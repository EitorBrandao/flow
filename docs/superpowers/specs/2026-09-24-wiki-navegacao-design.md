# Navegação e texto da wiki — design

## Objetivo

A wiki fica mais fácil de navegar e de ler. Hoje:

- O botão "☰ Índice" fica no alto da página. Some ao rolar.
- A gaveta lista só capítulos. As seções não aparecem.
- A busca devolve só o nome do capítulo. O leitor não sabe onde o termo está.
- O texto é longo, com frases compridas e repetições.

## 1. Barra fixa

- Uma barra substitui o botão "☰ Índice".
- A barra gruda logo abaixo do cabeçalho do app (`.topo`), com `position: sticky`.
- Conteúdo: `☰  Capítulo · Seção atual`. Texto longo corta com reticências numa linha só.
- Um toque em qualquer ponto da barra abre a gaveta. A barra inteira é um `<button>`, com `aria-label` "Índice".
- Seção atual: o último título de seção (`h3` de tópico) cujo topo já passou pela base da barra. Antes da primeira seção, a barra mostra só o capítulo.
- A seção atual se recalcula num ouvinte de rolagem (`scroll`, passivo). Não usa `IntersectionObserver`: jsdom não o tem, e a regra "último que passou" fica mais simples com `getBoundingClientRect`.
- O deslocamento do topo da barra vem da altura real do `.topo`. O cálculo é feito na montagem e em `resize`. Nada de número fixo no CSS.
- "‹ Ajustes" e "Wiki" continuam no alto e rolam normalmente.

## 2. Gaveta com seções

Sem busca, a gaveta lista os capítulos, como hoje. Muda:

- O capítulo atual aparece expandido. Suas seções vêm logo abaixo, recuadas.
- A seção atual fica destacada (mesmo destaque do capítulo ativo, `--ac-dim`/`--ac`).
- Tocar numa seção rola até ela e fecha a gaveta. Os títulos ganham `scroll-margin-top` igual à altura do `.topo` mais a barra, para não ficarem escondidos sob ela. Vale também para links internos e termos em `.wiki-campos`.
- Tocar em outro capítulo abre esse capítulo no topo e fecha a gaveta (comportamento de hoje).
- Outros capítulos não expandem. Uma árvore inteira aberta vira uma lista longa demais no celular.

## 3. Busca com trecho

Com a busca preenchida, a lista de capítulos dá lugar a uma lista de resultados:

- Um resultado por seção que contém o termo. O texto antes da primeira seção conta como seção do próprio capítulo, sem nome de seção.
- Cada resultado mostra `Capítulo · Seção` e um trecho de cerca de 80 caracteres em volta da primeira ocorrência, com o termo destacado (`<mark>`).
- A comparação continua sem acento e sem caixa (`normalizar`). O destaque marca o trecho original, com acento.
- Tocar no resultado abre o capítulo, rola até a seção e fecha a gaveta.
- Nenhum resultado: "Nada encontrado." (texto de hoje).
- Os nomes sorteados (`{{nomeA}}` etc.) já estão aplicados no texto de busca. O trecho mostra os mesmos nomes do capítulo.

### Modelo

`capitulos.ts` ganha uma função pura:

```ts
interface SecaoTexto { id?: string; titulo?: string; texto: string }
function secoesDoCapitulo(c: Capitulo): SecaoTexto[]
function buscar(capitulos: Capitulo[], termo: string): Resultado[]
interface Resultado { capitulo: string; tituloCapitulo: string; secao?: string; tituloSecao?: string; antes: string; achado: string; depois: string }
```

`buscar` é testável sem DOM. O corte do trecho respeita limite de palavra e põe "…" nas pontas cortadas.

## 4. Texto mais sucinto

- Revisão dos 9 capítulos no estilo do CLAUDE.md (ASD-STE100 + Zinsser): frases curtas, uma ideia por frase, voz ativa, sem repetição.
- Nenhum conteúdo sai. Só a forma muda.
- Títulos de seção (`##`) não mudam: são os ids dos links internos.
- Termos `[[glossário]]` e links internos continuam. `validarLinks` confere no `npm test`.
- Marcadores de nome (`{{nomeA}}`…) continuam. Nenhum nome literal.
- Um capítulo por commit, para a revisão ficar legível.

## Estilo

- Classes novas (barra, seção na gaveta, resultado de busca, destaque) entram em `src/styles.css` e em `docs/estilo/catalogo.md`.
- Só tokens existentes. A barra usa o mesmo fundo translúcido com desfoque do `.topo`.
- Mockup com as classes reais, enviado pelo chat, antes de codar a UI.

## Testes

### Vitest (`npm test`)

- `buscar`: termo em parágrafo, em lista, em campo, em nota; termo antes da primeira seção; termo com acento buscado sem acento; várias ocorrências na mesma seção (um resultado só); nenhum resultado; termo no começo e no fim do texto (sem "…" na ponta que não foi cortada).
- `Wiki.test.tsx`: a barra mostra o capítulo; a gaveta mostra as seções do capítulo atual; tocar numa seção chama `scrollIntoView` no título certo; busca mostra `Capítulo · Seção` e o trecho com `<mark>`; tocar no resultado troca de capítulo.
- `capitulos.test.ts` continua validando a sintaxe e os links do texto enxugado.

### Playwright (varredura como usuário)

Fora do projeto, na pasta de rascunho da sessão — nunca no `package.json` (não é dependência do Flow). Servidor `npx vite` do worktree em porta própria, só `localhost`. Tela do celular do usuário, Samsung Galaxy S25+: viewport 411 × 744 CSS px (tela 412 × 892), `deviceScaleFactor` 2,63 — medidos no aparelho, `isMobile` e `hasTouch` ligados. Outros tamanhos ficam para depois.

Roteiro:

1. Ajustes → Wiki. Rolar até o fim de um capítulo longo: a barra continua visível, colada sob o `.topo`, sem sobrepor texto.
2. A seção na barra muda ao passar cada título.
3. Abrir a gaveta: seções do capítulo atual listadas, a atual destacada. Tocar numa seção: o título fica visível logo abaixo da barra, não escondido por ela.
4. Buscar um termo com acento sem digitar o acento: resultados com trecho e destaque. Tocar num resultado leva à seção.
5. Título longo corta com reticências; nada de rolagem horizontal.
6. Balão do glossário continua abrindo e fechando ao rolar.

Capturas de tela da varredura vão pelo chat.

## Fora do escopo

- Botões de capítulo anterior/próximo.
- Botão de voltar ao topo.
- Reorganizar ou fundir capítulos.
- Playwright como dependência do projeto ou no CI.

## Entrega

Visível ao usuário: fragmento `changelog.d/alterado-wiki-navegacao.md`. A própria wiki é a mudança, então a atualização da wiki é o item 4. Ciclo de entrega completo, com release e deploy.
