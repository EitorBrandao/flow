import { diasEntre } from '../domain/dates';
import type { CompraCartao, Dados, ID, ISODate, Lancamento } from '../domain/types';
import { contraparteNubank, normalizarDescricao } from './descricao';
import type {
  AcaoItem, DecisaoTotal, DecisaoTroca, ItemConferencia, LancamentoBruto, LeituraAdapter,
} from './tipos';

/**
 * Sentinelas usadas no lugar da categoria real em `conferir`. No Flow, quem decide se um
 * valor soma ou subtrai no saldo é o tipo da categoria (`projection.ts`), não o sinal do
 * bruto — por isso não basta uma categoria só para todo lançamento novo de conta.
 *
 * Nada é gravado antes de o usuário confirmar: `aplicar` troca cada sentinela pela categoria
 * "A classificar" de verdade, criando-a só se algum item precisar dela.
 */
export const CATEGORIA_A_CLASSIFICAR = {
  ganho: 'a-classificar:ganho',
  gasto: 'a-classificar:gasto',
  cartao: 'a-classificar:cartao',
} as const;

export interface OpcoesConferencia {
  boxId: ID;
  cartaoId?: ID;
  /** Escolhida pelo sinal do bruto: positivo usa `ganho`, negativo usa `gasto`. Ver
   *  "A categoria padrão depende do sinal" na spec da conferência por extrato. */
  categoriasPadrao: { ganho: ID; gasto: ID };
  /** Só é exigida quando um bruto de cartão vira `novo` com `adicionarCompra`. Se ele casar
   *  como `confere`, `previsto` ou `divergente`, este campo nunca é lido. */
  categoriaCartaoPadraoId?: ID;
  toleranciaDias?: number;
}

/** Candidato do lado do app: um lançamento da box, ou uma compra de cartão. */
interface Candidato {
  id: ID;
  data: ISODate;
  valorCent: number;
  chave: string;
  ehPrevisto: boolean;
  ehCompra: boolean;
}

/** Uma fatura é mensal, então um pagamento nunca está a mais de um mês do vencimento dela.
 *  Sem este teto, um pagamento casaria com uma fatura vencida de meses atrás e a marcaria
 *  como paga. É um teto mais largo que o do casamento comum de propósito: pagar fatura
 *  adiantado ou atrasado é normal, comprar com trinta dias de defasagem não é. */
const TOLERANCIA_DIAS_FATURA = 31;

function diferencaEmDias(a: ISODate, b: ISODate): number {
  const [menor, maior] = a <= b ? [a, b] : [b, a];
  return diasEntre(menor, maior).length - 1;
}

function chaveDe(texto: string): string {
  return normalizarDescricao(contraparteNubank(texto));
}

/** O que identifica um bruto do lado do app. Para cartão, a nota da compra; para conta, a
 *  nota do lançamento. */
function chaveDoBruto(b: LancamentoBruto): string {
  return chaveDe(b.descricao);
}

function candidatosDaConta(dados: Dados, boxId: ID): Candidato[] {
  return dados.lancamentos
    .filter((l) => l.boxId === boxId && l.origem !== 'cartao' && l.origem !== 'transferencia')
    .map((l: Lancamento) => ({
      id: l.id, data: l.data, valorCent: l.valor,
      chave: chaveDe(l.nota ?? ''), ehPrevisto: l.status === 'previsto', ehCompra: false,
    }));
}

function candidatosDoCartao(dados: Dados, cartaoId: ID | undefined): Candidato[] {
  if (!cartaoId) return [];
  return dados.comprasCartao
    .filter((c) => c.cartaoId === cartaoId)
    .map((c: CompraCartao) => ({
      id: c.id, data: c.data, valorCent: c.valorTotal,
      chave: chaveDe(c.descricao ?? ''), ehPrevisto: false, ehCompra: true,
    }));
}

/**
 * Compara o que o banco mandou com o que o app tem, e devolve um item por decisão.
 *
 * O casamento é UM-PARA-UM e guloso: cada candidato casa no máximo uma vez. Sem isso, dois
 * lançamentos iguais no mesmo dia casam os dois com o mesmo registro — um vira `confere`, o
 * outro vira `novo`, e os dois estão errados.
 *
 * O `externalId` do bruto é lido do arquivo mas NÃO casa nada nesta entrega: `Lancamento` não
 * tem onde guardá-lo, então o app nunca tem um para comparar. Ver a entrega 3 na spec.
 *
 * Função pura: nada de IndexedDB, React ou arquivo. Todos os testes vivem disso.
 */
export function conferir(
  brutos: LancamentoBruto[], dados: Dados, opcoes: OpcoesConferencia,
): ItemConferencia[] {
  const tolerancia = opcoes.toleranciaDias ?? 3;
  const itens: ItemConferencia[] = [];
  const usados = new Set<ID>();

  const daConta = candidatosDaConta(dados, opcoes.boxId);
  const doCartao = candidatosDoCartao(dados, opcoes.cartaoId);

  const faturas = dados.lancamentos.filter(
    (l) => l.origem === 'cartao' && l.cartaoId === opcoes.cartaoId,
  );

  for (const b of brutos) {
    // 0. Linha de valor zero: não é gasto nem ganho, e virar lançamento de R$ 0,00 não serve
    // a nada — a categoria dele nem decidiria se soma ou subtrai no saldo. Fica visível, mas
    // nunca é gravada.
    if (b.valorCent === 0) {
      itens.push({
        estado: 'interno', bruto: b, acao: { tipo: 'ignorar' },
        aviso: 'Linha de valor zero; não entra no fluxo.',
      });
      continue;
    }

    // 1. Movimento interno e estorno: reconhecidos, nunca gravados.
    if (b.natureza === 'resgateInterno') {
      itens.push({ estado: 'interno', bruto: b, acao: { tipo: 'ignorar' } });
      continue;
    }
    if (b.natureza === 'aplicacaoInterna') {
      itens.push({
        estado: 'interno', bruto: b, acao: { tipo: 'ignorar' },
        aviso: 'Guardar na caixinha é movimento interno. Se este dinheiro foi para uma '
          + 'reserva que você não conta, marque como saída de verdade.',
      });
      continue;
    }
    if (b.natureza === 'estornoCartao') {
      itens.push({
        estado: 'interno', bruto: b, acao: { tipo: 'ignorar' },
        aviso: 'Estorno reconhecido. Esta versão ainda não grava estorno de cartão.',
      });
      continue;
    }

    // 2. Pagamento da fatura: casa contra o lançamento da fatura, nunca vira compra.
    if (b.natureza === 'pagamentoFatura') {
      const alvo = faturas
        .filter((f) => !usados.has(f.id) && diferencaEmDias(f.data, b.data) <= TOLERANCIA_DIAS_FATURA)
        .sort((x, y) => diferencaEmDias(x.data, b.data) - diferencaEmDias(y.data, b.data))[0];
      if (!alvo) {
        itens.push({
          estado: 'novo', bruto: b, acao: { tipo: 'ignorar' },
          aviso: 'Pagamento sem fatura correspondente no Flow. Confira se o cartão está '
            + 'cadastrado e se o ciclo está certo.',
        });
        continue;
      }
      usados.add(alvo.id);
      const valorCent = Math.abs(b.valorCent);
      const igual = alvo.status === 'efetivo' && alvo.valor === valorCent;
      itens.push({
        estado: igual ? 'confere' : alvo.status === 'previsto' ? 'previsto' : 'divergente',
        bruto: b, lancamentoId: alvo.id,
        acao: igual
          ? { tipo: 'ignorar' }
          : { tipo: 'confirmarComValor', valorCent, data: b.data },
      });
      continue;
    }

    // 3. Casamento comum.
    const universo = b.fonte === 'cartao' ? doCartao : daConta;
    const valorCent = Math.abs(b.valorCent);
    const chave = chaveDoBruto(b);

    const perto = universo
      .filter((c) => !usados.has(c.id)
        && c.chave === chave
        && diferencaEmDias(c.data, b.data) <= tolerancia)
      .sort((x, y) => diferencaEmDias(x.data, b.data) - diferencaEmDias(y.data, b.data));

    const exato = perto.find((c) => c.valorCent === valorCent);
    if (exato) {
      usados.add(exato.id);
      itens.push({
        estado: exato.ehPrevisto ? 'previsto' : 'confere',
        bruto: b, ...refDe(exato),
        acao: exato.ehPrevisto ? { tipo: 'confirmar' } : { tipo: 'ignorar' },
      });
      continue;
    }

    const divergente = perto[0];
    if (divergente) {
      usados.add(divergente.id);
      itens.push({
        estado: 'divergente', bruto: b, ...refDe(divergente),
        acao: { tipo: 'confirmarComValor', valorCent, data: b.data },
      });
      continue;
    }

    if (b.fonte === 'cartao') {
      const categoriaCartaoId = opcoes.categoriaCartaoPadraoId;
      if (categoriaCartaoId == null) {
        itens.push({
          estado: 'novo', bruto: b, acao: { tipo: 'ignorar' },
          aviso: 'Compra de cartão sem categoria de destino. Escolha o cartão na tela de '
            + 'conferência antes de confirmar.',
        });
        continue;
      }
      // O bruto já traz a data da compra original, resolvida pelo adapter da fatura, e o
      // valor de UMA parcela. O total da compra é a parcela vezes o número de parcelas —
      // é a única estimativa possível, porque a fatura informa uma parcela só.
      // Sem isto, `aplicar` grava o valor da parcela como se fosse o total da compra.
      const compraReconstruida = b.parcela
        ? {
            data: b.data,
            valorTotalCent: Math.abs(b.valorCent) * b.parcela.total,
            parcelas: b.parcela.total,
            anoDeduzidoComAviso: false,
          }
        : undefined;
      itens.push({
        estado: 'novo', bruto: b,
        acao: { tipo: 'adicionarCompra', categoriaCartaoId },
        ...(compraReconstruida ? { compraReconstruida } : {}),
      });
    } else {
      // O tipo da categoria decide se o valor soma ou subtrai no saldo (`projection.ts`).
      // Gravar uma entrada na categoria de gasto tiraria o valor da projeção em vez de somar.
      const categoriaId = b.valorCent > 0 ? opcoes.categoriasPadrao.ganho : opcoes.categoriasPadrao.gasto;
      itens.push({
        estado: 'novo', bruto: b,
        acao: { tipo: 'adicionarLancamento', categoriaId },
      });
    }
  }

  // 4. Sobra: o que o app tem, dentro do período do arquivo, e o arquivo não tem.
  const datas = brutos.map((b) => b.data).sort();
  if (datas.length > 0) {
    const [inicio, fim] = [datas[0], datas[datas.length - 1]];
    for (const c of [...daConta, ...doCartao]) {
      if (usados.has(c.id)) continue;
      if (c.data < inicio || c.data > fim) continue;
      itens.push({ estado: 'sobra', ...refDe(c), acao: { tipo: 'ignorar' } });
    }
  }

  return itens;
}

function refDe(c: Candidato): { lancamentoId: ID } | { compraCartaoId: ID } {
  return c.ehCompra ? { compraCartaoId: c.id } : { lancamentoId: c.id };
}

/**
 * Identidade estável de um item de conferência, usada para chavear as decisões do usuário
 * (`DecisaoTroca`, `DecisaoTotal`) em vez do índice dele na lista exibida.
 *
 * A lista se refaz a cada troca de destino — trocar o cartão de um bloco desloca o `flatMap`
 * de todos os blocos seguintes —, mas esta chave não muda enquanto o arquivo lido não mudar.
 *
 * Para item com `bruto`, a chave é a posição dele em `leitura.brutos`: é a MESMA referência de
 * objeto usada para montar o item, então `indexOf` acha a posição certa, e essa posição nunca
 * muda porque `leitura` só é recriada quando um novo arquivo é lido. Para "sobra" (sem
 * `bruto`), a chave é o que o item referencia do lado do app.
 */
export function chaveDoItem(item: ItemConferencia, leitura: LeituraAdapter): string {
  if (item.bruto) return `bruto:${leitura.brutos.indexOf(item.bruto)}`;
  if (item.compraCartaoId) return `sobra:${item.compraCartaoId}`;
  if (item.lancamentoId) return `sobra:${item.lancamentoId}`;
  return 'sobra:desconhecido';
}

/** A ação a aplicar de fato: a da decisão do usuário, só se ela foi tomada para o MESMO
 *  `estado` em que o item está agora; senão, a ação padrão que `conferir` propôs. */
export function acaoEfetiva(item: ItemConferencia, decisao: DecisaoTroca | undefined): AcaoItem {
  return decisao && decisao.estado === item.estado ? decisao.acao : item.acao;
}

/** Mesmo critério de `acaoEfetiva`, para a correção do total de uma compra reconstruída. */
export function totalEfetivo(item: ItemConferencia, decisao: DecisaoTotal | undefined): number | undefined {
  return decisao && decisao.estado === item.estado ? decisao.valorCent : undefined;
}

/**
 * Um total corrigido menor que o valor de UMA parcela não faz sentido — nem zero. Abaixo do
 * mínimo, a correção não é aplicada: `aplicar` grava o total reconstruído original.
 */
export function totalCorrigidoValido(
  item: ItemConferencia, totalCorrigidoCent: number | undefined,
): number | undefined {
  if (totalCorrigidoCent == null) return undefined;
  const minimoParcela = item.bruto ? Math.abs(item.bruto.valorCent) : 0;
  return totalCorrigidoCent >= minimoParcela ? totalCorrigidoCent : undefined;
}
