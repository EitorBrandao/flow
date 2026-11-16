# Plano D1 — Confirmação própria e "Desfazer"

> **Para quem executa:** use a skill `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** o app deixa de usar `window.confirm`. Exclusão simples apaga na hora e oferece "Desfazer"; exclusão em cascata pede confirmação num sheet do próprio app. O editor de lançamento ganha a hierarquia de botões aprovada.

**Arquitetura:** o aviso de retorno é estado do store único (`retorno`) e um componente montado uma vez no `Shell`. A confirmação é um componente, `ConfirmarSheet`, sobre o `Sheet` existente. O "Desfazer" de exclusão usa uma função nova do repositório, `restaurarLancamento`, que devolve o registro com o mesmo `id`. Um teste impede a volta do diálogo nativo.

**Stack:** React 18, TypeScript, Zustand, Dexie, framer-motion, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-15-confirmacao-retorno-e-pendentes-design.md`. Leia antes de começar. Mockup aprovado em 2026-11-15.

## Restrições globais

- Antes de editar a UI, leia `docs/estilo-visual.md` e os capítulos `nivel-2-nova-classe.md`, `nivel-4-novo-componente.md` e `transversais.md`.
- Classe e componente novos entram em `docs/estilo/catalogo.md` **no mesmo commit** que os cria. O release bloqueia se faltar.
- Cor, fundo e raio só por token. Nenhuma cor escrita à mão, salvo `#fff` sobre azul.
- Textos da interface em português, exatamente como escritos neste plano.
- Nenhuma dependência nova. Nada em `scripts/`, `.claude/`, `vite.config.ts` nem `package.json`.
- Antes de mexer em `src/db/repo.ts`, leia `src/db/CLAUDE.md` e a seção do tema em `docs/licoes-aprendidas.md`. Este plano não cria versão de schema.
- Dados de teste sintéticos. Nenhum valor escrito como texto em moeda fora de arquivo `*.test.tsx`.
- Não aperte timeouts de teste. Não use `{ timeout: n }` em `findBy*`.
- Mudança visível: fragmento em `changelog.d/`, wiki, varredura com o roteiro de `scripts/varredura/` (plano C), release e deploy pela skill `ciclo-de-entrega`.
- Siga o mockup aprovado. Desvio precisa de nova aprovação do usuário.

## Decisão do usuário (2026-11-16)

O botão Cancelar do sheet de confirmação sai **com contorno** (`.botao-discreto`), como o Fechar do editor. Este ponto diverge do mockup, que mostrava Cancelar cinza, e foi aprovado no chat.

## Modelo por tarefa

| Tarefa | Complexidade | Implementa | Revisa |
|---|---|---|---|
| 1 `restaurarLancamento` | complexa (`src/db/`) | Sonnet | Opus |
| 2 `Retorno` | complexa (usado por todas as telas) | Sonnet | Opus |
| 3 `ConfirmarSheet` | complexa (usado por 10 pontos) | Sonnet | Opus |
| 4 Editor de lançamento | intermediária | Haiku | Sonnet, depois Opus |
| 5 Descartar pendente e item de cenário | intermediária | Haiku | Sonnet, depois Opus |
| 6 Confirmações em `src/ui/` | intermediária | Haiku | Sonnet, depois Opus |
| 7 Confirmações em Ajustes | intermediária | Haiku | Sonnet, depois Opus |
| 8 Trava contra diálogo nativo | simples | Haiku | Opus |
| 9 Wiki, changelog, dossiê, varredura | intermediária | sessão principal | Opus |

Paralelismo: 1, 2 e 3 são independentes entre si. 4 e 5 dependem de 1 e 2. 6 e 7 dependem de 3 e são independentes entre si. 8 vem depois de 4 a 7. Catálogo: as Tarefas 2 e 3 editam `docs/estilo/catalogo.md` e `src/styles.css`; se rodarem em paralelo, cada uma no próprio worktree, com merge em sequência.

## Arquivos

| Arquivo | Muda o quê |
|---|---|
| `src/db/repo.ts` | `restaurarLancamento` |
| `src/state/store.ts` | `retorno`, `avisar`, `limparRetorno` |
| `src/ui/Retorno.tsx` (novo) | aviso de retorno |
| `src/ui/ConfirmarSheet.tsx` (novo) | sheet de confirmação |
| `src/ui/Shell.tsx` | monta `<Retorno />` |
| `src/styles.css`, `docs/estilo/catalogo.md` | classes novas |
| `src/ui/ConfirmarRepetidoSheet.tsx` | Cancelar com contorno |
| `src/ui/LancEditor.tsx`, `TelaHoje.tsx`, `ItemCenarioSheet.tsx` | Desfazer |
| `src/ui/TransferenciaSheet.tsx`, `FormCompra.tsx`, `CartaoSimples.tsx`, `CenarioCard.tsx` | `ConfirmarSheet` |
| `src/ui/ajustes/Bancos.tsx`, `Recorrencias.tsx`, `Assinaturas.tsx`, `Viagens.tsx`, `Backup.tsx` | `ConfirmarSheet` |
| `src/ui/semDialogoNativo.test.ts` (novo) | trava |
| `docs/wiki/6-telas.md`, `changelog.d/alterado-confirmacao-propria.md` | texto para o usuário |
| `docs/estilo/interacao.md` (novo), `docs/estilo-visual.md`, `docs/README.md` | capítulo de interação |

---

### Tarefa 1: `repo.restaurarLancamento`

**Arquivos:**
- Modificar: `src/db/repo.ts` (logo depois de `excluirLancamento`, hoje na linha 125)
- Testar: `src/db/repo.test.ts` (se o arquivo tiver outro nome, use o arquivo de teste que já cobre `excluirLancamento`; ache com `grep -rl "excluirLancamento" src/db`)

**Interfaces:**
- Produz: `restaurarLancamento(l: Lancamento): Promise<void>` — grava o registro inteiro, com o mesmo `id`.

- [ ] **Passo 1: escreva os testes que falham**

```ts
describe('restaurarLancamento', () => {
  it('devolve o lançamento excluído, idêntico e com o mesmo id', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'carteira', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
    const original = await repo.salvarLancamento({
      boxId: box.id, categoriaId: cat.id, data: '2026-07-05', valor: 5000, nota: 'feira', status: 'efetivo',
    });

    await repo.excluirLancamento(original.id);
    expect(await db.lancamentos.get(original.id)).toBeUndefined();

    await repo.restaurarLancamento(original);

    expect(await db.lancamentos.get(original.id)).toEqual(original);
    expect(await db.lancamentos.count()).toBe(1);
  });

  it('restaurar duas vezes não duplica', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'carteira', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
    const original = await repo.salvarLancamento({
      boxId: box.id, categoriaId: cat.id, data: '2026-07-05', valor: 5000, status: 'previsto',
    });
    await repo.excluirLancamento(original.id);

    await repo.restaurarLancamento(original);
    await repo.restaurarLancamento(original);

    expect(await db.lancamentos.count()).toBe(1);
  });

  it('recusa lançamento efetivo de cenário', async () => {
    const agora = agoraISO();
    const falso = {
      id: novoId(), boxId: novoId(), categoriaId: novoId(), data: '2026-07-05', valor: 5000,
      status: 'efetivo' as const, origem: 'manual' as const, cenarioId: novoId(), criadoEm: agora, alteradoEm: agora,
    };

    await expect(repo.restaurarLancamento(falso)).rejects.toThrow();
    expect(await db.lancamentos.count()).toBe(0);
  });
});
```

Use os mesmos `import` e a mesma limpeza de banco (`beforeEach`) que o arquivo de teste já tem. Recalcule: cada teste termina com exatamente 1 lançamento, salvo o terceiro, que termina com 0.

- [ ] **Passo 2:** rode `npx vitest run src/db -t "restaurarLancamento"`. Esperado: falha, a função não existe.

- [ ] **Passo 3: implemente**, logo depois de `excluirLancamento`:

```ts
/**
 * Devolve um lançamento apagado, com o mesmo id. Uso único: o "Desfazer" da UI, logo depois
 * de um `excluirLancamento`. `put`, e não `add`: restaurar duas vezes não duplica.
 */
export async function restaurarLancamento(l: Lancamento): Promise<void> {
  recusarEfetivoDeCenario(l.cenarioId, l.status);
  await db.transaction('rw', db.lancamentos, db.cenarios, db.config, async () => {
    await db.lancamentos.put(l);
    if (!(await ehRascunho(l.cenarioId))) await marcarMudanca();
  });
}
```

Se o terceiro teste falhar porque `recusarEfetivoDeCenario` lança de forma síncrona, fora da promessa, a asserção `rejects` continua valendo: a função é `async`, e o erro vira rejeição.

- [ ] **Passo 4:** rode `npx vitest run src/db`. Esperado: tudo passa.

- [ ] **Passo 5: commit**

```bash
git add src/db/
git commit -m "feat(repo): restaurarLancamento, para o Desfazer da interface"
```

---

### Tarefa 2: Aviso de retorno

**Arquivos:**
- Modificar: `src/state/store.ts`
- Criar: `src/ui/Retorno.tsx`
- Modificar: `src/ui/Shell.tsx` (linha 91, junto do `<AvisoAtualizacao />`)
- Modificar: `src/styles.css`, `docs/estilo/catalogo.md`
- Testar: `src/ui/Retorno.test.tsx`

**Interfaces:**
- Produz, no store: `retorno: Retorno | null`; `avisar(texto: string, desfazer?: () => Promise<void>): void`; `limparRetorno(): void`; tipo exportado `Retorno = { id: number; texto: string; desfazer?: () => Promise<void> }`.

- [ ] **Passo 1: escreva os testes que falham**

```tsx
// src/ui/Retorno.test.tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useApp } from '../state/store';
import Retorno from './Retorno';

beforeEach(() => { useApp.setState({ retorno: null }); });
afterEach(() => { vi.useRealTimers(); });

it('não mostra nada sem retorno', () => {
  render(<Retorno />);
  expect(screen.queryByText('Desfazer')).not.toBeInTheDocument();
});

it('mostra o texto; sem função de desfazer, não mostra o botão', () => {
  render(<Retorno />);
  act(() => useApp.getState().avisar('Alteração salva'));
  expect(screen.getByText('Alteração salva')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
});

it('Desfazer roda a função, recarrega e fecha o aviso', async () => {
  const desfazer = vi.fn().mockResolvedValue(undefined);
  const recarregar = vi.fn().mockResolvedValue(undefined);
  useApp.setState({ recarregar });
  render(<Retorno />);
  act(() => useApp.getState().avisar('Lançamento excluído', desfazer));

  await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

  expect(desfazer).toHaveBeenCalledOnce();
  expect(recarregar).toHaveBeenCalledOnce();
  expect(useApp.getState().retorno).toBeNull();
});

it('um aviso novo substitui o anterior e ganha id novo', () => {
  render(<Retorno />);
  act(() => useApp.getState().avisar('Primeiro'));
  const primeiro = useApp.getState().retorno!.id;
  act(() => useApp.getState().avisar('Segundo'));
  expect(screen.queryByText('Primeiro')).not.toBeInTheDocument();
  expect(screen.getByText('Segundo')).toBeInTheDocument();
  expect(useApp.getState().retorno!.id).not.toBe(primeiro);
});

it('some sozinho: 3 s sem Desfazer, 6 s com Desfazer', () => {
  vi.useFakeTimers();
  render(<Retorno />);

  act(() => useApp.getState().avisar('Alteração salva'));
  act(() => { vi.advanceTimersByTime(2999); });
  expect(useApp.getState().retorno).not.toBeNull();
  act(() => { vi.advanceTimersByTime(1); });
  expect(useApp.getState().retorno).toBeNull();

  act(() => useApp.getState().avisar('Lançamento excluído', async () => {}));
  act(() => { vi.advanceTimersByTime(5999); });
  expect(useApp.getState().retorno).not.toBeNull();
  act(() => { vi.advanceTimersByTime(1); });
  expect(useApp.getState().retorno).toBeNull();
});

it('se o Desfazer falhar, o aviso fecha e o erro não some em silêncio', async () => {
  const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<Retorno />);
  act(() => useApp.getState().avisar('Lançamento excluído', async () => { throw new Error('falhou'); }));

  await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

  expect(await screen.findByText('Não foi possível desfazer')).toBeInTheDocument();
  expect(erro).toHaveBeenCalled();
  erro.mockRestore();
});
```

- [ ] **Passo 2:** rode `npx vitest run src/ui/Retorno.test.tsx`. Esperado: falha, `Retorno` e `avisar` não existem.

- [ ] **Passo 3: store.** Em `src/state/store.ts`:

Antes de `interface AppState`:

```ts
/** Aviso curto depois de uma ação: o que aconteceu e, quando dá, como voltar atrás. */
export interface Retorno { id: number; texto: string; desfazer?: () => Promise<void> }

/** Numera os avisos: dois avisos com o mesmo texto ainda são avisos diferentes. */
let proximoRetorno = 0;
```

Dentro de `interface AppState`, depois de `importacao: ImportacaoPendente;`:

```ts
  retorno: Retorno | null;
```

e, depois de `limparImportacao(): void;`:

```ts
  /** Mostra o aviso de retorno. Um aviso novo substitui o anterior. */
  avisar(texto: string, desfazer?: () => Promise<void>): void;
  limparRetorno(): void;
```

No `create`, depois de `importacao: IMPORTACAO_VAZIA,`:

```ts
  retorno: null,
```

e, depois de `limparImportacao: ...`:

```ts
  avisar: (texto, desfazer) => { proximoRetorno += 1; set({ retorno: { id: proximoRetorno, texto, desfazer } }); },
  limparRetorno: () => set({ retorno: null }),
```

- [ ] **Passo 4: componente.**

```tsx
// src/ui/Retorno.tsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../state/store';

const DURACAO_MS = 3000;
const DURACAO_COM_DESFAZER_MS = 6000;

// Aviso de retorno: diz o que acabou de acontecer e, quando a ação tem volta, oferece
// "Desfazer". Mora na mesma faixa do aviso de atualização, acima da barra de navegação, e
// fica acima dos sheets. Regras em docs/estilo/interacao.md.
export default function Retorno() {
  const retorno = useApp((s) => s.retorno);
  const limparRetorno = useApp((s) => s.limparRetorno);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!retorno) return;
    const id = setTimeout(limparRetorno, retorno.desfazer ? DURACAO_COM_DESFAZER_MS : DURACAO_MS);
    return () => clearTimeout(id);
  }, [retorno, limparRetorno]);

  async function desfazer() {
    if (!retorno?.desfazer || ocupado) return;
    setOcupado(true);
    try {
      await retorno.desfazer();
      await useApp.getState().recarregar();
      // Só fecha o aviso que foi desfeito: outro pode ter chegado enquanto isso.
      if (useApp.getState().retorno?.id === retorno.id) limparRetorno();
    } catch (e) {
      console.error('Falha ao desfazer:', e);
      useApp.getState().avisar('Não foi possível desfazer');
    } finally {
      setOcupado(false);
    }
  }

  return createPortal(
    <div className="retorno-pista" role="status" aria-live="polite">
      <AnimatePresence>
        {retorno && (
          <motion.div
            key={retorno.id} className="retorno"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
          >
            <span>{retorno.texto}</span>
            {retorno.desfazer && (
              <button type="button" className="retorno-acao" onClick={desfazer} disabled={ocupado}>Desfazer</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
```

- [ ] **Passo 5: CSS.** No fim de `src/styles.css`:

```css
/* ---- Aviso de retorno (Retorno.tsx) ---- */
/* Mesma faixa do aviso de atualização, mas acima dos sheets (z-index 50): o aviso aparece
   logo depois de um sheet fechar, e às vezes com outro ainda aberto. */
.retorno-pista {
  position: fixed; left: 0; right: 0; bottom: calc(80px + env(safe-area-inset-bottom));
  display: flex; justify-content: center; pointer-events: none; z-index: 60; padding: 0 16px;
}
.retorno {
  pointer-events: auto; display: inline-flex; align-items: center; gap: 4px;
  border-radius: 999px; min-height: 44px; padding: 0 16px;
  background: var(--surface2); color: var(--fg); font-size: 14px; font-weight: 600;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .4);
}
.retorno-acao {
  background: none; border: none; color: var(--ac); font-weight: 700; font-size: 14px;
  min-height: 44px; padding: 0 12px; margin-right: -10px;
}
```

E dentro do bloco `@media (min-width: 900px)`, junto de `.aviso-atualizacao-pista`:

```css
  .retorno-pista { left: 190px; bottom: 24px; }
```

- [ ] **Passo 6: monte no Shell.** Em `src/ui/Shell.tsx`, importe `Retorno from './Retorno'` e acrescente `<Retorno />` logo depois de `<AvisoAtualizacao />`.

- [ ] **Passo 7: catálogo.** Em `docs/estilo/catalogo.md`, na tabela de classes, depois da linha de `.aviso-atualizacao-pista`:

```markdown
| `.retorno-pista` / `.retorno` / `.retorno-acao` | aviso de retorno (`Retorno.tsx`). `-pista` é a faixa fixa acima da barra de navegação, acima dos sheets, que não captura toque; `.retorno` é a pílula (`--surface2`, 14px, altura mínima de 44px); `.retorno-acao` é o "Desfazer", em `--ac`. No desktop, a faixa sobe ao canto inferior, ao lado da barra lateral |
```

Na lista de componentes, em ordem alfabética:

```markdown
- **`Retorno.tsx`** — aviso curto depois de uma ação, com "Desfazer" quando a ação tem volta. Montado uma vez no `Shell`; as telas chamam `useApp.getState().avisar(texto, desfazer?)`. Some em 3 s, ou em 6 s quando tem "Desfazer". Regras em `docs/estilo/interacao.md`.
```

- [ ] **Passo 8:** rode `npx vitest run src/ui/Retorno.test.tsx`, depois `node scripts/verificar-catalogo.mjs`, depois `npm test`. Esperado: 6 testes passam; o verificador não acusa as classes novas nem o componente; a suíte inteira passa.

- [ ] **Passo 9: commit**

```bash
git add src/state/store.ts src/ui/Retorno.tsx src/ui/Retorno.test.tsx src/ui/Shell.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "feat(ui): aviso de retorno com Desfazer"
```

---

### Tarefa 3: Sheet de confirmação e classes de botão

**Arquivos:**
- Criar: `src/ui/ConfirmarSheet.tsx`
- Modificar: `src/ui/ConfirmarRepetidoSheet.tsx` (linha 32)
- Modificar: `src/styles.css`, `docs/estilo/catalogo.md`
- Testar: `src/ui/ConfirmarSheet.test.tsx`

**Interfaces:**
- Produz: componente padrão `ConfirmarSheet` com as propriedades `{ aberto: boolean; titulo: string; resumo?: ReactNode; apoio?: string; rotuloConfirmar: string; perigo?: boolean; onCancelar: () => void; onConfirmar: () => void }`.
- Produz: classes `.botao-discreto`, `.botao-perigo-cheio`, `.sheet-botoes`, `.sheet-botoes .empurra`.

- [ ] **Passo 1: escreva os testes que falham**

```tsx
// src/ui/ConfirmarSheet.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import ConfirmarSheet from './ConfirmarSheet';

function montar(props: Partial<Parameters<typeof ConfirmarSheet>[0]> = {}) {
  const onCancelar = vi.fn();
  const onConfirmar = vi.fn();
  render(
    <ConfirmarSheet
      aberto titulo="Excluir esta viagem?" rotuloConfirmar="Excluir"
      onCancelar={onCancelar} onConfirmar={onConfirmar} {...props}
    />,
  );
  return { onCancelar, onConfirmar };
}

it('fechado não mostra nada', () => {
  montar({ aberto: false });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('mostra título, resumo e apoio, e o diálogo leva o título como nome', () => {
  montar({ resumo: <span>praia</span>, apoio: 'Os lançamentos continuam existindo.' });
  const dialogo = screen.getByRole('dialog', { name: 'Excluir esta viagem?' });
  expect(within(dialogo).getByText('praia')).toBeInTheDocument();
  expect(within(dialogo).getByText('Os lançamentos continuam existindo.')).toBeInTheDocument();
});

it('Cancelar chama só onCancelar', async () => {
  const { onCancelar, onConfirmar } = montar();
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onCancelar).toHaveBeenCalledOnce();
  expect(onConfirmar).not.toHaveBeenCalled();
});

it('o botão de confirmar chama só onConfirmar', async () => {
  const { onCancelar, onConfirmar } = montar();
  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
  expect(onConfirmar).toHaveBeenCalledOnce();
  expect(onCancelar).not.toHaveBeenCalled();
});

it('perigo usa o vermelho cheio; sem perigo, o azul', () => {
  montar({ perigo: true });
  expect(screen.getByRole('button', { name: 'Excluir' })).toHaveClass('botao-perigo-cheio');
});

it('sem perigo o botão é o primário', () => {
  montar({ rotuloConfirmar: 'Tornar real' });
  const botao = screen.getByRole('button', { name: 'Tornar real' });
  expect(botao).toHaveClass('botao-primario');
  expect(botao).not.toHaveClass('botao-perigo-cheio');
});

it('Cancelar é o botão com contorno', () => {
  montar();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveClass('botao-discreto');
});
```

- [ ] **Passo 2:** rode `npx vitest run src/ui/ConfirmarSheet.test.tsx`. Esperado: falha, o componente não existe.

- [ ] **Passo 3: componente.**

```tsx
// src/ui/ConfirmarSheet.tsx
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  /** A pergunta: "Excluir esta viagem?". */
  titulo: string;
  /** O item em questão, para o usuário ver o que vai mudar. */
  resumo?: ReactNode;
  /** O efeito, em uma frase. */
  apoio?: string;
  rotuloConfirmar: string;
  /** Verdadeiro quando a ação apaga: o botão fica vermelho. Falso quando só converte ou mescla. */
  perigo?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}

// Confirmação do próprio app, no lugar do window.confirm. Só para o que apaga em cascata ou
// não tem volta: exclusão simples apaga na hora e oferece "Desfazer" (docs/estilo/interacao.md).
export default function ConfirmarSheet({
  aberto, titulo, resumo, apoio, rotuloConfirmar, perigo = false, onCancelar, onConfirmar,
}: Props) {
  // Portal no body, pelo mesmo motivo do ConfirmarRepetidoSheet: aninhado num sheet, este
  // receberia o arrasto do sheet de fora e fecharia os dois.
  return createPortal(
    <Sheet
      aberto={aberto} onFechar={onCancelar} rotulo={titulo}
      cabecalho={<h2 style={{ margin: 0 }}>{titulo}</h2>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {resumo && <div className="item item-elevado">{resumo}</div>}
        {apoio && <p className="sub" style={{ margin: 0 }}>{apoio}</p>}
        <div className="acoes">
          <button type="button" className="botao botao-discreto" onClick={onCancelar}>Cancelar</button>
          <button
            type="button" className={`botao ${perigo ? 'botao-perigo-cheio' : 'botao-primario'}`}
            onClick={onConfirmar}
          >
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </Sheet>,
    document.body,
  );
}
```

- [ ] **Passo 4: CSS.** Em `src/styles.css`, logo depois da regra `.botao.ativo`:

```css
/* Ação que só sai da tela (Fechar, Cancelar ao lado da ação principal): contorno, sem fundo.
   box-shadow interno, e não border, para o botão manter o tamanho dos vizinhos. */
.botao-discreto { background: none; color: var(--fg); box-shadow: inset 0 0 0 1.5px var(--muted); }
/* Botão que apaga, só dentro do sheet de confirmação (ConfirmarSheet.tsx). */
.botao-perigo-cheio { background: var(--neg); color: var(--bg); }
/* Rodapé de botões de um sheet: a ação destrutiva à esquerda; `.empurra` joga o resto para a
   direita, com a ação principal por último. */
.sheet-botoes { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
.sheet-botoes .empurra { margin-left: auto; }
```

- [ ] **Passo 5: `ConfirmarRepetidoSheet`.** Na linha 32, troque `className="botao"` por `className="botao botao-discreto"` no botão Cancelar. Nada mais muda.

- [ ] **Passo 6: catálogo.** Em `docs/estilo/catalogo.md`, troque a linha de `.botao`, `.botao-primario`, `.botao-perigo` por:

```markdown
| `.botao`, `.botao-primario`, `.botao-perigo`, `.botao-discreto`, `.botao-perigo-cheio` | botão padrão / ação principal (azul, no máximo um por linha de botões) / ação destrutiva (texto vermelho) / ação que só sai da tela, como Fechar e Cancelar (contorno `--muted`, sem fundo) / botão que apaga dentro do `ConfirmarSheet` (fundo `--neg`). `.botao:disabled` fica a 45% de opacidade, em toda tela |
| `.sheet-botoes` (+ `.empurra`) | rodapé de botões de um sheet: a ação destrutiva fica à esquerda, e o primeiro botão com `.empurra` joga os demais para a direita, com a ação principal por último |
```

Na lista de componentes, antes de `ConfirmarRepetidoSheet.tsx`:

```markdown
- **`ConfirmarSheet.tsx`** — sheet de confirmação do próprio app, no lugar do `window.confirm`. Título em pergunta, resumo do item, uma frase de efeito, Cancelar e a ação. `perigo` deixa o botão vermelho. Só para o que apaga em cascata ou não tem volta; exclusão simples usa o "Desfazer" do `Retorno`.
```

- [ ] **Passo 7:** rode `npx vitest run src/ui/ConfirmarSheet.test.tsx src/ui/ConfirmarRepetidoSheet.test.tsx`, depois `node scripts/verificar-catalogo.mjs`, depois `npm test`. Esperado: tudo passa.

- [ ] **Passo 8: commit**

```bash
git add src/ui/ConfirmarSheet.tsx src/ui/ConfirmarSheet.test.tsx src/ui/ConfirmarRepetidoSheet.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "feat(ui): sheet de confirmação próprio e botão com contorno"
```

---

### Tarefa 4: Editor de lançamento — botões e excluir com Desfazer

**Arquivos:**
- Modificar: `src/ui/LancEditor.tsx` (linhas 18, 49-55 e 135-146)
- Testar: `src/ui/LancEditor.test.tsx` (os dois testes "excluir pede confirmação", linhas 92 e 115)

**Interfaces:**
- Consome: `repo.restaurarLancamento` (Tarefa 1); `avisar` do store (Tarefa 2); `.sheet-botoes`, `.empurra`, `.botao-discreto` (Tarefa 3).

- [ ] **Passo 1: troque os dois testes de confirmação por estes.** Mantenha a montagem de box e categoria que os testes atuais já fazem (linhas 93-101 e 116-124); só o trecho depois de `useApp.setState(...)` muda.

```tsx
it('excluir apaga na hora, fecha o editor e oferece Desfazer', async () => {
  // ...mesma montagem do teste antigo, com `lanc` efetivo de 5000...
  const onFechar = vi.fn();
  render(<LancEditor lanc={lanc} onFechar={onFechar} />);

  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

  await waitFor(() => expect(onFechar).toHaveBeenCalledOnce());
  expect(await db.lancamentos.get(lanc.id)).toBeUndefined();
  const retorno = useApp.getState().retorno!;
  expect(retorno.texto).toBe('Lançamento excluído');

  await retorno.desfazer!();
  expect(await db.lancamentos.get(lanc.id)).toEqual(lanc);
});

it('excluir um previsto diz "Previsto excluído"', async () => {
  // ...mesma montagem do teste antigo, com `previsto`...
  const onFechar = vi.fn();
  render(<LancEditor lanc={previsto} onFechar={onFechar} />);

  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

  await waitFor(() => expect(onFechar).toHaveBeenCalledOnce());
  expect(useApp.getState().retorno!.texto).toBe('Previsto excluído');
  expect(await db.lancamentos.get(previsto.id)).toBeUndefined();
});

it('o Desfazer devolve o lançamento como estava antes de qualquer edição não salva', async () => {
  // ...mesma montagem, com `lanc` efetivo de 5000 e nota 'feira'...
  render(<LancEditor lanc={lanc} onFechar={vi.fn()} />);
  await userEvent.clear(screen.getByLabelText('Nota'));
  await userEvent.type(screen.getByLabelText('Nota'), 'outra coisa');

  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
  await waitFor(() => expect(useApp.getState().retorno).not.toBeNull());
  await useApp.getState().retorno!.desfazer!();

  expect((await db.lancamentos.get(lanc.id))!.nota).toBe('feira');
});

it('lançamento: Salvar é a ação principal e Fechar tem contorno', async () => {
  // ...mesma montagem, com `lanc` efetivo...
  render(<LancEditor lanc={lanc} onFechar={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Salvar' })).toHaveClass('botao-primario');
  expect(screen.getByRole('button', { name: 'Fechar' })).toHaveClass('botao-discreto');
  expect(screen.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument();
});

it('previsto: Confirmar é a ação principal e Salvar deixa de ser', async () => {
  // ...mesma montagem, com `previsto`...
  render(<LancEditor lanc={previsto} onFechar={vi.fn()} />);
  expect(screen.getByRole('button', { name: /Confirmar/ })).toHaveClass('botao-primario');
  expect(screen.getByRole('button', { name: 'Salvar' })).not.toHaveClass('botao-primario');
});
```

Tire do arquivo todo `vi.spyOn(window, 'confirm')`. No `beforeEach`, acrescente `useApp.setState({ retorno: null });`.

- [ ] **Passo 2:** rode `npx vitest run src/ui/LancEditor.test.tsx`. Esperado: os testes novos falham.

- [ ] **Passo 3: implemente.** Em `src/ui/LancEditor.tsx`:

Linha 18:

```tsx
  const { dados, recarregar, avisar } = useApp();
```

Troque a função `excluir` inteira por:

```tsx
  // Sem confirmação: apaga um registro só, e o "Desfazer" o devolve idêntico (com o que
  // estava gravado, não com o que foi digitado e não salvo). Ver docs/estilo/interacao.md.
  async function excluir() {
    await repo.excluirLancamento(lanc.id);
    await recarregar();
    avisar(
      lanc.status === 'previsto' ? 'Previsto excluído' : 'Lançamento excluído',
      () => repo.restaurarLancamento(lanc),
    );
    onFechar();
  }
```

Logo antes do `return`, depois de `podeEscolherBanco`:

```tsx
  // Um azul por linha de botões: Confirmar quando existe; senão, Salvar.
  const podeConfirmar = lanc.status === 'previsto' && !doCenario;
  const podeSalvar = !previstoDeRecorrencia;
```

Troque o bloco `<div className="linha" style={{ marginTop: 12 }}> ... </div>` inteiro por:

```tsx
        <div className="sheet-botoes">
          {!parcelaDeRecorrenciaCenario && (
            <button className="botao botao-perigo" onClick={excluir}>Excluir</button>
          )}
          <button className="botao botao-discreto empurra" onClick={onFechar}>Fechar</button>
          {podeSalvar && (
            <button className={`botao${podeConfirmar ? '' : ' botao-primario'}`} onClick={() => aplicar(false)}>Salvar</button>
          )}
          {podeConfirmar && (
            <button className="botao botao-primario" onClick={() => aplicar(true)}>✓ Confirmar</button>
          )}
        </div>
```

- [ ] **Passo 4:** rode `npx vitest run src/ui/LancEditor.test.tsx`, depois `npm test`. Esperado: tudo passa. Outro teste que abria o editor e contava com o `window.confirm` (em `TelaFluxo.test.tsx`, por exemplo) falha aqui: corrija-o pelo mesmo padrão, sem recolocar o diálogo.

- [ ] **Passo 5: commit**

```bash
git add src/ui/LancEditor.tsx src/ui/LancEditor.test.tsx
git commit -m "feat(ui): editor de lançamento com ação principal em destaque e Desfazer"
```

---

### Tarefa 5: Descartar pendente e excluir item de cenário

**Arquivos:**
- Modificar: `src/ui/TelaHoje.tsx` (linha 436, função `descartar` na 544, chamada na 717)
- Modificar: `src/ui/ItemCenarioSheet.tsx` (função `excluir`, linha 47; botões, linha 59)
- Testar: `src/ui/TelaHoje.test.tsx` (teste da linha 746 e o seguinte), `src/ui/ItemCenarioSheet.test.tsx`

**Interfaces:**
- Consome: `repo.restaurarLancamento`, `avisar`, `ConfirmarSheet`.

- [ ] **Passo 1: testes do Hoje.** Troque os testes "descartar pede confirmação" por:

```tsx
  it('descartar tira o pendente da fila na hora e oferece Desfazer', async () => {
    // ...mesma montagem do teste antigo: box, categoria 'aluguel', um previsto em 2026-07-01, hoje 2026-07-02...
    render(<TelaHoje />);
    await userEvent.click(screen.getByRole('tab', { name: /Pendentes/ }));

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    await screen.findByText(/Nada a confirmar — tudo em dia./);
    expect(await db.lancamentos.get(previsto.id)).toBeUndefined();
    const retorno = useApp.getState().retorno!;
    expect(retorno.texto).toBe('Previsto descartado');

    await retorno.desfazer!();
    expect(await db.lancamentos.get(previsto.id)).toEqual(previsto);
  });
```

Tire os `vi.spyOn(window, 'confirm')` do arquivo. Acrescente `useApp.setState({ retorno: null });` ao `beforeEach`.

- [ ] **Passo 2: implemente no Hoje.** Linha 436:

```tsx
  const { dados, boxSel, hoje, recarregar, abrirAjustes, abrirFluxo, avisar } = useApp();
```

Função `descartar`:

```tsx
  async function descartar(l: Lancamento) {
    await repo.excluirLancamento(l.id);
    await recarregar();
    avisar('Previsto descartado', () => repo.restaurarLancamento(l));
  }
```

Chamada, no botão "Descartar": `onClick={() => descartar(l)}`.

- [ ] **Passo 3: testes do item de cenário.** Em `src/ui/ItemCenarioSheet.test.tsx`, troque o teste que usa `window.confirm` por dois. Aproveite a montagem que o arquivo já tem para um item "uma vez" e para um item com repetição:

```tsx
it('excluir item "uma vez" apaga na hora e oferece Desfazer', async () => {
  // ...montagem existente de um item com repeticao 'unica'...
  await userEvent.click(screen.getByRole('button', { name: 'Excluir item' }));

  await waitFor(() => expect(onFechar).toHaveBeenCalledOnce());
  expect(await db.lancamentos.get(item.id)).toBeUndefined();
  expect(useApp.getState().retorno!.texto).toBe('Item excluído');

  await useApp.getState().retorno!.desfazer!();
  expect(await db.lancamentos.get(item.id)).toBeDefined();
});

it('excluir item com repetição pede confirmação no sheet; Cancelar mantém', async () => {
  // ...montagem existente de um item com repetição...
  await userEvent.click(screen.getByRole('button', { name: 'Excluir item' }));

  const dialogo = await screen.findByRole('dialog', { name: 'Excluir este item do cenário?' });
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

  expect(onFechar).not.toHaveBeenCalled();
  expect(await db.recorrencias.get(item.id)).toBeDefined();
});

it('excluir item com repetição: confirmar apaga a regra', async () => {
  // ...mesma montagem...
  await userEvent.click(screen.getByRole('button', { name: 'Excluir item' }));
  const dialogo = await screen.findByRole('dialog', { name: 'Excluir este item do cenário?' });
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Excluir' }));

  await waitFor(() => expect(onFechar).toHaveBeenCalledOnce());
  expect(await db.recorrencias.get(item.id)).toBeUndefined();
});
```

Se o arquivo de teste não tiver a montagem de um item com repetição, crie-a com `repo.salvarRecorrencia`, copiando os campos que `FormItemCenario.tsx:43` usa.

- [ ] **Passo 4: implemente no item de cenário.** Em `src/ui/ItemCenarioSheet.tsx`:

Importe `useState` de `react` (se ainda não estiver), `ConfirmarSheet from './ConfirmarSheet'`, e pegue `avisar` e `dados` do store na mesma chamada de `useApp` que o componente já faz.

Troque a função `excluir` por:

```tsx
  const [confirmando, setConfirmando] = useState(false);

  // "Uma vez" é um lançamento só: apaga na hora, com Desfazer. Com repetição, o item é uma
  // regra e leva os previstos junto: pede confirmação.
  async function excluir() {
    if (item.repeticao !== 'unica') { setConfirmando(true); return; }
    const original = dados?.lancamentos.find((l) => l.id === item.id);
    await repo.excluirLancamento(item.id);
    await recarregar();
    avisar('Item excluído', original ? () => repo.restaurarLancamento(original) : undefined);
    onFechar();
  }

  async function excluirRegra() {
    setConfirmando(false);
    await repo.excluirRecorrencia(item.id);
    await recarregar();
    avisar('Item excluído');
    onFechar();
  }
```

Dentro do JSX, logo antes de `</Sheet>`:

```tsx
      <ConfirmarSheet
        aberto={confirmando} titulo="Excluir este item do cenário?"
        apoio="O item se repete: as parcelas dele saem da simulação."
        rotuloConfirmar="Excluir" perigo
        onCancelar={() => setConfirmando(false)} onConfirmar={excluirRegra}
      />
```

No botão "Fechar" (linha 61), troque `className="botao"` por `className="botao botao-discreto"`.

- [ ] **Passo 5:** rode `npx vitest run src/ui/TelaHoje.test.tsx src/ui/ItemCenarioSheet.test.tsx`, depois `npm test`. Esperado: tudo passa.

- [ ] **Passo 6: commit**

```bash
git add src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx src/ui/ItemCenarioSheet.tsx src/ui/ItemCenarioSheet.test.tsx
git commit -m "feat(ui): descartar pendente e excluir item de cenário com Desfazer"
```

---

### Tarefa 6: Confirmações em `src/ui/` (quatro arquivos, cinco pontos)

**Arquivos:**
- Modificar: `src/ui/TransferenciaSheet.tsx:27`, `src/ui/FormCompra.tsx:215`, `src/ui/CartaoSimples.tsx:84`, `src/ui/CenarioCard.tsx:47` e `:52`
- Testar: `TransferenciaSheet.test.tsx`, `TelaCartao.test.tsx`, `CartaoSimples.test.tsx`, `SimuladorFluxo.test.tsx`

**Interfaces:**
- Consome: `ConfirmarSheet` (Tarefa 3), `avisar` (Tarefa 2).

**O padrão, igual nos cinco pontos.** A função que hoje começa com `if (!window.confirm(...)) return;` se divide em duas: a que abre o sheet e a que age. O estado é um `useState` do componente.

- [ ] **Passo 1: `TransferenciaSheet.tsx`**

```tsx
  const [confirmando, setConfirmando] = useState(false);

  async function excluir() {
    if (!lanc.transferenciaId) return;
    setConfirmando(false);
    await repo.excluirTransferencia(lanc.transferenciaId);
    await recarregar();
    avisar('Transferência excluída');
    onFechar();
  }
```

O botão que chamava `excluir` passa a chamar `() => setConfirmando(true)`. Antes de `</Sheet>`:

```tsx
      <ConfirmarSheet
        aberto={confirmando} titulo="Excluir esta transferência?"
        apoio="Os dois lançamentos serão apagados."
        rotuloConfirmar="Excluir" perigo
        onCancelar={() => setConfirmando(false)} onConfirmar={excluir}
      />
```

- [ ] **Passo 2: `FormCompra.tsx`**

```tsx
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  async function excluir() {
    if (!compra) return;
    setConfirmandoExclusao(false);
    await repo.excluirCompraCartao(compra.id, horizonte);
    await recarregar();
    avisar('Compra excluída');
    onFechar();
  }
```

O botão "Excluir" da compra passa a chamar `() => setConfirmandoExclusao(true)`. No fim do fragmento que o componente devolve:

```tsx
      <ConfirmarSheet
        aberto={confirmandoExclusao} titulo="Excluir esta compra?"
        apoio="Todas as parcelas dela saem das faturas."
        rotuloConfirmar="Excluir" perigo
        onCancelar={() => setConfirmandoExclusao(false)} onConfirmar={excluir}
      />
```

- [ ] **Passo 3: `CartaoSimples.tsx`**

```tsx
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const efeitoDaRemocao = compras.length > 0 ? 'A fatura volta à soma das compras.' : 'Sem compras, a fatura sai do Fluxo.';

  // Apagar o valor pode perder um valor do banco vindo do Avançado: pede confirmação, como as outras ações destrutivas.
  async function removerValor() {
    if (ocupadoRef.current) return;
    setConfirmandoRemocao(false);
    ocupadoRef.current = true;
    try {
      await repo.removerConferenciaFatura(cartao.id, mes, horizonte);
      setCents(null);
      await recarregar();
      avisar('Valor da fatura removido');
    } finally {
      ocupadoRef.current = false;
    }
  }
```

Confira o `finally` contra o que o arquivo tem hoje e mantenha o que já estava lá dentro. O botão "Remover valor" passa a chamar `() => setConfirmandoRemocao(true)`. Junto do JSX do componente:

```tsx
      <ConfirmarSheet
        aberto={confirmandoRemocao} titulo="Remover o valor informado desta fatura?"
        apoio={efeitoDaRemocao}
        rotuloConfirmar="Remover" perigo
        onCancelar={() => setConfirmandoRemocao(false)} onConfirmar={removerValor}
      />
```

- [ ] **Passo 4: `CenarioCard.tsx`** (dois pontos)

```tsx
  const [confirmando, setConfirmando] = useState<'real' | 'excluir' | null>(null);
  const temPassado = dados!.lancamentos.some((l) => l.cenarioId === cenario.id && l.data <= hoje);

  async function tornarReal() {
    setConfirmando(null);
    await repo.converterCenarioEmReal(cenario.id);
    await recarregar();
    avisar('Cenário convertido em lançamentos reais');
  }
  async function excluir() {
    setConfirmando(null);
    await repo.excluirCenario(cenario.id);
    await recarregar();
    avisar('Cenário excluído');
  }
```

Mantenha, depois de `repo.excluirCenario` e de `repo.converterCenarioEmReal`, qualquer linha que as funções atuais tenham além de `recarregar()`. Os botões "Tornar real" e "Excluir cenário" passam a chamar `() => setConfirmando('real')` e `() => setConfirmando('excluir')`. No JSX:

```tsx
      <ConfirmarSheet
        aberto={confirmando === 'real'} titulo={`Converter "${cenario.nome}" em lançamentos reais?`}
        apoio={temPassado ? 'Itens com data já passada vão para os Pendentes, em Hoje.' : undefined}
        rotuloConfirmar="Tornar real"
        onCancelar={() => setConfirmando(null)} onConfirmar={tornarReal}
      />
      <ConfirmarSheet
        aberto={confirmando === 'excluir'} titulo={`Excluir o cenário "${cenario.nome}"?`}
        apoio="Os itens dele são apagados junto."
        rotuloConfirmar="Excluir" perigo
        onCancelar={() => setConfirmando(null)} onConfirmar={excluir}
      />
```

Em cada um dos quatro arquivos: importe `ConfirmarSheet from './ConfirmarSheet'`, `useState` se faltar, e pegue `avisar` do store na chamada de `useApp` que o componente já faz.

- [ ] **Passo 5: testes.** Em cada arquivo de teste listado, para cada `vi.spyOn(window, 'confirm')`:

- Onde o espião devolvia `true`: tire o espião; depois do clique que abre a confirmação, clique no botão do sheet.
- Onde devolvia `false`: tire o espião; clique em "Cancelar" no sheet e mantenha as asserções de "nada mudou".
- Onde o teste conferia o texto do `confirm`: confira o nome do diálogo.

Use este auxiliar, no topo de cada arquivo de teste que precisar:

```tsx
async function responderNoSheet(titulo: string | RegExp, botao: string) {
  const dialogo = await screen.findByRole('dialog', { name: titulo });
  await userEvent.click(within(dialogo).getByRole('button', { name: botao }));
}
```

Títulos e botões, para os testes:

| Arquivo | Título do diálogo | Botão que confirma |
|---|---|---|
| `TransferenciaSheet` | `Excluir esta transferência?` | `Excluir` |
| `FormCompra` (testado por `TelaCartao.test.tsx`) | `Excluir esta compra?` | `Excluir` |
| `CartaoSimples` | `Remover o valor informado desta fatura?` | `Remover` |
| `CenarioCard` (testado por `SimuladorFluxo.test.tsx`) | `/^Converter ".+" em lançamentos reais\?$/` | `Tornar real` |
| `CenarioCard` | `/^Excluir o cenário ".+"\?$/` | `Excluir` |

Acrescente, em cada arquivo, um teste de caso-limite que ainda não exista: **tocar duas vezes no botão de abrir não abre dois diálogos** (`expect(screen.getAllByRole('dialog', { name: titulo })).toHaveLength(1)`), e, no `CenarioCard`, **o apoio sobre Pendentes só aparece quando há item com data passada**.

- [ ] **Passo 6:** rode `npx vitest run src/ui/TransferenciaSheet.test.tsx src/ui/TelaCartao.test.tsx src/ui/CartaoSimples.test.tsx src/ui/SimuladorFluxo.test.tsx`, depois `npm test`. Esperado: tudo passa.

- [ ] **Passo 7: commit**

```bash
git add src/ui/TransferenciaSheet.tsx src/ui/FormCompra.tsx src/ui/CartaoSimples.tsx src/ui/CenarioCard.tsx src/ui/*.test.tsx
git commit -m "feat(ui): confirmação própria em transferência, compra, fatura e cenário"
```

---

### Tarefa 7: Confirmações em Ajustes (cinco arquivos)

**Arquivos:**
- Modificar: `src/ui/ajustes/Bancos.tsx:107`, `Recorrencias.tsx:195`, `Assinaturas.tsx:164`, `Viagens.tsx:103`, `Backup.tsx:57`
- Testar: `src/ui/ajustes/Bancos.test.tsx`, `Viagens.test.tsx`, `Backup.test.tsx`; crie o teste que faltar para `Recorrencias` e `Assinaturas` no arquivo de teste de cada um (se não existir, crie `Recorrencias.test.tsx` e `Assinaturas.test.tsx` seguindo a montagem de `Viagens.test.tsx`)

**Interfaces:**
- Consome: `ConfirmarSheet` (Tarefa 3), `avisar` (Tarefa 2).

Em cada lista de Ajustes, o botão de excluir recebe o `id` do item. O estado guarda esse `id`.

- [ ] **Passo 1: `Bancos.tsx`**

```tsx
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  async function excluir() {
    const id = excluindoId;
    if (!id) return;
    setExcluindoId(null);
    await repo.excluirBanco(id);
    await repo.sincronizarCartoes(dados!.config.horizonteProjecao);
    await recarregar();
    avisar('Banco excluído');
  }
```

O botão de excluir de cada banco passa de `() => excluir(b.id)` para `() => setExcluindoId(b.id)` (use o nome de variável que o `map` do arquivo já usa). No fim do JSX da tela:

```tsx
      <ConfirmarSheet
        aberto={excluindoId != null} titulo="Excluir este banco?"
        resumo={<span className="cresce">{bancos.find((b) => b.id === excluindoId)?.nome}</span>}
        apoio="Os cartões, os lançamentos e as recorrências dele ficam sem banco. Nada é apagado."
        rotuloConfirmar="Excluir" perigo
        onCancelar={() => setExcluindoId(null)} onConfirmar={excluir}
      />
```

`bancos` é a lista que a tela já mostra; use o nome que o arquivo usa.

- [ ] **Passo 2: `Recorrencias.tsx`** — mesmo desenho, com:

```tsx
  async function excluir() {
    const id = excluindoId;
    if (!id) return;
    setExcluindoId(null);
    await repo.excluirRecorrencia(id);
    await recarregar();
    avisar('Recorrência excluída');
  }
```

```tsx
      <ConfirmarSheet
        aberto={excluindoId != null} titulo="Excluir esta recorrência?"
        apoio="Os previstos dela são apagados. Os lançamentos já confirmados são mantidos."
        rotuloConfirmar="Excluir" perigo
        onCancelar={() => setExcluindoId(null)} onConfirmar={excluir}
      />
```

- [ ] **Passo 3: `Assinaturas.tsx`**

```tsx
  async function excluir() {
    const id = excluindoId;
    if (!id) return;
    setExcluindoId(null);
    await repo.excluirAssinatura(id, horizonte);
    await recarregar();
    avisar('Assinatura excluída');
  }
```

```tsx
      <ConfirmarSheet
        aberto={excluindoId != null} titulo="Excluir esta assinatura?"
        apoio="As compras futuras dela são apagadas. As passadas são mantidas."
        rotuloConfirmar="Excluir" perigo
        onCancelar={() => setExcluindoId(null)} onConfirmar={excluir}
      />
```

- [ ] **Passo 4: `Viagens.tsx`**

```tsx
  async function excluir() {
    const id = excluindoId;
    if (!id) return;
    setExcluindoId(null);
    await repo.excluirViagem(id);
    await recarregar();
    avisar('Viagem excluída');
  }
```

```tsx
      <ConfirmarSheet
        aberto={excluindoId != null} titulo="Excluir esta viagem?"
        apoio="Os lançamentos e as compras marcados continuam existindo; só perdem a marcação de viagem."
        rotuloConfirmar="Excluir" perigo
        onCancelar={() => setExcluindoId(null)} onConfirmar={excluir}
      />
```

- [ ] **Passo 5: `Backup.tsx`.** Antes de mexer, leia `src/backup/CLAUDE.md`. Aqui a confirmação fica entre a escolha do arquivo e a restauração. O arquivo escolhido fica em estado até a resposta:

```tsx
  const [arquivoPendente, setArquivoPendente] = useState<File | null>(null);
```

A função que hoje é `restaurar(file)` perde as quatro primeiras linhas (a montagem do `aviso` e o `window.confirm`) e passa a ser chamada só pela confirmação:

```tsx
  async function restaurar(file: File) {
    setArquivoPendente(null);
    try {
      // ...o corpo atual, a partir de `const backup = validarBackup(...)`, sem mudança...
```

Quem hoje chama `restaurar(file)` ao escolher o arquivo passa a chamar `setArquivoPendente(file)`. No JSX:

```tsx
      <ConfirmarSheet
        aberto={arquivoPendente != null}
        titulo={modo === 'substituir' ? 'Substituir todos os dados pelo backup?' : 'Mesclar o backup com os dados atuais?'}
        resumo={<span className="cresce">{arquivoPendente?.name}</span>}
        apoio={modo === 'substituir'
          ? 'Tudo o que está no app hoje é apagado e trocado pelo conteúdo do arquivo.'
          : 'O que está no arquivo entra junto com o que já está no app.'}
        rotuloConfirmar={modo === 'substituir' ? 'Substituir' : 'Mesclar'}
        perigo={modo === 'substituir'}
        onCancelar={() => setArquivoPendente(null)}
        onConfirmar={() => { if (arquivoPendente) void restaurar(arquivoPendente); }}
      />
```

O nome do arquivo de backup aparece só na tela, nunca em arquivo versionado. As mensagens de sucesso e de erro da restauração (`setMsg`) continuam como estão: são mais ricas que um aviso de retorno.

- [ ] **Passo 6: testes.** Para cada `vi.spyOn(window, 'confirm')` de `Bancos.test.tsx`, `Viagens.test.tsx` e `Backup.test.tsx`, aplique a mesma troca da Tarefa 6, com o mesmo auxiliar:

```tsx
async function responderNoSheet(titulo: string | RegExp, botao: string) {
  const dialogo = await screen.findByRole('dialog', { name: titulo });
  await userEvent.click(within(dialogo).getByRole('button', { name: botao }));
}
```

| Tela | Título | Botão que confirma |
|---|---|---|
| Bancos | `Excluir este banco?` | `Excluir` |
| Recorrências | `Excluir esta recorrência?` | `Excluir` |
| Assinaturas | `Excluir esta assinatura?` | `Excluir` |
| Viagens | `Excluir esta viagem?` | `Excluir` |
| Backup, substituir | `Substituir todos os dados pelo backup?` | `Substituir` |
| Backup, mesclar | `Mesclar o backup com os dados atuais?` | `Mesclar` |

Testes novos obrigatórios, um por tela: **Cancelar não apaga** (o registro continua no banco) e **confirmar apaga e avisa** (`useApp.getState().retorno!.texto`). No Backup: **Cancelar não restaura nada** (a contagem de lançamentos do banco é a mesma de antes) e **"Substituir" é vermelho, "Mesclar" é azul** (`toHaveClass`).

- [ ] **Passo 7:** rode `npx vitest run src/ui/ajustes`, depois `npm test`. Esperado: tudo passa.

- [ ] **Passo 8: commit**

```bash
git add src/ui/ajustes/
git commit -m "feat(ajustes): confirmação própria em bancos, recorrências, assinaturas, viagens e backup"
```

---

### Tarefa 8: Trava contra diálogo nativo

**Arquivos:**
- Criar: `src/ui/semDialogoNativo.test.ts`

- [ ] **Passo 1: escreva o teste**

```ts
// src/ui/semDialogoNativo.test.ts
import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

// O app não usa window.confirm, alert nem prompt: a confirmação é o ConfirmarSheet e o aviso
// é o Retorno (docs/estilo/interacao.md). Este teste impede que voltem.
const RAIZ = path.resolve('src');
const DIALOGO = /(?<![.\w])(?:window\.)?(confirm|alert|prompt)\s*\(/;

function fontes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = path.join(dir, e.name);
    if (e.isDirectory()) return fontes(caminho);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [caminho] : [];
  });
}

it('nenhum arquivo de src/ abre diálogo nativo do navegador', () => {
  const achados = fontes(RAIZ).flatMap((arquivo) =>
    fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)
      .map((linha, i) => ({ linha, n: i + 1 }))
      .filter(({ linha }) => DIALOGO.test(linha) && !linha.trim().startsWith('//') && !linha.trim().startsWith('*'))
      .map(({ n }) => `${path.relative(RAIZ, arquivo)}:${n}`));

  expect(achados).toEqual([]);
});

it('a expressão pega as três formas e não pega nomes parecidos', () => {
  expect(DIALOGO.test("if (!window.confirm('x')) return;")).toBe(true);
  expect(DIALOGO.test("alert('x')")).toBe(true);
  expect(DIALOGO.test('const r = prompt("x")')).toBe(true);
  expect(DIALOGO.test('await repo.confirmarPendente(id)')).toBe(false);
  expect(DIALOGO.test('function confirmar() {')).toBe(false);
  expect(DIALOGO.test('onConfirmar()')).toBe(false);
});
```

- [ ] **Passo 2:** rode `npx vitest run src/ui/semDialogoNativo.test.ts`. Esperado: passa. Se o primeiro teste falhar, ele lista o `arquivo:linha` que sobrou: volte à tarefa daquele arquivo. Prove que a trava funciona: escreva `window.confirm('x')` numa linha de `src/ui/Shell.tsx`, rode, veja falhar, e desfaça com `git checkout src/ui/Shell.tsx`.

- [ ] **Passo 3:** confira que não sobrou espião de `confirm` em teste nenhum.

Rode: `grep -rn "window, 'confirm'\|window.confirm" src`
Esperado: só as linhas de `semDialogoNativo.test.ts`.

- [ ] **Passo 4: commit**

```bash
git add src/ui/semDialogoNativo.test.ts
git commit -m "test(ui): impede a volta do diálogo nativo do navegador"
```

---

### Tarefa 9: Wiki, changelog, dossiê e varredura

**Arquivos:**
- Modificar: `docs/wiki/6-telas.md` (linhas 17, 71, 82 e 85)
- Criar: `changelog.d/alterado-confirmacao-propria.md`

- [ ] **Passo 1: wiki.** Em `docs/wiki/6-telas.md`:

- Linha 17 (Pendentes): depois de "com confirmar (✓) ou descartar (✕) em um toque", acrescente a frase: "Descartar tira o item na hora; um aviso acima da barra oferece Desfazer por alguns segundos."
- Linha 71 (editor): depois de "abre o editor (valor, data, categoria, banco, nota)", acrescente: "O botão em azul é a ação principal: Salvar num lançamento, Confirmar num previsto. Excluir fica à esquerda e apaga na hora; um aviso oferece Desfazer por alguns segundos."
- Linha 82 (cenário): troque "os dois com confirmação" por "os dois pedem confirmação numa janela do próprio app, que diz o que vai acontecer".
- Na mesma página, onde a wiki fala de excluir transferência, compra, banco, recorrência, assinatura ou viagem "com confirmação", o texto continua certo. Não invente seção nova.

Valide: `npx vitest run src/ui/ajustes/capitulos.test.ts`. Esperado: passa. O parser aceita um subconjunto fechado de markdown: não use negrito novo nem lista aninhada.

- [ ] **Passo 1b: capítulo de interação.** Os comentários do código deste plano apontam para `docs/estilo/interacao.md`. Crie o arquivo:

```markdown
# Interação — confirmar, avisar e ordenar botões

Referência transversal, como `transversais.md`: vale em qualquer nível de edição. Leia antes de criar um botão que grava ou apaga.

## Confirmar

1. O app nunca usa `window.confirm`, `window.alert` nem `window.prompt`. O teste `src/ui/semDialogoNativo.test.ts` bloqueia.
2. **Exclusão simples apaga na hora e oferece "Desfazer".** É simples quando apaga um registro só e o registro pode voltar idêntico. Chame `avisar(texto, desfazer)`.
3. **Exclusão em cascata, ou sem volta, pede confirmação no `ConfirmarSheet`.** Vale para o que apaga mais de um registro, muda outros registros, ou troca os dados todos.
4. No `ConfirmarSheet`: o título é a pergunta; o resumo mostra o item; o apoio diz o efeito em uma frase. O botão que apaga usa `perigo`. O que converte ou mescla fica azul.

## Avisar

5. **Toda gravação dá retorno**, pelo `Retorno`: `avisar('Alteração salva')`. Frase curta, no passado, sem ponto final.
6. O aviso some sozinho: 3 s, ou 6 s quando tem "Desfazer". Um aviso novo substitui o anterior, e o "Desfazer" do anterior deixa de existir.
7. O retorno não substitui o aviso de validação. Erro de preenchimento continua abaixo do botão, em `.aviso`.

## Ordenar botões

8. Numa linha de botões há no máximo um azul (`.botao-primario`): a ação que o usuário veio fazer.
9. A ação que só sai da tela, como Fechar e Cancelar, tem contorno e não tem fundo (`.botao-discreto`).
10. A ação destrutiva fica à esquerda, longe da principal (`.sheet-botoes` com `.empurra`). A principal é sempre a última à direita.

## Onde está aplicado

As regras 1 a 4 e 8 a 10 valem no editor de lançamento e em todas as confirmações desde a entrega da confirmação própria. A regra 5 e a regra 9 chegam às demais telas na entrega seguinte (`docs/superpowers/plans/2026-11-15-d2-retorno-ao-salvar.md`). Ao tocar numa tela que ainda não as segue, alinhe-a.
```

Em `docs/estilo-visual.md`, na lista "Referências (não são níveis)", acrescente:

```markdown
- [`interacao.md`](estilo/interacao.md) — confirmar, avisar e ordenar botões. Leia antes de criar um botão que grava ou apaga.
```

Em `docs/README.md`, acrescente o capítulo ao mapa, no mesmo formato das outras linhas de `docs/estilo/`.

- [ ] **Passo 2: fragmento de changelog.**

```markdown
- Confirmações com o visual do app, no lugar da janela do navegador.
  - A janela mostra o que vai ser apagado e o efeito, antes de você confirmar.
- Excluir um lançamento ou descartar um pendente agora é imediato, com Desfazer por alguns segundos.
- Editor de lançamento com a ação principal em azul e Excluir separado, à esquerda.
```

Confira o formato em `changelog.d/README.md`: dois níveis, sem negrito.

- [ ] **Passo 3: dossiê.** Rode `npm run dossie`. Se `docs/dossie/` mudou, commite a regeneração e invoque a skill `revisar-dossie`.

- [ ] **Passo 4: varredura.** Com o roteiro do plano C, mais um arquivo de passos na pasta de rascunho:

```js
// passos-d1.mjs
export const passos = [
  { nome: 'd1-editor-lancamento', ir: async (p, a) => { await a.aba('Fluxo'); await p.locator('main .item').filter({ hasText: 'Feira 1' }).first().click(); }, sair: async (p) => { await p.keyboard.press('Escape'); } },
  { nome: 'd1-excluir-desfazer', ir: async (p, a) => { await a.aba('Fluxo'); await p.locator('main .item').filter({ hasText: 'Feira 2' }).first().click(); await p.getByRole('button', { name: 'Excluir' }).click(); await p.getByText('Lançamento excluído').waitFor(); } },
  { nome: 'd1-descartar', ir: async (p, a) => { await a.aba('Hoje'); await a.pilula(/Pendentes/); await p.getByRole('button', { name: 'Descartar' }).first().click(); await p.getByText('Previsto descartado').waitFor(); } },
];
```

Rode: `node <worktree>/scripts/varredura/varredura.mjs http://localhost:5199/ --extra passos-d1.mjs`
Esperado: código de saída 0, nenhum achado do tipo `dialogo-nativo`, e as capturas novas. Fotografe também, à mão, um `ConfirmarSheet` (Ajustes › Viagens › excluir) e o editor de um previsto. Envie as capturas ao usuário.

Confira nas capturas, contra o mockup aprovado: a linha de botões do editor cabe em uma linha a 411 px; o aviso de retorno não cobre a barra de navegação; o sheet de confirmação mostra o resumo.

- [ ] **Passo 5: commit**

```bash
git add docs/wiki/6-telas.md docs/estilo/interacao.md docs/estilo-visual.md docs/README.md changelog.d/alterado-confirmacao-propria.md docs/dossie
git commit -m "docs: confirmação própria e Desfazer na wiki, no guia e no changelog"
```

---

## Encerramento

- [ ] `npm test` inteiro verde; `node scripts/verificar-catalogo.mjs --strict` com saída 0.
- [ ] `grep -rn "window.confirm" src` só acha o teste da trava.
- [ ] Mostre o fragmento de changelog ao usuário (não espera resposta).
- [ ] `TODO.md`: o item "Confirmação própria e retorno ao salvar" fica parcial, apontando para o plano D2.
- [ ] Skill `ciclo-de-entrega`: merge, release `minor`, push, deploy. O release roda no PC do usuário (plano A).
- [ ] `git -C <checkout principal> status --porcelain` vazio.

## Fora do escopo (fica para o plano D2)

- Aviso de retorno nos salvamentos que não são exclusão.
- Contorno nos demais botões Cancelar e Fechar.
