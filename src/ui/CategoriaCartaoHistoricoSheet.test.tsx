import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Cartao, CategoriaCartao, CompraCartao } from '../domain/types';
import CategoriaCartaoHistoricoSheet from './CategoriaCartaoHistoricoSheet';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };
const cartao: Cartao = {
  id: 'k1', boxId: 'b1', nome: 'Cartão Azul', diaFechamento: 28, diaVencimento: 5,
  categoriaFaturaId: 'catFlow', ativo: true, ...ts,
};
const mercado: CategoriaCartao = { id: 'mercado', cartaoId: 'k1', nome: 'Mercado', ordem: 0, arquivada: false, ...ts };

function compra(id: string, data: string, valorTotal: number, cartaoId = 'k1'): CompraCartao {
  return { id, cartaoId, categoriaCartaoId: 'mercado', data, valorTotal, parcelas: 1, ...ts };
}

function abrir(compras: CompraCartao[]) {
  render(
    <CategoriaCartaoHistoricoSheet
      aberto cartao={cartao} categoria={mercado} mes="2026-09"
      comprasCartao={compras} ajustesFechamento={[]} onFechar={() => {}}
    />,
  );
  return screen.getByRole('dialog', { name: 'Mercado · Cartão Azul' });
}

describe('CategoriaCartaoHistoricoSheet', () => {
  it('mostra os 6 meses até o mês escolhido, do mais antigo ao mais novo, e a média', () => {
    // faturas: 06/2026 ← compra de 10/05; 08/2026 ← 10/07; 09/2026 ← 10/08
    const dialog = abrir([
      compra('a', '2026-05-10', 30000),
      compra('b', '2026-07-10', 60000),
      compra('c', '2026-08-10', 90000),
    ]);
    const rotulos = within(dialog).getAllByText(/^[a-z]{3}\/2026$/).map((e) => e.textContent);
    expect(rotulos).toEqual(['abr/2026', 'mai/2026', 'jun/2026', 'jul/2026', 'ago/2026', 'set/2026']);
    expect(within(dialog).getAllByText('R$ 300,00')[0]).toHaveClass('valor-gasto'); // jun; a média também dá 300,00
    expect(within(dialog).getByText('R$ 900,00')).toHaveClass('valor-gasto');
    // 30000 + 60000 + 90000 = 180000 / 6 = 30000
    const media = within(dialog).getByText('média 6m').querySelector('strong');
    expect(media?.textContent).toBe('R$ 300,00');
    expect(within(dialog).getByText('últimos 6 meses, pelo mês da fatura')).toBeInTheDocument();
  });

  it('mês zerado fica neutro e com barra vazia; o maior mês enche a barra', () => {
    const dialog = abrir([compra('b', '2026-07-10', 60000), compra('c', '2026-08-10', 90000)]);
    const zeros = within(dialog).getAllByText('R$ 0,00');
    expect(zeros).toHaveLength(4);
    for (const z of zeros) expect(z).toHaveClass('valor-neutro');
    const barras = dialog.querySelectorAll<HTMLElement>('.composicao-preenchimento');
    expect([...barras].map((b) => b.style.width)).toEqual(['0%', '0%', '0%', '0%', '66.67%', '100%']);
  });

  it('estorno líquido no mês: valor verde e barra de ganho', () => {
    const dialog = abrir([compra('e', '2026-08-10', -12000)]);
    expect(within(dialog).getAllByText('R$ 120,00')[0]).toHaveClass('valor-ganho');
    const barras = dialog.querySelectorAll('.composicao-preenchimento');
    expect(barras[5]).toHaveClass('ganho');
  });

  it('ignora compra de outro cartão', () => {
    const dialog = abrir([compra('x', '2026-08-10', 50000, 'outro')]);
    expect(within(dialog).queryByText('R$ 500,00')).not.toBeInTheDocument();
  });

  it('sem cartão ou categoria não renderiza nada', () => {
    const { container } = render(
      <CategoriaCartaoHistoricoSheet
        aberto cartao={null} categoria={null} mes="2026-09"
        comprasCartao={[]} ajustesFechamento={[]} onFechar={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
