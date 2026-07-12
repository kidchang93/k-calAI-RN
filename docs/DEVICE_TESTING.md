# 실기기(iPhone) 테스트 가이드

이 앱은 커스텀 네이티브 모듈이 없어(전부 Expo SDK 모듈) **Expo Go + QR**로 실기기에서 바로 실행할 수 있다. dev build 불필요.

## 0. 준비 (수동)

- [ ] **iPhone에 Expo Go 설치** — App Store에서 "Expo Go".
- [ ] **iPhone과 Mac이 같은 Wi-Fi**에 연결. (사내/게스트 Wi-Fi는 기기 간 통신을 막기도 한다 → 안 되면 아래 트러블슈팅.)

## 1. 백엔드 서버 기동

워크스페이스 루트(`kcal/`)에서:

```bash
./dev.sh server        # kcalAI-model 서버만 기동 (uvicorn --host 0.0.0.0 --port 8000)
```

`0.0.0.0` 바인딩이라 LAN의 다른 기기(폰)에서 접근 가능하다. 확인:

```bash
# Mac의 LAN IP 확인
ipconfig getifaddr en0            # 예: 192.168.25.43
# 그 IP로 서버가 응답하는지
curl -sf http://<LAN_IP>:8000/openapi.json >/dev/null && echo OK
```

## 2. Expo 개발 서버 기동

`k-calAI-RN/`에서 **대화형 터미널**로:

```bash
npx expo start
```

터미널에 **QR 코드**와 `exp://<LAN_IP>:8081` URL이 뜬다. (LAN 모드가 기본. QR은 이 터미널에만 표시되므로 직접 실행해야 한다.)

## 3. iPhone에서 접속

- iPhone **기본 카메라 앱**으로 터미널의 QR을 비춘다 → "Expo Go에서 열기" 배너 탭.
- Expo Go가 번들을 내려받아 앱이 뜬다.

## API base URL은 어떻게 정해지나

`services/api-base.ts`가 **Expo 개발 서버 호스트(`Constants.expoConfig.hostUri`)에서 Mac의 LAN IP를 자동으로 꺼내** `http://<LAN_IP>:8000`으로 백엔드를 호출한다. 즉 폰이 QR로 붙는 그 IP를 그대로 쓰므로 **별도 설정 없이 실기기에서 백엔드에 닿는다.**

- 시뮬레이터/에뮬레이터에서는 `127.0.0.1`(iOS)·`10.0.2.2`(Android)로 폴백.
- 특정 서버로 강제하려면 `.env`에 `EXPO_PUBLIC_*_API_URL`을 지정(오버라이드 우선). `.env.example` 참조.

## 트러블슈팅

| 증상 | 원인·해결 |
|------|-----------|
| QR 스캔 후 앱이 안 뜸 | iPhone·Mac이 **같은 Wi-Fi**인지 확인. VPN 끄기. |
| 앱은 뜨는데 로그인/조회가 네트워크 오류 | 백엔드가 안 떠 있거나 방화벽. `curl http://<LAN_IP>:8000/openapi.json`로 확인. macOS 방화벽에서 python/uvicorn 허용. |
| 회사/게스트 Wi-Fi라 기기 격리됨 | `npx expo start --tunnel`(느림). 단 이때는 백엔드도 폰에서 못 닿으므로 `EXPO_PUBLIC_*_API_URL`을 공개 접근 가능한 주소로 지정해야 함. 가능하면 개인 Wi-Fi/핫스팟 사용 권장. |
| LAN IP가 바뀜 | Wi-Fi 재접속 시 IP가 바뀔 수 있다. `expo start`를 재기동하면 새 IP가 반영된다(앱이 hostUri에서 자동 도출). |

## 이 문서 작성 시 검증한 것 / 하지 못한 것

- ✅ 백엔드가 LAN IP:8000에서 200 응답, Metro 정상 부팅, `tsc`/`lint` 통과.
- ⚠️ 실제 iPhone에서의 최종 표시·플로우는 **물리 기기가 필요**해 여기서 확인하지 못했다 — 위 3단계가 사용자 수동 단계다.
