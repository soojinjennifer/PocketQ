import type { RouteObject } from "react-router";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { PublicOnlyRoute } from "../features/auth/PublicOnlyRoute";
import { CameraPreviewGuard } from "../features/problem-input/CameraPreviewGuard";
import { RequireProblemInputGuard } from "../features/problem-input/RequireProblemInputGuard";
import { CameraCapturePage } from "../pages/camera/CameraCapturePage";
import { CameraPreviewPage } from "../pages/camera/preview/CameraPreviewPage";
import { GradeSetupPage } from "../pages/grade-setup/GradeSetupPage";
import { LoginPage } from "../pages/login/LoginPage";
import { MyPage } from "../pages/mypage/MyPage";
import { NotFoundPage } from "../pages/not-found/NotFoundPage";
import { RegisterPage } from "../pages/register/RegisterPage";
import { SolveLandscapePage } from "../pages/solve/landscape/SolveLandscapePage";
import { SolvePencilcanvasPage } from "../pages/solve/pencilcanvas/SolvePencilcanvasPage";
import { IndexRedirect } from "./IndexRedirect";
import { ProblemInputRoute } from "./ProblemInputRoute";

/**
 * 확정 라우트 트리(단일 소스). `router.tsx`(브라우저 실행)와 테스트(메모리 라우터)가
 * 동일한 이 배열을 공유해 라우트 정의가 중복되지 않게 한다.
 */
export const routeConfig: RouteObject[] = [
  {
    path: "/",
    element: <IndexRedirect />,
  },
  {
    path: "/login",
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: "/register",
    element: (
      <PublicOnlyRoute>
        <RegisterPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: "/grade-setup",
    element: (
      <ProtectedRoute>
        <GradeSetupPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/mypage",
    element: (
      <ProtectedRoute>
        <MyPage />
      </ProtectedRoute>
    ),
  },
  {
    // `/solve/pencilcanvas`, `/solve/landscape`, `/camera`, `/camera/preview` 4개 라우트가
    // `ProblemInputProvider`(사진 Blob/필기 획/제출 상태)를 공유하는 하나의 레이아웃 라우트.
    element: (
      <ProtectedRoute>
        <ProblemInputRoute />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "/solve/pencilcanvas",
        element: <SolvePencilcanvasPage />,
      },
      {
        path: "/solve/landscape",
        element: (
          <RequireProblemInputGuard>
            <SolveLandscapePage />
          </RequireProblemInputGuard>
        ),
      },
      {
        path: "/camera",
        element: <CameraCapturePage />,
      },
      {
        path: "/camera/preview",
        element: (
          <CameraPreviewGuard>
            <CameraPreviewPage />
          </CameraPreviewGuard>
        ),
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
];
