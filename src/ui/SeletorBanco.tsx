import type { Banco } from '../domain/types';
import SeletorPills from './SeletorPills';

interface Props {
  bancos: Banco[];
  /** `null` = nenhum marcado (lançamento antigo, sem banco). */
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
}

/** Pílulas para escolher o banco de um lançamento ou de uma recorrência. Com menos de dois
 *  bancos não há o que escolher: o campo some, e quem grava usa o único banco (ou nenhum). */
export default function SeletorBanco({ bancos, selecionadaId, onSelecionar }: Props) {
  if (bancos.length < 2) return null;
  return (
    <div className="campo">
      <label>Banco</label>
      <SeletorPills
        rotulo="Banco"
        opcoes={bancos.map((b) => ({ id: b.id, nome: b.nome }))}
        selecionadaId={selecionadaId ?? ''}
        onSelecionar={onSelecionar}
      />
    </div>
  );
}
