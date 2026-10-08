import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConfirmarRepetidoSheet from './ConfirmarRepetidoSheet';

function abrir(aberto = true) {
  const onCancelar = vi.fn();
  const onConfirmar = vi.fn();
  render(
    <ConfirmarRepetidoSheet
      aberto={aberto} titulo="Compra repetida?" frase={<>Já existe <strong>algo</strong>.</>}
      apoio="Texto de apoio." rotuloConfirmar="Salvar mesmo assim"
      onCancelar={onCancelar} onConfirmar={onConfirmar}
    />,
  );
  return { onCancelar, onConfirmar };
}

describe('ConfirmarRepetidoSheet', () => {
  it('fechado, não mostra nada', () => {
    abrir(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mostra título, frase, apoio e o rótulo de confirmar recebido', () => {
    abrir();
    expect(screen.getByRole('dialog', { name: 'Compra repetida?' })).toBeInTheDocument();
    expect(screen.getByText(/Já existe/)).toHaveTextContent('Já existe algo.');
    expect(screen.getByText('Texto de apoio.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar mesmo assim' })).toBeInTheDocument();
  });

  it('os botões chamam cancelar e confirmar', async () => {
    const { onCancelar, onConfirmar } = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar mesmo assim' }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });
});
