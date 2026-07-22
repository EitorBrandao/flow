import { render, screen, within } from '@testing-library/react';
import AssinaturasResumoSheet from './AssinaturasResumoSheet';

it('agrupa os itens por cartão e mostra o total', () => {
  render(
    <AssinaturasResumoSheet
      aberto
      totalCent={5190}
      itens={[
        { cartaoId: 'k1', cartaoNome: 'Nubank', recorrenciaCartaoId: 'a1', descricao: 'Netflix', valorCent: 3990 },
        { cartaoId: 'k2', cartaoNome: 'Inter', recorrenciaCartaoId: 'a2', descricao: 'iCloud', valorCent: 1200 },
      ]}
      onFechar={() => {}}
    />,
  );
  const dialog = screen.getByRole('dialog', { name: 'Assinaturas' });
  expect(within(dialog).getByText('R$ 51,90')).toBeInTheDocument();
  expect(within(dialog).getByText('Nubank')).toBeInTheDocument();
  expect(within(dialog).getByText('Netflix')).toBeInTheDocument();
  expect(within(dialog).getByText('Inter')).toBeInTheDocument();
  expect(within(dialog).getByText('iCloud')).toBeInTheDocument();
});

it('não renderiza nada quando fechado', () => {
  render(<AssinaturasResumoSheet aberto={false} totalCent={0} itens={[]} onFechar={() => {}} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
