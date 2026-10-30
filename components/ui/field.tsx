"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { useI18n } from "@/lib/i18n";
import { AnimatedTabs } from "@/components/ui/animated-tabs";

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
  HTMLButtonElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  const { t } = useI18n();
  const options = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>> =>
      React.isValidElement(child) && child.type === "option",
  );
  const selected = props.value === undefined ? undefined : String(props.value);
  const defaultSelected = props.defaultValue === undefined ? undefined : String(props.defaultValue);
  const triggerId = props.id;

  return (
    <SelectPrimitive.Root
      value={selected}
      defaultValue={defaultSelected}
      onValueChange={(selectedValue) => {
        const value = selectedValue === "__gridhub_empty__" ? "" : selectedValue;
        props.onChange?.({
          target: { value, name: props.name },
          currentTarget: { value, name: props.name },
        } as React.ChangeEvent<HTMLSelectElement>);
      }}
      name={props.name}
      required={props.required}
      disabled={props.disabled}
    >
      <SelectPrimitive.Trigger
        id={triggerId}
        ref={ref}
        className={cn(controlBase, "flex h-10 items-center justify-between gap-2 text-left", className)}
        aria-label={props["aria-label"] ? t(props["aria-label"]!) : undefined}
        aria-invalid={props["aria-invalid"]}
        aria-describedby={props["aria-describedby"]}
        title={props.title ? t(props.title) : undefined}
        onBlur={props.onBlur as unknown as React.FocusEventHandler<HTMLButtonElement>}
        onFocus={props.onFocus as unknown as React.FocusEventHandler<HTMLButtonElement>}
      >
        <SelectPrimitive.Value placeholder={t(options.find((option) => option.props.value === "")?.props.children?.toString() ?? "Select…")} />
        <SelectPrimitive.Icon asChild>
          <AnimatedIcon name="chevronDown" size={14} trigger="none" className="shrink-0 text-fg-subtle" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          side="bottom"
          sideOffset={4}
          align="start"
          collisionPadding={8}
          className="glass-strong z-[100] max-h-[min(18rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-xl p-1.5 text-sm shadow-xl"
        >
          <SelectPrimitive.Viewport>
            {options.map((option, index) => {
              const rawValue = String(option.props.value ?? index);
              const value = rawValue === "" ? "__gridhub_empty__" : rawValue;
              const label = option.props.children;
              /**
               * `<option data-raw>` marks the label as user data (a category,
               * account or product the person typed), not product copy. Those
               * must be shown verbatim — translating them would rename the
               * user's own records on screen.
               */
              const isRaw = (option.props as Record<string, unknown>)["data-raw"] !== undefined;
              return (
                <SelectPrimitive.Item
                  key={option.key === null ? value : String(option.key)}
                  value={value}
                  disabled={option.props.disabled}
                  textValue={typeof label === "string" && !isRaw ? t(label) : undefined}
                  className="relative flex min-h-9 cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-fg outline-none data-[highlighted]:bg-[var(--bg-subtle)] data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
                >
                  <SelectPrimitive.ItemText>
                    {typeof label === "string" && !isRaw ? t(label) : label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-3 text-[var(--accent)]">
                    <AnimatedIcon name="check" size={14} trigger="none" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              );
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
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
      <SwitchPrimitive.Thumb className="block h-[18px] w-[18px] translate-x-[3px] rounded-full bg-[var(--fg-muted)] shadow-sm transition-transform data-[state=checked]:translate-x-[23px] data-[state=checked]:bg-[var(--accent-fg)]" />
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
    <AnimatedTabs
      value={value}
      onChange={onChange}
      options={options.map((option) => ({
        value: option.value,
        label: typeof option.label === "string" ? t(option.label) : option.label,
      }))}
      className={cn("inline-flex items-center gap-0.5 rounded-full border border-line bg-[var(--bg-subtle)] p-0.5", className)}
      buttonClassName={size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3.5 text-[13px]"}
    />
  );
}
