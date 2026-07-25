/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Flow — controle financeiro',
        short_name: 'Flow',
        description: 'Fluxo de caixa diário com saldo projetado',
        lang: 'pt-BR',
        display: 'standalone',
        theme_color: '#0b0d11',
        background_color: '#0b0d11',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  base: './',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    // O padrão de 5 s falhava sozinho numa máquina de desenvolvimento ocupada, com um teste
    // diferente a cada rodada — medido em 2026-07-25: com timeout alto e a suíte inteira em
    // paralelo, 3 testes passaram de 5 s (pico de 5,8 s) e 2 ficaram entre 3 e 5 s. São os
    // testes que sobem tela cheia com Recharts e os de scripts/, que sobem repositórios git
    // de verdade. Timeout generoso não custa nada em teste que passa — só limita o quanto um
    // teste travado segura a suíte —, e vermelho intermitente treina a ignorar vermelho.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // .worktrees/ e .claude/worktrees/ contêm checkouts paralelos completos (node_modules incluso)
    // usados por sessões de implementação isoladas — sem excluir, o Vitest coleta os testes de lá
    // também e carrega uma segunda cópia do React, quebrando hooks ("Invalid hook call").
    exclude: [...configDefaults.exclude, '.worktrees/**', 'worktrees/**', '.claude/worktrees/**'],
  },
});
