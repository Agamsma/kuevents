import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The perforation system.
 *
 * Every surface in KU Events is an admission stub — the same physical object
 * the whole product is about. `Stub` is the card, `Perforation` is the tear
 * line, and `FieldLabel` is the tiny monospaced caption printed above a value
 * on a real ticket. Using one vocabulary everywhere is what makes the event
 * list, the pass and the gate console read as one system.
 */

export function Stub({
  className,
  notched = false,
  /** How far down the card the notches sit, as a CSS length or percentage. */
  notchAt = "50%",
  style,
  ...props
}: React.ComponentProps<"div"> & { notched?: boolean; notchAt?: string }) {
  return (
    <div
      data-slot="stub"
      className={cn("stub", notched && "stub-notched", className)}
      style={{ ...style, ["--at" as string]: notchAt }}
      {...props}
    />
  );
}

/** The dashed rule a stub tears along. */
export function Perforation({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("tear", className)} {...props} />;
}

/** MONO, tiny, letterspaced — the caption printed above a value on a ticket. */
export function FieldLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("field-label", className)} {...props} />;
}

/** A label/value pair, set the way a boarding pass sets one. */
export function Field({
  label,
  value,
  icon: Icon,
  className,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <FieldLabel>{label}</FieldLabel>
      <div
        className={cn(
          "mt-1.5 flex items-center gap-1.5 text-sm font-medium text-bone",
          valueClassName,
        )}
      >
        {Icon ? <Icon className="size-3.5 shrink-0 text-bone-faint" /> : null}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
