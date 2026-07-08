import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId, type Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import FaturaResumo from './FaturaResumo';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('mostra os itens e o total da fatura, e "Editar" navega para a aba Cartão', async () => {
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

    expect(await screen.findByRole('dialog', { name: 'Fatura Nubank' })).toBeInTheDocument();
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*50,00/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(useApp.getState().aba).toBe('cartao');
    expect(onFechar).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});
