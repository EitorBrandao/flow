import { useId, useState } from 'react';
import * as repo from '../db/repo';
import { categoriasFaturaIds } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import { agoraISO, novoId, type Cenario } from '../domain/types';
import { useApp } from '../state/store';
import CampoValor from './CampoValor';

function FormHipotetico({ cenario }: { cenario: Cenario }) {
  const { dados, hoje, recarregar } = useApp();
  const [valor, setValor] = useState(0);
  const [categoriaId, setCategoriaId] = useState('');
  const [data, setData] = useState(hoje);
  const [parcelas, setParcelas] = useState('1');
  const uid = useId();
  if (!dados) return null;
  const ocultas = categoriasFaturaIds(dados.cartoes);
  const categorias = dados.categorias.filter((c) => !c.arquivada && !ocultas.has(c.id));
  const boxDe = (catId: string) => dados.categorias.find((c) => c.id === catId)?.boxId;

  async function adicionar() {
    const cents = valor;
    const nParcelas = Math.max(1, Number(parcelas) || 1);
    const boxId = boxDe(categoriaId);
    if (cents <= 0 || !boxId) return;
    if (nParcelas === 1) {
      await repo.salvarLancamento({
        boxId, categoriaId, data, valor: cents, status: 'previsto', cenarioId: cenario.id,
      });
    } else {
      await repo.salvarRecorrencia({
        boxId, categoriaId, valor: Math.round(cents / nParcelas),
        dataInicio: data, diaDoMes: Number(data.slice(8, 10)), parcelas: nParcelas,
        nota: cenario.nome, cenarioId: cenario.id,
      }, dados!.config.horizonteProjecao);
    }
    await recarregar();
    setValor(0);
  }

  return (
    <div className="linha" style={{ marginTop: 8 }}>
      <div className="campo">
        <label htmlFor={`${uid}-valor`}>Valor total</label>
        <CampoValor id={`${uid}-valor`} valorCentavos={valor} onChange={setValor} style={{ width: 90 }} />
      </div>
      <div className="campo">
        <label htmlFor={`${uid}-cat`}>Categoria</label>
        <select id={`${uid}-cat`} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">categoria…</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor={`${uid}-data`}>Data</label>
        <input id={`${uid}-data`} type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
        <input id={`${uid}-parcelas`} type="number" min={1} value={parcelas}
          onChange={(e) => setParcelas(e.target.value)} style={{ width: 64 }} />
      </div>
      <button className="botao" style={{ alignSelf: 'flex-end' }} onClick={adicionar}>Adicionar</button>
    </div>
  );
}

export default function TelaSimulador() {
  const { dados, recarregar } = useApp();
  const [nomeNovo, setNomeNovo] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  if (!dados) return null;

  async function criar() {
    if (!nomeNovo.trim()) return;
    const agora = agoraISO();
    await repo.salvarCenario({ id: novoId(), nome: nomeNovo.trim(), ligado: true, criadoEm: agora, alteradoEm: agora });
    await recarregar();
    setNomeNovo('');
  }

  async function alternar(c: Cenario) {
    await repo.salvarCenario({ ...c, ligado: !c.ligado });
    await recarregar();
  }

  async function tornarReal(c: Cenario) {
    if (!window.confirm(`Converter "${c.nome}" em lançamentos reais?`)) return;
    await repo.converterCenarioEmReal(c.id);
    await recarregar();
  }

  async function excluir(c: Cenario) {
    if (!window.confirm(`Excluir o cenário "${c.nome}" e seus lançamentos hipotéticos?`)) return;
    await repo.excluirCenario(c.id);
    await recarregar();
  }

  const nomeCat = (id: string) => dados.categorias.find((c) => c.id === id)?.nome ?? '?';

  return (
    <div className="tela">
      <h2>Simulador</h2>
      <p className="sub">Cenários ligados aparecem como linha pontilhada no Fluxo e no Hoje.</p>
      <div className="linha">
        <input placeholder="novo cenário (ex.: bike 10x)" value={nomeNovo}
          onChange={(e) => setNomeNovo(e.target.value)} style={{ flex: 1 }} />
        <button className="botao botao-primario" onClick={criar}>Criar</button>
      </div>
      {dados.cenarios.map((c) => {
        const lancs = dados.lancamentos.filter((l) => l.cenarioId === c.id);
        const total = lancs.reduce((s, l) => s + l.valor, 0);
        return (
          <div className="card" key={c.id}>
            <div className="linha" style={{ justifyContent: 'space-between' }}>
              <label className="linha" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={c.ligado} onChange={() => alternar(c)} />
                <strong>{c.nome}</strong>
              </label>
              <span className="sub">{lancs.length} lançamento(s) · {formatarBRL(total)}</span>
            </div>
            <div className="linha" style={{ marginTop: 8 }}>
              <button className="botao" onClick={() => setAberto(aberto === c.id ? null : c.id)}>
                {aberto === c.id ? 'Fechar' : 'Detalhar'}
              </button>
              <button className="botao" onClick={() => tornarReal(c)}>Tornar real</button>
              <button className="botao botao-perigo" onClick={() => excluir(c)}>Excluir</button>
            </div>
            {aberto === c.id && (
              <>
                <div className="lista" style={{ marginTop: 8 }}>
                  {lancs.map((l) => (
                    <div className="item" key={l.id}>
                      <span className="cresce">{nomeCat(l.categoriaId)} · {l.data.split('-').reverse().join('/')}</span>
                      <span className="valor-gasto">{formatarBRL(l.valor)}</span>
                    </div>
                  ))}
                </div>
                <FormHipotetico cenario={c} />
              </>
            )}
          </div>
        );
      })}
      {dados.cenarios.length === 0 && <p className="sub">Nenhum cenário ainda.</p>}
    </div>
  );
}
