import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  titulo: string;
  /** A frase que descreve o item que já existe. */
  frase: ReactNode;
  apoio: string;
  rotuloConfirmar: string;
  onCancelar: () => void;
  onConfirmar: () => void;
}

export default function ConfirmarRepetidoSheet({
  aberto, titulo, frase, apoio, rotuloConfirmar, onCancelar, onConfirmar,
}: Props) {
  // Portal no body: o FormCompra vive dentro do sheet Adicionar, e um sheet aninhado receberia
  // o arrasto do sheet de fora (os listeners de toque dele ficam no conteúdo) e fecharia os dois.
  return createPortal(
    <Sheet
      aberto={aberto}
      onFechar={onCancelar}
      rotulo={titulo}
      cabecalho={<h2 style={{ margin: 0 }}>{titulo}</h2>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p className="aviso">{frase}</p>
        <p className="sub" style={{ margin: 0 }}>{apoio}</p>
        <div className="acoes">
          <button className="botao" style={{ flex: 1 }} onClick={onCancelar}>Cancelar</button>
          <button className="botao botao-primario" style={{ flex: 1 }} onClick={onConfirmar}>
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </Sheet>,
    document.body,
  );
}
