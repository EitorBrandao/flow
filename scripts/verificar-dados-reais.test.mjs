import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SCRIPT = path.resolve('scripts/verificar-dados-reais.mjs');

describe('verificar-dados-reais', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dados-reais-'));
    execFileSync('git', ['init', '-b', 'main'], { cwd: tmpDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Cria os arquivos e versiona todos (o script só olha arquivos versionados). */
  function versionar(arquivos) {
    for (const [rel, conteudo] of Object.entries(arquivos)) {
      const destino = path.join(tmpDir, rel);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, conteudo);
    }
    execFileSync('git', ['add', '-A'], { cwd: tmpDir });
    execFileSync('git', ['commit', '-m', 'fixture'], { cwd: tmpDir, stdio: 'ignore' });
  }

  function rodar(...args) {
    const r = spawnSync('node', [SCRIPT, tmpDir, ...args], { encoding: 'utf8' });
    return { saida: r.stdout || '', exitCode: r.status };
  }

  /** Roda o verificador com uma lista privada de teste (ou sem lista, com caminho inexistente). */
  function rodarComLista(termos, ...args) {
    const lista = path.join(tmpDir, '..', `lista-${path.basename(tmpDir)}.txt`);
    if (termos !== null) fs.writeFileSync(lista, termos.join('\n'));
    const r = spawnSync('node', [SCRIPT, tmpDir, ...args], {
      encoding: 'utf8',
      env: { ...process.env, FLOW_DADOS_REAIS_LISTA: termos === null ? `${lista}.nao-existe` : lista },
    });
    if (termos !== null) fs.rmSync(lista, { force: true });
    return { saida: r.stdout || '', exitCode: r.status };
  }

  it('termo da lista privada vale em arquivo de teste e no dossiê gerado', () => {
    versionar({
      'src/ui/Algo.test.tsx': "expect(tela).toHaveTextContent('padaria-inventada-xyz');\n",
      'docs/dossie/02-motor.md': '- compra em padaria-inventada-xyz\n',
    });

    const { saida, exitCode } = rodarComLista(['padaria-inventada-xyz'], '--strict');

    expect(exitCode).toBe(1);
    expect(saida).toContain('src/ui/Algo.test.tsx:1');
    expect(saida).toContain('docs/dossie/02-motor.md:1');
    expect(saida).not.toContain('padaria-inventada-xyz');
  });

  it('código de terceiros em public/tesseract/ não é comparado com os termos privados', () => {
    versionar({
      'public/tesseract/nucleo.wasm.js': 'var a="padaria-inventada-xyz";\n',
      'public/outro.js': 'var b="padaria-inventada-xyz";\n',
    });

    const { saida } = rodarComLista(['padaria-inventada-xyz']);

    expect(saida).not.toContain('public/tesseract/nucleo.wasm.js');
    expect(saida).toContain('public/outro.js:1');
  });

  it('código de terceiros continua sob o padrão genérico de moeda', () => {
    // Montado em partes: escrito por extenso, o valor casaria com o padrão de moeda quando o
    // verificador varresse o plano em docs/ de onde este teste foi copiado.
    const valor = ['R$ 7', '777,77'].join('.');
    versionar({ 'public/tesseract/nucleo.wasm.js': `var c="${valor}";\n` });

    expect(rodarComLista(['padaria-inventada-xyz']).saida).toContain('public/tesseract/nucleo.wasm.js:1');
  });

  it('--exigir-lista sai 2 quando a lista não existe', () => {
    versionar({ 'docs/nota.md': 'nenhum valor aqui\n' });

    const { saida, exitCode } = rodarComLista(null, '--strict', '--exigir-lista');

    expect(exitCode).toBe(2);
    expect(saida).toContain('Lista privada ausente');
  });

  it('--exigir-lista sai 2 quando a lista só tem comentário e linha vazia', () => {
    versionar({ 'docs/nota.md': 'nenhum valor aqui\n' });

    expect(rodarComLista(['# só comentário', ''], '--exigir-lista').exitCode).toBe(2);
  });

  it('--exigir-lista com lista válida e repositório limpo sai 0', () => {
    versionar({ 'docs/nota.md': 'nenhum valor aqui\n' });

    expect(rodarComLista(['padaria-inventada-xyz'], '--strict', '--exigir-lista').exitCode).toBe(0);
  });

  it('sem --exigir-lista a falta da lista não muda o código de saída', () => {
    versionar({ 'docs/nota.md': 'nenhum valor aqui\n' });

    expect(rodarComLista(null, '--strict').exitCode).toBe(0);
  });

  it('acha moeda em arquivo versionado e sai 0 sem --strict', () => {
    versionar({ 'docs/nota.md': 'o saldo era de R$ 7.777,77 naquele dia\n' });

    const { saida, exitCode } = rodar();

    expect(exitCode).toBe(0);
    expect(saida).toContain('docs/nota.md:1');
    expect(saida).toContain('moeda');
    // o trecho não é ecoado por padrão
    expect(saida).not.toContain('7.777,77');
  });

  it('com --strict sai 1', () => {
    versionar({ 'docs/nota.md': 'R$ 7.777,77\n' });
    expect(rodar('--strict').exitCode).toBe(1);
  });

  it('repo limpo sai 0 com mensagem de ok', () => {
    versionar({ 'docs/nota.md': 'nenhum valor aqui\n' });

    const { saida, exitCode } = rodar('--strict');

    expect(exitCode).toBe(0);
    expect(saida).toContain('✓');
  });

  it('exceção por valor via CLI oculta o achado', () => {
    versionar({ 'docs/nota.md': 'R$ 7.777,77\n' });

    expect(rodar('R$ 7.777,77', '--strict').exitCode).toBe(0);
  });

  it('exceção ignora diferença de espaço, inclusive não separável', () => {
    // U+00A0 entre "R$" e o número: outra string, mesmo valor
    versionar({ 'docs/nota.md': 'R$ 7.777,77\n' });

    expect(rodar('R$ 7.777,77', '--strict').exitCode).toBe(0);
  });

  it('exceções são separadas por ponto e vírgula, não por vírgula', () => {
    // a vírgula é decimal em todo valor em real: separar por vírgula quebraria os dois
    versionar({ 'docs/a.md': 'R$ 7.777,77\n', 'docs/b.md': 'R$ 6.666,66\n' });

    expect(rodar('R$ 7.777,77;R$ 6.666,66', '--strict').exitCode).toBe(0);
  });

  it('valor que casa nos dois padrões vira um achado só, com uma exceção só', () => {
    // "R$ 7.777,77" casa em moeda e em milhar; o segundo está contido no primeiro
    versionar({ 'docs/nota.md': 'R$ 7.777,77\n' });

    const { saida } = rodar();
    const linhas = saida.split('\n').filter((l) => l.includes('docs/nota.md'));

    expect(linhas).toHaveLength(1);
    expect(saida).toContain('1 ocorrência(s)');
  });

  it('arquivo não versionado não é varrido', () => {
    versionar({ 'docs/nota.md': 'sem valor\n' });
    fs.writeFileSync(path.join(tmpDir, 'solto.md'), 'R$ 7.777,77\n');

    const { saida, exitCode } = rodar('--strict');

    expect(exitCode).toBe(0);
    expect(saida).not.toContain('solto.md');
  });

  it('padrão genérico não vale em arquivo de teste, mas vale no resto', () => {
    versionar({
      'src/ui/Algo.test.tsx': "expect(tela).toHaveTextContent('R$ 7.777,77');\n",
      'src/ui/Algo.tsx': "const rotulo = 'R$ 8.888,88';\n",
    });

    const { saida } = rodar();

    expect(saida).not.toContain('Algo.test.tsx');
    expect(saida).toContain('Algo.tsx:1');
  });

  // O README da pasta é escrito à mão e continua sob o padrão genérico: é isso que separa
  // "arquivo gerado pelo roteiro sintético" de "qualquer markdown em docs/dossie/". Sem a
  // segunda asserção, alargar a regex para a pasta inteira não quebraria nada.
  it('padrão genérico não vale no dossiê gerado, mas vale no README da mesma pasta', () => {
    versionar({
      'docs/dossie/02-motor.md': '- Fim de mês 2026-01: R$ 7.777,77\n',
      'docs/dossie/README.md': 'Exemplo de saldo: R$ 8.888,88\n',
    });

    const { saida } = rodar();

    expect(saida).not.toContain('02-motor.md');
    expect(saida).toContain('docs/dossie/README.md:1');
  });

  it('valor com milhar e centavos conta mesmo sem R$', () => {
    versionar({ 'docs/nota.md': 'fechou em 9.999,99 no mês\n' });

    const { saida, exitCode } = rodar('--strict');

    expect(exitCode).toBe(1);
    expect(saida).toContain('milhar');
  });

  it('--valores imprime os valores distintos para calibrar', () => {
    versionar({ 'docs/nota.md': 'R$ 777,77 e depois R$ 777,77\ne R$ 666,66\n' });

    const { saida } = rodar('--valores');

    expect(saida).toContain('Valores distintos (2)');
    expect(saida).toContain('R$ 777,77');
    expect(saida).toContain('R$ 666,66');
  });

  it('fora de um repositório git avisa e sai 0', () => {
    const semGit = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-git-'));
    try {
      const r = spawnSync('node', [SCRIPT, semGit, '--strict'], { encoding: 'utf8' });
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('Não é um repositório git');
    } finally {
      fs.rmSync(semGit, { recursive: true, force: true });
    }
  });
});
