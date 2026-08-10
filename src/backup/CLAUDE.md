# src/backup/

Um erro aqui custa dados financeiros do usuário. Esses dados não têm servidor, nem cópia automática. `docs/dominio.md` descreve o modelo conceitual e os invariantes.

- Toda mudança aqui exige testes adversariais: JSON malformado, campos ausentes, `config` nulo, `alteradoEm` no futuro. **Nunca relaxe `validarBackup`.** A validação de import só pode ficar mais rígida, nunca mais frouxa.
