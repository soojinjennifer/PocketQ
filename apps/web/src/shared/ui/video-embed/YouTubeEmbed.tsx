import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "../../lib/dom/usePrefersReducedMotion";
import { useViewportPlayback } from "./useViewportPlayback";
import { useYouTubePlaybackGroup } from "./youTubePlaybackGroupContext";
import {
  YOUTUBE_PLAYER_STATE,
  parsePlayerMessage,
  postListening,
  postPlayerCommand,
  type YouTubePlayerCommand,
} from "./youTubePlayerMessages";
import { buildYouTubeEmbedSrc } from "./youTubeUrls";

interface YouTubeEmbedProps {
  /** YouTube 영상 id(예: `vSsyDRtZmKw`). */
  videoId: string;
  /** 영상 제목. 재생 버튼 라벨(`"{title} 영상 재생"`)과 iframe 제목에 쓴다. */
  title: string;
  /** facade 배경 썸네일 URL. 생략하면 컨테이너 배경(className)만 보인다. */
  thumbnailSrc?: string;
  /**
   * `thumbnailSrc`를 못 불러오거나 120px 자리표시 이미지(YouTube maxres가 없는 영상)가 오면 대신 쓰는 썸네일.
   * 이것마저 실패하면 이미지를 지워 컨테이너 배경이 보이게 한다.
   */
  thumbnailFallbackSrc?: string;
  /** 썸네일 위에 얹는 시각 요소(재생 아이콘, 캡션, 오버레이 등). 버튼 안에 들어가므로 상호작용 요소를 넣지 않는다. */
  children?: ReactNode;
  /** 16:9 컨테이너의 배경·모서리 등 스킨. 레이아웃(비율, 폭)은 컴포넌트가 정한다. */
  className?: string;
  /**
   * facade 포커스 표시 클래스. 버튼의 마지막 자식인 장식 span(썸네일 위)에 붙으므로 `group-focus-visible:` 접두사로 쓴다
   * — 버튼 자체에 그린 ring/outline은 absolute 썸네일 아래에 깔려 보이지 않는다(LANDING_DESIGN §14.0).
   * 컨테이너가 `overflow-hidden`이라 바깥 offset 링은 잘리므로 inset 링을 쓴다.
   * @default "group-focus-visible:ring-4 group-focus-visible:ring-inset group-focus-visible:ring-brand"
   */
  focusRingClassName?: string;
  /**
   * true면 영상이 화면 가운데에 오면 음소거로 자동 재생하고, 화면 밖으로 나가면 일시정지한다(D2-1). 동작 줄이기·데이터
   * 절약 모드·IntersectionObserver 미지원 환경에서는 자동 재생하지 않는다. 자동 재생은 포커스를 옮기지 않는다.
   * @default false — 누를 때만 재생(기존 facade 동작)
   */
  autoplayOnView?: boolean;
}

const DEFAULT_FOCUS_RING =
  "group-focus-visible:ring-4 group-focus-visible:ring-inset group-focus-visible:ring-brand";

/**
 * 우리가 보낸 pauseVideo의 "일시정지" 알림을 기다리는 시간. 버퍼링 중이던 플레이어 등은 알림을 보내지 않으므로
 * 이 시간이 지나면 기다림을 접는다 — 남아 있으면 다음 진짜 사용자 일시정지를 놓친다(QA L-R2-4).
 */
const EXPECTED_PAUSE_WINDOW_MS = 2000;

/** YouTube가 maxres 썸네일이 없을 때 돌려주는 자리표시 이미지의 폭(120×90). */
const PLACEHOLDER_THUMBNAIL_WIDTH = 120;

type EmbedMode =
  | { kind: "facade" }
  | {
      kind: "embedded";
      /** 자동 재생은 음소거로만 시작할 수 있다. */
      muted: boolean;
      /** 사용자가 눌러서 만든 iframe만 포커스를 받는다. */
      focusOnMount: boolean;
    };

function isSaveDataEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  const { connection } = navigator as Navigator & { connection?: { saveData?: boolean } };
  return connection?.saveData === true;
}

/**
 * YouTube lite embed(facade). 처음에는 썸네일과 재생 표시만 그린 버튼이고, 누르면 같은 자리를
 * `youtube-nocookie.com` iframe(autoplay)으로 바꾼 뒤 iframe으로 포커스를 옮긴다. 16:9 비율을 유지한다.
 * `autoplayOnView`면 스크롤 위치에 따라 음소거 자동 재생·일시정지하고, `YouTubePlaybackGroup` 안에서는 한 번에
 * 하나만 재생한다.
 */
export function YouTubeEmbed({
  videoId,
  title,
  thumbnailSrc,
  thumbnailFallbackSrc,
  children,
  className,
  focusRingClassName = DEFAULT_FOCUS_RING,
  autoplayOnView = false,
}: YouTubeEmbedProps) {
  const playerId = useId();
  const group = useYouTubePlaybackGroup();
  const prefersReducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mode, setMode] = useState<EmbedMode>({ kind: "facade" });
  const isEmbedded = mode.kind === "embedded";

  /**
   * 플레이어가 명령을 받을 준비가 됐는지. onReady나 상태 알림(플레이어가 말을 걸어 옴)으로만 판단한다 — iframe load는
   * 준비 신호가 아니다(그 시점의 pauseVideo는 무시될 수 있다, QA L-R2-5). 준비 전 명령은 마지막 하나만 보관했다가
   * 준비되면 보낸다.
   */
  const playerReadyRef = useRef(false);
  const iframeLoadedRef = useRef(false);
  const pendingCommandRef = useRef<YouTubePlayerCommand | null>(null);
  /** 사용자가 직접 멈췄다 — 다시 화면에 들어와도 자동으로 이어 재생하지 않는다(D2-2). */
  const userPausedRef = useRef(false);
  /** 우리가 보낸 pauseVideo의 결과로 올 "일시정지" 상태를 사용자 일시정지로 착각하지 않게 한다. */
  const expectingPauseRef = useRef(false);
  const expectingPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 마지막으로 받은 플레이어 상태. 이미 멈춘 플레이어에 보낸 pauseVideo는 상태 알림이 오지 않는다. */
  const lastPlayerStateRef = useRef<number | null>(null);

  const { shouldPlay, shouldPause } = useViewportPlayback(containerRef, autoplayOnView);
  const canAutoplay = autoplayOnView && !prefersReducedMotion && !isSaveDataEnabled();

  const [thumbnailFailure, setThumbnailFailure] = useState({ src: thumbnailSrc, count: 0 });
  const thumbnailFailures = thumbnailFailure.src === thumbnailSrc ? thumbnailFailure.count : 0;
  const thumbnailCandidates = [thumbnailSrc, thumbnailFallbackSrc].filter(
    (src): src is string => typeof src === "string" && src.length > 0,
  );
  const activeThumbnail = thumbnailCandidates[thumbnailFailures];
  const skipThumbnail = () =>
    setThumbnailFailure({ src: thumbnailSrc, count: thumbnailFailures + 1 });

  const sendCommand = (command: YouTubePlayerCommand) => {
    const iframe = iframeRef.current;
    if (iframe && playerReadyRef.current) {
      postPlayerCommand(iframe, command);
      return;
    }
    pendingCommandRef.current = command;
    // onReady가 끝내 오지 않는 환경 대비: 재생 명령만 load 이후 미리 보낸다(준비되면 한 번 더 보낸다).
    if (iframe && iframeLoadedRef.current && command === "playVideo") {
      postPlayerCommand(iframe, command);
    }
  };

  const markPlayerReady = () => {
    if (playerReadyRef.current) return;
    playerReadyRef.current = true;
    const iframe = iframeRef.current;
    const command = pendingCommandRef.current;
    pendingCommandRef.current = null;
    if (iframe && command) postPlayerCommand(iframe, command);
  };

  const clearExpectingPause = () => {
    expectingPauseRef.current = false;
    if (expectingPauseTimerRef.current !== null) {
      clearTimeout(expectingPauseTimerRef.current);
      expectingPauseTimerRef.current = null;
    }
  };

  const pauseForUs = () => {
    clearExpectingPause();
    if (lastPlayerStateRef.current !== YOUTUBE_PLAYER_STATE.paused) {
      expectingPauseRef.current = true;
      expectingPauseTimerRef.current = setTimeout(clearExpectingPause, EXPECTED_PAUSE_WINDOW_MS);
    }
    sendCommand("pauseVideo");
  };

  // 재생 구역에 들어온 순간 facade를 음소거 iframe으로 바꾼다. effect 안 setState(연쇄 렌더) 대신 렌더 중에 이전 신호와
  // 비교해 바로 조정한다(React "props 변화에 맞춰 state 조정" 패턴). 포커스는 옮기지 않는다.
  const [seenShouldPlay, setSeenShouldPlay] = useState(shouldPlay);
  if (seenShouldPlay !== shouldPlay) {
    setSeenShouldPlay(shouldPlay);
    if (shouldPlay && canAutoplay && mode.kind === "facade") {
      setMode({ kind: "embedded", muted: true, focusOnMount: false });
    }
  }

  const onEnterPlayZone = useEffectEvent(() => {
    if (!canAutoplay || mode.kind !== "embedded") return;
    if (userPausedRef.current) return;
    // 방금 만든 iframe(아직 준비 전, 보류 명령 없음)은 autoplay=1이 재생하므로 playVideo를 보내지 않는다.
    // 준비 전이라도 보류 중인 pauseVideo가 있으면 playVideo로 바꿔 둔다.
    const isFreshAutoplay = !playerReadyRef.current && pendingCommandRef.current === null;
    if (!isFreshAutoplay) sendCommand("playVideo");
    group.claim(playerId);
  });

  const onLeaveView = useEffectEvent(() => {
    if (mode.kind === "embedded") pauseForUs();
  });

  const onGroupPause = useEffectEvent(() => {
    if (mode.kind === "embedded") pauseForUs();
  });

  const onPlayerMessage = useEffectEvent((event: MessageEvent) => {
    const message = parsePlayerMessage(event, iframeRef.current);
    if (!message) return;
    // 상태 알림이 온다는 것은 플레이어가 이미 명령을 듣고 있다는 뜻이다.
    markPlayerReady();
    if (message.kind === "ready") return;
    lastPlayerStateRef.current = message.state;
    if (message.state === YOUTUBE_PLAYER_STATE.playing) {
      userPausedRef.current = false;
      clearExpectingPause();
      group.claim(playerId);
    } else if (message.state === YOUTUBE_PLAYER_STATE.paused) {
      if (expectingPauseRef.current) {
        clearExpectingPause();
      } else if (!shouldPause) {
        userPausedRef.current = true;
      }
    }
  });

  useEffect(() => {
    if (shouldPlay) onEnterPlayZone();
  }, [shouldPlay]);

  useEffect(() => {
    if (shouldPause) onLeaveView();
  }, [shouldPause]);

  useEffect(() => {
    group.register(playerId, () => onGroupPause());
    return () => group.unregister(playerId);
  }, [group, playerId]);

  useEffect(
    () => () => {
      if (expectingPauseTimerRef.current !== null) clearTimeout(expectingPauseTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!isEmbedded) return undefined;
    const handleMessage = (event: MessageEvent) => onPlayerMessage(event);
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isEmbedded]);

  useEffect(() => {
    if (mode.kind === "embedded" && mode.focusOnMount) {
      iframeRef.current?.focus();
    }
  }, [mode]);

  const handleFacadeClick = () => {
    setMode({ kind: "embedded", muted: false, focusOnMount: true });
    group.claim(playerId);
  };

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframeLoadedRef.current = true;
    postListening(iframe, playerId);
    // load는 준비 신호가 아니다. 보류 중인 재생 명령만 미리 보내고, 보류 명령은 준비될 때까지 그대로 둔다.
    if (pendingCommandRef.current === "playVideo") postPlayerCommand(iframe, "playVideo");
  };

  const containerClassName =
    `relative aspect-video w-full overflow-hidden ${className ?? ""}`.trim();

  return (
    <div ref={containerRef} className={containerClassName}>
      {mode.kind === "embedded" ? (
        <iframe
          ref={iframeRef}
          className="absolute inset-0 h-full w-full border-0"
          src={buildYouTubeEmbedSrc(videoId, { muted: mode.muted, origin: window.location.origin })}
          title={`${title} 영상 (YouTube)`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          onLoad={handleIframeLoad}
        />
      ) : (
        <button
          type="button"
          aria-label={`${title} 영상 재생`}
          onClick={handleFacadeClick}
          className="group absolute inset-0 h-full w-full cursor-pointer rounded-[inherit] outline-none"
        >
          {activeThumbnail ? (
            <img
              key={activeThumbnail}
              src={activeThumbnail}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
              onError={skipThumbnail}
              onLoad={(event) => {
                const { naturalWidth } = event.currentTarget;
                if (naturalWidth > 0 && naturalWidth <= PLACEHOLDER_THUMBNAIL_WIDTH)
                  skipThumbnail();
              }}
            />
          ) : null}
          {children}
          <span
            aria-hidden="true"
            data-focus-ring=""
            className={`pointer-events-none absolute inset-0 rounded-[inherit] ${focusRingClassName}`}
          />
        </button>
      )}
    </div>
  );
}
