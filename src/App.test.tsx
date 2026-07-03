import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import App from './App';

it('boota e mostra o shell', async () => {
  render(<App />);
  expect(await screen.findByText('Flow')).toBeInTheDocument();
  // 'Hoje' aparece na aba e no h2 do stub — mire no botão da navegação
  expect(screen.getByRole('button', { name: 'Hoje' })).toBeInTheDocument();
});
