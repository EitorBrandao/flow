import { useId, useMemo, useState } from 'react';
import * as repo from '../db/repo';
import { dataComDia, mesAbreviado, mesDe, ultimoDiaDoMes } from '../domain/dates';
import { projetarBoxes } from '../domain/projection';
import { estenderRecorrencias, extremosPossiveis, larguraColunaValor, periodoPadrao, primeiroMesNegativo, resumoMensal, type LinhaMes, type PeriodoSimulacao } from '../domain/simulacao';
import { agoraISO, novoId, type ID } from '../domain/types';
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

    const resumo = (ligados: ReadonlySet<ID>) => resumoMensal(projetarBoxes(ids, {
      boxes: dados.boxes, categorias: dados.categorias, lancamentos: [...dados.lancamentos, ...extras],
      cenariosLigados: ligados, horizonte,
    }), hoje, p.ate);
    const ligados = cenariosLigados(dados);
    const combinado = resumo(ligados);
    const porCenario = new Map<ID, LinhaMes[]>(dados.cenarios.map((c) => [c.id, resumo(new Set([c.id]))]));
    const sem = combinado.map((l) => l.sem);
    const ext = extremosPossiveis(sem, [...porCenario.values()].map((ls) => ls.map((l) => l.dif)));
    const larguraCh = larguraColunaValor(sem, ext);
    const negativoEm = primeiroMesNegativo(combinado);
    const ultimoMes = combinado.at(-1)?.mes;
    return { ligados, combinado, porCenario, larguraCh, negativoEm, ultimoMes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, boxSel, hoje, periodo]);
  if (!dados || !calc) return null;
  const { ligados, combinado, porCenario, larguraCh, negativoEm, ultimoMes } = calc;

  async function criar() {
    const nome = nomeNovo.trim();
    if (!nome) return;
    const agora = agoraISO();
    const id = novoId();
    await repo.salvarCenario({ id, nome, ligado: true, criadoEm: agora, alteradoEm: agora });
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
                Com os cenários ligados, o saldo fica negativo em {mesAbreviado(negativoEm)}.
              </p>
            ) : (
              <p className="sub" style={{ margin: '0 0 12px' }}>
                Com os cenários ligados, o saldo segue positivo{ultimoMes ? ` até ${mesAbreviado(ultimoMes)}` : ''}.
              </p>
            )}
          </div>
          <TabelaSimulacao linhas={combinado} larguraCh={larguraCh} aberta={tabelaAberta} onAlternar={() => setTabelaAberta(!tabelaAberta)} />
        </div>
      </section>

      <p className="rotulo-grupo">Cenários</p>
      <div className="lista">
        {[...dados.cenarios].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).map((c) => (
          <CenarioCard
            key={c.id} cenario={c} linhas={porCenario.get(c.id) ?? []} larguraCh={larguraCh}
            aberto={aberto === c.id} onAlternar={() => setAberto(aberto === c.id ? null : c.id)}
            boxIdNovo={boxIdEfetivo(dados, boxSel)}
          />
        ))}
        {dados.cenarios.length === 0 && <p className="sub">Nenhum cenário ainda.</p>}
      </div>
    </>
  );
}
