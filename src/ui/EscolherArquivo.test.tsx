import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import EscolherArquivo from './EscolherArquivo';

it('mostra o botão próprio e entrega o arquivo escolhido', async () => {
  const onEscolher = vi.fn();
  render(<EscolherArquivo id="arq" accept=".json" rotulo="Escolher arquivo" onEscolher={onEscolher} />);
  expect(screen.getByText('Escolher arquivo')).toHaveClass('botao');
  const arquivo = new File(['{}'], 'backup.json', { type: 'application/json' });
  await userEvent.upload(screen.getByLabelText('Escolher arquivo'), arquivo);
  expect(onEscolher).toHaveBeenCalledWith(arquivo);
});

it('fica azul só quando é a ação principal', () => {
  render(<EscolherArquivo id="arq" accept=".json" primario onEscolher={() => {}} />);
  expect(screen.getByText('Escolher arquivo')).toHaveClass('botao-primario');
});

it('limpa a escolha, para o mesmo arquivo poder ser escolhido de novo', async () => {
  const onEscolher = vi.fn();
  render(<EscolherArquivo id="arq" accept=".json" rotulo="Escolher arquivo" onEscolher={onEscolher} />);
  const input = screen.getByLabelText('Escolher arquivo') as HTMLInputElement;
  const arquivo = new File(['{}'], 'backup.json', { type: 'application/json' });
  await userEvent.upload(input, arquivo);
  expect(input.value).toBe('');
});
