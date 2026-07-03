import { useMemo } from 'react';
import * as repo from '../db/repo';
import { addDias } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import { pendentes, projetarBoxes } from '../domain/projection';
import { boxIdsSelecionadas, cenariosLigados, useApp } from '../state/store';
import BalanceChart from './BalanceChart';

const SETE_DIAS_MS = 7 * 86_400_000;

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
