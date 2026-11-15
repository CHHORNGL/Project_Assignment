import * as React from "react";
import { cn } from "@/lib/utils";

export interface NeumorphicToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export default function NeumorphicToggle({
  checked,
  defaultChecked,
  onChange,
  id,
  name = "check",
  label,
  disabled = false,
  className = "",
  ...props
}: NeumorphicToggleProps) {
  return (
    <label
      htmlFor={id}
      className={cn("label", disabled && "opacity-60 cursor-not-allowed", className)}
    >
      <div className="toggle">
        <input
          type="checkbox"
          id={id}
          name={name}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={onChange}
          disabled={disabled}
          className="toggle-state"
          {...props}
        />
        <div className="indicator" />
      </div>
      {label && <span className="label-text">{label}</span>}
    </label>
  );
}
