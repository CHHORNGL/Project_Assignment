import React from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import "./styles/mobile.css";
import DiagnosisWizardPage from "./diagnosis/DiagnosisWizardPage";
import { initInspectGuard, scrubBootstrapData } from "./utils/inspectGuard";
import { registerServiceWorker } from "./utils/pwa";

registerServiceWorker();

function readBootstrap(): Record<string, any> | null {
  const node = document.getElementById("diagnosis-wizard-data");
  if (!node) {
    return null;
  }

  try {
    return JSON.parse(node.textContent || "{}") as Record<string, any>;
  } catch {
    return null;
  }
}

const rootNode = document.getElementById("diagnosis-wizard-root");
const bootstrap = readBootstrap();
initInspectGuard();
if (bootstrap) {
  scrubBootstrapData(["diagnosis-wizard-data"]);
}

if (rootNode && bootstrap) {
  createRoot(rootNode).render(
    <React.StrictMode>
      <DiagnosisWizardPage bootstrap={bootstrap} />
    </React.StrictMode>,
  );
}
