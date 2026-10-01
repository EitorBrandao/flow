import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaLancar from './TelaLancar';

beforeEach(async () => {
  await limparDb();
});

async function prepararSimples(opcoes: { duasBoxes?: boolean; semPadrao?: boolean } = {}) {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  let outra = null;
  if (opcoes.duasBoxes) {
    outra = { id: novoId(), nome: 'maria', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(outra);
  }
  if (!opcoes.semPadrao) await repo.salvarConfig({ boxPadraoId: box.id });
  const mercado = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await repo.salvarModo('lancar', 'simples');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
  return { box, outra, mercado };
}

describe('Lançar no modo Simples', () => {
  it('mostra só valor, Gasto/Ganho, descrição e Lançar', async () => {
    await prepararSimples();
    render(<TelaLancar />);
    expect(screen.getByLabelText('Valor')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Gasto' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Ganho' })).toBeInTheDocument();
    expect(screen.getByLabelText('Do que foi? (opcional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lançar' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Data')).toBeNull();
    expect(screen.queryByLabelText(/Nota/)).toBeNull();
    expect(screen.queryByLabelText(/Marcar como previsto/)).toBeNull();
    expect(screen.queryByText('Banco')).toBeNull();
    expect(screen.queryByRole('button', { name: 'mercado' })).toBeNull();
    expect(screen.queryByLabelText(/Viagem/)).toBeNull();
  });

  it('usa a categoria do lançamento anterior com a mesma descrição', async () => {
    const { box, mercado } = await prepararSimples();
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco A', ordem: 0 });
    await repo.salvarLancamento({
      boxId: box.id, categoriaId: mercado.id, data: '2026-06-01', valor: 1000, nota: 'Mercado', status: 'efetivo',
    });
    await useApp.getState().recarregar();
    useApp.setState({ hoje: '2026-07-02' });
    render(<TelaLancar />);
    await userEvent.type(screen.getByLabelText('Valor'), '48,00');
    await userEvent.type(screen.getByLabelText('Do que foi? (opcional)'), 'mercado');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    const lancs = (await db.lancamentos.toArray()).filter((l) => l.valor === 4800);
    expect(lancs).toHaveLength(1);
    expect(lancs[0]).toMatchObject({
      categoriaId: mercado.id, data: '2026-07-02', status: 'efetivo', origem: 'manual',
      nota: 'mercado', bancoId: banco.id, boxId: box.id,
    });
  });

  it('chip dos Frequentes com categoria: o lançamento grava essa categoria', async () => {
    const { box, mercado } = await prepararSimples();
    const padaria = await repo.salvarCategoria({ boxId: box.id, nome: 'padaria', tipo: 'gasto', ordem: 1 });
    // a descrição aponta para "mercado", mas a escolha do chip (padaria) vale mais
    await repo.salvarLancamento({
      boxId: box.id, categoriaId: mercado.id, data: '2026-06-01', valor: 1000, nota: 'pão', status: 'efetivo',
    });
    await useApp.getState().recarregar();
    useApp.setState({ hoje: '2026-07-02' });
    render(<TelaLancar />);
    act(() => useApp.setState({ rascunhoLancar: { categoriaId: padaria.id, valorCent: 850 } }));
    await screen.findByDisplayValue('R$ 8,50');
    await userEvent.type(screen.getByLabelText('Do que foi? (opcional)'), 'pão');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    const novo = (await db.lancamentos.toArray()).find((l) => l.valor === 850)!;
    expect(novo.categoriaId).toBe(padaria.id);
  });

  it('depois de lançar com chip, o lançamento seguinte sem chip volta à regra da descrição', async () => {
    const { box, mercado } = await prepararSimples();
    const padaria = await repo.salvarCategoria({ boxId: box.id, nome: 'padaria', tipo: 'gasto', ordem: 1 });
    await repo.salvarLancamento({
      boxId: box.id, categoriaId: mercado.id, data: '2026-06-01', valor: 1000, nota: 'pão', status: 'efetivo',
    });
    await useApp.getState().recarregar();
    useApp.setState({ hoje: '2026-07-02' });
    render(<TelaLancar />);
    act(() => useApp.setState({ rascunhoLancar: { categoriaId: padaria.id, valorCent: 850 } }));
    await screen.findByDisplayValue('R$ 8,50');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    await screen.findByText(/Lançado/);
    await userEvent.type(screen.getByLabelText('Valor'), '9,00');
    await userEvent.type(screen.getByLabelText('Do que foi? (opcional)'), 'pão');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    await vi.waitFor(async () => expect((await db.lancamentos.toArray()).some((l) => l.valor === 900)).toBe(true));
    expect((await db.lancamentos.toArray()).find((l) => l.valor === 900)!.categoriaId).toBe(mercado.id);
  });

  it('com viagem ativa na data, o lançamento grava o viagemId; sem viagem, não grava', async () => {
    const { box } = await prepararSimples();
    const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
    await useApp.getState().recarregar();
    useApp.setState({ hoje: '2026-07-02' });
    render(<TelaLancar />);
    await userEvent.type(screen.getByLabelText('Valor'), '10,00');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    await screen.findByText(/Lançado/);
    expect((await db.lancamentos.toArray()).find((l) => l.valor === 1000)).toMatchObject({ boxId: box.id, viagemId: viagem.id });
    // fora do período da viagem
    useApp.setState({ hoje: '2026-08-02' });
    await userEvent.type(screen.getByLabelText('Valor'), '11,00');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    await vi.waitFor(async () => expect((await db.lancamentos.toArray()).some((l) => l.valor === 1100)).toBe(true));
    expect((await db.lancamentos.toArray()).find((l) => l.valor === 1100)!.viagemId).toBeUndefined();
  });

  it('descrição sem correspondência ou vazia cai em "A classificar", uma só categoria', async () => {
    const { box } = await prepararSimples();
    render(<TelaLancar />);
    await userEvent.type(screen.getByLabelText('Valor'), '10,00');
    await userEvent.type(screen.getByLabelText('Do que foi? (opcional)'), 'coisa nova');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Valor'), '20,00');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    await vi.waitFor(async () => expect(await db.lancamentos.count()).toBe(2));
    const aClassificar = (await db.categorias.toArray()).filter((c) => c.boxId === box.id && c.nome === 'A classificar');
    expect(aClassificar).toHaveLength(1);
    const lancs = await db.lancamentos.toArray();
    expect(lancs.every((l) => l.categoriaId === aClassificar[0].id)).toBe(true);
    expect(lancs.find((l) => l.valor === 2000)!.nota).toBeUndefined();
  });

  it('Ganho usa "A classificar" do tipo ganho', async () => {
    const { box } = await prepararSimples();
    render(<TelaLancar />);
    await userEvent.click(screen.getByRole('radio', { name: 'Ganho' }));
    await userEvent.type(screen.getByLabelText('Valor'), '30,00');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    const cat = (await db.categorias.toArray()).find((c) => c.boxId === box.id && c.nome === 'A classificar (entrada)');
    expect(cat!.tipo).toBe('ganho');
  });

  it('duplo clique rápido grava um único lançamento', async () => {
    await prepararSimples();
    render(<TelaLancar />);
    await userEvent.type(screen.getByLabelText('Valor'), '5,00');
    const botao = screen.getByRole('button', { name: 'Lançar' });
    await act(async () => { botao.click(); botao.click(); });
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    expect(await db.lancamentos.count()).toBe(1);
  });

  it('usa a box padrão mesmo com outra box selecionada, sem seletor de Box', async () => {
    const { box, outra } = await prepararSimples({ duasBoxes: true });
    useApp.setState({ boxSel: outra!.id });
    render(<TelaLancar />);
    expect(screen.queryByLabelText('Box')).toBeNull();
    await userEvent.type(screen.getByLabelText('Valor'), '7,00');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    expect((await db.lancamentos.toArray())[0].boxId).toBe(box.id);
  });

  it('sem box padrão e com mais de uma box, mostra o seletor de Box uma vez', async () => {
    const { outra } = await prepararSimples({ duasBoxes: true, semPadrao: true });
    render(<TelaLancar />);
    expect(screen.getAllByLabelText('Box')).toHaveLength(1);
    await userEvent.selectOptions(screen.getByLabelText('Box'), outra!.id);
    await userEvent.type(screen.getByLabelText('Valor'), '9,00');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    expect((await db.lancamentos.toArray())[0].boxId).toBe(outra!.id);
  });

  it('padrão apontando para box inexistente, com uma só box própria, grava nela', async () => {
    const { box } = await prepararSimples({ semPadrao: true });
    await repo.salvarConfig({ boxPadraoId: novoId() });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: 'casa', hoje: '2026-07-02' });
    render(<TelaLancar />);
    await userEvent.type(screen.getByLabelText('Valor'), '4,00');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    expect((await db.lancamentos.toArray())[0].boxId).toBe(box.id);
  });

  it('sem padrão, uma só box própria e "casa" selecionada, grava na box própria', async () => {
    const { box } = await prepararSimples({ semPadrao: true });
    useApp.setState({ boxSel: 'casa' });
    render(<TelaLancar />);
    await userEvent.type(screen.getByLabelText('Valor'), '5,00');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    expect((await db.lancamentos.toArray())[0].boxId).toBe(box.id);
  });

  it('sem padrão e com duas boxes, sem escolha: Lançar desabilitado até escolher a box', async () => {
    const { outra } = await prepararSimples({ duasBoxes: true, semPadrao: true });
    useApp.setState({ boxSel: 'casa' });
    render(<TelaLancar />);
    await userEvent.type(screen.getByLabelText('Valor'), '6,00');
    expect(screen.getByRole('button', { name: 'Lançar' })).toBeDisabled();
    expect(screen.getByText('Escolha a box.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Box'), outra!.id);
    expect(screen.getByRole('button', { name: 'Lançar' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    expect((await db.lancamentos.toArray())[0].boxId).toBe(outra!.id);
  });

  it('sem padrão, com a box selecionada sendo própria, usa essa box', async () => {
    const { outra } = await prepararSimples({ duasBoxes: true, semPadrao: true });
    useApp.setState({ boxSel: outra!.id });
    render(<TelaLancar />);
    await userEvent.type(screen.getByLabelText('Valor'), '8,00');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    expect((await db.lancamentos.toArray())[0].boxId).toBe(outra!.id);
  });

  it('o campo Box é o mesmo do Avançado e nunca oferece a box "casa"', async () => {
    const { box, outra } = await prepararSimples({ duasBoxes: true, semPadrao: true });
    useApp.setState({ boxSel: 'casa' });
    render(<TelaLancar />);
    const seletor = screen.getByLabelText('Box') as HTMLSelectElement;
    const opcoes = Array.from(seletor.options).map((o) => o.value).filter((v) => v !== '');
    expect(opcoes.sort()).toEqual([box.id, outra!.id].sort());
    expect(screen.queryByRole('option', { name: 'casa' })).toBeNull();
  });

  it('com a box do topo própria, o campo Box já vem nela e trocar grava na nova', async () => {
    const { box, outra } = await prepararSimples({ duasBoxes: true, semPadrao: true });
    useApp.setState({ boxSel: box.id });
    render(<TelaLancar />);
    expect((screen.getByLabelText('Box') as HTMLSelectElement).value).toBe(box.id);
    expect(screen.queryByText('Escolha a box.')).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Box'), outra!.id);
    await userEvent.type(screen.getByLabelText('Valor'), '3,00');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    expect((await db.lancamentos.toArray())[0].boxId).toBe(outra!.id);
  });

  it('sem nenhuma box própria, avisa para criar uma e não lança', async () => {
    await repo.salvarModo('lancar', 'simples');
    await useApp.getState().iniciar(); // só a box "casa", autocriada
    useApp.setState({ boxSel: 'casa', hoje: '2026-07-02' });
    render(<TelaLancar />);
    expect(screen.getByText(/Nenhuma box — crie em Ajustes → Boxes\./)).toBeInTheDocument();
    expect(screen.queryByLabelText('Box')).toBeNull();
    await userEvent.type(screen.getByLabelText('Valor'), '2,00');
    expect(screen.getByRole('button', { name: 'Lançar' })).toBeDisabled();
  });

  it('no modo Avançado todos os campos continuam presentes', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
    render(<TelaLancar />);
    expect(screen.getByLabelText('Data')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nota/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Marcar como previsto/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'mercado' })).toBeInTheDocument();
  });
});
