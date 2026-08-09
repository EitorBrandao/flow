import { useState } from 'react';
import { apagarUltimoDigito, digitosParaCentavos, empurrarDigito, formatarBRL } from '../domain/money';

interface CampoValorProps {
  id: string;
  valorCentavos: number;
  onChange: (centavos: number) => void;
  autoFocus?: boolean;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

export default function CampoValor({ id, valorCentavos, onChange, autoFocus, style, ariaLabel }: CampoValorProps) {
  /**
   * `pristino` = o campo acabou de receber foco e o conteúdo está inteiro selecionado.
   * O primeiro dígito digitado **substitui** o valor; do segundo em diante, empurra.
   *
   * Antes, o foco zerava o buffer chamando `onChange(0)` na hora. Isso fazia *encostar* no
   * campo já alterar o valor — e, em telas que salvam vários campos de uma vez, um toque
   * acidental gravava zero por cima de um valor real. Agora focar não dispara `onChange`
   * nenhum: só digitar altera.
   *
   * A lógica não depende de a seleção visual acontecer de fato (em alguns teclados móveis
   * ela não aparece): quem manda é este estado, não o DOM.
   */
  const [pristino, setPristino] = useState(false);

  function onFocus(e: React.FocusEvent<HTMLInputElement>) {
    setPristino(true);
    e.target.select();
  }

  function onBlur() {
    setPristino(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      onChange(empurrarDigito(pristino ? 0 : valorCentavos, e.key));
      setPristino(false);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      // Tudo selecionado: apagar limpa o campo, como em qualquer input.
      onChange(pristino ? 0 : apagarUltimoDigito(valorCentavos));
      setPristino(false);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    setPristino(false);
    onChange(digitosParaCentavos(e.clipboardData.getData('text')));
  }

  return (
    <input
      id={id} inputMode="numeric" autoFocus={autoFocus} style={style} aria-label={ariaLabel}
      value={formatarBRL(valorCentavos)}
      onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown} onPaste={onPaste}
      onChange={() => {}}
    />
  );
}
