import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { db } from '../db/database';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { formatarBRL } from '../domain/money';
import { useApp } from '../state/store';
import AdicionarSheet from './AdicionarSheet';

beforeEach(async () => {
  await limparDb();
});

async function montarBox() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  return box;
}

it('escolher "Lançamento" fecha o sheet e troca para a aba Lançar', async () => {
  const box = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, aba: 'cartao' });
  const onFechar = vi.fn();
  render(<AdicionarSheet aberto onFechar={onFechar} />);

  await userEvent.click(screen.getByText('Lançamento'));
  expect(onFechar).toHaveBeenCalledOnce();
  expect(useApp.getState().aba).toBe('lancar');
});

it('sem cartão cadastrado: "Compra no cartão" mostra aviso e leva para Ajustes', async () => {
  const box = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  const onFechar = vi.fn();
  render(<AdicionarSheet aberto onFechar={onFechar} />);

  await userEvent.click(screen.getByText('Compra no cartão'));
  expect(await screen.findByRole('heading', { name: 'Nenhum cartão cadastrado' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Cadastrar cartão' }));
  expect(onFechar).toHaveBeenCalledOnce();
  expect(useApp.getState().aba).toBe('ajustes');
});

it('cartão único bloqueado para compra mostra aviso específico, não "nenhum cartão cadastrado"', async () => {
  const box = await montarBox();
  const nubank = await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await repo.salvarCartao({ ...nubank, permiteCompra: false }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  const onFechar = vi.fn();
  render(<AdicionarSheet aberto onFechar={onFechar} />);

  await userEvent.click(screen.getByText('Compra no cartão'));
  expect(await screen.findByRole('heading', { name: 'Nenhum cartão liberado para compra' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Ir para Ajustes' }));
  expect(onFechar).toHaveBeenCalledOnce();
  expect(useApp.getState().aba).toBe('ajustes');
});

it('1 cartão ativo: "Compra no cartão" pula direto para o formulário', async () => {
  const box = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(screen.getByText('Compra no cartão'));
  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
});

it('2+ cartões ativos: "Compra no cartão" mostra lista de escolha antes do formulário', async () => {
  const box = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await repo.salvarCartao({
    boxId: box.id, nome: 'Inter', diaFechamento: 20, diaVencimento: 28,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(screen.getByText('Compra no cartão'));
  expect(await screen.findByRole('heading', { name: 'Compra em qual cartão?' })).toBeInTheDocument();
  await userEvent.click(screen.getByText('Inter'));
  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
});

it('cartão bloqueado para compra não aparece na escolha, mesmo ativo', async () => {
  const box = await montarBox();
  const nubank = await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await repo.salvarCartao({ ...nubank, permiteCompra: false }, '2027-12-31');
  await repo.salvarCartao({
    boxId: box.id, nome: 'Inter', diaFechamento: 20, diaVencimento: 28,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(screen.getByText('Compra no cartão'));
  // só o Inter está disponível: pula direto pro formulário, sem passar pela escolha
  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Compra em qual cartão?' })).not.toBeInTheDocument();
});

async function montarComHistorico() {
  const box = await montarBox();
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Cartão A', diaFechamento: 20, diaVencimento: 28,
  }, '2027-12-31');
  // um segundo cartão ativo: com só um cartão, "Compra no cartão" também pularia a
  // escolha, e a asserção "sem passar pela escolha de cartão" ficaria vácua.
  await repo.salvarCartao({
    boxId: box.id, nome: 'Cartão B', diaFechamento: 10, diaVencimento: 17,
  }, '2027-12-31');
  const catCartao = await repo.salvarCategoriaCartao({
    cartaoId: cartao.id, nome: 'Farmácia', ordem: 0,
  });
  const catBox = await repo.salvarCategoria({
    boxId: box.id, nome: 'Café', tipo: 'gasto', ordem: 0,
  });
  await repo.salvarLancamento({
    boxId: box.id, categoriaId: catBox.id, data: '2026-08-10', valor: 850, status: 'efetivo',
  });
  await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-08-12',
    valorTotal: 6240, parcelas: 1,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-08-20' });
  return { box, cartao, catBox, catCartao };
}

it('sem histórico, a faixa de frequentes não aparece', async () => {
  const box = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-08-20' });
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  expect(await screen.findByText('Lançamento')).toBeInTheDocument();
  expect(screen.queryByText('Frequentes')).not.toBeInTheDocument();
});

it('chip de cartão abre o formulário preenchido, sem escolher cartão', async () => {
  await montarComHistorico();
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(await screen.findByRole('button', { name: /Farmácia/ }));

  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
  // o passo "Compra em qual cartão?" não pode ter acontecido
  expect(screen.queryByRole('heading', { name: 'Compra em qual cartão?' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Farmácia' })).toHaveClass('selecionada');
  expect(await screen.findByLabelText('Valor')).toHaveValue(formatarBRL(6240));
});

it('chip de box fecha a sheet, vai para Lançar e grava o rascunho', async () => {
  const { catBox } = await montarComHistorico();
  const onFechar = vi.fn();
  useApp.setState({ aba: 'hoje' });
  render(<AdicionarSheet aberto onFechar={onFechar} />);

  await userEvent.click(await screen.findByRole('button', { name: /Café/ }));

  expect(onFechar).toHaveBeenCalledOnce();
  expect(useApp.getState().aba).toBe('lancar');
  expect(useApp.getState().rascunhoLancar).toEqual({ categoriaId: catBox.id, valorCent: 850 });
});

it('o chip diz de que cartão é, para quem não enxerga o ponto azul', async () => {
  await montarComHistorico();
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  expect(await screen.findByRole('button', { name: 'Farmácia, no Cartão A, 62,40' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Café, nesta box, 8,50' })).toBeInTheDocument();
});

it('chip de cartão mostra o nome do cartão na folha, não só no aria-label', async () => {
  await montarComHistorico();
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(await screen.findByRole('button', { name: /Farmácia/ }));

  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
  expect(screen.getByText('Cartão A')).toBeInTheDocument();
});

async function montarComCartao() {
  const box = await montarBox();
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Cartão A', diaFechamento: 20, diaVencimento: 28,
  }, '2027-12-31');
  await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'Farmácia', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-08-20' });
  return { box, cartao };
}

it('ícone de câmera no cabeçalho abre o escaneamento de nota fiscal', async () => {
  await montarComCartao();
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: 'Compra por nota fiscal' }));

  expect(await screen.findByRole('heading', { name: 'Escanear nota fiscal' })).toBeInTheDocument();
});

it('nota fiscal escaneada, com um só cartão ativo, abre o formulário direto preenchido', async () => {
  await montarComCartao();
  render(<AdicionarSheet aberto onFechar={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: 'Compra por nota fiscal' }));

  await userEvent.type(await screen.findByLabelText('Chave de acesso'), '3'.repeat(44));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  const textarea = await screen.findByLabelText('Ou cole o texto do XML');
  fireEvent.change(textarea, {
    target: {
      value: '<nfeProc><NFe><infNFe>'
        + '<ide><dhEmi>2026-08-15T10:00:00-03:00</dhEmi></ide>'
        + '<emit><xNome>Mercado Exemplo LTDA</xNome></emit>'
        + '<total><ICMSTot><vNF>62.40</vNF></ICMSTot></total>'
        + '</infNFe></NFe></nfeProc>',
    },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
  expect(screen.getByLabelText('Valor')).toHaveValue(formatarBRL(6240));
  expect(screen.getByLabelText('Data')).toHaveValue('2026-08-15');
  expect(screen.getByLabelText('Descrição (opcional)')).toHaveValue('Mercado Exemplo LTDA');
  // nenhuma categoria vem do XML: a categoria existente não fica selecionada
  expect(screen.getByRole('button', { name: 'Farmácia' })).not.toHaveClass('selecionada');
});

it('cancelar o escaneamento volta pro menu', async () => {
  await montarComCartao();
  render(<AdicionarSheet aberto onFechar={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: 'Compra por nota fiscal' }));
  await screen.findByRole('heading', { name: 'Escanear nota fiscal' });

  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

  expect(await screen.findByRole('heading', { name: 'Adicionar' })).toBeInTheDocument();
});

it('itens da nota escaneada chegam até a compra salva', async () => {
  const XML_COM_ITENS = '<nfeProc><NFe><infNFe>'
    + '<ide><dhEmi>2026-08-15T10:00:00-03:00</dhEmi></ide>'
    + '<emit><xNome>Mercado Exemplo LTDA</xNome></emit>'
    + '<det><prod><xProd>Produto A</xProd><vProd>10.00</vProd></prod></det>'
    + '<det><prod><xProd>Produto B</xProd><vProd>52.40</vProd></prod></det>'
    + '<total><ICMSTot><vNF>62.40</vNF></ICMSTot></total>'
    + '</infNFe></NFe></nfeProc>';

  await montarComCartao();
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: 'Compra por nota fiscal' }));
  await userEvent.type(await screen.findByLabelText('Chave de acesso'), '3'.repeat(44));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  fireEvent.change(await screen.findByLabelText('Ou cole o texto do XML'), { target: { value: XML_COM_ITENS } });
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
  expect(screen.getByLabelText('Descrição (opcional)')).toHaveValue('Mercado Exemplo LTDA');
  await userEvent.click(screen.getByRole('button', { name: 'Farmácia' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(async () => {
    expect(await db.notasFiscais.count()).toBe(1);
  });
  const [nota] = await db.notasFiscais.toArray();
  const [compraSalva] = await db.comprasCartao.toArray();
  expect(nota.itens).toHaveLength(2);
  expect(nota.emitente).toBe('Mercado Exemplo LTDA');
  expect(nota.compraCartaoId).toBe(compraSalva.id);
});
