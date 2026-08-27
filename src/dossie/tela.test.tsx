import 'fake-indexeddb/auto';
import { render } from '@testing-library/react';
import { PREFIXO_EXCECAO, renderComCaptura, resumirNo } from './tela';

it('ignora classe, estilo e id', () => {
  const { container: a } = render(
    <div><h2 className="titulo">Saldo</h2><span className="valor">R$ 10,00</span></div>,
  );
  const antes = resumirNo(a);
  const { container: b } = render(
    <div id="x"><h2 className="titulo-novo destaque">Saldo</h2><span style={{ color: 'red' }}>R$ 10,00</span></div>,
  );
  expect(resumirNo(b)).toBe(antes);
});

it('enxerga mudança de rótulo', () => {
  const { container: a } = render(<div><h2>Saldo</h2></div>);
  const { container: b } = render(<div><h2>Saldo total</h2></div>);
  expect(resumirNo(b)).not.toBe(resumirNo(a));
});

it('enxerga mudança de valor', () => {
  const { container: a } = render(<div><span>R$ 10,00</span></div>);
  const { container: b } = render(<div><span>R$ 11,00</span></div>);
  expect(resumirNo(b)).not.toBe(resumirNo(a));
});

it('enxerga mudança de ordem numa lista', () => {
  const { container: a } = render(<ul><li>mercado</li><li>transporte</li></ul>);
  const { container: b } = render(<ul><li>transporte</li><li>mercado</li></ul>);
  expect(resumirNo(b)).not.toBe(resumirNo(a));
});

it('marca o papel quando existe', () => {
  const { container } = render(<div><button>Salvar</button><h2>Hoje</h2></div>);
  expect(resumirNo(container)).toContain('button: Salvar');
  expect(resumirNo(container)).toContain('heading: Hoje');
});

it('normaliza espaço em branco', () => {
  const { container: a } = render(<div><p>{'  Saldo   do   dia  '}</p></div>);
  const { container: b } = render(<div><p>Saldo do dia</p></div>);
  expect(resumirNo(b)).toBe(resumirNo(a));
});

it('não emite linha para elemento sem texto', () => {
  const { container } = render(<div><svg /><p>Texto</p></div>);
  expect(resumirNo(container).split('\n')).toEqual(['Texto']);
});

it('rótulo ao lado de um filho-elemento move a saída', () => {
  const { container: a } = render(<p>Saldo: <b>R$ 10,00</b></p>);
  const { container: b } = render(<p>Total: <b>R$ 10,00</b></p>);
  expect(resumirNo(a)).not.toBe(resumirNo(b));
});

it('texto solto e texto do filho aparecem os dois', () => {
  const { container } = render(<p>Saldo: <b>R$ 10,00</b></p>);
  const texto = resumirNo(container);
  expect(texto).toContain('Saldo:');
  expect(texto).toContain('R$ 10,00');
});

it('erro em callback assíncrono vira PREFIXO_EXCECAO', async () => {
  // `renderComCaptura` é o miolo de `textoDaTela`, extraído para aceitar qualquer
  // elemento, sem depender do Shell nem do store — é o que permite isolar este teste.
  //
  // O gatilho real seria um `throw` dentro de um `setTimeout`, depois do primeiro quadro —
  // o caso que um error boundary sozinho não pega. Não dá para simular esse `throw` aqui:
  // o Vitest roda o jsdom fora de uma VM, então `window` desta suíte É o `global` do Node
  // (confirmado por `window === globalThis`), e `window.setTimeout` é o `setTimeout` nativo
  // do Node — não a versão do jsdom que embrulha a chamada em try/catch e despacha 'error'.
  // Um `throw` num `setTimeout` aqui vira exceção não tratada do Node, não evento de
  // `window`, e nunca chegaria ao ouvinte. Isso é uma lacuna deste ambiente de teste, não
  // do app: no navegador de verdade, `window` é o único objeto global, e um estouro
  // assíncrono dispara 'error' nele de verdade.
  //
  // Por isso o teste dispara o evento à mão, de dentro de um `setTimeout` — o mesmo atraso
  // "depois do primeiro quadro" do cenário real — o que prova exatamente o que este teste
  // precisa provar: um evento de erro que chega depois do render inicial não se perde.
  function Ok() { return <div>ok</div>; }
  setTimeout(() => {
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('estouro assíncrono') }));
  }, 10);
  const texto = await renderComCaptura(<Ok />);
  expect(texto).toContain(PREFIXO_EXCECAO);
});

import { limparDb } from '../test-setup';
import { executarRoteiro } from './executar';
import { ROTEIRO } from './roteiro';
import { ABAS_DO_DOSSIE, coletarTelas, textoDaTela } from './tela';

it('cada aba do dossiê rende texto não vazio no primeiro corte', async () => {
  await limparDb();
  const retratos = await executarRoteiro(ROTEIRO);
  for (const aba of ABAS_DO_DOSSIE) {
    const texto = await textoDaTela(retratos[0], aba);
    expect(texto, `aba ${aba} veio vazia`).not.toBe('');
    expect(texto, `aba ${aba} estourou`).not.toContain(PREFIXO_EXCECAO);
  }
});

it('duas leituras da mesma tela dão o mesmo texto', async () => {
  await limparDb();
  const retratos = await executarRoteiro(ROTEIRO);
  const primeira = await textoDaTela(retratos[2], 'cartao');
  const segunda = await textoDaTela(retratos[2], 'cartao');
  expect(segunda).toBe(primeira);
});

it('coleta uma entrada por corte, com todas as abas', async () => {
  await limparDb();
  const retratos = await executarRoteiro(ROTEIRO);
  const telas = await coletarTelas(retratos);
  expect(telas).toHaveLength(ROTEIRO.cortes.length);
  expect(Object.keys(telas[0].textos).sort()).toEqual([...ABAS_DO_DOSSIE].sort());
  expect(telas[0].rotulo).toBe(retratos[0].rotulo);
});
