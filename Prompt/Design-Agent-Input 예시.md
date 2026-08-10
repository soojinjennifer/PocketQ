이전에 네가 검수해서 발견한 3가지 문제(SolveLandscapePage 배경 텍스처 불일치, 결과 패널 접근성 부족, 도트 텍스처 모양 미세 불일치)를 development-agent가 수정했다. 코드는 수정하지 말고 최종 재검수만 해달라.

## 수정 내역
1. `apps/web/src/pages/solve/landscape/SolveLandscapePage.tsx` 루트 className: `bg-canvas-texture` → `bg-bg-canvas`로 교체(Figma node 38:21 실측 `#fbfaf6` flat 배경에 맞춤). `SolvePencilcanvasPage.tsx`는 손대지 않음(원래도 정답이었음).
2. 같은 파일의 결과 패널 컨테이너에 `aria-live="polite"`, 에러 메시지 `<p>`에 `role="alert"` 추가.
3. `apps/web/src/shared/styles/textures.css`의 `.bg-canvas-texture`: 부드러운 `radial-gradient` 원형 점 → 2×2px 경성 사각형(inline base64 SVG, `shape-rendering="crispEdges"`) + `image-rendering: pixelated`로 교체(Figma 실측 도트 모양에 맞춤).

## 재검수 요청
1. Figma MCP로 `3-1 · Solve/Pencilcanvas`(node 127:445), `3-2 · Solve/Landscape`(node 38:21) 스크린샷을 다시 실측해서, 이번엔 코드와 정확히 일치하는지 픽셀 단위로 재확인해라(이전에 썼던 것과 같은 방법: 배경색 RGB 샘플링 + 도트 존재 여부).
2. 실제 파일을 열어서 위 3가지 수정이 정확히 반영됐는지 확인해라.
3. 새로운 문제를 만들지는 않았는지도 함께 봐라(예: Pencilcanvas가 실수로 같이 바뀌었는지, 다른 화면에 영향은 없는지).

## 보고
일치/불일치 결론과, 아직 남은 문제가 있다면 그것만 간결하게 보고해라. 다 통과했으면 "전부 통과"라고 명확히 말해라.