# CODE_STYLE

린트는 `eslint-config-expo` (flat config, `dist/*` 제외)만 적용됩니다. Prettier는 없습니다. 아래 규칙은 **기존 코드에서 실제로 관찰된 패턴**이며, 새 코드는 이를 따릅니다.

## 파일 배치

| 종류 | 위치 | 예시 |
|------|------|------|
| 라우트/화면 | `app/` | `app/auth.tsx`, `app/(tabs)/index.tsx` |
| 공유 컴포넌트 | `components/` | `components/chip-group.tsx` |
| 저수준 UI 프리미티브 | `components/ui/` | `components/ui/icon-symbol.tsx` |
| API 클라이언트·전역 상태 | `services/` | `services/calorie-api.ts` |
| 훅 | `hooks/` | `hooks/use-color-scheme.ts` |

**`app/`에는 라우트만 둡니다.** expo-router가 모든 파일을 화면으로 해석합니다.

## 네이밍

| 대상 | 규칙 | 예시 |
|------|------|------|
| 파일명 | `kebab-case` | `chip-group.tsx`, `use-color-scheme.ts`, `calorie-api.ts` |
| 라우트 파일 | expo-router 규약 | `_layout.tsx`, `(tabs)/`, `index.tsx` |
| 컴포넌트 | `PascalCase` | `ChipGroup`, `PredictionRow`, `ActionButton` |
| 화면 컴포넌트 | `<Name>Screen` | `HomeScreen`, `AuthScreen`, `TabTwoScreen` |
| 훅 | `use` 접두사 | `useThemeColor`, `useAuthSession` |
| 함수·변수 | `camelCase` | `pickFromCamera`, `topPrediction`, `isUploading` |
| 모듈 상수 | `UPPER_SNAKE_CASE` | `CALORIE_API_URL`, `DEFAULT_AUTH_API_URL` |
| 타입 | `PascalCase` | `Prediction`, `PhotoAsset`, `AuthTokenResponse` |
| 불리언 상태 | `is` 접두사 | `isUploading`, `isCalculating`, `isSignup` |
| 이벤트 핸들러 prop | `on` 접두사 | `onPress` |

**서버 응답 타입의 필드는 서버의 `snake_case`를 그대로 씁니다.** 변환하지 않습니다.

```typescript
export type AuthUser = {
  id: number;
  nickname: string | null;
  created_at: string;
};
```

## import

- 경로 별칭 `@/*`를 씁니다. `../../services/...` 같은 상대 경로를 쓰지 않습니다.
- 순서: 서드파티 → 빈 줄 → 로컬(`@/`).

```typescript
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CALORIE_API_URL, Prediction, uploadFoodPhoto } from '@/services/calorie-api';
```

- `react-native`에서 가져오는 심볼은 알파벳 순으로 정렬합니다.
- 타입만 import 할 때는 `import type`을 씁니다 (`services/auth-session.ts:3`).

## 타입

- `tsconfig.json`이 `strict: true`입니다. `any`를 쓰지 않습니다.
- 객체 타입은 `interface`가 아니라 `type`으로 선언합니다.
- 컴포넌트 props는 **인라인 타입**으로 선언합니다. 화면 내부 하위 컴포넌트에서 특히 그렇습니다.

```typescript
function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
```

여러 곳에서 재사용하는 props만 `export type XxxProps = ...`로 분리합니다 (`components/chip-group.tsx`).

- 서버 응답은 `unknown`으로 받아 좁힙니다.

```typescript
const data = (await response.json()) as { response_text?: unknown };

if (typeof data.response_text !== 'string') {
  throw new Error('서버 응답에 response_text 값이 없습니다.');
}
```

- 불가피한 캐스팅은 `as unknown as T`로 의도를 드러냅니다 (RN의 FormData 파일 객체).

```typescript
formData.append('file', { uri, name, type } as unknown as Blob);
```

## 컴포넌트

- 화면은 `export default function`. 그 외는 named export.
- 화면 전용 하위 컴포넌트는 **같은 파일 하단**에 named function으로 둡니다.
- `React.FC`를 쓰지 않습니다.
- `Pressable`의 눌림 상태는 스타일 배열로 표현합니다.

```typescript
<Pressable
  onPress={onPress}
  style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
```

- 조건부 렌더링은 `? :` 또는 `cond ? <X /> : null`. `&&`로 JSX를 렌더링하지 않습니다 (RN에서 `0`이 텍스트로 새는 것을 방지).

```typescript
{errorMessage ? (
  <View style={styles.errorBox}>...</View>
) : null}
```

- 리스트 `key`는 값 조합으로 안정화합니다: `` key={`${prediction.label}-${prediction.score}`} ``

## 스타일

- `StyleSheet.create`를 **파일 맨 아래**에 `const styles`로 둡니다.
- 스타일 키 이름은 역할 기반(`summaryCard`, `predictionRow`), 변형은 접미사(`primaryButtonDisabled`, `predictionRowSelected`, `statusDotActive`).
- 각 스타일 객체 내부 속성은 **알파벳 순**으로 정렬합니다.

```typescript
actionButton: {
  alignItems: 'center',
  backgroundColor: '#ffffff',
  borderRadius: 8,
  flex: 1,
  flexDirection: 'row',
  gap: 10,
  padding: 16,
},
```

- 인라인 스타일은 동적 값에만 씁니다: `` style={[styles.progressFill, { width: `${percent}%` }]} ``
- 색상은 소문자 6자리 hex (`#ffffff`, `#3182f6`). `docs/DESIGN.md`의 팔레트를 벗어나지 않습니다.
- 간격은 `gap`을 우선 사용합니다. `margin`으로 형제 간격을 만들지 않습니다.

## 서비스 모듈

```typescript
import { Platform } from 'react-native';

// 1. 타입 export
export type Prediction = { label: string; score: number };

// 2. 기본 URL + 플랫폼 분기
const DEFAULT_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/predict' : 'http://127.0.0.1:8000/api/predict';

// 3. 환경변수 override
export const CALORIE_API_URL = process.env.EXPO_PUBLIC_CALORIE_API_URL ?? DEFAULT_API_URL;

// 4. 공개 async 함수
export async function uploadFoodPhoto(asset: PhotoAsset): Promise<Prediction[]> { ... }

// 5. 모듈 내부 헬퍼 (파일 하단, export 안 함)
async function readErrorMessage(response: Response) { ... }
```

- 기본값은 `??`를 씁니다. `||`를 쓰지 않습니다 (빈 문자열이 유효값일 수 있음).
- 실패 시 `throw new Error('<한국어 메시지>')`. 화면이 `error.message`를 그대로 표시합니다.
- `services/`는 React를 import 하지 않습니다. 단, `auth-session.ts`의 `useAuthSession` 훅은 기존 예외입니다.

## 문자열

- 사용자 노출 문자열은 **한국어**. i18n 프레임워크는 없습니다.
- 따옴표는 작은따옴표(`'`). JSX 속성은 큰따옴표(`"`).
- 템플릿 리터럴은 보간이 있을 때만 씁니다.

## 주석

- 코드로 드러나지 않는 이유만 짧게 적습니다. 현재 코드에 주석이 거의 없습니다.
- JSDoc을 쓰지 않습니다.

## 금지 패턴

| 금지 | 대신 |
|------|------|
| `npm run reset-project` | 실행하지 않음 (`app/`을 파괴적으로 이동) |
| `app/`에 라우트 아닌 파일 배치 | `components/` 또는 `services/` |
| 루트 레이아웃에서 `router.replace()` 호출 | `<Redirect href="..." />` (네비게이터 마운트 전 호출 시 예외) |
| 화면에서 `fetch` 직접 호출 | `services/<domain>-api.ts`에 함수 추가 |
| `services/`에서 컴포넌트/JSX 작성 | `components/` |
| `components/`가 `services/`를 import | props로 주입 |
| `any` | `unknown` + 타입 가드 |
| `interface Props {}` | 인라인 타입 또는 `type XxxProps` |
| `{cond && <View />}` | `{cond ? <View /> : null}` |
| `value \|\| default` | `value ?? default` |
| 상대 경로 `../../services/x` | `@/services/x` |
| 응답 JSON을 검증 없이 사용 | `typeof` / `Array.isArray` 가드 |
| 서버 필드명을 camelCase로 변환 | `snake_case` 그대로 유지 |
| `EXPO_PUBLIC_*`에 비밀값 | 클라이언트 번들에 평문 노출됨 |
| `Platform.OS` 분기 없는 기본 URL | Android 에뮬레이터에서 `10.0.2.2` 필요 |
| 새 색상 하드코딩 | `docs/DESIGN.md` 팔레트 사용 |
| 영어 사용자 문구 | 한국어 |

## 공통 HTTP 모듈

네트워크 공통 코드는 `services/http.ts`에 있습니다.

- `readErrorMessage(response)` — 서버 오류 메시지 추출. 배열 `detail`(Pydantic 422)을 `\n`으로 join 합니다. `auth-api.ts`·`calorie-api.ts`가 공유합니다. **재정의하지 마세요.**
- `apiFetch(input, init)` — 세션이 있으면 `Authorization: Bearer <access_token>`을 붙이고, `401`이면 `clearAuthSession()`으로 세션을 비웁니다. 인증이 필요한 요청은 `fetch` 대신 `apiFetch`를 씁니다.

인증 API(`kakao/login`, `kakao/signup`)는 세션 발급 전 단계라 **순수 `fetch`**를 씁니다 (헤더 미첨부). `logout`만 `apiFetch`로 Bearer를 붙입니다.

## 테스트 스타일

<!-- TODO: 확인 필요 - 테스트 프레임워크가 도입되어 있지 않습니다. jest-expo, @testing-library/react-native 모두 미설치이며 테스트 파일이 없습니다. -->

현재 검증 수단은 `npx tsc --noEmit`와 `npm run lint` 두 가지뿐입니다.
