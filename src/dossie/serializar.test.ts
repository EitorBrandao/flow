import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { executarRoteiro } from './executar';
import { checarTelas, checarTudo } from './invariantes';
import { ROTEIRO } from './roteiro';
import { montarDossie } from './serializar';
import { coletarTelas } from './tela';

beforeEach(async () => {
  await limparDb();
});

async function gerar() {
  const retratos = await executarRoteiro(ROTEIRO);
  const telas = await coletarTelas(retratos);
  const resultados = [...checarTudo(retratos), ...checarTelas(telas, retratos)];
  return montarDossie(ROTEIRO, retratos, resultados, telas);
}

it('monta os quatro arquivos, na ordem', async () => {
  const arquivos = await gerar();
  expect(arquivos.map((a) => a.nome)).toEqual([
    '00-roteiro.md', '01-invariantes.md', '02-motor.md', '03-telas.md',
  ]);
});

it('não deixa espaço no fim da linha nem falta quebra final', async () => {
  for (const a of await gerar()) {
    expect(a.conteudo.endsWith('\n'), `${a.nome} não termina com quebra`).toBe(true);
    expect(a.conteudo, `${a.nome} tem espaço no fim de linha`).not.toMatch(/[ \t]+\n/);
  }
});

it('escreve dinheiro em reais, não em centavos', async () => {
  const motor = (await gerar()).find((a) => a.nome === '02-motor.md')!;
  expect(motor.conteudo).toContain('R$');
});

it('traz a descrição de cada passo do roteiro', async () => {
  const roteiro = (await gerar()).find((a) => a.nome === '00-roteiro.md')!;
  for (const p of ROTEIRO.passos) {
    expect(roteiro.conteudo).toContain(p.descricao);
  }
});

it('traz cada invariante com a sua classe', async () => {
  const inv = (await gerar()).find((a) => a.nome === '01-invariantes.md')!;
  expect(inv.conteudo).toContain('garantido');
  expect(inv.conteudo).toContain('expectativa');
});

it('duas montagens dão byte igual', async () => {
  const primeira = await gerar();
  await limparDb();
  const segunda = await gerar();
  expect(segunda).toEqual(primeira);
});
