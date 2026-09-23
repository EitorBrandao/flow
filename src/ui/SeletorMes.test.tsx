import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import SeletorMes from './SeletorMes';

it('mostra o mês por nome e as setas levam ao mês anterior e ao seguinte', async () => {
  const onMudar = vi.fn();
  render(<SeletorMes mes="2026-01" onMudar={onMudar} />);

  expect(screen.getByText('janeiro de 2026')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
  expect(onMudar).toHaveBeenLastCalledWith('2025-12');
  await userEvent.click(screen.getByRole('button', { name: 'Mês seguinte' }));
  expect(onMudar).toHaveBeenLastCalledWith('2026-02');
});
