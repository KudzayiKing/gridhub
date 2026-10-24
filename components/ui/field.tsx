"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { useI18n } from "@/lib/i18n";

/* -------------------------------- Label -------------------------------- */

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn("text-[13px] font-medium leading-none text-fg", className)}
      {...props}
    />
  );
});

/* -------------------------------- Field -------------------------------- */

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor} className="flex items-center gap-1">
          {typeof label === "string" ? t(label) : label}
          {required ? <span className="text-[var(--negative)]">*</span> : null}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-[var(--negative)]" role="alert">
          {t(error)}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-subtle">{typeof hint === "string" ? t(hint) : hint}</p>
      ) : null}
    </div>
  );
}

const controlBase =
  "w-full rounded-xl border border-line-strong bg-[var(--surface-strong)] px-3 text-sm text-fg placeholder:text-fg-subtle transition-colors focus:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    const { t } = useI18n();
    return <input ref={ref} className={cn(controlBase, "h-10", className)} {...props}
      placeholder={props.placeholder ? t(props.placeholder) : undefined}
      aria-label={props["aria-label"] ? t(props["aria-label"]) : undefined}
      title={props.title ? t(props.title) : undefined} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  const { t } = useI18n();
  return <textarea ref={ref} className={cn(controlBase, "min-h-20 py-2 leading-relaxed", className)} {...props}
    placeholder={props.placeholder ? t(props.placeholder) : undefined}
    aria-label={props["aria-label"] ? t(props["aria-label"]) : undefined}
    title={props.title ? t(props.title) : undefined} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  const { t } = useI18n();
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlBase, "h-10 appearance-none pr-9", className)}
        {...props}
        aria-label={props["aria-label"] ? t(props["aria-label"]!) : undefined}
        title={props.title ? t(props.title) : undefined}
      >
        {React.Children.map(children, (child) => React.isValidElement<{ children?: React.ReactNode }>(child) && typeof child.props.children === "string"
          ? React.cloneElement(child, {}, t(child.props.children))
          : child)}
      </select>
      <AnimatedIcon
        name="chevronDown"
        size={14}
        trigger="none"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle"
      />
    </div>
  );
});

/* ------------------------------- Checkbox ------------------------------ */

export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "press grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border border-line-strong bg-[var(--surface-strong)] data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent)] data-[state=checked]:text-[var(--accent-fg)]",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <AnimatedIcon name="check" size={12} trigger="none" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

/* -------------------------------- Switch ------------------------------- */

export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "press relative h-6 w-11 shrink-0 rounded-full border border-line-strong bg-[var(--bg-subtle)] data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent)]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block h-[18px] w-[18px] translate-x-[3px] rounded-full bg-[var(--surface-strong)] shadow-sm transition-transform data-[state=checked]:translate-x-[23px] data-[state=checked]:bg-[var(--accent-fg)]" />
    </SwitchPrimitive.Root>
  );
});

/* ----------------------------- Segmented ------------------------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  size?: "sm" | "md";
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-line bg-[var(--bg-subtle)] p-0.5",
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "press rounded-full font-medium transition-colors",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3.5 text-[13px]",
            value === opt.value
              ? "bg-[var(--surface-strong)] text-fg shadow-[0_1px_2px_rgba(23,26,24,0.08)]"
              : "text-fg-muted hover:text-fg",
          )}
        >
          {typeof opt.label === "string" ? t(opt.label) : opt.label}
        </button>
      ))}
    </div>
  );
}
