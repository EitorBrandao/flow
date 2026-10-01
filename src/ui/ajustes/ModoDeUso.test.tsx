import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import ModoDeUso from './ModoDeUso';

const ROTULOS = ['Hoje', 'Fluxo', 'Cartão', 'Análises', 'Lançar (+)'];

async function semearBox() {
  const agora = agoraISO();
  await repo.salvarBox({
    id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora,
  });
}

function bloco(rotulo: string): HTMLElement {
  return screen.getByText(rotulo, { selector: 'strong' }).closest('.item') as HTMLElement;
}

describe('ModoDeUso', () => {
  beforeEach(async () => { await limparDb(); });

  it('mostra as cinco telas, cada uma Avançado quando a config não tem modos', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    render(<ModoDeUso />);
    for (const r of ROTULOS) {
      expect(within(bloco(r)).getByText('Avançado', { selector: '.badge' })).toBeInTheDocument();
    }
    expect(screen.getByText(/nada se perde ao trocar/)).toBeInTheDocument();
  });

  it('clicar em Simples no Hoje grava só o modo do Hoje e mostra o selo', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    render(<ModoDeUso />);
    await userEvent.click(within(bloco('Hoje')).getByRole('button', { name: 'Simples' }));
    expect(await within(bloco('Hoje')).findByText('Simples', { selector: '.badge' })).toBeInTheDocument();
    const cfg = await db.config.get('config');
    expect(cfg?.modos).toEqual({
      hoje: 'simples', fluxo: 'avancado', cartao: 'avancado', analises: 'avancado', lancar: 'avancado',
    });
    expect(within(bloco('Hoje')).getByText('Saldo, projeção e conferência com um número só.')).toBeInTheDocument();
  });

  it('voltar para Avançado troca selo e resumo', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    render(<ModoDeUso />);
    await userEvent.click(within(bloco('Lançar (+)')).getByRole('button', { name: 'Simples' }));
    await within(bloco('Lançar (+)')).findByText('Simples', { selector: '.badge' });
    await userEvent.click(within(bloco('Lançar (+)')).getByRole('button', { name: 'Avançado' }));
    expect(await within(bloco('Lançar (+)')).findByText('Avançado', { selector: '.badge' })).toBeInTheDocument();
    expect(within(bloco('Lançar (+)')).getByText('Todos os campos. Igual em qualquer tela.')).toBeInTheDocument();
  });

  it('em instalação nova as cinco telas começam Simples', async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await useApp.getState().iniciar();
    render(<ModoDeUso />);
    for (const r of ROTULOS) {
      expect(within(bloco(r)).getByText('Simples', { selector: '.badge' })).toBeInTheDocument();
    }
  });
});
