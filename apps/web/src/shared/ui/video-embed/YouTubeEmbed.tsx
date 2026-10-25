import { useEffect, useRef, useState, type ReactNode } from "react";

interface YouTubeEmbedProps {
  /** YouTube 영상 id(예: `vSsyDRtZmKw`). */
  videoId: string;
  /** 영상 제목. 재생 버튼 라벨(`"{title} 영상 재생"`)과 iframe 제목에 쓴다. */
  title: string;
  /** facade 배경 썸네일 URL. 생략하면 컨테이너 배경(className)만 보인다. */
  thumbnailSrc?: string;
  /** 썸네일 위에 얹는 시각 요소(재생 아이콘, 캡션, 오버레이 등). 버튼 안에 들어가므로 상호작용 요소를 넣지 않는다. */
  children?: ReactNode;
  /** 16:9 컨테이너의 배경·모서리 등 스킨. 레이아웃(비율, 폭)은 컴포넌트가 정한다. */
  className?: string;
  /**
   * facade 버튼의 포커스 링 클래스. 어두운 패널 위처럼 기본 링(`ring-brand`)의 대비가 부족한 곳에서 바꾼다.
   * 컨테이너가 `overflow-hidden`이라 바깥 offset 링은 잘리므로 inset 링을 쓴다.
   * @default "focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand"
   */
  focusRingClassName?: string;
}

const NOCOOKIE_EMBED_ORIGIN = "https://www.youtube-nocookie.com/embed/";

/** 재생을 누른 뒤에 쓰는 iframe 주소. 사용자가 누르기 전에는 YouTube로 요청을 보내지 않는다(facade). */
function buildYouTubeEmbedSrc(videoId: string): string {
  return `${NOCOOKIE_EMBED_ORIGIN}${encodeURIComponent(videoId)}?autoplay=1&rel=0&playsinline=1`;
}

/** 컨테이너가 `overflow-hidden`이라 바깥 offset 링은 잘린다 — 안쪽(inset) 링으로 포커스를 보인다. */
const DEFAULT_FOCUS_RING = "focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand";

/**
 * YouTube lite embed(facade). 처음에는 썸네일과 재생 표시만 그린 버튼이고, 누르면 같은 자리를
 * `youtube-nocookie.com` iframe(autoplay)으로 바꾼 뒤 iframe으로 포커스를 옮긴다. 16:9 비율을 유지한다.
 */
export function YouTubeEmbed({
  videoId,
  title,
  thumbnailSrc,
  children,
  className,
  focusRingClassName = DEFAULT_FOCUS_RING,
}: YouTubeEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isPlaying) {
      iframeRef.current?.focus();
    }
  }, [isPlaying]);

  const containerClassName = `relative aspect-video w-full overflow-hidden ${className ?? ""}`.trim();

  return (
    <div className={containerClassName}>
      {isPlaying ? (
        <iframe
          ref={iframeRef}
          className="absolute inset-0 h-full w-full border-0"
          src={buildYouTubeEmbedSrc(videoId)}
          title={`${title} 영상 (YouTube)`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          aria-label={`${title} 영상 재생`}
          onClick={() => setIsPlaying(true)}
          className={`absolute inset-0 h-full w-full cursor-pointer outline-none ${focusRingClassName}`}
        >
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          {children}
        </button>
      )}
    </div>
  );
}
