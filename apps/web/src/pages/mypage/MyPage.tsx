import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ResultPanel } from "../../features/ai-solution/ResultPanel";
import { getUserGrade } from "../../features/auth/getUserGrade";
import { getUserNickname } from "../../features/auth/getUserNickname";
import { useAuth } from "../../features/auth/useAuth";
import { useAuthActions } from "../../features/auth/useAuthActions";
import { ChatBubble } from "../../features/follow-up-chat/ChatBubble";
import { GRADE_OPTIONS } from "../../features/grade-setup/useGradeSetup";
import { HistoryDetailPanel } from "../../features/learning-history/HistoryDetailPanel";
import { HistoryEmptyState } from "../../features/learning-history/HistoryEmptyState";
import { HistoryRow } from "../../features/learning-history/HistoryRow";
import { ProfileHeaderCard } from "../../features/learning-history/ProfileHeaderCard";
import { useProblemHistoryDetail } from "../../features/learning-history/useProblemHistoryDetail";
import { useProblemHistoryList } from "../../features/learning-history/useProblemHistoryList";
import { Button } from "../../shared/ui/button/Button";
import { FilterPill } from "../../shared/ui/filter-pill/FilterPill";
import { LoadingMark } from "../../shared/ui/loading-mark/LoadingMark";
import { Logo } from "../../shared/ui/logo/Logo";
import { NavTabBar } from "../../shared/ui/nav-tab-bar/NavTabBar";

const NAV_TABS = [
  { id: "solve", label: "문제풀기" },
  { id: "mypage", label: "마이페이지" },
];

/** 필터 Pill의 "전체"(필터 해제) 항목. 실제 태그 이름과 겹치지 않도록 별도 sentinel 값을 쓴다. */
const ALL_TAGS = "__all__";

/**
 * `/mypage` — 프로필 헤더 + 개념 태그 필터 + 풀이 이력 목록(MYPAGE-1) + 과거 풀이 다시 보기
 * 오버레이(MYPAGE-2).
 *
 * 이 페이지는 조립만 한다(`.claude/rules/frontend.md` §1). 이력 조회 로직은
 * `features/learning-history`의 훅이, 인증 정보는 `features/auth`가, 결과 렌더링은
 * `features/ai-solution`/`features/follow-up-chat`가 담당하며 — feature 간 직접 참조가 금지돼
 * 있으므로 `HistoryDetailPanel`(learning-history)에 `ResultPanel`/`ChatBubble`을 `children`으로
 * 주입하는 조립은 이 페이지 레이어에서만 이루어진다(`SolveLandscapePage`가 `ResultPanelShell`에
 * children을 주입하는 것과 동일한 패턴).
 *
 * 과거 기록 조회는 `features/problem-input`(진행 중인 `/solve` 세션)과 완전히 분리돼 있다 —
 * `useProblemInput`을 호출하지 않으므로 기록을 열어봐도 현재 풀이 세션이 오염되지 않는다.
 *
 * Figma 없음 — 결정 필요:
 * - 상단 헤더는 Figma `4 · MyPage`의 로고/탭 배치를 따르되, `/solve`의 `SolveHeader`(absolute
 *   오버레이)와 달리 스크롤되는 목록 위에 놓이므로 일반 흐름 헤더로 구현했다.
 * - Body 컬럼 폭 760px은 Figma 실측값이며, 좁은 화면(Split View)에서는 `max-w-full`로 줄어든다.
 */
export function MyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { signOut } = useAuthActions();

  const { status: listStatus, items, errorMessage: listError, reload } = useProblemHistoryList();

  const [selectedTag, setSelectedTag] = useState<string>(ALL_TAGS);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);

  const {
    status: detailStatus,
    detail,
    errorMessage: detailError,
    reload: reloadDetail,
  } = useProblemHistoryDetail(selectedProblemId);

  // 필터 Pill 라벨은 Figma의 정적 예시가 아니라 실제 목록에 등장한 개념 태그에서 뽑는다.
  const tagOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) {
      for (const tag of item.conceptTags) {
        seen.add(tag);
      }
    }
    return [...seen];
  }, [items]);

  const visibleItems = useMemo(
    () =>
      selectedTag === ALL_TAGS
        ? items
        : items.filter((item) => item.conceptTags.includes(selectedTag)),
    [items, selectedTag],
  );

  const nickname = getUserNickname(user);
  const grade = getUserGrade(user);
  const gradeLabel = GRADE_OPTIONS.find((option) => option.value === grade)?.label ?? null;
  const profileSubtitle = [gradeLabel, user?.email].filter(Boolean).join(" · ");

  return (
    <div className="bg-bg-canvas min-h-screen">
      <header className="relative flex items-center justify-center px-6 pt-6 pb-4">
        <div className="absolute top-6 left-6">
          <Logo size="small" />
        </div>
        <NavTabBar
          items={NAV_TABS}
          activeId="mypage"
          onSelect={(id) => {
            if (id !== "mypage") {
              void navigate("/solve/pencilcanvas");
            }
          }}
        />
      </header>

      <main className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-6 pb-10">
        <ProfileHeaderCard
          // 닉네임이 없는 사용자(소셜 로그인 등)를 위한 대체 표기 — Figma 없음, 결정 필요.
          name={nickname ?? "학생"}
          subtitle={profileSubtitle || undefined}
          onChangeGrade={() => void navigate("/grade-setup")}
          onSignOut={() => void signOut()}
        />

        {tagOptions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <FilterPill
              label="전체"
              selected={selectedTag === ALL_TAGS}
              onClick={() => setSelectedTag(ALL_TAGS)}
            />
            {tagOptions.map((tag) => (
              <FilterPill
                key={tag}
                label={tag}
                selected={selectedTag === tag}
                onClick={() => setSelectedTag(tag)}
              />
            ))}
          </div>
        ) : null}

        {listStatus === "loading" ? (
          <div className="flex justify-center py-10">
            <LoadingMark label="풀이 기록을 불러오는 중" />
          </div>
        ) : null}

        {listStatus === "error" ? (
          // 전체 화면이 깨지지 않도록 모달이 아니라 인라인 안내 + 재시도 버튼으로 처리한다.
          <div
            role="alert"
            className="bg-bg-elevated flex flex-col items-center gap-3 rounded-[16px] px-[18px] py-[48px] text-center"
          >
            <p className="text-label-primary text-[15px] font-[590]">{listError}</p>
            <Button variant="pill-glass" onClick={reload}>
              다시 시도
            </Button>
          </div>
        ) : null}

        {listStatus === "success" && items.length === 0 ? (
          <HistoryEmptyState onStartSolve={() => void navigate("/solve/pencilcanvas")} />
        ) : null}

        {listStatus === "success" && items.length > 0 ? (
          <section className="overflow-hidden rounded-[16px]">
            {visibleItems.map((item) => (
              <HistoryRow
                key={item.problemId}
                recognizedText={item.recognizedText}
                conceptTags={item.conceptTags}
                createdAt={item.createdAt}
                onClick={() => setSelectedProblemId(item.problemId)}
              />
            ))}
            {visibleItems.length === 0 ? (
              <p className="bg-bg-elevated text-label-secondary px-[18px] py-[48px] text-center text-[15px]">
                이 개념의 풀이 기록이 없어요
              </p>
            ) : null}
          </section>
        ) : null}
      </main>

      {selectedProblemId ? (
        <HistoryDetailPanel onClose={() => setSelectedProblemId(null)}>
          {detailStatus === "loading" ? (
            <div className="flex flex-1 items-center justify-center p-10">
              <LoadingMark label="풀이를 불러오는 중" />
            </div>
          ) : null}

          {detailStatus === "error" ? (
            <div role="alert" className="flex flex-1 flex-col items-center gap-3 p-10 text-center">
              <p className="text-label-primary text-[15px] font-[590]">{detailError}</p>
              <Button variant="pill-glass" onClick={reloadDetail}>
                다시 시도
              </Button>
            </div>
          ) : null}

          {detailStatus === "success" && detail ? (
            detail.solution ? (
              <ResultPanel
                category={detail.solution.conceptTags[0]}
                recognizedText={detail.recognizedText}
                conceptMd={detail.solution.conceptMd}
                solutionMd={detail.solution.solutionMd}
                answerMd={detail.solution.answerMd}
                // 다시 보기 오버레이는 조회 전용이라 "새 문제"/후속 질문 입력은 제공하지 않고,
                // 인식된 문제 바의 액션만 "다시 풀기"(MYPAGE-2 후속)로 쓴다. 클릭하면 사진/필기
                // 재입력 없이 `/solve/landscape`에서 곧바로 다시 풀이하도록 라우터 state로 의도를
                // 넘긴다(마이페이지는 `ProblemInputProvider` 트리 밖이라 상태를 직접 넘길 수 없다 —
                // 재수화는 `SolveLandscapePage`가 트리거한다). 이동과 동시에 오버레이가 있는
                // `/mypage`를 완전히 벗어나므로 별도의 닫기 처리는 필요 없다.
                showNewProblemBadge={false}
                editLabel="다시 풀기"
                onEdit={() =>
                  void navigate("/solve/landscape", {
                    state: { resumeProblemId: detail.problemId },
                  })
                }
                chatContent={
                  detail.chatMessages.length > 0 ? (
                    <>
                      {detail.chatMessages.map((message, index) => (
                        // 조회 전용이라 순서가 바뀌거나 삭제되지 않아 index를 key로 써도 안전하다.
                        <ChatBubble key={index} role={message.role} content={message.content} />
                      ))}
                    </>
                  ) : undefined
                }
              />
            ) : (
              // 인식만 하고 풀이를 생성하지 않은 기록(서버 계약상 `solution`은 nullable).
              <div className="flex flex-1 flex-col items-center gap-2 p-10 text-center">
                <p className="text-label-primary text-[15px] font-[590]">
                  저장된 풀이가 없는 문제예요
                </p>
                <p className="text-label-secondary text-[13px]">{detail.recognizedText}</p>
              </div>
            )
          ) : null}
        </HistoryDetailPanel>
      ) : null}
    </div>
  );
}
