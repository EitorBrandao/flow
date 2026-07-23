#!/usr/bin/env node
// Monta um release do Flow a partir dos fragmentos em changelog.d/.
//
// Uso:  npm run release -- <patch|minor|major>
//
// O que faz, em ordem:
//   1. valida: branch, working tree, tag, fragmentos e formato;
//   2. lê a versão atual de package.json e calcula a próxima;
//   3. junta os fragmentos changelog.d/*.md (exceto README) numa nova seção
//      "## [X.Y.Z] - AAAA-MM-DD" no topo do CHANGELOG.md;
//   4. grava a nova versão em package.json;
//   5. apaga os fragmentos consumidos;
//   6. git add + commit "chore(release): vX.Y.Z" + tag vX.Y.Z.
//
// Validações (todos os guards executam antes de qualquer escrita de arquivo):
//   - branch: deve estar em main (exceto em dry-run).
//   - working tree: apenas CHANGELOG.md, package.json e changelog.d/ podem estar modificados
//     (exceto em dry-run).
//   - tag: versão calculada não pode já ter tag (exceto em dry-run).
//   - fragmento vazio: nenhum fragmento pode estar vazio.
//   - formato de bullet: cada linha deve começar com "- ", sem "**" ou indentação.
//   - items resultante: após coleta, deve haver pelo menos um item.
//
// Fonte única do número de versão: ele é decidido AQUI, na integração, nunca
// dentro de um branch de feature. Isso elimina colisão entre sessões paralelas.
//
// Variáveis de ambiente:
//   RELEASE_DRY_RUN=1  → faz tudo menos os passos de git (para testes).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const raiz = process.cwd();
const SECOES = ['adicionado', 'alterado', 'removido'];
const TITULOS = { adicionado: 'Adicionado', alterado: 'Alterado', removido: 'Removido' };
const dryRun = process.env.RELEASE_DRY_RUN === '1';

function abortar(msg) {
  console.error(`\n  release: ${msg}\n`);
  process.exit(1);
}

// --- guards (validações que executam antes de qualquer escrita) ----------

function validarBranch() {
  if (dryRun) return;
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: raiz,
      encoding: 'utf8',
    }).trim();
    if (branch !== 'main') {
      abortar(`rode na main — branches de feature não fazem release (branch atual: "${branch}")`);
    }
  } catch (e) {
    abortar(`erro ao verificar branch: ${e.message}`);
  }
}

function validarWorkingTree() {
  if (dryRun) return;
  try {
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: raiz,
      encoding: 'utf8',
    });
    const linhas = status.split('\n').filter((l) => l.trim());
    const sujos = linhas.filter((l) => {
      const caminho = l.slice(3).trim();
      // permitir: CHANGELOG.md, package.json, ou dentro de changelog.d/
      if (caminho === 'CHANGELOG.md' || caminho === 'package.json') return false;
      if (caminho.startsWith('changelog.d/')) return false;
      return true;
    });
    if (sujos.length > 0) {
      const caminhos = sujos.map((l) => `  ${l.slice(3).trim()}`).join('\n');
      abortar(`working tree sujo fora de changelog.d/, CHANGELOG.md, package.json:\n${caminhos}`);
    }
  } catch (e) {
    abortar(`erro ao verificar working tree: ${e.message}`);
  }
}

function validarTag(versao) {
  if (dryRun) return;
  try {
    const resultado = execFileSync('git', ['tag', '-l', `v${versao}`], {
      cwd: raiz,
      encoding: 'utf8',
    }).trim();
    if (resultado) {
      abortar(`a versão já existe — outro branch fez release; reconcilie antes (tag: v${versao})`);
    }
  } catch (e) {
    abortar(`erro ao verificar tag: ${e.message}`);
  }
}

// --- 1. calcular próxima versão -------------------------------------------
function proximaVersao(atual, tipo) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(atual);
  if (!m) abortar(`versão atual inválida em package.json: "${atual}"`);
  let [maior, menor, patch] = m.slice(1).map(Number);
  if (tipo === 'major') { maior += 1; menor = 0; patch = 0; }
  else if (tipo === 'minor') { menor += 1; patch = 0; }
  else if (tipo === 'patch') { patch += 1; }
  else abortar(`tipo de bump inválido: "${tipo}". Use patch, minor ou major.`);
  return `${maior}.${menor}.${patch}`;
}

// --- 2. coletar fragmentos com validação --------------------------------
function coletarFragmentos(dir) {
  if (!fs.existsSync(dir)) return { itens: {}, arquivos: [] };
  const arquivos = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort();
  const itens = {};
  for (const nome of arquivos) {
    const tipo = nome.split('-')[0].toLowerCase();
    if (!SECOES.includes(tipo)) {
      abortar(`fragmento "${nome}" precisa começar com adicionado-, alterado- ou removido-.`);
    }
    const conteudoBruto = fs.readFileSync(path.join(dir, nome), 'utf8');
    const linhas = conteudoBruto
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+$/, ''));
    const linhasUteis = linhas.filter((l) => l.trim() !== '');

    // Guard: fragmento vazio
    if (linhasUteis.length === 0) {
      abortar(`fragmento vazio: "${nome}"`);
    }

    // Guard: validar formato de cada linha
    for (let i = 0; i < linhasUteis.length; i++) {
      const linha = linhasUteis[i];
      const numLinha = linhas.indexOf(linha) + 1; // número da linha no arquivo (1-indexed)

      // Deve começar com "- "
      if (!/^- /.test(linha)) {
        abortar(
          `fragmento "${nome}" linha ${numLinha}: deve começar com "- ". Veja changelog.d/README.md.`
        );
      }

      // Não pode conter "**"
      if (linha.includes('**')) {
        abortar(
          `fragmento "${nome}" linha ${numLinha}: não pode conter "**" (negrito). Veja changelog.d/README.md.`
        );
      }

      // Não pode começar com espaço ou tab
      if (/^\s/.test(linha)) {
        abortar(
          `fragmento "${nome}" linha ${numLinha}: não pode começar com espaço ou tab. Veja changelog.d/README.md.`
        );
      }
    }

    (itens[tipo] ??= []).push(...linhasUteis);
  }
  return { itens, arquivos };
}

// --- 3. montar a seção de changelog ---------------------------------------
function montarSecao(versao, data, itens, eol) {
  const partes = [`## [${versao}] - ${data}`, ''];
  for (const tipo of SECOES) {
    const linhas = itens[tipo];
    if (!linhas || linhas.length === 0) continue;
    partes.push(`### ${TITULOS[tipo]}`, '', ...linhas, '');
  }
  return partes.join(eol);
}

function inserirNoChangelog(changelog, secao, eol) {
  const idx = changelog.indexOf(`${eol}## [`);
  if (idx === -1) {
    // Sem seções ainda: acrescenta ao fim do preâmbulo.
    return `${changelog.replace(/\s*$/, '')}${eol}${eol}${secao}${eol}`;
  }
  const preambulo = changelog.slice(0, idx).replace(/\s*$/, '');
  const resto = changelog.slice(idx + eol.length); // resto começa em "## ["
  return `${preambulo}${eol}${eol}${secao}${eol}${resto}`;
}

// --- fluxo -----------------------------------------------------------------
// 1. validar tipo
const tipo = process.argv[2];
if (!tipo) abortar('faltou o tipo de bump. Uso: npm run release -- <patch|minor|major>');

// 2. ler package.json e calcular próxima versão
const pkgPath = path.join(raiz, 'package.json');
const pkgRaw = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgRaw);
const versaoAtual = pkg.version;
const versao = proximaVersao(versaoAtual, tipo);

// 3. coletar fragmentos (com validação de formato e não-vazios)
const { itens, arquivos } = coletarFragmentos(path.join(raiz, 'changelog.d'));
if (arquivos.length === 0) abortar('nenhum fragmento em changelog.d/ — nada para lançar.');

// 4. Guard: validar que há itens resultantes após coleta
let temItens = false;
for (const secao of SECOES) {
  if (itens[secao] && itens[secao].length > 0) {
    temItens = true;
    break;
  }
}
if (!temItens) {
  abortar('nenhum item útil após coletar fragmentos.');
}

// 5. executar guards de git (pulam em dry-run)
validarBranch();
validarWorkingTree();
validarTag(versao);

// 6. montar a seção (sem side effects)
const data = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD local
const changelogPath = path.join(raiz, 'CHANGELOG.md');
const changelog = fs.readFileSync(changelogPath, 'utf8');
const eol = changelog.includes('\r\n') ? '\r\n' : '\n';
const secao = montarSecao(versao, data, itens, eol);
const changelogNovo = inserirNoChangelog(changelog, secao, eol);

// 7. ESCREVER ARQUIVOS (só se todas as validações passaram)
// 7a. grava o novo CHANGELOG.md
fs.writeFileSync(changelogPath, changelogNovo);

// 7b. grava a nova versão em package.json preservando indentação/newline
const pkgNovo = pkgRaw.replace(/("version":\s*")[^"]+(")/, `$1${versao}$2`);
fs.writeFileSync(pkgPath, pkgNovo);

// 7c. apaga os fragmentos consumidos
for (const nome of arquivos) fs.rmSync(path.join(raiz, 'changelog.d', nome));

console.log(`  release: ${versaoAtual} → ${versao}  (${arquivos.length} fragmento(s))`);

if (dryRun) {
  console.log('  release: RELEASE_DRY_RUN=1 — pulando git commit/tag.');
  process.exit(0);
}

// 8. OPERAÇÕES GIT (só se não estamos em dry-run)
const git = (...args) => execFileSync('git', args, { cwd: raiz, stdio: 'inherit' });
git('add', 'CHANGELOG.md', 'package.json', 'changelog.d');
git('commit', '-m', `chore(release): v${versao}`);
git('tag', `v${versao}`);
console.log(`  release: commit + tag v${versao} criados. Rode: git push origin main && npm run deploy`);
