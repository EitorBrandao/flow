import { useState } from 'react';
import { compararMeses, mediaMovel3, resumoMensal, serieMensal } from '../domain/aggregations';
import { addMeses, mesDe } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import type { ID } from '../domain/types';
import { boxIdsSelecionadas, useApp } from '../state/store';
import FaturaCategoriaSheet from './FaturaCategoriaSheet';
import LancamentosSheet from './LancamentosSheet';

function nomeMes(mes: string): string {
  return new Date(`${mes}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function pct(x: number | null): string {
  return x == null ? '—' : `${(x * 100).toFixed(1)}%`;
}

export default function TelaAnalises() {
  const { dados, boxSel, hoje, setAba } = useApp();
  const [mes, setMes] = useState(() => mesDe(hoje));
  const [incluirPrevistos, setIncluirPrevistos] = useState(true);
  const [categoriaAberta, setCategoriaAberta] = useState<ID | null>(null);
  if (!dados) return null;
  const categoriaObj = dados.categorias.find((c) => c.id === categoriaAberta);
  const cartaoDaCategoria = dados.cartoes.find((c) => c.categoriaFaturaId === categoriaAberta) ?? null;
  const ids = boxIdsSelecionadas(dados, boxSel);
  const resumo = resumoMensal(mes, ids, dados.categorias, dados.lancamentos, incluirPrevistos);
  const comparativo = compararMeses(mes, ids, dados.categorias, dados.lancamentos, incluirPrevistos);
  // tendência: média móvel de 3 meses terminando no mês selecionado
  const meses = [-5, -4, -3, -2, -1, 0].map((n) => addMeses(mes, n));
  const media3m = (categoriaId: string) =>
    mediaMovel3(serieMensal(categoriaId, meses, ids, dados.lancamentos, incluirPrevistos)).at(-1);

  return (
    <div className="tela">
      <h2>Análises</h2>
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <button className="botao" onClick={() => setMes(addMeses(mes, -1))} aria-label="Mês anterior">◀</button>
        <strong>{nomeMes(mes)}</strong>
        <button className="botao" onClick={() => setMes(addMeses(mes, 1))} aria-label="Próximo mês">▶</button>
      </div>
      <label className="linha">
        <input type="checkbox" checked={incluirPrevistos} onChange={(e) => setIncluirPrevistos(e.target.checked)} />
        incluir previstos
      </label>

      <div className="card">
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <span>Ganhos <strong className="valor-ganho">{formatarBRL(resumo.totalGanhos)}</strong></span>
          <span>Gastos <strong className="valor-gasto">{formatarBRL(resumo.totalGastos)}</strong></span>
          <span>Sobra <strong className={resumo.sobra >= 0 ? 'valor-ganho' : 'valor-gasto'}>{formatarBRL(resumo.sobra)}</strong></span>
        </div>
      </div>

      <div className="card rolavel">
        <h2>Por categoria</h2>
        <table className="tabela">
          <thead>
            <tr><th>Categoria</th><th>Total</th><th>% da renda</th></tr>
          </thead>
          <tbody>
            {resumo.linhas.map((l) => (
              <tr
                key={l.categoriaId}
                onClick={() => setCategoriaAberta(l.categoriaId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCategoriaAberta(l.categoriaId); }
                }}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
              >
                <td>{l.nome}</td>
                <td className={l.tipo === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>{formatarBRL(l.total)}</td>
                <td>{pct(l.pctDaRenda)}</td>
              </tr>
            ))}
            {resumo.linhas.length === 0 && <tr><td colSpan={3}>Sem movimentos no mês.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card rolavel">
        <h2>Comparativo</h2>
        <table className="tabela">
          <thead>
            <tr><th>Categoria</th><th>{mes}</th><th>mês anterior</th><th>ano passado</th><th>média 3m</th></tr>
          </thead>
          <tbody>
            {comparativo.map((c) => {
              const media = media3m(c.categoriaId);
              return (
                <tr key={c.categoriaId}>
                  <td>{c.nome}</td>
                  <td className={c.tipo === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>{formatarBRL(c.atual)}</td>
                  <td className={c.tipo === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>{formatarBRL(c.mesAnterior)}</td>
                  <td className={c.tipo === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>{formatarBRL(c.anoAnterior)}</td>
                  <td className={c.tipo === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>{media == null ? '—' : formatarBRL(media)}</td>
                </tr>
              );
            })}
            {comparativo.length === 0 && <tr><td colSpan={5}>Sem dados para comparar.</td></tr>}
          </tbody>
        </table>
      </div>

      {cartaoDaCategoria ? (
        <FaturaCategoriaSheet
          aberto={categoriaAberta !== null}
          cartao={cartaoDaCategoria}
          mes={mes}
          comprasCartao={dados.comprasCartao}
          categoriasCartao={dados.categoriasCartao}
          horizonteProjecao={dados.config.horizonteProjecao}
          onFechar={() => setCategoriaAberta(null)}
          onAbrirCartao={() => { setAba('cartao'); setCategoriaAberta(null); }}
        />
      ) : (
        <LancamentosSheet
          aberto={categoriaAberta !== null}
          categoriaId={categoriaAberta}
          nome={categoriaObj?.nome ?? ''}
          tipo={categoriaObj?.tipo ?? 'gasto'}
          mes={mes}
          boxIds={ids}
          lancamentos={dados.lancamentos}
          incluirPrevistos={incluirPrevistos}
          onFechar={() => setCategoriaAberta(null)}
        />
      )}
    </div>
  );
}
