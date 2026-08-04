import { useId, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as repo from '../db/repo';
import { addDias } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import type { ISODate, Lancamento } from '../domain/types';
import { pendentes, projetarBoxes } from '../domain/projection';
import { boxIdsSelecionadas, cenariosLigados, estadoPrimeiroUso, useApp } from '../state/store';
import BalanceChart from './BalanceChart';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import PrimeiroUso from './PrimeiroUso';
import { PagamentoFaturaSheetModal } from './PagamentoFaturaSheet';

const SETE_DIAS_MS = 7 * 86_400_000;

/** Um pendente que é fatura de cartão — tem cartão dono e mês de fatura, e por isso pode ser
 *  pago parcialmente/parcelado em vez de só confirmado. */
function ehFatura(l: Lancamento): boolean {
  return l.origem === 'cartao' && l.cartaoId != null && l.faturaMes != null;
}

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
            <button type="button" className="botao" aria-label="Alternar sinal (positivo/negativo)" onClick={() => setNegativo(n => !n)} style={{ padding: '8px 12px' }}>
              {negativo ? '−' : '+'}
            </button>
            <CampoValor id={`${uid}-saldo`} valorCentavos={magnitude} onChange={setMagnitude} style={{ width: 110 }} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-data`}>Data</label>
          <CampoData id={`${uid}-data`} value={data} onChange={setData} />
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
  const { dados, boxSel, hoje, recarregar, abrirAjustes } = useApp();
  const [pagando, setPagando] = useState<Lancamento | null>(null);
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
    if (!window.confirm('Descartar este previsto?')) return;
    await repo.excluirLancamento(id);
    await recarregar();
  }

  // Enquanto o pendente é `previsto`, o valor dele *é* o total da fatura — quem o escreve é a
  // sincronização do cartão, não a mão do usuário.
  const totalDaFaturaPendente = pagando?.valor ?? 0;

  const { precisa: primeiroUso } = estadoPrimeiroUso(dados);

  return (
    <div className="tela">
      {backupVelho && (
        <button className="aviso" style={{ border: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => abrirAjustes('backup')}>
          Há mudanças sem backup há mais de 7 dias — toque para exportar.
        </button>
      )}
      {primeiroUso ? (
        <PrimeiroUso />
      ) : (
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
            <p className="sub" style={{ margin: 0 }}>
              projetado: <strong className={deHoje.saldoProjetado >= 0 ? 'valor-ganho' : 'valor-gasto'}>
                {formatarBRL(deHoje.saldoProjetado)}
              </strong>
            </p>
          )}
          <ConferenciaSaldo key={boxSel} saldoApp={deHoje?.saldoEfetivo ?? 0} declaradoCent={declaradoCent}
            dataDeclarado={dataDeclarado} hoje={hoje} onSalvar={salvarSaldoReal} />
          <BalanceChart serie={janela} hoje={hoje} altura={120} mostrarCenarios={ligados.size > 0} />
        </div>
      )}
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
                {/* Fatura não se descarta — ela sempre aconteceu; o que varia é quanto foi
                    pago dela. Nos demais pendentes o par Confirmar/Descartar continua igual. */}
                {ehFatura(l) ? (
                  <button className="botao" aria-label={`Paguei outro valor de ${nomeCat(l.categoriaId)}`} onClick={() => setPagando(l)}>Paguei outro valor</button>
                ) : (
                  <button className="botao" aria-label="Descartar" onClick={() => descartar(l.id)}>Descartar</button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <PagamentoFaturaSheetModal
          lancamento={pagando} totalFaturaCent={totalDaFaturaPendente}
          onFechar={() => setPagando(null)}
        />
        {fila.length === 0 && <p className="sub">Nada a confirmar — tudo em dia.</p>}
      </div>
    </div>
  );
}
