"use client";

import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { AnimatedIcon, type AnimatedIconTrigger } from "@/components/icons/animated-icon";

const buttonVariants = cva(
  "press inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_1px_2px_rgba(23,26,24,0.12)] hover:opacity-92",
        secondary:
          "border border-line-strong bg-[var(--surface-strong)] text-fg hover:bg-[var(--surface-hover)]",
        outline: "border border-line bg-transparent text-fg hover:bg-[var(--bg-subtle)]",
        ghost: "text-fg-muted hover:bg-[var(--bg-subtle)] hover:text-fg",
        subtle: "bg-[var(--accent-soft)] text-fg hover:opacity-90",
        danger: "bg-[var(--negative)] text-white hover:opacity-92",
        link: "text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  icon?: string;
  iconSize?: number;
  iconTrigger?: AnimatedIconTrigger;
  iconRight?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, icon, iconSize = 16, iconTrigger = "click", iconRight, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled}
      {...props}
    >
      {/*
        `Slottable` is required, not decorative. With `asChild`, Radix's Slot must merge
        its props onto exactly one child; when we also render leading/trailing icons there
        are three children, and Slot throws "Expected a single React element child or
        Slottable". Marking the real child lets Slot find it while the icons still render.
        Without `asChild` this is an inert wrapper.
      */}
      {icon ? <AnimatedIcon name={icon} size={iconSize} trigger={iconTrigger} disabled={disabled} /> : null}
      <Slottable>{children}</Slottable>
      {iconRight ? <AnimatedIcon name={iconRight} size={iconSize} trigger={iconTrigger} disabled={disabled} /> : null}
    </Comp>
  );
});

export { buttonVariants };
