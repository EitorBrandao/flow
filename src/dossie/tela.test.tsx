import 'fake-indexeddb/auto';
import { render } from '@testing-library/react';
import { resumirNo } from './tela';

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
  expect(telas).toHaveLength(6);
  expect(Object.keys(telas[0].textos).sort()).toEqual([...ABAS_DO_DOSSIE].sort());
  expect(telas[0].rotulo).toBe(retratos[0].rotulo);
});
