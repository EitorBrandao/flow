# Varredura fixa

Percorre as telas do Flow na tela do celular do usuário, mede e fotografa. Soma ao `npm test`; não o substitui.

## Como rodar

O Playwright não é dependência do projeto. Instale-o na pasta de rascunho da sessão e chame o roteiro de lá.

```
# pasta de rascunho
npm i playwright && npx playwright install chromium

# worktree da entrega
npx vite --port 5199 --strictPort --host localhost

# pasta de rascunho
node <worktree>/scripts/varredura/varredura.mjs http://localhost:5199/
```

O roteiro só aceita `localhost`. No site publicado estão os dados reais.

A versão do `playwright` precisa casar com o Chromium baixado. Se o Chromium da máquina já existe numa pasta `ms-playwright/chromium-NNNN`, instale a versão do `playwright` que usa essa revisão, em vez de baixar outro navegador.

## O que ele mede

| Tipo | O que é |
|---|---|
| `estouro` | a página rola para o lado |
| `alvo` | botão, link, campo ou aba com menos de 38 px de altura |
| `alinhamento` | irmãos de uma coluna que começam ou terminam de 1 a 8 px um do outro |
| `primario-fora` | ação principal atrás da barra de navegação ao abrir a tela |
| `dialogo-nativo` | o app abriu `window.confirm` ou `alert` |
| `erro-de-script` | erro não tratado na página |

Caixa de seleção e botão de opção são medidos pelo rótulo que os envolve. A medida é feita com a tela rolada para o topo e antes da captura: quem abre a tela a vê do começo.

## Como ler o resultado

A saída fica em `varredura/`, na pasta de onde você chamou: uma captura por passo, `relatorio.md` e `relatorio.json`. Um achado é identificado pelo tipo e pelo elemento, não pelo passo: o mesmo botão visto em duas telas é um achado só.

- **Código de saída 0:** nenhum achado novo. Envie as capturas ao usuário.
- **Código de saída 1:** há achado novo, passo que falhou ou captura faltando. Corrija a tela. Não acrescente o achado aos conhecidos para passar.
- **"Conhecidos que sumiram":** você corrigiu algo. Tire a linha de `conhecidos.json` no mesmo branch.

`--atualizar-conhecidos` regrava `conhecidos.json` com tudo o que a rodada achou. Use só quando o usuário aceitar um achado como ele é.

## Passos da sua entrega

Toda entrega visível acrescenta os próprios passos, num arquivo da pasta de rascunho:

```js
// passos-da-entrega.mjs
export const passos = [
  { nome: 'minha-tela', ir: async (page, ajuda) => { await ajuda.aba('Fluxo'); await page.getByRole('button', { name: 'Novo' }).click(); } },
];
```

```
node <worktree>/scripts/varredura/varredura.mjs http://localhost:5199/ --extra passos-da-entrega.mjs
```

Um passo pode ter `sair`, para fechar o que abriu: `sair: async (page) => { await page.keyboard.press('Escape'); }`.

## Dados da semente

A semente imita o uso real: uma box no modo Avançado, dois bancos, oito categorias, uma viagem ativa, previstos vencidos e lançamentos efetivos. Com menos que isso, o formulário de lançamento fica curto e o botão Lançar não chega à barra de navegação — e a varredura deixa de ver um defeito real.

## Limites

O Chromium sem tela não abre o teclado virtual. Câmera, leitura de comprovante e de nota fiscal não são varridas.
