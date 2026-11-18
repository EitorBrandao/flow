import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import ConfirmarSheet from './ConfirmarSheet';

function montar(props: Partial<Parameters<typeof ConfirmarSheet>[0]> = {}) {
  const onCancelar = vi.fn();
  const onConfirmar = vi.fn();
  render(
    <ConfirmarSheet
      aberto titulo="Excluir esta viagem?" rotuloConfirmar="Excluir"
      onCancelar={onCancelar} onConfirmar={onConfirmar} {...props}
    />,
  );
  return { onCancelar, onConfirmar };
}

it('fechado não mostra nada', () => {
  montar({ aberto: false });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('mostra título, resumo e apoio, e o diálogo leva o título como nome', () => {
  montar({ resumo: <span>praia</span>, apoio: 'Os lançamentos continuam existindo.' });
  const dialogo = screen.getByRole('dialog', { name: 'Excluir esta viagem?' });
  expect(within(dialogo).getByText('praia')).toBeInTheDocument();
  expect(within(dialogo).getByText('Os lançamentos continuam existindo.')).toBeInTheDocument();
});

it('sem resumo e sem apoio mostra só o título e os dois botões', () => {
  montar();
  const dialogo = screen.getByRole('dialog', { name: 'Excluir esta viagem?' });
  expect(within(dialogo).getByRole('heading', { name: 'Excluir esta viagem?' })).toBeInTheDocument();
  expect(within(dialogo).getAllByRole('button')).toHaveLength(2);
  expect(dialogo.querySelector('.item-elevado')).toBeNull();
  expect(dialogo.querySelector('p.sub')).toBeNull();
});

it('Cancelar chama só onCancelar', async () => {
  const { onCancelar, onConfirmar } = montar();
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onCancelar).toHaveBeenCalledOnce();
  expect(onConfirmar).not.toHaveBeenCalled();
});

it('o botão de confirmar chama só onConfirmar', async () => {
  const { onCancelar, onConfirmar } = montar();
  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
  expect(onConfirmar).toHaveBeenCalledOnce();
  expect(onCancelar).not.toHaveBeenCalled();
});

it('perigo usa o vermelho cheio; sem perigo, o azul', () => {
  montar({ perigo: true });
  expect(screen.getByRole('button', { name: 'Excluir' })).toHaveClass('botao-perigo-cheio');
});

it('sem perigo o botão é o primário', () => {
  montar({ rotuloConfirmar: 'Tornar real' });
  const botao = screen.getByRole('button', { name: 'Tornar real' });
  expect(botao).toHaveClass('botao-primario');
  expect(botao).not.toHaveClass('botao-perigo-cheio');
});

it('Cancelar é o botão com contorno', () => {
  montar();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveClass('botao-discreto');
});

it('dois cliques seguidos em confirmar chamam onConfirmar uma vez só', async () => {
  const { onConfirmar } = montar();
  const confirmar = screen.getByRole('button', { name: 'Excluir' });
  await userEvent.click(confirmar);
  await userEvent.click(confirmar);
  expect(onConfirmar).toHaveBeenCalledOnce();
});

it('fechando e reabrindo o sheet, um novo clique em confirmar volta a chamar', async () => {
  const onConfirmar = vi.fn();
  const props = {
    titulo: 'Excluir esta viagem?', rotuloConfirmar: 'Excluir',
    onCancelar: vi.fn(), onConfirmar,
  };
  const { rerender } = render(<ConfirmarSheet aberto {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
  expect(onConfirmar).toHaveBeenCalledOnce();

  rerender(<ConfirmarSheet aberto={false} {...props} />);
  rerender(<ConfirmarSheet aberto {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
  expect(onConfirmar).toHaveBeenCalledTimes(2);
});
