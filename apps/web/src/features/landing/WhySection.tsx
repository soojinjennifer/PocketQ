import appIconUrl from "../../assets/landing/app-icon-120.webp";
import { CheckNegativeIcon, CheckPositiveIcon } from "./LandingIcons";
import { SectionHeader } from "./SectionHeader";
import { LANDING_CONTAINER, LANDING_SCROLL_MARGIN } from "./landingStyles";

const OLD_WAY = [
  "정답 풀이를 처음부터 다시 보여줘요, 그리고 풀이 공식을 외우게 해요",
  "내가 쓴 풀이는 아무도 안 봐줘요. 혼자 공부, 어떻게 해야 돼요?",
  "“뭘 잘못 생각했는지”는 끝내 모르고, 그냥 풀이 방법을 외워요ㅠㅠ",
] as const;

const SUPULING_WAY = [
  "일단 내가 생각해서 풀어봐요. 그리고 풀이 과정을 점검해주면 아하!",
  "막힌 줄 번호와 이유를 콕 짚어줘요. 맞춤 과외선생님이 내 손안에 쏘옥~",
  "쓰던 방법 그대로, 막힌 곳부터 풀어줘서 혼자 생각하는 능력이 쑤욱!",
] as const;

/** 비교 카드 공통(`p 28`, radius 28, 세로 gap 14). */
const COMPARE_CARD = "rounded-landing-card flex flex-col gap-3.5 p-6 md:p-7";
const CHECK_LIST = "m-0 flex list-none flex-col gap-3 p-0";
const CHECK_ITEM = "flex items-start gap-2.5 text-base leading-[1.5]";

/** Why · Pain vs Solution(`446:54`). 비교 카드는 768 이상 2열, 그 아래 1열(§6.2 잠정). */
export function WhySection() {
  return (
    <section id="why" aria-labelledby="why-title" className={LANDING_SCROLL_MARGIN}>
      <div className={`${LANDING_CONTAINER} flex flex-col gap-[34px] pt-10 pb-12 lg:pb-16`}>
        <SectionHeader
          titleId="why-title"
          align="center"
          weight="bold"
          eyebrowSize="large"
          eyebrow="자기주도 학습을 통해 진짜 실력을 키우려면"
          title={
            <>
              정답만 찾는 게 아니라
              <br />
              “내 풀이 방법이 어디서 막히는지” 알아야 하잖아요.
            </>
          }
        />
        <div className="grid gap-4.5 md:grid-cols-2">
          <div className={`${COMPARE_CARD} bg-surface-well shadow-landing-well`}>
            <h3 className="text-landing-brand-deep m-0 text-[15px] font-bold">해설지 · 인강 · 검색 AI</h3>
            <ul className={CHECK_LIST}>
              {OLD_WAY.map((item) => (
                <li key={item} className={`${CHECK_ITEM} text-landing-label-ink`}>
                  <CheckNegativeIcon className="mt-1 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className={`${COMPARE_CARD} bg-landing-brand-deep shadow-landing-raised`}>
            <h3 className="text-landing-brand-mint m-0 flex items-center gap-2.5 text-[15px] font-bold">
              <img
                src={appIconUrl}
                alt=""
                width={30}
                height={30}
                loading="lazy"
                className="rounded-landing-icon-sm size-[30px]"
              />
              수풀잉
            </h3>
            <ul className={CHECK_LIST}>
              {SUPULING_WAY.map((item) => (
                <li key={item} className={`${CHECK_ITEM} text-landing-label-on-deep`}>
                  <CheckPositiveIcon className="mt-1 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
