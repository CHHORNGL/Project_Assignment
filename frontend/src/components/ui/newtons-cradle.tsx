import * as React from "react";
import { cn } from "@/lib/utils";

export interface NewtonsCradleProps {
  size?: string;
  speed?: string;
  color?: string;
  className?: string;
}

export default function NewtonsCradle({
  size = "50px",
  speed = "1.2s",
  color = "#474554",
  className = "",
}: NewtonsCradleProps) {
  const style = {
    "--uib-size": size,
    "--uib-speed": speed,
    "--uib-color": color,
  } as React.CSSProperties;

  return (
    <div
      className={cn("newtons-cradle", className)}
      style={style}
      role="status"
      aria-label="Loading"
    >
      <div className="newtons-cradle__dot" />
      <div className="newtons-cradle__dot" />
      <div className="newtons-cradle__dot" />
      <div className="newtons-cradle__dot" />
    </div>
  );
}
