interface Props {
  categorias: { id: string; nome: string }[];
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
}

export default function SeletorCategoria({ categorias, selecionadaId, onSelecionar }: Props) {
  return (
    <div className="grade-categorias">
      {categorias.map((c) => (
        <button
          key={c.id}
          className={`botao ${selecionadaId === c.id ? 'selecionada' : ''}`}
          onClick={() => onSelecionar(c.id)}
        >{c.nome}</button>
      ))}
      {categorias.length === 0 && <p className="sub">Nenhuma categoria — crie em Ajustes.</p>}
    </div>
  );
}
