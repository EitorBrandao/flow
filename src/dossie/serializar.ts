import { formatarBRL } from '../domain/money';
import type { Aba } from '../state/store';
import type { Roteiro, Passo, Corte } from './executar';
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

/** Um item da linha do tempo do roteiro: ou um passo, ou um corte, cada um com sua posição
 *  de origem — usada só para o desempate dentro da mesma data. */
type ItemDoRoteiro =
  | { tipo: 'passo'; data: string; indice: number; passo: Passo }
  | { tipo: 'corte'; data: string; indice: number; corte: Corte };

/** Junta passos e cortes numa única linha do tempo, na mesma ordem que `executarRoteiro`
 *  (`src/dossie/executar.ts`) usa para rodar o roteiro: na mesma data, todo passo vem antes
 *  de todo corte, porque o retrato é tirado com o passo do dia já aplicado. */
function linhaDoTempo(roteiro: Roteiro): ItemDoRoteiro[] {
  return [
    ...roteiro.passos.map((passo, indice) => ({ tipo: 'passo' as const, data: passo.data, indice, passo })),
    ...roteiro.cortes.map((corte, indice) => ({ tipo: 'corte' as const, data: corte.data, indice, corte })),
  ].sort((a, b) => {
    if (a.data !== b.data) return porData(a.data, b.data);
    if (a.tipo !== b.tipo) return a.tipo === 'passo' ? -1 : 1;
    return a.indice - b.indice;
  });
}

function montarRoteiro(roteiro: Roteiro): string {
  const linhas = abrirArquivo('Roteiro', [
    'Os passos que o roteiro sintético do dossiê executa, em ordem cronológica.',
    '',
    'Uma citação marca cada corte, no instante em que o dossiê tira o retrato. Quando um '
      + 'corte cai na mesma data de um passo, o corte vem depois: o retrato é tirado com o '
      + 'passo do dia já aplicado.',
    '',
  ]);

  let dataAtual: string | null = null;
  let numero = 0;
  let ultimoTipo: 'passo' | 'corte' | null = null;
  for (const item of linhaDoTempo(roteiro)) {
    if (item.data !== dataAtual) {
      if (dataAtual !== null) linhas.push('');
      linhas.push(`## ${item.data}`, '');
      dataAtual = item.data;
      numero = 0;
      ultimoTipo = null;
    }
    if (item.tipo === 'passo') {
      numero += 1;
      linhas.push(`${numero}. ${item.passo.descricao}`);
    } else {
      if (ultimoTipo === 'passo') linhas.push('');
      linhas.push(`> **Corte: ${item.corte.rotulo}.** O dossiê tira o retrato aqui.`);
    }
    ultimoTipo = item.tipo;
  }
  return finalizar(linhas);
}

// --- 01-invariantes.md ------------------------------------------------------------------

/** Compara dois resultados: primeiro por nome do invariante (para a tabela ficar agrupada
 *  por invariante), depois pela posição cronológica do corte — nunca pelo rótulo do corte,
 *  que é texto solto, sem ordem alguma. Um rótulo fora de `ordemCorte` é erro de programação
 *  do chamador: `montarInvariantes` sempre recebe resultados dos mesmos cortes de `retratos`. */
function porInvarianteECorte(
  ordemCorte: Map<string, number>,
): (a: ResultadoInvariante, b: ResultadoInvariante) => number {
  return (a, b) => {
    const porNome = a.nome.localeCompare(b.nome, 'pt-BR');
    if (porNome !== 0) return porNome;
    const ordemA = ordemCorte.get(a.corte);
    const ordemB = ordemCorte.get(b.corte);
    if (ordemA === undefined) throw new Error(`corte "${a.corte}" não está na lista de retratos`);
    if (ordemB === undefined) throw new Error(`corte "${b.corte}" não está na lista de retratos`);
    return ordemA - ordemB;
  };
}

function montarInvariantes(resultados: ResultadoInvariante[], ordemCorte: Map<string, number>): string {
  const linhas = abrirArquivo('Invariantes', [
    'Um invariante **garantido** violado reprova o `npm test`. Um de **expectativa** só',
    'aparece aqui: o `docs/dominio.md` diz que o código não o promete.',
    '',
    '| Invariante | Classe | Corte | Resultado | Detalhe |',
    '|---|---|---|---|---|',
  ]);
  for (const r of [...resultados].sort(porInvarianteECorte(ordemCorte))) {
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
    const linhasFatura = r.faturas.map(({ cartao, fatura }) => (
      `| ${cartao.nome} | ${fatura.mes} | ${fatura.itens.length} | ${formatarBRL(fatura.totalCent)} |`
    ));
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
  const ordemCorte = new Map(retratos.map((r, i) => [r.rotulo, i] as const));
  return [
    { nome: '00-roteiro.md', conteudo: montarRoteiro(roteiro) },
    { nome: '01-invariantes.md', conteudo: montarInvariantes(resultados, ordemCorte) },
    { nome: '02-motor.md', conteudo: montarMotor(retratos) },
    { nome: '03-telas.md', conteudo: montarTelas(retratos, telas) },
  ];
}
