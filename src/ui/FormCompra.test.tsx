import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { formatarBRL } from '../domain/money';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import FormCompra from './FormCompra';

beforeEach(async () => {
  await limparDb();
});

async function montarCartao() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  return { box, cartao, catCartao };
}

it('cria uma compra parcelada', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao } = await montarCartao();
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    const onFechar = vi.fn();
    render(<FormCompra cartao={cartao} onFechar={onFechar} />);
    expect(screen.getByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Valor'), '100,00');
    await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
    await userEvent.clear(screen.getByLabelText('Parcelas'));
    await userEvent.type(screen.getByLabelText('Parcelas'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(onFechar).toHaveBeenCalledOnce();
    });
    const compras = await db.comprasCartao.toArray();
    expect(compras).toHaveLength(1);
    expect(compras[0]).toMatchObject({ valorTotal: 10000, parcelas: 3 });
  } finally { vi.useRealTimers(); }
});

it('campo Parcelas já pagas só aparece com 2 parcelas ou mais', async () => {
  const { box, cartao } = await montarCartao();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

  render(<FormCompra cartao={cartao} onFechar={() => {}} />);
  expect(screen.queryByLabelText('Parcelas já pagas')).not.toBeInTheDocument();
  const parcelas = screen.getByLabelText('Parcelas');
  fireEvent.change(parcelas, { target: { value: '3' } });
  expect(screen.getByLabelText('Parcelas já pagas')).toBeEnabled();
  fireEvent.change(parcelas, { target: { value: '1' } });
  expect(screen.queryByLabelText('Parcelas já pagas')).not.toBeInTheDocument();
});

it('editar uma compra existente mostra "Editar compra" e o botão Excluir', async () => {
  const { box, cartao, catCartao } = await montarCartao();
  const compra = await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-01',
    valorTotal: 8000, parcelas: 1,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Editar compra' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
});

it('editar uma compra existente mostra o valor atual formatado e permite trocá-lo', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao();
    const compra = await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-01',
      valorTotal: 8000, parcelas: 1,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    const onFechar = vi.fn();
    render(<FormCompra cartao={cartao} compra={compra} onFechar={onFechar} />);

    // Campo de valor deve mostrar o valor inicial formatado como R$ 80,00
    const inputValor = screen.getByLabelText('Valor') as HTMLInputElement;
    expect(inputValor.value).toContain('80,00');

    // Focar e limpar o valor usando backspace 4 vezes (para 8000 centavos)
    await userEvent.click(inputValor);
    for (let i = 0; i < 4; i++) {
      await userEvent.keyboard('{Backspace}');
    }

    // Digitar um novo valor (5000 centavos = 50,00)
    await userEvent.type(inputValor, '5000');

    // Verificar que o novo valor está exibido como R$ 50,00
    expect(inputValor.value).toContain('50,00');

    // Salvar
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(onFechar).toHaveBeenCalledOnce();
    });

    // Verificar que a compra foi atualizada
    const compras = await db.comprasCartao.toArray();
    expect(compras).toHaveLength(1);
    expect(compras[0]).toMatchObject({ valorTotal: 5000, parcelas: 1 });
  } finally { vi.useRealTimers(); }
});

it('checkbox de viagem aparece marcado quando a data cai no período de uma viagem e marca a compra', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao } = await montarCartao();
    const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    const onFechar = vi.fn();
    render(<FormCompra cartao={cartao} onFechar={onFechar} />);
    const checkbox = screen.getByLabelText(`Viagem: ${viagem.nome}`) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    await userEvent.type(screen.getByLabelText('Valor'), '100,00');
    await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onFechar).toHaveBeenCalledOnce());
    const compras = await db.comprasCartao.toArray();
    expect(compras[0].viagemId).toBe(viagem.id);
  } finally { vi.useRealTimers(); }
});

it('checkbox de viagem some quando a data está fora do período', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao } = await montarCartao();
    const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    render(<FormCompra cartao={cartao} onFechar={() => {}} />);
    expect(screen.getByLabelText(`Viagem: ${viagem.nome}`)).toBeInTheDocument();

    const inputData = screen.getByLabelText('Data') as HTMLInputElement;
    await userEvent.clear(inputData);
    await userEvent.type(inputData, '2026-08-01');
    expect(screen.queryByLabelText(`Viagem: ${viagem.nome}`)).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('desmarcar o checkbox de viagem não marca a compra', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao } = await montarCartao();
    const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    const onFechar = vi.fn();
    render(<FormCompra cartao={cartao} onFechar={onFechar} />);
    await userEvent.click(screen.getByLabelText(`Viagem: ${viagem.nome}`));

    await userEvent.type(screen.getByLabelText('Valor'), '100,00');
    await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onFechar).toHaveBeenCalledOnce());
    const compras = await db.comprasCartao.toArray();
    expect(compras[0].viagemId).toBeUndefined();
  } finally { vi.useRealTimers(); }
});

it('editar uma compra já marcada com viagem preserva o checkbox marcado ao abrir o form', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao();
    const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
    const compra = await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-02',
      valorTotal: 8000, parcelas: 1, viagemId: viagem.id,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);
    const checkbox = screen.getByLabelText(`Viagem: ${viagem.nome}`) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  } finally { vi.useRealTimers(); }
});

it('desmarcar o checkbox ao editar uma compra já marcada remove a tag de viagem', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao();
    const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
    const compra = await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-02',
      valorTotal: 8000, parcelas: 1, viagemId: viagem.id,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    const onFechar = vi.fn();
    render(<FormCompra cartao={cartao} compra={compra} onFechar={onFechar} />);
    await userEvent.click(screen.getByLabelText(`Viagem: ${viagem.nome}`));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onFechar).toHaveBeenCalledOnce());
    const atualizada = await db.comprasCartao.get(compra.id);
    expect(atualizada?.viagemId).toBeUndefined();
  } finally { vi.useRealTimers(); }
});

it('digitar Parcelas já pagas recalcula Data para trás em meses', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao } = await montarCartao();
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    render(<FormCompra cartao={cartao} onFechar={() => {}} />);
    const inputData = screen.getByLabelText('Data') as HTMLInputElement;
    const inputParcelas = screen.getByLabelText('Parcelas');

    // Inicialmente, data é 'hoje' (2026-07-01)
    expect(inputData.value).toBe('2026-07-01');

    // Definir 3 parcelas
    await userEvent.clear(inputParcelas);
    await userEvent.type(inputParcelas, '3');
    // O campo só aparece com 2 parcelas ou mais.
    const inputParcelasPagas = screen.getByLabelText('Parcelas já pagas');

    // Digitar 2 em "Parcelas já pagas"
    await userEvent.type(inputParcelasPagas, '2');

    // Data deve recalcular para 2 meses antes (2026-05-01)
    expect(inputData.value).toBe('2026-05-01');
  } finally {
    vi.useRealTimers();
  }
});

it('limpar Parcelas já pagas NÃO reverte Data ao valor original', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao } = await montarCartao();
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    render(<FormCompra cartao={cartao} onFechar={() => {}} />);
    const inputData = screen.getByLabelText('Data') as HTMLInputElement;
    const inputParcelas = screen.getByLabelText('Parcelas');

    // Inicialmente, data é 'hoje' (2026-07-01)
    expect(inputData.value).toBe('2026-07-01');

    // Definir 3 parcelas
    await userEvent.clear(inputParcelas);
    await userEvent.type(inputParcelas, '3');
    // O campo só aparece com 2 parcelas ou mais.
    const inputParcelasPagas = screen.getByLabelText('Parcelas já pagas');

    // Digitar 2 em "Parcelas já pagas"
    await userEvent.type(inputParcelasPagas, '2');
    expect(inputData.value).toBe('2026-05-01');

    // Limpar "Parcelas já pagas"
    await userEvent.clear(inputParcelasPagas);

    // Data permanece em 2026-05-01 (não reverte para 2026-07-01)
    expect(inputData.value).toBe('2026-05-01');
  } finally {
    vi.useRealTimers();
  }
});

it('categoria automática de assinaturas não aparece no grid de categoria da compra', async () => {
  const { box, cartao } = await montarCartao();
  await repo.categoriaAssinaturasDe(cartao.id);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

  render(<FormCompra cartao={cartao} onFechar={() => {}} />);

  expect(screen.queryByRole('button', { name: 'Assinaturas' })).not.toBeInTheDocument();
});

it('inicial semeia valor e categoria de uma compra nova', async () => {
  const { box, cartao, catCartao } = await montarCartao();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

  render(
    <FormCompra
      cartao={cartao}
      inicial={{ valorTotal: 6240, categoriaCartaoId: catCartao.id }}
      onFechar={() => {}}
    />,
  );

  expect(await screen.findByRole('button', { name: 'mercado' })).toHaveClass('selecionada');
  expect(screen.getByLabelText('Valor')).toHaveValue(formatarBRL(6240));
  expect(screen.getByLabelText('Parcelas')).toHaveValue(1);
});

it('editando uma compra, inicial é ignorado', async () => {
  const { box, cartao, catCartao } = await montarCartao();
  const outra = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'posto', ordem: 1 });
  const compra = await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-06-10',
    valorTotal: 10000, parcelas: 3,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

  render(
    <FormCompra
      cartao={cartao}
      compra={compra}
      inicial={{ valorTotal: 6240, categoriaCartaoId: outra.id }}
      onFechar={() => {}}
    />,
  );

  // a compra que está sendo editada manda; inicial não pode sobrescrever dado gravado
  expect(await screen.findByRole('button', { name: 'mercado' })).toHaveClass('selecionada');
  expect(screen.getByLabelText('Valor')).toHaveValue(formatarBRL(10000));
  expect(screen.getByLabelText('Parcelas')).toHaveValue(3);
});

it('inicial semeia também data e descrição, vindas de uma nota fiscal escaneada', async () => {
  const { box, cartao } = await montarCartao();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

  render(
    <FormCompra
      cartao={cartao}
      inicial={{ valorTotal: 6240, data: '2026-06-15', descricao: 'Mercado Exemplo LTDA' }}
      onFechar={() => {}}
    />,
  );

  expect(screen.getByLabelText('Valor')).toHaveValue(formatarBRL(6240));
  expect(screen.getByLabelText('Data')).toHaveValue('2026-06-15');
  expect(screen.getByLabelText('Descrição (opcional)')).toHaveValue('Mercado Exemplo LTDA');
  // sem categoriaCartaoId no inicial: a categoria existente não fica selecionada
  expect(screen.getByRole('button', { name: 'mercado' })).not.toHaveClass('selecionada');
});

const XML_NOTA = `<?xml version="1.0"?>
<nfeProc><NFe><infNFe>
  <ide><dhEmi>2026-07-01T10:00:00-03:00</dhEmi></ide>
  <emit><xNome>Mercado Exemplo LTDA</xNome></emit>
  <det><prod><xProd>Produto A</xProd><qCom>1.0000</qCom><uCom>UN</uCom><vProd>20.00</vProd></prod></det>
  <det><prod><xProd>Produto B</xProd><qCom>2.0000</qCom><uCom>UN</uCom><vProd>60.00</vProd></prod></det>
  <total><ICMSTot><vNF>80.00</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;

async function compraSalva() {
  const { box, cartao, catCartao } = await montarCartao();
  const compra = await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catCartao.id,
    data: '2026-07-01', valorTotal: 10000, parcelas: 1,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
  return { cartao, compra };
}

it('cancelar o painel de anexar limpa o texto do XML ao reabrir', async () => {
  const { cartao, compra } = await compraSalva();
  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: 'Anexar nota fiscal' }));
  const textarea = await screen.findByLabelText('Ou cole o texto do XML');
  fireEvent.change(textarea, { target: { value: 'texto abandonado' } });
  const painel = textarea.closest('.nota-bloco') as HTMLElement;
  await userEvent.click(within(painel).getByRole('button', { name: 'Cancelar' }));

  await userEvent.click(screen.getByRole('button', { name: 'Anexar nota fiscal' }));
  expect(await screen.findByLabelText('Ou cole o texto do XML')).toHaveValue('');
});

it('anexa nota a uma compra salva sem mexer em valor nem data', async () => {
  const { cartao, compra } = await compraSalva();
  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: 'Anexar nota fiscal' }));
  fireEvent.change(await screen.findByLabelText('Ou cole o texto do XML'), { target: { value: XML_NOTA } });
  await userEvent.click(screen.getByRole('button', { name: 'Anexar' }));

  expect(await screen.findByText('Mercado Exemplo LTDA')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(async () => {
    await expect(db.notasFiscais.where('compraCartaoId').equals(compra.id).count()).resolves.toBe(1);
  });
  expect(await db.comprasCartao.get(compra.id)).toMatchObject({ valorTotal: 10000, data: '2026-07-01' });
});

it('a lista sai por valor decrescente e fecha com a linha de diferença', async () => {
  const { cartao, compra } = await compraSalva(); // compra de 100,00; nota soma 80,00
  await repo.salvarNotaFiscal({
    compraCartaoId: compra.id, emitente: 'Mercado Exemplo LTDA', emissao: '2026-07-01',
    totalNotaCent: 8000,
    itens: [
      { descricao: 'Produto A', valorCent: 2000 },
      { descricao: 'Produto B', valorCent: 6000 },
    ],
  });
  await useApp.getState().recarregar();

  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Ver itens' }));

  const linhas = await screen.findAllByRole('listitem');
  expect(linhas[0]).toHaveTextContent('Produto B');
  expect(linhas[1]).toHaveTextContent('Produto A');
  expect(linhas[2]).toHaveTextContent('Frete ou acréscimo');
  expect(linhas[0]).toHaveTextContent('60,0%');
});

it('sem diferença, a linha de diferença não aparece', async () => {
  const { cartao, compra } = await compraSalva();
  await repo.salvarNotaFiscal({
    compraCartaoId: compra.id, itens: [{ descricao: 'Produto A', valorCent: 10000 }],
  });
  await useApp.getState().recarregar();

  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Ver itens' }));

  expect(screen.queryByText('Frete ou acréscimo')).not.toBeInTheDocument();
  expect(screen.queryByText('Desconto')).not.toBeInTheDocument();
});

it('XML inválido mostra erro e não altera nada da compra', async () => {
  const { cartao, compra } = await compraSalva();
  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: 'Anexar nota fiscal' }));
  fireEvent.change(await screen.findByLabelText('Ou cole o texto do XML'), { target: { value: 'não é xml' } });
  await userEvent.click(screen.getByRole('button', { name: 'Anexar' }));

  expect(await screen.findByText('Não foi possível ler os itens desse XML.')).toBeInTheDocument();
  await expect(db.notasFiscais.count()).resolves.toBe(0);
  expect(await db.comprasCartao.get(compra.id)).toMatchObject({ valorTotal: 10000 });
});

it('remover a nota só vale depois de salvar', async () => {
  const { cartao, compra } = await compraSalva();
  await repo.salvarNotaFiscal({
    compraCartaoId: compra.id, itens: [{ descricao: 'Produto A', valorCent: 10000 }],
  });
  await useApp.getState().recarregar();

  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Remover' }));
  await expect(db.notasFiscais.count()).resolves.toBe(1); // ainda não

  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(async () => {
    await expect(db.notasFiscais.count()).resolves.toBe(0);
  });
});

// TAREFA 4: ORÇAMENTO DE VIAGEM NA TELA DE ADICIONAR

/** Cartão com uma viagem orçada em R$ 3.000,00 (cobrindo `hoje`) e R$ 1.200,00 já gastos
 *  nela por um lançamento efetivo — a fixture-base dos 2 casos de orçamento deste formulário. */
async function montarCartaoComViagemOrcada() {
  const { box, cartao, catCartao } = await montarCartao();
  const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
  await db.viagens.update(viagem.id, { orcamentoCent: 300000 });
  const catGasto = await repo.salvarCategoria({ boxId: box.id, nome: 'gasto', tipo: 'gasto', ordem: 1 });
  await repo.salvarLancamento({
    boxId: box.id, categoriaId: catGasto.id,
    data: '2026-07-02', valor: 120000, status: 'efetivo', viagemId: viagem.id,
  });
  return { box, cartao, catCartao, viagem };
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

/** Acha o <p> da linha do orçamento pelo texto completo — não por um trecho solto. */
function linhaOrcamento(texto: string) {
  return screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === texto);
}

it('linha orçamento viagem: nova compra soma ao gasto atual com o prefixo "Com este gasto"', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao } = await montarCartaoComViagemOrcada();
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    render(<FormCompra cartao={cartao} onFechar={() => {}} />);
    await userEvent.type(screen.getByLabelText('Valor'), '500,00');
    expect(linhaOrcamento(textoOrcamento(170000, 300000, true))).toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it('linha orçamento viagem: editar uma compra já marcada na viagem não conta o valor antigo em dobro', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao, viagem } = await montarCartaoComViagemOrcada();
    const compra = await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-01',
      valorTotal: 30000, parcelas: 1, viagemId: viagem.id,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);
    // gasto atual = 120000 (lançamento) + 30000 (esta compra) = 150000; editar desconta o
    // valor antigo (30000) antes de somar o novo — senão a compra contaria duas vezes.
    const inputValor = screen.getByLabelText('Valor') as HTMLInputElement;
    await userEvent.click(inputValor);
    for (let i = 0; i < 5; i++) await userEvent.keyboard('{Backspace}');
    await userEvent.type(inputValor, '40000');

    expect(linhaOrcamento(textoOrcamento(160000, 300000, true))).toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});
