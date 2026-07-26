# Documentação da wiki em markdown

Esta pasta contém os capítulos da wiki do Flow em markdown puro. Este arquivo documenta o subconjunto de markdown aceito pelo parser da wiki.

## Subconjunto de sintaxe aceito

A tabela abaixo lista todas as construções que o parser reconhece:

| Construção | Sintaxe | Exemplo |
|---|---|---|
| Título de capítulo | `# Título` | `# Ajustes` |
| Título de seção | `## Título` | `## Categorias` |
| Parágrafo | Texto simples | `Uma box é um fluxo de caixa com saldo próprio.` |
| Lista com bullets | `- item` | `- Criar, renomear, reordenar` |
| Nota (bloco destacado) | `> nota` | `> Esta é uma nota importante.` |
| Campo/definição | `: termo \| definição` | `: efetivo \| Lançamento confirmado.` |
| Link interno | `[texto](#ancora)` | `[Recorrência](#recorrencia)` |
| Link externo | `[texto](url)` | `[github.com/flow](https://github.com/...)` |
| Ênfase (negrito) | `**texto**` | `**Obrigatório:** nome` |
| Código inline | `` `código` `` | `` `IndexedDB` `` ou `` `id` `` |

**Nenhuma outra sintaxe é aceita.** Construções fora deste subconjunto — como títulos de nível 3 ou superior (`###`), tabelas com barras (`\|`), listas numeradas (`1.`), ou listas com `*` — fazem o parser **lançar uma exceção** em vez de ignorar silenciosamente. Isso é intencional: erros de sintaxe devem parar o pipeline de build, não passar desapercebidos. A suíte de testes automatizados (`npm test`) roda na integração contínua (CI) e no commit local, garantindo que toda wiki publicada é sintaticamente válida.

## Notas sobre a sintaxe

### Blocos de nota

Uma nota é sempre **uma linha só**. Quebrar linha dentro dela cria dois blocos separados:

```markdown
> Primeira nota.
> Esta é uma segunda nota separada, não continuação da primeira.
```

Se precisar de duas frases numa mesma nota, mantenha na mesma linha:

```markdown
> Primeira frase. Segunda frase — mesmo bloco.
```

### Campos e definições

O formato `: termo | definição` é usado na wiki para listas de termos e seus significados, e na tabela de glossário (que foi convertida para este formato). Cada linha é um par independente.

### Links

Dois tipos de link são permitidos:

1. **Link interno** (`[texto](#ancora)`): aponta para uma âncora **no mesmo capítulo**. Se o destino está em outro capítulo, não use link — cite o capítulo em prosa em vez disso:
   - ✅ Correto: "veja o capítulo Conceitos e modelo de dados"
   - ❌ Errado: `[Recorrência](#recorrencia)` (se `#recorrencia` está em outro capítulo)

2. **Link externo** (`[texto](url)`): aponta para um site. A URL é preservada integralmente.

## Marcadores de nome

Quatro placeholders substituem nomes específicos em tempo de renderização:

| Marcador | Propósito | Exemplo |
|---|---|---|
| `{{nomeA}}` | Primeiro nome de exemplo (pessoa) | {{nomeA}} tem sua box própria |
| `{{nomeB}}` | Segundo nome de exemplo (pessoa) | {{nomeB}} e {{nomeA}} compartilham a casa |
| `{{boxA}}` | Primeira box (nome em minúsculo) | A box {{boxA}} tem um cartão |
| `{{boxB}}` | Segunda box (nome em minúsculo) | Entre {{boxA}}, {{boxB}} e casa |

**Por quê?** Os nomes de exemplo aparecem na wiki para ajudar a entender o modelo (duas pessoas, uma casa). Se os nomes fossem fixos (por exemplo, sempre "Ana" e "Bruno"), a documentação pareceria falar sobre a vida do dono do app. Para evitar isso, os quatro marcadores são sorteados a cada abertura da wiki, escolhendo pares aleatórios de uma lista de nomes comuns. O navegador substitui os marcadores por JavaScript, garantindo que nenhum nome real entra no repositório versionado.

**Restrição:** nenhum arquivo de markdown contém nomes literais (não há "Ana", "Bruno" etc.). Use sempre os marcadores.

## Decisões de design

### Por que não tabelas?

Tabelas markdown com barras (`| coluna1 | coluna2 |`) não são aceitas. Isso é proposital: em celulares com 375px de largura, tabelas ficam ilegíveis (ou forçam scroll horizontal). A wiki prioriza legibilidade em telas pequenas.

Para listas de pares termo/definição, use `: termo | definição` em vez disso.

### Por que o parser lança em vez de ignorar?

Um erro de sintaxe silencioso é pior que um erro ruidoso:
- **Silencioso:** você escreve `### Título` (três hashes) e o parser ignora, deixando o texto como parágrafo. Ninguém percebe até o reader abrir a wiki.
- **Ruidoso:** o build falha, você descobre na hora e conserta.

## Estrutura esperada dos capítulos

Cada capítulo `N-nome.md` deve seguir este padrão:

1. Começar com `# Título` (heading 1 — obrigatório)
2. Um parágrafo introdutório simples (opcional)
3. Uma ou mais seções com `## Título` (heading 2)
4. Dentro de cada seção: parágrafos, listas, campos, notas — sempre respeitando o subconjunto acima

Não há suporte para heading 3 ou superior (`### `, `#### `, etc.).
