# 실행·연결·운영 가이드

## 현재 운영 범위

이 프로젝트는 샘플 데이터로 검증하는 localhost 개발판입니다. 프런트만 공개 배포해도 API가 연결되지 않으며, localhost 운영자 테스트 계정을 공개 서비스의 인증으로 사용할 수 없습니다. 실제 업체 쿠폰으로 오해하지 않도록 화면 전체에 샘플 고지를 유지합니다.

## 환경변수

`.env.example`을 프로젝트 폴더의 `.env`로 복사해 설정합니다. `.env`, SQLite 파일과 테스트 화면은 Git 제외 대상입니다.

| 변수                                       | 목적                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `PORT`, `HOST`                             | 기본 8787, 127.0.0.1. 샘플 서버의 공개 바인딩은 차단                                |
| `DATA_DIR`                                 | SQLite 저장 폴더. 기본 `.data`                                                      |
| `ENABLE_LOCAL_OPERATOR_PREVIEW`            | localhost 테스트 계정만 활성화. dev 명령은 true, start는 기본 false                 |
| `OPENAI_API_KEY`                           | 서버 전용 Responses API 키                                                          |
| `OPENAI_MODEL`                             | 계정에서 사용 가능하고 Structured Outputs를 지원하는 모델 ID. 임의 모델·요금 미가정 |
| `OPENAI_DAILY_CALL_LIMIT`                  | 서버 전체 일 호출 상한. 기본 50. 실패 호출도 보수적으로 카운트                      |
| `VITE_MAP_TILE_URL`                        | 공개 타일 URL. 기본 OpenStreetMap 개발용 URL. 비밀키 사용 금지                      |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | 다음 단계 계정·DB 연결에 필요한 값. 현재 서버에서 사용하지 않음                     |

OpenAI 코드가 보내는 데이터는 사용자가 자연어 입력란에 직접 작성한 요청뿐입니다. GPS, 구조화한 숙소 좌표·코스·이름·개인 동선은 자동으로 보내지 않습니다. 입력란에 개인정보를 넣지 않도록 안내합니다. API 응답의 등록 장소나 추천 사실을 신뢰하는 설계가 아니며 장소 추천·시간·비용은 코드로 계산합니다. 실제 비용 정산은 공급자 사용량·과금 내역을 연결하는 후속 작업입니다.

## Supabase 연결 순서

1. 사용자가 NOWRO 전용 프로젝트와 연결 계정을 지정합니다. 다른 프로젝트나 기존 테이블을 임의로 수정하지 않습니다.
2. 실제 서비스의 email OTP / magic link와 허용 redirect URL을 설정합니다. 한국 전화번호는 요구하지 않습니다.
3. `supabase/schema.sql`은 **준비 스키마**이며 원격에 적용하지 않았습니다. 로컬 PostgreSQL에서 RLS·소유권·RPC를 실행 검증했습니다. 빈 개발 DB에서만 검토·적용하세요.
4. 실제 Supabase CLI 버전을 확인하고 `--help`로 명령을 확인합니다. 스키마를 로컬 개발 DB에서 검증한 후 security advisors를 실행하고 CLI로 migration 파일을 생성합니다. 현재 파일은 migration 이력으로 위장하지 않습니다.
5. 운영자 회원·업체 소유권은 검증된 운영 절차로 `nowro_private`에 등록합니다. 사용자가 수정 가능한 `user_metadata`로 권한을 부여하지 않습니다.
6. 로컬 SQLite Store를 Supabase adapter로 교체합니다. 클라이언트 저장은 사용자 JWT + RLS, 쿠폰·증빙은 RPC, AI·QR 서명은 서버 또는 Edge Functions로 구현합니다.
7. QR RPC의 nonce에는 Edge Functions의 HMAC 서명 검증을 추가합니다. 준비 스키마에는 nonce·만료·1회용 검사가 있고, 로컬 서버에는 HMAC까지 구현되어 있습니다. 원격 서명 처리는 아직 배포하지 않았습니다.
8. 관리자 승인·사업자 쿠폰 생성·사진 업로드·집계 RPC와 Storage bucket 정책을 추가하고 실제 Supabase 환경에서 사용자 A/B·사업자 A/B 테스트를 실행합니다.
9. 비회원 → 회원 이관은 **현재 세션 소유 증명을 서버에서 확인한 뒤** 해당 사용자의 기록만 트랜잭션으로 이전합니다. 사용자 제공 guest ID만으로 이관하지 않습니다. 이관 UI·실서비스 로직은 아직 없습니다.

`schema.sql`의 공개 함수는 SECURITY INVOKER이며, 수량·사용 상태 변경에 필요한 권한 상승은 공개되지 않는 스키마의 제한된 함수에 있습니다. 내부 함수마다 `auth.uid()`, 소유권 검사와 고정 search_path를 적용했습니다. 클라이언트는 발급·사용 상태와 스탬프를 테이블에 직접 쓰지 못합니다. 스키마의 `trips.route_snapshot` 자체는 실행 가능성을 보장하는 증빙이 아니며, 실서비스 API 저장·재추천에도 현재 코스 엔진 검증을 적용해야 합니다.

## 데이터 관리

- 초기 fixtures는 `shared/catalog.ts`. 공개 장소·조건은 데이터 객체에서 읽고 승인 후 SQLite `places`로 저장합니다. fixture 재시드는 새 DB에서만 반영되며 서버가 기존 승인정보를 덮어쓰지 않습니다.
- 로컬 사업자 계정은 `g-cafe` 한 장소에만 배정된 테스트 계정입니다. 실제 사업자 생성·소유권 검증은 후속 개발입니다.
- 수정 요청은 가격 상한·체류시간만 지원합니다. 실제 운영시간·예외일·번역·사진 수정 승인 UI는 후속입니다.
- 실제 장소 출처·최종 확인일·가격범위·휴무·최종 입장·예약·외국어·식이·접근성·사진 라이선스를 업체에서 검증해야 샘플 표시를 제거할 수 있습니다.
- 현재 모든 장소의 실제 식이·어린이·접근성은 미확인입니다. 해당 확인 필터를 선택하면 결과 없음으로 처리합니다.
- 쿠폰은 발급 가능→보유→사업자 확인 후 사용 완료. 중지·기간·1인1회·총 발급 상한·최소금액을 검사합니다. 로컬 총 사용 상한은 발급 상한과 동일합니다. 별도 사용 상한·취소·제외 시간·품목 증빙은 실서비스 확장 대상입니다.
- 현장 코드: 2분 만료, HMAC SHA-256, 랜덤 nonce, 1회용. 장소당 세션 1회 스탬프. GPS 근접 체크는 아직 제공하지 않으며 GPS만으로 성공시키지 않습니다.
- QR 스캔은 휴대폰 기본 카메라로 링크를 열거나 대체 인증코드를 붙여 넣는 방식입니다. 앱 내 카메라 스캐너는 후속입니다. localhost 링크는 다른 기기에서 접근할 수 없으므로 동일 기기의 대체 코드로 테스트하세요.
- 미션·보상은 스키마만 준비했습니다. 실제 미션 운영 UI는 없습니다.

## 보존과 로그

- 서버 발급 비회원 쿠키: HttpOnly, SameSite=Strict, 7일. 토큰은 256비트 무작위 값. 사용자 데이터 API는 쿠키의 서버 소유자만 조회·삭제합니다.
- 로그인 없는 세션은 기기·브라우저마다 다릅니다. 계정 영구 저장·기기간 동기화는 아직 제공하지 않습니다.
- 만료된 게스트 여행·쿠폰·스탬프·동의·이벤트를 시작 시 및 매시간 정리합니다.
- 여행 조건·GPS는 요청이나 세션 저장한 조건에 있으며 전체 이동이력을 수집하지 않습니다. 저장 코스에 입력 좌표와 복귀 좌표가 들어갈 수 있으므로 보존기간·열람·삭제 정책을 실제 운영 설계에 반영하세요.
- 선택 이용 이벤트는 동의 후에만 기록합니다. 동의 철회 시 해당 분석 이벤트를 삭제합니다. 분석 이벤트는 30일 이후 정리합니다.
- 감사기록은 보안 행위와 엔티티 ID·증빙 금액 등을 별도로 남깁니다. 실제 감사 보존기간·삭제·사업자 감사열람 정책은 출시 전에 확정해야 합니다.
- 서명 비밀은 SQLite config에 보관합니다. 실제 운영에서는 서버 Secret Manager / Supabase secrets로 이전합니다.

## 출시·배포 조건

HTTPS 호스팅, Node API 또는 Supabase Edge Functions 실행환경, Supabase 인증·Storage·RLS, 지도 경로 제공자, 실제 장소 데이터가 필요합니다. 현재 공개 배포는 수행하지 않았습니다.

PWA 서비스워커는 첫 방문 이후 앱 shell을 캐시하고 네트워크가 끊기면 기존 shell을 표시할 수 있습니다. API 응답·개인 기록·지도 타일을 캐시하지 않으므로 오프라인 신규 코스 생성은 불가능합니다. production build로 서비스워커와 설치 가능성을 실제 모바일 기기에서 추가 검증하세요.

OpenStreetMap 공용 타일은 개발·가벼운 사용 용도입니다. 상업적 실증에서는 사용량·정책에 맞는 제공자를 확정합니다. attribution·Referer를 유지하고 일괄 다운로드·오프라인 지도 타일 캐시는 하지 않습니다. 실제 경로 API에 대한 거리·시간·교통·접근성 정확성도 별도로 검증해야 합니다.

출시 전 개인정보 처리방침, 위치 이용동의, 국외 이전, 보존기간·탈퇴, 지도·사진 이용권, 업체 쿠폰 조건·광고 표시, 언어별 핵심 이용조건을 운영 구조에 맞춰 검토합니다. 의료관광·결제·예약재고·광고 입찰은 구현·노출하지 않습니다. 외국인 300명·업체 30개는 실증 **목표**이며 확보 실적으로 표시하지 않습니다.

## 참고 공식 문서

- [React](https://react.dev/learn), [Vite](https://vite.dev/guide/)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase email passwordless login](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Leaflet](https://leafletjs.com/examples/quick-start/), [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- [Node SQLite](https://nodejs.org/api/sqlite.html)
