import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ChronoDeck from "../app/ChronoDeck";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChronoDeck />
  </StrictMode>,
);
