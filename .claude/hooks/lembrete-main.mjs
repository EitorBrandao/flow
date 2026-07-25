#!/usr/bin/env node
/**
 * Hook: lembrete-main.mjs
 * Avisa quando uma edição de arquivo VERSIONADO acontece com o checkout na `main`.
 *
 * "Nunca trabalhar direto na main — criar branch/worktree antes" é a regra mais repetida do
 * CLAUDE.md e era a única regra central sem nenhuma rede: catálogo, release, deploy,
 * dependência nova e edição de UI já tinham guard ou hook.
 *
 * Não bloqueia (exit 0 sempre), como os outros hooks daqui: quem bloqueia mora em scripts/
 * e no CI. Fail-open em qualquer erro — hook quebrado não pode travar edição.
 *
 * Arquivo ignorado pelo git não conta: TODO.md é local e gitignored de propósito, e editá-lo
 * na main é o fluxo normal.
 *
 * Dedupe por sessão (não por arquivo, ao contrário do lembrete-ui): "criar branch" é uma
 * decisão tomada uma vez, repetir a cada arquivo seria só ruído.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { dirname, isAbsolute, join, resolve } from 'path';
import { tmpdir } from 'os';

function silencio() {
  process.exit(0);
}

/** Primeiro diretório existente subindo a partir de `dir` (arquivo novo em pasta nova). */
function diretorioExistente(dir) {
  let atual = dir;
  for (let i = 0; i < 50 && atual; i += 1) {
    if (existsSync(atual)) return atual;
    const pai = dirname(atual);
    if (pai === atual) return null;
    atual = pai;
  }
  return null;
}

let hookInput;
try {
  hookInput = JSON.parse(readFileSync(0, 'utf-8'));
} catch {
  silencio();
}

try {
  const filePath = hookInput.tool_input?.file_path || '';
  if (!filePath) silencio();

  // O git precisa rodar de dentro do repositório DO ARQUIVO, não do cwd da sessão: com
  // worktrees os dois divergem, e é justamente o caso que este hook precisa acertar — a
  // sessão fica no checkout principal (main) enquanto o arquivo está no worktree da feature.
  const base = hookInput.cwd || process.cwd();
  const caminhoAbs = isAbsolute(filePath) ? filePath : resolve(base, filePath);
  const cwd = diretorioExistente(dirname(caminhoAbs)) || base;

  const git = (args) => execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (branch !== 'main') silencio();

  // gitignored → sem aviso (TODO.md e afins)
  let ignorado = false;
  try {
    execFileSync('git', ['check-ignore', '-q', caminhoAbs], { cwd, stdio: 'ignore' });
    ignorado = true; // exit 0 do check-ignore = está ignorado
  } catch {
    // exit 1 = não está ignorado; segue para o aviso
  }
  if (ignorado) silencio();

  const sessionId = hookInput.session_id;
  if (sessionId) {
    const markerPath = join(tmpdir(), `flow-lembrete-main-${sessionId}`);
    if (existsSync(markerPath)) silencio();
    try {
      writeFileSync(markerPath, '');
    } catch {
      // fail-open: sem marcador, no pior caso avisa de novo
    }
  }

  const additionalContext =
    'Você está editando um arquivo versionado com o checkout na branch main. A regra do '
    + 'CLAUDE.md é criar um branch próprio antes de alterar arquivos — e, como sessões '
    + 'concorrentes usam este mesmo checkout, trabalho com commits deve ir para um git '
    + 'worktree próprio (git worktree add .worktrees/<nome> -b <nome> main), nunca um '
    + 'checkout -b aqui. Se a edição for intencionalmente na main (integração, release), siga.';

  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext },
  }));

  process.exit(0);
} catch {
  // sem git, HEAD destacado, arquivo fora de repositório, qualquer coisa: silêncio
  process.exit(0);
}
