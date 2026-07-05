import type { Dados } from '../domain/types';
import { gerarBackup, mesclar, validarBackup } from './backup';

function dados(): Dados {
  return {
    boxes: [{ id: 'b1', nome: 'eitor', saldoInicial: 100, dataSaldoInicial: '2026-01-01', criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z' }],
    categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
    cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [], conferenciasFatura: [],
    config: { id: 'config', boxPadraoId: null, ultimoBackupEm: null, mudancasDesdeBackup: false, horizonteProjecao: '2027-12-31' },
  };
}

it('round-trip: gerar → serializar → validar', () => {
  const b = gerarBackup(dados());
  const volta = validarBackup(JSON.parse(JSON.stringify(b)));
  expect(volta.dados.boxes).toHaveLength(1);
  expect(volta.schema).toBe(2);
});

it('validarBackup rejeita arquivo de outro app ou schema', () => {
  expect(() => validarBackup({ app: 'outro' })).toThrow(/não é um backup do Flow/);
  expect(() => validarBackup({ app: 'flow', schema: 99, dados: {} })).toThrow(/versão/);
  expect(() => validarBackup({ app: 'flow', schema: 1, dados: { boxes: 'x' } })).toThrow(/corrompido/);
});

it('mesclar: vence o alteradoEm mais recente, config do atual mantida', () => {
  const atual = dados();
  const backup = dados();
  backup.boxes[0] = { ...backup.boxes[0], nome: 'eitor novo', alteradoEm: '2026-06-01T00:00:00Z' };
  backup.config.horizonteProjecao = '2099-12-31';
  const m = mesclar(atual, backup);
  expect(m.boxes[0].nome).toBe('eitor novo');
  expect(m.config.horizonteProjecao).toBe('2027-12-31');
  const atual2 = dados();
  atual2.boxes[0] = { ...atual2.boxes[0], nome: 'local mais novo', alteradoEm: '2026-07-01T00:00:00Z' };
  expect(mesclar(atual2, backup).boxes[0].nome).toBe('local mais novo');
});

it('mesclar une registros de ids diferentes', () => {
  const atual = dados();
  const backup = dados();
  backup.boxes.push({ id: 'b2', nome: 'ju', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: 'x', alteradoEm: 'x' });
  expect(mesclar(atual, backup).boxes).toHaveLength(2);
});

it('gerarBackup emite schema 2', () => {
  const b = gerarBackup(dados());
  expect(b.schema).toBe(2);
});

it('aceita backup schema 1 preenchendo as tabelas do cartão vazias', () => {
  const v1 = {
    app: 'flow', schema: 1, exportadoEm: '2026-01-01T00:00:00Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      config: { id: 'config' },
    },
  };
  const b = validarBackup(v1);
  expect(b.schema).toBe(2);
  expect(b.dados.cartoes).toEqual([]);
  expect(b.dados.conferenciasFatura).toEqual([]);
});

it('rejeita schema desconhecido', () => {
  expect(() => validarBackup({ app: 'flow', schema: 3, dados: {} }))
    .toThrow(/versão incompatível/);
});

it('mescla cartões e compras pelo alteradoEm mais recente', () => {
  const a = dados();
  const b = dados();
  const base = { boxId: 'b', nome: 'Nu', diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: 'c', ativo: true, criadoEm: '2026-01-01' };
  a.cartoes = [{ ...base, id: 'k1', nome: 'Velho', alteradoEm: '2026-01-01' }];
  b.cartoes = [{ ...base, id: 'k1', nome: 'Novo', alteradoEm: '2026-02-01' }];
  expect(mesclar(a, b).cartoes[0].nome).toBe('Novo');
});
