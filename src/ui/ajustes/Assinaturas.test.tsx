import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { formatarBRL } from '../../domain/money';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Assinaturas from './Assinaturas';

beforeEach(async () => {
  await limparDb();
});

async function prepararCartao(nome = 'Nubank') {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  return repo.salvarCartao({ boxId: box.id, nome, diaFechamento: 10, diaVencimento: 20 }, '2027-12-31');
}

async function prepararDoisCartoesNaMesmaBox() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const nubank = await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31');
  const inter = await repo.salvarCartao({ boxId: box.id, nome: 'Inter', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31');
  return { nubank, inter };
}

async function prepararBoxComCartao(nomeBox: string, nomeCartao: string) {
  const agora = agoraISO();
  const box = { id: novoId(), nome: nomeBox, saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({ boxId: box.id, nome: nomeCartao, diaFechamento: 10, diaVencimento: 20 }, '2027-12-31');
  return { box, cartao };
}

it('cria uma assinatura sem pedir categoria, usando a categoria Assinaturas automática', async () => {
  const cartao = await prepararCartao();
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Assinaturas />);

  expect(screen.queryByLabelText('Categoria')).not.toBeInTheDocument();

  await userEvent.type(screen.getByLabelText('Valor'), '39,90');
  await userEvent.type(screen.getByLabelText('Descrição (opcional)'), 'Netflix');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  await waitFor(() => expect(screen.getByText('Netflix')).toBeInTheDocument());
  const assinaturas = await db.recorrenciasCartao.toArray();
  expect(assinaturas).toHaveLength(1);
  expect(assinaturas[0]).toMatchObject({ cartaoId: cartao.id, valor: 3990, descricao: 'Netflix' });
  const categoria = await db.categoriasCartao.get(assinaturas[0].categoriaCartaoId);
  expect(categoria).toMatchObject({ cartaoId: cartao.id, nome: 'Assinaturas' });
});

it('trocar de cartão mostra só as assinaturas daquele cartão', async () => {
  const { nubank, inter } = await prepararDoisCartoesNaMesmaBox();
  await repo.salvarAssinatura({
    cartaoId: nubank.id, categoriaCartaoId: await repo.categoriaAssinaturasDe(nubank.id),
    valor: 3990, dataInicio: '2026-07-01', diaDoMes: 8, parcelas: null, descricao: 'Netflix',
  }, '2027-12-31');
  await repo.salvarAssinatura({
    cartaoId: inter.id, categoriaCartaoId: await repo.categoriaAssinaturasDe(inter.id),
    valor: 1200, dataInicio: '2026-07-01', diaDoMes: 3, parcelas: null, descricao: 'iCloud',
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });

  render(<Assinaturas />);
  await userEvent.click(screen.getByRole('radio', { name: 'Nubank' }));

  expect(await screen.findByText('Netflix')).toBeInTheDocument();
  expect(screen.queryByText('iCloud')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('radio', { name: 'Inter' }));

  expect(await screen.findByText('iCloud')).toBeInTheDocument();
  expect(screen.queryByText('Netflix')).not.toBeInTheDocument();
});

it('trocar a box no chip do topo troca os cartões oferecidos no seletor de Assinaturas', async () => {
  const { box: eitor } = await prepararBoxComCartao('eitor', 'Nubank');
  const { box: ju } = await prepararBoxComCartao('ju', 'Santander');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01', boxSel: eitor.id });

  const { rerender } = render(<Assinaturas />);

  expect(screen.getByRole('radio', { name: 'Nubank' })).toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Santander' })).not.toBeInTheDocument();

  useApp.setState({ boxSel: ju.id });
  rerender(<Assinaturas />);

  expect(screen.getByRole('radio', { name: 'Santander' })).toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Nubank' })).not.toBeInTheDocument();
});

it('o formulário de criação não tem botão Cancelar', async () => {
  await prepararCartao();
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Assinaturas />);

  expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
});

it('toca no lápis para editar: abre os campos dentro do item e some "Nova assinatura"', async () => {
  const cartao = await prepararCartao();
  await repo.salvarAssinatura({
    cartaoId: cartao.id, categoriaCartaoId: await repo.categoriaAssinaturasDe(cartao.id),
    valor: 3990, dataInicio: '2026-07-01', diaDoMes: 8, parcelas: null, descricao: 'Netflix',
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Assinaturas />);

  expect(screen.getByText('Nova assinatura')).toBeInTheDocument();
  const item = screen.getByText('Netflix').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));

  expect(screen.queryByText('Nova assinatura')).not.toBeInTheDocument();
  expect(within(item).getByLabelText('Valor')).toHaveValue(formatarBRL(3990));
});

it('no item aberto, os botões aparecem na ordem Cancelar, Salvar', async () => {
  const cartao = await prepararCartao();
  await repo.salvarAssinatura({
    cartaoId: cartao.id, categoriaCartaoId: await repo.categoriaAssinaturasDe(cartao.id),
    valor: 3990, dataInicio: '2026-07-01', diaDoMes: 8, parcelas: null, descricao: 'Netflix',
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Assinaturas />);

  const item = screen.getByText('Netflix').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));

  const botoes = within(item).getAllByRole('button');
  const nomes = botoes.map((b) => b.textContent);
  expect(nomes.indexOf('Cancelar')).toBeLessThan(nomes.indexOf('Salvar'));
  expect(within(item).getByRole('button', { name: 'Salvar' })).toHaveClass('botao-primario');
});

it('cancelar fecha o item sem gravar e traz "Nova assinatura" de volta', async () => {
  const cartao = await prepararCartao();
  const assinatura = await repo.salvarAssinatura({
    cartaoId: cartao.id, categoriaCartaoId: await repo.categoriaAssinaturasDe(cartao.id),
    valor: 3990, dataInicio: '2026-07-01', diaDoMes: 8, parcelas: null, descricao: 'Netflix',
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Assinaturas />);

  const item = screen.getByText('Netflix').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  const valorInput = within(item).getByLabelText('Valor');
  await userEvent.clear(valorInput);
  await userEvent.type(valorInput, '99,00');
  await userEvent.click(within(item).getByRole('button', { name: 'Cancelar' }));

  expect(screen.getByText('Nova assinatura')).toBeInTheDocument();
  expect(within(item).getByText(formatarBRL(3990).replace(/\s/g, ' '))).toBeInTheDocument();
  const atual = await db.recorrenciasCartao.get(assinatura.id);
  expect(atual?.valor).toBe(3990);
});

it('edita uma assinatura existente pelo item', async () => {
  const cartao = await prepararCartao();
  const assinatura = await repo.salvarAssinatura({
    cartaoId: cartao.id, categoriaCartaoId: await repo.categoriaAssinaturasDe(cartao.id),
    valor: 3990, dataInicio: '2026-07-01', diaDoMes: 8, parcelas: null, descricao: 'Netflix',
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Assinaturas />);

  const item = screen.getByText('Netflix').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  const valorInput = within(item).getByLabelText('Valor');
  await userEvent.clear(valorInput);
  await userEvent.type(valorInput, '49,90');
  await userEvent.click(within(item).getByRole('button', { name: 'Salvar' }));

  await waitFor(() => expect(screen.getByText(formatarBRL(4990).replace(/\s/g, ' '))).toBeInTheDocument());
  const atualizada = await db.recorrenciasCartao.get(assinatura.id);
  expect(atualizada?.valor).toBe(4990);
});
