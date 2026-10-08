import { describe, expect, it } from 'vitest';
import { categoriaPorDescricao, modoDaBox, modoDe, modosDaBox, modosEfetivos, modosInstalacaoNova, modosValidos } from './modos';
import type { Categoria, Config, Lancamento } from './types';

const config = (modos?: Config['modos']): Config => ({
  id: 'config', boxPadraoId: null, ultimoBackupEm: null, mudancasDesdeBackup: false,
  horizonteProjecao: '2027-12-31', ...(modos ? { modos } : {}),
});

describe('modoDe', () => {
  it('campo ausente vale avançado', () => {
    expect(modoDe(config(), 'hoje')).toBe('avancado');
  });
  it('chave ausente dentro de modos vale avançado', () => {
    expect(modoDe(config({ hoje: 'simples' }), 'fluxo')).toBe('avancado');
  });
  it('lê o modo gravado', () => {
    expect(modoDe(config({ cartao: 'simples' }), 'cartao')).toBe('simples');
  });
});

describe('modosEfetivos e modosInstalacaoNova', () => {
  it('completa as cinco telas', () => {
    expect(modosEfetivos(config({ hoje: 'simples' }))).toEqual({
      hoje: 'simples', fluxo: 'avancado', cartao: 'avancado', analises: 'avancado', lancar: 'avancado',
    });
  });
  it('instalação nova começa tudo em simples', () => {
    expect(Object.values(modosInstalacaoNova()).every((m) => m === 'simples')).toBe(true);
    expect(Object.keys(modosInstalacaoNova())).toHaveLength(5);
  });
});

describe('modosValidos', () => {
  it('aceita objeto parcial', () => expect(modosValidos({ hoje: 'simples' })).toBe(true));
  it('rejeita valor fora do conjunto', () => expect(modosValidos({ hoje: 'facil' })).toBe(false));
  it('rejeita chave desconhecida', () => expect(modosValidos({ lixo: 'simples' })).toBe(false));
  it('rejeita não-objeto e array', () => {
    expect(modosValidos('simples')).toBe(false);
    expect(modosValidos([])).toBe(false);
    expect(modosValidos(null)).toBe(false);
  });
});

describe('categoriaPorDescricao', () => {
  const cat = (id: string, tipo: Categoria['tipo'], arquivada = false): Categoria =>
    ({ id, boxId: 'b1', nome: id, tipo, ordem: 0, arquivada, criadoEm: '2026-09-01T10:00:00Z', alteradoEm: '2026-09-01T10:00:00Z' } as Categoria);
  const lanc = (id: string, over: Partial<Lancamento>): Lancamento =>
    ({ id, boxId: 'b1', categoriaId: 'c1', data: '2026-09-01', valor: 100, status: 'efetivo',
       origem: 'manual', criadoEm: '2026-09-01T10:00:00Z', alteradoEm: '2026-09-01T10:00:00Z', ...over } as Lancamento);
  const base = { boxId: 'b1', tipo: 'gasto' as const };

  it('acha a categoria da mesma descrição, sem diferenciar maiúsculas nem espaços', () => {
    const r = categoriaPorDescricao({ ...base, categorias: [cat('c1', 'gasto')], descricao: '  MERCADO ',
      lancamentos: [lanc('l1', { nota: 'mercado' })] });
    expect(r).toBe('c1');
  });
  it('usa o lançamento mais recente quando há categorias diferentes', () => {
    const r = categoriaPorDescricao({ ...base, categorias: [cat('c1', 'gasto'), cat('c2', 'gasto')], descricao: 'padaria',
      lancamentos: [lanc('l1', { nota: 'padaria', categoriaId: 'c1', data: '2026-08-01' }),
                    lanc('l2', { nota: 'padaria', categoriaId: 'c2', data: '2026-09-10' })] });
    expect(r).toBe('c2');
  });
  it('ignora descrição vazia, categoria arquivada, tipo diferente, outra box, cenário e origem não manual', () => {
    const lancamentos = [
      lanc('a', { nota: 'x', categoriaId: 'arq' }),
      lanc('b', { nota: 'x', categoriaId: 'ganho1' }),
      lanc('c', { nota: 'x', boxId: 'b2' }),
      lanc('d', { nota: 'x', cenarioId: 'cen' }),
      lanc('e', { nota: 'x', origem: 'cartao' }),
    ];
    const categorias = [cat('arq', 'gasto', true), cat('ganho1', 'ganho'), cat('c1', 'gasto')];
    expect(categoriaPorDescricao({ ...base, categorias, lancamentos, descricao: 'x' })).toBeNull();
    expect(categoriaPorDescricao({ ...base, categorias, lancamentos, descricao: '   ' })).toBeNull();
  });
});

describe('modoDaBox', () => {
  it('box com modo próprio vale mais que o global', () => {
    expect(modoDaBox(config({ hoje: 'avancado' }), { modos: { hoje: 'simples' } }, 'hoje')).toBe('simples');
  });
  it('box sem modos herda o global', () => {
    expect(modoDaBox(config({ hoje: 'simples' }), {}, 'hoje')).toBe('simples');
  });
  it('tela ausente na box herda só aquela tela do global', () => {
    const box = { modos: { hoje: 'simples' } } as const;
    expect(modoDaBox(config({ fluxo: 'simples' }), box, 'fluxo')).toBe('simples');
    expect(modoDaBox(config({ fluxo: 'simples' }), box, 'cartao')).toBe('avancado');
  });
  it('sem box e sem global vale avançado', () => {
    expect(modoDaBox(config(), undefined, 'lancar')).toBe('avancado');
  });
});

describe('modosDaBox', () => {
  it('completa as cinco telas: box primeiro, depois o global, depois avançado', () => {
    expect(modosDaBox(config({ fluxo: 'simples' }), { modos: { hoje: 'simples' } })).toEqual({
      hoje: 'simples', fluxo: 'simples', cartao: 'avancado', analises: 'avancado', lancar: 'avancado',
    });
  });
});
