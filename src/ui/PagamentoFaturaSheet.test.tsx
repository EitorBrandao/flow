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

async function digitarPago(centavos: string) {
  await userEvent.click(screen.getByLabelText('Quanto você pagou'));
  await userEvent.keyboard(`{Backspace>9/}${centavos}`);
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

it('sobrando valor, as pílulas aparecem com "Mês seguinte" marcado e o restante preenchido', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    // pagando o total não sobra nada, então não há pergunta
    expect(screen.queryByRole('radiogroup', { name: 'Destino do que sobrou' })).not.toBeInTheDocument();

    await digitarPago('30000');

    expect(screen.getByRole('radio', { name: 'Mês seguinte' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Valor na próxima fatura')).toHaveValue(formatarBRL(60000));
    expect(screen.queryByLabelText('Valor de cada parcela')).not.toBeInTheDocument();
    expect(screen.getByText('Na próxima fatura').nextElementSibling).toHaveTextContent(/600,00/);
    expect(screen.getByText('sem juros')).toBeInTheDocument();
    expect(screen.queryByText(/somem da projeção/)).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('a linha de contas mostra "sem juros" quando as parcelas somam o restante', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('30000'); // R$ 300,00
    await userEvent.click(screen.getByRole('radio', { name: 'Parcelei' }));

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
    await digitarPago('30000');
    await userEvent.click(screen.getByRole('radio', { name: 'Parcelei' }));
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
    await digitarPago('30000');
    await userEvent.click(screen.getByRole('radio', { name: 'Parcelei' }));
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
    await digitarPago('85000'); // R$ 850,00
    await userEvent.click(screen.getByRole('radio', { name: 'Não volta' }));
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
    await digitarPago('30000');
    await userEvent.click(screen.getByRole('radio', { name: 'Parcelei' }));
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

it('"Não volta" avisa que a sobra some da projeção', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('30000');
    await userEvent.click(screen.getByRole('radio', { name: 'Não volta' }));

    expect(screen.getByText(/somem da projeção/)).toBeInTheDocument();
    expect(screen.getByText(/desconto ou estorno/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Valor na próxima fatura')).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('pagando a fatura inteira não há sobra nem aviso', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);

    expect(screen.queryByRole('radiogroup', { name: 'Destino do que sobrou' })).not.toBeInTheDocument();
    expect(screen.queryByText(/somem da projeção/)).not.toBeInTheDocument();
    expect(screen.queryByText(/a mais/)).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('preencher a parcela troca o aviso pelas contas do parcelamento', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('30000');
    await userEvent.click(screen.getByRole('radio', { name: 'Parcelei' }));
    expect(screen.getByText(/somem da projeção/)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Valor de cada parcela'));
    await userEvent.keyboard('30000'); // 2 × 300,00 cobre os 600,00

    expect(screen.queryByText(/somem da projeção/)).not.toBeInTheDocument();
    expect(screen.getByText('sem juros')).toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('INVARIANTE: nenhuma sobra pode sumir sem aviso, em nenhuma pílula', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);

    for (const centavos of ['0', '1', '30000', '89999', '90000']) {
      await digitarPago(centavos);
      const restante = 90000 - Number(centavos);

      if (restante <= 0) {
        expect(screen.queryByText(/somem da projeção/), 'aviso sem sobra').not.toBeInTheDocument();
        continue;
      }
      for (const pilula of ['Mês seguinte', 'Parcelei', 'Não volta']) {
        await userEvent.click(screen.getByRole('radio', { name: pilula }));
        const vaiParaFatura = screen.queryByText('Na próxima fatura') != null
          || screen.queryByText(/^\d+ × /) != null;
        const avisado = screen.queryByText(/somem da projeção/) != null;
        expect(vaiParaFatura || avisado, `sobra de ${restante} em "${pilula}" some calada`).toBe(true);
      }
      // zerar o valor da próxima fatura também tem que avisar
      await userEvent.click(screen.getByRole('radio', { name: 'Mês seguinte' }));
      await userEvent.click(screen.getByLabelText('Valor na próxima fatura'));
      await userEvent.keyboard('{Backspace>9/}');
      expect(screen.getByText(/somem da projeção/)).toBeInTheDocument();
    }
  } finally { vi.useRealTimers(); }
});

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


it('"Não volta" grava só o pagamento, sem compra nem categoria reservada', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('30000');
    await userEvent.click(screen.getByRole('radio', { name: 'Não volta' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await vi.waitFor(async () => {
      expect(await db.lancamentos.get(fatura.id)).toMatchObject({ status: 'efetivo', valor: 30000 });
    });
    expect(await db.comprasCartao.count()).toBe(1); // só a compra original
    expect((await db.categoriasCartao.toArray()).some((c) => c.nome === 'Parcelamento')).toBe(false);
  } finally { vi.useRealTimers(); }
});

it('"Mês seguinte" grava o restante como parcela única na fatura seguinte', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('30000');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await vi.waitFor(async () => {
      const faturas = (await db.lancamentos.toArray())
        .filter((l) => l.origem === 'cartao')
        .sort((a, b) => a.data.localeCompare(b.data));
      expect(faturas.map((l) => [l.faturaMes, l.valor, l.status])).toEqual([
        ['2026-08', 30000, 'efetivo'],
        ['2026-09', 60000, 'previsto'],
      ]);
    });
    const restante = (await db.comprasCartao.toArray()).find((c) => c.parcelas === 1 && c.descricao);
    expect(restante?.descricao).toBe('Restante da fatura de 08/2026');
  } finally { vi.useRealTimers(); }
});

it('"Mês seguinte" com juros: grava o valor digitado e mostra a diferença como juros', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('30000');
    await userEvent.click(screen.getByLabelText('Valor na próxima fatura'));
    await userEvent.keyboard('64000'); // 600,00 + 40,00 do banco

    expect(screen.getByText('Juros').nextElementSibling).toHaveTextContent(/40,00/);
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
    await vi.waitFor(async () => {
      const setembro = (await db.lancamentos.toArray()).find((l) => l.faturaMes === '2026-09');
      expect(setembro?.valor).toBe(64000);
    });
  } finally { vi.useRealTimers(); }
});

it('o valor da próxima fatura acompanha o pago até ser digitado', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('30000');
    expect(screen.getByLabelText('Valor na próxima fatura')).toHaveValue(formatarBRL(60000));
    await digitarPago('50000');
    expect(screen.getByLabelText('Valor na próxima fatura')).toHaveValue(formatarBRL(40000));

    await userEvent.click(screen.getByLabelText('Valor na próxima fatura'));
    await userEvent.keyboard('45000');
    await digitarPago('40000');
    expect(screen.getByLabelText('Valor na próxima fatura')).toHaveValue(formatarBRL(45000));
  } finally { vi.useRealTimers(); }
});

it('pagou a mais: avisa o excesso, sem pílulas e sem gravar crédito', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('100000'); // 1.000,00 numa fatura de 900,00

    expect(screen.getByText(/a mais/)).toHaveTextContent(/100,00/);
    expect(screen.getByText(/ainda não registra esse crédito/)).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Destino do que sobrou' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
    await vi.waitFor(async () => {
      expect(await db.lancamentos.get(fatura.id)).toMatchObject({ status: 'efetivo', valor: 100000 });
    });
    expect(await db.comprasCartao.count()).toBe(1);
  } finally { vi.useRealTimers(); }
});

it('fatura com restante já lançado: abre em "Não volta", mostra o lançado e não duplica', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { cartao, fatura } = await comFatura();
    await repo.registrarPagamentoFatura({
      lancamentoId: fatura.id, cartaoId: cartao.id, faturaMes: '2026-08',
      valorPagoCent: 30000, dataPagamento: '2026-07-01',
      parcelamento: { parcelas: 1, valorParcelaCent: 60000 }, horizonte: '2027-12-31',
    });
    await useApp.getState().recarregar();
    const paga = useApp.getState().dados!.lancamentos.find((l) => l.id === fatura.id)!;
    montar(paga); // abre com o valor já pago, 300,00: sobram 600,00

    expect(screen.getByText(/Já lançado na próxima fatura/)).toHaveTextContent(/600,00/);
    expect(screen.getByRole('radio', { name: 'Não volta' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText(/somem da projeção/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
    await vi.waitFor(async () => {
      expect(await db.lancamentos.get(fatura.id)).toMatchObject({ status: 'efetivo', valor: 30000 });
    });
    expect(await db.comprasCartao.count()).toBe(2); // a original + o restante, sem duplicar
  } finally { vi.useRealTimers(); }
});
