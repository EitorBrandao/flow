#!/usr/bin/env node
// Monta um release do Flow a partir dos fragmentos em changelog.d/.
//
// Uso:  npm run release -- <patch|minor|major>
//
// O que faz, em ordem:
//   1. lê a versão atual de package.json e calcula a próxima;
//   2. junta os fragmentos changelog.d/*.md (exceto README) numa nova seção
//      "## [X.Y.Z] - AAAA-MM-DD" no topo do CHANGELOG.md;
//   3. apaga os fragmentos consumidos;
//   4. grava a nova versão em package.json;
//   5. git add + commit "chore(release): vX.Y.Z" + tag vX.Y.Z.
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

// --- 2. coletar fragmentos -------------------------------------------------
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
    const corpo = fs
      .readFileSync(path.join(dir, nome), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+$/, ''))
      .filter((l) => l.trim() !== '');
    if (corpo.length === 0) continue;
    (itens[tipo] ??= []).push(...corpo);
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
const tipo = process.argv[2];
if (!tipo) abortar('faltou o tipo de bump. Uso: npm run release -- <patch|minor|major>');

const pkgPath = path.join(raiz, 'package.json');
const pkgRaw = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgRaw);
const versaoAtual = pkg.version;
const versao = proximaVersao(versaoAtual, tipo);

const { itens, arquivos } = coletarFragmentos(path.join(raiz, 'changelog.d'));
if (arquivos.length === 0) abortar('nenhum fragmento em changelog.d/ — nada para lançar.');

const data = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD local

const changelogPath = path.join(raiz, 'CHANGELOG.md');
const changelog = fs.readFileSync(changelogPath, 'utf8');
const eol = changelog.includes('\r\n') ? '\r\n' : '\n';
const secao = montarSecao(versao, data, itens, eol);
fs.writeFileSync(changelogPath, inserirNoChangelog(changelog, secao, eol));

// grava a nova versão preservando indentação/newline do arquivo
const pkgNovo = pkgRaw.replace(/("version":\s*")[^"]+(")/, `$1${versao}$2`);
fs.writeFileSync(pkgPath, pkgNovo);

// apaga os fragmentos consumidos
for (const nome of arquivos) fs.rmSync(path.join(raiz, 'changelog.d', nome));

console.log(`  release: ${versaoAtual} → ${versao}  (${arquivos.length} fragmento(s))`);

if (dryRun) {
  console.log('  release: RELEASE_DRY_RUN=1 — pulando git commit/tag.');
  process.exit(0);
}

// --- 5. git ----------------------------------------------------------------
const git = (...args) => execFileSync('git', args, { cwd: raiz, stdio: 'inherit' });
git('add', 'CHANGELOG.md', 'package.json', 'changelog.d');
git('commit', '-m', `chore(release): v${versao}`);
git('tag', `v${versao}`);
console.log(`  release: commit + tag v${versao} criados. Rode: git push origin main && npm run deploy`);
