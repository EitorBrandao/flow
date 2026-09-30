import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Banco } from '../domain/types';
import SeletorFiltroBanco from './SeletorFiltroBanco';

const ts = { criadoEm: '2026-08-01T12:00:00.000Z', alteradoEm: '2026-08-01T12:00:00.000Z' };
const banco = (id: string, nome: string, ordem: number): Banco => (
  { id, boxId: 'box1', nome, ordem, saldoDeclaradoCent: null, dataSaldoDeclarado: null, ...ts }
);
const BANCOS = [banco('b1', 'Banco Um', 0), banco('b2', 'Banco Dois', 1)];

it('não aparece com menos de dois bancos', () => {
  const { container } = render(
    <SeletorFiltroBanco bancos={[BANCOS[0]]} valor="todos" onMudar={() => {}} />,
  );
  expect(container).toBeEmptyDOMElement();
});

it('oferece Todos, cada banco e Sem banco, e marca o valor atual', () => {
  render(<SeletorFiltroBanco bancos={BANCOS} valor="b2" onMudar={() => {}} />);

  expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(
    ['Todos', 'Banco Um', 'Banco Dois', 'Sem banco'],
  );
  expect(screen.getByRole('radio', { name: 'Banco Dois' })).toHaveAttribute('aria-checked', 'true');
});

it('avisa o filtro escolhido: "todos", "sem-banco" ou o ID do banco', async () => {
  const onMudar = vi.fn();
  render(<SeletorFiltroBanco bancos={BANCOS} valor="todos" onMudar={onMudar} />);

  await userEvent.click(screen.getByRole('radio', { name: 'Banco Um' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Sem banco' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Todos' }));

  expect(onMudar.mock.calls.map((c) => c[0])).toEqual(['b1', 'sem-banco', 'todos']);
});
