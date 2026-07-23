#!/usr/bin/env node
/**
 * Hook: lembrete-deps.mjs
 * Detecta comandos npm install/i/add (mas não uninstall)
 * e emite lembrete sobre dependências novas (decisão de produto)
 */

import { readFileSync } from 'fs';

let stdin;
try {
  stdin = readFileSync(0, 'utf-8');
} catch {
  process.exit(0);
}

let hookInput;
try {
  hookInput = JSON.parse(stdin);
} catch {
  process.exit(0);
}

const command = hookInput.tool_input?.command || '';

// Use regex to match npm install/i/add (not uninstall)
// \bnpm\s+(install|i|add)\b ensures we match the exact command after npm
const isNpmInstall = /\bnpm\s+(install|i|add)\b/.test(command);

if (isNpmInstall) {
  const additionalContext = `Instalação de dependência detectada: dependência nova (inclusive dev) é decisão de produto — confirme com o usuário antes, justifique por que código próprio não basta, rode npm audit e inclua o lockfile no mesmo commit (CLAUDE.md, Regras do repositório).`;

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext
    }
  };

  console.log(JSON.stringify(output));
}

process.exit(0);
