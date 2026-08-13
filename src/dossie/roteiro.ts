import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import type { Roteiro } from './executar';

/**
 * Os 12 meses sintéticos que o dossiê roda. Cada passo acha o que precisa em `dados` pelo
 * nome — nunca por um id guardado de um passo anterior — para ficar legível sozinho e não
 * depender da ordem de criação.
 *
 * Nomes de box, categoria, cartão e estabelecimento são inventados. Nenhum valor lembra
 * saldo de conta real.
 */
export const ROTEIRO: Roteiro = {
  passos: [
    {
      data: '2026-01-05',
      descricao: 'Abre as boxes "carteira" e "reserva", cada uma com um banco dentro.',
      async executar() {
        await repo.salvarBox({
          id: 'box-carteira', nome: 'carteira',
          saldoInicial: 400_000, dataSaldoInicial: '2026-01-05',
          criadoEm: '2026-01-05T12:00:00.000Z', alteradoEm: '2026-01-05T12:00:00.000Z',
        });
        await repo.salvarBox({
          id: 'box-reserva', nome: 'reserva',
          saldoInicial: 1_200_000, dataSaldoInicial: '2026-01-05',
          criadoEm: '2026-01-05T12:00:00.000Z', alteradoEm: '2026-01-05T12:00:00.000Z',
        });
        await repo.salvarBanco({ boxId: 'box-carteira', nome: 'banco azul', ordem: 0 });
        await repo.salvarBanco({ boxId: 'box-reserva', nome: 'banco verde', ordem: 0 });
      },
    },
    {
      data: '2026-01-05',
      descricao:
        'Cria as categorias de ganho, "salário" e "extra", e as de gasto, "mercado", '
        + '"transporte" e "moradia", todas na box "carteira".',
      async executar() {
        await repo.salvarCategoria({ boxId: 'box-carteira', nome: 'salário', tipo: 'ganho', ordem: 0 });
        await repo.salvarCategoria({ boxId: 'box-carteira', nome: 'extra', tipo: 'ganho', ordem: 1 });
        await repo.salvarCategoria({ boxId: 'box-carteira', nome: 'mercado', tipo: 'gasto', ordem: 0 });
        await repo.salvarCategoria({ boxId: 'box-carteira', nome: 'transporte', tipo: 'gasto', ordem: 1 });
        await repo.salvarCategoria({ boxId: 'box-carteira', nome: 'moradia', tipo: 'gasto', ordem: 2 });
      },
    },
    {
      data: '2026-01-08',
      descricao:
        'Cria as recorrências do salário, no dia 5, e da moradia, no dia 10, e lança um '
        + 'extra pontual já recebido.',
      async executar(dados) {
        const horizonte = dados.config.horizonteProjecao;
        const carteira = dados.boxes.find((b) => b.nome === 'carteira')!;
        const salario = dados.categorias.find((c) => c.nome === 'salário')!;
        const extra = dados.categorias.find((c) => c.nome === 'extra')!;
        const moradia = dados.categorias.find((c) => c.nome === 'moradia')!;
        await repo.salvarRecorrencia({
          boxId: carteira.id, categoriaId: salario.id, valor: 500_000,
          dataInicio: '2026-02-05', diaDoMes: 5, parcelas: null,
        }, horizonte);
        await repo.salvarRecorrencia({
          boxId: carteira.id, categoriaId: moradia.id, valor: 150_000,
          dataInicio: '2026-02-10', diaDoMes: 10, parcelas: null,
        }, horizonte);
        await repo.salvarLancamento({
          boxId: carteira.id, categoriaId: extra.id, data: '2026-01-08', valor: 30_000,
          nota: 'Trabalho extra pontual', status: 'efetivo',
        });
      },
    },
    {
      data: '2026-01-20',
      descricao: 'Cadastra o cartão "sigma", com fechamento no dia 25 e vencimento no dia 5.',
      async executar(dados) {
        const horizonte = dados.config.horizonteProjecao;
        const carteira = dados.boxes.find((b) => b.nome === 'carteira')!;
        const bancoAzul = dados.bancos.find((b) => b.nome === 'banco azul')!;
        await repo.salvarCartao({
          boxId: carteira.id, nome: 'sigma', diaFechamento: 25, diaVencimento: 5, bancoId: bancoAzul.id,
        }, horizonte);
      },
    },
    {
      data: '2026-01-21',
      descricao: 'Cria as categorias do cartão "sigma": "compras" e "serviços".',
      async executar(dados) {
        const cartao = dados.cartoes.find((c) => c.nome === 'sigma')!;
        await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'compras', ordem: 0 });
        await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'serviços', ordem: 1 });
      },
    },
    {
      data: '2026-01-22',
      descricao:
        'Faz uma compra à vista de R$ 180,00 e uma compra parcelada de R$ 900,00 em seis vezes '
        + 'no cartão "sigma".',
      async executar(dados) {
        const horizonte = dados.config.horizonteProjecao;
        const cartao = dados.cartoes.find((c) => c.nome === 'sigma')!;
        const compras = dados.categoriasCartao.find((cc) => cc.cartaoId === cartao.id && cc.nome === 'compras')!;
        const servicos = dados.categoriasCartao.find((cc) => cc.cartaoId === cartao.id && cc.nome === 'serviços')!;
        await repo.salvarCompraCartao({
          cartaoId: cartao.id, categoriaCartaoId: compras.id, data: '2026-01-22',
          valorTotal: 18_000, parcelas: 1, descricao: 'Compra avulsa de equipamento',
        }, horizonte);
        await repo.salvarCompraCartao({
          cartaoId: cartao.id, categoriaCartaoId: servicos.id, data: '2026-01-22',
          valorTotal: 90_000, parcelas: 6, descricao: 'Curso online parcelado',
        }, horizonte);
      },
    },
    {
      data: '2026-02-01',
      descricao: 'Assina um serviço de streaming, R$ 39,90 por mês, sem data para acabar.',
      async executar(dados) {
        const horizonte = dados.config.horizonteProjecao;
        const cartao = dados.cartoes.find((c) => c.nome === 'sigma')!;
        const servicos = dados.categoriasCartao.find((cc) => cc.cartaoId === cartao.id && cc.nome === 'serviços')!;
        await repo.salvarAssinatura({
          cartaoId: cartao.id, categoriaCartaoId: servicos.id, valor: 3_990,
          dataInicio: '2026-02-01', diaDoMes: 1, parcelas: null, descricao: 'Assinatura de streaming',
        }, horizonte);
      },
    },
    {
      data: '2026-03-06',
      descricao: 'Confirma o pendente da moradia de fevereiro com o valor previsto.',
      async executar(dados) {
        const moradia = dados.categorias.find((c) => c.nome === 'moradia')!;
        const pendente = dados.lancamentos.find(
          (l) => l.categoriaId === moradia.id && l.status === 'previsto' && l.data === '2026-02-10',
        )!;
        await repo.confirmarPendente(pendente.id);
      },
    },
    {
      data: '2026-04-06',
      descricao: 'Confirma o pendente do salário de fevereiro com um valor diferente do previsto.',
      async executar(dados) {
        const salario = dados.categorias.find((c) => c.nome === 'salário')!;
        const pendente = dados.lancamentos.find(
          (l) => l.categoriaId === salario.id && l.status === 'previsto' && l.data === '2026-02-05',
        )!;
        await repo.confirmarPendente(pendente.id, 520_000);
      },
    },
    {
      data: '2026-05-04',
      descricao: 'Registra uma conferência da fatura de maio com valor divergente da soma das compras.',
      async executar(dados) {
        const horizonte = dados.config.horizonteProjecao;
        const cartao = dados.cartoes.find((c) => c.nome === 'sigma')!;
        await repo.salvarConferenciaFatura(cartao.id, '2026-05', 20_500, true, horizonte);
      },
    },
    {
      data: '2026-06-05',
      descricao: 'Paga a fatura de junho por menos que o total e parcela o resto em três vezes.',
      async executar(dados) {
        const cartao = dados.cartoes.find((c) => c.nome === 'sigma')!;
        const fatura = dados.lancamentos.find(
          (l) => l.origem === 'cartao' && l.categoriaId === cartao.categoriaFaturaId && l.data.startsWith('2026-06'),
        )!;
        await repo.registrarPagamentoFatura({
          lancamentoId: fatura.id,
          cartaoId: cartao.id,
          faturaMes: '2026-06',
          valorPagoCent: 20_000,
          dataPagamento: '2026-06-05',
          parcelamento: { parcelas: 3, valorParcelaCent: 15_000 },
          horizonte: dados.config.horizonteProjecao,
        });
      },
    },
    {
      data: '2026-07-10',
      descricao: 'Cria a viagem "praia", de 15 a 22 de julho.',
      async executar() {
        await repo.salvarViagem({ nome: 'praia', dataInicio: '2026-07-15', dataFim: '2026-07-22' });
      },
    },
    {
      data: '2026-07-17',
      descricao: 'Lança um gasto de mercado dentro da viagem e faz uma compra de cartão dentro dela também.',
      async executar(dados) {
        const horizonte = dados.config.horizonteProjecao;
        const carteira = dados.boxes.find((b) => b.nome === 'carteira')!;
        const mercado = dados.categorias.find((c) => c.nome === 'mercado')!;
        const cartao = dados.cartoes.find((c) => c.nome === 'sigma')!;
        const compras = dados.categoriasCartao.find((cc) => cc.cartaoId === cartao.id && cc.nome === 'compras')!;
        const viagem = dados.viagens.find((v) => v.nome === 'praia')!;
        await repo.salvarLancamento({
          boxId: carteira.id, categoriaId: mercado.id, data: '2026-07-17', valor: 8_000,
          nota: 'Mercado na praia', status: 'efetivo', viagemId: viagem.id,
        });
        await repo.salvarCompraCartao({
          cartaoId: cartao.id, categoriaCartaoId: compras.id, data: '2026-07-17',
          valorTotal: 6_000, parcelas: 1, descricao: 'Sorvete na praia', viagemId: viagem.id,
        }, horizonte);
      },
    },
    {
      data: '2026-09-01',
      descricao: 'Arquiva a categoria "extra", que já tem histórico de lançamento.',
      async executar(dados) {
        const extra = dados.categorias.find((c) => c.nome === 'extra')!;
        await repo.atualizarCategoria(extra.id, { arquivada: true });
      },
    },
    {
      data: '2026-10-01',
      descricao: 'Cria um cenário ligado, com um lançamento hipotético de financiamento de carro.',
      async executar(dados) {
        const carteira = dados.boxes.find((b) => b.nome === 'carteira')!;
        const transporte = dados.categorias.find((c) => c.nome === 'transporte')!;
        const agora = agoraISO();
        const cenario = {
          id: novoId(), nome: 'e se eu financiar um carro', ligado: true,
          criadoEm: agora, alteradoEm: agora,
        };
        await repo.salvarCenario(cenario);
        await repo.salvarLancamento({
          boxId: carteira.id, categoriaId: transporte.id, data: '2026-10-15', valor: 250_000,
          nota: 'Parcela hipotética de financiamento de carro', status: 'previsto', cenarioId: cenario.id,
        });
      },
    },
    {
      data: '2026-11-01',
      descricao: 'Desliga o cenário do financiamento de carro.',
      async executar(dados) {
        const cenario = dados.cenarios.find((c) => c.nome === 'e se eu financiar um carro')!;
        await repo.salvarCenario({ ...cenario, ligado: false });
      },
    },
  ],
  cortes: [
    { data: '2026-01-24', rotulo: 'antes do primeiro fechamento' },
    { data: '2026-01-28', rotulo: 'entre fechamento e vencimento' },
    { data: '2026-02-10', rotulo: 'depois do primeiro vencimento' },
    { data: '2026-06-20', rotulo: 'depois do pagamento parcial' },
    { data: '2026-07-18', rotulo: 'no meio da viagem' },
    { data: '2026-11-30', rotulo: 'fim do roteiro' },
  ],
};
