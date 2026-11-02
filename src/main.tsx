import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { env } from "@/config/env";
import "./index.css";

document.title = env.appName;

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemen #root tidak ditemukan di index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
