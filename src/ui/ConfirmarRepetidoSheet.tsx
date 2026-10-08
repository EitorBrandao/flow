import Sheet from './Sheet';
import { formatarDataBR } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import type { Lancamento, TipoCategoria } from '../domain/types';

interface Props {
  /** O lançamento igual que já existe. `null` fecha o sheet. */
  repetido: Lancamento | null;
  tipo: TipoCategoria;
  nomeBox: string;
  onCancelar: () => void;
  onConfirmar: () => void;
}

export default function ConfirmarRepetidoSheet({ repetido, tipo, nomeBox, onCancelar, onConfirmar }: Props) {
  return (
    <Sheet
      aberto={repetido != null}
      onFechar={onCancelar}
      rotulo="Lançamento repetido?"
      cabecalho={<h2 style={{ margin: 0 }}>Lançamento repetido?</h2>}
    >
      {repetido && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="aviso">
            Já existe {tipo === 'gasto' ? 'um gasto' : 'um ganho'} de <strong>{formatarBRL(repetido.valor)}</strong>
            {' '}em <strong>{formatarDataBR(repetido.data)}</strong> na box {nomeBox}
            {repetido.nota ? <>: “{repetido.nota}”.</> : '.'}
          </p>
          <p className="sub" style={{ margin: 0 }}>
            Se foi um toque duplo, cancele. Se é outro lançamento igual, lance mesmo assim.
          </p>
          <div className="acoes">
            <button className="botao" style={{ flex: 1 }} onClick={onCancelar}>Cancelar</button>
            <button className="botao botao-primario" style={{ flex: 1 }} onClick={onConfirmar}>
              Lançar mesmo assim
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
