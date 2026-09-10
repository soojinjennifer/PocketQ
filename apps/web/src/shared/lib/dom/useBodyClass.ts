import { useEffect } from "react";

/**
 * 마운트 중에만 `document.body`에 CSS 클래스를 추가하고, 언마운트 시 제거하는 작은 훅.
 * `shared/lib`이라 다른 계층(`app`/`pages`/`features`)을 import하지 않는다(frontend.md §1 준수).
 *
 * `/solve/pencilcanvas`, `/solve/landscape`가 `solve-viewport-lock`
 * (`shared/styles/textures.css`)을 body에 적용해 iOS 키보드/받아쓰기 툴바로 인한 body 스크롤을
 * 막는 데 쓴다.
 */
export function useBodyClass(className: string): void {
  useEffect(() => {
    document.body.classList.add(className);
    return () => {
      document.body.classList.remove(className);
    };
  }, [className]);
}
