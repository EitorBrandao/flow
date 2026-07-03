import { render, screen } from '@testing-library/react';
import App from './App';

it('renderiza o app', () => {
  render(<App />);
  expect(screen.getByText('Flow')).toBeInTheDocument();
});
