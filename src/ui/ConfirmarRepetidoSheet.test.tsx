import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Lancamento } from '../domain/types';
import ConfirmarRepetidoSheet from './ConfirmarRepetidoSheet';

const existente = (extra: Partial<Lancamento> = {}): Lancamento => ({
  id: 'l1', boxId: 'b1', categoriaId: 'c1', data: '2026-10-08', valor: 4500,
  status: 'efetivo', origem: 'manual', criadoEm: 't', alteradoEm: 't', ...extra,
});

function abrir(repetido: Lancamento | null, extra: { tipo?: 'gasto' | 'ganho' } = {}) {
  const onCancelar = vi.fn();
  const onConfirmar = vi.fn();
  render(
    <ConfirmarRepetidoSheet
      repetido={repetido} tipo={extra.tipo ?? 'gasto'} nomeBox="Pessoal"
      onCancelar={onCancelar} onConfirmar={onConfirmar}
    />,
  );
  return { onCancelar, onConfirmar };
}

describe('ConfirmarRepetidoSheet', () => {
  it('sem lançamento repetido, não mostra nada', () => {
    abrir(null);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('descreve o lançamento existente, com a nota', () => {
    abrir(existente({ nota: 'Almoço' }));
    const dialog = screen.getByRole('dialog', { name: 'Lançamento repetido?' });
    expect(within(dialog).getByText(/Já existe um gasto de/)).toHaveTextContent(
      'Já existe um gasto de R$ 45,00 em 08/10/2026 na box Pessoal: “Almoço”.',
    );
  });

  it('sem nota, termina a frase na box; ganho diz "um ganho"', () => {
    abrir(existente(), { tipo: 'ganho' });
    expect(screen.getByText(/Já existe um ganho de/)).toHaveTextContent(
      'Já existe um ganho de R$ 45,00 em 08/10/2026 na box Pessoal.',
    );
  });

  it('os botões chamam cancelar e confirmar', async () => {
    const { onCancelar, onConfirmar } = abrir(existente());
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Lançar mesmo assim' }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });
});
