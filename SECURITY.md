# 보안 정책

지움AI는 보안된 환경과 피해자 보호를 기본 전제로 설계되었습니다.

## 수집하지 않는 정보

- 계정 비밀번호
- 주민등록번호 원문
- 카드번호
- 신분증 원본 이미지
- 불법촬영물, 성착취물, 딥페이크 피해 이미지/영상 원본
- 타인의 민감정보 원문

## 기본 저장 정책

- 기본 사건 보드는 브라우저 localStorage만 사용합니다.
- 서버 저장은 MVP에서 기본 기능이 아닙니다.
- 사용자는 사건을 Markdown으로 내려받거나 브라우저 저장소에서 삭제할 수 있습니다.
- 암호화 보관함은 WebCrypto 기반 패스프레이즈 암호화를 기본으로 하며, 데스크톱 배포에서는 `window.jiumSecureVault` 보안 저장소 브리지를 통해 Windows DPAPI, macOS Keychain, Linux Secret Service 같은 OS 보호 저장소로 연결할 수 있습니다.
- 보안 저장소 브리지가 없으면 브라우저 localStorage 암호화 모드로 동작하며, UI가 현재 backend와 OS 보안 저장소 연결 여부를 표시합니다.
- 데스크톱 bridge 코어는 `scripts/native-secure-vault-bridge.mjs`에 있으며, Electron preload 예시는 `desktop/electron-preload.cjs`에 있습니다. Windows는 DPAPI CurrentUser 보호 blob, macOS는 Keychain, Linux는 Secret Service를 사용합니다.

## 외부 AI 정책

- 기본값은 `AI_MODE=off`입니다.
- 외부 AI provider는 명시적으로 켤 때만 사용합니다.
- AI 호출 전 민감정보는 redaction pipeline을 거쳐야 합니다.
- 디지털 성범죄, 아동 피해, 협박, 스토킹, 자해 위험은 외부 AI 전송보다 전문기관 라우팅이 우선입니다.
- 실제 API 키는 `.env`, GitHub Secrets, 배포 플랫폼 secret store에만 둡니다.

## 링크 정책

- 피해 URL을 자동으로 열지 않습니다.
- 링크 미리보기, 썸네일 생성, Open Graph fetch를 하지 않습니다.
- 외부 공식기관 링크는 사용자가 누를 때만 열립니다.

## 운영 보안 게이트

배포 전 아래 검사를 통과해야 합니다.

```bash
npm run security:secrets
npm run security:audit
npm run typecheck
npm test
npm run build
```

`npm run ci:verify`는 위 검사를 한 번에 실행합니다. GitHub Actions의 Pull Request 품질 게이트와 Pages 배포 워크플로도 같은 검사를 사용합니다.

정적 호스팅 보안 헤더는 아래 명령으로 `public/_headers`에 생성합니다. Netlify와 Cloudflare Pages는 배포 산출물의 `_headers` 파일을 커스텀 응답 헤더 설정으로 사용할 수 있습니다. GitHub Pages는 이 파일을 제공만 하고 응답 헤더로 강제하지 않으므로, 강제 보안 헤더가 필요한 운영 배포는 Netlify/Cloudflare Pages/Vercel 같은 헤더 지원 호스팅을 우선합니다.

```bash
npm run security:headers
```

운영 URL에 실제 응답 헤더가 붙었는지는 아래 명령으로 확인합니다. GitHub Pages처럼 `_headers` 파일은 배포되지만 응답 헤더로 강제되지 않는 호스팅은 이 검사가 실패해야 정상입니다.

```bash
npm run security:headers:check -- https://your-production.example
```

담당자용 HTML과 기관 제출 인쇄본은 사용자 입력을 포함하므로 XSS 회귀 테스트를 별도 보안 게이트로 실행합니다.

```bash
npm run security:xss
```

승인된 기관·파트너 지능 피드는 원문 URL, 초대링크, 계정 핸들, 전화번호, onion 주소를 저장하지 않고, 패턴 ID·비식별 digest·출처·확인일·보존기한·감사로그만 허용합니다.

```bash
npm run security:feeds
```

제한 피드 가져오기는 로컬 운영자 세션을 요구합니다. 이 세션은 정적 앱 안의 실수 방지 장치이며, 조직 인증·수사권한·서버 RBAC를 대신하지 않습니다.

운영 승인 피드는 `jium-authorized-feed-signed-v1` envelope로 서명되어야 합니다. 지움AI는 고정된 신뢰 공개키로 RSA-SHA256 서명을 검증한 뒤에만 제한 피드를 수입합니다. 개인키는 저장소, 브라우저 번들, 환경변수에 넣지 말고 기관·파트너 쪽 안전한 서명 환경에서만 사용해야 합니다. 현재 저장소에는 실제 운영 공개키가 없으므로, 운영 배포 전 승인 기관/파트너의 공개키를 검증 절차와 함께 등록해야 합니다.

신뢰 공개키는 `data/trusted-authorized-feed-keys.json`에 등록합니다. 아래 검사는 공개키 레지스트리에 개인키 JWK 필드, private key usage, 중복 keyId, 잘못된 유효기간이 섞였는지 확인합니다.

```bash
npm run security:feed-keys
```

신규 기관 공개키는 바로 registry에 붙이지 말고 먼저 redacted review를 만듭니다.

```bash
npm run security:trusted-key:review -- --candidate ./partner-public-key.json --patch-output ./trusted-key-registry.patch.json
```

이 명령은 fingerprint, checklist, warning/error만 report에 남기고 raw modulus, 연락처, URL, secret, 피해자 지표는 report에 저장하지 않습니다. BLOCKED 후보는 patch를 쓰지 않습니다. `validUntil`이 없는 후보는 NEEDS_REVIEW로 남겨 회전 계획을 승인 기록에 남기게 합니다.

기관·파트너 운영자 세션은 `jium-authorized-operator-credential-signed-v1` credential로 열 수 있습니다. credential은 같은 신뢰 공개키 체계로 검증되며, subjectId는 이메일·전화번호·URL·초대링크가 아닌 가명 운영자 ID여야 합니다. 로컬 확인 문장 세션은 네트워크 없는 현장용 보조 장치이며, 운영 배포에서는 서명 credential 또는 서버 기반 기관 계정 인증을 우선해야 합니다.

서버 기반 기관 계정 세션은 역할별 capability matrix와 MFA 요구사항을 통과해야 합니다. PROGRAM_ADMIN의 계정 발급·해지, 신뢰 공개키 검토, 감사 원장 검토 같은 고위험 권한은 `SERVER_SESSION_MFA`와 `mfaVerifiedAt` 검증이 필요합니다.

```bash
npm run security:auth
```

대시보드의 기관 계정 관리자 패널은 서버 배포 모드에서 `/api/institution/accounts`에 연결해 기관 계정 목록 조회, 발급, 해지를 요청할 수 있습니다. 이 요청은 `credentials: include`, JSON Content-Type, `X-Jium-Institution-Account-Admin: 1` 보호 header를 사용하며, 실제 권한 검증은 서버 Route에서 `INSTITUTION_ACCOUNT_ADMIN` capability가 있는 PROGRAM_ADMIN MFA 세션으로만 수행합니다. 발급·해지 요청에는 승인번호, 승인자 가명 ID, 승인시각이 필요하며, 실제 작업자와 승인자가 같으면 거부합니다. PROGRAM_ADMIN 발급은 별도 `PROGRAM_ADMIN_PROVISION` 승인 범위로 기록해야 합니다. 승인번호, 승인자 ID, 승인 메모, subjectId에는 이메일, 전화번호, URL, 초대링크, onion 주소 같은 원문 식별자를 넣지 않아야 합니다. 같은 패널의 기관 세션 JSON 검토 기능은 role, capability, MFA, 만료, 고위험 권한, 원문 식별자 노출 위험을 확인하는 감사 보조 도구입니다.

계정 발급·해지 감사 이벤트에는 가명 accountId, approvalRef, approvalScope, targetRole, targetAccountStatus, safe reasonCode만 기록합니다. 감사 원장에는 승인자 실명, 연락처, 승인 메모 원문, URL, 초대링크, onion 주소를 저장하지 않습니다. 이 필드는 기관 내부 승인 문서, 계정 registry, hash-chain 감사 원장을 대조하기 위한 참조값이며 피해자 원문 정보나 수사 대상 식별자로 사용하면 안 됩니다.

서버 배포에서 기관 계정 세션 토큰을 발급할 때는 `INSTITUTION_SESSION_SECRET` 같은 서버 전용 HMAC secret을 사용해야 합니다. 이 값은 32바이트 이상 고엔트로피 secret이어야 하며, `NEXT_PUBLIC_*`, 브라우저 번들, 저장소, 클라이언트 JSON에 넣지 않습니다. 토큰 검증 코어는 변조, 만료, 약한 secret, 비활성 key를 거부합니다.

기관 세션 쿠키는 운영 환경에서 `__Host-jium_institution_session` 이름의 `HttpOnly; Secure; SameSite=Strict; Path=/` 쿠키로만 발급합니다. 개발용 HTTP 환경에서만 별도 dev 쿠키 이름을 사용하며, 운영 쿠키에는 `Domain`을 붙이지 않습니다.

기관 credential 로그인 HTTP 코어는 `POST`만 허용하고, `Content-Type: application/json`, 허용 Origin, `X-Jium-Institution-Login: 1` 헤더, 16KB 요청 본문 제한을 통과해야 합니다. 성공 응답은 서버 세션 토큰을 JSON 본문에 노출하지 않고 `Set-Cookie`로만 전달하며, 실패 응답에는 credential 검증 상세를 노출하지 않습니다. GitHub Pages 정적 배포를 유지하기 위해 `app/api` Route Handler는 저장소에 상시 두지 않고, 서버 배포 프로필에서만 템플릿을 materialize해 이 코어를 호출합니다.

기관 인증 감사 로그는 credential 원문, 세션 토큰, 원문 URL, 초대링크, 계정 핸들, onion 주소, 이메일, 전화번호를 저장하지 않습니다. 감사 이벤트에는 성공/거부 결과, reason code, Origin의 허용/거부/누락 분류, 기관명, 가명 subjectId, role, capability, 만료시각 같은 운영 확인 정보만 남깁니다.

기관 인증 감사 원장은 `jium-institution-audit-ledger-v1` 해시 체인으로 기록할 수 있습니다. 각 기록은 이전 기록 digest, 이벤트 digest, 기록 digest를 포함하며, 중간 이벤트 수정이나 삭제가 있으면 검증에서 드러납니다. 원장에도 credential 원문, 세션 토큰, 실제 Origin URL은 저장하지 않습니다.

서버/데스크톱 런타임에서는 기관 인증 감사 원장을 JSONL 파일로 append-only 저장할 수 있습니다. 파일 저장소는 설정된 기준 디렉터리 안의 단순 `.jsonl` 파일명만 허용하며, 기존 원장 검증이 실패하면 새 기록 추가를 거부합니다. 실제 운영 배포에서는 이 파일 저장소 또는 동등한 DB 저장소를 단일 writer 정책, 백업, 접근 통제와 함께 사용해야 합니다.

지원자·상담자 전달 파일은 `.jiumhandoff.json` archive로 만들며, 읽기전용 패킷 본문과 담당자 HTML, 증거 체인 manifest, 체크리스트는 AES-GCM passphrase 암호화 payload 안에 보관합니다. archive metadata에는 사건 ID, 수신 역할, 만료 시각, 체인 지문만 남깁니다. 접근 코드는 파일과 같은 채널에 남기지 말고, 만료된 handoff archive는 새 파일로 다시 만들어야 합니다.

수사·심의기관 제출 전 최종 검수표는 자동 제출 기능이 아니라 보류·검토·통과 항목을 분리하는 안전장치입니다. 검수표는 원본 피해물 포함 여부, 무결성 지문, 요청 이력, 수사권한 분리를 확인하며, IP·가입자·결제·서버 로그와 같은 항목은 피해자 직접 추적이 아니라 공식기관 요청사항으로만 표시합니다.

Next 서버 배포로 전환할 때는 기관 route adapter가 `INSTITUTION_SESSION_SECRET`, `INSTITUTION_ALLOWED_ORIGINS`, `INSTITUTION_AUDIT_LEDGER_DIR`, `INSTITUTION_ACCOUNT_REGISTRY_DIR`, 신뢰 공개키를 모두 요구합니다. `NEXT_PUBLIC_INSTITUTION_SESSION_SECRET`은 설정 자체를 거부하며, 운영 환경에서 `INSTITUTION_SECURE_COOKIES=false`도 거부합니다. 서버 Route 파일은 `server-route-templates/app/api/institution/*/route.ts`에 보관하고, `npm run server:routes:materialize`로 `app/api` 아래에 생성합니다. 다시 정적 Pages 빌드로 돌아갈 때는 `npm run server:routes:clean`으로 생성 파일을 제거합니다.

배포 프로필 가드는 `npm run security:deployment`로 실행합니다. `GITHUB_PAGES=true` 정적 export에서는 `app/**/route.ts` 같은 Route Handler 파일이 있으면 실패하며, `JIUM_SERVER_ROUTES=true` 서버 운영 프로필에서는 기관 secret, 허용 Origin, 감사 원장 디렉터리, 계정 registry 디렉터리 같은 서버 설정이 없으면 실패합니다. GitHub Pages 배포와 PR 품질 게이트 모두 이 검사를 실행합니다.

서버 운영 빌드는 아래 순서로 준비합니다.

```powershell
$env:JIUM_SERVER_ROUTES="true"
$env:INSTITUTION_ACCOUNT_REGISTRY_DIR="C:\secure\jium-account-registry"
npm run server:routes:materialize
npm run security:deployment
npm run build:server
```

실제 운영 전 최종 승인은 `npm run security:server-readiness` 또는 `npm run build:server:production`으로 확인합니다. 이 검사는 서버 env뿐 아니라 `data/trusted-authorized-feed-keys.json`에 최소 1개의 활성 승인 기관 공개키가 등록되어 있는지도 확인합니다. 만료됐거나 아직 유효하지 않은 공개키는 운영 활성키로 세지 않습니다. 현재 공개 저장소의 기본 registry는 비어 있으므로, 파트너 공개키 승인 절차가 끝나기 전에는 이 readiness 검사가 실패해야 정상입니다.

운영자 인수인계용 readiness 리포트는 아래 명령으로 생성합니다. 리포트는 secret 값, Origin 원문, 파일시스템 경로를 저장하지 않고 설정 여부와 개수만 표시합니다.

```bash
npm run security:server-readiness:json -- --output ./server-readiness.json
npm run security:server-readiness:markdown -- --output ./server-readiness.md
npm run server:env:init
```

`server:env:init`은 git에서 제외되는 `.env.server.local` 초안을 만들고 48바이트 random server session secret을 생성합니다. 다만 `INSTITUTION_ALLOWED_ORIGINS`는 `REPLACE-ME` placeholder로 남아 readiness가 BLOCKED가 되도록 설계되어 있습니다. 승인된 HTTPS 운영자 origin을 넣고, 공개키 registry와 private approval records가 준비된 뒤에만 서버 readiness를 다시 통과시켜야 합니다. `NEXT_PUBLIC_INSTITUTION_SESSION_SECRET`은 생성하지 않습니다.

### 데스크톱 release readiness

데스크톱 빌드는 GitHub Pages용 `/jium-ai` basePath를 상속하지 않는 별도 정적 export profile을 사용합니다.

```bash
npm run desktop:export
npm run desktop:release:check
npm run desktop:signing-secrets:check
npm run desktop:distribution:check
npm run desktop:update-feed:check -- --feed-dir ./dist/desktop
npm run desktop:publish:check -- --feed-dir ./dist/desktop
npm run desktop:release:bundle
npm run desktop:release:json -- --output ./desktop-readiness.json
npm run desktop:release:markdown -- --output ./desktop-readiness.md
npm run ops:approvals:init
npm run ops:approvals:check
npm run ops:go-live:check
npm run ops:handoff:bundle
```

`desktop:release:check`는 승인된 release channel, HTTPS updater endpoint, 최소 1개 플랫폼 signing profile이 설정되기 전까지 차단되어야 정상입니다. JSON/Markdown 리포트는 설정 존재 여부만 표시하며 updater URL 원문, signing certificate path, certificate hash, Apple team ID, Linux signing key ID, 피해자 지표, 초대 링크, onion 주소, 이메일, 전화번호를 저장하지 않습니다.

`desktop:signing-secrets:check`는 electron-builder가 실제로 사용할 수 있는 Windows 서명 조합을 확인합니다. 기본 권장 조합은 `CSC_LINK`와 `CSC_KEY_PASSWORD`이며, Windows 전용으로 `WIN_CSC_LINK`와 `WIN_CSC_KEY_PASSWORD`를 사용할 수 있습니다. 로컬 파일 인증서를 쓰는 경우 `WINDOWS_SIGNING_CERT_PATH`와 `WINDOWS_SIGNING_CERT_PASSWORD`가 함께 있어야 합니다. 단순 인증서 hash만으로는 signed package를 만들 수 없으므로 readiness 통과 조건으로 보지 않습니다.

`desktop:distribution:check`는 이미 생성된 로컬 데스크톱 산출물의 실행 파일, `app.asar`, 필수 정적 export, OS 보안 저장소 브리지, `electron-updater` 포함 여부를 확인하고 SHA-256 지문을 기록합니다. 이 리포트는 artifact 이름·크기·digest만 남기며 로컬 절대경로나 피해자 지표를 저장하지 않습니다.

`desktop:update-feed:check`는 generic updater metadata(`latest.yml`, macOS는 `latest-mac.yml`, Linux는 `latest-linux.yml`)와 같은 폴더의 artifact가 같은 빌드에서 나온 것인지 확인합니다. version, releaseDate, path, files 목록, SHA-512, 파일 크기가 일치해야 하며, metadata가 없으면 BLOCKED가 정상입니다. signed installer와 update metadata를 다른 빌드에서 섞어 올리면 안 됩니다.

`desktop:publish:check`는 GitHub Release에 signed installer를 업로드하기 직전의 마지막 기술 게이트입니다. `JIUM_DESKTOP_RELEASE_TAG`는 `package.json` version과 일치해야 하고, update metadata version도 같은 값을 가져야 합니다. 또한 `JIUM_DESKTOP_PUBLISH_APPROVAL=APPROVED`, `GITHUB_REPOSITORY`, `GITHUB_TOKEN` 또는 `GH_TOKEN`, distribution gate, release readiness gate, update feed gate가 모두 통과해야 READY가 됩니다. 리포트에는 token 값, update endpoint 원문, 인증서 material, 피해자 지표, URL, 초대 링크, onion 주소, 이메일, 전화번호를 저장하지 않습니다.

`desktop:release:bundle`은 distribution, release readiness, update feed 리포트와 요약을 `dist/desktop-release-bundle`에 모읍니다. 이 bundle은 운영자 검토용 증적이며, legal/institutional sign-off, 코드서명, update hosting 완료를 대신하지 않습니다. GitHub Actions의 `Desktop Release Candidate` 수동 workflow는 Windows runner에서 unsigned release candidate를 만들고 이 bundle과 unpacked package를 artifact로 보관합니다. workflow에는 signing certificate path/password 같은 secret을 직접 넣지 않습니다.

실제 signed installer 생성은 `Desktop Signed Release` 수동 workflow로 분리합니다. 이 workflow는 GitHub Secrets의 `JIUM_WINDOWS_CSC_LINK`, `JIUM_WINDOWS_CSC_KEY_PASSWORD`, 선택적 `JIUM_WINDOWS_SIGNING_CERT_SHA256`를 `CSC_*` 환경변수로 주입한 뒤 signing preflight, release readiness, signed packaging, update-feed 검증, evidence bundle 생성을 순서대로 실행합니다. secret 값은 로그나 bundle에 기록하지 않습니다. 기존 GitHub Release에 installer asset을 업로드하려면 `release_tag`가 앱 버전과 일치해야 하며, `publish_to_github_release=true`와 `publish_approval=APPROVED`를 명시해야 합니다. 업로드 job만 `contents: write` 권한을 가지며, 기본 signed build job은 release artifact를 Actions artifact로만 보관합니다.

`ops:approvals:check`는 운영 승인 증빙 packet을 go-live 전에 별도로 검증합니다. packet 경로는 `JIUM_OPERATIONAL_APPROVAL_RECORDS` 또는 git에서 제외된 기본값 `ops/private/operational-approval-records.json`입니다. packet에는 go-live approval, legal review, release evidence review, data retention acknowledgement, support route assignment, incident-response owner assignment에 대한 가명 승인 기록만 남겨야 합니다. report에는 상태와 카운트만 남기며 URL 원문, 연락처, 담당자명, secret, token, 피해자 지표, 초대 링크, onion 주소, 이메일, 전화번호를 저장하지 않습니다.

`ops:approvals:init`은 위 private packet의 안전한 초안을 생성합니다. 초안에는 `REPLACE-ME` placeholder와 `PENDING_APPROVAL` 상태가 들어가며, validator가 이를 BLOCKED로 처리합니다. 실제 승인 없이 placeholder를 그대로 둔 packet이 go-live를 통과하면 안 됩니다. 기존 packet은 기본적으로 덮어쓰지 않고, 운영자가 의도적으로 `-- --force`를 준 경우에만 다시 생성합니다.

`ops:go-live:check`는 운영 출시 직전의 종합 게이트입니다. 서버 runtime readiness와 desktop publish readiness가 모두 통과해야 하며, `JIUM_GO_LIVE_APPROVAL=APPROVED`, `JIUM_LEGAL_REVIEW_APPROVAL=APPROVED`, `JIUM_RELEASE_EVIDENCE_REVIEW=APPROVED`, `JIUM_DATA_RETENTION_POLICY_ACK=APPROVED`, HTTPS `JIUM_PUBLIC_APP_URL`, HTTPS `JIUM_PRIVACY_NOTICE_URL`, `JIUM_SUPPORT_CONTACT_ROUTE`, `JIUM_INCIDENT_RESPONSE_OWNER`, private approval records packet이 필요합니다. 리포트에는 URL 원문, support 연락처, 담당자명, secret, token, 인증서 material, 피해자 지표, 초대 링크, onion 주소, 이메일, 전화번호를 저장하지 않습니다.

`ops:handoff:bundle`은 서버 runtime readiness, desktop publish readiness, go-live report, 운영 인수인계 runbook을 `dist/operational-handoff-bundle`에 모읍니다. bundle은 운영 승인 증적을 검토하기 위한 묶음이며, 승인 자체를 대체하지 않습니다. 이 bundle에도 public URL 값, support 연락처, incident owner 이름, secret, token, 인증서 material, 피해자 지표, 초대 링크, onion 주소, 이메일, 전화번호를 넣지 않습니다.

### 기기 안전점검

피해자가 민감한 피해사실을 입력하거나 암호화 보관함을 열기 전에는 앱 안의 기기·브라우저 안전점검을 먼저 확인합니다. 이 점검은 본인만 쓰는 기기, 확장프로그램 격리, 원격제어 종료, 가해자 접근 차단을 필수 항목으로 두고, 악성코드 검사·신뢰 가능한 네트워크·동기화/클립보드 노출 축소를 권장 항목으로 둡니다. 체크 상태는 화면 상태로만 다루며 확장프로그램 목록, 기기 식별자, 피해자 원문을 저장하지 않습니다.

대시보드의 "기관 공개키 승인" 패널은 후보 JWK 공개키를 검토하고 registry patch JSON을 만들기 위한 보조 도구입니다. fingerprint와 checklist를 승인 기록에 남기는 용도이며, 개인키·PEM private key·서명 key material은 입력하거나 저장하지 않습니다.

같은 패널에서 registry 수명주기 검토를 실행하면 활성, 곧 만료, 만료, 만료일 없음, 활성 전 상태를 집계하고 운영 차단 항목을 표시합니다. 운영자는 폐기할 keyId와 폐기 시각을 입력해 검토 가능한 retirement patch를 만들 수 있습니다. 실제 교체 때는 새 공개키를 먼저 승인한 뒤 기존 키를 폐기하고, readiness 검사로 최소 1개의 활성 공개키가 남는지 확인해야 합니다.

대시보드의 "기관 감사 원장 검증" 패널은 서버/데스크톱에서 내보낸 `institution-auth-audit-ledger.jsonl`을 클라이언트에서 검증하는 보조 도구입니다. 해시 체인, sequence, event digest, record digest를 확인하고 집계 리포트를 만들지만, 검증 성공이 수사권한이나 신원 특정 권한을 의미하지는 않습니다. 검증 실패 원장은 덮어쓰지 말고 원본 파일을 보존한 뒤 관리자 절차로 분리해야 합니다.

서버 운영 프로필에서는 `/api/institution/audit-ledger` Route를 통해 같은 감사 원장 요약을 읽을 수 있습니다. 이 Route는 `INSTITUTION_AUDIT_LEDGER_REVIEW` capability가 있는 MFA 기반 `PROGRAM_ADMIN` 기관 세션만 허용하며, 성공·거부 이벤트를 다시 감사 원장에 남깁니다. 응답에는 원장 원문이 아니라 검증 상태, 집계, 최근 기록의 비식별 필드만 포함합니다.

CI는 Node.js 24 런타임을 직접 지원하는 GitHub Actions major 버전을 사용합니다. 향후 Actions 경고가 발생하면 강제 환경변수로 덮지 말고, 해당 공식 action의 최신 major와 보안 공지를 먼저 확인합니다.

## 신고

보안 문제는 GitHub issue에 민감정보를 쓰지 말고, 재현 조건과 영향만 최소한으로 남겨 주세요.
