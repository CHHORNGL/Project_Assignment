import React from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import DiagnosisWizardPage from "./diagnosis/DiagnosisWizardPage";

function readBootstrap() {
  const node = document.getElementById("diagnosis-wizard-data");
  if (!node) {
    return null;
  }

  try {
    return JSON.parse(node.textContent || "{}");
  } catch (error) {
    return null;
  }
}

const rootNode = document.getElementById("diagnosis-wizard-root");
const bootstrap = readBootstrap();

if (rootNode && bootstrap) {
  createRoot(rootNode).render(
    <React.StrictMode>
      <DiagnosisWizardPage bootstrap={bootstrap} />
    </React.StrictMode>,
  );
}
