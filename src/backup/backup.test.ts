import type { Dados } from '../domain/types';
import { gerarBackup, mesclar, validarBackup } from './backup';

function dados(): Dados {
  return {
    boxes: [{ id: 'b1', nome: 'eitor', saldoInicial: 100, dataSaldoInicial: '2026-01-01', criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z' }],
    categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
    cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [], conferenciasFatura: [],
    viagens: [], bancos: [], ajustesFechamento: [], notasFiscais: [],
    config: { id: 'config', boxPadraoId: null, ultimoBackupEm: null, mudancasDesdeBackup: false, horizonteProjecao: '2027-12-31' },
  };
}

it('round-trip: gerar → serializar → validar', () => {
  const b = gerarBackup(dados());
  const volta = validarBackup(JSON.parse(JSON.stringify(b)));
  expect(volta.dados.boxes).toHaveLength(1);
  expect(volta.schema).toBe(6);
});

it('backup com cenário rascunho valida e mescla com o campo preservado', () => {
  const d = dados();
  d.cenarios = [{ id: 'c1', nome: 'Simulação rápida', ligado: false, rascunho: true, criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z' }];
  const volta = validarBackup(JSON.parse(JSON.stringify(gerarBackup(d))));
  expect(volta.dados.cenarios[0].rascunho).toBe(true);
  expect(mesclar(dados(), volta.dados).cenarios[0].rascunho).toBe(true);
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

it('gerarBackup emite schema 6', () => {
  const b = gerarBackup(dados());
  expect(b.schema).toBe(6);
});

it('gerarBackup emite schema 6 e leva as notas fiscais', () => {
  const d = dados();
  d.notasFiscais = [{
    id: 'n1', compraCartaoId: 'c1', emitente: 'Mercado Exemplo LTDA', emissao: '2026-08-29',
    totalNotaCent: 6240, itens: [{ descricao: 'Produto A', valorCent: 1000 }],
    criadoEm: 'x', alteradoEm: '2026-08-29T00:00:00Z',
  }];
  const b = gerarBackup(d);
  expect(b.schema).toBe(6);
  const volta = validarBackup(JSON.parse(JSON.stringify(b)));
  expect(volta.dados.notasFiscais).toHaveLength(1);
  expect(volta.dados.notasFiscais[0].itens[0].valorCent).toBe(1000);
});

it('backup de schema 4 sem notasFiscais backfila lista vazia', () => {
  const d = dados() as unknown as Record<string, unknown>;
  delete d.notasFiscais;
  const volta = validarBackup({ app: 'flow', schema: 4, exportadoEm: 'x', dados: d });
  expect(volta.dados.notasFiscais).toEqual([]);
  expect(volta.schema).toBe(6);
});

it('backup de schema 5 da v0.27.0 sem notasFiscais é aceito e backfila lista vazia', () => {
  // Caso real: a v0.27.0 saiu com schema 5 e sem a tabela de notas. Recusar esse arquivo
  // trancaria o usuário fora do próprio backup.
  const d = dados() as unknown as Record<string, unknown>;
  delete d.notasFiscais;
  const volta = validarBackup({ app: 'flow', schema: 5, exportadoEm: 'x', dados: d });
  expect(volta.dados.notasFiscais).toEqual([]);
  expect(volta.dados.ajustesFechamento).toEqual([]);
  expect(volta.schema).toBe(6);
});

it('backup de schema 6 sem notasFiscais é recusado como corrompido', () => {
  const d = dados() as unknown as Record<string, unknown>;
  delete d.notasFiscais;
  expect(() => validarBackup({ app: 'flow', schema: 6, exportadoEm: 'x', dados: d }))
    .toThrow(/corrompido/);
});

it('recusa backup schema 6 com notasFiscais que não é array', () => {
  expect(() => validarBackup({
    app: 'flow', schema: 6, exportadoEm: '2026-08-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], bancos: [], ajustesFechamento: [],
      config: { id: 'config' }, notasFiscais: { id: 'n1' },
    },
  })).toThrow(/estrutura de dados inesperada/);
});

it('recusa backup schema 4 com notasFiscais que não é array', () => {
  expect(() => validarBackup({
    app: 'flow', schema: 4, exportadoEm: '2026-08-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], bancos: [], config: { id: 'config' }, notasFiscais: 'x',
    },
  })).toThrow(/estrutura de dados inesperada/);
});

it('backup schema 5 com notasFiscais real preserva o registro (não é apagado no backfill)', () => {
  // O backfill é condicionado a `!Array.isArray(dados.notasFiscais)`, não ao número do schema.
  // Um backup de schema 5 gerado por um branch que já tinha a entidade traz notas reais: se a
  // condição virasse `b.schema < 6`, essas notas virariam `[]` — perda silenciosa.
  const nota = {
    id: 'n1', compraCartaoId: 'c1', itens: [{ descricao: 'Produto A', valorCent: 1000 }],
    criadoEm: 'x', alteradoEm: '2026-08-29T00:00:00Z',
  };
  const b = validarBackup({
    app: 'flow', schema: 5, exportadoEm: '2026-08-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], bancos: [], ajustesFechamento: [],
      notasFiscais: [nota], config: { id: 'config' },
    },
  });
  expect(b.dados.notasFiscais).toEqual([nota]);
});

it('mesclar une notas fiscais dos dois lados e resolve conflito pelo alteradoEm', () => {
  const atual = dados();
  const backup = dados();
  atual.notasFiscais = [{
    id: 'n1', compraCartaoId: 'c1', itens: [{ descricao: 'Produto A', valorCent: 1000 }],
    criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z',
  }];
  backup.notasFiscais = [
    {
      id: 'n1', compraCartaoId: 'c1', itens: [{ descricao: 'Produto B', valorCent: 2000 }],
      criadoEm: 'x', alteradoEm: '2026-06-01T00:00:00Z',
    },
    { id: 'n2', compraCartaoId: 'c2', itens: [], criadoEm: 'x', alteradoEm: 'x' },
  ];
  const m = mesclar(atual, backup);
  expect(m.notasFiscais).toHaveLength(2);
  expect(m.notasFiscais.find((n) => n.id === 'n1')!.itens[0].descricao).toBe('Produto B');
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
  expect(b.schema).toBe(6);
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
  expect(b.schema).toBe(6);
  expect(b.dados.viagens).toEqual([]);
});

it('aceita backup schema 3 preenchendo bancos vazia', () => {
  const b = validarBackup({
    app: 'flow', schema: 3, exportadoEm: '2026-08-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], config: { id: 'config' },
    },
  });
  expect(b.schema).toBe(6);
  expect(b.dados.bancos).toEqual([]);
});

it('recusa backup schema 4 sem a tabela bancos', () => {
  expect(() => validarBackup({
    app: 'flow', schema: 4, exportadoEm: '2026-08-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], config: { id: 'config' },
    },
  })).toThrow(/estrutura de dados inesperada/);
});

it('recusa backup schema 4 com bancos que não é array', () => {
  expect(() => validarBackup({
    app: 'flow', schema: 4, exportadoEm: '2026-08-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], config: { id: 'config' }, bancos: { nome: 'Alfa' },
    },
  })).toThrow(/estrutura de dados inesperada/);
});

it('recusa backup schema 4 sem a tabela viagens ou com viagens que não é array', () => {
  // guarda a checagem `b.schema >= 3` de virar `b.schema === 3`: se voltar a `===`, um
  // backup schema 4 sem viagens bem formada passaria batido (não é < 3, não backfila;
  // não é === 3, não valida).
  const base = {
    app: 'flow', schema: 4, exportadoEm: '2026-08-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], bancos: [], notasFiscais: [], config: { id: 'config' },
    },
  };
  expect(() => validarBackup(base)).toThrow(/estrutura de dados inesperada/);
  expect(() => validarBackup({ ...base, dados: { ...base.dados, viagens: { nome: 'Praia' } } }))
    .toThrow(/estrutura de dados inesperada/);
});

it('backup schema 3 com bancos real preserva o registro (não é apagado no backfill)', () => {
  // o backfill de `bancos` é condicionado a `!Array.isArray(dados.bancos)`, não ao número
  // do schema: existem backups reais com schema 3 que já trazem `bancos` preenchido (a
  // entidade nasceu antes do bump). Se a condição virasse `b.schema < 4`, esses bancos reais
  // virariam `[]` — perda silenciosa de dado financeiro.
  const bancoReal = {
    id: 'bk1', boxId: 'box1', nome: 'Banco Teste', ordem: 0,
    saldoDeclaradoCent: 10_000, dataSaldoDeclarado: '2026-08-01',
    criadoEm: '2026-08-01T00:00:00.000Z', alteradoEm: '2026-08-01T00:00:00.000Z',
  };
  const b = validarBackup({
    app: 'flow', schema: 3, exportadoEm: '2026-08-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], bancos: [bancoReal], notasFiscais: [], config: { id: 'config' },
    },
  });
  expect(b.dados.bancos).toEqual([bancoReal]);
});

it('mescla bancos pelo alteradoEm mais recente', () => {
  const base = { id: '', boxId: 'box1', nome: '', ordem: 0, saldoDeclaradoCent: null, dataSaldoDeclarado: null, criadoEm: '2026-01-01', alteradoEm: '2026-01-01' };
  const a = dados();
  const b = dados();
  a.bancos = [{ ...base, id: 'bk1', nome: 'Nome velho', alteradoEm: '2026-01-01' }];
  b.bancos = [{ ...base, id: 'bk1', nome: 'Nome novo', alteradoEm: '2026-02-01' }];
  expect(mesclar(a, b).bancos[0].nome).toBe('Nome novo');
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

describe('mesclar: a box "casa" não duplica', () => {
  const caixa = (id: string, nome = 'casa') => ({ id, nome, saldoInicial: null, dataSaldoInicial: null, criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z' });
  const cat = (id: string, boxId: string) => ({ id, boxId, nome: 'Mercado', tipo: 'gasto' as const, ordem: 0, arquivada: false, criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z' });
  const lanc = (id: string, boxId: string, categoriaId: string) => ({ id, boxId, categoriaId, data: '2026-02-01', valor: 1000, status: 'efetivo' as const, origem: 'manual' as const, criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z' });

  it('app novo (casa com id próprio) mescla backup com outra casa: fica uma só, com os dados do backup', () => {
    const atual = dados();
    atual.boxes = [caixa('casa-nova')];
    const backup = dados();
    backup.boxes = [caixa('casa-velha'), { ...backup.boxes[0] }];
    backup.categorias = [cat('c1', 'casa-velha')];
    backup.lancamentos = [lanc('l1', 'casa-velha', 'c1')];
    backup.recorrencias = [{ id: 'r1', boxId: 'casa-velha', categoriaId: 'c1', dataInicio: '2026-01-01', diaDoMes: 1, valor: 500, parcelas: null, ativa: true, origem: 'manual', criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z' }];
    backup.cenarios = [{ id: 'k1', nome: 'Hipótese', ligado: false, escopo: 'casa-velha', criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z' }];
    backup.bancos = [{ id: 'bk1', boxId: 'casa-velha', nome: 'Banco', ordem: 0, saldoDeclaradoCent: null, dataSaldoDeclarado: null, criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z' }];
    backup.cartoes = [{ id: 'ct1', boxId: 'casa-velha', nome: 'Cartão', diaFechamento: 10, diaVencimento: 20, categoriaFaturaId: 'c1', ativo: true, criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z' }];

    const m = mesclar(atual, backup);

    expect(m.boxes.filter((x) => x.nome === 'casa').map((x) => x.id)).toEqual(['casa-nova']);
    expect(m.boxes).toHaveLength(2); // casa + b1
    expect(m.categorias[0].boxId).toBe('casa-nova');
    expect(m.lancamentos[0].boxId).toBe('casa-nova');
    expect(m.recorrencias[0].boxId).toBe('casa-nova');
    expect(m.cenarios[0].escopo).toBe('casa-nova');
    expect(m.bancos[0].boxId).toBe('casa-nova');
    expect(m.cartoes[0].boxId).toBe('casa-nova');
  });

  it('nenhum registro fica apontando para uma box que não existe', () => {
    const atual = dados();
    atual.boxes = [caixa('casa-nova')];
    const backup = dados();
    backup.boxes = [caixa('casa-velha')];
    backup.categorias = [cat('c1', 'casa-velha')];
    backup.lancamentos = [lanc('l1', 'casa-velha', 'c1')];
    const m = mesclar(atual, backup);
    const ids = new Set(m.boxes.map((x) => x.id));
    expect(m.boxes.filter((x) => x.nome === 'casa')).toHaveLength(1);
    expect(m.lancamentos.every((l) => ids.has(l.boxId))).toBe(true);
    expect(m.categorias.every((c) => ids.has(c.boxId))).toBe(true);
  });

  it('mesma casa nos dois lados (mesmo id): nada muda', () => {
    const atual = dados();
    atual.boxes = [caixa('casa-1')];
    const backup = dados();
    backup.boxes = [caixa('casa-1')];
    backup.lancamentos = [lanc('l1', 'casa-1', 'c1')];
    const m = mesclar(atual, backup);
    expect(m.boxes).toHaveLength(1);
    expect(m.lancamentos[0].boxId).toBe('casa-1');
  });

  it('só o backup tem casa: ela entra como está', () => {
    const atual = dados();
    const backup = dados();
    backup.boxes = [caixa('casa-velha')];
    const m = mesclar(atual, backup);
    expect(m.boxes.map((x) => x.id).sort()).toEqual(['b1', 'casa-velha']);
  });

  it('boxes de outro nome com ids diferentes continuam entrando as duas', () => {
    const atual = dados();
    const backup = dados();
    backup.boxes = [{ ...backup.boxes[0], id: 'b2', nome: 'outra' }];
    expect(mesclar(atual, backup).boxes).toHaveLength(2);
  });

  it('não altera os objetos recebidos', () => {
    const atual = dados();
    atual.boxes = [caixa('casa-nova')];
    const backup = dados();
    backup.boxes = [caixa('casa-velha')];
    backup.lancamentos = [lanc('l1', 'casa-velha', 'c1')];
    mesclar(atual, backup);
    expect(backup.lancamentos[0].boxId).toBe('casa-velha');
    expect(backup.boxes).toHaveLength(1);
  });
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

// ---------- ajuste de fechamento: schema 5 ----------

it('aceita backup schema 4 preenchendo ajustesFechamento vazia', () => {
  const b = validarBackup({
    app: 'flow', schema: 4, exportadoEm: '2026-09-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], bancos: [], config: { id: 'config' },
    },
  });
  expect(b.schema).toBe(6);
  expect(b.dados.ajustesFechamento).toEqual([]);
});

it('recusa backup schema 5 sem a tabela ajustesFechamento', () => {
  expect(() => validarBackup({
    app: 'flow', schema: 5, exportadoEm: '2026-09-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], bancos: [], config: { id: 'config' },
    },
  })).toThrow(/estrutura de dados inesperada/);
});

it('recusa backup schema 5 com ajustesFechamento que não é array', () => {
  expect(() => validarBackup({
    app: 'flow', schema: 5, exportadoEm: '2026-09-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], bancos: [], config: { id: 'config' },
      ajustesFechamento: { dia: 30 },
    },
  })).toThrow(/estrutura de dados inesperada/);
});

function ajuste(id: string, mes: string, diaFechamento: number, alteradoEm: string) {
  return { id, cartaoId: 'k1', mes, diaFechamento, criadoEm: '2026-01-01', alteradoEm };
}

it('mesclar deixa um só ajuste de fechamento por cartão e mês, o mais recente', () => {
  const a = dados();
  const b = dados();
  a.ajustesFechamento = [ajuste('af1', '2026-07', 28, '2026-07-01')];
  b.ajustesFechamento = [ajuste('af2', '2026-07', 30, '2026-07-10')];
  const m = mesclar(a, b).ajustesFechamento;
  expect(m).toHaveLength(1);
  expect(m[0]).toMatchObject({ id: 'af2', diaFechamento: 30 });
});

it('mesclar preserva ajustes de meses e cartões diferentes', () => {
  const a = dados();
  const b = dados();
  a.ajustesFechamento = [ajuste('af1', '2026-07', 28, '2026-07-01')];
  b.ajustesFechamento = [
    ajuste('af2', '2026-08', 15, '2026-08-01'),
    { ...ajuste('af3', '2026-07', 20, '2026-07-01'), cartaoId: 'k2' },
  ];
  expect(mesclar(a, b).ajustesFechamento.map((x) => x.id).sort()).toEqual(['af1', 'af2', 'af3']);
});

it('round-trip preserva o banco padrão, o banco do lançamento e o da recorrência', () => {
  const d = dados();
  d.bancos = [{
    id: 'bk1', boxId: 'b1', nome: 'Banco Um', ordem: 0, saldoDeclaradoCent: null,
    dataSaldoDeclarado: null, padrao: true, criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z',
  }];
  d.lancamentos = [{
    id: 'l1', boxId: 'b1', categoriaId: 'c1', data: '2026-08-02', valor: 1000, status: 'efetivo',
    origem: 'manual', bancoId: 'bk1', criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z',
  }];
  d.recorrencias = [{
    id: 'r1', boxId: 'b1', categoriaId: 'c1', valor: 1000, dataInicio: '2026-08-01', diaDoMes: 5,
    parcelas: null, ativa: true, origem: 'manual', bancoId: 'bk1', criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z',
  }];

  const volta = validarBackup(JSON.parse(JSON.stringify(gerarBackup(d))));

  expect(volta.dados.bancos[0].padrao).toBe(true);
  expect(volta.dados.lancamentos[0].bancoId).toBe('bk1');
  expect(volta.dados.recorrencias[0].bancoId).toBe('bk1');
});

it('backup antigo, sem os campos de banco padrão e de banco do lançamento, continua válido', () => {
  const d = dados();
  d.bancos = [{
    id: 'bk1', boxId: 'b1', nome: 'Banco Um', ordem: 0, saldoDeclaradoCent: null,
    dataSaldoDeclarado: null, criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z',
  }];
  d.lancamentos = [{
    id: 'l1', boxId: 'b1', categoriaId: 'c1', data: '2026-08-02', valor: 1000, status: 'efetivo',
    origem: 'manual', criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z',
  }];

  const volta = validarBackup(JSON.parse(JSON.stringify(gerarBackup(d))));

  expect(volta.dados.bancos[0].padrao).toBeUndefined();
  expect(volta.dados.lancamentos[0].bancoId).toBeUndefined();
});

it('mesclar: o banco padrão e o banco do lançamento seguem o registro mais recente', () => {
  const base = {
    id: 'bk1', boxId: 'b1', nome: 'Banco Um', ordem: 0, saldoDeclaradoCent: null,
    dataSaldoDeclarado: null, criadoEm: 'x',
  };
  const atual = dados();
  const backup = dados();
  atual.bancos = [{ ...base, padrao: true, alteradoEm: '2026-01-01T00:00:00Z' }];
  backup.bancos = [{ ...base, padrao: false, alteradoEm: '2026-02-01T00:00:00Z' }];
  const lancBase = {
    id: 'l1', boxId: 'b1', categoriaId: 'c1', data: '2026-08-02', valor: 1000, status: 'efetivo' as const,
    origem: 'manual' as const, criadoEm: 'x',
  };
  atual.lancamentos = [{ ...lancBase, bancoId: 'bk1', alteradoEm: '2026-03-01T00:00:00Z' }];
  backup.lancamentos = [{ ...lancBase, alteradoEm: '2026-02-01T00:00:00Z' }];

  const m = mesclar(atual, backup);

  expect(m.bancos[0].padrao).toBe(false);
  expect(m.lancamentos[0].bancoId).toBe('bk1');
});

// ---------- modos de uso ----------

it('validarBackup: backup sem modos valida e a config volta sem modos', () => {
  const v = validarBackup(backupCom({ horizonteProjecao: '2027-12-31' }));
  expect('modos' in v.dados.config).toBe(false);
  const comUndefined = validarBackup(backupCom({ horizonteProjecao: '2027-12-31', modos: undefined }));
  expect(comUndefined.dados.config.modos).toBeUndefined();
});

it('validarBackup: modos válidos passam e são preservados', () => {
  const modos = { hoje: 'simples', fluxo: 'avancado', cartao: 'simples' };
  const v = validarBackup(backupCom({ horizonteProjecao: '2027-12-31', modos }));
  expect(v.dados.config.modos).toEqual(modos);
  expect(validarBackup(backupCom({ modos: {} })).dados.config.modos).toEqual({});
});

it('validarBackup: modos com valor inválido lança erro em português', () => {
  expect(() => validarBackup(backupCom({ modos: { hoje: 'facil' } }))).toThrow(/modos de uso inválidos/);
  expect(() => validarBackup(backupCom({ modos: { telaInexistente: 'simples' } }))).toThrow(/modos de uso inválidos/);
  expect(() => validarBackup(backupCom({ modos: { hoje: null } }))).toThrow(/modos de uso inválidos/);
});

it('validarBackup: modos que não é objeto lança erro', () => {
  expect(() => validarBackup(backupCom({ modos: [] }))).toThrow(/modos de uso inválidos/);
  expect(() => validarBackup(backupCom({ modos: 'x' }))).toThrow(/modos de uso inválidos/);
  expect(() => validarBackup(backupCom({ modos: null }))).toThrow(/modos de uso inválidos/);
  expect(() => validarBackup(backupCom({ modos: 0 }))).toThrow(/modos de uso inválidos/);
});

it('mesclar mantém os modos da config local', () => {
  const atual = dados();
  atual.config.modos = { hoje: 'simples' };
  const backup = dados();
  backup.config.modos = { hoje: 'avancado', fluxo: 'simples' };
  expect(mesclar(atual, backup).config.modos).toEqual({ hoje: 'simples' });
  const semModos = dados();
  expect(mesclar(semModos, backup).config.modos).toBeUndefined();
});

describe('escopo do cenário no backup', () => {
  const cenario = (extra: Record<string, unknown> = {}) => ({
    id: 'c1', nome: 'Viagem', ligado: true, criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z', ...extra,
  });
  const comCenario = (extra: Record<string, unknown> = {}) => {
    const d = dados();
    d.cenarios = [cenario(extra) as unknown as Dados['cenarios'][number]];
    return JSON.parse(JSON.stringify(gerarBackup(d)));
  };

  it('aceita cenário sem escopo e não inventa o campo', () => {
    const volta = validarBackup(comCenario());
    expect('escopo' in volta.dados.cenarios[0]).toBe(false);
  });

  it('aceita escopo casa e escopo de box, preservando o valor', () => {
    expect(validarBackup(comCenario({ escopo: 'casa' })).dados.cenarios[0].escopo).toBe('casa');
    expect(validarBackup(comCenario({ escopo: 'b1' })).dados.cenarios[0].escopo).toBe('b1');
  });

  it.each([[123], [null], [{}], [['x']], [''], [true]])('rejeita escopo inválido %j', (invalido) => {
    expect(() => validarBackup(comCenario({ escopo: invalido }))).toThrow(/Backup corrompido: escopo de cenário inválido/);
  });

  it('rejeita escopo inválido mesmo com outros cenários válidos', () => {
    const b = comCenario({ escopo: 'casa' });
    b.dados.cenarios.push(cenario({ id: 'c2', escopo: 5 }));
    expect(() => validarBackup(b)).toThrow(/escopo de cenário inválido/);
  });

  it('rejeita escopo de box que não existe no backup (cenário órfão)', () => {
    expect(() => validarBackup(comCenario({ escopo: 'box-fantasma' })))
      .toThrow('Backup corrompido: escopo de cenário inválido.');
  });

  it('rejeita escopo que só difere de casa na caixa ou nos espaços', () => {
    expect(() => validarBackup(comCenario({ escopo: 'Casa' }))).toThrow(/escopo de cenário inválido/);
    expect(() => validarBackup(comCenario({ escopo: ' casa' }))).toThrow(/escopo de cenário inválido/);
  });

  it('rejeita escopo de box quando o backup não traz nenhuma box', () => {
    const b = comCenario({ escopo: 'b1' });
    b.dados.boxes = [];
    expect(() => validarBackup(b)).toThrow(/escopo de cenário inválido/);
  });

  it('mesclar aceita cenário de escopo válido com alteradoEm no futuro', () => {
    const atual = dados();
    atual.cenarios = [cenario({ escopo: 'b1' }) as unknown as Dados['cenarios'][number]];
    const backup = validarBackup(comCenario({ escopo: 'casa', alteradoEm: '2999-01-01T00:00:00Z' })).dados;
    const m = mesclar(atual, backup);
    expect(m.cenarios).toHaveLength(1);
    expect(m.cenarios[0].escopo).toBe('casa');
  });

  it('elemento nulo na tabela de cenários não lança erro de tipo no validador', () => {
    const b = comCenario();
    b.dados.cenarios.push(null);
    expect(() => validarBackup(b)).not.toThrow(TypeError);
  });

  it('mesclar preserva o escopo e não duplica o cenário de mesmo id', () => {
    const atual = dados();
    atual.cenarios = [cenario({ escopo: 'b1' }) as unknown as Dados['cenarios'][number]];
    const backup = validarBackup(comCenario({ escopo: 'casa', alteradoEm: '2026-06-01T00:00:00Z' })).dados;
    const m = mesclar(atual, backup);
    expect(m.cenarios).toHaveLength(1);
    expect(m.cenarios[0].escopo).toBe('casa');
    const m2 = mesclar(backup, atual);
    expect(m2.cenarios).toHaveLength(1);
    expect(m2.cenarios[0].escopo).toBe('casa');
  });

  it('ida e volta: gerar e validar devolve o mesmo escopo', () => {
    const d = dados();
    d.cenarios = [cenario({ escopo: 'b1' }) as unknown as Dados['cenarios'][number]];
    const volta = validarBackup(JSON.parse(JSON.stringify(gerarBackup(d))));
    expect(volta.dados.cenarios[0].escopo).toBe('b1');
  });
});
