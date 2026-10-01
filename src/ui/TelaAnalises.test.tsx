import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as repo from '../db/repo';
import { nomeDoMes } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaAnalises from './TelaAnalises';

beforeEach(async () => {
  await limparDb();
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
  // `sincronizarCartoes` usa a data REAL do sistema, não o `hoje` do store, e
  // `diffSincronizacao` só cria o previsto da fatura quando o vencimento é estritamente
  // posterior a hoje. Sem congelar o relógio, este teste passava enquanto o mundo estivesse
  // antes de 05/08/2026 (vencimento da fatura montada aqui) e quebrava para sempre depois —
  // foi o que aconteceu. Data fixa em julho mantém a fatura no futuro para sempre.
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
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

    const dialog = await screen.findByRole('dialog', { name: `Nubank · fatura de ${nomeDoMes('2026-08')}` });
    expect(within(dialog).getByText('R$ 670,00')).toBeInTheDocument(); // total da fatura
    expect(within(dialog).getByText('Mercado')).toBeInTheDocument();
    expect(within(dialog).getByText('R$ 620,00')).toBeInTheDocument(); // subtotal Mercado
    expect(within(dialog).getByText('Farmácia')).toBeInTheDocument();
    expect(within(dialog).getByText('R$ 50,00')).toBeInTheDocument(); // subtotal Farmácia

    const link = within(dialog).getByRole('button', { name: /Ver fatura completa/ });
    await userEvent.click(link);
    expect(useApp.getState().aba).toBe('cartao');
  } finally { vi.useRealTimers(); }
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
    const cardComposicao = screen.getByText('Por categoria').closest('.card') as HTMLElement;
    await userEvent.click(within(cardComposicao).getByRole('button', { name: /Assinaturas/ }));

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
  await userEvent.click(screen.getByRole('button', { name: 'Mês seguinte' }));
  await userEvent.click(screen.getByRole('button', { name: 'Mês seguinte' }));
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
  expect(await screen.findByText('4.000')).toHaveClass('evolucao-sobra', 'pos'); // sobra de julho: 500000-100000 centavos
});

it('título Comparativo fica fora do container que rola horizontalmente', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-05', valor: 30000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);
  const titulo = screen.getByText('Comparativo');
  expect(titulo.closest('.rolavel')).toBeNull();
  expect(screen.getByRole('table').closest('.rolavel')).not.toBeNull();
});

it('viagem sem gasto não ganha pílula vermelha, e a linha responde ao teclado', async () => {
  const { box } = await seedBoxComCategoria();
  await repo.salvarViagem({ nome: 'Serra', dataInicio: '2026-11-02', dataFim: '2026-11-05' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);
  const cardViagens = screen.getByText('Viagens').closest('.card') as HTMLElement;
  const linha = within(cardViagens).getByRole('button', { name: /Serra/ });
  expect(within(linha).getByText('R$ 0,00')).toHaveClass('valor-neutro');
  expect(within(linha).getByText('R$ 0,00')).not.toHaveClass('valor-gasto');
});

it('estorno maior que os ganhos do mês: total de Ganhos aparece vermelho, sem sinal', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  const catSalario = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: '2026-07-05', valor: 1000, status: 'efetivo' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: '2026-07-06', valor: -3000, status: 'efetivo' }); // estorno de ganho
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-10', valor: 500, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);
  const cardResumo = screen.getByText('Ganhos').closest('.card') as HTMLElement;
  const ganhos = within(cardResumo).getByText('R$ 20,00'); // |1000-3000| = 2000 centavos, líquido negativo
  expect(ganhos).toHaveClass('valor-gasto');
  expect(ganhos).not.toHaveClass('valor-ganho');
});

it('card Viagens: estorno maior que o gasto do mês deixa o total verde, sem sinal', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  const viagem = await repo.salvarViagem({ nome: 'Serra', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
  await repo.salvarLancamento({
    boxId: box.id, categoriaId: catPix.id, data: '2026-07-02', valor: -3000, status: 'efetivo', viagemId: viagem.id,
  }); // estorno maior que qualquer gasto do mês nessa viagem
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);
  const cardViagens = screen.getByText('Viagens').closest('.card') as HTMLElement;
  const linha = within(cardViagens).getByRole('button', { name: /Serra/ });
  const valor = within(linha).getByText('R$ 30,00');
  expect(valor).toHaveClass('valor-ganho');
  expect(valor).not.toHaveClass('valor-gasto');
});

it('sobra zero (ganho igual ao gasto) fica sem cor, com a tipografia dos outros valores', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  const catSalario = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: '2026-07-05', valor: 100000, status: 'efetivo' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-10', valor: 100000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);
  const cardResumo = screen.getByText('Sobra').closest('.card') as HTMLElement;
  const sobra = within(cardResumo).getByText('R$ 0,00');
  expect(sobra).toHaveClass('valor-neutro');
  expect(sobra).not.toHaveClass('valor-ganho');
  expect(sobra).not.toHaveClass('valor-gasto');
});

it('cabeçalho do comparativo mostra o mês abreviado', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-10-05', valor: 30000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-10-15' });

  render(<TelaAnalises />);
  expect(within(screen.getByRole('table')).getByRole('columnheader', { name: 'out/2026' })).toBeInTheDocument();
});

it('card Categorias do cartão: mostra a categoria no mês da fatura e abre o histórico de 6 meses', async () => {
  // mesmo motivo do teste da fatura acima: `sincronizarCartoes` usa a data real do sistema
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box } = await seedBoxComCategoria();
    const cartao = await repo.salvarCartao({
      boxId: box.id, nome: 'Cartão Azul', diaFechamento: 28, diaVencimento: 5,
    }, '2027-12-31');
    const catMercado = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'Mercado', ordem: 0 });
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catMercado.id, data: '2026-06-10', valorTotal: 30000, parcelas: 1,
    }, '2027-12-31'); // fatura de jul/2026
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catMercado.id, data: '2026-07-10', valorTotal: 62000, parcelas: 1,
    }, '2027-12-31'); // fatura de ago/2026
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-08-01' });

    render(<TelaAnalises />);
    const card = screen.getByText('Categorias do cartão').closest('.card') as HTMLElement;
    expect(card.querySelector('.rotulo-grupo')).toBeNull(); // um cartão só: sem subtítulo
    const linha = within(card).getByRole('button', { name: 'Mercado' }).closest('tr') as HTMLElement;
    expect(within(linha).getAllByRole('cell')[1]).toHaveTextContent('620,00');
    expect(within(linha).getAllByRole('cell')[2]).toHaveTextContent('300,00');

    await userEvent.click(within(card).getByRole('button', { name: 'Mercado' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mercado · Cartão Azul' });
    // mar..ago = [0, 0, 0, 0, 30000, 62000]; média = 92000 / 6 = 15333,33 → 15333
    expect(within(dialog).getByText('média 6m').querySelector('strong')).toHaveTextContent('153,33');
  } finally { vi.useRealTimers(); }
});

async function seedDoisMeses() {
  const { box, catPix } = await seedBoxComCategoria();
  // out/2025 e set/2026: os dois cabem em "12 meses" terminando em set/2026
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2025-10-05', valor: 10000, status: 'efetivo', nota: 'Padaria' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-09-05', valor: 25000, status: 'efetivo', nota: 'Feira' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-09-15' });
  return { box, catPix };
}

it('12 meses: soma o período e mostra a média por mês', async () => {
  await seedDoisMeses();
  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('radio', { name: '12 meses' }));
  expect(screen.getByText('out/2025 – set/2026')).toBeInTheDocument();
  // pix: 10000 + 25000 = 35000
  const linha = screen.getByRole('button', { name: /pix/ });
  expect(within(linha).getByText('R$ 350,00')).toBeInTheDocument();
  expect(screen.getByText(/^média por mês:/)).toBeInTheDocument();
});

it('Comparativo com 12 meses: sem a coluna ano anterior, com a nota do intervalo', async () => {
  await seedDoisMeses();
  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('radio', { name: '12 meses' }));
  const card = screen.getByRole('heading', { name: 'Comparativo' }).closest('.card') as HTMLElement;
  const cabecalhos = within(card).getAllByRole('columnheader').map((th) => th.textContent);
  expect(cabecalhos).toEqual(['Categoria', '12 meses', 'anterior', 'média/mês']);
  expect(within(card).getByText('anterior = out/2024 – set/2025 (é também o ano anterior)')).toBeInTheDocument();
  const linha = within(card).getByText('pix').closest('tr') as HTMLElement;
  // média = round(35000 / 12) = 2917
  expect(within(linha).getAllByRole('cell').map((td) => td.textContent))
    .toEqual(['pix', formatarBRL(35000), formatarBRL(0), formatarBRL(2917)]);
});

it('Período: 7 meses por padrão, com a coluna ano anterior', async () => {
  await seedDoisMeses();
  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('radio', { name: 'Período' }));
  expect(screen.getByText('mar/2026 – set/2026')).toBeInTheDocument();
  const card = screen.getByRole('heading', { name: 'Comparativo' }).closest('.card') as HTMLElement;
  expect(within(card).getAllByRole('columnheader').map((th) => th.textContent))
    .toEqual(['Categoria', '7 meses', 'anterior', 'ano anterior', 'média/mês']);
});

it('Ano: abre no último ano fechado', async () => {
  await seedDoisMeses();
  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('radio', { name: 'Ano' }));
  expect(document.querySelector('.barra-fixa')).toHaveTextContent('2025');
  // só out/2025 cai em 2025
  expect(within(screen.getByRole('button', { name: /pix/ })).getByText('R$ 100,00')).toBeInTheDocument();
});

it('categoria com vários meses: folha do período → folha do mês → volta ao período', async () => {
  await seedDoisMeses();
  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('radio', { name: '12 meses' }));
  await userEvent.click(screen.getByRole('button', { name: /pix/ }));
  const periodo = await screen.findByRole('dialog', { name: 'pix' });
  expect(within(periodo).getByText('out/2025 – set/2026 · toque num mês para ver os lançamentos')).toBeInTheDocument();

  await userEvent.click(within(periodo).getByRole('button', { name: /out\/2025/ }));
  expect(await screen.findByText('Padaria')).toBeInTheDocument();
  expect(screen.queryByText('Feira')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /voltar ao período/ }));
  expect(await screen.findByText('out/2025 – set/2026 · toque num mês para ver os lançamentos')).toBeInTheDocument();
});

it('modo Mês: o seletor de mês fica na barra fixa', async () => {
  await seedDoisMeses();
  render(<TelaAnalises />);
  const barra = document.querySelector('.barra-fixa') as HTMLElement;
  expect(within(barra).getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
  expect(within(barra).getByText('setembro de 2026')).toBeInTheDocument();
});

it('categoria de fatura com pagamento lançado à mão no mês abre os lançamentos, não a fatura', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box } = await seedBoxComCategoria();
    const cartao = await repo.salvarCartao({
      boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
    }, '2027-12-31');
    // pagamento antigo, anterior ao cadastro das compras: o valor da barra não é a fatura calculada
    await repo.salvarLancamento({
      boxId: box.id, categoriaId: cartao.categoriaFaturaId, data: '2026-05-29', valor: 83995,
      status: 'efetivo', nota: 'Pagamento antigo',
    });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-05-15' });

    render(<TelaAnalises />);
    await userEvent.click(screen.getByRole('button', { name: /Nubank/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Nubank' });
    expect(within(dialog).getByText('Pagamento antigo')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /fatura de/ })).not.toBeInTheDocument();

    // o link leva à fatura do mês, que ainda existe (vazia aqui, sem compras)
    await userEvent.click(within(dialog).getByRole('button', { name: /Ver a fatura de maio de 2026/ }));
    expect(await screen.findByRole('dialog', { name: `Nubank · fatura de ${nomeDoMes('2026-05')}` })).toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('com dois bancos, o filtro por banco restringe as categorias do resumo', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const mercado = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const lazer = await repo.salvarCategoria({ boxId: box.id, nome: 'lazer', tipo: 'gasto', ordem: 1 });
  const um = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
  const dois = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
  await repo.salvarLancamento({
    boxId: box.id, categoriaId: mercado.id, data: '2026-07-10', valor: 4290, status: 'efetivo', bancoId: um.id,
  });
  await repo.salvarLancamento({
    boxId: box.id, categoriaId: lazer.id, data: '2026-07-11', valor: 1800, status: 'efetivo', bancoId: dois.id,
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);
  expect((await screen.findAllByText('mercado')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('lazer').length).toBeGreaterThan(0);

  await userEvent.click(screen.getByRole('radio', { name: 'Banco Dois' }));

  await waitFor(() => {
    expect(screen.queryByText('mercado')).not.toBeInTheDocument();
  });
  expect(screen.getAllByText('lazer').length).toBeGreaterThan(0);
});

it('filtro por banco reseta ao trocar de box nas Análises', async () => {
  const agora = agoraISO();
  const boxA = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(boxA);
  const catA = await repo.salvarCategoria({ boxId: boxA.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const umA = await repo.salvarBanco({ boxId: boxA.id, nome: 'Banco Um', ordem: 0 });
  await repo.salvarBanco({ boxId: boxA.id, nome: 'Banco Dois', ordem: 1 });
  await repo.salvarLancamento({ boxId: boxA.id, categoriaId: catA.id, data: '2026-07-10', valor: 4290, status: 'efetivo', bancoId: umA.id });

  const boxB = { id: novoId(), nome: 'outra', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(boxB);
  const catB = await repo.salvarCategoria({ boxId: boxB.id, nome: 'lazer', tipo: 'gasto', ordem: 0 });
  await repo.salvarBanco({ boxId: boxB.id, nome: 'Banco Um', ordem: 0 });
  const doisB = await repo.salvarBanco({ boxId: boxB.id, nome: 'Banco Dois', ordem: 1 });
  await repo.salvarLancamento({ boxId: boxB.id, categoriaId: catB.id, data: '2026-07-11', valor: 1800, status: 'efetivo', bancoId: doisB.id });

  await useApp.getState().iniciar();
  useApp.setState({ boxSel: boxA.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);

  // Na box A, selecionar "Banco Dois"
  await userEvent.click(await screen.findByRole('radio', { name: 'Banco Dois' }));
  expect(screen.getByRole('radio', { name: 'Banco Dois' })).toHaveAttribute('aria-checked', 'true');

  // Trocar para box B
  act(() => useApp.setState({ boxSel: boxB.id }));

  // Na box B, o filtro deve ter resetado para "Todos"
  expect(screen.getByRole('radio', { name: 'Todos' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.queryByRole('radio', { name: 'Banco Dois' })).not.toHaveAttribute('aria-checked', 'true');
});

describe('modo Simples', () => {
  // jul/2026, hoje = 15/07. Ganhos 5000,00; gastos 300,00 efetivo + 100,00 previsto = 400,00;
  // sobra = 5000,00 - 400,00 = 4600,00.
  async function seedJulho(modo: 'simples' | 'avancado') {
    const { box, catPix } = await seedBoxComCategoria();
    const catSalario = await repo.salvarCategoria({ boxId: box.id, nome: 'salário', tipo: 'ganho', ordem: 1 });
    await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: '2026-07-05', valor: 500000, status: 'efetivo', nota: 'Pagamento' });
    await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-05', valor: 30000, status: 'efetivo', nota: 'Padaria' });
    await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-20', valor: 10000, status: 'previsto', nota: 'Feira' });
    await repo.salvarModo('analises', modo);
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });
    return { box, catPix };
  }
  const resumoDoCard = () => (screen.getByText(/^Ganhos/).closest('.card') as HTMLElement).textContent;

  it('esconde períodos, previstos, banco, Viagens, Comparativo e categorias do cartão', async () => {
    await seedJulho('simples');
    render(<TelaAnalises />);
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
    for (const nome of ['12 meses', 'Ano', 'Período']) {
      expect(screen.queryByRole('radio', { name: nome })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText('incluir previstos')).not.toBeInTheDocument();
    expect(screen.queryByText(/incluir previstos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/banco/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Viagens' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Comparativo' })).not.toBeInTheDocument();
    expect(screen.queryByText(/cartão/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Ganhos/)).toBeInTheDocument();
    expect(screen.getByText(/^Gastos/)).toBeInTheDocument();
    expect(screen.getByText(/^Sobra/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Por categoria' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evolução mensal' })).toBeInTheDocument();
  });

  it('mostra no resumo os mesmos números do Avançado para o mesmo mês', async () => {
    await seedJulho('simples');
    const { unmount } = render(<TelaAnalises />);
    const simples = resumoDoCard();
    expect(simples).toContain(formatarBRL(500000));
    expect(simples).toContain(formatarBRL(40000));
    expect(simples).toContain(formatarBRL(460000));
    unmount();
    await act(async () => { await repo.salvarModo('analises', 'avancado'); await useApp.getState().recarregar(); useApp.setState({ hoje: '2026-07-15' }); });
    render(<TelaAnalises />);
    expect(resumoDoCard()).toBe(simples);
  });

  it('o drill-down de categoria continua abrindo a folha do mês', async () => {
    await seedJulho('simples');
    render(<TelaAnalises />);
    await userEvent.click(screen.getByRole('button', { name: /pix/ }));
    const folha = await screen.findByRole('dialog', { name: 'pix' });
    expect(within(folha).getByText('Padaria')).toBeInTheDocument();
  });

  it('trocar de Avançado para Simples volta ao período Mês', async () => {
    await seedJulho('avancado');
    render(<TelaAnalises />);
    await userEvent.click(screen.getByRole('radio', { name: 'Ano' }));
    expect(screen.queryByRole('button', { name: 'Mês anterior' })).not.toBeInTheDocument();
    await act(async () => { await repo.salvarModo('analises', 'simples'); await useApp.getState().recarregar(); useApp.setState({ hoje: '2026-07-15' }); });
    expect(await screen.findByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Ano' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^média por mês:/)).not.toBeInTheDocument();
  });

  it('trocar para Simples restaura "incluir previstos" e o filtro por banco', async () => {
    await seedJulho('avancado');
    render(<TelaAnalises />);
    await userEvent.click(screen.getByLabelText('incluir previstos'));
    expect(resumoDoCard()).toContain(formatarBRL(30000));
    await act(async () => { await repo.salvarModo('analises', 'simples'); await useApp.getState().recarregar(); useApp.setState({ hoje: '2026-07-15' }); });
    await waitFor(() => expect(resumoDoCard()).toContain(formatarBRL(40000)));
  });

  it('Avançado mantém todos os blocos', async () => {
    await seedJulho('avancado');
    render(<TelaAnalises />);
    expect(screen.getByRole('radio', { name: 'Ano' })).toBeInTheDocument();
    expect(screen.getByLabelText('incluir previstos')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Viagens' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Comparativo' })).toBeInTheDocument();
  });
});

describe('Análises na casa: categorias de mesmo nome', () => {
  async function seedDuasBoxes() {
    const agora = agoraISO();
    const mk = (nome: string) => ({ id: novoId(), nome, saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora });
    const ana = mk('ana');
    const bruno = mk('bruno');
    await repo.salvarBox(ana);
    await repo.salvarBox(bruno);
    const catAna = await repo.salvarCategoria({ boxId: ana.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
    const catBruno = await repo.salvarCategoria({ boxId: bruno.id, nome: 'Mercado', tipo: 'gasto', ordem: 0 });
    await repo.salvarLancamento({ boxId: ana.id, categoriaId: catAna.id, data: '2026-07-05', valor: 50000, status: 'efetivo', nota: 'feira' });
    await repo.salvarLancamento({ boxId: bruno.id, categoriaId: catBruno.id, data: '2026-07-06', valor: 40000, status: 'efetivo', nota: 'atacado' });
    await useApp.getState().iniciar();
    return { ana, bruno };
  }

  it('na casa, mostra uma só linha "mercado" com a soma e a folha traz os selos das boxes', async () => {
    await seedDuasBoxes();
    useApp.setState({ boxSel: 'casa', hoje: '2026-07-15' });
    render(<TelaAnalises />);
    const linhas = screen.getAllByRole('button', { name: /mercado/i });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].textContent).toContain(formatarBRL(90000));
    await userEvent.click(linhas[0]);
    const folha = await screen.findByRole('dialog', { name: /mercado/i });
    expect(within(folha).getByText('feira')).toBeInTheDocument();
    expect(within(folha).getByText('atacado')).toBeInTheDocument();
    expect(within(folha).getByText('ana')).toBeInTheDocument();
    expect(within(folha).getByText('bruno')).toBeInTheDocument();
  });

  it('numa box só, a linha mostra só o total da box e a folha não tem selo', async () => {
    const { ana } = await seedDuasBoxes();
    useApp.setState({ boxSel: ana.id, hoje: '2026-07-15' });
    render(<TelaAnalises />);
    const linha = screen.getByRole('button', { name: /mercado/i });
    expect(linha.textContent).toContain(formatarBRL(50000));
    expect(linha.textContent).not.toContain(formatarBRL(90000));
    await userEvent.click(linha);
    const folha = await screen.findByRole('dialog', { name: /mercado/i });
    expect(within(folha).queryByText('ana')).not.toBeInTheDocument();
  });
});
