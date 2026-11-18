import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import CategoriasCartao from './CategoriasCartao';

// O arrasto do framer-motion não roda no jsdom. Este mock deixa o `onReorder` de cada
// `Reorder.Group` ao alcance do teste, indexado pelos ids dos itens na ordem renderizada.
const captura = vi.hoisted(() => ({
  porIds: new Map<string, (novaOrdem: unknown[]) => unknown>(),
}));

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  const React = await import('react');
  const Group = (props: { values: { id: string }[]; onReorder: (novaOrdem: unknown[]) => unknown }) => {
    captura.porIds.set(props.values.map((v) => v.id).join(','), props.onReorder);
    return React.createElement(actual.Reorder.Group, props as never);
  };
  return { ...actual, Reorder: { ...actual.Reorder, Group } };
});

beforeEach(async () => {
  await limparDb();
  useApp.setState({ retorno: null });
});

async function prepararCartao() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  return cartao;
}

async function prepararBoxComCartao(nomeBox: string, nomeCartao: string) {
  const agora = agoraISO();
  const box = { id: novoId(), nome: nomeBox, saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({ boxId: box.id, nome: nomeCartao, diaFechamento: 10, diaVencimento: 20 }, '2027-12-31');
  return { box, cartao };
}

it('renomeia uma categoria de cartão existente via edição inline', async () => {
  const cartao = await prepararCartao();
  const cat = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const input = screen.getByLabelText('Editar nome');
  await userEvent.clear(input);
  await userEvent.type(input, 'supermercado');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText('supermercado')).toBeInTheDocument();
  const atualizado = await db.categoriasCartao.get(cat.id);
  expect(atualizado?.nome).toBe('supermercado');
});

it('arquivar move a categoria de cartão para a seção Arquivadas', async () => {
  const cartao = await prepararCartao();
  await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);
  expect(screen.queryByText('Arquivadas')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Arquivar' }));

  expect(await screen.findByText('Arquivadas')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Restaurar' })).toBeInTheDocument();
});

it('restaurar devolve a categoria de cartão pra lista ativa', async () => {
  const cartao = await prepararCartao();
  const cat = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await repo.atualizarCategoriaCartao(cat.id, { arquivada: true, ordem: 0 });
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);
  expect(screen.getByText('Arquivadas')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));

  await waitFor(() => expect(screen.queryByText('Arquivadas')).not.toBeInTheDocument());
  const atualizado = await db.categoriasCartao.get(cat.id);
  expect(atualizado?.arquivada).toBe(false);
});

it('categoria automática de assinaturas não aparece na lista de categorias do cartão', async () => {
  const cartao = await prepararCartao();
  await repo.categoriaAssinaturasDe(cartao.id);
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);

  expect(screen.queryByText('Assinaturas')).not.toBeInTheDocument();
});

it('trocar a box no chip do topo troca os cartões oferecidos no seletor de Categorias do cartão', async () => {
  const { box: eitor } = await prepararBoxComCartao('eitor', 'Nubank');
  const { box: ju } = await prepararBoxComCartao('ju', 'Santander');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: eitor.id });

  const { rerender } = render(<CategoriasCartao />);

  expect(screen.getByRole('radio', { name: 'Nubank' })).toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Santander' })).not.toBeInTheDocument();

  act(() => { useApp.setState({ boxSel: ju.id }); });
  rerender(<CategoriasCartao />);

  expect(screen.getByRole('radio', { name: 'Santander' })).toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Nubank' })).not.toBeInTheDocument();
});

it('trocar de cartão pela pílula com um item aberto traz "Nova categoria do cartão" de volta', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cartaoA = await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await repo.salvarCartao({ boxId: box.id, nome: 'Inter', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31');
  await repo.salvarCategoriaCartao({ cartaoId: cartaoA.id, nome: 'mercado', ordem: 0 });
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);
  // Qual cartão vem selecionado por padrão não é garantido (a ordem de `dados.cartoes` segue
  // a chave primária, não a ordem de criação) — seleciona o Nubank explicitamente, que é o
  // dono da categoria "mercado" usada no teste.
  await userEvent.click(screen.getByRole('radio', { name: 'Nubank' }));
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  expect(screen.queryByText('Nova categoria do cartão')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('radio', { name: 'Inter' }));

  expect(screen.getByText('Nova categoria do cartão')).toBeInTheDocument();
});

it('toca no lápis para editar: abre os campos dentro do item e some "Nova categoria do cartão"', async () => {
  const cartao = await prepararCartao();
  await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);

  expect(screen.getByText('Nova categoria do cartão')).toBeInTheDocument();
  const item = screen.getByText('mercado').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));

  expect(screen.queryByText('Nova categoria do cartão')).not.toBeInTheDocument();
  expect(within(item).getByLabelText('Editar nome')).toHaveValue('mercado');
});

it('no item aberto, os botões aparecem na ordem Cancelar, Salvar', async () => {
  const cartao = await prepararCartao();
  await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);
  const item = screen.getByText('mercado').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));

  const botoes = within(item).getAllByRole('button');
  const nomes = botoes.map((b) => b.textContent);
  expect(nomes.indexOf('Cancelar')).toBeLessThan(nomes.indexOf('Salvar'));
  expect(within(item).getByRole('button', { name: 'Salvar' })).toHaveClass('botao-primario');
});

it('cancelar fecha o item sem gravar e traz "Nova categoria do cartão" de volta', async () => {
  const cartao = await prepararCartao();
  const cat = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);
  const item = screen.getByText('mercado').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  const input = within(item).getByLabelText('Editar nome');
  await userEvent.clear(input);
  await userEvent.type(input, 'outro nome');
  await userEvent.click(within(item).getByRole('button', { name: 'Cancelar' }));

  expect(screen.getByText('Nova categoria do cartão')).toBeInTheDocument();
  expect(screen.getByText('mercado')).toBeInTheDocument();
  const atual = await db.categoriasCartao.get(cat.id);
  expect(atual?.nome).toBe('mercado');
});

it('criar ou salvar sem nome avisa embaixo dos botões', async () => {
  const cartao = await prepararCartao();
  const cat = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await useApp.getState().iniciar();
  render(<CategoriasCartao />);
  const criar = await screen.findByRole('button', { name: 'Criar' });
  await userEvent.click(criar);
  expect(screen.getByText('Dê um nome à categoria para criar.').previousElementSibling).toContainElement(criar);

  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  await userEvent.clear(screen.getByLabelText('Editar nome'));
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  expect(screen.getByText('Dê um nome à categoria para salvar.')).toBeInTheDocument();
  expect((await db.categoriasCartao.get(cat.id))?.nome).toBe('mercado');
});

it('sem cartão, o aviso leva a Ajustes → Cartões', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<CategoriasCartao />);
  expect(screen.getByText('Cadastre um cartão primeiro.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Cadastrar cartão' }));
  expect(useApp.getState().ajustesSecao).toBe('cartoes');
});

describe('retorno ao salvar', () => {
  it('criar uma categoria de cartão avisa "Categoria criada"', async () => {
    await prepararCartao();
    await useApp.getState().iniciar();
    render(<CategoriasCartao />);
    await userEvent.type(await screen.findByLabelText('Nome'), 'lazer');
    await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

    await waitFor(() => expect(useApp.getState().retorno?.texto).toBe('Categoria criada'));
  });

  it('criar sem nome não avisa', async () => {
    await prepararCartao();
    await useApp.getState().iniciar();
    render(<CategoriasCartao />);
    await userEvent.click(await screen.findByRole('button', { name: 'Criar' }));

    expect(await screen.findByText('Dê um nome à categoria para criar.')).toBeInTheDocument();
    expect(useApp.getState().retorno).toBeNull();
  });

  it('editar uma categoria de cartão avisa "Categoria salva"', async () => {
    const cartao = await prepararCartao();
    await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    await useApp.getState().iniciar();
    render(<CategoriasCartao />);
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await userEvent.clear(screen.getByLabelText('Editar nome'));
    await userEvent.type(screen.getByLabelText('Editar nome'), 'supermercado');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(useApp.getState().retorno?.texto).toBe('Categoria salva'));
  });

  it('salvar a edição com o nome apagado não avisa', async () => {
    const cartao = await prepararCartao();
    await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    await useApp.getState().iniciar();
    render(<CategoriasCartao />);
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await userEvent.clear(screen.getByLabelText('Editar nome'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Dê um nome à categoria para salvar.')).toBeInTheDocument();
    expect(useApp.getState().retorno).toBeNull();
  });

  it('arquivar avisa "Categoria arquivada" e restaurar avisa "Categoria restaurada"', async () => {
    const cartao = await prepararCartao();
    await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    await useApp.getState().iniciar();
    render(<CategoriasCartao />);

    await userEvent.click(screen.getByRole('button', { name: 'Arquivar' }));
    await waitFor(() => expect(useApp.getState().retorno?.texto).toBe('Categoria arquivada'));

    await userEvent.click(await screen.findByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(useApp.getState().retorno?.texto).toBe('Categoria restaurada'));
  });
});

describe('reordenar não avisa', () => {
  it('reordenar categorias de cartão grava a nova ordem e não avisa', async () => {
    const cartao = await prepararCartao();
    const a = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    const b = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'lazer', ordem: 1 });
    await useApp.getState().iniciar();
    render(<CategoriasCartao />);

    const reordenar = captura.porIds.get(`${a.id},${b.id}`);
    expect(reordenar).toBeDefined();
    await act(async () => {
      await reordenar!([b, a]);
    });

    await waitFor(async () => expect((await db.categoriasCartao.get(b.id))?.ordem).toBe(0));
    expect((await db.categoriasCartao.get(a.id))?.ordem).toBe(1);
    expect(useApp.getState().retorno).toBeNull();
  });
});
