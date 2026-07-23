import { itensDaViagem, totalViagemNoMes, viagemAtivaEm, viagensSobrepoem } from './viagem';
import type { Cartao, CompraCartao, Lancamento, Viagem } from './types';
import { agoraISO, novoId } from './types';

function viagem(dataInicio: string, dataFim: string, nome = 'Praia'): Viagem {
  const agora = agoraISO();
  return { id: novoId(), nome, dataInicio, dataFim, criadoEm: agora, alteradoEm: agora };
}

function cartao(over: Partial<Cartao> = {}): Cartao {
  const agora = agoraISO();
  return {
    id: novoId(), boxId: 'box1', nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
    categoriaFaturaId: 'catfat', ativo: true, criadoEm: agora, alteradoEm: agora, ...over,
  };
}

function lancamento(over: Partial<Lancamento> & Pick<Lancamento, 'data' | 'valor'>): Lancamento {
  const agora = agoraISO();
  return {
    id: novoId(), boxId: 'box1', categoriaId: 'cat1', status: 'efetivo', origem: 'manual',
    criadoEm: agora, alteradoEm: agora, ...over,
  };
}

function compra(over: Partial<CompraCartao> & Pick<CompraCartao, 'data' | 'valorTotal'>): CompraCartao {
  const agora = agoraISO();
  return {
    id: novoId(), cartaoId: 'cartao1', categoriaCartaoId: 'catc1', parcelas: 1,
    criadoEm: agora, alteradoEm: agora, ...over,
  };
}

describe('viagemAtivaEm', () => {
  it('encontra a viagem cuja data inicial é a própria data', () => {
    const v = viagem('2026-01-31', '2026-02-05');
    expect(viagemAtivaEm([v], '2026-01-31')).toEqual(v);
  });

  it('encontra a viagem cuja data final é a própria data', () => {
    const v = viagem('2026-01-31', '2026-02-05');
    expect(viagemAtivaEm([v], '2026-02-05')).toEqual(v);
  });

  it('retorna null para data fora de qualquer período', () => {
    const v = viagem('2026-01-31', '2026-02-05');
    expect(viagemAtivaEm([v], '2026-02-06')).toBeNull();
  });

  it('retorna null quando não há viagens cadastradas', () => {
    expect(viagemAtivaEm([], '2026-02-01')).toBeNull();
  });
});

describe('viagensSobrepoem', () => {
  it('períodos adjacentes sem se tocar não sobrepõem', () => {
    const v = viagem('2026-01-10', '2026-01-15');
    expect(viagensSobrepoem([v], '2026-01-16', '2026-01-20')).toBe(false);
  });

  it('períodos que se tocam numa borda sobrepõem', () => {
    const v = viagem('2026-01-10', '2026-01-15');
    expect(viagensSobrepoem([v], '2026-01-15', '2026-01-20')).toBe(true);
  });

  it('ignora a própria viagem ao editar (ignorarId)', () => {
    const v = viagem('2026-01-10', '2026-01-15');
    expect(viagensSobrepoem([v], '2026-01-10', '2026-01-15', v.id)).toBe(false);
  });
});

describe('itensDaViagem', () => {
  it('agrupa por nota (débito) e descrição (cartão), soma subtotal e total', () => {
    const v = viagem('2026-01-31', '2026-02-05');
    const c = cartao();
    const lancamentos = [
      lancamento({ data: '2026-02-01', valor: 5000, nota: 'Almoço', viagemId: v.id }),
      lancamento({ data: '2026-02-02', valor: 3000, nota: 'almoço', viagemId: v.id }),
    ];
    const comprasCartao = [
      compra({ data: '2026-01-31', valorTotal: 20000, descricao: 'Hotel', viagemId: v.id, cartaoId: c.id }),
    ];
    const resumo = itensDaViagem(v, lancamentos, comprasCartao, ['box1'], [c], true);
    expect(resumo.total).toBe(28000);
    expect(resumo.grupos).toEqual([
      { chave: 'hotel', rotulo: 'Hotel', subtotal: 20000, itens: [{ data: '2026-01-31', valor: 20000 }] },
      {
        chave: 'almoço', rotulo: 'Almoço', subtotal: 8000,
        itens: [{ data: '2026-02-02', valor: 3000 }, { data: '2026-02-01', valor: 5000 }],
      },
    ]);
  });

  it('itens sem nota/descrição caem em "sem descrição"', () => {
    const v = viagem('2026-01-31', '2026-02-05');
    const lancamentos = [lancamento({ data: '2026-02-01', valor: 1000, viagemId: v.id })];
    const resumo = itensDaViagem(v, lancamentos, [], ['box1'], [], true);
    expect(resumo.grupos).toEqual([{ chave: '', rotulo: 'sem descrição', subtotal: 1000, itens: [{ data: '2026-02-01', valor: 1000 }] }]);
  });

  it('ignora lançamentos/compras de outra viagem ou sem viagem', () => {
    const v = viagem('2026-01-31', '2026-02-05');
    const outra = viagem('2026-03-01', '2026-03-05', 'Outra');
    const lancamentos = [
      lancamento({ data: '2026-02-01', valor: 1000, viagemId: v.id }),
      lancamento({ data: '2026-03-02', valor: 2000, viagemId: outra.id }),
      lancamento({ data: '2026-02-03', valor: 3000 }),
    ];
    const resumo = itensDaViagem(v, lancamentos, [], ['box1'], [], true);
    expect(resumo.total).toBe(1000);
  });

  it('filtra por box (compra de cartão via cartaoId -> boxId)', () => {
    const v = viagem('2026-01-31', '2026-02-05');
    const cDaBox1 = cartao({ id: 'c1', boxId: 'box1' });
    const cDaBox2 = cartao({ id: 'c2', boxId: 'box2' });
    const comprasCartao = [
      compra({ data: '2026-02-01', valorTotal: 1000, cartaoId: 'c1', viagemId: v.id, descricao: 'a' }),
      compra({ data: '2026-02-01', valorTotal: 2000, cartaoId: 'c2', viagemId: v.id, descricao: 'b' }),
    ];
    const resumo = itensDaViagem(v, [], comprasCartao, ['box1'], [cDaBox1, cDaBox2], true);
    expect(resumo.total).toBe(1000);
  });

  it('sem incluirPrevistos, ignora débito previsto mas conta compra de cartão sempre', () => {
    const v = viagem('2026-01-31', '2026-02-05');
    const c = cartao();
    const lancamentos = [lancamento({ data: '2026-02-01', valor: 1000, status: 'previsto', viagemId: v.id })];
    const comprasCartao = [compra({ data: '2026-02-01', valorTotal: 5000, viagemId: v.id, cartaoId: c.id, descricao: 'x' })];
    const resumo = itensDaViagem(v, lancamentos, comprasCartao, ['box1'], [c], false);
    expect(resumo.total).toBe(5000);
  });
});

describe('totalViagemNoMes', () => {
  it('soma débito do mês e ignora débito de outro mês', () => {
    const v = viagem('2026-01-31', '2026-02-05');
    const lancamentos = [
      lancamento({ data: '2026-02-01', valor: 1000, viagemId: v.id }),
      lancamento({ data: '2026-03-01', valor: 5000, viagemId: v.id }),
    ];
    expect(totalViagemNoMes(v, '2026-02', ['box1'], lancamentos, [], [], true)).toBe(1000);
  });

  it('parcela de compra cai no mês de vencimento da fatura, não no mês da compra', () => {
    const v = viagem('2026-01-31', '2026-02-05');
    const c = cartao(); // fecha dia 28, vence dia 5
    const comprasCartao = [
      compra({ data: '2026-01-31', valorTotal: 9000, parcelas: 3, viagemId: v.id, cartaoId: c.id }),
    ];
    // compra em 31/01 fecha na fatura de fev (fechamento 28/01 já passou) -> parcela 1 vence 05/03
    expect(totalViagemNoMes(v, '2026-02', ['box1'], [], comprasCartao, [c], true)).toBe(0);
    expect(totalViagemNoMes(v, '2026-03', ['box1'], [], comprasCartao, [c], true)).toBe(3000);
    expect(totalViagemNoMes(v, '2026-04', ['box1'], [], comprasCartao, [c], true)).toBe(3000);
    expect(totalViagemNoMes(v, '2026-05', ['box1'], [], comprasCartao, [c], true)).toBe(3000);
  });

  it('continua mostrando parcela pendente em mês futuro mesmo com incluirPrevistos desligado', () => {
    const v = viagem('2026-01-31', '2026-02-05');
    const c = cartao();
    const comprasCartao = [
      compra({ data: '2026-01-31', valorTotal: 6000, parcelas: 2, viagemId: v.id, cartaoId: c.id }),
    ];
    expect(totalViagemNoMes(v, '2026-04', ['box1'], [], comprasCartao, [c], false)).toBe(3000);
  });

  it('respeita incluirPrevistos para o lado débito', () => {
    const v = viagem('2026-01-31', '2026-02-05');
    const lancamentos = [lancamento({ data: '2026-02-01', valor: 1000, status: 'previsto', viagemId: v.id })];
    expect(totalViagemNoMes(v, '2026-02', ['box1'], lancamentos, [], [], false)).toBe(0);
    expect(totalViagemNoMes(v, '2026-02', ['box1'], lancamentos, [], [], true)).toBe(1000);
  });
});
