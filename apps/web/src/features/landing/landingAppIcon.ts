import appIcon40Url from "../../assets/landing/app-icon-40.webp";
import appIcon80Url from "../../assets/landing/app-icon-80.webp";

/**
 * 오너 앱 아이콘(Round 2, §14.3). 원본 168px에서 x 30~138, y 4~112(108×108)만 잘라 구워진 "수풀잉" 글자를 뺐다 —
 * 바로 옆 워드마크·제목과 같은 말이 판독 불가 크기로 반복되기 때문이다. 모서리는 CSS radius가 담당한다.
 * Nav(40)와 Why 카드(30)가 같은 1x/2x 세트를 쓴다.
 */
export const LANDING_APP_ICON_SRC = appIcon40Url;
export const LANDING_APP_ICON_SRCSET = `${appIcon40Url} 1x, ${appIcon80Url} 2x`;
