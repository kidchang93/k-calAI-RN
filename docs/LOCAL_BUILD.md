# 로컬 네이티브 빌드 (iOS)

Expo Go 대신 **실제 앱 바이너리**를 로컬에서 빌드해 시뮬레이터/실기기에서 실행하는 방법.
네이티브 프로젝트는 **CNG(Continuous Native Generation)** 방식이라 `ios/`·`android/`는 gitignore된다 —
`expo prebuild`로 언제든 재생성한다(커밋하지 않는다).

## 툴체인 (macOS)

| 도구 | 확인 | 없으면 |
|------|------|--------|
| Xcode (full) | `xcodebuild -version` | App Store에서 설치 후 `sudo xcodebuild -license accept` |
| Xcode 커맨드라인 | `xcode-select -p` | `xcode-select --install` |
| CocoaPods | `pod --version` | `gem install cocoapods` (또는 `brew install cocoapods`) |
| Node | `node --version` | (이미 있음) |
| watchman | `watchman --version` | `brew install watchman` (선택) |
| iOS 시뮬레이터 | `xcrun simctl list devices available` | Xcode > Settings > Components에서 런타임 설치 |

> **rbenv 사용 시 주의**: `gem install cocoapods`가 `~/.rbenv/versions/<ver>/bin/pod`에 설치되는데
> 셸에 shim이 없을 수 있다. 빌드 전 그 경로를 PATH에 넣는다:
> `export PATH="$HOME/.rbenv/versions/3.4.8/bin:$PATH"`. CocoaPods는 UTF-8 로케일이 필요하니
> `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`도 설정한다.

## 시뮬레이터 빌드/실행 (권장 시작점)

`k-calAI-RN/`에서:

```bash
export PATH="$HOME/.rbenv/versions/3.4.8/bin:$PATH"   # rbenv pod을 PATH에 (해당 시)
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# 1) 네이티브 iOS 프로젝트 생성 (ios/ 는 gitignore, 재생성 안전)
npx expo prebuild --platform ios

# 2) 빌드 + 시뮬레이터 실행 (pod install 자동, 첫 빌드는 10분+)
npx expo run:ios
```

`run:ios`가 Pod 설치 → xcodebuild → 시뮬레이터 부팅 → 앱 설치·실행까지 한다. 특정 시뮬레이터를
고르려면 `npx expo run:ios --device "iPhone 17 Pro"`.

**백엔드**: 앱은 `services/api-base.ts`가 자동으로 로컬 백엔드(`http://<LAN_IP or 127.0.0.1>:8000`)에
붙는다. 먼저 워크스페이스 루트에서 `./dev.sh server`로 서버를 띄운다. 시뮬레이터는 `127.0.0.1`로
호스트에 닿는다.

## 실기기(iPhone) 빌드 — Apple 서명 필요 (수동)

실기기 설치는 **Apple 개발자 서명**이 있어야 한다. 이 부분은 사람이 Xcode UI에서 해야 한다:

1. **Apple 계정 준비**: 무료 Apple ID로도 개인 기기 테스트 서명이 가능하다(7일 만료·기기 제한).
   지속적 배포는 유료 Apple Developer Program($99/년)이 필요.
2. **Xcode에 계정 추가**: Xcode > Settings > Accounts > `+` > Apple ID 로그인.
3. **워크스페이스 열기**: `open ios/kcalAIRN.xcworkspace` (⚠️ `.xcodeproj` 아니라 `.xcworkspace`).
4. **서명 설정**: 프로젝트 `kcalAIRN` 타깃 > Signing & Capabilities >
   - "Automatically manage signing" 체크
   - Team: 위에서 추가한 개인 팀(Personal Team) 선택
   - Bundle Identifier가 고유해야 함(`com.kcalai.kcalairn`이 이미 쓰이면 뒤에 접미사 추가:
     `com.<본인>.kcalairn`). 값은 `app.json`의 `ios.bundleIdentifier`와 맞춘다.
5. **기기 연결·신뢰**: iPhone을 케이블로 연결 → 기기에서 "이 컴퓨터를 신뢰" → Xcode 상단 기기 선택.
6. **빌드/실행**: `npx expo run:ios --device`로 연결된 실기기를 고르거나, Xcode에서 ▶︎ Run.
7. **기기에서 개발자 신뢰**: 첫 실행 시 iPhone > 설정 > 일반 > VPN 및 기기 관리 >
   개발자 앱에서 본인 인증서를 "신뢰"로 설정.
8. 무료 계정은 서명이 **7일 뒤 만료**되어 재빌드가 필요하다.

> CLI로는 서명을 대신 설정할 수 없어(개인 인증서·Team 선택은 Xcode/Apple 계정 필요) 위 단계는 수동이다.

## CNG·재생성 규칙

- `ios/`·`android/`는 gitignore된다. 커밋 대상은 `app.json`(설정)뿐이다.
- 네이티브 설정을 바꾸려면 `app.json`/플러그인을 수정하고 `npx expo prebuild --clean`으로 재생성한다.
  네이티브 폴더를 직접 손으로 고치지 않는다(다음 prebuild에서 덮인다).

## 트러블슈팅

| 증상 | 해결 |
|------|------|
| `pod: command not found` | rbenv 경로를 PATH에 (위 주의) 또는 `brew install cocoapods` |
| `CocoaPods requires UTF-8` 경고/실패 | `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` |
| prebuild가 bundleIdentifier를 물음 | `app.json`의 `ios.bundleIdentifier`를 먼저 지정(이미 `com.kcalai.kcalairn`) |
| 빌드 캐시 꼬임 | `npx expo prebuild --clean` 후 `ios/Pods` 삭제 → `pod install` 재실행 |
| 시뮬레이터 안 뜸 | `xcrun simctl list devices available`로 런타임 확인, Xcode에서 시뮬레이터 다운로드 |
