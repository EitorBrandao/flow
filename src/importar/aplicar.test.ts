import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { limparDb } from '../test-setup';
import { aplicar } from './aplicar';

const HORIZONTE = '2027-12-31';

async function montarBox() {
  const agora = agoraISO();
  const box = {
    id: novoId(), nome: 'casa', saldoInicial: 0, dataSaldoInicial: '2026-01-01',
    criadoEm: agora, alteradoEm: agora,
  };
  await repo.salvarBox(box);
  const gasto = await repo.salvarCategoria({
    boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0,
  });
  return { box, gasto };
}

async function montarCartaoDeTeste() {
  const { box } = await montarBox();
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Santander', diaFechamento: 28, diaVencimento: 5,
  }, HORIZONTE);
  const catCartao = await repo.salvarCategoriaCartao({
    cartaoId: cartao.id, nome: 'A classificar', ordem: 0,
  });
  return { box, cartao, catCartao };
}

describe('aplicar', () => {
  beforeEach(async () => { await limparDb(); });

  it('confirma um previsto com o valor do banco', async () => {
    const { box, gasto } = await montarBox();
    const l = await repo.salvarLancamento({
      boxId: box.id, categoriaId: gasto.id, data: '2026-08-15', valor: 12000,
      status: 'previsto', nota: 'LOJA GAMA',
    });

    const resumo = await aplicar([{
      estado: 'divergente', lancamentoId: l.id,
      acao: { tipo: 'confirmarComValor', valorCent: 13700, data: '2026-08-15' },
    }], { boxId: box.id, horizonte: HORIZONTE });

    const dados = await repo.carregarTudo();
    const atualizado = dados.lancamentos.find((x) => x.id === l.id);
    expect(atualizado?.status).toBe('efetivo');
    expect(atualizado?.valor).toBe(13700);
    expect(resumo.confirmados).toBe(1);
  });

  it('adiciona um lançamento novo com valor positivo', async () => {
    const { box, gasto } = await montarBox();
    const resumo = await aplicar([{
      estado: 'novo',
      bruto: { data: '2026-08-15', valorCent: -4500, descricao: 'LOJA GAMA', fonte: 'conta' },
      acao: { tipo: 'adicionarLancamento', categoriaId: gasto.id },
    }], { boxId: box.id, horizonte: HORIZONTE });

    const dados = await repo.carregarTudo();
    expect(dados.lancamentos).toHaveLength(1);
    // No Flow o valor é sempre positivo; quem diz saída é o tipo da categoria.
    expect(dados.lancamentos[0].valor).toBe(4500);
    expect(dados.lancamentos[0].status).toBe('efetivo');
    expect(resumo.adicionados).toBe(1);
  });

  // Esta é a razão de `compraReconstruida` existir: sem ela, gravaria o valor da parcela
  // como se fosse o total da compra, dez vezes menor.
  it('grava a compra parcelada com o total reconstruído, não com o valor da parcela', async () => {
    const { cartao, catCartao } = await montarCartaoDeTeste();

    await aplicar([{
      estado: 'novo',
      bruto: {
        data: '2026-07-02', valorCent: -10000, descricao: 'LOJA GAMA',
        fonte: 'cartao', parcela: { n: 3, total: 10 },
      },
      compraReconstruida: {
        data: '2026-07-02', valorTotalCent: 100000, parcelas: 10, anoDeduzidoComAviso: false,
      },
      acao: { tipo: 'adicionarCompra', categoriaCartaoId: catCartao.id },
    }], { boxId: cartao.boxId, cartaoId: cartao.id, horizonte: HORIZONTE });

    const dados = await repo.carregarTudo();
    expect(dados.comprasCartao).toHaveLength(1);
    expect(dados.comprasCartao[0].valorTotal).toBe(100000);
    expect(dados.comprasCartao[0].parcelas).toBe(10);
  });

  it('grava a compra à vista com o valor do bruto', async () => {
    const { cartao, catCartao } = await montarCartaoDeTeste();

    await aplicar([{
      estado: 'novo',
      bruto: { data: '2026-08-07', valorCent: -4500, descricao: 'MERCADO ALFA', fonte: 'cartao' },
      acao: { tipo: 'adicionarCompra', categoriaCartaoId: catCartao.id },
    }], { boxId: cartao.boxId, cartaoId: cartao.id, horizonte: HORIZONTE });

    const dados = await repo.carregarTudo();
    expect(dados.comprasCartao[0].valorTotal).toBe(4500);
    expect(dados.comprasCartao[0].parcelas).toBe(1);
  });

  it('não grava nada para itens ignorados', async () => {
    const { box } = await montarBox();
    const resumo = await aplicar(
      [{ estado: 'interno', acao: { tipo: 'ignorar' } }],
      { boxId: box.id, horizonte: HORIZONTE },
    );
    const dados = await repo.carregarTudo();
    expect(dados.lancamentos).toHaveLength(0);
    expect(dados.comprasCartao).toHaveLength(0);
    expect(resumo.ignorados).toBe(1);
  });
});
