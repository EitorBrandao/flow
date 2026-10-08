import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { formatarBRL } from '../domain/money';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaLancar from './TelaLancar';

beforeEach(async () => {
  await limparDb();
});

it('lança um gasto em 3 interações: valor, categoria, Lançar', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  await userEvent.type(screen.getByLabelText('Valor'), '12,34');
  await userEvent.click(screen.getByRole('button', { name: 'cartão' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  const lancs = await db.lancamentos.toArray();
  expect(lancs).toHaveLength(1);
  expect(lancs[0]).toMatchObject({ valor: 1234, data: '2026-07-02', status: 'efetivo', origem: 'manual' });
});

it('bloqueia o lançamento quando a data é limpa', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  await userEvent.type(screen.getByLabelText('Valor'), '12,34');
  await userEvent.click(screen.getByRole('button', { name: 'cartão' }));
  await userEvent.clear(screen.getByLabelText('Data'));

  expect(screen.getByRole('button', { name: 'Lançar' })).toBeDisabled();
  const lancs = await db.lancamentos.toArray();
  expect(lancs).toHaveLength(0);
});

describe('Lançar com "casa" no topo', () => {
  async function montar() {
    const agora = agoraISO();
    const box = (nome: string, saldo: number | null) =>
      ({ id: novoId(), nome, saldoInicial: saldo, dataSaldoInicial: saldo === null ? null : '2026-01-01', criadoEm: agora, alteradoEm: agora });
    const ana = box('ana', 0);
    const bruno = box('bruno', 0);
    const casa = box('casa', null);
    await repo.salvarBox(ana);
    await repo.salvarBox(bruno);
    await repo.salvarBox(casa);
    await repo.salvarCategoria({ boxId: ana.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
    await repo.salvarCategoria({ boxId: bruno.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: 'casa', hoje: '2026-07-02' });
    return { ana, bruno, casa };
  }

  it('pede a box antes de mostrar o resto do formulário', async () => {
    await montar();
    render(<TelaLancar />);
    const seletor = screen.getByLabelText('Box');
    expect(within(seletor).getByRole('option', { name: 'ana' })).toBeInTheDocument();
    expect(within(seletor).getByRole('option', { name: 'bruno' })).toBeInTheDocument();
    expect(within(seletor).queryByRole('option', { name: 'casa' })).not.toBeInTheDocument();
    expect(screen.getByText('Escolha a box.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lançar' })).not.toBeInTheDocument();
  });

  it('grava na box escolhida, nunca na box "casa"', async () => {
    const { bruno } = await montar();
    render(<TelaLancar />);
    await userEvent.selectOptions(screen.getByLabelText('Box'), bruno.id);
    await userEvent.type(screen.getByLabelText('Valor'), '50,00');
    await userEvent.click(screen.getByRole('button', { name: 'aluguel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    const lancs = await db.lancamentos.toArray();
    expect(lancs).toHaveLength(1);
    expect(lancs[0]).toMatchObject({ boxId: bruno.id, valor: 5000 });
  });

  it('as categorias seguem a box escolhida e trocar a box zera a categoria', async () => {
    const { ana, bruno } = await montar();
    render(<TelaLancar />);
    await userEvent.selectOptions(screen.getByLabelText('Box'), ana.id);
    await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
    expect(screen.queryByRole('button', { name: 'aluguel' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Box'), bruno.id);
    expect(screen.queryByRole('button', { name: 'mercado' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'aluguel' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Valor'), '10,00');
    expect(screen.getByRole('button', { name: 'Lançar' })).toBeDisabled();
  });

  it('a box continua escolhida depois de lançar', async () => {
    const { ana } = await montar();
    render(<TelaLancar />);
    await userEvent.selectOptions(screen.getByLabelText('Box'), ana.id);
    await userEvent.type(screen.getByLabelText('Valor'), '12,00');
    await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    expect((screen.getByLabelText('Box') as HTMLSelectElement).value).toBe(ana.id);
  });

  it('rascunho com categoria da box "casa" não habilita o Lançar com outra box escolhida', async () => {
    const { ana, casa } = await montar();
    const catCasa = await repo.salvarCategoria({ boxId: casa.id, nome: 'luz', tipo: 'gasto', ordem: 0 });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: 'casa', hoje: '2026-07-02' });
    render(<TelaLancar />);
    await userEvent.selectOptions(screen.getByLabelText('Box'), ana.id);
    act(() => useApp.setState({ rascunhoLancar: { categoriaId: catCasa.id, valorCent: 3000 } }));
    expect(await screen.findByRole('button', { name: 'Lançar' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await db.lancamentos.toArray()).toHaveLength(0);
  });

  it('box compartilhada sem saldo próprio não aparece no seletor Box', async () => {
    await montar();
    const agora = agoraISO();
    await repo.salvarBox({ id: novoId(), nome: 'viagem em grupo', saldoInicial: null, dataSaldoInicial: null, criadoEm: agora, alteradoEm: agora });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: 'casa', hoje: '2026-07-02' });
    render(<TelaLancar />);
    const seletor = screen.getByLabelText('Box');
    expect(within(seletor).getByRole('option', { name: 'ana' })).toBeInTheDocument();
    expect(within(seletor).queryByRole('option', { name: 'viagem em grupo' })).not.toBeInTheDocument();
  });

  it('trocar a box zera o banco escolhido e ao voltar o banco é o padrão', async () => {
    const { ana, bruno } = await montar();
    await repo.salvarBanco({ boxId: ana.id, nome: 'Banco Um', ordem: 0 });
    await repo.salvarBanco({ boxId: ana.id, nome: 'Banco Dois', ordem: 1 });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: 'casa', hoje: '2026-07-02' });
    render(<TelaLancar />);
    await userEvent.selectOptions(screen.getByLabelText('Box'), ana.id);
    await userEvent.click(screen.getByRole('radio', { name: 'Banco Dois' }));
    expect(screen.getByRole('radio', { name: 'Banco Dois' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.selectOptions(screen.getByLabelText('Box'), bruno.id);
    await userEvent.selectOptions(screen.getByLabelText('Box'), ana.id);
    expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'true');
  });

  it('sem nenhuma box real, avisa para criar uma', async () => {
    await limparDb();
    await useApp.getState().iniciar(); // só a box "casa", autocriada
    useApp.setState({ boxSel: 'casa', hoje: '2026-07-02' });
    render(<TelaLancar />);
    expect(screen.getByText(/Nenhuma box — crie em Ajustes → Boxes\./)).toBeInTheDocument();
    expect(screen.queryByLabelText('Box')).not.toBeInTheDocument();
  });

  it('numa box concreta, o campo Box não aparece', async () => {
    const { ana } = await montar();
    useApp.setState({ boxSel: ana.id });
    render(<TelaLancar />);
    expect(screen.queryByLabelText('Box')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Valor')).toBeInTheDocument();
  });
});

it('marca como previsto quando o toggle está ativo, mesmo com data de hoje', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  await userEvent.type(screen.getByLabelText('Valor'), '12,34');
  await userEvent.click(screen.getByRole('button', { name: 'cartão' }));
  await userEvent.click(screen.getByLabelText('Marcar como previsto'));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  const lancs = await db.lancamentos.toArray();
  expect(lancs).toHaveLength(1);
  expect(lancs[0]).toMatchObject({ data: '2026-07-02', status: 'previsto' });
});

it('checkbox de viagem aparece marcado quando a data cai no período de uma viagem e marca o lançamento', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  const checkbox = screen.getByLabelText(`Viagem: ${viagem.nome}`) as HTMLInputElement;
  expect(checkbox.checked).toBe(true);

  await userEvent.type(screen.getByLabelText('Valor'), '12,34');
  await userEvent.click(screen.getByRole('button', { name: 'cartão' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  const lancs = await db.lancamentos.toArray();
  expect(lancs[0].viagemId).toBe(viagem.id);
});

it('checkbox de viagem some quando a data está fora do período e desmarcado não marca o lançamento', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  expect(screen.getByLabelText(`Viagem: ${viagem.nome}`)).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText(`Viagem: ${viagem.nome}`));

  await userEvent.type(screen.getByLabelText('Valor'), '12,34');
  await userEvent.click(screen.getByRole('button', { name: 'cartão' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  let lancs = await db.lancamentos.toArray();
  expect(lancs[0].viagemId).toBeUndefined();

  // agora fora do período: o checkbox deve sumir
  await userEvent.clear(screen.getByLabelText('Data'));
  await userEvent.type(screen.getByLabelText('Data'), '2026-08-01');
  expect(screen.queryByLabelText(`Viagem: ${viagem.nome}`)).not.toBeInTheDocument();

  await userEvent.type(screen.getByLabelText('Valor'), '5,00');
  await userEvent.click(screen.getByRole('button', { name: 'cartão' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
  lancs = await db.lancamentos.toArray();
  expect(lancs).toHaveLength(2);
  expect(lancs[1].viagemId).toBeUndefined();
});

it('categoria da fatura de um cartão não aparece na grade de seleção', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);

  expect(screen.getByRole('button', { name: 'mercado' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Nubank' })).not.toBeInTheDocument();
});

it('sem categoria na box, diz o que falta em vez de só desabilitar o botão', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);

  expect(screen.getByRole('button', { name: 'Lançar' })).toBeDisabled();
  expect(screen.getByText('Nenhuma categoria nesta box — crie em Ajustes, Categorias.')).toBeInTheDocument();
});

it('com categoria mas sem valor, não mostra aviso — o campo Valor já abre em foco', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);

  expect(screen.getByRole('button', { name: 'Lançar' })).toBeDisabled();
  expect(screen.queryByText('Digite um valor.')).not.toBeInTheDocument();
  // com valor, o aviso seguinte aparece sozinho
  await userEvent.type(screen.getByLabelText('Valor'), '10,00');
  expect(screen.getByText('Escolha uma categoria.')).toBeInTheDocument();
});

it('consome o rascunho: preenche valor, categoria e tipo, e limpa o rascunho', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const ganho = await repo.salvarCategoria({ boxId: box.id, nome: 'bico', tipo: 'ganho', ordem: 1 });
  await useApp.getState().iniciar();
  useApp.setState({
    boxSel: box.id, hoje: '2026-07-02',
    rascunhoLancar: { categoriaId: ganho.id, valorCent: 4500 },
  });

  render(<TelaLancar />);

  // a categoria semeada é de GANHO, e a tela abre em 'gasto': se o tipo não virar sozinho,
  // ela nem aparece na grade. É por isso que a fixture tem uma categoria de cada tipo.
  expect(await screen.findByRole('button', { name: 'bico' })).toHaveClass('selecionada');
  expect(screen.getByLabelText('Valor')).toHaveValue('R$ 45,00');
  // o rascunho é de uso único: sem limpar, voltar para a tela ressuscitaria o valor
  expect(useApp.getState().rascunhoLancar).toBeNull();
});

it('rascunho com categoria que não existe mais não quebra a tela e é descartado', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({
    boxSel: box.id, hoje: '2026-07-02',
    rascunhoLancar: { categoriaId: 'sumiu', valorCent: 4500 },
  });

  render(<TelaLancar />);

  expect(await screen.findByRole('button', { name: 'Lançar' })).toBeInTheDocument();
  expect(useApp.getState().rascunhoLancar).toBeNull();
  // rascunho inválido não pode semear nada parcialmente: o campo de valor fica em zero
  expect(screen.getByLabelText('Valor')).toHaveValue('R$ 0,00');
});

it('atalho usado com a tela Lançar já aberta não herda data, nota nem previsto que a pessoa já tinha digitado', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cafe = await repo.salvarCategoria({ boxId: box.id, nome: 'café', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);

  // a pessoa já estava na tela, mexeu em tudo e desistiu — antes de usar o atalho
  const inputData = screen.getByLabelText('Data') as HTMLInputElement;
  await userEvent.clear(inputData);
  await userEvent.type(inputData, '2026-09-01');
  await userEvent.type(screen.getByLabelText('Nota (opcional)'), 'nota antiga');
  await userEvent.click(screen.getByLabelText(/Marcar como previsto/));
  expect(inputData.value).toBe('2026-09-01');
  expect(screen.getByLabelText(/Marcar como previsto/)).toBeChecked();

  // aí vem o atalho — setAba('lancar') não muda `aba`, a tela não remonta
  act(() => useApp.setState({ rascunhoLancar: { categoriaId: cafe.id, valorCent: 850 } }));

  expect(await screen.findByRole('button', { name: 'café' })).toHaveClass('selecionada');
  expect(screen.getByLabelText('Valor')).toHaveValue('R$ 8,50');
  expect(inputData.value).toBe('2026-07-02');
  expect(screen.getByLabelText('Nota (opcional)')).toHaveValue('');
  expect(screen.getByLabelText(/Marcar como previsto/)).not.toBeChecked();
});

// TAREFA 4: ORÇAMENTO DE VIAGEM NA TELA DE ADICIONAR

/** Box com uma viagem orçada em R$ 3.000,00 (cobrindo `hoje`) e R$ 1.200,00 já gastos nela
 *  por um lançamento efetivo — a fixture-base dos 6 casos de orçamento desta tela. */
async function montarViagemComGasto() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  const catGasto = await repo.salvarCategoria({ boxId: box.id, nome: 'gasto', tipo: 'gasto', ordem: 1 });
  const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
  await db.viagens.update(viagem.id, { orcamentoCent: 300000 });
  await repo.salvarLancamento({
    boxId: box.id, categoriaId: catGasto.id,
    data: '2026-07-02', valor: 120000, status: 'efetivo', viagemId: viagem.id,
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
  return { box, viagem };
}

/** Reproduz o texto exato de `LinhaOrcamentoViagem`, com `formatarBRL` — inclusive o
 *  espaço não-quebrável entre "R$" e o valor. */
function textoOrcamento(gastoCent: number, orcamentoCent: number, comEsteGasto = false): string {
  const prefixo = comEsteGasto ? 'Com este gasto: ' : '';
  const restanteCent = orcamentoCent - gastoCent;
  return restanteCent >= 0
    ? `${prefixo}${formatarBRL(gastoCent)} de ${formatarBRL(orcamentoCent)} · falta ${formatarBRL(restanteCent)}`
    : `${prefixo}${formatarBRL(gastoCent)} de ${formatarBRL(orcamentoCent)} · passou ${formatarBRL(-restanteCent)}`;
}

/** Acha o <p> da linha do orçamento pelo texto completo — não por um trecho solto, que
 *  também bateria com o parágrafo de "o que falta" ou com o valor isolado no <strong>. */
function linhaOrcamento(texto: string) {
  return screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === texto);
}

it('linha orçamento viagem: sem valor digitado, mostra o gasto atual sem "Com este gasto"', async () => {
  await montarViagemComGasto();

  render(<TelaLancar />);
  expect(linhaOrcamento(textoOrcamento(120000, 300000))).toBeInTheDocument();
  expect(screen.queryByText(/Com este gasto/)).not.toBeInTheDocument();
});

it('linha orçamento viagem: digitar um gasto soma ao atual com o prefixo "Com este gasto"', async () => {
  await montarViagemComGasto();

  render(<TelaLancar />);
  await userEvent.type(screen.getByLabelText('Valor'), '250,00');
  expect(linhaOrcamento(textoOrcamento(145000, 300000, true))).toBeInTheDocument();
});

it('linha orçamento viagem: passar do orçamento mostra "passou" com o valor em destaque', async () => {
  await montarViagemComGasto();

  render(<TelaLancar />);
  await userEvent.type(screen.getByLabelText('Valor'), '2000,00');
  expect(linhaOrcamento(textoOrcamento(320000, 300000, true))).toBeInTheDocument();
  const alerta = screen.getByText(formatarBRL(20000).replace(/\s/g, ' ')).closest('strong');
  expect(alerta).toHaveClass('valor-gasto');
});

it('linha orçamento viagem: marcar previsto ou trocar para Ganho tira o valor digitado do cálculo', async () => {
  await montarViagemComGasto();

  render(<TelaLancar />);
  await userEvent.type(screen.getByLabelText('Valor'), '250,00');
  expect(linhaOrcamento(textoOrcamento(145000, 300000, true))).toBeInTheDocument();

  // previsto: o valor digitado sai da conta
  await userEvent.click(screen.getByLabelText('Marcar como previsto'));
  expect(linhaOrcamento(textoOrcamento(120000, 300000))).toBeInTheDocument();

  // volta a efetivo, digitado conta de novo — antes de testar o outro motivo de exclusão
  await userEvent.click(screen.getByLabelText('Marcar como previsto'));
  expect(linhaOrcamento(textoOrcamento(145000, 300000, true))).toBeInTheDocument();

  // Ganho: o mesmo valor digitado também sai da conta
  await userEvent.click(screen.getByRole('radio', { name: 'Ganho' }));
  expect(linhaOrcamento(textoOrcamento(120000, 300000))).toBeInTheDocument();
});

it('linha orçamento viagem: desmarcar a viagem esconde a linha', async () => {
  const { viagem } = await montarViagemComGasto();

  render(<TelaLancar />);
  expect(linhaOrcamento(textoOrcamento(120000, 300000))).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText(`Viagem: ${viagem.nome}`));
  expect(screen.queryByText(/· falta|· passou/)).not.toBeInTheDocument();
});

it('linha orçamento viagem: viagem sem orçamento não mostra a linha', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
  // viagem sem orcamentoCent
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  expect(screen.queryByText(/· falta|· passou/)).not.toBeInTheDocument();
});

it('mostra em qual box o lançamento vai', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  expect(screen.getByText(/Lançando na box/)).toHaveTextContent('Lançando na box eitor');
});

it('avisa que a data já está dentro do saldo da box, e some ao escolher data depois dele', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-07-02', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  expect(screen.getByText(/já está dentro do saldo inicial da box \(02\/07\/2026\)/)).toBeInTheDocument();
});

it('não avisa quando a data é depois do saldo da box', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  expect(screen.queryByText(/já está dentro do saldo inicial/)).not.toBeInTheDocument();
});

// TAREFA 5: CAMPO BANCO EM LANÇAR

async function boxComDoisBancos({ padraoDois = false }: { padraoDois?: boolean } = {}) {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const um = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
  const dois = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
  if (padraoDois) await repo.definirBancoPadrao(dois.id);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
  return { box, um, dois };
}

it('com dois bancos, o banco padrão vem marcado e o lançamento sai nele', async () => {
  const { um } = await boxComDoisBancos();

  render(<TelaLancar />);
  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.type(screen.getByLabelText('Valor'), '42,90');
  await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  expect((await db.lancamentos.toArray())[0].bancoId).toBe(um.id);
});

it('troca o banco no lançamento e volta ao padrão depois de lançar', async () => {
  const { dois } = await boxComDoisBancos();

  render(<TelaLancar />);
  await userEvent.click(screen.getByRole('radio', { name: 'Banco Dois' }));
  await userEvent.type(screen.getByLabelText('Valor'), '10,00');
  await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  expect((await db.lancamentos.toArray())[0].bancoId).toBe(dois.id);
  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'true');
});

it('respeita o banco marcado como padrão em Ajustes', async () => {
  await boxComDoisBancos({ padraoDois: true });

  render(<TelaLancar />);

  expect(screen.getByRole('radio', { name: 'Banco Dois' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'false');
});

it('com um banco só, não mostra o campo e grava nele', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const unico = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Único', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  expect(screen.queryByRole('radio', { name: 'Banco Único' })).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Valor'), '5,00');
  await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  expect((await db.lancamentos.toArray())[0].bancoId).toBe(unico.id);
});

it('sem bancos, o lançamento sai sem banco', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  await userEvent.type(screen.getByLabelText('Valor'), '5,00');
  await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  expect((await db.lancamentos.toArray())[0].bancoId).toBeUndefined();
});

it('confirmação "Lançado ✓" tem a classe aviso-sucesso', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  await userEvent.type(screen.getByLabelText('Valor'), '12,34');
  await userEvent.click(screen.getByRole('button', { name: 'cartão' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText('Lançado ✓')).toHaveClass('aviso', 'aviso-sucesso');
});

it('escolher banco e trocar de box volta ao banco padrão da nova box', async () => {
  const agora = agoraISO();
  // Primeira box com 2 bancos
  const box1 = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box1);
  await repo.salvarCategoria({ boxId: box1.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await repo.salvarBanco({ boxId: box1.id, nome: 'Banco Um', ordem: 0 });
  await repo.salvarBanco({ boxId: box1.id, nome: 'Banco Dois', ordem: 1 });

  // Segunda box com 2 bancos, banco padrão diferente
  const box2 = { id: novoId(), nome: 'conjunta', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box2);
  await repo.salvarCategoria({ boxId: box2.id, nome: 'contas', tipo: 'gasto', ordem: 0 });
  await repo.salvarBanco({ boxId: box2.id, nome: 'Banco Três', ordem: 0 });
  const banco2dois = await repo.salvarBanco({ boxId: box2.id, nome: 'Banco Quatro', ordem: 1 });
  // Define banco 2 como padrão na segunda box
  await repo.definirBancoPadrao(banco2dois.id);

  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box1.id, hoje: '2026-07-02' });

  const { rerender } = render(<TelaLancar />);

  // Começa com Banco Um marcado (padrão de box1)
  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'true');

  // Escolhe Banco Dois
  await userEvent.click(screen.getByRole('radio', { name: 'Banco Dois' }));
  expect(screen.getByRole('radio', { name: 'Banco Dois' })).toHaveAttribute('aria-checked', 'true');

  // Troca de box
  act(() => useApp.setState({ boxSel: box2.id }));
  rerender(<TelaLancar />);

  // Deve voltar ao padrão da nova box (Banco Quatro)
  expect(screen.getByRole('radio', { name: 'Banco Quatro' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('radio', { name: 'Banco Três' })).toHaveAttribute('aria-checked', 'false');
});

describe('lançamento repetido (Avançado)', () => {
  async function prepararComExistente() {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
    await repo.salvarLancamento({
      boxId: box.id, categoriaId: cat.id, data: '2026-07-02', valor: 4500, nota: 'almoço',
      status: 'efetivo',
    });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
  }
  async function preencher(valor: string) {
    await userEvent.type(screen.getByLabelText('Valor'), valor);
    await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
  }

  it('sem lançamento igual, salva direto', async () => {
    await prepararComExistente();
    render(<TelaLancar />);
    await preencher('45,01');
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    expect(screen.queryByText('Lançamento repetido?')).not.toBeInTheDocument();
    expect(await db.lancamentos.count()).toBe(2);
  });

  it('com lançamento igual, abre a confirmação e não salva', async () => {
    await prepararComExistente();
    render(<TelaLancar />);
    await preencher('45,00');
    expect(await screen.findByText('Lançamento repetido?')).toBeInTheDocument();
    expect(screen.getByText(/“almoço”/)).toBeInTheDocument();
    expect(await db.lancamentos.count()).toBe(1);
  });

  it('Cancelar fecha sem salvar e mantém o formulário', async () => {
    await prepararComExistente();
    render(<TelaLancar />);
    await preencher('45,00');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await db.lancamentos.count()).toBe(1);
    expect(screen.getByLabelText('Valor')).toHaveValue(formatarBRL(4500));
  });

  it('Lançar mesmo assim salva uma vez', async () => {
    await prepararComExistente();
    render(<TelaLancar />);
    await preencher('45,00');
    await userEvent.click(await screen.findByRole('button', { name: 'Lançar mesmo assim' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    expect(await db.lancamentos.count()).toBe(2);
  });

  it('toque duplo em Lançar salva uma vez só', async () => {
    await prepararComExistente();
    render(<TelaLancar />);
    await userEvent.type(screen.getByLabelText('Valor'), '45,01');
    await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
    await userEvent.dblClick(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    expect(await db.lancamentos.count()).toBe(2);
  });
});
