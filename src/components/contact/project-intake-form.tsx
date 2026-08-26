"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { submitProjectInquiry } from "@/app/actions/contact";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPlanBySlug, sellableAddOns } from "@/lib/plans";
import {
  budgetTiers,
  contactSchema,
  projectTypes,
  timelines,
  type ContactInput,
} from "@/lib/schemas/contact";
import { buildWhatsAppUrl, leadWhatsAppMessage } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export function ProjectIntakeForm({
  defaultPlanSlug,
  defaultAddonSlug,
}: {
  defaultPlanSlug?: string;
  defaultAddonSlug?: string;
}) {
  const selected = getPlanBySlug(defaultPlanSlug);
  const addon = sellableAddOns.find((item) => item.slug === defaultAddonSlug);
  const [pending, startTransition] = useTransition();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
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
      company: "",
      projectType: selected ? "plan-booking" : addon ? "addon" : "",
      budget: selected ? `plan-${selected.slug}` : "",
      timeline: selected?.slug === "starter" ? "asap" : selected ? "1-3-months" : "",
      selectedPlan: selected?.planCode ?? addon?.title ?? "",
      scope: selected
        ? `I'd like to book the ${selected.name} plan (${selected.priceLabel}). Goals and requirements: `
        : addon
          ? `I'd like to add "${addon.title}" to my engagement. ${addon.summary} Details: `
          : "",
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
        <p className="mt-3 max-w-md text-muted-foreground">
          {serverMessage}
        </p>
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
            {selected.priceLabel} · {selected.delivery}
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
          id="company"
          label="Company / project"
          error={errors.company?.message}
          className="sm:col-span-2"
        >
          <Input
            id="company"
            autoComplete="organization"
            placeholder="Acme Labs"
            disabled={pending}
            aria-invalid={!!errors.company}
            {...register("company")}
          />
        </Field>
        <Field
          id="projectType"
          label="Project type"
          error={errors.projectType?.message}
        >
          <select
            id="projectType"
            className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            disabled={pending}
            aria-invalid={!!errors.projectType}
            {...register("projectType")}
          >
            <option value="">Select type</option>
            {projectTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="budget" label="Budget / plan" error={errors.budget?.message}>
          <select
            id="budget"
            className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            disabled={pending}
            aria-invalid={!!errors.budget}
            {...register("budget")}
          >
            <option value="">Select budget</option>
            {budgetTiers.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="timeline"
          label="Timeline"
          error={errors.timeline?.message}
          className="sm:col-span-2"
        >
          <select
            id="timeline"
            className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            disabled={pending}
            aria-invalid={!!errors.timeline}
            {...register("timeline")}
          >
            <option value="">Select timeline</option>
            {timelines.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="scope"
          label="Scope notes"
          error={errors.scope?.message}
          className="sm:col-span-2"
        >
          <Textarea
            id="scope"
            placeholder="Goals, current stack, must-haves, and what ‘done’ looks like."
            className="min-h-32"
            disabled={pending}
            aria-invalid={!!errors.scope}
            {...register("scope")}
          />
        </Field>
      </div>

      {serverMessage && !success ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {serverMessage}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          size="lg"
          className="h-11 bg-forest px-6 text-primary-foreground hover:bg-forest/90 dark:bg-gold dark:text-gold-foreground dark:hover:bg-gold/90"
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
              company: values.company || "my company",
              projectType: values.projectType || "a project",
              budget: values.budget || "to discuss",
              timeline: values.timeline || "flexible",
              selectedPlan: values.selectedPlan || selected?.planCode,
              scope:
                values.scope ||
                "I'd like to discuss a web project with the Lynx team.",
            });
            window.open(buildWhatsAppUrl(message), "_blank", "noopener,noreferrer");
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
        <p className="mt-1.5 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
