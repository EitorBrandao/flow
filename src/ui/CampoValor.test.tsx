import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import CampoValor from './CampoValor';

// Helper component that manages state for testing
function CampoValorWrapper(props: { autoFocus?: boolean }) {
  const [valor, setValor] = useState(0);
  return <CampoValor id="campo" valorCentavos={valor} onChange={setValor} autoFocus={props.autoFocus} />;
}

describe('CampoValor', () => {
  it('mostra o valor inicial formatado antes do primeiro toque', () => {
    render(<CampoValor id="campo" valorCentavos={12345} onChange={() => {}} />);
    expect(screen.getByDisplayValue(/R\$\s*123,45/)).toBeInTheDocument();
  });

  it('primeiro foco zera o buffer, chamando onChange(0)', async () => {
    const onChange = vi.fn();
    render(<CampoValor id="campo" valorCentavos={12345} onChange={onChange} />);
    const input = screen.getByRole('textbox');

    await userEvent.click(input);

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('digita "1234" e exibe "R$ 12,34" com onChange(1234)', async () => {
    render(<CampoValorWrapper autoFocus />);
    const input = screen.getByRole('textbox');

    await userEvent.type(input, '1234');

    expect(screen.getByDisplayValue(/R\$\s*12,34/)).toBeInTheDocument();
  });

  it('backspace remove o último dígito', async () => {
    render(<CampoValorWrapper autoFocus />);
    const input = screen.getByRole('textbox');

    await userEvent.type(input, '1234');
    await userEvent.type(input, '{Backspace}');

    expect(screen.getByDisplayValue(/R\$\s*1,23/)).toBeInTheDocument();
  });

  it('colar "R$ 12,34" extrai só os dígitos e chama onChange(1234)', async () => {
    render(<CampoValorWrapper autoFocus />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    await userEvent.click(input);

    await act(async () => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text', 'R$ 12,34');
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
      } as ClipboardEventInit);
      input.dispatchEvent(pasteEvent);
    });

    // The display value should show "R$ 12,34" after pasting "R$ 12,34"
    expect(screen.getByDisplayValue(/R\$\s*12,34/)).toBeInTheDocument();
  });

  it('colar substitui o buffer inteiro, não concatena', async () => {
    render(<CampoValorWrapper autoFocus />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    await userEvent.click(input);
    await userEvent.type(input, '123');

    await act(async () => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text', '500');
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
      } as ClipboardEventInit);
      input.dispatchEvent(pasteEvent);
    });

    // After pasting "500", display should be "R$ 5,00", not "R$ 1,25 + 5,00"
    expect(screen.getByDisplayValue(/R\$\s*5,00/)).toBeInTheDocument();
  });

  it('segundo foco não reseta, mantém o buffer', async () => {
    render(<CampoValorWrapper autoFocus />);
    const input = screen.getByRole('textbox');

    await userEvent.click(input);
    await userEvent.type(input, '500');

    await userEvent.tab();
    await userEvent.click(input);
    await userEvent.type(input, '6');

    // After typing "500", blurring, focusing again, and typing "6", should show "R$ 50,06"
    expect(screen.getByDisplayValue(/R\$\s*50,06/)).toBeInTheDocument();
  });

  it('inputMode é "numeric"', () => {
    render(<CampoValor id="campo" valorCentavos={0} onChange={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    expect(input.inputMode).toBe('numeric');
  });
});
