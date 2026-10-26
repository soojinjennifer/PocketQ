import { createContext, useContext } from "react";

export interface YouTubePlaybackGroupApi {
  /** 그룹이 이 영상을 멈춰야 할 때 부를 함수를 등록한다. */
  register: (id: string, pause: () => void) => void;
  unregister: (id: string) => void;
  /** 이 영상이 재생을 시작했다 — 같은 그룹의 다른 영상을 모두 멈춘다(한 번에 하나만 재생). */
  claim: (id: string) => void;
}

const NOOP_GROUP: YouTubePlaybackGroupApi = {
  register: () => {},
  unregister: () => {},
  claim: () => {},
};

export const YouTubePlaybackGroupContext = createContext<YouTubePlaybackGroupApi>(NOOP_GROUP);

/** Provider 밖에서는 아무 일도 하지 않는 그룹을 돌려준다. */
export function useYouTubePlaybackGroup(): YouTubePlaybackGroupApi {
  return useContext(YouTubePlaybackGroupContext);
}
