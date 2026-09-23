# Hiperlinks na wiki — design

## Objetivo

A wiki passa a ligar seus capítulos entre si. Hoje, uma referência cruzada é só prosa ("veja o capítulo Motor por baixo dos panos, seção Fronteira do hoje"). O leitor precisa abrir o índice e procurar. Com esta mudança:

- Um link leva a outro capítulo, ou a uma seção dele.
- Um termo do glossário mostra a definição ali mesmo, num balão.

## Sintaxe

Existe um só formato de link interno, sempre qualificado pelo capítulo:

- `[texto](#motor)`: leva ao capítulo `motor`.
- `[texto](#motor/fronteira-do-hoje)`: leva à seção `fronteira-do-hoje` do capítulo `motor`.
- `[[pendente]]`: atalho para `[pendente](#glossario/pendente)`.
- Forma diferente do termo (plural, flexão) usa a versão longa: `[previstos](#glossario/previsto)`.

Regras:

- O id do capítulo é o nome do arquivo sem o prefixo numérico: `4-motor.md` → `motor`. Renumerar capítulos não quebra links.
- O id da seção é o de hoje: `idDoTopico(titulo)`.
- O id de um termo do glossário é `idDoTopico(termo)`, calculado sobre o texto puro do termo (sem crases). Ex.: `` `efetivo` `` → `efetivo`; `box casa` → `box-casa`.
- O link solto `[texto](#secao)`, só no mesmo capítulo, deixa de existir. Nenhum capítulo o usa hoje. `#secao` passa a ser lido como capítulo `secao`, e o teste de integridade reprova o capítulo inexistente — ver Validação.
- Link externo (`[texto](https://...)`) não muda.
- `[[` e `]]` fora do padrão `[[termo]]` lançam exceção, como qualquer marcação não reconhecida.

## Validação

- O parser continua lançando exceção para sintaxe fora do subconjunto.
- Um teste novo carrega todos os capítulos e confere cada link interno:
  - o capítulo existe;
  - a seção existe nesse capítulo, quando há seção;
  - o termo existe no glossário, quando o capítulo é `glossario`.
- Link quebrado reprova `npm test`. Por isso nunca chega ao ar.

## Modelo

`Inline` de tipo `link` ganha a forma resolvida:

- `{ tipo: 'link', texto, href }`: link externo (sem mudança).
- `{ tipo: 'ref', texto, capitulo, secao? }`: link interno. `secao` ausente = topo do capítulo.

Links internos para `glossario` com seção são renderizados como termo (balão), não como navegação. A decisão é da camada de UI; o modelo só guarda capítulo e seção.

O bloco `campos` ganha um `id` por item (`idDoTopico` do termo). Isso serve de destino para os links do glossário e para a validação.

## Comportamento na tela (`Wiki.tsx`)

- **Link para capítulo ou seção:** troca o capítulo atual e rola até a seção. Sem seção, rola até o topo do capítulo. A URL não muda (o app não tem rotas por URL).
- **Link para termo do glossário:** abre um balão com o termo e a definição, sem sair do capítulo. Tocar fora do balão fecha. Só um balão aberto por vez.
- **Aparência do termo:** sublinhado pontilhado, para se distinguir de link de navegação.
- **Link externo:** continua abrindo em nova aba.
- O balão também aparece dentro do próprio capítulo Glossário, se ele citar outro termo.

### Visual aprovado (mockup de 2026-09-23, opção A)

- **Link de navegação (`.wiki-link`):** `--ac`, sublinhado com `text-underline-offset: 3px`.
- **Termo (`.wiki-termo`):** botão sem aparência de botão. Cor `--fg`, sublinhado pontilhado de 2px em `--muted`, `text-underline-offset: 4px`. Aberto (`.aberto`): texto e sublinhado em `--ac`.
- **Dentro de nota (`.aviso`):** termo e link herdam a cor da nota (`color: inherit`).
- **Balão (`.wiki-balao`):** ancorado logo abaixo da linha do termo, 10px abaixo dela, com a largura do corpo da wiki. Fundo `--surface2`, raio 18px, padding 14px 16px, sombra. Uma setinha quadrada girada 45° aponta para o meio do termo. Não escurece a tela.
- **Conteúdo do balão:** termo em negrito (`.wiki-balao-termo`), definição em 15px (`.wiki-balao-def`).
- **Fecha:** tocar fora, tocar de novo no mesmo termo, ou rolar a tela.

As classes novas entram em `docs/estilo/catalogo.md`.

## Conteúdo

- Converter as referências em prosa para links:
  - `3-conceitos.md` (2): Motor → Consolidação da casa; Motor → Fronteira do hoje.
  - `5-cartao.md` (2): seção Sincronização com o Flow; Ajustes → Cartões.
  - `6-telas.md` (1): capítulo Cartão.
  - `7-ajustes.md` (1): capítulo Conceitos e modelo de dados.
  - `2-visao-geral.md` (1): capítulo Telas.
- Marcar `[[termo]]` na primeira ocorrência relevante de cada termo em cada capítulo. Só quando o sentido é o do glossário ("sobra" no sentido comum não vira link).
- Acrescentar em `7-ajustes.md` uma seção curta "Wiki" que explica os links e o balão.

## Documentação

- `docs/wiki/README.md`: nova sintaxe de link interno, atalho `[[termo]]`, regra de validação. Remover a regra "link só no mesmo capítulo".
- `docs/estilo/catalogo.md`: classes novas.
- Fragmento `changelog.d/alterado-wiki-hiperlinks.md`.

## Testes

- `capitulos.test.ts`: parse de `#capitulo`, `#capitulo/secao`, `[[termo]]`, rejeição de `[[` malformado; ids dos itens de `campos`.
- Teste de integridade dos links sobre os capítulos reais, com um caso que prova que ele reprova capítulo, seção e termo inexistentes.
- `Wiki.test.tsx`: clicar num link de capítulo troca o capítulo; clicar num termo abre o balão com a definição; tocar fora fecha.

## Fora do escopo

- Botão "voltar" ao ponto de origem de um link.
- Link automático de termos sem marcação.
- Mudança na URL ao navegar.
