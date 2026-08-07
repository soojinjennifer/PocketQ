import type { RouteObject } from "react-router";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { PublicOnlyRoute } from "../features/auth/PublicOnlyRoute";
import { CameraPreviewGuard } from "../features/camera/CameraPreviewGuard";
import { CameraSessionProvider } from "../features/camera/CameraSessionProvider";
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
    path: "/solve/pencilcanvas",
    element: (
      <ProtectedRoute>
        <SolvePencilcanvasPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/solve/landscape",
    element: (
      <ProtectedRoute>
        <SolveLandscapePage />
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
    path: "/camera",
    element: <CameraSessionProvider />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <CameraCapturePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "preview",
        element: (
          <ProtectedRoute>
            <CameraPreviewGuard>
              <CameraPreviewPage />
            </CameraPreviewGuard>
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
];
