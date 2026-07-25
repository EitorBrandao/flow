#!/usr/bin/env node
/**
 * Hook: lembrete-ui.mjs
 * Detecta edições em UI (src/ui/, src/styles.css, index.html)
 * e emite lembrete sobre consultar docs/estilo-visual.md
 *
 * Arquivo de teste (*.test.tsx / *.test.ts) NÃO conta: não tem markup, classe nem
 * componente, então nenhum dos seis níveis do guia se aplica.
 *
 * Dedupe por session_id + arquivo: cada arquivo de UI avisa uma vez por sessão. Era uma vez
 * por SESSÃO, e aí a primeira edição qualquer em src/ui/ queimava o aviso — inclusive um
 * arquivo de teste, deixando a edição de componente seguinte sem nenhum lembrete.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';

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

const filePath = hookInput.tool_input?.file_path || '';
const sessionId = hookInput.session_id;

// Normalize path separators (handle Windows backslashes)
const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

// Check if file is under src/ui/, or is src/styles.css or exactly index.html (not subdir)
const isUIEdit =
  normalizedPath.includes('src/ui/') ||
  normalizedPath.includes('src/styles.css') ||
  normalizedPath === 'index.html' ||
  normalizedPath.endsWith('/index.html');

// Arquivo de teste não é edição de UI para efeito do guia de estilo
const isTeste = /\.test\.tsx?$/.test(normalizedPath);

if (!isUIEdit || isTeste) {
  process.exit(0);
}

// Dedupe logic: if session_id exists, use marker file (por sessão E por arquivo)
if (sessionId) {
  const hashArquivo = createHash('sha1').update(normalizedPath).digest('hex').slice(0, 12);
  const markerPath = join(tmpdir(), `flow-lembrete-ui-${sessionId}-${hashArquivo}`);

  try {
    if (existsSync(markerPath)) {
      // Already emitted in this session; be silent
      process.exit(0);
    }
  } catch {
    // Fail-open: error reading marker, continue to emit
  }

  // Emit the reminder
  const additionalContext = `Edição de UI detectada: antes de prosseguir, confirme que consultou docs/estilo-visual.md e o capítulo do nível da mudança em docs/estilo/ (CLAUDE.md, Regras do repositório). Classe/componente novo exige catalogação em docs/estilo/catalogo.md no mesmo commit.`;

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext
    }
  };

  console.log(JSON.stringify(output));

  // Create marker file (fail-open)
  try {
    writeFileSync(markerPath, '');
  } catch {
    // Fail-open: error creating marker, but already emitted
  }

  process.exit(0);
}

// No session_id: always emit (no dedupe)
const additionalContext = `Edição de UI detectada: antes de prosseguir, confirme que consultou docs/estilo-visual.md e o capítulo do nível da mudança em docs/estilo/ (CLAUDE.md, Regras do repositório). Classe/componente novo exige catalogação em docs/estilo/catalogo.md no mesmo commit.`;

const output = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext
  }
};

console.log(JSON.stringify(output));

process.exit(0);
