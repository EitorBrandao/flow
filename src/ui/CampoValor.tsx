import { useState } from 'react';
import { apagarUltimoDigito, digitosParaCentavos, empurrarDigito, formatarBRL } from '../domain/money';

interface CampoValorProps {
  id: string;
  valorCentavos: number;
  onChange: (centavos: number) => void;
  autoFocus?: boolean;
  style?: React.CSSProperties;
}

export default function CampoValor({ id, valorCentavos, onChange, autoFocus, style }: CampoValorProps) {
  const [tocado, setTocado] = useState(false);

  function onFocus() {
    if (!tocado) { setTocado(true); onChange(0); }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      onChange(empurrarDigito(valorCentavos, e.key));
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      onChange(apagarUltimoDigito(valorCentavos));
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    setTocado(true);
    onChange(digitosParaCentavos(e.clipboardData.getData('text')));
  }

  return (
    <input
      id={id} inputMode="numeric" autoFocus={autoFocus} style={style}
      value={formatarBRL(valorCentavos)}
      onFocus={onFocus} onKeyDown={onKeyDown} onPaste={onPaste}
      onChange={() => {}}
    />
  );
}
