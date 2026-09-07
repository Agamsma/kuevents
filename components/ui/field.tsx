"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { FieldLabel } from "@/components/ui/stub";

/**
 * Form controls, styled once.
 *
 * Every input in the app shares one treatment: a hairline field on a barely
 * lifted surface, crimson on focus, and errors reported under the control in
 * the interface's voice rather than the browser's.
 */

const baseField =
  "w-full rounded-xl border border-line bg-accent px-3.5 py-2.5 text-[15px] text-foreground transition-colors placeholder:text-subtle-foreground focus:border-primary focus:bg-accent focus:outline-none disabled:opacity-50";

export function TextField({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: React.ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string | null;
}) {
  const fieldId = id ?? `field-${props.name}`;

  return (
    <div className={className}>
      <label htmlFor={fieldId}>
        <FieldLabel>{label}</FieldLabel>
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(baseField, "mt-2", error && "border-refuse")}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="mt-1.5 text-[12px] text-refuse">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 font-mono text-[10px] text-subtle-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: React.ComponentProps<"textarea"> & {
  label: string;
  hint?: string;
  error?: string | null;
}) {
  const fieldId = id ?? `field-${props.name}`;

  return (
    <div className={className}>
      <label htmlFor={fieldId}>
        <FieldLabel>{label}</FieldLabel>
      </label>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn(baseField, "mt-2 min-h-28 resize-y leading-relaxed", error && "border-refuse")}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-[12px] text-refuse">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 font-mono text-[10px] text-subtle-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * A radio group that looks like a set of chips.
 *
 * Native radios under the hood, so arrow-key navigation and screen-reader
 * grouping come for free — the chip is just a styled label.
 */
export function ChipGroup<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  error,
  className,
}: {
  label: string;
  name: string;
  options: { value: T; label: string; hint?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string | null;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend>
        <FieldLabel>{label}</FieldLabel>
      </legend>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = value === option.value;

          return (
            <label
              key={option.value}
              title={option.hint}
              className={cn(
                "cursor-pointer rounded-full border px-4 py-2 text-[13px] transition-all",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-crimson",
                checked
                  ? "border-primary/50 bg-primary/15 text-foreground"
                  : "border-line text-muted-foreground hover:border-[color:var(--line-strong)] hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>

      {error ? <p className="mt-2 text-[12px] text-refuse">{error}</p> : null}
    </fieldset>
  );
}
