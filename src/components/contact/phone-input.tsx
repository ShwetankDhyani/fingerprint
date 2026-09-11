"use client";

import { useMemo, useState } from "react";
import {
  AsYouType,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

import { Input } from "@/components/ui/input";
import { countryFlag, phoneCountryOptions, toE164 } from "@/lib/phone";
import { cn } from "@/lib/utils";

type PhoneInputProps = {
  id?: string;
  disabled?: boolean;
  defaultCountry?: CountryCode;
  value?: string;
  onChange: (e164: string) => void;
  onBlur?: () => void;
  "aria-invalid"?: boolean;
  className?: string;
};

function splitValue(value: string | undefined, fallback: CountryCode) {
  if (!value) return { country: fallback, national: "" };
  const parsed = parsePhoneNumberFromString(value);
  if (parsed?.country) {
    return {
      country: parsed.country,
      national: parsed.nationalNumber || "",
    };
  }
  return { country: fallback, national: value.replace(/^\+\d{1,4}\s?/, "") };
}

export function PhoneInput({
  id = "phone",
  disabled,
  defaultCountry = "IN",
  value,
  onChange,
  onBlur,
  "aria-invalid": ariaInvalid,
  className,
}: PhoneInputProps) {
  const options = useMemo(() => phoneCountryOptions(), []);
  const initial = splitValue(value, defaultCountry);
  const [country, setCountry] = useState<CountryCode>(initial.country);
  const [national, setNational] = useState(initial.national);

  function publish(nextCountry: CountryCode, nextNational: string) {
    const trimmed = nextNational.trim();
    if (!trimmed) {
      onChange("");
      return;
    }

    const e164 = toE164(trimmed, nextCountry);
    if (e164) {
      onChange(e164);
      return;
    }

    // Progressive draft while typing — zod still requires a valid E.164 on submit.
    const drafted = new AsYouType(nextCountry).input(trimmed);
    const parsed = parsePhoneNumberFromString(drafted, nextCountry);
    onChange(parsed?.number ?? "");
  }

  return (
    <div
      className={cn(
        "border-input bg-background focus-within:border-ring focus-within:ring-ring/50 flex h-8 overflow-hidden rounded-lg border focus-within:ring-3",
        ariaInvalid ? "border-destructive" : null,
        className,
      )}
    >
      <label className="sr-only" htmlFor={`${id}-country`}>
        Country code
      </label>
      <select
        id={`${id}-country`}
        className="bg-muted/40 text-foreground max-w-[7.75rem] shrink-0 border-0 border-r border-input px-2 text-xs outline-none disabled:opacity-50 sm:max-w-[9.75rem]"
        disabled={disabled}
        value={country}
        aria-label="Country code"
        onChange={(event) => {
          const next = event.target.value as CountryCode;
          setCountry(next);
          publish(next, national);
        }}
      >
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {countryFlag(option.code)} {option.code} {option.dial}
          </option>
        ))}
      </select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="Mobile number"
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-required
        value={national}
        onBlur={onBlur}
        onChange={(event) => {
          const next = event.target.value;
          setNational(next);
          publish(country, next);
        }}
        className="h-8 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
