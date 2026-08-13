import { render, cleanup } from '@testing-library/react';
import { useApp, type Aba } from '../state/store';
import Shell from '../ui/Shell';
import type { Retrato } from './retrato';

/** Uma tela que estoura não derruba a geração — o estrago entra no dossiê e é julgado lá. */
export const PREFIXO_EXCECAO = '⚠ a tela lançou exceção: ';

export interface TelasDoCorte { rotulo: string; textos: Record<string, string> }

/** As telas que entram no dossiê. Sheets e subtelas de Ajustes ficam fora nesta volta. */
export const ABAS_DO_DOSSIE: Aba[] = ['hoje', 'fluxo', 'cartao', 'analises', 'lancar', 'ajustes'];

const PAPEL_POR_TAG: Record<string, string> = {
  H1: 'heading', H2: 'heading', H3: 'heading', H4: 'heading',
  BUTTON: 'button', A: 'link', LI: 'listitem', OPTION: 'option',
  TD: 'cell', TH: 'columnheader', LABEL: 'label',
};

function papelDe(el: Element): string | null {
  return el.getAttribute('role') ?? PAPEL_POR_TAG[el.tagName] ?? null;
}

function temFilhoComTexto(el: Element): boolean {
  return Array.from(el.children).some((f) => (f.textContent ?? '').trim() !== '');
}

/**
 * Recolhe o texto de folha da árvore, em ordem de documento.
 *
 * Só o texto e o papel entram. Classe, estilo e id ficam de fora por construção — é o que
 * impede o dossiê de mexer quando alguém troca uma classe de CSS. Reestruturar markup
 * move a saída, e isso é desejado: reestruturação é mudança de verdade.
 */
export function resumirNo(container: HTMLElement): string {
  const linhas: string[] = [];
  const visitar = (el: Element) => {
    const texto = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (texto === '') return;
    if (temFilhoComTexto(el)) {
      for (const filho of Array.from(el.children)) visitar(filho);
      return;
    }
    const papel = papelDe(el);
    linhas.push(papel ? `${papel}: ${texto}` : texto);
  };
  for (const filho of Array.from(container.children)) visitar(filho);
  return linhas.join('\n');
}

/** Espera o texto parar de mudar. TelaAnalises importa Recharts sob demanda. */
async function estabilizar(container: HTMLElement): Promise<string> {
  let anterior = '';
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    const atual = resumirNo(container);
    if (atual !== '' && atual === anterior) return atual;
    anterior = atual;
    await new Promise((r) => setTimeout(r, 50));
  }
  return anterior;
}

export async function textoDaTela(retrato: Retrato, aba: Aba): Promise<string> {
  useApp.setState({
    dados: retrato.dados, hoje: retrato.data, aba,
    boxSel: 'casa', carregado: true, ajustesSecao: null,
  });
  try {
    const { container } = render(<Shell />);
    return await estabilizar(container);
  } catch (erro) {
    // A geração não para. O invariante `nenhuma tela lança` reprova depois, e o revisor lê
    // o estrago no dossiê em vez de receber um stack trace no lugar do relatório inteiro.
    return PREFIXO_EXCECAO + (erro instanceof Error ? erro.message : String(erro));
  } finally {
    cleanup();
  }
}

export async function coletarTelas(retratos: Retrato[]): Promise<TelasDoCorte[]> {
  const saida: TelasDoCorte[] = [];
  for (const r of retratos) {
    const textos: Record<string, string> = {};
    for (const aba of ABAS_DO_DOSSIE) textos[aba] = await textoDaTela(r, aba);
    saida.push({ rotulo: r.rotulo, textos });
  }
  return saida;
}
