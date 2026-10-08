# Flow

App de controle financeiro pessoal: fluxo de caixa diário com saldo projetado. PWA
local-first — **não existe servidor**, todos os dados vivem no IndexedDB do seu navegador.

**[→ Abrir o app](https://eitorbrandao.github.io/flow/)**

## O que ele faz

- **Hoje** — saldo atual, entradas e saídas do dia, projeção dos próximos dias.
- **Fluxo** — lançamentos dia a dia com saldo projetado até o horizonte configurado, em lista, em gráfico e em **Simular** (cenários de gastos e ganhos futuros, mês a mês).
- **Lançar** — ganhos e gastos manuais; o botão **+** também lança compra no cartão, à vista ou parcelada.
- **Cartão** — faturas por ciclo de fechamento/vencimento, com as assinaturas embutidas, e conferência da fatura.
- **Análises** — composição por categoria, evolução mensal, comparativo, categorias do cartão e viagens, por mês, 12 meses, ano ou intervalo livre.
- **Ajustes** — cinco grupos: Contas (boxes e bancos), Planejamento (categorias, recorrências e viagens), Cartão (cartões, categorias do cartão e assinaturas), Dados (importar e conferir extrato e fatura; backup e restauração) e Sobre o app (modo de uso, wiki e versão).

Boxes são contas ou perfis separados; o chip do topo escolhe qual box o app inteiro enxerga, ou a **casa**, que soma todas.

Cada tela tem o modo **Simples** (o essencial) e o **Avançado**. O app novo começa no Simples.

## Seus dados ficam só no seu navegador

Não há conta, login nem sincronização. Isso significa que **limpar os dados do site, trocar
de aparelho ou desinstalar o PWA apaga tudo**. Exporte um backup em
**Ajustes → Backup e restauração** com regularidade e guarde o arquivo fora do navegador.

## Rodar localmente

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm test         # suíte completa (vitest)
npm run build    # checagem de tipos + build de produção
```

Node 24 (a mesma versão do CI).

## Stack

React 18 + TypeScript + Vite · Zustand (estado) · Dexie/IndexedDB (persistência) · Recharts
(gráficos) · framer-motion (animação) · vite-plugin-pwa. Código, interface e documentação em
português.

## Documentação

- [`CLAUDE.md`](CLAUDE.md) — arquitetura, convenções e regras do repositório.
- [`docs/README.md`](docs/README.md) — mapa de toda a documentação.
- [`docs/dominio.md`](docs/dominio.md) — modelo de dados e invariantes.
- [`docs/wiki/`](docs/wiki/) — a wiki do app, em markdown.
- [`docs/licoes-aprendidas.md`](docs/licoes-aprendidas.md) — o que o projeto aprendeu errando.
- [`docs/estilo-visual.md`](docs/estilo-visual.md) — guia de estilo da interface, indexado por nível de edição.
- [`CHANGELOG.md`](CHANGELOG.md) — histórico de versões (a mesma lista aparece em Ajustes → Versão).
