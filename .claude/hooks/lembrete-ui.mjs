#!/usr/bin/env node
/**
 * Hook: lembrete-ui.mjs
 * Detecta edições em UI (src/ui/, src/styles.css, index.html)
 * e emite lembrete sobre consultar docs/estilo-visual.md
 */

import { readFileSync } from 'fs';

const stdin = readFileSync(0, 'utf-8');
let hookInput;

try {
  hookInput = JSON.parse(stdin);
} catch {
  process.exit(0);
}

const filePath = hookInput.tool_input?.file_path || '';

// Normalize path separators (handle Windows backslashes)
const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

// Check if file is under src/ui/, or is src/styles.css or index.html
const isUIEdit =
  normalizedPath.includes('src/ui/') ||
  normalizedPath.includes('src/styles.css') ||
  normalizedPath.includes('index.html');

if (isUIEdit) {
  const additionalContext = `Edição de UI detectada: antes de prosseguir, confirme que consultou docs/estilo-visual.md e o capítulo do nível da mudança em docs/estilo/ (CLAUDE.md, Regras do repositório). Classe/componente novo exige catalogação em docs/estilo/catalogo.md no mesmo commit.`;

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext
    }
  };

  console.log(JSON.stringify(output));
}

process.exit(0);
