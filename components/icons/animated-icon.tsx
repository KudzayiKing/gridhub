"use client";

import * as React from "react";
import { cn, isReducedMotion } from "@/lib/utils";
import { resolveAnimatedIcon } from "./icon-registry";

export type AnimatedIconTrigger = "hover" | "click" | "both" | "none" | "mount";

export interface AnimatedIconProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color"> {
  /** Logical icon key from the registry (e.g. "wallet", "plus"). */
  name: string;
  size?: number;
  /** Animation duration in seconds, matching the AnimateIcons API. */
  duration?: number;
  color?: string;
  /**
   * Accepted for API stability with older call sites but intentionally not
   * forwarded: AnimateIcons components render their own stroke geometry and
   * do not expose a `strokeWidth` prop.
   */
  strokeWidth?: number;
  trigger?: AnimatedIconTrigger;
  /** Accessible label. When omitted the icon is decorative (aria-hidden). */
  label?: string;
  /** Animation is suppressed when the control is disabled. */
  disabled?: boolean;
}

interface AnimationHandle {
  startAnimation?: () => void;
  stopAnimation?: () => void;
}

/**
 * The single abstraction every interactive icon in Gridhub goes through.
 *
 * - Renders an official `@animateicons/react/lucide` component.
 * - Triggers animation through the documented imperative ref API, so behaviour is
 *   identical for mouse, keyboard and touch (no reliance on hover alone).
 * - Never intercepts pointer events: the surrounding button/link keeps working.
 * - Respects `prefers-reduced-motion` and the in-app reduced-motion preference.
 */
export const AnimatedIcon = React.forwardRef<HTMLSpanElement, AnimatedIconProps>(
  function AnimatedIcon(
    {
      name,
      size = 20,
      duration = 1,
      color = "currentColor",
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      strokeWidth: _strokeWidth,
      trigger = "both",
      label,
      disabled,
      className,
      onPointerDown,
      onClick,
      onMouseEnter,
      onMouseLeave,
      onFocus,
      ...rest
    },
    forwardedRef,
  ) {
    const iconRef = React.useRef<AnimationHandle | null>(null);
    const Icon = React.useMemo(() => resolveAnimatedIcon(name), [name]);

    const play = React.useCallback(() => {
      if (disabled) return;
      if (isReducedMotion()) return;
      try {
        iconRef.current?.startAnimation?.();
      } catch {
        /* animation must never break the control */
      }
    }, [disabled]);

    // `mount` fires once when the icon appears; the ref is attached during commit,
    // so this has to run in an effect rather than during render.
    React.useEffect(() => {
      if (trigger !== "mount") return;
      play();
    }, [trigger, play, Icon]);

    const handlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
      if (trigger === "click" || trigger === "both") play();
      onPointerDown?.(e);
    };

    const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
      if (trigger === "click" || trigger === "both") play();
      onClick?.(e);
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
      if (trigger === "hover" || trigger === "both") play();
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLSpanElement>) => {
      if (trigger === "hover" || trigger === "both") {
        try {
          iconRef.current?.stopAnimation?.();
        } catch {
          /* stopping an animation must never break the surrounding control */
        }
      }
      onMouseLeave?.(e);
    };

    // Keyboard parity: focusing a control animates exactly like hovering it.
    const handleFocus = (e: React.FocusEvent<HTMLSpanElement>) => {
      if (trigger === "hover" || trigger === "both" || trigger === "click") play();
      onFocus?.(e);
    };

    if (!Icon) {
      return (
        <span
          ref={forwardedRef}
          className={cn("inline-block shrink-0", className)}
          style={{ width: size, height: size }}
          aria-hidden="true"
          {...rest}
        />
      );
    }

    return (
      <span
        ref={forwardedRef}
        className={cn("inline-flex shrink-0 items-center justify-center", className)}
        data-icon={name}
        aria-hidden={label ? undefined : true}
        role={label ? "img" : undefined}
        aria-label={label}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        {...rest}
      >
        {React.createElement(Icon, {
          ref: iconRef,
          size,
          duration,
          color,
        })}
      </span>
    );
  },
);

/** Convenience wrapper: an animated icon with a text label, used in nav and buttons. */
export function IconLabel({
  name,
  children,
  size = 18,
  className,
  iconClassName,
  trigger = "hover",
}: {
  name: string;
  children: React.ReactNode;
  size?: number;
  className?: string;
  iconClassName?: string;
  trigger?: AnimatedIconTrigger;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <AnimatedIcon name={name} size={size} trigger={trigger} className={iconClassName} />
      <span>{children}</span>
    </span>
  );
}
