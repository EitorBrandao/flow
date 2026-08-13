import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { executarRoteiro } from './executar';
import { ROTEIRO } from './roteiro';
import { INVARIANTES, checarTelas, checarTudo } from './invariantes';
import { PREFIXO_EXCECAO, type TelasDoCorte } from './tela';
import type { Retrato } from './retrato';
import type { Dados } from '../domain/types';
import * as backupMod from '../backup/backup';

beforeEach(async () => {
  await limparDb();
});

/** Um `Dados` mínimo, com um único cartão cuja categoria de fatura leva o nome dado. */
function dadosComCartao(nomeCartao: string): Dados {
  const agora = '2026-01-01T00:00:00.000Z';
  return {
    boxes: [],
    categorias: [
      { id: 'cat-fatura', boxId: 'box-1', nome: nomeCartao, tipo: 'gasto', ordem: 0, arquivada: false, criadoEm: agora, alteradoEm: agora },
    ],
    lancamentos: [],
    recorrencias: [],
    cenarios: [],
    cartoes: [
      {
        id: 'cartao-1', boxId: 'box-1', nome: nomeCartao, diaFechamento: 5, diaVencimento: 15,
        categoriaFaturaId: 'cat-fatura', ativo: true, criadoEm: agora, alteradoEm: agora,
      },
    ],
    categoriasCartao: [],
    comprasCartao: [],
    recorrenciasCartao: [],
    conferenciasFatura: [],
    viagens: [],
    bancos: [],
    config: {
      id: 'config', boxPadraoId: null, ultimoBackupEm: null,
      mudancasDesdeBackup: false, horizonteProjecao: '2026-12-31',
    },
  };
}

/** Um `Retrato` sintético, só com `dados` preenchido — o resto fica vazio de propósito. */
function retratoMinimo(dados: Dados, rotulo = 'corte sintético'): Retrato {
  return {
    data: '2026-01-01',
    rotulo,
    saldos: [],
    marcos: { minimo: null, maximo: null, fimDeMes: [] },
    serie: [],
    faturas: [],
    contagemPorStatusOrigem: {},
    dados,
  };
}

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
  // Muda o mesmo lançamento, pelo id, em todos os cortes onde ele existe — e sempre para o
  // mesmo estado (efetivo). Mudar só o primeiro corte criaria, como efeito colateral, uma
  // regressão de status entre um corte e o seguinte, e isso violaria "efetivo não volta a
  // previsto" (garantido) por um motivo alheio ao que este teste quer provar.
  const idAlvo = retratos[0].dados.lancamentos[0].id;
  for (const r of retratos) {
    const alvo = r.dados.lancamentos.find((l) => l.id === idAlvo);
    if (alvo) {
      alvo.cenarioId = 'cen-x';
      alvo.status = 'efetivo';
    }
  }
  const resultados = checarTudo(retratos);
  const violado = resultados.find((r) => r.nome === 'cenário nunca é efetivo' && !r.ok);
  expect(violado).toBeDefined();
  expect(violado!.classe).toBe('expectativa');
  expect(resultados.filter((r) => r.classe === 'garantido' && !r.ok)).toEqual([]);
});

it('lançamento de cenário que volta a previsto reprova "efetivo não volta a previsto"', async () => {
  // Prova que a Correção 1 removeu a exclusão de propósito: hoje o roteiro nunca produz esse
  // caminho de verdade (o lançamento de cenário nasce `previsto` e nunca vira `efetivo`), mas
  // o invariante tem que pegar se algo indevido fizer um lançamento de cenário regredir.
  const retratos = await executarRoteiro(ROTEIRO);
  const anterior = retratos[0];
  const atual = retratos[1];
  const alvo = { ...anterior.dados.lancamentos[0], id: 'lanc-cenario-teste', cenarioId: 'cen-teste', status: 'efetivo' as const };
  anterior.dados.lancamentos = [...anterior.dados.lancamentos, alvo];
  atual.dados.lancamentos = [...atual.dados.lancamentos, { ...alvo, status: 'previsto' as const }];
  const resultados = checarTudo(retratos);
  const violado = resultados.find(
    (r) => r.nome === 'efetivo não volta a previsto' && r.corte === atual.rotulo && !r.ok,
  );
  expect(violado).toBeDefined();
  expect(violado!.detalhe).toContain('lanc-cenario-teste');
});

it('tela que estourou reprova e diz qual aba', async () => {
  const retratos = [retratoMinimo(dadosComCartao('roxo-teste'))];
  const resultados = checarTelas([
    { rotulo: 'corte de teste', textos: { hoje: 'button: Hoje', cartao: `${PREFIXO_EXCECAO}saldo indefinido` } },
  ], retratos);
  const violado = resultados.find((r) => !r.ok);
  expect(violado).toBeDefined();
  expect(violado!.classe).toBe('garantido');
  expect(violado!.detalhe).toContain('cartao');
  expect(violado!.detalhe).toContain('saldo indefinido');
});

it('telas sem exceção passam', async () => {
  const retratos = [retratoMinimo(dadosComCartao('roxo-teste'))];
  const resultados = checarTelas([
    { rotulo: 'corte de teste', textos: { hoje: 'button: Hoje', cartao: 'heading: Cartão' } },
  ], retratos);
  expect(resultados.every((r) => r.ok)).toBe(true);
});

it('checarTelas estoura se telas e retratos não casarem em tamanho', () => {
  const retratos = [retratoMinimo(dadosComCartao('roxo-teste'))];
  const telas: TelasDoCorte[] = [
    { rotulo: 'a', textos: {} },
    { rotulo: 'b', textos: {} },
  ];
  expect(() => checarTelas(telas, retratos)).toThrow();
});

it('categoria de fatura vazando na aba lancar reprova, e nomeia a categoria e a linha', () => {
  const dados = dadosComCartao('roxo-teste');
  const retratos = [retratoMinimo(dados)];
  const telas: TelasDoCorte[] = [
    {
      rotulo: 'corte sintético',
      textos: { lancar: 'heading: Lançar\noption: roxo-teste\noption: mercado' },
    },
  ];
  const resultados = checarTelas(telas, retratos);
  const violado = resultados.find((r) => r.nome === 'categoria de fatura fica escondida' && !r.ok);
  expect(violado).toBeDefined();
  expect(violado!.classe).toBe('garantido');
  expect(violado!.detalhe).toContain('roxo-teste');
  expect(violado!.detalhe).toContain('option: roxo-teste');
});

it('categoria de fatura aparecendo só na aba cartao não reprova', () => {
  const dados = dadosComCartao('roxo-teste');
  const retratos = [retratoMinimo(dados)];
  const telas: TelasDoCorte[] = [
    {
      rotulo: 'corte sintético',
      textos: { cartao: 'heading: roxo-teste\nfatura de agosto: R$ 100,00', lancar: 'option: mercado' },
    },
  ];
  const resultados = checarTelas(telas, retratos);
  const achado = resultados.find((r) => r.nome === 'categoria de fatura fica escondida');
  expect(achado).toBeDefined();
  expect(achado!.ok).toBe(true);
});

it('detalhe do backup nomeia a coleção e o tamanho quando um registro some na volta', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  const espiao = vi.spyOn(backupMod, 'validarBackup').mockImplementation((json) => {
    const backup = json as backupMod.Backup;
    return { ...backup, dados: { ...backup.dados, lancamentos: backup.dados.lancamentos.slice(1) } };
  });
  const resultados = checarTudo(retratos);
  espiao.mockRestore();
  const achado = resultados.find((r) => r.nome === 'backup dá a volta' && !r.ok);
  expect(achado).toBeDefined();
  expect(achado!.detalhe).toContain('lancamentos');
  expect(achado!.detalhe).toMatch(/\d+/);
});

it('detalhe do backup nomeia o registro e o campo quando um valor muda na volta', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  const idAlvo = retratos[0].dados.lancamentos[0].id;
  const espiao = vi.spyOn(backupMod, 'validarBackup').mockImplementation((json) => {
    const backup = json as backupMod.Backup;
    const lancamentos = backup.dados.lancamentos.map((l) =>
      l.id === idAlvo ? { ...l, valor: l.valor + 1 } : l);
    return { ...backup, dados: { ...backup.dados, lancamentos } };
  });
  const resultados = checarTudo(retratos);
  espiao.mockRestore();
  const achado = resultados.find(
    (r) => r.nome === 'backup dá a volta' && r.corte === retratos[0].rotulo && !r.ok,
  );
  expect(achado).toBeDefined();
  expect(achado!.detalhe).toContain(idAlvo);
  expect(achado!.detalhe).toContain('valor');
});
