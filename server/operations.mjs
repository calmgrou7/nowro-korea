import { ServiceError } from './store.mjs';
import { growthConfig } from './growth.mjs';
import { affiliateConfig } from './affiliates.mjs';

function admin(session) { if (session.role !== 'admin') throw new ServiceError('FORBIDDEN',403); }
// Explicit allowlist: never export users, sessions, auth tokens, QR keys or environment secrets.
const contentKeys = ['board_posts','affiliate_config','growth_config','performance_ids'];
export function contentBackup(store, session) {
  admin(session);
  const config = Object.fromEntries(contentKeys.flatMap(key => {
    const row=store.db.prepare('SELECT value FROM config WHERE key=?').get(key);
    return row ? [[key,JSON.parse(row.value)]] : [];
  }));
  return {format:'nowro-content-backup',version:1,createdAt:new Date().toISOString(),
    scope:'Homepage, news, boards, affiliate configuration, search configuration and performance IDs only. Not a database recovery backup.',
    siteContent:store.siteContent(),config};
}
export function operationsStatus(store, session, auth) {
  admin(session);
  const growth=growthConfig(store), affiliates=affiliateConfig(store);
  return {checkedAt:new Date().toISOString(),checks:[
    {id:'auth',ready:!!auth.enabled,title:'회원 로그인',detail:auth.enabled?'인증 연결 설정 있음. 실제 가입·로그인은 별도 확인이 필요합니다.':'인증 연결 설정이 필요합니다.'},
    {id:'storage',ready:false,title:'운영 데이터 영구 보존',detail:'현재 SQLite 저장 방식입니다. 서버 재배포 후 보존과 외부 저장소 복구를 확인하기 전까지 미완료입니다.'},
    {id:'backup',ready:false,title:'운영 DB 전체 백업',detail:'아래 콘텐츠 내려받기는 회원·이미지 저장소·예약을 포함하지 않습니다. 운영 서버 DB 전체 백업과 복원 검증이 별도로 필요합니다.'},
    {id:'analytics',ready:growth.enabled,title:'GA4 방문 분석',detail:growth.enabled?'측정 설정 활성화. 동의 후 실제 수신은 GA4에서 확인하세요.':'측정 ID 등록·활성화 후 실제 수신을 확인해야 합니다.'},
    {id:'search',ready:!!growth.naverVerification&&!!growth.googleVerification,title:'검색 소유 확인',detail:'사이트에 등록한 확인 태그 상태이며, 검색 서비스의 소유 확인·수집·색인 완료를 의미하지 않습니다.'},
    {id:'affiliate',ready:affiliates.offers.some(o=>o.status==='approved'&&o.active&&(!o.validUntil||o.validUntil>=new Date().toISOString().slice(0,10))),title:'제휴 상품',detail:'상품과 장소 연결을 각각 승인해야 노출됩니다. 실제 예약·수수료는 제휴사에서 확인해야 합니다.'},
    {id:'mail',ready:false,title:'자동 이메일',detail:'현재 사용자 이메일 앱에서 직접 보내기만 지원합니다. 인증된 발신 서비스 연결 전입니다.'},
    {id:'billing',ready:false,title:'결제·정산',detail:'요금·계약·결제 서비스와 환불 운영이 확정되기 전에는 자동 청구하지 않습니다.'},
    {id:'hosting',ready:false,title:'상시 접속',detail:'호스팅 요금제·절전 상태는 배포 계정에서 확인해야 합니다. 이 화면은 요금제를 변경하지 않습니다.'}
  ]};
}
