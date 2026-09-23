# Saldo de um dia futuro no Fluxo — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar o progresso.

**Objetivo:** no filtro por data do Fluxo, o dia filtrado sempre aparece com o saldo, a diferença em relação a hoje e, fora da projeção, um `—` no lugar do R$ 0,00 falso.

**Arquitetura:** tudo muda na montagem da lista de `TelaFluxo.tsx` — quais dias entram (`diasSet`) e o que o bloco de cada dia mostra. A pílula `.delta` da Hoje troca a seta pelo sinal, no mesmo branch, para as duas telas mostrarem a diferença do mesmo jeito. Nenhuma função de domínio nova.

**Stack:** React 18 + TypeScript, Vitest + Testing Library (jsdom, fake-indexeddb).

**Spec:** `docs/superpowers/specs/2026-09-23-saldo-dia-futuro-e-rodape-backup-design.md`, parte A.

## Restrições globais

- Todo texto de UI, teste, commit e doc em português.
- Nenhuma dependência nova. Não mexer em `scripts/`, `vite.config.ts`, `tsconfig.json`, scripts do `package.json` nem `.claude/`.
- Não editar `"version"` do `package.json` nem o topo do `CHANGELOG.md` — só fragmento em `changelog.d/`.
- Dados sintéticos em testes e mockup — nenhum valor real do usuário.
- Sinal colado ao valor, com o menos `−` (U+2212): `+R$ 450,00` / `−R$ 450,00`.
- Textos exatos: `em relação a hoje`, `Nenhum lançamento neste dia.`, `A projeção vai até DD/MM/AAAA.`, `nos próximos 28 dias`.
- `formatarBRL` põe espaço não separável entre `R$` e o número. Nos testes, monte o texto esperado com `formatarBRL(...)`, nunca com o literal `'R$ 50,00'`.
- Não aperte timeouts nem passe `{ timeout }` a `findBy*`.

## Arquivos

- Modificar: `src/ui/TelaFluxo.tsx` — dias da lista e bloco do dia.
- Modificar: `src/ui/TelaFluxo.test.tsx` — testes novos e dois testes antigos que mudam de expectativa.
- Modificar: `src/ui/TelaHoje.tsx:~370` — pílula `.delta` com sinal.
- Modificar: `src/ui/TelaHoje.test.tsx` — teste da pílula.
- Modificar: `docs/estilo/catalogo.md` — descrição da `.delta` (hoje diz "com seta ▲/▼").
- Modificar: `docs/wiki/6-telas.md` — seções Hoje (Visão) e Fluxo.
- Criar: `changelog.d/alterado-saldo-dia-futuro.md`.
- Regenerar: `docs/dossie/` (`npm run dossie`).

---

### Tarefa 0: worktree e mockup aprovado

**Arquivos:** nenhum versionado. O mockup vive no scratchpad da sessão.

- [ ] **Passo 1: criar o worktree a partir da `main`** (depois do merge do branch `spec-fluxo-backup`)

```bash
git -C /c/Users/eitor/Claude/ProjetoFinancas worktree add .worktrees/saldo-dia-futuro -b saldo-dia-futuro main
cd /c/Users/eitor/Claude/ProjetoFinancas/.worktrees/saldo-dia-futuro && npm ci
```

- [ ] **Passo 2: ler o guia** — `docs/estilo-visual.md` e `docs/estilo/nivel-1-editar-tela.md`.

- [ ] **Passo 3: montar o mockup HTML** no scratchpad (`mockup-saldo-dia-futuro.html`), com `<meta charset="utf-8">` na primeira linha e as cores de `:root` copiadas de `src/styles.css`. Três quadros lado a lado, com dados sintéticos:
  1. Dia único futuro sem lançamento: cabeçalho `qua. 12/08/2026 · R$ 950,00`, pílula vermelha `−R$ 50,00 em relação a hoje`, linha `Nenhum lançamento neste dia.`
  2. Período: primeiro dia vazio, um dia com lançamento, último dia vazio — cada dia futuro com a sua pílula.
  3. Dia além do horizonte: cabeçalho com `—`, linha `A projeção vai até 31/12/2027.`
  E, embaixo, o card de saldo da Hoje com a pílula nova `+R$ 800,00 nos próximos 28 dias`.

- [ ] **Passo 4: mostrar o mockup** — abrir no navegador do PC **e** mandar no chat com SendUserFile.

- [ ] **Passo 5: parar e esperar a aprovação.** Silêncio não é aprovação. Se o mockup pedir espaçamento próprio para a linha da pílula, a mudança vira nível 2: criar a classe no bloco `/* ---- Fluxo (TelaFluxo.tsx) ---- */` e catalogá-la em `docs/estilo/catalogo.md`, na mesma tarefa em que ela for usada.

---

### Tarefa 1: o dia filtrado sempre aparece, sem R$ 0,00 falso

**Arquivos:**
- Modificar: `src/ui/TelaFluxo.tsx:1-7` (imports), `:110-113` (dias), `:180-214` (lista)
- Teste: `src/ui/TelaFluxo.test.tsx`

**Interfaces:**
- Consome: `formatarDataBR(d: ISODate): string` de `src/domain/dates.ts`; `dados.config.horizonteProjecao: ISODate`.
- Produz: nada que outras tarefas usem.

- [ ] **Passo 1: escrever os testes que falham.** No fim de `src/ui/TelaFluxo.test.tsx`, acrescentar `formatarBRL` e `formatarDataBR` aos imports do topo:

```tsx
import { addDias, formatarDataBR } from '../domain/dates';
import { formatarBRL } from '../domain/money';
```

e os testes:

```tsx
describe('dia filtrado sem lançamento', () => {
  it('dia futuro sem lançamento aparece com o saldo projetado e o aviso de dia vazio', async () => {
    const { box, catMercado } = await seedBoxComCategoria();
    const hoje = '2026-07-05';
    await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: '2026-07-20', valor: 5000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje });

    render(<TelaFluxo />);
    await abrirFiltros();
    fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: '2026-08-12' } });

    expect(await screen.findByText(/12\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByText(formatarBRL(95000))).toBeInTheDocument();
    expect(screen.getByText('Nenhum lançamento neste dia.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum resultado para a busca.')).not.toBeInTheDocument();
  });

  it('período mostra o primeiro e o último dia mesmo vazios, mas não os dias vazios do meio', async () => {
    const { box, catMercado } = await seedBoxComCategoria();
    const hoje = '2026-07-05';
    await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: '2026-08-15', valor: 5000, status: 'previsto', nota: 'conta do meio' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje });

    render(<TelaFluxo />);
    await abrirFiltros();
    await userEvent.click(screen.getByRole('button', { name: 'Selecionar período' }));
    fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-08-31' } });

    expect(await screen.findByText(/01\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/31\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByText('conta do meio')).toBeInTheDocument();
    expect(screen.queryByText(/10\/08\/2026/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Nenhum lançamento neste dia.')).toHaveLength(2);
  });

  it('dia depois do horizonte mostra traço e até onde a projeção vai, nunca R$ 0,00', async () => {
    const { box } = await seedBoxComCategoria();
    const hoje = '2026-07-05';
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje });
    const horizonte = useApp.getState().dados!.config.horizonteProjecao;

    render(<TelaFluxo />);
    await abrirFiltros();
    fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: '2040-01-01' } });

    expect(await screen.findByText(`A projeção vai até ${formatarDataBR(horizonte)}.`)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(formatarBRL(0))).not.toBeInTheDocument();
  });
});
```

Os valores: a box começa com `saldoInicial: 100000` em 2025-01-01; o gasto de 5000 em 20/07 deixa o saldo projetado de 12/08 em 95000.

- [ ] **Passo 2: atualizar os dois testes antigos que mudam de expectativa.** Eles afirmam o comportamento que esta tarefa corrige.

Em `'escolher uma data sem lançamentos mostra mensagem de nenhum resultado'`, trocar o nome e a última linha:

```tsx
it('escolher uma data sem lançamentos mostra o dia vazio, não "nenhum resultado"', async () => {
  // ...corpo igual até o fireEvent.change...
  expect(await screen.findByText('Nenhum lançamento neste dia.')).toBeInTheDocument();
  expect(screen.queryByText('Nenhum resultado para a busca.')).not.toBeInTheDocument();
});
```

Em `'filtro de data ativo não força hoje a aparecer se não tiver lançamento no filtro'`, trocar só a primeira expectativa:

```tsx
  expect(await screen.findByText('Nenhum lançamento neste dia.')).toBeInTheDocument();
  expect(screen.queryByText(/· hoje/)).not.toBeInTheDocument();
```

- [ ] **Passo 3: rodar e ver falhar**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx`
Expected: FAIL nos três testes novos e nos dois atualizados ("Unable to find an element with the text: Nenhum lançamento neste dia.").

- [ ] **Passo 4: implementar.** Em `src/ui/TelaFluxo.tsx`, trocar o import de datas:

```tsx
import { addDias, formatarDataBR } from '../domain/dates';
```

Trocar as linhas 110-113 por:

```tsx
  const saldoPorDia = new Map(serie.map((s) => [s.data, s.saldoProjetado]));
  const horizonte = dados.config.horizonteProjecao;
  const diasSet = new Set(porDia.keys());
  if (!filtroAtivo) diasSet.add(hoje);
  // Filtro de data responde "quanto vou ter no dia X?" — o dia (e as pontas do período)
  // entra mesmo sem lançamento; os dias vazios do meio de um período continuam de fora.
  if (dataAtiva) {
    diasSet.add(dataDeFiltro);
    diasSet.add(dataAteFiltro);
  }
  const dias = [...diasSet].sort();
```

Trocar o bloco `{dias.map((dia) => ( ... ))}` (linhas 181-211) por:

```tsx
            {dias.map((dia) => {
              const saldo = saldoPorDia.get(dia);
              const lancsDia = porDia.get(dia) ?? [];
              return (
                <div key={dia}>
                  <div className={dia === hoje ? 'cabecalho-dia dia-hoje' : 'cabecalho-dia'}>
                    <strong>{dataBonita(dia)}{dia === hoje ? ' · hoje' : ''}</strong>
                    <span className="sub">
                      {saldo == null ? (
                        <strong className="total-dia">—</strong>
                      ) : (
                        <strong className={`total-dia ${saldo >= 0 ? 'pos' : 'neg'}`}>
                          {formatarBRL(saldo)}
                        </strong>
                      )}
                    </span>
                  </div>
                  {saldo == null && dia > horizonte && (
                    <p className="sub">A projeção vai até {formatarDataBR(horizonte)}.</p>
                  )}
                  {dataAtiva && lancsDia.length === 0 && (
                    <p className="sub">Nenhum lançamento neste dia.</p>
                  )}
                  {lancsDia.map((l) => (
                    <button
                      key={l.id} className="item" style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => (
                        l.origem === 'cartao' ? setFaturaSel(l)
                        : l.origem === 'transferencia' ? setTransferenciaSel(l)
                        : setEditando(l)
                      )}
                    >
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
              );
            })}
```

- [ ] **Passo 5: rodar e ver passar**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx`
Expected: PASS em todos.

- [ ] **Passo 6: commit**

```bash
git add src/ui/TelaFluxo.tsx src/ui/TelaFluxo.test.tsx
git commit -m "feat(fluxo): dia filtrado sempre aparece, com traço fora da projeção"
```

(com as linhas de coautoria da sessão no fim da mensagem)

---

### Tarefa 2: diferença em relação a hoje, com sinal — no Fluxo e na Hoje

**Arquivos:**
- Modificar: `src/ui/TelaFluxo.tsx` (bloco do dia, da Tarefa 1)
- Modificar: `src/ui/TelaHoje.tsx:~367-374` (pílula do card de saldo)
- Modificar: `docs/estilo/catalogo.md:30`
- Teste: `src/ui/TelaFluxo.test.tsx`, `src/ui/TelaHoje.test.tsx`

**Interfaces:**
- Consome: o bloco do dia da Tarefa 1 (variáveis `saldo`, `dia`, `hoje`, `dataAtiva`).
- Produz: nada que outras tarefas usem.

- [ ] **Passo 1: escrever os testes que falham.** Dentro do `describe('dia filtrado sem lançamento', ...)` de `src/ui/TelaFluxo.test.tsx`:

```tsx
  it('dia futuro filtrado mostra a diferença em relação a hoje, negativa em vermelho', async () => {
    const { box, catMercado } = await seedBoxComCategoria();
    const hoje = '2026-07-05';
    await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: '2026-07-20', valor: 5000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje });

    render(<TelaFluxo />);
    await abrirFiltros();
    fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: '2026-08-12' } });

    const pilula = await screen.findByText(`−${formatarBRL(5000)} em relação a hoje`);
    expect(pilula).toHaveClass('delta', 'neg');
  });

  it('dia futuro filtrado com saldo maior que hoje mostra diferença positiva em verde', async () => {
    const { box, catSalario } = await seedBoxComCategoria();
    const hoje = '2026-07-05';
    await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: '2026-07-20', valor: 5000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje });

    render(<TelaFluxo />);
    await abrirFiltros();
    fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: '2026-08-12' } });

    const pilula = await screen.findByText(`+${formatarBRL(5000)} em relação a hoje`);
    expect(pilula).toHaveClass('delta', 'pos');
  });

  it('dia de hoje e dia passado filtrados não mostram diferença', async () => {
    const { box } = await seedBoxComCategoria();
    const hoje = '2026-07-05';
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje });

    render(<TelaFluxo />);
    await abrirFiltros();
    fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: hoje } });
    expect(await screen.findByText(/· hoje/)).toBeInTheDocument();
    expect(screen.queryByText(/em relação a hoje/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: '2026-06-01' } });
    expect(await screen.findByText(/01\/06\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/em relação a hoje/)).not.toBeInTheDocument();
  });

  it('lista sem filtro não mostra diferença em relação a hoje', async () => {
    const { box, catMercado } = await seedBoxComCategoria();
    const hoje = '2026-07-05';
    await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: '2026-07-08', valor: 5000, status: 'previsto', nota: 'conta futura' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje });

    render(<TelaFluxo />);

    expect(await screen.findByText('conta futura')).toBeInTheDocument();
    expect(screen.queryByText(/em relação a hoje/)).not.toBeInTheDocument();
  });
```

Em `src/ui/TelaHoje.test.tsx`, um teste novo para a pílula do card (o arquivo já importa `formatarBRL`):

```tsx
it('a diferença dos próximos 28 dias usa sinal e cor, não seta', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-10', valor: 80000, status: 'previsto' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);

  const pilula = screen.getByText(`+${formatarBRL(80000)} nos próximos 28 dias`);
  expect(pilula).toHaveClass('delta', 'pos');
  expect(screen.queryByText(/▲|▼/)).not.toBeInTheDocument();
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx src/ui/TelaHoje.test.tsx`
Expected: FAIL nos testes de diferença positiva e negativa do Fluxo e no da pílula da Hoje.

- [ ] **Passo 3: implementar no Fluxo.** Em `src/ui/TelaFluxo.tsx`, logo depois de `const dias = [...diasSet].sort();`:

```tsx
  // Mesma base da pílula da Hoje: saldo efetivo do último dia até hoje.
  const deHoje = serie.filter((s) => s.data <= hoje).at(-1);
```

No bloco do dia, logo depois do `</div>` que fecha o `.cabecalho-dia` (antes da linha "A projeção vai até"):

```tsx
                  {dataAtiva && dia > hoje && saldo != null && deHoje && (() => {
                    const delta = saldo - deHoje.saldoEfetivo;
                    if (delta === 0) return null;
                    return (
                      <div className="linha">
                        <span className={`delta ${delta > 0 ? 'pos' : 'neg'}`}>
                          {delta > 0 ? '+' : '−'}{formatarBRL(Math.abs(delta))} em relação a hoje
                        </span>
                      </div>
                    );
                  })()}
```

Se o mockup aprovado pediu outro arranjo para a pílula, siga o mockup.

- [ ] **Passo 4: implementar na Hoje.** Em `src/ui/TelaHoje.tsx`, na pílula do card de saldo, trocar:

```tsx
                  {delta > 0 ? '▲' : '▼'} {formatarBRL(Math.abs(delta))} nos próximos 28 dias
```

por:

```tsx
                  {delta > 0 ? '+' : '−'}{formatarBRL(Math.abs(delta))} nos próximos 28 dias
```

- [ ] **Passo 5: atualizar o catálogo.** Em `docs/estilo/catalogo.md:30`, trocar a descrição da `.delta`:

```markdown
| `.delta` (+ `.pos`/`.neg`) | badge de variação de saldo projetado, com sinal colado ao valor (`+R$ …` / `−R$ …`) e cor pelo sinal |
```

- [ ] **Passo 6: rodar e ver passar**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx src/ui/TelaHoje.test.tsx`
Expected: PASS em todos.

- [ ] **Passo 7: commit**

```bash
git add src/ui/TelaFluxo.tsx src/ui/TelaFluxo.test.tsx src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx docs/estilo/catalogo.md
git commit -m "feat(fluxo): diferença do dia filtrado em relação a hoje; pílula da Hoje com sinal"
```

---

### Tarefa 3: dossiê, wiki e fragmento

**Arquivos:**
- Regenerar: `docs/dossie/`
- Modificar: `docs/wiki/6-telas.md:11` (Visão) e `:51` (Lista do Fluxo)
- Criar: `changelog.d/alterado-saldo-dia-futuro.md`

- [ ] **Passo 1: regenerar o dossiê**

Run: `npm run dossie`
Expected: `docs/dossie/03-telas.md` troca as linhas `▲ R$ … nos próximos 28 dias` por `+R$ … nos próximos 28 dias`. Leia o `git diff docs/dossie/` inteiro com a skill `revisar-dossie`: nenhuma outra mudança deve aparecer além da pílula e, se o roteiro filtrar datas, dos dias vazios.

- [ ] **Passo 2: atualizar a wiki.** Em `docs/wiki/6-telas.md`, na linha da Lista (seção Fluxo), trocar a frase final `Cada dia mostra seu saldo projetado no cabeçalho.` por:

```markdown
Cada dia mostra seu saldo projetado no cabeçalho. Com filtro de data, o dia escolhido aparece mesmo sem lançamento — é o jeito de saber quanto você vai ter num dia em que nada acontece. Num período, aparecem o primeiro e o último dia, mais os dias com lançamento. Cada dia futuro filtrado mostra também a diferença em relação a hoje, em verde se o saldo sobe e em vermelho se desce. Um dia depois do fim da projeção mostra um traço no lugar do saldo e até quando a projeção vai.
```

Na linha da Visão (seção Hoje), depois de `se o projetado difere, aparece logo abaixo.`, acrescentar:

```markdown
A pílula colorida mostra quanto o saldo muda nos próximos 28 dias, com sinal: verde e positiva se sobe, vermelha e negativa se desce.
```

- [ ] **Passo 3: validar a wiki**

Run: `npx vitest run src/ui/ajustes/capitulos.test.ts`
Expected: PASS.

- [ ] **Passo 4: criar o fragmento** `changelog.d/alterado-saldo-dia-futuro.md`:

```markdown
- No Fluxo, filtrar por data mostra o saldo do dia escolhido mesmo quando não há lançamento nele.
  - Num período, aparecem sempre o primeiro e o último dia.
  - Cada dia futuro filtrado mostra a diferença em relação a hoje, em verde ou vermelho.
  - Um dia depois do fim da projeção mostra um traço e até quando a projeção vai, em vez de R$ 0,00.
- Na tela Hoje, a variação dos próximos 28 dias passa a usar sinal (+ ou −) no lugar da seta.
```

- [ ] **Passo 5: suíte inteira e build**

Run: `npm test && npm run build`
Expected: tudo verde, incluindo `src/dossie/dossie.test.ts`.

- [ ] **Passo 6: commit**

```bash
git add docs/dossie docs/wiki/6-telas.md changelog.d/alterado-saldo-dia-futuro.md
git commit -m "docs: wiki, dossiê e fragmento do saldo de dia futuro"
```

- [ ] **Passo 7: seguir a skill `ciclo-de-entrega`** — revisão do fragmento com o usuário (confirmação literal), merge na `main`, `npm run release`, push e deploy. Antes do merge, responder: "que item do `TODO.md` isto fecha?" — a entrega 1 do item 8; o item continua parcial (falta o tooltip).
