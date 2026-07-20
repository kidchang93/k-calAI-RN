// 업데이트 이력(사용자 공지). 릴리즈와 함께 이 배열만 갱신하면 화면에 반영된다 — 최신 항목이 맨 위.
// 정적 번들 데이터라 서버 왕복이 없고 오프라인에서도 보인다. 사용자에게 보이는 문구이므로
// 개발 용어가 아니라 사용자 관점의 변화로 적는다(예: "logged_at 앵커" X → "지난 날짜에도 기록" O).

export type ChangeType = 'new' | 'improved' | 'fixed';

export type ChangeItem = {
  type: ChangeType;
  text: string;
};

export type ChangelogEntry = {
  // YYYY-MM-DD. 사용자에게 릴리즈 날짜로 보인다.
  date: string;
  title: string;
  items: ChangeItem[];
};

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  new: '신규',
  improved: '개선',
  fixed: '수정',
};

// 최신순(위가 최신). 새 릴리즈는 이 배열 맨 앞에 추가한다.
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-07-20',
    title: '신장병 맞춤 식단 · 영양 정보 강화',
    items: [
      {
        type: 'new',
        text: '추천 메뉴마다 나트륨·칼륨·인·단백질 함량을 함께 보여드려요.',
      },
      {
        type: 'new',
        text: '신장 질환이 있으면 칼륨·인이 높은 음식을 추천에서 빼고, 칼륨을 줄이는 조리법을 알려드려요. (대한신장학회 지침 참고)',
      },
      {
        type: 'improved',
        text: '음식을 기록할 때 "칼륨이 높은 편이에요"처럼 어떤 영양소를 주의하면 좋을지 알려드려요.',
      },
    ],
  },
  {
    date: '2026-07-16',
    title: '지난 날짜 기록 · 한 끼 여러 메뉴',
    items: [
      {
        type: 'new',
        text: '지난 날짜에도 식사를 기록할 수 있어요. 캘린더에서 날짜를 고르면 바로 추가할 수 있어요.',
      },
      {
        type: 'new',
        text: '사진 한 장에서 여러 음식을 한 번에 인식해요. 밥·국·반찬이 있는 한 상 차림도 한 끼로 담을 수 있어요.',
      },
      {
        type: 'new',
        text: '이미 저장한 끼니에 사진이나 메뉴를 나중에 더할 수 있어요.',
      },
      {
        type: 'new',
        text: '음식 이름으로 검색해 메뉴를 추가하면 사진 인식 횟수를 쓰지 않아요.',
      },
      {
        type: 'improved',
        text: '무료 사진 인식이 하루 3건에서 5건으로 늘었어요.',
      },
    ],
  },
  {
    date: '2026-07-14',
    title: '카카오 로그인',
    items: [
      {
        type: 'new',
        text: '카카오 계정으로 간편하게 로그인할 수 있어요.',
      },
    ],
  },
  {
    date: '2026-07-13',
    title: '리포트와 캘린더',
    items: [
      {
        type: 'new',
        text: '주·월 섭취 추이와 캘린더로 그동안의 기록을 한눈에 볼 수 있어요.',
      },
      {
        type: 'new',
        text: '영양 정보에 없는 음식은 AI가 칼로리를 추정해 알려드려요.',
      },
    ],
  },
  {
    date: '2026-07-11',
    title: '식단 추천',
    items: [
      {
        type: 'new',
        text: '질병·알러지를 고려한 끼니 추천을 받아볼 수 있어요.',
      },
    ],
  },
  {
    date: '2026-07-10',
    title: '그룹과 반려동물',
    items: [
      {
        type: 'new',
        text: '가족·친구와 그룹을 만들어 함께 식단을 관리해요.',
      },
      {
        type: 'new',
        text: '반려동물을 등록하고 권장 칼로리를 확인할 수 있어요.',
      },
    ],
  },
];
