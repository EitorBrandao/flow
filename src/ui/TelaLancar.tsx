import { useEffect, useMemo, useRef, useState } from 'react';
import * as repo from '../db/repo';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import SeletorCategoria from './SeletorCategoria';
import { categoriasFaturaIds } from '../domain/fatura';
import type { TipoCategoria } from '../domain/types';
import { viagemAtivaEm } from '../domain/viagem';
import { useApp } from '../state/store';

export default function TelaLancar() {
  const { dados, boxSel, hoje, recarregar } = useApp();
  const [cents, setCents] = useState(0);
  const [tipo, setTipo] = useState<TipoCategoria>('gasto');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [data, setData] = useState(hoje);
  const [nota, setNota] = useState('');
  const [previsto, setPrevisto] = useState(false);
  const [viagemMarcada, setViagemMarcada] = useState(true);
  const [salvo, setSalvo] = useState(false);
  const salvoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viagemAtiva = viagemAtivaEm(dados?.viagens ?? [], data);

  useEffect(() => {
    setViagemMarcada(true);
  }, [viagemAtiva?.id ?? null]);

  useEffect(() => () => {
    if (salvoTimeoutRef.current != null) clearTimeout(salvoTimeoutRef.current);
  }, []);

  const boxId = boxSel === 'casa'
    ? dados?.boxes.find((b) => b.nome === 'casa')?.id
    : boxSel;

  const ocultas = useMemo(() => categoriasFaturaIds(dados?.cartoes ?? []), [dados]);
  const categorias = useMemo(
    () => (dados?.categorias ?? [])
      .filter((c) => c.boxId === boxId && c.tipo === tipo && !c.arquivada && !ocultas.has(c.id)),
    [dados, boxId, tipo, ocultas],
  );

  const valido = boxId != null && cents > 0 && categoriaId != null && data !== '';

  async function lancar() {
    if (!valido) return;
    await repo.salvarLancamento({
      boxId: boxId!, categoriaId: categoriaId!, data, valor: cents,
      ...(nota ? { nota } : {}),
      status: previsto ? 'previsto' : (data > hoje ? 'previsto' : 'efetivo'),
      ...(viagemAtiva && viagemMarcada ? { viagemId: viagemAtiva.id } : {}),
    });
    await recarregar();
    setCents(0); setCategoriaId(null); setNota(''); setData(hoje);
    setPrevisto(false); setViagemMarcada(true); setSalvo(true);
    if (salvoTimeoutRef.current != null) clearTimeout(salvoTimeoutRef.current);
    salvoTimeoutRef.current = setTimeout(() => setSalvo(false), 2500);
  }

  return (
    <div className="tela">
      <h2>Lançar</h2>
      <div className="campo">
        <label htmlFor="valor">Valor</label>
        <CampoValor id="valor" valorCentavos={cents} onChange={setCents} autoFocus style={{ fontSize: 28 }} />
      </div>
      <div className="linha" role="radiogroup" aria-label="Tipo">
        <button
          className={`botao ${tipo === 'gasto' ? 'botao-primario' : ''}`}
          onClick={() => { setTipo('gasto'); setCategoriaId(null); }}
        >Gasto</button>
        <button
          className={`botao ${tipo === 'ganho' ? 'botao-primario' : ''}`}
          onClick={() => { setTipo('ganho'); setCategoriaId(null); }}
        >Ganho</button>
      </div>
      <SeletorCategoria categorias={categorias} selecionadaId={categoriaId} onSelecionar={setCategoriaId} />
      <div className="linha">
        <div className="campo">
          <label htmlFor="data">Data</label>
          <CampoData id="data" value={data} onChange={setData} />
        </div>
        <div className="campo" style={{ flex: 1 }}>
          <label htmlFor="nota">Nota (opcional)</label>
          <input id="nota" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="previsto">
          <input
            id="previsto" type="checkbox"
            checked={previsto} onChange={(e) => setPrevisto(e.target.checked)}
          />
          {' '}Marcar como previsto
        </label>
      </div>
      {viagemAtiva && (
        <div className="campo">
          <label htmlFor="viagem">
            <input
              id="viagem" type="checkbox"
              checked={viagemMarcada} onChange={(e) => setViagemMarcada(e.target.checked)}
            />
            {' '}Viagem: {viagemAtiva.nome}
          </label>
        </div>
      )}
      <button className="botao botao-primario" disabled={!valido} onClick={lancar} style={{ padding: 14 }}>
        Lançar
      </button>
      {salvo && <p className="aviso">Lançado ✓</p>}
    </div>
  );
}
