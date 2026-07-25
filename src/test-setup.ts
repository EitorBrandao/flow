import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

import { configure } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { db } from './db/database';

// `findBy*`/`waitFor` têm um relógio próprio, separado do `testTimeout` do Vitest: subir só o
// do Vitest não resolve um `findBy*` que estoura. O padrão de 1 s não cobre uma tela que faz
// import dinâmico do Recharts numa máquina ocupada — e a prova é que o teste do modal do
// gráfico já tinha um `{ timeout: 5000 }` na chamada e mesmo assim falhava. Isto só corre por
// inteiro quando o teste vai falhar de qualquer jeito; em teste que passa, não custa nada.
configure({ asyncUtilTimeout: 10_000 });

// Limpa as tabelas sem fechar a conexão: db.delete()+open() derruba promises de
// handlers de clique ainda em voo (onClick assíncrono não aguardado) com DatabaseClosedError.
export async function limparDb(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}

// framer-motion: animações instantâneas nos testes (sem esperas nem elementos presos em exit)
MotionGlobalConfig.skipAnimations = true;

// jsdom não implementa matchMedia; framer-motion consulta prefers-reduced-motion
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}

// jsdom não implementa ResizeObserver; Recharts (ResponsiveContainer) usa internamente
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom não implementa DataTransfer e ClipboardEvent; testes de paste precisam deles
if (typeof global !== 'undefined' && !global.DataTransfer) {
  global.DataTransfer = class {
    private data: Record<string, string> = {};
    setData(format: string, value: string) {
      this.data[format] = value;
    }
    getData(format: string): string {
      return this.data[format] || '';
    }
  } as unknown as typeof DataTransfer;
}

if (typeof global !== 'undefined' && !global.ClipboardEvent) {
  global.ClipboardEvent = class extends Event {
    clipboardData: DataTransfer | null;
    constructor(type: string, eventInit?: ClipboardEventInit) {
      super(type, eventInit);
      this.clipboardData = (eventInit as unknown as { clipboardData?: DataTransfer })?.clipboardData || null;
    }
  } as unknown as typeof ClipboardEvent;
}
