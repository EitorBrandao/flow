import { vi } from 'vitest';
import type { ISODate } from '../domain/types';

/**
 * Congela o relógio e sequencia os ids, para o dossiê sair igual a cada rodada.
 *
 * O meio-dia UTC não é arbitrário: `hojeISO()` deriva a data do fuso local, e uma hora
 * perto da meia-noite faria a data virar num fuso e não noutro.
 */
const HORA_FIXA = 'T12:00:00.000Z';

export interface Ambiente {
  /** Move o relógio para a data indicada. Só para a frente. */
  avancarPara(data: ISODate): void;
  /** Devolve relógio e gerador de id reais. Sempre num `finally`. */
  restaurar(): void;
}

export function instalarAmbiente(dataInicial: ISODate): Ambiente {
  let dataAtual = dataInicial;
  let contador = 0;

  // `toFake: ['Date']` é obrigatório: falsear setTimeout trava o Dexie, que depende dele
  // para resolver transação — o teste pendura até o timeout em vez de falhar.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${dataInicial}${HORA_FIXA}`));

  // `novoId()` consulta `crypto.randomUUID` na hora da chamada, não na carga do módulo —
  // por isso trocar a função aqui basta. Zero padding para a ordem lexicográfica do id
  // coincidir com a ordem de criação: `carregarTudo` desempata por chave primária.
  const original = globalThis.crypto.randomUUID;
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value: () => `id-${String(++contador).padStart(4, '0')}`,
  });

  return {
    avancarPara(data: ISODate) {
      if (data < dataAtual) {
        throw new Error(`o roteiro não anda para trás: ${dataAtual} → ${data}`);
      }
      dataAtual = data;
      vi.setSystemTime(new Date(`${data}${HORA_FIXA}`));
    },
    restaurar() {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        configurable: true,
        value: original,
      });
      vi.useRealTimers();
    },
  };
}
