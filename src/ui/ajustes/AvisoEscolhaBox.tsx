/** Aviso das telas de configuração por box quando "casa" está no topo: elas pertencem a cada box. */
export default function AvisoEscolhaBox({ assunto }: { assunto: string }) {
  return <p className="sub">{assunto} são de cada box. Escolha uma box no topo para ver ou editar.</p>;
}
