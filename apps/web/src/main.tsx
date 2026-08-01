import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./shared/styles/tokens.css";
import "./shared/styles/theme.css";
import "./shared/styles/global.css";
import "./shared/styles/safe-area.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element(#root)를 찾을 수 없습니다.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
