import { useApp, type Aba } from '../state/store';
import TelaAjustes from './TelaAjustes';
import TelaAnalises from './TelaAnalises';
import TelaFluxo from './TelaFluxo';
import TelaHoje from './TelaHoje';
import TelaLancar from './TelaLancar';
import TelaSimulador from './TelaSimulador';

const ABAS: { id: Aba; rotulo: string; central?: boolean }[] = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'fluxo', rotulo: 'Fluxo' },
  { id: 'lancar', rotulo: '+', central: true },
  { id: 'analises', rotulo: 'Análises' },
  { id: 'simulador', rotulo: 'Simular' },
];

export default function Shell() {
  const { aba, setAba, boxSel, setBoxSel, dados } = useApp();
  if (!dados) return null;
  const boxesComSaldo = dados.boxes.filter((b) => b.saldoInicial != null);
  return (
    <div className="shell">
      <nav className="navegacao">
        {ABAS.map((a) => (
          <button
            key={a.id}
            className={`${aba === a.id ? 'ativo' : ''} ${a.central ? 'central' : ''}`}
            onClick={() => setAba(a.id)}
            aria-label={a.central ? 'Lançar' : a.rotulo}
          >
            {a.rotulo}
          </button>
        ))}
      </nav>
      <div className="shell-corpo">
        <header className="topo">
          <select value={boxSel} onChange={(e) => setBoxSel(e.target.value)} aria-label="Box">
            {boxesComSaldo.map((b) => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
            <option value="casa">casa</option>
          </select>
          <span className="titulo">Flow</span>
          <button className="icone" onClick={() => setAba('ajustes')} aria-label="Ajustes">⚙️</button>
        </header>
        <main className="conteudo">
          {aba === 'hoje' && <TelaHoje />}
          {aba === 'fluxo' && <TelaFluxo />}
          {aba === 'lancar' && <TelaLancar />}
          {aba === 'analises' && <TelaAnalises />}
          {aba === 'simulador' && <TelaSimulador />}
          {aba === 'ajustes' && <TelaAjustes />}
        </main>
      </div>
    </div>
  );
}
