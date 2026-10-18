import { KeyboardEvent, ReactNode, useId } from 'react';
import type { ControlDescriptor } from '../../simulator/simulator-interface';
import './controls.css';

export function Button({
  children,
  onClick,
  variant = 'default',
  pressed,
  disabled,
  title,
  kbd,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost';
  pressed?: boolean;
  disabled?: boolean;
  title?: string;
  kbd?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${className}`}
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
      title={title}
    >
      {children}
      {kbd && <kbd aria-hidden="true">{kbd}</kbd>}
    </button>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  const onKey = (e: KeyboardEvent) => {
    const i = options.findIndex((o) => o.value === value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(options[(i + 1) % options.length].value);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(options[(i - 1 + options.length) % options.length].value);
    }
  };
  return (
    <div className={`seg seg-${size}`} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={active ? 'on' : ''}
            onClick={() => onChange(o.value)}
            title={o.title}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function OptionList({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const onKey = (e: KeyboardEvent) => {
    const i = options.findIndex((o) => o.value === value);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(options[(i + 1) % options.length].value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(options[(i - 1 + options.length) % options.length].value);
    }
  };
  return (
    <div className="optlist" role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={active ? 'on' : ''}
            onClick={() => onChange(o.value)}
          >
            <span className="idx">{i.toString(2).padStart(3, '0')}</span>
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  bits,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  bits?: number;
  format?: (v: number) => string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="range">
      <div className="range-top">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="mono-num">
          {format ? format(value) : value}
          {bits !== undefined && <span className="bin">{value.toString(2).padStart(bits, '0')}</span>}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby={hint ? `${id}-hint` : undefined}
        style={{ '--p': `${((value - min) / (max - min || 1)) * 100}%` } as React.CSSProperties}
      />
      {hint && (
        <span id={`${id}-hint`} className="visually-hidden">
          {hint}
        </span>
      )}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  title,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  title?: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} title={title}>
      <span className="toggle-led" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export function BitSwitch({
  value,
  onToggle,
  label,
  highlight,
}: {
  value: number;
  onToggle?: () => void;
  label: string;
  highlight?: 'changed' | 'dropped' | 'filled' | null;
}) {
  const cls = `bit ${value ? 'one' : 'zero'} ${highlight ?? ''}`;
  if (!onToggle) {
    return (
      <span className={cls} aria-label={`${label} = ${value}`}>
        {value}
      </span>
    );
  }
  return (
    <button type="button" className={cls} onClick={onToggle} aria-label={`${label} = ${value}, toggle`} aria-pressed={!!value}>
      {value}
    </button>
  );
}

export function ControlField({
  control,
  value,
  onChange,
}: {
  control: ControlDescriptor;
  value: number;
  onChange: (v: number) => void;
}) {
  const pin =
    control.binding.type === 'ui_in'
      ? control.binding.msb === control.binding.lsb
        ? `ui_in[${control.binding.msb}]`
        : `ui_in[${control.binding.msb}:${control.binding.lsb}]`
      : null;
  if (control.kind === 'toggle') {
    return <Toggle label={control.label} checked={!!value} onChange={(v) => onChange(v ? 1 : 0)} title={pin ?? control.hint} />;
  }
  if (control.kind === 'range') {
    return (
      <RangeField
        label={pin ? `${control.label} · ${pin}` : control.label}
        value={value}
        min={control.min}
        max={control.max}
        bits={control.bits}
        hint={control.hint}
        onChange={onChange}
      />
    );
  }
  return null;
}
