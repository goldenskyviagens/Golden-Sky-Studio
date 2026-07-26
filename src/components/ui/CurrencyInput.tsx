"use client";

import { InputHTMLAttributes } from "react";

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  style?: InputHTMLAttributes<HTMLInputElement>["style"];
}

export function CurrencyInput({ value, onChange, className, style }: CurrencyInputProps) {
  const display =
    value === "" || value === undefined || value === null || isNaN(Number(value))
      ? ""
      : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      onChange("");
      return;
    }
    const num = parseInt(digits, 10) / 100;
    onChange(String(num));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder="R$ 0,00"
      className={className}
      style={style}
    />
  );
}
