import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { act, render, screen } from '@testing-library/react';
import * as repo from '../db/repo';
import { agoraISO } from '../domain/types';
import { useApp } from '../state/store';
import { useModo } from './useModo';

function Sonda() {
  return <span data-testid="modo">{useModo('hoje')}</span>;
}

async function box(id: string, nome: string, saldoInicial: number | null) {
  const agora = agoraISO();
  await repo.salvarBox({ id, nome, saldoInicial, dataSaldoInicial: saldoInicial === null ? null : '2026-01-01', criadoEm: agora, alteradoEm: agora });
}

describe('useModo', () => {
  beforeEach(async () => { await limparDb(); });

  it('troca o modo ao trocar a box do topo, e a casa tem o modo da box casa', async () => {
    await box('b1', 'Pessoal', 0);
    await box('b2', 'Empresa', 0);
    await box('c1', 'casa', null);
    await repo.salvarModoBox('b1', 'hoje', 'simples');
    await repo.salvarModoBox('b2', 'hoje', 'avancado');
    await repo.salvarModoBox('c1', 'hoje', 'simples');
    await useApp.getState().iniciar();
    render(<Sonda />);
    await act(async () => { useApp.getState().setBoxSel('b1'); });
    expect(screen.getByTestId('modo')).toHaveTextContent('simples');
    await act(async () => { useApp.getState().setBoxSel('b2'); });
    expect(screen.getByTestId('modo')).toHaveTextContent('avancado');
    await act(async () => { useApp.getState().setBoxSel('casa'); });
    expect(screen.getByTestId('modo')).toHaveTextContent('simples');
  });

  it('box sem modos herda o global', async () => {
    await box('b1', 'Pessoal', 0);
    await repo.salvarModo('hoje', 'simples');
    await useApp.getState().iniciar();
    render(<Sonda />);
    await act(async () => { useApp.getState().setBoxSel('b1'); });
    expect(screen.getByTestId('modo')).toHaveTextContent('simples');
  });

  it('visão casa sem a box real casa usa o global', async () => {
    await box('b1', 'Pessoal', 0);
    await useApp.getState().iniciar();
    const casa = useApp.getState().dados!.boxes.find((b) => b.nome === 'casa')!;
    await repo.salvarBox({ ...casa, nome: 'renomeada' });
    await repo.salvarModo('hoje', 'simples');
    await useApp.getState().recarregar();
    render(<Sonda />);
    await act(async () => { useApp.getState().setBoxSel('casa'); });
    expect(screen.getByTestId('modo')).toHaveTextContent('simples');
  });
});
