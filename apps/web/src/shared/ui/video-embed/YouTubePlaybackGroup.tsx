import { useMemo, useRef, type ReactNode } from "react";
import {
  YouTubePlaybackGroupContext,
  type YouTubePlaybackGroupApi,
} from "./youTubePlaybackGroupContext";

/**
 * 안에 있는 `YouTubeEmbed`들 중 한 번에 하나만 재생되게 한다. 한 영상이 재생을 시작하면(claim) 나머지를 멈춘다.
 */
export function YouTubePlaybackGroup({ children }: { children: ReactNode }) {
  const membersRef = useRef(new Map<string, () => void>());

  const api = useMemo<YouTubePlaybackGroupApi>(
    () => ({
      register: (id, pause) => {
        membersRef.current.set(id, pause);
      },
      unregister: (id) => {
        membersRef.current.delete(id);
      },
      claim: (id) => {
        membersRef.current.forEach((pause, memberId) => {
          if (memberId !== id) pause();
        });
      },
    }),
    [],
  );

  return <YouTubePlaybackGroupContext value={api}>{children}</YouTubePlaybackGroupContext>;
}
