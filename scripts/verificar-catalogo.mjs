#!/usr/bin/env node
// Verifica que classes CSS e componentes compartilhados estão catalogados.
//
// Uso:  node scripts/verificar-catalogo.mjs [raiz]
//
// O que faz:
//   1. extrai seletores de classe de primeiro nível de src/styles.css;
//   2. lista componentes em src/ui/*.tsx (excluindo Tela* e *.test.tsx);
//   3. extrai classes e componentes catalogados em docs/estilo/catalogo.md;
//   4. reporta: "no CSS, fora do catálogo" e "no catálogo, sumiu do CSS";
//   5. reporta: "no src/ui, fora do catálogo" e "no catálogo, sumiu de src/ui";
//   6. saída: relatório legível em português; exit 0 sempre.
//
// EXCECOES: classes/componentes deliberadamente fora do catálogo.
const EXCECOES = [];

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const raiz = process.argv[2] || process.cwd();

// --- helpers ---------------------------------------------------------------

function lerArquivo(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function listarArquivos(dir) {
  try {
    return fs.readdirSync(dir).sort();
  } catch {
    return [];
  }
}

// --- extratores ------------------------------------------------------------

// Extrai classes CSS: linhas que começam com ^\.([a-z][a-z0-9-]*)
function extrairClassesCSS(conteudo) {
  const classes = new Set();
  const linhas = conteudo.split(/\r?\n/);
  for (const linha of linhas) {
    const match = /^\.([a-z][a-z0-9-]*)/.exec(linha.trim());
    if (match) classes.add(match[1]);
  }
  return classes;
}

// Lista componentes em src/ui/*.tsx, excluindo Tela*.tsx e *.test.tsx
function listarComponentesEmUI(raizProjeto) {
  const uiDir = path.join(raizProjeto, 'src', 'ui');
  const arquivos = listarArquivos(uiDir);
  const componentes = new Set();

  for (const arquivo of arquivos) {
    if (!arquivo.endsWith('.tsx')) continue;
    if (arquivo.startsWith('Tela')) continue; // Excluir TelaXxx.tsx
    if (arquivo.endsWith('.test.tsx')) continue; // Excluir *.test.tsx

    const nome = arquivo.replace('.tsx', '');
    componentes.add(nome);
  }

  return componentes;
}

// Extrai classes da tabela de catálogo (primeira coluna entre crases)
function extrairClassesDoCatalogo(conteudo) {
  const classes = new Set();
  const secaoClasses = conteudo.split('## Classes')[1];
  if (!secaoClasses) return classes;

  const ateSectores = secaoClasses.split('## Componentes')[0] || secaoClasses;
  const linhas = ateSectores.split(/\r?\n/);

  for (const linha of linhas) {
    // Linha da tabela: | `.classe` | ...
    const match = /^\|\s*`\.([a-z][a-z0-9-]*)`/i.exec(linha);
    if (match) classes.add(match[1]);
  }

  return classes;
}

// Extrai componentes da seção de catálogo (bullet points com `Nome.tsx` ou `Nome`)
function extrairComponentesDoCatalogo(conteudo) {
  const componentes = new Set();
  const secaoComponentes = conteudo.split('## Componentes')[1];
  if (!secaoComponentes) return componentes;

  const linhas = secaoComponentes.split(/\r?\n/);

  for (const linha of linhas) {
    // Procura por `Nome.tsx` ou `Nome` em bullet points ou bold
    // Padrão: **`ComponenteName.tsx`** ou **`ComponenteName`** ou `ComponenteName`
    const matches = linha.matchAll(/`([A-Z][a-zA-Z0-9]*(?:\.tsx)?)`/g);
    for (const match of matches) {
      let nome = match[1];
      if (!nome.endsWith('.tsx')) nome += '.tsx';
      componentes.add(nome.replace('.tsx', '')); // Armazena sem .tsx, será comparado assim
    }
  }

  return componentes;
}

// --- validação e relatório -------------------------------------------------

function relatorio(raizProjeto) {
  const cssPath = path.join(raizProjeto, 'src', 'styles.css');
  const catalogoPath = path.join(raizProjeto, 'docs', 'estilo', 'catalogo.md');

  const cssConteudo = lerArquivo(cssPath);
  const catalogoConteudo = lerArquivo(catalogoPath);

  const divergencias = [];

  // === CLASSES ===
  if (cssConteudo !== null && catalogoConteudo !== null) {
    const classesCSS = extrairClassesCSS(cssConteudo);
    const classesCatalogo = extrairClassesDoCatalogo(catalogoConteudo);

    // Classes no CSS mas fora do catálogo (menos exceções)
    for (const classe of classesCSS) {
      if (!classesCatalogo.has(classe) && !EXCECOES.includes(classe)) {
        divergencias.push({
          tipo: 'classe',
          nome: classe,
          direcao: 'CSS, fora do catálogo',
        });
      }
    }

    // Classes no catálogo mas sumidas do CSS (menos exceções)
    for (const classe of classesCatalogo) {
      if (!classesCSS.has(classe) && !EXCECOES.includes(classe)) {
        divergencias.push({
          tipo: 'classe',
          nome: classe,
          direcao: 'catálogo, sumiu do CSS',
        });
      }
    }
  }

  // === COMPONENTES ===
  if (catalogoConteudo !== null) {
    const componentesUI = listarComponentesEmUI(raizProjeto);
    const componentesCatalogo = extrairComponentesDoCatalogo(catalogoConteudo);

    // Componentes em src/ui mas fora do catálogo (menos exceções)
    for (const componente of componentesUI) {
      if (!componentesCatalogo.has(componente) && !EXCECOES.includes(componente)) {
        divergencias.push({
          tipo: 'componente',
          nome: componente,
          direcao: 'componente, fora do catálogo',
        });
      }
    }

    // Componentes no catálogo mas sumidos de src/ui (menos exceções)
    for (const componente of componentesCatalogo) {
      if (!componentesUI.has(componente) && !EXCECOES.includes(componente)) {
        divergencias.push({
          tipo: 'componente',
          nome: componente,
          direcao: 'catálogo, sumiu de src/ui',
        });
      }
    }
  }

  // === SAÍDA ===
  if (divergencias.length === 0) {
    console.log('✓ Catálogo e código em dia.');
  } else {
    console.log('⚠  Divergências entre catálogo e código:\n');
    divergencias.sort((a, b) => a.nome.localeCompare(b.nome));
    for (const div of divergencias) {
      console.log(`  - ${div.tipo} ".${div.nome}": ${div.direcao}`);
    }
  }

  // Sempre exit 0 (aviso, não bloqueio)
  process.exit(0);
}

// Executa
relatorio(raiz);
