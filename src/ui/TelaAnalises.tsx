import { Suspense, lazy, useState } from 'react';
import {
  compararMeses, mediaMovel3, resumoMensal, serieMensal, serieMensalResumo,
} from '../domain/aggregations';
import { addMeses, formatarDataBR, mesDe } from '../domain/dates';
import { resumoAssinaturasDoMes } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { ID, Viagem } from '../domain/types';
import { itensDaViagem, totalViagemNoMes } from '../domain/viagem';
import { boxIdsSelecionadas, useApp } from '../state/store';
import AssinaturasResumoSheet from './AssinaturasResumoSheet';
import ComposicaoBarChart, { type LinhaComposicao } from './ComposicaoBarChart';
import FaturaCategoriaSheet from './FaturaCategoriaSheet';
import LancamentosSheet from './LancamentosSheet';
import ViagemSheet from './ViagemSheet';

const EvolucaoMensalChart = lazy(() => import('./EvolucaoMensalChart'));

function nomeMes(mes: string): string {
  return new Date(`${mes}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function TelaAnalises() {
  const { dados, boxSel, hoje, setAba } = useApp();
  const [mes, setMes] = useState(() => mesDe(hoje));
  const [incluirPrevistos, setIncluirPrevistos] = useState(true);
  const [categoriaAberta, setCategoriaAberta] = useState<ID | null>(null);
  const [assinaturasAberto, setAssinaturasAberto] = useState(false);
  const [viagemAberta, setViagemAberta] = useState<Viagem | null>(null);
  if (!dados) return null;
  const categoriaObj = dados.categorias.find((c) => c.id === categoriaAberta);
  const cartaoDaCategoria = dados.cartoes.find((c) => c.categoriaFaturaId === categoriaAberta) ?? null;
  const ids = boxIdsSelecionadas(dados, boxSel);
  const resumo = resumoMensal(mes, ids, dados.categorias, dados.lancamentos, incluirPrevistos);
  const base = Math.max(resumo.totalGanhos, resumo.totalGastos, 1);
  const comparativo = compararMeses(mes, ids, dados.categorias, dados.lancamentos, incluirPrevistos);
  const resumoAssinaturas = resumoAssinaturasDoMes(mes, ids, dados.cartoes, dados.comprasCartao, dados.recorrenciasCartao);
  // tendência: média móvel de 3 meses terminando no mês selecionado
  const meses = [-5, -4, -3, -2, -1, 0].map((n) => addMeses(mes, n));
  const serieEvolucao = serieMensalResumo(meses, ids, dados.categorias, dados.lancamentos, incluirPrevistos);
  const media3m = (categoriaId: string) =>
    mediaMovel3(serieMensal(categoriaId, meses, ids, dados.lancamentos, incluirPrevistos)).at(-1);
  const viagensNoMes = dados.viagens
    .map((v) => ({
      viagem: v,
      total: totalViagemNoMes(v, mes, ids, dados.lancamentos, dados.comprasCartao, dados.cartoes, incluirPrevistos),
    }))
    .filter((x) => x.total !== 0);
  const linhasComposicao: LinhaComposicao[] = [
    ...resumo.linhas.map((l) => ({
      chave: l.categoriaId, nome: l.nome, tipo: l.tipo, total: l.total, pctDaRenda: l.pctDaRenda,
    })),
    ...(resumoAssinaturas.totalCent > 0
      ? [{
        chave: 'assinaturas', nome: 'Assinaturas', badge: 'todos os cartões',
        tipo: 'gasto' as const, total: resumoAssinaturas.totalCent, pctDaRenda: null,
      }]
      : []),
    ...viagensNoMes.map(({ viagem, total }) => ({
      chave: `viagem:${viagem.id}`,
      nome: `viagem - ${formatarDataBR(viagem.dataInicio)} ~ ${formatarDataBR(viagem.dataFim)}`,
      tipo: 'gasto' as const, total, pctDaRenda: null,
    })),
  ];

  const abrirComposicao = (chave: string) => {
    if (chave === 'assinaturas') { setAssinaturasAberto(true); return; }
    if (chave.startsWith('viagem:')) {
      const viagem = dados.viagens.find((v) => v.id === chave.slice('viagem:'.length));
      if (viagem) setViagemAberta(viagem);
      return;
    }
    setCategoriaAberta(chave);
  };
  const viagensComTotal = [...dados.viagens]
    .sort((a, b) => (a.dataInicio < b.dataInicio ? 1 : -1))
    .map((v) => ({
      viagem: v,
      total: itensDaViagem(v, dados.lancamentos, dados.comprasCartao, ids, dados.cartoes, incluirPrevistos).total,
    }));

  return (
    <div className="tela">
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
        <div className="resumo-barras">
          <div className="resumo-barra-trilho">
            <div className="resumo-barra-preenchimento ganho" style={{ width: `${Math.round((resumo.totalGanhos / base) * 10000) / 100}%` }} />
          </div>
          <div className="resumo-barra-trilho">
            <div className="resumo-barra-preenchimento gasto" style={{ width: `${Math.round((resumo.totalGastos / base) * 10000) / 100}%` }} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Por categoria</h2>
        <p className="sub" style={{ margin: '-4px 0 0' }}>
          barras na mesma escala do card acima (100% = maior entre ganhos e gastos do mês)
        </p>
        <ComposicaoBarChart linhas={linhasComposicao} base={base} onClicarLinha={abrirComposicao} />
      </div>

      <div className="card">
        <h2>Evolução mensal</h2>
        <Suspense fallback={null}>
          <EvolucaoMensalChart serie={serieEvolucao} mesAtual={mes} />
        </Suspense>
      </div>

      <div className="card rolavel">
        <h2>Viagens</h2>
        <div className="lista">
          {viagensComTotal.map(({ viagem, total }) => (
            <div className="item" key={viagem.id} style={{ cursor: 'pointer' }} onClick={() => setViagemAberta(viagem)}>
              <div className="cresce">
                {viagem.nome}
                <div className="sub">{formatarDataBR(viagem.dataInicio)} – {formatarDataBR(viagem.dataFim)}</div>
              </div>
              <span className="valor-gasto">{formatarBRL(total)}</span>
            </div>
          ))}
          {viagensComTotal.length === 0 && <p className="sub">Nenhuma viagem cadastrada — crie em Ajustes.</p>}
        </div>
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

      <AssinaturasResumoSheet
        aberto={assinaturasAberto}
        itens={resumoAssinaturas.itens}
        totalCent={resumoAssinaturas.totalCent}
        onFechar={() => setAssinaturasAberto(false)}
      />
      <ViagemSheet
        aberto={viagemAberta !== null}
        viagem={viagemAberta}
        boxIds={ids}
        lancamentos={dados.lancamentos}
        comprasCartao={dados.comprasCartao}
        cartoes={dados.cartoes}
        incluirPrevistos={incluirPrevistos}
        onFechar={() => setViagemAberta(null)}
      />
    </div>
  );
}
