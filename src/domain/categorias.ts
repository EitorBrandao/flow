import type { Cartao, Categoria, CategoriaCartao, ID, Lancamento } from './types';

// Ordem canônica definida pelo usuário em Ajustes: ganhos antes de gastos, arquivadas
// sempre por último (grupo à parte, misturando os dois tipos); dentro do grupo, `ordem`
// decide e `nome` desempata — existem `ordem` duplicadas na prática (ex.: categoria de
// fatura nasce com ordem 0) e a ordem vinda do banco é arbitrária.
function grupoCategoria(c: Categoria): number {
  if (c.arquivada) return 2;
  return c.tipo === 'ganho' ? 0 : 1;
}

export function compararCategorias(a: Categoria, b: Categoria): number {
  const grupoA = grupoCategoria(a);
  const grupoB = grupoCategoria(b);
  if (grupoA !== grupoB) return grupoA - grupoB;
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.nome.localeCompare(b.nome);
}

export function compararCategoriasCartao(a: CategoriaCartao, b: CategoriaCartao): number {
  if (a.arquivada !== b.arquivada) return a.arquivada ? 1 : -1;
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.nome.localeCompare(b.nome);
}

interface ComOrdem { id: ID; ordem: number }

// Depois de um arraste, o índice 0-based de cada item na nova ordem vira o novo `ordem` a
// persistir; só devolve os que realmente mudaram, pra não escrever no banco à toa.
export function diffOrdem<T extends ComOrdem>(novaOrdem: readonly T[]): Array<{ id: ID; ordem: number }> {
  return novaOrdem
    .map((item, ordem) => ({ id: item.id, ordem }))
    .filter((item, i) => item.ordem !== novaOrdem[i].ordem);
}

// Próxima posição livre no fim de um grupo — usado tanto ao criar uma categoria quanto ao
// mover uma categoria pra outro grupo (arquivar/restaurar).
export function proximaOrdem(itensDoGrupo: readonly { ordem: number }[]): number {
  return Math.max(-1, ...itensDoGrupo.map((c) => c.ordem)) + 1;
}

/** Ids das CategoriaCartao que o app reserva para si (assinaturas automáticas e parcelamento
 *  de fatura) — não devem aparecer em nenhuma lista de **seleção manual** de categoria de
 *  cartão. Note que elas continuam aparecendo onde a fatura é só *exibida*: o resumo por
 *  categoria da TelaCartao mostra "Parcelamento" de propósito, que é o ponto da feature. */
export function categoriasCartaoReservadasIds(cartoes: Cartao[]): Set<ID> {
  return new Set(
    cartoes
      .flatMap((c) => [c.categoriaAssinaturasId, c.categoriaParcelamentoId])
      .filter((id): id is ID => id != null),
  );
}

function chaveCategoria(c: Categoria): string {
  const nome = c.nome.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[0300-036f]/g, '');
  return `${c.tipo}|${nome}`;
}

/** Junta categorias de mesmo tipo e mesmo nome (sem diferenciar maiúsculas, acentos nem espaços
 *  nas pontas). Serve à visão casa de Análises, onde cada box tem a sua "mercado". O representante
 *  do grupo é a primeira categoria ativa na ordem de `compararCategorias`; os lançamentos das
 *  outras passam a apontar para ele. As `ocultas` (fatura, transferência) ficam como estão: a
 *  folha da fatura depende do id original. Não altera as entradas. */
export function unificarCategoriasPorNome(
  categorias: Categoria[], lancamentos: Lancamento[], ocultas: ReadonlySet<ID>,
): { categorias: Categoria[]; lancamentos: Lancamento[] } {
  const grupos = new Map<string, Categoria[]>();
  for (const c of [...categorias].sort(compararCategorias)) {
    if (ocultas.has(c.id)) continue;
    const chave = chaveCategoria(c);
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(c);
    else grupos.set(chave, [c]);
  }
  const representante = new Map<ID, ID>(); // id absorvido -> id do representante
  const mantidas = new Set<ID>();
  for (const grupo of grupos.values()) {
    const rep = grupo.find((c) => !c.arquivada) ?? grupo[0];
    mantidas.add(rep.id);
    for (const c of grupo) if (c.id !== rep.id) representante.set(c.id, rep.id);
  }
  return {
    categorias: categorias.filter((c) => ocultas.has(c.id) || mantidas.has(c.id)),
    lancamentos: lancamentos.map((l) => {
      const rep = representante.get(l.categoriaId);
      return rep ? { ...l, categoriaId: rep } : l;
    }),
  };
}
