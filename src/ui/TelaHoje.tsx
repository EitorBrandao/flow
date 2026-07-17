import { useId, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as repo from '../db/repo';
import { addDias } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import type { ISODate } from '../domain/types';
import { pendentes, projetarBoxes } from '../domain/projection';
import { boxIdsSelecionadas, cenariosLigados, useApp } from '../state/store';
import BalanceChart from './BalanceChart';
import CampoValor from './CampoValor';

const SETE_DIAS_MS = 7 * 86_400_000;

function ConferenciaSaldo({ saldoApp, declaradoCent, dataDeclarado, hoje, onSalvar }: {
  saldoApp: number;
  declaradoCent: number | null;
  dataDeclarado: ISODate | null;
  hoje: ISODate;
  onSalvar: (cents: number, data: ISODate) => Promise<void>;
}) {
  const [magnitude, setMagnitude] = useState(Math.abs(declaradoCent ?? 0));
  const [negativo, setNegativo] = useState((declaradoCent ?? 0) < 0);
  const [data, setData] = useState(dataDeclarado ?? hoje);
  const uid = useId();

  async function salvar() {
    const valor = negativo ? -magnitude : magnitude;
    await onSalvar(valor, data);
  }

  const diff = declaradoCent != null ? declaradoCent - saldoApp : null;

  return (
    <div style={{ marginTop: 8 }}>
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <div className="campo">
          <label htmlFor={`${uid}-saldo`}>Saldo real no banco</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <CampoValor id={`${uid}-saldo`} valorCentavos={magnitude} onChange={setMagnitude} style={{ width: 110 }} />
            <button type="button" className="botao" aria-label="Alternar sinal (positivo/negativo)" onClick={() => setNegativo(n => !n)} style={{ padding: '8px 12px' }}>
              {negativo ? '−' : '+'}
            </button>
          </div>
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-data`}>Data</label>
          <input id={`${uid}-data`} type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <button className="botao" style={{ alignSelf: 'flex-end' }} onClick={salvar}>Salvar</button>
      </div>
      {diff != null && (
        <p className="sub" style={{ margin: '4px 0 0' }}>
          {Math.abs(diff) <= 1
            ? 'Bate certinho.'
            : diff > 0
              ? `Diferença: ${formatarBRL(diff)} — falta inserir no app`
              : `Diferença: ${formatarBRL(-diff)} — sobra no app (confira duplicado ou algo não confirmado no banco)`}
          {dataDeclarado ? ` · conferido em ${dataDeclarado}` : ''}
        </p>
      )}
    </div>
  );
}

export default function TelaHoje() {
  const { dados, boxSel, hoje, recarregar, setAba } = useApp();
  const ids = dados ? boxIdsSelecionadas(dados, boxSel) : [];
  const ligados = dados ? cenariosLigados(dados) : new Set<string>();

  const serie = useMemo(
    () => dados ? projetarBoxes(ids, {
      boxes: dados.boxes, categorias: dados.categorias, lancamentos: dados.lancamentos,
      cenariosLigados: ligados, horizonte: dados.config.horizonteProjecao,
    }) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados, boxSel],
  );
  if (!dados) return null;

  const deHoje = serie.filter((s) => s.data <= hoje).at(-1);
  const janela = serie.filter((s) => s.data >= addDias(hoje, -7) && s.data <= addDias(hoje, 28));
  const fila = pendentes(dados.lancamentos.filter((l) => ids.includes(l.boxId)), hoje);
  const nomeCat = (id: string) => dados.categorias.find((c) => c.id === id)?.nome ?? '?';
  const tipoCat = (id: string) => dados.categorias.find((c) => c.id === id)?.tipo ?? 'gasto';

  const backupVelho = dados.config.mudancasDesdeBackup
    && (!dados.config.ultimoBackupEm
      || Date.parse(dados.config.ultimoBackupEm) < Date.now() - SETE_DIAS_MS);

  const boxAtual = boxSel !== 'casa' ? dados.boxes.find((b) => b.id === boxSel) : undefined;
  const declaradoCent = (boxSel === 'casa' ? dados.config.saldoDeclaradoCent : boxAtual?.saldoDeclaradoCent) ?? null;
  const dataDeclarado = (boxSel === 'casa' ? dados.config.dataSaldoDeclarado : boxAtual?.dataSaldoDeclarado) ?? null;

  async function salvarSaldoReal(cents: number, data: string) {
    if (boxSel === 'casa') await repo.salvarConfig({ saldoDeclaradoCent: cents, dataSaldoDeclarado: data });
    else if (boxAtual) await repo.salvarBox({ ...boxAtual, saldoDeclaradoCent: cents, dataSaldoDeclarado: data });
    await recarregar();
  }

  async function confirmar(id: string) {
    await repo.confirmarPendente(id);
    await recarregar();
  }
  async function descartar(id: string) {
    await repo.excluirLancamento(id);
    await recarregar();
  }

  return (
    <div className="tela">
      {backupVelho && (
        <button className="aviso" style={{ border: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => setAba('ajustes')}>
          Há mudanças sem backup há mais de 7 dias — toque para exportar.
        </button>
      )}
      <div className="card">
        <p className="rotulo" style={{ margin: 0 }}>
          Saldo hoje · {boxSel === 'casa' ? 'casa' : dados.boxes.find((b) => b.id === boxSel)?.nome}
        </p>
        {(() => {
          const saldoHoje = deHoje?.saldoEfetivo ?? 0;
          const [reais, centavos] = formatarBRL(saldoHoje).split(',');
          return (
            <p className={`saldo-grande${saldoHoje < 0 ? ' negativo' : ''}`} style={{ margin: '4px 0' }}>
              {reais}<b>,{centavos}</b>
            </p>
          );
        })()}
        {(() => {
          const fim = janela.at(-1);
          const delta = fim && deHoje ? fim.saldoProjetado - deHoje.saldoEfetivo : null;
          if (delta == null || delta === 0) return null;
          return (
            <span className={`delta ${delta > 0 ? 'pos' : 'neg'}`}>
              {delta > 0 ? '▲' : '▼'} {formatarBRL(Math.abs(delta))} nos próximos 28 dias
            </span>
          );
        })()}
        {deHoje && deHoje.saldoProjetado !== deHoje.saldoEfetivo && (
          <p className="sub" style={{ margin: 0 }}>projetado: {formatarBRL(deHoje.saldoProjetado)}</p>
        )}
        <ConferenciaSaldo key={boxSel} saldoApp={deHoje?.saldoEfetivo ?? 0} declaradoCent={declaradoCent}
          dataDeclarado={dataDeclarado} hoje={hoje} onSalvar={salvarSaldoReal} />
        <BalanceChart serie={janela} hoje={hoje} altura={120} mostrarCenarios={ligados.size > 0} />
      </div>
      <h2>Pendentes ({fila.length})</h2>
      <div className="lista">
        <AnimatePresence initial={false}>
          {fila.map((l) => (
            <motion.div
              className="item item-coluna" key={l.id} layout
              exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
              style={{ overflow: 'hidden' }}
              transition={{ duration: 0.18 }}
            >
              <div className="linha-topo">
                <div className="cresce">
                  <div>{nomeCat(l.categoriaId)}</div>
                  <div className="sub">{l.data.split('-').reverse().join('/')}{l.nota ? ` · ${l.nota}` : ''}</div>
                </div>
                <span className={tipoCat(l.categoriaId) === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
                  {formatarBRL(l.valor)}
                </span>
              </div>
              <div className="acoes">
                <button className="botao botao-primario" aria-label={`Confirmar ${nomeCat(l.categoriaId)}`} onClick={() => confirmar(l.id)}>✓ Confirmar</button>
                <button className="botao" aria-label="Descartar" onClick={() => descartar(l.id)}>Descartar</button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {fila.length === 0 && <p className="sub">Nada a confirmar — tudo em dia.</p>}
      </div>
    </div>
  );
}
