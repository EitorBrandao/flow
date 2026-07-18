import { useState } from 'react';
import * as repo from '../db/repo';
import { categoriasFaturaIds } from '../domain/fatura';
import type { Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import Sheet from './Sheet';

export default function LancEditor({ lanc, onFechar }: { lanc: Lancamento; onFechar: () => void }) {
  const { dados, recarregar } = useApp();
  const [valorCentavos, setValorCentavos] = useState(Math.abs(lanc.valor));
  const [negativo] = useState(lanc.valor < 0);
  const [data, setData] = useState(lanc.data);
  const [categoriaId, setCategoriaId] = useState(lanc.categoriaId);
  const [nota, setNota] = useState(lanc.nota ?? '');
  const [erro, setErro] = useState('');
  if (!dados) return null;

  const ocultas = categoriasFaturaIds(dados.cartoes);
  const categorias = dados.categorias
    .filter((c) => c.boxId === lanc.boxId && !c.arquivada && !ocultas.has(c.id));

  function centsDigitados(): number | null {
    return valorCentavos > 0 ? (negativo ? -valorCentavos : valorCentavos) : null;
  }

  async function aplicar(confirmarTb: boolean) {
    const cents = centsDigitados();
    if (cents == null) { setErro('Valor inválido.'); return; }
    await repo.atualizarLancamento(lanc.id, {
      valor: cents, data, categoriaId, nota: nota || undefined,
      ...(confirmarTb ? { status: 'efetivo' as const } : {}),
    });
    await recarregar();
    onFechar();
  }

  async function excluir() {
    await repo.excluirLancamento(lanc.id);
    await recarregar();
    onFechar();
  }

  const previstoDeRecorrencia = lanc.recorrenciaId != null && lanc.status === 'previsto';

  return (
    <Sheet aberto onFechar={onFechar} rotulo={lanc.status === 'previsto' ? 'Previsto' : 'Lançamento'}>
        <h2 style={{ marginTop: 0 }}>
          {lanc.status === 'previsto' ? 'Previsto' : 'Lançamento'}
          {lanc.recorrenciaId && <span className="badge" style={{ marginLeft: 8 }}>recorrência</span>}
        </h2>
        <div className="campo">
          <label htmlFor="ed-valor">Valor{negativo ? ' (estorno)' : ''}</label>
          <CampoValor id="ed-valor" valorCentavos={valorCentavos} onChange={setValorCentavos} />
        </div>
        <div className="campo">
          <label htmlFor="ed-data">Data</label>
          <CampoData id="ed-data" value={data} onChange={setData} />
        </div>
        <div className="campo">
          <label htmlFor="ed-cat">Categoria</label>
          <select id="ed-cat" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="ed-nota">Nota</label>
          <input id="ed-nota" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
        {erro && <p className="aviso">{erro}</p>}
        {previstoDeRecorrencia && (
          <p className="sub">
            Previsto de uma recorrência: para mudar valor ou data, edite a regra em Ajustes — ou confirme já com o valor ajustado.
          </p>
        )}
        <div className="linha" style={{ marginTop: 12 }}>
          {lanc.status === 'previsto' && (
            <button className="botao botao-primario" onClick={() => aplicar(true)}>✓ Confirmar</button>
          )}
          {!previstoDeRecorrencia && (
            <button className="botao" onClick={() => aplicar(false)}>Salvar</button>
          )}
          <button className="botao botao-perigo" onClick={excluir}>Excluir</button>
          <button className="botao" style={{ marginLeft: 'auto' }} onClick={onFechar}>Fechar</button>
        </div>
    </Sheet>
  );
}
