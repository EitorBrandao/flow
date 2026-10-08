import { useId, useMemo, useState } from 'react';
import * as repo from '../db/repo';
import { dataComDia, formatarDataBR, mesAbreviado, mesDe, ultimoDiaDoMes } from '../domain/dates';
import { cenarioDaVisao } from '../domain/cenarios';
import { projetarBoxes, type DiaSaldo } from '../domain/projection';
import { estenderRecorrencias, extremosPossiveis, larguraColunaValor, periodoPadrao, primeiroDiaNegativo, resumoMensal, type LinhaMes, type PeriodoSimulacao } from '../domain/simulacao';
import { agoraISO, novoId, type ID, type ISODate } from '../domain/types';
import { boxIdEfetivo, boxIdsSelecionadas, cenariosLigados, useApp } from '../state/store';
import CenarioCard from './CenarioCard';
import SeletorPeriodoSimular from './SeletorPeriodoSimular';
import TabelaSimulacao from './TabelaSimulacao';

/** Fluxo › Simular: cenários de gastos e ganhos futuros e o efeito deles no saldo, mês a mês. */
export default function SimuladorFluxo() {
  const { dados, boxSel, hoje, recarregar } = useApp();
  const [nomeNovo, setNomeNovo] = useState('');
  const [aberto, setAberto] = useState<ID | null>(null);
  const [tabelaAberta, setTabelaAberta] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoSimulacao | null>(null);
  const uid = useId();

  // Memoizado: `projetarBoxes` roda uma vez por cenário (+ uma vez combinado) — sem isto,
  // cada tecla em "Novo cenário" (estado local, não ligado a `dados`/`boxSel`/`hoje`)
  // refaria a projeção inteira a cada render.
  const calc = useMemo(() => {
    if (!dados) return null;
    const ids = boxIdsSelecionadas(dados, boxSel);
    const p = periodo ?? periodoPadrao(hoje, dados.config.horizonteProjecao);

    // Calcula o fim do período e estende as recorrências
    const [anoFim, mesFim] = p.ate.split('-').map(Number);
    const ultimoDiaFim = ultimoDiaDoMes(anoFim, mesFim);
    const fim = dataComDia(anoFim, mesFim, ultimoDiaFim);
    const extras = estenderRecorrencias(dados, fim);

    // Mantém pelo menos o horizonte do app
    const horizonte = fim > dados.config.horizonteProjecao ? fim : dados.config.horizonteProjecao;

    const serieDe = (ligados: ReadonlySet<ID>) => projetarBoxes(ids, {
      boxes: dados.boxes, categorias: dados.categorias, lancamentos: [...dados.lancamentos, ...extras],
      cenariosLigados: ligados, horizonte,
    });
    // O aviso de saldo negativo olha dia a dia, dentro do período: o saldo de fim de mês pode
    // estar positivo e o do meio dele, não (mesma leitura do gráfico).
    const negativoDe = (serie: DiaSaldo[]) =>
      primeiroDiaNegativo(serie.filter((d) => d.data <= fim), 'saldoComCenarios', hoje);
    const ligados = cenariosLigados(dados, boxSel);
    const serieCombinada = serieDe(ligados);
    const combinado = resumoMensal(serieCombinada, hoje, p.ate);
    const porCenario = new Map<ID, LinhaMes[]>();
    const negativoPorCenario = new Map<ID, ISODate | null>();
    for (const c of dados.cenarios.filter((x) => cenarioDaVisao(x, boxSel))) {
      const serie = serieDe(new Set([c.id]));
      porCenario.set(c.id, resumoMensal(serie, hoje, p.ate));
      negativoPorCenario.set(c.id, negativoDe(serie));
    }
    const sem = combinado.map((l) => l.sem);
    const ext = extremosPossiveis(sem, [...porCenario.values()].map((ls) => ls.map((l) => l.dif)));
    const larguraCh = larguraColunaValor(sem, ext);
    const negativoEm = negativoDe(serieCombinada);
    const ultimoMes = combinado.at(-1)?.mes;
    return { ligados, combinado, porCenario, negativoPorCenario, larguraCh, negativoEm, ultimoMes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, boxSel, hoje, periodo]);
  if (!dados || !calc) return null;
  const { ligados, combinado, porCenario, negativoPorCenario, larguraCh, negativoEm, ultimoMes } = calc;
  const cenariosVisao = dados.cenarios.filter((c) => cenarioDaVisao(c, boxSel));

  async function criar() {
    const nome = nomeNovo.trim();
    if (!nome) return;
    const agora = agoraISO();
    const id = novoId();
    await repo.salvarCenario({ id, nome, ligado: true, escopo: boxSel, criadoEm: agora, alteradoEm: agora });
    await recarregar();
    setNomeNovo('');
    setAberto(id);
  }

  return (
    <>
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-novo`}>Novo cenário</label>
          <input id={`${uid}-novo`} placeholder="ex.: bike em 10x" value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} />
        </div>
        <button className="botao botao-primario" disabled={!nomeNovo.trim()} onClick={criar}>Criar</button>
      </div>
      <p className="sub" style={{ margin: '0 0 12px' }}>
        Cenário é uma hipótese, como comprar algo ou trocar de aluguel. Ele nunca altera o seu saldo real: só aparece aqui e no gráfico, quando ligado.
      </p>

      <section aria-label="Período">
        <p className="rotulo-grupo">Período</p>
        {calc && <SeletorPeriodoSimular periodo={periodo ?? periodoPadrao(hoje, dados.config.horizonteProjecao)} mesHoje={mesDe(hoje)} horizonte={dados.config.horizonteProjecao} onMudar={setPeriodo} />}
      </section>

      <section aria-label="Cenários ligados">
        <p className="rotulo-grupo">Cenários ligados · {ligados.size}</p>
        <div className="card" style={{ padding: '16px 0 4px' }}>
          <div style={{ padding: '0 16px' }}>
            {ligados.size === 0 ? (
              <p className="sub" style={{ margin: '0 0 12px' }}>Nenhum cenário ligado: a tabela mostra só o saldo real.</p>
            ) : negativoEm ? (
              <p className="aviso aviso-urgente" style={{ margin: '0 0 12px' }}>
                Com os cenários ligados, o saldo fica negativo em {formatarDataBR(negativoEm)}.
              </p>
            ) : (
              <p className="sub" style={{ margin: '0 0 12px' }}>
                Com os cenários ligados, o saldo segue positivo{ultimoMes ? ` até ${mesAbreviado(ultimoMes)}` : ''}.
              </p>
            )}
          </div>
          <TabelaSimulacao linhas={combinado} larguraCh={larguraCh} aberta={tabelaAberta} onAlternar={() => setTabelaAberta(!tabelaAberta)} soReal={ligados.size === 0} />
        </div>
      </section>

      <p className="rotulo-grupo">Cenários</p>
      <div className="lista">
        {[...cenariosVisao].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).map((c) => (
          <CenarioCard
            key={c.id} cenario={c} linhas={porCenario.get(c.id) ?? []} negativoEm={negativoPorCenario.get(c.id) ?? null} larguraCh={larguraCh}
            aberto={aberto === c.id} onAlternar={() => setAberto(aberto === c.id ? null : c.id)}
            boxIdNovo={boxIdEfetivo(dados, boxSel)}
          />
        ))}
        {cenariosVisao.length === 0 && <p className="sub">Nenhum cenário ainda.</p>}
      </div>
    </>
  );
}
