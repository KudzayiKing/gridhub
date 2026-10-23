"use client";

import * as React from "react";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { cn } from "@/lib/utils";

export type FormFieldType =
  | "text"
  | "number"
  | "currency"
  | "date"
  | "select"
  | "checkbox"
  | "textarea"
  | "email";

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  step?: string;
  min?: number;
  max?: number;
  defaultValue?: string | number | boolean;
  span?: 1 | 2;
  /** Hide the field unless the predicate passes. */
  visibleWhen?: (values: Record<string, unknown>) => boolean;
}

export type FormValues = Record<string, unknown>;

export interface RecordFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: FormField[];
  initial?: FormValues;
  onSubmit: (values: FormValues) => void | Promise<void>;
  submitLabel?: string;
  /** Extra content below the fields (e.g. a calculated preview). */
  footer?: React.ReactNode;
}

function initialValues(fields: FormField[], initial?: FormValues): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const fromInitial = initial?.[f.key];
    if (fromInitial !== undefined && fromInitial !== null) out[f.key] = fromInitial;
    else if (f.defaultValue !== undefined) out[f.key] = f.defaultValue;
    else if (f.type === "checkbox") out[f.key] = false;
    else if (f.type === "number" || f.type === "currency") out[f.key] = "";
    else out[f.key] = "";
  }
  return out;
}

/**
 * Schema-driven record form. Every tool uses this, so validation, mobile layout and
 * keyboard behaviour stay consistent across all sixteen applications.
 */
export function RecordForm({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initial,
  onSubmit,
  submitLabel = "Save",
  footer,
}: RecordFormProps) {
  const [values, setValues] = React.useState<FormValues>(() => initialValues(fields, initial));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  /*
   * Reset when the dialog opens or the edited record changes.
   *
   * This is React's documented "adjusting state when a prop changes" pattern: compare
   * against the last seen signature and update during render. React discards the in-flight
   * render and re-runs immediately, so the user never sees the previous record's values.
   * The effect this replaces produced a second committed render pass on every open, and
   * briefly painted stale fields.
   */
  const signature = `${open ? "open" : "closed"}:${initial ? JSON.stringify(initial) : "new"}`;
  const [lastSignature, setLastSignature] = React.useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setValues(initialValues(fields, initial));
    setErrors({});
  }

  const set = (key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    for (const f of fields) {
      if (f.visibleWhen && !f.visibleWhen(values)) continue;
      const raw = values[f.key];
      const empty = raw === "" || raw === null || raw === undefined;
      if (f.required && empty) {
        next[f.key] = `${f.label} is required`;
        continue;
      }
      if (!empty && (f.type === "number" || f.type === "currency")) {
        const n = Number(raw);
        if (!Number.isFinite(n)) next[f.key] = "Enter a valid number";
        else if (f.min !== undefined && n < f.min) next[f.key] = `Must be at least ${f.min}`;
        else if (f.max !== undefined && n > f.max) next[f.key] = `Must be at most ${f.max}`;
      }
      if (!empty && f.type === "date" && Number.isNaN(new Date(String(raw)).getTime())) {
        next[f.key] = "Enter a valid date";
      }
      if (!empty && f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(raw))) {
        next[f.key] = "Enter a valid email";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: FormValues = {};
      for (const f of fields) {
        if (f.visibleWhen && !f.visibleWhen(values)) continue;
        const raw = values[f.key];
        if (f.type === "number" || f.type === "currency") {
          payload[f.key] = raw === "" ? 0 : Number(raw);
        } else if (f.type === "checkbox") {
          payload[f.key] = Boolean(raw);
        } else {
          payload[f.key] = raw;
        }
      }
      await onSubmit(payload);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const visible = fields.filter((f) => !f.visibleWhen || f.visibleWhen(values));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {visible.map((f) => {
              const id = `field-${f.key}`;
              const common = {
                id,
                value: values[f.key] === undefined || values[f.key] === null ? "" : String(values[f.key]),
                onChange: (
                  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
                ) => set(f.key, e.target.value),
                placeholder: f.placeholder,
                "aria-invalid": Boolean(errors[f.key]),
                "aria-describedby": errors[f.key] ? `${id}-error` : undefined,
              };
              return (
                <Field
                  key={f.key}
                  label={f.label}
                  required={f.required}
                  error={errors[f.key]}
                  hint={f.help}
                  htmlFor={id}
                  className={cn(f.span === 2 && "sm:col-span-2")}
                >
                  {f.type === "textarea" ? (
                    <Textarea {...common} />
                  ) : f.type === "select" ? (
                    <Select {...common}>
                      <option value="">Select…</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : f.type === "checkbox" ? (
                    <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-fg">
                      <Checkbox
                        checked={Boolean(values[f.key])}
                        onCheckedChange={(v) => set(f.key, Boolean(v))}
                        id={id}
                      />
                      <span className="text-fg-muted">{f.placeholder ?? "Yes"}</span>
                    </label>
                  ) : (
                    <Input
                      {...common}
                      type={f.type === "currency" || f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "email" ? "email" : "text"}
                      inputMode={f.type === "currency" || f.type === "number" ? "decimal" : undefined}
                      step={f.step ?? (f.type === "currency" ? "0.01" : undefined)}
                      min={f.min}
                      max={f.max}
                    />
                  )}
                </Field>
              );
            })}
          </div>

          {footer}

          <div className="mt-1 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={saving} icon="save">
              {saving ? "Saving…" : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Reusable "add record" button with animated plus icon. */
export function AddButton({
  label = "Add",
  onClick,
  size = "sm",
}: {
  label?: string;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  return (
    <Button variant="primary" size={size} onClick={onClick} icon="plus">
      {label}
    </Button>
  );
}

export { AnimatedIcon };
