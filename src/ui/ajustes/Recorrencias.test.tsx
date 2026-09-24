import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { formatarBRL } from '../../domain/money';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Recorrencias from './Recorrencias';

beforeEach(async () => {
  await limparDb();
});

// Relógio fixo: a recorrência ocorre em 2026-07-05, 08-05 e 09-05, e o teste exige que ao
// menos uma continue `previsto`. Fixar só o `hoje` do store não basta — o repo materializa
// pelo relógio real, então com a data real depois de 2026-09-05 as três viravam `efetivo` e
// o teste passava a falhar sozinho, por passagem de tempo e não por mudança de código.
it('edita o valor de uma recorrência existente e atualiza os previstos remanescentes', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-02T12:00:00'));
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
  } finally { vi.useRealTimers(); }
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
  useApp.setState({ hoje: '2026-07-02', boxSel: eitor.id });

  const { rerender } = render(<Recorrencias />);

  expect(screen.getByText('aluguel', { selector: 'div' })).toBeInTheDocument();
  expect(screen.queryByText('contas da casa', { selector: 'div' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'aluguel' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'contas da casa' })).not.toBeInTheDocument();

  act(() => { useApp.setState({ boxSel: conjunta.id }); });
  rerender(<Recorrencias />);

  expect(screen.getByText('contas da casa', { selector: 'div' })).toBeInTheDocument();
  expect(screen.queryByText('aluguel', { selector: 'div' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'contas da casa' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'aluguel' })).not.toBeInTheDocument();
});

it('box sem recorrência mostra cartão explicativo', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'assinatura', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-02' });

  render(<Recorrencias />);

  expect(screen.getByText('Recorrências geram previstos')).toBeInTheDocument();
  expect(screen.getByText(/Cada recorrência cria lançamentos automaticamente/)).toBeInTheDocument();
});

it('box com recorrência não mostra cartão explicativo', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'assinatura', tipo: 'gasto', ordem: 0 });
  await repo.salvarRecorrencia({
    boxId: box.id, categoriaId: cat.id, valor: 5000, dataInicio: '2026-07-01',
    diaDoMes: 5, parcelas: 3,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-02' });

  render(<Recorrencias />);

  expect(screen.queryByText('Recorrências geram previstos')).not.toBeInTheDocument();
  expect(screen.getByText('assinatura', { selector: 'div' })).toBeInTheDocument();
});

it('o formulário de criação não tem botão Cancelar', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'assinatura', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  render(<Recorrencias />);

  expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
});

it('depois de criar, tipo, categoria, início e dia continuam preenchidos — só valor e parcelas voltam ao padrão', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salário', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-02' });
  render(<Recorrencias />);

  await userEvent.click(screen.getByRole('radio', { name: 'Ganho' }));
  await userEvent.click(screen.getByRole('button', { name: 'salário' }));
  await userEvent.type(screen.getByLabelText('Valor'), '500000');
  await userEvent.clear(screen.getByLabelText('Início'));
  await userEvent.type(screen.getByLabelText('Início'), '2026-08-15');
  await userEvent.clear(screen.getByLabelText('Dia do mês'));
  await userEvent.type(screen.getByLabelText('Dia do mês'), '20');
  await userEvent.type(screen.getByLabelText('Parcelas'), '6');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  await waitFor(() => expect(screen.getByText('salário', { selector: 'div' })).toBeInTheDocument());

  expect(screen.getByRole('radio', { name: 'Ganho' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'salário' })).toHaveClass('selecionada');
  expect(screen.getByLabelText('Início')).toHaveValue('2026-08-15');
  expect((screen.getByLabelText('Dia do mês') as HTMLInputElement).value).toBe('20');
  expect(screen.getByLabelText('Valor')).toHaveValue(formatarBRL(0));
  expect((screen.getByLabelText('Parcelas') as HTMLInputElement).value).toBe('');
});

it('toca no lápis para editar: abre os campos dentro do item e some "Nova recorrência"', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'assinatura', tipo: 'gasto', ordem: 0 });
  await repo.salvarRecorrencia({
    boxId: box.id, categoriaId: cat.id, valor: 5000, dataInicio: '2026-07-01',
    diaDoMes: 5, parcelas: 3,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-02' });
  render(<Recorrencias />);

  expect(screen.getByText('Nova recorrência')).toBeInTheDocument();
  const item = screen.getByText('assinatura', { selector: 'div' }).closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));

  expect(screen.queryByText('Nova recorrência')).not.toBeInTheDocument();
  expect(within(item).getByLabelText('Valor')).toHaveValue(formatarBRL(5000));
});

it('no item aberto, os botões aparecem na ordem Cancelar, Salvar', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'assinatura', tipo: 'gasto', ordem: 0 });
  await repo.salvarRecorrencia({
    boxId: box.id, categoriaId: cat.id, valor: 5000, dataInicio: '2026-07-01',
    diaDoMes: 5, parcelas: 3,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-02' });
  render(<Recorrencias />);

  const item = screen.getByText('assinatura', { selector: 'div' }).closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));

  const botoes = within(item).getAllByRole('button');
  const nomes = botoes.map((b) => b.textContent);
  expect(nomes.indexOf('Cancelar')).toBeLessThan(nomes.indexOf('Salvar'));
  expect(within(item).getByRole('button', { name: 'Salvar' })).toHaveClass('botao-primario');
});

it('cancelar fecha o item sem gravar e traz "Nova recorrência" de volta', async () => {
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

  const item = screen.getByText('assinatura', { selector: 'div' }).closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  const valorInput = within(item).getByLabelText('Valor');
  await userEvent.clear(valorInput);
  await userEvent.type(valorInput, '99,00');
  await userEvent.click(within(item).getByRole('button', { name: 'Cancelar' }));

  expect(screen.getByText('Nova recorrência')).toBeInTheDocument();
  expect(within(item).getByText(formatarBRL(5000).replace(/\s/g, ' '))).toBeInTheDocument();
  const atual = await db.recorrencias.get(rec.id);
  expect(atual?.valor).toBe(5000);
});

it('criar sem valor e sem categoria avisa uma coisa por vez, embaixo dos botões', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  render(<Recorrencias />);
  const criar = screen.getByRole('button', { name: 'Criar' });
  await userEvent.click(criar);
  const aviso = screen.getByText('Digite um valor para criar.');
  expect(aviso.previousElementSibling).toContainElement(criar);
  await userEvent.type(screen.getByLabelText('Valor'), '100,00');
  await userEvent.click(criar);
  expect(screen.getByText('Escolha uma categoria para criar.')).toBeInTheDocument();
  expect(screen.queryByText('Digite um valor para criar.')).not.toBeInTheDocument();
  expect(await db.recorrencias.count()).toBe(0);
});
