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
  const item = screen.getByText('eitor').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  const checkbox = within(item).getByLabelText('Esta box tem saldo próprio');
  await userEvent.click(checkbox);
  const saldoInput = within(item).getByLabelText('Saldo inicial');
  await userEvent.click(saldoInput);
  const dataInput = within(item).getByLabelText('Data do saldo');
  await userEvent.clear(dataInput);
  await userEvent.type(dataInput, '2026-01-01');
  await userEvent.click(within(item).getByRole('button', { name: 'Salvar' }));
  // O item fecha e "Nova box" volta depois do recarregar — esperar evita o aviso de act().
  await screen.findByRole('heading', { name: 'Nova box' });

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
  const item = screen.getByText('eitor').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  const checkbox = within(item).getByLabelText('Esta box tem saldo próprio');
  expect(checkbox).toBeChecked();
  await userEvent.click(checkbox);
  await userEvent.click(within(item).getByRole('button', { name: 'Salvar' }));

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
  await userEvent.type(screen.getByLabelText('Nome'), 'pessoal');
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
  const item = screen.getByText('eitor').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  await userEvent.click(within(item).getByLabelText('Esta box tem saldo próprio'));
  expect(within(item).getByLabelText('Data do saldo')).toHaveValue('2026-07-02');
});

it('o formulário de criação não tem botão Cancelar', async () => {
  await useApp.getState().iniciar();
  render(<Boxes />);

  expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
});

it('o campo Nome e o botão Criar ficam na mesma linha de formulário', async () => {
  await useApp.getState().iniciar();
  render(<Boxes />);

  const campoNome = screen.getByLabelText('Nome');
  const formLinha = campoNome.closest('.form-linha') as HTMLElement;
  expect(formLinha).not.toBeNull();
  expect(within(formLinha).getByRole('button', { name: 'Criar' })).toBeInTheDocument();
});

it('toca no lápis para editar: abre os campos dentro do item e some "Nova box"', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: null, dataSaldoInicial: null, criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  render(<Boxes />);

  expect(screen.getByText('Nova box')).toBeInTheDocument();
  const item = screen.getByText('eitor').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));

  expect(screen.queryByText('Nova box')).not.toBeInTheDocument();
  expect(within(item).getByLabelText('Nome')).toHaveValue('eitor');
});

it('no item aberto, os botões aparecem na ordem Cancelar, Salvar', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: null, dataSaldoInicial: null, criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  render(<Boxes />);

  const item = screen.getByText('eitor').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));

  const botoes = within(item).getAllByRole('button');
  const nomes = botoes.map((b) => b.textContent);
  expect(nomes.indexOf('Cancelar')).toBeLessThan(nomes.indexOf('Salvar'));
  expect(within(item).getByRole('button', { name: 'Salvar' })).toHaveClass('botao-primario');
});

it('cancelar fecha o item sem gravar e traz "Nova box" de volta', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: null, dataSaldoInicial: null, criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  render(<Boxes />);

  const item = screen.getByText('eitor').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  const nome = within(item).getByLabelText('Nome') as HTMLInputElement;
  await userEvent.clear(nome);
  await userEvent.type(nome, 'Outro nome');
  await userEvent.click(within(item).getByRole('button', { name: 'Cancelar' }));

  expect(screen.getByText('Nova box')).toBeInTheDocument();
  expect(within(item).getByText('eitor')).toBeInTheDocument();
  const atual = await db.boxes.get(box.id);
  expect(atual?.nome).toBe('eitor');
});

it('salvar com o nome apagado avisa em vez de voltar calado ao nome antigo', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  render(<Boxes />);
  const item = screen.getByText('eitor').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  const nome = within(item).getByLabelText('Nome');
  expect(nome).toHaveFocus();
  await userEvent.clear(nome);
  const salvar = within(item).getByRole('button', { name: 'Salvar' });
  await userEvent.click(salvar);
  expect(screen.getByText('Dê um nome à box para salvar.').previousElementSibling).toContainElement(salvar);
});

it('saldo e data ficam em linhas de formulário separadas', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  render(<Boxes />);
  const item = screen.getByText('eitor').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  const linhaSaldo = within(item).getByLabelText('Saldo inicial').closest('.form-linha');
  const linhaData = within(item).getByLabelText('Data do saldo').closest('.form-linha');
  expect(linhaSaldo).not.toBe(linhaData);
});
