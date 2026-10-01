import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as repo from '../db/repo';
import type { ModoUso, TelaModo } from '../domain/types';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaAnalises from './TelaAnalises';
import TelaCartao from './TelaCartao';
import TelaFluxo from './TelaFluxo';
import TelaHoje from './TelaHoje';
import TelaLancar from './TelaLancar';

/**
 * Teste transversal: o mesmo conceito aparece do mesmo jeito no modo Simples e no Avançado
 * (spec "Consistência entre telas"). Cada tela tem modo próprio; aqui os dois modos rodam sobre
 * os mesmos dados sintéticos.
 */

const HOJE = '2026-07-03';
const HORIZONTE = '2027-12-31';
const TELAS: TelaModo[] = ['hoje', 'fluxo', 'cartao', 'analises', 'lancar'];

beforeEach(async () => {
  await limparDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${HOJE}T12:00:00`));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/**
 * Dados (hoje = 03/07/2026; centavos):
 *  - box com saldo inicial de 1.000,00 em 01/01/2026;
 *  - salário +3.000,00 efetivo (01/07); mercado −200,00 efetivo (02/07); aluguel −800,00 previsto (25/07);
 *  - cartão fecha dia 5, vence dia 12, com uma compra de 150,00 em 20/06: cai na fatura de julho
 *    (fecha 05/07, vence 12/07/2026), previsto de 150,00 no dia 12;
 *  - conferência da fatura de julho: 180,00 no app do banco, sem usar o valor no Flow.
 *
 * Saldo efetivo hoje = 1.000 + 3.000 − 200 = 3.800,00 (o aluguel e a fatura são previstos).
 * Julho em Análises (com previstos): ganhos 3.000,00; gastos 200 + 800 + 150 = 1.150,00; sobra 1.850,00.
 */
async function montar() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarConfig({ boxPadraoId: box.id });
  const salario = await repo.salvarCategoria({ boxId: box.id, nome: 'salário', tipo: 'ganho', ordem: 0 });
  const mercado = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const aluguel = await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 1 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: salario.id, data: '2026-07-01', valor: 300000, status: 'efetivo' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: mercado.id, data: '2026-07-02', valor: 20000, status: 'efetivo' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: aluguel.id, data: '2026-07-25', valor: 80000, status: 'previsto' });
  const cartao = await repo.salvarCartao({ boxId: box.id, nome: 'Cartão Sigma', diaFechamento: 5, diaVencimento: 12 }, HORIZONTE);
  const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-06-20', valorTotal: 15000, parcelas: 1,
  }, HORIZONTE);
  await repo.salvarConferenciaFatura(cartao.id, '2026-07', 18000, false, HORIZONTE);
  return { box, cartao };
}

/** Põe todas as telas no mesmo modo e recarrega o store (que reinicia `hoje` — fixa de novo). */
async function usarModo(modo: ModoUso, boxId: string) {
  for (const t of TELAS) await repo.salvarModo(t, modo);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: boxId, hoje: HOJE });
}

const MODOS: ModoUso[] = ['simples', 'avancado'];

const textoSaldoGrande = (c: HTMLElement) => c.querySelector('.saldo-grande')?.textContent ?? null;

it('Hoje mostra o mesmo saldo grande nos dois modos (R$ 3.800,00)', async () => {
  const { box } = await montar();
  const saldos: Array<string | null> = [];
  for (const modo of MODOS) {
    await usarModo(modo, box.id);
    const { container, unmount } = render(<TelaHoje />);
    saldos.push(textoSaldoGrande(container));
    unmount();
  }
  expect(saldos[0]).toMatch(/^R\$\s*3\.800,00$/);
  expect(saldos[1]).toBe(saldos[0]);
});

it('Análises mostra os mesmos ganhos, gastos e sobra do mês nos dois modos', async () => {
  const { box } = await montar();
  const resumos: string[] = [];
  for (const modo of MODOS) {
    await usarModo(modo, box.id);
    const { container, unmount } = render(<TelaAnalises />);
    const card = container.querySelector('.card') as HTMLElement;
    resumos.push((card.querySelector('.linha') as HTMLElement).textContent ?? '');
    unmount();
  }
  expect(resumos[0]).toMatch(/Ganhos\s*R\$\s*3\.000,00/);
  expect(resumos[0]).toMatch(/Gastos\s*R\$\s*1\.150,00/);
  expect(resumos[0]).toMatch(/Sobra\s*R\$\s*1\.850,00/);
  expect(resumos[1]).toBe(resumos[0]);
});

it('Fluxo lista os mesmos lançamentos, com o mesmo valor e a mesma cor, nos dois modos', async () => {
  const { box } = await montar();
  const linhas: string[][] = [];
  for (const modo of MODOS) {
    await usarModo(modo, box.id);
    const { container, unmount } = render(<TelaFluxo />);
    linhas.push(
      Array.from(container.querySelectorAll('button.item')).map((b) => {
        const valor = b.querySelector(':scope > span') as HTMLElement;
        return `${b.querySelector('.cresce')?.textContent}|${valor.textContent}|${valor.className}`;
      }),
    );
    unmount();
  }
  // salário, mercado, fatura (previsto de 12/07) e aluguel (previsto de 25/07) — nada some no Simples
  expect(linhas[0]).toHaveLength(4);
  expect(linhas[0].some((l) => /^salário\|R\$\s*3\.000,00\|valor-ganho/.test(l))).toBe(true);
  expect(linhas[0].some((l) => /^mercado\|R\$\s*200,00\|valor-gasto/.test(l))).toBe(true);
  expect(linhas[0].some((l) => /^aluguel.*previsto\|R\$\s*800,00\|valor-gasto/.test(l))).toBe(true);
  expect(linhas[1]).toEqual(linhas[0]);
});

describe('lançamento criado no Lançar simples', () => {
  async function lancarNoSimples(boxId: string) {
    await usarModo('simples', boxId);
    const { unmount } = render(<TelaLancar />);
    await userEvent.type(screen.getByLabelText('Valor'), '4500');
    await userEvent.type(screen.getByLabelText('Do que foi? (opcional)'), 'padaria');
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText('Lançado ✓')).toBeInTheDocument();
    unmount();
  }

  it('aparece no Fluxo (Simples e Avançado) com o mesmo valor e a cor de gasto', async () => {
    const { box } = await montar();
    await lancarNoSimples(box.id);
    for (const modo of MODOS) {
      await usarModo(modo, box.id);
      const { unmount } = render(<TelaFluxo />);
      const item = screen.getByText('padaria').closest('button.item') as HTMLElement;
      const valor = within(item).getByText(/R\$\s*45,00/);
      expect(valor).toHaveClass('valor-gasto');
      unmount();
    }
  });

  it('entra em Análises com o mesmo valor e a cor de gasto nos dois modos, e soma ao total do mês', async () => {
    const { box } = await montar();
    await lancarNoSimples(box.id);
    for (const modo of MODOS) {
      await usarModo(modo, box.id);
      const { container, unmount } = render(<TelaAnalises />);
      const nome = within(container.querySelector('.composicao-lista') as HTMLElement).getByText('A classificar');
      const linha = nome.closest('.composicao-linha') as HTMLElement;
      expect(within(linha).getByText(/R\$\s*45,00/)).toHaveClass('valor-gasto');
      // 1.150,00 + 45,00 = 1.195,00 de gastos; sobra 3.000,00 − 1.195,00 = 1.805,00
      const resumo = (container.querySelector('.card .linha') as HTMLElement).textContent ?? '';
      expect(resumo).toMatch(/Gastos\s*R\$\s*1\.195,00/);
      expect(resumo).toMatch(/Sobra\s*R\$\s*1\.805,00/);
      unmount();
    }
  });

  it('muda o saldo grande de Hoje igual nos dois modos (3.800,00 − 45,00 = R$ 3.755,00)', async () => {
    const { box } = await montar();
    await lancarNoSimples(box.id);
    const saldos: Array<string | null> = [];
    for (const modo of MODOS) {
      await usarModo(modo, box.id);
      const { container, unmount } = render(<TelaHoje />);
      saldos.push(textoSaldoGrande(container));
      unmount();
    }
    expect(saldos[0]).toMatch(/^R\$\s*3\.755,00$/);
    expect(saldos[1]).toBe(saldos[0]);
  });
});

describe('diferença da conferência: mesmas frases, cores e sinal', () => {
  async function diferencaDeHoje(modo: ModoUso, boxId: string, declarado: string, frase: RegExp) {
    await usarModo(modo, boxId);
    const { unmount } = render(<TelaHoje />);
    await userEvent.click(screen.getByRole('tab', { name: 'Conferir' }));
    const campo = screen.getByLabelText('Saldo real no banco');
    await userEvent.clear(campo);
    await userEvent.type(campo, declarado);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const p = (await screen.findByText(frase)).closest('p') as HTMLElement;
    const resultado = { texto: p.textContent ?? '', classe: p.querySelector('strong')?.className ?? '' };
    unmount();
    return resultado;
  }

  it('Hoje diz as mesmas frases nos dois modos, para falta e para sobra', async () => {
    const { box } = await montar();
    // banco 3.900,00 contra 3.800,00 no app: faltam 100,00 no app (vermelho)
    const falta = await diferencaDeHoje('simples', box.id, '390000', /falta inserir no app/);
    const faltaAv = await diferencaDeHoje('avancado', box.id, '390000', /falta inserir no app/);
    expect(falta.texto).toMatch(/^Diferença: R\$\s*100,00 — falta inserir no app · conferido em 03\/07\/2026$/);
    expect(falta.classe).toBe('valor-gasto');
    expect(faltaAv).toEqual(falta);
    // banco 3.700,00: sobram 100,00 no app (verde)
    const sobra = await diferencaDeHoje('simples', box.id, '370000', /sobra no app/);
    const sobraAv = await diferencaDeHoje('avancado', box.id, '370000', /sobra no app/);
    expect(sobra.texto).toMatch(/^Diferença: R\$\s*100,00 — sobra no app \(confira duplicado/);
    expect(sobra.classe).toBe('valor-ganho');
    expect(sobraAv).toEqual(sobra);
  });

  it('Hoje com banco igual ao app diz "Bate certinho." nos dois modos', async () => {
    const { box } = await montar();
    const simples = await diferencaDeHoje('simples', box.id, '380000', /Bate certinho/);
    const avancado = await diferencaDeHoje('avancado', box.id, '380000', /Bate certinho/);
    expect(simples.texto).toMatch(/^Bate certinho\./);
    expect(avancado).toEqual(simples);
  });

  async function diferencaDoCartao(valorBanco: string, frase: RegExp) {
    render(<TelaCartao />);
    await userEvent.click(screen.getByRole('tab', { name: /Conferência/ }));
    const campo = screen.getByLabelText('Valor no app do banco');
    await userEvent.clear(campo);
    await userEvent.type(campo, valorBanco);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência' }));
    return (await screen.findByText(frase)).closest('p') as HTMLElement;
  }

  it('Cartão › Conferência usa a mesma estrutura, a mesma cor e o mesmo sinal de Hoje', async () => {
    const { box } = await montar();
    await usarModo('avancado', box.id);
    useApp.setState({ hoje: HOJE });
    // fatura de julho: 150,00 nos itens. Banco 180,00: faltam 30,00 no Flow (vermelho)
    let p = await diferencaDoCartao('18000', /falta inserir no cartão/);
    expect(p.textContent).toMatch(/^Diferença: R\$\s*30,00 — falta inserir no cartão$/);
    expect(p.querySelector('strong')).toHaveClass('valor-gasto');
    cleanup();
    // Hoje, no mesmo cenário (falta lançar): mesma cor, mesmo valor sem sinal, mesma estrutura
    const hojeFalta = await diferencaDeHoje('avancado', box.id, '383000', /falta inserir no app/);
    expect(hojeFalta.classe).toBe('valor-gasto');
    expect(hojeFalta.texto).toMatch(/^Diferença: R\$\s*30,00 — falta inserir no app/);
    // Banco 120,00: sobram 30,00 no Flow (verde)
    await usarModo('avancado', box.id);
    p = await diferencaDoCartao('12000', /sobra no cartão/);
    expect(p.textContent).toMatch(/^Diferença: R\$\s*30,00 — sobra no cartão \(confira duplicado/);
    expect(p.querySelector('strong')).toHaveClass('valor-ganho');
    cleanup();
    const hojeSobra = await diferencaDeHoje('avancado', box.id, '377000', /sobra no app/);
    expect(hojeSobra.classe).toBe('valor-ganho');
    expect(hojeSobra.texto).toMatch(/^Diferença: R\$\s*30,00 — sobra no app \(confira duplicado/);
    // banco igual aos itens
    await usarModo('avancado', box.id);
    p = await diferencaDoCartao('15000', /Bate certinho/);
    expect(p.textContent).toBe('Bate certinho.');
  });
});

it('Cartão simples e avançado mostram o mesmo valor de fatura do mês (150,00 das compras)', async () => {
  const { box } = await montar();
  // Simples: o campo vem com o que a fatura leva ao Flow (a conferência de 180,00 não usa o valor do app)
  await usarModo('simples', box.id);
  render(<TelaCartao />);
  const campo = screen.getByLabelText('Valor da fatura') as HTMLInputElement;
  expect(campo.value).toMatch(/150,00/);
  expect(screen.getByText('Vencimento: 12/07/2026')).toBeInTheDocument();
  cleanup();
  // Avançado: o resumo da mesma fatura soma o mesmo valor
  await usarModo('avancado', box.id);
  const { container } = render(<TelaCartao />);
  await waitFor(() => expect(container.textContent).toMatch(/R\$\s*150,00/));
  expect(container.textContent).not.toMatch(/R\$\s*180,00 /);
});
