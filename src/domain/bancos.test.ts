import type { Banco } from './types';
import { bancosDaBox, totalDeclaradoCent } from './bancos';

const ts = { criadoEm: '2026-08-01T12:00:00.000Z', alteradoEm: '2026-08-01T12:00:00.000Z' };

function banco(id: string, boxId: string, nome: string, ordem: number, declarado: number | null): Banco {
  return { id, boxId, nome, ordem, saldoDeclaradoCent: declarado, dataSaldoDeclarado: declarado != null ? '2026-08-01' : null, ...ts };
}

describe('bancosDaBox', () => {
  it('filtra pelas boxes pedidas', () => {
    const bancos = [banco('b1', 'box1', 'Alfa', 0, null), banco('b2', 'box2', 'Beta', 0, null)];
    expect(bancosDaBox(bancos, ['box1']).map((b) => b.id)).toEqual(['b1']);
  });

  it('ordena por ordem e desempata por nome', () => {
    // nomes escolhidos para que a ordenação correta DIVIRJA da puramente alfabética:
    // só por nome daria ['Apple', 'Mango', 'Zebra'], que não é o esperado abaixo
    const bancos = [
      banco('b1', 'box1', 'Zebra', 0, null),
      banco('b2', 'box1', 'Apple', 1, null),
      banco('b3', 'box1', 'Mango', 0, null),
    ];
    expect(bancosDaBox(bancos, ['box1']).map((b) => b.nome)).toEqual(['Mango', 'Zebra', 'Apple']);
  });

  it('boxes múltiplas (visão casa) trazem os bancos de todas', () => {
    const bancos = [banco('b1', 'box1', 'Alfa', 0, null), banco('b2', 'box2', 'Beta', 0, null)];
    expect(bancosDaBox(bancos, ['box1', 'box2'])).toHaveLength(2);
  });
});

describe('totalDeclaradoCent', () => {
  it('soma só os informados, ignorando os nulos', () => {
    const bancos = [banco('b1', 'box1', 'Alfa', 0, 50000), banco('b2', 'box1', 'Beta', 1, null), banco('b3', 'box1', 'Gama', 2, 30000)];
    expect(totalDeclaradoCent(bancos)).toBe(80000);
  });

  it('devolve null quando nenhum banco foi informado', () => {
    // distinguir "informou zero" de "não informou" é o que impede a tela de afirmar
    // uma diferença que não existe
    const bancos = [banco('b1', 'box1', 'Alfa', 0, null), banco('b2', 'box1', 'Beta', 1, null)];
    expect(totalDeclaradoCent(bancos)).toBe(null);
  });

  it('zero informado conta como informado, e não como ausente', () => {
    expect(totalDeclaradoCent([banco('b1', 'box1', 'Alfa', 0, 0)])).toBe(0);
  });

  it('zero misturado com não informados devolve 0, não null', () => {
    // se a função filtrasse por valor "falsy" em vez de por `!= null`, o zero sumiria
    // e o resultado viraria null — a tela então acusaria uma diferença inexistente
    const bancos = [banco('b1', 'box1', 'Alfa', 0, 0), banco('b2', 'box1', 'Beta', 1, null)];
    expect(totalDeclaradoCent(bancos)).toBe(0);
  });

  it('lista vazia devolve null', () => {
    expect(totalDeclaradoCent([])).toBe(null);
  });
});
