import 'fake-indexeddb/auto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { limparDb } from '../test-setup';
import { executarRoteiro } from './executar';
import { checarTelas, checarTudo } from './invariantes';
import { ROTEIRO } from './roteiro';
import { montarDossie } from './serializar';
import { coletarTelas } from './tela';

const PASTA = join(process.cwd(), 'docs', 'dossie');

it('o dossiê no disco reflete o comportamento atual do app', async () => {
  await limparDb();
  const retratos = await executarRoteiro(ROTEIRO);
  const telas = await coletarTelas(retratos);
  const resultados = [...checarTudo(retratos), ...checarTelas(telas, retratos)];
  const arquivos = montarDossie(ROTEIRO, retratos, resultados, telas);

  if (process.env.DOSSIE === 'escrever') {
    mkdirSync(PASTA, { recursive: true });
    for (const a of arquivos) writeFileSync(join(PASTA, a.nome), a.conteudo, 'utf8');
    return;
  }

  const desatualizados = arquivos.filter((a) => {
    const caminho = join(PASTA, a.nome);
    return !existsSync(caminho) || readFileSync(caminho, 'utf8') !== a.conteudo;
  });

  expect(
    desatualizados.map((a) => a.nome),
    'o dossiê está desatualizado — rode `npm run dossie` e commite o resultado',
  ).toEqual([]);
});

it('nenhum invariante garantido está violado', async () => {
  await limparDb();
  const retratos = await executarRoteiro(ROTEIRO);
  const telas = await coletarTelas(retratos);
  const violados = [...checarTudo(retratos), ...checarTelas(telas, retratos)]
    .filter((r) => r.classe === 'garantido' && !r.ok)
    .map((r) => `${r.nome} @ ${r.corte}: ${r.detalhe}`);
  expect(violados).toEqual([]);
});
