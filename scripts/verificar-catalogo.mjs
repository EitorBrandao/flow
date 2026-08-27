#!/usr/bin/env node
// Verifica que classes CSS e componentes compartilhados estão catalogados.
//
// Uso:  node scripts/verificar-catalogo.mjs [raiz] [excecoes] [--strict]
//
// O que faz:
//   1. extrai seletores de classe de primeiro nível de src/styles.css;
//   2. lista componentes em src/ui/*.tsx (excluindo Tela* e *.test.tsx);
//   3. extrai classes e componentes catalogados em docs/estilo/catalogo.md;
//   4. reporta: "no CSS, fora do catálogo" e "no catálogo, sumiu do CSS";
//   5. reporta: "no src/ui, fora do catálogo" e "no catálogo, sumiu de src/ui";
//   6. reporta o próprio catálogo ausente quando existe src/styles.css para catalogar;
//   7. saída: relatório legível em português.
//
// EXIT CODE: 0 sempre, EXCETO com --strict, que devolve 1 havendo divergência. Rodar à mão
// é aviso; quem bloqueia é o release (scripts/release.mjs), e ele chama com --strict e lê o
// código de saída. O texto do relatório é, portanto, livre para mudar sem desligar o guard.
//
// PARAMETROS:
//   raiz      - raiz do projeto (default: cwd)
//   excecoes  - nomes separados por vírgula que se SOMAM à constante EXCECOES
//               (ex.: "classe1,Componente2,classe3")
//   --strict  - exit 1 quando houver divergência (posição livre entre os argumentos)

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// EXCECOES: classes/componentes deliberadamente fora do catálogo.
// A constante pode ser estendida via argumento CLI.
//
// Estes 8 são modificadores que no CSS só existem como seletor composto
// (ex.: `.saldo-grande.positivo`, `.total-dia.neg`, `.valor-gasto.editavel`) — o extrator de
// classes CSS só reconhece seletores que começam a linha com `.nome`, então essas classes
// nunca vão bater e sempre apareceriam como "sumiu do CSS" mesmo existindo.
//
// No catálogo eles aparecem entre parênteses na linha da classe que modificam
// (ex.: "`.secao` (+ `.acao`)") ou, quando têm o que explicar, em linha própria
// (ex.: `.editavel`).
const EXCECOES = ['acao', 'cresce', 'dia-hoje', 'editavel', 'neg', 'negativo', 'pos', 'positivo'];

// flags saem da conta antes dos posicionais: assim --strict pode vir em qualquer posição
// sem empurrar `raiz` e `excecoes` de lugar
const argumentos = process.argv.slice(2);
const strict = argumentos.includes('--strict');
const posicionais = argumentos.filter(a => !a.startsWith('--'));

const raiz = posicionais[0] || process.cwd();
const excecoesCLI = posicionais[1]
  ? posicionais[1].split(',').map(e => e.trim()).filter(e => e)
  : [];
const todasExcecoes = new Set([...EXCECOES, ...excecoesCLI]);

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
// Captura múltiplas classes por linha (separadas por `/` ou `,`)
// Wildcards `.prefixo-*` viram prefixos: classes que começam com `prefixo-` contam
function extrairClassesDoCatalogo(conteudo) {
  const classes = new Set();
  const wildcards = new Set();
  const secaoClasses = conteudo.split('## Classes')[1];
  if (!secaoClasses) return { classes, wildcards };

  const ateComponentes = secaoClasses.split('## Componentes')[0] || secaoClasses;
  const linhas = ateComponentes.split(/\r?\n/);

  for (const linha of linhas) {
    // Linha da tabela: | `.classe` | ... ou | `.classe1` / `.classe2` | ...
    // Extrai TODAS as classes entre crases na primeira coluna (antes do |)
    const match = /^\|\s*(.+?)\s*\|/.exec(linha);
    if (!match) continue;

    const primeiraColuna = match[1];
    // Encontra todas as strings entre crases (incluindo wildcards `.prefixo-*`)
    const classMatches = primeiraColuna.matchAll(/`\.([a-z][a-z0-9-]*(?:-\*)?|\*)`/g);

    for (const classMatch of classMatches) {
      const nome = classMatch[1];
      if (nome.endsWith('-*')) {
        // `.prefixo-*` → adiciona como wildcard
        const prefixo = nome.slice(0, -2); // remove "-*"
        wildcards.add(prefixo);
      } else if (nome !== '*') {
        // Classe normal (ignora `*` isolado)
        classes.add(nome);
      }
    }

    // Também captura modificadores entre parênteses: (+ `.pos`/`.neg`)
    const parenMatches = primeiraColuna.match(/\([^)]*\)/g) || [];
    for (const paren of parenMatches) {
      const modMatches = paren.matchAll(/`\.([a-z][a-z0-9-]*(?:-\*)?)`/g);
      for (const modMatch of modMatches) {
        const nome = modMatch[1];
        if (nome.endsWith('-*')) {
          const prefixo = nome.slice(0, -2);
          wildcards.add(prefixo);
        } else {
          classes.add(nome);
        }
      }
    }
  }

  return { classes, wildcards };
}

// Extrai componentes da seção de catálogo (bullets em formato `- **\`Nome.tsx\`**`)
// Menções em prosa dentro da descrição do bullet não são reportadas
function extrairComponentesDoCatalogo(conteudo) {
  const componentes = new Set();
  const secaoComponentes = conteudo.split('## Componentes')[1];
  if (!secaoComponentes) return componentes;

  const linhas = secaoComponentes.split(/\r?\n/);

  for (const linha of linhas) {
    // Bullet point: começa com "- " e tem **`Nome.tsx`** no início
    // Padrão: ^- \*\*`ComponenteName.tsx`\*\*
    const match = /^-\s+\*\*`([A-Z][a-zA-Z0-9]*(?:\.tsx)?)`\*\*/.exec(linha);
    if (match) {
      let nome = match[1];
      if (!nome.endsWith('.tsx')) nome += '.tsx';
      componentes.add(nome.replace('.tsx', '')); // Armazena sem .tsx
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

  // === O PRÓPRIO CATÁLOGO ===
  // Sem isto, apagar docs/estilo/catalogo.md faz o verificador pular todos os blocos abaixo
  // e anunciar "em dia": o guard desligaria exatamente quando o catálogo deixou de existir.
  // O gatilho é haver src/styles.css — havendo CSS para catalogar, o catálogo é obrigatório.
  if (cssConteudo !== null && catalogoConteudo === null) {
    divergencias.push({
      tipo: 'arquivo',
      nome: 'docs/estilo/catalogo.md',
      direcao: 'catálogo não encontrado, mas existe src/styles.css para catalogar',
    });
  }

  // === CLASSES ===
  if (cssConteudo !== null && catalogoConteudo !== null) {
    const classesCSS = extrairClassesCSS(cssConteudo);
    const { classes: classesCatalogo, wildcards: wildcardsCatalogo } = extrairClassesDoCatalogo(catalogoConteudo);

    // Classes no CSS mas fora do catálogo (menos exceções)
    for (const classe of classesCSS) {
      // Verifica se está no catálogo, em exceções, ou encaixa um wildcard
      const emCatalogo = classesCatalogo.has(classe);
      const emExcecao = todasExcecoes.has(classe);
      const encaixaWildcard = Array.from(wildcardsCatalogo).some(w => classe.startsWith(w + '-'));

      if (!emCatalogo && !emExcecao && !encaixaWildcard) {
        divergencias.push({
          tipo: 'classe',
          nome: classe,
          direcao: 'CSS, fora do catálogo',
        });
      }
    }

    // Classes no catálogo mas sumidas do CSS (menos exceções e wildcards)
    for (const classe of classesCatalogo) {
      if (!classesCSS.has(classe) && !todasExcecoes.has(classe)) {
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
      if (!componentesCatalogo.has(componente) && !todasExcecoes.has(componente)) {
        divergencias.push({
          tipo: 'componente',
          nome: componente,
          direcao: 'componente, fora do catálogo',
        });
      }
    }

    // Componentes no catálogo mas sumidos de src/ui (menos exceções)
    for (const componente of componentesCatalogo) {
      if (!componentesUI.has(componente) && !todasExcecoes.has(componente)) {
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
    process.exit(0);
  }

  console.log('⚠  Divergências entre catálogo e código:\n');
  divergencias.sort((a, b) => a.nome.localeCompare(b.nome));
  for (const div of divergencias) {
    // só classe leva ponto na frente; componente e arquivo têm nome próprio
    const rotulo = div.tipo === 'classe' ? `".${div.nome}"` : `"${div.nome}"`;
    console.log(`  - ${div.tipo} ${rotulo}: ${div.direcao}`);
  }

  // Sem --strict, exit 0: rodar à mão é aviso. Quem bloqueia é o release, que chama com
  // --strict e lê ESTE número — não o texto acima.
  process.exit(strict ? 1 : 0);
}

// Executa
relatorio(raiz);
