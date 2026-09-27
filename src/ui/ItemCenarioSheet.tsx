import * as repo from '../db/repo';
import type { ItemCenario } from '../domain/simulacao';
import { useApp } from '../state/store';
import FormItemCenario, { type ValoresItem } from './FormItemCenario';
import Sheet from './Sheet';

interface Props { item: ItemCenario; onFechar: () => void }

/** Editar ou excluir um item de cenário. A repetição fica fixa. */
export default function ItemCenarioSheet({ item, onFechar }: Props) {
  const { dados, recarregar } = useApp();
  if (!dados) return null;
  const horizonte = dados.config.horizonteProjecao;
  const tipoDe = (categoriaId: string) => dados.categorias.find((c) => c.id === categoriaId)?.tipo ?? 'gasto';

  const inicial: ValoresItem = item.repeticao === 'unica'
    ? {
      valor: item.lancamento.valor, descricao: item.lancamento.nota ?? '', tipo: tipoDe(item.lancamento.categoriaId),
      categoriaId: item.lancamento.categoriaId, repeticao: 'unica', data: item.lancamento.data, parcelas: 2,
    }
    : {
      valor: item.recorrencia.valor * (item.recorrencia.parcelas ?? 1), descricao: item.recorrencia.nota ?? '',
      tipo: tipoDe(item.recorrencia.categoriaId), categoriaId: item.recorrencia.categoriaId, repeticao: item.repeticao,
      data: item.recorrencia.dataInicio, parcelas: item.recorrencia.parcelas ?? 2,
    };
  const boxId = item.repeticao === 'unica' ? item.lancamento.boxId : item.recorrencia.boxId;

  async function salvar(v: ValoresItem) {
    const nota = v.descricao.trim() || undefined;
    if (item.repeticao === 'unica') {
      await repo.atualizarLancamento(item.id, { valor: v.valor, data: v.data, categoriaId: v.categoriaId!, nota });
    } else {
      const parcelado = item.repeticao === 'parcelado';
      await repo.salvarRecorrencia({
        ...item.recorrencia, categoriaId: v.categoriaId!, dataInicio: v.data, diaDoMes: Number(v.data.slice(8, 10)),
        valor: parcelado ? Math.round(v.valor / v.parcelas) : v.valor, parcelas: parcelado ? v.parcelas : null, nota,
      }, horizonte);
    }
    await recarregar();
    onFechar();
  }

  async function excluir() {
    if (!window.confirm('Excluir este item do cenário?')) return;
    if (item.repeticao === 'unica') await repo.excluirLancamento(item.id);
    else await repo.excluirRecorrencia(item.id);
    await recarregar();
    onFechar();
  }

  return (
    <Sheet aberto onFechar={onFechar} rotulo="Item do cenário">
      <h2 style={{ marginTop: 0 }}>Item do cenário</h2>
      <FormItemCenario boxId={boxId} inicial={inicial} repeticaoFixa rotuloBotao="Salvar" onSalvar={salvar} />
      <div className="acoes" style={{ marginTop: 12 }}>
        <button className="botao botao-perigo" onClick={excluir}>Excluir item</button>
        <button className="botao" onClick={onFechar}>Fechar</button>
      </div>
    </Sheet>
  );
}
