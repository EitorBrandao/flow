import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  /** A pergunta: "Excluir esta viagem?". */
  titulo: string;
  /** O item em questão, para o usuário ver o que vai mudar. */
  resumo?: ReactNode;
  /** O efeito, em uma frase. */
  apoio?: string;
  rotuloConfirmar: string;
  /** Verdadeiro quando a ação apaga: o botão fica vermelho. Falso quando só converte ou mescla. */
  perigo?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}

// Confirmação do próprio app, no lugar do window.confirm. Só para o que apaga em cascata ou
// não tem volta: exclusão simples apaga na hora e oferece "Desfazer" (docs/estilo/interacao.md).
export default function ConfirmarSheet({
  aberto, titulo, resumo, apoio, rotuloConfirmar, perigo = false, onCancelar, onConfirmar,
}: Props) {
  // Portal no body, pelo mesmo motivo do ConfirmarRepetidoSheet: aninhado num sheet, este
  // receberia o arrasto do sheet de fora e fecharia os dois.
  return createPortal(
    <Sheet
      aberto={aberto} onFechar={onCancelar} rotulo={titulo}
      cabecalho={<h2 style={{ margin: 0 }}>{titulo}</h2>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {resumo && <div className="item item-elevado">{resumo}</div>}
        {apoio && <p className="sub" style={{ margin: 0 }}>{apoio}</p>}
        <div className="acoes">
          <button type="button" className="botao botao-discreto" onClick={onCancelar}>Cancelar</button>
          <button
            type="button" className={`botao ${perigo ? 'botao-perigo-cheio' : 'botao-primario'}`}
            onClick={onConfirmar}
          >
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </Sheet>,
    document.body,
  );
}
