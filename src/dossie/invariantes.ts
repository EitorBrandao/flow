import { gerarBackup, validarBackup } from '../backup/backup';
import { categoriasCartaoReservadasIds } from '../domain/categorias';
import { calcularFaturas, categoriasFaturaIds, valorSincronizado } from '../domain/fatura';
import { projetarBoxes } from '../domain/projection';
import type { Dados, ISODate } from '../domain/types';
import { viagensSobrepoem } from '../domain/viagem';
import { PREFIXO_EXCECAO, type TelasDoCorte } from './tela';
import type { Retrato } from './retrato';

export type ClasseInvariante = 'garantido' | 'expectativa';

export interface Achado { ok: boolean; detalhe: string }

export interface Invariante {
  nome: string;
  classe: ClasseInvariante;
  /** Sobre um corte. */
  checar?(r: Retrato): Achado;
  /** Sobre dois cortes seguidos. Não roda no primeiro. */
  checarPar?(anterior: Retrato, atual: Retrato): Achado;
}

const OK: Achado = { ok: true, detalhe: '—' };

/** Todo campo monetário conhecido do snapshot, com um rótulo que nomeia o registro. */
function valoresMonetariosDe(dados: Dados): { rotulo: string; valor: number | null | undefined }[] {
  const saida: { rotulo: string; valor: number | null | undefined }[] = [];
  for (const b of dados.boxes) {
    saida.push({ rotulo: `box ${b.id}.saldoInicial`, valor: b.saldoInicial });
    saida.push({ rotulo: `box ${b.id}.saldoDeclaradoCent`, valor: b.saldoDeclaradoCent });
  }
  for (const banco of dados.bancos) {
    saida.push({ rotulo: `banco ${banco.id}.saldoDeclaradoCent`, valor: banco.saldoDeclaradoCent });
  }
  for (const l of dados.lancamentos) saida.push({ rotulo: `lançamento ${l.id}.valor`, valor: l.valor });
  for (const rc of dados.recorrencias) saida.push({ rotulo: `recorrência ${rc.id}.valor`, valor: rc.valor });
  for (const c of dados.comprasCartao) saida.push({ rotulo: `compra ${c.id}.valorTotal`, valor: c.valorTotal });
  for (const rcc of dados.recorrenciasCartao) saida.push({ rotulo: `assinatura ${rcc.id}.valor`, valor: rcc.valor });
  for (const cf of dados.conferenciasFatura) {
    saida.push({ rotulo: `conferência ${cf.id}.valorAppCent`, valor: cf.valorAppCent });
  }
  saida.push({ rotulo: 'config.saldoDeclaradoCent', valor: dados.config.saldoDeclaradoCent });
  return saida;
}

/** Todo campo de data ISO conhecido do snapshot, com um rótulo que nomeia o registro. */
function datasDe(dados: Dados): { rotulo: string; data: string | null | undefined }[] {
  const saida: { rotulo: string; data: string | null | undefined }[] = [];
  for (const b of dados.boxes) {
    saida.push({ rotulo: `box ${b.id}.dataSaldoInicial`, data: b.dataSaldoInicial });
    saida.push({ rotulo: `box ${b.id}.dataSaldoDeclarado`, data: b.dataSaldoDeclarado });
  }
  for (const banco of dados.bancos) {
    saida.push({ rotulo: `banco ${banco.id}.dataSaldoDeclarado`, data: banco.dataSaldoDeclarado });
  }
  for (const l of dados.lancamentos) saida.push({ rotulo: `lançamento ${l.id}.data`, data: l.data });
  for (const rc of dados.recorrencias) saida.push({ rotulo: `recorrência ${rc.id}.dataInicio`, data: rc.dataInicio });
  for (const c of dados.comprasCartao) saida.push({ rotulo: `compra ${c.id}.data`, data: c.data });
  for (const rcc of dados.recorrenciasCartao) {
    saida.push({ rotulo: `assinatura ${rcc.id}.dataInicio`, data: rcc.dataInicio });
  }
  for (const v of dados.viagens) {
    saida.push({ rotulo: `viagem ${v.id}.dataInicio`, data: v.dataInicio });
    saida.push({ rotulo: `viagem ${v.id}.dataFim`, data: v.dataFim });
  }
  saida.push({ rotulo: 'config.dataSaldoDeclarado', data: dados.config.dataSaldoDeclarado });
  saida.push({ rotulo: 'config.horizonteProjecao', data: dados.config.horizonteProjecao });
  return saida;
}

/**
 * Aponta onde `ida` e `volta` divergem, nomeando a coleção e, quando dá, o registro e o
 * campo. Devolve `null` se não achar diferença (não deveria acontecer quando chamada só
 * após o `JSON.stringify` dos dois já ter dado diferente).
 */
function diferencaDeBackup(ida: Dados, volta: Dados): string | null {
  for (const chave of Object.keys(ida) as (keyof Dados)[]) {
    if (chave === 'config') {
      const antes = JSON.stringify(ida.config);
      const depois = JSON.stringify(volta.config);
      if (antes !== depois) return `a coleção config voltou diferente: era ${antes}, voltou ${depois}`;
      continue;
    }
    const listaIda = ida[chave] as { id: string }[];
    const listaVolta = volta[chave] as { id: string }[] | undefined;
    if (!Array.isArray(listaVolta)) {
      return `a coleção ${chave} não existe no backup que voltou`;
    }
    if (listaIda.length !== listaVolta.length) {
      return `a coleção ${chave} voltou com ${listaVolta.length} registros, ida tinha ${listaIda.length}`;
    }
    const voltaPorId = new Map(listaVolta.map((reg) => [reg.id, reg]));
    for (const registroIda of listaIda) {
      const registroVolta = voltaPorId.get(registroIda.id);
      if (!registroVolta) {
        return `a coleção ${chave} não tem mais o registro ${registroIda.id} depois de voltar`;
      }
      for (const campo of Object.keys(registroIda) as (keyof typeof registroIda)[]) {
        const valorIda = (registroIda as Record<string, unknown>)[campo as string];
        const valorVolta = (registroVolta as Record<string, unknown>)[campo as string];
        if (JSON.stringify(valorIda) !== JSON.stringify(valorVolta)) {
          return `registro ${registroIda.id} da coleção ${chave} voltou diferente: campo ${String(campo)} `
            + `era ${JSON.stringify(valorIda)}, voltou ${JSON.stringify(valorVolta)}`;
        }
      }
    }
  }
  return null;
}

export const INVARIANTES: Invariante[] = [
  {
    nome: 'referências resolvem',
    classe: 'garantido',
    checar(r) {
      const boxes = new Set(r.dados.boxes.map((b) => b.id));
      const categorias = new Set(r.dados.categorias.map((c) => c.id));
      for (const l of r.dados.lancamentos) {
        if (!boxes.has(l.boxId)) {
          return { ok: false, detalhe: `lançamento ${l.id} aponta para a box ${l.boxId}, que não existe` };
        }
        if (!categorias.has(l.categoriaId)) {
          return { ok: false, detalhe: `lançamento ${l.id} aponta para a categoria ${l.categoriaId}, que não existe` };
        }
      }
      return OK;
    },
  },

  // A soma dos itens da fatura só é comparada ao lançamento de fatura quando este ainda é
  // `previsto`: `registrarPagamentoFatura` (o único caminho que reescreve um `efetivo`) grava o
  // valor realmente pago, que pode ser menor que o total — divergência legítima, não bug.
  // O alvo é `valorSincronizado`, não a soma bruta dos itens: quando existe `ConferenciaFatura`
  // com `usarValorApp`, é esse valor — não a soma — que `diffSincronizacao` grava no lançamento
  // (`docs/dominio.md`, seção do ciclo da fatura). Faturas sem lançamento correspondente são
  // puladas: um vencimento já passado no momento em que a sincronização rodou pela primeira vez
  // nunca ganha lançamento (`diffSincronizacao` só cria com `data > hoje`), e isso não é bug.
  {
    nome: 'fatura bate com os itens',
    classe: 'garantido',
    checar(r) {
      for (const cartao of r.dados.cartoes) {
        const compras = r.dados.comprasCartao.filter((c) => c.cartaoId === cartao.id);
        const faturas = calcularFaturas(cartao, compras, r.dados.config.horizonteProjecao);
        for (const fatura of faturas) {
          const lanc = r.dados.lancamentos.find(
            (l) => l.origem === 'cartao' && l.cartaoId === cartao.id && l.faturaMes === fatura.mes,
          );
          if (!lanc || lanc.status === 'efetivo') continue;
          const conf = r.dados.conferenciasFatura.find((c) => c.cartaoId === cartao.id && c.mes === fatura.mes);
          const esperado = valorSincronizado(fatura, conf);
          if (lanc.valor !== esperado) {
            return {
              ok: false,
              detalhe: `fatura do cartão ${cartao.id} (${cartao.nome}), mês ${fatura.mes}: itens somam `
                + `${esperado}, mas o lançamento ${lanc.id} tem valor ${lanc.valor}`,
            };
          }
        }
      }
      return OK;
    },
  },

  {
    nome: 'efetivo não some',
    classe: 'garantido',
    checarPar(anterior, atual) {
      const agora = new Set(atual.dados.lancamentos.map((l) => l.id));
      const sumido = anterior.dados.lancamentos.find((l) => l.status === 'efetivo' && !agora.has(l.id));
      return sumido
        ? { ok: false, detalhe: `lançamento efetivo ${sumido.id} (${sumido.data}) existia em "${anterior.rotulo}" e sumiu` }
        : OK;
    },
  },

  {
    nome: 'efetivo não volta a previsto',
    classe: 'garantido',
    checarPar(anterior, atual) {
      const efetivosAntes = new Set(
        anterior.dados.lancamentos.filter((l) => l.status === 'efetivo').map((l) => l.id),
      );
      const porAtual = new Map(atual.dados.lancamentos.map((l) => [l.id, l]));
      for (const id of efetivosAntes) {
        const l = porAtual.get(id);
        if (l && l.status !== 'efetivo') {
          return {
            ok: false,
            detalhe: `lançamento ${l.id} (${l.data}) era efetivo em "${anterior.rotulo}" e voltou a `
              + `"${l.status}" em "${atual.rotulo}"`,
          };
        }
      }
      return OK;
    },
  },

  {
    nome: 'uma conferência por cartão e mês',
    classe: 'garantido',
    checar(r) {
      const vistos = new Map<string, string>();
      for (const c of r.dados.conferenciasFatura) {
        const chave = `${c.cartaoId}|${c.mes}`;
        const outroId = vistos.get(chave);
        if (outroId) {
          return {
            ok: false,
            detalhe: `conferências ${outroId} e ${c.id} repetem o cartão ${c.cartaoId} no mês ${c.mes}`,
          };
        }
        vistos.set(chave, c.id);
      }
      return OK;
    },
  },

  // Verifica a integridade referencial do mecanismo de esconder: as categorias reservadas
  // continuam existindo (senão a fatura perderia onde cair) e nenhum lançamento fora da origem
  // 'cartao' usa a categoria de fatura — essa é a única forma de "vazamento" que dá para checar
  // sem depender de texto de tela. Não checa uso de categoria de cartão reservada por
  // CompraCartao: o parcelamento de fatura (`registrarPagamentoFatura`) e a assinatura sem
  // categoria escolhida (`Assinaturas.tsx`) usam essas categorias de propósito, e nada no
  // snapshot distingue essa origem legítima de uma seleção manual indevida.
  {
    nome: 'categoria de fatura só é usada pelo cartão',
    classe: 'garantido',
    checar(r) {
      const idsCategoria = categoriasFaturaIds(r.dados.cartoes);
      const categorias = new Set(r.dados.categorias.map((c) => c.id));
      for (const id of idsCategoria) {
        if (!categorias.has(id)) {
          return { ok: false, detalhe: `categoria de fatura ${id} não existe mais em categorias` };
        }
      }
      const vazamento = r.dados.lancamentos.find(
        (l) => l.origem !== 'cartao' && idsCategoria.has(l.categoriaId),
      );
      if (vazamento) {
        return {
          ok: false,
          detalhe: `lançamento ${vazamento.id} (origem ${vazamento.origem}) usa a categoria de fatura `
            + `${vazamento.categoriaId}, que deveria ficar escondida da seleção manual`,
        };
      }
      const idsCategoriaCartao = categoriasCartaoReservadasIds(r.dados.cartoes);
      const categoriasCartao = new Set(r.dados.categoriasCartao.map((c) => c.id));
      for (const id of idsCategoriaCartao) {
        if (!categoriasCartao.has(id)) {
          return { ok: false, detalhe: `categoria de cartão reservada ${id} não existe mais em categoriasCartao` };
        }
      }
      return OK;
    },
  },

  {
    nome: 'backup dá a volta',
    classe: 'garantido',
    checar(r) {
      const ida = gerarBackup(r.dados);
      const volta = validarBackup(JSON.parse(JSON.stringify(ida)));
      const antes = JSON.stringify(ida.dados);
      const depois = JSON.stringify(volta.dados);
      if (antes === depois) return OK;
      const detalhe = diferencaDeBackup(ida.dados, volta.dados);
      return {
        ok: false,
        detalhe: detalhe ?? 'exportar e reimportar mudou os dados, mas a divergência não pôde ser isolada',
      };
    },
  },

  // A série sai fresca de `projetarBoxes`, chamada aqui — e não do campo `serie` do Retrato —
  // de propósito: `Retrato.serie` é congelado no instante de `tirarRetrato`, mas alguns testes
  // deste arquivo mutam `r.dados` depois de o Retrato existir. Usar o campo congelado compararia
  // uma série velha com lançamentos novos e reprovaria por uma inconsistência do teste, não do
  // app. Recalcular aqui mantém série e lançamentos sempre da mesma fonte. O sinal segue o tipo
  // da categoria, não o valor (`src/domain/projection.ts:53`): ganho soma, gasto subtrai, sempre
  // com `valor` positivo. Lançamentos com `data <= dataSaldoInicial` da própria box são pulados:
  // a projeção os trata como já embutidos no saldo inicial. Cenário nunca entra em `saldoProjetado`.
  {
    nome: 'projeção acumula',
    classe: 'garantido',
    checar(r) {
      const todasAsBoxes = r.dados.boxes.map((b) => b.id);
      const cenariosLigados = new Set(r.dados.cenarios.filter((c) => c.ligado).map((c) => c.id));
      const serie = projetarBoxes(todasAsBoxes, {
        boxes: r.dados.boxes,
        categorias: r.dados.categorias,
        lancamentos: r.dados.lancamentos,
        cenariosLigados,
        horizonte: r.dados.config.horizonteProjecao,
      });
      if (serie.length === 0) return OK; // nenhuma box com saldo inicial: nada a conferir
      const boxesPorId = new Map(r.dados.boxes.map((b) => [b.id, b]));
      const categoriasPorId = new Map(r.dados.categorias.map((c) => [c.id, c]));
      const deltaDoDia = (dia: ISODate): number => {
        let delta = 0;
        for (const l of r.dados.lancamentos) {
          if (l.cenarioId || l.data !== dia) continue;
          const box = boxesPorId.get(l.boxId);
          if (!box) continue; // referência quebrada é achado de outro invariante
          if (box.dataSaldoInicial != null && l.data <= box.dataSaldoInicial) continue;
          const tipo = categoriasPorId.get(l.categoriaId)?.tipo ?? 'gasto';
          delta += (tipo === 'ganho' ? 1 : -1) * l.valor;
        }
        return delta;
      };
      const base = r.dados.boxes.reduce((s, b) => s + (b.saldoInicial ?? 0), 0);
      let esperado = base + deltaDoDia(serie[0].data);
      if (serie[0].saldoProjetado !== esperado) {
        return {
          ok: false,
          detalhe: `dia ${serie[0].data}: saldoProjetado é ${serie[0].saldoProjetado}, esperado `
            + `${esperado} (saldo inicial das boxes + lançamentos do dia)`,
        };
      }
      for (let i = 1; i < serie.length; i++) {
        esperado = serie[i - 1].saldoProjetado + deltaDoDia(serie[i].data);
        if (serie[i].saldoProjetado !== esperado) {
          return {
            ok: false,
            detalhe: `dia ${serie[i].data}: saldoProjetado é ${serie[i].saldoProjetado}, esperado `
              + `${esperado} (dia anterior + lançamentos do dia)`,
          };
        }
      }
      return OK;
    },
  },

  {
    nome: 'cenário nunca é efetivo',
    classe: 'expectativa',
    checar(r) {
      const culpado = r.dados.lancamentos.find((l) => l.cenarioId && l.status === 'efetivo');
      return culpado
        ? { ok: false, detalhe: `lançamento ${culpado.id} é de cenário e está efetivo` }
        : OK;
    },
  },

  {
    nome: 'viagens não se sobrepõem',
    classe: 'expectativa',
    checar(r) {
      const viagens = r.dados.viagens;
      for (const v of viagens) {
        if (viagensSobrepoem(viagens, v.dataInicio, v.dataFim, v.id)) {
          const outra = viagens.find(
            (o) => o.id !== v.id && v.dataInicio <= o.dataFim && v.dataFim >= o.dataInicio,
          );
          return {
            ok: false,
            detalhe: `viagem ${v.id} (${v.nome}) se sobrepõe com ${outra?.id ?? '?'} (${outra?.nome ?? '?'})`,
          };
        }
      }
      return OK;
    },
  },

  {
    nome: 'dinheiro é inteiro',
    classe: 'expectativa',
    checar(r) {
      for (const { rotulo, valor } of valoresMonetariosDe(r.dados)) {
        if (valor != null && !Number.isInteger(valor)) {
          return { ok: false, detalhe: `${rotulo} é ${valor}, não é um inteiro de centavos` };
        }
      }
      return OK;
    },
  },

  {
    nome: 'datas são AAAA-MM-DD',
    classe: 'expectativa',
    checar(r) {
      const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
      for (const { rotulo, data } of datasDe(r.dados)) {
        if (data != null && !RE_DATA.test(data)) {
          return { ok: false, detalhe: `${rotulo} é "${data}", não bate com o formato AAAA-MM-DD` };
        }
      }
      return OK;
    },
  },
];

export interface ResultadoInvariante {
  nome: string;
  classe: ClasseInvariante;
  corte: string;
  ok: boolean;
  detalhe: string;
}

export function checarTudo(retratos: Retrato[]): ResultadoInvariante[] {
  const saida: ResultadoInvariante[] = [];
  for (const inv of INVARIANTES) {
    retratos.forEach((r, i) => {
      if (inv.checar) {
        const a = inv.checar(r);
        saida.push({ nome: inv.nome, classe: inv.classe, corte: r.rotulo, ...a });
      }
      if (inv.checarPar && i > 0) {
        const a = inv.checarPar(retratos[i - 1], r);
        saida.push({ nome: inv.nome, classe: inv.classe, corte: r.rotulo, ...a });
      }
    });
  }
  return saida;
}

/**
 * Uma linha de `resumirNo` casa com `nome` se ela é o nome sozinho, ou o nome com um
 * prefixo de papel (`"option: sigma"`, `"label: sigma"`...). Comparar a linha inteira, e não
 * por `includes`, evita falso positivo com qualquer palavra que só contenha o nome.
 */
function linhaCasaComNome(linha: string, nome: string): boolean {
  if (linha === nome) return true;
  const doisPontos = linha.indexOf(': ');
  return doisPontos !== -1 && linha.slice(doisPontos + 2) === nome;
}

/**
 * O invariante das telas mora aqui, e não em INVARIANTES, porque lê texto de tela — que o
 * Retrato não carrega. Juntar os dois acoplaria o executor à UI.
 *
 * `telas` e `retratos` casam por índice: `coletarTelas` preserva a ordem dos cortes, então
 * `telas[i]` é sempre o mesmo corte que `retratos[i]`. Não confiar cegamente nisso — um
 * tamanho diferente é erro de programação do chamador, não achado de dossiê, e por isso
 * estoura em vez de produzir um resultado incoerente.
 */
export function checarTelas(telas: TelasDoCorte[], retratos: Retrato[]): ResultadoInvariante[] {
  if (telas.length !== retratos.length) {
    throw new Error(
      `checarTelas recebeu ${telas.length} telas e ${retratos.length} retratos: os dois têm que `
        + 'ter um item por corte, na mesma ordem.',
    );
  }
  const saida: ResultadoInvariante[] = [];
  telas.forEach((t, i) => {
    const quebrada = Object.entries(t.textos).find(([, texto]) => texto.startsWith(PREFIXO_EXCECAO));
    saida.push({
      nome: 'nenhuma tela lança',
      classe: 'garantido',
      corte: t.rotulo,
      ok: !quebrada,
      detalhe: quebrada
        ? `a aba ${quebrada[0]} estourou: ${quebrada[1].slice(PREFIXO_EXCECAO.length)}`
        : '—',
    });

    // O nome de uma categoria de fatura é sempre igual ao nome do cartão (`src/db/repo.ts`,
    // `salvarCartao`). Checar a aba `lancar` — a lista de seleção manual de verdade — é o
    // que a tabela do plano pede, e é o que o invariante de referência não consegue checar.
    const retrato = retratos[i];
    const idsCategoriaFatura = categoriasFaturaIds(retrato.dados.cartoes);
    const categoriasPorId = new Map(retrato.dados.categorias.map((c) => [c.id, c]));
    const linhasLancar = (t.textos.lancar ?? '').split('\n');
    let vazamento: { nomeCategoria: string; linha: string } | undefined;
    for (const id of idsCategoriaFatura) {
      const nome = categoriasPorId.get(id)?.nome;
      if (nome == null) continue; // categoria apagada é achado de outro invariante
      const linha = linhasLancar.find((l) => linhaCasaComNome(l, nome));
      if (linha) {
        vazamento = { nomeCategoria: nome, linha };
        break;
      }
    }
    saida.push({
      nome: 'categoria de fatura fica escondida',
      classe: 'garantido',
      corte: t.rotulo,
      ok: !vazamento,
      detalhe: vazamento
        ? `a categoria de fatura "${vazamento.nomeCategoria}" apareceu na aba lancar, na linha `
          + `"${vazamento.linha}"`
        : '—',
    });
  });
  return saida;
}
