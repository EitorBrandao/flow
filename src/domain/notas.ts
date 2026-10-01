/**
 * A nota de um lançamento só vale a pena quando diz algo que a categoria já não diz.
 * Recorrência e lançamento rápido costumam gravar o próprio nome da categoria como nota:
 * mostrar as duas linhas ("Salário" e "Salário") é ruído.
 */
export function notaExibivel(nota: string | undefined, nomeCategoria: string): string | undefined {
  const limpa = nota?.trim();
  if (!limpa) return undefined;
  const igual = limpa.toLocaleLowerCase('pt-BR') === nomeCategoria.trim().toLocaleLowerCase('pt-BR');
  return igual ? undefined : limpa;
}
