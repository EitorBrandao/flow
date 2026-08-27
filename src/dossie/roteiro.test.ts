import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { executarRoteiro } from './executar';
import { ROTEIRO } from './roteiro';

beforeEach(async () => {
  await limparDb();
});

it('tem os passos em ordem cronológica', () => {
  const datas = ROTEIRO.passos.map((p) => p.data);
  expect([...datas].sort()).toEqual(datas);
});

it('tem os cortes em ordem cronológica', () => {
  const datas = ROTEIRO.cortes.map((c) => c.data);
  expect([...datas].sort()).toEqual(datas);
});

// `serializar.ts` indexa os cortes pelo rótulo para pôr as linhas de `01-invariantes.md` em
// ordem cronológica. Dois rótulos iguais colapsam nesse índice, e a ordem sai errada sem
// nenhum erro — por isso a unicidade é checada aqui, e não deixada à disciplina de quem
// acrescenta um corte.
it('não repete rótulo de corte', () => {
  const rotulos = ROTEIRO.cortes.map((c) => c.rotulo);
  expect(new Set(rotulos).size).toBe(rotulos.length);
});

it('todo passo tem descrição em prosa', () => {
  for (const p of ROTEIRO.passos) {
    expect(p.descricao.length).toBeGreaterThan(15);
    expect(p.descricao).not.toMatch(/^[a-z-]+$/); // não é slug
  }
});

it('roda inteiro e produz um retrato por corte', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  expect(retratos).toHaveLength(ROTEIRO.cortes.length);
});

it('exercita a matriz status × origem inteira', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  const chaves = Object.keys(retratos[retratos.length - 1].contagemPorStatusOrigem);
  expect(chaves).toEqual(expect.arrayContaining([
    'efetivo/manual', 'previsto/manual', 'previsto/recorrencia',
    'efetivo/recorrencia', 'previsto/cartao', 'efetivo/cartao',
  ]));
});

it('gera fatura no cartão', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  expect(retratos[2].faturas.length).toBeGreaterThan(0);
});

it('duas execuções dão retratos idênticos', async () => {
  const primeira = await executarRoteiro(ROTEIRO);
  await limparDb();
  const segunda = await executarRoteiro(ROTEIRO);
  expect(JSON.stringify(segunda)).toBe(JSON.stringify(primeira));
});
