import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import FormItemCenario, { gravarItemNovo, type ValoresItem } from './FormItemCenario';

beforeEach(async () => { await limparDb(); });

async function preparar() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-09-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const casa = await repo.salvarCategoria({ boxId: box.id, nome: 'Casa', tipo: 'gasto', ordem: 0 });
  const extra = await repo.salvarCategoria({ boxId: box.id, nome: 'Extra', tipo: 'ganho', ordem: 1 });
  const cenario = { id: novoId(), nome: 'Mudança', ligado: true, criadoEm: agora, alteradoEm: agora };
  await repo.salvarCenario(cenario);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-09-15' });
  return { box, casa, extra, cenario };
}

const vazio = (data = '2026-09-15'): ValoresItem =>
  ({ valor: 0, descricao: '', tipo: 'gasto', categoriaId: null, repeticao: 'unica', data, parcelas: 2 });

it('Adicionar fica desativado sem valor ou sem categoria', async () => {
  const { box } = await preparar();
  render(<FormItemCenario boxId={box.id} inicial={vazio()} rotuloBotao="Adicionar ao cenário" onSalvar={async () => {}} />);
  const botao = screen.getByRole('button', { name: 'Adicionar ao cenário' });
  expect(botao).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Valor'), '300,00');
  expect(botao).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Casa' }));
  expect(botao).toBeEnabled();
});

it('Parcelado exige 2 parcelas ou mais e mostra o valor da parcela', async () => {
  const { box } = await preparar();
  render(<FormItemCenario boxId={box.id} inicial={vazio()} rotuloBotao="Adicionar ao cenário" onSalvar={async () => {}} />);
  await userEvent.type(screen.getByLabelText('Valor'), '1000,00');
  await userEvent.click(screen.getByRole('button', { name: 'Casa' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Parcelado' }));
  const parcelas = screen.getByLabelText('Parcelas');
  await userEvent.clear(parcelas);
  await userEvent.type(parcelas, '1');
  expect(screen.getByRole('button', { name: 'Adicionar ao cenário' })).toBeDisabled();
  await userEvent.clear(parcelas);
  await userEvent.type(parcelas, '4');
  expect(screen.getByRole('button', { name: 'Adicionar ao cenário' })).toBeEnabled();
  // 100000 / 4 = 25000 centavos
  expect(screen.getByText(/cada parcela sai por R\$\s*250,00/)).toBeInTheDocument();
});

it('Todo mês mostra a dica de lançar só a diferença', async () => {
  const { box } = await preparar();
  render(<FormItemCenario boxId={box.id} inicial={vazio()} rotuloBotao="Adicionar ao cenário" onSalvar={async () => {}} />);
  await userEvent.click(screen.getByRole('radio', { name: 'Todo mês' }));
  expect(screen.getByText(/lance só a diferença/)).toBeInTheDocument();
});

it('trocar para Ganho mostra só categorias de ganho', async () => {
  const { box } = await preparar();
  render(<FormItemCenario boxId={box.id} inicial={vazio()} rotuloBotao="Adicionar ao cenário" onSalvar={async () => {}} />);
  await userEvent.click(screen.getByRole('radio', { name: 'Ganho' }));
  expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Casa' })).not.toBeInTheDocument();
});

it('onSalvar recebe os valores digitados', async () => {
  const { box } = await preparar();
  let recebido: ValoresItem | null = null;
  render(<FormItemCenario boxId={box.id} inicial={vazio()} rotuloBotao="Adicionar ao cenário" onSalvar={async (v) => { recebido = v; }} />);
  await userEvent.type(screen.getByLabelText('Valor'), '300,00');
  await userEvent.type(screen.getByLabelText('Descrição'), 'Geladeira');
  await userEvent.click(screen.getByRole('button', { name: 'Casa' }));
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-12-05' } });
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar ao cenário' }));
  expect(recebido).toMatchObject({ valor: 30000, descricao: 'Geladeira', repeticao: 'unica', data: '2026-12-05' });
});

describe('gravarItemNovo', () => {
  it('uma vez vira lançamento previsto do cenário, com a descrição na nota', async () => {
    const { box, casa, cenario } = await preparar();
    await gravarItemNovo(cenario.id, box.id, { ...vazio('2026-12-05'), valor: 30000, categoriaId: casa.id, descricao: 'Geladeira' }, '2027-12-31');
    const [l] = await db.lancamentos.where('cenarioId').equals(cenario.id).toArray();
    expect(l).toMatchObject({ valor: 30000, status: 'previsto', nota: 'Geladeira', data: '2026-12-05' });
    expect(l.recorrenciaId).toBeUndefined();
  });
  it('parcelado vira recorrência com a parcela arredondada e N parcelas', async () => {
    const { box, casa, cenario } = await preparar();
    await gravarItemNovo(cenario.id, box.id, { ...vazio('2026-10-10'), valor: 100000, categoriaId: casa.id, repeticao: 'parcelado', parcelas: 3 }, '2027-12-31');
    const [r] = (await db.recorrencias.toArray()).filter((x) => x.cenarioId === cenario.id);
    // 100000 / 3 = 33333,33 → 33333
    expect(r).toMatchObject({ valor: 33333, parcelas: 3, dataInicio: '2026-10-10', diaDoMes: 10 });
  });
  it('todo mês vira recorrência sem fim', async () => {
    const { box, casa, cenario } = await preparar();
    await gravarItemNovo(cenario.id, box.id, { ...vazio('2026-10-10'), valor: 40000, categoriaId: casa.id, repeticao: 'mensal' }, '2027-12-31');
    const [r] = (await db.recorrencias.toArray()).filter((x) => x.cenarioId === cenario.id);
    expect(r).toMatchObject({ valor: 40000, parcelas: null });
  });
});
