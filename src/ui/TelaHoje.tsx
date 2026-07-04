import { useMemo, useState } from 'react';
import * as repo from '../db/repo';
import { addDias } from '../domain/dates';
import { formatarBRL, parseValorDigitado } from '../domain/money';
import type { ISODate } from '../domain/types';
import { pendentes, projetarBoxes } from '../domain/projection';
import { boxIdsSelecionadas, cenariosLigados, useApp } from '../state/store';
import BalanceChart from './BalanceChart';

const SETE_DIAS_MS = 7 * 86_400_000;

function ConferenciaSaldo({ saldoApp, declaradoCent, dataDeclarado, hoje, onSalvar }: {
  saldoApp: number;
  declaradoCent: number | null;
  dataDeclarado: ISODate | null;
  hoje: ISODate;
  onSalvar: (cents: number, data: ISODate) => Promise<void>;
}) {
  const [saldo, setSaldo] = useState(declaradoCent != null ? (declaradoCent / 100).toFixed(2).replace('.', ',') : '');
  const [data, setData] = useState(dataDeclarado ?? hoje);

  async function salvar() {
    const negativo = saldo.trim().startsWith('-');
    const cents = parseValorDigitado(saldo.replace('-', ''), { permitirZero: true });
    if (cents == null) return;
    await onSalvar(negativo ? -cents : cents, data);
  }

  const diff = declaradoCent != null ? declaradoCent - saldoApp : null;

  return (
    <div style={{ marginTop: 8 }}>
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <input aria-label="Saldo real no banco" placeholder="saldo real no banco" inputMode="decimal" value={saldo}
          onChange={(e) => setSaldo(e.target.value)} style={{ width: 110 }} />
        <input aria-label="Data da conferência" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <button className="botao" onClick={salvar}>Salvar</button>
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
        <p className="sub" style={{ margin: 0 }}>Saldo hoje ({boxSel === 'casa' ? 'casa' : dados.boxes.find((b) => b.id === boxSel)?.nome})</p>
        <p className="saldo-grande" style={{ margin: '4px 0' }}>{formatarBRL(deHoje?.saldoEfetivo ?? 0)}</p>
        {deHoje && deHoje.saldoProjetado !== deHoje.saldoEfetivo && (
          <p className="sub" style={{ margin: 0 }}>projetado: {formatarBRL(deHoje.saldoProjetado)}</p>
        )}
        <ConferenciaSaldo key={boxSel} saldoApp={deHoje?.saldoEfetivo ?? 0} declaradoCent={declaradoCent}
          dataDeclarado={dataDeclarado} hoje={hoje} onSalvar={salvarSaldoReal} />
        <BalanceChart serie={janela} hoje={hoje} altura={120} mostrarCenarios={ligados.size > 0} />
      </div>
      <h2>Pendentes ({fila.length})</h2>
      <div className="lista">
        {fila.map((l) => (
          <div className="item" key={l.id}>
            <div className="cresce">
              <div>{nomeCat(l.categoriaId)}</div>
              <div className="sub">{l.data.split('-').reverse().join('/')}{l.nota ? ` · ${l.nota}` : ''}</div>
            </div>
            <span className={tipoCat(l.categoriaId) === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
              {formatarBRL(l.valor)}
            </span>
            <button className="botao" aria-label={`Confirmar ${nomeCat(l.categoriaId)}`} onClick={() => confirmar(l.id)}>✓ Confirmar</button>
            <button className="botao botao-perigo" aria-label="Descartar" onClick={() => descartar(l.id)}>✕</button>
          </div>
        ))}
        {fila.length === 0 && <p className="sub">Nada a confirmar — tudo em dia.</p>}
      </div>
    </div>
  );
}
