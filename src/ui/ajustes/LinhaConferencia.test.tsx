import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Dados } from '../../domain/types';
import { CATEGORIA_A_CLASSIFICAR } from '../../importar/conferencia';
import type { AcaoItem, ItemConferencia } from '../../importar/tipos';
import LinhaConferencia from './LinhaConferencia';

function dadosVazios(): Dados {
  return {
    boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
    cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
    conferenciasFatura: [], viagens: [], bancos: [], ajustesFechamento: [], notasFiscais: [],
    config: {
      id: 'config', boxPadraoId: null, ultimoBackupEm: null, mudancasDesdeBackup: false,
      horizonteProjecao: '2026-12-31',
    },
  };
}

function renderLinha(item: ItemConferencia, dados: Dados = dadosVazios(), dataCorrigida?: string) {
  const onTrocarAcao = vi.fn();
  const onCorrigirTotal = vi.fn();
  const onCorrigirData = vi.fn();
  render(
    <LinhaConferencia
      item={item} dados={dados} acaoAtual={item.acao}
      onTrocarAcao={onTrocarAcao} onCorrigirTotal={onCorrigirTotal}
      dataCorrigida={dataCorrigida} onCorrigirData={onCorrigirData}
    />,
  );
  return { onTrocarAcao, onCorrigirTotal, onCorrigirData };
}

describe('LinhaConferencia', () => {
  it('novo: mostra Adicionar e Descartar; Descartar troca para ignorar', async () => {
    const item: ItemConferencia = {
      estado: 'novo',
      bruto: { data: '2026-08-07', valorCent: -4500, descricao: 'MERCADO ALFA 103', fonte: 'conta' },
      acao: { tipo: 'adicionarLancamento', categoriaId: 'cat-gasto' },
    };
    const { onTrocarAcao } = renderLinha(item);

    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onTrocarAcao).toHaveBeenCalledWith({ tipo: 'ignorar' });
  });

  it('novo com compra reconstruída: mostra Corrigir compra, que abre um campo de valor', async () => {
    const item: ItemConferencia = {
      estado: 'novo',
      bruto: {
        data: '2026-07-02', valorCent: -10000, descricao: 'LOJA GAMA', fonte: 'cartao',
        parcela: { n: 3, total: 10 },
      },
      acao: { tipo: 'adicionarCompra', categoriaCartaoId: 'cat-cartao' },
      compraReconstruida: { data: '2026-05-02', valorTotalCent: 100000, parcelas: 10, anoDeduzidoComAviso: false },
    };
    const { onCorrigirTotal } = renderLinha(item);

    expect(screen.getByText(/parcela 3 de 10/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir compra' }));
    const campo = await screen.findByLabelText('Total da compra');
    await userEvent.type(campo, '5');
    expect(onCorrigirTotal).toHaveBeenCalledWith(5);
    expect(screen.queryByLabelText('Data da compra')).not.toBeInTheDocument();
  });

  // IMPORTANTE 4: um total corrigido menor que o valor de uma parcela não faz sentido.
  it('total corrigido abaixo do valor de uma parcela: mostra aviso', async () => {
    const item: ItemConferencia = {
      estado: 'novo',
      bruto: {
        data: '2026-07-02', valorCent: -10000, descricao: 'LOJA GAMA', fonte: 'cartao',
        parcela: { n: 3, total: 10 },
      },
      acao: { tipo: 'adicionarCompra', categoriaCartaoId: 'cat-cartao' },
      compraReconstruida: { data: '2026-05-02', valorTotalCent: 100000, parcelas: 10, anoDeduzidoComAviso: false },
    };
    const onTrocarAcao = vi.fn();
    const onCorrigirTotal = vi.fn();
    render(
      <LinhaConferencia
        item={item} dados={dadosVazios()} acaoAtual={item.acao} totalCorrigidoCent={9999}
        onTrocarAcao={onTrocarAcao} onCorrigirTotal={onCorrigirTotal}
        onCorrigirData={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Corrigir compra' }));
    expect(screen.getByText('O total não pode ser menor que uma parcela.')).toBeInTheDocument();
  });

  it('total corrigido igual ao valor de uma parcela: sem aviso', async () => {
    const item: ItemConferencia = {
      estado: 'novo',
      bruto: {
        data: '2026-07-02', valorCent: -10000, descricao: 'LOJA GAMA', fonte: 'cartao',
        parcela: { n: 3, total: 10 },
      },
      acao: { tipo: 'adicionarCompra', categoriaCartaoId: 'cat-cartao' },
      compraReconstruida: { data: '2026-05-02', valorTotalCent: 100000, parcelas: 10, anoDeduzidoComAviso: false },
    };
    render(
      <LinhaConferencia
        item={item} dados={dadosVazios()} acaoAtual={item.acao} totalCorrigidoCent={10000}
        onTrocarAcao={vi.fn()} onCorrigirTotal={vi.fn()} onCorrigirData={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Corrigir compra' }));
    expect(screen.queryByText('O total não pode ser menor que uma parcela.')).not.toBeInTheDocument();
  });

  const ITEM_ESTIMADO: ItemConferencia = {
    estado: 'novo',
    bruto: {
      data: '2026-05-30', valorCent: -4000, descricao: 'Loja Delta', fonte: 'cartao',
      parcela: { n: 3, total: 10 }, dataEstimada: { min: '2026-05-30', max: '2026-06-29' },
    },
    compraReconstruida: { data: '2026-05-30', valorTotalCent: 40000, parcelas: 10, anoDeduzidoComAviso: false },
    acao: { tipo: 'adicionarCompra', categoriaCartaoId: 'cc-1' },
  };

  it('data estimada: a linha marca "(estimada)"', () => {
    renderLinha(ITEM_ESTIMADO);
    expect(screen.getByText(/30\/05\/2026 \(estimada\)/)).toBeInTheDocument();
  });

  it('data estimada: Corrigir compra mostra o campo de data com o intervalo e a dica', async () => {
    renderLinha(ITEM_ESTIMADO);
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir compra' }));
    const campo = screen.getByLabelText('Data da compra');
    expect(campo).toHaveAttribute('min', '2026-05-30');
    expect(campo).toHaveAttribute('max', '2026-06-29');
    expect(screen.getByText('Pela parcela, a compra foi entre 30/05/2026 e 29/06/2026. Estimada: 30/05/2026.'))
      .toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voltar para a data estimada' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Total da compra')).toBeInTheDocument();
  });

  it('mudar a data chama onCorrigirData; escolher a estimada apaga a correção', async () => {
    const { onCorrigirData } = renderLinha(ITEM_ESTIMADO);
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir compra' }));
    fireEvent.change(screen.getByLabelText('Data da compra'), { target: { value: '2026-06-10' } });
    expect(onCorrigirData).toHaveBeenLastCalledWith('2026-06-10');
  });

  it('com data corrigida: some "(estimada)" e aparece "Voltar para a data estimada"', async () => {
    const { onCorrigirData } = renderLinha(ITEM_ESTIMADO, dadosVazios(), '2026-06-10');
    expect(screen.getByText(/10\/06\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/\(estimada\)/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir compra' }));
    await userEvent.click(screen.getByRole('button', { name: 'Voltar para a data estimada' }));
    expect(onCorrigirData).toHaveBeenLastCalledWith(undefined);
  });

  it('data corrigida fora do intervalo é ignorada: a linha mostra a estimada', () => {
    renderLinha(ITEM_ESTIMADO, dadosVazios(), '2026-07-03');
    expect(screen.getByText(/30\/05\/2026 \(estimada\)/)).toBeInTheDocument();
  });

  it('confere com data estimada mostra a data da compra cadastrada no app', () => {
    const dados = dadosVazios();
    dados.comprasCartao = [{
      id: 'cc', cartaoId: 'k', categoriaCartaoId: 'c', data: '2026-06-12', valorTotal: 40000,
      parcelas: 10, descricao: 'Loja Delta', criadoEm: '', alteradoEm: '',
    } as Dados['comprasCartao'][number]];
    renderLinha({ ...ITEM_ESTIMADO, estado: 'confere', compraCartaoId: 'cc', acao: { tipo: 'ignorar' } }, dados);
    expect(screen.getByText(/12\/06\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/30\/05\/2026/)).not.toBeInTheDocument();
  });

  it('previsto: mostra Confirmar e Descartar', () => {
    const item: ItemConferencia = {
      estado: 'previsto',
      bruto: { data: '2026-08-20', valorCent: -3990, descricao: 'FARMACIA DELTA', fonte: 'conta' },
      lancamentoId: 'l1',
      acao: { tipo: 'confirmar' },
    };
    renderLinha(item);
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
  });

  it('divergente: mostra Confirmar com o valor do banco e Descartar', () => {
    const item: ItemConferencia = {
      estado: 'divergente',
      bruto: { data: '2026-08-15', valorCent: -12345, descricao: 'POSTO BETA', fonte: 'conta' },
      lancamentoId: 'l2',
      acao: { tipo: 'confirmarComValor', valorCent: 12345, data: '2026-08-15' },
    };
    renderLinha(item);
    expect(screen.getByRole('button', { name: /Confirmar R\$\s?123,45/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
  });

  it('confere: linha compacta, sem botões', () => {
    const item: ItemConferencia = {
      estado: 'confere',
      bruto: { data: '2026-08-07', valorCent: -4500, descricao: 'MERCADO ALFA 103', fonte: 'conta' },
      lancamentoId: 'l3',
      acao: { tipo: 'ignorar' },
    };
    renderLinha(item);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('confere com aviso mostra o aviso de descrição diferente', () => {
    const item: ItemConferencia = {
      estado: 'confere',
      bruto: { data: '2026-08-07', valorCent: -4500, descricao: 'MERCADO ALFA 103', fonte: 'conta' },
      lancamentoId: 'l3',
      acao: { tipo: 'ignorar' },
      aviso: 'Casado por valor e data, com descrição diferente. Confira se é o mesmo lançamento.',
    };
    renderLinha(item);
    expect(screen.getByText(
      'Casado por valor e data, com descrição diferente. Confira se é o mesmo lançamento.',
    )).toBeInTheDocument();
  });

  it('previsto com aviso mostra o aviso de descrição diferente', () => {
    const item: ItemConferencia = {
      estado: 'previsto',
      bruto: { data: '2026-08-20', valorCent: -3990, descricao: 'FARMACIA DELTA', fonte: 'conta' },
      lancamentoId: 'l1',
      acao: { tipo: 'confirmar' },
      aviso: 'Casado por valor e data, com descrição diferente. Confira se é o mesmo lançamento.',
    };
    renderLinha(item);
    expect(screen.getByText(
      'Casado por valor e data, com descrição diferente. Confira se é o mesmo lançamento.',
    )).toBeInTheDocument();
  });

  it('interno (resgate): mostra só Ignorar', () => {
    const item: ItemConferencia = {
      estado: 'interno',
      bruto: { data: '2026-08-19', valorCent: 12345, descricao: 'Resgate RDB', fonte: 'conta', natureza: 'resgateInterno' },
      acao: { tipo: 'ignorar' },
    };
    renderLinha(item);
    expect(screen.getByRole('button', { name: 'Ignorar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'É saída de verdade' })).not.toBeInTheDocument();
  });

  it('interno (aplicação): "É saída de verdade" troca para adicionarLancamento com a sentinela de gasto', async () => {
    const item: ItemConferencia = {
      estado: 'interno',
      bruto: {
        data: '2026-08-15', valorCent: -100000, descricao: 'Aplicação RDB', fonte: 'conta',
        natureza: 'aplicacaoInterna',
      },
      acao: { tipo: 'ignorar' },
      aviso: 'Guardar na caixinha é movimento interno.',
    };
    const { onTrocarAcao } = renderLinha(item);

    expect(screen.getByText('Guardar na caixinha é movimento interno.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'É saída de verdade' }));
    const acaoEsperada: AcaoItem = { tipo: 'adicionarLancamento', categoriaId: CATEGORIA_A_CLASSIFICAR.gasto };
    expect(onTrocarAcao).toHaveBeenCalledWith(acaoEsperada);
  });

  it('sobra de um lançamento de estorno (valor negativo): cor pelo efeito no saldo, com o rótulo "estorno"', async () => {
    const dados = dadosVazios();
    dados.categorias.push({
      id: 'cat-gasto', boxId: 'b1', nome: 'Mercado', tipo: 'gasto', ordem: 0, arquivada: false,
      criadoEm: '2026-01-01T00:00:00.000Z', alteradoEm: '2026-01-01T00:00:00.000Z',
    });
    dados.lancamentos.push({
      id: 'l5', boxId: 'b1', categoriaId: 'cat-gasto', data: '2026-08-16', valor: -5190,
      status: 'efetivo', origem: 'manual', nota: 'devolução',
      criadoEm: '2026-01-01T00:00:00.000Z', alteradoEm: '2026-01-01T00:00:00.000Z',
    });
    const item: ItemConferencia = { estado: 'sobra', lancamentoId: 'l5', acao: { tipo: 'ignorar' } };
    renderLinha(item, dados);

    const valor = screen.getByText('R$ 51,90');
    expect(valor).toHaveClass('valor-ganho'); // estorno de gasto: entra dinheiro, fica verde
    expect(valor).not.toHaveClass('valor-gasto');
    expect(screen.getByText('estorno')).toBeInTheDocument();
  });

  it('sobra: "Excluir do app" chama a troca com { tipo: "excluir" }', async () => {
    const dados = dadosVazios();
    dados.categorias.push({
      id: 'cat-gasto', boxId: 'b1', nome: 'Mercado', tipo: 'gasto', ordem: 0, arquivada: false,
      criadoEm: '2026-01-01T00:00:00.000Z', alteradoEm: '2026-01-01T00:00:00.000Z',
    });
    dados.lancamentos.push({
      id: 'l4', boxId: 'b1', categoriaId: 'cat-gasto', data: '2026-08-16', valor: 5190,
      status: 'efetivo', origem: 'manual', nota: 'LOJA GAMA',
      criadoEm: '2026-01-01T00:00:00.000Z', alteradoEm: '2026-01-01T00:00:00.000Z',
    });
    const item: ItemConferencia = { estado: 'sobra', lancamentoId: 'l4', acao: { tipo: 'ignorar' } };
    const { onTrocarAcao } = renderLinha(item, dados);

    expect(screen.getByRole('button', { name: 'Manter' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir do app' }));
    expect(onTrocarAcao).toHaveBeenCalledWith({ tipo: 'excluir' });
  });
});
