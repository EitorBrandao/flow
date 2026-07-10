import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { addDias } from '../domain/dates';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaFluxo from './TelaFluxo';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function seedBoxComCategoria() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2025-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const catMercado = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const catSalario = await repo.salvarCategoria({ boxId: box.id, nome: 'salário', tipo: 'ganho', ordem: 1 });
  return { box, catMercado, catSalario };
}

it('busca não encontra lançamento fora do intervalo já exibido', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  const dataFora = addDias(hoje, -60); // fora da janela padrão de 14 dias
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: dataFora, valor: -5000, status: 'efetivo', nota: 'padaria da esquina' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  await userEvent.type(screen.getByPlaceholderText(/Buscar/), 'padaria');

  expect(await screen.findByText('Nenhum resultado para a busca.')).toBeInTheDocument();
  expect(screen.queryByText('padaria da esquina')).not.toBeInTheDocument();
});

it('ampliar o intervalo com +30 dias atrás passa a incluir o lançamento na busca ativa', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  const dataFora = addDias(hoje, -20); // fora dos 14 dias padrão, dentro de 14+30
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: dataFora, valor: -5000, status: 'efetivo', nota: 'padaria da esquina' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  await userEvent.type(screen.getByPlaceholderText(/Buscar/), 'padaria');
  expect(screen.queryByText('padaria da esquina')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: '+30 dias atrás' }));

  expect(await screen.findByText('padaria da esquina')).toBeInTheDocument();
});

it('busca por nome de categoria encontra lançamento sem nota dentro do intervalo', async () => {
  const { box, catSalario } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: hoje, valor: 300000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  await userEvent.type(screen.getByPlaceholderText(/Buscar/), 'SALÁRIO');

  expect(await screen.findByText('salário')).toBeInTheDocument();
});

it('busca por valor encontra lançamento pelo substring do valor formatado dentro do intervalo', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: hoje, valor: -15000, status: 'efetivo', nota: 'compra grande' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  await userEvent.type(screen.getByPlaceholderText(/Buscar/), '150');

  expect(await screen.findByText('compra grande')).toBeInTheDocument();
});

it('limpar a busca restaura todos os lançamentos do intervalo', async () => {
  const { box, catMercado, catSalario } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: hoje, valor: -5000, status: 'efetivo', nota: 'padaria da esquina' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: hoje, valor: 300000, status: 'efetivo', nota: 'pagamento mensal' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  const campo = screen.getByPlaceholderText(/Buscar/);
  await userEvent.type(campo, 'padaria');
  await screen.findByText('padaria da esquina');
  expect(screen.queryByText('pagamento mensal')).not.toBeInTheDocument();

  await userEvent.clear(campo);

  expect(await screen.findByText('pagamento mensal')).toBeInTheDocument();
  expect(screen.getByText('padaria da esquina')).toBeInTheDocument();
});

it('busca por número do dia encontra lançamento pela data, não pela nota ou valor', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: hoje, valor: -1000, status: 'efetivo', nota: 'chuchu' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: '2026-06-25', valor: -3000, status: 'efetivo', nota: 'batata' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  await userEvent.type(screen.getByPlaceholderText(/Buscar/), '25');

  expect(await screen.findByText('batata')).toBeInTheDocument();
  expect(screen.queryByText('chuchu')).not.toBeInTheDocument();
});

it('escolher uma data no calendário pula direto pra aquele dia, mesmo fora do intervalo, e esconde o controle de +30 dias', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  const dataFora = addDias(hoje, -60); // bem fora da janela padrão de 14 dias
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: dataFora, valor: -5000, status: 'efetivo', nota: 'compra antiga' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: dataFora } });

  expect(await screen.findByText('compra antiga')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '+30 dias atrás' })).not.toBeInTheDocument();
});

it('escolher uma data sem lançamentos mostra mensagem de nenhum resultado', async () => {
  const { box } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: '2026-01-01' } });

  expect(await screen.findByText('Nenhum resultado para a busca.')).toBeInTheDocument();
});

it('escolher uma data limpa a busca de texto e vice-versa', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: hoje, valor: -5000, status: 'efetivo', nota: 'compra do dia' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  const campoTexto = screen.getByPlaceholderText(/Buscar/);
  const campoData = screen.getByLabelText('Buscar por data');
  await userEvent.type(campoTexto, 'compra');
  expect(campoTexto).toHaveValue('compra');

  fireEvent.change(campoData, { target: { value: hoje } });
  expect(campoTexto).toHaveValue('');

  await userEvent.type(campoTexto, 'compra');
  expect(campoData).toHaveValue('');
});

it('o botão "Selecionar período" revela um campo de data "Até"', async () => {
  const { box } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  expect(screen.queryByLabelText('Até')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Selecionar período' }));

  expect(screen.getByLabelText('Até')).toBeInTheDocument();
});

it('selecionar um período mostra lançamentos de todos os dias no intervalo, mesmo fora da janela, e esconde o controle de +30 dias', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  const dataInicioRange = addDias(hoje, -40);
  const dataMeio = addDias(hoje, -35);
  const dataForaRange = addDias(hoje, -10);
  const dataFimRange = addDias(hoje, -30);
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: dataInicioRange, valor: -1000, status: 'efetivo', nota: 'evento início' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: dataMeio, valor: -1000, status: 'efetivo', nota: 'evento meio' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: dataForaRange, valor: -1000, status: 'efetivo', nota: 'evento fora' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  await userEvent.click(screen.getByRole('button', { name: 'Selecionar período' }));
  fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: dataInicioRange } });
  fireEvent.change(screen.getByLabelText('Até'), { target: { value: dataFimRange } });

  expect(await screen.findByText('evento início')).toBeInTheDocument();
  expect(screen.getByText('evento meio')).toBeInTheDocument();
  expect(screen.queryByText('evento fora')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '+30 dias atrás' })).not.toBeInTheDocument();
});

it('período com as datas trocadas (até antes de de) ainda funciona', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  const dataInicioRange = addDias(hoje, -40);
  const dataFimRange = addDias(hoje, -30);
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: dataInicioRange, valor: -1000, status: 'efetivo', nota: 'evento início' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: dataFimRange, valor: -1000, status: 'efetivo', nota: 'evento fim' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  await userEvent.click(screen.getByRole('button', { name: 'Selecionar período' }));
  fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: dataFimRange } });
  fireEvent.change(screen.getByLabelText('Até'), { target: { value: dataInicioRange } });

  expect(await screen.findByText('evento início')).toBeInTheDocument();
  expect(screen.getByText('evento fim')).toBeInTheDocument();
});

it('limpar reseta o período selecionado', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  const dataInicioRange = addDias(hoje, -40);
  const dataFimRange = addDias(hoje, -30);
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: dataInicioRange, valor: -1000, status: 'efetivo', nota: 'evento início' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  await userEvent.click(screen.getByRole('button', { name: 'Selecionar período' }));
  fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: dataInicioRange } });
  fireEvent.change(screen.getByLabelText('Até'), { target: { value: dataFimRange } });
  await screen.findByText('evento início');

  await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));

  expect(screen.queryByText('evento início')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '+30 dias atrás' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Selecionar período' })).toBeInTheDocument();
});

it('busca sem resultados dentro do intervalo mostra mensagem de nenhum resultado', async () => {
  const { box } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  await userEvent.type(screen.getByPlaceholderText(/Buscar/), 'inexistente');

  expect(await screen.findByText('Nenhum resultado para a busca.')).toBeInTheDocument();
});

it('clicar no card do gráfico abre o modal expandido', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: hoje, valor: -5000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  await userEvent.click(screen.getByRole('button', { name: 'Expandir gráfico de saldo' }));

  // primeiro import dinâmico do FluxoChartModal (carrega recharts) é lento no ambiente de teste
  expect(await screen.findByRole('dialog', { name: 'Gráfico de saldo expandido' }, { timeout: 5000 })).toBeInTheDocument();
});

it('sem ao menos 2 dias na série projetada, o gráfico não fica clicável', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: null, dataSaldoInicial: null, criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-05' });

  render(<TelaFluxo />);

  expect(screen.queryByRole('button', { name: 'Expandir gráfico de saldo' })).not.toBeInTheDocument();
});

it('lançamento de fatura de cartão abre o resumo em vez do editor, e "Editar" navega para a aba Cartão', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box } = await seedBoxComCategoria();
    const cartao = await repo.salvarCartao({
      boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
    }, '2027-12-31');
    const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
      valorTotal: 5000, parcelas: 1, descricao: 'Mercado',
    }, '2027-12-31');
    const hoje = '2026-07-01';
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje });

    render(<TelaFluxo />);
    // o item mostra "Nubank" + badge "previsto" no mesmo nó — nome exato não bate, usa regex
    await userEvent.click(await screen.findByRole('button', { name: /Nubank/ }));

    expect(await screen.findByRole('dialog', { name: 'Fatura Nubank' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Previsto' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(useApp.getState().aba).toBe('cartao');
  } finally { vi.useRealTimers(); }
});

it('dia de hoje aparece na lista mesmo sem lançamentos, destacado e só com o cabeçalho', async () => {
  const { box } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);

  const cabecalhoHoje = await screen.findByText(/· hoje/);
  expect(cabecalhoHoje).toBeInTheDocument();
  expect(cabecalhoHoje.closest('.dia-hoje')).toBeInTheDocument();
  expect(screen.queryByText('Nenhum lançamento no período.')).not.toBeInTheDocument();
});

it('filtro de data ativo não força hoje a aparecer se não tiver lançamento no filtro', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: hoje, valor: -5000, status: 'efetivo', nota: 'compra de hoje' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: '2026-01-01' } });

  expect(await screen.findByText('Nenhum resultado para a busca.')).toBeInTheDocument();
  expect(screen.queryByText(/· hoje/)).not.toBeInTheDocument();
});
