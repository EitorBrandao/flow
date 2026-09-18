import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Dados } from '../../domain/types';
import type { ItemConferencia, LeituraAdapter } from '../../importar/tipos';
import ListaConferencia, { type ItemComContexto } from './ListaConferencia';

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

describe('ListaConferencia', () => {
  it('mostra as contagens do resumo e a lista em ordem de data', () => {
    const dados = dadosVazios();
    dados.categorias.push({
      id: 'cat-gasto', boxId: 'b1', nome: 'Mercado', tipo: 'gasto', ordem: 0, arquivada: false,
      criadoEm: '2026-01-01T00:00:00.000Z', alteradoEm: '2026-01-01T00:00:00.000Z',
    });
    dados.lancamentos.push({
      id: 'l-sobra', boxId: 'b1', categoriaId: 'cat-gasto', data: '2026-08-10', valor: 5190,
      status: 'efetivo', origem: 'manual', nota: 'POSTO BETA',
      criadoEm: '2026-01-01T00:00:00.000Z', alteradoEm: '2026-01-01T00:00:00.000Z',
    });

    const itemNovo: ItemConferencia = {
      estado: 'novo',
      bruto: { data: '2026-08-20', valorCent: -4500, descricao: 'MERCADO ALFA', fonte: 'conta' },
      acao: { tipo: 'adicionarLancamento', categoriaId: 'cat-gasto' },
    };
    const itemConfere: ItemConferencia = {
      estado: 'confere',
      bruto: { data: '2026-08-05', valorCent: -3990, descricao: 'LOJA GAMA', fonte: 'conta' },
      acao: { tipo: 'ignorar' },
    };
    const itemSobra: ItemConferencia = { estado: 'sobra', lancamentoId: 'l-sobra', acao: { tipo: 'ignorar' } };

    const itens: ItemComContexto[] = [
      { item: itemNovo, boxId: 'b1' },
      { item: itemConfere, boxId: 'b1' },
      { item: itemSobra, boxId: 'b1' },
    ];
    const leitura: LeituraAdapter = { brutos: [], linhasIgnoradas: 0, avisos: [] };

    const { container } = render(
      <ListaConferencia
        leitura={leitura} itens={itens} dados={dados}
        trocas={{}} onTrocar={vi.fn()}
        totaisCorrigidos={{}} onCorrigirTotal={vi.fn()}
      />,
    );

    const resumo = container.querySelector('.importar-resumo')!;
    expect(resumo.textContent).toContain('1 confere');
    expect(resumo.textContent).toContain('1 novo');
    expect(resumo.textContent).toContain('1 sobra');
    expect(resumo.textContent).toContain('0 previstos');
    expect(resumo.textContent).toContain('0 divergentes');
    expect(resumo.textContent).toContain('0 internos');

    const descricoes = Array.from(container.querySelectorAll('.item')).map((el) => el.textContent ?? '');
    const indiceLoja = descricoes.findIndex((t) => t.includes('LOJA GAMA'));
    const indicePosto = descricoes.findIndex((t) => t.includes('POSTO BETA'));
    const indiceMercado = descricoes.findIndex((t) => t.includes('MERCADO ALFA'));
    expect(indiceLoja).toBeGreaterThanOrEqual(0);
    expect(indicePosto).toBeGreaterThan(indiceLoja);
    expect(indiceMercado).toBeGreaterThan(indicePosto);
  });
});
