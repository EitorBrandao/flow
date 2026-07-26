import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Boxes from './Boxes';

beforeEach(async () => {
  await limparDb();
  // O store sobrevive entre testes do mesmo arquivo: sem resetar a seleção, um teste que
  // troca de box faz o seguinte começar sujo — acoplamento à ordem, não a comportamento.
  useApp.setState({ boxSel: 'casa' });
});

it('salva saldo inicial "0,00" como zero, não como sem-saldo-próprio', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: null, dataSaldoInicial: null, criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();

  render(<Boxes />);
  const cardEitor = within(screen.getByText('eitor').closest('.card') as HTMLElement);
  const checkbox = cardEitor.getByLabelText('Esta box tem saldo próprio');
  await userEvent.click(checkbox);
  const saldoInput = cardEitor.getByLabelText('Saldo inicial');
  await userEvent.click(saldoInput);
  const dataInput = cardEitor.getByLabelText('Data do saldo');
  await userEvent.clear(dataInput);
  await userEvent.type(dataInput, '2026-01-01');
  await userEvent.click(cardEitor.getByRole('button', { name: 'Salvar' }));

  const atualizado = await db.boxes.get(box.id);
  expect(atualizado?.saldoInicial).toBe(0);
  expect(atualizado?.dataSaldoInicial).toBe('2026-01-01');
});

it('desmarcar "tem saldo próprio" salva null', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 12345, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();

  render(<Boxes />);
  const cardEitor = within(screen.getByText('eitor').closest('.card') as HTMLElement);
  const checkbox = cardEitor.getByLabelText('Esta box tem saldo próprio');
  expect(checkbox).toBeChecked();
  await userEvent.click(checkbox);
  await userEvent.click(cardEitor.getByRole('button', { name: 'Salvar' }));

  const atualizado = await db.boxes.get(box.id);
  expect(atualizado?.saldoInicial).toBe(null);
  expect(atualizado?.dataSaldoInicial).toBe(null);
});

it('criar sem nome avisa em vez de não fazer nada', async () => {
  await useApp.getState().iniciar();
  const antes = (await db.boxes.toArray()).length;

  render(<Boxes />);
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  expect(await screen.findByText('Dê um nome à box para criar.')).toBeInTheDocument();
  expect((await db.boxes.toArray()).length).toBe(antes);
});

it('a box criada já fica selecionada no topo', async () => {
  await useApp.getState().iniciar();
  expect(useApp.getState().boxSel).toBe('casa');

  render(<Boxes />);
  await userEvent.type(screen.getByLabelText('Nova box'), 'pessoal');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  // Esperar a box aparecer na lista: `criar` é uma cadeia assíncrona (salvar → recarregar →
  // selecionar), e ler o store logo depois do clique pega o estado antes do fim dela.
  await screen.findByText('pessoal');
  const criada = (await db.boxes.toArray()).find((b) => b.nome === 'pessoal')!;
  expect(criada).toBeDefined();
  expect(useApp.getState().boxSel).toBe(criada.id);
});

it('a data do saldo já vem preenchida com hoje numa box sem data', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: null, dataSaldoInicial: null, criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-02' });

  render(<Boxes />);
  const cardEitor = within(screen.getByText('eitor').closest('.card') as HTMLElement);
  await userEvent.click(cardEitor.getByLabelText('Esta box tem saldo próprio'));
  expect(cardEitor.getByLabelText('Data do saldo')).toHaveValue('2026-07-02');
});
