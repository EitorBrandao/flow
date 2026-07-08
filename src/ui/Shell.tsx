import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { useApp, type Aba } from '../state/store';
import AdicionarSheet from './AdicionarSheet';
import TelaAjustes from './TelaAjustes';
import TelaAnalises from './TelaAnalises';
import TelaCartao from './TelaCartao';
import TelaFluxo from './TelaFluxo';
import TelaHoje from './TelaHoje';
import TelaLancar from './TelaLancar';
import TelaSimulador from './TelaSimulador';

const ABAS: { id: Aba; rotulo: string; central?: boolean }[] = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'fluxo', rotulo: 'Fluxo' },
  { id: 'lancar', rotulo: '+', central: true },
  { id: 'cartao', rotulo: 'Cartão' },
  { id: 'analises', rotulo: 'Análises' },
  { id: 'simulador', rotulo: 'Simular' },
];

export default function Shell() {
  const { aba, setAba, boxSel, setBoxSel, dados } = useApp();
  const [menuAberto, setMenuAberto] = useState(false);
  if (!dados) return null;
  const boxesComSaldo = dados.boxes.filter((b) => b.saldoInicial != null);
  return (
    <div className="shell">
      <nav className="navegacao">
        {ABAS.map((a) => (
          <button
            key={a.id}
            className={`${aba === a.id ? 'ativo' : ''} ${a.central ? 'central' : ''}`}
            onClick={() => (a.central ? setMenuAberto(true) : setAba(a.id))}
            aria-label={a.central ? 'Adicionar' : a.rotulo}
          >
            {a.rotulo}
          </button>
        ))}
      </nav>
      <div className="shell-corpo">
        <header className="topo">
          <select className="chip" value={boxSel} onChange={(e) => setBoxSel(e.target.value)} aria-label="Box">
            {boxesComSaldo.map((b) => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
            <option value="casa">casa</option>
          </select>
          <button className="chip" onClick={() => setAba('ajustes')} aria-label="Ajustes">
            <Settings size={18} />
          </button>
        </header>
        <main className="conteudo">
          <motion.div
            key={aba}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {aba === 'hoje' && <TelaHoje />}
            {aba === 'fluxo' && <TelaFluxo />}
            {aba === 'lancar' && <TelaLancar />}
            {aba === 'cartao' && <TelaCartao />}
            {aba === 'analises' && <TelaAnalises />}
            {aba === 'simulador' && <TelaSimulador />}
            {aba === 'ajustes' && <TelaAjustes />}
          </motion.div>
        </main>
      </div>
      <AdicionarSheet aberto={menuAberto} onFechar={() => setMenuAberto(false)} />
    </div>
  );
}
