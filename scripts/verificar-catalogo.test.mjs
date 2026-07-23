import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('verificar-catalogo', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verificador-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function setupFixture(fixtureName, files) {
    // Criar diretórios necessários
    for (const filePath of Object.keys(files)) {
      const fullPath = path.join(tmpDir, filePath);
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, files[filePath]);
    }
  }

  function runVerificador(rootDir, excecoes = null) {
    // Roda o script e captura saída + exit code
    try {
      const args = [rootDir];
      if (excecoes) args.push(excecoes);
      const output = execFileSync('node', ['scripts/verificar-catalogo.mjs', ...args], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      return { output, exitCode: 0 };
    } catch (e) {
      return { output: e.stdout || '', exitCode: e.status };
    }
  }

  it('classe no CSS fora do catálogo → aparece no relatório', () => {
    setupFixture('class-not-in-catalog', {
      'src/styles.css': '.tela { display: flex; }\n.nova-classe { color: red; }',
      'docs/estilo/catalogo.md':
        '# Catálogo\n## Classes (em `src/styles.css`)\n| Classe | Para quê |\n|---|---|\n| `.tela` | wrapper |',
    });

    const { output, exitCode } = runVerificador(tmpDir);
    expect(exitCode).toBe(0);
    expect(output).toContain('nova-classe');
    expect(output).toContain('CSS, fora do catálogo');
  });

  it('classe no catálogo sem CSS → aparece no relatório', () => {
    setupFixture('class-not-in-css', {
      'src/styles.css': '.tela { display: flex; }',
      'docs/estilo/catalogo.md':
        '# Catálogo\n## Classes (em `src/styles.css`)\n| Classe | Para quê |\n|---|---|\n| `.tela` | wrapper |\n| `.desaparecida` | removed |',
    });

    const { output, exitCode } = runVerificador(tmpDir);
    expect(exitCode).toBe(0);
    expect(output).toContain('desaparecida');
    expect(output).toContain('catálogo, sumiu do CSS');
  });

  it('componente não catalogado → aparece no relatório', () => {
    setupFixture('component-not-in-catalog', {
      'src/ui/NovoComponente.tsx': 'export default function NovoComponente() {}',
      'src/ui/CampoValor.tsx': 'export default function CampoValor() {}',
      'docs/estilo/catalogo.md':
        '# Catálogo\n## Componentes compartilhados (em `src/ui/`)\n- **`CampoValor.tsx`** — input numérico',
    });

    const { output, exitCode } = runVerificador(tmpDir);
    expect(exitCode).toBe(0);
    expect(output).toContain('NovoComponente');
    expect(output).toContain('componente, fora do catálogo');
  });

  it('componente no catálogo sem arquivo → aparece no relatório', () => {
    setupFixture('component-not-in-files', {
      'src/ui/CampoValor.tsx': 'export default function CampoValor() {}',
      'docs/estilo/catalogo.md':
        '# Catálogo\n## Componentes compartilhados (em `src/ui/`)\n- **`CampoValor.tsx`** — input numérico\n- **`ComponenteFantasma.tsx`** — removed',
    });

    const { output, exitCode } = runVerificador(tmpDir);
    expect(exitCode).toBe(0);
    expect(output).toContain('ComponenteFantasma');
    expect(output).toContain('catálogo, sumiu de src/ui');
  });

  it('tudo em dia → mensagem de ok', () => {
    setupFixture('all-ok', {
      'src/styles.css': '.tela { display: flex; }\n.card { padding: 20px; }',
      'src/ui/CampoValor.tsx': 'export default function CampoValor() {}',
      'docs/estilo/catalogo.md':
        '# Catálogo\n## Classes (em `src/styles.css`)\n| Classe | Para quê |\n|---|---|\n| `.tela` | wrapper |\n| `.card` | card |\n\n## Componentes compartilhados (em `src/ui/`)\n- **`CampoValor.tsx`** — input',
    });

    const { output, exitCode } = runVerificador(tmpDir);
    expect(exitCode).toBe(0);
    expect(output).toContain('✓');
  });

  it('exceção via argumento CLI oculta a divergência', () => {
    setupFixture('with-exception-cli', {
      'src/styles.css': '.tela { display: flex; }\n.temporaria { color: red; }',
      'docs/estilo/catalogo.md':
        '# Catálogo\n## Classes (em `src/styles.css`)\n| Classe | Para quê |\n|---|---|\n| `.tela` | wrapper |',
    });

    // Sem argumento: divergência reportada
    let { output, exitCode } = runVerificador(tmpDir);
    expect(exitCode).toBe(0);
    expect(output).toContain('temporaria');
    expect(output).toContain('CSS, fora do catálogo');

    // Com argumento (exceção): divergência oculta
    ({ output, exitCode } = runVerificador(tmpDir, 'temporaria'));
    expect(exitCode).toBe(0);
    expect(output).not.toContain('temporaria');
    expect(output).toContain('✓');
  });

  it('captura múltiplas classes por linha (separadas por / ou vírgula)', () => {
    setupFixture('multiple-classes', {
      'src/styles.css': '.botao { padding: 10px; }\n.botao-primario { color: blue; }\n.botao-perigo { color: red; }',
      'docs/estilo/catalogo.md':
        '# Catálogo\n## Classes (em `src/styles.css`)\n| Classe | Para quê |\n|---|---|\n| `.botao`, `.botao-primario`, `.botao-perigo` | botões |',
    });

    const { output, exitCode } = runVerificador(tmpDir);
    expect(exitCode).toBe(0);
    expect(output).toContain('✓');
    expect(output).not.toContain('botao');
  });

  it('wildcard `.prefixo-*` cobre `.prefixo-xxx`', () => {
    setupFixture('wildcard-classes', {
      'src/styles.css': '.grafico-expandido-linha { width: 100%; }\n.grafico-expandido-area { fill: blue; }',
      'docs/estilo/catalogo.md':
        '# Catálogo\n## Classes (em `src/styles.css`)\n| Classe | Para quê |\n|---|---|\n| `.grafico-expandido-*` | classes internas do gráfico |',
    });

    const { output, exitCode } = runVerificador(tmpDir);
    expect(exitCode).toBe(0);
    expect(output).toContain('✓');
  });

  it('menção em prosa de componente NÃO é reportada como catalogado', () => {
    setupFixture('prose-mention-not-cataloged', {
      'src/ui/LancEditor.tsx': 'export default function LancEditor() {}',
      'src/ui/Sheet.tsx': 'export default function Sheet() {}',
      'docs/estilo/catalogo.md':
        '# Catálogo\n## Componentes compartilhados (em `src/ui/`)\n- **`Sheet.tsx`** — bottom sheet. Usado em editores modais como `LancEditor`. Não confundir com TelaXxx.tsx.',
    });

    const { output, exitCode } = runVerificador(tmpDir);
    expect(exitCode).toBe(0);
    // LancEditor e TelaXxx não devem ser capturados da prosa
    expect(output).toContain('LancEditor');
    expect(output).toContain('componente, fora do catálogo');
  });

  it('ignora Tela*.tsx e *.test.tsx', () => {
    setupFixture('ignore-tela-and-test', {
      'src/ui/TelaLancar.tsx': 'export default function TelaLancar() {}',
      'src/ui/CampoValor.test.tsx': 'describe("test", () => {})',
      'src/ui/CampoValor.tsx': 'export default function CampoValor() {}',
      'docs/estilo/catalogo.md':
        '# Catálogo\n## Componentes compartilhados (em `src/ui/`)\n- **`CampoValor.tsx`** — input',
    });

    const { output, exitCode } = runVerificador(tmpDir);
    expect(exitCode).toBe(0);
    expect(output).not.toContain('TelaLancar');
    expect(output).not.toContain('test.tsx');
  });

  it('tolera src/styles.css ou docs/ ausentes (não aborta)', () => {
    setupFixture('missing-files', {
      'src/ui/CampoValor.tsx': 'export default function CampoValor() {}',
    });

    const { output, exitCode } = runVerificador(tmpDir);
    expect(exitCode).toBe(0);
    // Deve rodar sem erro mesmo sem os arquivos
  });
});
