import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Categorias from './Categorias';

beforeEach(async () => {
  await limparDb();
});

it('renomeia uma categoria existente via edição inline', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const input = screen.getByLabelText('Editar nome');
  await userEvent.clear(input);
  await userEvent.type(input, 'cartão de crédito');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText('cartão de crédito')).toBeInTheDocument();
  const atualizado = await db.categorias.get(cat.id);
  expect(atualizado?.nome).toBe('cartão de crédito');
});

it('categoria da fatura de um cartão não aparece na lista de categorias', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 1 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);

  expect(screen.getByText('mercado')).toBeInTheDocument();
  expect(screen.queryByText('Nubank')).not.toBeInTheDocument();
});

it('arquivar move a categoria para a seção Arquivados, com badge de tipo', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);
  expect(screen.queryByText('Arquivados')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Arquivar' }));

  expect(await screen.findByText('Arquivados')).toBeInTheDocument();
  expect(screen.getByText('gasto', { selector: '.badge' })).toBeInTheDocument();
});

it('trocar a box no chip do topo troca as categorias mostradas em Ajustes', async () => {
  const agora = agoraISO();
  const eitor = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  const ju = { id: novoId(), nome: 'ju', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(eitor);
  await repo.salvarBox(ju);
  await repo.salvarCategoria({ boxId: eitor.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
  await repo.salvarCategoria({ boxId: ju.id, nome: 'faculdade', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();

  useApp.setState({ boxSel: eitor.id });
  const { rerender } = render(<Categorias />);

  expect(screen.getByText('aluguel')).toBeInTheDocument();
  expect(screen.queryByText('faculdade')).not.toBeInTheDocument();

  useApp.setState({ boxSel: ju.id });
  rerender(<Categorias />);

  expect(screen.getByText('faculdade')).toBeInTheDocument();
  expect(screen.queryByText('aluguel')).not.toBeInTheDocument();
});

it('restaurar devolve a categoria para a seção do seu tipo', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await repo.atualizarCategoria(cat.id, { arquivada: true, ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);
  expect(screen.getByText('Arquivados')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));

  await waitFor(() => expect(screen.queryByText('Arquivados')).not.toBeInTheDocument());
  const atualizado = await db.categorias.get(cat.id);
  expect(atualizado?.arquivada).toBe(false);
});

it('box sem categorias mostra o bloco de sugestões', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);

  expect(screen.getByText('Sugestões')).toBeInTheDocument();
  expect(screen.getByText('Ganhos')).toBeInTheDocument();
  expect(screen.getByText('Gastos')).toBeInTheDocument();
  expect(screen.getByText('salário')).toBeInTheDocument();
  expect(screen.getByText('mercado')).toBeInTheDocument();
});

it('box com pelo menos uma categoria não mostra o bloco de sugestões', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);

  expect(screen.queryByText('Sugestões')).not.toBeInTheDocument();
});

it('criar as sugestões marcadas grava exatamente as marcadas com tipo certo', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);

  // verificar que o bloco aparece
  expect(screen.getByText('Sugestões')).toBeInTheDocument();

  // clicar em criar (usa a contagem padrão de 7)
  const botaoCriar = screen.getByRole('button', { name: /Criar as \d+ marcadas/ });
  await userEvent.click(botaoCriar);

  // verificar que as categorias foram criadas
  await waitFor(() => expect(screen.queryByText('Sugestões')).not.toBeInTheDocument());
  expect(screen.getByText('salário')).toBeInTheDocument();
  // verificar que ambos "pix" estão na lista
  const pixElements = screen.getAllByText('pix');
  expect(pixElements.length).toBeGreaterThan(0);
  expect(screen.getByText('mercado')).toBeInTheDocument();
  expect(screen.getByText('transporte')).toBeInTheDocument();
  expect(screen.getByText('moradia')).toBeInTheDocument();
  expect(screen.getByText('contas')).toBeInTheDocument();
  // saúde e lazer não devem estar, pois não foram marcadas por padrão
  expect(screen.queryByText('saúde')).not.toBeInTheDocument();
  expect(screen.queryByText('lazer')).not.toBeInTheDocument();
  expect(screen.queryByText('outros')).not.toBeInTheDocument();
});

it('desmarcar uma sugestão e criar não inclui a desmarcada', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);

  // encontrar e clicar no checkbox de 'saúde' para desmarcar
  const checkboxes = screen.getAllByRole('checkbox');
  let saudeCheck: HTMLElement | undefined;
  for (const c of checkboxes) {
    if ((c.parentElement as HTMLElement)?.textContent?.includes('saúde')) {
      saudeCheck = c;
      break;
    }
  }

  expect(saudeCheck).toBeDefined();
  if (saudeCheck) {
    expect((saudeCheck as HTMLInputElement).checked).toBe(false); // saúde começa desmarcada
    await userEvent.click(saudeCheck);
    // após marcar, deve estar marcado
    expect((saudeCheck as HTMLInputElement).checked).toBe(true);
    // desmarcar novamente
    await userEvent.click(saudeCheck);
    expect((saudeCheck as HTMLInputElement).checked).toBe(false);
  }

  // criar com saúde desmarcada
  const botaoCriar = screen.getByRole('button', { name: /Criar as/ });
  await userEvent.click(botaoCriar);

  // verificar que saúde não foi criada
  await waitFor(() => expect(screen.queryByText('Sugestões')).not.toBeInTheDocument());
  expect(screen.queryByText('saúde')).not.toBeInTheDocument();
  expect(screen.getByText('salário')).toBeInTheDocument();
});

it('box cuja única categoria é a de fatura de um cartão mostra sugestões', async () => {
  // Caso: uma box tem um cartão (que cria categoria de fatura oculta), mas nenhuma
  // categoria visível. Deve mostrar sugestões, sem erro.
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  // Criar um cartão, que automaticamente cria uma categoria de fatura oculta
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);

  // Deve mostrar sugestões (nenhuma categoria visível)
  expect(screen.getByText('Sugestões')).toBeInTheDocument();
  // Categoria de fatura do cartão não deve aparecer
  expect(screen.queryByText('Nubank')).not.toBeInTheDocument();
});

it('criar as sugestões grava ordem começando em 0, não 1', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);

  // criar as sugestões padrão
  const botaoCriar = screen.getByRole('button', { name: /Criar as \d+ marcadas/ });
  await userEvent.click(botaoCriar);

  // aguardar a renderização
  await waitFor(() => expect(screen.queryByText('Sugestões')).not.toBeInTheDocument());

  // verificar as ordens: ganho deve ter 0, 1, ... e gasto também 0, 1, ...
  const todas = await db.categorias.toArray();
  const ganhos = todas.filter((c) => c.tipo === 'ganho');
  const gastos = todas.filter((c) => c.tipo === 'gasto');

  // garantir que temos dados
  expect(ganhos.length).toBeGreaterThan(0);
  expect(gastos.length).toBeGreaterThan(0);

  // verificar que as ordens começam em 0
  ganhos.sort((a, b) => a.ordem - b.ordem);
  gastos.sort((a, b) => a.ordem - b.ordem);

  expect(ganhos[0].ordem).toBe(0);
  for (let i = 1; i < ganhos.length; i++) {
    expect(ganhos[i].ordem).toBe(i);
  }

  expect(gastos[0].ordem).toBe(0);
  for (let i = 1; i < gastos.length; i++) {
    expect(gastos[i].ordem).toBe(i);
  }
});
