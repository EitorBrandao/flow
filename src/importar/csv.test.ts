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
});
