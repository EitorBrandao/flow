import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Banco } from '../domain/types';
import SeletorBanco from './SeletorBanco';

const ts = { criadoEm: '2026-08-01T12:00:00.000Z', alteradoEm: '2026-08-01T12:00:00.000Z' };
const banco = (id: string, nome: string, ordem: number): Banco => (
  { id, boxId: 'box1', nome, ordem, saldoDeclaradoCent: null, dataSaldoDeclarado: null, ...ts }
);
const BANCOS = [banco('b1', 'Banco Um', 0), banco('b2', 'Banco Dois', 1)];

it('não aparece com menos de dois bancos', () => {
  const { container } = render(
    <SeletorBanco bancos={[BANCOS[0]]} selecionadaId="b1" onSelecionar={() => {}} />,
  );
  expect(container).toBeEmptyDOMElement();
});

it('marca o banco selecionado e avisa quando a pessoa escolhe outro', async () => {
  const onSelecionar = vi.fn();
  render(<SeletorBanco bancos={BANCOS} selecionadaId="b1" onSelecionar={onSelecionar} />);

  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('radio', { name: 'Banco Dois' })).toHaveAttribute('aria-checked', 'false');

  await userEvent.click(screen.getByRole('radio', { name: 'Banco Dois' }));

  expect(onSelecionar).toHaveBeenCalledWith('b2');
});

it('sem seleção, nenhuma pílula fica marcada', () => {
  render(<SeletorBanco bancos={BANCOS} selecionadaId={null} onSelecionar={() => {}} />);
  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('radio', { name: 'Banco Dois' })).toHaveAttribute('aria-checked', 'false');
});
