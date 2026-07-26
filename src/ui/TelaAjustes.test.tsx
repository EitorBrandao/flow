import 'fake-indexeddb/auto';
import { act } from 'react';
import { limparDb } from '../test-setup';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaAjustes from './TelaAjustes';

beforeEach(async () => {
  await limparDb();
});

async function setup() {
  const agora = agoraISO();
  const box = {
    id: novoId(),
    nome: 'eitor',
    saldoInicial: 0,
    dataSaldoInicial: '2026-01-01',
    criadoEm: agora,
    alteradoEm: agora,
  };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
}

it('abrirAjustes("boxes") faz a tela de Boxes aparecer sem passar pelo menu', async () => {
  await setup();

  const { abrirAjustes } = useApp.getState();

  // Chama abrirAjustes dentro de act
  act(() => {
    abrirAjustes('boxes');
  });

  // Renderiza após o estado estar definido
  render(<TelaAjustes />);

  // A tela de Boxes deve aparecer, não o menu
  expect(screen.queryByRole('button', { name: /Categorias/i })).not.toBeInTheDocument();
  expect(screen.getByText('Boxes', { selector: 'h2' })).toBeInTheDocument();
});

it('estando numa subtela, o botão "‹ Ajustes" volta ao menu', async () => {
  await setup();

  const { abrirAjustes } = useApp.getState();

  act(() => {
    abrirAjustes('boxes');
  });

  render(<TelaAjustes />);

  // A tela de Boxes está visível
  expect(screen.getByText('Boxes', { selector: 'h2' })).toBeInTheDocument();

  // Clica no botão "‹ Ajustes" para voltar
  const botaoVoltar = screen.getByRole('button', { name: '‹ Ajustes' });
  await userEvent.click(botaoVoltar);

  // O menu deve aparecer
  expect(screen.getAllByRole('button', { name: /Categorias/i }).length).toBeGreaterThan(0);
  expect(screen.queryByText('Boxes', { selector: 'h2' })).not.toBeInTheDocument();
});

it('depois de usar abrirAjustes, uma remontagem (simulando a engrenagem) cai no menu', async () => {
  await setup();

  const { abrirAjustes, limparAjustesSecao } = useApp.getState();

  // Abre a seção Boxes
  act(() => {
    abrirAjustes('boxes');
  });

  const { rerender } = render(<TelaAjustes key="1" />);

  // A seção Boxes deve estar visível
  expect(screen.getByText('Boxes', { selector: 'h2' })).toBeInTheDocument();

  // Simula remontagem (como se a engrenagem tivesse sido clicada)
  act(() => {
    limparAjustesSecao();
  });

  // Remonta o componente com uma nova key (como a engrenagem faz)
  rerender(<TelaAjustes key="2" />);

  // O menu deve aparecer
  expect(screen.getAllByRole('button', { name: /Categorias/i }).length).toBeGreaterThan(0);
  expect(screen.queryByText('Boxes', { selector: 'h2' })).not.toBeInTheDocument();
});

it('o caminho antigo setAba("ajustes") continua caindo no menu', async () => {
  await setup();

  const { setAba } = useApp.getState();

  act(() => {
    setAba('ajustes');
  });

  render(<TelaAjustes />);

  // A tela de Ajustes deve estar no menu (ajustesSecao não foi setado)
  expect(screen.getAllByRole('button', { name: /Categorias/i }).length).toBeGreaterThan(0);

  // Verifica que não está em nenhuma subtela
  expect(screen.queryByText('Boxes', { selector: 'h2' })).not.toBeInTheDocument();
  expect(screen.queryByText('Categorias', { selector: 'h2' })).not.toBeInTheDocument();
});
