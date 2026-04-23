import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { seedCompanyEventsIfEmpty } from "./lib/companyEventsSeeds";

/* Pre-rellenamos el historial cross-empresa con datos de ejemplo en
 * la primera carga. Idempotente: solo escribe si está vacío. */
seedCompanyEventsIfEmpty();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
