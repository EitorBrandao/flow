import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
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
  const nubank = await prepararCartao('Nubank');
  const inter = await prepararCartao('Inter');
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
  await userEvent.click(screen.getByRole('button', { name: 'Nubank' }));

  expect(await screen.findByText('Netflix')).toBeInTheDocument();
  expect(screen.queryByText('iCloud')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Inter' }));

  expect(await screen.findByText('iCloud')).toBeInTheDocument();
  expect(screen.queryByText('Netflix')).not.toBeInTheDocument();
});
