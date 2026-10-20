# NOWRO Android 웹앱 배포

NOWRO의 배포 목표는 PWA + Trusted Web Activity(TWA) 방식의 Google Play 설치 앱이다. 웹과 Android 앱이 같은 서버·계정·상점·스탬프 데이터를 사용한다. TWA는 브라우저 엔진으로 고정 HTTPS 사이트를 표시한다. 도메인과 앱 서명 인증서의 Digital Asset Links 검증에 성공해야 주소 표시줄 없이 열린다. 설치 패키지에 서버가 포함되는 방식이 아니므로 상시 서버가 필요하다.

## 이번 구현

- 앱 식별자·scope·영문 설명·브랜드 색상·탐색/저장 코스/스탬프 바로가기와 기존 실제 로고 아이콘을 PWA manifest에 설정했다.
- 탭 이동을 브라우저 이력에 연결하고 공통 상세창에 뒤로가기 닫기를 추가했다. `?tab=MAP`, `?tab=TRIP`, `?tab=PASSPORT`로 직접 실행할 수 있다.
- 연결 장애 시 별도 오프라인 안내와 재연결 버튼을 표시한다. 로그인·결제·스탬프·배송 데이터는 서비스 워커 캐시에 저장하지 않는다. 오프라인 결제·스탬프 적립은 지원하지 않는다.
- 서버 `/.well-known/assetlinks.json`은 실제 앱 ID와 인증서가 설정되었을 때만 JSON 인증 정보를 제공한다. 미설정 시 JSON 404를 반환하며 SPA 화면으로 대체하지 않는다.
- `npm run android:prepare -- android/release-config.json`은 고정 주소를 검증하고 Bubblewrap 제작 명령과 입력 정보를 `.data/android/`에 새로 만든다. 임시 trycloudflare 주소는 거절한다.

## Android 패키징 순서

1. 고정 HTTPS 주소를 배포한다. `/manifest.webmanifest`, 앱 아이콘, API와 로그인 메일 복귀를 확인한다. 호스팅은 Render 외 다른 서버도 가능하다.
2. `android/release-config.example.json`을 `android/release-config.json`으로 복사하고 실제 origin을 넣는다. `com.nowro.korea`는 제안한 앱 ID이며 Play Console에 최초 등록하기 전 사용 가능 여부와 소유 주체를 확정한다. 인증서는 처음에는 빈 배열로 둔다.
3. `npm run android:prepare -- android/release-config.json`으로 입력 파일을 생성한다. 출력된 제작 명령은 별도 빈 Android 프로젝트 폴더에서 실행한다. Google의 Bubblewrap CLI 1.26.0을 사용하도록 명령을 고정했다. 현재 Java/Android SDK 설치를 확인하지 못했으며 APK·AAB를 아직 생성하지 않았다.
4. SDK 설치 약관과 서명키 비밀번호는 소유자가 직접 확인하고 입력한다. 서명키·비밀번호를 소스 저장소나 채팅에 넣지 않는다.
5. 생성된 앱의 `targetSdkVersion`이 36 이상인지 확인한다. Google Play는 2026-08-31부터 일반 신규 Android 앱에 API 36 이상을 요구한다. Bubblewrap 버전만으로 이 요구 충족을 보장하지 않으므로 실제 생성된 Gradle 설정과 빌드를 확인한다.
6. `bubblewrap build`로 테스트 APK와 제출용 `app-release-bundle.aab`를 만든다. Google Play App Signing의 **앱 서명 인증서 SHA-256**을 확인한다. 업로드 키 인증서와 구분한다.
7. 서버 환경변수 `ANDROID_APP_ID`와 `ANDROID_SHA256_FINGERPRINTS`에 실제 값을 설정한다. 여러 실제 서명 인증서를 지원해야 하면 쉼표로 구분한다. 필요하면 설정 파일의 sha256Fingerprints 배열에도 같은 값을 넣어 인증 JSON을 생성한다. SHA-256 지문은 공개 정보이며 개인 서명키는 서버에 올리지 않는다.
8. 실제 앱 도메인의 `/.well-known/assetlinks.json`이 리다이렉트 없이 HTTPS 200/JSON을 반환하는지 확인하고 설치 앱에서 TWA 검증을 확인한다. 서비스 워커는 이 인증 파일을 캐시하지 않는다.
9. Play Console 내부 테스트에 AAB를 올려 실제 Android 기기에서 점검한다. 공개 출시는 별도 승인 단계다.

## 실제 기기 검증

- 첫 설치·재실행, 홈 화면 아이콘, 시스템 뒤로가기(창 닫기→이전 탭→앱 종료).
- 노치·하단 제스처 영역·키보드·작은 화면·글꼴 확대.
- 메일 링크를 누른 뒤 계정 확인, 외부 브라우저와 설치 앱의 로그인/쿠키 동작. TWA의 브라우저 선택에 따라 동작이 달라질 수 있으므로 실기기 검증이 필요하다.
- 위치 권한 거절 후 수동 지역 선택, QR 링크 복귀, 결제 검증·중복 적립 차단.
- 비행기 모드, 연결 복구, 서버 장애에서 미적립 기록을 성공으로 표시하지 않는지 확인.
- 앱 업데이트 및 서버 재배포 후 동일 계정 기록 유지.

## Google Play 제출 전 남은 것

Play Console 계정·개발자 확인, 개인정보처리방침과 데이터 보안 응답, 앱 안/웹에서 시작하는 계정 삭제 기능, 스토어 설명·스크린샷·콘텐츠 등급·심사자 로그인 접근을 준비한다. 신규 개인 개발자 계정이라면 해당 계정의 비공개 테스트 요구도 확인한다. 현재 샘플 개인정보 안내와 로컬 시험 결제를 정식 운영 기능으로 제출하지 않는다. 굿즈·현장 서비스와 디지털 상품은 결제 정책 적용이 다를 수 있으므로 판매 상품을 확정한 뒤 검토한다.

현재 상태는 Android 배포 기반 구현이며 Google Play 업로드·심사·출시 완료가 아니다.

## 공식 자료

- https://developer.chrome.com/docs/android/trusted-web-activity
- https://github.com/GoogleChromeLabs/bubblewrap/tree/main/packages/cli
- https://developer.android.com/training/app-links/configure-assetlinks
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://support.google.com/googleplay/android-developer/answer/9842756
- https://support.google.com/googleplay/android-developer/answer/13327111
- https://support.google.com/googleplay/android-developer/answer/14151465
