import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { formatarBRL } from '../domain/money';
import AvisoFaturaForaDoFluxo from './AvisoFaturaForaDoFluxo';

const semNbsp = (s: string) => s.replace(/\s/g, ' ');

it('fatura vencida sem lançamento: explica, sem ação', () => {
  render(<AvisoFaturaForaDoFluxo situacao={{ tipo: 'vencida-sem-lancamento' }} onCorrigir={() => {}} />);
  expect(screen.getByText(/Essa fatura ficou de fora do Fluxo/)).toHaveClass('aviso');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('fatura paga a menor: mostra a diferença e o link corrige com o valor sugerido', async () => {
  const onCorrigir = vi.fn();
  const { container } = render(
    <AvisoFaturaForaDoFluxo
      situacao={{ tipo: 'paga-a-menor', diferencaCent: 15000, valorSugeridoCent: 109076 }}
      onCorrigir={onCorrigir}
    />,
  );
  expect(semNbsp(container.textContent!)).toContain(`Tem ${semNbsp(formatarBRL(15000))} nessa fatura que não chegaram no Fluxo`);
  await userEvent.click(screen.getByRole('button', { name: 'Corrigir o valor pago' }));
  expect(onCorrigir).toHaveBeenCalledWith(109076);
});
