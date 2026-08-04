import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { formatarBRL } from '../domain/money';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaHoje from './TelaHoje';

beforeEach(async () => {
  await limparDb();
  useApp.setState({ aba: 'hoje', ajustesSecao: null });
});

it('mostra saldo e confirma um pendente', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 550000, status: 'previsto' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent?.replace(/ /g, ' ') === 'R$ 1.000,00')).toBeInTheDocument(); // saldo efetivo
  expect(screen.getByText(/salario/)).toBeInTheDocument();     // pendente na fila

  await userEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
  await screen.findByText('Nada a confirmar — tudo em dia.'); // aguarda o recarregar() do clique terminar
  const lanc = (await db.lancamentos.toArray())[0];
  expect(lanc.status).toBe('efetivo');
});

it('declara saldo real maior que o saldo do app e mostra que falta inserir', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  await userEvent.type(screen.getByLabelText('Saldo real no banco'), '1050,00');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText(/falta inserir/)).toBeInTheDocument();
  expect(screen.getByText(/R\$\s*50,00/)).toBeInTheDocument();
  const salva = await db.boxes.get(box.id);
  expect(salva?.saldoDeclaradoCent).toBe(105000);
});

it('declara saldo real negativo (cheque especial) e persiste com o sinal', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  await userEvent.type(screen.getByLabelText('Saldo real no banco'), '5000');
  const toggleBtn = screen.getByRole('button', { name: 'Alternar sinal (positivo/negativo)' });
  await userEvent.click(toggleBtn);
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText(/sobra no app/)).toBeInTheDocument();
  const salva = await db.boxes.get(box.id);
  expect(salva?.saldoDeclaradoCent).toBe(-5000);
});

it('declara saldo real igual ao saldo do app e mostra que bate certinho', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  await userEvent.type(screen.getByLabelText('Saldo real no banco'), '1000,00');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText(/bate certinho/i)).toBeInTheDocument();
});

it('troca de box reseta o campo de saldo real para o valor daquela box', async () => {
  const agora = agoraISO();
  const boxA = { id: novoId(), nome: 'a', saldoInicial: 100000, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora };
  const boxB = { id: novoId(), nome: 'b', saldoInicial: 0, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(boxA);
  await repo.salvarBox(boxB);
  await repo.salvarCategoria({ boxId: boxA.id, nome: 'cat1', tipo: 'ganho', ordem: 0 });
  await repo.salvarCategoria({ boxId: boxB.id, nome: 'cat2', tipo: 'ganho', ordem: 0 });
  await repo.salvarBox({ ...boxA, saldoDeclaradoCent: 105000, dataSaldoDeclarado: '2026-07-02' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: boxA.id, hoje: '2026-07-02' });

  const { rerender } = render(<TelaHoje />);
  const saldoInput = screen.getByLabelText('Saldo real no banco') as HTMLInputElement;
  expect(saldoInput.value).toMatch(/1\.050,00/);

  act(() => useApp.setState({ boxSel: boxB.id }));
  rerender(<TelaHoje />);
  expect((screen.getByLabelText('Saldo real no banco') as HTMLInputElement).value).toMatch(/0,00/);
});

it('com banco vazio, a Hoje mostra o cartão de primeiro uso e não mostra o saldo grande', async () => {
  await useApp.getState().iniciar();

  render(<TelaHoje />);
  expect(screen.getByText('Primeira vez por aqui?')).toBeInTheDocument();
  expect(screen.queryByText(/Saldo hoje/)).not.toBeInTheDocument();
});

it('com box com saldo próprio e ao menos uma categoria, mostra o saldo e não o cartão de primeiro uso', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  expect(screen.getByText(/Saldo hoje/)).toBeInTheDocument();
  expect(screen.queryByText('Primeira vez por aqui?')).not.toBeInTheDocument();
});

it('clicar no aviso de backup atrasado abre a subtela de backup', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();

  // Marca que há mudanças desde o último backup, e o último backup foi há mais de 7 dias
  await repo.salvarConfig({
    mudancasDesdeBackup: true,
    ultimoBackupEm: '2026-07-01T00:00:00Z', // 25 dias atrás (hoje é 26/07)
  });
  await useApp.getState().recarregar();

  useApp.setState({ boxSel: box.id, aba: 'hoje', ajustesSecao: null });
  render(<TelaHoje />);

  expect(screen.getByText(/Há mudanças sem backup/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /Há mudanças sem backup/ }));

  const estado = useApp.getState();
  expect(estado.aba).toBe('ajustes');
  expect(estado.ajustesSecao).toBe('backup');
});

describe('fatura pendente na fila', () => {
  /** Cartão com a fatura de 08/2026 (R$ 900,00) já vencida, esperando na fila. */
  async function comFaturaVencida() {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
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
    useApp.setState({ boxSel: box.id, hoje: '2026-08-05' }); // dia do vencimento
    return { box, cartao };
  }

  it('oferece "Paguei outro valor" no lugar de "Descartar"', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      await comFaturaVencida();

      render(<TelaHoje />);
      expect(screen.getByRole('button', { name: /Paguei outro valor/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it('pendente que não é fatura continua com "Descartar"', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
    await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 50000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

    render(<TelaHoje />);
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Paguei outro valor/ })).not.toBeInTheDocument();
  });

  it('descartar pede confirmação: cancelar mantém o pendente na fila', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
    const previsto = await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 50000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<TelaHoje />);

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(confirmSpy).toHaveBeenCalledWith('Descartar este previsto?');
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
    expect(await db.lancamentos.get(previsto.id)).toBeDefined();
    confirmSpy.mockRestore();
  });

  it('descartar pede confirmação: confirmar remove o pendente da fila', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
    const previsto = await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 50000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TelaHoje />);

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(confirmSpy).toHaveBeenCalledWith('Descartar este previsto?');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument();
    });
    expect(await db.lancamentos.get(previsto.id)).toBeUndefined();
    confirmSpy.mockRestore();
  });

  it('o botão abre a folha de pagamento já com o total da fatura', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      await comFaturaVencida();

      render(<TelaHoje />);
      await userEvent.click(screen.getByRole('button', { name: /Paguei outro valor/ }));

      expect(await screen.findByRole('dialog', { name: 'Pagamento da fatura' })).toBeInTheDocument();
      expect(screen.getByLabelText('Quanto você pagou')).toHaveValue(formatarBRL(90000));
    } finally { vi.useRealTimers(); }
  });
});
