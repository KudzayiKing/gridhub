"use client";

import * as React from "react";
import { LazyMotion, domMin, m, useAnimation, useReducedMotion } from "motion/react";

function PanelIcon({ open, size = 20 }: { open: boolean; size?: number }) {
  const controls = useAnimation();
  const reducedMotion = useReducedMotion();
  const variants = open
    ? {
        normal: { x: 0 },
        animate: { x: [0, 2.5, 0, 2.5, 0], transition: { duration: 0.8, ease: "easeInOut" as const } },
      }
    : {
        normal: { x: 0 },
        animate: { x: [0, -2.5, 0, -2.5, 0], transition: { duration: 0.8, ease: "easeInOut" as const } },
      };

  const animate = () => {
    if (!reducedMotion) void controls.start("animate");
  };

  return (
    <LazyMotion features={domMin} strict>
      <m.svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={controls}
        initial="normal"
        onMouseEnter={animate}
        onFocus={animate}
        aria-hidden="true"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <m.path d={open ? "M9 3v18" : "M15 3v18"} variants={{ normal: { x: 0 }, animate: { x: [0, open ? 2 : -2, 0] } }} />
        <m.path d={open ? "m14 9 3 3-3 3" : "m10 15-3-3 3-3"} variants={variants} />
      </m.svg>
    </LazyMotion>
  );
}

export function PanelRightOpenIcon({ size = 20 }: { size?: number }) {
  return <PanelIcon open={false} size={size} />;
}

export function PanelLeftOpenIcon({ size = 20 }: { size?: number }) {
  return <PanelIcon open size={size} />;
}
