import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeletorCategoria from './SeletorCategoria';

it('marca a categoria selecionada e chama onSelecionar ao clicar em outra', async () => {
  const onSelecionar = vi.fn();
  render(
    <SeletorCategoria
      categorias={[{ id: 'a', nome: 'Mercado' }, { id: 'b', nome: 'Uber' }]}
      selecionadaId="a"
      onSelecionar={onSelecionar}
    />,
  );
  expect(screen.getByRole('button', { name: 'Mercado' })).toHaveClass('selecionada');
  expect(screen.getByRole('button', { name: 'Uber' })).not.toHaveClass('selecionada');

  await userEvent.click(screen.getByRole('button', { name: 'Uber' }));
  expect(onSelecionar).toHaveBeenCalledWith('b');
});

it('mostra aviso quando não há categorias', () => {
  render(<SeletorCategoria categorias={[]} selecionadaId={null} onSelecionar={() => {}} />);
  expect(screen.getByText('Nenhuma categoria — crie em Ajustes.')).toBeInTheDocument();
});
