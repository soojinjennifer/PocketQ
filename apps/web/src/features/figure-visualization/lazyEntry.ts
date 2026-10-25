/**
 * 도형 지연 청크의 단일 진입점(Stage 5). 실시간용 `SolutionFigures`와 재조회용 `SavedSolutionFigures`를 **한 동적 import**로 묶는다.
 * 진입점이 둘이면 번들러가 둘이 공유하는 검증 커널을 공통 청크로 빼면서 메인 번들이 정적으로 불러오는 청크에 합쳐 버린다
 * (on 빌드에서 확인, 장부 §8) — 커널을 지연 청크에만 두기 위해 진입점을 하나로 둔다.
 */
export { SolutionFigures } from "./SolutionFigures";
export { SavedSolutionFigures } from "./SavedSolutionFigures";
