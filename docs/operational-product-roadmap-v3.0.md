# 지움AI 실제 운영제품 로드맵 v3.0

작성일: 2026-05-31

최신 구현 메모: v3.56에서 server deployment bundle을 추가했다. 세부 runbook은 `docs/server-deployment-bundle-v0.3.56.md`를 기준으로 한다.

## 운영제품 기준

해커톤 MVP는 "시연 가능"이 기준이지만, 실제 운영제품은 피해자가 현실 사건에서 안전하게 쓰고 담당자가 제출자료를 신뢰할 수 있어야 한다.

운영제품의 최소 기준은 다음이다.

1. 피해자 안전: 피해물 원본 업로드 금지, 악성 기기 경고, 빠른 나가기, 외부 이동 전 확인
2. 보관 안전: 일반 로컬 보드 평문 최소화, 암호화 보관함, 패스프레이즈 미저장
3. 증거성: 발견·캡처 시각, 기록 방식, 해시, 요청 이력, 접수번호, 체인 매니페스트
4. 합법성: 폐쇄형 채널, IP, 결제, 가입자 정보는 공식기관·법원 절차로 분리
5. 기관 인계: 중앙디지털성범죄피해자지원센터, 경찰 ECRM, 개인정보침해 신고센터 등 공식 경로 우선
6. 배포 보안: 보안 헤더, CSP 점진 적용, 외부 스크립트 최소화, 민감정보 서버 전송 금지
7. 운영 통제: 감사로그, 내보내기 이력, 삭제·보관 정책, 비식별 학습만 허용

## v3.0 1차 운영화 반영

- 보안 헤더
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - 민감 브라우저 권한 차단용 `Permissions-Policy`
  - `Content-Security-Policy-Report-Only`로 CSP 위반 관찰 시작

- 증거 체인
  - 사건별 제출 패킷에 `JIUM-CHAIN-*` 체인 매니페스트 추가
  - 발견, 캡처, 요청, 패킷 생성 이벤트를 시간순으로 정리
  - 해시, 메타데이터 지문, 접수번호, 제출 대상 누락 여부를 운영 보강 항목으로 표시

- 제출 패킷 보강
  - 패킷 화면과 Markdown 내보내기에 증거 체인·인계 이력 포함
  - 기관 담당자가 "무엇이 관찰 사실이고 무엇이 보강 필요인지" 바로 볼 수 있도록 분리

## v3.1 보관·이동성 보강

- 암호화 사건 파일
  - 사건 보관함을 `.jiumcase` 파일로 암호화 내보내기
  - `.jiumcase` 파일을 같은 패스프레이즈로 복호화해 보관함에 병합
  - 파일 안에는 제목, URL, 게시자 단서 같은 평문 사건 정보를 넣지 않음
  - 가져오기와 내보내기는 기기 안전 확인 뒤에만 실행

## v3.2 제출 패키지 보강

- 기관 제출 ZIP 패키지
  - 제출 패킷 Markdown
  - 담당자 읽기전용 HTML
  - 인쇄용 HTML 제출본
  - 증거 체인 manifest JSON
  - Mermaid 추격 다이어그램 원문
  - 제출 전 체크리스트

## v3.3 제출 버전 비교 보강

- 제출 패킷 스냅샷
  - 현재 제출 패킷의 지문, 증거 체인, 증거 ID, 보강 항목, 기관 후보, 홍보면 패턴 ID를 저장
  - 원문 URL, 피해물 원본, 방 이름, 게시자 원문 텍스트는 저장하지 않음
- 직전 버전 비교
  - 증거 건수, 증거 지문, 보강 필요 항목, 기관 후보, 공식권한 인계 수 변경을 표시
  - 비교 결과 Markdown 내려받기 제공
  - 제출 ZIP에도 `submission-version-snapshot.json` 포함

## v3.4 기관별 제출 워크플로 보강

- 기관별 제출 프로필
  - 중앙디지털성범죄피해자지원센터, 경찰청 ECRM, KISA 개인정보침해 신고센터, 방송미디어통신심의위원회, 온라인피해365센터, 대한법률구조공단을 사건 유형별로 라우팅
  - 각 기관별 사용 시점, 긴급 트리거, 준비물, 제출 순서, 제출 금지 정보, 후속 기록 항목을 구조화
- 제출 준비도 엔진
  - 피해사실 요약, 피해 유형, URL·게시 위치, 발견·캡처 시각, 기록 방식, 증거 지문·해시, 요청 이력을 기준으로 준비도를 점수화
  - 원본 피해물, 본인확인 정보, IP·가입자·결제 흐름은 지움AI가 보관하거나 직접 확인하지 않고 공식기관 절차로 분리
- 제출 ZIP 보강
  - `agency-workflow-plan.json`
  - `agency-workflow-checklist.txt`

## v3.5 암호화 보관함 세션 보안 보강

- 자동 잠금
  - 암호화 보관함을 연 뒤 5분 동안 활동이 없으면 복호화 목록과 패스프레이즈 입력값을 화면 상태에서 제거
  - 탭이 숨겨지는 즉시 보관함을 잠가 공용 화면·화면공유·브라우저 전환 노출을 줄임
- 수동 잠금
  - 사용자가 제출 패킷 확인 후 즉시 `지금 잠금`을 눌러 복호화 상태를 정리할 수 있음
- 사용자 가시성
  - 보관함 상태를 `잠김/열림`으로 표시하고 자동 잠금까지 남은 시간을 안내
  - 정책 문구로 패스프레이즈 미저장, 복호화 목록 초기화, 숨김 탭 잠금을 명시

## v3.6 운영 보안 게이트 보강

- 로컬 보안 스크립트
  - `npm run security:secrets`: 추적 파일에서 고신뢰 API 키, GitHub 토큰, 개인키, Slack/AWS 토큰 패턴을 검사
  - `npm run security:audit`: 중간 이상 취약 의존성 감사
  - `npm run ci:verify`: secret scan, dependency audit, typecheck, test, build를 한 번에 실행
- GitHub Actions 품질 게이트
  - Pull Request용 `Quality Gate` 워크플로 추가
  - GitHub Pages 배포 전 secret scan, dependency audit, typecheck, test를 모두 통과해야 static build와 deploy 진행
- 운영 원칙
  - 실제 키는 `.env`, GitHub Secrets, 배포 플랫폼 secret store에만 두고 저장소에는 빈 예시값만 유지
  - secret scan은 고신뢰 패턴 중심의 1차 방어선이며, 외부 전문 스캐너 도입 전까지 로컬·CI 기본 게이트로 사용

## v3.7 CSP Enforcement·정적 호스팅 헤더 보강

- 보안 헤더 중앙화
  - Next 런타임 헤더와 정적 `_headers` 파일이 같은 `SECURITY_HEADERS` 정의를 사용
  - `Content-Security-Policy`를 Enforcement로 추가하고 기존 `Content-Security-Policy-Report-Only`도 동일 정책으로 유지
- 정적 호스팅 지원
  - `npm run security:headers`로 Netlify/Cloudflare Pages 호환 `public/_headers` 파일 생성
  - PR/배포 CI에서 `_headers` 생성과 동기화 테스트를 실행
- 운영 한계 명시
  - GitHub Pages는 `_headers` 파일을 응답 헤더로 강제하지 않으므로, 강제 보안 헤더가 필요한 운영 배포는 Netlify/Cloudflare Pages/Vercel 등 헤더 지원 호스팅으로 이전 필요

## v3.8 GitHub Actions Node 24 네이티브 전환

- 배포 파이프라인 경고 제거
  - `actions/checkout`, `actions/setup-node`, `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`를 Node 24 지원 major로 업데이트
  - `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` 강제 환경변수를 제거하고 공식 action 버전으로 해결
- 회귀 방지
  - 워크플로 테스트에서 최신 major 사용과 강제 환경변수 미사용을 확인
  - Pages 배포 워크플로와 PR 품질 게이트 모두 같은 Node 24 기반 검증 흐름 유지

## v3.9 운영 URL 보안 헤더 감사

- 운영 URL 검증 명령
  - `npm run security:headers:check -- <url>`로 실제 HTTP 응답의 CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy를 검사
  - `_headers` 파일 생성과 실제 응답 헤더 강제 여부를 분리해 판단
- 배포 의사결정 보조
  - GitHub Pages처럼 응답 헤더 강제가 안 되는 환경은 감사 실패로 드러남
  - Netlify/Cloudflare Pages/Vercel 등 운영 후보 배포 URL을 같은 기준으로 비교 가능
- 회귀 방지
  - 보안 헤더 감사 로직 테스트를 `npm run security:headers`와 `ci:verify`에 연결

## v3.10 담당자 HTML XSS 회귀 게이트

- HTML 이스케이프 중앙화
  - 읽기전용 담당자 패킷과 제출용 인쇄 HTML이 같은 `escapeHtml` 유틸리티를 사용
  - 작은따옴표까지 이스케이프해 향후 속성 출력 확장 시 위험을 줄임
- 사용자 입력 회귀 테스트
  - 사건 제목, 설명, URL, 플랫폼, 증거 위치, 게시자 단서, 메모에 악성 HTML 페이로드가 들어가도 실행 가능한 태그로 남지 않는지 확인
  - 담당자용 HTML과 기관 제출 인쇄본 모두 검증
- CI 보안 게이트
  - `npm run security:xss`를 추가하고 PR 품질 게이트와 Pages 배포 게이트에 연결

## v3.11 승인 지능 피드 안전 게이트

- 제한 저장 모델
  - 승인된 기관·파트너·플랫폼 투명성 피드만 `AuthorizedFeedIndicator`로 수입
  - 원문 URL, 초대링크, 계정 핸들, 전화번호, onion 주소는 저장 거부
  - 허용되는 지표는 패턴 ID, 비식별 `sha256-*` 또는 `ahash-*` digest, 출처, 확인일, 보존기한, 권한 수준, 감사로그로 제한
- 보존·감사
  - `expiresAt`이 지난 지표는 저장·로드 과정에서 제거
  - 피드 수입 시 `IMPORTED` 감사로그를 남김
  - 학습 출력은 출처 유형, 접근 수준, 경로 패턴, 홍보면 패턴의 집계 통계만 제공
- CI 보안 게이트
  - `npm run security:feeds`로 승인 피드, 공개 경로 지식, 홍보면 지식, 비식별 학습 저장소를 함께 검증
  - PR 품질 게이트와 Pages 배포 게이트에 연결

## v3.12 제한 피드 운영자 세션·가져오기 UI

- 로컬 운영자 세션
  - 제한 피드 수입·만료 정리 전에 16자 이상의 운영자 확인 문장으로 짧은 세션을 열어야 함
  - 세션은 조직 인증이나 수사권한을 대신하지 않는다는 한계를 UI와 보안 문서에 명시
  - 허용 capability를 `AUTHORIZED_FEED_IMPORT`, `AUTHORIZED_FEED_SUMMARY`, `AUTHORIZED_FEED_PURGE`로 분리
- 피해자 UI 노출 제한
  - 대시보드에는 제한 피드 개별 지표명·원문 지표를 표시하지 않고 집계 요약만 표시
  - 경로 패턴, 홍보면 패턴, 출처 유형, 권한 수준, 30일 내 만료 건수 중심으로 표시
- 운영 절차
  - 승인 피드 JSON 가져오기와 만료 지표 정리를 운영자 세션 안에서만 실행
  - `security:feeds` 게이트에 접근 통제와 UI 회귀 테스트 포함

## v3.13 서명된 승인 피드 검증

- 서명 envelope
  - 운영 피드는 `jium-authorized-feed-signed-v1` 형식으로 `keyId`, `signedAt`, 원본 `jium-authorized-feed-v1` bundle, `signature`를 포함해야 함
  - 서명 payload는 정렬된 canonical JSON으로 고정해 JSON key 순서 차이로 검증이 흔들리지 않게 함
- 공개키 검증
  - 신뢰 공개키는 `TrustedAuthorizedFeedKey`로 pinning하고 RSA-SHA256 WebCrypto 검증을 통과해야 함
  - 개인키는 저장소·브라우저 번들·환경변수에 저장하지 않고 기관/파트너 서명 환경에만 둠
- UI 운영 게이트
  - 기본 대시보드는 unsigned 제한 피드 수입을 막고, 등록된 공개키가 있을 때만 signed envelope를 수입함
  - 테스트에서 위조·변조·미등록 키·운영자 세션 누락을 모두 거부하는지 확인

## v3.14 신뢰 공개키 레지스트리·등록 검증

- 공개키 레지스트리
  - 운영 승인 피드 서명 검증용 공개키를 `data/trusted-authorized-feed-keys.json`으로 분리
  - 기본 저장소에는 실제 운영 공개키가 없으며, 기관/파트너 확인 뒤 공개키만 등록해야 함
- 키 위생 검사
  - `npm run security:feed-keys`로 개인키 JWK 필드, private key usage, PEM private key material, 중복 keyId, 잘못된 유효기간을 차단
  - `security:feeds`와 `ci:verify`에 연결해 PR/배포 전에 공개키 레지스트리 오류가 드러나게 함
- 운영 절차
  - private key는 기관/파트너 서명 환경에만 보관
  - keyId, issuerName, validFrom, validUntil을 운영 감사 기준으로 남김

## v3.15 서명된 운영자 credential 세션

- credential 기반 운영자 세션
  - 기관·파트너가 발급한 `jium-authorized-operator-credential-signed-v1` envelope를 검증해 운영자 세션을 열 수 있음
  - credential에는 credentialId, 가명 subjectId, issuerName, 유효기간, capabilityIds, 운영 한계가 포함됨
- 안전 제한
  - subjectId와 issuerName에는 이메일, 전화번호, URL, 초대링크, onion 주소 같은 원문 식별자를 넣지 못하게 검증
  - credential 만료, 변조, 미등록/만료 공개키, 지원하지 않는 capability를 거부
- UI 운영 게이트
  - 대시보드 제한 피드 패널에서 서명 credential JSON으로 세션을 열 수 있음
  - 기존 16자 확인 문장은 네트워크 없는 현장용 보조 장치로 남기고, 운영 배포에서는 서명 credential 또는 서버 기반 기관 계정 인증을 우선함

## v3.16 서버 기관 계정 RBAC 공통 모델

- 기관 세션 모델
  - `InstitutionAccountSession`으로 organizationId, 가명 subjectId, role, assuranceLevel, capabilityIds, evidenceAccessScope, 만료시각을 구조화
  - 이메일·전화번호·URL·초대링크 같은 원문 식별자는 계정 식별자에 넣지 못하게 검증
- 역할 기반 권한
  - VICTIM_SUPPORT_CASEWORKER, LAW_ENFORCEMENT_LIAISON, PLATFORM_TRUST_SAFETY, PROGRAM_ADMIN별 capability matrix를 추가
  - role이 허용하지 않는 capability를 포함하면 세션을 거부
  - TRUSTED_KEY_REVIEW 같은 고위험 권한은 `SERVER_SESSION_MFA`와 `mfaVerifiedAt`을 요구
- 제한 피드 연동
  - 서버 기관 계정 세션을 제한 피드 운영자 세션으로 변환하는 adapter 추가
  - 대시보드 제한 피드 패널은 서버 세션이 주입되면 passphrase 없이 제한 피드 권한을 확인할 수 있음
- CI 게이트
  - `npm run security:auth`를 추가하고 PR/배포 게이트에 연결

## v3.17 서버 기관 세션 토큰 코어

- HMAC 서명 토큰
  - 서버 배포에서 기관 계정 세션을 `jium-institution-session-token-v1` 토큰으로 발급·검증할 수 있는 코어 추가
  - header/payload/signature 3분할 토큰과 canonical JSON signing input을 사용
- secret 위생
  - `INSTITUTION_SESSION_SECRET`는 서버 전용 32바이트 이상 고엔트로피 secret으로만 사용
  - token payload나 저장소, 브라우저 번들, `NEXT_PUBLIC_*`에 secret이 노출되지 않도록 문서화
- 검증 범위
  - 토큰 변조, 만료된 기관 세션, LOCAL_SIGNED_CREDENTIAL 세션의 서버 토큰 발급, 약한 secret, 미등록/비활성 key를 거부
  - `security:auth` 게이트에 세션 토큰 회귀 테스트 포함

## v3.18 기관 로그인 코어·HttpOnly 쿠키 정책

- 로그인 코어
  - 기관·파트너 signed operator credential을 검증해 서버 기관 세션과 HMAC 세션 토큰을 발급하는 코어 추가
  - role/capability matrix를 다시 검증해 credential 권한이 서버 역할을 초과하지 못하게 함
- 쿠키 정책
  - 운영 쿠키는 `__Host-jium_institution_session` 이름으로 `HttpOnly; Secure; SameSite=Strict; Path=/` 적용
  - 운영 쿠키에 `Domain`을 붙이지 않아 host-only 쿠키로 제한
  - 로컬 HTTP 개발 환경에서만 `jium_institution_session_dev` 이름을 사용
- 검증 범위
  - Set-Cookie 헤더에 secret이 들어가지 않는지, HttpOnly/Secure/SameSite/Path가 붙는지, clear cookie가 안전한지 테스트
  - role escalation credential은 쿠키 발급 전에 거부

## v3.19 기관 로그인 HTTP 핸들러 코어

- 서버 Route 연결 전 코어
  - GitHub Pages 정적 export를 유지하기 위해 실제 `app/api` Route Handler는 아직 추가하지 않음
  - 표준 Web `Request`/`Response` 기반 `handleInstitutionCredentialLoginRequest`, `handleInstitutionSessionRequest`, `handleInstitutionLogoutRequest` 코어를 추가
  - 이후 Next 서버 배포, 데스크톱 로컬 서버, 별도 기관 포털 API에서 같은 코어를 재사용할 수 있음
- 요청 보안
  - 로그인과 로그아웃은 `POST`만 허용
  - 로그인 요청은 `Content-Type: application/json`, 허용 Origin, `X-Jium-Institution-Login: 1` 헤더, 16KB 본문 제한을 통과해야 함
  - 실패 응답에는 credential 검증 상세를 노출하지 않고, 성공 응답은 서버 세션 토큰을 JSON에 포함하지 않음
- 세션 확인
  - 세션 확인 핸들러는 HttpOnly 쿠키에 담긴 기관 세션 토큰만 검증
  - 유효한 세션도 브라우저 응답에는 기관명, 가명 subjectId, role, capability, 만료시각, 운영 제한만 반환
- 검증 범위
  - 쿠키 발급, JSON 본문 token 비노출, origin/CSRF/content-type/body-size 차단, 세션 확인, logout clear cookie를 테스트

## v3.20 기관 인증 비식별 감사 로그

- 감사 이벤트 코어
  - `InstitutionAuditEvent` 모델과 `InstitutionAuditSink`를 추가
  - 로그인 성공/거부, 세션 확인 성공/거부, 로그아웃 성공/거부 이벤트를 기록할 수 있음
  - HTTP 핸들러는 선택적 audit sink가 있을 때 각 인증 경계에서 이벤트를 emit
- 데이터 최소화
  - credential 원문, 서버 세션 토큰, 원문 URL, 초대링크, 계정 핸들, onion 주소, 이메일, 전화번호를 감사 로그에 저장하지 않음
  - Origin은 실제 값을 저장하지 않고 `ALLOWED`, `REJECTED`, `MISSING`, `NOT_CONFIGURED`로만 분류
  - requestId는 안전한 문자 집합만 허용하고, 위험한 값은 새 비식별 ID로 대체
- 검증 범위
  - 안전한 감사 이벤트 생성, raw indicator 차단, Origin 분류, requestId 정규화, HTTP 핸들러 audit sink 연동을 테스트

## v3.21 기관 인증 감사 해시 체인 원장

- append-only 원장 코어
  - `jium-institution-audit-ledger-v1` 레코드를 추가
  - 각 레코드는 sequence, recordedAt, previousRecordDigest, eventDigest, recordDigest, 비식별 audit event를 포함
  - 첫 기록은 `GENESIS`에서 시작하고, 이후 기록은 직전 recordDigest에 연결
- 무결성 검증
  - 이벤트 변경, 이전 digest 변경, record digest 불일치, sequence 오류를 검출
  - 표준 WebCrypto SHA-256과 canonical JSON을 사용해 런타임별 JSON key 순서 차이를 줄임
- HTTP 연동
  - `createInstitutionAuditLedgerSink`를 통해 기관 로그인 HTTP 핸들러의 audit sink에 바로 붙일 수 있음
  - 원장에도 credential 원문, 서버 세션 토큰, 실제 Origin URL은 저장하지 않음
- 검증 범위
  - 정상 체인 검증, 변조 탐지, chain link 오류 탐지, HTTP login handler 연동, token/origin 비노출을 테스트

## v3.22 서버/데스크톱 감사 원장 JSONL 저장소

- 파일 저장소 코어
  - 서버/데스크톱 런타임에서 기관 인증 감사 원장을 JSONL 파일로 append-only 저장하는 코어 추가
  - 설정된 base directory 안의 단순 `.jsonl` 파일명만 허용
  - 기존 파일이 없으면 빈 원장에서 시작하고, 있으면 모든 record를 읽어 검증한 뒤에만 append
- 변조 방어
  - 기존 원장 검증이 실패하면 새 기록 추가를 거부
  - 원장 파일에는 credential 원문, 서버 세션 토큰, 실제 Origin URL을 저장하지 않음
- 운영 전제
  - 운영 배포에서는 단일 writer 정책, 백업, 접근 통제, 로그 보존 기간 정책이 함께 필요
  - DB 저장소로 바꾸더라도 같은 record schema와 검증 함수를 사용 가능
- 검증 범위
  - JSONL append/read/verify, 기존 원장 변조 시 append 거부, path traversal 차단, token/origin 비노출을 테스트

## v3.23 기관 로그인 Next 서버 Route adapter

- Route adapter
  - `createInstitutionServerRouteHandlers`로 login/session/logout handler 묶음을 생성
  - 현재 GitHub Pages 정적 export를 깨지 않도록 실제 `app/api` 파일은 추가하지 않고, 서버 배포 전환 시 Route Handler에서 호출 가능한 adapter로 제공
  - login, session, logout 모두 기존 HTTP 코어와 JSONL audit ledger store를 재사용
- 환경 로더
  - `INSTITUTION_SESSION_SECRET`, `INSTITUTION_ALLOWED_ORIGINS`, `INSTITUTION_AUDIT_LEDGER_DIR`, 신뢰 공개키가 없으면 서버 route 설정을 거부
  - `NEXT_PUBLIC_INSTITUTION_SESSION_SECRET` 설정을 명시적으로 거부
  - 운영 환경에서 `INSTITUTION_SECURE_COOKIES=false`를 거부
  - 로컬 개발 환경에서만 dev cookie를 허용
- 검증 범위
  - login/session/logout route adapter 흐름, audit ledger 3건 기록, secret/token/origin 비노출, 취약 env 설정 거부, 로컬 dev cookie 허용을 테스트

## v3.24 배포 프로필 가드

- 정적 export 보호
  - `npm run security:deployment` 스크립트를 추가
  - `GITHUB_PAGES=true`일 때 `app/**/route.ts` 같은 Route Handler 파일이 존재하면 정적 export 전에 실패
  - GitHub Pages 배포 워크플로에서 build 전에 이 검사를 실행
- 서버 운영 프로필 보호
  - `JIUM_SERVER_ROUTES=true`이면 `INSTITUTION_SESSION_SECRET`, `INSTITUTION_ALLOWED_ORIGINS`, `INSTITUTION_AUDIT_LEDGER_DIR`를 요구
  - `GITHUB_PAGES=true`와 `JIUM_SERVER_ROUTES=true` 동시 설정을 거부
  - `NEXT_PUBLIC_INSTITUTION_SESSION_SECRET` 및 운영 환경 insecure cookie 설정을 거부
- 검증 범위
  - 현재 정적/local 프로필 통과, Route Handler가 있는 임시 repo의 Pages export 실패, unsafe server env 실패, 정상 server env 통과를 테스트
  - PR 품질 게이트와 Pages 배포 워크플로에 deployment profile guard가 포함되는지 테스트

## v3.25 서버 Route materialize 흐름

- 서버 Route 템플릿
  - `server-route-templates/app/api/institution/login/route.ts`, `session/route.ts`, `logout/route.ts`를 추가
  - 각 Route는 Node.js runtime과 dynamic mode를 사용하고, 요청 시 `loadInstitutionServerRouteConfig`와 `createInstitutionServerRouteHandlers`를 lazy-load
  - 정적 GitHub Pages export를 깨지 않도록 `app/api`에는 상시 Route 파일을 두지 않음
- 서버 배포 명령
  - `npm run server:routes:materialize`로 서버 프로필에서만 `app/api/institution/*/route.ts`를 생성
  - `npm run server:routes:clean`으로 생성된 Route 파일만 안전하게 제거
  - `npm run build:server`로 materialize, deployment profile check, Next server build를 연결
- 안전장치
  - `GITHUB_PAGES=true`에서는 materialize를 거부
  - `JIUM_SERVER_ROUTES=true`가 아니거나 server secret/origin/audit dir 설정이 부족하면 materialize를 거부
  - 기존 비생성 Route 파일은 덮어쓰지 않음
  - 생성 Route 파일은 `.gitignore`에 추가해 정적 배포 저장소에 실수로 커밋되지 않게 함
- 검증 범위
  - 템플릿 목록, materialize 결과, clean 결과, Pages 모드 거부, 누락 env 거부, 비생성 Route 덮어쓰기 거부를 테스트

## v3.26 서버 운영 readiness 가드

- 운영 readiness 검사
  - `npm run security:server-readiness` 스크립트를 추가
  - `JIUM_SERVER_ROUTES=true` 서버 프로필과 `GITHUB_PAGES=false` 운영 조건을 확인
  - `INSTITUTION_SESSION_SECRET`, `INSTITUTION_ALLOWED_ORIGINS`, `INSTITUTION_AUDIT_LEDGER_DIR` 등 deployment profile guard 결과를 함께 반영
- 기관 공개키 승인 조건
  - `data/trusted-authorized-feed-keys.json`의 schema를 재검증
  - 실제 운영 readiness에서는 최소 1개의 승인 기관 공개키가 필요
  - 현재 공개 저장소의 빈 registry 상태에서는 readiness가 실패해야 정상
- 서버 Route 템플릿 조건
  - login/session/logout Route 템플릿이 모두 존재하는지 확인
  - `server:routes:clean`이 stale `.next/types`와 `.next/dev/types` cache도 제거해, 서버 빌드 후 정적 타입체크가 흔들리지 않게 함
- 운영 빌드 명령
  - `npm run build:server`는 기술적 서버 빌드 확인용
  - `npm run build:server:production`은 materialize 후 readiness까지 통과해야 Next server build를 진행
- 검증 범위
  - trusted key registry 있음/없음, Pages 모드 충돌, 누락 env, Route 템플릿 누락, CLI 실행을 테스트

## v3.27 기관 공개키 승인 패널

- 공개키 후보 검토 코어
  - `lib/trustedKeyApproval.ts`를 추가해 후보 JWK 공개키를 검토
  - private JWK field, private key usage, duplicate keyId, 잘못된 validity window를 차단
  - 승인 기록용 SHA-256 fingerprint를 산출
- registry patch 생성
  - 기존 registry에 후보 공개키를 추가한 JSON patch를 생성
  - 앱이 저장소 파일을 직접 수정하지 않고, PR 또는 관리자 검토 흐름으로 넘기는 구조
- 대시보드 UI
  - `TrustedKeyApprovalPanel`을 사건 보드에 추가
  - 공개키 후보 JSON 입력, fingerprint/checklist 표시, registry patch 다운로드 제공
  - 개인키 입력·저장을 금지하는 운영 문구 포함
- 검증 범위
  - 공개키 승인 코어 테스트와 UI 회귀 테스트 추가
  - 기존 제한 피드 패널 테스트와 함께 실행

## v3.28 기관 감사 원장 검증 패널

- 감사 원장 리포트 코어
  - `lib/institutionAuditLedgerReport.ts`를 추가
  - JSONL과 JSON 배열 형식의 기관 인증 감사 원장 export를 파싱
  - 기존 `verifyInstitutionAuditLedger`를 사용해 sequence, previous digest, event digest, record digest를 검증
  - 이벤트 유형, 결과, Origin 분류, 기관명 기준 집계를 생성
- 대시보드 UI
  - `InstitutionAuditLedgerPanel`을 사건 보드에 추가
  - 원장 텍스트 붙여넣기, `.jsonl/.json` 파일 선택, 검증 실행, Markdown 리포트 저장을 지원
  - 최근 감사 기록은 sequence, event type, outcome, 기관명, recordedAt만 표시
  - credential 원문, 세션 토큰, URL, 초대링크, 계정 핸들, onion 주소, 이메일, 전화번호를 표시하지 않는 안전 메모를 함께 제공
- 운영 안전
  - 검증 실패 원장은 덮어쓰지 말고 원본 파일을 보존하도록 안내
  - 검증 성공도 수사권한 또는 신원 특정 권한을 대신하지 않음을 명시
- 검증 범위
  - JSONL/JSON 배열 파싱, 정상 원장 리포트, parse error, tamper detection, UI 검증 흐름을 테스트

## v3.29 기관 감사 원장 서버 요약 API

- 감사 원장 조회 capability
  - `INSTITUTION_AUDIT_LEDGER_REVIEW` institution capability를 추가
  - `PROGRAM_ADMIN` 역할과 `SERVER_SESSION_MFA` assurance에서만 허용
  - 일반 피드 수입/요약 권한과 감사 원장 조회 권한을 분리
- HTTP 코어
  - `lib/institutionAuditLedgerHttp.ts`를 추가
  - `GET`만 허용하고, 허용 Origin과 HttpOnly 기관 세션 쿠키를 검증
  - 세션 토큰 검증 후 `INSTITUTION_AUDIT_LEDGER_REVIEW` capability를 요구
  - JSONL audit store에서 원장을 읽고, `InstitutionAuditLedgerReport` 기반 공개 요약만 반환
- 감사 재기록
  - 감사 원장 조회 성공은 `INSTITUTION_AUDIT_LEDGER_VIEWED`로 기록
  - 세션 누락, Origin 거부, 권한 부족은 `INSTITUTION_AUDIT_LEDGER_VIEW_DENIED`로 기록
  - 응답에는 credential 원문, 세션 토큰, Origin URL, 원장 원문을 넣지 않음
- 서버 Route 연결
  - `server-route-templates/app/api/institution/audit-ledger/route.ts` 추가
  - materialize/readiness 검사에서 login/logout/session과 함께 audit-ledger Route 템플릿을 확인
- 검증 범위
  - 권한 있는 세션의 redacted report 응답, 세션 누락 거부, 권한 부족 거부, materialize/readiness 갱신을 테스트

## v3.30 기관 공개키 수명주기·폐기 절차

- 공개키 수명주기 코어
  - `lib/trustedKeyLifecycle.ts`를 추가해 registry의 활성, 곧 만료, 만료, 만료일 없음, 활성 전 상태를 판정
  - 운영 가능한 활성 공개키가 없으면 오류로 보고, 만료 예정·만료일 없음·미래 시작 키는 경고나 보강 항목으로 분리
- 폐기·교체 patch
  - 운영자가 폐기할 keyId와 폐기 시각을 지정해 검토 가능한 retirement patch JSON을 생성
  - 교체 작업에서는 새 공개키를 먼저 추가한 뒤 기존 공개키에 `validUntil`을 부여하는 rotation patch 코어를 제공
  - 앱이 registry 파일을 직접 수정하지 않고 PR/관리자 검토가 가능한 patch만 만든다
- readiness 강화
  - 서버 운영 readiness는 공개키 개수뿐 아니라 현재 시각 기준 활성 공개키 수를 확인
  - registry가 존재해도 모두 만료됐거나 아직 활성 전이면 운영 준비 실패로 판단
- 대시보드 UI
  - "기관 공개키 승인" 패널에서 현재 registry JSON을 붙여 넣고 수명주기 검토를 실행
  - 활성/만료 집계, 키별 상태, 폐기 patch 다운로드를 제공
- 검증 범위
  - 수명주기 판정, 폐기/교체 patch 생성, 만료 키만 있는 readiness 거부, UI 폐기 patch 흐름을 테스트

## v3.31 암호화 보관함 보안 저장소 backend 분리

- 보관 backend 추상화
  - `lib/encryptedCaseStorage.ts`에 브라우저 localStorage와 데스크톱 보안 저장소 브리지 backend를 분리
  - 데스크톱 앱은 `window.jiumSecureVault` 계약으로 read/write/delete/describe를 제공할 수 있음
  - 브리지가 연결되면 암호화 payload를 localStorage에 남기지 않고 브리지 저장소에만 기록
- 운영 준비도 표시
  - 암호화 보관함 UI가 현재 backend, providerName, OS 보안 저장소 연결 여부, 경고를 표시
  - 브리지 미연결 상태에서는 브라우저 localStorage 암호화 모드와 운영 전 보강 필요성을 명시
- 검증 범위
  - localStorage 암호화 저장, 데스크톱 브리지 우선 저장, localStorage 미잔류, UI backend 표시를 테스트

## v3.32 기관 계정 관리자 검토·지역 피해지원 라우팅

- 기관 계정 관리자 검토 패널
  - 서버 기관 세션 JSON을 붙여 넣어 role, capability, MFA, 만료, 고위험 권한, 원문 식별자 노출 위험을 검토
  - 계정 발급 도구가 아니라 운영 전 검토·감사용 보조 패널로 제한
  - 운영 가능/검토 필요/만료/고위험 권한 집계를 표시하고 Markdown 리포트를 내려받을 수 있음
- 지역 디지털성범죄 피해지원 라우팅
  - D4U 공식 지역 디성센터 현황 기준 지역 디성센터 후보를 지역별로 매핑
  - 긴급 사건은 112 또는 1366 우선, 상담·삭제지원·유포 모니터링은 중앙디지털성범죄피해자지원센터와 지역 후보를 함께 제시
  - 지움AI가 자동 제출하지 않고, 피해물 원본·신분증 원본·비밀번호를 저장하지 않는 안전 경계를 함께 표시
- 검증 범위
  - 기관 세션 검토 코어와 UI, `security:auth` 회귀 게이트, 지역 별칭 라우팅, 지역 라우팅 UI, 제출 패킷 연동을 테스트

## v3.33 지원자·상담자 읽기전용 전달 패키지

- 암호화 handoff archive
  - 상담자, 피해자 지원자, 수사·심의 담당자에게 전달할 읽기전용 패킷을 `.jiumhandoff.json` 파일로 암호화
  - 접근 코드는 12자 이상으로 요구하고, 파일과 다른 채널로 전달하도록 안내
  - 만료 시각, 수신 역할, 체인 지문, 안전 경계를 archive metadata와 별도 안내 메모에 기록
- 제출 패킷 UI
  - 제출 패킷 화면에서 수신 역할, 유효 시간, 접근 코드, 코드 힌트를 입력해 handoff 파일과 안내 메모를 생성
  - 생성 이력은 사건 감사로그에 `SUPPORT_HANDOFF_EXPORTED`로 남김
- 제출 ZIP 보강
  - ZIP 안에 `support-handoff-guide.txt`를 포함해 파일 기반 전달 절차와 금지 행위를 안내
- 검증 범위
  - 암호화 archive에 사건 제목·원문 URL이 평문으로 남지 않는지, 만료 archive가 거부되는지, UI 저장 흐름과 ZIP 포함 여부를 테스트

## v3.34 수사·심의기관 제출 전 최종 검수표

- 제출 전 preflight 엔진
  - 피해 사실 요약, 접근 경로, 발견·캡처 시각, 기록 방식, 무결성 지문, 요청 이력, 원본 피해물 취급, 수사권한 분리를 PASS/REVIEW/BLOCKED로 판정
  - 기관별 제출 준비도와 연결해 제출 보류 항목, 상담 검토 항목, 다음 행동을 한 보고서로 정리
  - IP·가입자·결제·서버 로그는 피해자 직접 추적 대상이 아니라 수사·심의기관 요청사항으로 분리
- 제출 패킷 UI
  - `제출 전 최종 검수` 패널을 추가해 점수, 보류 건수, 검토 건수, 우선 기관 후보를 표시
  - Markdown 검수표를 내려받고 사건 감사로그에 `PRE_SUBMISSION_CHECKLIST_EXPORTED`를 남김
- 제출 ZIP 보강
  - ZIP 안에 `pre-submission-checklist.md`를 포함해 기관 제출 전 빠진 항목을 다시 확인할 수 있게 함
- 검증 범위
  - 검수 엔진, UI 렌더링, ZIP 포함 여부, 제출 패킷 통합 화면, 타입 검사를 테스트

## v3.35 데스크톱 OS 보안 저장소 브리지

- 네이티브 secure vault bridge
  - `scripts/native-secure-vault-bridge.mjs`를 추가해 데스크톱 런타임에서 같은 `jium-ai.encrypted-cases.v1` vault payload를 OS 보안 저장소에 저장할 수 있게 함
  - Windows는 DPAPI CurrentUser로 보호한 blob을 사용자 프로필 아래 JSON record로 저장
  - macOS는 사용자 Keychain generic password, Linux는 Secret Service `secret-tool` 경로를 사용
- Electron preload 연결
  - `desktop/electron-preload.cjs`에서 `window.jiumSecureVault`를 노출해 기존 브라우저 보관함 추상화와 직접 연결
  - read/write/delete/has/describe API를 유지하므로 기존 UI는 브리지 연결 여부만 보고 동작
- 운영 확인 명령
  - `npm run desktop:vault:describe`로 현재 플랫폼의 bridge descriptor를 확인
  - `npm run desktop:vault -- write <key> <utf8-file>` 또는 `read|has|delete <key>`로 데스크톱 런타임에서 수동 점검 가능
- 검증 범위
  - Windows DPAPI record 저장 경로, 평문 미저장, Secret Service stdin 전달, 안전하지 않은 key 차단, CLI descriptor를 테스트

## v3.36 기관 계정 발급·해지 backend

- 서버 계정 registry
  - `lib/institutionAccountRegistry.ts`를 추가해 기관 계정을 `ACTIVE/SUSPENDED/REVOKED` 상태로 관리
  - accountId, organizationId, subjectId는 가명 식별자만 허용하고 URL, 초대링크, onion, 이메일, 전화번호 형태를 거부
  - role-capability matrix를 재사용해 역할 밖 권한 발급을 차단
- 계정 registry 파일 저장소
  - `INSTITUTION_ACCOUNT_REGISTRY_DIR` 아래 단순 `.json` 파일에 계정 registry를 저장
  - 경로 traversal과 잘못된 파일명을 거부하고, 쓰기 전 registry 전체 검증을 수행
- 서버 HTTP 코어와 Route 템플릿
  - `/api/institution/accounts` Route 템플릿을 추가
  - `INSTITUTION_ACCOUNT_ADMIN` capability를 가진 `PROGRAM_ADMIN` MFA 세션만 LIST/PROVISION/REVOKE를 실행
  - CSRF header, Origin, Content-Type, body size, HttpOnly 세션 쿠키 검사를 통과해야 함
- 감사 원장 연동
  - 계정 발급, 해지, 목록 조회, 거부 이벤트를 기관 인증 감사 원장에 기록
  - 감사 이벤트에는 credential 원문, 세션 토큰, Origin 원문, 피해 URL, 이메일, 전화번호를 남기지 않음
- 검증 범위
  - registry 검증, 파일 저장소, HTTP handler, 서버 Route adapter, materialize/readiness 검사를 테스트

## v3.37 기관 계정 관리자 UI 서버 연동

- 서버 계정 운영 패널
  - 대시보드 기관 계정 관리자 패널에서 `/api/institution/accounts`에 LIST/PROVISION/REVOKE 요청을 보낼 수 있음
  - 요청은 `credentials: include`, JSON Content-Type, 계정 관리자 CSRF header를 사용해 HttpOnly 기관 세션 쿠키 기반 운영을 전제로 함
  - static Pages 환경에서는 서버 route가 없으므로 서버 배포 모드에서만 실제 계정 발급·해지가 동작함
- 안전한 입력 UX
  - 기관 ID, 기관명, 담당자 가명 ID, 역할, 증거 접근 범위, 만료시각, 권한 목록, 운영 메모를 구조화
  - 권한 목록을 비우면 role-capability matrix의 기본 권한을 사용하고, 잘못된 capability는 클라이언트에서 먼저 차단
  - 해지 작업은 accountId와 사유 코드를 분리해 감사 가능한 형태로 요청
- 한국어 운영 문구 정비
  - 기관 계정 관리자 패널과 계정 검토 리포트의 깨진 한글 문구를 정비
  - 세션 검토 보조 기능은 유지해 서버 발급 전후 운영 점검에 계속 사용할 수 있음
- 검증 범위
  - 서버 목록 조회, 계정 발급, 계정 해지 요청 header/body, 세션 검토 UI를 컴포넌트 테스트로 검증

## v3.38 기관 계정 승인 workflow

- 발급·해지 승인 기록
  - 서버 기관 계정 발급과 해지 요청에 승인번호, 승인자 가명 ID, 승인시각을 필수로 요구
  - 승인자와 실제 작업자가 같으면 거부해 단독 self-approval을 차단
  - 승인 만료시각이 있으면 만료된 승인으로 계정 lifecycle을 진행하지 않음
- 고위험 계정 분리
  - `PROGRAM_ADMIN` 발급은 일반 `PROVISION`이 아니라 `PROGRAM_ADMIN_PROVISION` 승인 범위로 저장
  - 기관 계정 목록에는 발급승인과 해지승인 번호를 표시해 사후 감사자가 계정 lifecycle을 바로 대조할 수 있음
- 원문 식별자 차단
  - 승인번호, 승인자 ID, 승인 메모에 URL, 초대링크, onion 주소, 이메일, 전화번호 형태가 들어가면 저장을 거부
  - 승인자 ID는 운영자 가명 ID 형태만 허용해 실제 신상정보가 registry에 섞이지 않도록 함
- 검증 범위
  - registry, HTTP handler, 서버 저장소, 대시보드 계정 관리자 패널 테스트에 승인 기록 필수화와 self-approval 거부를 추가 검증

## v3.39 기관 계정 lifecycle 감사 연결

- 감사 원장 대조성
  - 계정 발급·해지 감사 이벤트에 가명 accountId, approvalRef, approvalScope, targetRole, targetAccountStatus를 기록
  - 해지 이벤트에는 safe reasonCode도 함께 기록해 계정 registry의 해지 사유와 감사 원장 이벤트를 대조할 수 있음
- 개인정보 최소화
  - 감사 이벤트에는 승인자 실명, 이메일, 전화번호, URL, 초대링크, onion 주소를 저장하지 않음
  - accountId와 approvalRef는 단순 가명 참조 형식만 허용하고 free-text 승인 메모는 감사 원장에 넣지 않음
- 운영 확인
  - 감사 원장 검증 패널과 서버 요약 API는 기존 redacted ledger 흐름을 유지하면서 새 lifecycle 필드를 recent record 안에서 확인할 수 있음
  - 발급·해지 HTTP handler 테스트와 감사 로그 안전 테스트로 registry-approval-audit 연결을 검증

## v3.40 서버 운영 readiness 리포트

- 운영자 handoff 리포트
  - `npm run security:server-readiness:json`과 `npm run security:server-readiness:markdown` 스크립트를 추가
  - 서버 운영 profile, 활성 신뢰 공개키 수, Route template 수, Origin 개수, 차단 항목, 다음 조치 항목을 구조화해 출력
- secret redaction
  - 리포트에는 `INSTITUTION_SESSION_SECRET` 값, Origin 원문, 감사 원장/계정 registry 파일 경로를 기록하지 않음
  - env 값은 `SET/MISSING/TRUE/NOT_TRUE` 같은 존재 여부와 개수만 표시
- 검증 범위
  - JSON/Markdown 리포트 생성, 파일 출력, blocked next action, secret/origin/path 미노출을 서버 readiness 테스트로 검증

## 남은 운영제품 개발 단계

### Phase A: 제출 패키지 고도화

- PDF/A 또는 인쇄용 HTML 제출본: 인쇄용 HTML 1차 구현 완료
- ZIP 제출 패키지: Markdown, 담당자 HTML, 증거 체인 manifest JSON, 체크리스트: 1차 구현 완료
- 사건별 `.jiumcase` 암호화 내보내기와 가져오기: 1차 구현 완료
- 제출 패킷 버전 고정과 변경 이력 비교: 1차 구현 완료
- 기관별 준비물 프로필과 제출 준비도: 1차 구현 완료

### Phase B: 데스크톱 보안 저장소

- Tauri 또는 Electron 기반 로컬 앱 검토: Electron preload 1차 연결 완료
- Windows DPAPI, macOS Keychain, Linux Secret Service 브리지 실제 구현: 1차 CLI/bridge 구현 완료
- 보관함 storage backend 추상화와 UI 상태 표시: 1차 구현 완료
- 브라우저 확장프로그램 영향을 줄이는 독립 실행 환경: Electron preload 기반 1차 경로 구현 완료
- 자동 잠금, 세션 타임아웃, 복호화 메모리 초기화: 브라우저 보관함 1차 구현 완료

### Phase C: 기관·전문가 협업

- 기관별 준비물 프로필: 1차 구현 완료
- 지역 디지털성범죄피해자지원센터 라우팅: 1차 구현 완료
- 지원자/상담자용 읽기전용 토큰 또는 파일 기반 전달: 암호화 파일 기반 1차 구현 완료
- 수사·심의기관 제출 전 확인 체크리스트: 1차 구현 완료

### Phase D: 운영 보안

- CSP Report-Only 결과 확인 후 단계적 Enforcement 전환: 1차 Enforcement 병행 완료
- 보안 헤더가 정적 호스팅에서도 적용되도록 Netlify/Cloudflare/Vercel별 설정: Netlify/Cloudflare `_headers` 1차 구현 완료
- SAST, dependency audit, secret scan CI: secret scan과 dependency audit CI 1차 구현 완료
- 민감정보 테스트 케이스와 XSS 회귀 테스트: 담당자 HTML·인쇄 HTML 1차 XSS 회귀 게이트 완료

### Phase E: 합법적 데이터 피드

- 공개 범죄 사이트 목록을 제품에 노출하지 않음
- 승인된 파트너/기관 피드만 제한 저장: 1차 구현 및 운영자 세션 게이트 완료
- 피드별 출처, 확인일, 권한 수준, 보존 기한, 감사로그: 1차 구현 완료
- 비식별 통계만 학습 저장: 승인 피드 집계 요약과 대시보드 표시 1차 구현 완료
- 서명된 피드 검증: 1차 구현 완료
- 실제 파트너 공개키 등록 검증: 1차 구현 완료
- 서명된 운영자 credential 세션: 1차 구현 완료
- 서버 기관 계정 RBAC 공통 모델: 1차 구현 완료
- 서버 기관 세션 토큰 코어: 1차 구현 완료
- 기관 로그인 코어·HttpOnly 쿠키 정책: 1차 구현 완료
- 기관 로그인 HTTP 핸들러 코어: 1차 구현 완료
- 기관 인증 비식별 감사 로그: 1차 구현 완료
- 기관 인증 감사 해시 체인 원장: 1차 구현 완료
- 서버/데스크톱 감사 원장 JSONL 저장소: 1차 구현 완료
- 기관 로그인 Next 서버 Route adapter: 1차 구현 완료
- 배포 프로필 가드: 1차 구현 완료
- 서버 Route materialize 흐름: 1차 구현 완료
- 서버 운영 readiness 가드: 1차 구현 완료
- 기관 공개키 승인 패널: 1차 구현 완료
- 기관 공개키 수명주기·폐기 절차: 1차 구현 완료
- 기관 감사 원장 검증 패널: 1차 구현 완료
- 기관 감사 원장 서버 요약 API: 1차 구현 완료
- 암호화 보관함 보안 저장소 backend 분리: 1차 구현 완료
- 기관 계정 관리자 검토 패널: 1차 구현 완료
- 기관 계정 발급·해지 backend: 1차 구현 완료
- 기관 계정 관리자 UI 서버 연동: 1차 구현 완료
- 기관 계정 승인 workflow: 1차 구현 완료
- 기관 계정 lifecycle 감사 연결: 1차 구현 완료
- 서버 운영 readiness 리포트: 1차 구현 완료
- 운영 배포 전 과제: 실제 파트너 공개키 값 등록과 승인 기록 보관, 데스크톱 앱 패키징·서명·자동 업데이트, 운영 승인 워크플로와 배포 환경 hardening

## 공식 경로 기준

- 중앙디지털성범죄피해자지원센터: https://d4u.stop.or.kr/main
- 경찰청 사이버범죄 신고시스템: https://ecrm.police.go.kr
- KISA 개인정보침해 신고센터: https://privacy.kisa.or.kr
- 개인정보보호위원회 개인정보 침해 신고 안내: https://www.pipc.go.kr/np/default/page.do?mCode=D030050000

## 운영 판단

현재 지움AI는 해커톤 시연 MVP를 넘어 실제 운영제품의 뼈대에 들어섰다. 다만 법률·기관 협업·데스크톱 보안 저장소·배포 보안·증거 제출 포맷까지 완성되어야 "현장 운영 가능"이라고 부를 수 있다.

## v3.41 데스크톱 패키징 readiness

- 데스크톱 shell
  - `desktop/electron-main.cjs`를 추가해 정적 export를 `jium://app` private protocol로 로드한다.
  - Electron은 Node integration을 끄고 preload bridge만 노출하며, 외부 이동은 HTTPS 링크만 시스템 브라우저로 넘긴다.
  - `jium://app/../`, encoded traversal, file/javascript/http 이동은 차단한다.
- 데스크톱 export
  - `JIUM_DESKTOP_EXPORT=true` profile을 추가해 GitHub Pages의 `/jium-ai` basePath 없이 `out`을 만든다.
  - `npm run desktop:export`는 Next build 후 `out/index.html`, dashboard route, `_next` asset을 검증하고 `out/jium-desktop-manifest.json`을 기록한다.
- release readiness
  - `npm run desktop:release:check`는 Electron shell 파일, export 산출물, release channel, HTTPS update URL, signing profile 존재 여부를 확인한다.
  - `desktop:release:json`과 `desktop:release:markdown`은 운영자 인수인계용 redacted report를 만든다.
  - 리포트는 update endpoint, 인증서 경로, 인증서 hash, team ID, signing key ID, 피해자 지표, 초대 링크, onion 주소, 이메일, 전화번호를 저장하지 않는다.
- 검증 범위
  - Electron route resolver, static export profile, desktop release report redaction, 실제 `npm run desktop:export`를 검증했다.
  - 기본 공개 repo 상태에서는 signing/update/channel 값이 없으므로 `desktop:release:check`가 BLOCKED로 실패해야 정상이다.

## v3.43 피해자 기기 안전점검

- 악성 확장프로그램·원격제어 리스크 반영
  - `lib/deviceSafety.ts`를 필수/권장 점검과 readiness 판정 엔진으로 확장했다.
  - 필수 항목은 본인만 쓰는 기기, 확장프로그램 격리, 원격제어 종료, 가해자 접근 차단이다.
  - 권장 항목은 빠른 악성코드 검사, 신뢰 가능한 네트워크, 동기화·클립보드 노출 축소다.
- 제품 흐름 연결
  - `DeviceSafetyPanel`을 추가해 첫 진단 화면과 사건 보드에서 같은 안전점검을 보여준다.
  - 상태는 `중지 권장`, `추가 확인`, `진행 가능`으로 표시하고 피해자 원문이나 기기 세부정보는 저장하지 않는다.
  - 암호화 보관함의 기존 기기 확인 흐름과 같은 안전 원칙을 공유한다.
- 검증 범위
  - readiness 판정, 패널 상호작용, 사건 보드 통합, 모바일 패널 헤더 배치 보정을 테스트했다.
## v3.44 경량 데스크톱 패키징 파이프라인

- 배포 구조 보강
  - `dist/electron-app` 전용 스테이징 폴더를 만들고, electron-builder의 app 디렉터리를 이 폴더로 고정한다.
  - 패키지에는 Electron main/preload, OS 보안 저장소 브리지, 정적 export, `electron-updater` 런타임 의존성만 포함한다.
  - Next.js, React, Prisma, 테스트 파일 같은 루트 웹 개발 의존성이 `app.asar`에 들어가는 상황을 차단한다.
- 운영 안전성
  - `desktop:package:dir`와 `desktop:package:signed`는 항상 정적 export 후 스테이징을 먼저 수행한다.
  - `app.asar` 크기 상한 검사를 추가해 과도하게 큰 패키지를 release-ready로 오판하지 않도록 했다.
  - 자동 업데이트는 명시적으로 켜고 HTTPS update URL과 release channel이 있을 때만 feed를 구성한다.
- 보안 저장소 연결
  - preload가 앱 실행 파일을 Node처럼 재실행하지 않고, Electron main IPC를 통해 `scripts/native-secure-vault-bridge.mjs` 기능을 호출한다.
  - 패키지 환경에서도 Windows DPAPI, macOS Keychain, Linux Secret Service 연결 경로를 유지할 수 있게 했다.
- 검증 범위
  - 스테이징 package manifest, 경량 패키징 helper, archive 크기 guard, main-process vault IPC, release readiness 검사를 테스트했다.

## v3.45 데스크톱 배포 산출물과 업데이트 피드 검증

- 배포 산출물 검증
  - `desktop:distribution:check`는 `dist/desktop` 산출물의 실행 파일, `app.asar`, 필수 정적 export, OS 보안 저장소 브리지, `electron-updater` 포함 여부를 확인한다.
  - `app.asar` 안에 Next.js, React, Prisma 같은 루트 웹 의존성이 다시 들어가면 BLOCKED로 판단한다.
  - 실행 파일과 `app.asar`의 byte size와 SHA-256 지문을 기록해 release handoff와 재현성 검토에 사용할 수 있게 했다.
- 업데이트 피드 검증
  - `desktop:update-feed:check`는 generic updater metadata(`latest.yml`, macOS `latest-mac.yml`, Linux `latest-linux.yml`)를 검사한다.
  - package version, releaseDate, path, files 목록, artifact 존재, SHA-512, file size가 같은 빌드 기준으로 일치해야 한다.
  - metadata가 없거나 artifact와 checksum/size가 맞지 않으면 signed release 전 단계에서 BLOCKED로 남긴다.
- 개인정보 최소화
  - 두 리포트 모두 상대 artifact 이름, 크기, checksum 또는 checksum match 상태만 저장한다.
  - update endpoint 원문, signing certificate path/hash, team ID, signing key ID, 피해자 지표, 초대 링크, onion 주소, 이메일, 전화번호는 저장하지 않는다.
- 검증 범위
  - asar 내부 필수 항목, 금지 의존성, redacted distribution report, updater YAML parser, checksum/size mismatch 차단을 테스트했다.

## v3.46 데스크톱 릴리즈 후보 증적 bundle

- 릴리즈 후보 증적
  - `desktop:release:bundle`은 distribution, release readiness, update feed 리포트를 `dist/desktop-release-bundle`에 모은다.
  - summary에는 gate별 READY/BLOCKED, 오류 수, 버전, 커밋, 상대 artifact 이름, byte size, digest 값을 남긴다.
  - update endpoint 원문, signing certificate path/password, signing key material, 피해자 지표, 초대 링크, onion 주소, 이메일, 전화번호는 bundle에 저장하지 않는다.
- GitHub Actions 보강
  - `Desktop Release Candidate` 수동 workflow를 추가해 Windows runner에서 unsigned desktop package를 만들고 evidence bundle을 artifact로 업로드한다.
  - 같은 workflow는 `dist/desktop/win-unpacked`도 별도 artifact로 보관해 담당자가 실제 실행 후보와 증적을 함께 검토할 수 있게 한다.
  - workflow는 signing secret을 직접 다루지 않고, release channel과 update URL은 readiness 판정용 입력으로만 사용한다.
- 운영 한계
  - 이 bundle은 릴리즈 후보 검토 증적이며, 코드서명, HTTPS update hosting, 법률·기관 sign-off 완료를 대체하지 않는다.
  - update metadata가 없으면 update-feed gate는 BLOCKED로 남아야 정상이다.
- 검증 범위
  - bundle 파일 생성, redaction, gate summary, 수동 workflow 구조, artifact upload 설정을 테스트했다.

## v3.47 데스크톱 코드서명 secret preflight와 signed workflow

- 실제 서명 가능 조건 강화
  - `desktop:signing-secrets:check`는 electron-builder가 사용할 수 있는 Windows 서명 조합을 확인한다.
  - 권장 조건은 `CSC_LINK`와 `CSC_KEY_PASSWORD`이며, Windows 전용 `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD`, 로컬 인증서 `WINDOWS_SIGNING_CERT_PATH`/`WINDOWS_SIGNING_CERT_PASSWORD`, Azure Trusted Signing 조합도 판정한다.
  - 단순 인증서 hash는 검증용 보조 정보일 뿐 signed artifact를 만들 수 없으므로 signing profile로 세지 않는다.
- signed release workflow
  - `Desktop Signed Release` 수동 workflow를 추가했다.
  - GitHub Secrets의 `JIUM_WINDOWS_CSC_LINK`, `JIUM_WINDOWS_CSC_KEY_PASSWORD`, 선택적 `JIUM_WINDOWS_SIGNING_CERT_SHA256`를 runner 환경변수로 주입한다.
  - signing preflight, release readiness, signed packaging, distribution check, update feed check, release bundle 생성을 순서대로 실행한다.
- 개인정보와 secret 최소화
  - preflight report는 설정 존재 여부만 저장하고 certificate payload, password, endpoint 원문, 피해자 지표를 저장하지 않는다.
  - workflow에는 secret 값이 아니라 GitHub Secrets 참조만 남긴다.
- 검증 범위
  - signing secret 조합, redacted CLI report, release readiness 강화, signed workflow 구조를 테스트했다.

## v3.48 데스크톱 GitHub Release publish gate

- 릴리즈 버전 정합성
  - 앱 version을 `0.3.48`로 올리고 signed desktop publish 전용 `desktop:publish:check`를 추가했다.
  - publish gate는 `JIUM_DESKTOP_RELEASE_TAG`가 `v<package.json version>` 형식으로 일치하는지, update metadata version도 같은 값인지 확인한다.
  - feature 릴리즈 태그와 실제 설치파일 업데이트 버전이 어긋나면 GitHub Release 업로드 전에 BLOCKED로 남긴다.
- GitHub Release 업로드 통제
  - `Desktop Signed Release` workflow에 선택적 publish job을 추가했다.
  - signed build job은 기존처럼 Actions artifact만 만들고, GitHub Release 업로드 job만 `contents: write` 권한을 가진다.
  - 업로드는 `publish_to_github_release=true`, `publish_approval=APPROVED`, 기존 release tag 존재, publish readiness 통과 후 `gh release upload`로 실행된다.
  - 데스크톱 release candidate와 signed release artifact 업로드는 Node 24 계열 `actions/upload-artifact@v7`로 맞추고, publish job은 `actions/download-artifact@v7`로 같은 run의 artifact를 내려받는다.
- 개인정보와 secret 최소화
  - publish readiness report는 release tag, package version, update metadata 이름, artifact 개수, 설정 존재 여부만 저장한다.
  - GitHub token, update endpoint 원문, 인증서 material, 피해자 지표, URL, 초대 링크, onion 주소, 이메일, 전화번호는 저장하지 않는다.
- 검증 범위
  - release tag parsing, version alignment, approval/token gate, workflow publish job 구조를 테스트했다.

## v3.49 운영 go-live 종합 gate

- 종합 출시 판정
  - 앱 version을 `0.3.49`로 올리고 `ops:go-live:check`, `ops:go-live:json`, `ops:go-live:markdown`을 추가했다.
  - go-live gate는 서버 runtime readiness와 desktop publish readiness를 함께 평가한다.
  - 공개 앱 URL, 개인정보 처리 안내 URL, 지원 연락 경로, incident response 담당, 법무·운영 승인, release evidence review, 데이터 보존 정책 승인을 한 리포트로 묶는다.
- 외부 의존성 명시
  - 승인 기관 공개키, 서버 secret/env, signed installer, update feed, GitHub Release publish, human approval이 없으면 BLOCKED가 정상이다.
  - 이 gate는 기능 테스트 통과와 실제 운영 오픈 승인을 분리해, 기술 빌드 성공을 운영 완료로 오인하지 않게 한다.
- 개인정보와 secret 최소화
  - go-live report는 승인 상태, URL 유효성 상태, 카운트, release tag, package version만 저장한다.
  - URL 원문, support 연락처, 담당자명, secret, token, 인증서 material, 피해자 지표, 초대 링크, onion 주소, 이메일, 전화번호는 저장하지 않는다.
- 검증 범위
  - 승인/URL 요약, 완전 승인 profile, 서버·데스크톱 downstream blocker, redaction을 테스트했다.

## v3.50 운영 인수인계 bundle

- 운영 증적 묶음
  - 앱 version을 `0.3.50`으로 올리고 `ops:handoff:bundle`, `ops:handoff:json`, `ops:handoff:markdown`을 추가했다.
  - bundle은 서버 runtime readiness report, desktop publish readiness report, operational go-live report, 운영 handoff runbook을 `dist/operational-handoff-bundle`에 모은다.
  - summary에는 gate별 READY/BLOCKED, 오류 수, package version, commit, platform, 필요한 외부 승인 기록, 다음 조치를 남긴다.
- 운영 인수인계 경계
  - 이 bundle은 운영자가 승인 증적을 검토하기 위한 자료이며, 기관 승인·법무 승인·서명·update hosting 완료를 대체하지 않는다.
  - 공개 repo 기본 상태에서는 server runtime, desktop publish, go-live gate 중 하나라도 BLOCKED이면 bundle도 BLOCKED로 남아야 정상이다.
- 개인정보와 secret 최소화
  - report와 runbook은 승인 상태, 카운트, release tag, package version, 상대 artifact 이름, 설정 존재 여부만 저장한다.
  - public URL 값, support 연락처, incident owner 이름, secret, token, 인증서 material, 피해자 지표, 초대 링크, onion 주소, 이메일, 전화번호는 저장하지 않는다.
- 검증 범위
  - READY bundle 생성, BLOCKED bundle 생성, redaction, 외부 승인 기록 checklist, 안전한 bundle directory cleanup을 테스트했다.

## v3.51 운영 승인 증빙 records gate

- 승인 기록의 기계 검증
  - 앱 version을 `0.3.51`로 올리고 `ops:approvals:check`, `ops:approvals:json`, `ops:approvals:markdown`을 추가했다.
  - go-live 승인은 환경변수 `APPROVED`만으로 끝나지 않고, 비공개 approval records packet까지 검증한다.
  - 기본 packet 경로는 `ops/private/operational-approval-records.json`이며, `ops/private`는 git에서 제외한다.
- 필수 승인 유형
  - go-live approval, legal review, release evidence review, data retention acknowledgement, support route assignment, incident response owner assignment를 모두 요구한다.
  - 각 record는 가명 approver reference, 내부 reference ID, scope, 승인 시각, 선택적 sha256 증거 지문만 담는다.
- 개인정보와 secret 최소화
  - approval report는 승인 유형별 상태, package version, release tag, source/file 존재 여부, 카운트만 저장한다.
  - raw URL, support 연락처, 담당자명, secret, token, 인증서 material, 피해자 지표, 초대 링크, onion 주소, 이메일, 전화번호는 packet과 report 모두에서 차단한다.
- go-live/handoff 연동
  - `ops:go-live:check`는 approval records gate를 포함해 최종 READY/BLOCKED를 판단한다.
  - `ops:handoff:bundle`은 `operational-approval-records-report.json`과 `.md`를 함께 묶는다.
- 검증 범위
  - 완전한 approval packet, 누락된 승인 유형, raw URL 유출 차단, 경로 redaction, go-live/handoff 연동을 테스트했다.

## v3.52 운영 승인 packet init

- 승인 packet 생성 보조
  - 앱 version을 `0.3.52`로 올리고 `ops:approvals:init`을 추가했다.
  - 운영자는 git에서 제외된 `ops/private/operational-approval-records.json` 초안을 생성한 뒤, 실제 승인 기록을 채워 `ops:approvals:check`를 통과시킨다.
  - 기존 packet은 기본적으로 덮어쓰지 않고, 명시적 `-- --force`가 있을 때만 다시 생성한다.
- placeholder 차단
  - 초안은 `REPLACE-ME` reference와 `PENDING_APPROVAL` 상태를 넣어 일부러 BLOCKED로 남긴다.
  - validator가 `REPLACE-ME`, `TODO`, `TBD`, `PLACEHOLDER`, `PENDING_APPROVAL` 같은 placeholder 값을 차단한다.
- 개인정보와 secret 최소화
  - init template에는 raw URL, 연락처, 담당자명, secret, token, 피해자 지표, 초대 링크, onion 주소, 이메일, 전화번호를 넣지 않는다.
  - 승인 packet이 실제 운영 자료가 되는 시점에도 가명 reference, release scope, sha256 증거 지문만 사용하도록 유도한다.
- 검증 범위
  - template 생성, overwrite 차단, force overwrite, release tag 정렬, placeholder 기반 BLOCKED 판정을 테스트했다.

## v3.53 기관 공개키 후보 review CLI

- 신뢰 공개키 온보딩 보조
  - 앱 version을 `0.3.53`으로 올리고 `security:trusted-key:review`를 추가했다.
  - 운영자는 후보 공개키 JSON을 바로 registry에 붙이지 않고, 먼저 fingerprint/checklist/error/warning report를 생성한다.
  - BLOCKED 후보는 registry patch를 쓰지 않고, 통과 또는 검토 필요 상태일 때만 `--patch-output`으로 patch를 생성한다.
- 개인정보와 secret 최소화
  - review report는 keyId, issuerName, fingerprint, algorithm 상태, 유효기간 설정 여부, registry key count만 저장한다.
  - raw public-key modulus, private key material, 연락처, URL, secret, 피해자 지표, 초대 링크, onion 주소, 이메일, 전화번호는 report에 저장하지 않는다.
  - patch output에는 공개키 material만 포함되며, 승인 기록과 별도 PR/관리자 검토를 거쳐야 한다.
- 운영 승인 연결
  - fingerprint를 private approval records packet에 남기고, 별도 신뢰 채널로 발급기관이 제공한 fingerprint와 대조한다.
  - patch 적용 뒤 `npm run security:feed-keys`와 `npm run security:server-readiness`를 다시 실행한다.
- 검증 범위
  - 정상 후보 patch 생성, report redaction, private JWK 차단, missing validUntil NEEDS_REVIEW, BLOCKED 후보 patch 미생성을 테스트했다.

## v3.54 서버 runtime env init과 weak secret 차단

- 서버 env 초안 생성
  - 앱 version을 `0.3.54`로 올리고 `server:env:init`을 추가했다.
  - 기본 출력은 git에서 제외되는 `.env.server.local`이며, 48바이트 random `INSTITUTION_SESSION_SECRET`을 생성한다.
  - `NEXT_PUBLIC_INSTITUTION_SESSION_SECRET`은 생성하지 않는다.
- 의도적 BLOCKED 초안
  - `INSTITUTION_ALLOWED_ORIGINS`는 `REPLACE-ME-https-origin` placeholder로 남겨 실제 승인 origin이 들어오기 전에는 readiness가 BLOCKED가 되도록 했다.
  - 기존 env 파일은 `--force` 없이는 덮어쓰지 않는다.
- readiness 강화
  - `INSTITUTION_SESSION_SECRET`는 32바이트 미만 또는 placeholder 값을 `SET_WEAK`으로 분류하고 BLOCKED 처리한다.
  - `INSTITUTION_ALLOWED_ORIGINS`는 HTTPS origin이어야 하며 placeholder, query, fragment, credential을 거부한다.
- 검증 범위
  - env template 생성, strong secret 생성, placeholder origin BLOCKED, overwrite 차단, force overwrite, weak secret summary를 테스트했다.

## v3.55 서버 storage readiness gate

- 서버 저장소 안전성 점검
  - 앱 version을 `0.3.55`로 올리고 `security:server-storage`를 추가했다.
  - `INSTITUTION_AUDIT_LEDGER_DIR`와 `INSTITUTION_ACCOUNT_REGISTRY_DIR`는 절대경로, repo 외부, public/build artifact 외부, 서로 분리된 non-nested directory, 서버 process 쓰기 가능 상태여야 한다.
  - placeholder, 상대경로, repo 내부 경로, public/out/dist/.next/app/server-route-templates/data 하위 경로, 쓰기 불가 대상은 BLOCKED가 된다.
- readiness와 handoff 연결
  - `security:server-readiness`가 storage gate 결과를 포함한다.
  - `ops:handoff:bundle`이 `server-storage-readiness-report.json`과 `.md`를 별도로 생성한다.
  - report는 filesystem path 원문을 저장하지 않고 PASS/BLOCKED 상태와 count만 남긴다.
- env 초안 보강
  - `server:env:init`의 storage 값은 repo-local 기본값 대신 `REPLACE-ME` 배포 placeholder로 남긴다.
- 검증 범위
  - 정상 외부 writable directory, 상대경로, placeholder, repo/public 경로, nested directory, file target, CLI JSON redaction, server readiness/handoff 연결을 테스트했다.

## v3.56 서버 deployment bundle

- 서버 배포 증적 묶음
  - 앱 version을 `0.3.56`으로 올리고 `server:deployment:bundle`, `server:deployment:json`, `server:deployment:markdown`을 추가했다.
  - bundle은 `dist/server-deployment-bundle` 아래에 runtime readiness, storage readiness, route materialization, summary, runbook report를 생성한다.
- route materialization dry-run
  - 실제 `app/api`에 쓰기 전에 route template과 materialized route file 계획을 dry-run으로 검증한다.
  - report에는 상대 route path와 template path만 남기고, secret, origin, storage path는 저장하지 않는다.
- 운영 연결
  - server deployment bundle은 server runtime, private storage, route materialization이 모두 READY일 때만 READY가 된다.
  - 운영 승인, 기관 공개키 승인, 호스팅 승인, 보관정책 승인은 여전히 외부 증빙으로 남는다.
- 검증 범위
  - ready bundle 생성, redacted summary/runbook, blocked route materialization, dry-run non-write 동작을 테스트했다.
