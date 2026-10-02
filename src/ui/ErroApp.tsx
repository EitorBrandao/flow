import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface Estado {
  erro: Error | null;
  atualizando: boolean;
}

const CHAVE_RECARGA = 'flow:recarga-automatica';
/** Intervalo mínimo entre duas recargas automáticas: evita laço se a falha persistir. */
const INTERVALO_RECARGA_MS = 60_000;

// Mensagens que cada navegador usa quando um trecho do app (carregado sob demanda) não chega.
const PADRAO_TRECHO_AUSENTE =
  /dynamically imported module|importing a module script failed|loading chunk|loading css chunk/i;

export function ehFalhaDeTrecho(erro: Error): boolean {
  return PADRAO_TRECHO_AUSENTE.test(erro.message);
}

/** Registra a recarga automática e diz se ela ainda cabe. Sem armazenamento, não recarrega. */
function reservarRecargaAutomatica(agora: number): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE_RECARGA));
    if (ultima && agora - ultima < INTERVALO_RECARGA_MS) return false;
    sessionStorage.setItem(CHAVE_RECARGA, String(agora));
    return true;
  } catch {
    return false;
  }
}

// Um erro de renderização derruba a árvore inteira do React e deixa a tela preta.
// Este limite troca a tela preta por uma saída. Um app aberto há dias pode pedir um trecho
// de uma versão que o deploy já apagou: recarregar traz a versão nova.
export default class ErroApp extends Component<Props, Estado> {
  state: Estado = { erro: null, atualizando: false };

  static getDerivedStateFromError(erro: Error): Partial<Estado> {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error(erro, info.componentStack);
    if (ehFalhaDeTrecho(erro) && reservarRecargaAutomatica(Date.now())) {
      this.setState({ atualizando: true });
      window.location.reload();
    }
  }

  render() {
    const { erro, atualizando } = this.state;
    if (!erro) return this.props.children;
    if (atualizando) {
      return (
        <div className="erro-app" role="status">
          <div className="card">
            <h2>Atualizando o Flow…</h2>
            <p className="sub">Há uma versão nova do app. Já volto.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="erro-app" role="alert">
        <div className="card">
          <h2>Algo deu errado</h2>
          <p>O Flow não conseguiu abrir esta tela. Seus dados estão salvos neste aparelho.</p>
          <button type="button" className="botao botao-primario" onClick={() => window.location.reload()}>
            Recarregar
          </button>
          <span className="erro-app-detalhe">Detalhe: {erro.message}</span>
        </div>
      </div>
    );
  }
}
