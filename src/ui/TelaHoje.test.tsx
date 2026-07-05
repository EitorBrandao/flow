import 'fake-indexeddb/auto';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaHoje from './TelaHoje';

beforeEach(async () => {
  await db.delete();
  await db.open();
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
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  await userEvent.type(screen.getByLabelText('Saldo real no banco'), '-50,00');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText(/sobra no app/)).toBeInTheDocument();
  const salva = await db.boxes.get(box.id);
  expect(salva?.saldoDeclaradoCent).toBe(-5000);
});

it('declara saldo real igual ao saldo do app e mostra que bate certinho', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
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
  await repo.salvarBox({ ...boxA, saldoDeclaradoCent: 105000, dataSaldoDeclarado: '2026-07-02' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: boxA.id, hoje: '2026-07-02' });

  const { rerender } = render(<TelaHoje />);
  expect(screen.getByLabelText('Saldo real no banco')).toHaveValue('1050,00');

  act(() => useApp.setState({ boxSel: boxB.id }));
  rerender(<TelaHoje />);
  expect(screen.getByLabelText('Saldo real no banco')).toHaveValue('');
});
