import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const SCRIPT = path.resolve('scripts/release.mjs');

function criarFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-test-'));
  return tmpDir;
}

function executarRelease(tmpDir, tipo, env = {}) {
  const nodeEnv = { ...process.env, ...env, RELEASE_DRY_RUN: '1' };
  const result = spawnSync('node', [SCRIPT, tipo], {
    cwd: tmpDir,
    env: nodeEnv,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function executarReleaseGit(tmpDir, tipo, env = {}) {
  const nodeEnv = { ...process.env, ...env };
  const result = spawnSync('node', [SCRIPT, tipo], {
    cwd: tmpDir,
    env: nodeEnv,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

describe('release.mjs', () => {
  describe('fragmentos válidos', () => {
    it('deve processar fragmentos com LF sem erros (dry-run)', () => {
      const tmp = criarFixture();
      try {
        // Setup
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.2.3' }, null, 2)
        );
        fs.writeFileSync(
          path.join(tmp, 'CHANGELOG.md'),
          '# Changelog\n\nHistórico de versões.\n'
        );
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-novo-recurso.md'),
          '- Novo recurso adicionado.\n- Outro item.\n'
        );

        // Executar
        const result = executarRelease(tmp, 'patch');

        // Verificar
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('1.2.3 → 1.2.4');
        expect(result.stdout).toContain('1 fragmento(s)');

        // Verificar que os arquivos foram escritos (mesmo em dry-run)
        const changelogContent = fs.readFileSync(path.join(tmp, 'CHANGELOG.md'), 'utf8');
        expect(changelogContent).toContain('## [1.2.4]');
        expect(changelogContent).toContain('### Adicionado');
        expect(changelogContent).toContain('- Novo recurso adicionado.');

        const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
        expect(pkg.version).toBe('1.2.4');

        // Fragmento foi deletado mesmo em dry-run
        const fragmentos = fs.readdirSync(path.join(tmp, 'changelog.d'));
        expect(fragmentos).not.toContain('adicionado-novo-recurso.md');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });

    it('deve processar fragmentos com CRLF preservando EOL (dry-run)', () => {
      const tmp = criarFixture();
      try {
        // Setup com CRLF
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '2.0.0' }, null, 2)
        );
        fs.writeFileSync(
          path.join(tmp, 'CHANGELOG.md'),
          '# Changelog\r\n\r\nHistórico de versões.\r\n'
        );
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'removido-funcao-antiga.md'),
          '- Removida função obsoleta.\r\n'
        );

        // Executar
        const result = executarRelease(tmp, 'minor');

        // Verificar
        expect(result.exitCode).toBe(0);

        // Verificar que CRLF foi preservado
        const changelogContent = fs.readFileSync(
          path.join(tmp, 'CHANGELOG.md'),
          'utf8'
        );
        expect(changelogContent).toContain('\r\n');
        expect(changelogContent).toContain('## [2.1.0]');
        expect(changelogContent).toContain('### Removido');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });

    it('deve processar múltiplos fragmentos de diferentes tipos', () => {
      const tmp = criarFixture();
      try {
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(
          path.join(tmp, 'CHANGELOG.md'),
          '# Changelog\n\n'
        );
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-feature-1.md'),
          '- Feature 1 adicionada.\n'
        );
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'alterado-behavior.md'),
          '- Comportamento alterado.\n'
        );
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'removido-deprecated.md'),
          '- API deprecated removida.\n'
        );

        const result = executarRelease(tmp, 'patch');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('3 fragmento(s)');

        const changelogContent = fs.readFileSync(path.join(tmp, 'CHANGELOG.md'), 'utf8');
        expect(changelogContent).toContain('### Adicionado');
        expect(changelogContent).toContain('### Alterado');
        expect(changelogContent).toContain('### Removido');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });
  });

  describe('fragmento vazio', () => {
    it('deve abortar com mensagem nomeando o arquivo', () => {
      const tmp = criarFixture();
      try {
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(path.join(tmp, 'changelog.d', 'adicionado-vazio.md'), '');

        const result = executarRelease(tmp, 'patch');

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('fragmento vazio');
        expect(result.stderr).toContain('adicionado-vazio.md');

        // Verificar que NADA foi escrito
        const changelogContent = fs.readFileSync(path.join(tmp, 'CHANGELOG.md'), 'utf8');
        expect(changelogContent).not.toContain('## [1.0.1]');

        const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
        expect(pkg.version).toBe('1.0.0');

        // Fragmento ainda existe
        expect(fs.existsSync(path.join(tmp, 'changelog.d', 'adicionado-vazio.md'))).toBe(true);
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });

    it('deve abortar se fragmento tem só espaços/quebras', () => {
      const tmp = criarFixture();
      try {
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-spaces.md'),
          '  \n\n   \n'
        );

        const result = executarRelease(tmp, 'patch');

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('fragmento vazio');

        const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
        expect(pkg.version).toBe('1.0.0');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });
  });

  describe('validação de formato', () => {
    it('deve abortar se linha não começa com "- "', () => {
      const tmp = criarFixture();
      try {
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-sem-dash.md'),
          '- Linha válida.\nLinha inválida sem dash.\n'
        );

        const result = executarRelease(tmp, 'patch');

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('deve começar com "- "');
        expect(result.stderr).toContain('changelog.d/README.md');
        expect(result.stderr).toContain('adicionado-sem-dash.md');

        const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
        expect(pkg.version).toBe('1.0.0');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });

    it('deve abortar se linha contém negrito (**)', () => {
      const tmp = criarFixture();
      try {
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-negrito.md'),
          '- Linha com **negrito** não permitido.\n'
        );

        const result = executarRelease(tmp, 'patch');

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('não pode conter "**"');
        expect(result.stderr).toContain('changelog.d/README.md');

        const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
        expect(pkg.version).toBe('1.0.0');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });

    it('deve abortar se linha começa com espaço/tab (com hífen)', () => {
      const tmp = criarFixture();
      try {
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-indented.md'),
          '- Linha válida.\n  - sub-item indentado.\n'
        );

        const result = executarRelease(tmp, 'patch');

        expect(result.exitCode).toBe(1);
        // Uma linha indentada é rejeitada no check de indentação (ordem corrigida)
        expect(result.stderr).toContain('não pode começar com espaço ou tab');
        expect(result.stderr).toContain('changelog.d/README.md');

        const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
        expect(pkg.version).toBe('1.0.0');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });

    it('deve abortar se linha começa com espaço/tab (sem hífen)', () => {
      const tmp = criarFixture();
      try {
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-indented.md'),
          '- Linha válida.\n  Linha indentada sem hífen.\n'
        );

        const result = executarRelease(tmp, 'patch');

        expect(result.exitCode).toBe(1);
        // Uma linha indentada é rejeitada no check de indentação (ordem corrigida)
        expect(result.stderr).toContain('não pode começar com espaço ou tab');
        expect(result.stderr).toContain('changelog.d/README.md');

        const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
        expect(pkg.version).toBe('1.0.0');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });
  });

  describe('guards de git (sem dry-run)', () => {
    function setupGitRepo(tmpDir) {
      execFileSync('git', ['init'], { cwd: tmpDir });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpDir });
      execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: tmpDir });
      // Garantir que estamos na branch 'main' (git init cria 'master' por padrão)
      try {
        execFileSync('git', ['checkout', '-b', 'main'], { cwd: tmpDir });
      } catch (e) {
        // Se falhar, tentar renomear master para main
        try {
          execFileSync('git', ['branch', '-m', 'master', 'main'], { cwd: tmpDir });
        } catch (e2) {
          // main já existe, só garantir que estamos nela
          execFileSync('git', ['checkout', 'main'], { cwd: tmpDir });
        }
      }
    }

    it('deve abortar se não estiver na branch main', () => {
      const tmp = criarFixture();
      try {
        setupGitRepo(tmp);
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-test.md'),
          '- Test.\n'
        );

        // Commit inicial e criar branch feature
        execFileSync('git', ['add', '.'], { cwd: tmp });
        execFileSync('git', ['commit', '-m', 'init'], { cwd: tmp });
        execFileSync('git', ['checkout', '-b', 'feature'], { cwd: tmp });

        const result = executarReleaseGit(tmp, 'patch', {});

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('rode na main');
        expect(result.stderr).toContain('branches de feature não fazem release');
        expect(result.stderr).toContain('feature');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });

    it('deve abortar se working tree está sujo fora de changelog.d/CHANGELOG.md/package.json', () => {
      const tmp = criarFixture();
      try {
        setupGitRepo(tmp);
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-test.md'),
          '- Test.\n'
        );
        fs.writeFileSync(path.join(tmp, 'outros-arquivo.js'), 'console.log("teste");');

        // Commit inicial
        execFileSync('git', ['add', '.'], { cwd: tmp });
        execFileSync('git', ['commit', '-m', 'init'], { cwd: tmp });

        // Modificar arquivo estranho
        fs.writeFileSync(path.join(tmp, 'outros-arquivo.js'), 'console.log("modificado");');

        const result = executarReleaseGit(tmp, 'patch', {});

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('working tree sujo');
        expect(result.stderr).toContain('outros-arquivo.js');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });

    it('deve abortar se tag da versão já existe', () => {
      const tmp = criarFixture();
      try {
        setupGitRepo(tmp);
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-test.md'),
          '- Test.\n'
        );

        // Commit inicial
        execFileSync('git', ['add', '.'], { cwd: tmp });
        execFileSync('git', ['commit', '-m', 'init'], { cwd: tmp });

        // Criar tag v1.0.1 (próxima versão)
        execFileSync('git', ['tag', 'v1.0.1'], { cwd: tmp });

        const result = executarReleaseGit(tmp, 'patch', {});

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('a versão já existe');
        expect(result.stderr).toContain('v1.0.1');
        expect(result.stderr).toContain('reconcilie');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });

    it('deve abortar se há arquivo untracked fora dos caminhos permitidos', () => {
      const tmp = criarFixture();
      try {
        setupGitRepo(tmp);
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-test.md'),
          '- Test.\n'
        );

        // Commit inicial
        execFileSync('git', ['add', '.'], { cwd: tmp });
        execFileSync('git', ['commit', '-m', 'init'], { cwd: tmp });

        // Adicionar arquivo untracked fora dos caminhos permitidos
        fs.writeFileSync(path.join(tmp, 'novo-arquivo.js'), 'console.log("novo");');

        const result = executarReleaseGit(tmp, 'patch', {});

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('working tree sujo');
        expect(result.stderr).toContain('novo-arquivo.js');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });
  });

  describe('caminho feliz com git', () => {
    it('deve criar commit e tag na main limpa', () => {
      const tmp = criarFixture();
      try {
        // Setup git
        execFileSync('git', ['init'], { cwd: tmp });
        execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmp });
        execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: tmp });
        // Garantir que estamos na branch 'main'
        try {
          execFileSync('git', ['checkout', '-b', 'main'], { cwd: tmp });
        } catch (e) {
          try {
            execFileSync('git', ['branch', '-m', 'master', 'main'], { cwd: tmp });
          } catch (e2) {
            execFileSync('git', ['checkout', 'main'], { cwd: tmp });
          }
        }

        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-test.md'),
          '- Test feature.\n'
        );

        // Commit inicial
        execFileSync('git', ['add', '.'], { cwd: tmp });
        execFileSync('git', ['commit', '-m', 'init'], { cwd: tmp });

        // Executar release (SEM dry-run)
        const result = executarReleaseGit(tmp, 'patch', {});

        expect(result.exitCode).toBe(0);
        // Script output vai para stdout
        expect(result.stdout).toContain('1.0.0 → 1.0.1');
        expect(result.stdout).toContain('commit + tag');

        // Verificar commit e tag
        const log = execFileSync('git', ['log', '--oneline'], { cwd: tmp, encoding: 'utf8' });
        expect(log).toContain('chore(release): v1.0.1');

        const tags = execFileSync('git', ['tag', '-l'], { cwd: tmp, encoding: 'utf8' });
        expect(tags).toContain('v1.0.1');

        // Verificar files
        const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
        expect(pkg.version).toBe('1.0.1');

        const changelogContent = fs.readFileSync(path.join(tmp, 'CHANGELOG.md'), 'utf8');
        expect(changelogContent).toContain('## [1.0.1]');

        // Fragmento foi deletado
        expect(fs.existsSync(path.join(tmp, 'changelog.d', 'adicionado-test.md'))).toBe(false);
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });
  });

});
