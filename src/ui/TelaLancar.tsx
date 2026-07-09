import { useEffect, useMemo, useRef, useState } from 'react';
import * as repo from '../db/repo';
import { categoriasFaturaIds } from '../domain/fatura';
import { parseValorDigitado } from '../domain/money';
import type { TipoCategoria } from '../domain/types';
import { useApp } from '../state/store';

export default function TelaLancar() {
  const { dados, boxSel, hoje, recarregar } = useApp();
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState<TipoCategoria>('gasto');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [data, setData] = useState(hoje);
  const [nota, setNota] = useState('');
  const [previsto, setPrevisto] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const salvoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (salvoTimeoutRef.current != null) clearTimeout(salvoTimeoutRef.current);
  }, []);

  const boxId = boxSel === 'casa'
    ? dados?.boxes.find((b) => b.nome === 'casa')?.id
    : boxSel;

  const ocultas = useMemo(() => categoriasFaturaIds(dados?.cartoes ?? []), [dados]);
  const categorias = useMemo(
    () => (dados?.categorias ?? [])
      .filter((c) => c.boxId === boxId && c.tipo === tipo && !c.arquivada && !ocultas.has(c.id))
      .sort((a, b) => a.ordem - b.ordem),
    [dados, boxId, tipo, ocultas],
  );

  const cents = parseValorDigitado(valor);
  const valido = boxId != null && cents != null && categoriaId != null && data !== '';

  async function lancar() {
    if (!valido) return;
    await repo.salvarLancamento({
      boxId: boxId!, categoriaId: categoriaId!, data, valor: cents!,
      ...(nota ? { nota } : {}),
      status: previsto ? 'previsto' : (data > hoje ? 'previsto' : 'efetivo'),
    });
    await recarregar();
    setValor(''); setCategoriaId(null); setNota(''); setData(hoje); setPrevisto(false); setSalvo(true);
    if (salvoTimeoutRef.current != null) clearTimeout(salvoTimeoutRef.current);
    salvoTimeoutRef.current = setTimeout(() => setSalvo(false), 2500);
  }

  return (
    <div className="tela">
      <h2>Lançar</h2>
      <div className="campo">
        <label htmlFor="valor">Valor</label>
        <input
          id="valor" inputMode="decimal" autoFocus placeholder="0,00"
          value={valor} onChange={(e) => setValor(e.target.value)}
          style={{ fontSize: 28 }}
        />
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
      <div className="grade-categorias">
        {categorias.map((c) => (
          <button
            key={c.id}
            className={`botao ${categoriaId === c.id ? 'selecionada' : ''}`}
            onClick={() => setCategoriaId(c.id)}
          >{c.nome}</button>
        ))}
        {categorias.length === 0 && <p className="sub">Nenhuma categoria — crie em Ajustes.</p>}
      </div>
      <div className="linha">
        <div className="campo">
          <label htmlFor="data">Data</label>
          <input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
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
      <button className="botao botao-primario" disabled={!valido} onClick={lancar} style={{ padding: 14 }}>
        Lançar
      </button>
      {salvo && <p className="aviso">Lançado ✓</p>}
    </div>
  );
}
