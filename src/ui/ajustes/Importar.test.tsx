import 'fake-indexeddb/auto';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { limparDb } from '../../test-setup';
import { useApp } from '../../state/store';
import Importar from './Importar';

const CABECALHO = 'Data,Valor,Identificador,Descrição';

const CSV_DUAS_LINHAS = [
  CABECALHO,
  '20/08/2026,150.00,1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d,PAGAMENTO RECEBIDO',
  '21/08/2026,-45.00,2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e,LOJA GAMA',
].join('\n');

// Texto sintético no formato da fatura do Santander, com dois cartões (titular e virtual) —
// mesmo formato de `fixtures/santander-fatura.ts`, com "Vencimento" acrescentado: sem ele,
// `mesFaturaDoTexto` devolve `undefined` e a leitura é recusada.
const TEXTO_FATURA_DOIS_CARTOES = [
  'Vencimento 05/09/2026',
  'Detalhamento da Fatura',
  'FULANO DE TAL - 0000 XXXX XXXX 0000',
  'Despesas',
  'Compra Data Descrição Parcela R$ US$',
  '3 07/08 MERCADO ALFA 45,00',
  'VALOR TOTAL 45,00 0,00',
  '@ FULANO DE TAL - 1234 5678 9012 3456',
  'Despesas',
  'Compra Data Descrição Parcela R$ US$ 3 19/08 POSTO BETA 51,90',
  'VALOR TOTAL 51,90 0,00',
  '3/4',
].join('\n');

// A leitura real do PDF passa pelo pdf.js (`textoPdf.ts`); os testes deste arquivo não têm um
// PDF binário de verdade, então a extração de texto é substituída pelo texto sintético acima.
// É um `vi.fn()`, não uma função fixa, porque um teste abaixo precisa fazê-la falhar uma vez,
// pra verificar a mensagem de erro em português.
const extrairTextoPdfMock = vi.fn(async (_conteudo: ArrayBuffer) => TEXTO_FATURA_DOIS_CARTOES);
vi.mock('../../importar/adapters/textoPdf', () => ({
  extrairTextoPdf: (conteudo: ArrayBuffer) => extrairTextoPdfMock(conteudo),
}));

beforeEach(async () => {
  await limparDb();
});

async function montarBox() {
  const agora = agoraISO();
  const box = {
    id: novoId(), nome: 'casa', saldoInicial: 0, dataSaldoInicial: '2026-01-01',
    criadoEm: agora, alteradoEm: agora,
  };
  await repo.salvarBox(box);
  return box;
}

async function montarBoxComDoisCartoes() {
  const box = await montarBox();
  const cartaoA = await repo.salvarCartao(
    { boxId: box.id, nome: 'Cartão A', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31',
  );
  const cartaoB = await repo.salvarCartao(
    { boxId: box.id, nome: 'Cartão B', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31',
  );
  return { box, cartaoA, cartaoB };
}

async function uploadCsvDuasLinhas() {
  const arquivo = new File([CSV_DUAS_LINHAS], 'extrato-nubank.csv', { type: 'text/csv' });
  await userEvent.upload(screen.getByLabelText('Escolher arquivo'), arquivo);
  await screen.findByRole('button', { name: /Confirmar — 2 mudanças/ });
}

/** `.closest()` devolve `Element | null`; a UI dela é sempre um `<div class="item">`, mas o
 *  tipo não garante isso sozinho — aqui a checagem de nulo E de tipo ficam num só lugar. */
function linhaDoItem(elementoDeTexto: HTMLElement): HTMLElement {
  const linha = elementoDeTexto.closest('.item');
  if (!(linha instanceof HTMLElement)) throw new Error('linha ".item" não encontrada');
  return linha;
}

describe('Importar', () => {
  it('estado vazio: mostra só o passo 1, sem destino nem conferência', async () => {
    await useApp.getState().iniciar();
    render(<Importar />);

    expect(screen.getByText(/Escolha o CSV do extrato do Nubank/)).toBeInTheDocument();
    expect(screen.queryByText('2. Destino')).not.toBeInTheDocument();
    expect(screen.queryByText('3. Conferir')).not.toBeInTheDocument();
  });

  it('fluxo completo com o CSV do Nubank: lista os dois lançamentos e grava com a categoria certa', async () => {
    await useApp.getState().iniciar();
    render(<Importar />);

    await userEvent.upload(
      screen.getByLabelText('Escolher arquivo'),
      new File([CSV_DUAS_LINHAS], 'extrato-nubank.csv', { type: 'text/csv' }),
    );

    await screen.findByText(/Reconhecido: Nubank/);
    expect(await screen.findByText('LOJA GAMA')).toBeInTheDocument();
    expect(screen.getByText('PAGAMENTO RECEBIDO')).toBeInTheDocument();

    const botaoConfirmar = await screen.findByRole('button', { name: /Confirmar — 2 mudanças/ });
    await userEvent.click(botaoConfirmar);

    await screen.findByText(/2 adicionados/);

    const dados = await repo.carregarTudo();
    expect(dados.lancamentos).toHaveLength(2);

    const entrada = dados.lancamentos.find((l) => l.nota === 'PAGAMENTO RECEBIDO');
    const saida = dados.lancamentos.find((l) => l.nota === 'LOJA GAMA');
    expect(entrada).toBeDefined();
    expect(saida).toBeDefined();

    // O ponto que este teste protege: quem decide entrada/saída no Flow é o TIPO da
    // categoria, não o sinal do bruto — uma entrada gravada em categoria de gasto tiraria o
    // valor da projeção em vez de somar (ver "A categoria padrão depende do sinal" na spec).
    const categoriaEntrada = dados.categorias.find((c) => c.id === entrada!.categoriaId);
    const categoriaSaida = dados.categorias.find((c) => c.id === saida!.categoriaId);
    expect(categoriaEntrada?.tipo).toBe('ganho');
    expect(categoriaSaida?.tipo).toBe('gasto');
  });

  // Regressão do defeito do buffer esvaziado do PDF (ver `textoPdf.test.ts`): a exceção crua
  // aparecia na tela em inglês. O detalhe técnico continua na mensagem — foi ele que permitiu
  // diagnosticar o defeito —, mas com um prefixo em português na frente.
  it('erro ao ler o arquivo aparece com prefixo em português, com o detalhe técnico junto', async () => {
    extrairTextoPdfMock.mockRejectedValueOnce(new Error('Cannot perform Construct on a detached ArrayBuffer'));
    await useApp.getState().iniciar();
    render(<Importar />);

    await userEvent.upload(
      screen.getByLabelText('Escolher arquivo'),
      new File(['%PDF-1.4 fatura sintética'], 'fatura.pdf', { type: 'application/pdf' }),
    );

    await screen.findByText(
      'Não foi possível ler o arquivo. Detalhe técnico: Cannot perform Construct on a detached ArrayBuffer',
    );
  });

  // CRÍTICO 1: `trocas`/`totaisCorrigidos` eram chaveados pelo ÍNDICE do item na lista
  // exibida. Trocar o destino de um bloco de cartão refaz o `flatMap` dos blocos e desloca os
  // índices de todo bloco seguinte — uma decisão tomada num item passava a valer, em
  // silêncio, para outro. Este teste falha com a implementação por índice.
  it('trocar o destino de um bloco não desloca a decisão tomada noutro bloco', async () => {
    const { cartaoA } = await montarBoxComDoisCartoes();
    await useApp.getState().iniciar();
    render(<Importar />);

    await userEvent.upload(
      screen.getByLabelText('Escolher arquivo'),
      new File(['%PDF-1.4 fatura sintética'], 'fatura.pdf', { type: 'application/pdf' }),
    );

    // Com dois cartões ativos, nenhum bloco escolhe destino sozinho: os dois rótulos aparecem
    // no passo 2, ambos sem destino ainda.
    await screen.findByText('FULANO DE TAL - 0000 XXXX XXXX 0000');
    const rotuloBlocoB = '@ FULANO DE TAL - 1234 5678 9012 3456';

    // Escolhe destino só do segundo bloco (POSTO BETA) primeiro — ele fica na posição 0 da
    // lista exibida, sozinho.
    const radiogroupB = screen.getByRole('radiogroup', { name: `Destino de ${rotuloBlocoB}` });
    await userEvent.click(within(radiogroupB).getByRole('button', { name: cartaoA.nome }));

    const linhaPosto = linhaDoItem(screen.getByText('POSTO BETA'));
    await userEvent.click(within(linhaPosto).getByRole('button', { name: 'Descartar' }));
    expect(within(linhaPosto).getByRole('button', { name: 'Descartar' })).toHaveClass('ativo');

    // Agora escolhe destino do primeiro bloco (MERCADO ALFA) também. Isso empurra MERCADO
    // ALFA pra posição 0 e POSTO BETA pra posição 1 na lista recalculada.
    const rotuloBlocoA = 'FULANO DE TAL - 0000 XXXX XXXX 0000';
    const radiogroupA = screen.getByRole('radiogroup', { name: `Destino de ${rotuloBlocoA}` });
    await userEvent.click(within(radiogroupA).getByRole('button', { name: cartaoA.nome }));

    const containerMercado = linhaDoItem(await screen.findByText('MERCADO ALFA'));
    // MERCADO ALFA nunca foi tocado: continua com a ação padrão (Adicionar), não "descartado".
    expect(within(containerMercado).getByRole('button', { name: 'Adicionar' })).toHaveClass('ativo');
    expect(within(containerMercado).getByRole('button', { name: 'Descartar' })).not.toHaveClass('ativo');

    // A decisão de descartar POSTO BETA continua sendo dele, não migrou pra outro item.
    const linhaPostoDepois = linhaDoItem(screen.getByText('POSTO BETA'));
    expect(within(linhaPostoDepois).getByRole('button', { name: 'Descartar' })).toHaveClass('ativo');
  });

  // CRÍTICO 2: se um `aplicar` falhar depois de outro já ter gravado, o app precisa recarregar
  // os dados (pra não duplicar numa nova tentativa) e avisar, mantendo a lista pra conferência.
  it('erro no meio da gravação: recarrega, avisa, e a nova tentativa não duplica o que já entrou', async () => {
    await montarBox();
    await useApp.getState().iniciar();
    render(<Importar />);
    await uploadCsvDuasLinhas();

    // PAGAMENTO RECEBIDO grava normalmente (call-through); LOJA GAMA falha — simula uma
    // gravação que para no meio do grupo.
    const salvarOriginal = repo.salvarLancamento;
    vi.spyOn(repo, 'salvarLancamento')
      .mockImplementationOnce((...args: Parameters<typeof repo.salvarLancamento>) => salvarOriginal(...args))
      .mockRejectedValueOnce(new Error('falha sintética de gravação'));

    await userEvent.click(screen.getByRole('button', { name: /Confirmar — 2 mudanças/ }));

    await screen.findByText(
      'A gravação parou no meio. O que já entrou foi salvo, e a lista foi atualizada: '
      + 'confira de novo antes de confirmar.',
    );

    let dados = await repo.carregarTudo();
    expect(dados.lancamentos).toHaveLength(1);
    expect(dados.lancamentos[0].nota).toBe('PAGAMENTO RECEBIDO');

    // A lista se refez sozinha: só sobrou 1 mudança (LOJA GAMA, que não entrou).
    const botaoRetentativa = await screen.findByRole('button', { name: /Confirmar — 1 mudanças/ });
    await userEvent.click(botaoRetentativa);
    await screen.findByText(/1 adicionados/);

    dados = await repo.carregarTudo();
    expect(dados.lancamentos).toHaveLength(2);
    expect(dados.lancamentos.map((l) => l.nota).sort()).toEqual(['LOJA GAMA', 'PAGAMENTO RECEBIDO']);
  });

  // IMPORTANTE 3: `aplicando` só desabilita o botão depois do re-render. Dois cliques
  // disparados antes disso precisam resultar numa gravação só.
  it('duplo clique em Confirmar grava só uma vez por lançamento', async () => {
    await montarBox();
    await useApp.getState().iniciar();
    render(<Importar />);
    await uploadCsvDuasLinhas();

    const spy = vi.spyOn(repo, 'salvarLancamento');
    const botao = screen.getByRole('button', { name: /Confirmar — 2 mudanças/ });
    fireEvent.click(botao);
    fireEvent.click(botao);

    await screen.findByText(/2 adicionados/);
    // Um lançamento por linha do CSV — não o dobro, que um segundo `aplicar` produziria.
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('"Marcar todos como ignorar" zera as mudanças, mesmo sobre decisões já tomadas', async () => {
    await montarBox();
    await useApp.getState().iniciar();
    render(<Importar />);
    await uploadCsvDuasLinhas();

    await userEvent.click(screen.getByRole('button', { name: 'Marcar todos como ignorar' }));

    const botao = await screen.findByRole('button', { name: /Confirmar — 0 mudanças/ });
    expect(botao).toBeDisabled();
  });

  it('"Escolher outro arquivo" volta ao passo 1, limpando leitura, destino e decisões', async () => {
    await montarBox();
    await useApp.getState().iniciar();
    render(<Importar />);
    await uploadCsvDuasLinhas();

    await userEvent.click(screen.getByRole('button', { name: 'Escolher outro arquivo' }));

    expect(await screen.findByText(/Escolha o CSV do extrato do Nubank/)).toBeInTheDocument();
    expect(screen.queryByText('2. Destino')).not.toBeInTheDocument();
    expect(screen.queryByText('3. Conferir')).not.toBeInTheDocument();
  });
});
