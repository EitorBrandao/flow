import { render, screen } from '@testing-library/react';
import type { Cartao, CompraCartao, Lancamento, Viagem } from '../domain/types';
import ViagemSheet from './ViagemSheet';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };

const viagem: Viagem = { id: 'v1', nome: 'Praia', dataInicio: '2026-01-31', dataFim: '2026-02-05', ...ts };

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
        cartoes={cartoes} incluirPrevistos={true} onFechar={() => {}}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Praia' })).toBeInTheDocument();
    expect(screen.getByText('R$ 250,00')).toBeInTheDocument(); // total
    expect(screen.getByText('Hotel')).toBeInTheDocument();
    expect(screen.getByText('Almoço')).toBeInTheDocument();
  });

  it('fechado não renderiza nada', () => {
    render(
      <ViagemSheet
        aberto={false} viagem={null} boxIds={['b1']} lancamentos={[]} comprasCartao={[]}
        cartoes={cartoes} incluirPrevistos={true} onFechar={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sem gastos marcados mostra mensagem vazia', () => {
    render(
      <ViagemSheet
        aberto viagem={viagem} boxIds={['b1']} lancamentos={[]} comprasCartao={[]}
        cartoes={cartoes} incluirPrevistos={true} onFechar={() => {}}
      />,
    );
    expect(screen.getByText(/sem gastos marcados/i)).toBeInTheDocument();
  });
});
