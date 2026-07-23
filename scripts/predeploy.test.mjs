import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, execSync } from 'node:child_process';
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
    return execFileSync('git', args, {
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
    execFileSync('node', [scriptPath], {
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

  it('deve avisar e prosseguir se fetch falha (sem remote origin)', () => {
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

    // Sem remote configurado, fetch vai falhar mas predeploy continua
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

  // Testes com remote real para o check 4 (HEAD vs origin/main)
  it('check 4: deve passar quando HEAD == origin/main com remote real', () => {
    const originDir = path.join(tempDir, 'origin.git');
    const repoDir = path.join(tempDir, 'repo');

    // Criar repo bare como origin
    fs.mkdirSync(originDir);
    git(originDir, 'init', '--bare');

    // Criar repo local e conectar ao origin
    fs.mkdirSync(repoDir);
    git(repoDir, 'init', '-b', 'main');
    git(repoDir, 'config', 'user.email', 'test@example.com');
    git(repoDir, 'config', 'user.name', 'Test User');
    git(repoDir, 'remote', 'add', 'origin', originDir);

    // Criar commit inicial e push para main
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# Test\n');
    git(repoDir, 'add', 'README.md');
    git(repoDir, 'commit', '-m', 'Initial commit');
    git(repoDir, 'push', '-u', 'origin', 'main');

    const result = executarPredeploy(repoDir);
    expect(result.exit).toBe(0);
  });

  it('check 4: deve falhar quando HEAD está à frente de origin/main', () => {
    const originDir = path.join(tempDir, 'origin.git');
    const repoDir = path.join(tempDir, 'repo');

    // Criar repo bare como origin
    fs.mkdirSync(originDir);
    git(originDir, 'init', '--bare');

    // Criar repo local e conectar ao origin
    fs.mkdirSync(repoDir);
    git(repoDir, 'init', '-b', 'main');
    git(repoDir, 'config', 'user.email', 'test@example.com');
    git(repoDir, 'config', 'user.name', 'Test User');
    git(repoDir, 'remote', 'add', 'origin', originDir);

    // Criar commit inicial e push
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# Test\n');
    git(repoDir, 'add', 'README.md');
    git(repoDir, 'commit', '-m', 'Initial commit');
    git(repoDir, 'push', '-u', 'origin', 'main');

    // Criar novo commit local sem fazer push
    fs.writeFileSync(path.join(repoDir, 'file.txt'), 'new content\n');
    git(repoDir, 'add', 'file.txt');
    git(repoDir, 'commit', '-m', 'Local commit not pushed');

    const result = executarPredeploy(repoDir);
    expect(result.exit).toBe(1);
    expect(result.stderr).toMatch(/faça git push origin main antes do deploy/);
  });

  it('check 4: deve falhar quando HEAD está atrás de origin/main', () => {
    const originDir = path.join(tempDir, 'origin.git');
    const repo1Dir = path.join(tempDir, 'repo1');
    const repo2Dir = path.join(tempDir, 'repo2');

    // Criar repo bare como origin
    fs.mkdirSync(originDir);
    git(originDir, 'init', '--bare');

    // Criar primeiro repo e fazer push do commit inicial
    fs.mkdirSync(repo1Dir);
    git(repo1Dir, 'init', '-b', 'main');
    git(repo1Dir, 'config', 'user.email', 'test@example.com');
    git(repo1Dir, 'config', 'user.name', 'Test User');
    git(repo1Dir, 'remote', 'add', 'origin', originDir);

    fs.writeFileSync(path.join(repo1Dir, 'README.md'), '# Test\n');
    git(repo1Dir, 'add', 'README.md');
    git(repo1Dir, 'commit', '-m', 'Initial commit');
    git(repo1Dir, 'push', '-u', 'origin', 'main');

    // Criar segundo repo (simula outro dev)
    fs.mkdirSync(repo2Dir);
    git(repo2Dir, 'init', '-b', 'main');
    git(repo2Dir, 'config', 'user.email', 'test2@example.com');
    git(repo2Dir, 'config', 'user.name', 'Test User 2');
    git(repo2Dir, 'remote', 'add', 'origin', originDir);

    // Fazer fetch e checkout de main
    git(repo2Dir, 'fetch', 'origin', 'main');
    git(repo2Dir, 'checkout', '-b', 'main', 'origin/main');

    // Commit e push de outro dev
    fs.writeFileSync(path.join(repo2Dir, 'file.txt'), 'new content\n');
    git(repo2Dir, 'add', 'file.txt');
    git(repo2Dir, 'commit', '-m', 'New commit from other dev');
    git(repo2Dir, 'push', 'origin', 'main');

    // No repo1, simular que HEAD está atrás de origin/main (reset local)
    git(repo1Dir, 'reset', '--hard', 'HEAD~0');

    const result = executarPredeploy(repo1Dir);
    expect(result.exit).toBe(1);
    expect(result.stderr).toMatch(/sua main está atrás de origin\/main/);
  });
});
