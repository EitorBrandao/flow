#!/usr/bin/env node
/**
 * Hook: scan-dados-reais.mjs
 * Scans git diff --cached for real financial data matching patterns in ~/.claude/flow-dados-reais.txt
 * Emits warning (non-blocking) if matches found, never echoing the matched text (data leak prevention)
 * Fail-open: any internal error → exit 0 silently
 */

import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { execFileSync } from 'child_process';
import { join } from 'path';

const stdin = readFileSync(0, 'utf-8');
let hookInput;

try {
  hookInput = JSON.parse(stdin);
} catch {
  process.exit(0);
}

try {
  const cwd = hookInput.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const patternsFilePath = join(homedir(), '.claude', 'flow-dados-reais.txt');

  // If patterns file doesn't exist or is empty, exit silently
  if (!existsSync(patternsFilePath)) {
    process.exit(0);
  }

  const patternsText = readFileSync(patternsFilePath, 'utf-8');
  const lines = patternsText.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#');
  });

  if (lines.length === 0) {
    process.exit(0);
  }

  // Get git diff --cached -U0
  let gitDiff;
  try {
    gitDiff = execFileSync('git', ['diff', '--cached', '-U0'], {
      cwd,
      encoding: 'utf-8'
    });
  } catch {
    // Git command failed (git not available, not a repo, etc.)
    process.exit(0);
  }

  // Parse diff: collect added lines (lines starting with +, excluding diff headers like +++)
  const addedLines = [];
  const addedLinesByFile = {}; // Track {file: [line_indices]}

  let currentFile = null;
  const diffLines = gitDiff.split('\n');

  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i];

    if (line.startsWith('+++')) {
      // Extract filename from +++ b/path/to/file
      currentFile = line.replace(/^\+\+\+ b\//, '').replace(/^\+\+\+ /, '');
      if (!addedLinesByFile[currentFile]) {
        addedLinesByFile[currentFile] = [];
      }
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      // This is an added line
      const content = line.substring(1); // Remove leading +
      addedLines.push({ file: currentFile, content, index: i });
      if (currentFile) {
        addedLinesByFile[currentFile].push(addedLines.length - 1);
      }
    }
  }

  // Check patterns against added lines
  const matches = [];

  for (const patternStr of lines) {
    let regex;
    try {
      regex = new RegExp(patternStr);
    } catch {
      // Invalid regex pattern, ignore
      continue;
    }

    for (const added of addedLines) {
      if (regex.test(added.content)) {
        // Don't echo the matched text; just track file and pattern
        matches.push({ file: added.file, pattern: patternStr });
      }
    }
  }

  if (matches.length > 0) {
    // Build warning: list files and patterns, never the matched text
    const matchList = matches
      .map(m => `${m.file}: padrão "${m.pattern}"`)
      .join(', ');

    const additionalContext = `Possível dado financeiro real no diff staged (padrões de ~/.claude/flow-dados-reais.txt): ${matchList}. Regra: nenhum dado real em arquivo versionado (CLAUDE.md). Confirme com o usuário antes de commitar.`;

    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext
      }
    };

    console.log(JSON.stringify(output));
  }

  process.exit(0);
} catch {
  // Any error: fail-open, exit silently
  process.exit(0);
}
