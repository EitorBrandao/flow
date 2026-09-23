import { addMeses, nomeDoMes } from '../domain/dates';

/** Navegação de mês das Análises e do Cartão: ‹ mês por nome ›. */
export default function SeletorMes({ mes, onMudar }: { mes: string; onMudar: (mes: string) => void }) {
  return (
    <div className="linha" style={{ justifyContent: 'space-between' }}>
      <button className="botao" aria-label="Mês anterior" onClick={() => onMudar(addMeses(mes, -1))}>‹</button>
      <strong>{nomeDoMes(mes)}</strong>
      <button className="botao" aria-label="Mês seguinte" onClick={() => onMudar(addMeses(mes, 1))}>›</button>
    </div>
  );
}
