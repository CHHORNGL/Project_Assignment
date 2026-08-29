import React from "react";
import { cn } from "@/lib/utils";

/**
 * Custom Neumorphic (Soft UI) Toggle Switch Component
 *
 * @param {Object} props
 * @param {boolean} [props.checked] - Controlled checked state
 * @param {boolean} [props.defaultChecked] - Uncontrolled initial state
 * @param {function} [props.onChange] - Event callback on state change
 * @param {string} [props.id] - Optional HTML id
 * @param {string} [props.name="check"] - Form field name
 * @param {string} [props.label] - Optional text label beside the switch
 * @param {boolean} [props.disabled] - Disabled state
 * @param {string} [props.className] - Additional wrapper styling classes
 */
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
}) {
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
