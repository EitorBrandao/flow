import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { formatarBRL } from '../domain/money';
import { itensDoCenario } from '../domain/simulacao';
import { useApp } from '../state/store';
import { gravarItemNovo } from './FormItemCenario';
import ItemCenarioSheet from './ItemCenarioSheet';

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

async function prepararComItens() {
  const { box, casa, extra, cenario } = await preparar();
  await gravarItemNovo(cenario.id, box.id, {
    valor: 30000, descricao: 'Geladeira', tipo: 'gasto', categoriaId: casa.id,
    repeticao: 'unica', data: '2026-10-05', parcelas: 2,
  }, '2027-12-31');
  await gravarItemNovo(cenario.id, box.id, {
    valor: 100000, descricao: 'Móveis', tipo: 'gasto', categoriaId: casa.id,
    repeticao: 'parcelado', data: '2026-10-05', parcelas: 4,
  }, '2027-12-31');
  await useApp.getState().recarregar();
  const itens = itensDoCenario(useApp.getState().dados!, cenario.id);
  const itemUnica = itens.find((i) => i.repeticao === 'unica')!;
  const itemParcelado = itens.find((i) => i.repeticao === 'parcelado')!;
  return { box, casa, extra, cenario, itemUnica, itemParcelado };
}

it('editar o item "uma vez": mostra os valores atuais e salva a mudança na descrição', async () => {
  const { itemUnica } = await prepararComItens();
  const onFechar = vi.fn();
  render(<ItemCenarioSheet item={itemUnica} onFechar={onFechar} />);

  expect((screen.getByLabelText('Valor') as HTMLInputElement).value).toBe(formatarBRL(30000));
  expect((screen.getByLabelText('Descrição') as HTMLInputElement).value).toBe('Geladeira');

  await userEvent.clear(screen.getByLabelText('Descrição'));
  await userEvent.type(screen.getByLabelText('Descrição'), 'Fogão');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => expect(onFechar).toHaveBeenCalled());
  const l = await db.lancamentos.get(itemUnica.id);
  expect(l).toMatchObject({ nota: 'Fogão' });
});

it('editar o parcelado: mostra o valor total, sem seletor de repetição, e recalcula a parcela', async () => {
  const { itemParcelado } = await prepararComItens();
  const onFechar = vi.fn();
  render(<ItemCenarioSheet item={itemParcelado} onFechar={onFechar} />);

  // 25000 × 4 = 100000
  expect((screen.getByLabelText('Valor') as HTMLInputElement).value).toBe(formatarBRL(100000));
  expect(screen.queryByRole('radio', { name: 'Uma vez' })).not.toBeInTheDocument();

  const parcelas = screen.getByLabelText('Parcelas');
  await userEvent.clear(parcelas);
  await userEvent.type(parcelas, '5');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => expect(onFechar).toHaveBeenCalled());
  const r = await db.recorrencias.get(itemParcelado.id);
  // 100000 / 5 = 20000
  expect(r).toMatchObject({ parcelas: 5, valor: 20000 });
});

it('item "uma vez" com valor negativo (estorno legado): abre com a magnitude e reaplica o sinal ao salvar', async () => {
  const { box, casa, cenario } = await preparar();
  const lanc = await repo.salvarLancamento({
    boxId: box.id, categoriaId: casa.id, data: '2026-10-05', valor: -30000, status: 'previsto', cenarioId: cenario.id, nota: 'Reembolso',
  });
  await useApp.getState().recarregar();
  const item = itensDoCenario(useApp.getState().dados!, cenario.id).find((i) => i.repeticao === 'unica')!;
  const onFechar = vi.fn();
  render(<ItemCenarioSheet item={item} onFechar={onFechar} />);

  // abre com a magnitude, não com o valor negativo
  expect((screen.getByLabelText('Valor') as HTMLInputElement).value).toBe(formatarBRL(30000));

  await userEvent.clear(screen.getByLabelText('Descrição'));
  await userEvent.type(screen.getByLabelText('Descrição'), 'Reembolso ajustado');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => expect(onFechar).toHaveBeenCalled());
  const l = await db.lancamentos.get(lanc.id);
  expect(l).toMatchObject({ valor: -30000, nota: 'Reembolso ajustado' }); // sinal preservado
});

it('item parcelado com valor negativo (estorno legado): abre com a magnitude total e reaplica o sinal por parcela ao salvar', async () => {
  const { box, casa, cenario } = await preparar();
  const rec = await repo.salvarRecorrencia({
    boxId: box.id, categoriaId: casa.id, valor: -25000, dataInicio: '2026-10-05', diaDoMes: 5, parcelas: 4, cenarioId: cenario.id,
  }, '2027-12-31');
  await useApp.getState().recarregar();
  const item = itensDoCenario(useApp.getState().dados!, cenario.id).find((i) => i.repeticao === 'parcelado')!;
  const onFechar = vi.fn();
  render(<ItemCenarioSheet item={item} onFechar={onFechar} />);

  // 25000 × 4 = 100000, sem sinal
  expect((screen.getByLabelText('Valor') as HTMLInputElement).value).toBe(formatarBRL(100000));

  const parcelas = screen.getByLabelText('Parcelas');
  await userEvent.clear(parcelas);
  await userEvent.type(parcelas, '5');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => expect(onFechar).toHaveBeenCalled());
  const r = await db.recorrencias.get(rec.id);
  // 100000 / 5 = 20000, sinal negativo de volta
  expect(r).toMatchObject({ parcelas: 5, valor: -20000 });
});

it('editar um parcelado de cenário para começar hoje mantém as N parcelas, hoje inclusive', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-09-15T12:00:00'));
    const { itemParcelado } = await prepararComItens();
    // itemParcelado nasceu com dataInicio '2026-10-05', hoje agora é '2026-09-15': mudar
    // a data para hoje exercita o caminho de materializar o passado (ver recorrência de
    // cenário em `src/domain/recurrence.ts`/`src/db/repo.ts`).
    const onFechar = vi.fn();
    render(<ItemCenarioSheet item={itemParcelado} onFechar={onFechar} />);

    await userEvent.clear(screen.getByLabelText('A partir de'));
    await userEvent.type(screen.getByLabelText('A partir de'), '2026-09-15');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onFechar).toHaveBeenCalled());
    const r = await db.recorrencias.get(itemParcelado.id);
    expect(r).toMatchObject({ dataInicio: '2026-09-15', parcelas: 4 });
    const materializados = await db.lancamentos.where('recorrenciaId').equals(itemParcelado.id).toArray();
    expect(materializados).toHaveLength(4);
    expect(materializados.map((l) => l.data).sort()).toEqual([
      '2026-09-15', '2026-10-15', '2026-11-15', '2026-12-15',
    ]);
  } finally {
    vi.useRealTimers();
  }
});

it('excluir: com confirmação, remove o item do banco e fecha a sheet', async () => {
  const { itemUnica } = await prepararComItens();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const onFechar = vi.fn();
  render(<ItemCenarioSheet item={itemUnica} onFechar={onFechar} />);

  await userEvent.click(screen.getByRole('button', { name: 'Excluir item' }));

  await waitFor(() => expect(onFechar).toHaveBeenCalled());
  const restante = await db.lancamentos.get(itemUnica.id);
  expect(restante).toBeUndefined();
});
