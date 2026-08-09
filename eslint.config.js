import tseslint from "typescript-eslint";

/**
 * 워크스페이스 루트 ESLint 설정 — `apps/api`, `packages/*` 대상.
 * `apps/web`은 React 전용 규칙이 추가로 필요해 자체 `eslint.config.js`를 그대로 유지한다
 * (ESLint flat config는 실행 디렉터리에서 가장 가까운 config 파일을 우선 사용하므로,
 * `apps/web` 안에서 `eslint .`를 실행하면 이 루트 설정과 충돌 없이 자체 설정만 적용된다).
 */
export default tseslint.config(
  { ignores: ["**/dist", "**/node_modules"] },
  {
    extends: [...tseslint.configs.recommendedTypeChecked],
    files: ["apps/api/src/**/*.ts", "packages/*/src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // vi.mocked(...)로 감싼 mock 메서드 참조를 unbound-method로 오탐하는 것을 막는다
    // (테스트 코드에서만 완화, 프로덕션 코드에는 적용하지 않음). apps/web과 동일 패턴.
    // no-unsafe-assignment/no-unsafe-member-access는 supertest의 `res.body`가
    // 타입상 `any`라 테스트 단언에서만 반복 발생하므로 같은 원칙으로 완화한다
    // (프로덕션 코드의 any 금지 원칙과는 무관, 테스트 코드에만 적용).
    files: ["apps/api/src/**/*.test.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
);
