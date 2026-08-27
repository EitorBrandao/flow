# Confirmar pendente com outro valor — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> caixa de seleção (`- [ ]`) para acompanhamento.

**Objetivo:** na fila de Pendentes da tela Hoje, tocar no valor de um previsto comum abre a
correção de valor e data dentro do próprio item, e confirmar grava o lançamento com os valores
corrigidos num gesto só.

**Arquitetura:** a persistência já quase resolve — `repo.confirmarPendente(id, valorReal?)`
existe e grava valor corrigido; ela só ganha um terceiro parâmetro de data. Todo o resto é
`src/ui/TelaHoje.tsx`: um estado local com o id do item em correção, mais `CampoValor` e
`CampoData`, componentes que a folha da fatura já usa. Nenhum componente novo, nenhuma
migração de schema.

**Tecnologias:** React 18 + TypeScript, Vitest + Testing Library + fake-indexeddb, Dexie,
framer-motion (`AnimatePresence`, já no arquivo).

**Spec:** `docs/superpowers/specs/2026-08-27-confirmar-pendente-outro-valor-design.md`

## Restrições globais

- **Branch:** todo o trabalho vai para o worktree `.worktrees/confirmar-outro-valor`, no
  branch `confirmar-outro-valor`. Nunca commite na `main`.
- **Idioma:** código, UI, comentários, docs e mensagens de commit em **português**. Sem
  palavra solta em inglês.
- **Dinheiro:** centavos inteiros. Parse e format só por `src/domain/money.ts`.
- **Datas:** strings ISO `"AAAA-MM-DD"`.
- **Dados reais proibidos:** nenhum valor, saldo, descrição ou nome de estabelecimento real em
  arquivo versionado. Os testes usam nomes sintéticos (`internet`, `agua`) e valores redondos,
  como o resto da suíte.
- **Edição de UI:** antes de tocar em `src/ui/**` ou `src/styles.css`, leia
  `docs/estilo-visual.md` e o capítulo do nível. Este plano é **nível 2** (classe CSS nova):
  `docs/estilo/nivel-2-nova-classe.md`. Quem cria classe, cataloga em
  `docs/estilo/catalogo.md`, **no mesmo commit**.
- **Timeouts de teste:** nunca passe `{ timeout: n }` num `findBy*`. Os timeouts globais já são
  generosos de propósito.
- **`scripts/`, arquivos de build e `.claude/` não mudam** neste trabalho.
- **Comando de teste de um arquivo:** `npx vitest run <caminho>`. Um teste pelo nome:
  `npx vitest run -t "nome"`.

## Estrutura de arquivos

| Arquivo | Papel | Ação |
|---|---|---|
| `<scratchpad>/corrigir-pendente.html` | mockup dos dois estados do item, para aprovação — **fora do repo** | criar |
| `src/db/repo.ts` | `confirmarPendente` ganha `dataReal` | modificar (linha ~94) |
| `src/db/repo.test.ts` | teste da data corrigida | modificar |
| `src/styles.css` | modificador `.editavel` do valor | modificar (perto da linha 125) |
| `docs/estilo/catalogo.md` | registro do modificador | modificar |
| `src/ui/TelaHoje.tsx` | gesto, campos e gravação | modificar (linhas ~230–345) |
| `src/ui/TelaHoje.test.tsx` | os sete testes da spec | modificar |
| `docs/wiki/6-telas.md` | a frase que ensina o gesto | modificar (linha 13) |
| `changelog.d/alterado-corrigir-pendente.md` | fragmento de changelog | criar |

---

### Tarefa 1: Mockup aprovado

**Portão do ciclo de entrega:** mudança de UI não vira código sem mockup aprovado pelo
usuário. Esta tarefa termina esperando resposta — não siga para a Tarefa 2 sem ela.

**Arquivos:**
- Criar: `corrigir-pendente.html` **no diretório de scratchpad da sessão**, nunca dentro do
  repositório. Mockup é material de aprovação, não entregável — o repo nunca versionou nenhum.

- [ ] **Passo 1: Escrever o mockup**

Um arquivo HTML autocontido, com `<meta charset="utf-8">` na primeira linha do `<head>` — sem
ele os acentos viram lixo no celular. Ele mostra, lado a lado, os dois estados do item da fila:
repouso (valor tocável) e correção (campos abertos). Copie os tokens de cor reais do `:root` de
`src/styles.css` para o mockup parecer o app — os valores abaixo são um ponto de partida, e o
que vale é o que estiver no arquivo.

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Corrigir pendente — mockup</title>
<style>
  :root {
    --bg: #0f1319; --surface: #161b24; --surface2: #1c2230; --txt: #e8ecf3;
    --sub: #9aa4b6; --ac: #4c8dff; --pos: #3ddc97; --pos-bg: #123227;
    --neg: #ff6b6b; --neg-bg: #331b1e;
  }
  body { margin: 0; padding: 24px; background: var(--bg); color: var(--txt);
         font-family: system-ui, -apple-system, sans-serif; }
  h1 { font-size: 18px; } h2 { font-size: 14px; color: var(--sub); font-weight: 600; }
  .telas { display: flex; gap: 24px; flex-wrap: wrap; }
  .tela { width: 320px; }
  .item { background: var(--surface); border-radius: 18px; padding: 14px;
          display: flex; flex-direction: column; gap: 10px; }
  .linha-topo { display: flex; align-items: center; gap: 10px; }
  .cresce { flex: 1; }
  .sub { color: var(--sub); font-size: 13px; }
  .valor-gasto { color: var(--neg); background: var(--neg-bg); font-weight: 700;
                 font-size: 14.5px; padding: 6px 12px; border-radius: 12px;
                 font-variant-numeric: tabular-nums; }
  .valor-gasto.editavel { border: none; font-family: inherit; cursor: pointer;
                          min-height: 38px; display: inline-flex; align-items: center;
                          text-decoration: underline dotted; text-underline-offset: 3px; }
  .acoes { display: flex; gap: 8px; }
  .acoes .botao { flex: 1; }
  .botao { background: var(--surface2); color: var(--txt); border: none; border-radius: 12px;
           padding: 10px 14px; font-size: 14px; font-family: inherit; cursor: pointer; }
  .botao-primario { background: var(--ac); color: #fff; }
  .campo { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .campo label { color: var(--sub); font-size: 13px; }
  .campo input { background: var(--surface2); color: var(--txt); border: none;
                 border-radius: 12px; padding: 10px 12px; font-size: 15px;
                 font-family: inherit; }
  .linha { display: flex; gap: 8px; }
</style>
</head>
<body>
<h1>Fila de Pendentes — corrigir valor de um previsto comum</h1>
<div class="telas">
  <div class="tela">
    <h2>Repouso — o valor é tocável</h2>
    <div class="item">
      <div class="linha-topo">
        <div class="cresce">
          <div>internet</div>
          <div class="sub">27/08 · mensal</div>
        </div>
        <button class="valor-gasto editavel">R$ 120,00</button>
      </div>
      <div class="acoes">
        <button class="botao botao-primario">✓ Confirmar</button>
        <button class="botao">Descartar</button>
      </div>
    </div>
  </div>
  <div class="tela">
    <h2>Depois do toque no valor</h2>
    <div class="item">
      <div class="linha-topo">
        <div class="cresce">
          <div>internet</div>
          <div class="sub">27/08 · mensal</div>
        </div>
      </div>
      <div class="linha">
        <div class="campo"><label>Valor pago</label><input value="R$ 137,00"></div>
        <div class="campo"><label>Data do pagamento</label><input value="27/08/2026"></div>
      </div>
      <div class="acoes">
        <button class="botao botao-primario">✓ Confirmar</button>
        <button class="botao">Cancelar</button>
      </div>
    </div>
  </div>
</div>
</body>
</html>
```

- [ ] **Passo 2: Mostrar ao usuário e esperar a aprovação**

Entregue o arquivo ao usuário (`SendUserFile`, com `display: "render"`) e pergunte se aprova.
**Pare aqui.** Só continue com um "sim" explícito. Se ele pedir mudança, ajuste o mockup e
pergunte de novo.

Nada a commitar nesta tarefa: o mockup fica no scratchpad. Com o "sim" na mão, siga para a
Tarefa 2.

---

### Tarefa 2: `confirmarPendente` aceita a data corrigida

**Arquivos:**
- Modificar: `src/db/repo.ts:94-96`
- Testar: `src/db/repo.test.ts`

**Interfaces:**
- Consome: nada de tarefas anteriores.
- Produz: `confirmarPendente(id: ID, valorReal?: number, dataReal?: ISODate): Promise<void>`.
  A Tarefa 5 chama exatamente essa assinatura.

- [ ] **Passo 1: Escrever os testes que falham**

Acrescente ao fim de `src/db/repo.test.ts`:

```ts
it('confirma um pendente com valor e data corrigidos', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'internet', tipo: 'gasto', ordem: 0 });
  const lanc = await repo.salvarLancamento({
    boxId: box.id, categoriaId: cat.id, data: '2026-08-27', valor: 12000, status: 'previsto',
  });

  await repo.confirmarPendente(lanc.id, 13700, '2026-08-28');

  const salvo = await db.lancamentos.get(lanc.id);
  expect(salvo?.status).toBe('efetivo');
  expect(salvo?.valor).toBe(13700);
  expect(salvo?.data).toBe('2026-08-28');
});

it('confirma um pendente sem data corrigida e mantém a data do previsto', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'internet', tipo: 'gasto', ordem: 0 });
  const lanc = await repo.salvarLancamento({
    boxId: box.id, categoriaId: cat.id, data: '2026-08-27', valor: 12000, status: 'previsto',
  });

  await repo.confirmarPendente(lanc.id, 13700);

  const salvo = await db.lancamentos.get(lanc.id);
  expect(salvo?.valor).toBe(13700);
  expect(salvo?.data).toBe('2026-08-27');
});
```

**Antes de escrever:** abra o topo de `src/db/repo.test.ts` e veja se já existe um auxiliar que
monta uma box (`criarBox` ou parecido) e se `agoraISO`/`novoId` já estão importados. Se houver
auxiliar, use-o no lugar das quatro linhas de montagem — não duplique o que o arquivo já tem.

- [ ] **Passo 2: Rodar o teste e ver falhar**

Rodar: `npx vitest run src/db/repo.test.ts -t "valor e data corrigidos"`
Esperado: FALHA — a data salva continua `2026-08-27`, porque o terceiro argumento é ignorado.

- [ ] **Passo 3: Implementar**

Em `src/db/repo.ts`, troque a função inteira:

```ts
export async function confirmarPendente(id: ID, valorReal?: number, dataReal?: ISODate): Promise<void> {
  await atualizarLancamento(id, {
    status: 'efetivo',
    ...(valorReal != null ? { valor: valorReal } : {}),
    ...(dataReal != null ? { data: dataReal } : {}),
  });
}
```

Confira que `ISODate` está entre os tipos importados de `../domain/types` no topo de `repo.ts`;
se não estiver, acrescente-o.

- [ ] **Passo 4: Rodar os testes e ver passar**

Rodar: `npx vitest run src/db/repo.test.ts`
Esperado: PASSA — o arquivo inteiro, para garantir que nenhuma chamada antiga quebrou.

- [ ] **Passo 5: Commitar**

```bash
git add src/db/repo.ts src/db/repo.test.ts
git commit -m "feat(repo): confirmarPendente aceita data corrigida"
```

---

### Tarefa 3: O modificador `.editavel` do valor

**Nível 2 do guia de estilo.** Leia `docs/estilo/nivel-2-nova-classe.md` antes.

**Arquivos:**
- Modificar: `src/styles.css` (logo depois da linha 125, junto do bloco `.valor-ganho`/`.valor-gasto`)
- Modificar: `docs/estilo/catalogo.md`

**Interfaces:**
- Produz: a classe `editavel`, usada encadeada (`valor-gasto editavel`) pela Tarefa 4.

- [ ] **Passo 1: Escrever a classe**

Em `src/styles.css`, imediatamente depois da linha `.valor-gasto { color: var(--neg); ... }`:

```css
/* valor de um previsto que dá pra corrigir num toque (fila de Pendentes, TelaHoje): o
   sublinhado pontilhado é a única pista de que o valor é tocável, e o min-height sobe a
   pílula ao alvo mínimo de toque (38px, fundamentos.md). */
.valor-ganho.editavel, .valor-gasto.editavel {
  border: none; font-family: inherit; cursor: pointer;
  min-height: 38px; display: inline-flex; align-items: center;
  text-decoration: underline dotted; text-underline-offset: 3px;
}
```

Sem cor nova, sem token novo: o `<button>` herda cor e fundo de `.valor-ganho`/`.valor-gasto`,
e o modificador só desfaz o visual padrão de botão e acrescenta a pista.

- [ ] **Passo 2: Catalogar**

Em `docs/estilo/catalogo.md`, na linha logo abaixo da de `.valor-ganho`, `.valor-gasto`,
acrescente:

```markdown
| `.editavel` | modificador de `.valor-ganho`/`.valor-gasto` quando o valor é um `<button>` que abre a correção do lançamento (fila de Pendentes, `TelaHoje`); sublinhado pontilhado como pista, e altura mínima de alvo de toque |
```

Confira as colunas da tabela do `catalogo.md` antes de escrever e siga o formato que estiver
lá — se ela tiver mais de duas colunas, preencha todas.

- [ ] **Passo 3: Rodar o verificador de catálogo**

Rodar: `node scripts/verificar-catalogo.mjs`
Esperado: nenhuma reclamação sobre `editavel`. Sem `--strict` ele sai com 0 mesmo avisando —
leia a saída, não só o código de saída.

- [ ] **Passo 4: Commitar**

```bash
git add src/styles.css docs/estilo/catalogo.md
git commit -m "feat(estilo): modificador .editavel para valor tocável"
```

---

### Tarefa 4: O gesto — abrir e cancelar a correção

**Arquivos:**
- Modificar: `src/ui/TelaHoje.tsx`
- Testar: `src/ui/TelaHoje.test.tsx`

**Interfaces:**
- Consome: a classe `editavel` (Tarefa 3).
- Produz: o estado `corrigindo`/`valorCorrigido`/`dataCorrigida`, o botão com `aria-label`
  `Corrigir valor de {categoria}`, os rótulos `Valor pago` e `Data do pagamento`, e o esboço
  `confirmarCorrigido(l: Lancamento)` que a Tarefa 5 preenche.

- [ ] **Passo 1: Escrever os testes que falham**

Acrescente a `src/ui/TelaHoje.test.tsx`. O arquivo já tem o auxiliar `abrirAba` no topo — use-o.

```tsx
/** Monta uma box com um previsto comum de gasto na fila de Pendentes. */
async function cenarioPendenteComum(valor = 12000) {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-08-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'internet', tipo: 'gasto', ordem: 0 });
  const lanc = await repo.salvarLancamento({
    boxId: box.id, categoriaId: cat.id, data: '2026-08-27', valor, status: 'previsto',
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-08-27' });
  return { box, cat, lanc };
}

it('tocar no valor de um previsto comum abre os campos de correção', async () => {
  await cenarioPendenteComum();

  render(<TelaHoje />);
  await abrirAba(/Pendentes/);
  expect(screen.queryByLabelText('Valor pago')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Corrigir valor de internet' }));

  expect(await screen.findByLabelText('Valor pago')).toBeInTheDocument();
  expect(screen.getByLabelText('Data do pagamento')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument();
});

it('cancelar a correção fecha os campos sem gravar nada', async () => {
  const { lanc } = await cenarioPendenteComum();

  render(<TelaHoje />);
  await abrirAba(/Pendentes/);
  await userEvent.click(screen.getByRole('button', { name: 'Corrigir valor de internet' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

  await waitFor(() => expect(screen.queryByLabelText('Valor pago')).not.toBeInTheDocument());
  const salvo = await db.lancamentos.get(lanc.id);
  expect(salvo?.status).toBe('previsto');
  expect(salvo?.valor).toBe(12000);
});

it('abrir a correção de um item fecha a do outro', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-08-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const net = await repo.salvarCategoria({ boxId: box.id, nome: 'internet', tipo: 'gasto', ordem: 0 });
  const agua = await repo.salvarCategoria({ boxId: box.id, nome: 'agua', tipo: 'gasto', ordem: 1 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: net.id, data: '2026-08-27', valor: 12000, status: 'previsto' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: agua.id, data: '2026-08-27', valor: 8000, status: 'previsto' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-08-27' });

  render(<TelaHoje />);
  await abrirAba(/Pendentes/);
  await userEvent.click(screen.getByRole('button', { name: 'Corrigir valor de internet' }));
  await screen.findByLabelText('Valor pago');
  await userEvent.click(screen.getByRole('button', { name: 'Corrigir valor de agua' }));

  await waitFor(() => expect(screen.getAllByLabelText('Valor pago')).toHaveLength(1));
});
```

Confira que `waitFor` está entre os imports de `@testing-library/react` no topo do arquivo; se
não estiver, acrescente-o.

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npx vitest run src/ui/TelaHoje.test.tsx -t "abre os campos de correção"`
Esperado: FALHA — não existe botão com o nome acessível `Corrigir valor de internet`.

- [ ] **Passo 3: Implementar o gesto**

Em `src/ui/TelaHoje.tsx`:

**3.1.** No corpo do componente, junto dos outros `useState`, acrescente:

```tsx
  // Id do pendente com a correção aberta — um por vez, para a fila não virar um formulário
  // com vários campos abertos ao mesmo tempo.
  const [corrigindo, setCorrigindo] = useState<string | null>(null);
  const [valorCorrigido, setValorCorrigido] = useState(0);
  const [dataCorrigida, setDataCorrigida] = useState<ISODate>(hoje);
```

**3.2.** Junto das funções `confirmar`/`descartar`, acrescente a que abre a correção. Ela guarda
a **magnitude**: o sinal do previsto é reaplicado na hora de gravar (Tarefa 5).

```tsx
  function abrirCorrecao(l: Lancamento) {
    setCorrigindo(l.id);
    setValorCorrigido(Math.abs(l.valor));
    setDataCorrigida(l.data);
  }

  async function confirmarCorrigido(_l: Lancamento) {
    setCorrigindo(null);
  }
```

O corpo vazio de `confirmarCorrigido` é proposital: esta tarefa entrega só o gesto, e a
Tarefa 5 preenche a gravação.

**3.3.** No item da fila, troque o `<span>` do valor. O trecho de hoje é:

```tsx
                  <span className={tipoCat(l.categoriaId) === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
                    {formatarBRL(l.valor)}
                  </span>
```

Passa a ser:

```tsx
                  {ehFatura(l) ? (
                    <span className={tipoCat(l.categoriaId) === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
                      {formatarBRL(l.valor)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={`${tipoCat(l.categoriaId) === 'ganho' ? 'valor-ganho' : 'valor-gasto'} editavel`}
                      aria-label={`Corrigir valor de ${nomeCat(l.categoriaId)}`}
                      onClick={() => abrirCorrecao(l)}
                    >
                      {formatarBRL(l.valor)}
                    </button>
                  )}
```

**3.4.** Entre a `div.linha-topo` e a `div.acoes`, acrescente os campos, visíveis só no item em
correção:

```tsx
                {corrigindo === l.id && (
                  <div className="linha">
                    <div className="campo cresce">
                      <label htmlFor={`corrigir-valor-${l.id}`}>Valor pago</label>
                      <CampoValor
                        id={`corrigir-valor-${l.id}`} valorCentavos={valorCorrigido}
                        onChange={setValorCorrigido} autoFocus
                      />
                    </div>
                    <div className="campo">
                      <label htmlFor={`corrigir-data-${l.id}`}>Data do pagamento</label>
                      <CampoData
                        id={`corrigir-data-${l.id}`} value={dataCorrigida} onChange={setDataCorrigida}
                      />
                    </div>
                  </div>
                )}
```

**3.5.** Troque o bloco `div.acoes` inteiro. O de hoje é:

```tsx
                <div className="acoes">
                  <button className="botao botao-primario" aria-label={`Confirmar ${nomeCat(l.categoriaId)}`} onClick={() => confirmar(l.id)}>✓ Confirmar</button>
                  {ehFatura(l) ? (
                    <button className="botao" aria-label={`Paguei outro valor de ${nomeCat(l.categoriaId)}`} onClick={() => setPagando(l)}>Paguei outro valor</button>
                  ) : (
                    <button className="botao" aria-label="Descartar" onClick={() => descartar(l.id)}>Descartar</button>
                  )}
                </div>
```

Passa a ser:

```tsx
                <div className="acoes">
                  {corrigindo === l.id ? (
                    <>
                      <button className="botao botao-primario" aria-label={`Confirmar ${nomeCat(l.categoriaId)}`} onClick={() => confirmarCorrigido(l)}>✓ Confirmar</button>
                      <button className="botao" onClick={() => setCorrigindo(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button className="botao botao-primario" aria-label={`Confirmar ${nomeCat(l.categoriaId)}`} onClick={() => confirmar(l.id)}>✓ Confirmar</button>
                      {ehFatura(l) ? (
                        <button className="botao" aria-label={`Paguei outro valor de ${nomeCat(l.categoriaId)}`} onClick={() => setPagando(l)}>Paguei outro valor</button>
                      ) : (
                        <button className="botao" aria-label="Descartar" onClick={() => descartar(l.id)}>Descartar</button>
                      )}
                    </>
                  )}
                </div>
```

**3.6.** `ISODate` já está entre os tipos importados de `../domain/types` (linha 7) e
`CampoValor`/`CampoData` já estão importados (linhas 10–11) — confira antes de acrescentar
import repetido.

- [ ] **Passo 4: Rodar os testes e ver passar**

Rodar: `npx vitest run src/ui/TelaHoje.test.tsx`
Esperado: PASSA — os três testes novos e todos os antigos. O teste antigo "mostra saldo e
confirma um pendente" busca `{ name: /Confirmar/ }`; se essa busca passar a casar com mais de
um botão e quebrar, **não afrouxe o teste novo**: torne a busca antiga específica, trocando-a
por `{ name: 'Confirmar salario' }`, que é o `aria-label` exato daquele botão.

- [ ] **Passo 5: Commitar**

```bash
git add src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx
git commit -m "feat(hoje): tocar no valor de um pendente abre a correção"
```

---

### Tarefa 5: Gravar o valor e a data corrigidos

**Arquivos:**
- Modificar: `src/ui/TelaHoje.tsx`
- Testar: `src/ui/TelaHoje.test.tsx`

**Interfaces:**
- Consome: `repo.confirmarPendente(id, valorReal?, dataReal?)` (Tarefa 2); o estado
  `corrigindo`/`valorCorrigido`/`dataCorrigida`, o auxiliar de teste `cenarioPendenteComum` e o
  esboço `confirmarCorrigido` (Tarefa 4).

- [ ] **Passo 1: Escrever os testes que falham**

Acrescente a `src/ui/TelaHoje.test.tsx`, reusando `cenarioPendenteComum` da Tarefa 4:

```tsx
it('confirma o pendente com o valor corrigido e o tira da fila', async () => {
  const { lanc } = await cenarioPendenteComum();

  render(<TelaHoje />);
  await abrirAba(/Pendentes/);
  await userEvent.click(screen.getByRole('button', { name: 'Corrigir valor de internet' }));
  await userEvent.type(await screen.findByLabelText('Valor pago'), '13700');
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar internet' }));

  await screen.findByText('Nada a confirmar — tudo em dia.');
  const salvo = await db.lancamentos.get(lanc.id);
  expect(salvo?.status).toBe('efetivo');
  expect(salvo?.valor).toBe(13700);
});

it('confirma o pendente com a data corrigida', async () => {
  const { lanc } = await cenarioPendenteComum();

  render(<TelaHoje />);
  await abrirAba(/Pendentes/);
  await userEvent.click(screen.getByRole('button', { name: 'Corrigir valor de internet' }));
  const data = await screen.findByLabelText('Data do pagamento');
  await userEvent.clear(data);
  await userEvent.type(data, '2026-08-25');
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar internet' }));

  await screen.findByText('Nada a confirmar — tudo em dia.');
  const salvo = await db.lancamentos.get(lanc.id);
  expect(salvo?.data).toBe('2026-08-25');
});

it('previsto com valor negativo continua negativo depois de corrigido', async () => {
  const { lanc } = await cenarioPendenteComum(-4000);

  render(<TelaHoje />);
  await abrirAba(/Pendentes/);
  await userEvent.click(screen.getByRole('button', { name: 'Corrigir valor de internet' }));
  await userEvent.type(await screen.findByLabelText('Valor pago'), '5000');
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar internet' }));

  await screen.findByText('Nada a confirmar — tudo em dia.');
  const salvo = await db.lancamentos.get(lanc.id);
  expect(salvo?.valor).toBe(-5000);
});

it('a fatura de cartão não ganha o gesto e mantém "Paguei outro valor"', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-08-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'fatura cartao', tipo: 'gasto', ordem: 0 });
  await db.lancamentos.add({
    id: novoId(), boxId: box.id, categoriaId: cat.id, data: '2026-08-27', valor: 50000,
    status: 'previsto', origem: 'cartao', cartaoId: novoId(), faturaMes: '2026-08',
    criadoEm: agora, alteradoEm: agora,
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-08-27' });

  render(<TelaHoje />);
  await abrirAba(/Pendentes/);

  expect(screen.queryByRole('button', { name: 'Corrigir valor de fatura cartao' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Paguei outro valor/ })).toBeInTheDocument();
});
```

**Sobre o último teste:** ele grava direto em `db.lancamentos` porque `repo.salvarLancamento`
não expõe `origem`/`cartaoId`/`faturaMes`. Antes de escrevê-lo, abra
`src/ui/PagamentoFaturaSheet.test.tsx` e veja como aquele arquivo monta um pendente de fatura —
se houver caminho pronto e mais fiel (ex.: criar cartão e sincronizar), use-o.

**Sobre digitar no `CampoValor`:** ele intercepta tecla a tecla e reformata, então digitar
`13700` resulta em `R$ 137,00`. Veja em `src/ui/PagamentoFaturaSheet.test.tsx` como a suíte já
digita nesse campo e siga o mesmo jeito.

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npx vitest run src/ui/TelaHoje.test.tsx -t "valor corrigido"`
Esperado: FALHA — o lançamento continua `previsto`, porque `confirmarCorrigido` só fecha a
correção.

- [ ] **Passo 3: Implementar a gravação**

Em `src/ui/TelaHoje.tsx`, troque o esboço de `confirmarCorrigido` por:

```tsx
  // O campo edita a magnitude; o sinal vem do previsto original, para um estorno negativo não
  // virar positivo em silêncio. Trocar o sinal continua sendo trabalho do LancEditor.
  async function confirmarCorrigido(l: Lancamento) {
    const valor = l.valor < 0 ? -valorCorrigido : valorCorrigido;
    setCorrigindo(null);
    await repo.confirmarPendente(l.id, valor, dataCorrigida);
    await recarregar();
  }
```

- [ ] **Passo 4: Rodar os testes e ver passar**

Rodar: `npx vitest run src/ui/TelaHoje.test.tsx`
Esperado: PASSA — arquivo inteiro.

- [ ] **Passo 5: Rodar a suíte inteira**

Rodar: `npm test`
Esperado: tudo verde. Se `src/dossie/dossie.test.ts` acusar dossiê desatualizado, rode
`npm run dossie` e inclua o resultado no commit do passo seguinte.

- [ ] **Passo 6: Commitar**

```bash
git add src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx docs/dossie/
git commit -m "feat(hoje): confirmar pendente com valor e data corrigidos"
```

---

### Tarefa 6: Wiki e fragmento de changelog

**Arquivos:**
- Modificar: `docs/wiki/6-telas.md:13`
- Criar: `changelog.d/alterado-corrigir-pendente.md`

- [ ] **Passo 1: Atualizar a wiki**

Em `docs/wiki/6-telas.md`, a linha 13 é hoje:

```markdown
- **Pendentes:** fila de previstos vencidos, com confirmar (✓) ou descartar (✕) em um toque. O rótulo da aba mostra quantos itens esperam.
```

Troque por:

```markdown
- **Pendentes:** fila de previstos vencidos, com confirmar (✓) ou descartar (✕) em um toque. O rótulo da aba mostra quantos itens esperam. Se a conta veio com outro valor, toque no valor do item: ele abre os campos de valor e data ali mesmo, e confirmar grava o que você corrigiu. O ajuste vale só para aquela ocorrência — a recorrência que a gerou não muda.
```

O parser da wiki aceita só um subconjunto fechado de markdown (`docs/wiki/README.md`): bullet
simples e `**negrito**` estão dentro dele; título de nível 3, tabela e lista numerada, não.

- [ ] **Passo 2: Validar o parser da wiki**

Rodar: `npx vitest run src/ui/ajustes/capitulos.test.ts`
Esperado: PASSA. Se lançar exceção, é sintaxe fora do subconjunto — releia
`docs/wiki/README.md`.

- [ ] **Passo 3: Escrever o fragmento de changelog**

Crie `changelog.d/alterado-corrigir-pendente.md`. Sem negrito, sem terceiro nível, detalhe com
exatamente dois espaços de indentação:

```markdown
- Na fila de Pendentes, tocar no valor de um previsto abre a correção ali mesmo.
  - Dá para ajustar o valor e a data antes de confirmar, num gesto só.
  - O ajuste vale só para aquela ocorrência: a recorrência que gerou o previsto não muda.
  - Fatura de cartão continua com "Paguei outro valor", que abre a folha de parcelamento.
```

- [ ] **Passo 4: Rodar o verificador de dados reais**

Rodar: `node scripts/verificar-dados-reais.mjs`
Esperado: nada apontado nos arquivos novos. Os testes usam `internet`, `agua` e valores
redondos — nada real.

- [ ] **Passo 5: Commitar**

```bash
git add docs/wiki/6-telas.md changelog.d/alterado-corrigir-pendente.md
git commit -m "docs: wiki e changelog do gesto de corrigir pendente"
```

---

### Tarefa 7: Fechamento

- [ ] **Passo 1: Suíte e build**

Rodar: `npm test`
Esperado: tudo verde.

Rodar: `npm run build`
Esperado: `tsc -b && vite build` sem erro.

- [ ] **Passo 2: Entregar ao ciclo**

Invoque a skill `ciclo-de-entrega` e siga o que resta: confirmação do usuário sobre o
changelog, merge na `main`, `npm run release`, push e `npm run deploy`. **Não pule o ponto de
confirmação do changelog** — o ciclo para ali de propósito.

- [ ] **Passo 3: Atualizar o backlog local**

`TODO.md` e `TODO-CONCLUIDOS.md` são locais e ficam fora do git. Com o item 6 fechado, mova-o
inteiro para `TODO-CONCLUIDOS.md`, com o relato do que foi entregue, e tire a linha dele do
índice do `TODO.md` — deixando o número 6 fora da tabela, como os outros concluídos. Ajuste
também a frase da "Direção atual" que hoje diz que o item 6 é o que resta da etapa 2.
