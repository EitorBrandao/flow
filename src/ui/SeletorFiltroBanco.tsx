import type { FiltroBanco } from '../domain/bancos';
import type { Banco } from '../domain/types';
import SeletorPills from './SeletorPills';

interface Props {
  bancos: Banco[];
  valor: FiltroBanco;
  onMudar: (valor: FiltroBanco) => void;
}

/** Pílulas do filtro por banco (Fluxo e Análises): Todos, cada banco e "Sem banco". Com menos
 *  de dois bancos não há o que filtrar: o filtro some. */
export default function SeletorFiltroBanco({ bancos, valor, onMudar }: Props) {
  if (bancos.length < 2) return null;
  return (
    <div className="campo">
      <label>Banco</label>
      <SeletorPills
        rotulo="Filtrar por banco"
        opcoes={[
          { id: 'todos', nome: 'Todos' },
          ...bancos.map((b) => ({ id: b.id, nome: b.nome })),
          { id: 'sem-banco', nome: 'Sem banco' },
        ]}
        selecionadaId={valor}
        onSelecionar={(id) => onMudar(id)}
      />
    </div>
  );
}
