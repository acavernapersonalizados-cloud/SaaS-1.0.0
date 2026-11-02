import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { equivalentText, formatQuantity, parseQuantity, subUnitOf } from '../lib/quantity';

/**
 * Estacionamento item 25 (2/11/2026): quantidade com fração, com vírgula ou ponto e teclado decimal no celular. Em
 * kg, l ou m há o botão para digitar na unidade menor (g, ml, cm) e o equivalente aparece embaixo. O valor que sai
 * (`onChange`) é sempre na unidade do insumo; null = campo vazio ou inválido.
 */
export function QuantityInput({
  value,
  onChange,
  unit,
  id,
  ariaLabel,
  placeholder,
  className,
  readOnly,
  compact,
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  unit?: string;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  /** Sem a linha do equivalente (campos pequenos em lista). */
  compact?: boolean;
}) {
  const sub = subUnitOf(unit);
  const [inSub, setInSub] = useState(false);
  const factor = inSub && sub ? sub.factor : 1;
  const shown = (v: number | null | undefined) =>
    v === null || v === undefined || Number.isNaN(Number(v))
      ? ''
      : formatQuantity(Number(v) * factor, { grouping: false });
  const [text, setText] = useState(shown(value));
  const [invalid, setInvalid] = useState(false);

  // Valor mudou por fora (ou trocou kg/g): reescreve o texto, sem atrapalhar o que está sendo digitado.
  useEffect(() => {
    const typed = parseQuantity(text);
    const current = typed === null ? null : typed / factor;
    const v = value === undefined || value === null || Number.isNaN(Number(value)) ? null : Number(value);
    if (v === null) {
      if (typed !== null) setText('');
    } else if (current === null || Math.abs(current - v) > 1e-9) setText(shown(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, factor]);

  const handle = (t: string) => {
    setText(t);
    const n = parseQuantity(t);
    setInvalid(t.trim() !== '' && n === null);
    onChange(n === null ? null : Math.round((n / factor) * 1e6) / 1e6);
  };

  const v = Number(value) || 0;
  return (
    <div className={cn('space-y-1', compact && 'space-y-0')}>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          readOnly={readOnly}
          placeholder={placeholder}
          value={text}
          onChange={e => handle(e.target.value)}
          className={cn(className, invalid && 'border-red-400')}
        />
        {sub && !readOnly && (
          <button
            type="button"
            onClick={() => setInSub(s => !s)}
            aria-label={`Digitar em ${inSub ? unit : sub.unit}`}
            className="shrink-0 px-2 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-bold text-neutral-700"
          >
            {inSub ? sub.unit : unit}
          </button>
        )}
      </div>
      {invalid && <p className="text-[11px] font-bold text-red-600">Use números: 0,5 ou 0.5</p>}
      {!compact && sub && v > 0 && <p className="text-[11px] text-neutral-500">= {equivalentText(v, unit)}</p>}
    </div>
  );
}
