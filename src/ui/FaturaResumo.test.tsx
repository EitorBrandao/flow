import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { nomeDoMes } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import { agoraISO, novoId, type Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import FaturaResumo from './FaturaResumo';

beforeEach(async () => {
  await limparDb();
});

it('mostra os itens e o total da fatura, e o link navega para a aba Cartão', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cartao = await repo.salvarCartao({
      boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
    }, '2027-12-31');
    const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
      valorTotal: 5000, parcelas: 1, descricao: 'Mercado',
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01', aba: 'fluxo' });

    const lanc = (await db.lancamentos.toArray()).find((l) => l.origem === 'cartao') as Lancamento;
    const onFechar = vi.fn();
    render(<FaturaResumo lanc={lanc} onFechar={onFechar} />);

    expect(await screen.findByRole('dialog', { name: `Nubank · fatura de ${nomeDoMes(lanc.faturaMes!)}` })).toBeInTheDocument();
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    // Compra em 10/07/2026 fecha a fatura de agosto (fechamento dia 28/07, vencimento dia 05/08).
    expect(screen.getByText(`Nubank · fatura de ${nomeDoMes(lanc.faturaMes!)}`)).toBeInTheDocument();
    const valorEsperado = formatarBRL(5000).replace(/\s/g, ' ');
    expect(screen.getByText(valorEsperado, { selector: 'strong.valor-gasto' })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'P'
      && (el.textContent ?? '').includes('fecha 28/07/2026 · vence 05/08/2026'))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Ver fatura completa na aba Cartão/ }));
    expect(useApp.getState().aba).toBe('cartao');
    expect(onFechar).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});

it('fatura sem itens mostra "Nenhum gasto nesta fatura."', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cartao = await repo.salvarCartao({
      boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01', aba: 'fluxo' });

    // Lançamento de fatura sem nenhuma compra correspondente (fatura não encontrada).
    const lanc: Lancamento = {
      id: novoId(), boxId: box.id, categoriaId: cartao.categoriaFaturaId, valor: 0,
      data: '2026-08-05', status: 'previsto', origem: 'cartao', cartaoId: cartao.id, faturaMes: '2026-08',
      criadoEm: agora, alteradoEm: agora,
    };
    render(<FaturaResumo lanc={lanc} onFechar={() => {}} />);

    expect(await screen.findByRole('dialog', { name: `Nubank · fatura de ${nomeDoMes(lanc.faturaMes!)}` })).toBeInTheDocument();
    expect(screen.getByText('Nenhum gasto nesta fatura.')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'P'
      && (el.textContent ?? '').includes('fecha 28/07/2026 · vence 05/08/2026'))).toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});
