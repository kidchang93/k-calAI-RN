# DESIGN

## 설계 원칙

1. **AI 데모가 아니라 건강 관리 루틴의 일부처럼 보인다.** 화면 문구와 흐름을 그 기준으로 판단합니다.
2. **네트워크 경계는 `services/`에만 있다.** 화면은 `fetch`를 직접 호출하지 않습니다.
3. **서버 응답을 신뢰하지 않는다.** 타입 가드를 통과한 값만 화면으로 넘깁니다.
4. **실패는 사용자가 이해할 수 있는 한국어 문장으로 표시한다.**
5. **입력 흐름이 길어지면 사용자는 기록을 포기한다.** 단계를 늘리는 변경은 신중히 판단합니다.

## 코드에서 확인된 설계 결정

| 결정 | 위치 | 이유 |
|------|------|------|
| API 클라이언트를 `services/`로 분리하고 타입을 함께 수출 | `services/calorie-api.ts:3` | 화면이 응답 형태를 재정의하지 않게 함 |
| 응답을 런타임 검증 후 반환 | `calorie-api.ts:54`, `:83` | 서버 스키마 오류가 화면 크래시로 이어지지 않게 함 |
| 서버 오류 메시지를 파싱해 `Error`로 던짐 | `readErrorMessage` | 화면은 `error.message`만 알면 됨 |
| 세션을 Context 대신 모듈 싱글톤 + 리스너로 관리 | `services/auth-session.ts` | Provider 중첩 없이 어느 라우트에서든 바로 구독 |
| 인증 가드를 `<Redirect>` 선언형으로 구현 | `app/(tabs)/_layout.tsx`, `app/auth.tsx` | 루트 레이아웃의 `useEffect` + `router.replace()`는 네비게이터 마운트 전에 실행되어 `assertIsReady()` 예외를 던짐 |
| 기본 API URL에 `Platform.OS === 'android'` 분기 | `services/*.ts` | 에뮬레이터의 `10.0.2.2` 호스트 매핑 |
| 사진 선택 시 하위 상태를 전부 초기화 | `app/(tabs)/index.tsx:58` | 이전 예측/칼로리 결과가 새 사진에 남지 않게 함 |
| 그룹 진입점은 홈, 반려동물 진입점은 내 정보 | `app/(tabs)/home.tsx`, `app/(tabs)/account.tsx` | 매일 보는 곳이라야 모임이 굴러간다 (기획 목업 확정) |
| 탭 밖 스택(그룹·펫)은 네이티브 헤더 대신 `BackButton` | `components/back-button.tsx` | 중첩 Stack 헤더의 뒤로가기 귀속 문제를 피하고 기존 화면 골격(headerShown: false) 유지 |
| 목록 화면은 `useFocusEffect`로 포커스마다 재조회 | `app/groups/index.tsx`, `app/pets/index.tsx`, 상세 화면들 | 생성·수정 화면에서 돌아왔을 때 갱신 (홈 화면 패턴) |
| 펫 단건 조회는 목록에서 찾는다 | `app/pets/[id]/index.tsx` | 서버에 `GET /api/pets/{id}` 단건 API가 없음 (DATA_MODEL.md 9장) |
| `PetForm`은 서버 타입을 import 하지 않고 구조적 타입 선언 | `components/pet-form.tsx` | `components/ → services/` 의존 금지. `PetFormValue`는 `PetUpsertRequest`와 구조 호환 |
| 초대코드 공유는 RN `Share` 시트 | `app/groups/[id].tsx` | 추가 의존성 없이 OS 공유. 취소·미지원(web)은 오류로 취급하지 않음 |
| 예측 목록을 `score` 내림차순 정렬 후 표시 | `app/(tabs)/index.tsx:105` | 서버 정렬을 신뢰하지 않음 |
| `quality: 0.86`, `aspect: [4,3]`로 업로드 이미지 축소 | `app/(tabs)/index.tsx:53` | 업로드 크기와 지연 절감 |

## 선택지 데이터 규칙 (2026-07-09 확정)

온보딩의 질병·알러지 선택지는 앱 하드코딩이 아니라 **서버 참조 테이블이 정본**입니다 (`kcalAI-model/docs/DATA_MODEL.md` 10장). 화면은 진입 시 `GET /api/meta/options`로 칩 목록을 받아 그리고, 네트워크 실패 시 **번들 폴백 상수**(서버 시드와 동일한 code/label)로 그립니다 — 온보딩이 네트워크 오류로 막히면 안 됩니다. 서버로는 한국어 라벨이 아니라 **표준 code**를 보냅니다. '없음' 칩은 서버 값이 아니라 앱 전용입니다(replace-all PUT 빈 배열). 끼니·섭취량·혈액형처럼 화면 구조에 붙은 값은 코드 상수를 유지합니다.

## 의도적으로 하지 않은 것

- **상태 관리 라이브러리를 쓰지 않습니다.** `useState` + 모듈 싱글톤으로 충분한 규모입니다.
- **비밀번호가 없습니다.** 휴대폰 번호 + 일회용 코드가 유일한 인증 수단입니다.

## 미완성 설계 (구현 전 반드시 확인)

| 항목 | 현재 상태 | 필요한 결정 |
|------|-----------|-------------|
| ~~세션 영속화~~ | **완료.** `expo-secure-store`로 저장·복원 (웹은 메모리 폴백) | `services/auth-session.ts` |
| ~~토큰 사용~~ | **완료.** `apiFetch`가 세션 있으면 `Authorization: Bearer` 첨부, 401 시 세션 비움 | `services/http.ts`. 서버 `get_current_user` 도입 대기 |
| 로그아웃 | `clearAuthSession()`은 있으나 호출하는 UI 없음 | 로그아웃 진입점 위치 |
| 칼로리 프롬프트 | 앱에 하드코딩 (`calorie-api.ts:71`) | 서버 템플릿화 시점 |
| 다크모드 | 테마 인프라만 있고 실화면은 하드코딩 색상 | 색상 토큰으로 통일할지, 라이트 전용으로 확정할지 |
| 상태 탭 | 개발자용 진단 화면이 일반 탭에 노출 | 설정/개발자 영역으로 이동 (`docs/PROJECT_PLANNING.md`) |
| 템플릿 잔재 | `modal.tsx`, `hello-wave.tsx`, `parallax-scroll-view.tsx`, `collapsible.tsx`, react-logo 이미지 | 삭제 시점 |

## 새 API 클라이언트 추가 절차

1. `services/<domain>-api.ts` 파일을 만듭니다.
2. 서버 응답 형태를 `type`으로 선언하고 **export** 합니다. 필드명은 서버의 `snake_case`를 그대로 씁니다.
3. 기본 URL에 `Platform.OS === 'android'` 분기를 넣고, `EXPO_PUBLIC_*` 환경변수로 덮어쓸 수 있게 합니다.

```typescript
const DEFAULT_X_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/x' : 'http://127.0.0.1:8000/api/x';

export const X_API_URL = process.env.EXPO_PUBLIC_X_API_URL ?? DEFAULT_X_API_URL;
```

4. `async function`을 작성합니다. 반드시 다음 순서를 지킵니다.

```typescript
export async function doSomething(input: Input): Promise<Output> {
  const response = await fetch(X_API_URL, { method: 'POST', headers: {...}, body: ... });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `작업 실패: ${response.status}`);   // 한국어 폴백 메시지
  }

  const data = (await response.json()) as { field?: unknown };

  if (typeof data.field !== 'string') {                            // 런타임 검증 필수
    throw new Error('서버 응답에 field 값이 없습니다.');
  }

  return data.field;
}
```

5. 서버(`kcalAI-model`)에 해당 경로가 **실제로 존재하는지 확인합니다.** `/api/gpt-predict`처럼 없는 경로를 호출하는 코드가 이미 있습니다.

## 새 화면 추가 절차

1. `app/` 하위에 파일을 만듭니다. 파일명이 곧 경로입니다. **라우트가 아닌 파일을 `app/`에 두지 마세요.**
2. `export default function <Name>Screen()` 형태로 기본 export 합니다.
3. `SafeAreaView` → `ScrollView contentContainerStyle={styles.container}` 골격을 따릅니다.
4. 화면 전용 하위 컴포넌트는 **같은 파일 하단에 named function**으로 둡니다 (`ActionButton`, `PredictionRow`, `StatusItem`). 여러 화면이 공유할 때만 `components/`로 승격합니다.
5. `StyleSheet.create`를 파일 맨 아래에 둡니다.
6. 탭에 노출하려면 `app/(tabs)/_layout.tsx`에 `<Tabs.Screen>`을 추가합니다.

## 상태 관리 규칙

- 화면 로컬 상태는 `useState`. 파생 값은 `useMemo` (`confidence` 계산).
- 비동기 작업마다 별도의 `isXxx` 플래그를 둡니다 (`isUploading`, `isCalculating`, `isRequesting`, `isVerifying`). 하나의 `loading`으로 합치지 않습니다.
- 오류는 화면당 하나의 `errorMessage: string | null`로 모읍니다.
- 새 작업을 시작할 때 `setErrorMessage(null)`로 먼저 지웁니다.
- `finally`에서 로딩 플래그를 내립니다.

```typescript
setIsUploading(true);
setErrorMessage(null);
try {
  ...
} catch (error) {
  setErrorMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
} finally {
  setIsUploading(false);
}
```

## 오류 표시 규칙

| 상황 | 방식 |
|------|------|
| 권한 거부, 사용자 선행 조건 미충족 | `Alert.alert(제목, 안내문)` — 즉시 차단해야 하는 경우 |
| 네트워크·서버 오류 | 화면 내 `errorBox` 배너 (`#fff5f5` 배경 + `error-outline` 아이콘) |
| 서버가 준 메시지 | 그대로 표시. 없으면 `` `업로드 실패: ${response.status}` `` 같은 폴백 |

모든 사용자 노출 문자열은 **한국어**이며, 다음 행동을 알려주는 문장으로 씁니다.

- `'분석할 음식 사진을 먼저 촬영하거나 선택해주세요.'`
- `'음식 사진을 촬영하려면 카메라 권한을 허용해주세요.'`

## 디자인 토큰 (실화면 기준)

`constants/theme.ts`의 `Colors`는 템플릿 컴포넌트(`ThemedText` 등)만 사용합니다. 실제 화면은 아래 팔레트를 하드코딩합니다.

| 용도 | 값 |
|------|-----|
| 배경 | `#f7f8fa` |
| 카드 | `#ffffff` |
| 강조 / 프라이머리 | `#3182f6` |
| 강조 배경 | `#edf6ff`, `#f5f9ff` |
| 제목 텍스트 | `#191f28` |
| 본문 텍스트 | `#333d4b`, `#4e5968` |
| 보조 텍스트 | `#6b7684`, `#8b95a1` |
| 입력/채움 배경 | `#f2f4f6` |
| 비활성 | `#b4c7e7`, `#b0b8c1`, `#d1d6db`, `#e5e8eb` |
| 성공 | `#20c997` |
| 오류 | `#e5484d`, 배경 `#fff5f5` |
| 라운드 | `8` (pill은 `999`) |
| 눌림 상태 | `opacity: 0.74` |

새 화면은 이 팔레트를 따릅니다. **새로운 색상을 임의로 추가하지 마세요.** 토큰화가 필요하다고 판단되면 별도 작업으로 제안합니다.
