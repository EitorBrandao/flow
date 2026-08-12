import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import * as repo from '../db/repo';
import { executarRoteiro, type Roteiro } from './executar';

beforeEach(async () => {
  await limparDb();
});

/** Roteiro mínimo: uma box, uma categoria, um ganho, um gasto previsto. */
function roteiroMinimo(): Roteiro {
  return {
    passos: [
      {
        data: '2026-01-01',
        descricao: 'abre a box "carteira" com saldo inicial de R$ 1.000,00',
        async executar() {
          await repo.salvarBox({
            id: 'box-carteira', nome: 'carteira',
            saldoInicial: 100000, dataSaldoInicial: '2026-01-01',
            criadoEm: '2026-01-01T12:00:00.000Z', alteradoEm: '2026-01-01T12:00:00.000Z',
          });
          await repo.salvarCategoria({ boxId: 'box-carteira', nome: 'renda', tipo: 'ganho', ordem: 0 });
        },
      },
      {
        data: '2026-02-10',
        descricao: 'recebe R$ 300,00 de renda',
        async executar(dados) {
          const renda = dados.categorias.find((c) => c.nome === 'renda')!;
          await repo.salvarLancamento({
            boxId: 'box-carteira', categoriaId: renda.id,
            data: '2026-02-10', valor: 30000, status: 'efetivo',
          });
        },
      },
    ],
    cortes: [
      { data: '2026-01-15', rotulo: 'depois da abertura' },
      { data: '2026-02-20', rotulo: 'depois do primeiro ganho' },
    ],
  };
}

it('devolve um retrato por corte, na ordem cronológica', async () => {
  const retratos = await executarRoteiro(roteiroMinimo());
  expect(retratos).toHaveLength(2);
  expect(retratos.map((r) => r.data)).toEqual(['2026-01-15', '2026-02-20']);
  expect(retratos[0].rotulo).toBe('depois da abertura');
});

it('o corte só enxerga os passos anteriores a ele', async () => {
  const retratos = await executarRoteiro(roteiroMinimo());
  const carteiraAntes = retratos[0].saldos.find((s) => s.nome === 'carteira')!;
  const carteiraDepois = retratos[1].saldos.find((s) => s.nome === 'carteira')!;
  expect(carteiraAntes.efetivo).toBe(100000);
  expect(carteiraDepois.efetivo).toBe(130000);
});

it('cria a box "casa" como o iniciar() do store faz', async () => {
  const retratos = await executarRoteiro(roteiroMinimo());
  const casa = retratos[0].dados.boxes.find((b) => b.nome === 'casa');
  expect(casa).toBeDefined();
  expect(casa!.saldoInicial).toBeNull();
});

it('conta os lançamentos pela matriz status × origem', async () => {
  const retratos = await executarRoteiro(roteiroMinimo());
  expect(retratos[1].contagemPorStatusOrigem['efetivo/manual']).toBe(1);
});

it('duas execuções dão retratos idênticos', async () => {
  const primeira = await executarRoteiro(roteiroMinimo());
  await limparDb();
  const segunda = await executarRoteiro(roteiroMinimo());
  expect(JSON.stringify(segunda)).toBe(JSON.stringify(primeira));
});

it('passo que estoura interrompe e diz qual passo', async () => {
  const roteiro = roteiroMinimo();
  roteiro.passos.push({
    data: '2026-03-01',
    descricao: 'passo que quebra de propósito',
    async executar() { throw new Error('falha interna'); },
  });
  await expect(executarRoteiro(roteiro)).rejects.toThrow(
    /passo 3 \(2026-03-01, "passo que quebra de propósito"\)/,
  );
});
