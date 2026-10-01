# A casa não duplica nem mente — plano de implementação

> **Para agentes:** SUB-HABILIDADE OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** com "casa" no topo, Análises junta categorias de mesmo nome e tipo, e as cinco telas de configuração por box mostram só um aviso para escolher uma box.

**Arquitetura:** só leitura mais troca de corpo de tela. Uma função de domínio nova (`unificarCategoriasPorNome`), uma propriedade opcional em `LancamentosSheet`, um componente novo (`AvisoEscolhaBox`) e um auxiliar novo no store (`boxIdConcreta`). Sem campo novo, sem mudança em `src/db/` nem `src/backup/`.

**Stack:** React 18, TypeScript, Zustand, Vitest + Testing Library, fake-indexeddb.

Spec: `docs/superpowers/specs/2026-10-01-casa-sem-duplicar-design.md` (leia). Mockup de Análises aprovado em 2026-10-01.

## Restrições globais

- **Worktree:** `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\casa-b` (branch `casa-b`). Não toque no checkout principal. Antes da primeira edição, rode `git rev-parse --show-toplevel`: deve terminar em `.worktrees/casa-b`.
- Todo texto, comentário, teste e mensagem de commit em **português**. Sem palavra solta em inglês.
- Mensagens de commit terminam com estas duas linhas:
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM
  ```
- Dados de teste **sintéticos** (nomes `ana`, `bruno`; valores redondos).
- `boxSel === 'casa'` é o sentinela de consolidação; a box de nome `"casa"` é uma box real (ver `docs/dominio.md`). Não confunda.
- A junção de categorias e o aviso valem **só** com `boxSel === 'casa'`. Numa box só, nenhuma tela muda.
- Não edite `package.json`, `scripts/`, `vite.config.ts`, `tsconfig.json`, `.claude/` nem o topo do `CHANGELOG.md`. Não instale dependência além de `npm ci`.
- Rode a suíte completa (`npm test`) antes de dizer que terminou cada tarefa.
- Arquivos em UTF-8 sem BOM. Use as ferramentas de edição de arquivo.
- Antes de editar UI, leia `docs/estilo/nivel-1-editar-tela.md` e `docs/estilo/catalogo.md`.
- Fora de escopo (entrega C): Bancos, Simular, Importar e `AdicionarSheet` continuam usando `boxIdEfetivo`.

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/domain/categorias.ts` (+ `categorias.test.ts`) | editar: `unificarCategoriasPorNome` |
| `src/ui/TelaAnalises.tsx` (+ teste) | editar: aplicar a junção na casa; passar `boxes` ao sheet |
| `src/ui/LancamentosSheet.tsx` (+ teste) | editar: propriedade opcional `boxes` com selo |
| `src/state/store.ts` | editar: `boxIdConcreta` |
| `src/ui/ajustes/AvisoEscolhaBox.tsx` (+ teste) | criar |
| `src/ui/ajustes/{Recorrencias,Categorias,CategoriasCartao,Cartoes,Assinaturas}.tsx` (+ testes) | editar |
| `docs/estilo/catalogo.md`, `docs/wiki/*`, `docs/dominio.md`, `changelog.d/*` | editar/criar |

Pontos de chamada de `boxIdEfetivo` (grep): `AdicionarSheet`, `Assinaturas`, `Bancos`, `Cartoes` (duas vezes: `FormCartao` e `Cartoes`), `Categorias`, `CategoriasCartao`, `Importar`, `Recorrencias` (duas vezes: `FormRecorrencia` e `Recorrencias`), `CenarioCard`, `SimuladorFluxo`, `SimuladorSimples`. Esta entrega troca só os das cinco telas de configuração. Nenhum caminho de exclusão, importação, backup ou pagamento muda.

---

### Tarefa 1: `unificarCategoriasPorNome`

**Arquivos:**
- Editar: `src/domain/categorias.ts`
- Testar: `src/domain/categorias.test.ts` (crie se não existir; se existir, acrescente um `describe`)

**Interfaces:**
- Produz:
  ```ts
  export function unificarCategoriasPorNome(
    categorias: Categoria[], lancamentos: Lancamento[], ocultas: ReadonlySet<ID>,
  ): { categorias: Categoria[]; lancamentos: Lancamento[] }
  ```

Regras (da spec):
- Chave do grupo: `tipo` + nome com `trim()`, `toLocaleLowerCase('pt-BR')` e sem acento (`normalize('NFD')` e remoção de `\u0300-\u036f`).
- Representante do grupo: a categoria **ativa** (não arquivada) primeira na ordem de `compararCategorias`; se todas forem arquivadas, a primeira arquivada na mesma ordem. O nome exibido é o do representante.
- Os lançamentos das outras categorias do grupo passam a apontar (`categoriaId`) para o representante. `boxId` e todo o resto do lançamento ficam iguais.
- Categorias em `ocultas` não entram na junção: ficam como estão, no resultado, e seus lançamentos não mudam.
- O resultado `categorias` contém o representante de cada grupo e as ocultas, nada das categorias absorvidas. A função não altera as entradas (devolve objetos novos só onde mudar `categoriaId`).

- [ ] **Passo 1: Escrever os testes que falham**

Monte os dados com construtores de teste (confira em `src/domain/types.ts` os campos obrigatórios de `Categoria` e `Lancamento`; um modelo existe em `src/domain/saldoPorBox.test.ts`). Casos, todos com asserções explícitas:
1. "mercado" (box A) e "Mercado" (box B), mesmo tipo `gasto`: um grupo; `categorias` tem 1 item daquele nome; os dois lançamentos terminam com o `categoriaId` do representante.
2. "Cafe", "Café" e "CAFÉ": um grupo só.
3. "mercado" `gasto` e "mercado" `ganho`: dois grupos (tipos diferentes).
4. Nome com espaços nas pontas (`'  mercado '`) junta com "mercado".
5. Categoria em `ocultas` com o mesmo nome de outra: não junta; continua no resultado; seus lançamentos não mudam.
6. Arquivada + ativa de mesmo nome e tipo: o representante é a ativa.
7. Só arquivadas: o representante é a primeira arquivada na ordem de `compararCategorias`.
8. `boxId` dos lançamentos não muda; `valor`, `data`, `id` também não.
9. Entradas não mudam: congele os arrays (`Object.freeze`) e confira que a chamada não lança e que os originais mantêm os `categoriaId`.
10. Categoria sem lançamento também é juntada (some a absorvida).
11. Sem nenhum grupo repetido: resultado igual à entrada (mesmo conteúdo).

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/domain/categorias.test.ts`
Esperado: FALHA (função não existe).

- [ ] **Passo 3: Implementar**

Em `src/domain/categorias.ts`, acrescente (e `Lancamento` ao import de tipos):

```ts
function chaveCategoria(c: Categoria): string {
  const nome = c.nome.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return `${c.tipo}|${nome}`;
}

/** Junta categorias de mesmo tipo e mesmo nome (sem diferenciar maiúsculas, acentos nem espaços
 *  nas pontas). Serve à visão casa de Análises, onde cada box tem a sua "mercado". O representante
 *  do grupo é a primeira categoria ativa na ordem de `compararCategorias`; os lançamentos das
 *  outras passam a apontar para ele. As `ocultas` (fatura, transferência) ficam como estão: a
 *  folha da fatura depende do id original. Não altera as entradas. */
export function unificarCategoriasPorNome(
  categorias: Categoria[], lancamentos: Lancamento[], ocultas: ReadonlySet<ID>,
): { categorias: Categoria[]; lancamentos: Lancamento[] } {
  const grupos = new Map<string, Categoria[]>();
  for (const c of [...categorias].sort(compararCategorias)) {
    if (ocultas.has(c.id)) continue;
    const chave = chaveCategoria(c);
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(c);
    else grupos.set(chave, [c]);
  }
  const representante = new Map<ID, ID>(); // id absorvido -> id do representante
  const mantidas = new Set<ID>();
  for (const grupo of grupos.values()) {
    const rep = grupo.find((c) => !c.arquivada) ?? grupo[0];
    mantidas.add(rep.id);
    for (const c of grupo) if (c.id !== rep.id) representante.set(c.id, rep.id);
  }
  return {
    categorias: categorias.filter((c) => ocultas.has(c.id) || mantidas.has(c.id)),
    lancamentos: lancamentos.map((l) => {
      const rep = representante.get(l.categoriaId);
      return rep ? { ...l, categoriaId: rep } : l;
    }),
  };
}
```

- [ ] **Passo 4: Rodar, suíte completa e commit**

Rode: `npx vitest run src/domain/categorias.test.ts` → PASSA. Rode `npm test` → verde.

```bash
git add src/domain/categorias.ts src/domain/categorias.test.ts
git commit -m "feat(dominio): unificarCategoriasPorNome para a visão casa de Análises

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

### Tarefa 2: Análises junta categorias na casa

**Arquivos:**
- Editar: `src/ui/TelaAnalises.tsx` (derivação de `dados`, ~linha 61; `LancamentosSheet`, ~linha 326)
- Editar: `src/ui/LancamentosSheet.tsx`
- Testar: `src/ui/TelaAnalises.test.tsx`, `src/ui/LancamentosSheet.test.tsx`

**Interfaces:**
- Consome: `unificarCategoriasPorNome` (Tarefa 1); `SeloBox` (`src/ui/SeloBox.tsx`, props `{ boxId, boxes }`); `categoriasFaturaIds` (`src/domain/fatura.ts`) e `categoriasTransferenciaIds` (`src/domain/transferencia.ts`), ambos recebem a lista de cartões/boxes e devolvem os ids.
- Produz: `LancamentosSheet` aceita `boxes?: Box[]` (opcional).

- [ ] **Passo 1: Escrever os testes que falham**

`LancamentosSheet.test.tsx`: com `boxes` (duas boxes) e lançamentos de boxes diferentes na mesma categoria e mês, o selo com o nome da box aparece em cada lançamento (grupo de um lançamento e lançamento dentro de grupo com vários); sem `boxes`, nenhum selo. Use os helpers e a forma de montar do arquivo existente.

`TelaAnalises.test.tsx` (use a montagem dos testes existentes): duas boxes `ana` e `bruno` com saldo próprio; categoria `mercado` de gasto em ana e `Mercado` de gasto em bruno, um lançamento efetivo de 50000 e outro de 40000 no mês atual.
- Na casa: existe **uma** linha "mercado" (ou "Mercado", a do representante) com R$ 900,00; não existem duas linhas com esse nome.
- Tocar a linha abre a folha com os dois lançamentos e os selos `ana` e `bruno`.
- Numa box só (`boxSel` = id de ana): a linha mostra só o total de ana.
- Na casa, a fatura de um cartão (categoria de fatura) continua abrindo a folha da fatura (se já houver teste disso, ele deve continuar passando sem mudança).

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/ui/TelaAnalises.test.tsx src/ui/LancamentosSheet.test.tsx`
Esperado: os testes novos FALHAM.

- [ ] **Passo 3: Implementar `LancamentosSheet`**

Importe `SeloBox` e `Box`. Acrescente à interface `Props`: `/** Na visão casa: mostra o selo da box de cada lançamento. */ boxes?: Box[];` e à desestruturação. No rótulo do grupo, depois do selo de estorno, acrescente `{boxes && g.itens.length === 1 && <SeloBox boxId={g.itens[0].boxId} boxes={boxes} />}`. No item dentro de grupo com vários, depois da data (e do selo de estorno): `{boxes && <SeloBox boxId={it.boxId} boxes={boxes} />}`. Se o tipo de `g.itens` não tiver `boxId`, ajuste o tipo em `lancamentosDaCategoria` (`src/domain/aggregations.ts`) para devolver `Lancamento`, sem mudar o resto.

- [ ] **Passo 4: Implementar `TelaAnalises`**

Importe `unificarCategoriasPorNome`, `categoriasFaturaIds`, `categoriasTransferenciaIds`. Troque

```tsx
  const dados = dadosDoBanco(dadosTodos, simples ? 'todos' : filtroBanco);
```

por

```tsx
  const dadosDoFiltro = dadosDoBanco(dadosTodos, simples ? 'todos' : filtroBanco);
  // Na casa, cada box tem a sua "mercado": junta por nome e tipo para a categoria aparecer uma vez.
  const dados = boxSel === 'casa'
    ? {
      ...dadosDoFiltro,
      ...unificarCategoriasPorNome(
        dadosDoFiltro.categorias, dadosDoFiltro.lancamentos,
        new Set([...categoriasFaturaIds(dadosDoFiltro.cartoes), ...categoriasTransferenciaIds(dadosDoFiltro.boxes)]),
      ),
    }
    : dadosDoFiltro;
```

No `<LancamentosSheet …>` acrescente `boxes={boxSel === 'casa' ? dados.boxes : undefined}`. Se `TelaAnalises` usar `dados` com tipo explícito em algum lugar, ajuste o tipo (`Dados`).

- [ ] **Passo 5: Rodar, suíte completa e commit**

Rode: `npx vitest run src/ui/TelaAnalises.test.tsx src/ui/LancamentosSheet.test.tsx` → PASSA. `npm test` → verde. `npx tsc -b` limpo.

```bash
git add src/ui/TelaAnalises.tsx src/ui/LancamentosSheet.tsx src/ui/TelaAnalises.test.tsx src/ui/LancamentosSheet.test.tsx src/domain/aggregations.ts
git commit -m "feat(analises): na casa, junta categorias de mesmo nome e mostra o selo da box

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

(Não inclua `aggregations.ts` no `git add` se não o alterou.)

---

### Tarefa 3: Telas de configuração por box pedem uma box na casa

**Arquivos:**
- Editar: `src/state/store.ts`
- Criar: `src/ui/ajustes/AvisoEscolhaBox.tsx`, `src/ui/ajustes/AvisoEscolhaBox.test.tsx`
- Editar: `src/ui/ajustes/Recorrencias.tsx`, `Categorias.tsx`, `CategoriasCartao.tsx`, `Cartoes.tsx`, `Assinaturas.tsx`
- Testar: os testes existentes de cada tela (`src/ui/ajustes/*.test.tsx` ou `src/ui/TelaAjustes.test.tsx`; ache com `grep -l`)
- Editar: `docs/estilo/catalogo.md`

**Interfaces:**
- Produz em `store.ts`: `export function boxIdConcreta(boxSel: BoxSelecionada): ID | null` → `boxSel === 'casa' ? null : boxSel`.
- Produz: `export default function AvisoEscolhaBox({ assunto }: { assunto: string })` → `<p className="sub">{assunto} são de cada box. Escolha uma box no topo para ver ou editar.</p>`. Atenção ao gênero: o `assunto` leva o artigo e o verbo concorda no plural ou singular; por isso use a frase pronta abaixo, com `assunto` já no plural ("As categorias", "Os cartões", "As assinaturas", "As recorrências", "As categorias do cartão"), todos no plural: "são de cada box".

- [ ] **Passo 1: Escrever os testes que falham**

`AvisoEscolhaBox.test.tsx`: renderiza com `assunto="As categorias"` e o texto "As categorias são de cada box. Escolha uma box no topo para ver ou editar." aparece, dentro de um `<p>` com a classe `sub`.

Para cada uma das cinco telas (use o padrão de montagem do teste existente dela; duas boxes `ana` e `bruno` com saldo próprio e, quando preciso, um cartão em ana):
- Com `boxSel: 'casa'`: o `<h2>` da tela aparece, o texto do aviso aparece, e **não** aparecem o formulário de criação nem a lista (por exemplo, `queryByRole('button', { name: 'Criar' })` e o texto "Nova recorrência" ausentes; ajuste ao que cada tela tem). A mensagem `A box "casa" não foi encontrada` não aparece.
- Com `boxSel` = id de ana: o comportamento de hoje (os testes existentes continuam passando sem mudança).

Se algum teste existente afirmar a mensagem `A box "casa" não foi encontrada` para a tela com `boxSel: 'casa'`, atualize-o para o aviso novo e diga isso no relatório.

- [ ] **Passo 2: Rodar e ver falhar**

Rode os arquivos de teste das cinco telas e `AvisoEscolhaBox.test.tsx`. Esperado: os testes novos FALHAM.

- [ ] **Passo 3: Implementar**

`store.ts`, junto de `boxIdEfetivo`:

```ts
/** Box concreta para as telas de configuração por box (Categorias, Cartões, Recorrências…): `null`
 *  na visão casa, onde elas mostram só um aviso para escolher uma box. */
export function boxIdConcreta(boxSel: BoxSelecionada): ID | null {
  return boxSel === 'casa' ? null : boxSel;
}
```

`AvisoEscolhaBox.tsx`:

```tsx
/** Aviso das telas de configuração por box quando "casa" está no topo: elas pertencem a cada box. */
export default function AvisoEscolhaBox({ assunto }: { assunto: string }) {
  return <p className="sub">{assunto} são de cada box. Escolha uma box no topo para ver ou editar.</p>;
}
```

Em cada uma das cinco telas (e nos subcomponentes que repetem a linha, `FormRecorrencia` e `FormCartao`):
- troque `boxIdEfetivo(dados, boxSel)` por `boxIdConcreta(boxSel)` (ajuste o import: tire `boxIdEfetivo`, ponha `boxIdConcreta`; `dados ? … : null` vira só a chamada);
- no ramo `if (boxId == null) { … }`, troque `<p className="sub">A box "casa" não foi encontrada — crie uma em Ajustes → Boxes.</p>` por `<AvisoEscolhaBox assunto="…" />`, mantendo o `<h2>` e o container que o ramo já tem. Valores de `assunto`: Recorrências → "As recorrências"; Categorias → "As categorias"; CategoriasCartao → "As categorias do cartão"; Cartoes → "Os cartões"; Assinaturas → "As assinaturas".
- os efeitos `[boxId]` continuam como estão.

Catálogo (`docs/estilo/catalogo.md`), no mesmo formato dos vizinhos:

```
- **`ajustes/AvisoEscolhaBox.tsx`** — aviso (`.sub`) das telas de Ajustes que pertencem a uma box (Categorias, Categorias do cartão, Cartões, Assinaturas, Recorrências) quando "casa" está no topo: "<assunto> são de cada box. Escolha uma box no topo para ver ou editar."
```

(Confira com `node scripts/verificar-catalogo.mjs` como o catálogo nomeia componentes de subpasta e siga o formato.)

- [ ] **Passo 4: Rodar, suíte completa e commit**

Rode os testes das telas e `AvisoEscolhaBox.test.tsx` → PASSAM. `npm test` → verde. `npx tsc -b` limpo. `node scripts/verificar-catalogo.mjs --strict` → ok.

```bash
git add src/state/store.ts src/ui/ajustes docs/estilo/catalogo.md
git commit -m "feat(ajustes): na casa, as telas por box pedem uma box

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

### Tarefa 4: Documentação, changelog e dossiê

**Arquivos:**
- Editar: `docs/wiki/7-ajustes.md`, `docs/wiki/6-telas.md`, `docs/dominio.md`, possivelmente `docs/wiki/3-conceitos.md` e `8-glossario.md`
- Criar: `changelog.d/alterado-analises-junta-categorias-na-casa.md`, `changelog.d/alterado-ajustes-por-box-pedem-box-na-casa.md`
- Regenerar: `docs/dossie/`

- [ ] **Passo 1: Wiki e domínio**

Leia `docs/wiki/README.md` (subconjunto fechado de markdown; marcadores `{{boxA}}`/`{{boxB}}`, sem nome fixo). Confira no código o que cada tela faz agora.
- `7-ajustes.md`: diga que, com **casa** no topo, Categorias, Categorias do cartão, Cartões, Assinaturas e Recorrências só mostram um aviso: são de cada box, e é preciso escolher uma no topo. Ajuste as frases que dizem que o padrão da box é "a box casa" na visão casa (linha ~50 e vizinhas) e a frase sobre a casa servir aos gastos divididos (linha ~33), sem contradizer o código.
- `6-telas.md` (Análises): na visão casa, categorias de mesmo nome e tipo (sem diferenciar maiúsculas nem acentos) viram uma linha só, com o total das boxes; a folha dela mostra a box de cada lançamento.
- `docs/dominio.md`: a UI de configuração (categorias, cartões, assinaturas, recorrências) não opera sobre a box `"casa"`; o que já existe nela segue contando nos totais e na projeção, mas não tem tela de edição. Regra da interface, **não** do repo (**expectativa não garantida** no domínio). Atualize a lista de quem usa `boxIdEfetivo` (hoje: Bancos, Importar, Simular, `AdicionarSheet`).
- Valide: `npx vitest run src/ui/ajustes/capitulos.test.ts`.

- [ ] **Passo 2: Fragmentos de changelog**

Leia `changelog.d/README.md` (bullets sem negrito, no máximo 2 níveis).

`changelog.d/alterado-analises-junta-categorias-na-casa.md`:
```
- Na visão casa, Análises junta as categorias de mesmo nome e tipo numa linha só.
  - A comparação ignora maiúsculas, acentos e espaços nas pontas.
  - Ao tocar na linha, cada lançamento mostra a box de origem.
```

`changelog.d/alterado-ajustes-por-box-pedem-box-na-casa.md`:
```
- Com casa no topo, Categorias, Categorias do cartão, Cartões, Assinaturas e Recorrências pedem para escolher uma box.
  - Antes, Recorrências dizia "Nenhuma recorrência nesta box" na casa, e as outras telas mostravam só o que está na box casa.
```

- [ ] **Passo 3: Dossiê**

Rode `npm run dossie`; leia `git diff --stat docs/dossie/`. Mudanças só nas telas afetadas. Algo fora disso: pare e relate como DONE_WITH_CONCERNS sem commitar o dossiê.

- [ ] **Passo 4: Verificações finais**

Todos devem passar: `npm test`, `npm run build`, `node scripts/verificar-catalogo.mjs --strict`, `node scripts/verificar-dados-reais.mjs --strict`, `npx vitest run src/ui/ajustes/capitulos.test.ts`.

- [ ] **Passo 5: Commit**

```bash
git add docs changelog.d
git commit -m "docs(casa): wiki, domínio, changelog e dossiê da entrega B

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

## Depois das tarefas (coordenador)

1. Revisão final do branch inteiro; um único lote de correções.
2. Varredura com Playwright (Galaxy S25+), duas boxes e a casa: Análises na casa (linha juntada, folha com selos, fatura ainda abre), as cinco telas de Ajustes na casa (aviso) e numa box (normal).
3. Mostrar os fragmentos de changelog; skill `ciclo-de-entrega`: merge na `main`, `npm run release`, push, `npm run deploy`.
4. Mover VB-19 e VB-20 do item 34 do `TODO.md` para `TODO-CONCLUIDOS.md`; limpar o worktree.
