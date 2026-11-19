import { formatarDataBR } from '../domain/dates';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import { notaExibivel } from '../domain/notas';
import type { Box, Categoria, Lancamento } from '../domain/types';
import SeloBox from './SeloBox';

/** Quantos pendentes o card mostra; o resto fica a um toque, na pílula Pendentes. */
const MAXIMO = 2;
const TITULO = 'Pendentes';

interface Props {
  /** A fila de `pendentes()`, já ordenada do mais antigo para o mais novo. */
  fila: Lancamento[];
  categorias: Categoria[];
  boxes: Box[];
  /** Na visão casa, cada linha diz de que box é. */
  mostrarBox: boolean;
  onConfirmar: (l: Lancamento) => void;
  onVerTodos: () => void;
}

// Card da Visão do Hoje: os pendentes mais antigos, com confirmar num toque. Corrigir valor,
// descartar e pagar fatura com outro valor continuam na pílula Pendentes — o card é o atalho
// do caso comum, não uma segunda fila.
export default function PendentesResumo({ fila, categorias, boxes, mostrarBox, onConfirmar, onVerTodos }: Props) {
  if (fila.length === 0) return null;
  const categoria = (id: string) => categorias.find((c) => c.id === id);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="secao">
        <span className="rotulo">{TITULO} · {fila.length}</span>
        {fila.length > MAXIMO && (
          <button type="button" className="acao" onClick={onVerTodos}>Ver os {fila.length} →</button>
        )}
      </div>
      {fila.slice(0, MAXIMO).map((l) => {
        const cat = categoria(l.categoriaId);
        const nome = cat?.nome ?? '?';
        const nota = notaExibivel(l.nota, nome);
        return (
          <div className="pendentes-resumo-linha" key={l.id}>
            <div className="cresce">
              <div>
                {nome}
                {mostrarBox && <SeloBox boxId={l.boxId} boxes={boxes} />}
                {l.valor < 0 && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
              </div>
              <div className="sub">{formatarDataBR(l.data)}{nota ? ` · ${nota}` : ''}</div>
            </div>
            <span className={classeEfeito(efeitoNoSaldo(l.valor, cat?.tipo ?? 'gasto'))}>{formatarBRL(l.valor)}</span>
            <button
              type="button" className="botao botao-primario botao-confirmar-curto"
              aria-label={`Confirmar ${nome}`} onClick={() => onConfirmar(l)}
            >
              ✓
            </button>
          </div>
        );
      })}
    </div>
  );
}
