import { createContext } from "react";

export interface CameraSessionValue {
  /**
   * 촬영 데이터 보유 여부. 이번 단계는 실제 카메라 접근/촬영을 구현하지 않으므로
   * 항상 false("데이터 없음")로 유지되며, /camera/preview 가드 리다이렉트 검증에만 사용된다.
   */
  hasCaptureData: boolean;
}

export const CameraSessionContext = createContext<CameraSessionValue | undefined>(undefined);
