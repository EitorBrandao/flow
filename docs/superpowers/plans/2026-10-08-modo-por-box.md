# Modo de uso por box — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** Cada box (e a visão casa) ter seus próprios modos Simples/Avançado por tela, herdando o `Config.modos` atual quando não tem modo próprio.

**Arquitetura:** `Box.modos` opcional. Regra de resolução pura em `src/domain/modos.ts`: `box.modos[tela]` → `config.modos[tela]` → `'avancado'`. A UI resolve a box do topo (`boxIdEfetivo`) e chama essa regra. Gravação por `repo.salvarModoBox`, sem mexer em `alteradoEm`. Backup valida `modos` de cada box e o `mesclar` mantém o `modos` do aparelho.

**Tecnologias:** React 18, TypeScript, Zustand, Dexie, Vitest + Testing Library.

Spec: `docs/superpowers/specs/2026-10-08-modo-por-box-design.md`.

## Restrições globais

- Todo o trabalho acontece no worktree `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\modo-por-box` (branch `modo-por-box`). **Não toque no checkout principal.** Antes da primeira edição: `git rev-parse --show-toplevel` deve devolver o worktree.
- Texto para o usuário e mensagens de commit em português. Commits terminam com as linhas:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` e
  `Claude-Session: https://claude.ai/code/session_01DoK2LEBGFwR7Y6EyuMMA3t`.
- Arquivos em UTF-8 sem BOM. Use as ferramentas de edição, não `Set-Content`.
- Sem schema novo: **não** crie `this.version(n)` no Dexie.
- Não mude `scripts/`, `vite.config.ts`, `tsconfig.json`, `.claude/`. Não instale dependência.
- Não relaxe `validarBackup`.
- Trocar de modo **não** muda `alteradoEm` da box e **não** chama `marcarMudanca`.
- Dados de teste são sintéticos.
- Nenhuma classe CSS nem componente novo.
- Antes de dizer que terminou: `npm test` completo (não só o arquivo mexido).
- Frase de abertura de Ajustes → Modo de uso, do mockup aprovado, palavra por palavra:
  "Escolha o quanto de detalhe cada tela mostra **{onde}**. Para mudar outra box, troque a box no topo. Seus dados são os mesmos nos dois modos e nada se perde ao trocar."
  com `{onde}` = "na box X" | "na visão casa (todas as boxes juntas)" | "no padrão do app".

---

### Task 1: Domínio — `Box.modos` e a regra de resolução

**Arquivos:**
- Modificar: `src/domain/types.ts` (interface `Box`, ~linha 13–22)
- Modificar: `src/domain/modos.ts`
- Testar: `src/domain/modos.test.ts`

**Interfaces:**
- Produz:
  - `Box.modos?: Partial<ModosUso>`
  - `modoDaBox(config: Config, box: Pick<Box, 'modos'> | undefined, tela: TelaModo): ModoUso`
  - `modosDaBox(config: Config, box: Pick<Box, 'modos'> | undefined): ModosUso`

- [ ] **Passo 1: escrever os testes que falham.** Em `src/domain/modos.test.ts`, mude o import da linha 2 para incluir `modoDaBox, modosDaBox` e acrescente no fim do arquivo:

```ts
describe('modoDaBox', () => {
  it('box com modo próprio vale mais que o global', () => {
    expect(modoDaBox(config({ hoje: 'avancado' }), { modos: { hoje: 'simples' } }, 'hoje')).toBe('simples');
  });
  it('box sem modos herda o global', () => {
    expect(modoDaBox(config({ hoje: 'simples' }), {}, 'hoje')).toBe('simples');
  });
  it('tela ausente na box herda só aquela tela do global', () => {
    const box = { modos: { hoje: 'simples' } } as const;
    expect(modoDaBox(config({ fluxo: 'simples' }), box, 'fluxo')).toBe('simples');
    expect(modoDaBox(config({ fluxo: 'simples' }), box, 'cartao')).toBe('avancado');
  });
  it('sem box e sem global vale avançado', () => {
    expect(modoDaBox(config(), undefined, 'lancar')).toBe('avancado');
  });
});

describe('modosDaBox', () => {
  it('completa as cinco telas: box primeiro, depois o global, depois avançado', () => {
    expect(modosDaBox(config({ fluxo: 'simples' }), { modos: { hoje: 'simples' } })).toEqual({
      hoje: 'simples', fluxo: 'simples', cartao: 'avancado', analises: 'avancado', lancar: 'avancado',
    });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run src/domain/modos.test.ts` → FAIL (`modoDaBox` não é exportado).

- [ ] **Passo 3: implementar.**
  - Em `src/domain/types.ts`, na interface `Box`, depois de `categoriaTransferenciaEntradaId?`, acrescente:
    `modos?: Partial<ModosUso>; // ausente = herda Config.modos (ver modoDaBox em modos.ts)`
  - Em `src/domain/modos.ts`, mude a primeira linha de import para incluir `Box` (já importa `Categoria, Config, ID, Lancamento, ModoUso, ModosUso, TelaModo, TipoCategoria`) e acrescente depois de `modosEfetivos`:

```ts
/** Modo de uma tela numa box: o da própria box, senão o global (`Config.modos`), senão Avançado. */
export function modoDaBox(config: Config, box: Pick<Box, 'modos'> | undefined, tela: TelaModo): ModoUso {
  return box?.modos?.[tela] ?? modoDe(config, tela);
}

/** Os cinco modos efetivos de uma box. */
export function modosDaBox(config: Config, box: Pick<Box, 'modos'> | undefined): ModosUso {
  return Object.fromEntries(TELAS_MODO.map((t) => [t, modoDaBox(config, box, t)])) as ModosUso;
}
```

- [ ] **Passo 4: rodar e ver passar.** `npx vitest run src/domain/modos.test.ts` → PASS. Depois `npx tsc -b` sem erro.

- [ ] **Passo 5: commit.** `git add src/domain && git commit` com a mensagem `feat(modos): regra de modo por box no domínio` (mais as duas linhas de atribuição).

---

### Task 2: Persistência — `salvarModoBox`

**Arquivos:**
- Modificar: `src/db/repo.ts` (import de `modosEfetivos, modosInstalacaoNova` na linha 4; novo método depois de `salvarModo`, ~linha 284)
- Testar: `src/db/repo.test.ts` (dentro do `describe('modos de uso', …)` que começa na linha 1926; o `describe` termina com o teste "salvarModo simultâneo…" perto da linha 2043–2055 — acrescente os novos `it` antes do `});` que fecha esse `describe`)

**Interfaces:**
- Consome: `modosDaBox(config, box)` (Task 1).
- Produz: `salvarModoBox(boxId: ID, tela: TelaModo, modo: ModoUso): Promise<void>`. Lança `Error('Box não encontrada.')` se a box não existe.

- [ ] **Passo 1: escrever os testes que falham.** Os testes usam o `describe` existente, que já tem `vazio()` e `TELAS`. Confira como `repo.test.ts` cria uma box (procure `salvarBox({` nos testes vizinhos) e use um helper local:

```ts
  const criarBox = async (id: string, nome = id) => {
    const agora = '2026-01-01T00:00:00.000Z';
    await repo.salvarBox({ id, nome, saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora });
  };

  it('salvarModoBox grava as cinco telas na box, herdando o global nas outras', async () => {
    await vazio();
    await db.config.put({
      id: 'config', boxPadraoId: null, ultimoBackupEm: null, mudancasDesdeBackup: false,
      horizonteProjecao: '2099-12-31', modos: { fluxo: 'simples' },
    });
    await criarBox('b1');
    await repo.salvarModoBox('b1', 'hoje', 'simples');
    expect((await db.boxes.get('b1'))?.modos).toEqual({
      hoje: 'simples', fluxo: 'simples', cartao: 'avancado', analises: 'avancado', lancar: 'avancado',
    });
  });

  it('salvarModoBox não muda o global nem outra box', async () => {
    await vazio();
    await criarBox('b1');
    await criarBox('b2');
    await repo.salvarModoBox('b1', 'hoje', 'simples');
    expect((await db.boxes.get('b2'))?.modos).toBeUndefined();
    expect((await db.config.get('config'))?.modos?.hoje).not.toBe('simples');
  });

  it('salvarModoBox depois de mudar o global não altera a box que já tem modos', async () => {
    await vazio();
    await criarBox('b1');
    await repo.salvarModoBox('b1', 'hoje', 'simples');
    await repo.salvarModo('cartao', 'simples');
    expect((await db.boxes.get('b1'))?.modos?.cartao).toBe('avancado');
  });

  it('salvarModoBox não muda alteradoEm nem marca mudança de backup', async () => {
    await vazio();
    await criarBox('b1');
    await db.config.put({
      id: 'config', boxPadraoId: null, ultimoBackupEm: null, mudancasDesdeBackup: false,
      horizonteProjecao: '2099-12-31',
    });
    await repo.salvarModoBox('b1', 'hoje', 'simples');
    expect((await db.boxes.get('b1'))?.alteradoEm).toBe('2026-01-01T00:00:00.000Z');
    expect((await db.config.get('config'))?.mudancasDesdeBackup).toBe(false);
  });

  it('salvarModoBox simultâneo em duas telas da mesma box é atômico', async () => {
    await vazio();
    await criarBox('b1');
    await Promise.all([repo.salvarModoBox('b1', 'hoje', 'simples'), repo.salvarModoBox('b1', 'fluxo', 'simples')]);
    const m = (await db.boxes.get('b1'))?.modos;
    expect(m?.hoje).toBe('simples');
    expect(m?.fluxo).toBe('simples');
    expect(m?.cartao).toBe('avancado');
  });

  it('salvarModoBox numa box que não existe lança erro em português', async () => {
    await vazio();
    await expect(repo.salvarModoBox('nao-existe', 'hoje', 'simples')).rejects.toThrow('Box não encontrada.');
  });

  it('salvarBox com a box lida preserva o modos', async () => {
    await vazio();
    await criarBox('b1');
    await repo.salvarModoBox('b1', 'hoje', 'simples');
    const box = (await db.boxes.get('b1'))!;
    await repo.salvarBox({ ...box, nome: 'renomeada' });
    expect((await db.boxes.get('b1'))?.modos?.hoje).toBe('simples');
  });

  it('substituirTudo traz o modos das boxes do backup', async () => {
    await vazio();
    const atuais = await repo.carregarTudo();
    const agora = '2026-01-01T00:00:00.000Z';
    await repo.substituirTudo({
      ...atuais,
      boxes: [{
        id: 'b1', nome: 'b1', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora,
        modos: { hoje: 'simples' },
      }],
    });
    expect((await db.boxes.get('b1'))?.modos).toEqual({ hoje: 'simples' });
  });
```

- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run src/db/repo.test.ts -t "salvarModoBox"` → FAIL (`salvarModoBox` não existe). O teste de `substituirTudo` e o de `salvarBox` podem já passar: tudo bem, ficam como rede de segurança.

- [ ] **Passo 3: implementar.** Em `src/db/repo.ts`: importe `modosDaBox` junto de `modosEfetivos, modosInstalacaoNova` (linha 4), confira que `ID`, `TelaModo` e `ModoUso` já estão importados de `../domain/types` (os dois últimos já são usados por `salvarModo`), e acrescente depois de `salvarModo`:

```ts
/** Grava o modo de uma tela numa box. Grava as cinco telas: a box deixa de herdar o global, então mudar o
 *  global depois não a altera. Não muda `alteradoEm` (o `mesclar` preferiria a box inteira por engano) e
 *  não chama `marcarMudanca`: trocar de modo não é dado a salvar em backup. */
export async function salvarModoBox(boxId: ID, tela: TelaModo, modo: ModoUso): Promise<void> {
  await db.transaction('rw', db.boxes, db.config, async () => {
    const box = await db.boxes.get(boxId);
    if (!box) throw new Error('Box não encontrada.');
    const config = (await db.config.get('config')) ?? configPadrao();
    await db.boxes.update(boxId, { modos: { ...modosDaBox(config, box), [tela]: modo } });
  });
}
```

- [ ] **Passo 4: rodar e ver passar.** `npx vitest run src/db/repo.test.ts` → PASS inteiro. `npx tsc -b` sem erro.

- [ ] **Passo 5: commit.** `feat(db): salvarModoBox grava os modos de uma box`.

---

### Task 3: Backup — validar e mesclar o `modos` das boxes

**Arquivos:**
- Modificar: `src/backup/backup.ts` (`validarBackup`, depois do bloco de `config.modos`, linha 43–47; e `mesclar`, linha 135–165)
- Testar: `src/backup/backup.test.ts` (acrescente depois do teste "mesclar mantém os modos da config local", ~linha 548; reaproveite `dados()` e `backupCom` do arquivo)

**Interfaces:**
- Consome: `modosValidos` (já importado em `backup.ts`).
- Produz: `validarBackup` lança `Backup corrompido: modos de uso inválidos.` para box com `modos` inválido; `mesclar` mantém o `modos` do aparelho em toda box que já existe.

- [ ] **Passo 1: escrever os testes que falham.** Antes, leia `backupCom` (procure no arquivo) para ver o formato. Se `backupCom` só aceita `config`, monte o backup assim:

```ts
const backupComBox = (box: Record<string, unknown>) => {
  const b = JSON.parse(JSON.stringify(gerarBackup(dados())));
  b.dados.boxes = [box];
  return b;
};
const boxBase = { id: 'b1', nome: 'eitor', saldoInicial: 100, dataSaldoInicial: '2026-01-01', criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z' };

it('validarBackup: box com modos válido sai com o modos intacto', () => {
  const modos = { hoje: 'simples', fluxo: 'avancado', cartao: 'simples', analises: 'avancado', lancar: 'simples' };
  const v = validarBackup(backupComBox({ ...boxBase, modos }));
  expect(v.dados.boxes[0].modos).toEqual(modos);
});

it('validarBackup: box sem modos ou com modos undefined valida e volta sem modos', () => {
  expect(validarBackup(backupComBox({ ...boxBase })).dados.boxes[0].modos).toBeUndefined();
  expect(validarBackup(backupComBox({ ...boxBase, modos: undefined })).dados.boxes[0].modos).toBeUndefined();
});

it('validarBackup: box com modos inválido lança erro em português', () => {
  for (const modos of [{ hoje: 'facil' }, { telaInexistente: 'simples' }, { hoje: null }, [], 'x', null, 0]) {
    expect(() => validarBackup(backupComBox({ ...boxBase, modos }))).toThrow(/modos de uso inválidos/);
  }
});

it('validarBackup: box nula no array de boxes não quebra a checagem de modos', () => {
  const b = JSON.parse(JSON.stringify(gerarBackup(dados())));
  b.dados.boxes = [null];
  expect(() => validarBackup(b)).not.toThrow(/modos de uso/);
});

it('mesclar mantém o modos do aparelho mesmo quando a box do backup é mais nova', () => {
  const atual = dados();
  atual.boxes[0] = { ...atual.boxes[0], modos: { hoje: 'simples' } };
  const backup = dados();
  backup.boxes[0] = { ...backup.boxes[0], nome: 'novo nome', alteradoEm: '2026-06-01T00:00:00Z', modos: { hoje: 'avancado', fluxo: 'simples' } };
  const m = mesclar(atual, backup);
  expect(m.boxes[0].nome).toBe('novo nome');
  expect(m.boxes[0].modos).toEqual({ hoje: 'simples' });
});

it('mesclar: aparelho sem modos na box não ganha o modos do backup', () => {
  const atual = dados();
  const backup = dados();
  backup.boxes[0] = { ...backup.boxes[0], alteradoEm: '2026-06-01T00:00:00Z', modos: { hoje: 'simples' } };
  expect(mesclar(atual, backup).boxes[0].modos).toBeUndefined();
});

it('mesclar: box que só existe no backup entra com o modos dela', () => {
  const atual = dados();
  const backup = dados();
  backup.boxes.push({ ...backup.boxes[0], id: 'b2', modos: { hoje: 'simples' } });
  const m = mesclar(atual, backup);
  expect(m.boxes.find((b) => b.id === 'b2')?.modos).toEqual({ hoje: 'simples' });
});
```

- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run src/backup/backup.test.ts` → os testes de rejeição e de `mesclar` falham.

- [ ] **Passo 3: implementar.** Em `validarBackup`, logo depois do `if` de `d.config.modos` (linha 47), acrescente:

```ts
  // modos de uso por box: opcional (ausente = herda o global), mas se vier tem que ser válido.
  // Box nula ou que não é objeto passa: quem trata é o resto do import, não esta checagem.
  for (const x of d.boxes as Array<Record<string, unknown> | null>) {
    if (x && typeof x === 'object' && 'modos' in x && x.modos !== undefined && !modosValidos(x.modos)) {
      throw new Error('Backup corrompido: modos de uso inválidos.');
    }
  }
```

  Em `mesclar`, troque `boxes: mesclarTabela(atual.boxes, doBackup.boxes),` por `boxes: mesclarBoxes(),` e declare dentro de `mesclar`, antes do `return`:

```ts
  // O modo de uso é preferência do aparelho (como `config`): em toda box que já existe aqui, o
  // `modos` local vale, mesmo quando a box do backup vence por `alteradoEm`.
  function mesclarBoxes() {
    const locais = new Map(atual.boxes.map((b) => [b.id, b]));
    return mesclarTabela(atual.boxes, doBackup.boxes).map((b) => {
      const local = locais.get(b.id);
      if (!local) return b;
      const copia = { ...b };
      if (local.modos) copia.modos = local.modos;
      else delete copia.modos;
      return copia;
    });
  }
```

  Atualize o comentário de `mesclar` (linha 134) para: `/** Mescla por id; em conflito vence o alteradoEm mais recente. Config local e o modos das boxes locais são mantidos. */`

- [ ] **Passo 4: rodar e ver passar.** `npx vitest run src/backup src/db/repo.test.ts` → PASS. `npx tsc -b` sem erro.

- [ ] **Passo 5: commit.** `feat(backup): valida e mescla o modo de uso das boxes`.

---

### Task 4: Interface — `useModo`, Ajustes → Modo de uso e o detalhe do menu

**Arquivos:**
- Modificar: `src/ui/useModo.ts`
- Modificar: `src/ui/ajustes/ModoDeUso.tsx`
- Modificar: `src/ui/TelaAjustes.tsx` (linha 104)
- Testar: `src/ui/useModo.test.tsx` (novo), `src/ui/ajustes/ModoDeUso.test.tsx`, `src/ui/TelaAjustes.test.tsx` (linhas 107 e 192)
- **Antes de editar:** leia `docs/estilo-visual.md` e o capítulo `docs/estilo/nivel-1-editar-tela.md` (sem classe nem componente novo, só texto e dados).

**Interfaces:**
- Consome: `modoDaBox` (Task 1), `repo.salvarModoBox` (Task 2), `boxIdEfetivo(dados, boxSel)` de `src/state/store.ts`.
- Produz: `useModo(tela)` (mesma assinatura) agora depende de `boxSel`.

- [ ] **Passo 1: escrever os testes que falham.**

  `src/ui/useModo.test.tsx` (novo):

```tsx
import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { act, render, screen } from '@testing-library/react';
import * as repo from '../db/repo';
import { agoraISO } from '../domain/types';
import { useApp } from '../state/store';
import { useModo } from './useModo';

function Sonda() {
  return <span data-testid="modo">{useModo('hoje')}</span>;
}

async function box(id: string, nome: string, saldoInicial: number | null) {
  const agora = agoraISO();
  await repo.salvarBox({ id, nome, saldoInicial, dataSaldoInicial: saldoInicial === null ? null : '2026-01-01', criadoEm: agora, alteradoEm: agora });
}

describe('useModo', () => {
  beforeEach(async () => { await limparDb(); });

  it('troca o modo ao trocar a box do topo, e a casa tem o modo da box casa', async () => {
    await box('b1', 'Pessoal', 0);
    await box('b2', 'Empresa', 0);
    await box('c1', 'casa', null);
    await repo.salvarModoBox('b1', 'hoje', 'simples');
    await repo.salvarModoBox('b2', 'hoje', 'avancado');
    await repo.salvarModoBox('c1', 'hoje', 'simples');
    await useApp.getState().iniciar();
    render(<Sonda />);
    await act(async () => { useApp.getState().setBoxSel('b1'); });
    expect(screen.getByTestId('modo')).toHaveTextContent('simples');
    await act(async () => { useApp.getState().setBoxSel('b2'); });
    expect(screen.getByTestId('modo')).toHaveTextContent('avancado');
    await act(async () => { useApp.getState().setBoxSel('casa'); });
    expect(screen.getByTestId('modo')).toHaveTextContent('simples');
  });

  it('box sem modos herda o global', async () => {
    await box('b1', 'Pessoal', 0);
    await repo.salvarModo('hoje', 'simples');
    await useApp.getState().iniciar();
    render(<Sonda />);
    await act(async () => { useApp.getState().setBoxSel('b1'); });
    expect(screen.getByTestId('modo')).toHaveTextContent('simples');
  });

  it('visão casa sem a box real casa usa o global', async () => {
    await box('b1', 'Pessoal', 0);
    await useApp.getState().iniciar();
    const casa = useApp.getState().dados!.boxes.find((b) => b.nome === 'casa')!;
    await repo.salvarBox({ ...casa, nome: 'renomeada' });
    await repo.salvarModo('hoje', 'simples');
    await useApp.getState().recarregar();
    render(<Sonda />);
    await act(async () => { useApp.getState().setBoxSel('casa'); });
    expect(screen.getByTestId('modo')).toHaveTextContent('simples');
  });
});
```

  Confira que `setBoxSel` existe em `useApp` (o `Shell` o usa) e que `limparDb` limpa o `useApp`; se não, ajuste só o preparo do teste.

  `src/ui/ajustes/ModoDeUso.test.tsx`:
  - Ajuste o teste "clicar em Simples no Hoje grava só o modo do Hoje e mostra o selo" (linhas 46–57): em vez de `db.config.get('config')?.modos`, leia a box do topo — `const boxId = useApp.getState().boxSel;` e `expect((await db.boxes.get(boxId))?.modos).toEqual({ hoje: 'simples', fluxo: 'avancado', cartao: 'avancado', analises: 'avancado', lancar: 'avancado' });` — e acrescente `expect((await db.config.get('config'))?.modos?.hoje).not.toBe('simples');` (o global não muda). Se `boxSel` do teste for `'casa'`, use `boxIdEfetivo(useApp.getState().dados!, 'casa')`. Confira qual é o caso rodando o teste.
  - Acrescente (importe `act` de `@testing-library/react`):

```tsx
  it('a frase de abertura nomeia a box do topo e traz o aviso de trocar a box', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    const boxId = useApp.getState().dados!.boxes.find((b) => b.nome === 'eitor')!.id;
    await act(async () => { useApp.getState().setBoxSel(boxId); });
    const { container } = render(<ModoDeUso />);
    const frase = container.querySelector('.card > .sub')!.textContent;
    expect(frase).toBe('Escolha o quanto de detalhe cada tela mostra na box eitor. Para mudar outra box, troque a box no topo. Seus dados são os mesmos nos dois modos e nada se perde ao trocar.');
  });

  it('cada box tem os seus modos: trocar a box no topo troca os selos', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    const agora = agoraISO();
    await repo.salvarBox({ id: 'b2', nome: 'segunda', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora });
    await useApp.getState().recarregar();
    const b1 = useApp.getState().dados!.boxes.find((b) => b.nome === 'eitor')!.id;
    await act(async () => { useApp.getState().setBoxSel(b1); });
    render(<ModoDeUso />);
    await userEvent.click(within(bloco('Hoje')).getByRole('button', { name: 'Simples' }));
    await within(bloco('Hoje')).findByText('Simples', { selector: '.badge' });
    await act(async () => { useApp.getState().setBoxSel('b2'); });
    expect(within(bloco('Hoje')).getByText('Avançado', { selector: '.badge' })).toBeInTheDocument();
    await act(async () => { useApp.getState().setBoxSel(b1); });
    expect(within(bloco('Hoje')).getByText('Simples', { selector: '.badge' })).toBeInTheDocument();
  });

  it('na visão casa a frase diz "na visão casa" e grava na box casa', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    await act(async () => { useApp.getState().setBoxSel('casa'); });
    const { container } = render(<ModoDeUso />);
    expect(container.querySelector('.card > .sub')!.textContent).toContain('mostra na visão casa (todas as boxes juntas). Para mudar outra box');
    await userEvent.click(within(bloco('Fluxo')).getByRole('button', { name: 'Simples' }));
    await within(bloco('Fluxo')).findByText('Simples', { selector: '.badge' });
    const casa = useApp.getState().dados!.boxes.find((b) => b.nome === 'casa')!;
    expect((await db.boxes.get(casa.id))?.modos?.fluxo).toBe('simples');
  });

  it('visão casa sem a box casa: frase "no padrão do app" e grava o modo global', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    const casa = useApp.getState().dados!.boxes.find((b) => b.nome === 'casa')!;
    await repo.salvarBox({ ...casa, nome: 'renomeada' });
    await useApp.getState().recarregar();
    await act(async () => { useApp.getState().setBoxSel('casa'); });
    const { container } = render(<ModoDeUso />);
    expect(container.querySelector('.card > .sub')!.textContent).toContain('mostra no padrão do app. Para mudar outra box');
    await userEvent.click(within(bloco('Cartão')).getByRole('button', { name: 'Simples' }));
    await within(bloco('Cartão')).findByText('Simples', { selector: '.badge' });
    expect((await db.config.get('config'))?.modos?.cartao).toBe('simples');
  });
```

  `src/ui/TelaAjustes.test.tsx`: troque nas linhas 107 e 192 "por tela" por "por box e por tela" (o texto novo é `Simples ou avançado, por box e por tela`).

- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run src/ui/useModo.test.tsx src/ui/ajustes/ModoDeUso.test.tsx src/ui/TelaAjustes.test.tsx` → FAIL nos testes novos e nos ajustados.

- [ ] **Passo 3: implementar.**

  `src/ui/useModo.ts` inteiro:

```ts
import { boxIdEfetivo, useApp } from '../state/store';
import { modoDaBox } from '../domain/modos';
import type { ModoUso, TelaModo } from '../domain/types';

/** Modo da tela na box do topo. Na visão casa vale o modo da box real "casa". */
export function useModo(tela: TelaModo): ModoUso {
  return useApp((s) => {
    if (!s.dados) return 'avancado';
    const id = boxIdEfetivo(s.dados, s.boxSel);
    return modoDaBox(s.dados.config, s.dados.boxes.find((b) => b.id === id), tela);
  });
}
```

  `src/ui/ajustes/ModoDeUso.tsx`: troque o import de `modoDe` por `modoDaBox`; importe `boxIdEfetivo, useApp` de `../../state/store`; dentro do componente:

```tsx
  const dados = useApp((s) => s.dados);
  const boxSel = useApp((s) => s.boxSel);
  const recarregar = useApp((s) => s.recarregar);
  const boxId = dados ? boxIdEfetivo(dados, boxSel) : null;
  const box = dados?.boxes.find((b) => b.id === boxId);
  const onde = !box ? 'no padrão do app'
    : boxSel === 'casa' ? 'na visão casa (todas as boxes juntas)'
    : `na box ${box.nome}`;

  async function escolher(tela: TelaModo, modo: ModoUso) {
    if (box) await repo.salvarModoBox(box.id, tela, modo);
    else await repo.salvarModo(tela, modo);
    await recarregar();
  }
```

  Troque a leitura do modo por `const modo = dados ? modoDaBox(dados.config, box, tela) : 'avancado';` e a frase de abertura por:

```tsx
        <div className="sub">
          Escolha o quanto de detalhe cada tela mostra <b>{onde}</b>. Para mudar outra box, troque a box no topo. Seus dados são os mesmos nos dois modos e nada se perde ao trocar.
        </div>
```

  `src/ui/TelaAjustes.tsx` linha 104: `'Simples ou avançado, por box e por tela'`.

- [ ] **Passo 4: rodar e ver passar.** Os três arquivos acima → PASS. Depois a suíte completa: `npm test` → verde (os testes de cada tela usam `repo.salvarModo`, que continua global; as boxes sem `modos` herdam, então seguem passando). Se algum teste de tela falhar porque a box do teste tem `modos`, ajuste o teste, não a regra. `npx tsc -b` sem erro.

- [ ] **Passo 5: commit.** `feat(ui): modo de uso por box em Ajustes e nas telas`.

---

### Task 5: Documentação e fragmento de changelog

**Arquivos:**
- Modificar: `docs/dominio.md` (linhas 113–120)
- Modificar: `docs/wiki/65-modos.md`
- Criar: `changelog.d/alterado-modo-por-box.md`
- Modificar: `docs/superpowers/README.md` (tabela de planos, depois da linha de `modo-simples-avancado`)

- [ ] **Passo 1: `docs/dominio.md`.** Troque as linhas 113–120 (do início de "`Config.modos`" até "…reaproveita as entidades existentes.") por:

```
  `Box.modos` (`Partial<ModosUso>`, `src/domain/types.ts`) guarda o modo de uso — `'simples'` ou
  `'avancado'` — de cada tela (`hoje`, `fluxo`, `cartao`, `analises` e `lancar`) **da box**. A
  visão casa usa o `modos` da box real `"casa"`. `Config.modos` continua e vale como **padrão**:
  a regra é `Box.modos[tela]` → `Config.modos[tela]` → Avançado (`modoDaBox`,
  `src/domain/modos.ts`). Uma base que já existe, ou um backup anterior aos modos, nunca muda de
  aparência sozinha. Só uma instalação nova grava Simples (`modosInstalacaoNova`, em
  `Config.modos`), e a box nova herda isso. `repo.salvarModoBox` grava as cinco telas da box, não
  muda `alteradoEm` e não marca mudança de backup. Não há tabela nem `version(n)` no Dexie. Em
  backup, `validarBackup` rejeita `modos` inválido na `config` e em cada box (`modosValidos`);
  **mesclar** mantém os modos do aparelho (a `config` vem de `atual`, e o `modos` de toda box que
  já existe aqui também) e **substituir** traz os do arquivo. O modo Simples só muda o que a tela
  mostra: reaproveita as entidades existentes.
```

- [ ] **Passo 2: `docs/wiki/65-modos.md`.** Use só markdown do subconjunto já usado no arquivo (parágrafos, listas com `- `, `##`, `>`).
  - Linha 7: troque por `Cada tela tem o seu próprio modo, e cada box também. Você pode deixar uma tela no Simples e outra no Avançado. Pode deixar uma box no Simples e outra no Avançado.`
  - Linha 17: troque por `Abra Ajustes (ícone ⚙️ no topo), depois Sobre o app, depois Modo de uso. A tela tem cinco blocos, um por tela do app. Cada bloco tem dois botões, Simples e Avançado. O selo do bloco diz o modo atual da tela. Os blocos mostram os modos da box escolhida no topo. Para mudar outra box, troque a box no topo. A visão casa tem os modos dela.`
  - Depois do item "Um backup antigo…" (linha 23), acrescente: `- Uma box nova começa no modo padrão do app: Simples numa instalação nova e Avançado num app que já tinha dados.`
  - Linha 25: troque por `> Ao restaurar um backup, **substituir tudo** traz os modos de cada box do arquivo. **Mesclar** mantém os modos deste aparelho.`
  - Valide: `npx vitest run src/ui/ajustes/capitulos.test.ts` → PASS.

- [ ] **Passo 3: fragmento.** Crie `changelog.d/alterado-modo-por-box.md` (tópico sem negrito, detalhe com exatamente 2 espaços):

```
- O modo Simples ou Avançado agora vale por box
  - Cada box, e a visão casa, tem os seus modos. Troque a box no topo para ver e mudar os dela, em Ajustes, Modo de uso.
  - Quem já usava o app continua com os mesmos modos em todas as boxes, até mudar.
```

  Valide o formato lendo `changelog.d/README.md`. (Não rode `npm run release` no branch.)

- [ ] **Passo 4: `docs/superpowers/README.md`.** Acrescente depois da linha de `modo-simples-avancado.md`:

```
| 2026-10-08 | [modo-por-box.md](plans/2026-10-08-modo-por-box.md) | Implementação do modo de uso por box. | implementada | [modo-por-box-design.md](specs/2026-10-08-modo-por-box-design.md) |
```

  Se o README tiver também uma tabela só de specs, acrescente a linha lá no mesmo formato das vizinhas.

- [ ] **Passo 5: verificação.** `npm test` completo → verde (inclui o teste do dossiê; se acusar dossiê desatualizado, rode `npm run dossie` e commite `docs/dossie/`). `npm run build` → sem erro. `node scripts/verificar-dados-reais.mjs` → sem achado novo.

- [ ] **Passo 6: commit.** `docs: modo de uso por box (domínio, wiki, changelog)`.

---

## Depois das tarefas (sessão principal, não subagente)

1. Auditoria do diff pelo advisor contra a spec.
2. Varredura com Playwright (Galaxy S25+, `npx vite` do worktree em porta própria, dados sintéticos): duas boxes com modos diferentes, troca no topo, visão casa, Ajustes → Modo de uso. Capturas enviadas ao usuário.
3. Ciclo de entrega (skill `ciclo-de-entrega`): fragmento mostrado, merge na `main`, `npm run release`, push, `npm run deploy`.
