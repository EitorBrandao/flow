import { render, screen } from '@testing-library/react';
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

function renderLinha(item: ItemConferencia, dados: Dados = dadosVazios()) {
  const onTrocarAcao = vi.fn();
  const onCorrigirTotal = vi.fn();
  render(
    <LinhaConferencia
      item={item} dados={dados} acaoAtual={item.acao}
      onTrocarAcao={onTrocarAcao} onCorrigirTotal={onCorrigirTotal}
    />,
  );
  return { onTrocarAcao, onCorrigirTotal };
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

  it('novo com compra reconstruída: mostra Corrigir total, que abre um campo de valor', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir total' }));
    const campo = await screen.findByLabelText('Total da compra');
    await userEvent.type(campo, '5');
    expect(onCorrigirTotal).toHaveBeenCalledWith(5);
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
