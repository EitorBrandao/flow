import { describe, expect, it } from 'vitest';
import { lerCsv } from './csv';

describe('lerCsv', () => {
  it('lê linhas e colunas simples', () => {
    expect(lerCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('descarta o BOM do começo', () => {
    expect(lerCsv('﻿Data,Valor\n15/08/2026,45.00')).toEqual([
      ['Data', 'Valor'], ['15/08/2026', '45.00'],
    ]);
  });

  it('respeita vírgula dentro de aspas', () => {
    expect(lerCsv('a,b\n"MERCADO ALFA, LTDA",45.00')).toEqual([
      ['a', 'b'], ['MERCADO ALFA, LTDA', '45.00'],
    ]);
  });

  it('trata aspas duplicadas como uma aspa literal', () => {
    expect(lerCsv('a\n"diz ""oi"""')).toEqual([['a'], ['diz "oi"']]);
  });

  it('aceita fim de linha do Windows e ignora linha vazia', () => {
    expect(lerCsv('a,b\r\n1,2\r\n\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  // Campo entre aspas pode conter quebra de linha: ela fica DENTRO do campo e não parte o
  // registro em dois. É o caso que mais quebra parser de CSV escrito à mão.
  it('mantém a quebra de linha que está dentro de aspas', () => {
    expect(lerCsv('a,"b\nc",d')).toEqual([['a', 'b\nc', 'd']]);
  });

  // Arquivo truncado é entrada esperada: aproveita o que deu para ler, sem lançar.
  it('não lança quando as aspas nunca fecham', () => {
    expect(lerCsv('"a')).toEqual([['a']]);
  });
});
