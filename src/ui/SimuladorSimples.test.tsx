import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import SimuladorSimples from './SimuladorSimples';

beforeEach(async () => { await limparDb(); });

/** Box com 1.000,00 (100000 centavos) desde 01/09/2026, hoje 15/09/2026, sem outros
 *  lançamentos: o menor saldo "sem" é 1.000,00 em qualquer período. */
async function preparar() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-09-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-09-15' });
  return { box };
}

async function preencher(valor: string, data: string) {
  await userEvent.type(screen.getByLabelText('Valor'), valor);
  fireEvent.change(screen.getByLabelText('Quando'), { target: { value: data } });
}

/** `recarregar` troca `hoje` pela data real; sem refixar, o teste depende do dia em que roda. */
async function simular() {
  await userEvent.click(screen.getByRole('button', { name: 'Simular' }));
  await screen.findByText('Menor saldo sem a compra');
  useApp.setState({ hoje: '2026-09-15' });
}
const rascunhos = async () => (await db.cenarios.toArray()).filter((c) => c.rascunho === true);

it('Simular fica desativado sem valor ou sem data', async () => {
  await preparar();
  render(<SimuladorSimples />);
  const botao = screen.getByRole('button', { name: 'Simular' });
  expect(botao).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Valor'), '1500,00');
  expect(botao).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Quando'), { target: { value: '2026-10-15' } });
  expect(botao).toBeEnabled();
});

it('Simular fica desativado com data anterior a hoje', async () => {
  await preparar();
  render(<SimuladorSimples />);
  await preencher('1500,00', '2026-09-14');
  expect(screen.getByRole('button', { name: 'Simular' })).toBeDisabled();
});

it('uma vez: mostra o menor saldo sem e com a compra e o aviso de saldo negativo', async () => {
  await preparar();
  render(<SimuladorSimples />);
  await preencher('1500,00', '2026-10-15');
  await simular();
  // sem: 1.000,00 sempre. com: 1.000,00 - 1.500,00 = -500,00 a partir de 15/10.
  expect(await screen.findByText('Menor saldo sem a compra')).toBeInTheDocument();
  expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument();
  expect(screen.getByText('Menor saldo com a compra')).toBeInTheDocument();
  expect(screen.getByText('−R$ 500,00')).toBeInTheDocument();
  const aviso = screen.getByText('O saldo ficaria negativo em 15/10.');
  expect(aviso).toHaveClass('aviso', 'aviso-urgente');
});

it('compra que cabe no saldo: sem aviso, menor saldo com a compra positivo', async () => {
  await preparar();
  render(<SimuladorSimples />);
  await preencher('300,00', '2026-10-15');
  await simular();
  expect(await screen.findByText('R$ 700,00')).toBeInTheDocument();
  expect(screen.queryByText(/O saldo ficaria negativo/)).not.toBeInTheDocument();
});

it('parcelado: pede o número de parcelas e divide o valor', async () => {
  await preparar();
  render(<SimuladorSimples />);
  expect(screen.queryByLabelText('Parcelas')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: 'Parcelado' }));
  await preencher('1500,00', '2026-10-15');
  const parcelas = screen.getByLabelText('Parcelas');
  await userEvent.clear(parcelas);
  await userEvent.type(parcelas, '3');
  await simular();
  // 3 parcelas de 500,00 (15/10, 15/11, 15/12): 1.000,00 - 1.500,00 = -500,00 no fim.
  expect(await screen.findByText('−R$ 500,00')).toBeInTheDocument();
  const [rec] = await db.recorrencias.toArray();
  expect(rec).toMatchObject({ valor: 50000, parcelas: 3, dataInicio: '2026-10-15' });
});

it('parcelado: com menos de 2 parcelas, Simular fica desativado', async () => {
  await preparar();
  render(<SimuladorSimples />);
  await userEvent.click(screen.getByRole('radio', { name: 'Parcelado' }));
  await preencher('1500,00', '2026-10-15');
  const parcelas = screen.getByLabelText('Parcelas');
  await userEvent.clear(parcelas);
  await userEvent.type(parcelas, '1');
  expect(screen.getByRole('button', { name: 'Simular' })).toBeDisabled();
});

it('todo mês: grava recorrência sem fim e mostra o aviso', async () => {
  await preparar();
  render(<SimuladorSimples />);
  await userEvent.click(screen.getByRole('radio', { name: 'Todo mês' }));
  await preencher('1500,00', '2026-10-15');
  await simular();
  expect(await screen.findByText('O saldo ficaria negativo em 15/10.')).toBeInTheDocument();
  const [rec] = await db.recorrencias.toArray();
  expect(rec).toMatchObject({ valor: 150000, parcelas: null });
});

it('o item é um gasto na categoria "A classificar"', async () => {
  const { box } = await preparar();
  render(<SimuladorSimples />);
  await preencher('300,00', '2026-10-15');
  await simular();
  await screen.findByText('R$ 700,00');
  const [lanc] = (await db.lancamentos.toArray()).filter((l) => l.cenarioId);
  const cat = await db.categorias.get(lanc.categoriaId);
  expect(cat).toMatchObject({ nome: 'A classificar', tipo: 'gasto', boxId: box.id });
  expect(lanc).toMatchObject({ valor: 30000, status: 'previsto', data: '2026-10-15' });
});

it('existe um só cenário de simulação rápida; uma segunda simulação substitui a primeira', async () => {
  await preparar();
  render(<SimuladorSimples />);
  await preencher('1500,00', '2026-10-15');
  await simular();
  await screen.findByText('−R$ 500,00');
  expect(await rascunhos()).toHaveLength(1);
  const primeiro = (await rascunhos())[0].id;

  await userEvent.clear(screen.getByLabelText('Valor'));
  await userEvent.type(screen.getByLabelText('Valor'), '300,00');
  await simular();
  await screen.findByText('R$ 700,00');
  const depois = await rascunhos();
  expect(depois).toHaveLength(1);
  expect(depois[0].id).not.toBe(primeiro);
  // os itens do rascunho antigo também saíram: só sobra o lançamento de 300,00
  const itens = (await db.lancamentos.toArray()).filter((l) => l.cenarioId);
  expect(itens).toHaveLength(1);
  expect(itens[0].valor).toBe(30000);
});

it('ao desmontar sem Guardar, o cenário é apagado com seus itens', async () => {
  await preparar();
  const { unmount } = render(<SimuladorSimples />);
  await preencher('1500,00', '2026-10-15');
  await simular();
  await screen.findByText('−R$ 500,00');
  unmount();
  await waitFor(async () => expect(await db.cenarios.toArray()).toHaveLength(0));
  expect((await db.lancamentos.toArray()).filter((l) => l.cenarioId)).toHaveLength(0);
});

it('desmontar sem ter simulado não apaga nada', async () => {
  await preparar();
  const agora = agoraISO();
  await repo.salvarCenario({ id: novoId(), nome: 'Mudança', ligado: false, criadoEm: agora, alteradoEm: agora });
  const { unmount } = render(<SimuladorSimples />);
  unmount();
  expect(await db.cenarios.toArray()).toHaveLength(1);
});

it('Guardar renomeia para "Simulação de DD/MM" e o cenário sobrevive ao desmontar', async () => {
  await preparar();
  const { unmount } = render(<SimuladorSimples />);
  await preencher('1500,00', '2026-10-15');
  await simular();
  await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }));
  await waitFor(async () => {
    expect((await db.cenarios.toArray()).map((c) => c.nome)).toEqual(['Simulação de 15/09']);
  });
  // Guardada desligada: não muda o gráfico de Hoje e Fluxo sem aviso.
  expect((await db.cenarios.toArray()).every((c) => c.ligado === false)).toBe(true);
  expect(await screen.findByText('Guardada. Ela aparece em Simular, no modo Avançado, desligada.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  unmount();
  await new Promise((r) => setTimeout(r, 50));
  expect((await db.cenarios.toArray()).map((c) => c.nome)).toEqual(['Simulação de 15/09']);
  expect((await db.lancamentos.toArray()).filter((l) => l.cenarioId)).toHaveLength(1);
});

it('depois de Guardar, uma nova simulação não apaga a guardada', async () => {
  await preparar();
  render(<SimuladorSimples />);
  await preencher('1500,00', '2026-10-15');
  await simular();
  await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }));
  await waitFor(async () => expect((await db.cenarios.toArray())[0].nome).toBe('Simulação de 15/09'));
  await userEvent.clear(screen.getByLabelText('Valor'));
  await userEvent.type(screen.getByLabelText('Valor'), '300,00');
  await simular();
  await screen.findByText('R$ 700,00');
  const nomes = (await db.cenarios.toArray()).map((c) => c.nome).sort();
  expect(nomes).toEqual(['Simulação de 15/09', repo.NOME_SIMULACAO_RAPIDA].sort());
  // o rascunho nasce desligado e marcado; o guardado perde a marca e segue desligado
  const todos = await db.cenarios.toArray();
  const guardado = todos.find((c) => c.nome === 'Simulação de 15/09')!;
  expect(guardado.rascunho).toBeUndefined();
  expect(guardado.ligado).toBe(false);
  const rasc = todos.find((c) => c.nome === repo.NOME_SIMULACAO_RAPIDA)!;
  expect(rasc.rascunho).toBe(true);
  expect(rasc.ligado).toBe(false);
});

it('Simular desativado diz o que falta, uma frase por vez', async () => {
  await preparar();
  render(<SimuladorSimples />);
  // sem valor: nada
  expect(screen.queryByText('Escolha uma data.')).not.toBeInTheDocument();
  expect(screen.queryByText('Data anterior a hoje.')).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Valor'), '1500,00');
  expect(screen.getByText('Escolha uma data.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Quando'), { target: { value: '2026-09-14' } });
  expect(screen.getByText('Data anterior a hoje.')).toBeInTheDocument();
  expect(screen.queryByText('Escolha uma data.')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Quando'), { target: { value: '2026-10-15' } });
  expect(screen.queryByText('Data anterior a hoje.')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: 'Parcelado' }));
  const parcelas = screen.getByLabelText('Parcelas');
  await userEvent.clear(parcelas);
  await userEvent.type(parcelas, '1');
  expect(screen.getByText('Parcelado precisa de 2 parcelas ou mais.')).toBeInTheDocument();
  await userEvent.clear(parcelas);
  await userEvent.type(parcelas, '3');
  expect(screen.queryByText('Parcelado precisa de 2 parcelas ou mais.')).not.toBeInTheDocument();
});

it.each([0, 1, 5, 15, 40])('desmontar %i ms depois de Simular não deixa órfãos', async (ms) => {
  await preparar();
  const { unmount } = render(<SimuladorSimples />);
  await preencher('1500,00', '2026-10-15');
  fireEvent.click(screen.getByRole('button', { name: 'Simular' }));
  if (ms) await new Promise((r) => setTimeout(r, ms));
  unmount();
  await new Promise((r) => setTimeout(r, 400));
  expect(await db.cenarios.toArray()).toHaveLength(0);
  expect(await db.lancamentos.toArray()).toHaveLength(0);
  expect(await db.recorrencias.toArray()).toHaveLength(0);
});

it('desmontar logo depois de Guardar não apaga o cenário guardado', async () => {
  await preparar();
  const { unmount } = render(<SimuladorSimples />);
  await preencher('1500,00', '2026-10-15');
  await simular();
  fireEvent.click(await screen.findByRole('button', { name: 'Guardar' }));
  unmount();
  await new Promise((r) => setTimeout(r, 400));
  expect((await db.cenarios.toArray()).map((c) => c.nome)).toEqual(['Simulação de 15/09']);
  expect((await db.lancamentos.toArray()).filter((l) => l.cenarioId)).toHaveLength(1);
});

it('editar um campo depois de simular limpa o resultado e some o Guardar', async () => {
  await preparar();
  render(<SimuladorSimples />);
  await preencher('1500,00', '2026-10-15');
  await simular();
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  await userEvent.clear(screen.getByLabelText('Valor'));
  await userEvent.type(screen.getByLabelText('Valor'), '300,00');
  expect(screen.queryByText('Menor saldo sem a compra')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  await simular();
  fireEvent.change(screen.getByLabelText('Quando'), { target: { value: '2026-10-16' } });
  expect(screen.queryByText('Menor saldo sem a compra')).not.toBeInTheDocument();
  await simular();
  await userEvent.click(screen.getByRole('radio', { name: 'Todo mês' }));
  expect(screen.queryByText('Menor saldo sem a compra')).not.toBeInTheDocument();
});

it('no StrictMode (montar, limpar, montar) a simulação funciona e desmontar de verdade apaga o rascunho', async () => {
  await preparar();
  const { unmount } = render(<StrictMode><SimuladorSimples /></StrictMode>);
  await preencher('1500,00', '2026-10-15');
  await simular();
  expect(screen.getByText('Menor saldo com a compra')).toBeInTheDocument();
  expect(await rascunhos()).toHaveLength(1);
  unmount();
  await waitFor(async () => expect(await rascunhos()).toHaveLength(0));
});

it('o rascunho nasce com o escopo da visão e "Guardar" o mantém', async () => {
  const { box } = await preparar();
  render(<SimuladorSimples />);
  await preencher('1500,00', '2026-10-15');
  await simular();
  const [rascunho] = await rascunhos();
  expect(rascunho.escopo).toBe(box.id);
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await screen.findByText(/Guardada/);
  const guardado = (await db.cenarios.toArray()).find((c) => c.nome.startsWith('Simulação de'));
  expect(guardado?.escopo).toBe(box.id);
  expect(guardado?.rascunho).toBeUndefined();
});

it('na casa o rascunho nasce com escopo "casa"', async () => {
  await preparar();
  useApp.setState({ boxSel: 'casa' });
  render(<SimuladorSimples />);
  await preencher('1500,00', '2026-10-15');
  await simular();
  const [rascunho] = await rascunhos();
  expect(rascunho.escopo).toBe('casa');
});
