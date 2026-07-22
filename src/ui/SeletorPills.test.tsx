import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeletorPills from './SeletorPills';

it('marca a opção selecionada e chama onSelecionar ao clicar em outra', async () => {
  const onSelecionar = vi.fn();
  render(
    <SeletorPills
      opcoes={[{ id: 'a', nome: 'Eitor' }, { id: 'b', nome: 'Conjunta' }]}
      selecionadaId="a"
      onSelecionar={onSelecionar}
    />,
  );
  expect(screen.getByRole('button', { name: 'Eitor' })).toHaveClass('ativo');
  expect(screen.getByRole('button', { name: 'Conjunta' })).not.toHaveClass('ativo');

  await userEvent.click(screen.getByRole('button', { name: 'Conjunta' }));
  expect(onSelecionar).toHaveBeenCalledWith('b');
});
