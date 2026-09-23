# Rodapé de backup na Hoje — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar o progresso.

**Objetivo:** um indicador de backup sempre visível no rodapé da aba Visão, em três estados (neutro, âmbar, vermelho), no lugar do aviso condicional do topo — com Ajustes → Backup dizendo a mesma coisa.

**Arquitetura:** uma função pura nova, `estadoBackup`, em `src/domain/estadoBackup.ts`, decide o nível e a idade em dias de calendário. `TelaHoje` e `Backup.tsx` só montam a frase a partir dela. Três classes CSS novas, com tokens existentes.

**Stack:** React 18 + TypeScript, Vitest + Testing Library (jsdom, fake-indexeddb).

**Spec:** `docs/superpowers/specs/2026-09-23-saldo-dia-futuro-e-rodape-backup-design.md`, parte B.

## Restrições globais

- Todo texto de UI, teste, commit e doc em português.
- Nenhuma dependência nova. Não mexer em `scripts/`, `vite.config.ts`, `tsconfig.json`, scripts do `package.json` nem `.claude/`.
- Não editar `"version"` do `package.json` nem o topo do `CHANGELOG.md` — só fragmento em `changelog.d/`.
- Dados sintéticos em testes e mockup.
- Textos exatos: `Último backup: ` + `hoje` / `ontem` / `há N dias` / `nunca`; sufixo ` · há mudanças não salvas em backup`.
- Limite do vermelho: **7 dias de calendário ou mais**, contados entre a data local de `ultimoBackupEm` e `hoje` do store.
- Classes CSS: `.backup-rodape`, `.backup-rodape-neutro`, `.aviso-urgente` — nunca um modificador só composto (`.aviso.urgente`): o `verificar-catalogo.mjs --strict` não o enxerga e bloqueia o release.
- Não aperte timeouts nem passe `{ timeout }` a `findBy*`.

## Arquivos

- Criar: `src/domain/estadoBackup.ts` — nível e idade do backup.
- Criar: `src/domain/estadoBackup.test.ts`.
- Modificar: `src/ui/TelaHoje.tsx` — sai o aviso do topo (`SETE_DIAS_MS`, `backupVelho`), entra o rodapé na Visão.
- Modificar: `src/ui/TelaHoje.test.tsx` — o teste do aviso antigo vira testes do rodapé.
- Modificar: `src/ui/ajustes/Backup.tsx:72-75` — mesma idade relativa.
- Modificar: `src/ui/ajustes/Backup.test.tsx`.
- Modificar: `src/styles.css` — `.aviso-urgente` logo depois de `.aviso`; `.backup-rodape` e `.backup-rodape-neutro` no bloco da Hoje.
- Modificar: `docs/estilo/catalogo.md`.
- Modificar: `docs/wiki/6-telas.md:14`, `docs/wiki/1-primeiros-passos.md:84`, `docs/wiki/7-ajustes.md` (seção Backup).
- Criar: `changelog.d/alterado-rodape-backup.md`.
- Regenerar: `docs/dossie/` se o texto capturado da Hoje mudar.

---

### Tarefa 0: worktree e mockup aprovado

- [ ] **Passo 1: criar o worktree a partir da `main`** (depois do merge do branch `spec-fluxo-backup`; se o item 8 já tiver entrado, parte dele também)

```bash
git -C /c/Users/eitor/Claude/ProjetoFinancas worktree add .worktrees/rodape-backup -b rodape-backup main
cd /c/Users/eitor/Claude/ProjetoFinancas/.worktrees/rodape-backup && npm ci
```

- [ ] **Passo 2: ler o guia** — `docs/estilo-visual.md`, `docs/estilo/nivel-2-nova-classe.md` e `docs/estilo/fundamentos.md`.

- [ ] **Passo 3: montar o mockup HTML** no scratchpad (`mockup-rodape-backup.html`), com `<meta charset="utf-8">` na primeira linha e as cores de `:root` copiadas de `src/styles.css`. Três quadros da aba Visão, com o card de saldo sintético em cima e o rodapé embaixo:
  1. Neutro: `Último backup: há 3 dias`.
  2. Âmbar: `Último backup: há 3 dias · há mudanças não salvas em backup`.
  3. Vermelho: `Último backup: há 12 dias · há mudanças não salvas em backup`.
  E um quarto quadro com a linha nova de Ajustes → Backup: `Último backup: há 3 dias (22/09/2026, 19:46)`.
  Inclua um seletor de cor ao vivo para o fundo e o texto do estado vermelho, partindo de `--neg-bg`/`--neg`.

- [ ] **Passo 4: mostrar o mockup** — abrir no navegador do PC **e** mandar no chat com SendUserFile.

- [ ] **Passo 5: parar e esperar a aprovação.** Silêncio não é aprovação. Se a aprovação trouxer uma cor fora dos tokens, a tarefa vira nível 3 (token novo) — pare e leia `docs/estilo/nivel-3-novo-token.md` antes de seguir.

---

### Tarefa 1: função pura `estadoBackup`

**Arquivos:**
- Criar: `src/domain/estadoBackup.ts`
- Teste: `src/domain/estadoBackup.test.ts`

**Interfaces:**
- Consome: `hojeISO(agora?: Date): ISODate` e `diasEntre(inicio, fim): ISODate[]` de `src/domain/dates.ts`; o tipo `Config` de `src/domain/types.ts`.
- Produz:
  ```ts
  export type NivelBackup = 'neutro' | 'aviso' | 'urgente';
  export interface EstadoBackup { nivel: NivelBackup; idade: string }
  export const DIAS_BACKUP_URGENTE = 7;
  export const SUFIXO_MUDANCAS_BACKUP = ' · há mudanças não salvas em backup';
  export function estadoBackup(
    config: Pick<Config, 'ultimoBackupEm' | 'mudancasDesdeBackup'>, hoje: ISODate,
  ): EstadoBackup;
  ```

- [ ] **Passo 1: escrever os testes que falham** em `src/domain/estadoBackup.test.ts`:

```ts
import { estadoBackup } from './estadoBackup';

/** Timestamp de um horário local — independente do fuso da máquina que roda o teste. */
function local(ano: number, mes: number, dia: number, hora = 12, minuto = 0): string {
  return new Date(ano, mes - 1, dia, hora, minuto).toISOString();
}

const HOJE = '2026-07-26';

describe('estadoBackup', () => {
  it('nunca feito e sem mudanças é neutro', () => {
    expect(estadoBackup({ ultimoBackupEm: null, mudancasDesdeBackup: false }, HOJE))
      .toEqual({ nivel: 'neutro', idade: 'nunca' });
  });

  it('nunca feito e com mudanças é urgente', () => {
    expect(estadoBackup({ ultimoBackupEm: null, mudancasDesdeBackup: true }, HOJE))
      .toEqual({ nivel: 'urgente', idade: 'nunca' });
  });

  it('feito hoje, com mudanças, é aviso', () => {
    expect(estadoBackup({ ultimoBackupEm: local(2026, 7, 26, 9), mudancasDesdeBackup: true }, HOJE))
      .toEqual({ nivel: 'aviso', idade: 'hoje' });
  });

  it('feito ontem às 23:50 conta como ontem, não como hoje', () => {
    expect(estadoBackup({ ultimoBackupEm: local(2026, 7, 25, 23, 50), mudancasDesdeBackup: false }, HOJE))
      .toEqual({ nivel: 'neutro', idade: 'ontem' });
  });

  it('6 dias com mudanças ainda é aviso', () => {
    expect(estadoBackup({ ultimoBackupEm: local(2026, 7, 20), mudancasDesdeBackup: true }, HOJE))
      .toEqual({ nivel: 'aviso', idade: 'há 6 dias' });
  });

  it('7 dias com mudanças é urgente', () => {
    expect(estadoBackup({ ultimoBackupEm: local(2026, 7, 19), mudancasDesdeBackup: true }, HOJE))
      .toEqual({ nivel: 'urgente', idade: 'há 7 dias' });
  });

  it('30 dias sem mudanças continua neutro', () => {
    expect(estadoBackup({ ultimoBackupEm: local(2026, 6, 26), mudancasDesdeBackup: false }, HOJE))
      .toEqual({ nivel: 'neutro', idade: 'há 30 dias' });
  });

  it('data de backup ilegível é tratada como nunca feito', () => {
    expect(estadoBackup({ ultimoBackupEm: 'lixo', mudancasDesdeBackup: true }, HOJE))
      .toEqual({ nivel: 'urgente', idade: 'nunca' });
  });

  it('backup com data depois de hoje (relógio adiantado) conta como hoje', () => {
    expect(estadoBackup({ ultimoBackupEm: local(2026, 7, 28), mudancasDesdeBackup: true }, HOJE))
      .toEqual({ nivel: 'aviso', idade: 'hoje' });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/domain/estadoBackup.test.ts`
Expected: FAIL — "Failed to resolve import './estadoBackup'".

- [ ] **Passo 3: implementar** `src/domain/estadoBackup.ts`:

```ts
import { diasEntre, hojeISO } from './dates';
import type { Config, ISODate } from './types';

export type NivelBackup = 'neutro' | 'aviso' | 'urgente';

export interface EstadoBackup {
  nivel: NivelBackup;
  /** "hoje", "ontem", "há N dias" ou "nunca" — completa a frase "Último backup: …". */
  idade: string;
}

/** Dias de calendário a partir dos quais um backup com mudanças pendentes fica urgente. */
export const DIAS_BACKUP_URGENTE = 7;

/** Mesmo texto na Hoje e em Ajustes → Backup. */
export const SUFIXO_MUDANCAS_BACKUP = ' · há mudanças não salvas em backup';

/** Idade e nível do último backup. A idade é contada em dias de calendário entre a data
 *  local do backup e `hoje` — não em horas —, para o texto e o limite do vermelho usarem a
 *  mesma régua. */
export function estadoBackup(
  config: Pick<Config, 'ultimoBackupEm' | 'mudancasDesdeBackup'>,
  hoje: ISODate,
): EstadoBackup {
  const ms = config.ultimoBackupEm ? Date.parse(config.ultimoBackupEm) : Number.NaN;
  if (Number.isNaN(ms)) {
    return { nivel: config.mudancasDesdeBackup ? 'urgente' : 'neutro', idade: 'nunca' };
  }
  const dataBackup = hojeISO(new Date(ms));
  // diasEntre devolve [] quando o backup é depois de hoje (relógio adiantado): conta como hoje
  const dias = Math.max(0, diasEntre(dataBackup, hoje).length - 1);
  const idade = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
  const nivel: NivelBackup = !config.mudancasDesdeBackup
    ? 'neutro'
    : dias >= DIAS_BACKUP_URGENTE ? 'urgente' : 'aviso';
  return { nivel, idade };
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `npx vitest run src/domain/estadoBackup.test.ts`
Expected: PASS nos 9.

- [ ] **Passo 5: commit**

```bash
git add src/domain/estadoBackup.ts src/domain/estadoBackup.test.ts
git commit -m "feat(dominio): estado do backup em dias de calendário"
```

---

### Tarefa 2: rodapé na Visão, no lugar do aviso do topo

**Arquivos:**
- Modificar: `src/ui/TelaHoje.tsx` — imports, linha 16 (`SETE_DIAS_MS`), linhas 276-278 (`backupVelho`), linhas 336-340 (aviso do topo), bloco da Visão (~350-386)
- Modificar: `src/styles.css`
- Modificar: `docs/estilo/catalogo.md`
- Teste: `src/ui/TelaHoje.test.tsx`

**Interfaces:**
- Consome: `estadoBackup`, `SUFIXO_MUDANCAS_BACKUP` da Tarefa 1.

- [ ] **Passo 1: trocar o teste do aviso antigo pelos testes do rodapé.** Em `src/ui/TelaHoje.test.tsx`, apagar o teste `'clicar no aviso de backup atrasado abre a subtela de backup'` e pôr no lugar:

```tsx
describe('rodapé de backup', () => {
  async function montar(config: { mudancasDesdeBackup: boolean; ultimoBackupEm: string | null }) {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
    await useApp.getState().iniciar();
    await repo.salvarConfig(config);
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-26', aba: 'hoje', ajustesSecao: null });
    render(<TelaHoje />);
  }

  /** Horário local fixo — o teste não depende do fuso da máquina. */
  const local = (dia: number) => new Date(2026, 6, dia, 12).toISOString();

  it('sem mudanças pendentes fica neutro', async () => {
    await montar({ mudancasDesdeBackup: false, ultimoBackupEm: local(23) });
    const rodape = screen.getByRole('button', { name: 'Último backup: há 3 dias' });
    expect(rodape).toHaveClass('backup-rodape', 'backup-rodape-neutro');
    expect(rodape).not.toHaveClass('aviso');
  });

  it('com mudanças e backup recente fica âmbar', async () => {
    await montar({ mudancasDesdeBackup: true, ultimoBackupEm: local(23) });
    const rodape = screen.getByRole('button', { name: 'Último backup: há 3 dias · há mudanças não salvas em backup' });
    expect(rodape).toHaveClass('backup-rodape', 'aviso');
    expect(rodape).not.toHaveClass('aviso-urgente');
  });

  it('com mudanças e backup de 7 dias ou mais fica vermelho', async () => {
    await montar({ mudancasDesdeBackup: true, ultimoBackupEm: local(14) });
    const rodape = screen.getByRole('button', { name: 'Último backup: há 12 dias · há mudanças não salvas em backup' });
    expect(rodape).toHaveClass('backup-rodape', 'aviso', 'aviso-urgente');
  });

  it('tocar no rodapé abre Ajustes → Backup', async () => {
    await montar({ mudancasDesdeBackup: true, ultimoBackupEm: local(14) });
    await userEvent.click(screen.getByRole('button', { name: /Último backup/ }));
    const estado = useApp.getState();
    expect(estado.aba).toBe('ajustes');
    expect(estado.ajustesSecao).toBe('backup');
  });

  it('o aviso antigo do topo não existe mais', async () => {
    await montar({ mudancasDesdeBackup: true, ultimoBackupEm: local(1) });
    expect(screen.queryByText(/Há mudanças sem backup/)).not.toBeInTheDocument();
  });

  it('só aparece na Visão', async () => {
    await montar({ mudancasDesdeBackup: true, ultimoBackupEm: local(14) });
    await abrirAba(/Pendentes/);
    expect(screen.queryByRole('button', { name: /Último backup/ })).not.toBeInTheDocument();
  });
});

it('no primeiro uso o rodapé de backup não aparece', async () => {
  await useApp.getState().iniciar();
  render(<TelaHoje />);
  expect(screen.queryByRole('button', { name: /Último backup/ })).not.toBeInTheDocument();
});
```

O último teste monta o estado vazio do mesmo jeito que o teste existente `'com banco vazio, a Hoje mostra o cartão de primeiro uso…'`: só `iniciar()`, sem box nem categoria.

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/ui/TelaHoje.test.tsx`
Expected: FAIL nos testes do rodapé ("Unable to find role button with name Último backup: …") e no "aviso antigo não existe".

- [ ] **Passo 3: implementar em `src/ui/TelaHoje.tsx`.**

Import novo, junto dos outros de `../domain/`:

```tsx
import { estadoBackup, SUFIXO_MUDANCAS_BACKUP } from '../domain/estadoBackup';
```

Apagar a linha 16 (`const SETE_DIAS_MS = 7 * 86_400_000;`), as linhas 276-278 (`const backupVelho = ...`) e o bloco do topo (linhas 336-340):

```tsx
      {backupVelho && (
        <button className="aviso" ...>
          Há mudanças sem backup há mais de 7 dias — toque para exportar.
        </button>
      )}
```

Perto de onde `backupVelho` estava, calcular o estado:

```tsx
  const backup = estadoBackup(dados.config, hoje);
  const classeBackup = backup.nivel === 'neutro' ? 'backup-rodape backup-rodape-neutro'
    : backup.nivel === 'aviso' ? 'backup-rodape aviso'
    : 'backup-rodape aviso aviso-urgente';
```

Na Visão, trocar o ramo `) : (` que abre `<div className="card">` por um fragmento com o card e o rodapé:

```tsx
        ) : (
          <>
            <div className="card">
              {/* ...conteúdo atual do card de saldo, sem mudança... */}
            </div>
            <button type="button" className={classeBackup} onClick={() => abrirAjustes('backup')}>
              Último backup: {backup.idade}{dados.config.mudancasDesdeBackup && SUFIXO_MUDANCAS_BACKUP}
            </button>
          </>
        )
```

Se o mockup aprovado tiver ícone ou outra disposição, siga o mockup.

- [ ] **Passo 4: CSS.** Em `src/styles.css`, logo depois do bloco `.aviso { ... }` (linha ~178):

```css
.aviso-urgente { background: var(--neg-bg); color: var(--neg); }
```

E no fim do arquivo, num bloco próprio:

```css
/* ---- Rodapé de backup (TelaHoje.tsx) ---- */
.backup-rodape {
  display: block; width: 100%; text-align: left; border: none;
}
.backup-rodape-neutro {
  background: none; color: var(--muted); font-size: 13px; padding: 10px 14px;
}
```

A `.backup-rodape` não define fundo, cor nem espaçamento: nos estados âmbar e vermelho, quem manda é a `.aviso` (e a `.aviso-urgente`).

- [ ] **Passo 5: catálogo.** Em `docs/estilo/catalogo.md`, logo depois da linha da `.aviso`:

```markdown
| `.aviso-urgente` | variante vermelha da `.aviso`, usada junto dela (`aviso aviso-urgente`): `--neg-bg` e `--neg`. Classe solta, não modificador composto, para o verificador de catálogo enxergá-la |
```

E na tabela de classes de componente, perto das outras da `TelaHoje.tsx`:

```markdown
| `.backup-rodape` / `.backup-rodape-neutro` | rodapé de backup da Visão (`TelaHoje.tsx`). `.backup-rodape` é só a forma (botão de bloco, sem borda, alinhado à esquerda); `.backup-rodape-neutro` é o estado sem mudanças pendentes (sem fundo, `--muted`, 13px). Nos estados âmbar e vermelho, o botão leva `.aviso` / `.aviso .aviso-urgente` no lugar da `-neutro` |
```

- [ ] **Passo 6: rodar e ver passar**

Run: `npx vitest run src/ui/TelaHoje.test.tsx && node scripts/verificar-catalogo.mjs --strict`
Expected: PASS nos testes; o verificador sai com código 0, sem classe fora do catálogo.

- [ ] **Passo 7: commit**

```bash
git add src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "feat(hoje): rodapé de backup sempre visível, em três estados"
```

---

### Tarefa 3: Ajustes → Backup com a mesma idade

**Arquivos:**
- Modificar: `src/ui/ajustes/Backup.tsx:7-8` e `:72-75`
- Teste: `src/ui/ajustes/Backup.test.tsx`

**Interfaces:**
- Consome: `estadoBackup`, `SUFIXO_MUDANCAS_BACKUP` da Tarefa 1; `hoje` de `useApp()`.

- [ ] **Passo 1: escrever os testes que falham.** No fim de `src/ui/ajustes/Backup.test.tsx`:

```tsx
describe('Backup (última cópia)', () => {
  it('mostra a idade relativa e a data completa entre parênteses', async () => {
    await useApp.getState().iniciar();
    const quando = new Date(2026, 6, 23, 19, 46).toISOString();
    await repo.salvarConfig({ ultimoBackupEm: quando, mudancasDesdeBackup: false });
    await useApp.getState().recarregar();
    useApp.setState({ hoje: '2026-07-26' });

    render(<Backup />);

    const dataCompleta = new Date(quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    expect(screen.getByText(`Último backup: há 3 dias (${dataCompleta})`)).toBeInTheDocument();
  });

  it('sem backup feito mostra "nunca", sem parênteses', async () => {
    await useApp.getState().iniciar();
    await repo.salvarConfig({ ultimoBackupEm: null, mudancasDesdeBackup: true });
    await useApp.getState().recarregar();

    render(<Backup />);

    expect(screen.getByText('Último backup: nunca · há mudanças não salvas em backup')).toBeInTheDocument();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/ui/ajustes/Backup.test.tsx`
Expected: FAIL nos dois testes novos.

- [ ] **Passo 3: implementar.** Em `src/ui/ajustes/Backup.tsx`, import novo:

```tsx
import { estadoBackup, SUFIXO_MUDANCAS_BACKUP } from '../../domain/estadoBackup';
```

Trocar `const { dados, recarregar } = useApp();` por:

```tsx
  const { dados, hoje, recarregar } = useApp();
```

E o parágrafo das linhas 72-75 por:

```tsx
      <p className="sub">
        Último backup: {estadoBackup(dados.config, hoje).idade}
        {dados.config.ultimoBackupEm && !Number.isNaN(Date.parse(dados.config.ultimoBackupEm))
          && ` (${new Date(dados.config.ultimoBackupEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })})`}
        {dados.config.mudancasDesdeBackup && SUFIXO_MUDANCAS_BACKUP}
      </p>
```

- [ ] **Passo 4: rodar e ver passar**

Run: `npx vitest run src/ui/ajustes/Backup.test.tsx`
Expected: PASS em todos. Se o `getByText` falhar por o texto vir quebrado em nós, use o matcher de função que `TelaHoje.test.tsx` já usa (`(_, el) => el?.tagName === 'P' && el.textContent === ...`).

- [ ] **Passo 5: commit**

```bash
git add src/ui/ajustes/Backup.tsx src/ui/ajustes/Backup.test.tsx
git commit -m "feat(backup): Ajustes mostra a idade do último backup como a Hoje"
```

---

### Tarefa 4: dossiê, wiki e fragmento

**Arquivos:**
- Regenerar: `docs/dossie/`
- Modificar: `docs/wiki/6-telas.md:14`, `docs/wiki/1-primeiros-passos.md:84`, `docs/wiki/7-ajustes.md` (seção "Backup e restauração")
- Criar: `changelog.d/alterado-rodape-backup.md`

- [ ] **Passo 1: regenerar o dossiê**

Run: `npm run dossie`
Expected: se o roteiro capturar a Visão, aparece a linha `Último backup: …`, e some a do aviso antigo. Revise o `git diff docs/dossie/` com a skill `revisar-dossie`.

- [ ] **Passo 2: atualizar a wiki.** Em `docs/wiki/6-telas.md`, trocar a linha 14:

```markdown
- **Rodapé de backup:** abaixo do card de saldo, na Visão, sempre visível — mostra há quanto tempo foi o último backup. Fica discreto quando não há nada novo sem cópia, âmbar quando há mudanças sem backup, e vermelho quando essas mudanças já têm 7 dias ou mais (ou quando você nunca fez backup). Tocar leva direto para Ajustes → Backup.
```

Em `docs/wiki/1-primeiros-passos.md:84`, trocar a frase por:

```markdown
- A tela Hoje mostra, embaixo do saldo, há quanto tempo foi o último backup — quando ele ficar vermelho, está falando sério.
```

Em `docs/wiki/7-ajustes.md`, na seção "Backup e restauração", se houver descrição da linha "Último backup", ajustá-la para: `mostra há quanto tempo foi o último backup, com a data e a hora entre parênteses`.

- [ ] **Passo 3: validar a wiki**

Run: `npx vitest run src/ui/ajustes/capitulos.test.ts`
Expected: PASS.

- [ ] **Passo 4: criar o fragmento** `changelog.d/alterado-rodape-backup.md`:

```markdown
- A tela Hoje mostra sempre, embaixo do saldo, há quanto tempo foi o último backup.
  - Fica âmbar quando há mudanças sem backup, e vermelho quando elas já têm 7 dias ou mais.
  - Tocar leva direto para Ajustes → Backup.
  - Substitui o aviso que só aparecia no topo depois de 7 dias.
- Ajustes → Backup mostra há quanto tempo foi o último backup, com a data e a hora entre parênteses.
```

- [ ] **Passo 5: suíte inteira e build**

Run: `npm test && npm run build`
Expected: tudo verde, incluindo `src/dossie/dossie.test.ts`.

- [ ] **Passo 6: commit**

```bash
git add docs/dossie docs/wiki changelog.d/alterado-rodape-backup.md
git commit -m "docs: wiki, dossiê e fragmento do rodapé de backup"
```

- [ ] **Passo 7: seguir a skill `ciclo-de-entrega`** — revisão do fragmento com o usuário (confirmação literal), merge na `main`, `npm run release`, push e deploy. Se o item 8 já estiver na `main`, o merge de `docs/wiki/6-telas.md` pode pedir um rebase simples (seções diferentes). Antes do merge, responder: "que item do `TODO.md` isto fecha?" — o item 5, inteiro.
