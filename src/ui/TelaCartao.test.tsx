import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaCartao from './TelaCartao';

beforeEach(async () => {
  await limparDb();
});

async function montarCartao() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  return { box, cartao, catCartao };
}

/** O card da fatura ganhou 3 abas (Resumo/Lançamentos/Conferência) — Resumo é a padrão. */
async function abrirAba(nome: RegExp | string) {
  await userEvent.click(screen.getByRole('tab', { name: nome }));
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

it('editar uma compra existente abre o formulário num Sheet', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  let confirmSpy: any;
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao();
    const compra = await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-01',
      valorTotal: 5000, parcelas: 1,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    render(<TelaCartao />);

    await abrirAba('Lançamentos');
    await userEvent.click(await screen.findByText('mercado'));
    expect(await screen.findByRole('dialog', { name: 'Editar compra' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Editar compra' })).toBeInTheDocument();

    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(async () => {
      expect(await db.comprasCartao.get(compra.id)).toBeUndefined();
    });
  } finally {
    confirmSpy?.mockRestore();
    vi.useRealTimers();
  }
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

    await abrirAba(/Conferência/);
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

it('botão Remover remove a conferência salva', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao();
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-01',
      valorTotal: 5000, parcelas: 1,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    render(<TelaCartao />);
    await abrirAba(/Conferência/);

    // Digite valor e salve
    await userEvent.type(screen.getByLabelText('Valor no app do banco'), '100,00');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência' }));
    expect(await screen.findByText(/Falta bater/)).toBeInTheDocument();

    // Clique em Remover
    await userEvent.click(screen.getByRole('button', { name: 'Remover conferência' }));

    // Confirme que a diferença desapareceu
    await waitFor(async () => {
      expect(screen.queryByText(/Falta bater/)).not.toBeInTheDocument();
    });

    // Clique Salvar novamente — não deve recriar a conferência
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência' }));

    // Confirme que a diferença ainda não aparece (valor foi resetado para 0)
    await waitFor(async () => {
      expect(screen.queryByText(/Falta bater/)).not.toBeInTheDocument();
    });

    // Confirme que a conferência não foi recriada no DB
    const confRefresh = await db.conferenciasFatura.toArray();
    expect(confRefresh).toHaveLength(0);
  } finally { vi.useRealTimers(); }
});

it('agrupa lançamentos em À vista/Parceladas, mais recentes primeiro', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao();
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-04',
      valorTotal: 41230, parcelas: 1, descricao: 'Mercado',
    }, '2027-12-31');
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-15',
      valorTotal: 4490, parcelas: 1, descricao: 'Streaming',
    }, '2027-12-31');
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
      valorTotal: 28900, parcelas: 3, descricao: 'Notebook',
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    render(<TelaCartao />);

    await abrirAba('Lançamentos');
    const grupos = screen.getAllByText(/À vista|Parceladas/).map((el) => el.textContent);
    expect(grupos).toEqual(['À vista', 'Parceladas']);

    const itens = screen.getAllByText(/Mercado|Streaming|Notebook/).map((el) => el.textContent);
    // dentro de "À vista": Streaming (15/07) antes de Mercado (04/07); "Notebook" é a parcelada.
    expect(itens.indexOf('Streaming')).toBeLessThan(itens.indexOf('Mercado'));
    expect(itens.indexOf('Notebook')).toBeGreaterThan(itens.indexOf('Mercado'));
  } finally { vi.useRealTimers(); }
});

it('clicar numa categoria do resumo filtra os lançamentos; clicar de novo limpa o filtro', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao();
    const catLazer = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'lazer', ordem: 1 });
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-04',
      valorTotal: 41230, parcelas: 1, descricao: 'Mercado',
    }, '2027-12-31');
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catLazer.id, data: '2026-07-15',
      valorTotal: 4490, parcelas: 1, descricao: 'Streaming',
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    render(<TelaCartao />);

    // Clicar na categoria, no Resumo, já pula pra aba Lançamentos com o filtro aplicado.
    await userEvent.click(screen.getByRole('button', { name: /^lazer/ }));
    expect(await screen.findByText('Streaming')).toBeInTheDocument();
    expect(screen.queryByText('Mercado')).not.toBeInTheDocument();

    await abrirAba('Resumo');
    expect(screen.getByRole('button', { name: /^lazer/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /^lazer/ }));

    expect(await screen.findByText('Mercado')).toBeInTheDocument();
    expect(screen.getByText('Streaming')).toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('busca filtra por descrição e mostra estado vazio quando nada bate', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao();
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-04',
      valorTotal: 41230, parcelas: 1, descricao: 'Mercado',
    }, '2027-12-31');
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-15',
      valorTotal: 4490, parcelas: 1, descricao: 'Streaming',
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    render(<TelaCartao />);

    await abrirAba('Lançamentos');
    await userEvent.type(screen.getByPlaceholderText(/Buscar/), 'stream');
    expect(await screen.findByText('Streaming')).toBeInTheDocument();
    expect(screen.queryByText('Mercado')).not.toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText(/Buscar/));
    await userEvent.type(screen.getByPlaceholderText(/Buscar/), 'padaria');
    expect(await screen.findByText('Nenhum lançamento encontrado.')).toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

describe('pagamento da fatura pela aba Cartão', () => {
  async function comFatura() {
    const { box, cartao, catCartao } = await montarCartao();
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-05',
      valorTotal: 90000, parcelas: 1,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    return { box, cartao };
  }

  it('a fatura ainda não paga mostra o valor a pagar e o atalho', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      await comFatura();
      render(<TelaCartao />); // a tela já abre na fatura 08/2026, a da compra de julho, aba Resumo

      expect(screen.getByText(/A pagar/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'paguei outro valor' })).toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it('fatura já confirmada oferece corrigir ou parcelar depois', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      await comFatura();
      const lanc = useApp.getState().dados!.lancamentos.find((l) => l.origem === 'cartao')!;
      await repo.confirmarPendente(lanc.id);
      await useApp.getState().recarregar();

      render(<TelaCartao />);
      expect(screen.getByText(/Pago/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'corrigir ou parcelar' }));
      expect(await screen.findByRole('dialog', { name: 'Pagamento da fatura' })).toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it('mês sem lançamento de fatura não oferece o atalho', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      await comFatura();
      render(<TelaCartao />);
      // 09/2026 não tem compra nenhuma, logo não virou lançamento no Flow
      await userEvent.click(screen.getByRole('button', { name: 'Mês seguinte' }));

      expect(screen.queryByRole('button', { name: /paguei outro valor/i })).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });
});
