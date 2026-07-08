import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { addDias } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import type { DiaSaldo } from '../domain/projection';
import FluxoChartModal from './FluxoChartModal';

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
