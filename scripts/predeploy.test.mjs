import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Criar um diretório temporário para cada teste
function criarTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'flow-predeploy-'));
}

function limparTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Executar comando git
function git(repoDir, ...args) {
  try {
    // Construir comando com proper quoting
    const quotedArgs = args.map((arg) => {
      if (arg.includes(' ') || arg.includes("'") || arg.includes('"')) {
        return `"${arg.replace(/"/g, '\\"')}"`;
      }
      return arg;
    });
    const cmd = `git ${quotedArgs.join(' ')}`;
    return execSync(cmd, {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    throw new Error(`git ${args[0]} failed: ${e.message}`);
  }
}

// Executar o script predeploy em um repo temporário
function executarPredeploy(repoDir, env = {}) {
  const scriptPath = path.resolve('./scripts/predeploy.mjs');
  try {
    execSync(`node "${scriptPath}"`, {
      cwd: repoDir,
      stdio: 'pipe',
      env: { ...process.env, ...env },
    });
    return { exit: 0 };
  } catch (e) {
    return { exit: e.status || 1, stderr: e.stderr?.toString() || '', stdout: e.stdout?.toString() || '' };
  }
}

// Setup git repo com configuração mínima
function setupGitRepo(repoDir) {
  git(repoDir, 'init');
  git(repoDir, 'config', 'user.email', 'test@example.com');
  git(repoDir, 'config', 'user.name', 'Test User');

  // Criar um commit inicial
  fs.writeFileSync(path.join(repoDir, 'README.md'), '# Test Repo\n');
  git(repoDir, 'add', 'README.md');
  git(repoDir, 'commit', '-m', 'Initial commit');
}

describe('predeploy guards', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = criarTempDir();
  });

  afterEach(() => {
    limparTempDir(tempDir);
  });

  it('deve falhar em branch de feature (não main)', () => {
    setupGitRepo(tempDir);
    git(tempDir, 'checkout', '-b', 'feature/teste');

    const result = executarPredeploy(tempDir);
    expect(result.exit).toBe(1);
    expect(result.stderr).toMatch(/deploy só na main/);
  });

  it('deve falhar com working tree sujo', () => {
    setupGitRepo(tempDir);
    git(tempDir, 'checkout', '-b', 'main');

    // Criar arquivo sujo
    fs.writeFileSync(path.join(tempDir, 'dirty.txt'), 'dirty');

    const result = executarPredeploy(tempDir);
    expect(result.exit).toBe(1);
    expect(result.stderr).toMatch(/working tree suja/);
  });

  it('deve falhar se há release de outro branch não mesclado', () => {
    setupGitRepo(tempDir);
    git(tempDir, 'checkout', '-b', 'main');

    // Simular que há um commit com chore(release) em outro branch
    git(tempDir, 'checkout', '-b', 'release-branch');
    fs.writeFileSync(path.join(tempDir, 'version.txt'), 'v1.0.0\n');
    git(tempDir, 'add', 'version.txt');
    git(tempDir, 'commit', '-m', 'chore(release): v1.0.0');

    // Voltar para main sem fazer merge
    git(tempDir, 'checkout', 'main');

    const result = executarPredeploy(tempDir);
    expect(result.exit).toBe(1);
    expect(result.stderr).toMatch(/outro branch tem release não mesclado/);
  });

  it('deve passar com main limpa, releases ancestrais, e sem remote', () => {
    setupGitRepo(tempDir);
    git(tempDir, 'checkout', '-b', 'main');

    // Criar um release no passado (ancestral)
    git(tempDir, 'checkout', '-b', 'release-v0.1.0');
    fs.writeFileSync(path.join(tempDir, 'version.txt'), 'v0.1.0\n');
    git(tempDir, 'add', 'version.txt');
    git(tempDir, 'commit', '-m', 'chore(release): v0.1.0');

    // Merge de volta para main
    git(tempDir, 'checkout', 'main');
    git(tempDir, 'merge', 'release-v0.1.0', '--no-edit');

    const result = executarPredeploy(tempDir);
    expect(result.exit).toBe(0);
  });

  it('deve pular guards com DEPLOY_FORCE=1 mesmo em estado errado', () => {
    setupGitRepo(tempDir);
    git(tempDir, 'checkout', '-b', 'feature/teste');

    // Mesmo em branch errado + tree sujo
    fs.writeFileSync(path.join(tempDir, 'dirty.txt'), 'dirty');

    const result = executarPredeploy(tempDir, { DEPLOY_FORCE: '1' });
    expect(result.exit).toBe(0);
  });

  it('deve avisar e prosseguir se fetch falha (sem remote origin)', () => {
    setupGitRepo(tempDir);
    git(tempDir, 'checkout', '-b', 'main');

    // Sem remote configurado, fetch vai falhar
    const result = executarPredeploy(tempDir);
    // Deve passar pois a regra é: falha de fetch não é fatal
    expect(result.exit).toBe(0);
  });
});
