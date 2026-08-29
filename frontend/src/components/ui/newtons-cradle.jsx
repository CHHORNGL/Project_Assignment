import React from "react";
import { cn } from "@/lib/utils";

/**
 * Newton's Cradle Physics-based Collision Pendulum Loading Spinner
 *
 * @param {Object} props
 * @param {string} [props.size="50px"] - Size of the square container (e.g., "50px", "60px")
 * @param {string} [props.speed="1.2s"] - Full cycle duration (e.g., "1.2s")
 * @param {string} [props.color="#474554"] - Color of the sphere dots
 * @param {string} [props.className] - Optional extra Tailwind / CSS classes
 */
export default function NewtonsCradle({
  size = "50px",
  speed = "1.2s",
  color = "#474554",
  className = "",
}) {
  return (
    <div
      className={cn("newtons-cradle", className)}
      style={{
        "--uib-size": size,
        "--uib-speed": speed,
        "--uib-color": color,
      }}
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
