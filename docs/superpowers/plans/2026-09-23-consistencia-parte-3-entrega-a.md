# Consistência entre telas, parte 3, entrega A — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar o progresso.

**Objetivo:** um padrão só de formulário nas oito subtelas de Ajustes que cadastram coisas — criar no topo, editar na própria linha pelo lápis, um primário por formulário, campos ocupando a largura toda.

**Arquitetura:** duas classes CSS novas (`.form-linha`, `.form-botoes`) dão a largura; cada tela extrai um componente local de campos (ex.: `FormViagem`) e o usa no topo, para criar, e dentro do item aberto, para editar. A Tarefa 1 faz a referência em Viagens; as seguintes repetem o padrão.

**Stack:** React 18 + TypeScript, Vitest + Testing Library (jsdom, fake-indexeddb), `lucide-react` (já instalado).

**Spec:** `docs/superpowers/specs/2026-09-23-consistencia-parte-3-design.md`, entrega A.

## Restrições globais

- Todo texto de UI, teste, commit e doc em português. Nenhuma dependência nova. Não mexer em `scripts/`, `vite.config.ts`, `tsconfig.json`, scripts do `package.json` nem `.claude/`. Não editar `"version"` do `package.json` nem o topo do `CHANGELOG.md`.
- Toda subtela abre com o próprio `h2` (nome da tela). O formulário de criação fica no topo, com `h2` "Nova …"/"Novo …", antes da lista.
- Editar: `button.botao` com o ícone `Pencil` (`lucide-react`, `size={16}`) e `aria-label="Editar"`. Tocar abre os campos dentro do item (`.item.item-coluna` quando o formulário tem várias linhas). Um item aberto por vez.
- **Enquanto um item está aberto, o formulário de criação do topo (e o `h2` "Nova …") não aparece.** Cancelar ou Salvar o traz de volta.
- Botões: um único `.botao-primario` por formulário (Criar ou Salvar). Ordem **Cancelar, Salvar**, à direita. O formulário de criação não tem Cancelar.
- Largura (aprovada no mockup — "sem espaço sobrando dos lados"):
  - formulário de um campo só: o campo e os botões na mesma `.form-linha`;
  - vários campos: cada linha de campos é uma `.form-linha` (os campos dividem a linha por igual); os botões vão numa `.form-botoes` própria.
  - nada de `style={{ width: … }}` fixo em campo.
- Nenhuma regra de negócio muda: validações, avisos e chamadas `repo.*` continuam as mesmas; o Salvar do item aberto chama o que o Salvar do topo chamava ao editar.
- Testes: nunca afrouxar asserção existente; se a marcação mudou, ajuste só o seletor. Todo teste "aparece/não aparece" tem de falhar com o código antigo. Não passar `{ timeout }` a `findBy*`. Textos com valor em real: `formatarBRL(x).replace(/\s/g, ' ')`.
- Commits em português, com as linhas de coautoria da sessão. Depois de cada commit, `git status --short` vazio.

## Arquivos

- `src/styles.css`, `docs/estilo/catalogo.md` — `.form-linha`, `.form-botoes`.
- `src/ui/ajustes/{Viagens,Cartoes,Recorrencias,Assinaturas,Boxes,Bancos,Categorias,CategoriasCartao}.tsx` e os `.test.tsx`.
- `docs/estilo/nivel-5-nova-tela.md`, `docs/wiki/7-ajustes.md`, `docs/dossie/`, `changelog.d/alterado-formularios-ajustes.md`.

---

### Tarefa 0: mockup aprovado

Aprovado pelo usuário em 2026-09-23 (`mockup-ajustes-entrega-a.html`, versão 2, no scratchpad da sessão): edição na linha, formulário do topo some durante a edição, campos ocupando a largura toda.

---

### Tarefa 1: classes de largura e a referência em Viagens

**Arquivos:** `src/styles.css`, `docs/estilo/catalogo.md`, `src/ui/ajustes/Viagens.tsx`, `src/ui/ajustes/Viagens.test.tsx`

**Produz:** as classes `.form-linha` e `.form-botoes`; o padrão (componente local de campos + item aberto) que as Tarefas 2 a 7 repetem.

- [ ] **Passo 1: testes que falham**, em `Viagens.test.tsx` (siga a montagem dos testes existentes):
  1. Tocar no lápis (`getByRole('button', { name: 'Editar' })`) abre os campos **dentro do item** (`within(item)` do item da viagem tem `getByLabelText('Nome')` com o nome atual) e o `h2` "Nova viagem" **some**.
  2. No item aberto, os botões aparecem na ordem Cancelar, Salvar (`within(item).getAllByRole('button')` — confira que "Cancelar" vem antes de "Salvar"), e Salvar tem a classe `botao-primario`.
  3. Cancelar fecha o item sem gravar e traz "Nova viagem" de volta.
  4. O teste existente "edita uma viagem existente" continua passando, agora editando pelos campos do item.
  5. O formulário de criação não tem botão Cancelar.
- [ ] **Passo 2: ver falhar** — `npx vitest run src/ui/ajustes/Viagens.test.tsx`.
- [ ] **Passo 3: CSS** — leia `docs/estilo-visual.md` e `docs/estilo/nivel-2-nova-classe.md`. Em `src/styles.css`, perto de `.campo` (classes de formulário ficam juntas, regra 8 do nível 2):

```css
/* linha de formulário: os campos dividem a largura por igual; botões na mesma linha ficam no fim */
.form-linha { display: flex; gap: 8px; align-items: flex-end; }
.form-linha > .campo { flex: 1; min-width: 0; }
.form-linha > .campo input, .form-linha > .campo select, .form-linha > .campo .campo-data { width: 100%; }
.form-linha > .botao { flex: 0 0 auto; }
/* botões de um formulário de várias linhas: à direita, primário por último */
.form-botoes { display: flex; gap: 8px; justify-content: flex-end; }
```

  Se `.campo-data` (do `CampoData`) não ocupar a largura com isso (ela é `inline-flex`), acrescente `.form-linha > .campo .campo-data { display: flex; }` e registre no relatório.

  Em `docs/estilo/catalogo.md`, uma linha na tabela de classes compartilhadas, perto de `.campo` / `.linha`:

```markdown
| `.form-linha` / `.form-botoes` | largura dos formulários de Ajustes: `.form-linha` põe campos lado a lado dividindo a largura por igual (e, em formulário de um campo só, os botões no fim da mesma linha); `.form-botoes` é a linha de botões de um formulário de várias linhas, à direita, na ordem Cancelar, Salvar |
```

- [ ] **Passo 4: Viagens** — reescreva `src/ui/ajustes/Viagens.tsx` assim (mantendo as mensagens e as validações atuais):

```tsx
import { Pencil } from 'lucide-react';
import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { formatarDataBR } from '../../domain/dates';
import type { Viagem } from '../../domain/types';
import { viagensSobrepoem } from '../../domain/viagem';
import { useApp } from '../../state/store';
import CampoData from '../CampoData';

interface CamposViagem { nome: string; dataInicio: string; dataFim: string }

/** Campos de uma viagem, usados para criar (no topo) e para editar (dentro do item). */
function FormViagem({ inicial, idExcluido, rotuloSalvar, onSalvo, onCancelar }: {
  inicial: CamposViagem;
  idExcluido?: string;
  rotuloSalvar: 'Criar' | 'Salvar';
  onSalvo: (campos: CamposViagem) => Promise<void>;
  onCancelar?: () => void;
}) {
  const { dados } = useApp();
  const [nome, setNome] = useState(inicial.nome);
  const [dataInicio, setDataInicio] = useState(inicial.dataInicio);
  const [dataFim, setDataFim] = useState(inicial.dataFim);
  const [aviso, setAviso] = useState('');
  const uid = useId();

  async function salvar() {
    if (!nome.trim() || !dataInicio || !dataFim) {
      setAviso('Preencha nome, início e fim para salvar.');
      return;
    }
    if (dataFim < dataInicio) {
      setAviso('A data final não pode ser anterior à data inicial.');
      return;
    }
    if (viagensSobrepoem(dados!.viagens, dataInicio, dataFim, idExcluido)) {
      setAviso('Já existe uma viagem cadastrada nesse período.');
      return;
    }
    setAviso('');
    await onSalvo({ nome: nome.trim(), dataInicio, dataFim });
  }

  return (
    <>
      {aviso && <p className="aviso">{aviso}</p>}
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-nome`}>Nome</label>
          <input id={`${uid}-nome`} placeholder="ex.: Praia em janeiro" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
      </div>
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-inicio`}>Data inicial</label>
          <CampoData id={`${uid}-inicio`} value={dataInicio} onChange={setDataInicio} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-fim`}>Data final</label>
          <CampoData id={`${uid}-fim`} value={dataFim} onChange={setDataFim} />
        </div>
      </div>
      <div className="form-botoes">
        {onCancelar && <button className="botao" onClick={onCancelar}>Cancelar</button>}
        <button className="botao botao-primario" onClick={salvar}>{rotuloSalvar}</button>
      </div>
    </>
  );
}

export default function Viagens() {
  const { dados, recarregar, hoje } = useApp();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // Muda a cada criação para o formulário do topo voltar vazio (remonta com `key`).
  const [versaoNova, setVersaoNova] = useState(0);
  if (!dados) return null;

  const viagensOrdenadas: Viagem[] = [...dados.viagens].sort((a, b) => (a.dataInicio < b.dataInicio ? 1 : -1));

  async function criar(campos: CamposViagem) {
    await repo.salvarViagem(campos);
    setVersaoNova((v) => v + 1);
    await recarregar();
  }

  async function atualizar(id: string, campos: CamposViagem) {
    await repo.atualizarViagem(id, campos);
    setEditandoId(null);
    await recarregar();
  }

  async function excluir(id: string) {
    if (!window.confirm('Excluir esta viagem? Os lançamentos e compras marcados continuam existindo, só perdem a marcação de viagem.')) return;
    await repo.excluirViagem(id);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Viagens</h2>
      {!editandoId && (
        <>
          <h2>Nova viagem</h2>
          <FormViagem key={versaoNova} inicial={{ nome: '', dataInicio: hoje, dataFim: hoje }} rotuloSalvar="Criar" onSalvo={criar} />
        </>
      )}

      <div className="lista">
        {viagensOrdenadas.map((v) => (
          editandoId === v.id ? (
            <div className="item item-coluna" key={v.id}>
              <FormViagem
                inicial={{ nome: v.nome, dataInicio: v.dataInicio, dataFim: v.dataFim }}
                idExcluido={v.id} rotuloSalvar="Salvar"
                onSalvo={(campos) => atualizar(v.id, campos)} onCancelar={() => setEditandoId(null)}
              />
            </div>
          ) : (
            <div className="item" key={v.id}>
              <div className="cresce">
                {v.nome}
                <div className="sub">{formatarDataBR(v.dataInicio)} – {formatarDataBR(v.dataFim)}</div>
              </div>
              <button className="botao" aria-label="Editar" onClick={() => setEditandoId(v.id)}><Pencil size={16} /></button>
              <button className="botao botao-perigo" onClick={() => excluir(v.id)}>Excluir</button>
            </div>
          )
        ))}
        {viagensOrdenadas.length === 0 && <p className="sub">Nenhuma viagem cadastrada.</p>}
      </div>
    </div>
  );
}
```

  O título de grupo ("Cadastradas") é da entrega B — não acrescente agora.

- [ ] **Passo 5: ver passar** — `npx vitest run src/ui/ajustes/Viagens.test.tsx`; depois `npm test`, `npm run build`, `node scripts/verificar-catalogo.mjs --strict`. O dossiê pode acusar diferença: não regenere (Tarefa 8); registre.
- [ ] **Passo 6: commit** — `feat(ajustes): Viagens no padrão de formulário (editar na linha)`.

---

### Tarefas 2 a 4: Cartões, Recorrências, Assinaturas

Mesmo padrão da Tarefa 1, uma tarefa e um commit por tela. Em cada uma:

- Extraia os campos do formulário atual para um componente local (`FormCartao`, `FormRecorrencia`, `FormAssinatura`) com `inicial`, `rotuloSalvar`, `onSalvo`, `onCancelar?` — as validações e avisos que hoje ficam em `salvar()` vão para dentro dele, como em `FormViagem`. O que depende do item (ex.: `original` no Salvar de edição) vai na função `atualizar(id, campos)` da tela.
- Topo: `h2` da tela; `{!editandoId && <> h2 "Novo …"/"Nova …" + formulário com key </>}`.
- Lista: o item em edição vira `.item.item-coluna` com o formulário e `onCancelar`; o item fechado troca o botão "Editar" pelo lápis. Os outros botões da linha fechada não mudam.
- Largura: cada linha de campos numa `.form-linha`, sem `width` fixo (os dois dias do cartão dividem a linha; o `<select>` de banco ocupa a linha). Botões numa `.form-botoes`. Assinaturas deixa de empilhar os botões.
- Testes da tela: os mesmos 5 casos da Tarefa 1 (lápis abre no item e some o "Novo …"; ordem Cancelar, Salvar com Salvar primário; Cancelar não grava e traz o topo de volta; o teste de edição existente passa pelo item; criação sem Cancelar).
- Textos de liga/desliga ("Pausar", "Desativar") e títulos de grupo **não mudam** nesta entrega.

**Tarefa 2 — `Cartoes.tsx`:** ganha o `h2` "Cartões" no topo (hoje só tem "Novo cartão"/"Editar cartão"). Commit `feat(ajustes): Cartões no padrão de formulário`.

**Tarefa 3 — `Recorrencias.tsx`:** o seletor de categoria (grade) e Gasto/Ganho entram no `FormRecorrencia` como estão hoje (o controle vira pílula só na entrega B). Commit `feat(ajustes): Recorrências no padrão de formulário`.

**Tarefa 4 — `Assinaturas.tsx`:** idem; atenção ao cartão escolhido (`.pills`) e aos estados vazios que já existem na tela (sem cartão, sem categoria). Commit `feat(ajustes): Assinaturas no padrão de formulário`.

---

### Tarefa 5: Boxes

- "Nova box" sobe para o topo, antes da lista, com `h2` "Nova box": uma `.form-linha` com o campo "Nome" e o botão Criar na mesma linha (mockup, quadro 6). O `aviso` continua aparecendo logo acima.
- Cada box vira um `.item` fechado: nome em `strong`, saldo em `.sub` (o texto de hoje), o selo "padrão" ou o botão "Tornar padrão" (como hoje), e o lápis. O `EditorBox` sai de dentro de cada card e passa a abrir no item, pelo lápis, em `.item.item-coluna`, com Cancelar e Salvar numa `.form-botoes`. Hoje o `EditorBox` não tem Cancelar: acrescente, fechando sem gravar.
- Os campos do `EditorBox` seguem a largura: nome numa `.form-linha`; a caixa "Esta box tem saldo próprio" na linha dela; saldo e data numa `.form-linha` (sem o `width: 100` do nome).
- Enquanto uma box está aberta, "Nova box" some.
- Testes: os 5 casos da Tarefa 1, adaptados (o formulário de criação tem um campo só: confira que Criar está na mesma `.form-linha` do campo).
- Commit `feat(ajustes): Boxes no padrão de formulário`.

---

### Tarefa 6: Bancos

Bancos já edita na linha. Mudanças: o botão "Editar" (texto) vira o lápis; a ordem dos botões do item aberto fica Cancelar, Salvar numa `.form-botoes` (se hoje for outra); os campos seguem a largura (`.form-linha`, sem `width` fixo); o formulário de criação do topo some enquanto um banco está aberto; `h2` "Novo banco" no formulário de criação se ele não tiver título. Testes: lápis, ordem, some/volta, criação sem Cancelar. Commit `feat(ajustes): Bancos no padrão de formulário`.

---

### Tarefa 7: Categorias e Categorias do cartão

As duas já editam na linha, com lápis. Mudanças, nas duas:
- Item aberto numa linha só: `.form-linha` com o campo, Cancelar e Salvar, **nessa ordem** (hoje Salvar vem antes). O rótulo do campo continua "Editar nome".
- O formulário de criação do topo: `h2` "Nova categoria" (se não tiver) e uma `.form-linha` com o campo e Criar na mesma linha — o `<select>` de tipo em Categorias fica como está hoje (vira pílula na entrega B), dentro da mesma `.form-linha` se couber, senão numa `.form-linha` própria acima.
- O formulário de criação some enquanto uma categoria está aberta.
- A alça de arrastar e o reordenar continuam iguais.
- "Arquivados" **não muda** agora (entrega B).
- Testes nas duas telas: ordem Cancelar, Salvar; some/volta do formulário de criação; o reordenar existente continua passando.
- Commit `feat(ajustes): Categorias no padrão de formulário`.

---

### Tarefa 8: guia, wiki, dossiê e fragmento

- [ ] **Guia:** em `docs/estilo/nivel-5-nova-tela.md`, seção "Integração", logo depois da regra 10, uma regra 11:

```markdown
11. **Padrão de formulário de subtela de Ajustes:** criar no topo (formulário sem Cancelar);
    editar na própria linha, pelo lápis (`Pencil`, `aria-label="Editar"`), com os mesmos campos
    da criação num componente local; um item aberto por vez, e o formulário de criação some
    enquanto isso (regra 6: um primário por tela); botões Cancelar, Salvar, à direita, Salvar
    primário; campos em `.form-linha`, ocupando a largura toda.
```

- [ ] **Wiki:** `docs/wiki/7-ajustes.md` — onde descrever edição nas subtelas (procure "Editar" e cada seção: Boxes, Bancos, Categorias, Cartões, Recorrências, Assinaturas, Viagens), diga que editar é pelo lápis no próprio item, e que o formulário de cima é só para criar. Não invente comportamento; leia `docs/wiki/README.md` e valide com `npx vitest run src/ui/ajustes/capitulos.test.ts`.
- [ ] **Dossiê:** `npm run dossie`; liste toda linha que mudou; o esperado é "Editar" → botão do lápis e a posição de "Nova box". Inclua no commit.
- [ ] **Fragmento** `changelog.d/alterado-formularios-ajustes.md`:

```markdown
- As telas de cadastro em Ajustes passam a funcionar do mesmo jeito.
  - O formulário de cima serve para criar; para editar, toque no lápis do próprio item.
  - O item abre ali mesmo, com os mesmos campos da criação, e Cancelar e Salvar à direita.
  - Os campos ocupam a largura toda da tela.
  - Nova box fica no topo da tela, como nas outras.
```

- [ ] `npm test` (tudo verde), `npm run build`, `node scripts/verificar-dados-reais.mjs`, `node scripts/verificar-catalogo.mjs --strict`. Commit `docs: guia, wiki, dossiê e fragmento dos formulários de Ajustes`; `git status --short` vazio depois. Parar: o fragmento espera a confirmação do usuário.
