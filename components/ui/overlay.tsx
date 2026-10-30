"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { Button } from "./button";
import { useI18n } from "@/lib/i18n";

/* -------------------------------- Dialog ------------------------------- */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  children,
  className,
  title,
  description,
  wide,
  id,
  hideHeader = false,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  description?: React.ReactNode;
  wide?: boolean;
  id?: string;
  hideHeader?: boolean;
}) {
  const { t } = useI18n();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(0,0,0,0.5)] backdrop-blur-[3px] data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        id={id}
        className={cn(
          "glass-strong fixed left-1/2 top-1/2 z-50 max-h-[92dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[24px] p-5 thin-scroll sm:p-6",
          wide ? "max-w-3xl" : "max-w-lg",
          className,
        )}
      >
        <div className={cn("mb-4 flex items-start justify-between gap-4", hideHeader && "sr-only")}>
          <div>
            <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-fg">
              {t(title)}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-[13px] text-fg-muted">
                {typeof description === "string" ? t(description) : description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("Close dialog")}>
              <AnimatedIcon name="close" size={16} trigger="click" />
            </Button>
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/* ----------------------------- Alert dialog ---------------------------- */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  destructive = true,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  const { t } = useI18n();
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(0,0,0,0.5)] backdrop-blur-[3px]" />
        <AlertDialogPrimitive.Content className="glass-strong fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[24px] p-5 sm:p-6">
          <AlertDialogPrimitive.Title className="text-base font-semibold text-fg">
            {t(title)}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
            {t(description)}
          </AlertDialogPrimitive.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary" size="sm">
                Cancel
              </Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button
                variant={destructive ? "danger" : "primary"}
                size="sm"
                onClick={onConfirm}
                icon={destructive ? "trash" : "check"}
              >
                {confirmLabel}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

/* ------------------------------- Sheet --------------------------------- */

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "bottom",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  side?: "bottom" | "right";
}) {
  const { t } = useI18n();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(0,0,0,0.5)] backdrop-blur-[3px]" />
        <DialogPrimitive.Content
          className={cn(
            "glass-strong fixed z-50 overflow-y-auto thin-scroll p-5",
            side === "bottom"
              ? "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[24px] safe-bottom sm:left-1/2 sm:right-auto sm:w-[560px] sm:-translate-x-1/2"
              : "inset-y-0 right-0 w-[min(420px,92vw)] rounded-l-[24px]",
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <DialogPrimitive.Title className="text-base font-semibold text-fg">{t(title)}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <AnimatedIcon name="close" size={16} trigger="click" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {description ? (
            <DialogPrimitive.Description className="mb-4 text-[13px] text-fg-muted">
              {t(description)}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ----------------------------- Dropdown -------------------------------- */

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownContent({
  children,
  align = "end",
  className,
}: {
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn(
          "glass-strong z-50 min-w-[180px] overflow-hidden rounded-2xl p-1.5 text-sm",
          className,
        )}
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}

export function DropdownItem({
  children,
  onSelect,
  icon,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <DropdownPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-[var(--bg-subtle)]",
        danger ? "text-[var(--negative)]" : "text-fg",
        disabled && "opacity-40",
      )}
    >
      {icon ? <AnimatedIcon name={icon} size={15} trigger="hover" /> : null}
      {typeof children === "string" ? t(children) : children}
    </DropdownPrimitive.Item>
  );
}

export function DropdownSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-[var(--border)]" />;
}

/* ------------------------------ Tooltip -------------------------------- */

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={300}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="glass-strong z-50 rounded-lg px-2 py-1 text-xs text-fg"
        >
          {t(content)}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
