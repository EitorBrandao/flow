# Dossiê de comportamento — evidência legível para um agente revisor

## Problema

A suíte tem 55 arquivos de teste, quase todos espelhando um arquivo de código. Eles provam
pedaços. Nenhum deles diz nada sobre o app estar certo.

Três consequências:

1. **O teste só pega o que quem escreveu já tinha imaginado.** Um assert fixa `237500`
   porque alguém decidiu que 237500 era o certo. O caso que ninguém pensou não tem assert,
   e não vira vermelho.
2. **"55 testes verdes" não é uma leitura do conjunto.** Não existe nenhum lugar que
   mostre o app inteiro se comportando ao longo do tempo — só funções isoladas respondendo
   a entradas isoladas.
3. **Nada mostra o que um branch mudou no comportamento.** Um branch que diz mexer só em
   cartão pode mexer na projeção. Hoje isso só aparece se algum assert existente calhar de
   cobrir o caminho afetado.

O `docs/dominio.md` já descreve os invariantes do modelo em prosa, e distingue o que o
código **garante** do que é só **expectativa**. Nenhuma dessas afirmações é executável.

## Objetivo

A suíte passa a emitir **evidência**: um retrato determinístico e legível do app se
comportando ao longo de 12 meses de uso sintético. Um agente revisor lê essa evidência e
julga.

O que isto **não** é: uma troca. Os 55 arquivos ficam. O assert continua sendo a rede fina
— barato, determinístico, avisa na hora. O dossiê é a rede grossa, e pega outra classe de
problema.

## Decisões tomadas

Registradas com o motivo, porque cada uma teve alternativa descartada.

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Dossiê commitado no git; o `git diff` é o diff de comportamento | Gerar sob demanda, sem versionar | Sem baseline, o revisor julga no vácuo e vira gerador de opinião. Com baseline, a pergunta é "isto era pretendido?", que tem resposta. |
| Invariantes como seção do dossiê, escritos à mão | `fast-check` com gerador e redutor | Dependência nova é decisão de produto (`CLAUDE.md`). Os predicados escritos à mão pegam a maior parte do valor a custo zero. A busca aleatória fica para depois, quando os predicados já existirem. |
| Motor **e** telas em texto | Só o motor | O motor sozinho deixa de fora o que mais escapa: se a conta certa chega inteira na tela. |
| Telas em texto, não em imagem | Captura visual em navegador | Navegador de verdade no laço de teste é caro, e julgar layout por imagem é o menos confiável dos três caminhos. O guia de estilo e o `npm run deploy` cobrem isso melhor. |
| O revisor é uma skill, não um guard | `scripts/` que aborta | Julgamento de agente não é determinístico. Guard que aborta por opinião ensina todo mundo a contornar o guard. |

## Solução

### Arquitetura

```
src/dossie/roteiro.ts      roteiro declarativo: passos datados
        ↓
src/dossie/executar.ts     relógio congelado + ids sequenciais + repo real sobre fake-indexeddb
        ↓
        Retrato[]          um por data de corte
        ↓
   ┌────┴─────────────────────────┐
   ↓                              ↓
invariantes.ts              tela.ts  (RTL → texto normalizado)
   ↓                              ↓
   └────────────┬─────────────────┘
                ↓
        serializar.ts → docs/dossie/*.md   (commitado)
                ↓
   git diff (branch)   |   leitura inteira (auditoria)
                ↓
        skill revisar-dossie
```

Cada módulo tem uma responsabilidade e uma fronteira: o roteiro descreve, o executor roda,
o extrator lê a tela, os invariantes julgam o fato, o serializador escreve. Nenhum deles
precisa dos internos do outro.

### Determinismo

O app tem três fontes de não-determinismo, todas verificadas no código atual:

| Fonte | Onde | Tratamento |
|---|---|---|
| `crypto.randomUUID()` | `novoId()`, `src/domain/types.ts:156` | Substituir `globalThis.crypto.randomUUID` por um contador. Funciona porque `novoId` consulta `crypto.randomUUID` **na hora da chamada**, não na carga do módulo. Os ids saem como `id-0001`, `id-0002`… |
| `new Date()` | `agoraISO()` (`types.ts:170`), `hojeISO()` (`dates.ts:13`), horizonte padrão (`repo.ts:17` e `repo.ts:30`) | Relógio congelado. |
| Ordem de leitura do IndexedDB | Dexie | O serializador ordena tudo por chave estável antes de escrever. |

O relógio usa `vi.useFakeTimers({ toFake: ['Date'] })`. **O `toFake` é obrigatório:** falsear
`setTimeout` trava o Dexie, que depende dele. Avançar esse relógio entre os passos é o que
faz os meses passarem.

### O roteiro (`src/dossie/roteiro.ts`)

Lista declarativa de passos datados. Cada passo tem uma descrição em português e uma ação
que chama o `repo` de verdade — as mesmas mutations que a UI chama, com
re-materialização e sincronização de cartão inclusas.

```ts
interface Passo {
  data: ISODate;
  descricao: string;              // vai para docs/dossie/00-roteiro.md
  executar(ctx: Contexto): Promise<void>;
}
```

Cobre 12 meses e exercita, no mínimo:

- abrir boxes (com e sem saldo próprio) e bancos dentro delas;
- criar categorias de ganho e de gasto, reordenar, arquivar uma com histórico;
- criar recorrências e deixar a materialização rodar mês a mês;
- confirmar um pendente com o valor previsto, e outro com valor diferente;
- cadastrar cartão, comprar à vista e parcelado, assinar, atravessar fechamento e
  vencimento, pagar a fatura inteira, pagar outra parcialmente;
- registrar uma conferência de fatura divergente da soma das compras;
- criar uma viagem e lançar dentro dela, por lançamento e por compra de cartão;
- ligar e desligar um cenário;
- exportar backup e reimportar nos dois modos.

**Restrição dura:** todo dado do roteiro é sintético. O dossiê é arquivo versionado num
repositório público, então ele cai sob a regra de dados reais do `CLAUDE.md` e sob o
`scripts/verificar-dados-reais.mjs`. Isso não é conveniência — é requisito do roteiro.

### O executor (`src/dossie/executar.ts`)

Monta base limpa, instala o relógio e o contador de ids, roda os passos em ordem e, nas
datas de corte, tira um `Retrato`.

Seis datas de corte ao longo dos 12 meses, escolhidas para cair em momentos diferentes do
ciclo do cartão: antes do primeiro fechamento, entre fechamento e vencimento, depois do
vencimento, no meio da viagem, depois do pagamento parcial, e no fim do horizonte.

O `Retrato` guarda:

- saldos por box na data: efetivo, projetado e com cenários;
- a série de projeção dia a dia, **em memória**, para os invariantes;
- os marcos dessa série: mínimo, máximo e saldo de fim de cada mês. **Só os marcos vão
  para o dossiê** — a série inteira seria ruído no diff;
- faturas do cartão: ciclo, itens, total, e o lançamento `origem: 'cartao'` correspondente;
- as agregações que alimentam a aba Análises;
- a matriz `status` × `origem` dos lançamentos, em contagem;
- o `Dados` completo, para os invariantes — **não** serializado no dossiê.

### As telas em texto (`src/dossie/tela.ts`)

Renderiza cada tela com Testing Library no estado daquele corte, e extrai um resumo em
texto.

A extração usa **papéis e nomes acessíveis**, não `innerHTML`. Essa escolha é o coração da
peça e decide se o dossiê será lido ou ignorado:

- Mudar uma classe de CSS **não pode** mexer no dossiê.
- Mudar um rótulo, um valor, a ordem de uma lista ou um estado vazio **tem que** mexer.

Um dossiê que muda por motivo cosmético é um dossiê que ninguém lê, e vira mais um
vermelho a ignorar.

Telas cobertas: Hoje, Fluxo, Cartão, Análises, Lançar e o **índice** de Ajustes. As
subtelas de Ajustes e as sheets ficam fora nesta primeira volta — são muitas e dependem de
interação, o que multiplicaria o roteiro.

### Os invariantes (`src/dossie/invariantes.ts`)

Predicados tirados de `docs/dominio.md`, em dois formatos:

- **Sobre um retrato** — a maioria. Recebe o `Retrato` e o `Dados` daquele corte.
- **Sobre um par de retratos consecutivos** — para as regras que só existem no tempo, como
  a imutabilidade do `efetivo`. Recebe o corte anterior e o atual.

E em duas classes, com o mesmo vocabulário do `docs/dominio.md`:

**Garantido** — o código impõe hoje. Violação **reprova `npm test`**.

- Todo lançamento aponta para categoria e box existentes.
- A soma dos itens da fatura bate com o valor do lançamento `origem: 'cartao'` daquele
  ciclo.
- `efetivo` é imutável por materialização e por sincronização: nenhum lançamento `efetivo`
  muda entre dois cortes sem passo manual no roteiro.
- No máximo uma `ConferenciaFatura` por `cartaoId` + `mes`.
- A categoria de fatura e a de assinaturas ficam fora de todo seletor manual.
- Ida e volta do backup preserva `Dados`: exportar, validar, importar em base limpa,
  comparar.
- Nenhuma tela lança exceção em nenhum corte.
- Saldo projetado de um dia igual ao do dia anterior mais os lançamentos não-cenário
  daquele dia.

**Expectativa** — `docs/dominio.md` diz explicitamente que o código **não** garante.
Violação **não reprova**: entra no dossiê como achado, para o revisor ler.

- Nenhum cenário com `status: 'efetivo'`.
- Viagens não se sobrepõem.
- Todo valor monetário é inteiro.
- Toda data casa com `AAAA-MM-DD`.

A separação é honesta e evita o pior resultado possível: reprovar a suíte por uma regra
que o código nunca prometeu cumprir.

### A saída (`docs/dossie/`)

O `src/dossie/serializar.ts` escreve quatro arquivos, separados para o diff ficar legível e
o conflito entre worktrees ficar pequeno:

| Arquivo | Conteúdo |
|---|---|
| `00-roteiro.md` | O roteiro em prosa: o que aconteceu, em que data. |
| `01-invariantes.md` | Tabela invariante × data de corte, com classe e resultado. |
| `02-motor.md` | Números por data de corte. |
| `03-telas.md` | O que cada tela renderiza, por data de corte. |

### Comandos

`npm run dossie` regenera e grava. Um `scripts/dossie.mjs` de poucas linhas define a
variável de ambiente e chama o Vitest — resolve o Windows sem `cross-env`, e segue o padrão
dos outros scripts do repositório.

`npm test` regenera em memória e compara com o disco. Duas reprovações novas:

- **Dossiê desatualizado.** Mensagem curta: qual seção divergiu e "rode `npm run dossie`".
  Nunca o diff inteiro despejado no terminal.
- **Invariante garantido violado.** Diz qual invariante, em que data de corte.

Isso acrescenta duas guardas automáticas de verdade, que entram na tabela "Guardas
automáticas" do `CLAUDE.md`.

**Fricção aceita, idêntica à de um lockfile:** mudou comportamento, regenera antes de
commitar. Em conflito de merge no dossiê, a resolução é **sempre regenerar**, nunca resolver
à mão.

**Custo aceito:** a comparação renderiza 6 telas em 6 cortes a cada `npm test`, mais os 12
meses de mutations. É o teste mais caro da suíte, de longe. Se ele passar de meio minuto
numa máquina livre, o corte certo é reduzir as datas de corte — nunca apertar o
`testTimeout`, que o `CLAUDE.md` protege por motivo próprio.

### O revisor (`.claude/skills/revisar-dossie/SKILL.md`)

Dois recortes sobre o mesmo artefato:

**Por branch.** Lê `git diff main...HEAD -- docs/dossie/` junto com a intenção declarada do
branch. Responde uma pergunta só: cada mudança de comportamento era pretendida? O achado
principal é mudança fora do escopo declarado.

**Varredura larga.** Lê o dossiê inteiro, sem baseline, e procura o implausível: fatura com
item duplicado, categoria arquivada ainda aparecendo num seletor, mês em que o saldo pula
sem lançamento que explique.

A skill `ciclo-de-entrega` ganha esse passo **depois** do `npm test` verde e **antes** do
fragmento de changelog. Não é guarda que aborta: é leitura que o usuário recebe.

## Erros

| Situação | Comportamento |
|---|---|
| Passo do roteiro estoura | Interrompe a geração. Diz qual passo e qual data. **Dossiê parcial nunca é gravado.** |
| Tela estoura ao renderizar | **Não** interrompe. A exceção entra no dossiê naquele ponto, e o invariante "nenhuma tela lança" reprova. O relatório mostra o estrago em vez de escondê-lo atrás de um stack trace. |
| Invariante garantido violado | Registra na tabela, continua a geração, reprova no fim. Um invariante violado é exatamente o que se quer ver relatado. |
| Invariante de expectativa violado | Registra na tabela como achado. Não reprova. |

## Verificação

Testes da própria máquina, em `src/dossie/`:

- Gerar duas vezes no mesmo processo dá byte igual.
- Mudança cosmética não move o extrator de texto; mudança de rótulo move. Dois casos
  mínimos, um de cada.
- Um invariante propositalmente falso reprova, e a mensagem nomeia o invariante e a data.
- Um passo que estoura interrompe sem gravar arquivo.

Verificação do conjunto: `npm test` verde, `npm run build` limpo, e
`node scripts/verificar-dados-reais.mjs` sem achado no `docs/dossie/`.

## Autorizações concedidas

O `CLAUDE.md` reserva estes caminhos a pedido explícito do usuário. Concedido em
2026-08-10, para esta spec:

- `scripts/dossie.mjs` novo;
- script `dossie` no `package.json`;
- `.claude/skills/revisar-dossie/` nova, e um passo novo em `.claude/skills/ciclo-de-entrega/`.

## Fora de escopo

- **Busca aleatória com `fast-check`.** Fica para depois, quando os invariantes já
  existirem escritos e o custo dela cair. A dependência é decisão de produto à parte.
- **Captura visual em navegador.** Descartada, com o motivo na tabela de decisões.
- **Sheets no dossiê.** Só telas nesta volta.
- **Podar teste que não discrimina.** A poda vale, mas com evidência caso a caso, depois
  de a camada nova estar provada. Não por atacado.
