import { useEffect, useId, useRef, useState } from 'react';
import * as repo from '../db/repo';
import { addMesesData } from '../domain/dates';
import type { Cartao, CompraCartao } from '../domain/types';
import { viagemAtivaEm } from '../domain/viagem';
import { useApp } from '../state/store';
import CampoData from './CampoData';
import CampoValor from './CampoValor';

export default function FormCompra({ cartao, compra, onFechar }: {
  cartao: Cartao; compra?: CompraCartao; onFechar: () => void;
}) {
  const { dados, hoje, recarregar } = useApp();
  const [valor, setValor] = useState(compra?.valorTotal ?? 0);
  const [data, setData] = useState(compra?.data ?? hoje);
  const [categoriaId, setCategoriaId] = useState(compra?.categoriaCartaoId ?? '');
  const [parcelas, setParcelas] = useState(compra ? String(compra.parcelas) : '1');
  const [parcelasPagas, setParcelasPagas] = useState('');
  const [descricao, setDescricao] = useState(compra?.descricao ?? '');
  const [viagemMarcada, setViagemMarcada] = useState(compra ? compra.viagemId != null : true);
  const montouRef = useRef(true);
  const uid = useId();
  if (!dados) return null;
  const viagemAtiva = viagemAtivaEm(dados.viagens, data);
  const cats = dados.categoriasCartao.filter((c) => c.cartaoId === cartao.id && !c.arquivada);
  const horizonte = dados.config.horizonteProjecao;
  const parcelasNum = Math.min(48, Math.max(1, Math.round(Number(parcelas) || 1)));

  useEffect(() => {
    if (montouRef.current) { montouRef.current = false; return; }
    setViagemMarcada(true);
  }, [viagemAtiva?.id ?? null]);

  function onParcelasChange(v: string) {
    setParcelas(v);
    const n = Math.min(48, Math.max(1, Math.round(Number(v) || 1)));
    const p = Math.round(Number(parcelasPagas) || 0);
    if (p > 0 && p >= n) setParcelasPagas('');
  }

  function onParcelasPagasChange(v: string) {
    setParcelasPagas(v);
    const n = Math.round(Number(v));
    if (v.trim() === '' || !Number.isFinite(n) || n <= 0) return;
    const pClamped = Math.min(n, parcelasNum - 1);
    setData(addMesesData(hoje, -pClamped));
  }

  async function salvar() {
    if (valor <= 0 || !categoriaId) return;
    const campos = {
      data, valorTotal: valor, parcelas: parcelasNum, categoriaCartaoId: categoriaId,
      ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
      // viagemId sempre presente (mesmo undefined) para permitir desmarcar ao editar
      viagemId: (viagemAtiva && viagemMarcada) ? viagemAtiva.id : undefined,
    };
    if (compra) await repo.atualizarCompraCartao(compra.id, campos, horizonte);
    else await repo.salvarCompraCartao({ cartaoId: cartao.id, ...campos }, horizonte);
    await recarregar();
    onFechar();
  }

  async function excluir() {
    if (!compra) return;
    if (!window.confirm('Excluir a compra e todas as suas parcelas?')) return;
    await repo.excluirCompraCartao(compra.id, horizonte);
    await recarregar();
    onFechar();
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>{compra ? 'Editar compra' : 'Nova compra'}</h2>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-valor`}>Valor</label>
          <CampoValor id={`${uid}-valor`} valorCentavos={valor} onChange={setValor} style={{ width: 100 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-data`}>Data</label>
          <CampoData id={`${uid}-data`} value={data} onChange={setData} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-cat`}>Categoria</label>
          <select id={`${uid}-cat`} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">categoria…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
          <input id={`${uid}-parcelas`} type="number" min={1} max={48} value={parcelas}
            onChange={(e) => onParcelasChange(e.target.value)} style={{ width: 64 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-parcelaspagas`}>Parcelas já pagas</label>
          <input id={`${uid}-parcelaspagas`} type="number" min={0} max={Math.max(0, parcelasNum - 1)}
            disabled={parcelasNum <= 1}
            value={parcelasNum <= 1 ? '' : parcelasPagas}
            onChange={(e) => onParcelasPagasChange(e.target.value)} style={{ width: 64 }} />
        </div>
      </div>
      <div className="linha">
        <div className="campo cresce">
          <label htmlFor={`${uid}-desc`}>Descrição (opcional)</label>
          <input id={`${uid}-desc`} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        {viagemAtiva && (
          <div className="campo">
            <label htmlFor={`${uid}-viagem`}>
              <input
                id={`${uid}-viagem`} type="checkbox"
                checked={viagemMarcada} onChange={(e) => setViagemMarcada(e.target.checked)}
              />
              {' '}Viagem: {viagemAtiva.nome}
            </label>
          </div>
        )}
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={salvar}>Salvar</button>
        <button className="botao" style={{ alignSelf: 'flex-end' }} onClick={onFechar}>Cancelar</button>
        {compra && <button className="botao botao-perigo" style={{ alignSelf: 'flex-end' }} onClick={excluir}>Excluir</button>}
      </div>
    </>
  );
}
