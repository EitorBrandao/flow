import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { homedir } from 'os';

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();

describe('Hook Scripts', () => {
  describe('lembrete-ui.mjs', () => {
    it('should emit context when file_path is in src/ui/', () => {
      const input = {
        tool_name: 'Edit',
        tool_input: { file_path: 'src/ui/Button.tsx' },
        cwd: PROJECT_DIR
      };

      const output = execFileSync('node', [join(PROJECT_DIR, '.claude/hooks/lembrete-ui.mjs')], {
        input: JSON.stringify(input),
        encoding: 'utf-8'
      });

      expect(output).toContain('additionalContext');
      expect(output).toContain('docs/estilo-visual.md');
      expect(JSON.parse(output).hookSpecificOutput.additionalContext).toContain(
        'Edição de UI detectada'
      );
    });

    it('should emit context when file_path is src/styles.css', () => {
      const input = {
        tool_name: 'Write',
        tool_input: { file_path: 'src/styles.css' },
        cwd: PROJECT_DIR
      };

      const output = execFileSync('node', [join(PROJECT_DIR, '.claude/hooks/lembrete-ui.mjs')], {
        input: JSON.stringify(input),
        encoding: 'utf-8'
      });

      expect(output).toContain('additionalContext');
      expect(JSON.parse(output).hookSpecificOutput.additionalContext).toContain(
        'Edição de UI detectada'
      );
    });

    it('should emit context when file_path is index.html', () => {
      const input = {
        tool_name: 'Edit',
        tool_input: { file_path: 'index.html' },
        cwd: PROJECT_DIR
      };

      const output = execFileSync('node', [join(PROJECT_DIR, '.claude/hooks/lembrete-ui.mjs')], {
        input: JSON.stringify(input),
        encoding: 'utf-8'
      });

      expect(output).toContain('additionalContext');
    });

    it('should be silent when file_path is in src/domain/', () => {
      const input = {
        tool_name: 'Edit',
        tool_input: { file_path: 'src/domain/User.ts' },
        cwd: PROJECT_DIR
      };

      const output = execFileSync('node', [join(PROJECT_DIR, '.claude/hooks/lembrete-ui.mjs')], {
        input: JSON.stringify(input),
        encoding: 'utf-8'
      });

      expect(output.trim()).toBe('');
    });

    it('should handle Windows path separators', () => {
      const input = {
        tool_name: 'Edit',
        tool_input: { file_path: 'src\\ui\\Dialog.tsx' },
        cwd: PROJECT_DIR
      };

      const output = execFileSync('node', [join(PROJECT_DIR, '.claude/hooks/lembrete-ui.mjs')], {
        input: JSON.stringify(input),
        encoding: 'utf-8'
      });

      expect(output).toContain('additionalContext');
    });

    it('should be silent for missing tool_input', () => {
      const input = {
        tool_name: 'Edit',
        cwd: PROJECT_DIR
      };

      const output = execFileSync('node', [join(PROJECT_DIR, '.claude/hooks/lembrete-ui.mjs')], {
        input: JSON.stringify(input),
        encoding: 'utf-8'
      });

      expect(output.trim()).toBe('');
    });
  });

  describe('lembrete-deps.mjs', () => {
    it('should emit context when command contains "npm install"', () => {
      const input = {
        tool_name: 'Bash',
        tool_input: { command: 'npm install lodash' },
        cwd: PROJECT_DIR
      };

      const output = execFileSync('node', [join(PROJECT_DIR, '.claude/hooks/lembrete-deps.mjs')], {
        input: JSON.stringify(input),
        encoding: 'utf-8'
      });

      expect(output).toContain('additionalContext');
      expect(JSON.parse(output).hookSpecificOutput.additionalContext).toContain(
        'Instalação de dependência detectada'
      );
    });

    it('should emit context when command contains "npm i"', () => {
      const input = {
        tool_name: 'Bash',
        tool_input: { command: 'npm i express' },
        cwd: PROJECT_DIR
      };

      const output = execFileSync('node', [join(PROJECT_DIR, '.claude/hooks/lembrete-deps.mjs')], {
        input: JSON.stringify(input),
        encoding: 'utf-8'
      });

      expect(output).toContain('additionalContext');
    });

    it('should emit context when command contains "npm add"', () => {
      const input = {
        tool_name: 'Bash',
        tool_input: { command: 'npm add react-dom' },
        cwd: PROJECT_DIR
      };

      const output = execFileSync('node', [join(PROJECT_DIR, '.claude/hooks/lembrete-deps.mjs')], {
        input: JSON.stringify(input),
        encoding: 'utf-8'
      });

      expect(output).toContain('additionalContext');
    });

    it('should be silent when command is "npm run build"', () => {
      const input = {
        tool_name: 'Bash',
        tool_input: { command: 'npm run build' },
        cwd: PROJECT_DIR
      };

      const output = execFileSync('node', [join(PROJECT_DIR, '.claude/hooks/lembrete-deps.mjs')], {
        input: JSON.stringify(input),
        encoding: 'utf-8'
      });

      expect(output.trim()).toBe('');
    });

    it('should be silent when command does not contain npm', () => {
      const input = {
        tool_name: 'Bash',
        tool_input: { command: 'git status' },
        cwd: PROJECT_DIR
      };

      const output = execFileSync('node', [join(PROJECT_DIR, '.claude/hooks/lembrete-deps.mjs')], {
        input: JSON.stringify(input),
        encoding: 'utf-8'
      });

      expect(output.trim()).toBe('');
    });
  });

  describe('scan-dados-reais.mjs', () => {
    let tempDir;
    let tempHome;

    beforeAll(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'hooks-test-'));
      tempHome = mkdtempSync(join(tmpdir(), 'hooks-test-home-'));
    });

    afterAll(() => {
      rmSync(tempDir, { recursive: true, force: true });
      rmSync(tempHome, { recursive: true, force: true });
    });

    it('should be silent when patterns file does not exist', () => {
      const input = {
        tool_name: 'Bash',
        tool_input: { command: 'git commit -m "test"' },
        cwd: PROJECT_DIR
      };

      const output = execFileSync(
        'node',
        [join(PROJECT_DIR, '.claude/hooks/scan-dados-reais.mjs')],
        {
          input: JSON.stringify(input),
          encoding: 'utf-8',
          env: { ...process.env, HOME: tempHome, USERPROFILE: tempHome }
        }
      );

      expect(output.trim()).toBe('');
    });

    it('should be silent when patterns file is empty', () => {
      const patternsDir = join(tempHome, '.claude');
      const fs = require('fs');
      fs.mkdirSync(patternsDir, { recursive: true });
      writeFileSync(join(patternsDir, 'flow-dados-reais.txt'), '');

      const input = {
        tool_name: 'Bash',
        tool_input: { command: 'git commit -m "test"' },
        cwd: PROJECT_DIR
      };

      const output = execFileSync(
        'node',
        [join(PROJECT_DIR, '.claude/hooks/scan-dados-reais.mjs')],
        {
          input: JSON.stringify(input),
          encoding: 'utf-8',
          env: { ...process.env, HOME: tempHome, USERPROFILE: tempHome }
        }
      );

      expect(output.trim()).toBe('');
    });

    it('should emit warning when pattern matches added line, without echoing matched text', () => {
      // Create patterns file with a simple regex
      const patternsDir = join(tempHome, '.claude');
      require('fs').mkdirSync(patternsDir, { recursive: true });
      writeFileSync(join(patternsDir, 'flow-dados-reais.txt'), '\\d{3}\\.\\d{3}\\.\\d{3}');

      // Create a test git repo with a staged file containing the pattern
      const testRepoDir = join(tempDir, 'testrepo');
      require('fs').mkdirSync(testRepoDir);

      try {
        execFileSync('git', ['init'], { cwd: testRepoDir });
        execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: testRepoDir });
        execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: testRepoDir });

        // Create file with pattern and stage it
        writeFileSync(join(testRepoDir, 'data.txt'), 'valor: 123.456.789');
        execFileSync('git', ['add', 'data.txt'], { cwd: testRepoDir });

        const input = {
          tool_name: 'Bash',
          tool_input: { command: 'git commit -m "test"' },
          cwd: testRepoDir
        };

        const output = execFileSync(
          'node',
          [join(PROJECT_DIR, '.claude/hooks/scan-dados-reais.mjs')],
          {
            input: JSON.stringify(input),
            encoding: 'utf-8',
            env: { ...process.env, HOME: tempHome, USERPROFILE: tempHome }
          }
        );

        // Should emit warning
        expect(output).toContain('additionalContext');
        expect(output).toContain('Possível dado financeiro real');
        expect(output).toContain('data.txt');
        // Must NOT echo the matched text "123.456.789"
        expect(output).not.toContain('123.456.789');
        expect(output).not.toContain('123');
      } catch (e) {
        // Some systems might not have git; skip
        if (!e.message.includes('git')) {
          throw e;
        }
      }
    });

    it('should not crash on invalid regex pattern', () => {
      const patternsDir = join(tempHome, '.claude');
      require('fs').mkdirSync(patternsDir, { recursive: true });
      writeFileSync(join(patternsDir, 'flow-dados-reais.txt'), '[invalid(regex');

      const input = {
        tool_name: 'Bash',
        tool_input: { command: 'git commit -m "test"' },
        cwd: PROJECT_DIR
      };

      const output = execFileSync(
        'node',
        [join(PROJECT_DIR, '.claude/hooks/scan-dados-reais.mjs')],
        {
          input: JSON.stringify(input),
          encoding: 'utf-8',
          env: { ...process.env, HOME: tempHome, USERPROFILE: tempHome }
        }
      );

      // Should exit gracefully (exit 0)
      expect(output.trim()).toBe('');
    });
  });

  describe('settings.json', () => {
    it('should be valid JSON', () => {
      const settingsPath = join(PROJECT_DIR, '.claude/settings.json');
      const content = readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toBeDefined();
    });

    it('should preserve enabledPlugins', () => {
      const settingsPath = join(PROJECT_DIR, '.claude/settings.json');
      const content = readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.enabledPlugins).toBeDefined();
      expect(parsed.enabledPlugins['superpowers@superpowers-marketplace']).toBe(true);
    });

    it('should contain hooks.PreToolUse array', () => {
      const settingsPath = join(PROJECT_DIR, '.claude/settings.json');
      const content = readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.hooks).toBeDefined();
      expect(parsed.hooks.PreToolUse).toBeDefined();
      expect(Array.isArray(parsed.hooks.PreToolUse)).toBe(true);
      expect(parsed.hooks.PreToolUse.length).toBeGreaterThan(0);
    });

    it('should have Edit|Write matcher for UI hook', () => {
      const settingsPath = join(PROJECT_DIR, '.claude/settings.json');
      const content = readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(content);
      const editMatcher = parsed.hooks.PreToolUse.find(h => h.matcher === 'Edit|Write');
      expect(editMatcher).toBeDefined();
      expect(editMatcher.once).toBe(true);
    });

    it('should have Bash matcher for deps and scan hooks', () => {
      const settingsPath = join(PROJECT_DIR, '.claude/settings.json');
      const content = readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(content);
      const bashMatcher = parsed.hooks.PreToolUse.find(h => h.matcher === 'Bash');
      expect(bashMatcher).toBeDefined();
      expect(Array.isArray(bashMatcher.hooks)).toBe(true);
      expect(bashMatcher.hooks.length).toBeGreaterThanOrEqual(4);
    });

    it('should have if filters for npm and git commands', () => {
      const settingsPath = join(PROJECT_DIR, '.claude/settings.json');
      const content = readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(content);
      const bashMatcher = parsed.hooks.PreToolUse.find(h => h.matcher === 'Bash');
      const hooks = bashMatcher.hooks;

      const npmInstallFilter = hooks.some(h => h.if === 'Bash(npm install*)');
      const npmIFilter = hooks.some(h => h.if === 'Bash(npm i *)');
      const npmAddFilter = hooks.some(h => h.if === 'Bash(npm add*)');
      const gitCommitFilter = hooks.some(h => h.if === 'Bash(git commit*)');

      expect(npmInstallFilter).toBe(true);
      expect(npmIFilter).toBe(true);
      expect(npmAddFilter).toBe(true);
      expect(gitCommitFilter).toBe(true);
    });
  });
});
