#!/usr/bin/env node
// Guard pré-deploy: impede publicar o site de um estado errado.
//
// Checks (na ordem abaixo), todos pulados se DEPLOY_FORCE=1:
//   1. Branch deve ser main.
//   2. Working tree deve estar limpa.
//   3. Todos os commits com chore(release) de outros branches devem ser ancestrais de HEAD.
//   4. HEAD deve estar igual a origin/main (ou falha do fetch não é fatal).
//
// Variáveis de ambiente:
//   DEPLOY_FORCE=1  → pula todos os guards com aviso.

import { execFileSync } from 'node:child_process';
import process from 'node:process';

const raiz = process.cwd();
const forcar = process.env.DEPLOY_FORCE === '1';

function abortar(msg) {
  console.error(`\n  deploy: ${msg}\n`);
  process.exit(1);
}

function avisarForco() {
  console.log('\n  deploy: DEPLOY_FORCE=1 detectado — pulando todos os guards.\n');
}

// --- 1. Verificar branch ---

function verificarBranch() {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: raiz,
      encoding: 'utf8',
    }).trim();
    if (branch !== 'main') {
      abortar(`deploy só na main — branch atual: "${branch}"`);
    }
  } catch (e) {
    abortar(`erro ao verificar branch: ${e.message}`);
  }
}

// --- 2. Verificar working tree ---

function verificarWorkingTree() {
  try {
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: raiz,
      encoding: 'utf8',
    }).trim();
    if (status) {
      const entradas = status.split('\n').map((l) => `  ${l}`).join('\n');
      abortar(`working tree suja:\n${entradas}`);
    }
  } catch (e) {
    abortar(`erro ao verificar working tree: ${e.message}`);
  }
}

// --- 3. Verificar releases de outros branches ---

function verificarReleasesDeOutrosBranches() {
  try {
    // Pega todos os commits com "chore(release)" no log.
    const commits = execFileSync('git', ['log', '--all', '--grep=chore(release)', '--format=%H'], {
      cwd: raiz,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter((l) => l.trim());

    if (commits.length === 0) {
      // Sem releases, está tudo bem.
      return;
    }

    // Para cada commit, verificar se é ancestral de HEAD.
    const naoAncestral = [];
    for (const hash of commits) {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', hash, 'HEAD'], {
          cwd: raiz,
          stdio: 'pipe',
        });
        // exit 0 = é ancestral
      } catch (e) {
        // exit 1 = não é ancestral
        naoAncestral.push(hash);
      }
    }

    if (naoAncestral.length > 0) {
      const hashes = naoAncestral.map((h) => `  ${h}`).join('\n');
      abortar(
        `outro branch tem release não mesclado — mesclar/reconciliar antes de publicar:\n${hashes}`
      );
    }
  } catch (e) {
    abortar(`erro ao verificar releases de outros branches: ${e.message}`);
  }
}

// --- 4. Verificar HEAD pushado ---

function verificarHeadPushado() {
  try {
    // Tentar fazer fetch; se falhar, avisar mas não abortar.
    try {
      execFileSync('git', ['fetch', 'origin', 'main'], {
        cwd: raiz,
        stdio: 'pipe',
      });
    } catch (e) {
      console.log('  deploy: aviso: fetch de origin/main falhou (sem rede?). Continuando...');
      return;
    }

    // Fetch ok; comparar HEAD com origin/main.
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: raiz,
      encoding: 'utf8',
    }).trim();

    const originMain = execFileSync('git', ['rev-parse', 'origin/main'], {
      cwd: raiz,
      encoding: 'utf8',
    }).trim();

    if (head !== originMain) {
      // Detectar a situação (HEAD à frente vs. atrás).
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', 'HEAD', 'origin/main'], {
          cwd: raiz,
          stdio: 'pipe',
        });
        // HEAD é ancestral de origin/main → sua main está atrás.
        abortar('sua main está atrás de origin/main — dê git pull');
      } catch (e) {
        // HEAD não é ancestral de origin/main → HEAD está à frente.
        abortar('faça git push origin main antes do deploy');
      }
    }
  } catch (e) {
    abortar(`erro ao verificar HEAD pushado: ${e.message}`);
  }
}

// --- Main ---

if (forcar) {
  avisarForco();
} else {
  verificarBranch();
  verificarWorkingTree();
  verificarReleasesDeOutrosBranches();
  verificarHeadPushado();
}

console.log('  deploy: guards ok, rodando build...');
