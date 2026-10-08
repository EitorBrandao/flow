import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import * as projection from '../domain/projection';
import { boxIdsSelecionadas, cenariosLigados, useApp } from '../state/store';
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
  const c = { id: novoId(), nome, ligado, escopo: lanc.boxId, criadoEm: agora, alteradoEm: agora };
  await repo.salvarCenario(c);
  await repo.salvarLancamento({ ...lanc, status: 'previsto', cenarioId: c.id });
  await useApp.getState().recarregar();
  // `recarregar` troca `hoje` pela data real; sem refixar, o teste depende do dia em que roda.
  useApp.setState({ hoje: '2026-09-15' });
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
  expect(screen.getByRole('button', { name: 'Adicionar item' })).toBeInTheDocument();
  expect(screen.queryByText('Novo item')).not.toBeInTheDocument();
  expect((await db.cenarios.toArray())[0]).toMatchObject({ nome: 'Mudança', ligado: true });
});

it('Criar fica desativado com o nome vazio', async () => {
  await preparar();
  render(<SimuladorFluxo />);
  expect(screen.getByRole('button', { name: 'Criar' })).toBeDisabled();
});

it('resumo combinado: gasto de 300,00 em outubro tira 300,00 de outubro em diante', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-09-15T10:00:00'));
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
  } finally {
    vi.useRealTimers();
  }
});

it('saldo negativo só no meio do mês: o aviso aponta o dia, mesmo com o fim do mês positivo', async () => {
  const { box, casa, extra } = await preparar();
  await cenarioCom('Carro', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 150000 });
  await cenarioCom('Bônus', true, { boxId: box.id, categoriaId: extra.id, data: '2026-10-28', valor: 200000 });
  render(<SimuladorFluxo />);
  const resumo = screen.getByRole('region', { name: 'Cenários ligados' });
  // fim de out/26: 1.000,00 − 1.500,00 + 2.000,00 = 1.500,00 (positivo), mas de 10/10 a 27/10 é −500,00
  const out = within(linhaDoMes(within(resumo).getByRole('table'), 'out/26')).getAllByRole('cell');
  expect(out[1]).toHaveTextContent('1.500,00');
  expect(within(resumo).getByText(/o saldo fica negativo em 10\/10\/2026/)).toBeInTheDocument();
  expect(within(resumo).queryByText(/segue positivo/)).not.toBeInTheDocument();
});

it('cenário isolado: o card mostra o dia em que o saldo fica negativo', async () => {
  const { box, casa } = await preparar();
  await cenarioCom('Carro', false, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 150000 });
  render(<SimuladorFluxo />);
  expect(screen.getByText(/negativo em 10\/10\/2026/)).toBeInTheDocument();
});

it('saldo negativo: aviso com o dia e o "−" na coluna Com', async () => {
  const { box, casa } = await preparar();
  await cenarioCom('Carro', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 150000 });
  render(<SimuladorFluxo />);
  const resumo = screen.getByRole('region', { name: 'Cenários ligados' });
  expect(within(resumo).getByText(/o saldo fica negativo em 10\/10\/2026/)).toBeInTheDocument();
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

it('sem cenário ligado a tabela mostra só o saldo real; com um ligado, voltam Com, Diferença e Sem', async () => {
  const { box, casa } = await preparar();
  const c = await cenarioCom('Geladeira', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 30000 });
  render(<SimuladorFluxo />);
  const resumoAntes = screen.getByRole('region', { name: 'Cenários ligados' });
  expect(within(resumoAntes).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Mês', 'Com', 'Diferença', 'Sem']);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Ligar Geladeira' }));
  expect(await screen.findByText(/Nenhum cenário ligado/)).toBeInTheDocument();
  expect((await db.cenarios.get(c.id))?.ligado).toBe(false);
  const resumoDepois = screen.getByRole('region', { name: 'Cenários ligados' });
  expect(within(resumoDepois).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Mês', 'Saldo']);
  expect(c.id).toBeTruthy();
});

it('lista os cenários por criadoEm, do mais antigo pro mais novo', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-09-15T10:00:00'));
    const { box, casa } = await preparar();
    vi.setSystemTime(new Date('2026-09-15T10:00:05'));
    await cenarioCom('Zebra', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 100 });
    vi.setSystemTime(new Date('2026-09-15T10:00:10'));
    await cenarioCom('Abacate', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 100 });
    render(<SimuladorFluxo />);
    const nomes = screen.getAllByRole('checkbox').map((el) => el.getAttribute('aria-label'));
    expect(nomes).toEqual(['Ligar Zebra', 'Ligar Abacate']);
  } finally {
    vi.useRealTimers();
  }
});

it('cenário recém-criado pelo formulário vai ao fim da lista', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-09-15T10:00:00'));
    const { box, casa } = await preparar();
    vi.setSystemTime(new Date('2026-09-15T10:00:05'));
    await cenarioCom('Existente', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 100 });
    vi.setSystemTime(new Date('2026-09-15T10:00:10'));
    render(<SimuladorFluxo />);
    await userEvent.type(screen.getByLabelText('Novo cenário'), 'Novo');
    await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await screen.findByRole('button', { name: 'Adicionar item' });
    const nomes = screen.getAllByRole('checkbox').map((el) => el.getAttribute('aria-label'));
    expect(nomes).toEqual(['Ligar Existente', 'Ligar Novo']);
  } finally {
    vi.useRealTimers();
  }
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
  expect(screen.getAllByRole('button', { name: 'Adicionar item' })).toHaveLength(1);
});

it('adicionar item pelo cenário grava no cenário certo', async () => {
  await preparar();
  render(<SimuladorFluxo />);
  await userEvent.type(screen.getByLabelText('Novo cenário'), 'Mudança');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Adicionar item' }));
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

it('parcelado 3x a partir de hoje gera 3 lançamentos', async () => {
  // O repo materializa com o relógio real (hojeISO()) — precisa bater com `hoje` do store,
  // que é o data padrão do formulário. Sem o relógio falso, o valor default de "A partir de"
  // usaria a data real do sistema, não '2026-09-15'.
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-09-15T12:00:00'));
    await preparar();
    render(<SimuladorFluxo />);
    await userEvent.type(screen.getByLabelText('Novo cenário'), 'Móveis');
    await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar item' }));
    await userEvent.type(screen.getByLabelText('Valor'), '900,00');
    await userEvent.click(screen.getByRole('button', { name: 'Casa' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Parcelado' }));
    const parcelas = screen.getByLabelText('Parcelas');
    await userEvent.clear(parcelas);
    await userEvent.type(parcelas, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar ao cenário' }));

    const [c] = await db.cenarios.toArray();
    const lancs = await db.lancamentos.where('cenarioId').equals(c.id).toArray();
    expect(lancs).toHaveLength(3);
    expect(lancs.map((l) => l.data).sort()).toEqual(['2026-09-15', '2026-10-15', '2026-11-15']);
    expect(lancs.every((l) => l.status === 'previsto' && l.valor === 30000)).toBe(true);
  } finally {
    vi.useRealTimers();
  }
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

it('Tornar real avisa sobre Pendentes quando há item de cenário com data já passada (hoje inclusive)', async () => {
  const { box, casa } = await preparar(); // hoje = '2026-09-15'
  await cenarioCom('Y', true, { boxId: box.id, categoriaId: casa.id, data: '2026-09-15', valor: 100 });
  const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<SimuladorFluxo />);
  await userEvent.click(screen.getByRole('button', { name: /^Y/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Tornar real' }));
  expect(confirmar).toHaveBeenCalledWith(
    'Converter "Y" em lançamentos reais? Itens com data já passada vão para os Pendentes, em Hoje.',
  );
  confirmar.mockRestore();
});

it('Tornar real não avisa sobre Pendentes quando todos os itens do cenário são futuros', async () => {
  const { box, casa } = await preparar(); // hoje = '2026-09-15'
  await cenarioCom('Z', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 100 });
  const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<SimuladorFluxo />);
  await userEvent.click(screen.getByRole('button', { name: /^Z/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Tornar real' }));
  expect(confirmar).toHaveBeenCalledWith('Converter "Z" em lançamentos reais?');
  confirmar.mockRestore();
});

it('minimizar a tabela combinada esconde a tabela mas mantém visível a frase de resumo', async () => {
  const { box, casa } = await preparar();
  await cenarioCom('Gasto', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 30000 });
  render(<SimuladorFluxo />);
  const resumo = screen.getByRole('region', { name: 'Cenários ligados' });
  const tabelaAntes = within(resumo).queryByRole('table');
  expect(tabelaAntes).toBeInTheDocument();
  const botao = within(resumo).getByRole('button', { name: /Tabela por mês/ });
  await userEvent.click(botao);
  expect(within(resumo).queryByRole('table')).not.toBeInTheDocument();
  expect(within(resumo).getByText(/segue positivo/)).toBeInTheDocument();
});

it('abrir um cenário, minimizar sua tabela, fechar e reabrir mantém a tabela minimizada', async () => {
  const { box, casa } = await preparar();
  await cenarioCom('A', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 100 });
  render(<SimuladorFluxo />);
  const botaoAbrir = screen.getByRole('button', { name: /^A/ });
  await userEvent.click(botaoAbrir);
  const impacto = await screen.findByRole('region', { name: 'Impacto só deste cenário' });
  const botaoTabela = within(impacto).getByRole('button', { name: /Tabela por mês/ });
  await userEvent.click(botaoTabela);
  expect(within(impacto).queryByRole('table')).not.toBeInTheDocument();
  await userEvent.click(botaoAbrir);
  expect(screen.queryByRole('region', { name: 'Impacto só deste cenário' })).not.toBeInTheDocument();
  await userEvent.click(botaoAbrir);
  const impacto2 = await screen.findByRole('region', { name: 'Impacto só deste cenário' });
  expect(within(impacto2).queryByRole('table')).not.toBeInTheDocument();
});

it('padrão mostra de set/2026 até dez/2027', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-09-15T10:00:00'));
    const { box, casa } = await preparar();
    await cenarioCom('Gasto', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 100 });
    render(<SimuladorFluxo />);
    const tabela = within(screen.getByRole('region', { name: 'Cenários ligados' })).getByRole('table');
    const trs = within(tabela).getAllByRole('row');
    const primeiraMes = within(trs[1]).getAllByRole('cell')[0].textContent;
    const ultimaMes = within(trs[trs.length - 1]).getAllByRole('cell')[0].textContent;
    expect(primeiraMes).toContain('set/26');
    expect(ultimaMes).toContain('dez/27');
  } finally {
    vi.useRealTimers();
  }
});

it('mudar "Ano final" para 2030 acrescenta meses até dez/2030', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-09-15T10:00:00'));
    const { box, casa } = await preparar();
    await cenarioCom('Recurso', true, { boxId: box.id, categoriaId: casa.id, data: '2027-03-15', valor: 50000 });
    render(<SimuladorFluxo />);
    const selectAnoFinal = screen.getByLabelText('Ano final');
    await userEvent.selectOptions(selectAnoFinal, '2030');
    const tabela = within(screen.getByRole('region', { name: 'Cenários ligados' })).getByRole('table');
    const trs = within(tabela).getAllByRole('row');
    const ultimaMes = within(trs[trs.length - 1]).getAllByRole('cell')[0].textContent;
    expect(ultimaMes).toContain('dez/30');
  } finally {
    vi.useRealTimers();
  }
});

it('uma recorrência mensal de gasto criada por repo.salvarRecorrencia aparece em 2030', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-09-15T10:00:00'));
    const { box, casa } = await preparar();
    const rec = { id: novoId(), boxId: box.id, categoriaId: casa.id, valor: 10000, dataInicio: '2026-10-10', diaDoMes: 10, origem: 'manual' as const, ativa: true, parcelas: null, criadoEm: agoraISO(), alteradoEm: agoraISO() };
    await repo.salvarRecorrencia(rec, '2027-12-31');
    await useApp.getState().recarregar();
    render(<SimuladorFluxo />);
    const selectAnoFinal = screen.getByLabelText('Ano final');
    await userEvent.selectOptions(selectAnoFinal, '2030');
    const tabela = within(screen.getByRole('region', { name: 'Cenários ligados' })).getByRole('table');
    const linhas = within(tabela).getAllByRole('row');
    const linhaJan30 = linhas.find((tr) => {
      const cells = within(tr).queryAllByRole('cell');
      return cells[0]?.textContent?.includes('jan/30');
    });
    expect(linhaJan30).toBeDefined();
  } finally {
    vi.useRealTimers();
  }
});

it('mudar "Mês final" avança a tabela', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-09-15T10:00:00'));
    const { box, casa } = await preparar();
    await cenarioCom('Mudança', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 100 });
    render(<SimuladorFluxo />);
    const tabelaAntes = within(screen.getByRole('region', { name: 'Cenários ligados' })).getByRole('table');
    const trsAntes = within(tabelaAntes).getAllByRole('row');
    const qtdAntes = trsAntes.length - 1; // menos header
    const selectAnoFinal = screen.getByLabelText('Ano final');
    await userEvent.selectOptions(selectAnoFinal, '2030');
    const tabelaDepois = within(screen.getByRole('region', { name: 'Cenários ligados' })).getByRole('table');
    const trsDepois = within(tabelaDepois).getAllByRole('row');
    const qtdDepois = trsDepois.length - 1; // menos header
    expect(qtdDepois).toBeGreaterThan(qtdAntes);
  } finally {
    vi.useRealTimers();
  }
});

/** Duas boxes (ana, bruno) mais a box "casa" autocriada. Cada visão tem um cenário ligado com um item de gasto. */
async function prepararVisoes() {
  const agora = agoraISO();
  const ana = { id: novoId(), nome: 'ana', saldoInicial: 100000, dataSaldoInicial: '2026-09-01', criadoEm: agora, alteradoEm: agora };
  const bruno = { id: novoId(), nome: 'bruno', saldoInicial: 100000, dataSaldoInicial: '2026-09-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(ana);
  await repo.salvarBox(bruno);
  const catAna = await repo.salvarCategoria({ boxId: ana.id, nome: 'Casa', tipo: 'gasto', ordem: 0 });
  const catBruno = await repo.salvarCategoria({ boxId: bruno.id, nome: 'Casa', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  const boxCasa = useApp.getState().dados!.boxes.find((b) => b.nome === 'casa')!;
  const catCasa = await repo.salvarCategoria({ boxId: boxCasa.id, nome: 'Casa', tipo: 'gasto', ordem: 0 });
  const cenario = async (nome: string, escopo: string | undefined, boxId: string, categoriaId: string, valor: number) => {
    const c = { id: novoId(), nome, ligado: true, ...(escopo ? { escopo } : {}), criadoEm: agora, alteradoEm: agora };
    await repo.salvarCenario(c);
    await repo.salvarLancamento({ boxId, categoriaId, data: '2026-10-10', valor, status: 'previsto', cenarioId: c.id });
    return c;
  };
  const A = await cenario('Cenario A', ana.id, ana.id, catAna.id, 10000);
  const B = await cenario('Cenario B', bruno.id, bruno.id, catBruno.id, 20000);
  const C = await cenario('Cenario C', undefined, boxCasa.id, catCasa.id, 30000);
  await useApp.getState().recarregar();
  useApp.setState({ hoje: '2026-09-15' });
  return { ana, bruno, boxCasa, A, B, C };
}

it('cada visão lista só os seus cenários e conta só os ligados dela', async () => {
  const { ana } = await prepararVisoes();
  useApp.setState({ boxSel: ana.id });
  const { unmount } = render(<SimuladorFluxo />);
  expect(screen.getByRole('button', { name: /Cenario A/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Cenario B/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Cenario C/ })).not.toBeInTheDocument();
  expect(screen.getByText('Cenários ligados · 1')).toBeInTheDocument();
  unmount();

  useApp.setState({ boxSel: 'casa' });
  render(<SimuladorFluxo />);
  expect(screen.getByRole('button', { name: /Cenario C/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Cenario A/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Cenario B/ })).not.toBeInTheDocument();
  expect(screen.getByText('Cenários ligados · 1')).toBeInTheDocument();
});

it('visão sem cenário mostra "Nenhum cenário ainda." e zero ligados, mesmo com ligados em outras visões', async () => {
  const agora = agoraISO();
  const { ana } = await prepararVisoes();
  const sem = { id: novoId(), nome: 'carla', saldoInicial: 0, dataSaldoInicial: '2026-09-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(sem);
  await useApp.getState().recarregar();
  useApp.setState({ boxSel: sem.id, hoje: '2026-09-15' });
  expect(ana.id).not.toBe(sem.id);
  render(<SimuladorFluxo />);
  expect(screen.getByText('Nenhum cenário ainda.')).toBeInTheDocument();
  expect(screen.getByText('Cenários ligados · 0')).toBeInTheDocument();
});

it('criar um cenário grava o escopo da visão: "casa" na casa, o id da box numa box', async () => {
  const { ana } = await prepararVisoes();
  useApp.setState({ boxSel: 'casa' });
  const { unmount } = render(<SimuladorFluxo />);
  await userEvent.type(screen.getByLabelText('Novo cenário'), 'Da casa');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
  await screen.findByRole('button', { name: /Da casa/ });
  expect((await db.cenarios.toArray()).find((c) => c.nome === 'Da casa')?.escopo).toBe('casa');
  unmount();

  useApp.setState({ boxSel: ana.id, hoje: '2026-09-15' });
  render(<SimuladorFluxo />);
  await userEvent.type(screen.getByLabelText('Novo cenário'), 'Da ana');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
  await screen.findByRole('button', { name: /Da ana/ });
  expect((await db.cenarios.toArray()).find((c) => c.nome === 'Da ana')?.escopo).toBe(ana.id);
});

it('a projeção de cada visão soma só o item dos cenários dela', async () => {
  const { ana } = await prepararVisoes();
  const { dados } = useApp.getState();
  const saldoEm = (ids: string[], boxSel: string) => {
    const serie = projection.projetarBoxes(ids, {
      boxes: dados!.boxes, categorias: dados!.categorias, lancamentos: dados!.lancamentos,
      cenariosLigados: cenariosLigados(dados!, boxSel), horizonte: dados!.config.horizonteProjecao,
    });
    const dia = serie.find((d) => d.data === '2026-10-10')!;
    return dia.saldoComCenarios - dia.saldoProjetado;
  };
  // Ana: só o item A (100,00). Casa: só o item C (300,00); A e B não entram.
  expect(saldoEm(boxIdsSelecionadas(dados!, ana.id), ana.id)).toBe(-10000);
  expect(saldoEm(boxIdsSelecionadas(dados!, 'casa'), 'casa')).toBe(-30000);
});

describe('cenário aberto: item novo atrás de um botão', () => {
  async function abrirNovoCenario() {
    await preparar();
    render(<SimuladorFluxo />);
    await userEvent.type(screen.getByLabelText('Novo cenário'), 'Mudança');
    await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
    return screen.findByRole('button', { name: 'Adicionar item' });
  }

  it('o formulário só aparece depois de tocar em "Adicionar item"', async () => {
    const botao = await abrirNovoCenario();
    expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument();
    await userEvent.click(botao);
    expect(screen.getByLabelText('Valor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar ao cenário' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar item' })).not.toBeInTheDocument();
  });

  it('Cancelar fecha o formulário e devolve o botão', async () => {
    await userEvent.click(await abrirNovoCenario());
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar item' })).toBeInTheDocument();
  });

  it('depois de adicionar, o formulário fecha e o botão volta', async () => {
    await userEvent.click(await abrirNovoCenario());
    await userEvent.type(screen.getByLabelText('Valor'), '300,00');
    await userEvent.click(screen.getByRole('button', { name: 'Casa' }));
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar ao cenário' }));
    expect(await screen.findByRole('button', { name: 'Adicionar item' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument();
  });

  it('sem item, não mostra a tabela de impacto; com item, mostra', async () => {
    await abrirNovoCenario();
    expect(screen.getByText('Nenhum item ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Impacto só deste cenário' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    await userEvent.type(screen.getByLabelText('Valor'), '300,00');
    await userEvent.click(screen.getByRole('button', { name: 'Casa' }));
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar ao cenário' }));
    expect(await screen.findByRole('region', { name: 'Impacto só deste cenário' })).toBeInTheDocument();
  });
});
