# NOWRO 고정 도메인 연결 체크리스트

## 도메인 등록 후 순서

- [x] `nowrokorea.com` 등록 완료(Spaceship).
- [ ] 도메인 등록 서비스에서 DNS 관리 화면을 연다.
- [ ] 고정 호스팅(Render 등)의 실제 서비스 주소를 먼저 확인한다.
- [ ] 루트 도메인과 `www` 주소를 고정 호스팅으로 연결한다.
- [ ] 호스팅에서 `nowro.com`, `www.nowro.com` 인증서를 발급한다.
- [ ] 두 주소 중 하나를 대표 주소로 정하고 다른 주소는 HTTPS로 리다이렉트한다.
- [ ] `PUBLIC_APP_URL=https://nowro.com/`를 운영 서버 환경변수에 설정한다.
- [ ] Supabase Authentication의 Site URL을 `https://nowro.com`으로 설정한다.
- [ ] Supabase Redirect URLs에 `https://nowro.com/`와 `https://www.nowro.com/`를 필요한 범위로 등록한다.
- [ ] 새 인증 메일의 링크가 localhost나 임시 Cloudflare 주소를 포함하지 않는지 확인한다.

## 연결 직후 검수

- [ ] PC와 모바일에서 `https://nowro.com` 접속
- [ ] `http://nowro.com`이 HTTPS로 이동
- [ ] `www` 주소가 대표 주소로 이동
- [ ] `/api/status`에서 `operatorPreview=false` 확인
- [ ] 회원가입·이메일 확인·로그인·로그아웃
- [ ] 다른 기기에서 저장 코스·스탬프 기록 복원
- [ ] 업체 신청과 관리자 승인 권한 확인
- [ ] 서버 재배포 후 기록 유지 확인
- [ ] 외부 임시 주소가 더 이상 안내 문구나 이메일에 남아 있지 않은지 확인

## 운영 전 주의

- 도메인 연결만으로 정식 출시가 완료되는 것은 아니다.
- 현재 샘플 장소와 미검증 콘텐츠는 현장 사용 대상이 아니다.
- 결제·QR·보상·배송은 실제 운영 연결과 별도 검수가 필요하다.
- DNS 전파 중에는 기존 주소와 새 주소가 동시에 다르게 응답할 수 있다.
