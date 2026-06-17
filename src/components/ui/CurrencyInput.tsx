import { useState, useRef } from 'react';
import { formatCurrency } from '../../utils/formatters';

interface CurrencyInputProps {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  min?: number;
  disabled?: boolean;
}

/**
 * Input para valores monetarios en pesos colombianos.
 * - Modo display: muestra "$50.000" (formateado)
 * - Modo edición (focus): muestra "50000" (número puro, fácil de reemplazar)
 * - Nunca deja el "0" pegado al inicio cuando el usuario escribe
 */
export function CurrencyInput({
  value,
  onChange,
  placeholder = '$0',
  required = false,
  className = '',
  min = 0,
  disabled = false,
}: CurrencyInputProps) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw]         = useState('');
  const inputRef              = useRef<HTMLInputElement>(null);

  const handleFocus = () => {
    setEditing(true);
    // Mostrar el número sin formato; si es 0 dejar vacío para que el usuario escriba directamente
    setRaw(value > 0 ? String(value) : '');
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleBlur = () => {
    setEditing(false);
    const parsed = parseFloat(raw.replace(/[^\d]/g, '')) || 0;
    const clamped = Math.max(min, parsed);
    onChange(clamped);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Solo dígitos
    const digits = e.target.value.replace(/[^\d]/g, '');
    setRaw(digits);
  };

  return (
    <input
      ref={inputRef}
      type={editing ? 'tel' : 'text'}
      inputMode="numeric"
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      className={`input-field ${className}`}
      value={editing ? raw : (value > 0 ? formatCurrency(value) : '')}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
    />
  );
}
