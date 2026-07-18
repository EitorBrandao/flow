import { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { formatarDataBR } from '../domain/dates';
import type { ISODate } from '../domain/types';

interface CampoDataProps {
  id: string;
  value: ISODate | '';
  onChange: (v: ISODate) => void;
  placeholder?: string;
  ariaLabel?: string;
  ativo?: boolean;
  min?: string;
  max?: string;
  style?: React.CSSProperties;
}

export default function CampoData({
  id, value, onChange, placeholder = 'Selecionar', ariaLabel, ativo, min, max, style,
}: CampoDataProps) {
  const ref = useRef<HTMLInputElement>(null);

  function abrir() {
    const input = ref.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.focus();
  }

  return (
    <div className="campo-data" style={style}>
      <button
        type="button" className={`botao botao-com-icone${ativo ? ' ativo' : ''}`}
        aria-hidden="true" tabIndex={-1} onClick={abrir}
      >
        <Calendar size={16} aria-hidden="true" />
        <span>{value ? formatarDataBR(value) : placeholder}</span>
      </button>
      <input
        ref={ref} id={id} type="date" className="campo-data-input" value={value}
        aria-label={ariaLabel} min={min} max={max}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
