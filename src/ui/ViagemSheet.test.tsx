import { render, screen } from '@testing-library/react';
import type { Cartao, Categoria, CompraCartao, Lancamento, Viagem } from '../domain/types';
import ViagemSheet from './ViagemSheet';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };

const viagem: Viagem = { id: 'v1', nome: 'Praia', dataInicio: '2026-01-31', dataFim: '2026-02-05', ...ts };

const categorias: Categoria[] = [{
  id: 'cat1', boxId: 'b1', nome: 'Gasto', tipo: 'gasto', ordem: 1, arquivada: false, ...ts,
}];

function lanc(p: Partial<Lancamento> & Pick<Lancamento, 'id' | 'data' | 'valor'>): Lancamento {
  return { boxId: 'b1', categoriaId: 'cat1', status: 'efetivo', origem: 'manual', ...ts, ...p };
}

function compra(p: Partial<CompraCartao> & Pick<CompraCartao, 'id' | 'data' | 'valorTotal'>): CompraCartao {
  return { cartaoId: 'c1', categoriaCartaoId: 'cc1', parcelas: 1, ...ts, ...p };
}

const cartoes: Cartao[] = [{
  id: 'c1', boxId: 'b1', nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  categoriaFaturaId: 'catfat', ativo: true, ...ts,
}];

describe('ViagemSheet', () => {
  it('mostra nome, período, total e grupos por descrição/nota', () => {
    const lancamentos = [lanc({ id: 'l1', data: '2026-02-01', valor: 5000, nota: 'Almoço', viagemId: 'v1' })];
    const comprasCartao = [compra({ id: 'c1', data: '2026-01-31', valorTotal: 20000, descricao: 'Hotel', viagemId: 'v1' })];

    render(
      <ViagemSheet
        aberto viagem={viagem} boxIds={['b1']} lancamentos={lancamentos} comprasCartao={comprasCartao}
        cartoes={cartoes} incluirPrevistos={true} categorias={categorias} onFechar={() => {}}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Praia' })).toBeInTheDocument();
    expect(screen.getByText('R$ 250,00')).toBeInTheDocument(); // total
    expect(screen.getByText('Hotel')).toBeInTheDocument();
    expect(screen.getByText('Almoço')).toBeInTheDocument();
  });

  it('lançamento de estorno na viagem: item fica verde com o rótulo "estorno"; total e subtotal seguem o efeito no saldo', () => {
    const lancamentos = [
      lanc({ id: 'l1', data: '2026-02-01', valor: 8000, nota: 'Compras', viagemId: 'v1' }),
      lanc({ id: 'l2', data: '2026-02-02', valor: -3000, nota: 'Compras', viagemId: 'v1' }), // estorno
    ];
    const comprasCartao = [compra({ id: 'c1', data: '2026-01-31', valorTotal: 20000, descricao: 'Hotel', viagemId: 'v1' })];

    render(
      <ViagemSheet
        aberto viagem={viagem} boxIds={['b1']} lancamentos={lancamentos} comprasCartao={comprasCartao}
        cartoes={cartoes} incluirPrevistos={true} categorias={categorias} onFechar={() => {}}
      />,
    );

    // total: 8000 - 3000 + 20000 = 25000 centavos, ainda gasto (vermelho)
    expect(screen.getByText('R$ 250,00')).toHaveClass('valor-gasto');
    // subtotal do grupo "Compras": 8000 - 3000 = 5000 centavos, ainda gasto
    expect(screen.getByText('R$ 50,00')).toHaveClass('valor-gasto');

    const itemPositivo = screen.getByText('R$ 80,00');
    expect(itemPositivo).toHaveClass('valor-gasto');

    const itemEstorno = screen.getByText('R$ 30,00');
    expect(itemEstorno).toHaveClass('valor-ganho'); // estorno: entra dinheiro, fica verde
    expect(itemEstorno).not.toHaveClass('valor-gasto');
    expect(screen.getByText('estorno')).toBeInTheDocument();
  });

  it('grupo com um único item de estorno mostra o rótulo "estorno" na linha do grupo', () => {
    const lancamentos = [
      lanc({ id: 'l1', data: '2026-02-01', valor: -3000, nota: 'Reembolso', viagemId: 'v1' }),
    ];

    render(
      <ViagemSheet
        aberto viagem={viagem} boxIds={['b1']} lancamentos={lancamentos} comprasCartao={[]}
        cartoes={cartoes} incluirPrevistos={true} categorias={categorias} onFechar={() => {}}
      />,
    );

    expect(screen.getByText('Reembolso')).toBeInTheDocument();
    expect(screen.getByText('estorno')).toBeInTheDocument();
  });

  it('fechado não renderiza nada', () => {
    render(
      <ViagemSheet
        aberto={false} viagem={null} boxIds={['b1']} lancamentos={[]} comprasCartao={[]}
        cartoes={cartoes} incluirPrevistos={true} categorias={categorias} onFechar={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sem gastos marcados mostra mensagem vazia', () => {
    render(
      <ViagemSheet
        aberto viagem={viagem} boxIds={['b1']} lancamentos={[]} comprasCartao={[]}
        cartoes={cartoes} incluirPrevistos={true} categorias={categorias} onFechar={() => {}}
      />,
    );
    expect(screen.getByText(/sem gastos marcados/i)).toBeInTheDocument();
  });
});
