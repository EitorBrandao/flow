# Plano D2 — Retorno em todo salvar e botões alinhados

> **Para quem executa:** use a skill `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** toda gravação feita pela interface diz que gravou, pelo aviso de retorno. Todo botão Fechar ou Cancelar que divide a linha com a ação principal ganha o contorno.

**Arquitetura:** nenhum componente novo. Cada ponto de gravação chama `avisar(texto)` depois do `recarregar()`. Os dois avisos de "Lançado ✓" embutidos na tela Lançar migram para o mesmo aviso. Os dois painéis de resultado de transferência ficam como estão, porque mostram dados que o aviso não comporta.

**Stack:** React 18, TypeScript, Zustand, Vitest, Testing Library.

**Depende de:** plano D1 entregue (`avisar`, `Retorno`, `.botao-discreto`, `docs/estilo/interacao.md`).

**Spec:** `docs/superpowers/specs/2026-11-15-confirmacao-retorno-e-pendentes-design.md`.

## Restrições globais

- Antes de editar a UI, leia `docs/estilo-visual.md`, `docs/estilo/nivel-1-editar-tela.md` e `docs/estilo/interacao.md`.
- Nenhuma classe nova, nenhum componente novo, nenhuma dependência nova.
- Textos exatamente como nas tabelas deste plano: frase curta, no passado, sem ponto final.
- O aviso entra **depois** de `await recarregar()` e só no caminho em que a gravação aconteceu. Um retorno antecipado por validação não avisa.
- O aviso de validação (`.aviso` abaixo do botão) não muda.
- Não aperte timeouts de teste. Não use `{ timeout: n }` em `findBy*`.
- Os números de linha são da `main` em `a643c4f` e do que o plano D1 mudou. Confira cada um com `grep -n "await repo\." <arquivo>` antes de editar.
- Mudança visível: fragmento, wiki, varredura, release e deploy pela skill `ciclo-de-entrega`.

## Modelo por tarefa

| Tarefa | Complexidade | Implementa | Revisa |
|---|---|---|---|
| 1 Lançar e editor | intermediária | Haiku | Sonnet, depois Opus |
| 2 Hoje e cartão | intermediária | Haiku | Sonnet, depois Opus |
| 3 Cenários | intermediária | Haiku | Sonnet, depois Opus |
| 4 Ajustes | intermediária | Haiku | Sonnet, depois Opus |
| 5 Contorno em Cancelar e Fechar | intermediária | Haiku | Sonnet, depois Opus |
| 6 Trava de cobertura | intermediária | Sonnet | Opus |
| 7 Wiki, changelog, varredura | intermediária | sessão principal | Opus |

Paralelismo: 1 a 5 tocam arquivos diferentes, salvo o que está marcado. A Tarefa 5 toca arquivos das Tarefas 2, 3 e 4: rode-a depois delas. A 6 vem por último.

## O padrão

Em todo ponto, a mudança é a mesma. Onde o componente já desestrutura `useApp()`, acrescente `avisar`:

```tsx
const { dados, recarregar, avisar } = useApp();
```

Onde o componente usa seletores, acrescente:

```tsx
const avisar = useApp((s) => s.avisar);
```

E, depois da gravação:

```tsx
await repo.salvarViagem(dados);
await recarregar();
avisar('Viagem criada');
```

O teste de cada ponto é o mesmo desenho: faça a ação pela tela e confira `useApp.getState().retorno?.texto`. Em todo arquivo de teste tocado, acrescente ao `beforeEach`: `useApp.setState({ retorno: null });`.

```tsx
it('criar uma viagem avisa "Viagem criada"', async () => {
  // ...montagem que o arquivo já usa para criar uma viagem pela tela...
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
  await waitFor(() => expect(useApp.getState().retorno?.texto).toBe('Viagem criada'));
});

it('criar sem nome não avisa', async () => {
  // ...mesma tela, com o nome vazio...
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
  expect(await screen.findByText(/Dê um nome/)).toBeInTheDocument();
  expect(useApp.getState().retorno).toBeNull();
});
```

Para cada linha das tabelas abaixo: um teste do caminho que grava. Para cada formulário com validação: um teste de que a validação recusada **não** avisa.

---

### Tarefa 1: Lançar e editor de lançamento

**Arquivos:** `src/ui/TelaLancar.tsx`, `src/ui/LancEditor.tsx`; testes `TelaLancar.test.tsx`, `LancEditor.test.tsx`.

| Arquivo:linha | Gravação | Aviso |
|---|---|---|
| `TelaLancar.tsx:172` | `salvarLancamento` (modo Simples) | `Lançado` |
| `TelaLancar.tsx:198` | `salvarLancamento` (modo Avançado), status efetivo | `Lançado` |
| `TelaLancar.tsx:198` | o mesmo, quando o status gravado é `previsto` | `Previsto criado` |
| `LancEditor.tsx:40` | `atualizarLancamento`, com `confirmarTb` falso | `Alteração salva` |
| `LancEditor.tsx:40` | o mesmo, com `confirmarTb` verdadeiro | `Lançamento confirmado` |

- [ ] **Passo 1: testes.** Em `TelaLancar.test.tsx`, todo teste que procura o texto `Lançado ✓` na tela passa a conferir `useApp.getState().retorno?.texto` igual a `Lançado`. Acrescente: lançar com data futura avisa `Previsto criado`; tocar em Lançar sem valor não avisa. Em `LancEditor.test.tsx`: Salvar avisa `Alteração salva`; Confirmar avisa `Lançamento confirmado`; valor zerado mostra "Valor inválido." e não avisa.

- [ ] **Passo 2:** rode `npx vitest run src/ui/TelaLancar.test.tsx src/ui/LancEditor.test.tsx`. Esperado: os testes novos falham.

- [ ] **Passo 3: `TelaLancar.tsx`.** O estado `salvo` e o `salvoTimeoutRef` deixam de existir: o aviso de retorno já some sozinho.

- Apague `const [salvo, setSalvo] = useState(false)`, a declaração de `salvoTimeoutRef`, e qualquer `useEffect` que só limpe esse timeout.
- No modo Simples, troque as três linhas depois de `await recarregar();` por:

```tsx
      // O atalho vale para um lançamento só: o seguinte volta à regra da descrição.
      setCents(0); setNota(''); setCategoriaId(null);
      avisar('Lançado');
```

- No modo Avançado (`lancar`), guarde o status numa constante antes de gravar e use-a no aviso:

```tsx
      const status = previsto ? 'previsto' : (data > hoje ? 'previsto' : 'efetivo');
      await repo.salvarLancamento({
        boxId: boxId!, categoriaId: categoriaId!, data, valor: cents,
        ...(nota ? { nota } : {}),
        status,
        ...(viagemAtiva && viagemMarcada ? { viagemId: viagemAtiva.id } : {}),
        ...(bancoId ? { bancoId } : {}),
      });
      await recarregar();
      avisar(status === 'previsto' ? 'Previsto criado' : 'Lançado');
```

Mantenha o que a função faz depois (limpar campos) e tire só as linhas de `setSalvo` e do timeout.

- Apague as duas linhas `{salvo && <p className="aviso aviso-sucesso">Lançado ✓</p>}` (248 e 306).

- [ ] **Passo 4: `LancEditor.tsx`.** Em `aplicar`, depois de `await recarregar();`:

```tsx
    avisar(confirmarTb ? 'Lançamento confirmado' : 'Alteração salva');
```

- [ ] **Passo 5:** rode os dois arquivos de teste, depois `npm test`. Esperado: tudo passa.

- [ ] **Passo 6: commit**

```bash
git add src/ui/TelaLancar.tsx src/ui/TelaLancar.test.tsx src/ui/LancEditor.tsx src/ui/LancEditor.test.tsx
git commit -m "feat(ui): lançar e editar avisam pelo aviso de retorno"
```

---

### Tarefa 2: Hoje e cartão

**Arquivos:** `src/ui/TelaHoje.tsx`, `CartaoSimples.tsx`, `TelaCartao.tsx`, `FormCompra.tsx`, `PagamentoFaturaSheet.tsx`; testes de cada um.

| Arquivo:linha | Gravação | Aviso |
|---|---|---|
| `TelaHoje.tsx:487-488` | `salvarConfig` + `salvarBox` (saldo real, função `salvarSaldoReal`) | `Saldo conferido` |
| `TelaHoje.tsx:512` | `atualizarBanco` (função `salvarSaldosBancos`) | `Saldos conferidos` |
| `TelaHoje.tsx:516` | `salvarBox` (função `salvarConferenciaCasa`) | `Saldos conferidos` |
| `CartaoSimples.tsx:73` | `salvarConferenciaFatura` | `Fatura salva` |
| `CartaoSimples.tsx:97` | `confirmarPendente` (pagar a fatura) | `Fatura paga` |
| `TelaCartao.tsx:37` e `:52` | `salvarConferenciaFatura` | `Valor da fatura salvo` |
| `TelaCartao.tsx:44` | `removerConferenciaFatura` | `Valor da fatura removido` |
| `TelaCartao.tsx:112` | `salvarAjusteFechamento` | `Fechamento ajustado` |
| `TelaCartao.tsx:118` | `removerAjusteFechamento` | `Ajuste de fechamento removido` |
| `FormCompra.tsx:189` | `atualizarCompraCartao` | `Compra salva` |
| `FormCompra.tsx:192` | `salvarCompraCartao` | `Compra lançada` |
| `PagamentoFaturaSheet.tsx:92` | `registrarPagamentoFatura` | `Pagamento registrado` |

Não avisam, de propósito:

- `TelaHoje.tsx:169` (`transferirEntreBancos`) e `TransferirEntreBoxes.tsx:95`: a tela já mostra um painel com o saldo antes e depois. O painel fica.
- `TelaHoje.tsx:536` e `:541` (`confirmarPendente`): o plano E dá a esses dois o aviso com Desfazer.
- `FormCompra.tsx:196` e `:199` (`salvarCnpjCategoria`, `salvarNotaFiscal`): fazem parte do mesmo salvar da compra. Um aviso só, o da compra.

- [ ] **Passo 1:** escreva os testes da tabela, pelo padrão. Casos-limite obrigatórios: "Salvar" a conferência sem mudar nada **não** avisa (confira primeiro, lendo `salvarSaldoReal` e `salvarSaldosBancos`, se a função grava nesse caso; se grava, ela passa a sair antes de gravar quando nada mudou, e o teste cobre os dois lados); salvar a compra com campo obrigatório faltando não avisa.

- [ ] **Passo 2:** rode os testes dos cinco arquivos. Esperado: os novos falham.

- [ ] **Passo 3:** aplique o padrão em cada linha da tabela.

- [ ] **Passo 4:** rode os testes dos cinco arquivos, depois `npm test`. Esperado: tudo passa.

- [ ] **Passo 5: commit**

```bash
git add src/ui/TelaHoje.tsx src/ui/CartaoSimples.tsx src/ui/TelaCartao.tsx src/ui/FormCompra.tsx src/ui/PagamentoFaturaSheet.tsx src/ui/*.test.tsx
git commit -m "feat(ui): conferência, fatura e compra avisam ao gravar"
```

---

### Tarefa 3: Cenários

**Arquivos:** `src/ui/FormItemCenario.tsx`, `ItemCenarioSheet.tsx`, `CenarioCard.tsx`, `SimuladorFluxo.tsx`, `SimuladorSimples.tsx`; testes de cada um.

| Arquivo:linha | Gravação | Aviso |
|---|---|---|
| `FormItemCenario.tsx:37` e `:43` | `salvarLancamento` / `salvarRecorrencia` (item novo) | nenhum aqui: quem avisa é quem chamou, pelo `onSalvar` |
| `ItemCenarioSheet.tsx:35` e `:38` | `atualizarLancamento` / `salvarRecorrencia` (editar item) | `Item salvo` |
| `CenarioCard.tsx:41` | `salvarCenario` (ligar ou desligar) | nenhum: o quadradinho já mostra o estado novo |
| `CenarioCard.tsx`, formulário "Novo item" | o `onSalvar` do `FormItemCenario` | `Item adicionado` |
| `SimuladorFluxo.tsx:75` | `salvarCenario` (criar cenário) | `Cenário criado` |
| `SimuladorSimples.tsx:92` e `:133` | `salvarCenario` | leia as duas funções: a que cria avisa `Cenário criado`; a que renomeia ou liga não avisa |

- [ ] **Passo 1:** leia `FormItemCenario.tsx` inteiro e ache quem lhe passa `onSalvar` (`grep -rn "FormItemCenario" src/ui --include=*.tsx`). O aviso entra no chamador, depois do `recarregar()` dele.

- [ ] **Passo 2:** escreva os testes pelo padrão. Casos-limite: ligar e desligar um cenário não avisa; salvar item com valor zerado não avisa.

- [ ] **Passo 3:** rode, veja falhar, aplique, rode de novo, depois `npm test`.

- [ ] **Passo 4: commit**

```bash
git add src/ui/FormItemCenario.tsx src/ui/ItemCenarioSheet.tsx src/ui/CenarioCard.tsx src/ui/SimuladorFluxo.tsx src/ui/SimuladorSimples.tsx src/ui/*.test.tsx
git commit -m "feat(ui): cenários avisam ao gravar"
```

---

### Tarefa 4: Ajustes

**Arquivos:** os dez de `src/ui/ajustes/` da tabela; testes de cada um (crie o arquivo de teste que não existir, seguindo `Viagens.test.tsx`).

| Arquivo:linha | Gravação | Aviso |
|---|---|---|
| `Bancos.tsx:67` | `salvarBanco` | `Banco criado` |
| `Bancos.tsx:100` | `atualizarBanco` | `Banco salvo` |
| `Bancos.tsx:114` | `definirBancoPadrao` | `Banco padrão definido` |
| `Boxes.tsx:110` | `salvarBox` (criar) | `Box criada` |
| `Boxes.tsx:127` | `salvarBox` (editar) | `Box salva` |
| `Boxes.tsx:133` | `salvarConfig` (box padrão) | `Box padrão definida` |
| `Cartoes.tsx:115` | `salvarCartao` (criar) | `Cartão criado` |
| `Cartoes.tsx:123`, `:130`, `:137` | `salvarCartao` | leia as três funções: editar avisa `Cartão salvo`; arquivar avisa `Cartão arquivado`; reativar avisa `Cartão reativado` |
| `Categorias.tsx:113`, `:127` | `salvarCategoria` | `Categoria criada`; a criação em lote das sugeridas avisa `Categorias criadas` |
| `Categorias.tsx:161`, `:183` | `atualizarCategoria` | editar avisa `Categoria salva`; arquivar avisa `Categoria arquivada`; reordenar não avisa |
| `CategoriasCartao.tsx:114` | `salvarCategoriaCartao` | `Categoria criada` |
| `CategoriasCartao.tsx:127`, `:159` | `atualizarCategoriaCartao` | `Categoria salva`; arquivar avisa `Categoria arquivada`; reordenar não avisa |
| `Recorrencias.tsx:170` | `salvarRecorrencia` (criar) | `Recorrência criada` |
| `Recorrencias.tsx:183`, `:190` | `salvarRecorrencia` | editar avisa `Recorrência salva`; pausar e retomar avisam `Recorrência pausada` e `Recorrência retomada` |
| `Assinaturas.tsx:142` | `salvarAssinatura` (criar) | `Assinatura criada` |
| `Assinaturas.tsx:152`, `:159` | `salvarAssinatura` | editar avisa `Assinatura salva`; pausar e retomar avisam `Assinatura pausada` e `Assinatura retomada` |
| `Viagens.tsx:91` | `salvarViagem` | `Viagem criada` |
| `Viagens.tsx:97` | `atualizarViagem` | `Viagem salva` |
| `ModoDeUso.tsx:46-47` | `salvarModoBox` / `salvarModo` | nenhum: a opção marcada já mostra o estado novo |
| `Backup.tsx:44` | `salvarConfig` (depois de exportar) | nenhum: a tela já diz "Backup exportado." |

Onde a tabela diz "leia as três funções", o nome da função no arquivo diz o que ela faz. Se uma função não for nenhum dos casos descritos, pare e pergunte ao orquestrador; não invente um texto.

Regra geral desta tabela, para um caso que ela não previu: ação que o próprio controle já mostra (alternância, reordenação por arrasto) não avisa; ação que fecha um formulário ou muda uma lista avisa.

- [ ] **Passo 1:** escreva os testes pelo padrão: um por linha que avisa, um de validação recusada por formulário, e um de "reordenar não avisa" em `Categorias` e `CategoriasCartao`.

- [ ] **Passo 2:** rode `npx vitest run src/ui/ajustes`. Esperado: os novos falham.

- [ ] **Passo 3:** aplique o padrão.

- [ ] **Passo 4:** rode `npx vitest run src/ui/ajustes`, depois `npm test`. Esperado: tudo passa.

- [ ] **Passo 5: commit**

```bash
git add src/ui/ajustes/
git commit -m "feat(ajustes): toda gravação avisa pelo aviso de retorno"
```

---

### Tarefa 5: Contorno em Cancelar e Fechar

**Arquivos e linhas** (da `main` em `a643c4f`; confira com `grep -rn ">Fechar</button>\|>Cancelar</button>" src/ui --include=*.tsx`):

| Arquivo:linha | Botão | Muda? |
|---|---|---|
| `ajustes/Assinaturas.tsx:89` | Cancelar | sim |
| `ajustes/Bancos.tsx:199` | Cancelar | sim |
| `ajustes/Boxes.tsx:76` | Cancelar | sim |
| `ajustes/Cartoes.tsx:79` | Cancelar | sim |
| `ajustes/Categorias.tsx:45` | Cancelar | sim |
| `ajustes/CategoriasCartao.tsx:41` | Cancelar | sim |
| `ajustes/Recorrencias.tsx:129` | Cancelar | sim |
| `ajustes/Viagens.tsx:73` | Cancelar | sim |
| `CenarioCard.tsx:158` | Cancelar | sim |
| `EscanearComprovanteSheet.tsx:56` | Cancelar | só se houver ação principal na mesma linha |
| `EscanearNotaSheet.tsx:131` e `:170` | Cancelar | só se houver ação principal na mesma linha |
| `FormCompra.tsx:280` e `:362` | Cancelar | sim |
| `SimuladorFluxo.tsx:97` | Cancelar | sim |
| `TelaHoje.tsx:213` | Cancelar | sim |
| `TelaHoje.tsx:710` | Cancelar (correção do pendente) | sim |
| `TransferirEntreBoxes.tsx:179` | Cancelar | sim |
| `TelaHoje.tsx:320` | Fechar, hoje azul | não: é o único botão do painel de resultado, e é a ação principal dele |
| `TransferirEntreBoxes.tsx:135` | Fechar, hoje azul | não, pelo mesmo motivo |
| `ConfirmarRepetidoSheet.tsx:32`, `ItemCenarioSheet.tsx:61`, `LancEditor.tsx` | — | já feitos no plano D1 |

A regra é a 9 de `docs/estilo/interacao.md`: contorno quando o botão só sai da tela **e** divide a linha com a ação principal. Um Cancelar sozinho na linha fica como está.

- [ ] **Passo 1: teste.** Crie `src/ui/botoesDeSaida.test.ts`:

```ts
// src/ui/botoesDeSaida.test.ts
import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

// Regra 9 de docs/estilo/interacao.md: Fechar e Cancelar têm contorno (.botao-discreto).
// As exceções são painéis em que "Fechar" é a única ação, e por isso a principal.
const RAIZ = path.resolve('src/ui');
const EXCECOES = new Set([
  'TelaHoje.tsx:botao botao-primario',
  'TransferirEntreBoxes.tsx:botao botao-primario',
]);

function fontes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = path.join(dir, e.name);
    if (e.isDirectory()) return fontes(caminho);
    return e.name.endsWith('.tsx') && !e.name.endsWith('.test.tsx') ? [caminho] : [];
  });
}

it('todo botão Fechar ou Cancelar usa .botao-discreto, salvo as exceções declaradas', () => {
  const fora: string[] = [];
  for (const arquivo of fontes(RAIZ)) {
    const linhas = fs.readFileSync(arquivo, 'utf8').split(/\r?\n/);
    linhas.forEach((linha, i) => {
      const m = linha.match(/className="([^"]*)"[^>]*>(?:Fechar|Cancelar)<\/button>/);
      if (!m || m[1].includes('botao-discreto')) return;
      if (EXCECOES.has(`${path.basename(arquivo)}:${m[1]}`)) return;
      fora.push(`${path.relative(RAIZ, arquivo)}:${i + 1}`);
    });
  }
  expect(fora).toEqual([]);
});
```

Se, ao ler os dois sheets de escanear, o Cancelar deles estiver sozinho na linha, acrescente-os às `EXCECOES` com um comentário de uma linha dizendo por quê. A chave da exceção é `arquivo:classes`.

- [ ] **Passo 2:** rode `npx vitest run src/ui/botoesDeSaida.test.ts`. Esperado: falha, listando as linhas da tabela.

- [ ] **Passo 3:** em cada linha marcada "sim", troque `className="botao"` por `className="botao botao-discreto"`. Não mude ordem, texto nem `onClick`.

- [ ] **Passo 4:** rode o teste, depois `npm test`. Esperado: tudo passa. Um teste que procurava o botão pela classe exata `botao` precisa ser ajustado; um que procura pelo nome não muda.

- [ ] **Passo 5: commit**

```bash
git add src/ui/
git commit -m "feat(ui): Cancelar e Fechar com contorno em todas as telas"
```

---

### Tarefa 6: Trava de cobertura do aviso

O risco desta entrega é um ponto de gravação novo nascer sem aviso. Esta trava lista, por arquivo, quantas gravações existem e quantos avisos.

**Arquivos:**
- Criar: `src/ui/retornoEmTodaGravacao.test.ts`

- [ ] **Passo 1: escreva o teste**

```ts
// src/ui/retornoEmTodaGravacao.test.ts
import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

// Regra 5 de docs/estilo/interacao.md: toda gravação dá retorno. Este teste não prova que
// cada gravação avisa — isso é dos testes de cada tela. Ele pega o caso que os testes de tela
// não pegam: um arquivo novo, ou um arquivo antigo, que grava e não chama avisar() nenhuma vez.
const RAIZ = path.resolve('src/ui');
const GRAVA = /await repo\.(salvar|atualizar|excluir|definir|registrar|remover|converter|confirmar|transferir)\w*\(/;

// Arquivos que gravam e não avisam, de propósito. Cada um com o motivo.
const SEM_AVISO: Record<string, string> = {
  'FormItemCenario.tsx': 'quem avisa é o chamador, pelo onSalvar',
  'TransferirEntreBoxes.tsx': 'mostra um painel com o saldo antes e depois',
  'ajustes/ModoDeUso.tsx': 'a opção marcada já mostra o estado novo',
  'ajustes/Backup.tsx': 'a tela já mostra a mensagem do resultado da exportação e da restauração',
  'PrimeiroUso.tsx': 'a tela seguinte é o próprio retorno',
};

function fontes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = path.join(dir, e.name);
    if (e.isDirectory()) return fontes(caminho);
    return e.name.endsWith('.tsx') && !e.name.endsWith('.test.tsx') ? [caminho] : [];
  });
}

it('todo arquivo de tela que grava chama avisar(), salvo as exceções declaradas', () => {
  const mudos = fontes(RAIZ)
    .map((arquivo) => ({ rel: path.relative(RAIZ, arquivo).replace(/\\/g, '/'), texto: fs.readFileSync(arquivo, 'utf8') }))
    .filter(({ texto }) => GRAVA.test(texto) && !/\bavisar\(/.test(texto))
    .map(({ rel }) => rel)
    .filter((rel) => !(rel in SEM_AVISO));

  expect(mudos).toEqual([]);
});

it('nenhuma exceção sobrou depois de o arquivo passar a avisar ou deixar de gravar', () => {
  const sobrando = Object.keys(SEM_AVISO).filter((rel) => {
    const arquivo = path.join(RAIZ, rel);
    if (!fs.existsSync(arquivo)) return true;
    const texto = fs.readFileSync(arquivo, 'utf8');
    return !GRAVA.test(texto) || /\bavisar\(/.test(texto);
  });
  expect(sobrando).toEqual([]);
});
```

- [ ] **Passo 2:** rode `npx vitest run src/ui/retornoEmTodaGravacao.test.ts`. O primeiro teste lista o que ficou mudo. Para cada arquivo listado: ou ele foi esquecido numa tarefa (volte e corrija), ou é uma exceção legítima (acrescente a `SEM_AVISO` com o motivo). `PrimeiroUso.tsx` está na lista por previsão: se ele não gravar pelo `repo`, o segundo teste acusa, e você tira a linha.

- [ ] **Passo 3:** rode `npm test`. Esperado: tudo passa.

- [ ] **Passo 4: commit**

```bash
git add src/ui/retornoEmTodaGravacao.test.ts
git commit -m "test(ui): todo arquivo de tela que grava dá retorno"
```

---

### Tarefa 7: Guia, wiki, changelog e varredura

- [ ] **Passo 1: guia.** Em `docs/estilo/interacao.md`, troque a seção "Onde está aplicado" por:

```markdown
## Onde está aplicado

Em todas as telas. Dois testes guardam as regras: `src/ui/retornoEmTodaGravacao.test.ts` (regra 5) e `src/ui/botoesDeSaida.test.ts` (regra 9). Uma exceção nova entra na lista do teste, com o motivo.
```

- [ ] **Passo 2: wiki.** Em `docs/wiki/6-telas.md`, na abertura do capítulo (antes da primeira tela), acrescente um parágrafo: "Depois de salvar, criar ou excluir, um aviso curto aparece acima da barra de navegação e some sozinho. Quando a ação tem volta, o aviso traz Desfazer." Onde a wiki cita o texto "Lançado ✓", ajuste para o aviso. Valide: `npx vitest run src/ui/ajustes/capitulos.test.ts`.

- [ ] **Passo 3: fragmento** `changelog.d/alterado-retorno-ao-salvar.md`:

```markdown
- Toda gravação agora confirma que deu certo, com um aviso curto acima da barra.
  - Vale para lançamentos, conferência de saldo, cartão, cenários e todas as telas de Ajustes.
- Botões Cancelar e Fechar com contorno, para a ação principal se destacar.
```

- [ ] **Passo 4: dossiê.** `npm run dossie`; commite se mudou e invoque `revisar-dossie`.

- [ ] **Passo 5: varredura.** Rode o roteiro de `scripts/varredura/` com um arquivo de passos que: lança um valor e espera o aviso `Lançado`; salva uma conferência; cria uma categoria em Ajustes; abre um formulário de Ajustes com Cancelar e Salvar na mesma linha. Esperado: código de saída 0. Confira nas capturas que o aviso não cobre o botão que acabou de ser tocado nem a barra. Envie as capturas ao usuário.

- [ ] **Passo 6: commit**

```bash
git add docs/ changelog.d/alterado-retorno-ao-salvar.md
git commit -m "docs: retorno ao salvar no guia, na wiki e no changelog"
```

---

## Encerramento

- [ ] `npm test` inteiro verde; `node scripts/verificar-catalogo.mjs --strict` com saída 0.
- [ ] Fragmento mostrado ao usuário.
- [ ] `TODO.md`: o item "Confirmação própria e retorno ao salvar" sai inteiro para o `TODO-CONCLUIDOS.md`.
- [ ] Skill `ciclo-de-entrega`: merge, release `minor`, push, deploy.
- [ ] `git -C <checkout principal> status --porcelain` vazio.
