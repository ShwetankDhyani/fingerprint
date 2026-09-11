"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import type { CountryCode } from "libphonenumber-js";

import { submitProjectInquiry } from "@/app/actions/contact";
import { PhoneInput } from "@/components/contact/phone-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPlanBySlug, sellableAddOns } from "@/lib/plans";
import { formatPhoneDisplay } from "@/lib/phone";
import {
  contactSchema,
  type ContactInput,
} from "@/lib/schemas/contact";
import { buildWhatsAppUrl, leadWhatsAppMessage } from "@/lib/whatsapp-link";
import { cn } from "@/lib/utils";

export function ProjectIntakeForm({
  defaultPlanSlug,
  defaultAddonSlug,
  defaultPhoneCountry = "IN",
}: {
  defaultPlanSlug?: string;
  defaultAddonSlug?: string;
  defaultPhoneCountry?: CountryCode;
}) {
  const selected = getPlanBySlug(defaultPlanSlug);
  const addon = sellableAddOns.find((item) => item.slug === defaultAddonSlug);
  const [pending, startTransition] = useTransition();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
    setError,
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      message: selected
        ? `I'd like to book the ${selected.name} plan (${selected.priceLabel}). `
        : addon
          ? `I'd like to add "${addon.title}" to my engagement. `
          : "",
      selectedPlan: selected?.planCode ?? addon?.title ?? "",
      company: "",
    },
  });

  function onSubmit(values: ContactInput) {
    setServerMessage(null);
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) {
      formData.set(key, value ?? "");
    }

    startTransition(async () => {
      const result = await submitProjectInquiry(
        { ok: false, message: "" },
        formData,
      );

      if (!result.ok) {
        if (result.errors) {
          for (const [key, message] of Object.entries(result.errors)) {
            if (message) {
              setError(key as keyof ContactInput, { message });
            }
          }
        }
        setServerMessage(result.message);
        return;
      }

      reset();
      setSuccess(true);
      setServerMessage(result.message);
    });
  }

  if (success) {
    return (
      <div
        className="rounded-xl border border-forest/15 bg-card/80 p-8 dark:border-white/10"
        role="status"
      >
        <p className="font-display text-2xl tracking-tight text-forest dark:text-gold">
          Inquiry received.
        </p>
        <p className="mt-3 max-w-md text-muted-foreground">{serverMessage}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-6"
          onClick={() => {
            setSuccess(false);
            setServerMessage(null);
          }}
        >
          Send another inquiry
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-xl border border-forest/15 bg-card/80 p-6 sm:p-8 dark:border-white/10"
      noValidate
    >
      {selected ? (
        <div className="mb-6 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
          <p className="font-medium text-forest dark:text-gold">
            Booking: {selected.name}
          </p>
          <p className="mt-1 text-muted-foreground">
            Total {selected.priceLabel} · Advance {selected.advanceLabel} ·{" "}
            {selected.delivery}
          </p>
          <input type="hidden" {...register("selectedPlan")} />
        </div>
      ) : (
        <input type="hidden" value="" {...register("selectedPlan")} />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Name" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Alex Rivera"
            disabled={pending}
            aria-invalid={!!errors.name}
            {...register("name")}
          />
        </Field>
        <Field id="email" label="Work email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="alex@company.com"
            disabled={pending}
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </Field>
        <Field
          id="phone"
          label="Mobile number"
          error={errors.phone?.message}
          className="sm:col-span-2"
        >
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <PhoneInput
                id="phone"
                disabled={pending}
                defaultCountry={defaultPhoneCountry}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={!!errors.phone}
              />
            )}
          />
          <p className="text-muted-foreground mt-1.5 text-xs">
            Include your country code so we can reach you on call or WhatsApp.
          </p>
        </Field>
        <Field
          id="message"
          label="How can we help?"
          error={errors.message?.message}
          className="sm:col-span-2"
        >
          <Textarea
            id="message"
            placeholder="A sentence or two is enough — goals, timeline, or questions."
            className="min-h-28"
            disabled={pending}
            aria-invalid={!!errors.message}
            {...register("message")}
          />
        </Field>
      </div>

      {serverMessage && !success ? (
        <p className="text-destructive mt-4 text-sm" role="alert">
          {serverMessage}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          size="lg"
          className="bg-forest text-primary-foreground hover:bg-forest/90 dark:bg-gold dark:text-gold-foreground dark:hover:bg-gold/90 h-11 px-6"
          disabled={pending}
        >
          {pending
            ? "Sending…"
            : selected
              ? "Request plan booking"
              : "Start a conversation"}
        </Button>
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-11",
          )}
          onClick={() => {
            const values = getValues();
            const message = leadWhatsAppMessage({
              name: values.name || "there",
              company: values.company,
              phone: values.phone
                ? formatPhoneDisplay(values.phone)
                : undefined,
              selectedPlan: values.selectedPlan || selected?.planCode,
              message:
                values.message ||
                "I'd like to discuss a web project with the Lynx team.",
            });
            window.open(
              buildWhatsAppUrl(message),
              "_blank",
              "noopener,noreferrer",
            );
          }}
        >
          Continue on WhatsApp
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="grid gap-2">
        <Label htmlFor={id}>{label}</Label>
        {children}
      </div>
      {error ? (
        <p className="text-destructive mt-1.5 text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
