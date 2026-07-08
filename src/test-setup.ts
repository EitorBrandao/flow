import '@testing-library/jest-dom/vitest';

import { MotionGlobalConfig } from 'framer-motion';

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
