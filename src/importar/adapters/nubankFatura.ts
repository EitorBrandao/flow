import { addDias, addMesesData } from '../../domain/dates';
import type { ISODate } from '../../domain/types';
import { lerCsv } from '../csv';
import { corrigirUtf8Duplo } from '../texto';
import type { Adapter, LancamentoBruto, LeituraAdapter, NaturezaBruto } from '../tipos';
import { parsearDataExtrato, parsearValorExtrato } from '../valores';

const CABECALHO = 'date,title,amount';

/** Parcela no fim do título: " - Parcela 3/10" nas compras, " - 3/10" no Pix no Crédito. */
const PARCELA = /\s+-\s+(?:Parcela\s+)?(\d{1,2})\/(\d{1,2})$/i;

/** Crédito de uma compra: `Crédito de "<loja>"`. "é" com escape. */
const CREDITO_DE = /^Cr(?:é|e)dito de "(.+)"$/i;

function ehCabecalho(linha: string): boolean {
  return linha.replace(/^﻿/, '').trim().toLowerCase() === CABECALHO;
}

/**
 * Intervalo em que a compra de uma parcela n > 1 pode ter sido feita.
 *
 * A parcela n > 1 vem com a data de abertura do ciclo atual. A parcela 1 caiu no ciclo que
 * abriu `n − 1` meses antes; a compra foi feita dentro desse ciclo, que termina um dia antes
 * do ciclo seguinte abrir. Confirmado com dois arquivos reais: a parcela 1/4 trouxe a data
 * real da compra, e a 2/4, na fatura seguinte, deu um intervalo que contém essa data.
 */
export function intervaloDaCompra(dataLinha: ISODate, n: number): { min: ISODate; max: ISODate } {
  return {
    min: addMesesData(dataLinha, -(n - 1)),
    max: addDias(addMesesData(dataLinha, -(n - 2)), -1),
  };
}

function naturezaDe(descricao: string, valorArquivoCent: number): NaturezaBruto | undefined {
  if (valorArquivoCent >= 0) return undefined;
  return /^pagamento recebido$/i.test(descricao) ? 'pagamentoFatura' : 'estornoCartao';
}

/**
 * Fatura do cartão Nubank, em CSV (`date,title,amount`). O valor vem no formato brasileiro,
 * com compra positiva — o oposto da convenção do `LancamentoBruto`, então o sinal é invertido,
 * como no leitor do Santander.
 *
 * O CSV não separa titular de cartão virtual nem traz o total da fatura: tudo cai num bloco só,
 * sem `totalDeclaradoCent`.
 */
export function lerNubankFatura(texto: string): LeituraAdapter {
  const linhas = lerCsv(texto);
  const brutos: LancamentoBruto[] = [];
  const linhasNaoReconhecidas: string[] = [];
  let linhasIgnoradas = 0;

  if (linhas.length === 0 || !ehCabecalho(linhas[0].join(','))) {
    return { brutos, linhasIgnoradas, avisos: [], blocos: [] };
  }

  for (const colunas of linhas.slice(1)) {
    const data = parsearDataExtrato(colunas[0] ?? '');
    const titulo = (colunas[1] ?? '').trim();
    const valorArquivo = parsearValorExtrato(colunas[2] ?? '');
    if (data == null || valorArquivo == null || titulo === '') {
      linhasIgnoradas++;
      linhasNaoReconhecidas.push(colunas.join(','));
      continue;
    }

    let descricao = titulo;
    let parcela: { n: number; total: number } | undefined;
    const m = PARCELA.exec(titulo);
    if (m) {
      const n = Number(m[1]);
      const total = Number(m[2]);
      // Numeração impossível: o trecho fica na descrição, e a linha vale como compra à vista.
      if (n >= 1 && n <= total) {
        parcela = { n, total };
        descricao = titulo.slice(0, m.index).trim();
      }
    }
    const credito = CREDITO_DE.exec(descricao);
    if (credito) descricao = credito[1].trim();

    const natureza = naturezaDe(titulo, valorArquivo);
    const dataEstimada = parcela && parcela.n > 1 ? intervaloDaCompra(data, parcela.n) : undefined;
    brutos.push({
      data: dataEstimada ? dataEstimada.min : data,
      valorCent: -valorArquivo,
      descricao,
      fonte: 'cartao',
      ...(parcela ? { parcela } : {}),
      ...(natureza ? { natureza } : {}),
      ...(dataEstimada ? { dataEstimada } : {}),
    });
  }

  return {
    brutos, linhasIgnoradas, avisos: [], linhasNaoReconhecidas,
    blocos: [{ rotulo: 'Fatura Nubank', brutos }],
  };
}

export const nubankFatura: Adapter = {
  id: 'nubank-fatura-csv',
  rotulo: 'Nubank — fatura do cartão (CSV)',
  detectar: (_nome, inicio) => ehCabecalho(inicio.split('\n')[0] ?? ''),
  ler: async (conteudo) => {
    const texto = corrigirUtf8Duplo(new TextDecoder('utf-8').decode(conteudo));
    // Só para diagnóstico: deixa o usuário copiar o texto lido quando algo não é reconhecido.
    return { ...lerNubankFatura(texto), textoExtraido: texto };
  },
};
