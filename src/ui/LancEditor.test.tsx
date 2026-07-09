import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import LancEditor from './LancEditor';

beforeEach(async () => {
  await db.delete();
  await db.open();
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
  await userEvent.clear(campoValor);
  await userEvent.type(campoValor, '73,45');
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
    await userEvent.clear(campoValor);
    await userEvent.type(campoValor, '73,45');
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

  expect(screen.getByRole('option', { name: /mercado/ })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /Nubank/ })).not.toBeInTheDocument();
});
