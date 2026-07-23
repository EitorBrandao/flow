import { render, screen } from '@testing-library/react';
import Versao from './Versao';

it('mostra a versão atual e o histórico de versões anteriores', () => {
  render(<Versao />);
  expect(screen.getByText(/Você está na versão 0\.10\.0/)).toBeInTheDocument();
  expect(screen.getByText('0.1.0')).toBeInTheDocument();
});
