interface Props {
  opcoes: { id: string; nome: string }[];
  selecionadaId: string;
  onSelecionar: (id: string) => void;
}

export default function SeletorPills({ opcoes, selecionadaId, onSelecionar }: Props) {
  return (
    <div className="pills" role="radiogroup">
      {opcoes.map((o) => (
        <button
          key={o.id}
          className={selecionadaId === o.id ? 'ativo' : ''}
          onClick={() => onSelecionar(o.id)}
        >{o.nome}</button>
      ))}
    </div>
  );
}
