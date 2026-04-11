"use client";

import { useEffect, useRef } from "react";

type Props = {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

const inputClass =
  "h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500";

export function TableSelectCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
  disabled,
  className,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className={className ? `${inputClass} ${className}` : inputClass}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
    />
  );
}
