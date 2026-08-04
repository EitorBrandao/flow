import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { formatarBRL } from '../domain/money';
import { agoraISO, novoId, type Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import PagamentoFaturaSheet from './PagamentoFaturaSheet';

beforeEach(async () => {
  await limparDb();
});

/** Cartão com uma fatura de R$ 900,00 já projetada como pendente no Flow. */
async function comFatura() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Cartão', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-05',
    valorTotal: 90000, parcelas: 1,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
  const fatura = useApp.getState().dados!.lancamentos.find((l) => l.origem === 'cartao')!;
  return { cartao, fatura };
}

function montar(fatura: Lancamento, onFechar = () => {}) {
  return render(
    <PagamentoFaturaSheet lancamento={fatura} totalFaturaCent={90000} onFechar={onFechar} />,
  );
}

it('o valor pago já vem preenchido com o total da fatura', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    // formatarBRL usa espaço não-quebrável entre "R$" e o número: comparar com a saída dela,
    // nunca com um literal digitado à mão.
    expect(screen.getByLabelText('Quanto você pagou')).toHaveValue(formatarBRL(90000));
  } finally { vi.useRealTimers(); }
});

it('os campos de parcelamento aparecem sozinhos assim que sobra valor', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    // pagando o total não sobra nada, então não há o que parcelar
    expect(screen.queryByLabelText('Valor de cada parcela')).not.toBeInTheDocument();

    const pago = screen.getByLabelText('Quanto você pagou');
    await userEvent.click(pago);
    await userEvent.keyboard('{Backspace>7/}30000');

    // sem caixa nenhuma para marcar: sobrou, os campos estão lá
    expect(screen.getByLabelText('Valor de cada parcela')).toBeInTheDocument();
    expect(screen.getByLabelText('Parcelas')).toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('a linha de contas mostra "sem juros" quando as parcelas somam o restante', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    const pago = screen.getByLabelText('Quanto você pagou');
    await userEvent.click(pago);
    await userEvent.keyboard('{Backspace>7/}30000'); // R$ 300,00

    await userEvent.clear(screen.getByLabelText('Parcelas'));
    await userEvent.type(screen.getByLabelText('Parcelas'), '3');
    await userEvent.click(screen.getByLabelText('Valor de cada parcela'));
    await userEvent.keyboard('20000'); // R$ 200,00

    expect(screen.getByText('Restou da fatura').nextElementSibling).toHaveTextContent('R$ 600,00');
    expect(screen.getByText('3 × R$ 200,00').nextElementSibling).toHaveTextContent('R$ 600,00');
    expect(screen.getByText('sem juros')).toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('a linha de contas mostra os juros quando as parcelas somam mais que o restante', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    const pago = screen.getByLabelText('Quanto você pagou');
    await userEvent.click(pago);
    await userEvent.keyboard('{Backspace>7/}30000');
    await userEvent.clear(screen.getByLabelText('Parcelas'));
    await userEvent.type(screen.getByLabelText('Parcelas'), '3');
    await userEvent.click(screen.getByLabelText('Valor de cada parcela'));
    await userEvent.keyboard('22000'); // R$ 220,00

    expect(screen.getByText('Juros').nextElementSibling).toHaveTextContent('R$ 60,00');
    expect(screen.queryByText('sem juros')).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('parcelas que somam menos que o restante aparecem como falta, não como juros', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    const pago = screen.getByLabelText('Quanto você pagou');
    await userEvent.click(pago);
    await userEvent.keyboard('{Backspace>7/}30000');
    await userEvent.clear(screen.getByLabelText('Parcelas'));
    await userEvent.type(screen.getByLabelText('Parcelas'), '2');
    await userEvent.click(screen.getByLabelText('Valor de cada parcela'));
    await userEvent.keyboard('20000'); // 2 × 200,00 = 400,00, menos que os 600,00 que sobraram

    expect(screen.getByText('Faltam').nextElementSibling).toHaveTextContent('R$ 200,00');
    expect(screen.queryByText('Juros')).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('salvar sem parcelamento grava só o valor pago como efetivo', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    const fechou = vi.fn();
    montar(fatura, fechou);
    const pago = screen.getByLabelText('Quanto você pagou');
    await userEvent.click(pago);
    await userEvent.keyboard('{Backspace>7/}85000'); // R$ 850,00
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await vi.waitFor(async () => {
      expect(await db.lancamentos.get(fatura.id)).toMatchObject({ status: 'efetivo', valor: 85000 });
      expect(fechou).toHaveBeenCalled(); // só depois de gravar e recarregar
    });
  } finally { vi.useRealTimers(); }
});

it('salvar com parcelamento cria as parcelas nas faturas seguintes', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    const pago = screen.getByLabelText('Quanto você pagou');
    await userEvent.click(pago);
    await userEvent.keyboard('{Backspace>7/}30000');
    await userEvent.clear(screen.getByLabelText('Parcelas'));
    await userEvent.type(screen.getByLabelText('Parcelas'), '3');
    await userEvent.click(screen.getByLabelText('Valor de cada parcela'));
    await userEvent.keyboard('20000');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await vi.waitFor(async () => {
      const faturas = (await db.lancamentos.toArray())
        .filter((l) => l.origem === 'cartao')
        .sort((a, b) => a.data.localeCompare(b.data));
      expect(faturas.map((l) => [l.faturaMes, l.valor, l.status])).toEqual([
        ['2026-08', 30000, 'efetivo'],
        ['2026-09', 20000, 'previsto'],
        ['2026-10', 20000, 'previsto'],
        ['2026-11', 20000, 'previsto'],
      ]);
    });
  } finally { vi.useRealTimers(); }
});

it('sobra sem destino é avisada em vez de sumir calada', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    // pagou 300 de 900 e não informou parcelamento nenhum: 600 ficariam sem explicação
    const pago = screen.getByLabelText('Quanto você pagou');
    await userEvent.click(pago);
    await userEvent.keyboard('{Backspace>7/}30000');

    expect(screen.getByText(/somem da projeção/)).toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('pagando a fatura inteira não há sobra nem aviso', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);

    expect(screen.queryByText(/somem da projeção/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Valor de cada parcela')).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('preencher a parcela troca o aviso pelas contas do parcelamento', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    const pago = screen.getByLabelText('Quanto você pagou');
    await userEvent.click(pago);
    await userEvent.keyboard('{Backspace>7/}30000');
    expect(screen.getByText(/somem da projeção/)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Valor de cada parcela'));
    await userEvent.keyboard('30000'); // 2 × 300,00 cobre os 600,00

    expect(screen.queryByText(/somem da projeção/)).not.toBeInTheDocument();
    expect(screen.getByText('sem juros')).toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

// A invariante que faltava quando a feature saiu: a suíte cobria o caminho com parcelamento
// e o caminho sem, mas nenhum teste perguntava se dava para o dinheiro sumir calado. Foi
// exatamente isso que aconteceu em produção — pagamento parcial gravado, milhares de reais
// fora da projeção, nenhuma palavra na tela. Este teste varre a folha inteira e exige que,
// para QUALQUER sobra, ou as parcelas cubram o buraco ou a tela diga que ele existe.
it('numa fatura pendente a data do pagamento já vem em hoje', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    expect(fatura.data).toBe('2026-08-05'); // vence só em agosto
    montar(fatura);

    // pagar é algo que se faz agora; o vencimento é quando venceria, não quando pagou
    expect(screen.getByLabelText('Quando pagou')).toHaveValue('2026-07-01');
    expect(screen.getByText(/Pagamento adiantado/)).toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('numa fatura já paga a data registrada é preservada, não trocada por hoje', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    await repo.confirmarPendente(fatura.id);
    await useApp.getState().recarregar();
    const paga = useApp.getState().dados!.lancamentos.find((l) => l.id === fatura.id)!;
    montar(paga);

    // corrigir o valor de uma fatura já paga não pode mover a saída de dia sem querer
    expect(screen.getByLabelText('Quando pagou')).toHaveValue('2026-08-05');
    expect(screen.queryByText(/Pagamento adiantado/)).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('adiantar o pagamento grava a data escolhida no lançamento', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);

    const data = screen.getByLabelText('Quando pagou');
    await userEvent.clear(data);
    await userEvent.type(data, '2026-07-28');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await vi.waitFor(async () => {
      expect(await db.lancamentos.get(fatura.id)).toMatchObject({
        status: 'efetivo', data: '2026-07-28', faturaMes: '2026-08',
      });
    });
  } finally { vi.useRealTimers(); }
});

it('INVARIANTE: nenhuma sobra pode ficar sem parcelamento E sem aviso', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    const pago = screen.getByLabelText('Quanto você pagou');

    // varre do pagamento zerado ao total, incluindo as bordas
    for (const centavos of ['0', '1', '30000', '89999', '90000']) {
      await userEvent.click(pago);
      await userEvent.keyboard(`{Backspace>9/}${centavos}`);

      const restante = 90000 - Number(centavos);
      const avisado = screen.queryByText(/somem da projeção/) != null;
      const temCampos = screen.queryByLabelText('Valor de cada parcela') != null;

      if (restante > 0) {
        expect(avisado, `sobra de ${restante} sem aviso`).toBe(true);
        expect(temCampos, `sobra de ${restante} sem campos de parcelamento`).toBe(true);
      } else {
        expect(avisado, 'aviso aparecendo sem sobra nenhuma').toBe(false);
      }
    }
  } finally { vi.useRealTimers(); }
});

it('salvar sem preencher a parcela não inventa parcelamento nenhum', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    const pago = screen.getByLabelText('Quanto você pagou');
    await userEvent.click(pago);
    await userEvent.keyboard('{Backspace>7/}30000');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await vi.waitFor(async () => {
      expect(await db.lancamentos.get(fatura.id)).toMatchObject({ status: 'efetivo', valor: 30000 });
    });
    expect(await db.comprasCartao.count()).toBe(1); // só a compra original
    expect((await db.categoriasCartao.toArray()).some((c) => c.nome === 'Parcelamento')).toBe(false);
  } finally { vi.useRealTimers(); }
});
