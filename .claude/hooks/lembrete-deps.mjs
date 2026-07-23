#!/usr/bin/env node
/**
 * Hook: lembrete-deps.mjs
 * Detecta comandos npm install/i/add
 * e emite lembrete sobre dependências novas (decisão de produto)
 */

import { readFileSync } from 'fs';

const stdin = readFileSync(0, 'utf-8');
let hookInput;

try {
  hookInput = JSON.parse(stdin);
} catch {
  process.exit(0);
}

const command = hookInput.tool_input?.command || '';

// Check if command contains npm + (install | i | add)
const isNpmInstall =
  command.includes('npm') &&
  (command.includes('install') || /\s+i\s+/.test(command) || command.includes('add'));

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
