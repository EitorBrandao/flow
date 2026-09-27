import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import LancEditor from './LancEditor';

beforeEach(async () => {
  await limparDb();
});

it('confirma um pendente com valor editado: persiste o novo valor e status efetivo juntos', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const categoria = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  const previsto = await repo.salvarLancamento({
    boxId: box.id, categoriaId: categoria.id, data: '2026-07-05', valor: 5000, status: 'previsto',
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<LancEditor lanc={previsto} onFechar={() => {}} />);
  const campoValor = screen.getByLabelText('Valor');
  await userEvent.click(campoValor);
  await userEvent.type(campoValor, '7345');
  await userEvent.click(screen.getByRole('button', { name: '✓ Confirmar' }));

  // espera a cadeia async completa (persistência + recarregar) assentar antes de checar,
  // evitando promises pendentes vazando para o próximo teste.
  await waitFor(async () => {
    expect(await db.lancamentos.get(previsto.id)).toMatchObject({ valor: 7345, status: 'efetivo' });
  });
});

it('previsto vinculado a recorrência: sem botão Salvar, mostra dica, e Confirmar ainda aplica o valor editado', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const categoria = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
    await repo.salvarRecorrencia(
      { boxId: box.id, categoriaId: categoria.id, valor: 5000, dataInicio: '2026-08-05', diaDoMes: 5, parcelas: 1 },
      '2026-12-31',
    );
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
    const previsto = useApp.getState().dados!.lancamentos.find((l) => l.recorrenciaId != null)!;

    render(<LancEditor lanc={previsto} onFechar={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
    expect(screen.getByText(/edite a regra em Ajustes/i)).toBeInTheDocument();

    const campoValor = screen.getByLabelText('Valor');
    await userEvent.click(campoValor);
    await userEvent.type(campoValor, '7345');
    await userEvent.click(screen.getByRole('button', { name: '✓ Confirmar' }));

    // espera a cadeia async completa (persistência + recarregar) assentar antes de checar,
    // evitando promises pendentes vazando para o próximo teste.
    await waitFor(async () => {
      expect(await db.lancamentos.get(previsto.id)).toMatchObject({ valor: 7345, status: 'efetivo' });
    });
  } finally {
    vi.useRealTimers();
  }
});

it('categoria da fatura de um cartão não aparece no select de categoria do editor', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const categoria = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  const lanc = await repo.salvarLancamento({
    boxId: box.id, categoriaId: categoria.id, data: '2026-07-05', valor: 5000, status: 'efetivo',
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<LancEditor lanc={lanc} onFechar={() => {}} />);

  expect(screen.getByRole('button', { name: 'mercado' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Nubank/ })).not.toBeInTheDocument();
});

it('excluir pede confirmação: cancelar mantém o lançamento', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const categoria = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const lanc = await repo.salvarLancamento({
    boxId: box.id, categoriaId: categoria.id, data: '2026-07-05', valor: 5000, status: 'efetivo',
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const onFechar = vi.fn();
  render(<LancEditor lanc={lanc} onFechar={onFechar} />);

  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

  expect(confirmSpy).toHaveBeenCalledWith('Excluir este lançamento?');
  expect(onFechar).not.toHaveBeenCalled();
  expect(await db.lancamentos.get(lanc.id)).toBeDefined();
  confirmSpy.mockRestore();
});

it('excluir pede confirmação: confirmar apaga o lançamento', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const categoria = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const previsto = await repo.salvarLancamento({
    boxId: box.id, categoriaId: categoria.id, data: '2026-07-05', valor: 5000, status: 'previsto',
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const onFechar = vi.fn();
  render(<LancEditor lanc={previsto} onFechar={onFechar} />);

  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

  expect(confirmSpy).toHaveBeenCalledWith('Excluir este previsto?');
  await waitFor(() => {
    expect(onFechar).toHaveBeenCalledOnce();
  });
  expect(await db.lancamentos.get(previsto.id)).toBeUndefined();
  confirmSpy.mockRestore();
});

it('lançamento de cenário "uma vez": sem botão Confirmar, com Salvar e Excluir, e dica diz que não pode ser confirmado', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const categoria = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const cenarioId = novoId();
  await repo.salvarCenario({ id: cenarioId, nome: 'e se', ligado: true, criadoEm: agora, alteradoEm: agora });
  const previstoDeCenario = await repo.salvarLancamento({
    boxId: box.id, categoriaId: categoria.id, data: '2026-07-05', valor: 5000, status: 'previsto', cenarioId,
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<LancEditor lanc={previstoDeCenario} onFechar={() => {}} />);

  expect(screen.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
  // campos continuam editáveis: Salvar funciona neste caso
  expect(screen.getByLabelText('Valor')).toBeInTheDocument();
  expect(screen.getByText(/não pode ser confirmado/)).toBeInTheDocument();
  expect(screen.getByText(/use Tornar real, em Fluxo › Simular/)).toBeInTheDocument();
});

it('parcela de recorrência de cenário: sem Confirmar, sem Salvar, sem Excluir — só a dica, os dados em texto e Fechar', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const categoria = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
    const cenarioId = novoId();
    await repo.salvarCenario({ id: cenarioId, nome: 'e se', ligado: true, criadoEm: agora, alteradoEm: agora });
    await repo.salvarRecorrencia(
      { boxId: box.id, categoriaId: categoria.id, valor: 5000, dataInicio: '2026-08-05', diaDoMes: 5, parcelas: 2, cenarioId, nota: 'Aluguel novo' },
      '2026-12-31',
    );
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
    // duas parcelas materializam (08-05 e 09-05): pega a primeira pela data, não por
    // ordem arbitrária de array — `.find(recorrenciaId != null)` sozinho não garante qual.
    const previstoDeCenario = useApp.getState().dados!.lancamentos.find((l) => l.data === '2026-08-05')!;

    render(<LancEditor lanc={previstoDeCenario} onFechar={() => {}} />);

    expect(screen.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    expect(screen.getByText(/para mudar ou excluir, use Fluxo › Simular/)).toBeInTheDocument();

    // sem campos editáveis: nada aqui seria salvo
    expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Data')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nota')).not.toBeInTheDocument();
    // dados aparecem em texto
    expect(screen.getByText('R$ 50,00')).toBeInTheDocument();
    expect(screen.getByText('05/08/2026')).toBeInTheDocument();
    expect(screen.getByText('mercado')).toBeInTheDocument();
    expect(screen.getByText('Aluguel novo')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
