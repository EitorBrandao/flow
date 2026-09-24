import type { TipoCategoria } from '../domain/types';

/** Gasto/Ganho — o mesmo controle em Lançar, Recorrências e Categorias. */
export const OPCOES_TIPO: { id: TipoCategoria; nome: string }[] = [
  { id: 'gasto', nome: 'Gasto' },
  { id: 'ganho', nome: 'Ganho' },
];

interface Props {
  opcoes: { id: string; nome: string }[];
  selecionadaId: string;
  onSelecionar: (id: string) => void;
  /** nome do grupo para leitores de tela (ex.: "Tipo") */
  rotulo?: string;
}

export default function SeletorPills({ opcoes, selecionadaId, onSelecionar, rotulo }: Props) {
  return (
    <div className="pills" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={selecionadaId === o.id}
          className={selecionadaId === o.id ? 'ativo' : ''}
          onClick={() => onSelecionar(o.id)}
        >{o.nome}</button>
      ))}
    </div>
  );
}
