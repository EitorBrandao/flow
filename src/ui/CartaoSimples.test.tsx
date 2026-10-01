import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { formatarBRL } from '../domain/money';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaCartao from './TelaCartao';

beforeEach(async () => { await limparDb(); });
afterEach(() => { vi.useRealTimers(); });

const HORIZONTE = '2027-12-31';

/** Cartão sintético: fecha dia 5, vence dia 12. Com hoje = 01/10/2026 a fatura aberta é a de
 *  outubro (fecha 05/10, vence 12/10/2026). */
async function montar(hojeISO = '2026-10-01', modo: 'simples' | 'avancado' = 'simples') {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${hojeISO}T12:00:00`));
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({ boxId: box.id, nome: 'Cartão Sigma', diaFechamento: 5, diaVencimento: 12 }, HORIZONTE);
  await repo.salvarModo('cartao', modo);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: hojeISO });
  return { box, cartao };
}

const faturas = async () => (await db.lancamentos.toArray()).filter((l) => l.origem === 'cartao');

it('mostra seletor de mês, valor, vencimento somente leitura e Salvar fatura', async () => {
  await montar();
  render(<TelaCartao />);
  expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
  expect(screen.getByLabelText('Valor da fatura')).toBeInTheDocument();
  expect(screen.getByText(/^Vencimento:/)).toBeInTheDocument();
  expect(screen.getByText('Vencimento: 12/10/2026')).toBeInTheDocument();
  expect(screen.queryByLabelText('Vencimento')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Salvar fatura' })).toBeDisabled();
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
});

it('salvar grava a conferência com usarValorApp, sem compra, e cria um previsto no vencimento', async () => {
  await montar();
  render(<TelaCartao />);
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '187000');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  await waitFor(async () => expect(await faturas()).toHaveLength(1));
  const confs = await db.conferenciasFatura.toArray();
  expect(confs).toHaveLength(1);
  expect(confs[0]).toMatchObject({ mes: '2026-10', valorAppCent: 187000, usarValorApp: true });
  expect(await db.comprasCartao.count()).toBe(0);
  const [prev] = await faturas();
  expect(prev).toMatchObject({ status: 'previsto', valor: 187000, data: '2026-10-12' });
});

it('salvar de novo com outro valor atualiza a mesma conferência e o previsto', async () => {
  await montar();
  render(<TelaCartao />);
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '187000');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  await waitFor(async () => expect(await faturas()).toHaveLength(1));
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '200000');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  await waitFor(async () => expect((await faturas())[0].valor).toBe(200000));
  expect(await db.conferenciasFatura.count()).toBe(1);
  expect(await faturas()).toHaveLength(1);
});

it('mês com compras: o campo vem com a soma e salvar outro valor não apaga as compras', async () => {
  const { cartao } = await montar();
  const cat = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: cat.id, data: '2026-10-01', valorTotal: 8000, parcelas: 1,
  }, HORIZONTE);
  await useApp.getState().recarregar();
  useApp.setState({ hoje: '2026-10-01' });
  render(<TelaCartao />);
  expect(screen.getByLabelText('Valor da fatura')).toHaveValue(formatarBRL(8000));
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '10000');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  await waitFor(async () => expect((await faturas())[0]?.valor).toBe(10000));
  expect(await db.comprasCartao.count()).toBe(1);
  expect((await db.conferenciasFatura.toArray())[0]).toMatchObject({ valorAppCent: 10000, usarValorApp: true });
});

it('com o previsto: Paguei tudo vira efetivo; depois mostra Pago e some o botão', async () => {
  await montar();
  render(<TelaCartao />);
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '187000');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  expect(await screen.findByRole('button', { name: 'Paguei outro valor' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Paguei tudo' }));
  await waitFor(async () => expect((await faturas())[0].status).toBe('efetivo'));
  expect(await screen.findByText(/Pago: R\$\s*1\.870,00/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Paguei tudo' })).not.toBeInTheDocument();
});

it('Paguei outro valor abre a folha de pagamento da fatura', async () => {
  await montar();
  render(<TelaCartao />);
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '187000');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Paguei outro valor' }));
  expect(await screen.findByRole('dialog', { name: 'Pagamento da fatura' })).toBeInTheDocument();
});

it('vencimento já passado sem lançamento: mostra o aviso e nenhum botão de pagamento', async () => {
  await montar('2026-10-20');
  render(<TelaCartao />);
  await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' })); // outubro: venceu em 12/10
  expect(screen.getByText('Vencimento: 12/10/2026')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '187000');
  expect(screen.getByText('O vencimento desta fatura já passou. O valor fica registrado na Conferência, mas não entra no Fluxo.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  await waitFor(async () => expect(await db.conferenciasFatura.count()).toBe(1));
  expect(await faturas()).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Paguei tudo' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Paguei outro valor' })).not.toBeInTheDocument();
});

it('valor zerado desabilita Salvar fatura, sem frase de pista (sem valor, nada)', async () => {
  await montar();
  render(<TelaCartao />);
  const botao = screen.getByRole('button', { name: 'Salvar fatura' });
  expect(botao).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '5');
  expect(botao).toBeEnabled();
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '{Backspace}');
  expect(botao).toBeDisabled();
});

it('trocar de mês recarrega o valor do mês', async () => {
  await montar();
  render(<TelaCartao />);
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '187000');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  await waitFor(async () => expect(await faturas()).toHaveLength(1));
  await userEvent.click(screen.getByRole('button', { name: 'Mês seguinte' }));
  expect(screen.getByLabelText('Valor da fatura')).toHaveValue(formatarBRL(0));
  expect(screen.getByText('Vencimento: 12/11/2026')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
  expect(screen.getByLabelText('Valor da fatura')).toHaveValue(formatarBRL(187000));
});

it('visão casa empilha os cartões', async () => {
  const { box } = await montar();
  await repo.salvarCartao({ boxId: box.id, nome: 'Cartão Delta', diaFechamento: 5, diaVencimento: 12 }, HORIZONTE);
  await useApp.getState().recarregar();
  useApp.setState({ boxSel: 'casa', hoje: '2026-10-01' });
  render(<TelaCartao />);
  expect(screen.getAllByLabelText('Valor da fatura')).toHaveLength(2);
  expect(screen.getByRole('heading', { name: 'Cartão Sigma' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Cartão Delta' })).toBeInTheDocument();
});

it('sem cartão mostra o convite para cadastrar', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T12:00:00'));
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarModo('cartao', 'simples');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-10-01' });
  render(<TelaCartao />);
  expect(screen.getByRole('button', { name: 'Cadastrar cartão' })).toBeInTheDocument();
});

it('voltar ao Avançado mostra a mesma conferência marcada', async () => {
  await montar();
  const { unmount } = render(<TelaCartao />);
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '187000');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  await waitFor(async () => expect(await faturas()).toHaveLength(1));
  unmount();
  await repo.salvarModo('cartao', 'avancado');
  await useApp.getState().recarregar();
  useApp.setState({ hoje: '2026-10-01' });
  render(<TelaCartao />);
  await userEvent.click(screen.getByRole('tab', { name: /Conferência/ }));
  expect(screen.getByLabelText('Valor no app do banco')).toHaveValue(formatarBRL(187000));
  expect(screen.getByLabelText(/usar este valor no Flow/)).toBeChecked();
});

const AVISO_VENCIDA = 'O vencimento desta fatura já passou. O valor fica registrado na Conferência, mas não entra no Fluxo.';

it('mês vencido com valor zero: sem aviso de vencimento', async () => {
  await montar('2026-10-20');
  render(<TelaCartao />);
  await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
  expect(screen.getByLabelText('Valor da fatura')).toHaveValue(formatarBRL(0));
  expect(screen.queryByText(AVISO_VENCIDA)).not.toBeInTheDocument();
});

it('Salvar fatura fica desabilitado sem edição e não sobrescreve conferência do Avançado', async () => {
  const { cartao } = await montar();
  const cat = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: cat.id, data: '2026-10-01', valorTotal: 8000, parcelas: 1,
  }, HORIZONTE);
  await repo.salvarConferenciaFatura(cartao.id, '2026-10', 150000, false, HORIZONTE);
  await useApp.getState().recarregar();
  useApp.setState({ hoje: '2026-10-01' });
  render(<TelaCartao />);
  const botao = screen.getByRole('button', { name: 'Salvar fatura' });
  expect(screen.getByLabelText('Valor da fatura')).toHaveValue(formatarBRL(8000));
  expect(botao).toBeDisabled();
  await userEvent.click(botao);
  expect(await db.conferenciasFatura.toArray()).toMatchObject([{ valorAppCent: 150000, usarValorApp: false }]);
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '9000');
  expect(botao).toBeEnabled();
  await userEvent.click(botao);
  await waitFor(async () =>
    expect(await db.conferenciasFatura.toArray()).toMatchObject([{ valorAppCent: 9000, usarValorApp: true }]));
});

it('Remover valor só aparece com conferência marcada; sem compras, a fatura some do Fluxo', async () => {
  await montar();
  render(<TelaCartao />);
  expect(screen.queryByRole('button', { name: 'Remover valor' })).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '187000');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  await waitFor(async () => expect(await faturas()).toHaveLength(1));
  await userEvent.click(await screen.findByRole('button', { name: 'Remover valor' }));
  await waitFor(async () => expect(await db.conferenciasFatura.count()).toBe(0));
  await waitFor(async () => expect(await faturas()).toHaveLength(0));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Remover valor' })).not.toBeInTheDocument());
  expect(screen.getByLabelText('Valor da fatura')).toHaveValue(formatarBRL(0));
});

it('Remover valor com compras: a fatura volta à soma e as compras continuam', async () => {
  const { cartao } = await montar();
  const cat = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: cat.id, data: '2026-10-01', valorTotal: 8000, parcelas: 1,
  }, HORIZONTE);
  await useApp.getState().recarregar();
  useApp.setState({ hoje: '2026-10-01' });
  render(<TelaCartao />);
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '10000');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  await waitFor(async () => expect((await faturas())[0]?.valor).toBe(10000));
  await userEvent.click(await screen.findByRole('button', { name: 'Remover valor' }));
  await waitFor(async () => expect((await faturas())[0]?.valor).toBe(8000));
  expect(await db.conferenciasFatura.count()).toBe(0);
  expect(await db.comprasCartao.count()).toBe(1);
  expect(screen.getByLabelText('Valor da fatura')).toHaveValue(formatarBRL(8000));
});

it('pago a menor: mostra o aviso e Corrigir o valor pago grava o valor novo', async () => {
  await montar();
  render(<TelaCartao />);
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '187000');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Paguei tudo' }));
  await waitFor(async () => expect((await faturas())[0].status).toBe('efetivo'));
  expect(screen.queryByText(/não chegaram no Fluxo/)).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '1870000'); // o 1º dígito substitui: 18.700,00
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  expect(await screen.findByText(/Tem R\$\s*16\.830,00 nessa fatura que não chegaram no Fluxo/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Corrigir o valor pago' }));
  await screen.findByRole('dialog', { name: 'Pagamento da fatura' });
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
  await waitFor(async () => expect((await faturas())[0]).toMatchObject({ status: 'efetivo', valor: 1870000 }));
});

it('Paguei outro valor: confirmar grava o lançamento efetivo com o valor pago', async () => {
  await montar();
  render(<TelaCartao />);
  await userEvent.type(screen.getByLabelText('Valor da fatura'), '187000');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar fatura' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Paguei outro valor' }));
  await screen.findByRole('dialog', { name: 'Pagamento da fatura' });
  const campo = screen.getByLabelText('Quanto você pagou');
  await userEvent.clear(campo);
  await userEvent.type(campo, '100000');
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
  await waitFor(async () => {
    const f = (await faturas()).filter((l) => l.faturaMes === '2026-10' && l.status === 'efetivo');
    expect(f).toHaveLength(1);
    expect(f[0].valor).toBe(100000);
  });
});
