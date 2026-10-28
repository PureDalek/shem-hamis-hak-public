import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import { cloudConfigured } from "./cloud-config";

async function start() {
  if (cloudConfigured) {
    const { loadPublishedContent } = await import("./cloud");
    await loadPublishedContent();
  }
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
void start();
