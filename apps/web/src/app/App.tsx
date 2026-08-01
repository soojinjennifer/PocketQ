import { RouterProvider } from "react-router/dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import { ViewportGuard } from "../shared/ui/viewport-guard/ViewportGuard";
import { router } from "./router";

export function App() {
  return (
    <ViewportGuard>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ViewportGuard>
  );
}
