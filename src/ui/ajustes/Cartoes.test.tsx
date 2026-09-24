import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Cartoes from './Cartoes';

beforeEach(async () => {
  await limparDb();
});

async function montarBox() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  return box;
}

it('cadastra um cartão sem pedir categoria e cria a categoria da fatura sozinho', async () => {
  const box = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  expect(screen.queryByLabelText('Categoria da fatura')).not.toBeInTheDocument();

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Nubank');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  // aguarda o recarregar() da criação assentar (evita corrida com o beforeEach do próximo teste)
  await waitFor(() => expect(screen.getByText(/Nubank/)).toBeInTheDocument());

  const cartoes = await db.cartoes.toArray();
  expect(cartoes).toHaveLength(1);
  expect(cartoes[0]).toMatchObject({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, ativo: true });
  const categoria = await db.categorias.get(cartoes[0].categoriaFaturaId);
  expect(categoria).toMatchObject({ boxId: box.id, nome: 'Nubank', tipo: 'gasto' });
});

it('depois de criar, os dias de fechamento e vencimento continuam preenchidos — nome volta vazio', async () => {
  await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Nubank');
  await userEvent.clear(screen.getByLabelText('Dia de fechamento'));
  await userEvent.type(screen.getByLabelText('Dia de fechamento'), '10');
  await userEvent.clear(screen.getByLabelText('Dia de vencimento'));
  await userEvent.type(screen.getByLabelText('Dia de vencimento'), '20');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  await waitFor(() => expect(screen.getByText(/Nubank/)).toBeInTheDocument());

  expect(screen.getByLabelText('Nome do cartão')).toHaveValue('');
  expect((screen.getByLabelText('Dia de fechamento') as HTMLInputElement).value).toBe('10');
  expect((screen.getByLabelText('Dia de vencimento') as HTMLInputElement).value).toBe('20');
});

it('permite dois cartões ativos na mesma box', async () => {
  const box = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Inter');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  await waitFor(() => expect(screen.getByText(/Inter/)).toBeInTheDocument());
  const cartoes = await db.cartoes.toArray();
  expect(cartoes).toHaveLength(2);
  expect(cartoes.every((c) => c.ativo)).toBe(true);
});

it('permite escolher o banco dono do cartão (entre dois, não só o primeiro)', async () => {
  const box = await montarBox();
  const bancoUm = await repo.salvarBanco({ boxId: box.id, nome: 'banco principal', ordem: 0 });
  const bancoDois = await repo.salvarBanco({ boxId: box.id, nome: 'banco da reserva', ordem: 1 });
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Nubank');
  // Escolhe o SEGUNDO banco de propósito: com um banco só, uma implementação que
  // ignorasse a escolha e sempre gravasse o primeiro passaria por engano.
  await userEvent.selectOptions(screen.getByLabelText('Banco'), bancoDois.id);
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  await waitFor(async () => {
    const cartoes = await db.cartoes.toArray();
    expect(cartoes).toHaveLength(1);
    expect(cartoes[0].bancoId).toBe(bancoDois.id);
    expect(cartoes[0].bancoId).not.toBe(bancoUm.id);
  });
});

it('box sem banco nenhum não mostra o campo Banco', async () => {
  await montarBox();
  await useApp.getState().iniciar();
  render(<Cartoes />);

  // seletor com uma opção só ("sem banco") não oferece escolha nenhuma e só ocupa espaço
  expect(screen.queryByLabelText('Banco')).not.toBeInTheDocument();
});

it('editar um cartão que já tem banco pré-seleciona o banco atual', async () => {
  const box = await montarBox();
  const bancoUm = await repo.salvarBanco({ boxId: box.id, nome: 'banco principal', ordem: 0 });
  const bancoDois = await repo.salvarBanco({ boxId: box.id, nome: 'banco da reserva', ordem: 1 });
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, bancoId: bancoDois.id,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));

  const select = screen.getByLabelText('Banco') as HTMLSelectElement;
  expect(select.value).toBe(bancoDois.id);
  expect(select.value).not.toBe(bancoUm.id);
});

it('trocar para "— sem banco —" remove o vínculo de um cartão que tinha banco', async () => {
  const box = await montarBox();
  const banco = await repo.salvarBanco({ boxId: box.id, nome: 'banco principal', ordem: 0 });
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, bancoId: banco.id,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  const item = screen.getByText('Nubank', { exact: false }).closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  await userEvent.selectOptions(within(item).getByLabelText('Banco'), '');
  await userEvent.click(within(item).getByRole('button', { name: 'Salvar' }));

  await waitFor(async () => {
    const cartoes = await db.cartoes.toArray();
    expect(cartoes[0].bancoId).toBeUndefined();
  });
});

it('trocar de box na tela de Cartões mostra só os cartões daquela box', async () => {
  const agora = agoraISO();
  const eitor = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  const ju = { id: novoId(), nome: 'ju', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(eitor);
  await repo.salvarBox(ju);
  await repo.salvarCartao({ boxId: eitor.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await repo.salvarCartao({ boxId: ju.id, nome: 'Santander', diaFechamento: 29, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });

  useApp.setState({ boxSel: eitor.id });
  const { rerender } = render(<Cartoes />);

  expect(screen.getByText('Nubank', { exact: false })).toBeInTheDocument();
  expect(screen.queryByText('Santander', { exact: false })).not.toBeInTheDocument();

  act(() => { useApp.setState({ boxSel: ju.id }); });
  rerender(<Cartoes />);

  expect(screen.getByText('Santander', { exact: false })).toBeInTheDocument();
  expect(screen.queryByText('Nubank', { exact: false })).not.toBeInTheDocument();
});

it('bloquear compras não desativa o cartão, só o esconde do fluxo de nova compra', async () => {
  const box = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.click(screen.getByRole('button', { name: 'Bloquear' }));

  await waitFor(async () => {
    const [cartao] = await db.cartoes.toArray();
    expect(cartao.permiteCompra).toBe(false);
    expect(cartao.ativo).toBe(true);
  });
  expect(await screen.findByRole('button', { name: 'Permitir' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Permitir' }));

  await waitFor(async () => {
    const [cartao] = await db.cartoes.toArray();
    expect(cartao.permiteCompra).toBe(true);
  });
});

it('o formulário de criação não tem botão Cancelar', async () => {
  await montarBox();
  await useApp.getState().iniciar();
  render(<Cartoes />);

  expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
});

it('toca no lápis para editar: abre os campos dentro do item e some "Novo cartão"', async () => {
  const box = await montarBox();
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  expect(screen.getByText('Novo cartão')).toBeInTheDocument();
  const item = screen.getByText('Nubank', { exact: false }).closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));

  expect(screen.queryByText('Novo cartão')).not.toBeInTheDocument();
  expect(within(item).getByLabelText('Nome do cartão')).toHaveValue('Nubank');
});

it('no item aberto, os botões aparecem na ordem Cancelar, Salvar', async () => {
  const box = await montarBox();
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  const item = screen.getByText('Nubank', { exact: false }).closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));

  const botoes = within(item).getAllByRole('button');
  const nomes = botoes.map((b) => b.textContent);
  expect(nomes.indexOf('Cancelar')).toBeLessThan(nomes.indexOf('Salvar'));
  expect(within(item).getByRole('button', { name: 'Salvar' })).toHaveClass('botao-primario');
});

it('cancelar fecha o item sem gravar e traz "Novo cartão" de volta', async () => {
  const box = await montarBox();
  const cartao = await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  const item = screen.getByText('Nubank', { exact: false }).closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  const nome = within(item).getByLabelText('Nome do cartão') as HTMLInputElement;
  await userEvent.clear(nome);
  await userEvent.type(nome, 'Outro nome');
  await userEvent.click(within(item).getByRole('button', { name: 'Cancelar' }));

  expect(screen.getByText('Novo cartão')).toBeInTheDocument();
  expect(within(item).getByText('Nubank', { exact: false })).toBeInTheDocument();
  const atual = await db.cartoes.get(cartao.id);
  expect(atual?.nome).toBe('Nubank');
});

it('criar sem nome avisa embaixo dos botões em vez de não fazer nada', async () => {
  await montarBox();
  await useApp.getState().iniciar();
  render(<Cartoes />);
  const criar = screen.getByRole('button', { name: 'Criar' });
  await userEvent.click(criar);
  const aviso = screen.getByText('Dê um nome ao cartão para criar.');
  expect(aviso).toHaveClass('aviso');
  expect(aviso.previousElementSibling).toContainElement(criar);
  expect(await db.cartoes.count()).toBe(0);
});

it('salvar com o nome apagado avisa e não grava', async () => {
  const box = await montarBox();
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  render(<Cartoes />);
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  expect(screen.getByLabelText('Nome do cartão')).toHaveFocus();
  await userEvent.clear(screen.getByLabelText('Nome do cartão'));
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  expect(screen.getByText('Dê um nome ao cartão para salvar.')).toBeInTheDocument();
  expect((await db.cartoes.toArray())[0].nome).toBe('Nubank');
});
