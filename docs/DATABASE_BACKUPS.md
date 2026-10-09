# 운영 데이터 백업과 복구

현재 기록 저장소는 SQLite다. 이 기능은 Supabase DB 이전을 완료하는 기능이 아니라, 현재 단일 서버 데이터 보호와 이전 전 복구 검증을 위한 도구다.

## 백업

프로젝트 폴더에서 실행한다. 원본 경로를 명시하므로 개발 DB와 공개 미리보기 DB를 혼동하지 않는다.

```powershell
npm run db:backup -- create .data/nowro.sqlite .data/backups/local
npm run db:backup -- create .data/public-preview/nowro.sqlite .data/backups/public-preview
```

SQLite 온라인 백업 API로 실행 중인 WAL 데이터까지 일관된 스냅샷을 만든다. 기존 파일을 덮어쓰지 않고 새 폴더를 생성한다. 원본 DB가 없으면 오류로 중단하며 빈 DB를 대신 생성하지 않는다. 결과에는 테이블별 건수만 출력되고 이메일·주소·토큰·키의 값은 출력되지 않는다.

백업 폴더는 `nowro.sqlite`와 `manifest.json` 두 파일을 포함한다. 무결성·외래키·필수 테이블·인증 암호화 및 QR에 사용하는 키의 존재를 검사한다. 체크섬은 파일 손상 검출용이며 신뢰할 수 없는 사람이 DB와 manifest를 함께 변경하는 것을 막는 전자서명은 아니다.

## 검증과 새 파일로 복구

```powershell
npm run db:backup -- verify .data/backups/local/nowro-생성된폴더
npm run db:backup -- restore .data/backups/local/nowro-생성된폴더 .data/recovery-test/nowro.sqlite
```

복구는 체크섬·무결성·외래키·건수를 검사한 뒤 **새 파일로만** 복사한다. 기존 파일이 있으면 중단한다. 실행 중인 서버의 DB를 직접 바꾸거나 덮어쓰지 않는다.

운영 장애 시 별도 경로로 먼저 복구하고, 서버를 중단한 뒤 복구 파일 폴더를 DATA_DIR로 지정해 재시작한다. 고정 포트·다른 경로에서 시험 서버를 띄울 경우 운영 트래픽과 분리한다. 공개 미리보기 스크립트는 경로를 고정하므로 자동 경로 전환 대상이 아니다.

테스트에서는 쿠폰, 결제 완료 스탬프, 이미 소비된 결제의 재사용 방지, 단일 보상 신청, 인증 토큰의 복호화 가능 여부를 확인한다. 운영 전 본인 계정으로 복구 후 재로그인과 실제 요청을 별도로 확인해야 한다. 복구가 과거 상태를 되돌리므로 장애 이후 결제·발송·보상 처리는 결제사/배송사와 대조 후 재개한다.

## 보관

- 백업에는 이메일, 배송 정보와 서버 암호화 키가 포함될 수 있다. 인증 토큰 암호화만으로 백업 전체가 암호화되지는 않는다. 저장소와 공개 웹에 올리지 않는다.
- `.data/` 전체는 Git 제외 대상이다. 로컬 접근 권한을 제한하고 외부 보관 시 암호화된 저장소를 사용한다.
- 운영 데이터가 생기면 배포 전 백업 및 운영 정책에 맞는 정기 백업·기간별 삭제를 구성한다. 현재 도구는 수동 실행이며 자동 일정이나 외부 전송을 설정하지 않았다.
- 디스크 하나에 있는 백업만으로 장비 장애에 대비할 수 없다. 고정 배포 계정 준비 후 별도 저장소, 보존 기간, 복구 목표 시간을 확정한다.

Node 공식 API: https://nodejs.org/docs/latest-v24.x/api/sqlite.html#sqlitebackupsourceDb-path-options
