#!/usr/bin/env node
/**
 * Hook: lembrete-ui.mjs
 * Detecta edições em UI (src/ui/, src/styles.css, index.html)
 * e emite lembrete sobre consultar docs/estilo-visual.md
 *
 * Dedupe por session_id: uma vez por sessão usando marcador em tmpdir
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
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

if (!isUIEdit) {
  process.exit(0);
}

// Dedupe logic: if session_id exists, use marker file
if (sessionId) {
  const markerPath = join(tmpdir(), `flow-lembrete-ui-${sessionId}`);

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
