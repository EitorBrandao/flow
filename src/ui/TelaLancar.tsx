import { useMemo, useState } from 'react';
import * as repo from '../db/repo';
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
  const [salvo, setSalvo] = useState(false);

  const boxId = boxSel === 'casa'
    ? dados?.boxes.find((b) => b.nome === 'casa')?.id ?? dados?.boxes[0]?.id
    : boxSel;

  const categorias = useMemo(
    () => (dados?.categorias ?? [])
      .filter((c) => c.boxId === boxId && c.tipo === tipo && !c.arquivada)
      .sort((a, b) => a.ordem - b.ordem),
    [dados, boxId, tipo],
  );

  const cents = parseValorDigitado(valor);
  const valido = boxId != null && cents != null && categoriaId != null;

  async function lancar() {
    if (!valido) return;
    await repo.salvarLancamento({
      boxId: boxId!, categoriaId: categoriaId!, data, valor: cents!,
      ...(nota ? { nota } : {}),
      status: data > hoje ? 'previsto' : 'efetivo',
    });
    await recarregar();
    setValor(''); setCategoriaId(null); setNota(''); setData(hoje); setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
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
      <button className="botao botao-primario" disabled={!valido} onClick={lancar} style={{ padding: 14 }}>
        Lançar
      </button>
      {salvo && <p className="aviso">Lançado ✓</p>}
    </div>
  );
}
