import 'fake-indexeddb/auto';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaAnalises from './TelaAnalises';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function seedBoxComCategoria() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const catPix = await repo.salvarCategoria({ boxId: box.id, nome: 'pix', tipo: 'gasto', ordem: 0 });
  return { box, catPix };
}

it('clicar numa linha da tabela abre o sheet com os lançamentos agrupados por nota', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  const hoje = '2026-07-15';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-05', valor: 30000, status: 'efetivo', nota: 'Maria Silva' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-10', valor: 15000, status: 'efetivo', nota: 'Padaria' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('button', { name: /pix/ }));

  expect(await screen.findByRole('dialog', { name: 'pix' })).toBeInTheDocument();
  expect(screen.getByText('Maria Silva')).toBeInTheDocument();
  expect(screen.getByText('Padaria')).toBeInTheDocument();
});

it('trocar o mês com o sheet aberto atualiza os grupos exibidos', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  const hoje = '2026-07-15';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-05', valor: 30000, status: 'efetivo', nota: 'Maria Silva' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-06-05', valor: 20000, status: 'efetivo', nota: 'João' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('button', { name: /pix/ }));
  expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
  expect(screen.queryByText('João')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));

  expect(await screen.findByText('João')).toBeInTheDocument();
  expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
});

it('clicar na categoria do cartão mostra o detalhamento por categoria de cartão, não por nota', async () => {
  const { box } = await seedBoxComCategoria();
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  const catMercado = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'Mercado', ordem: 0 });
  const catFarmacia = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'Farmácia', ordem: 1 });
  await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catMercado.id, data: '2026-07-10', valorTotal: 62000, parcelas: 1,
  }, '2027-12-31');
  await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catFarmacia.id, data: '2026-07-12', valorTotal: 5000, parcelas: 1,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-08-01' });

  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('button', { name: /Nubank/ }));

  const dialog = await screen.findByRole('dialog', { name: 'Nubank' });
  expect(within(dialog).getByText('R$ 670,00')).toBeInTheDocument(); // total da fatura
  expect(within(dialog).getByText('Mercado')).toBeInTheDocument();
  expect(within(dialog).getByText('R$ 620,00')).toBeInTheDocument(); // subtotal Mercado
  expect(within(dialog).getByText('Farmácia')).toBeInTheDocument();
  expect(within(dialog).getByText('R$ 50,00')).toBeInTheDocument(); // subtotal Farmácia

  const link = within(dialog).getByRole('button', { name: /Ver fatura completa/ });
  await userEvent.click(link);
  expect(useApp.getState().aba).toBe('cartao');
});

it('linha Assinaturas soma as compras de assinatura de todos os cartões e abre o resumo agrupado', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box } = await seedBoxComCategoria();
    const nubank = await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31');
    const inter = await repo.salvarCartao({ boxId: box.id, nome: 'Inter', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31');
    const catAssNubank = await repo.categoriaAssinaturasDe(nubank.id);
    const catAssInter = await repo.categoriaAssinaturasDe(inter.id);
    await repo.salvarAssinatura({
      cartaoId: nubank.id, categoriaCartaoId: catAssNubank, valor: 3990,
      dataInicio: '2026-07-05', diaDoMes: 5, parcelas: null, descricao: 'Netflix',
    }, '2027-12-31');
    await repo.salvarAssinatura({
      cartaoId: inter.id, categoriaCartaoId: catAssInter, valor: 1200,
      dataInicio: '2026-07-05', diaDoMes: 5, parcelas: null, descricao: 'iCloud',
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

    render(<TelaAnalises />);
    await userEvent.click(screen.getByRole('button', { name: /Assinaturas/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Assinaturas' });
    expect(within(dialog).getByText('R$ 51,90')).toBeInTheDocument();
    expect(within(dialog).getByText('Nubank')).toBeInTheDocument();
    expect(within(dialog).getByText('Netflix')).toBeInTheDocument();
    expect(within(dialog).getByText('Inter')).toBeInTheDocument();
    expect(within(dialog).getByText('iCloud')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

it('linha da viagem aparece na tabela Por categoria com o total do mês e abre o sheet ao clicar', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
  await repo.salvarLancamento({
    boxId: box.id, categoriaId: catPix.id, data: '2026-07-02', valor: 5000, status: 'efetivo', viagemId: viagem.id,
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);
  const linhaViagem = screen.getByRole('button', { name: /viagem - /i });
  expect(within(linhaViagem).getByText('R$ 50,00')).toBeInTheDocument();

  await userEvent.click(linhaViagem);
  expect(await screen.findByRole('dialog', { name: 'Praia' })).toBeInTheDocument();
});

it('linha da viagem não aparece em mês sem nenhum gasto marcado', async () => {
  const { box } = await seedBoxComCategoria();
  await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);
  expect(screen.queryByRole('button', { name: /viagem - /i })).not.toBeInTheDocument();
});

it('mostra barrinhas de ganho/gasto no card resumo, na mesma escala (maior = 100%)', async () => {
  const { box } = await seedBoxComCategoria();
  const catSalario = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  const catAluguel = await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: '2026-07-05', valor: 200000, status: 'efetivo' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catAluguel.id, data: '2026-07-10', valor: 100000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  const { container } = render(<TelaAnalises />);
  const barras = container.querySelectorAll('.resumo-barra-preenchimento');
  expect(barras).toHaveLength(2);
  expect((barras[0] as HTMLElement).style.width).toBe('100%'); // ganho é o maior -> base
  expect((barras[1] as HTMLElement).style.width).toBe('50%'); // gasto é metade do ganho
});

it('barra da composição usa a mesma escala do card resumo (maior entre ganhos e gastos)', async () => {
  const { box } = await seedBoxComCategoria();
  const catSalario = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  const catAluguel = await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: '2026-07-05', valor: 400000, status: 'efetivo' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catAluguel.id, data: '2026-07-10', valor: 100000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  const { container } = render(<TelaAnalises />);
  const barras = container.querySelectorAll('.composicao-preenchimento');
  expect((barras[0] as HTMLElement).style.width).toBe('100%'); // salario: 400000/400000 (base = maior dos dois)
  expect((barras[1] as HTMLElement).style.width).toBe('25%'); // aluguel: 100000/400000
});

it('card Viagens lista o total histórico da viagem, e continua mostrando a parcela em meses futuros', async () => {
  const { box } = await seedBoxComCategoria();
  const cartao = await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'hotel', ordem: 0 });
  const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-01-31', dataFim: '2026-02-05' });
  await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-01-31',
    valorTotal: 9000, parcelas: 3, viagemId: viagem.id,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-01-31' });

  render(<TelaAnalises />);
  const cardViagens = screen.getByText('Viagens').closest('.card') as HTMLElement;
  expect(within(cardViagens).getByText('Praia')).toBeInTheDocument();
  expect(within(cardViagens).getByText('R$ 90,00')).toBeInTheDocument(); // total histórico

  // navega para março (compra fechou em fev, parcela 1 vence 05/03): a linha "viagem" deve aparecer
  await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
  await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
  expect(screen.getByRole('button', { name: /viagem - /i })).toBeInTheDocument();
});

it('mostra o card Evolução mensal com a sobra do mês selecionado', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  const catSalario = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: '2026-07-05', valor: 500000, status: 'efetivo' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-10', valor: 100000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);
  expect(await screen.findByText('Evolução mensal')).toBeInTheDocument();
  expect(await screen.findByText('+4.000')).toBeInTheDocument(); // sobra de julho: 500000-100000 centavos = R$4.000,00
});
