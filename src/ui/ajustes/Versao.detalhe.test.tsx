import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import Versao from './Versao';

vi.mock('../../../CHANGELOG.md?raw', () => ({
  default: `# Changelog

## [0.6.0] - 2026-07-22

### Adicionado

- Tópico com detalhe.
  - Primeiro detalhe do tópico.
  - Segundo detalhe do tópico.
- Tópico sem detalhe.
`,
}));

it('renderiza os detalhes de um tópico numa lista subordinada', () => {
  render(<Versao />);
  expect(screen.getByText('Tópico com detalhe.')).toBeInTheDocument();
  expect(screen.getByText('Primeiro detalhe do tópico.')).toBeInTheDocument();
  expect(screen.getByText('Segundo detalhe do tópico.')).toBeInTheDocument();
});

it('não renderiza lista de detalhes quando o tópico não tem nenhum', () => {
  render(<Versao />);
  const topico = screen.getByText('Tópico sem detalhe.');
  expect(topico.closest('li')?.querySelector('ul')).toBeNull();
});
