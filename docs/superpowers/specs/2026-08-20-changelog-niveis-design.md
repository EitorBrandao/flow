# Changelog com dois níveis — tópico e detalhe

## Problema

Hoje um fragmento de changelog (`changelog.d/*.md`) só aceita **bullets planos**: toda linha
começa com `- `, sem indentação, sem sub-item. Quando uma mudança tem um tópico com dois ou
três detalhes que valem a pena registrar, o único jeito é espalhar tudo em bullets soltos do
mesmo nível — perde-se a relação "isto é parte daquilo" que existia na cabeça de quem escreveu.

`scripts/release.mjs` reforça isso: o guard de formato rejeita qualquer linha que comece com
espaço ou tab. `src/ui/ajustes/changelog.ts` já sabe juntar uma linha indentada *sem* `- ` ao
item anterior (quebra de linha do bullet no arquivo-fonte), mas não sabe representar "isto é um
detalhe deste tópico" — só concatena texto.

## Decisões tomadas com o usuário (2026-08-20)

| Pergunta | Decisão |
|---|---|
| Escopo | Ponta a ponta: fragmento, `release.mjs`, `CHANGELOG.md` gerado **e** a tela Versão passam a distinguir tópico de detalhe visualmente |
| Sintaxe do detalhe | Bullet indentado: `- ` na coluna 0 é tópico; `  - ` (exatamente 2 espaços) é detalhe do tópico anterior |
| Continuação de linha (recurso existente) | Mantém — uma linha indentada sem `- ` próprio continua colando no texto do bullet mais recente, seja ele tópico ou detalhe |
| Profundidade | Só dois níveis. Um detalhe não tem detalhe |

## Solução

### Sintaxe do fragmento

```
- Tópico principal, sem indentação.
  - Detalhe do tópico, exatamente 2 espaços antes do "- ".
  - Outro detalhe.
- Tópico sem detalhe nenhum — continua válido, exatamente como hoje.
```

Regras, por linha:

1. Coluna 0 + `- ` → novo **tópico**.
2. Exatamente dois espaços + `- ` → **detalhe** do tópico mais recente. Erro se não houver
   tópico ainda aberto no fragmento (detalhe órfão).
3. Qualquer indentação com `- ` que **não** seja exatamente 2 espaços → erro de formato
   ("detalhe precisa de exatamente 2 espaços de indentação"). Não existe terceiro nível.
4. Qualquer outra linha indentada (sem `- ` próprio) → **continuação**: o texto gruda, com um
   espaço, no bullet mais recente — tópico ou detalhe, o que tiver vindo por último. Mesmo
   comportamento que existe hoje para tópicos.
5. `**` (negrito) continua proibido em qualquer linha.

Um fragmento 100% plano (só tópicos, sem nenhum detalhe) continua válido sem nenhuma mudança —
compatibilidade total com todo fragmento já mesclado no `CHANGELOG.md`.

### `src/ui/ajustes/changelog.ts` — novo modelo de dados

```ts
export interface ChangelogItem {
  texto: string;
  detalhes: string[];
}

export interface ChangelogSecao {
  titulo: string;
  itens: ChangelogItem[];   // era string[]
}
```

`parseChangelog` reconhece, nesta ordem, por linha: nova versão (`## [...]`), nova seção
(`### ...`), tópico (`- ` na coluna 0 → novo `ChangelogItem`), detalhe (exatamente `  - ` →
`push` em `detalhes` do último item), continuação (qualquer outra linha indentada → gruda no
último `texto` de `detalhes`, ou no `texto` do item se `detalhes` estiver vazio).

Isso lê tanto fragmentos novos (via `CHANGELOG.md` já montado) quanto todo o histórico atual do
`CHANGELOG.md`, que é 100% plano — cada versão antiga vira itens com `detalhes: []`.

### `scripts/release.mjs`

- `coletarFragmentos` devolve `itens: Record<tipo, ChangelogItem[]>` em vez de
  `Record<tipo, string[]>`. Ao ler um fragmento, mantém um "tópico corrente"; uma linha de
  detalhe faz `push` nele; uma linha de continuação gruda no texto mais recente (tópico ou
  último detalhe).
- Guard de formato reescrito para as 5 regras acima. Mensagens de erro citam o arquivo e o
  número da linha, como já fazem hoje.
- `montarSecao` imprime cada tópico como `- texto`, seguido de uma linha `  - detalhe` para
  cada item de `detalhes`, antes do próximo tópico. Ordem entre fragmentos: a mesma de hoje
  (ordenado por nome de arquivo).
- Fragmentos de vários arquivos continuam concatenando na mesma seção do `CHANGELOG.md`, tópico
  a tópico — só que agora cada tópico carrega os próprios detalhes.

### `CHANGELOG.md` gerado

Vira lista markdown aninhada de verdade — o preview do GitHub já sabe renderizar:

```md
### Adicionado

- Botão de exportar backup na tela de Ajustes.
  - Fica no rodapé, ao lado de "Importar".
  - Funciona mesmo sem conexão de rede.
- Aviso quando o backup falha silenciosamente.
```

### Tela Versão (`src/ui/ajustes/Versao.tsx`)

Edição de UI: antes de mexer, consultar `docs/estilo-visual.md` e seguir o nível indicado —
provavelmente nível 2 (classe nova, para o `<ul>` de detalhes) ou nível 3 (variação de tela
existente), decidido na hora ao olhar o guia. Passa pelo mockup aprovado do ciclo de entrega
antes da implementação, como qualquer edição de `src/ui/**`.

Direção geral (sujeita ao guia de estilo e ao mockup): cada tópico continua um `<li>` da lista
que já existe; quando `detalhes.length > 0`, uma `<ul>` aninhada aparece abaixo do tópico, com
tratamento visualmente subordinado (recuo e/ou tipografia mais discreta) — para o detalhe ler
como parte do tópico, não como um item irmão.

### Documentação

- `changelog.d/README.md`: exemplos reescritos com o formato de dois níveis; a seção "Como
  criar um fragmento" passa a explicar tópico e detalhe.
- `CLAUDE.md`: a frase "bullets planos (ver `changelog.d/README.md`)" fica desatualizada —
  atualiza para descrever os dois níveis, sem perder a referência ao README.
- `docs/wiki/`: nenhum capítulo documenta a tela Versão hoje (conferido — as únicas ocorrências
  de "versão" na wiki são sobre versão de *schema* de backup, assunto diferente). Sem página
  para atualizar.

## Arquivos

| Arquivo | O quê |
|---|---|
| `scripts/release.mjs` + `scripts/release.test.mjs` | novo modelo de `ChangelogItem`, guard de 5 regras, `montarSecao` com aninhamento |
| `src/ui/ajustes/changelog.ts` + `changelog.test.ts` | `ChangelogItem`, parser com tópico/detalhe/continuação |
| `src/ui/ajustes/Versao.tsx` + `Versao.test.tsx` | renderização aninhada, atrás de mockup aprovado |
| `src/styles.css` + `docs/estilo/catalogo.md` | classe(s) novas para o `<ul>` de detalhe, se o nível de estilo escolhido pedir, catalogadas no mesmo commit |
| `changelog.d/README.md` | exemplos e explicação atualizados |
| `CLAUDE.md` | frase sobre "bullets planos" atualizada |
| `changelog.d/alterado-changelog-niveis.md` | fragmento desta própria mudança (é visível: quem olha o `CHANGELOG.md` no GitHub, ou a tela Versão, vê o formato novo) |

## Testes que precisam existir

**`changelog.test.ts`:**

- Tópico com um ou mais detalhes — `detalhes` populado na ordem certa.
- Tópico sem nenhum detalhe — `detalhes: []`, igual ao comportamento atual.
- Continuação de um tópico (sem detalhe) — já coberto hoje, não pode quebrar.
- Continuação de um **detalhe** — a linha indentada sem `- ` gruda no último detalhe, não no
  texto do tópico.
- CRLF continua funcionando em todas as combinações acima.

**`scripts/release.test.mjs`:**

- Fragmento com tópico + detalhes válidos monta a seção certa em `CHANGELOG.md`.
- Detalhe com indentação diferente de 2 espaços → erro, cita arquivo e linha.
- Detalhe antes de qualquer tópico (órfão) → erro.
- Fragmento 100% plano (sem detalhe nenhum) continua passando, sem mudança de comportamento.
- Fragmentos de arquivos diferentes, cada um com seus próprios tópicos/detalhes, concatenam na
  mesma seção sem misturar detalhe de um tópico com outro.

**`Versao.test.tsx`:**

- Uma versão com tópico e detalhes renderiza o texto do tópico e de cada detalhe.
- Uma versão só com tópicos planos (todo o histórico atual) renderiza igual a hoje — sem `<ul>`
  vazia nem markup extra por item sem detalhe.

Todos os testes usam dados sintéticos.

## Bordas conhecidas (documentar, não "consertar")

- **Histórico existente não é retroativo.** Todo o `CHANGELOG.md` já publicado é plano; ele
  continua renderizando exatamente como hoje (tópicos sem detalhe). Ninguém precisa editar
  versões antigas.
- **Só dois níveis por design.** Um detalhe muito longo que "quer" ter sub-detalhe deve virar
  texto corrido dentro do próprio detalhe (usando continuação), não um terceiro nível.

## Fora de escopo

- Reformatar fragmentos ou o `CHANGELOG.md` já publicados para usar detalhe.
- Colapsar/expandir detalhe na tela Versão (interação nova) — a lista de detalhes fica sempre
  visível quando existe.
- Qualquer nível além de tópico/detalhe.

## Verificação

```
npm test
npm run build
node scripts/verificar-catalogo.mjs
node scripts/verificar-dados-reais.mjs
```

Um fragmento de teste manual com tópico + 2 detalhes, rodando `RELEASE_DRY_RUN=1 npm run
release -- patch`, para conferir a seção montada em `CHANGELOG.md` antes de repetir o fluxo
real. Depois do deploy, no celular: abrir Ajustes → Versão e conferir que o detalhe aparece
subordinado ao tópico, e que versões antigas (sem detalhe) continuam idênticas a antes.
