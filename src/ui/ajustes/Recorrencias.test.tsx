import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Recorrencias from './Recorrencias';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('edita o valor de uma recorrência existente e atualiza os previstos remanescentes', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'assinatura', tipo: 'gasto', ordem: 0 });
  const rec = await repo.salvarRecorrencia({
    boxId: box.id, categoriaId: cat.id, valor: 5000, dataInicio: '2026-07-01',
    diaDoMes: 5, parcelas: 3,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-02' });

  render(<Recorrencias />);
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const valorInput = screen.getByLabelText('Valor');
  await userEvent.clear(valorInput);
  await userEvent.type(valorInput, '75,00');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText('R$ 75,00')).toBeInTheDocument();
  const atualizada = await db.recorrencias.get(rec.id);
  expect(atualizada?.id).toBe(rec.id);
  expect(atualizada?.valor).toBe(7500);

  const previstos = await db.lancamentos.where('recorrenciaId').equals(rec.id)
    .filter((l) => l.status === 'previsto').toArray();
  expect(previstos.length).toBeGreaterThan(0);
  expect(previstos.every((l) => l.valor === 7500)).toBe(true);
});

it('categoria da fatura de um cartão não aparece no grid de categoria da recorrência', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'assinatura', tipo: 'gasto', ordem: 0 });
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-02' });

  render(<Recorrencias />);

  expect(screen.getByRole('button', { name: 'assinatura' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Nubank/ })).not.toBeInTheDocument();
});

it('trocar de box na tela de Recorrências mostra só as recorrências e categorias daquela box', async () => {
  const agora = agoraISO();
  const eitor = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  const conjunta = { id: novoId(), nome: 'conjunta', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(eitor);
  await repo.salvarBox(conjunta);
  const catEitor = await repo.salvarCategoria({ boxId: eitor.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
  const catConjunta = await repo.salvarCategoria({ boxId: conjunta.id, nome: 'contas da casa', tipo: 'gasto', ordem: 0 });
  await repo.salvarRecorrencia(
    { boxId: eitor.id, categoriaId: catEitor.id, valor: 180000, dataInicio: '2026-07-01', diaDoMes: 5, parcelas: null },
    '2027-12-31',
  );
  await repo.salvarRecorrencia(
    { boxId: conjunta.id, categoriaId: catConjunta.id, valor: 45000, dataInicio: '2026-07-01', diaDoMes: 10, parcelas: null },
    '2027-12-31',
  );
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-02' });

  render(<Recorrencias />);
  expect(screen.getByText('aluguel', { selector: 'div' })).toBeInTheDocument();
  expect(screen.queryByText('contas da casa', { selector: 'div' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'aluguel' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'contas da casa' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'conjunta' }));

  expect(screen.getByText('contas da casa', { selector: 'div' })).toBeInTheDocument();
  expect(screen.queryByText('aluguel', { selector: 'div' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'contas da casa' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'aluguel' })).not.toBeInTheDocument();
});
