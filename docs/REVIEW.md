# REVIEW

## 머지 전 필수 통과 조건

```bash
npx tsc --noEmit       # 반드시 0 exit
npm run lint           # 반드시 0 exit
```

두 명령 모두 현재 main에서 통과합니다. **회귀시키지 마세요.**

자동화된 테스트가 없으므로 UI 변경은 **실제 실행 확인**이 게이트입니다.

```bash
# 서버 먼저 기동 (별도 저장소)
cd ../kcalAI-model && docker compose up -d postgres && uvicorn main:app --port 8000

npm start              # 그 다음 앱
```

| 조건 | 확인 방법 |
|------|-----------|
| 타입 체크 통과 | `npx tsc --noEmit` |
| 린트 통과 | `npm run lint` |
| 변경한 화면이 iOS/Android 중 최소 하나에서 렌더된다 | `npm run ios` 또는 `npm run android` |
| 네트워크 코드를 바꿨다면 Android 에뮬레이터에서도 확인 | `10.0.2.2` 분기 |
| 서버 API 계약을 바꿨다면 `kcalAI-model`을 함께 수정했다 | 두 저장소 diff |
| 새 환경변수가 문서화되어 있다 | `CLAUDE.md` 환경변수 표 |

## 리뷰 체크리스트

### Correctness

- [ ] `fetch` 응답을 런타임 검증(`typeof`, `Array.isArray`)한 뒤 사용하는가.
- [ ] `!response.ok` 분기가 있고 `readErrorMessage` + 한국어 폴백 메시지를 던지는가.
- [ ] `try/catch/finally`에서 로딩 플래그를 `finally`에 내리는가.
- [ ] 새 작업 시작 시 `setErrorMessage(null)`로 이전 오류를 지우는가.
- [ ] 사진을 새로 선택하면 하위 상태(`predictions`, `selectedPrediction`, `calorieResult`)를 초기화하는가.
- [ ] `useEffect` 의존성 배열이 정확한가.
- [ ] **루트 레이아웃(`app/_layout.tsx`)에서 `router.replace()`/`router.push()`를 호출하지 않는가.** 네비게이터 마운트 전에 실행되어 `Attempted to navigate before mounting the Root Layout component` 예외가 납니다. 가드는 `<Redirect>`로 겁니다.
- [ ] 리스트 `key`가 인덱스가 아니라 안정적인 값 조합인가.
- [ ] `{cond && <JSX/>}`로 렌더링하지 않았는가. (RN에서 `0`이 새어나갑니다)
- [ ] `??`를 썼는가. `||`가 아닌가.

### 플랫폼

- [ ] 새 기본 URL에 `Platform.OS === 'android'` 분기가 있는가.
- [ ] `FormData` 구성이 web(`Blob`)과 native(`{uri,name,type}`)로 분기되는가.
- [ ] 네이티브 권한을 쓴다면 `app.json`에 권한 문구가 있는가.
- [ ] 플랫폼 전용 파일(`.ios.tsx`, `.web.ts`)이 필요한 경우 파일명 접미사를 썼는가.

### 레이어

- [ ] 화면이 `fetch`를 직접 호출하지 않는가.
- [ ] `services/`가 컴포넌트/JSX를 포함하지 않는가.
- [ ] `components/`가 `services/`를 import 하지 않는가.
- [ ] `app/`에 라우트가 아닌 파일을 추가하지 않았는가.
- [ ] `@/` 별칭을 썼는가. 상대 경로가 아닌가.

### API 계약

- [ ] 호출하는 경로가 `kcalAI-model`에 **실제로 존재하는가.** (`curl -sf localhost:8000/openapi.json`로 확인)
- [ ] 응답 타입의 필드명이 서버의 `snake_case`와 일치하는가.
- [ ] 서버 스키마가 바뀌었다면 `services/*.ts`의 `type`을 함께 고쳤는가.
- [ ] 새 엔드포인트에 `Authorization` 헤더가 필요한지 확인했는가. (현재 서버는 토큰을 검증하지 않습니다)

### 스타일

- [ ] `StyleSheet.create`가 파일 맨 아래에 있는가.
- [ ] 스타일 객체 속성이 알파벳 순인가.
- [ ] `docs/DESIGN.md` 팔레트 밖의 색상을 새로 만들지 않았는가.
- [ ] 형제 간격을 `margin`이 아니라 `gap`으로 만들었는가.
- [ ] 사용자 노출 문자열이 한국어인가.

### 보안 / 개인정보

- [ ] `EXPO_PUBLIC_*` 환경변수에 비밀값이 없는가. **번들에 평문으로 들어갑니다.**
- [ ] `dev_code`(서버가 개발 편의로 내려주는 인증번호)를 프로덕션 UI에 노출하지 않는가.
- [ ] `access_token`을 로그(`console.log`)에 출력하지 않는가.
- [ ] 사용자 사진을 앱이 로컬에 임의 저장하지 않는가.
- [ ] `.env*.local`이 커밋에 없는가.

### 테스트

- [ ] <!-- TODO: 확인 필요 - 테스트 프레임워크 미도입. 도입 전까지는 실행 확인 결과를 PR 본문에 기록합니다. -->

## 리뷰 시 흔한 실수

| 실수 | 왜 문제인가 |
|------|-------------|
| 서버 오류 메시지를 그대로 신뢰 | `/api/predict`, `/api/gpt-predict`는 사용자용 한국어 `detail`을 주지만, `/api/s3/*`는 boto3 내부 예외를 담아 보냅니다. |
| 로그인 상태가 앱 재시작 후에도 유지된다고 가정 | `auth-session.ts`는 모듈 전역 변수입니다. 영속화가 없습니다. |
| `access_token`이 요청에 붙는다고 가정 | 어떤 `fetch`에도 `Authorization` 헤더가 없습니다. |
| `ThemedText`/`Colors`가 실제 화면에 적용된다고 가정 | 실화면은 하드코딩 색상을 씁니다. 다크모드가 동작하지 않습니다. |
| `127.0.0.1`로 Android 에뮬레이터 테스트 | 에뮬레이터 자신을 가리킵니다. `10.0.2.2`여야 합니다. |
| `app/`에 헬퍼 파일 추가 | expo-router가 라우트로 등록합니다. |
| `readErrorMessage`를 한쪽만 수정 | `auth-api.ts`와 `calorie-api.ts`에 중복 정의되어 있고 동작이 다릅니다. |
| `hello-wave.tsx`, `parallax-scroll-view.tsx`, `modal.tsx`를 실사용 코드로 취급 | Expo 템플릿 잔재입니다. |
| `npm run reset-project` 실행 | `app/`을 `app-example/`로 옮기고 스캐폴드로 덮어씁니다. |

## 커밋

- 커밋 메시지는 한국어 `<type>: <요약>` 형식입니다. 관찰된 타입: `feat`, `chore`, `test`.
- API 계약 변경 커밋은 `kcalAI-model` 대응 커밋과 짝을 이룹니다.
- 현재 `services/auth-session.ts`가 미추적 상태이고 `app/_layout.tsx`, `app/auth.tsx`에 미커밋 변경이 있습니다. 새 작업 전에 이 상태를 정리할지 사용자에게 확인하세요.
