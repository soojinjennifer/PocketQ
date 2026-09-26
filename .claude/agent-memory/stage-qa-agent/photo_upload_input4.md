---
name: photo-upload-input4
description: INPUT-4 사진 업로드 단계 QA(2026-09-26) 구조·판정 요점과 재확인 포인트
metadata:
  type: project
---

INPUT-4 사진 업로드: usePhotoUpload(세대 가드 + isProcessingRef, 숨은 sr-only input), preparePhotoForUpload(정규화 후 5MB), reencodeImageToJpeg(shared/lib/image, 디코더/캔버스 주입), SolvePencilcanvasPage의 파생 displayInputMode. 서버 계약상 upload는 항상 photo(normalizeProblemInput가 capturedImage 유무로 결정 — 업로드/촬영 구분 없음).

2026-09-26 QA 결과: gate 전부 green (api 44f/330t, web 82f/618t). 범위 밖(API/Provider/routes/camera) 무변경 확인. isProcessingRef 영구잠금 경로 없음(마지막 generation은 항상 해제) — 단 prepare/image.decode가 영원히 pending이면 잠김(타임아웃 없음, LOW).

**Why:** 페이지 테스트는 preparePhotoForUpload를 모듈 모킹하고, 실제 createImageBitmap/canvas/HEIC/EXIF 경로는 jsdom에서 검증 불가 → 실기기 확인 필요로 남음. 업로드 사진→인식→확인팝업(PRD ⑥)은 업로드 전용 통합 테스트 없음(코드상 capturedImage 동일 경로).
**How to apply:** 재QA 시 위 gap이 실기기 또는 통합테스트로 메워졌는지 확인. 처리 중 "필기" 탭 탭 가능(overlay pointer-events-none) → 사진 도착 시 모드가 upload로 되돌아가는 미세 race(LOW) 재확인.
