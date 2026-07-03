import { useState } from 'react';
import * as repo from '../db/repo';
import { parseValorDigitado } from '../domain/money';
import type { Lancamento } from '../domain/types';
import { useApp } from '../state/store';

export default function LancEditor({ lanc, onFechar }: { lanc: Lancamento; onFechar: () => void }) {
  const { dados, recarregar } = useApp();
  const [valor, setValor] = useState((Math.abs(lanc.valor) / 100).toFixed(2).replace('.', ','));
  const [negativo] = useState(lanc.valor < 0);
  const [data, setData] = useState(lanc.data);
  const [categoriaId, setCategoriaId] = useState(lanc.categoriaId);
  const [nota, setNota] = useState(lanc.nota ?? '');
  const [erro, setErro] = useState('');
  if (!dados) return null;

  const categorias = dados.categorias
    .filter((c) => c.boxId === lanc.boxId && !c.arquivada)
    .sort((a, b) => (a.tipo === b.tipo ? a.ordem - b.ordem : a.tipo === 'ganho' ? -1 : 1));

  function centsDigitados(): number | null {
    const v = parseValorDigitado(valor);
    return v == null ? null : (negativo ? -v : v);
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

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 }}
      onClick={onFechar}
    >
      <div className="card" style={{ width: '100%', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>
          {lanc.status === 'previsto' ? 'Previsto' : 'Lançamento'}
          {lanc.recorrenciaId && <span className="badge" style={{ marginLeft: 8 }}>recorrência</span>}
        </h2>
        <div className="campo">
          <label htmlFor="ed-valor">Valor{negativo ? ' (estorno)' : ''}</label>
          <input id="ed-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="ed-data">Data</label>
          <input id="ed-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
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
        <div className="linha" style={{ marginTop: 12 }}>
          {lanc.status === 'previsto' && (
            <button className="botao botao-primario" onClick={() => aplicar(true)}>✓ Confirmar</button>
          )}
          <button className="botao" onClick={() => aplicar(false)}>Salvar</button>
          <button className="botao botao-perigo" onClick={excluir}>Excluir</button>
          <button className="botao" style={{ marginLeft: 'auto' }} onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
