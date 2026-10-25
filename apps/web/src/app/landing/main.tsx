import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LandingApp } from "./LandingApp";
import "../../shared/styles/tokens.css";
import "../../shared/styles/theme.css";
import "../../shared/styles/global.css";

/** 랜딩(`/home.html`) 진입점. 앱(`src/main.tsx`)과 번들을 나눠 라우터·앱 코드를 싣지 않는다. */
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element(#root)를 찾을 수 없습니다.");
}

createRoot(rootElement).render(
  <StrictMode>
    <LandingApp />
  </StrictMode>,
);
