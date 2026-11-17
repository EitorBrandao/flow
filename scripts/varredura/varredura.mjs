#!/usr/bin/env node
// Varredura fixa do Flow: percorre as telas na tela do celular do usuário, mede, fotografa e
// compara com os achados conhecidos.
//
// Uso (a partir da pasta de rascunho da sessão, onde o playwright está instalado):
//   node <repo>/scripts/varredura/varredura.mjs http://localhost:5199/ [--extra passos.mjs] [--atualizar-conhecidos]
//
// O playwright NÃO é dependência do projeto: é resolvido a partir da pasta de onde este
// script é chamado. Ver scripts/varredura/README.md.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { medir } from './medir.mjs';
import { semear } from './semente.mjs';
import { chaveDoAchado, comparar } from './comparar.mjs';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--') && /^https?:/.test(a));
const atualizar = args.includes('--atualizar-conhecidos');
const iExtra = args.indexOf('--extra');
const extra = iExtra >= 0 ? args[iExtra + 1] : null;

function sair(msg) { console.error(`varredura: ${msg}`); process.exit(2); }

if (!url) sair('informe o endereço do app, por exemplo http://localhost:5199/');
// No site publicado estão os dados reais do usuário: a varredura só abre a própria máquina.
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) sair('só é permitido localhost.');

let chromium;
try {
  const exigir = createRequire(path.join(process.cwd(), 'varredura.cjs'));
  // O playwright é CommonJS: o import dinâmico entrega as exportações em "default".
  const modulo = await import(pathToFileURL(exigir.resolve('playwright')).href);
  chromium = modulo.chromium ?? modulo.default.chromium;
} catch {
  sair('playwright não encontrado nesta pasta. Na pasta de rascunho: npm i playwright && npx playwright install chromium');
}

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ARQUIVO_CONHECIDOS = path.join(AQUI, 'conhecidos.json');
const SAIDA = path.resolve('varredura');
fs.mkdirSync(SAIDA, { recursive: true });

const ajuda = (page) => ({
  aba: (rotulo) => page.locator(`nav.navegacao button[aria-label="${rotulo}"]`).click(),
  pilula: (nome) => page.getByRole('tab', { name: nome }).click(),
});

// Roteiro base: as telas que toda entrega visível pode ter afetado.
const PASSOS_BASE = [
  { nome: 'hoje-visao', ir: async (p, a) => { await a.aba('Hoje'); await a.pilula('Visão'); } },
  { nome: 'hoje-pendentes', ir: async (p, a) => { await a.aba('Hoje'); await a.pilula(/Pendentes/); } },
  { nome: 'hoje-conferir', ir: async (p, a) => { await a.aba('Hoje'); await a.pilula('Conferir'); } },
  { nome: 'fluxo-lista', ir: async (p, a) => { await a.aba('Fluxo'); } },
  { nome: 'fluxo-editor', ir: async (p, a) => { await a.aba('Fluxo'); await p.locator('main .item').filter({ hasText: 'Feira 1' }).first().click(); }, sair: async (p) => { await p.keyboard.press('Escape'); } },
  { nome: 'adicionar', ir: async (p, a) => { await a.aba('Adicionar'); }, sair: async (p) => { await p.keyboard.press('Escape'); } },
  { nome: 'lancar', ir: async (p, a) => { await a.aba('Adicionar'); await p.getByRole('button', { name: /^Lançamento/ }).click(); } },
  { nome: 'cartao', ir: async (p, a) => { await a.aba('Cartão'); } },
  { nome: 'analises', ir: async (p, a) => { await a.aba('Análises'); } },
  { nome: 'ajustes', ir: async (p) => { await p.locator('button[aria-label="Ajustes"]').click(); } },
];

let passos = PASSOS_BASE;
if (extra) {
  const modulo = await import(pathToFileURL(path.resolve(extra)).href);
  if (!Array.isArray(modulo.passos)) sair(`${extra} precisa exportar "passos".`);
  passos = [...PASSOS_BASE, ...modulo.passos];
}

const browser = await chromium.launch();
const contexto = await browser.newContext({
  viewport: { width: 411, height: 744 }, screen: { width: 412, height: 892 },
  deviceScaleFactor: 2.63, isMobile: true, hasTouch: true, locale: 'pt-BR',
});
const page = await contexto.newPage();
const errosDePagina = [];
page.on('pageerror', (e) => errosDePagina.push(String(e).split('\n')[0]));
// Nenhum diálogo nativo deve existir no app; se aparecer, vira achado e é dispensado.
const dialogos = [];
page.on('dialog', async (d) => { dialogos.push(d.message()); await d.dismiss(); });

await page.goto(url);
await page.waitForSelector('nav.navegacao');
await page.evaluate(semear);
await page.reload();
await page.waitForSelector('nav.navegacao');
await page.locator('select[aria-label="Box"]').selectOption({ label: 'carteira' });

const achados = [];
const falhas = [];
const capturas = [];
for (const passo of passos) {
  try {
    await passo.ir(page, ajuda(page));
    await page.waitForTimeout(450); // espera as animações de entrada
    const arquivo = path.join(SAIDA, `${passo.nome}.png`);
    // Quem abre a tela a vê no topo: a rolagem herdada do passo anterior escondia o botão Lançar.
    await page.evaluate(() => window.scrollTo(0, 0));
    // Mede antes de fotografar: a captura rola a tela e deslocava o botão Lançar para fora da barra.
    for (const m of await page.evaluate(medir)) achados.push({ passo: passo.nome, ...m });
    await page.screenshot({ path: arquivo });
    capturas.push(arquivo);
    if (passo.sair) { await passo.sair(page); await page.waitForTimeout(300); }
  } catch (e) {
    falhas.push({ passo: passo.nome, erro: String(e).split('\n')[0].slice(0, 200) });
  }
}
for (const mensagem of dialogos) achados.push({ passo: 'geral', tipo: 'dialogo-nativo', alvo: mensagem.slice(0, 40), detalhe: 'window.confirm ou alert' });
for (const erro of errosDePagina) achados.push({ passo: 'geral', tipo: 'erro-de-script', alvo: erro.slice(0, 60), detalhe: '' });
await browser.close();

const conhecidos = JSON.parse(fs.readFileSync(ARQUIVO_CONHECIDOS, 'utf8'));
const { novos, resolvidos } = comparar(achados, conhecidos);
const semCaptura = passos.filter((p) => !fs.existsSync(path.join(SAIDA, `${p.nome}.png`))).map((p) => p.nome);

if (atualizar) {
  const chaves = [...new Set(achados.map(chaveDoAchado))].sort();
  fs.writeFileSync(ARQUIVO_CONHECIDOS, `${JSON.stringify(chaves, null, 2)}\n`);
  console.log(`varredura: conhecidos.json regravado com ${chaves.length} achado(s).`);
}

fs.writeFileSync(path.join(SAIDA, 'relatorio.json'), JSON.stringify({ novos, resolvidos, falhas, semCaptura, achados }, null, 1));
const linhas = [
  '# Varredura',
  '',
  `Passos: ${passos.length} · capturas: ${capturas.length} · achados: ${achados.length} · novos: ${novos.length} · resolvidos: ${resolvidos.length}`,
  '',
  '## Achados novos',
  ...(novos.length ? novos.map((n) => `- ${n.passo} · ${n.tipo} · ${n.alvo} · ${n.detalhe}`) : ['Nenhum.']),
  '',
  '## Conhecidos que sumiram (tire de conhecidos.json)',
  ...(resolvidos.length ? resolvidos.map((r) => `- ${r}`) : ['Nenhum.']),
  '',
  '## Passos que falharam',
  ...(falhas.length ? falhas.map((f) => `- ${f.passo}: ${f.erro}`) : ['Nenhum.']),
  '',
  '## Capturas (envie ao usuário pelo chat)',
  ...capturas.map((c) => `- ${c}`),
  '',
];
fs.writeFileSync(path.join(SAIDA, 'relatorio.md'), linhas.join('\n'));
console.log(linhas.join('\n'));

const reprovou = !atualizar && (novos.length > 0 || falhas.length > 0 || semCaptura.length > 0);
process.exit(reprovou ? 1 : 0);
