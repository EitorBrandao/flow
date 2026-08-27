#!/usr/bin/env node
// Procura dados financeiros reais em TODOS os arquivos versionados do repositório.
//
// Uso:  node scripts/verificar-dados-reais.mjs [raiz] [excecoes] [--strict]
//
// Por que existe, sendo que já há um hook: o `.claude/hooks/scan-dados-reais.mjs` varre só o
// `git diff --cached`, ou seja, a mudança que está entrando agora. O vazamento tratado em
// 2026-07-25 estava em dois documentos escritos semanas antes — arquivo antigo nunca aparece
// num diff, e a regra "nunca commitar dados reais" nasceu depois deles. Todo arquivo anterior
// a uma regra é, por construção, não auditado. Este script olha o repositório inteiro.
//
// O que procura:
//   1. moeda explícita em formato brasileiro (R$ seguido de valor com centavos);
//   2. valor com separador de milhar e centavos, mesmo sem o "R$";
//   3. os termos de ~/.claude/flow-dados-reais.txt, se o arquivo existir (mesma fonte do hook;
//      é privado de propósito — a lista em si é dado sensível).
//
// Os dois primeiros funcionam sem nenhum arquivo privado: dão uma rede mínima em qualquer
// máquina, inclusive no CI.
//
// EXIT CODE: 0 por padrão, 1 com --strict havendo achado. Desde 2026-07-25 o
// scripts/release.mjs chama com --strict e bloqueia pelo código de saída — mesmo caminho do
// verificador de catálogo (aviso → guard bloqueante DEPOIS de calibrado; promover antes da
// calibragem é o jeito mais rápido de ensinar todo mundo a afrouxar guard). Rodar à mão,
// sem a flag, continua sendo aviso: exit 0.
//
// PARAMETROS:
//   raiz      - raiz do repositório (default: cwd)
//   excecoes  - valores separados por PONTO E VÍRGULA que se somam a EXCECOES_VALOR.
//               Não é vírgula, ao contrário do verificar-catalogo.mjs: todo valor em real
//               tem vírgula decimal, e separar por vírgula quebraria "R$ 1.234,56" em dois.
//   --strict  - exit 1 havendo achado (posição livre entre os argumentos)
//   --valores - imprime também os valores distintos, para montar as exceções

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

// Valores sintéticos aprovados: aparecem em spec, teste ou changelog de propósito.
// Acrescentar aqui é decisão consciente — cada item é uma afirmação de que aquele número
// não veio da vida real do usuário.
// Comparados com os espaços normalizados: o repositório tem "R$ 0,00" com espaço comum e com
// espaço não separável (U+00A0), que são strings diferentes e o mesmo valor.
// Calibrado em 2026-07-25 varrendo o repositório inteiro: 15 valores distintos, todos
// conferidos um a um. Estes 14 são sintéticos; o que sobrou de fora aparece no relatório
// justamente por não ser.
const EXCECOES_VALOR = [
  // canônicos de teste, repetidos em asserção e em bloco de código de plano
  'R$ 12,34', 'R$ 1,23', 'R$ 123,45', 'R$ 1.234,56', '1.234,56', 'R$ 0,00',
  // redondos de fixture (saldos, faturas e assinaturas inventadas)
  'R$ 1.000,00', '1.000,00', 'R$ 100,00', 'R$ 500,00', 'R$ 650,00',
  'R$4.000,00', 'R$ 6.200,00', 'R$ 51,90', 'R$ 45,00',
  // roteiro e plano do dossiê de comportamento (sintéticos, 2026-08-12)
  'R$ 4.000,00', 'R$ 12.000,00', 'R$ 3.820,00', 'R$ 1.240,00', 'R$ 480,00',
  'R$ 300,00', 'R$ 180,00', 'R$ 900,00', 'R$ 39,90', 'R$ 10,00', 'R$ 11,00',
];

// Arquivos que contêm os próprios padrões e exemplos: casariam consigo mesmos.
const EXCECOES_ARQUIVO = [
  'scripts/verificar-dados-reais.mjs',
  'scripts/verificar-dados-reais.test.mjs',
];

// Binários e afins: não há texto para varrer e ler tudo em memória é desperdício.
const EXTENSOES_IGNORADAS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot',
  '.pdf', '.zip', '.xlsx', '.mp4', '.webm',
]);

const PADROES = [
  { nome: 'moeda (R$ com centavos)', re: /R\$\s*\d[\d.]*,\d{2}/g },
  { nome: 'valor com milhar e centavos', re: /\b\d{1,3}(?:\.\d{3})+,\d{2}\b/g },
];

// Arquivo de teste é feito de dinheiro sintético — é o ponto dele. Rodar os padrões genéricos
// ali gera 40+ achados de asserção legítima e afoga o sinal. Os termos da lista privada
// CONTINUAM valendo em teste: nome de estabelecimento real num teste é vazamento igual, e
// aquele padrão é preciso o bastante para não gerar ruído.
const RE_ARQUIVO_TESTE = /\.test\.tsx?$/;

// O dossiê de comportamento (`npm run dossie`) é gerado de um roteiro sintético
// (`src/dossie/roteiro.ts`), e é feito de saldo projetado e total de fatura: os padrões
// genéricos de moeda casam em quase toda linha. Recebe o mesmo tratamento do arquivo de
// teste, e pela mesma razão — os termos da lista privada CONTINUAM valendo. A isenção é para
// o ruído do padrão genérico, nunca para a rede de privacidade: estes quatro arquivos vão
// para um repositório público, e são justamente os que mais precisam dela.
const RE_ARQUIVO_GERADO = /^docs\/dossie\/\d{2}-[a-z]+\.md$/;

// --- argumentos -------------------------------------------------------------

const argumentos = process.argv.slice(2);
const strict = argumentos.includes('--strict');
const posicionais = argumentos.filter((a) => !a.startsWith('--'));

const raiz = posicionais[0] || process.cwd();
const excecoesCLI = posicionais[1]
  ? posicionais[1].split(';').map((e) => e.trim()).filter((e) => e)
  : [];
const excecoesValor = new Set(
  [...EXCECOES_VALOR, ...excecoesCLI].map((v) => v.trim().replace(/\s+/g, ' ')),
);
// --valores: imprime os valores distintos que casaram, para calibrar as exceções. Fora dele o
// relatório nunca ecoa o trecho — ver comentário na saída.
const mostrarValores = argumentos.includes('--valores');

// --- entradas ---------------------------------------------------------------

function arquivosVersionados(raizProjeto) {
  try {
    return execFileSync('git', ['ls-files'], { cwd: raizProjeto, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter((l) => l.trim());
  } catch {
    return null; // não é repositório git, ou git indisponível
  }
}

/** Termos privados, se existirem. A lista nunca entra no repositório. */
function termosPrivados() {
  const caminho = path.join(os.homedir(), '.claude', 'flow-dados-reais.txt');
  try {
    if (!fs.existsSync(caminho)) return [];
    return fs.readFileSync(caminho, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((termo) => {
        try {
          return { nome: 'termo da lista privada', re: new RegExp(termo, 'g') };
        } catch {
          return null; // regex inválida na lista: ignora, não derruba a varredura
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// --- varredura --------------------------------------------------------------

/**
 * Casamentos de uma linha, sem sobreposição. "R$ 1.234,56" casa nos dois padrões — o de moeda
 * inteiro e o de milhar, este contido naquele. Sem descartar o contido, o mesmo valor viraria
 * dois achados e exigiria DUAS exceções para ser silenciado, uma com "R$" e outra sem.
 * Vence o casamento que começa antes; empatando, o mais longo.
 */
function casarNaLinha(linha, padroes) {
  const brutos = [];
  for (const { nome, re } of padroes) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(linha)) !== null) {
      if (m[0].length === 0) { re.lastIndex += 1; continue; } // regex vazia na lista privada
      brutos.push({ nome, inicio: m.index, fim: m.index + m[0].length, texto: m[0] });
    }
  }
  brutos.sort((a, b) => a.inicio - b.inicio || (b.fim - b.inicio) - (a.fim - a.inicio));

  const mantidos = [];
  for (const b of brutos) {
    const contido = mantidos.some((k) => b.inicio >= k.inicio && b.fim <= k.fim);
    if (!contido) mantidos.push(b);
  }
  return mantidos;
}

function varrer(raizProjeto) {
  const arquivos = arquivosVersionados(raizProjeto);
  if (arquivos === null) {
    console.log('⚠  Não é um repositório git (ou o git não está disponível) — nada varrido.');
    return [];
  }

  const privados = termosPrivados();
  const achados = [];

  for (const arquivo of arquivos) {
    if (EXCECOES_ARQUIVO.includes(arquivo)) continue;
    if (EXTENSOES_IGNORADAS.has(path.extname(arquivo).toLowerCase())) continue;

    const soPrivados = RE_ARQUIVO_TESTE.test(arquivo) || RE_ARQUIVO_GERADO.test(arquivo);
    const padroes = soPrivados ? privados : [...PADROES, ...privados];
    if (padroes.length === 0) continue;

    let conteudo;
    try {
      conteudo = fs.readFileSync(path.join(raizProjeto, arquivo), 'utf8');
    } catch {
      continue; // arquivo apagado no working tree, permissão, etc.
    }
    if (conteudo.includes('\0')) continue; // binário disfarçado de texto

    const linhas = conteudo.split(/\r?\n/);
    for (let i = 0; i < linhas.length; i += 1) {
      for (const bruto of casarNaLinha(linhas[i], padroes)) {
        const valor = bruto.texto.trim().replace(/\s+/g, ' '); // normaliza inclusive U+00A0
        if (!excecoesValor.has(valor)) {
          achados.push({ arquivo, linha: i + 1, padrao: bruto.nome, valor });
        }
      }
    }
  }

  return achados;
}

// --- saída ------------------------------------------------------------------

const achados = varrer(raiz);

if (achados.length === 0) {
  console.log('✓ Nenhum dado financeiro real aparente nos arquivos versionados.');
  process.exit(0);
}

// O trecho casado NÃO é impresso: quem precisa calibrar abre o arquivo na linha indicada.
// Imprimir aqui copiaria o dado para o log da sessão, do CI e do terminal — exatamente o
// que a regra tenta evitar.
console.log(`⚠  Possíveis dados financeiros reais (${achados.length} ocorrência(s)):\n`);
achados.sort((a, b) => a.arquivo.localeCompare(b.arquivo) || a.linha - b.linha);
for (const a of achados) {
  console.log(`  - ${a.arquivo}:${a.linha}: ${a.padrao}`);
}

if (mostrarValores) {
  const distintos = [...new Set(achados.map((a) => a.valor))].sort();
  console.log(`\n  Valores distintos (${distintos.length}), para montar as exceções:`);
  for (const v of distintos) console.log(`    ${v}`);
}
console.log(
  '\n  Cada um é sintético (ok) ou real (não pode ficar). Sintético aprovado vai para'
  + '\n  EXCECOES_VALOR no topo deste script; real precisa sair do histórico, não só do'
  + '\n  arquivo — ver docs e CLAUDE.md.'
);

process.exit(strict ? 1 : 0);
