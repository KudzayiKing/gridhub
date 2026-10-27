"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

/*
 * The shell carries the font-size; every dimension inside the button is `em`, so these three
 * numbers are the only sizing decisions in the component. `md` lands at roughly 40px tall,
 * which is the minimum comfortable touch target.
 */
const SIZES: Record<Size, string> = {
  sm: "text-[12.5px]",
  md: "text-[13.5px]",
  lg: "text-[15px]",
};

const ICON_SIZE: Record<Size, number> = { sm: 13, md: 15, lg: 17 };

export interface LiquidButtonProps {
  children: React.ReactNode;
  /** Renders a next/link instead of a button. */
  href?: string;
  icon?: string;
  size?: Size;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
}

/**
 * Liquid-glass pill: a glass surface with a conic rim that sweeps on hover, a specular
 * highlight that travels across the face, and a soft shadow that tightens as it is pressed.
 *
 * Three nested elements are required, not stylistic — the shadow layer has to sit behind the
 * interactive element, and the label needs its own element to host the highlight pseudo.
 */
export function LiquidButton({
  children,
  href,
  icon,
  size = "md",
  className,
  disabled = false,
  type = "button",
  onClick,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
}: LiquidButtonProps) {
  const content = (
    <span className="liquid-btn__label">
      {icon ? (
        <AnimatedIcon name={icon} size={ICON_SIZE[size]} trigger="hover" className="shrink-0" />
      ) : null}
      {children}
    </span>
  );

  return (
    <span
      className={cn("liquid-btn", SIZES[size], className)}
      data-disabled={disabled || undefined}
    >
      <span className="liquid-btn__shadow" aria-hidden="true" />
      {href ? (
        <Link
          href={href}
          className="liquid-btn__core"
          aria-disabled={disabled || undefined}
          aria-expanded={ariaExpanded}
          aria-controls={ariaControls}
          tabIndex={disabled ? -1 : undefined}
          onClick={disabled ? undefined : onClick}
        >
          {content}
        </Link>
      ) : (
        <button
          type={type}
          className="liquid-btn__core"
          disabled={disabled}
          aria-expanded={ariaExpanded}
          aria-controls={ariaControls}
          onClick={onClick}
        >
          {content}
        </button>
      )}
    </span>
  );
}
