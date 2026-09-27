import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import * as projection from '../domain/projection';
import { useApp } from '../state/store';
import SimuladorFluxo from './SimuladorFluxo';

beforeEach(async () => { await limparDb(); });

/** Box com 1.000,00 desde 01/09/2026, hoje 15/09/2026, sem outros lançamentos: o saldo "sem"
 *  é 100000 centavos em todo mês. */
async function preparar() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-09-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const casa = await repo.salvarCategoria({ boxId: box.id, nome: 'Casa', tipo: 'gasto', ordem: 0 });
  const extra = await repo.salvarCategoria({ boxId: box.id, nome: 'Extra', tipo: 'ganho', ordem: 1 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-09-15' });
  return { box, casa, extra };
}

async function cenarioCom(nome: string, ligado: boolean, lanc: { categoriaId: string; boxId: string; data: string; valor: number; nota?: string }) {
  const agora = agoraISO();
  const c = { id: novoId(), nome, ligado, criadoEm: agora, alteradoEm: agora };
  await repo.salvarCenario(c);
  await repo.salvarLancamento({ ...lanc, status: 'previsto', cenarioId: c.id });
  await useApp.getState().recarregar();
  return c;
}

const linhaDoMes = (tabela: HTMLElement, mes: string) =>
  within(tabela).getByText(mes).closest('tr') as HTMLElement;

it('criar cenário: formulário no topo, o cenário nasce ligado e aberto', async () => {
  await preparar();
  render(<SimuladorFluxo />);
  await userEvent.type(screen.getByLabelText('Novo cenário'), 'Mudança');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
  expect(await screen.findByRole('checkbox', { name: 'Ligar Mudança' })).toBeChecked();
  expect(screen.getByText('Novo item')).toBeInTheDocument();
  expect((await db.cenarios.toArray())[0]).toMatchObject({ nome: 'Mudança', ligado: true });
});

it('Criar fica desativado com o nome vazio', async () => {
  await preparar();
  render(<SimuladorFluxo />);
  expect(screen.getByRole('button', { name: 'Criar' })).toBeDisabled();
});

it('resumo combinado: gasto de 300,00 em outubro tira 300,00 de outubro em diante', async () => {
  const { box, casa } = await preparar();
  await cenarioCom('Geladeira', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 30000 });
  render(<SimuladorFluxo />);
  const resumo = screen.getByRole('region', { name: 'Cenários ligados' });
  const tabela = within(resumo).getByRole('table');
  const set = within(linhaDoMes(tabela, 'set/26')).getAllByRole('cell');
  expect(set[2]).toHaveTextContent('—');
  const out = within(linhaDoMes(tabela, 'out/26')).getAllByRole('cell');
  expect(out[1]).toHaveTextContent('700,00');     // com: 100000 − 30000
  expect(out[2]).toHaveTextContent(/^300,00$/);   // diferença, sem sinal
  expect(out[2].querySelector('strong')).toHaveClass('valor-gasto');
  expect(out[3]).toHaveTextContent('1.000,00');   // sem
  expect(within(resumo).getByText(/segue positivo/)).toBeInTheDocument();
});

it('saldo negativo: aviso com o mês e o "−" na coluna Com', async () => {
  const { box, casa } = await preparar();
  await cenarioCom('Carro', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 150000 });
  render(<SimuladorFluxo />);
  const resumo = screen.getByRole('region', { name: 'Cenários ligados' });
  expect(within(resumo).getByText(/o saldo fica negativo em out\/2026/)).toBeInTheDocument();
  const out = within(linhaDoMes(within(resumo).getByRole('table'), 'out/26')).getAllByRole('cell');
  expect(out[1]).toHaveTextContent('−500,00');    // 100000 − 150000 = −50000
  expect(out[1].querySelector('strong')).toHaveClass('total-dia', 'neg');
});

it('cenário desligado não entra no resumo, mas o impacto dele aparece ao abrir', async () => {
  const { box, extra } = await preparar();
  await cenarioCom('Freela', false, { boxId: box.id, categoriaId: extra.id, data: '2026-10-10', valor: 20000, nota: 'Pagamento' });
  render(<SimuladorFluxo />);
  expect(screen.getByText(/Nenhum cenário ligado/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Freela/ }));
  const impacto = screen.getByRole('region', { name: 'Impacto só deste cenário' });
  const out = within(linhaDoMes(within(impacto).getByRole('table'), 'out/26')).getAllByRole('cell');
  expect(out[1]).toHaveTextContent('1.200,00');
  expect(out[2].querySelector('strong')).toHaveClass('valor-ganho');
  // o item de ganho aparece verde
  expect(screen.getByText('Pagamento').closest('.item')?.querySelector('.valor-ganho')).not.toBeNull();
});

it('ligar e desligar muda o resumo sem mudar a largura da tabela', async () => {
  const { box, casa } = await preparar();
  const c = await cenarioCom('Geladeira', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 30000 });
  render(<SimuladorFluxo />);
  const tabelaAntes = within(screen.getByRole('region', { name: 'Cenários ligados' })).getByRole('table');
  const larguraAntes = tabelaAntes.style.minWidth;
  await userEvent.click(screen.getByRole('checkbox', { name: 'Ligar Geladeira' }));
  expect(await screen.findByText(/Nenhum cenário ligado/)).toBeInTheDocument();
  expect((await db.cenarios.get(c.id))?.ligado).toBe(false);
  const tabelaDepois = within(screen.getByRole('region', { name: 'Cenários ligados' })).getByRole('table');
  expect(tabelaDepois.style.minWidth).toBe(larguraAntes);
});

it('só um cenário aberto por vez; a seta abre; o checkbox não abre', async () => {
  const { box, casa } = await preparar();
  await cenarioCom('A', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 100 });
  await cenarioCom('B', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 100 });
  render(<SimuladorFluxo />);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Ligar A' }));
  expect(screen.queryByText('Novo item')).not.toBeInTheDocument();
  const botaoA = screen.getByRole('button', { name: /^A/ });
  await userEvent.click(within(botaoA).getByText('▼'));
  expect(botaoA).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(screen.getByRole('button', { name: /^B/ }));
  expect(botaoA).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getAllByText('Novo item')).toHaveLength(1);
});

it('adicionar item pelo cenário grava no cenário certo', async () => {
  await preparar();
  render(<SimuladorFluxo />);
  await userEvent.type(screen.getByLabelText('Novo cenário'), 'Mudança');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
  await screen.findByText('Novo item');
  await userEvent.type(screen.getByLabelText('Valor'), '300,00');
  await userEvent.click(screen.getByRole('button', { name: 'Casa' }));
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar ao cenário' }));
  const [c] = await db.cenarios.toArray();
  const lancs = await db.lancamentos.where('cenarioId').equals(c.id).toArray();
  expect(lancs).toHaveLength(1);
  expect(lancs[0]).toMatchObject({ valor: 30000, status: 'previsto' });
});

it('memoiza a projeção: digitar em "Novo cenário" não recalcula projetarBoxes', async () => {
  await preparar();
  const spy = vi.spyOn(projection, 'projetarBoxes');
  render(<SimuladorFluxo />);
  const chamadasIniciais = spy.mock.calls.length;
  expect(chamadasIniciais).toBeGreaterThan(0);
  await userEvent.type(screen.getByLabelText('Novo cenário'), 'abc');
  expect(spy.mock.calls.length).toBe(chamadasIniciais);
  spy.mockRestore();
});

it('Tornar real e Excluir cenário pedem confirmação', async () => {
  const { box, casa } = await preparar();
  const c = await cenarioCom('X', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 100 });
  const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<SimuladorFluxo />);
  await userEvent.click(screen.getByRole('button', { name: /^X/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Excluir cenário' }));
  expect(confirmar).toHaveBeenCalled();
  expect(await db.cenarios.get(c.id)).toBeDefined();
  confirmar.mockRestore();
});
