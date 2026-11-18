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
  'SimuladorSimples.tsx': 'o simular é rascunho passageiro e a tabela é o retorno; o guardar mostra "Guardada…" na própria tela',
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
    .map((arquivo) => ({ rel: path.relative(RAIZ, arquivo).replaceAll('\\', '/'), texto: fs.readFileSync(arquivo, 'utf8') }))
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
