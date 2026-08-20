import type { Cartao, CategoriaCartao, CompraCartao, Dados, Categoria, Lancamento } from './types';
import { compararMeses, lancamentosDaCategoria, mediaMovel3, resumoMensal, serieMensal, serieMensalResumo, frequentes } from './aggregations';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };
const cats: Categoria[] = [
  { id: 'sal', boxId: 'be', nome: 'salario', tipo: 'ganho', ordem: 0, arquivada: false, ...ts },
  { id: 'car', boxId: 'be', nome: 'cartão', tipo: 'gasto', ordem: 0, arquivada: false, ...ts },
  { id: 'psi', boxId: 'be', nome: 'psicologa', tipo: 'gasto', ordem: 1, arquivada: false, ...ts },
];

function lanc(p: Partial<Lancamento> & Pick<Lancamento, 'id' | 'data' | 'valor' | 'categoriaId'>): Lancamento {
  return { boxId: 'be', status: 'efetivo', origem: 'manual', ...ts, ...p };
}

const lancs: Lancamento[] = [
  lanc({ id: '1', data: '2026-07-05', valor: 550000, categoriaId: 'sal' }),
  lanc({ id: '2', data: '2026-07-10', valor: 110000, categoriaId: 'car' }),
  lanc({ id: '3', data: '2026-07-12', valor: 80000, categoriaId: 'psi' }),
  lanc({ id: '4', data: '2026-07-20', valor: 50000, categoriaId: 'car', status: 'previsto' }),
  lanc({ id: '5', data: '2026-07-21', valor: 999999, categoriaId: 'car', status: 'previsto', cenarioId: 'x' }),
  lanc({ id: '6', data: '2026-06-10', valor: 90000, categoriaId: 'car' }),
  lanc({ id: '7', data: '2025-07-15', valor: 70000, categoriaId: 'car' }),
];

it('resumoMensal só com efetivos', () => {
  const r = resumoMensal('2026-07', ['be'], cats, lancs, false);
  expect(r.totalGanhos).toBe(550000);
  expect(r.totalGastos).toBe(190000);
  expect(r.sobra).toBe(360000);
  const cartao = r.linhas.find((l) => l.categoriaId === 'car')!;
  expect(cartao.total).toBe(110000);
  expect(cartao.pctDaRenda).toBeCloseTo(0.2);
  expect(r.linhas.find((l) => l.categoriaId === 'sal')!.pctDaRenda).toBeNull();
  expect(r.linhas[0].tipo).toBe('ganho'); // ganhos primeiro
});

it('resumoMensal com previstos inclui o previsto mas nunca o cenário', () => {
  const r = resumoMensal('2026-07', ['be'], cats, lancs, true);
  expect(r.totalGastos).toBe(240000); // 110000 + 80000 + 50000; cenário fora
});

it('compararMeses traz mês anterior e mesmo mês do ano anterior', () => {
  const c = compararMeses('2026-07', ['be'], cats, lancs, false);
  const cartao = c.find((x) => x.categoriaId === 'car')!;
  expect(cartao.atual).toBe(110000);
  expect(cartao.mesAnterior).toBe(90000);
  expect(cartao.anoAnterior).toBe(70000);
});

it('serieMensal e mediaMovel3', () => {
  const meses = ['2026-05', '2026-06', '2026-07'];
  expect(serieMensal('car', meses, ['be'], lancs, false)).toEqual([0, 90000, 110000]);
  expect(mediaMovel3([30, 60, 90, 120])).toEqual([null, null, 60, 90]);
});

it('lancamentosDaCategoria agrupa por nota normalizada, soma subtotal e ordena', () => {
  const lancsPix: Lancamento[] = [
    lanc({ id: 'p1', data: '2026-07-05', valor: 30000, categoriaId: 'car', nota: 'Maria Silva' }),
    lanc({ id: 'p2', data: '2026-07-12', valor: 20000, categoriaId: 'car', nota: ' maria silva ' }),
    lanc({ id: 'p3', data: '2026-07-08', valor: 15000, categoriaId: 'car', nota: 'Padaria' }),
    lanc({ id: 'p4', data: '2026-07-01', valor: 5000, categoriaId: 'car' }), // sem nota
  ];
  const grupos = lancamentosDaCategoria('2026-07', 'car', ['be'], lancsPix, false);

  expect(grupos).toHaveLength(3);
  expect(grupos[0].notaExibicao).toBe('Maria Silva');
  expect(grupos[0].notaChave).toBe('maria silva');
  expect(grupos[0].subtotal).toBe(50000);
  expect(grupos[0].itens.map((i) => i.data)).toEqual(['2026-07-12', '2026-07-05']); // recente primeiro
  expect(grupos[1].notaExibicao).toBe('Padaria');
  expect(grupos[1].subtotal).toBe(15000);
  expect(grupos[2].notaExibicao).toBe('sem nota');
  expect(grupos[2].subtotal).toBe(5000);
});

it('lancamentosDaCategoria respeita o filtro de box/mês/status/cenário', () => {
  const lancsPix: Lancamento[] = [
    lanc({ id: 'p1', data: '2026-07-05', valor: 30000, categoriaId: 'car', nota: 'Maria' }),
    lanc({ id: 'p2', data: '2026-07-05', valor: 30000, categoriaId: 'car', nota: 'Maria', boxId: 'outra' }),
    lanc({ id: 'p3', data: '2026-06-05', valor: 30000, categoriaId: 'car', nota: 'Maria' }), // mês errado
    lanc({ id: 'p4', data: '2026-07-05', valor: 30000, categoriaId: 'car', nota: 'Maria', status: 'previsto' }),
    lanc({ id: 'p5', data: '2026-07-05', valor: 999999, categoriaId: 'car', nota: 'Maria', status: 'previsto', cenarioId: 'x' }),
  ];
  const semPrevistos = lancamentosDaCategoria('2026-07', 'car', ['be'], lancsPix, false);
  expect(semPrevistos[0].subtotal).toBe(30000); // só p1

  const comPrevistos = lancamentosDaCategoria('2026-07', 'car', ['be'], lancsPix, true);
  expect(comPrevistos[0].subtotal).toBe(60000); // p1 + p4, cenário fora
});

it('serieMensalResumo soma ganho/gasto/sobra por mês', () => {
  const serie = serieMensalResumo(['2026-06', '2026-07'], ['be'], cats, lancs, false);
  expect(serie).toEqual([
    { mes: '2026-06', ganhos: 0, gastos: 90000, sobra: -90000 },
    { mes: '2026-07', ganhos: 550000, gastos: 190000, sobra: 360000 },
  ]);
});

it('serieMensalResumo com incluirPrevistos soma o previsto mas nunca o cenário', () => {
  const serie = serieMensalResumo(['2026-07'], ['be'], cats, lancs, true);
  expect(serie[0]).toEqual({ mes: '2026-07', ganhos: 550000, gastos: 240000, sobra: 310000 });
});

const tsF = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };
const HOJE = '2026-08-20';

const catsF: Categoria[] = [
  { id: 'cafe', boxId: 'b1', nome: 'Café', tipo: 'gasto', ordem: 0, arquivada: false, ...tsF },
  { id: 'merc', boxId: 'b1', nome: 'Mercado', tipo: 'gasto', ordem: 1, arquivada: false, ...tsF },
  { id: 'velha', boxId: 'b1', nome: 'Velha', tipo: 'gasto', ordem: 2, arquivada: true, ...tsF },
  { id: 'extra', boxId: 'b2', nome: 'De outra box', tipo: 'gasto', ordem: 0, arquivada: false, ...tsF },
];

const cartoesF: Cartao[] = [
  { id: 'c1', boxId: 'b1', nome: 'Cartão A', diaFechamento: 20, diaVencimento: 28,
    categoriaFaturaId: 'fat1', categoriaParcelamentoId: 'parc', ativo: true, ...tsF },
  { id: 'c2', boxId: 'b1', nome: 'Cartão B', diaFechamento: 10, diaVencimento: 18,
    categoriaFaturaId: 'fat2', ativo: false, ...tsF },
];

const catsCartaoF: CategoriaCartao[] = [
  { id: 'cc1', cartaoId: 'c1', nome: 'Farmácia', ordem: 0, arquivada: false, ...tsF },
  { id: 'parc', cartaoId: 'c1', nome: 'Parcelamento', ordem: 1, arquivada: false, ...tsF },
  { id: 'cc2', cartaoId: 'c2', nome: 'Posto', ordem: 0, arquivada: false, ...tsF },
];

function lancF(p: Partial<Lancamento> & Pick<Lancamento, 'id' | 'data' | 'valor' | 'categoriaId'>): Lancamento {
  return { boxId: 'b1', status: 'efetivo', origem: 'manual', ...tsF, ...p };
}

function compraF(p: Partial<CompraCartao> & Pick<CompraCartao, 'id' | 'data' | 'valorTotal' | 'categoriaCartaoId'>): CompraCartao {
  return { cartaoId: 'c1', parcelas: 1, ...tsF, ...p };
}

function dadosF(p: Partial<Dados> = {}): Dados {
  return {
    boxes: [], categorias: catsF, lancamentos: [], recorrencias: [], cenarios: [],
    cartoes: cartoesF, categoriasCartao: catsCartaoF, comprasCartao: [],
    recorrenciasCartao: [], conferenciasFatura: [], viagens: [], bancos: [],
    config: {
      id: 'config', boxPadraoId: null, ultimoBackupEm: null,
      mudancasDesdeBackup: false, horizonteProjecao: '2027-12-31',
    },
    ...p,
  };
}

const OPCOES = { hoje: HOJE, boxId: 'b1', cartaoIds: ['c1', 'c2'] };

it('frequentes: a janela de 60 dias corta o que é mais antigo', () => {
  const r = frequentes(dadosF({
    lancamentos: [
      // 'cafe' é o mais usado, mas todos os usos estão a 70 dias — fora da janela
      lancF({ id: 'a1', data: '2026-06-11', valor: 850, categoriaId: 'cafe' }),
      lancF({ id: 'a2', data: '2026-06-11', valor: 850, categoriaId: 'cafe' }),
      lancF({ id: 'a3', data: '2026-06-11', valor: 850, categoriaId: 'cafe' }),
      // 'merc' foi usado 1× a 50 dias — dentro
      lancF({ id: 'b1', data: '2026-07-01', valor: 18730, categoriaId: 'merc' }),
    ],
  }), OPCOES);
  expect(r.map((c) => c.destino)).toEqual([{ tipo: 'box', categoriaId: 'merc' }]);
});

it('frequentes: as duas pontas da janela são inclusivas', () => {
  const r = frequentes(dadosF({
    lancamentos: [
      lancF({ id: 'ini', data: '2026-06-22', valor: 100, categoriaId: 'cafe' }), // hoje-59
      lancF({ id: 'fim', data: HOJE, valor: 200, categoriaId: 'merc' }),
    ],
  }), OPCOES);
  expect(r).toHaveLength(2);
});

it('frequentes: o valor não entra na chave — três valores viram um chip só', () => {
  const r = frequentes(dadosF({
    lancamentos: [
      lancF({ id: 'm1', data: '2026-08-01', valor: 99999, categoriaId: 'merc' }),
      lancF({ id: 'm3', data: '2026-08-15', valor: 18730, categoriaId: 'merc' }), // mais recente
      lancF({ id: 'm2', data: '2026-08-08', valor: 50000, categoriaId: 'merc' }),
    ],
  }), OPCOES);
  expect(r).toHaveLength(1);
  expect(r[0].usos).toBe(3);
  // o da data mais recente — não o maior (99999), não o primeiro do array (99999),
  // não o último do array (50000)
  expect(r[0].valorCent).toBe(18730);
});

it('frequentes: o limite corta pelas mais usadas', () => {
  const lancamentos: Lancamento[] = [];
  const cats: Categoria[] = [];
  // 8 categorias; a de índice i tem (i + 1) usos, então as 6 melhores são i = 7..2
  for (let i = 0; i < 8; i += 1) {
    cats.push({ id: `k${i}`, boxId: 'b1', nome: `Cat ${i}`, tipo: 'gasto', ordem: i, arquivada: false, ...tsF });
    for (let n = 0; n <= i; n += 1) {
      lancamentos.push(lancF({ id: `k${i}-${n}`, data: '2026-08-10', valor: 100 + i, categoriaId: `k${i}` }));
    }
  }
  const r = frequentes(dadosF({ categorias: cats, lancamentos }), OPCOES);
  expect(r).toHaveLength(6);
  expect(r.map((c) => c.rotulo)).toEqual(['Cat 7', 'Cat 6', 'Cat 5', 'Cat 4', 'Cat 3', 'Cat 2']);
});

it('frequentes: só conta o que o usuário digitou', () => {
  const r = frequentes(dadosF({
    lancamentos: [
      lancF({ id: 'ok', data: '2026-08-10', valor: 850, categoriaId: 'cafe' }),
      lancF({ id: 'x1', data: '2026-08-11', valor: 850, categoriaId: 'merc', origem: 'recorrencia' }),
      lancF({ id: 'x2', data: '2026-08-12', valor: 850, categoriaId: 'merc', origem: 'cartao' }),
      lancF({ id: 'x3', data: '2026-08-13', valor: 850, categoriaId: 'merc', cenarioId: 'cen' }),
      lancF({ id: 'x4', data: '2026-08-14', valor: 850, categoriaId: 'velha' }), // arquivada
      lancF({ id: 'x5', data: '2026-08-15', valor: 850, categoriaId: 'extra', boxId: 'b2' }), // outra box
      lancF({ id: 'x6', data: '2026-08-16', valor: 850, categoriaId: 'sumiu' }), // categoria inexistente
    ],
  }), OPCOES);
  expect(r.map((c) => c.rotulo)).toEqual(['Café']);
});

it('frequentes: status não filtra — previsto digitado à mão conta', () => {
  const r = frequentes(dadosF({
    lancamentos: [
      lancF({ id: 'p1', data: '2026-08-10', valor: 850, categoriaId: 'cafe', status: 'previsto' }),
    ],
  }), OPCOES);
  expect(r).toHaveLength(1);
  expect(r[0].usos).toBe(1);
});

it('frequentes: compra de cartão vira chip com destino de cartão', () => {
  const r = frequentes(dadosF({
    comprasCartao: [
      compraF({ id: 'k1', data: '2026-08-10', valorTotal: 6240, categoriaCartaoId: 'cc1' }),
      compraF({ id: 'k2', data: '2026-08-12', valorTotal: 3000, categoriaCartaoId: 'cc1' }),
    ],
  }), OPCOES);
  expect(r).toHaveLength(1);
  expect(r[0].destino).toEqual({ tipo: 'cartao', cartaoId: 'c1', categoriaCartaoId: 'cc1' });
  expect(r[0].rotulo).toBe('Farmácia');
  expect(r[0].valorCent).toBe(3000);
  expect(r[0].chave).toBe('cartao:c1:cc1');
});

it('frequentes: compra automática, categoria reservada e cartão inativo ficam de fora', () => {
  const r = frequentes(dadosF({
    comprasCartao: [
      compraF({ id: 'y1', data: '2026-08-10', valorTotal: 6240, categoriaCartaoId: 'cc1', recorrenciaCartaoId: 'ass' }),
      compraF({ id: 'y2', data: '2026-08-11', valorTotal: 6240, categoriaCartaoId: 'parc' }),
      compraF({ id: 'y3', data: '2026-08-12', valorTotal: 6240, categoriaCartaoId: 'cc2', cartaoId: 'c2' }),
    ],
  }), OPCOES);
  expect(r).toEqual([]);
});

it('frequentes: cartão fora de cartaoIds não entra, mesmo estando ativo', () => {
  const r = frequentes(dadosF({
    comprasCartao: [compraF({ id: 'z1', data: '2026-08-10', valorTotal: 6240, categoriaCartaoId: 'cc1' })],
  }), { ...OPCOES, cartaoIds: [] });
  expect(r).toEqual([]);
});

it('frequentes: boxId null apaga os chips de box mas mantém os de cartão', () => {
  const r = frequentes(dadosF({
    lancamentos: [lancF({ id: 'n1', data: '2026-08-10', valor: 850, categoriaId: 'cafe' })],
    comprasCartao: [compraF({ id: 'n2', data: '2026-08-10', valorTotal: 6240, categoriaCartaoId: 'cc1' })],
  }), { ...OPCOES, boxId: null });
  expect(r.map((c) => c.rotulo)).toEqual(['Farmácia']);
});

it('frequentes: empate em usos desempata pela data mais recente, depois pela chave', () => {
  // 'cafe' e 'merc' têm 1 uso cada; 'merc' é mais recente e DEVE vir primeiro, mesmo com
  // 'cafe' vindo antes em ordem alfabética, em ordem de chave e em ordem de array.
  const r1 = frequentes(dadosF({
    lancamentos: [
      lancF({ id: 'e1', data: '2026-08-10', valor: 850, categoriaId: 'cafe' }),
      lancF({ id: 'e2', data: '2026-08-11', valor: 100, categoriaId: 'merc' }),
    ],
  }), OPCOES);
  expect(r1.map((c) => c.rotulo)).toEqual(['Mercado', 'Café']);

  // usos e data iguais: aí sim a chave crescente decide ('box:cafe' < 'box:merc')
  const r2 = frequentes(dadosF({
    lancamentos: [
      lancF({ id: 'e3', data: '2026-08-10', valor: 100, categoriaId: 'merc' }),
      lancF({ id: 'e4', data: '2026-08-10', valor: 850, categoriaId: 'cafe' }),
    ],
  }), OPCOES);
  expect(r2.map((c) => c.rotulo)).toEqual(['Café', 'Mercado']);
});

it('frequentes: sem histórico devolve lista vazia', () => {
  expect(frequentes(dadosF(), OPCOES)).toEqual([]);
});
