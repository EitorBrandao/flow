import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { nomeDoMes } from '../domain/dates';
import { agoraISO, novoId, type Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import FaturaResumo from './FaturaResumo';
import TelaCartao from './TelaCartao';

// Hoje é 01/07/2026: o mês que a aba Cartão abre sozinha é agosto de 2026. Os pedidos abaixo
// pedem dezembro de 2026 — mês diferente do padrão — e o cartão "Zeta", o segundo em ordem
// alfabética. Se o pedido fosse ignorado, a aba abriria "Alfa" em agosto e os testes falhariam.
const HOJE = '2026-07-01';
const MES_PEDIDO = '2026-12';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${HOJE}T12:00:00`));
  await limparDb();
});

afterEach(() => {
  vi.useRealTimers();
});

async function semear(modo: 'simples' | 'avancado' = 'avancado', zetaAtivo = true) {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarModo('cartao', modo);
  const alfa = await repo.salvarCartao({ boxId: box.id, nome: 'Alfa', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  const zeta = await repo.salvarCartao({ boxId: box.id, nome: 'Zeta', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  const catAlfa = await repo.salvarCategoriaCartao({ cartaoId: alfa.id, nome: 'mercado', ordem: 0 });
  const catZeta = await repo.salvarCategoriaCartao({ cartaoId: zeta.id, nome: 'mercado', ordem: 0 });
  await repo.salvarCompraCartao({
    cartaoId: alfa.id, categoriaCartaoId: catAlfa.id, data: '2026-07-10', valorTotal: 1000, parcelas: 1, descricao: 'Item do Alfa',
  }, '2027-12-31');
  // Compras de 10 e 12/11 caem na fatura que fecha em 28/11 e vence em 05/12/2026 (MES_PEDIDO).
  await repo.salvarCompraCartao({
    cartaoId: zeta.id, categoriaCartaoId: catZeta.id, data: '2026-11-10', valorTotal: 7834, parcelas: 1, descricao: 'Sorveteria Alvo',
  }, '2027-12-31');
  await repo.salvarCompraCartao({
    cartaoId: zeta.id, categoriaCartaoId: catZeta.id, data: '2026-11-12', valorTotal: 5000, parcelas: 1, descricao: 'Padaria',
  }, '2027-12-31');
  if (!zetaAtivo) await db.cartoes.update(zeta.id, { ativo: false });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: HOJE, aba: 'fluxo', cartaoPedido: null });
  return { box, alfa, zeta };
}

describe('aba Cartão aberta por um pedido', () => {
  it('sem pedido, abre no primeiro cartão e no mês atual (controle)', async () => {
    const { alfa } = await semear();
    render(<TelaCartao />);
    expect(screen.getByLabelText('Cartão')).toHaveValue(alfa.id);
    expect(screen.getByText(nomeDoMes('2026-08'))).toBeInTheDocument();
  });

  it('abre no cartão e no mês pedidos, e consome o pedido', async () => {
    const { zeta } = await semear();
    useApp.getState().abrirCartao({ cartaoId: zeta.id, mes: MES_PEDIDO });
    expect(useApp.getState().aba).toBe('cartao');
    render(<TelaCartao />);

    expect(screen.getByLabelText('Cartão')).toHaveValue(zeta.id);
    expect(screen.getByRole('heading', { name: 'Zeta' })).toBeInTheDocument();
    expect(screen.getByText(nomeDoMes(MES_PEDIDO))).toBeInTheDocument();
    // sem busca no pedido, a aba continua em Resumo
    expect(screen.getByRole('tab', { name: 'Resumo' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(useApp.getState().cartaoPedido).toBeNull());
  });

  it('com busca no pedido, abre em Lançamentos com o campo preenchido e só o que casa', async () => {
    const { zeta } = await semear();
    useApp.getState().abrirCartao({ cartaoId: zeta.id, mes: MES_PEDIDO, busca: 'Sorv' });
    render(<TelaCartao />);

    expect(screen.getByRole('tab', { name: 'Lançamentos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByPlaceholderText(/Buscar/)).toHaveValue('Sorv');
    expect(screen.getByText('Sorveteria Alvo')).toBeInTheDocument();
    expect(screen.queryByText('Padaria')).not.toBeInTheDocument();
  });

  it('trocar de cartão no seletor descarta o pedido: voltar não reaplica o mês', async () => {
    const { alfa, zeta } = await semear();
    useApp.getState().abrirCartao({ cartaoId: zeta.id, mes: MES_PEDIDO });
    render(<TelaCartao />);

    await userEvent.selectOptions(screen.getByLabelText('Cartão'), alfa.id);
    expect(screen.getByRole('heading', { name: 'Alfa' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Cartão'), zeta.id);
    expect(screen.getByRole('heading', { name: 'Zeta' })).toBeInTheDocument();
    expect(screen.getByText(nomeDoMes('2026-08'))).toBeInTheDocument();
    expect(screen.queryByText(nomeDoMes(MES_PEDIDO))).not.toBeInTheDocument();
  });

  it('cartão inativo, sem pedido, não aparece na aba', async () => {
    await semear('avancado', false);
    render(<TelaCartao />);
    // sem pedido: só o Alfa está ativo, então nem há seletor
    expect(screen.queryByLabelText('Cartão')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Alfa' })).toBeInTheDocument();
  });

  it('cartão inativo pedido abre no cartão certo, e não no primeiro da lista', async () => {
    const { zeta } = await semear('avancado', false);
    useApp.getState().abrirCartao({ cartaoId: zeta.id, mes: MES_PEDIDO });
    render(<TelaCartao />);
    expect(screen.getByLabelText('Cartão')).toHaveValue(zeta.id);
    expect(screen.getByRole('heading', { name: 'Zeta' })).toBeInTheDocument();
    expect(screen.getByText(nomeDoMes(MES_PEDIDO))).toBeInTheDocument();
  });

  it('no modo Simples, o pedido define o cartão e o mês', async () => {
    const { zeta } = await semear('simples');
    useApp.getState().abrirCartao({ cartaoId: zeta.id, mes: MES_PEDIDO, busca: 'Sorv' });
    render(<TelaCartao />);

    expect(screen.getByLabelText('Cartão')).toHaveValue(zeta.id);
    expect(screen.getByRole('heading', { name: 'Zeta' })).toBeInTheDocument();
    expect(screen.getByText(nomeDoMes(MES_PEDIDO))).toBeInTheDocument();
    expect(screen.getByLabelText('Valor da fatura')).toBeInTheDocument();
  });
});

describe('folha da fatura (Fluxo) → aba Cartão', () => {
  async function lancDaFaturaZeta(zetaId: string) {
    return (await db.lancamentos.toArray())
      .find((l) => l.origem === 'cartao' && l.cartaoId === zetaId && l.faturaMes === MES_PEDIDO) as Lancamento;
  }

  it('o botão fica no cabeçalho fixo da folha, junto do total', async () => {
    const { zeta } = await semear();
    render(<FaturaResumo lanc={await lancDaFaturaZeta(zeta.id)} onFechar={() => {}} />);
    const botao = await screen.findByRole('button', { name: /Ver fatura completa na aba Cartão/ });
    expect(botao.closest('.sheet-cabecalho')).not.toBeNull();
    expect(within(botao.closest('.sheet-cabecalho') as HTMLElement).getByText(/vence 05\/12\/2026/)).toBeInTheDocument();
  });

  it('o toque leva ao cartão e ao mês da fatura aberta (o bug do Cartão errado)', async () => {
    const { zeta } = await semear();
    const onFechar = vi.fn();
    const { unmount } = render(<FaturaResumo lanc={await lancDaFaturaZeta(zeta.id)} onFechar={onFechar} />);
    await userEvent.click(await screen.findByRole('button', { name: /Ver fatura completa na aba Cartão/ }));

    expect(useApp.getState().aba).toBe('cartao');
    expect(useApp.getState().cartaoPedido).toEqual({ cartaoId: zeta.id, mes: MES_PEDIDO, busca: undefined });
    expect(onFechar).toHaveBeenCalledOnce();
    unmount();

    render(<TelaCartao />);
    expect(screen.getByRole('heading', { name: 'Zeta' })).toBeInTheDocument();
    expect(screen.getByText(nomeDoMes(MES_PEDIDO))).toBeInTheDocument();
  });

  it('com busca, as compras que casam sobem para "Encontrado na busca" e a aba Cartão chega filtrada', async () => {
    const { zeta } = await semear();
    const { unmount } = render(<FaturaResumo lanc={await lancDaFaturaZeta(zeta.id)} busca="Sorv" onFechar={() => {}} />);

    expect(await screen.findByText('Encontrado na busca')).toBeInTheDocument();
    expect(screen.getAllByText('Sorveteria Alvo')).toHaveLength(1);
    expect(screen.getByText('Sorveteria Alvo').closest('.item')).toHaveClass('ativo');
    expect(screen.getByText('Padaria').closest('.item')).not.toHaveClass('ativo');
    // as demais compras seguem sob o próprio rótulo, para não parecerem parte do grupo achado
    expect(screen.getByText('À vista')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Ver fatura completa na aba Cartão/ }));
    expect(useApp.getState().cartaoPedido).toEqual({ cartaoId: zeta.id, mes: MES_PEDIDO, busca: 'Sorv' });
    unmount();

    render(<TelaCartao />);
    expect(screen.getByPlaceholderText(/Buscar/)).toHaveValue('Sorv');
    expect(screen.queryByText('Padaria')).not.toBeInTheDocument();
  });

  it('busca que casou só com o lançamento (nenhuma compra) não cria grupo nem filtra a aba Cartão', async () => {
    const { zeta } = await semear();
    render(<FaturaResumo lanc={await lancDaFaturaZeta(zeta.id)} busca="zeta" onFechar={() => {}} />);

    expect(await screen.findByText('Sorveteria Alvo')).toBeInTheDocument();
    expect(screen.queryByText('Encontrado na busca')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Ver fatura completa na aba Cartão/ }));
    expect(useApp.getState().cartaoPedido).toEqual({ cartaoId: zeta.id, mes: MES_PEDIDO, busca: undefined });
  });

  it('sem busca, a folha não mostra o grupo nem rótulos com um grupo só', async () => {
    const { zeta } = await semear();
    render(<FaturaResumo lanc={await lancDaFaturaZeta(zeta.id)} onFechar={() => {}} />);
    expect(await screen.findByText('Sorveteria Alvo')).toBeInTheDocument();
    expect(screen.queryByText('Encontrado na busca')).not.toBeInTheDocument();
    expect(screen.queryByText('À vista')).not.toBeInTheDocument();
  });
});
