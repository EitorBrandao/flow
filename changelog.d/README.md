# changelog.d/ — fragmentos de changelog

Cada mudança visível ao usuário entra aqui como **um arquivo próprio**, em vez de
editar o topo do `CHANGELOG.md` direto. Como cada feature mexe num arquivo
diferente, **sessões/branches paralelos nunca colidem** no changelog.

**"Visível ao usuário"** = muda o que ele vê ou o resultado que obtém — inclui
correção de cálculo ou de comportamento, por mais sutil. Refactor puro, docs e
tooling não viram fragmento.

## Como criar um fragmento

Nome do arquivo: `<tipo>-<slug>.md`, onde `<tipo>` é um de:

- `adicionado-` → recurso novo
- `alterado-` → mudança de comportamento existente
- `removido-` → algo que saiu

Exemplos: `adicionado-exportar-backup.md`, `alterado-cores-valores.md`.

O conteúdo é um ou mais **bullets planos**: toda linha começa com `- `, sem
negrito, sem sub-itens indentados — o parser do app (`src/ui/ajustes/changelog.ts`)
só entende isso; markdown rico passa no release e quebra a tela de Versão depois:

```
- Botão de exportar backup na tela de Ajustes.
- Aviso quando o backup falha silenciosamente.
```

## Regra de ouro

Branches de feature **só** criam fragmentos aqui. Eles **nunca** editam
`package.json` (`version`) nem o topo do `CHANGELOG.md`.

## Na integração (uma vez, no branch `main`)

`npm run release -- <patch|minor|major>` junta todos os fragmentos numa nova
seção `## [X.Y.Z] - AAAA-MM-DD` no topo do `CHANGELOG.md`, apaga os fragmentos,
bumpa a versão em `package.json` e cria o commit + tag do release. Veja
`scripts/release.mjs`.

Escolha do bump: só correções → `patch`; recurso ou comportamento novo
(`adicionado-`/`alterado-`) → `minor`; remoção de recurso ou quebra de
compatibilidade de dados/backup → `major`.
