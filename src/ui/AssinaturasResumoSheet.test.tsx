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

it('cada grupo mostra o subtotal do cartão, no padrão da lista de lançamentos', () => {
  render(
    <AssinaturasResumoSheet
      aberto
      totalCent={6390}
      itens={[
        { cartaoId: 'k1', cartaoNome: 'Nubank', recorrenciaCartaoId: 'a1', descricao: 'Netflix', valorCent: 3990 },
        { cartaoId: 'k1', cartaoNome: 'Nubank', recorrenciaCartaoId: 'a2', descricao: 'Spotify', valorCent: 1200 },
        { cartaoId: 'k2', cartaoNome: 'Inter', recorrenciaCartaoId: 'a3', descricao: 'iCloud', valorCent: 1200 },
      ]}
      onFechar={() => {}}
    />,
  );
  const dialog = screen.getByRole('dialog', { name: 'Assinaturas' });
  const cabecalhoNubank = within(dialog).getByText('Nubank').parentElement as HTMLElement;
  expect(cabecalhoNubank).toHaveClass('recuo-1');
  expect(within(cabecalhoNubank).getByText('R$ 51,90')).toBeInTheDocument();
  expect(within(dialog).getByText('Netflix').closest('.item')).toHaveClass('recuo-2');
});
