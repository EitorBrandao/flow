import { describe, expect, it } from 'vitest';
import {
  categoriaPorCnpj, dedupCnpjsCategoria, extrairCnpj, normalizarCnpj, raizCnpj,
} from './cnpj';
import type { CategoriaCartao, CnpjCategoria } from './types';

const CNPJ = '11222333000181'; // CNPJ de exemplo, válido

const cat = (id: string, cartaoId: string, nome: string, arquivada = false): CategoriaCartao =>
  ({ id, cartaoId, nome, ordem: 0, arquivada, criadoEm: 'x', alteradoEm: 'x' }) as CategoriaCartao;
const aprendido = (id: string, raiz: string, catId: string, nome: string, alteradoEm = '2026-01-01'): CnpjCategoria =>
  ({ id, raiz, categoriaCartaoId: catId, categoriaNome: nome, criadoEm: alteradoEm, alteradoEm });

describe('normalizarCnpj', () => {
  it('aceita com e sem pontuação', () => {
    expect(normalizarCnpj('11.222.333/0001-81')).toBe(CNPJ);
    expect(normalizarCnpj(CNPJ)).toBe(CNPJ);
  });
  it('recusa dígito verificador errado, tamanho errado e repetidos', () => {
    expect(normalizarCnpj('11.222.333/0001-82')).toBeUndefined();
    expect(normalizarCnpj('1122233300018')).toBeUndefined();
    expect(normalizarCnpj('')).toBeUndefined();
    expect(normalizarCnpj('00000000000000')).toBeUndefined();
  });
});

describe('extrairCnpj', () => {
  it('acha o CNPJ no meio do texto do comprovante', () => {
    expect(extrairCnpj('LOJA TESTE\nCNPJ: 11.222.333/0001-81\nSAO PAULO/SP')).toBe(CNPJ);
  });
  it('tolera espaços do OCR', () => {
    expect(extrairCnpj('CNPJ: 11. 222. 333 /0001 - 81')).toBe(CNPJ);
  });
  it('ignora número parecido com dígito errado', () => {
    expect(extrairCnpj('CNPJ: 11.222.333/0001-80')).toBeUndefined();
    expect(extrairCnpj('AUTE:902329/AUTO:100775')).toBeUndefined();
  });
  it('pega o válido quando o primeiro candidato é inválido', () => {
    expect(extrairCnpj('11.222.333/0001-80 e 11.222.333/0001-81')).toBe(CNPJ);
  });
});

describe('raizCnpj', () => {
  it('são os 8 primeiros dígitos', () => expect(raizCnpj(CNPJ)).toBe('11222333'));
});

describe('categoriaPorCnpj', () => {
  const cats = [cat('c1', 'A', 'Mercado'), cat('c2', 'B', 'mércado'), cat('c3', 'B', 'Lazer')];
  it('usa o id quando a categoria é do cartão', () => {
    expect(categoriaPorCnpj([aprendido('i', '11222333', 'c1', 'Mercado')], CNPJ, cats, 'A')).toBe('c1');
  });
  it('em outro cartão, acha a categoria de mesmo nome sem acento nem caixa', () => {
    expect(categoriaPorCnpj([aprendido('i', '11222333', 'c1', 'Mercado')], CNPJ, cats, 'B')).toBe('c2');
  });
  it('filial vale como matriz', () => {
    expect(categoriaPorCnpj([aprendido('i', '11222333', 'c1', 'Mercado')], '11222333000262', cats, 'A')).toBe('c1');
  });
  it('sem CNPJ, sem aprendizado ou sem categoria no cartão: nada', () => {
    const a = [aprendido('i', '11222333', 'c1', 'Mercado')];
    expect(categoriaPorCnpj(a, undefined, cats, 'A')).toBeUndefined();
    expect(categoriaPorCnpj([], CNPJ, cats, 'A')).toBeUndefined();
    expect(categoriaPorCnpj([aprendido('i', '99999999', 'c1', 'Mercado')], CNPJ, cats, 'A')).toBeUndefined();
    expect(categoriaPorCnpj([aprendido('i', '11222333', 'cx', 'Farmácia')], CNPJ, cats, 'A')).toBeUndefined();
  });
  it('nunca sugere categoria arquivada', () => {
    const arq = [cat('c1', 'A', 'Mercado', true)];
    expect(categoriaPorCnpj([aprendido('i', '11222333', 'c1', 'Mercado')], CNPJ, arq, 'A')).toBeUndefined();
  });
  it('com duas para a mesma raiz, vale a mais recente', () => {
    const a = [
      aprendido('i1', '11222333', 'c1', 'Mercado', '2026-01-01'),
      aprendido('i2', '11222333', 'c3', 'Lazer', '2026-02-01'),
    ];
    expect(categoriaPorCnpj(a, CNPJ, cats, 'B')).toBe('c3');
  });
});

describe('dedupCnpjsCategoria', () => {
  it('mantém uma por raiz: a mais recente; empate pelo id', () => {
    const r = dedupCnpjsCategoria([
      aprendido('a', '11222333', 'c1', 'X', '2026-01-01'),
      aprendido('b', '11222333', 'c2', 'Y', '2026-02-01'),
      aprendido('c', '55555555', 'c1', 'X', '2026-01-01'),
      aprendido('d', '55555555', 'c2', 'Y', '2026-01-01'),
    ]);
    expect(r.map((i) => i.id).sort()).toEqual(['b', 'd']);
  });
});
