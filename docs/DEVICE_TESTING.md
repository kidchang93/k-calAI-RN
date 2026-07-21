# 실기기·로컬 테스트 가이드

> 2026-07-21 개정. 이전 판은 "커스텀 네이티브 모듈이 없어 Expo Go + QR로 실행 가능, dev build 불필요"라고
>적혀 있었으나 **실태와 어긋난다** — 카카오 로그인이 Expo Go에서 동작하지 않아 로그인 이후 화면을 볼 수 없다.

## 어떤 방법으로 확인할 것인가

| 경로 | 로그인 | 무엇을 볼 수 있나 | 속도 |
|---|---|---|---|
| **A. 웹 브라우저** (권장) | 개발용 우회 가능 | **거의 전부** — 결제·카메라 빼고 | 가장 빠름 |
| **B. `expo run:ios`** (실기기·시뮬레이터) | 카카오 로그인 필요 | 전부 (실제 앱과 동일) | 느림(빌드) |
| **C. Expo Go + QR** | ❌ **안 됨** | 로그인 화면까지만 | 빠름 |

**대부분의 확인은 A로 끝난다.** 이 저장소의 기능 검증(추천·기록·운동·챌린지·코칭)은 전부 웹에서 이뤄졌다.
실기기가 꼭 필요한 것은 카메라 촬영, 딥링크 복귀, 네이티브 화면 크기·안전영역 정도다.

---

## A. 웹 브라우저 (가장 빠름)

```bash
./dev.sh web          # 워크스페이스 루트: Postgres + 서버(8000) + Expo 웹(8081)
```

로그인은 **개발용 우회 스크립트**를 쓴다 (카카오 로그인이 로컬에서 막히는 이유는 아래 참조):

```bash
cd kcalAI-model
venv/bin/python scripts/dev_login.py --conditions ckd     # 질병 조건도 지정 가능
```

출력된 `localStorage.setItem(...)` 한 줄을 **http://localhost:8081 브라우저 콘솔**에 붙여넣으면 로그인 상태가 된다.
프로필·목표·동의까지 채워져 있어 온보딩으로 튕기지 않는다.

⚠️ `localStorage`는 **오리진마다 따로**다. 8081에 심은 세션은 8000에서 쓸 수 없다(그 반대도 마찬가지).

## B. `expo run:ios` — 실기기·시뮬레이터

절차는 **`docs/LOCAL_BUILD.md`가 정본**이다(CNG 방식: `expo prebuild` → `expo run:ios`). `package.json`의
`npm run ios`/`npm run android`가 이 경로다.

### ⚠️ 실기기에서는 로그인 우회를 쓸 수 없다

`dev_login.py`가 내주는 세션은 웹의 `localStorage`에 심는 것이다. 네이티브 앱은 세션을 `expo-secure-store`에
보관하므로 **붙여넣을 방법이 없다**. 즉 실기기에서는 **카카오 로그인이 실제로 되어야** 로그인 이후 화면을 볼 수 있다.

그런데 **로컬 서버에 붙이면 카카오 로그인이 실패한다** — 카카오 앱에 허용 IP 제한이 걸려 있어 개발 머신의
공인 IP가 등록돼 있지 않으면 `-401 ip mismatched`가 난다 (서버 `CLAUDE.md` 알려진 문제 12). 진단:

```bash
cd kcalAI-model && venv/bin/python scripts/check_kakao_config.py
```

실기기에서 로그인까지 보려면 셋 중 하나를 골라야 한다:

1. **카카오 콘솔 > 앱 설정 > 보안 > 허용 IP**에 지금 공인 IP 추가 — 유동 IP라 바뀌면 또 막힌다.
2. **개발용 카카오 앱을 따로** 만들어 IP 제한 없이 쓰고, 로컬 `.env`의 키 3종만 그 앱 것으로 교체. (재발 없음)
3. `.env`의 `EXPO_PUBLIC_*_API_URL`을 **운영 서버**(`https://api.kcalai.link`)로 지정.
   ⚠️ 이때 만드는 기록·결제는 **운영 데이터**다. 읽기 위주 확인에만 쓴다.

## C. Expo Go — 지금은 반쪽만 된다

앱은 열리지만 **카카오 로그인이 동작하지 않는다.** Expo Go의 스킴이 `exp://`인데 서버는 `kcalairn://auth`로만
되돌리기 때문이다 (`CLAUDE.md` 알려진 문제 9). 따라서 로그인 화면까지만 볼 수 있다.

> **앞으로**: Apple 건강·Health Connect 연동(서버 `docs/ACTIVITY_GUIDANCE.md` 3-3)을 넣으면 커스텀 네이티브
> 모듈이 들어와 **Expo Go에서 아예 실행되지 않는다.** 그때는 이 경로가 사라지고 B만 남는다. 대신 **dev client**를
> 한 번 빌드해 폰에 설치하면 QR·핫리로드 개발 흐름은 그대로 유지된다.

---

## API base URL은 어떻게 정해지나

`services/api-base.ts`가 **Expo 개발 서버 호스트(`Constants.expoConfig.hostUri`)에서 Mac의 LAN IP를 자동으로
꺼내** `http://<LAN_IP>:8000`으로 백엔드를 호출한다. 폰이 붙은 그 IP를 그대로 쓰므로 별도 설정 없이 닿는다.

- 시뮬레이터/에뮬레이터는 `127.0.0.1`(iOS)·`10.0.2.2`(Android)로 폴백.
- 특정 서버로 강제하려면 `.env`에 `EXPO_PUBLIC_*_API_URL` 지정(오버라이드 우선). `.env.example` 참조.

## 백엔드 준비 (B·C 공통)

```bash
./dev.sh server                    # uvicorn --host 0.0.0.0 --port 8000
ipconfig getifaddr en0             # Mac LAN IP 확인
curl -sf http://<LAN_IP>:8000/openapi.json >/dev/null && echo OK
```

`0.0.0.0` 바인딩이라 LAN의 다른 기기(폰)에서 접근 가능하다.

## 트러블슈팅

| 증상 | 원인·해결 |
|------|-----------|
| 카카오 로그인이 `kakao_unavailable`로 끝남 | 허용 IP 미등록이 가장 흔하다. `scripts/check_kakao_config.py`로 판정. 위 B의 1~3 중 선택 |
| 로그인 후 8000 화면으로 떨어짐 | 서버가 `/auth`로 **상대 경로** 리다이렉트해서다(운영은 같은 오리진이라 정상). 로컬 웹 개발에서는 A 경로(우회 로그인)를 쓴다 |
| QR 스캔 후 앱이 안 뜸 | iPhone·Mac이 **같은 Wi-Fi**인지 확인. VPN 끄기 |
| 앱은 뜨는데 네트워크 오류 | 백엔드 미기동 또는 방화벽. `curl http://<LAN_IP>:8000/openapi.json`. macOS 방화벽에서 python/uvicorn 허용 |
| 회사/게스트 Wi-Fi라 기기 격리 | `npx expo start --tunnel`(느림). 이때는 백엔드도 폰에서 못 닿으므로 `EXPO_PUBLIC_*_API_URL`을 공개 주소로 지정. 개인 핫스팟 권장 |
| LAN IP가 바뀜 | `expo start` 재기동하면 새 IP가 반영된다(앱이 hostUri에서 자동 도출) |

## 검증 상태

- ✅ A 경로(웹 + `dev_login.py`)로 추천·기록·운동·목표·챌린지·코칭 전 기능 확인 (2026-07-21).
- ⚠️ B 경로(실기기 빌드)와 카메라·딥링크는 **물리 기기가 필요**해 확인하지 못했다 — 사용자 수동 단계다.
