import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { executarRoteiro } from './executar';
import { ROTEIRO } from './roteiro';
import { INVARIANTES, checarTelas, checarTudo } from './invariantes';
import { PREFIXO_EXCECAO } from './tela';

beforeEach(async () => {
  await limparDb();
});

it('todo invariante declara nome e classe', () => {
  for (const inv of INVARIANTES) {
    expect(inv.nome.length).toBeGreaterThan(3);
    expect(['garantido', 'expectativa']).toContain(inv.classe);
    expect(inv.checar ?? inv.checarPar).toBeDefined();
  }
});

it('o roteiro passa em todos os invariantes garantidos', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  const reprovados = checarTudo(retratos)
    .filter((r) => r.classe === 'garantido' && !r.ok);
  expect(reprovados.map((r) => `${r.nome} @ ${r.corte}: ${r.detalhe}`)).toEqual([]);
});

it('checa cada invariante em cada corte', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  const resultados = checarTudo(retratos);
  const soDeUmCorte = INVARIANTES.filter((i) => i.checar).length;
  const dePar = INVARIANTES.filter((i) => i.checarPar).length;
  expect(resultados).toHaveLength(soDeUmCorte * 6 + dePar * 5);
});

it('detecta referência quebrada e nomeia o registro', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  retratos[0].dados.lancamentos[0].categoriaId = 'id-inexistente';
  const achado = checarTudo(retratos)
    .find((r) => r.nome === 'referências resolvem' && !r.ok);
  expect(achado).toBeDefined();
  expect(achado!.detalhe).toContain('id-inexistente');
});

it('violação de expectativa não conta como garantida', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  retratos[0].dados.lancamentos[0].cenarioId = 'cen-x';
  retratos[0].dados.lancamentos[0].status = 'efetivo';
  const resultados = checarTudo(retratos);
  const violado = resultados.find((r) => r.nome === 'cenário nunca é efetivo' && !r.ok);
  expect(violado).toBeDefined();
  expect(violado!.classe).toBe('expectativa');
  expect(resultados.filter((r) => r.classe === 'garantido' && !r.ok)).toEqual([]);
});

it('tela que estourou reprova e diz qual aba', () => {
  const resultados = checarTelas([
    { rotulo: 'corte de teste', textos: { hoje: 'button: Hoje', cartao: `${PREFIXO_EXCECAO}saldo indefinido` } },
  ]);
  const violado = resultados.find((r) => !r.ok);
  expect(violado).toBeDefined();
  expect(violado!.classe).toBe('garantido');
  expect(violado!.detalhe).toContain('cartao');
  expect(violado!.detalhe).toContain('saldo indefinido');
});

it('telas sem exceção passam', () => {
  const resultados = checarTelas([
    { rotulo: 'corte de teste', textos: { hoje: 'button: Hoje', cartao: 'heading: Cartão' } },
  ]);
  expect(resultados.every((r) => r.ok)).toBe(true);
});
