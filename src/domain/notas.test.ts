import { notaExibivel } from './notas';

describe('notaExibivel', () => {
  it('devolve a nota quando ela difere da categoria', () => {
    expect(notaExibivel('Luz de setembro', 'Contas da casa')).toBe('Luz de setembro');
  });

  it('esconde a nota igual ao nome da categoria', () => {
    expect(notaExibivel('Salário', 'Salário')).toBeUndefined();
  });

  it('ignora diferença de caixa e espaços nas pontas', () => {
    expect(notaExibivel('  salário ', 'Salário')).toBeUndefined();
  });

  it('esconde nota vazia ou só de espaços', () => {
    expect(notaExibivel('', 'Salário')).toBeUndefined();
    expect(notaExibivel('   ', 'Salário')).toBeUndefined();
    expect(notaExibivel(undefined, 'Salário')).toBeUndefined();
  });

  it('mantém a nota que apenas contém o nome da categoria', () => {
    expect(notaExibivel('Salário extra', 'Salário')).toBe('Salário extra');
  });
});
