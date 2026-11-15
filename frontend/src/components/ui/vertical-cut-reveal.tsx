import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface VerticalCutRevealProps extends React.HTMLAttributes<HTMLSpanElement> {
  reverse?: boolean;
  splitBy?: string;
  containerClassName?: string;
}

export const VerticalCutReveal = forwardRef<HTMLSpanElement, VerticalCutRevealProps>(
  (
    {
      children,
      reverse: _reverse = false,
      splitBy: _splitBy = "words",
      containerClassName,
      ...props
    },
    ref,
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
  },
);

VerticalCutReveal.displayName = "VerticalCutReveal";
