import type { Box, ID } from '../domain/types';

/** Selo com o nome da box de um lançamento. Só as telas que consolidam várias boxes (a visão
 *  casa) o mostram: numa box só, o nome já está no topo. Mesmo formato do selo "estorno". */
export default function SeloBox({ boxId, boxes }: { boxId: ID; boxes: Box[] }) {
  const nome = boxes.find((b) => b.id === boxId)?.nome ?? '?';
  return <span className="badge" style={{ marginLeft: 6 }}>{nome}</span>;
}
