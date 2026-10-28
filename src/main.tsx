import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import { loadPublishedContent } from "./cloud";

async function start() {
  await loadPublishedContent();
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
void start();
