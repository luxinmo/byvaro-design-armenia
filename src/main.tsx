import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { seedCompanyEventsIfEmpty } from "./lib/companyEventsSeeds";
import { seedInvitacionesIfEmpty } from "./lib/invitacionesSeeds";

/* Pre-rellenamos el historial cross-empresa + invitaciones pendientes
 * con datos de ejemplo en la primera carga. Idempotentes: solo
 * escriben si el storage está vacío. */
seedCompanyEventsIfEmpty();
seedInvitacionesIfEmpty();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
