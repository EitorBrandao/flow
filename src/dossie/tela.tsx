import { Component, type ReactNode } from 'react';
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
  const normalizar = (t: string | null) => (t ?? '').replace(/\s+/g, ' ').trim();

  const visitar = (no: Node) => {
    if (no.nodeType === Node.TEXT_NODE) {
      // Texto solto ao lado de um filho-elemento. Sem esta linha, trocar o rótulo
      // "projetado:" em TelaHoje não moveria o dossiê.
      const solto = normalizar(no.textContent);
      if (solto !== '') linhas.push(solto);
      return;
    }
    if (no.nodeType !== Node.ELEMENT_NODE) return;
    const el = no as Element;
    const texto = normalizar(el.textContent);
    if (texto === '') return;
    if (temFilhoComTexto(el)) {
      for (const filho of Array.from(el.childNodes)) visitar(filho);
      return;
    }
    const papel = papelDe(el);
    linhas.push(papel ? `${papel}: ${texto}` : texto);
  };

  for (const filho of Array.from(container.childNodes)) visitar(filho);
  return linhas.join('\n');
}

/** Espera o texto parar de mudar. TelaAnalises importa Recharts sob demanda. */
async function estabilizar(container: HTMLElement): Promise<string> {
  // Vazio pode ser o estado final legítimo ou só o quadro anterior ao conteúdo. Por isso
  // ele precisa de mais repetições iguais: 10 × 50 ms = 500 ms, acima dos ~330 ms que o
  // import do Recharts leva para resolver neste ambiente.
  const REPETICOES_VAZIO = 10;
  let anterior = '';
  let iguais = 0;
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    const atual = resumirNo(container);
    iguais = atual === anterior ? iguais + 1 : 0;
    if (iguais >= (atual === '' ? REPETICOES_VAZIO : 1)) return atual;
    anterior = atual;
    await new Promise((r) => setTimeout(r, 50));
  }
  return anterior;
}

interface PropsSentinela { aoErro: (erro: unknown) => void; children: ReactNode }
interface EstadoSentinela { estourou: boolean }

/** Pega o que estoura na fase de render, no construtor e nos métodos de ciclo de vida —
 * inclusive o que vem depois da resolução de um Suspense. Não pega o que estoura dentro
 * de um callback assíncrono: por isso os ouvintes do `window`, em `renderComCaptura`. */
class Sentinela extends Component<PropsSentinela, EstadoSentinela> {
  state: EstadoSentinela = { estourou: false };
  static getDerivedStateFromError() {
    return { estourou: true };
  }
  componentDidCatch(erro: unknown) {
    this.props.aoErro(erro);
  }
  render() {
    return this.state.estourou ? null : this.props.children;
  }
}

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

/**
 * Renderiza um elemento e devolve o texto estabilizado, ou `PREFIXO_EXCECAO` se algo
 * estourou — no render (via `Sentinela`) ou num callback assíncrono (via os ouvintes do
 * `window`). Extraída de `textoDaTela` para aceitar qualquer elemento, sem depender do
 * `Shell` nem do store: é o que permite testar a captura de erro assíncrono isolada.
 */
export async function renderComCaptura(elemento: ReactNode): Promise<string> {
  const erros: string[] = [];
  const aoErroGlobal = (e: ErrorEvent) => { erros.push(mensagemDe(e.error ?? e.message)); };
  const aoRejeicao = (e: PromiseRejectionEvent) => { erros.push(mensagemDe(e.reason)); };
  window.addEventListener('error', aoErroGlobal);
  window.addEventListener('unhandledrejection', aoRejeicao);
  try {
    const { container } = render(
      <Sentinela aoErro={(erro) => erros.push(mensagemDe(erro))}>{elemento}</Sentinela>,
    );
    const texto = await estabilizar(container);
    // A geração não para. O invariante `nenhuma tela lança` reprova depois, e o revisor lê
    // o estrago no dossiê em vez de receber um stack trace no lugar do relatório inteiro.
    // O erro tem prioridade sobre o texto: só a primeira mensagem entra, porque um estouro
    // costuma gerar cascata, e o dossiê não deve inchar por causa disso.
    return erros.length > 0 ? PREFIXO_EXCECAO + erros[0] : texto;
  } catch (erro) {
    return PREFIXO_EXCECAO + mensagemDe(erro);
  } finally {
    window.removeEventListener('error', aoErroGlobal);
    window.removeEventListener('unhandledrejection', aoRejeicao);
    cleanup();
  }
}

export async function textoDaTela(retrato: Retrato, aba: Aba): Promise<string> {
  useApp.setState({
    dados: retrato.dados, hoje: retrato.data, aba,
    boxSel: 'casa', carregado: true, ajustesSecao: null,
  });
  return renderComCaptura(<Shell />);
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
