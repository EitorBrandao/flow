import { Suspense, lazy, useState } from 'react';
import {
  compararMeses, compararPeriodos, mediaMovel3, resumoPeriodo, serieMensal, serieMensalResumo,
} from '../domain/aggregations';
import { addMeses, formatarDataBR, mesAbreviado, mesDe } from '../domain/dates';
import { resumoAssinaturasDoPeriodo } from '../domain/fatura';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import {
  anoAnteriorRepete, estadoInicial, mesesDoPeriodo, notaComparacao, rotuloColunaPeriodo,
  type EstadoPeriodo,
} from '../domain/periodo';
import type { ID, Viagem } from '../domain/types';
import { itensDaViagem, totalViagemNoMes } from '../domain/viagem';
import { boxIdsSelecionadas, useApp } from '../state/store';
import AssinaturasResumoSheet from './AssinaturasResumoSheet';
import CategoriaPeriodoSheet from './CategoriaPeriodoSheet';
import CategoriaCartaoHistoricoSheet from './CategoriaCartaoHistoricoSheet';
import CategoriasCartaoCard, { type LinhaCategoriaCartao } from './CategoriasCartaoCard';
import ComposicaoBarChart, { type LinhaComposicao } from './ComposicaoBarChart';
import FaturaCategoriaSheet from './FaturaCategoriaSheet';
import LancamentosSheet from './LancamentosSheet';
import SeletorPeriodo from './SeletorPeriodo';
import ViagemSheet from './ViagemSheet';

const EvolucaoMensalChart = lazy(() => import('./EvolucaoMensalChart'));

export default function TelaAnalises() {
  const { dados, boxSel, hoje, setAba } = useApp();
  const [periodo, setPeriodo] = useState<EstadoPeriodo>(() => estadoInicial(mesDe(hoje)));
  const [incluirPrevistos, setIncluirPrevistos] = useState(true);
  // folha de um mês (lançamentos ou fatura); `doPeriodo` = aberta pela folha do período
  const [detalhe, setDetalhe] = useState<{ categoriaId: ID; mes: string; doPeriodo: boolean } | null>(null);
  // folha do período (vários meses) de uma categoria
  const [categoriaPeriodo, setCategoriaPeriodo] = useState<ID | null>(null);
  const [assinaturasAberto, setAssinaturasAberto] = useState(false);
  const [viagemAberta, setViagemAberta] = useState<Viagem | null>(null);
  const [categoriaCartaoAberta, setCategoriaCartaoAberta] = useState<LinhaCategoriaCartao | null>(null);
  if (!dados) return null;
  const meses = mesesDoPeriodo(periodo);
  const varios = meses.length > 1;
  // no modo Mês, o próprio mês; nos outros, o último do período (base das folhas por mês)
  const mes = meses[meses.length - 1];
  const categoriaAberta = detalhe?.categoriaId ?? null;
  // aberta pela folha do período: fica no mês tocado; no modo Mês, acompanha o seletor
  const mesDetalhe = detalhe?.doPeriodo ? detalhe.mes : mes;
  const categoriaObj = dados.categorias.find((c) => c.id === categoriaAberta);
  const cartaoDaCategoria = dados.cartoes.find((c) => c.categoriaFaturaId === categoriaAberta) ?? null;
  const cartaoDoHistorico = dados.cartoes.find((c) => c.id === categoriaCartaoAberta?.cartaoId) ?? null;
  const categoriaDoHistorico = dados.categoriasCartao.find((c) => c.id === categoriaCartaoAberta?.categoriaCartaoId) ?? null;
  const ids = boxIdsSelecionadas(dados, boxSel);
  const resumo = resumoPeriodo(meses, ids, dados.categorias, dados.lancamentos, incluirPrevistos);
  const base = Math.max(resumo.totalGanhos, resumo.totalGastos, 1);
  const comparativo = varios ? [] : compararMeses(mes, ids, dados.categorias, dados.lancamentos, incluirPrevistos);
  const comparativoPeriodo = varios ? compararPeriodos(meses, ids, dados.categorias, dados.lancamentos, incluirPrevistos) : [];
  const repete = anoAnteriorRepete(meses);
  const resumoAssinaturas = resumoAssinaturasDoPeriodo(
    meses, ids, dados.cartoes, dados.comprasCartao, dados.recorrenciasCartao, dados.ajustesFechamento,
  );
  // tendência: média móvel de 3 meses terminando no mês selecionado
  const mesesEvolucao = varios ? meses : [-5, -4, -3, -2, -1, 0].map((n) => addMeses(mes, n));
  const serieEvolucao = serieMensalResumo(mesesEvolucao, ids, dados.categorias, dados.lancamentos, incluirPrevistos);
  const media3m = (categoriaId: string) =>
    mediaMovel3(serieMensal(categoriaId, mesesEvolucao, ids, dados.lancamentos, incluirPrevistos)).at(-1);
  const viagensNoPeriodo = dados.viagens
    .map((v) => ({
      viagem: v,
      total: meses.reduce((soma, m) => soma + totalViagemNoMes(
        v, m, ids, dados.lancamentos, dados.comprasCartao, dados.cartoes, incluirPrevistos,
        dados.categorias, dados.ajustesFechamento,
      ), 0),
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
    ...viagensNoPeriodo.map(({ viagem, total }) => ({
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
    if (varios) { setCategoriaPeriodo(chave); return; }
    setDetalhe({ categoriaId: chave, mes, doPeriodo: false });
  };
  const viagensComTotal = [...dados.viagens]
    .sort((a, b) => (a.dataInicio < b.dataInicio ? 1 : -1))
    .map((v) => ({
      viagem: v,
      total: itensDaViagem(v, dados.lancamentos, dados.comprasCartao, ids, dados.cartoes, incluirPrevistos, dados.categorias).total,
    }));

  const categoriaPeriodoObj = dados.categorias.find((c) => c.id === categoriaPeriodo);
  const seriePeriodo = categoriaPeriodo
    ? serieMensal(categoriaPeriodo, meses, ids, dados.lancamentos, incluirPrevistos)
    : [];
  const periodoEhFatura = dados.cartoes.some((c) => c.categoriaFaturaId === categoriaPeriodo);
  const fecharDetalhe = () => setDetalhe(null);
  const voltarAoPeriodo = detalhe?.doPeriodo
    ? () => { setCategoriaPeriodo(detalhe.categoriaId); setDetalhe(null); }
    : undefined;
  const media = (v: number) => Math.round(v / meses.length);

  return (
    <div className="tela">
      <SeletorPeriodo estado={periodo} mesHoje={mesDe(hoje)} onMudar={setPeriodo} />
      <label className="linha">
        <input type="checkbox" checked={incluirPrevistos} onChange={(e) => setIncluirPrevistos(e.target.checked)} />
        incluir previstos
      </label>

      <div className="card">
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <span>Ganhos <strong className={classeEfeito(resumo.totalGanhos)}>{formatarBRL(resumo.totalGanhos)}</strong></span>
          <span>Gastos <strong className={classeEfeito(-resumo.totalGastos)}>{formatarBRL(resumo.totalGastos)}</strong></span>
          <span>Sobra <strong className={classeEfeito(resumo.sobra)}>{formatarBRL(resumo.sobra)}</strong></span>
        </div>
        {varios && (
          <p className="sub" style={{ margin: '8px 0 0' }}>
            média por mês: ganhos <strong className={classeEfeito(resumo.totalGanhos)}>{formatarBRL(media(resumo.totalGanhos))}</strong>
            {' · '}gastos <strong className={classeEfeito(-resumo.totalGastos)}>{formatarBRL(media(resumo.totalGastos))}</strong>
            {' · '}sobra <strong className={classeEfeito(resumo.sobra)}>{formatarBRL(media(resumo.sobra))}</strong>
          </p>
        )}
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
          barras na mesma escala do card acima (100% = maior entre ganhos e gastos {varios ? 'do período' : 'do mês'})
        </p>
        <ComposicaoBarChart linhas={linhasComposicao} base={base} onClicarLinha={abrirComposicao}
          vazio={varios ? 'Sem movimentos no período.' : 'Sem movimentos no mês.'} />
      </div>

      <div className="card">
        <h2>Evolução mensal</h2>
        <Suspense fallback={null}>
          <EvolucaoMensalChart serie={serieEvolucao} mesAtual={varios ? null : mes} />
        </Suspense>
      </div>

      <div className="card rolavel">
        <h2>Viagens</h2>
        <div className="lista">
          {viagensComTotal.map(({ viagem, total }) => (
            <button className="item" key={viagem.id} onClick={() => setViagemAberta(viagem)}>
              <div className="cresce">
                {viagem.nome}
                <div className="sub">{formatarDataBR(viagem.dataInicio)} – {formatarDataBR(viagem.dataFim)}</div>
              </div>
              {/* sem gasto, sem pílula vermelha — mesma regra da fatura sem gasto; estorno maior
                  que o gasto do mês vira efeito positivo no saldo, e fica verde */}
              <span className={classeEfeito(-total)}>{formatarBRL(total)}</span>
            </button>
          ))}
          {viagensComTotal.length === 0 && <p className="sub">Nenhuma viagem cadastrada — crie em Ajustes.</p>}
        </div>
      </div>

      <div className="card">
        <h2>Comparativo</h2>
        {varios && <p className="sub" style={{ margin: '2px 2px 0' }}>{notaComparacao(meses)}</p>}
        <div className="rolavel">
          <table className="tabela">
            {varios ? (
              <>
                <thead>
                  <tr>
                    <th>Categoria</th><th>{rotuloColunaPeriodo(periodo.modo, meses)}</th><th>anterior</th>
                    {!repete && <th>ano anterior</th>}<th>média/mês</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativoPeriodo.map((c) => {
                    const cor = (v: number) => classeEfeito(efeitoNoSaldo(v, c.tipo));
                    return (
                      <tr key={c.categoriaId}>
                        <td>{c.nome}</td>
                        <td className={cor(c.atual)}>{formatarBRL(c.atual)}</td>
                        <td className={cor(c.anterior)}>{formatarBRL(c.anterior)}</td>
                        {c.anoAnterior != null && <td className={cor(c.anoAnterior)}>{formatarBRL(c.anoAnterior)}</td>}
                        <td className={cor(c.mediaMensal)}>{formatarBRL(c.mediaMensal)}</td>
                      </tr>
                    );
                  })}
                  {comparativoPeriodo.length === 0 && <tr><td colSpan={repete ? 4 : 5}>Sem dados para comparar.</td></tr>}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr><th>Categoria</th><th>{mesAbreviado(mes)}</th><th>mês anterior</th><th>ano passado</th><th>média 3m</th></tr>
                </thead>
                <tbody>
                  {comparativo.map((c) => {
                    const media = media3m(c.categoriaId);
                    return (
                      <tr key={c.categoriaId}>
                        <td>{c.nome}</td>
                        <td className={classeEfeito(efeitoNoSaldo(c.atual, c.tipo))}>{formatarBRL(c.atual)}</td>
                        <td className={classeEfeito(efeitoNoSaldo(c.mesAnterior, c.tipo))}>{formatarBRL(c.mesAnterior)}</td>
                        <td className={classeEfeito(efeitoNoSaldo(c.anoAnterior, c.tipo))}>{formatarBRL(c.anoAnterior)}</td>
                        <td className={media == null ? 'valor-neutro' : classeEfeito(efeitoNoSaldo(media, c.tipo))}>{media == null ? '—' : formatarBRL(media)}</td>
                      </tr>
                    );
                  })}
                  {comparativo.length === 0 && <tr><td colSpan={5}>Sem dados para comparar.</td></tr>}
                </tbody>
              </>
            )}
          </table>
        </div>
      </div>

      <CategoriasCartaoCard
        mes={mes}
        periodo={varios ? meses : undefined}
        rotuloPeriodo={rotuloColunaPeriodo(periodo.modo, meses)}
        boxIds={ids}
        cartoes={dados.cartoes}
        categoriasCartao={dados.categoriasCartao}
        comprasCartao={dados.comprasCartao}
        ajustesFechamento={dados.ajustesFechamento}
        onAbrir={setCategoriaCartaoAberta}
      />

      {cartaoDaCategoria ? (
        <FaturaCategoriaSheet
          aberto={categoriaAberta !== null}
          cartao={cartaoDaCategoria}
          mes={mesDetalhe}
          comprasCartao={dados.comprasCartao}
          categoriasCartao={dados.categoriasCartao}
          horizonteProjecao={dados.config.horizonteProjecao}
          ajustesFechamento={dados.ajustesFechamento}
          onFechar={fecharDetalhe}
          onVoltar={voltarAoPeriodo}
          onAbrirCartao={() => { setAba('cartao'); fecharDetalhe(); }}
        />
      ) : (
        <LancamentosSheet
          aberto={categoriaAberta !== null}
          categoriaId={categoriaAberta}
          nome={categoriaObj?.nome ?? ''}
          tipo={categoriaObj?.tipo ?? 'gasto'}
          mes={mesDetalhe}
          boxIds={ids}
          lancamentos={dados.lancamentos}
          incluirPrevistos={incluirPrevistos}
          onFechar={fecharDetalhe}
          onVoltar={voltarAoPeriodo}
        />
      )}

      <CategoriaPeriodoSheet
        aberto={categoriaPeriodo !== null}
        nome={categoriaPeriodoObj?.nome ?? ''}
        tipo={categoriaPeriodoObj?.tipo ?? 'gasto'}
        meses={meses}
        serie={seriePeriodo}
        verMes={periodoEhFatura ? 'a fatura' : 'os lançamentos'}
        onAbrirMes={(m) => {
          if (categoriaPeriodo) setDetalhe({ categoriaId: categoriaPeriodo, mes: m, doPeriodo: true });
          setCategoriaPeriodo(null);
        }}
        onFechar={() => setCategoriaPeriodo(null)}
      />

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
        categorias={dados.categorias}
        onFechar={() => setViagemAberta(null)}
      />

      <CategoriaCartaoHistoricoSheet
        aberto={categoriaCartaoAberta !== null}
        cartao={cartaoDoHistorico}
        categoria={categoriaDoHistorico}
        mes={mes}
        periodo={varios ? meses : undefined}
        comprasCartao={dados.comprasCartao}
        ajustesFechamento={dados.ajustesFechamento}
        onFechar={() => setCategoriaCartaoAberta(null)}
      />
    </div>
  );
}
