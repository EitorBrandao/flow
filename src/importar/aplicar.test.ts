import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { limparDb } from '../test-setup';
import { aplicar } from './aplicar';
import { CATEGORIA_A_CLASSIFICAR } from './conferencia';

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

  it('conta o item malformado em vez de descartá-lo em silêncio', async () => {
    const { box } = await montarBox();
    const resumo = await aplicar([
      // sem `lancamentoId`, que a ação exige
      { estado: 'previsto', acao: { tipo: 'confirmar' } },
      // sem `bruto`, que a ação exige
      { estado: 'novo', acao: { tipo: 'adicionarLancamento', categoriaId: 'qualquer' } },
    ], { boxId: box.id, horizonte: HORIZONTE });

    const dados = await repo.carregarTudo();
    expect(dados.lancamentos).toHaveLength(0);
    expect(resumo.invalidos).toBe(2);
  });

  it('exclui um lançamento a partir de uma sobra', async () => {
    const { box, gasto } = await montarBox();
    const l = await repo.salvarLancamento({
      boxId: box.id, categoriaId: gasto.id, data: '2026-08-15', valor: 4500,
      status: 'efetivo', nota: 'LOJA GAMA',
    });

    const resumo = await aplicar(
      [{ estado: 'sobra', lancamentoId: l.id, acao: { tipo: 'excluir' } }],
      { boxId: box.id, horizonte: HORIZONTE },
    );

    const dados = await repo.carregarTudo();
    expect(dados.lancamentos).toHaveLength(0);
    expect(resumo.excluidos).toBe(1);
  });

  // Excluir compra de cartão precisa propagar o horizonte, senão a fatura projetada fica
  // dessincronizada e continua cobrando uma compra que não existe mais.
  // Congela "hoje" antes do vencimento da fatura: `diffSincronizacao` só cria previsto com
  // vencimento no futuro (ver src/domain/fatura.ts), e sem isso o teste ficaria dependente da
  // data real do relógio, quebrando sozinho quando o vencimento simulado ficasse no passado.
  it('exclui uma compra de cartão e ressincroniza a fatura', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-08-01T12:00:00'));
      const { cartao, catCartao } = await montarCartaoDeTeste();
      const compra = await repo.salvarCompraCartao({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-08-10',
        valorTotal: 4500, parcelas: 1, descricao: 'MERCADO ALFA',
      }, HORIZONTE);

      const antes = await repo.carregarTudo();
      expect(antes.lancamentos.some((l) => l.origem === 'cartao')).toBe(true);

      await aplicar(
        [{ estado: 'sobra', compraCartaoId: compra.id, acao: { tipo: 'excluir' } }],
        { boxId: cartao.boxId, cartaoId: cartao.id, horizonte: HORIZONTE },
      );

      const depois = await repo.carregarTudo();
      expect(depois.comprasCartao).toHaveLength(0);
      expect(depois.lancamentos.some((l) => l.origem === 'cartao')).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  describe('sentinelas de "A classificar"', () => {
    it('cria "A classificar (entrada)" para a sentinela de ganho e aponta o lançamento pra ela', async () => {
      const { box } = await montarBox();

      await aplicar([{
        estado: 'novo',
        bruto: { data: '2026-08-15', valorCent: 100000, descricao: 'FULANO DE TAL', fonte: 'conta' },
        acao: { tipo: 'adicionarLancamento', categoriaId: CATEGORIA_A_CLASSIFICAR.ganho },
      }], { boxId: box.id, horizonte: HORIZONTE });

      const dados = await repo.carregarTudo();
      const categoria = dados.categorias.find((c) => c.nome === 'A classificar (entrada)');
      expect(categoria).toBeDefined();
      expect(categoria?.tipo).toBe('ganho');
      expect(dados.lancamentos[0].categoriaId).toBe(categoria?.id);
    });

    it('reusa a mesma categoria "A classificar" em duas chamadas seguidas', async () => {
      const { box, gasto } = await montarBox();

      async function adicionarUmGasto() {
        await aplicar([{
          estado: 'novo',
          bruto: { data: '2026-08-15', valorCent: -4500, descricao: 'LOJA GAMA', fonte: 'conta' },
          acao: { tipo: 'adicionarLancamento', categoriaId: CATEGORIA_A_CLASSIFICAR.gasto },
        }], { boxId: box.id, horizonte: HORIZONTE });
      }
      await adicionarUmGasto();
      await adicionarUmGasto();

      const dados = await repo.carregarTudo();
      const comEsseNome = dados.categorias.filter((c) => c.nome === 'A classificar');
      expect(comEsseNome).toHaveLength(1);
      // A categoria manual criada em `montarBox` também se chama "mercado", não "A classificar".
      expect(comEsseNome[0].id).not.toBe(gasto.id);
    });

    it('cria a categoria "A classificar" do cartão para a sentinela de cartão', async () => {
      // Não usa `montarCartaoDeTeste`: ela já cria uma categoria "A classificar" própria, o
      // que mascararia a criação sob demanda que este teste verifica.
      const { box } = await montarBox();
      const cartao = await repo.salvarCartao({
        boxId: box.id, nome: 'Santander', diaFechamento: 28, diaVencimento: 5,
      }, HORIZONTE);

      await aplicar([{
        estado: 'novo',
        bruto: { data: '2026-08-07', valorCent: -4500, descricao: 'MERCADO ALFA', fonte: 'cartao' },
        acao: { tipo: 'adicionarCompra', categoriaCartaoId: CATEGORIA_A_CLASSIFICAR.cartao },
      }], { boxId: cartao.boxId, cartaoId: cartao.id, horizonte: HORIZONTE });

      const dados = await repo.carregarTudo();
      const categoria = dados.categoriasCartao.find((c) => c.cartaoId === cartao.id && c.nome === 'A classificar');
      expect(categoria).toBeDefined();
      expect(dados.comprasCartao[0].categoriaCartaoId).toBe(categoria?.id);
    });

    it('não cria categoria nenhuma quando a lista só tem itens para ignorar', async () => {
      const { box } = await montarBox();

      await aplicar(
        [{ estado: 'interno', acao: { tipo: 'ignorar' } }],
        { boxId: box.id, horizonte: HORIZONTE },
      );

      const dados = await repo.carregarTudo();
      expect(dados.categorias.some((c) => c.nome.startsWith('A classificar'))).toBe(false);
      expect(dados.categoriasCartao.some((c) => c.nome === 'A classificar')).toBe(false);
    });
  });
});
