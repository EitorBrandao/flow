# Linha de "hoje" fixa no Fluxo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na aba Fluxo, o cabeçalho do dia de hoje aparece sempre na lista padrão (sem busca/filtro ativo), mesmo sem lançamentos, destacado com um fundo verde-esmeralda sólido novo.

**Architecture:** Mudança contida em dois arquivos: `src/styles.css` ganha um token de cor novo e duas classes (`.cabecalho-dia` / `.dia-hoje`); `src/ui/TelaFluxo.tsx` passa a incluir `hoje` no conjunto de dias exibidos (quando não há busca/filtro ativo) e usa as classes novas no cabeçalho do dia em vez de `style` inline + a classe `valor-ganho`.

**Tech Stack:** React + TypeScript, Vitest + Testing Library (`@testing-library/react`, `@testing-library/user-event`), CSS puro (sem pré-processador).

## Global Constraints

- Cor do destaque: `--hoje-bg: #0d4a32` (verde-esmeralda sólido, opção "C" já validada com o usuário via mockup) — não usar `--pos`/`--pos-bg` (reservado a dinheiro, por `docs/estilo-visual.md`).
- Cor/raio nunca inline — sempre via classe em `src/styles.css` (convenção do projeto, ver `docs/estilo-visual.md`).
- Linha de hoje só é forçada a aparecer quando `!filtroAtivo` (nem busca de texto nem filtro de data/período ativos).
- Nomes de classe em português, consistente com o resto do arquivo (`cabecalho-dia`, `dia-hoje`).

---

### Task 1: Token e classes CSS do destaque de "hoje"

**Files:**
- Modify: `src/styles.css:1-9` (token novo em `:root`)
- Modify: `src/styles.css:114-117` (classes novas depois de `.aviso`)

**Interfaces:**
- Produces: token CSS `--hoje-bg`; classes `.cabecalho-dia` e `.cabecalho-dia.dia-hoje`, consumidas pelo JSX em `src/ui/TelaFluxo.tsx` na Task 2.

- [ ] **Step 1: Adicionar o token `--hoje-bg` em `:root`**

Em `src/styles.css`, linha 7 atual é:
```css
  --aviso-bg: #423306; --aviso-fg: #fcd34d;
```
Adicionar logo depois (antes de `color-scheme: dark;`):
```css
  --aviso-bg: #423306; --aviso-fg: #fcd34d;
  --hoje-bg: #0d4a32;
```

- [ ] **Step 2: Adicionar as classes `.cabecalho-dia` e `.dia-hoje`**

Em `src/styles.css`, logo depois do bloco `.aviso` (linhas 114-117 atuais):
```css
.aviso {
  background: var(--aviso-bg); color: var(--aviso-fg);
  padding: 12px 14px; border-radius: 12px; font-size: 14px;
}
```
Adicionar logo abaixo:
```css
.cabecalho-dia {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 10px 4px 4px;
}
.cabecalho-dia.dia-hoje {
  background: var(--hoje-bg); padding: 12px 14px; border-radius: 12px;
}
```

`.cabecalho-dia` sozinha reproduz exatamente o espaçamento que `TelaFluxo.tsx` hoje faz com
`className="linha"` + `style={{ padding: '10px 4px 4px', justifyContent: 'space-between' }}` —
não muda nada visualmente pros dias que não são hoje. `.dia-hoje` é o modificador aplicado só
na linha de hoje.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat(fluxo): token e classes CSS pro destaque da linha de hoje"
```

---

### Task 2: `TelaFluxo` sempre mostra o dia de hoje na lista padrão

**Files:**
- Modify: `src/ui/TelaFluxo.tsx:59-74` (montagem de `dias`)
- Modify: `src/ui/TelaFluxo.tsx:119-138` (render do cabeçalho e itens do dia)
- Test: `src/ui/TelaFluxo.test.tsx`

**Interfaces:**
- Consumes: classes `.cabecalho-dia` / `.dia-hoje` e token `--hoje-bg` da Task 1.
- Consumes (já existentes em `TelaFluxo.tsx`): `porDia: Map<string, Lancamento[]>`, `saldoPorDia: Map<string, number>`, `filtroAtivo: boolean`, `hoje: string` (de `useApp()`), `dataBonita(d: string): string`, `formatarBRL`.
- Produces: nenhuma interface nova consumida por outro arquivo — mudança contida em `TelaFluxo.tsx`.

- [ ] **Step 1: Escrever o teste que falha — hoje aparece sem lançamentos, só com o cabeçalho**

Em `src/ui/TelaFluxo.test.tsx`, adicionar ao final do arquivo (depois do último `it(...)`, antes do fechamento do arquivo):

```tsx
it('dia de hoje aparece na lista mesmo sem lançamentos, destacado e só com o cabeçalho', async () => {
  const { box } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);

  const cabecalhoHoje = await screen.findByText(/· hoje/);
  expect(cabecalhoHoje).toBeInTheDocument();
  expect(cabecalhoHoje.closest('.dia-hoje')).toBeInTheDocument();
  expect(screen.queryByText('Nenhum lançamento no período.')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test -- TelaFluxo -t "dia de hoje aparece na lista mesmo sem lançamentos"`
Expected: FAIL — hoje `porDia` só inclui dias com lançamento, então nenhum texto `/· hoje/`
aparece na tela (o dia de hoje simplesmente não é renderizado).

- [ ] **Step 3: Implementar a montagem de `dias` incluindo hoje**

Em `src/ui/TelaFluxo.tsx`, a linha atual (linha 74):
```tsx
  const dias = [...porDia.keys()].sort();
```
Substituir por:
```tsx
  const diasSet = new Set(porDia.keys());
  if (!filtroAtivo) diasSet.add(hoje);
  const dias = [...diasSet].sort();
```

- [ ] **Step 4: Implementar o cabeçalho do dia com as classes novas e o fallback de itens vazios**

Em `src/ui/TelaFluxo.tsx`, o bloco atual (linhas 120-138):
```tsx
        {dias.map((dia) => (
          <div key={dia}>
            <div className="linha" style={{ padding: '10px 4px 4px', justifyContent: 'space-between' }}>
              <strong className={dia === hoje ? 'valor-ganho' : ''}>{dataBonita(dia)}{dia === hoje ? ' · hoje' : ''}</strong>
              <span className="sub">{formatarBRL(saldoPorDia.get(dia) ?? 0)}</span>
            </div>
            {porDia.get(dia)!.map((l) => (
              <button key={l.id} className="item" style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => (l.origem === 'cartao' ? setFaturaSel(l) : setEditando(l))}>
                <div className="cresce">
                  {nomeCat(l.categoriaId)}
                  {l.status === 'previsto' && <span className="badge" style={{ marginLeft: 6 }}>{l.cenarioId ? 'cenário' : 'previsto'}</span>}
                  {l.nota && <div className="sub">{l.nota}</div>}
                </div>
                <span className={tipoCat(l.categoriaId) === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
                  {tipoCat(l.categoriaId) === 'ganho' ? '+' : '−'}{formatarBRL(Math.abs(l.valor))}
                </span>
              </button>
            ))}
          </div>
        ))}
```
Substituir por:
```tsx
        {dias.map((dia) => (
          <div key={dia}>
            <div className={dia === hoje ? 'cabecalho-dia dia-hoje' : 'cabecalho-dia'}>
              <strong>{dataBonita(dia)}{dia === hoje ? ' · hoje' : ''}</strong>
              <span className="sub">{formatarBRL(saldoPorDia.get(dia) ?? 0)}</span>
            </div>
            {(porDia.get(dia) ?? []).map((l) => (
              <button key={l.id} className="item" style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => (l.origem === 'cartao' ? setFaturaSel(l) : setEditando(l))}>
                <div className="cresce">
                  {nomeCat(l.categoriaId)}
                  {l.status === 'previsto' && <span className="badge" style={{ marginLeft: 6 }}>{l.cenarioId ? 'cenário' : 'previsto'}</span>}
                  {l.nota && <div className="sub">{l.nota}</div>}
                </div>
                <span className={tipoCat(l.categoriaId) === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
                  {tipoCat(l.categoriaId) === 'ganho' ? '+' : '−'}{formatarBRL(Math.abs(l.valor))}
                </span>
              </button>
            ))}
          </div>
        ))}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npm run test -- TelaFluxo -t "dia de hoje aparece na lista mesmo sem lançamentos"`
Expected: PASS

- [ ] **Step 6: Escrever o teste de regressão — filtro ativo não força hoje a aparecer**

Em `src/ui/TelaFluxo.test.tsx`, adicionar logo depois do teste do Step 1:

```tsx
it('filtro de data ativo não força hoje a aparecer se não tiver lançamento no filtro', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: hoje, valor: -5000, status: 'efetivo', nota: 'compra de hoje' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: '2026-01-01' } });

  expect(await screen.findByText('Nenhum resultado para a busca.')).toBeInTheDocument();
  expect(screen.queryByText(/· hoje/)).not.toBeInTheDocument();
});
```

Esse teste cobre a decisão de que a linha de hoje só é forçada na lista padrão — aqui há um
filtro de data ativo (`2026-01-01`, sem lançamentos) e mesmo hoje tendo um lançamento próprio
(`'compra de hoje'`), a linha de hoje não deve aparecer porque o filtro de data está ativo e
não bate com ela.

- [ ] **Step 7: Rodar toda a suíte de `TelaFluxo.test.tsx` e confirmar que passa**

Run: `npm run test -- TelaFluxo`
Expected: todos os testes do arquivo em PASS, incluindo os dois novos.

- [ ] **Step 8: Rodar a suíte completa e o build**

Run: `npm run test`
Expected: PASS (nenhuma suíte quebrada — em especial `TelaFluxo.test.tsx` continua verde
para os testes já existentes que dependem do texto/posição do cabeçalho do dia).

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 9: Commit**

```bash
git add src/ui/TelaFluxo.tsx src/ui/TelaFluxo.test.tsx
git commit -m "feat(fluxo): linha de hoje sempre visível na lista padrão, destacada em verde"
```

---

### Task 3: Conferência manual no celular

**Files:** nenhum arquivo novo — só verificação via app rodando.

- [ ] **Step 1: Rodar o preview acessível pela rede local**

Run: `npm run preview -- --host`
Expected: terminal mostra uma URL tipo `http://192.168.x.x:4173/` acessível pelo celular na
mesma rede.

- [ ] **Step 2: Abrir a aba Fluxo no celular e conferir**

Checklist manual:
- O dia de hoje aparece destacado com fundo verde-esmeralda, mesmo sem nenhum lançamento
  lançado hoje.
- A posição do dia de hoje na lista respeita a ordem cronológica (aparece entre os dias
  anteriores e os previstos futuros, se houver).
- Lançar algo hoje (via aba Lançar) faz o item aparecer normalmente embaixo do cabeçalho
  destacado, sem quebrar o layout.
- Buscar por texto ou escolher uma data/período que não inclua hoje **não** força a linha de
  hoje a aparecer.

- [ ] **Step 3: Deploy pro ambiente de testes do usuário**

Run: `npm run deploy`
Expected: publica em `https://eitorbrandao.github.io/flow/` (conforme preferência já registrada
do usuário de testar mudanças por lá).
