import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import FormCompra from './FormCompra';

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

it('cria uma compra parcelada', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao } = await montarCartao();
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    const onFechar = vi.fn();
    render(<FormCompra cartao={cartao} onFechar={onFechar} />);
    expect(screen.getByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Valor'), '100,00');
    await userEvent.selectOptions(screen.getByLabelText('Categoria'), screen.getByRole('option', { name: 'mercado' }));
    await userEvent.clear(screen.getByLabelText('Parcelas'));
    await userEvent.type(screen.getByLabelText('Parcelas'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(onFechar).toHaveBeenCalledOnce();
    });
    const compras = await db.comprasCartao.toArray();
    expect(compras).toHaveLength(1);
    expect(compras[0]).toMatchObject({ valorTotal: 10000, parcelas: 3 });
  } finally { vi.useRealTimers(); }
});

it('campo Parcelas já pagas fica desabilitado com 1 parcela', async () => {
  const { box, cartao } = await montarCartao();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

  render(<FormCompra cartao={cartao} onFechar={() => {}} />);
  expect(screen.getByLabelText('Parcelas já pagas')).toBeDisabled();
});

it('editar uma compra existente mostra "Editar compra" e o botão Excluir', async () => {
  const { box, cartao, catCartao } = await montarCartao();
  const compra = await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-01',
    valorTotal: 8000, parcelas: 1,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Editar compra' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
});

it('digitar Parcelas já pagas recalcula Data para trás em meses', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao } = await montarCartao();
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    render(<FormCompra cartao={cartao} onFechar={() => {}} />);
    const inputData = screen.getByLabelText('Data') as HTMLInputElement;
    const inputParcelas = screen.getByLabelText('Parcelas');
    const inputParcelasPagas = screen.getByLabelText('Parcelas já pagas');

    // Inicialmente, data é 'hoje' (2026-07-01)
    expect(inputData.value).toBe('2026-07-01');

    // Definir 3 parcelas
    await userEvent.clear(inputParcelas);
    await userEvent.type(inputParcelas, '3');

    // Digitar 2 em "Parcelas já pagas"
    await userEvent.type(inputParcelasPagas, '2');

    // Data deve recalcular para 2 meses antes (2026-05-01)
    expect(inputData.value).toBe('2026-05-01');
  } finally {
    vi.useRealTimers();
  }
});

it('limpar Parcelas já pagas NÃO reverte Data ao valor original', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao } = await montarCartao();
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    render(<FormCompra cartao={cartao} onFechar={() => {}} />);
    const inputData = screen.getByLabelText('Data') as HTMLInputElement;
    const inputParcelas = screen.getByLabelText('Parcelas');
    const inputParcelasPagas = screen.getByLabelText('Parcelas já pagas');

    // Inicialmente, data é 'hoje' (2026-07-01)
    expect(inputData.value).toBe('2026-07-01');

    // Definir 3 parcelas
    await userEvent.clear(inputParcelas);
    await userEvent.type(inputParcelas, '3');

    // Digitar 2 em "Parcelas já pagas"
    await userEvent.type(inputParcelasPagas, '2');
    expect(inputData.value).toBe('2026-05-01');

    // Limpar "Parcelas já pagas"
    await userEvent.clear(inputParcelasPagas);

    // Data permanece em 2026-05-01 (não reverte para 2026-07-01)
    expect(inputData.value).toBe('2026-05-01');
  } finally {
    vi.useRealTimers();
  }
});
