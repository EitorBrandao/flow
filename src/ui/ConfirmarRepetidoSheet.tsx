import type { ReactNode } from 'react';
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
  return (
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
    </Sheet>
  );
}
