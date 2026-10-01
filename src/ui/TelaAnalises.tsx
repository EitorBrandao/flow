import { Suspense, lazy, useEffect, useState } from 'react';
import { bancosDaBox, dadosDoBanco, type FiltroBanco } from '../domain/bancos';
import {
  compararMeses, compararPeriodos, mediaMovel3, resumoPeriodo, serieMensal, serieMensalResumo,
  faturaExplicaOMes,
} from '../domain/aggregations';
import { addMeses, formatarDataBR, mesAbreviado, mesDe } from '../domain/dates';
import { ajustesDoCartao, categoriasFaturaIds, faturaDoMes, resumoAssinaturasDoPeriodo } from '../domain/fatura';
import { unificarCategoriasPorNome } from '../domain/categorias';
import { categoriasTransferenciaIds } from '../domain/transferencia';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import {
  semColunaAnoAnterior, estadoInicial, mesesDoPeriodo, notaComparacao, rotuloColunaPeriodo, rotuloIntervalo,
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
import SeletorMes from './SeletorMes';
import SeletorFiltroBanco from './SeletorFiltroBanco';
import SeletorPeriodo from './SeletorPeriodo';
import ViagemSheet from './ViagemSheet';
import { useModo } from './useModo';

const EvolucaoMensalChart = lazy(() => import('./EvolucaoMensalChart'));

export default function TelaAnalises() {
  const { dados: dadosTodos, boxSel, hoje, setAba } = useApp();
  const [periodo, setPeriodo] = useState<EstadoPeriodo>(() => estadoInicial(mesDe(hoje)));
  const [incluirPrevistosEscolha, setIncluirPrevistos] = useState(true);
  const [filtroBanco, setFiltroBanco] = useState<FiltroBanco>('todos');
  const simples = useModo('analises') === 'simples';
  useEffect(() => {
    setFiltroBanco('todos');
  }, [boxSel]);
  // No Simples a tela não mostra período, previstos nem banco: volta tudo ao padrão, para nunca
  // exibir um número filtrado por algo que o modo esconde.
  useEffect(() => {
    if (!simples) return;
    setPeriodo((p) => (p.modo === 'mes' ? p : { ...p, modo: 'mes' }));
    setIncluirPrevistos(true);
    setFiltroBanco('todos');
  }, [simples]);
  // folha de um mês (lançamentos ou fatura); `doPeriodo` = aberta pela folha do período
  const [detalhe, setDetalhe] = useState<{ categoriaId: ID; mes: string; doPeriodo: boolean; forcarFatura?: boolean } | null>(null);
  // folha do período (vários meses) de uma categoria
  const [categoriaPeriodo, setCategoriaPeriodo] = useState<ID | null>(null);
  const [assinaturasAberto, setAssinaturasAberto] = useState(false);
  const [viagemAberta, setViagemAberta] = useState<Viagem | null>(null);
  const [categoriaCartaoAberta, setCategoriaCartaoAberta] = useState<LinhaCategoriaCartao | null>(null);
  if (!dadosTodos) return null;
  // Todo o resto da tela lê `dados`: com o filtro ligado, ele já vem só com os lançamentos e as
  // compras de cartão do banco escolhido (`dadosDoBanco`).
  // O Simples ignora na hora o que o modo Avançado escolheu (sem esperar o efeito acima).
  const incluirPrevistos = simples || incluirPrevistosEscolha;
  const dadosDoFiltro = dadosDoBanco(dadosTodos, simples ? 'todos' : filtroBanco);
  // Na casa, cada box tem a sua "mercado": junta por nome e tipo para a categoria aparecer uma vez.
  const dados = boxSel === 'casa'
    ? {
      ...dadosDoFiltro,
      ...unificarCategoriasPorNome(
        dadosDoFiltro.categorias, dadosDoFiltro.lancamentos,
        new Set([...categoriasFaturaIds(dadosDoFiltro.cartoes), ...categoriasTransferenciaIds(dadosDoFiltro.boxes)]),
      ),
    }
    : dadosDoFiltro;
  const periodoEfetivo: EstadoPeriodo = simples && periodo.modo !== 'mes' ? { ...periodo, modo: 'mes' } : periodo;
  const meses = mesesDoPeriodo(periodoEfetivo);
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
  const bancosSel = bancosDaBox(dadosTodos.bancos, ids);
  // total da fatura de um cartão num mês — base para decidir se a folha do mês é a fatura
  const totalFatura = (cartaoId: ID, m: string) => {
    const cartao = dados.cartoes.find((c) => c.id === cartaoId)!;
    return faturaDoMes(
      cartao, dados.comprasCartao.filter((c) => c.cartaoId === cartaoId), m,
      ajustesDoCartao(dados.ajustesFechamento, cartaoId), dados.config.horizonteProjecao,
    ).totalCent;
  };
  // categoria de fatura: a folha da fatura só quando ela explica o valor do mês (tudo veio do
  // cartão e bate com o total); senão, a folha lista os lançamentos que somam a barra, com um
  // link para a fatura (`forcarFatura`)
  const totalFaturaDetalhe = cartaoDaCategoria ? totalFatura(cartaoDaCategoria.id, mesDetalhe) : 0;
  const abrirFatura = cartaoDaCategoria != null && categoriaAberta != null && (detalhe?.forcarFatura === true
    || faturaExplicaOMes(categoriaAberta, mesDetalhe, ids, dados.lancamentos, incluirPrevistos, totalFaturaDetalhe));
  const resumo = resumoPeriodo(meses, ids, dados.categorias, dados.lancamentos, incluirPrevistos);
  const base = Math.max(resumo.totalGanhos, resumo.totalGastos, 1);
  const comparativo = varios ? [] : compararMeses(mes, ids, dados.categorias, dados.lancamentos, incluirPrevistos);
  const comparativoPeriodo = varios ? compararPeriodos(meses, ids, dados.categorias, dados.lancamentos, incluirPrevistos) : [];
  const semAnoAnterior = semColunaAnoAnterior(meses);
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
  const cartaoDoPeriodo = dados.cartoes.find((c) => c.categoriaFaturaId === categoriaPeriodo);
  // o que o toque num mês abre, na mesma regra da folha do mês (`abrirFatura`): fatura em todo
  // mês, lançamentos em todo mês, ou cada mês o seu — aí o texto fica neutro
  const mesesComLancamentoAvulso = categoriaPeriodo && cartaoDoPeriodo
    ? meses.filter((m) => !faturaExplicaOMes(
      categoriaPeriodo, m, ids, dados.lancamentos, incluirPrevistos, totalFatura(cartaoDoPeriodo.id, m),
    )).length
    : meses.length;
  const verMesPeriodo = mesesComLancamentoAvulso === 0
    ? 'a fatura'
    : mesesComLancamentoAvulso === meses.length ? 'os lançamentos' : 'o detalhe do mês';
  const fecharDetalhe = () => setDetalhe(null);
  const voltarAoPeriodo = detalhe?.doPeriodo
    ? () => { setCategoriaPeriodo(detalhe.categoriaId); setDetalhe(null); }
    : undefined;
  const media = (v: number) => Math.round(v / meses.length);

  return (
    <div className="tela">
      {simples ? (
        <div className="barra-fixa">
          <SeletorMes mes={periodoEfetivo.mes} onMudar={(m) => setPeriodo({ ...periodoEfetivo, mes: m })} />
        </div>
      ) : (
        <>
          <SeletorPeriodo estado={periodo} mesHoje={mesDe(hoje)} onMudar={setPeriodo} />
          <label className="linha">
            <input type="checkbox" checked={incluirPrevistos} onChange={(e) => setIncluirPrevistos(e.target.checked)} />
            incluir previstos
          </label>
          <SeletorFiltroBanco bancos={bancosSel} valor={filtroBanco} onMudar={setFiltroBanco} />
        </>
      )}

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
        <p className="sub" style={{ margin: '-4px 0 10px' }}>
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

      {!simples && (
        <>
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
                        <th>Categoria</th><th>{rotuloColunaPeriodo(periodoEfetivo.modo, meses)}</th><th>anterior</th>
                        {!semAnoAnterior && <th>ano anterior</th>}<th>média/mês</th>
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
                      {comparativoPeriodo.length === 0 && <tr><td colSpan={semAnoAnterior ? 4 : 5}>Sem dados para comparar.</td></tr>}
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
            rotuloPeriodo={rotuloColunaPeriodo(periodoEfetivo.modo, meses)}
            boxIds={ids}
            cartoes={dados.cartoes}
            categoriasCartao={dados.categoriasCartao}
            comprasCartao={dados.comprasCartao}
            ajustesFechamento={dados.ajustesFechamento}
            onAbrir={setCategoriaCartaoAberta}
          />
        </>
      )}

      {abrirFatura && cartaoDaCategoria ? (
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
          boxes={boxSel === 'casa' ? dados.boxes : undefined}
          onFechar={fecharDetalhe}
          onVoltar={voltarAoPeriodo}
          verFatura={cartaoDaCategoria && detalhe ? {
            totalCent: totalFaturaDetalhe,
            onAbrir: () => setDetalhe({ ...detalhe, mes: mesDetalhe, forcarFatura: true }),
          } : undefined}
        />
      )}

      <CategoriaPeriodoSheet
        aberto={categoriaPeriodo !== null}
        nome={categoriaPeriodoObj?.nome ?? ''}
        tipo={categoriaPeriodoObj?.tipo ?? 'gasto'}
        meses={meses}
        serie={seriePeriodo}
        verMes={verMesPeriodo}
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
        periodo={varios ? rotuloIntervalo(meses) : undefined}
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
