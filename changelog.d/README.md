# changelog.d/ — fragmentos de changelog

Cada mudança visível ao usuário entra aqui como **um arquivo próprio**, em vez de
editar o topo do `CHANGELOG.md` direto. Como cada feature mexe num arquivo
diferente, **sessões/branches paralelos nunca colidem** no changelog.

## Como criar um fragmento

Nome do arquivo: `<tipo>-<slug>.md`, onde `<tipo>` é um de:

- `adicionado-` → recurso novo
- `alterado-` → mudança de comportamento existente
- `removido-` → algo que saiu

Exemplos: `adicionado-exportar-backup.md`, `alterado-cores-valores.md`.

O conteúdo é um ou mais **bullets planos** (o parser do app só entende bullets
simples — sem negrito, sem aninhamento):

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
