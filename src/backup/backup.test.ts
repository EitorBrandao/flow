import type { Dados } from '../domain/types';
import { gerarBackup, mesclar, validarBackup } from './backup';

function dados(): Dados {
  return {
    boxes: [{ id: 'b1', nome: 'eitor', saldoInicial: 100, dataSaldoInicial: '2026-01-01', criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z' }],
    categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
    cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [], conferenciasFatura: [],
    viagens: [], bancos: [],
    config: { id: 'config', boxPadraoId: null, ultimoBackupEm: null, mudancasDesdeBackup: false, horizonteProjecao: '2027-12-31' },
  };
}

it('round-trip: gerar → serializar → validar', () => {
  const b = gerarBackup(dados());
  const volta = validarBackup(JSON.parse(JSON.stringify(b)));
  expect(volta.dados.boxes).toHaveLength(1);
  expect(volta.schema).toBe(3);
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

it('gerarBackup emite schema 3', () => {
  const b = gerarBackup(dados());
  expect(b.schema).toBe(3);
});

it('aceita backup schema 1 preenchendo as tabelas do cartão e viagens vazias', () => {
  const v1 = {
    app: 'flow', schema: 1, exportadoEm: '2026-01-01T00:00:00Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      config: { id: 'config' },
    },
  };
  const b = validarBackup(v1);
  expect(b.schema).toBe(3);
  expect(b.dados.cartoes).toEqual([]);
  expect(b.dados.conferenciasFatura).toEqual([]);
  expect(b.dados.viagens).toEqual([]);
});

it('aceita backup schema 3 sem a chave bancos preenchendo-a vazia, e mesclar não quebra', () => {
  // backup real de usuário: schema continua 3, mas `bancos` nasceu depois e não existe no arquivo
  const v3SemBancos = {
    app: 'flow', schema: 3, exportadoEm: '2026-01-01T00:00:00Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [], conferenciasFatura: [],
      viagens: [],
      config: { id: 'config' },
    },
  };
  const b = validarBackup(v3SemBancos);
  expect(b.dados.bancos).toEqual([]);
  expect(() => mesclar(dados(), b.dados)).not.toThrow();
});

it('aceita backup schema 2 preenchendo viagens vazia', () => {
  const v2 = {
    app: 'flow', schema: 2, exportadoEm: '2026-01-01T00:00:00Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [], conferenciasFatura: [],
      config: { id: 'config' },
    },
  };
  const b = validarBackup(v2);
  expect(b.schema).toBe(3);
  expect(b.dados.viagens).toEqual([]);
});

it('rejeita schema desconhecido', () => {
  expect(() => validarBackup({ app: 'flow', schema: 99, dados: {} }))
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

it('mescla viagens pelo alteradoEm mais recente', () => {
  const a = dados();
  const b = dados();
  const base = { nome: 'Praia', dataInicio: '2026-01-01', dataFim: '2026-01-05', criadoEm: '2026-01-01' };
  a.viagens = [{ ...base, id: 'v1', nome: 'Velho nome', alteradoEm: '2026-01-01' }];
  b.viagens = [{ ...base, id: 'v1', nome: 'Novo nome', alteradoEm: '2026-02-01' }];
  expect(mesclar(a, b).viagens[0].nome).toBe('Novo nome');
});

// ---------- validação adversarial ----------

function backupCom(config: unknown) {
  return { app: 'flow', schema: 3, exportadoEm: '2026-01-01T00:00:00Z', dados: { ...dados(), config } };
}

it('validarBackup rejeita config nulo, ausente ou que não é objeto', () => {
  // typeof null === 'object': é o caso que passava batido e só quebrava no repo
  expect(() => validarBackup(backupCom(null))).toThrow(/configuração ausente ou inválida/);
  expect(() => validarBackup(backupCom(undefined))).toThrow(/configuração ausente ou inválida/);
  expect(() => validarBackup(backupCom([]))).toThrow(/configuração ausente ou inválida/);
  expect(() => validarBackup(backupCom('config'))).toThrow(/configuração ausente ou inválida/);
  expect(() => validarBackup(backupCom(0))).toThrow(/configuração ausente ou inválida/);
});

it('validarBackup impõe o id do registro único de config', () => {
  const semId = validarBackup(backupCom({ horizonteProjecao: '2027-12-31' }));
  expect(semId.dados.config.id).toBe('config');
  const idErrado = validarBackup(backupCom({ id: 'outro', horizonteProjecao: '2027-12-31' }));
  expect(idErrado.dados.config.id).toBe('config');
});

it('validarBackup rejeita json que não é objeto e tabela faltando', () => {
  expect(() => validarBackup(null)).toThrow(/não é um backup do Flow/);
  expect(() => validarBackup('{}')).toThrow(/não é um backup do Flow/);
  expect(() => validarBackup([])).toThrow(/não é um backup do Flow/);
  const semRecorrencias = { app: 'flow', schema: 3, dados: { ...dados(), recorrencias: undefined } };
  expect(() => validarBackup(semRecorrencias)).toThrow(/corrompido/);
});

it('mesclar: alteradoEm no futuro vence — o backup manda, sem juízo sobre o relógio', () => {
  const a = dados();
  const b = dados();
  a.boxes[0] = { ...a.boxes[0], nome: 'local', alteradoEm: '2026-07-25T00:00:00Z' };
  b.boxes[0] = { ...b.boxes[0], nome: 'do futuro', alteradoEm: '2099-01-01T00:00:00Z' };
  expect(mesclar(a, b).boxes[0].nome).toBe('do futuro');
});

// ---------- conferência de fatura: uma por cartão e mês ----------

function conferencia(id: string, mes: string, valorAppCent: number, alteradoEm: string) {
  return { id, cartaoId: 'k1', mes, valorAppCent, usarValorApp: true, criadoEm: '2026-01-01', alteradoEm };
}

it('mesclar deixa uma só conferência por cartão e mês, a mais recente', () => {
  const a = dados();
  const b = dados();
  a.conferenciasFatura = [conferencia('cf1', '2026-03', 10_000, '2026-03-01')];
  b.conferenciasFatura = [conferencia('cf2', '2026-03', 25_000, '2026-03-10')];
  const m = mesclar(a, b).conferenciasFatura;
  expect(m).toHaveLength(1);
  expect(m[0].id).toBe('cf2');
  expect(m[0].valorAppCent).toBe(25_000);
});

it('mesclar desempata conferência do mesmo mês pelo id, sem depender da ordem', () => {
  const a = dados();
  const b = dados();
  a.conferenciasFatura = [conferencia('cf1', '2026-03', 10_000, '2026-03-01')];
  b.conferenciasFatura = [conferencia('cf2', '2026-03', 25_000, '2026-03-01')];
  expect(mesclar(a, b).conferenciasFatura[0].id).toBe('cf2');
  expect(mesclar(b, a).conferenciasFatura[0].id).toBe('cf2');
});

it('mesclar preserva conferências de meses e cartões diferentes', () => {
  const a = dados();
  const b = dados();
  a.conferenciasFatura = [conferencia('cf1', '2026-03', 10_000, '2026-03-01')];
  b.conferenciasFatura = [
    conferencia('cf2', '2026-04', 20_000, '2026-04-01'),
    { ...conferencia('cf3', '2026-03', 30_000, '2026-03-01'), cartaoId: 'k2' },
  ];
  expect(mesclar(a, b).conferenciasFatura.map((c) => c.id).sort()).toEqual(['cf1', 'cf2', 'cf3']);
});
