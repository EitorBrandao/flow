# Plano: Campo de valor "estilo caixa eletrônico"

## Contexto

Ver design aprovado nesta sessão (resumo): hoje todo input de valor monetário
no Flow exige digitar vírgula, e a lógica de parsing (`parseValorDigitado` em
`src/domain/money.ts`) está reimplementada de forma independente em 9 telas.
Vamos criar um componente compartilhado `CampoValor` que se comporta como
input de caixa eletrônico: dígitos entram pela direita empurrando os
anteriores, sem vírgula. Sinal (negativo) fica fora do componente, resolvido
por um toggle +/- explícito nas telas que precisam (`LancEditor` já tem,
`TelaHoje` e `Boxes` ganham um novo). `Boxes.tsx` ganha um checkbox "tem saldo
próprio" para substituir a distinção atual "campo vazio vs '0,00'".
`TelaCartao.tsx` ganha um botão "Remover" para substituir o gesto de "campo
vazio = remove conferência".

## Global Constraints

- Código, UI, testes e comentários em português, seguindo o padrão do
  restante do repo.
- **Antes de editar qualquer UI, consultar `docs/estilo-visual.md`** (aponta
  para o capítulo certo em `docs/estilo/` conforme o nível da mudança). Se
  criar uma classe ou toggle novo reaproveitável, catalogar em
  `docs/estilo/catalogo.md` no mesmo commit.
- Valores monetários são centavos inteiros (`number`), nunca strings.
- `CampoValor` (interface final, não alterar):
  ```tsx
  interface CampoValorProps {
    id: string;
    valorCentavos: number;               // magnitude atual, sempre >= 0
    onChange: (centavos: number) => void;
    autoFocus?: boolean;
    style?: React.CSSProperties;
  }
  ```
  Encapsula só o `<input>` — cada tela mantém seu próprio
  `<div className="campo"><label htmlFor="...">...</label></div>` ao redor,
  sem mudança nesse wrapper.
- Toggle de sinal (usado em `TelaHoje.tsx` e `Boxes.tsx`, novo): um botão
  simples ao lado do `CampoValor`, ex.:
  ```tsx
  <button type="button" onClick={() => setNegativo(n => !n)}>
    {negativo ? '−' : '+'}
  </button>
  ```
  Reaproveitar classe existente de botão do projeto (grep por `className="botao"` ou
  equivalente em `src/styles.css` e nas telas antes de inventar uma nova).
- Nenhuma tarefa remove `parseValorDigitado` de `src/domain/money.ts` exceto a
  Tarefa 12 (última, depois de todas as 9 migrações mescladas).
- Cada tarefa roda `npm test` (suite focada durante o trabalho, suite
  completa antes de comitar) e reporta os resultados.

## Task 1: `src/domain/money.ts` — funções de buffer de dígitos

Adicionar 3 funções puras novas (mantendo `formatarBRL` e `parseValorDigitado`
intactas — `parseValorDigitado` só será removida na Tarefa 12):

```ts
/** Acrescenta um dígito (0-9) ao fim do buffer de centavos, empurrando os existentes à esquerda. */
export function empurrarDigito(centavos: number, digito: string): number {
  return centavos * 10 + Number(digito);
}

/** Remove o último dígito do buffer de centavos. */
export function apagarUltimoDigito(centavos: number): number {
  return Math.floor(centavos / 10);
}

/** Extrai só os dígitos de um texto (ex. colado) e converte em centavos. */
export function digitosParaCentavos(texto: string): number {
  const digitos = texto.replace(/\D/g, '');
  return digitos === '' ? 0 : Number(digitos);
}
```

Escrever testes em `src/domain/money.test.ts` (TDD: escrever os testes
primeiro, ver falhar, depois implementar):
- `empurrarDigito`: dígito único (`empurrarDigito(0, '1') === 1`), encadeamento
  (`empurrarDigito(empurrarDigito(0,'1'),'2') === 12`), a partir de valor não-zero.
- `apagarUltimoDigito`: de um valor de vários dígitos até chegar a 0; `apagarUltimoDigito(0) === 0` (não fica negativo).
- `digitosParaCentavos`: `"R$ 12,34"` → `1234`; `"1234"` → `1234`; `""` → `0`; `"abc"` → `0`.

Não mexer em nenhum outro arquivo. Não remover nada existente.

**Acceptance:** `npm test -- money` verde, funções exportadas, testes cobrindo os casos acima.

## Task 2: `src/ui/CampoValor.tsx` (novo componente) — TDD

Depende da Tarefa 1 (usa `empurrarDigito`, `apagarUltimoDigito`,
`digitosParaCentavos`, `formatarBRL` de `../domain/money`).

Escrever primeiro `src/ui/CampoValor.test.tsx` (TDD, ver falhar antes de
implementar), com `@testing-library/react` + `@testing-library/user-event`
(seguir o padrão de outro teste de componente já existente no repo, ex.
`src/ui/TelaLancar.test.tsx`, para style de `render`/`screen`/setup). Casos:

1. Mostra o valor inicial formatado antes do primeiro toque (ex.
   `valorCentavos={12345}` exibe `"R$ 123,45"`).
2. Primeiro foco zera o buffer, mesmo com valor herdado (focar dispara
   `onChange(0)`).
3. Digitar dígitos empurra da direita pra esquerda: focar, digitar "1234",
   valor final exibido `"R$ 12,34"` e último `onChange` chamado com `1234`.
4. Backspace remove o último dígito (digitar "1234", apertar Backspace,
   esperar `"R$ 1,23"` / `onChange(123)`).
5. Colar texto extrai só os dígitos, ignorando "R$"/vírgula (paste
   `"R$ 12,34"` → `onChange(1234)`).
6. Colar substitui o buffer inteiro, não concatena (focar, digitar algo,
   colar "500" → resultado final é exatamente 500, não a concatenação).
7. Segundo foco (sem remontar o componente) NÃO reseta de novo: focar,
   digitar "500", blur, focar de novo, digitar "6" → resultado `5006`.
8. `inputMode` do input é `"numeric"`.

Implementação de referência (pode ajustar detalhes de estilo/lint, mas a
lógica deve ser esta):

```tsx
import { useState } from 'react';
import { apagarUltimoDigito, digitosParaCentavos, empurrarDigito, formatarBRL } from '../domain/money';

interface CampoValorProps {
  id: string;
  valorCentavos: number;
  onChange: (centavos: number) => void;
  autoFocus?: boolean;
  style?: React.CSSProperties;
}

export default function CampoValor({ id, valorCentavos, onChange, autoFocus, style }: CampoValorProps) {
  const [tocado, setTocado] = useState(false);

  function onFocus() {
    if (!tocado) { setTocado(true); onChange(0); }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      onChange(empurrarDigito(valorCentavos, e.key));
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      onChange(apagarUltimoDigito(valorCentavos));
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    setTocado(true);
    onChange(digitosParaCentavos(e.clipboardData.getData('text')));
  }

  return (
    <input
      id={id} inputMode="numeric" autoFocus={autoFocus} style={style}
      value={formatarBRL(valorCentavos)}
      onFocus={onFocus} onKeyDown={onKeyDown} onPaste={onPaste}
      onChange={() => {}}
    />
  );
}
```

Note: `onChange={() => {}}` no `<input>` nativo é necessário porque é um
input controlado — toda mudança real acontece via `onKeyDown`/`onPaste`.

Depois de implementar: consultar `docs/estilo-visual.md` → capítulo de "novo
componente" e catalogar `CampoValor` em `docs/estilo/catalogo.md` (seção de
componentes compartilhados), no mesmo commit.

**Acceptance:** `npm test -- CampoValor` verde com os 8 casos acima, componente
exportado default de `src/ui/CampoValor.tsx`, entrada no catálogo de estilo.

---

As Tarefas 3 a 11 abaixo são **independentes entre si** (arquivos disjuntos) e
dependem só das Tarefas 1 e 2 já mescladas. Podem ser implementadas em
paralelo por agentes diferentes.

## Task 3: Migrar `src/ui/TelaLancar.tsx`

Campo de valor do lançamento na tela "Lançar". Ler o arquivo atual para
localizar o estado do valor (hoje uma string, ex. `useState('')`) e o import de
`parseValorDigitado`.

- Trocar o estado de string para `useState<number>(0)` (centavos).
- Remover o uso de `parseValorDigitado` neste arquivo (o valor já vem em
  centavos do próprio estado).
- Validade do formulário: onde hoje checa `cents != null`, trocar para
  `cents > 0`.
- Reset do campo após lançar: setar o estado de centavos para `0` (em vez de
  string vazia).
- Trocar o `<input>` de valor por `<CampoValor id="valor" valorCentavos={...} onChange={...} autoFocus style={{ fontSize: 28 }} />`, importado de `./CampoValor` (ajustar path relativo real). Manter o `<div className="campo"><label htmlFor="valor">...</label>` ao redor como está.
- Atualizar `src/ui/TelaLancar.test.tsx`: os testes que digitam valor (ex.
  `userEvent.type(screen.getByLabelText('Valor'), '12,34')`) devem continuar
  funcionando sem mudança de expectativa (a vírgula é ignorada pelo
  `CampoValor`, os dígitos "1","2","3","4" resultam em 1234 centavos = mesmo
  valor esperado hoje) — rodar e confirmar; ajustar só se o teste realmente
  quebrar.

**Acceptance:** `npm test -- TelaLancar` verde, sem uso de `parseValorDigitado`
neste arquivo, campo se comporta como caixa eletrônico ao usar a tela.

## Task 4: Migrar `src/ui/ajustes/Recorrencias.tsx`

Campo de valor de recorrência. Mesmo padrão da Tarefa 3: ler o arquivo atual,
trocar `useState<string>` do valor por `useState<number>(0)`, remover
`parseValorDigitado`, trocar checagem `cents == null` por `cents <= 0`, resetar
para `0` (não string vazia) ao limpar/criar novo, ao editar um item existente
inicializar o estado com o valor em centavos já existente (`rec.valor`,
diretamente — sem `.toFixed`/`.replace`), trocar o `<input>` por `<CampoValor>`.

Atualizar `src/ui/ajustes/Recorrencias.test.tsx` se algum teste quebrar (o
teste que digita valor com vírgula deve continuar passando sem mudança).

**Acceptance:** `npm test -- Recorrencias` verde, sem `parseValorDigitado` no arquivo.

## Task 5: Migrar `src/ui/ajustes/Assinaturas.tsx`

Campo de valor de assinatura recorrente. Mesmo padrão da Tarefa 4 (ler o
arquivo, trocar estado string→number, remover `parseValorDigitado`, `cents <= 0`,
reset para `0`, inicializar a partir do valor existente em centavos ao editar,
trocar `<input>` por `<CampoValor>`).

Não existe `Assinaturas.test.tsx` hoje — não criar um novo arquivo de teste
para isso (fora de escopo), mas confirmar manualmente que `npm test` completo
continua verde (nada quebra por falta de teste aqui).

**Acceptance:** `npm run build` (typecheck) sem erros nesse arquivo, sem
`parseValorDigitado` nele, `npm test` completo continua verde.

## Task 6: Migrar `src/ui/TelaSimulador.tsx` (componente `FormHipotetico`)

Campo "valor total" de item hipotético. Mesmo padrão: ler o arquivo, trocar
estado string→number, remover `parseValorDigitado`, `cents <= 0`, reset para
`0`, trocar `<input>` por `<CampoValor>`.

`src/ui/TelaSimulador.test.tsx` não testa esse campo hoje — não é obrigatório
criar teste novo, mas confirmar que a suite completa continua verde.

**Acceptance:** `npm run build` sem erros, sem `parseValorDigitado` no arquivo,
`npm test` completo verde.

## Task 7: Migrar `src/ui/FormCompra.tsx`

Campo de valor de compra no cartão, usado tanto para criar quanto para editar
uma compra existente (via `AdicionarSheet` e via `TelaCartao`). Ler o arquivo
atual.

- Trocar o estado do valor para `useState<number>(compra?.valorTotal ?? 0)`
  (em vez de string formatada com `centavosParaTexto`/similar).
- Remover uso de `parseValorDigitado` neste arquivo. Onde hoje checa
  `cents == null || !categoriaId`, trocar para `valorCent <= 0 || !categoriaId`
  usando o próprio estado numérico diretamente.
- Trocar `<input>` por `<CampoValor id={...} valorCentavos={...} onChange={...} style={{ width: 100 }} />`.
- Se existir um helper local de conversão cents→texto usado só para
  pré-popular esse campo (ex. algo chamado `centavosParaTexto` definido
  neste próprio arquivo), remover — não é mais necessário.
- Atualizar `src/ui/FormCompra.test.tsx` conforme necessário (o teste que
  digita "100,00" deve continuar passando sem mudança de expectativa).
  Adicionar um teste cobrindo "editar uma compra existente mostra o valor
  atual formatado e permite trocá-lo" (esse fluxo não tem teste hoje e é
  sensível — valor inicial vem de props via `compra.valorTotal`).

**Acceptance:** `npm test -- FormCompra` verde incluindo o novo teste de
edição, sem `parseValorDigitado` nem helper local de conversão no arquivo.

## Task 8: Migrar `src/ui/LancEditor.tsx`

Editar valor de um lançamento existente, incluindo estorno (sinal negativo).
Ler o arquivo atual — há um estado separado de sinal (algo como
`negativo`, derivado de `lanc.valor < 0`) que **não deve mudar de
comportamento**, só a fonte da magnitude muda.

- Trocar o estado de string do valor para `useState<number>(Math.abs(lanc.valor))`.
- Manter o estado/lógica de `negativo` exatamente como está hoje.
- Onde hoje se calcula os centavos finais a partir do parse do texto e do
  sinal, trocar para calcular a partir do novo estado numérico + `negativo`
  (ex.: `const cents = valorCent > 0 ? (negativo ? -valorCent : valorCent) : null;`,
  ajustando nomes conforme o código real).
- Trocar `<input>` por `<CampoValor id="ed-valor" valorCentavos={...} onChange={...} />`.
- Atualizar `src/ui/LancEditor.test.tsx`: os testes que usam
  `userEvent.clear(campoValor)` seguido de `userEvent.type(campoValor, '73,45')`
  precisam mudar — não existe mais "campo vazio" para limpar. Trocar por
  focar o campo (o que já zera o buffer sozinho) e então digitar os dígitos,
  ex. `await userEvent.click(campoValor); await userEvent.type(campoValor, '7345');`.

**Acceptance:** `npm test -- LancEditor` verde, sinal de estorno preservado
(testar manualmente ou via teste que a lógica de `negativo` não foi tocada),
sem `parseValorDigitado` no arquivo.

## Task 9: Migrar `src/ui/TelaCartao.tsx` (`BlocoConferencia`)

Campo "valor no app do banco" da conferência de fatura. Ler o arquivo atual.

- Se existir um helper local `centavosParaTexto` duplicado neste arquivo,
  remover.
- Trocar o estado de string do valor para `useState<number>(conf?.valorAppCent ?? 0)`.
- Reescrever a função de salvar: **sempre** grava o valor atual do
  `CampoValor` via `repo.salvarConferenciaFatura(...)` quando o valor for
  maior que zero (remover a guarda de "campo vazio").
- Adicionar uma função/botão **"Remover"** separado, visível só quando já
  existe uma conferência salva (`conf != null`), que chama
  `repo.removerConferenciaFatura(...)` diretamente. Esse botão substitui o
  gesto antigo de "limpar o campo para remover".
- Trocar `<input>` por `<CampoValor>`.
- Atualizar `src/ui/TelaCartao.test.tsx`: o teste que digita "100,00" no campo
  "Valor no app do banco" deve continuar passando sem mudança de expectativa
  de dígitos. Adicionar um teste novo cobrindo o botão "Remover" (criar uma
  conferência, clicar em "Remover", confirmar que ela some / a diferença
  volta a não aparecer).

**Nota:** a suite hoje tem um `DatabaseClosedError` (unhandled rejection)
pré-existente relacionado a este arquivo de teste, não relacionado a esta
mudança — não precisa investigar/corrigir isso nesta tarefa, só não piorar
(confirmar que a contagem de testes passando não regride).

**Acceptance:** `npm test -- TelaCartao` verde (incluindo o teste novo do
botão Remover), sem helper `centavosParaTexto` local duplicado, sem
`parseValorDigitado` no arquivo.

## Task 10: Migrar `src/ui/TelaHoje.tsx` (componente `ConferenciaSaldo`)

Campo "saldo real no banco" do dia. Ler o arquivo atual — hoje o sinal
negativo é digitado como prefixo `-` no próprio texto (não há toggle visual).

- Trocar o estado do valor para dois estados: magnitude em centavos
  (`useState<number>(Math.abs(declaradoCent ?? 0))`) e sinal
  (`useState<boolean>((declaradoCent ?? 0) < 0)`, ex. `negativo`).
- Adicionar um botão toggle +/- ao lado do `CampoValor` (ver Global
  Constraints — padrão do toggle de sinal) para alternar `negativo`.
- Ao salvar, calcular `negativo ? -magnitude : magnitude` e chamar o callback
  de salvar existente com esse valor (sempre, sem guarda de "campo vazio" —
  remover a checagem de `cents == null` se existir, já que agora sempre há um
  número).
- Trocar `<input>` por `<CampoValor>`.
- Atualizar `src/ui/TelaHoje.test.tsx`: os testes que digitam valor com `-` no
  meio do texto (ex. `'-50,00'`) precisam mudar para: digitar só os dígitos
  (`'50,00'` ou `'5000'`) e ativar o toggle de sinal separadamente. O teste
  que espera `toHaveValue('')` ao trocar de box (campo "reseta") deve passar a
  esperar o valor formatado em zero (ex. `toHaveValue('R$ 0,00')` — confirmar
  o formato exato produzido por `formatarBRL(0)`).

**Acceptance:** `npm test -- TelaHoje` verde, toggle de sinal funcional
manualmente (positivo e negativo), sem `parseValorDigitado` no arquivo.

## Task 11: Migrar `src/ui/ajustes/Boxes.tsx` (componente `EditorBox`)

Campo "saldo inicial" da box. Ler o arquivo atual — hoje "campo vazio" vs
"'0,00'" distingue `saldoInicial: null` (sem saldo próprio/compartilhada) de
`saldoInicial: 0` (saldo zero explícito), e o sinal é digitado como prefixo
`-`.

- Adicionar um checkbox "Esta box tem saldo próprio" com estado
  `useState<boolean>(box.saldoInicial != null)`.
- Trocar o estado do valor para magnitude em centavos
  (`useState<number>(Math.abs(box.saldoInicial ?? 0))`) + sinal
  (`useState<boolean>((box.saldoInicial ?? 0) < 0)`).
- Adicionar o mesmo toggle +/- de sinal da Tarefa 10 ao lado do `CampoValor`
  (mesmo padrão visual).
- Ao salvar: se o checkbox estiver desmarcado, `saldoInicial: null`; se
  marcado, `saldoInicial: negativo ? -magnitude : magnitude` (inclusive
  quando `magnitude === 0`).
- Trocar `<input>` por `<CampoValor>`. Quando o checkbox estiver desmarcado,
  pode ocultar ou desabilitar o `CampoValor` e o toggle de sinal (escolher o
  que for mais simples de implementar corretamente, seguindo
  `docs/estilo-visual.md` se houver um padrão de campo desabilitado).
- Atualizar `src/ui/ajustes/Boxes.test.tsx`: o teste "salva saldo inicial
  '0,00' como zero, não como sem-saldo-próprio" precisa ser reescrito para o
  novo fluxo (checkbox marcado + `CampoValor` em zero → `saldoInicial === 0`).
  Adicionar um teste novo: "desmarcar 'tem saldo próprio' salva null".

**Acceptance:** `npm test -- Boxes` verde incluindo os dois testes acima,
sem `parseValorDigitado` no arquivo.

---

## Task 12: Remover `parseValorDigitado` (última tarefa, depois de 3–11 mescladas)

**Só iniciar depois que as Tarefas 3 a 11 estiverem todas mescladas na
branch.** Rodar `grep -rn "parseValorDigitado" src/` para confirmar que
nenhum arquivo de produção mais a chama (só `src/domain/money.ts` e
`src/domain/money.test.ts` devem aparecer). Se algum outro arquivo ainda
usar, **parar e reportar BLOCKED** — não remover.

- Remover a função `parseValorDigitado` de `src/domain/money.ts`.
- Remover o(s) `describe`/testes correspondentes em `src/domain/money.test.ts`.
- Rodar `npm test` completo e `npm run build` para confirmar que nada mais
  referencia a função removida.

**Acceptance:** grep por `parseValorDigitado` no repo retorna zero
ocorrências, `npm test` completo verde, `npm run build` sem erros.

## Verificação final (whole-branch, depois da Tarefa 12)

- `npm test` completo verde (sem regressão na contagem de testes passando em
  relação à baseline: 211 passed / 1 skipped antes desta feature).
- `npm run build` sem erros de tipo.
- Teste manual via `npm run dev` (roteiro completo no design aprovado):
  lançar, editar lançamento com estorno negativo, compra de cartão
  (criar/editar), conferência de fatura (salvar e remover), saldo real do dia
  (positivo/negativo via toggle), saldo inicial de box (com/sem saldo
  próprio, positivo/negativo), assinaturas, recorrências, simulador, e colar
  um valor copiado em pelo menos 2 telas.
