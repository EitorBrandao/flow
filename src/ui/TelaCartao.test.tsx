import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaCartao from './TelaCartao';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function montarCartao() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const catFlow = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: catFlow.id,
  }, '2027-12-31');
  const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  return { box, cartao, catCartao };
}

it('box sem cartão oferece cadastro', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
  render(<TelaCartao />);
  expect(screen.getByText(/Nenhum cartão cadastrado/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cadastrar cartão' })).toBeInTheDocument();
});

it('adiciona compra parcelada e navega entre faturas', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box } = await montarCartao();
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    render(<TelaCartao />);

    await userEvent.click(screen.getByRole('button', { name: '+ compra' }));
    await userEvent.type(screen.getByLabelText('Valor'), '100,00');
    await userEvent.selectOptions(screen.getByLabelText('Categoria'), screen.getByRole('option', { name: 'mercado' }));
    await userEvent.clear(screen.getByLabelText('Parcelas'));
    await userEvent.type(screen.getByLabelText('Parcelas'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    // fatura padrão = 08/2026 (compra 2026-07-01, fecha 28/07, vence 05/08): parcela 1
    expect(await screen.findByText(/1\/3/)).toBeInTheDocument();
    expect(screen.getAllByText(/33,34/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Mês seguinte' }));
    expect(await screen.findByText(/2\/3/)).toBeInTheDocument();
    expect(screen.getAllByText(/33,33/).length).toBeGreaterThan(0);
  } finally { vi.useRealTimers(); }
});

it('conferência mostra a diferença e a caixa troca o valor do previsto', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao();
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-01',
      valorTotal: 8000, parcelas: 1,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    render(<TelaCartao />);

    await userEvent.type(screen.getByLabelText('Valor no app do banco'), '100,00');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência' }));
    expect(await screen.findByText(/Falta bater/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*20,00/)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/usar este valor no Flow/));
    await waitFor(async () => {
      const previsto = (await db.lancamentos.toArray()).find((l) => l.origem === 'cartao');
      expect(previsto?.valor).toBe(10000);
    });
  } finally { vi.useRealTimers(); }
});
