import { render, screen } from '@testing-library/react';
import type { Box } from '../domain/types';
import SeloBox from './SeloBox';

const agora = '2026-07-01T12:00:00.000Z';
const ana: Box = { id: 'b-ana', nome: 'ana', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };

it('mostra o nome da box como selo', () => {
  render(<SeloBox boxId="b-ana" boxes={[ana]} />);
  const selo = screen.getByText('ana');
  expect(selo).toHaveClass('badge');
});

it('mostra "?" quando a box não existe', () => {
  render(<SeloBox boxId="inexistente" boxes={[ana]} />);
  expect(screen.getByText('?')).toHaveClass('badge');
});
