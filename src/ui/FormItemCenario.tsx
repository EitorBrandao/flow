import { useId, useState } from 'react';
import * as repo from '../db/repo';
import { categoriasFaturaIds } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { Repeticao } from '../domain/simulacao';
import { categoriasTransferenciaIds } from '../domain/transferencia';
import type { Categoria, Dados, ID, ISODate, TipoCategoria } from '../domain/types';
import { useApp } from '../state/store';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import SeletorCategoria from './SeletorCategoria';
import SeletorPills, { OPCOES_TIPO } from './SeletorPills';

export interface ValoresItem {
  valor: number; descricao: string; tipo: TipoCategoria; categoriaId: ID | null;
  repeticao: Repeticao; data: ISODate; parcelas: number;
}

const OPCOES_REPETICAO: { id: Repeticao; nome: string }[] = [
  { id: 'unica', nome: 'Uma vez' },
  { id: 'parcelado', nome: 'Parcelado' },
  { id: 'mensal', nome: 'Todo mês' },
];

/** Categorias que um item de cenário pode usar: da box, do tipo, ativas, sem as de fatura e
 *  de transferência (as mesmas que Lançar esconde). */
export function categoriasDoItem(dados: Dados, boxId: ID, tipo: TipoCategoria): Categoria[] {
  const ocultas = new Set([...categoriasFaturaIds(dados.cartoes), ...categoriasTransferenciaIds(dados.boxes)]);
  return dados.categorias.filter((c) => c.boxId === boxId && c.tipo === tipo && !c.arquivada && !ocultas.has(c.id));
}

/** Grava um item novo no cenário: "uma vez" vira lançamento previsto; "parcelado" e "todo
 *  mês" viram recorrência (parcela = total ÷ N, arredondada). A descrição vai na nota. */
export async function gravarItemNovo(cenarioId: ID, boxId: ID, v: ValoresItem, horizonte: ISODate): Promise<void> {
  const nota = v.descricao.trim() || undefined;
  if (v.repeticao === 'unica') {
    await repo.salvarLancamento({
      boxId, categoriaId: v.categoriaId!, data: v.data, valor: v.valor, status: 'previsto', cenarioId, nota,
    });
    return;
  }
  const parcelado = v.repeticao === 'parcelado';
  await repo.salvarRecorrencia({
    boxId, categoriaId: v.categoriaId!, dataInicio: v.data, diaDoMes: Number(v.data.slice(8, 10)),
    valor: parcelado ? Math.round(v.valor / v.parcelas) : v.valor,
    parcelas: parcelado ? v.parcelas : null, nota, cenarioId,
  }, horizonte);
}

interface Props {
  boxId: ID;
  inicial: ValoresItem;
  /** Na edição, a repetição não muda: para trocar, exclui-se o item e cria-se outro. */
  repeticaoFixa?: boolean;
  rotuloBotao: string;
  onSalvar: (v: ValoresItem) => Promise<void>;
}

export default function FormItemCenario({ boxId, inicial, repeticaoFixa, rotuloBotao, onSalvar }: Props) {
  const { dados } = useApp();
  const uid = useId();
  const [v, setV] = useState<ValoresItem>(inicial);
  const [parcelasTexto, setParcelasTexto] = useState(String(inicial.parcelas));
  const [salvando, setSalvando] = useState(false);
  if (!dados) return null;
  const mudar = (patch: Partial<ValoresItem>) => setV((atual) => ({ ...atual, ...patch }));
  const categorias = categoriasDoItem(dados, boxId, v.tipo);
  const parcelas = Number(parcelasTexto) || 0;
  const valido = v.valor > 0 && v.categoriaId != null
    && (v.repeticao !== 'parcelado' || (parcelas >= 2 && Math.round(v.valor / parcelas) >= 1));

  async function salvar() {
    if (!valido || salvando) return;
    setSalvando(true);
    try {
      await onSalvar({ ...v, parcelas });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="tela">
      <div className="campo">
        <label htmlFor={`${uid}-valor`}>Valor</label>
        <CampoValor id={`${uid}-valor`} valorCentavos={v.valor} onChange={(valor) => mudar({ valor })} style={{ fontSize: 28 }} />
      </div>
      <div className="campo">
        <label htmlFor={`${uid}-descricao`}>Descrição</label>
        <input
          id={`${uid}-descricao`} placeholder="ex.: diferença do aluguel" value={v.descricao}
          onChange={(e) => mudar({ descricao: e.target.value })}
        />
      </div>
      <SeletorPills
        rotulo="Tipo" opcoes={OPCOES_TIPO} selecionadaId={v.tipo}
        onSelecionar={(id) => mudar({ tipo: id as TipoCategoria, categoriaId: null })}
      />
      <SeletorCategoria categorias={categorias} selecionadaId={v.categoriaId} onSelecionar={(categoriaId) => mudar({ categoriaId })} />
      {!repeticaoFixa && (
        <SeletorPills
          rotulo="Repetição" opcoes={OPCOES_REPETICAO} selecionadaId={v.repeticao}
          onSelecionar={(id) => mudar({ repeticao: id as Repeticao })}
        />
      )}
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-data`}>{v.repeticao === 'unica' ? 'Data' : 'A partir de'}</label>
          <CampoData id={`${uid}-data`} value={v.data} onChange={(data) => mudar({ data })} />
        </div>
        {v.repeticao === 'parcelado' && (
          <div className="campo">
            <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
            <input
              id={`${uid}-parcelas`} inputMode="numeric" value={parcelasTexto}
              onChange={(e) => setParcelasTexto(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        )}
      </div>
      {v.repeticao === 'parcelado' && parcelas >= 2 && v.valor > 0 && (
        <p className="sub" style={{ margin: 0 }}>
          O valor é o total: cada parcela sai por {formatarBRL(Math.round(v.valor / parcelas))}.
        </p>
      )}
      {v.repeticao === 'mensal' && (
        <p className="sub" style={{ margin: 0 }}>
          Repete todo mês até o fim da projeção. Para algo que já existe, como aluguel ou salário, lance só a diferença.
        </p>
      )}
      <button className="botao botao-primario" style={{ padding: 14 }} disabled={!valido || salvando} onClick={salvar}>
        {rotuloBotao}
      </button>
    </div>
  );
}
