import React, { useId } from "react";

interface AutoResizeTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * Champ texte auto-extensible : utilise `field-sizing: content` en natif
 * avec un repli CSS Grid (`data-replicated-value`) sur les navigateurs
 * sans support natif, à largeur 100% stable.
 */
export default function AutoResizeTextarea({
  label,
  value,
  onChange,
  error,
  className = "",
  id,
  ...rest
}: AutoResizeTextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-xs font-medium text-slate-700 dark:text-slate-200"
        >
          {label}
        </label>
      )}
      <div className="wt-grow-wrap" data-replicated-value={value}>
        <textarea
          id={textareaId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`wt-auto-grow w-full rounded-xl border bg-surface px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-brand ${
            error ? "border-red-500" : "border-surface-border"
          } ${className}`}
          {...rest}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
