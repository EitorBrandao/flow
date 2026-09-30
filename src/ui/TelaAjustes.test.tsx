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
  useApp.setState({ aba: 'hoje', ajustesSecao: null });
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

it('estando numa subtela, "‹ Contas" volta ao submenu e "‹ Ajustes" volta ao menu', async () => {
  await setup();

  act(() => {
    useApp.getState().abrirAjustes('boxes');
  });

  render(<TelaAjustes />);
  expect(screen.getByText('Boxes', { selector: 'h2' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: '‹ Contas' }));
  expect(screen.getByText('Contas', { selector: 'h2' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bancos' })).toBeInTheDocument();
  expect(screen.queryByText('Boxes', { selector: 'h2' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: '‹ Ajustes' }));
  expect(screen.getByRole('button', { name: /^Planejamento/ })).toBeInTheDocument();
  expect(screen.queryByText('Contas', { selector: 'h2' })).not.toBeInTheDocument();
});

it('o menu mostra 5 grupos, cada um com a lista dos seus itens', async () => {
  await setup();
  render(<TelaAjustes />);

  const nomes = ['Contas', 'Planejamento', 'Cartão', 'Dados', 'Sobre o app'];
  for (const nome of nomes) {
    expect(screen.getByRole('button', { name: new RegExp('^' + nome) })).toBeInTheDocument();
  }
  expect(screen.getAllByRole('button')).toHaveLength(5);
  expect(screen.getByRole('button', { name: /^Cartão/ })).toHaveTextContent('Cartões · Categorias do cartão · Assinaturas do cartão');
});

it('tocar num grupo abre o submenu, e tocar num item abre a subtela', async () => {
  await setup();
  render(<TelaAjustes />);

  await userEvent.click(screen.getByRole('button', { name: /^Cartão/ }));
  expect(screen.getByText('Cartão', { selector: 'h2' })).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(4);

  await userEvent.click(screen.getByRole('button', { name: 'Assinaturas do cartão' }));
  expect(screen.getByText('Assinaturas do cartão', { selector: 'h2' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '‹ Cartão' })).toBeInTheDocument();
});

it('cada subtela de Ajustes está em exatamente um grupo', async () => {
  await setup();
  render(<TelaAjustes />);

  const itens: string[] = [];
  for (const nome of ['Contas', 'Planejamento', 'Cartão', 'Dados', 'Sobre o app']) {
    await userEvent.click(screen.getByRole('button', { name: new RegExp('^' + nome) }));
    const botoes = screen.getAllByRole('button').map((b) => b.textContent ?? '').filter((t) => t !== '‹ Ajustes');
    itens.push(...botoes);
    await userEvent.click(screen.getByRole('button', { name: '‹ Ajustes' }));
  }
  expect([...itens].sort()).toEqual([
    'Assinaturas do cartão', 'Backup e restauração', 'Bancos', 'Boxes', 'Cartões', 'Categorias',
    'Categorias do cartão', 'Importar e conferir', 'Recorrências', 'Versão', 'Viagens', 'Wiki',
  ].sort());
});

it('depois de usar abrirAjustes, uma remontagem (simulando a engrenagem) cai no menu', async () => {
  await setup();

  const { abrirAjustes } = useApp.getState();

  // Abre a seção Boxes
  act(() => {
    abrirAjustes('boxes');
  });

  const { rerender } = render(<TelaAjustes key="1" />);

  // A seção Boxes deve estar visível
  expect(screen.getByText('Boxes', { selector: 'h2' })).toBeInTheDocument();

  // Simula remontagem (como se a engrenagem tivesse sido clicada) — nova key, sem chamar
  // limparAjustesSecao manualmente. O componente deve automaticamente voltar ao menu.
  rerender(<TelaAjustes key="2" />);

  // O menu deve aparecer
  expect(screen.getByRole('button', { name: /^Planejamento/ })).toBeInTheDocument();
  expect(screen.queryByText('Boxes', { selector: 'h2' })).not.toBeInTheDocument();
});

it('estando numa subtela, abrirAjustes leva para outra subtela sem remontagem', async () => {
  await setup();

  const { abrirAjustes } = useApp.getState();

  // Abre a seção Boxes
  act(() => {
    abrirAjustes('boxes');
  });

  render(<TelaAjustes />);

  // A seção Boxes deve estar visível
  expect(screen.getByText('Boxes', { selector: 'h2' })).toBeInTheDocument();

  // Sem remontagem, chama abrirAjustes para outra seção
  act(() => {
    abrirAjustes('backup');
  });

  // Deve ir direto para Backup, sem passar pelo menu
  expect(screen.getByText('Backup e restauração', { selector: 'h2' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Categorias/i })).not.toBeInTheDocument();
});

it('o caminho antigo setAba("ajustes") continua caindo no menu', async () => {
  await setup();

  const { setAba } = useApp.getState();

  act(() => {
    setAba('ajustes');
  });

  render(<TelaAjustes />);

  // A tela de Ajustes deve estar no menu (ajustesSecao não foi setado)
  expect(screen.getByRole('button', { name: /^Planejamento/ })).toBeInTheDocument();

  // Verifica que não está em nenhuma subtela
  expect(screen.queryByText('Boxes', { selector: 'h2' })).not.toBeInTheDocument();
  expect(screen.queryByText('Categorias', { selector: 'h2' })).not.toBeInTheDocument();
});
