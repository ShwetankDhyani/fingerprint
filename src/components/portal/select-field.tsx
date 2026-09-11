"use client";

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type PortalSelectOption = { value: string; label: string };

/** Closed-field chrome shared with any leftover native selects. */
export const portalSelectClassName =
  "h-8 w-full rounded-lg border border-[#24302b] bg-[#121a17] px-2 text-sm text-[#e8eee9] outline-none [color-scheme:dark] focus-visible:border-[#b08d1f] focus-visible:ring-3 focus-visible:ring-[#b08d1f]/30 disabled:cursor-not-allowed disabled:opacity-50";

/** Internal only — never rendered as visible text. */
const ALL_VALUE = "all";

/**
 * Dark-surface select that paints its own menu and always shows a human label.
 * Native <option> lists inherit light OS chrome inside the portal; this avoids
 * that, and never leaks sentinel values like "__empty__" into the trigger.
 */
export function PortalSelect({
  id,
  name,
  label,
  options,
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  required,
  className,
  includeEmptyLabel,
  placeholder,
}: {
  id?: string;
  name?: string;
  label?: string;
  options: PortalSelectOption[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  className?: string;
  /** Human label for the “no filter / unset” option (e.g. “All statuses”). */
  includeEmptyLabel?: string;
  placeholder?: string;
}) {
  const isControlled = controlledValue !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const current = isControlled ? (controlledValue ?? "") : uncontrolled;

  const emptyLabel = includeEmptyLabel ?? placeholder ?? "All";
  const items = includeEmptyLabel
    ? [{ value: ALL_VALUE, label: emptyLabel }, ...options]
    : options;

  function toSelectValue(raw: string) {
    if (!raw) return includeEmptyLabel ? ALL_VALUE : null;
    return raw;
  }

  function fromSelectValue(next: string | null) {
    if (!next || next === ALL_VALUE) return "";
    return next;
  }

  function handleChange(next: string | null) {
    const resolved = fromSelectValue(next);
    if (!isControlled) setUncontrolled(resolved);
    onValueChange?.(resolved);
  }

  const selectValue = toSelectValue(current);
  const displayLabel =
    items.find((option) => option.value === (selectValue ?? ""))?.label ??
    emptyLabel;

  return (
    <>
      {name ? (
        <input type="hidden" name={name} value={current} required={required} />
      ) : null}
      <Select
        value={selectValue}
        onValueChange={handleChange}
      >
        <SelectTrigger
          id={id}
          aria-label={label ?? emptyLabel}
          className={cn(
            "h-8 w-full min-w-0 border-[#24302b] bg-[#121a17] text-[#e8eee9] hover:bg-[#1a2420] dark:bg-[#121a17] dark:hover:bg-[#1a2420]",
            className,
          )}
        >
          {/* Plain text — never rely on SelectValue, which can echo the raw value. */}
          <span className="flex-1 truncate text-left">{displayLabel}</span>
        </SelectTrigger>
        <SelectContent
          align="start"
          // `dark` keeps theme tokens correct when the menu portals to <body>.
          className="dark z-[80] border border-[#24302b] bg-[#121a17] text-[#e8eee9] shadow-lg ring-[#b08d1f]/20"
        >
          {items.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="!text-[#e8eee9] focus:!bg-[#1a2420] focus:!text-[#e8eee9] data-highlighted:!bg-[#1a2420] data-highlighted:!text-[#e8eee9] data-[selected]:!text-[#e8eee9] [&_*]:!text-inherit"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
