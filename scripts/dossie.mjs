#!/usr/bin/env node
// Regenera o dossiê de comportamento em docs/dossie/.
//
// Existe porque o gerador precisa do jsdom e do fake-indexeddb — ele roda dentro do Vitest,
// não como script solto. E precisa de uma variável de ambiente, que o npm não sabe passar
// igual no Windows e no Linux. Um spawn resolve os dois sem dependência nova.
import { spawn } from 'node:child_process';

const filho = spawn(
  'npx',
  ['vitest', 'run', 'src/dossie/dossie.test.ts'],
  { stdio: 'inherit', shell: true, env: { ...process.env, DOSSIE: 'escrever' } },
);

filho.on('exit', (codigo) => process.exit(codigo ?? 1));
