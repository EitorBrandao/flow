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
  expect(screen.getByRole('radio', { name: 'Eitor' })).toHaveClass('ativo');
  expect(screen.getByRole('radio', { name: 'Conjunta' })).not.toHaveClass('ativo');
  // leitor de tela ouve qual está marcada, não só vê a cor
  expect(screen.getByRole('radio', { name: 'Eitor' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Conjunta' })).not.toBeChecked();

  await userEvent.click(screen.getByRole('radio', { name: 'Conjunta' }));
  expect(onSelecionar).toHaveBeenCalledWith('b');
});
