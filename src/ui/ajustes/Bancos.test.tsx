import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Bancos from './Bancos';

beforeEach(async () => {
  await limparDb();
  useApp.setState({ boxSel: 'casa' });
});

async function comBox() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-08-05' });
  return box;
}

// `recarregar()` também sobrescreve `hoje` com a data real do relógio — indesejável nestes
// testes, que fixam `hoje` em '2026-08-05'. Recarrega só `dados`, preservando o resto do
// estado do store (mesmo cuidado que levou a comentar aqui).
async function recarregarDados() {
  useApp.setState({ dados: await repo.carregarTudo() });
}

it('cria um banco pelo formulário do topo', async () => {
  await comBox();
  render(<Bancos />);
  await userEvent.type(screen.getByLabelText('Nome do banco'), 'Banco Um');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  expect(await screen.findByText('Banco Um')).toBeInTheDocument();
  expect((await db.bancos.toArray()).map((b) => b.nome)).toEqual(['Banco Um']);
});

it('criar sem nome avisa em vez de não fazer nada', async () => {
  await comBox();
  render(<Bancos />);
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  expect(await screen.findByText('Dê um nome ao banco para criar.')).toBeInTheDocument();
  expect(await db.bancos.count()).toBe(0);
});

it('estado vazio explica para que serve', async () => {
  await comBox();
  render(<Bancos />);
  expect(screen.getByText(/Nenhum banco cadastrado/)).toBeInTheDocument();
});

it('edita nome, saldo e data de um banco existente', async () => {
  const box = await comBox();
  const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Antigo', ordem: 0 });
  await recarregarDados();
  render(<Bancos />);

  expect(await screen.findByText(/saldo ainda não informado/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const nome = screen.getByLabelText('Nome') as HTMLInputElement;
  await userEvent.clear(nome);
  await userEvent.type(nome, 'Banco Novo');
  await userEvent.click(screen.getByLabelText('Saldo informado'));
  await userEvent.type(screen.getByLabelText('Saldo'), '150000');
  await userEvent.clear(screen.getByLabelText('Data do saldo'));
  await userEvent.type(screen.getByLabelText('Data do saldo'), '2026-08-01');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => expect(screen.getByText('Banco Novo')).toBeInTheDocument());
  const atualizado = await db.bancos.get(banco.id);
  expect(atualizado?.nome).toBe('Banco Novo');
  expect(atualizado?.saldoDeclaradoCent).toBe(150000);
  expect(atualizado?.dataSaldoDeclarado).toBe('2026-08-01');
  expect(screen.getByText(/R\$ 1\.500,00 informado em 01\/08/)).toBeInTheDocument();
});

it('cancelar a edição não persiste nenhuma mudança', async () => {
  const box = await comBox();
  const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Original', ordem: 0 });
  await recarregarDados();
  render(<Bancos />);

  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const nome = screen.getByLabelText('Nome') as HTMLInputElement;
  await userEvent.clear(nome);
  await userEvent.type(nome, 'Nome Descartado');
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

  expect(screen.getByText('Banco Original')).toBeInTheDocument();
  expect(screen.queryByText('Nome Descartado')).not.toBeInTheDocument();
  const inalterado = await db.bancos.get(banco.id);
  expect(inalterado?.nome).toBe('Banco Original');
});

it('exclui um banco após confirmar', async () => {
  const box = await comBox();
  await repo.salvarBanco({ boxId: box.id, nome: 'Banco a Excluir', ordem: 0 });
  await recarregarDados();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<Bancos />);

  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

  await waitFor(async () => expect(await db.bancos.count()).toBe(0));
  await waitFor(() => expect(screen.queryByText('Banco a Excluir')).not.toBeInTheDocument());
});

it('não exclui quando a confirmação é cancelada', async () => {
  const box = await comBox();
  await repo.salvarBanco({ boxId: box.id, nome: 'Banco Mantido', ordem: 0 });
  await recarregarDados();
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<Bancos />);

  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

  expect(await db.bancos.count()).toBe(1);
  expect(screen.getByText('Banco Mantido')).toBeInTheDocument();
});

it('mostra a contagem de cartões vinculados a cada banco', async () => {
  const box = await comBox();
  const bancoComUm = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um Cartao', ordem: 0 });
  const bancoComDois = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois Cartoes', ordem: 1 });
  await repo.salvarBanco({ boxId: box.id, nome: 'Banco Sem Cartao', ordem: 2 });
  const horizonte = useApp.getState().dados!.config.horizonteProjecao;

  const c1 = await repo.salvarCartao({ boxId: box.id, nome: 'Cartao A', diaFechamento: 5, diaVencimento: 15 }, horizonte);
  await repo.salvarCartao({ ...c1, bancoId: bancoComUm.id }, horizonte);
  const c2 = await repo.salvarCartao({ boxId: box.id, nome: 'Cartao B', diaFechamento: 5, diaVencimento: 15 }, horizonte);
  await repo.salvarCartao({ ...c2, bancoId: bancoComDois.id }, horizonte);
  const c3 = await repo.salvarCartao({ boxId: box.id, nome: 'Cartao C', diaFechamento: 5, diaVencimento: 15 }, horizonte);
  await repo.salvarCartao({ ...c3, bancoId: bancoComDois.id }, horizonte);

  await recarregarDados();
  render(<Bancos />);

  expect(await screen.findByText(/1 cartão/)).toBeInTheDocument();
  expect(await screen.findByText(/2 cartões/)).toBeInTheDocument();
  expect(await screen.findByText(/nenhum cartão/)).toBeInTheDocument();
});
