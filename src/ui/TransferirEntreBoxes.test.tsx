import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId, type Box } from '../domain/types';
import { useApp } from '../state/store';
import TelaHoje from './TelaHoje';

beforeEach(async () => {
  await limparDb();
});

function box(nome: string, saldoInicial: number | null = 100000): Box {
  const agora = agoraISO();
  return { id: novoId(), nome, saldoInicial, dataSaldoInicial: saldoInicial == null ? null : '2026-01-01', criadoEm: agora, alteradoEm: agora };
}

async function abrirConferir() {
  render(<TelaHoje />);
  await userEvent.click(await screen.findByRole('tab', { name: 'Conferir' }));
}

async function prepararDuasBoxes(boxSel: string | 'primeira' = 'primeira') {
  const ana = box('ana');
  const caio = box('caio', 50000);
  await repo.salvarBox(ana);
  await repo.salvarBox(caio);
  await useApp.getState().recarregar();
  useApp.setState({ boxSel: boxSel === 'primeira' ? ana.id : boxSel, hoje: '2026-07-05' });
  return { ana, caio };
}

describe('Transferir entre boxes', () => {
  it('só aparece com duas ou mais boxes com saldo próprio', async () => {
    const ana = box('ana');
    await repo.salvarBox(ana);
    await repo.salvarBox(box('casa', null));
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: ana.id, hoje: '2026-07-05' });
    await abrirConferir();
    expect(screen.queryByRole('button', { name: 'Transferir entre boxes' })).not.toBeInTheDocument();
  });

  it('transfere sem bancos, mostra o aviso de saldo da casa e grava as duas pernas', async () => {
    const { ana, caio } = await prepararDuasBoxes();
    await abrirConferir();
    await userEvent.click(screen.getByRole('button', { name: 'Transferir entre boxes' }));
    expect(screen.getByRole('button', { name: 'Confirmar transferência' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Valor'), '30000');
    expect(screen.getByText(/Isto não muda o saldo somado da casa/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar transferência' }));

    expect(await screen.findByText('Transferência feita ✓')).toBeInTheDocument();
    const pernas = (await db.lancamentos.toArray()).filter((l) => l.origem === 'transferencia');
    expect(pernas.map((l) => l.boxId).sort()).toEqual([ana.id, caio.id].sort());
    expect(pernas.every((l) => l.valor === 30000)).toBe(true);
  });

  it('mesma box em De e Para desabilita a confirmação com aviso', async () => {
    await prepararDuasBoxes();
    await abrirConferir();
    await userEvent.click(screen.getByRole('button', { name: 'Transferir entre boxes' }));
    await userEvent.selectOptions(screen.getByLabelText('Para'), (screen.getByLabelText('De') as HTMLSelectElement).value);
    expect(screen.getByRole('button', { name: 'Confirmar transferência' })).toBeDisabled();
    expect(screen.getByText('Escolha duas boxes diferentes.')).toBeInTheDocument();
  });

  it('com bancos: mostra o seletor de banco de cada ponta e o saldo antes e depois', async () => {
    const { ana, caio } = await prepararDuasBoxes();
    const azul = await repo.salvarBanco({ boxId: ana.id, nome: 'Azul', ordem: 0 });
    await repo.salvarBanco({ boxId: caio.id, nome: 'Verde', ordem: 0 });
    await repo.atualizarBanco(azul.id, { saldoDeclaradoCent: 120000, dataSaldoDeclarado: '2026-07-01' });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: ana.id, hoje: '2026-07-05' });
    await abrirConferir();
    await userEvent.click(screen.getByRole('button', { name: 'Transferir entre boxes' }));
    expect(screen.getByLabelText('Banco (de)')).toHaveValue(azul.id);
    expect(screen.getByLabelText('Banco (para)')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Valor'), '30000');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar transferência' }));

    expect(await screen.findByText('ana · Azul')).toBeInTheDocument();
    expect(screen.getByText('caio · Verde')).toBeInTheDocument();
    const pernas = (await db.lancamentos.toArray()).filter((l) => l.origem === 'transferencia');
    expect(pernas.map((l) => l.nota)).toEqual(['ana · Azul → caio · Verde', 'ana · Azul → caio · Verde']);
  });

  it('na visão casa também aparece e abre com a primeira box como origem', async () => {
    const { ana, caio } = await prepararDuasBoxes('casa');
    await abrirConferir();
    await userEvent.click(await screen.findByRole('button', { name: 'Transferir entre boxes' }));
    // a box `casa` (sem saldo próprio) fica fora das opções; origem e destino começam diferentes
    const de = screen.getByLabelText('De') as HTMLSelectElement;
    const para = screen.getByLabelText('Para') as HTMLSelectElement;
    expect([ana.id, caio.id]).toContain(de.value);
    expect(para.value).not.toBe(de.value);
    expect(Array.from(de.options).map((o) => o.text).sort()).toEqual(['ana', 'caio']);
  });
});
