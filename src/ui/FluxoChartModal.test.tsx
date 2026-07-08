import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDias } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import type { DiaSaldo } from '../domain/projection';
import FluxoChartModal from './FluxoChartModal';

// jsdom (25.x, usado pelo ambiente de teste) não implementa o construtor global `PointerEvent`.
// Sem ele, @testing-library/dom cai para o construtor genérico `Event` ao criar os eventos de
// fireEvent.pointerDown/Move/Up, que ignora silenciosamente `clientX`/`pointerId` do init dict
// (propriedades reconhecidas apenas por MouseEvent/PointerEvent). Isso faria os testes de gesto
// abaixo receberem `clientX`/`pointerId` sempre `undefined`. Polyfill mínimo baseado em
// `MouseEvent`, que o jsdom já suporta com `clientX` funcional, só para esta suíte.
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
    }
  }
  // @ts-expect-error polyfill mínimo (não implementa a interface PointerEvent inteira)
  window.PointerEvent = PointerEventPolyfill;
}

const BASE = '2026-01-01';
const N = 120;
const HOJE_IDX = 60;

function ddmm(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

// formatarBRL usa toLocaleString, que insere um espaço não separável ( ) entre "R$" e o
// valor; o normalizador padrão do testing-library colapsa esse caractere para um espaço comum
// ao ler o texto do DOM, então precisamos normalizar o texto esperado da mesma forma antes de
// comparar (mesmo ajuste já usado em src/ui/TelaHoje.test.tsx).
function semNbsp(s: string): string {
  return s.replace(/\u00A0/g, ' ');
}

function serieDeTeste(): DiaSaldo[] {
  const dias: DiaSaldo[] = [];
  for (let i = 0; i < N; i++) {
    const data = addDias(BASE, i);
    const saldo = 100000 + i * 1000; // centavos
    dias.push({ data, saldoEfetivo: saldo, saldoProjetado: saldo, saldoComCenarios: saldo - 500000 });
  }
  return dias;
}

const serie = serieDeTeste();
const hoje = serie[HOJE_IDX].data;

describe('FluxoChartModal', () => {
  it('abre com o rótulo de período cobrindo 30 dias antes e depois de hoje', () => {
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const esperado = `${ddmm(serie[HOJE_IDX - 30].data)} – ${ddmm(serie[HOJE_IDX + 30].data)}`;
    expect(screen.getByTestId('grafico-expandido-periodo')).toHaveTextContent(esperado);
  });

  it('a leitura inicial mostra o saldo e a data de hoje', () => {
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    expect(screen.getByText(semNbsp(formatarBRL(serie[HOJE_IDX].saldoEfetivo)))).toBeInTheDocument();
    expect(screen.getByTestId('grafico-expandido-leitura-data')).toHaveTextContent('· hoje');
  });

  it('o rodapé mostra mín/máx da janela visível, não da série inteira', () => {
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const min = serie[HOJE_IDX - 30].saldoProjetado;
    const max = serie[HOJE_IDX + 30].saldoProjetado;
    expect(screen.getByText(semNbsp(`mín ${formatarBRL(min)} · máx ${formatarBRL(max)}`))).toBeInTheDocument();
  });

  it('clicar no X chama onFechar', () => {
    const onFechar = vi.fn();
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={onFechar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('a tecla Escape chama onFechar', () => {
    const onFechar = vi.fn();
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={onFechar} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('clicar dentro do modal fora do botão X não chama onFechar', () => {
    const onFechar = vi.fn();
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={onFechar} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onFechar).not.toHaveBeenCalled();
  });

  it('sem cenário ligado, a legenda não aparece', () => {
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    expect(screen.queryByText('Cenário')).not.toBeInTheDocument();
  });

  it('com cenário ligado, a legenda aparece', () => {
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios onFechar={() => {}} />);
    expect(screen.getByText('Cenário')).toBeInTheDocument();
    expect(screen.getByText('Real')).toBeInTheDocument();
    expect(screen.getByText('Projetado')).toBeInTheDocument();
  });
});

describe('FluxoChartModal — gestos', () => {
  function mockRect(largura = 400) {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: largura, height: 340, left: 0, top: 0, right: largura, bottom: 340, x: 0, y: 0,
      toJSON() { return {}; },
    } as DOMRect);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clicar e arrastar (scrub) seleciona o dia mais próximo do ponteiro, ao vivo', () => {
    mockRect(400);
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const area = screen.getByTestId('grafico-expandido-area');

    fireEvent.pointerDown(area, { pointerId: 1, clientX: 0, timeStamp: 1000 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 400, timeStamp: 1050 });
    fireEvent.pointerUp(area, { pointerId: 1, clientX: 400, timeStamp: 1060 });

    expect(screen.getByTestId('grafico-expandido-leitura-data'))
      .toHaveTextContent(ddmm(serie[HOJE_IDX + 30].data));
  });

  it('clique-duplo e arraste faz pan, sem mudar o dia selecionado', () => {
    mockRect(400);
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const area = screen.getByTestId('grafico-expandido-area');

    // 1º clique: rápido, no meio do gráfico (posição de "hoje", não muda a seleção)
    fireEvent.pointerDown(area, { pointerId: 1, clientX: 200, timeStamp: 1000 });
    fireEvent.pointerUp(area, { pointerId: 1, clientX: 200, timeStamp: 1010 });
    // 2º clique logo em seguida, perto do mesmo ponto: entra em modo pan
    fireEvent.pointerDown(area, { pointerId: 1, clientX: 202, timeStamp: 1100 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 302, timeStamp: 1150 });
    fireEvent.pointerUp(area, { pointerId: 1, clientX: 302, timeStamp: 1160 });

    const esperado = `${ddmm(serie[HOJE_IDX - 45].data)} – ${ddmm(serie[HOJE_IDX + 15].data)}`;
    expect(screen.getByTestId('grafico-expandido-periodo')).toHaveTextContent(esperado);
    expect(screen.getByTestId('grafico-expandido-leitura-data')).toHaveTextContent('· hoje');
  });

  it('wheel para baixo (deltaY > 0) alarga a janela (zoom out)', () => {
    mockRect(400);
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const area = screen.getByTestId('grafico-expandido-area');
    const periodoAntes = screen.getByTestId('grafico-expandido-periodo').textContent;

    fireEvent.wheel(area, { clientX: 200, deltaY: 100 });

    expect(screen.getByTestId('grafico-expandido-periodo').textContent).not.toBe(periodoAntes);
  });

  it('zoom in repetido não passa de 14 dias visíveis', () => {
    mockRect(400);
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const area = screen.getByTestId('grafico-expandido-area');

    for (let i = 0; i < 30; i++) fireEvent.wheel(area, { clientX: 200, deltaY: -100 });

    const [de, ate] = screen.getByTestId('grafico-expandido-periodo').textContent!.split(' – ');
    const idxDe = serie.findIndex((s) => ddmm(s.data) === de);
    const idxAte = serie.findIndex((s) => ddmm(s.data) === ate);
    expect(idxAte - idxDe).toBe(13); // 14 dias = 13 de diferença de índice
  });

  it('pinça (dois ponteiros se afastando) dá o mesmo tipo de zoom que o wheel', () => {
    mockRect(400);
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const area = screen.getByTestId('grafico-expandido-area');
    const periodoAntes = screen.getByTestId('grafico-expandido-periodo').textContent;

    fireEvent.pointerDown(area, { pointerId: 1, clientX: 180 });
    fireEvent.pointerDown(area, { pointerId: 2, clientX: 220 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(area, { pointerId: 2, clientX: 300 });

    expect(screen.getByTestId('grafico-expandido-periodo').textContent).not.toBe(periodoAntes);
  });
});
