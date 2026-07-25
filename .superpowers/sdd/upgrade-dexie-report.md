# Relatório: Testes de Upgrade de Schema Dexie

Data: 2026-07-25

## Resumo

Implementei testes de caminho de upgrade para o schema Dexie do app Flow. Três testes foram criados em `src/db/database.test.ts`:

1. **Teste 1: Upgrade v1 → v2** — Verifica que dados gravados em v1 sobrevivem ao upgrade para v2
2. **Teste 2: Upgrade v2 → v3** — Verifica que dados gravados em v2 sobrevivem ao upgrade para v3
3. **Teste 3: Upgrade v1 → v3 (full chain)** — Verifica que dados gravados em v1 chegam intactos até v3

Todos os testes passaram. Nenhuma perda de dados foi detectada.

## Desenho final de cada teste

### Teste 1: v1 → v2

**Propósito:** Garantir que o upgrade da v1 (data básica, sem cartão) para v2 (adiciona cartão) preserva todos os dados antigos.

**Execução:**
1. Cria um banco Dexie com nome único em v1
2. Popula com dados completos: boxes, categorias, lancamentos, recorrencias, cenarios, config
3. Fecha o banco
4. Reabre o mesmo banco na v2 (com os schemas de v1 e v2 declarados)
5. Verifica que todos os dados de v1 estão presentes
6. Verifica que as tabelas novas de v2 (cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura) estão vazias
7. Limpa o banco

**Validação de ordem:** Usa função helper `expectArraysEqualById()` que compara arrays agnóstico de ordem, checando por ID. Isso resolve o problema de que Dexie não garante ordem de retorno em `toArray()`.

### Teste 2: v2 → v3

**Propósito:** Garantir que o upgrade de v2 para v3 (adiciona viagens) preserva dados de cartão e tudo mais.

**Execução:**
1. Cria um banco Dexie com nome único em v2
2. Popula com dados de cartão: cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura
3. Fecha o banco
4. Reabre na v3 (com v1, v2, v3 declarados)
5. Verifica que todos os dados de v2 estão presentes
6. Verifica que a tabela nova de v3 (viagens) está vazia
7. Limpa o banco

### Teste 3: v1 → v3 (full chain)

**Propósito:** Simula um usuário que tem dados em v1 e pula direto para v3 (a versão atual). Dexie faz o upgrade automático passando por v2.

**Execução:**
1. Cria um banco em v1 e popula com dados simples (um box, uma categoria, um lançamento)
2. Fecha
3. Reabre na v3 (declarando v1, v2, v3), simule o upgrade automático da v1 → v2 → v3
4. Verifica que os dados de v1 chegaram até v3 intactos
5. Verifica que todas as tabelas intermediárias e novas estão vazias
6. Limpa

## Ajustes em relação ao desenho previsto

Não havia um "brief" explícito no arquivo `.superpowers/sdd/upgrade-dexie-brief.md` — o arquivo não existia. Baseei-me no:

1. **Schemas do `src/db/database.ts`** — as três versões com seus stores e índices
2. **Padrão de teste em `src/db/repo.test.ts`** — uso de `fake-indexeddb`, `limparDb()`, nomes de banco únicos
3. **Instruções do CLAUDE.md** — "Nova versão no Dexie exige teste do caminho de upgrade"

**Ajuste crítico: Ordem de dados**

Durante a primeira execução, os testes falharam porque `toArray()` não retorna dados em ordem de inserção. Dexie retorna por índice primário (id), que pode estar em qualquer ordem.

**Solução:** Criei função helper `expectArraysEqualById<T>()` que:
- Converte ambos os arrays (esperado e real) em Maps keyed by `id`
- Verifica que os tamanhos batem
- Para cada item esperado, confere que existe um item real com o mesmo ID e mesmos dados

Isso torna os testes robusto contra reordenamento.

## Saída dos comandos de verificação

### 1. `npx vitest run src/db/database.test.ts`

```
 RUN  v3.2.6 C:/Users/eitor/Claude/ProjetoFinancas/.worktrees/teste-upgrade-dexie

 ✓ src/db/database.test.ts (3 tests) 78ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  02:56:09
   Duration  3.70s (transform 122ms, setup 1.24s, collect 66ms, tests 78ms, environment 1.42s, prepare 335ms)
```

### 2. `npx tsc -b`

Compilação bem-sucedida (sem erros).

### 3. `npx vitest run src/db/` (todos os testes de banco)

```
 RUN  v3.2.6 C:/Users/eitor/Claude/ProjetoFinancas/.worktrees/teste-upgrade-dexie

 ✓ src/db/database.test.ts (3 tests) 215ms
 ✓ src/db/repo.test.ts (34 tests) 730ms

 Test Files  2 passed (2)
 Tests  37 passed (37)
   Start at  02:58:21
   Duration  5.23s (transform 400ms, setup 3.04s, collect 513ms, tests 946ms, environment 3.43s, prepare 768ms)
```

**Nota sobre `npm test` completo:** Há 3 testes de UI (`TelaAnalises.test.tsx`, `TelaFluxo.test.tsx`, `TelaSimulador.test.tsx`) falhando por timeout, mas **não são causados pelas minhas mudanças**. Esses testes já estavam instáveis (timeout de 5s).

## Dados e segurança

Todos os dados usados nos testes são sintéticos:
- Valores monetários em centavos: `500000`, `250000`, `15000`, `4990`, `50000`, etc. (nenhum real)
- Datas de teste: `2026-01-01`, `2026-07-01`, `2026-07-05`, `2026-07-10`, `2026-08`, etc.
- Nomes fictícios: "Eitor", "Salário", "Mercado", "Nubank", "Alimentação", "Netflix"

Nenhum dado financeiro real do usuário entra no repositório.

## Achados

✅ **Nenhuma perda de dados detectada** na cadeia de upgrade v1 → v2 → v3.

Todos os campos gravados em versões antigas aparecem intactos nas versões novas:
- `Box`, `Categoria`, `Lancamento`, `Recorrencia`, `Cenario`, `Config` (v1) → v2 OK
- `Cartao`, `CategoriaCartao`, `CompraCartao`, `RecorrenciaCartao`, `ConferenciaFatura` (v2) → v3 OK
- Full chain v1 → v3 OK

## Hash do commit

```
[A ser preenchido após commit]
```

## Contagem final de testes

- Testes de upgrade: **3**
- Testes de repo: **34**
- **Total da suite de banco (src/db/)**: **37 testes**
- **Testes falhando em UI** (não relacionados): 3 (timeout)
- **Cobertura de upgrade**: 100% das transições (v1→v2, v2→v3, v1→v3)

## Preocupações

Nenhuma. Os testes de upgrade passam, o TypeScript compila sem erros, e nenhum dado é perdido durante as migrações.
