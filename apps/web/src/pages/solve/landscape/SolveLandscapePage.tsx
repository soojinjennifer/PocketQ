import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { HandwritingCanvas } from "../../../features/drawing-canvas/HandwritingCanvas";
import { HandwritingHighlightOverlay } from "../../../features/drawing-canvas/HandwritingHighlightOverlay";
import { PenRail } from "../../../features/drawing-canvas/PenRail";
import { AnswerBox } from "../../../features/ai-solution/AnswerBox";
import { DiagnosisCard } from "../../../features/ai-solution/DiagnosisCard";
import { parseStreamingSolve } from "../../../features/ai-solution/parseStreamingSolve";
import { RecognizedProblemBar } from "../../../features/ai-solution/RecognizedProblemBar";
import { ResultCard } from "../../../features/ai-solution/ResultCard";
import { ResultPanel } from "../../../features/ai-solution/ResultPanel";
import { ResultPanelShell, type ResultPanelWidth } from "../../../features/ai-solution/ResultPanelShell";
import { ResumeModeBar } from "../../../features/ai-solution/ResumeModeBar";
import { ResumeResultCard } from "../../../features/ai-solution/ResumeResultCard";
import { WorkLineList } from "../../../features/ai-solution/WorkLineList";
import { ChatBubble } from "../../../features/follow-up-chat/ChatBubble";
import { ChatFooter, type ChatFooterHandle } from "../../../features/follow-up-chat/ChatFooter";
import { SuggestionPill } from "../../../features/follow-up-chat/SuggestionPill";
import { useProblemInput } from "../../../features/problem-input/useProblemInput";
import { ActionBar } from "../../../features/solve-session/ActionBar";
import { ProblemCard, type ProblemCardData } from "../../../features/solve-session/ProblemCard";
import { SolveHeader } from "../../../features/solve-session/SolveHeader";
import { deriveHighlightRegion } from "../../../shared/lib/solve/deriveHighlightRegion";
import { deriveWorkLineJudgments } from "../../../shared/lib/solve/deriveWorkLineJudgments";
import { Badge } from "../../../shared/ui/badge/Badge";
import { LoadingMark } from "../../../shared/ui/loading-mark/LoadingMark";
import { Modal } from "../../../shared/ui/modal/Modal";

/**
 * `/solve/landscape` — 문제풀기 결과 단계. `/solve/pencilcanvas`의 "풀기" 버튼 클릭 후 진입한다.
 * Pen Rail과 필기 캔버스를 동일하게 포함해서 결과 화면에서도 계속 필기할 수 있게 한다.
 *
 * 결과 표시: 제출을 시작한 순간(`isSubmitting || streamedText.length > 0`)부터 성공
 * (`isResultReady`)까지 `ResultPanelShell` 하나를 항상 같은 DOM 요소로 유지한 채, 그 안의
 * 콘텐츠만 로딩용 ↔ 완료용(`ResultPanel`)으로 전환한다(오너 iPad 실사용 중 발견: 로딩 박스와
 * Result Panel이 서로 다른 위치·스타일에 각각 마운트되어 "다른 곳에서 갑자기 나타나는" 것처럼
 * 보이던 문제 수정, 2026-08-14). 셸을 두 조건부 블록으로 나누지 않는 이유는 그렇게 하면 React가
 * 서로 다른 엘리먼트로 인식해 성공 시점에 마운트 애니메이션이 다시 재생되기 때문이다.
 *
 * 로딩 중 콘텐츠도 완료 후와 같은 카드 구조를 쓴다 — `streamedText`(누적 raw 텍스트)를 매 렌더마다
 * `parseStreamingSolve`로 헤더 기준 파싱해서, 아직 스트리밍 중이라도 도착한 섹션(관련 개념/단계별
 * 풀이/최종 답)만큼 `ResultCard`/`AnswerBox`를 그대로 채워 넣는다. 완료 시점에 구조화된
 * `ResultPanel`로 전환되어도 같은 컴포넌트들이 같은 자리에 있으므로 "깜빡이며 바뀌는" 느낌이 없다
 * (오너 요청, 2026-08-14). 헤더가 하나도 도착하지 않았을 때만 `LoadingMark`(브랜드 마크 펄스
 * 로딩)를 보여준다(오너 요청, 2026-08-16 — Claude 자체 채팅 UI처럼 진행 중임을 알리기 위함).
 */
export function SolveLandscapePage() {
  const {
    capturedImage,
    strokes,
    tool,
    setTool,
    startStroke,
    addPoint,
    undoStroke,
    clearStrokes,
    workStrokes,
    workTool,
    setWorkTool,
    startWorkStroke,
    addWorkPoint,
    undoWorkStroke,
    clearWorkStrokes,
    hasProblemInput,
    lastInputType,
    beginReinput,
    startNewProblem,
    submitProblem,
    resumeFromHistory,
    problemId,
    recognizeStatus,
    recognizedText,
    solveStatus,
    streamedText,
    solveResult,
    suggestedQuestions,
    resetSubmission,
    chatMessages,
    chatStatus,
    chatErrorMessage,
    sendChatMessage,
    workLines,
    recognizeWorkStatus,
    resetRecognizeWork,
    diagnosis,
    diagnoseStatus,
    resetDiagnose,
    resumeMode,
    resumeStatus,
    resumeSolution,
    resumeErrorMessage,
    startResume,
    resetResume,
  } = useProblemInput();

  // 마이페이지 "다시 풀기"로 진입한 경우(`RecognizedProblemBar`의 "다시 풀기" → `/solve/landscape`),
  // 사진/필기 재입력 없이 저장된 인식 결과를 재수화하고 곧바로 풀이를 시작한다. 마이페이지는
  // `ProblemInputProvider` 트리 밖이라 상태를 직접 넘길 수 없어서, 의도만 라우터 state로 전달받아
  // Provider 안쪽인 이 페이지에서 트리거한다.
  const location = useLocation();
  const navigate = useNavigate();
  const resumeAttemptedRef = useRef(false);

  useEffect(() => {
    const resumeProblemId = (location.state as { resumeProblemId?: string } | null)?.resumeProblemId;
    if (!resumeProblemId || resumeAttemptedRef.current || problemId !== null) {
      return;
    }
    resumeAttemptedRef.current = true;
    void resumeFromHistory(resumeProblemId);
    // 소비한 state는 즉시 비운다(새로고침 시 중복 재수화 방지, 뒤로가기 시 이상 동작 방지).
    // 이 시점에는 아직 problemId가 없지만 `RequireProblemInputGuard`가 `recognizeStatus`도 보고
    // 있어 `/camera`로 튕기지 않는다(가드 JSDoc 참고).
    void navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate, problemId, resumeFromHistory]);

  // `SuggestionPill`(Body)이 채워야 할 `ChatFooter`(Footer)의 입력창은 서로 다른 슬롯(`ResultPanel`의
  // `chatContent`/`chatFooter`)으로 전달되어 DOM 상 분리돼 있다 — `ResultPanel`(features/ai-solution)이
  // `features/follow-up-chat`를 직접 import하지 않게 하기 위한 구조(`ResultPanel` JSDoc 참고)라, 두
  // 슬롯을 조립하는 이 페이지가 `ref`로 연결한다(오너 확정 인터랙션: pill 클릭 → 입력창 채움 →
  // 포커스 → 사용자 확인/수정 → 전송 버튼/Enter로만 제출, 자동 전송 금지).
  const chatFooterRef = useRef<ChatFooterHandle>(null);

  // 스크롤 앵커 패턴: `ResultPanel`의 `chatContent` 슬롯 맨 끝에 빈 앵커 요소를 두고, 새 메시지/로딩
  // 인디케이터가 추가될 때마다 이 요소로 스크롤한다. `ResultPanel`/`ResultPanelShell`은 스크롤
  // 컨테이너(`overflow-y-auto`)만 소유할 뿐 이 로직을 몰라도 된다 — `scrollIntoView`는 가장 가까운
  // 스크롤 가능한 조상을 스크롤하므로 앵커가 그 컨테이너 안에 있기만 하면 된다(오너 iPad 실사용 중
  // 발견: 새 질문/로딩이 스크롤 영역 밖으로 밀려나 안 보이던 문제 수정, 2026-08-16).
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages.length, chatStatus]);

  // "수정"(다시 입력) 흐름 — 오너 확정 UX(2026-08-17): 결과 화면에서 "수정"을 누르면 안내 메시지를
  // 띄우고, 확인하면 입력 모달리티에 따라 필기는 캔버스를 지워 바로 다시 쓸 수 있게 하고 사진은
  // Problem Card에 "다시 찍어 주세요" 안내로 바꾼다(사진 Blob 자체는 풀이 성공 시 이미 정리돼
  // 있어 `ProblemCard`가 보여줄 게 없다). 그 다음은 평소 "풀기" 흐름과 동일하다.
  const [isReinputModalOpen, setIsReinputModalOpen] = useState(false);
  const [needsPhotoRetake, setNeedsPhotoRetake] = useState(false);
  // "#개념설명" 해시태그 pill 토글 상태(DIAG 결과 화면 전용, 패널 폭 Extend/Default와 무관한 로컬
  // state — 오너 확정). 켜지면 `diagnosis.conceptExplanations`를 관련 개념 카드로 보여준다.
  const [isConceptCardVisible, setIsConceptCardVisible] = useState(false);

  const handleRequestReinput = () => setIsReinputModalOpen(true);

  const handleReinputConfirm = () => {
    setIsReinputModalOpen(false);
    // 이전 풀이/채팅 결과는 더 이상 유효하지 않으므로 지우고 Result Panel을 닫는다 — 이후
    // 사용자는 평소 "풀기" 흐름 그대로 새 입력을 제출한다. `resetSubmission`이 아니라
    // `beginReinput`을 쓰는 이유: 둘 다 recognize/solve/chat을 초기화하지만, `beginReinput`은
    // 추가로 `isRequestingReinput`을 켜서 `RequireProblemInputGuard`가 이 과도기에도
    // `/camera`로 튕기지 않게 한다(가드 JSDoc "예외 3" 참고).
    beginReinput();
    if (lastInputType === "photo") {
      setNeedsPhotoRetake(true);
    } else {
      clearStrokes();
    }
  };

  const handleRequestRetakePhoto = () => {
    void navigate("/camera");
  };

  // WorkLineList "수정" 링크(오너 확정, 2026-09) — 인식된 학생 풀이가 틀렸을 때 WORK 캔버스로
  // 돌아가 고쳐서 재인식할 수 있게 한다. recognizeWork/diagnose 상태만 초기화하고 WORK 캔버스의
  // 필기 스트로크(`workStrokes`) 자체는 지우지 않는다 — 학생이 지우개로 일부만 고칠 수 있어야
  // 하는 게 의도된 동작이다.
  const handleEditWork = () => {
    resetRecognizeWork();
    resetDiagnose();
    // 이전 진단에 딸려 있던 이어풀기 결과도 더 이상 유효하지 않다 — WORK로 돌아가 학생 풀이를
    // 고치면 진단이 다시 실행돼야 하므로 남겨두지 않는다.
    resetResume();
    void navigate("/solve/pencilcanvas");
  };

  const problemCardData: ProblemCardData = needsPhotoRetake
    ? { needsRetake: true }
    : capturedImage
      ? { imageUrl: capturedImage.previewUrl }
      : null;
  // WORK-4("아직 못 풀겠어요", 기존 solve 재사용)와 SOLVE-2("봐 주세요", recognizeWork → diagnose
  // 2단계) 중 어느 경로로 도달했든 제출 진행 중 상태를 함께 반영한다(오너 확정 §4b).
  const isSubmitting =
    recognizeStatus === "loading" ||
    solveStatus === "loading" ||
    recognizeWorkStatus === "loading" ||
    diagnoseStatus === "loading";
  const isRecognizeError = recognizeStatus === "error";
  const hasError = isRecognizeError || solveStatus === "error";
  const isResultReady = solveStatus === "success" && solveResult !== null;
  // SOLVE-2(진단) 경로의 결과 준비 상태 — `isResultReady`(WORK-4/solve 경로)와 별개다.
  const isDiagnosisReady = diagnoseStatus === "success" && diagnosis !== null;
  // 진단(DIAG) 단계에서만 "막힌 지점" 하이라이트를 계산한다 — 학생이 실제로 쓴 WORK 캔버스
  // (`workStrokes`)와 그 인식 결과(`workLines`)를 진단 결과(`diagnosis.stallLine`)에 매핑한다
  // (오너 승인, work-order 6단계). `diagnosis.stallLine === null`(중단형)이거나 매핑 신뢰도가
  // 너무 낮으면 `deriveHighlightRegion`이 `null`을 반환해 오버레이가 아무것도 그리지 않는다.
  const highlightRegion =
    isDiagnosisReady && diagnosis ? deriveHighlightRegion(workStrokes, workLines ?? [], diagnosis) : null;
  // 제출을 시작한 시점부터 성공까지 `ResultPanelShell`을 항상 같은 DOM 요소로 유지한다(위 JSDoc
  // 참고) — 로딩용/완료용을 별개의 조건부 렌더링으로 나누지 않는다.
  const isPanelVisible = isSubmitting || streamedText.length > 0 || isResultReady || isDiagnosisReady;
  // 로딩 중에도 완료 후와 같은 카드 구조로 채워 넣기 위한 실시간 파싱(위 JSDoc 참고).
  // `isResultReady`가 되면 이 값은 더 이상 렌더링에 쓰이지 않는다.
  const { conceptSoFar, stepsSoFar, answerSoFar } = parseStreamingSolve(streamedText);
  const hasAnyStreamedSection = conceptSoFar !== null || stepsSoFar !== null || answerSoFar !== null;

  // `ResultPanelShell` 좌측 `ResultPanelResizeHandle`의 폭 상태. 새 제출이 시작돼 셸이 새로
  // 마운트되는 시점(`isPanelVisible`이 false→true로 바뀔 때)마다 `"default"`로 리셋해서, 이전
  // 문제에서 넓혀본 상태가 다음 문제까지 이어지지 않게 한다. `useEffect` 대신 React 공식
  // "prop이 바뀔 때 state 조정" 패턴(렌더 중 이전 값과 비교해 즉시 setState)을 사용한다 —
  // effect 안에서 setState하면 불필요한 커밋이 한 번 더 발생한다.
  const [panelWidth, setPanelWidth] = useState<ResultPanelWidth>("default");
  const [prevIsPanelVisible, setPrevIsPanelVisible] = useState(isPanelVisible);
  if (isPanelVisible !== prevIsPanelVisible) {
    setPrevIsPanelVisible(isPanelVisible);
    if (isPanelVisible) {
      setPanelWidth("default");
      // 이전 문제에서 열어뒀던 "#개념설명" 관련개념 카드 상태가 새 진단 결과로 이어지지 않게
      // 함께 리셋한다(재입력 후 새 문제 풀이 시작 시점, panelWidth 리셋과 동일 조건/위치).
      setIsConceptCardVisible(false);
    }
  }

  return (
    <div className="bg-bg-canvas solve-no-callout relative min-h-screen">
      <SolveHeader />

      {/* 캔버스/PenRail 소스 전환(오너 승인, work-order 6단계 발견 A 수정): 진단(DIAG) 결과가
          준비된 뒤에는 이 화면이 학생이 실제로 쓴 WORK 캔버스(`workStrokes`)를 보여줘야 한다 —
          이전에는 INPUT 캔버스(`strokes`)만 보여줘서 진단에 쓰인 필기 자체를 볼 수 없는 공백이
          있었다. 캔버스와 PenRail을 반드시 함께 전환한다(하나만 바꾸면 화면에 보이는 캔버스와
          지우개/undo가 서로 다른 버퍼를 참조하게 된다) — `SolvePencilcanvasPage.tsx`의 동일
          패턴 참고. 이로 인해 진단 화면의 지우개/undo가 진단에 쓰인 원본 필기를 지울 수 있는
          부작용이 있지만 단순함을 우선해 그대로 둔다(오너 승인). */}
      {isDiagnosisReady ? (
        <>
          <HandwritingHighlightOverlay region={highlightRegion} />
          <HandwritingCanvas strokes={workStrokes} onStartStroke={startWorkStroke} onAddPoint={addWorkPoint} />
          <PenRail
            activeTool={workTool}
            onSelectTool={setWorkTool}
            onUndo={undoWorkStroke}
            onClear={clearWorkStrokes}
          />
        </>
      ) : (
        <>
          <HandwritingCanvas strokes={strokes} onStartStroke={startStroke} onAddPoint={addPoint} />
          <PenRail activeTool={tool} onSelectTool={setTool} onUndo={undoStroke} onClear={clearStrokes} />
        </>
      )}

      {/* Result Panel(39:28)은 화면 우측에 독립 도킹된 패널이다. design-agent가 Figma(`38:21`)를
          재실측한 결과, Default 상태에서도 Action Bar 우측 끝이 Result Panel 좌측 끝과 10px
          겹치는 것으로 나타나(오너 명시 확인, 2026-08-14) — Figma 원안 자체가 "겹치지 않게 우측
          공간을 예약"하는 구조가 아니라 "겹쳐도 z-index로 위에 얹는" 구조다. 이에 따라 ProblemCard/
          ActionBar는 더 이상 우측 예약폭(pr-*)을 두지 않고 화면 전체 폭 기준으로 정상
          중앙정렬하며, `ResultPanelShell`이 더 높은 z-index로 그 위에 얹혀 필요하면 겹친다(아래
          `ResultPanelShell`의 z-20 참고). */}

      {/* ProblemCard는 캔버스와 같은 레벨의 독립 absolute 요소로 배치한다(PenRail/SolveHeader와 동일
          패턴). top-[90px]는 SolveNavTabs(top-6=24px) + NavTabBar 실측 높이(42px) + 24px 여백
          (24+42+24=90) 유도값이다(기존 값 유지). 폭/정렬(543px, mx-auto)도 기존 값을 그대로
          재사용한다 — 화면 전체 폭 기준 중앙정렬이며 우측 예약폭은 없다(위 코멘트 참고, Result
          Panel과 겹칠 수 있음). 로딩 중 표시는 더 이상 이 컬럼에 두지 않고 우측
          `ResultPanelShell`로 통합했다(위 JSDoc 참고). 결과 화면에서는 촬영 사진(`{imageUrl}`)을
          완전히 숨긴다(오너 확정, 2026-09-08, 이전 결정 번복 — Figma `38:21` 재실측 결과 이 화면에
          Problem Card 인스턴스 자체가 없음을 확인). `"needsRetake" in problemCardData`로 게이팅해
          "수정" 흐름의 재촬영 안내(`{needsRetake:true}`) 케이스만 남기고, 사진 미리보기는
          로딩/성공 여부와 무관하게 렌더링하지 않는다. */}
      <div className="pointer-events-auto absolute inset-x-0 top-[90px] z-10">
        <div className="mx-auto flex w-[543px] max-w-[calc(100%-3rem)] flex-col gap-3">
          {problemCardData !== null && "needsRetake" in problemCardData ? (
            <ProblemCard data={problemCardData} onRequestRetake={handleRequestRetakePhoto} />
          ) : null}
        </div>
      </div>

      {isPanelVisible ? (
        <ResultPanelShell
          width={panelWidth}
          onExtend={() => setPanelWidth("extend")}
          onBackToDefault={() => setPanelWidth("default")}
          onClose={() => setPanelWidth("close")}
          onOpen={() => setPanelWidth("default")}
        >
          {isResultReady && solveResult ? (
            <ResultPanel
              category={solveResult.conceptTags[0]}
              recognizedText={recognizedText ?? ""}
              onEdit={handleRequestReinput}
              conceptMd={solveResult.conceptMd}
              solutionMd={solveResult.solutionMd}
              answerMd={solveResult.answerMd}
              chatContent={
                <>
                  {/* 제안 질문 pill(Final QA MEDIUM-4) — 풀이 성공 직후 별도 AI 호출로 채워진다.
                      아직 안 왔거나(로딩 중) 실패했으면 행 자체를 그리지 않는다(선택적 보조 UI라
                      별도 로딩/에러 표시 없음). */}
                  {suggestedQuestions && suggestedQuestions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {suggestedQuestions.map((question) => (
                        <SuggestionPill
                          key={question}
                          label={question}
                          onClick={() => chatFooterRef.current?.fillAndFocus(question)}
                        />
                      ))}
                    </div>
                  ) : null}
                  {chatMessages.map((message, index) => (
                    // 메시지는 항상 끝에만 추가되고 재정렬/삭제되지 않아 index를 key로 써도 안전하다.
                    <ChatBubble key={index} role={message.role} content={message.content} />
                  ))}
                  {/* 후속 질문 응답 대기 중: 마지막 메시지 다음, AI 답변이 도착하기 전까지 좌측
                      정렬로 표시한다(Claude 자체 채팅 UI 패턴, 오너 요청 2026-08-16). */}
                  {chatStatus === "submitting" ? (
                    <div className="flex justify-start">
                      <LoadingMark label="답변을 생성하는 중" />
                    </div>
                  ) : null}
                  <div ref={chatEndRef} />
                </>
              }
              chatFooter={
                <ChatFooter
                  ref={chatFooterRef}
                  // 해시태그 pill 콘텐츠는 실제 문제의 `conceptTags`를 그대로 재사용한다(새 텍스트를
                  // 발명하지 않기 위함) — 헤더 카테고리 배지(`conceptTags[0]`)와 일부 겹칠 수
                  // 있는데, 이를 제외할지는 Figma에 근거가 없어 결정 필요(오너 확인 필요).
                  hashtags={solveResult.conceptTags}
                  status={chatStatus}
                  errorMessage={chatErrorMessage}
                  onSend={sendChatMessage}
                  // 오너 확정 UX: 해시태그 pill도 `SuggestionPill`과 동일하게 입력창을 채우고
                  // 포커스만 한다(자동 전송 없음). 정확한 문구 템플릿은 Figma/오너가 확정한 바
                  // 없어 결정 필요(오너 확인 필요) — 우선 자연스러운 문장으로 조립한다.
                  onHashtagClick={(tag) => chatFooterRef.current?.fillAndFocus(`${tag}에 대해 좀 더 설명해주세요`)}
                />
              }
            />
          ) : isDiagnosisReady && diagnosis ? (
            // SOLVE-2(진단) 결과 콘텐츠 — `ResultPanel`은 concept/solution/answer(solve 결과)
            // 형태를 전제로 하는 컴포넌트라 진단 결과에는 맞지 않는다. 새 컴포넌트를 만들지 않고
            // 기존 조각(`RecognizedProblemBar`/`WorkLineList`/`DiagnosisCard`/`ResumeModeBar`/
            // `ResumeResultCard`)을 이 페이지가 직접 조립한다(오너 확정 §4b, RESUME 화면 연결은
            // 5단계 2차 — `docs/PROJECT_STATUS.md` §3.23).
            <>
              {/* Figma Header의 Actions 프레임에는 토픽 배지도 있지만 `Diagnosis` 타입에 대응
                  필드가 없어 이번엔 "새 문제" 배지만 넣었다 — 정식 필드가 추가되면 반영 검토
                  (결정 필요, 오너 확인 필요). */}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-5 py-3">
                <h2 className="text-label-primary text-[17px] leading-[22px] font-[590]">풀이 결과</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="tint-blue">새 문제</Badge>
                </div>
              </div>
              <div
                className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5 touch-pan-y"
                aria-live="polite"
              >
                {recognizedText ? <RecognizedProblemBar recognizedText={recognizedText} /> : null}
                <WorkLineList
                  lines={deriveWorkLineJudgments(workLines ?? [], diagnosis)}
                  onEdit={handleEditWork}
                />
                <DiagnosisCard diagnosis={diagnosis} />
                {/* 이어풀기(RESUME) — Figma(`253:53`) 실측: Body 내 순서는 진단 → 이어풀기 →
                    추천 질문 pill → 관련개념 카드다(위 `isConceptCardVisible` 주석 참고). 진단
                    성공 시 자동으로 호출되지 않는다 — 사용자가 아래 버튼을 직접 눌러야
                    `startResume()`이 호출된다(오너 확정). */}
                <ResumeModeBar
                  mode={resumeMode ?? "own"}
                  onModeChange={(mode) => void startResume(mode)}
                  ownModeDisabled={!diagnosis.isMethodApplicable}
                  applicabilityNote={diagnosis.methodApplicabilityNote}
                />
                {resumeStatus === "loading" ? (
                  <LoadingMark label="이어서 풀이를 만드는 중" />
                ) : resumeStatus === "success" && resumeSolution && resumeSolution.verified ? (
                  <ResumeResultCard solution={resumeSolution} />
                ) : null}
                {suggestedQuestions && suggestedQuestions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {suggestedQuestions.map((question) => (
                      <SuggestionPill
                        key={question}
                        label={question}
                        onClick={() => chatFooterRef.current?.fillAndFocus(question)}
                      />
                    ))}
                  </div>
                ) : null}
                {chatMessages.map((message, index) => (
                  <ChatBubble key={index} role={message.role} content={message.content} />
                ))}
                {chatStatus === "submitting" ? (
                  <div className="flex justify-start">
                    <LoadingMark label="답변을 생성하는 중" />
                  </div>
                ) : null}
                {/* "#개념설명" 해시태그 pill 토글(오너 확정) — 켜져 있을 때만 관련 개념 각각의
                    제목+설명을 `ResultCard`(kind="concept")로 보여준다. Figma(174:640) 실측: Body
                    내 순서는 진단 → 이어풀기 → 추천 질문 pill → 관련개념 카드(Footer 직전, 맨 아래). */}
                {isConceptCardVisible && diagnosis.conceptExplanations.length > 0
                  ? diagnosis.conceptExplanations.map((concept) => (
                      <ResultCard
                        key={concept.name}
                        kind="concept"
                        title={concept.title}
                        body={concept.explanationMd}
                      />
                    ))
                  : null}
                <div ref={chatEndRef} />
              </div>
              {/* 후속 질문 입력창(`ChatFooter`) — solve-result 분기(`ResultPanel`의 `chatFooter` 슬롯)와
                  동일하게, 결과 준비 후(`isDiagnosisReady`)에만 보이도록 body와 형제로 둔다
                  (`ResultPanel.tsx`의 `chatFooter` 슬롯 렌더 패턴과 동일). */}
              <div className="shrink-0 px-5 pt-2 pb-5">
                <ChatFooter
                  ref={chatFooterRef}
                  // Figma(`253:53`/`174:617~625`/`174:663~671`) 공통 4-패턴: "#개념설명"(고정, 항상
                  // 첫 번째) + 관련 개념 태그(가변 개수, `diagnosis.relatedConcepts`) + "#비슷한
                  // 문제"(고정, 항상 마지막).
                  hashtags={["개념설명", ...diagnosis.relatedConcepts, "비슷한 문제"]}
                  status={chatStatus}
                  errorMessage={chatErrorMessage}
                  onSend={sendChatMessage}
                  // "#개념설명"만 로컬 토글(관련 개념 카드 노출/숨김)로 처리하고, 그 외(개별 관련
                  // 개념 태그, "#비슷한 문제" 포함)는 기존 default 동작(입력창 채움+포커스)을 그대로
                  // 적용한다(오너 확정).
                  onHashtagClick={(tag) =>
                    tag === "개념설명"
                      ? setIsConceptCardVisible((prev) => !prev)
                      : chatFooterRef.current?.fillAndFocus(`${tag}에 대해 좀 더 설명해주세요`)
                  }
                />
              </div>
            </>
          ) : (
            <div
              className="flex flex-1 flex-col gap-3 overflow-y-auto p-5 touch-pan-y"
              aria-live="polite"
            >
              {hasAnyStreamedSection ? (
                <>
                  {recognizedText ? <RecognizedProblemBar recognizedText={recognizedText} /> : null}
                  {conceptSoFar ? <ResultCard kind="concept" body={conceptSoFar} /> : null}
                  {stepsSoFar ? <ResultCard kind="steps" body={stepsSoFar} /> : null}
                  {answerSoFar ? <AnswerBox answerMd={answerSoFar} /> : null}
                </>
              ) : (
                <LoadingMark
                  label={
                    recognizeStatus === "loading"
                      ? "문제를 인식하는 중"
                      : recognizeWorkStatus === "loading"
                        ? "풀이를 인식하는 중"
                        : diagnoseStatus === "loading"
                          ? "진단하는 중"
                          : "풀이를 생성하는 중"
                  }
                />
              )}
            </div>
          )}
        </ResultPanelShell>
      ) : null}

      {/* Action Bar: Figma 실측(`Solve/Action Bar` 인스턴스 node 256:405, `3-1 · Solve/Pencilcanvas`
          `127:445` 내부) constraints.vertical=MAX(Bottom), 프레임 하단에서 정확히
          40px 여백. iPad Safari 하단 툴바/홈 인디케이터 회피를 위해 세이프에어리어 inset도 더한다.
          이전에는 좌측(캔버스) 영역 안에서만 중앙정렬되도록 우측 예약폭(pr-*)을 뒀지만,
          design-agent의 Figma(`38:21`) 재실측 결과 Default 상태에서도 Result Panel과 10px
          겹치는 것이 원안에 가까워(오너 명시 확인, 2026-08-14) 예약을 제거하고 화면 전체 폭
          기준으로 정상 중앙정렬한다 — 필요하면 `ResultPanelShell`(z-20)이 위에 겹쳐 보인다. */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+40px)] z-10">
        <div className="mx-auto w-fit">
          {/* "아직 못 풀겠어요"/"봐 주세요"(WORK 단계) 클릭은 `/solve/pencilcanvas`에서만 발생한다
              (오너 확정 §4b) — 이 화면은 WORK-4(`giveUp`)가 이미 트리거된 뒤 곧바로 이동해 온
              상태이거나(진행 중 solveStatus="loading"), SOLVE-2(`diagnose`)가 이미 성공한 뒤
              도달한 상태(RESULT 단계)라 실질적으로 두 버튼이 클릭 가능한 구간이 없다. `onRecognize`
              (기존 "수정" 이후 재제출 등 `submitProblem()` 경로)는 그대로 유지한다.
              RESULT 단계([1] 세그먼트가 "새 문제 풀기"로 전환된 상태)에서는 `startNewProblem()`으로
              전체 상태를 초기화한 뒤 `/solve/pencilcanvas`(INPUT 단계)로 돌아간다. `hasWorkInput`은
              이 페이지(RESULT 단계)의 세그먼트 강조 판단에는 쓰이지 않지만 타입상 필수라 WORK 캔버스
              보유 여부(`workLines !== null`)를 그대로 전달한다. */}
          <ActionBar
            problemId={problemId}
            hasProblemInput={hasProblemInput}
            hasWorkInput={workLines !== null}
            recognizeStatus={recognizeStatus}
            solveStatus={solveStatus}
            recognizeWorkStatus={recognizeWorkStatus}
            diagnoseStatus={diagnoseStatus}
            onRecognize={() => void submitProblem()}
            onNewProblem={() => {
              startNewProblem();
              void navigate("/solve/pencilcanvas");
            }}
          />
        </div>
      </div>

      {hasError ? (
        <Modal
          icon="error"
          title={isRecognizeError ? "문제를 인식하지 못했습니다" : "풀이를 만들지 못했습니다"}
          description={
            isRecognizeError
              ? "사진이나 손글씨가 선명하게 보이는지 확인하고 다시 시도해 주세요."
              : "잠시 후 다시 시도해 주세요."
          }
          actionLabel="확인"
          onAction={resetSubmission}
        />
      ) : null}

      {resumeStatus === "error" ? (
        <Modal
          icon="error"
          title="이어풀기를 만들지 못했습니다"
          description={resumeErrorMessage ?? "잠시 후 다시 시도해 주세요."}
          actionLabel="확인"
          onAction={resetResume}
        />
      ) : null}

      {/* RESUME-5: CAS 최종 답 검증에 실패한 이어풀기 결과는 카드로 보여주지 않고(위 `verified`
          조건 참고), 대신 재시도를 안내한다(PRD "재생성 또는 오류 안내로 대체", stage-qa-agent
          회귀 HIGH 결함 수정, 2026-09). 기존 이어풀기 에러 Modal과 동일한 패턴을 재사용한다. */}
      {resumeStatus === "success" && resumeSolution && !resumeSolution.verified ? (
        <Modal
          icon="error"
          title="이어풀기 검증에 실패했습니다"
          description="생성된 풀이의 최종 답을 확인하지 못했어요. 다시 시도해 주세요."
          actionLabel="확인"
          onAction={resetResume}
        />
      ) : null}

      {isReinputModalOpen ? (
        <Modal
          icon="check"
          title="문제를 다시 입력해주세요"
          description="인식이 잘못됐다면 문제를 다시 촬영하거나 손글씨로 다시 써서 입력해 주세요."
          actionLabel="확인"
          onAction={handleReinputConfirm}
        />
      ) : null}
    </div>
  );
}
