import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const VerticalCutReveal = forwardRef(
  (
    {
      children,
      reverse = false,
      splitBy = "words",
      containerClassName,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={cn("inline-block", containerClassName)}
        {...props}
      >
        {children}
      </span>
    );
  }
);

VerticalCutReveal.displayName = "VerticalCutReveal";
