# src/db/

Um erro aqui custa dados financeiros do usuário. Esses dados não têm servidor, nem cópia automática. `docs/dominio.md` descreve o modelo conceitual e os invariantes.

- Toda nova `this.version(n)` no Dexie exige um teste do caminho de upgrade, no mesmo commit. O teste deve popular dados no schema n−1, e depois abrir esses dados no schema n.
- Sessões paralelas podem criar a mesma `this.version(n)`. Antes do merge, compare o maior `n` de `database.ts` com o da `main` atual. Se colidir, renumere a sua versão e o teste de upgrade.
