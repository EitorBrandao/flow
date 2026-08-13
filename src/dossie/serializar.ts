import { calcularFaturas } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { Aba } from '../state/store';
import type { Roteiro, Passo } from './executar';
import type { ResultadoInvariante } from './invariantes';
import type { Retrato } from './retrato';
import { ABAS_DO_DOSSIE, type TelasDoCorte } from './tela';

export interface ArquivoDossie { nome: string; conteudo: string }

const TITULO_ABA: Partial<Record<Aba, string>> = {
  hoje: 'Hoje',
  fluxo: 'Fluxo',
  cartao: 'Cartão',
  analises: 'Análises',
  lancar: 'Lançar',
  ajustes: 'Ajustes',
};

function tituloAba(aba: Aba): string {
  return TITULO_ABA[aba] ?? aba;
}

/** Compara datas ISO `AAAA-MM-DD` na ordem cronológica. Sem `localeCompare`: um formato
 *  já ordenável por texto não precisa de colação de idioma, e evita qualquer surpresa. */
function porData(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Remove linhas em branco do fim, para nenhum arquivo terminar com mais de uma quebra. */
function finalizar(linhas: string[]): string {
  const copia = [...linhas];
  while (copia.length > 0 && copia[copia.length - 1] === '') copia.pop();
  return `${copia.join('\n')}\n`;
}

/**
 * `descricao` decide sozinha se termina em linha em branco: a tabela de invariantes não
 * quer uma entre o cabeçalho e a primeira linha, mas um parágrafo antes de uma seção quer.
 */
function abrirArquivo(titulo: string, descricao: string[]): string[] {
  return [`# ${titulo}`, '', 'Gerado por `npm run dossie`. Não edite à mão.', '', ...descricao];
}

function cabecalhoDoCorte(r: Retrato): string {
  return `## ${r.data} — ${r.rotulo}`;
}

// --- 00-roteiro.md ---------------------------------------------------------------------

function montarRoteiro(roteiro: Roteiro): string {
  const linhas = abrirArquivo('Roteiro', [
    'Os passos que o roteiro sintético do dossiê executa, em ordem cronológica.',
    '',
  ]);

  const passos: Passo[] = [...roteiro.passos].sort((a, b) => porData(a.data, b.data));
  let dataAtual: string | null = null;
  let numero = 0;
  for (const p of passos) {
    if (p.data !== dataAtual) {
      if (dataAtual !== null) linhas.push('');
      linhas.push(`## ${p.data}`, '');
      dataAtual = p.data;
      numero = 0;
    }
    numero += 1;
    linhas.push(`${numero}. ${p.descricao}`);
  }
  return finalizar(linhas);
}

// --- 01-invariantes.md ------------------------------------------------------------------

function montarInvariantes(resultados: ResultadoInvariante[]): string {
  const linhas = abrirArquivo('Invariantes', [
    'Um invariante **garantido** violado reprova o `npm test`. Um de **expectativa** só',
    'aparece aqui: o `docs/dominio.md` diz que o código não o promete.',
    '',
    '| Invariante | Classe | Corte | Resultado | Detalhe |',
    '|---|---|---|---|---|',
  ]);
  for (const r of [...resultados].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR') || a.corte.localeCompare(b.corte, 'pt-BR'))) {
    linhas.push(`| ${r.nome} | ${r.classe} | ${r.corte} | ${r.ok ? 'passa' : '**viola**'} | ${r.detalhe} |`);
  }
  return finalizar(linhas);
}

// --- 02-motor.md -------------------------------------------------------------------------

function montarMotor(retratos: Retrato[]): string {
  const linhas = abrirArquivo('Motor', [
    'Os números que o motor de projeção e de fatura calculou, um corte por vez.',
    '',
  ]);

  for (const r of [...retratos].sort((a, b) => porData(a.data, b.data))) {
    linhas.push(cabecalhoDoCorte(r), '', '### Saldos', '');
    linhas.push('| Box | Efetivo | Projetado | Com cenários |', '|---|---|---|---|');
    for (const s of [...r.saldos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))) {
      linhas.push(
        `| ${s.nome} | ${formatarBRL(s.efetivo)} | ${formatarBRL(s.projetado)} | ${formatarBRL(s.comCenarios)} |`,
      );
    }
    linhas.push('', '### Marcos da projeção', '');
    if (r.marcos.minimo === null || r.marcos.maximo === null) {
      linhas.push('Sem projeção neste corte.');
    } else {
      linhas.push(`- Mínimo: ${formatarBRL(r.marcos.minimo.saldoProjetado)} em ${r.marcos.minimo.data}`);
      linhas.push(`- Máximo: ${formatarBRL(r.marcos.maximo.saldoProjetado)} em ${r.marcos.maximo.data}`);
      for (const dia of r.marcos.fimDeMes) {
        linhas.push(`- Fim de mês ${dia.data.slice(0, 7)}: ${formatarBRL(dia.saldoProjetado)}`);
      }
    }

    linhas.push('', '### Faturas', '');
    // Recalcula por cartão, e não usa `r.faturas`: `Fatura` não guarda o id do cartão, e o
    // dossiê precisa nomeá-lo na tabela. `dados.cartoes` e `dados.comprasCartao` são a mesma
    // fonte que `tirarRetrato` usa; recalcular aqui só recupera a associação perdida no achatamento.
    const linhasFatura: string[] = [];
    for (const cartao of [...r.dados.cartoes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))) {
      const compras = r.dados.comprasCartao.filter((c) => c.cartaoId === cartao.id);
      const faturas = calcularFaturas(cartao, compras, r.dados.config.horizonteProjecao);
      for (const fatura of faturas) {
        linhasFatura.push(
          `| ${cartao.nome} | ${fatura.mes} | ${fatura.itens.length} | ${formatarBRL(fatura.totalCent)} |`,
        );
      }
    }
    if (linhasFatura.length === 0) {
      linhas.push('Nenhuma fatura neste corte.');
    } else {
      linhas.push('| Cartão | Ciclo | Itens | Total |', '|---|---|---|---|', ...linhasFatura);
    }

    linhas.push('', '### Lançamentos por status e origem', '');
    const combinacoes = Object.entries(r.contagemPorStatusOrigem)
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
    if (combinacoes.length === 0) {
      linhas.push('Nenhum lançamento neste corte.');
    } else {
      linhas.push('| Combinação | Quantos |', '|---|---|');
      for (const [chave, quantos] of combinacoes) linhas.push(`| ${chave} | ${quantos} |`);
    }
    linhas.push('');
  }
  return finalizar(linhas);
}

// --- 03-telas.md -------------------------------------------------------------------------

/** Casa cada retrato com a sua tela pelo índice: os dois entram na mesma ordem de corte
 *  (`coletarTelas` preserva a ordem de `retratos`). Um tamanho diferente é erro de
 *  programação do chamador — estoura em vez de gerar um dossiê incoerente. */
function parearCortes(
  retratos: Retrato[],
  telas: TelasDoCorte[],
): { retrato: Retrato; tela: TelasDoCorte }[] {
  if (retratos.length !== telas.length) {
    throw new Error(
      `montarDossie recebeu ${retratos.length} retratos e ${telas.length} telas: os dois precisam `
        + 'ter um item por corte, na mesma ordem.',
    );
  }
  return retratos.map((retrato, i) => ({ retrato, tela: telas[i] }));
}

function montarTelas(retratos: Retrato[], telas: TelasDoCorte[]): string {
  const linhas = abrirArquivo('Telas', [
    'O texto de cada aba, extraído do que a tela renderiza, um corte por vez.',
    '',
  ]);

  const cortes = parearCortes(retratos, telas)
    .sort((a, b) => porData(a.retrato.data, b.retrato.data));
  for (const { retrato, tela } of cortes) {
    linhas.push(cabecalhoDoCorte(retrato), '');
    for (const aba of ABAS_DO_DOSSIE) {
      linhas.push(`### Aba ${tituloAba(aba)}`, '', '```', tela.textos[aba] ?? '', '```', '');
    }
  }
  return finalizar(linhas);
}

// -------------------------------------------------------------------------------------------

export function montarDossie(
  roteiro: Roteiro,
  retratos: Retrato[],
  resultados: ResultadoInvariante[],
  telas: TelasDoCorte[],
): ArquivoDossie[] {
  return [
    { nome: '00-roteiro.md', conteudo: montarRoteiro(roteiro) },
    { nome: '01-invariantes.md', conteudo: montarInvariantes(resultados) },
    { nome: '02-motor.md', conteudo: montarMotor(retratos) },
    { nome: '03-telas.md', conteudo: montarTelas(retratos, telas) },
  ];
}
