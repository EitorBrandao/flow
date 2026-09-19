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
      { item: itemNovo, boxId: 'b1', chave: 'bruto:0' },
      { item: itemConfere, boxId: 'b1', chave: 'bruto:1' },
      { item: itemSobra, boxId: 'b1', chave: 'sobra:l-sobra' },
    ];
    const leitura: LeituraAdapter = { brutos: [], linhasIgnoradas: 0, avisos: [] };

    const { container } = render(
      <ListaConferencia
        leitura={leitura} itens={itens} dados={dados}
        trocas={{}} onTrocar={vi.fn()}
        totaisCorrigidos={{}} onCorrigirTotal={vi.fn()}
        mostrarLinhasIgnoradas={false} onToggleLinhasIgnoradas={vi.fn()}
        copiarEstado="ocioso" onCopiarTextoExtraido={vi.fn()}
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

  it('mostra o botão de ver linhas não reconhecidas e a lista só quando mandado exibir', () => {
    const dados = dadosVazios();
    const leitura: LeituraAdapter = {
      brutos: [], linhasIgnoradas: 2, avisos: [],
      linhasNaoReconhecidas: ['linha torta 1', 'linha torta 2'],
    };

    const { container, rerender } = render(
      <ListaConferencia
        leitura={leitura} itens={[]} dados={dados}
        trocas={{}} onTrocar={vi.fn()}
        totaisCorrigidos={{}} onCorrigirTotal={vi.fn()}
        mostrarLinhasIgnoradas={false} onToggleLinhasIgnoradas={vi.fn()}
        copiarEstado="ocioso" onCopiarTextoExtraido={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('Ver linhas não reconhecidas');
    expect(container.textContent).not.toContain('linha torta 1');

    rerender(
      <ListaConferencia
        leitura={leitura} itens={[]} dados={dados}
        trocas={{}} onTrocar={vi.fn()}
        totaisCorrigidos={{}} onCorrigirTotal={vi.fn()}
        mostrarLinhasIgnoradas onToggleLinhasIgnoradas={vi.fn()}
        copiarEstado="ocioso" onCopiarTextoExtraido={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('Ocultar linhas não reconhecidas');
    expect(container.textContent).toContain('linha torta 1');
    expect(container.textContent).toContain('linha torta 2');
  });

  it('mostra o botão de copiar texto extraído quando há linhas ignoradas ou nenhum lançamento reconhecido', () => {
    const dados = dadosVazios();
    // Sem texto extraído, o botão nunca aparece
    const semTexto: LeituraAdapter = { brutos: [], linhasIgnoradas: 0, avisos: [], textoExtraido: undefined };
    const { container, rerender } = render(
      <ListaConferencia
        leitura={semTexto} itens={[]} dados={dados}
        trocas={{}} onTrocar={vi.fn()}
        totaisCorrigidos={{}} onCorrigirTotal={vi.fn()}
        mostrarLinhasIgnoradas={false} onToggleLinhasIgnoradas={vi.fn()}
        copiarEstado="ocioso" onCopiarTextoExtraido={vi.fn()}
      />,
    );
    expect(container.textContent).not.toContain('Copiar texto extraído');

    // Com texto e zero lançamentos reconhecidos (itens vazio), o botão aparece
    const zeroLancamentos: LeituraAdapter = { brutos: [], linhasIgnoradas: 0, avisos: [], textoExtraido: 'texto' };
    rerender(
      <ListaConferencia
        leitura={zeroLancamentos} itens={[]} dados={dados}
        trocas={{}} onTrocar={vi.fn()}
        totaisCorrigidos={{}} onCorrigirTotal={vi.fn()}
        mostrarLinhasIgnoradas={false} onToggleLinhasIgnoradas={vi.fn()}
        copiarEstado="ocioso" onCopiarTextoExtraido={vi.fn()}
      />,
    );
    expect(container.textContent).toContain('Copiar texto extraído');

    // Com linhas ignoradas, o botão também aparece
    const comIgnoradas: LeituraAdapter = { brutos: [], linhasIgnoradas: 1, avisos: [], textoExtraido: 'texto' };
    rerender(
      <ListaConferencia
        leitura={comIgnoradas} itens={[]} dados={dados}
        trocas={{}} onTrocar={vi.fn()}
        totaisCorrigidos={{}} onCorrigirTotal={vi.fn()}
        mostrarLinhasIgnoradas={false} onToggleLinhasIgnoradas={vi.fn()}
        copiarEstado="ocioso" onCopiarTextoExtraido={vi.fn()}
      />,
    );
    expect(container.textContent).toContain('Copiar texto extraído');
  });
});
