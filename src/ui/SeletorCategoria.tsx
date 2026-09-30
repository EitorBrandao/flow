interface Props {
  categorias: { id: string; nome: string }[];
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
  /** Texto do estado vazio, quando "crie em Ajustes" não diz onde. */
  vazio?: string;
}

export default function SeletorCategoria({ categorias, selecionadaId, onSelecionar, vazio }: Props) {
  return (
    <div className="grade-categorias">
      {categorias.map((c) => (
        <button
          key={c.id}
          className={`botao ${selecionadaId === c.id ? 'selecionada' : ''}`}
          onClick={() => onSelecionar(c.id)}
        >{c.nome}</button>
      ))}
      {categorias.length === 0 && <p className="sub">{vazio ?? 'Nenhuma categoria — crie em Ajustes.'}</p>}
    </div>
  );
}
