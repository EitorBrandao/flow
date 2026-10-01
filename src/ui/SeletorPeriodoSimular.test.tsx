import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PeriodoSimulacao } from '../domain/simulacao';
import SeletorPeriodoSimular from './SeletorPeriodoSimular';

const periodo: PeriodoSimulacao = { de: '2026-09', ate: '2027-09' };
const mesHoje = '2026-09';
const horizonte = '2027-12-31';
let mudancas: PeriodoSimulacao[] = [];
const onMudar = (p: PeriodoSimulacao) => { mudancas.push(p); };

beforeEach(() => { mudancas = []; });

it('seta › em "Mês final" avança um mês e chama onMudar', async () => {
  const user = userEvent.setup();
  render(<SeletorPeriodoSimular periodo={periodo} mesHoje={mesHoje} horizonte={horizonte} onMudar={onMudar} />);
  const seta = screen.getByLabelText('Mês final seguinte');
  await user.click(seta);
  expect(mudancas).toHaveLength(1);
  expect(mudancas[0].ate).toBe('2027-10');
  expect(mudancas[0].de).toBe('2026-09');
});

it('select "Ano inicial" não oferece anos antes do ano de hoje', async () => {
  render(<SeletorPeriodoSimular periodo={periodo} mesHoje={mesHoje} horizonte={horizonte} onMudar={onMudar} />);
  const selectAnoInicial = screen.getByLabelText('Ano inicial');
  const options = Array.from(selectAnoInicial.querySelectorAll('option')).map((o) => o.textContent);
  expect(options).not.toContain('2025');
  expect(options).toContain('2026');
});

it('contador "13 meses · máximo de 60" para período de set/2026 a set/2027', async () => {
  render(<SeletorPeriodoSimular periodo={periodo} mesHoje={mesHoje} horizonte={horizonte} onMudar={onMudar} />);
  expect(screen.getByText('13 meses · máximo de 60')).toBeInTheDocument();
});

it('"1 mês" no singular', async () => {
  const p: PeriodoSimulacao = { de: '2026-09', ate: '2026-09' };
  render(<SeletorPeriodoSimular periodo={p} mesHoje={mesHoje} horizonte={horizonte} onMudar={onMudar} />);
  expect(screen.getByText('1 mês · máximo de 60')).toBeInTheDocument();
});

it('com ate depois do horizonte aparece o aviso das faturas', async () => {
  const p: PeriodoSimulacao = { de: '2026-09', ate: '2028-01' };
  render(<SeletorPeriodoSimular periodo={p} mesHoje={mesHoje} horizonte={horizonte} onMudar={onMudar} />);
  expect(screen.getByText(/Depois de dez\/2027, a tabela não inclui faturas de cartão/)).toBeInTheDocument();
});

it('sem passar do horizonte, não aparece o aviso das faturas', async () => {
  render(<SeletorPeriodoSimular periodo={periodo} mesHoje={mesHoje} horizonte={horizonte} onMudar={onMudar} />);
  expect(screen.queryByText(/Depois de dez\/2027, a tabela não inclui faturas de cartão/)).not.toBeInTheDocument();
});
