import { efeitoNoSaldo } from './money';
import type { Banco, Cartao, Categoria, Dados, ID, Lancamento } from './types';

/** Bancos das boxes pedidas, na ordem canônica de Ajustes (mesma disciplina das
 *  categorias de cartão: `ordem` decide, `nome` desempata). */
export function bancosDaBox(bancos: Banco[], boxIds: readonly ID[]): Banco[] {
  return bancos
    .filter((b) => boxIds.includes(b.boxId))
    .sort((a, b) => (a.ordem !== b.ordem ? a.ordem - b.ordem : a.nome.localeCompare(b.nome)));
}

/** Soma dos saldos informados, ignorando os que não foram informados. Devolve `null`
 *  quando NENHUM banco tem valor — "informou zero" e "não informou" são coisas
 *  diferentes, e confundi-las faz a tela acusar uma diferença inexistente. */
export function totalDeclaradoCent(bancos: Banco[]): number | null {
  const informados = bancos.filter((b) => b.saldoDeclaradoCent != null);
  if (informados.length === 0) return null;
  return informados.reduce((s, b) => s + b.saldoDeclaradoCent!, 0);
}

/** Banco pré-selecionado numa box: o marcado com `padrao` e, sem nenhuma marca, o primeiro
 *  por `ordem`. Um backup mesclado pode trazer dois marcados; vale o primeiro por `ordem`. */
export function bancoPadrao(bancos: Banco[], boxId: ID): Banco | undefined {
  const daBox = bancosDaBox(bancos, [boxId]);
  return daBox.find((b) => b.padrao === true) ?? daBox[0];
}

/** Banco de um cartão: o dele, ou o padrão da box. Vínculo que aponta para banco que não existe
 *  mais cai no padrão. Devolve `undefined` quando a box não tem bancos. */
export function bancoIdDoCartao(cartao: Cartao, bancos: Banco[]): ID | undefined {
  if (cartao.bancoId != null && bancos.some((b) => b.id === cartao.bancoId)) return cartao.bancoId;
  return bancoPadrao(bancos, cartao.boxId)?.id;
}

/** Banco de um lançamento: o gravado. Fatura de cartão sem banco gravado usa o banco do
 *  cartão — nunca o padrão, para trocar o padrão não mover o histórico. Referência a banco que
 *  não existe mais conta como "sem banco" (`undefined`). */
export function bancoIdDoLancamento(
  l: Lancamento, cartoes: Cartao[], bancos: Banco[],
): ID | undefined {
  const id = l.bancoId
    ?? (l.origem === 'cartao' ? cartoes.find((c) => c.id === l.cartaoId)?.bancoId : undefined);
  return id != null && bancos.some((b) => b.id === id) ? id : undefined;
}

export type DadosDeBanco = Pick<Dados, 'lancamentos' | 'categorias' | 'cartoes' | 'bancos'>;

/** Saldo do banco: o último saldo informado mais o efeito dos lançamentos efetivos do banco com
 *  data DEPOIS da data informada (a data do saldo é fim de dia: o que caiu nela já está no
 *  saldo). Sem saldo informado devolve `null`. Previsto, cenário e lançamento sem banco ficam
 *  de fora. */
export function saldoCalculadoBanco(banco: Banco, dados: DadosDeBanco): number | null {
  if (banco.saldoDeclaradoCent == null || banco.dataSaldoDeclarado == null) return null;
  const tipos = new Map(dados.categorias.map((c: Categoria) => [c.id, c.tipo]));
  let saldo = banco.saldoDeclaradoCent;
  for (const l of dados.lancamentos) {
    if (l.status !== 'efetivo' || l.cenarioId || l.data <= banco.dataSaldoDeclarado) continue;
    if (bancoIdDoLancamento(l, dados.cartoes, dados.bancos) !== banco.id) continue;
    saldo += efeitoNoSaldo(l.valor, tipos.get(l.categoriaId) ?? 'gasto');
  }
  return saldo;
}

/** O que o filtro por banco mostra: tudo, só o que não tem banco, ou um banco (por ID). */
export type FiltroBanco = 'todos' | 'sem-banco' | ID;

export function lancamentoNoFiltro(
  l: Lancamento, filtro: FiltroBanco, cartoes: Cartao[], bancos: Banco[],
): boolean {
  if (filtro === 'todos') return true;
  const id = bancoIdDoLancamento(l, cartoes, bancos);
  return filtro === 'sem-banco' ? id === undefined : id === filtro;
}

/** Cópia de `Dados` só com os lançamentos e as compras de cartão do filtro. Compra de cartão
 *  conta no banco do cartão (`bancoIdDoCartao`). O resto do snapshot segue igual. */
export function dadosDoBanco(dados: Dados, filtro: FiltroBanco): Dados {
  if (filtro === 'todos') return dados;
  const cartaoPorId = new Map(dados.cartoes.map((c) => [c.id, c]));
  return {
    ...dados,
    lancamentos: dados.lancamentos.filter(
      (l) => lancamentoNoFiltro(l, filtro, dados.cartoes, dados.bancos),
    ),
    comprasCartao: dados.comprasCartao.filter((c) => {
      const cartao = cartaoPorId.get(c.cartaoId);
      const id = cartao ? bancoIdDoCartao(cartao, dados.bancos) : undefined;
      return filtro === 'sem-banco' ? id === undefined : id === filtro;
    }),
  };
}

/** Nome do banco de um lançamento, ou "Sem banco". */
export function nomeBancoDoLancamento(
  l: Lancamento, dados: Pick<Dados, 'cartoes' | 'bancos'>,
): string {
  const id = bancoIdDoLancamento(l, dados.cartoes, dados.bancos);
  return dados.bancos.find((b) => b.id === id)?.nome ?? 'Sem banco';
}
