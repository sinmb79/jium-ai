# 지움AI

개인정보 노출과 디지털 피해 대응은 돈이 먼저가 아니어야 합니다.

지움AI는 삭제를 대신하는 서비스가 아니라, 사용자가 직접 움직일 수 있도록 사건을 분류하고 요청서, 증거 체크리스트, 무료 공식기관 경로, 진행 상태 보드를 준비하는 로컬 우선 웹앱입니다.

## 🧭 무엇을 도와주나요

- 개인정보 노출 진단
- 오래된 게시물/아동·청소년 시기 게시물 정리
- 검색 결과 캐시/스니펫 제거 요청서
- 계정 유출 의심 대응 체크리스트
- 디지털 성범죄·유포 협박 긴급 안전 안내
- 피해 게시물 URL, 게시 위치, 게시자 단서, 발견 일시를 여러 건으로 정리하는 접근경로 증거목록
- 사건별 7일/30일/90일 재확인 보드
- 안전 추적 계획, 삭제 요청 순서, 경찰 신고서, 형사 고소 상담자료 자동 생성
- 피해자가 직접 삭제를 원할 때의 증거 보존 → 직접 요청 → 공식기관 격상 → 사용자 확인 완료 플랜
- 온라인피해365센터, ECRM, KISA, 디지털성범죄피해자지원센터, 대한법률구조공단, 공개 법률 플랫폼 연계 경로 안내
- 디지털성범죄 범죄유형별 필요한 조치와 피해 확산 방지 대응 매트릭스
- n번방·박사방형 조직적 성착취와 놀쟈.com류 폐쇄형 유통 사이트 사례 기반 대응 원칙

## 🛡️ 안전 원칙

- 기본값은 `AI_MODE=off`입니다.
- API 키 없이 핵심 기능이 작동합니다.
- 비밀번호, 주민등록번호, 카드번호, 피해 이미지/영상 원본이 감지되면 결과 생성과 저장을 멈춥니다.
- URL 미리보기, 자동 접속, 무단 크롤링을 하지 않습니다.
- 디지털 성범죄 사건은 외부 AI보다 전문기관 연결을 우선합니다.
- 사건 보드는 서버가 아니라 현재 브라우저의 localStorage에 저장됩니다.
- 로컬 저장은 기본적으로 URL 경로를 숨기며, 기관 제출을 위해 정확한 URL 보관이 필요할 때만 사용자가 명시적으로 선택합니다.
- 유출자 신원 특정은 지움AI가 하지 않습니다. 게시자 단서만 정리하고, 실제 확인은 수사기관·법원·플랫폼의 공식 절차가 필요합니다.
- 외부 기관·법률 플랫폼으로 이동할 때 사건 내용과 피해 URL은 자동 전달하지 않습니다. 사용자가 문서를 검토한 뒤 직접 제출합니다.
- 피해자 직접 삭제 플랜도 자동 삭제가 아니라, 사용자가 검토하고 제출할 안전한 순서와 문안만 제공합니다.
- 과거 범죄 양상은 범행 방법이 아니라 위험 신호, 필요한 조치, 주변인의 도움 방식으로만 보여줍니다.
- 의심 사이트 접속, 초대코드 공유, 피해물 다운로드처럼 피해 확산에 기여할 수 있는 행동은 안내하지 않습니다.

## 🗺️ 처음 보는 사람을 위한 구조

지움AI는 크게 네 부분으로 나뉩니다.

- `app/`: 실제 페이지입니다. 첫 화면, 사건 보드, 공식기관 목록, 긴급 안전 화면이 여기에 있습니다.
- `components/`: 화면 조각입니다. 사건 입력 폼, 접근경로 증거목록, 요청서, 대응 패키지, 빠른 나가기 버튼처럼 사용자가 직접 만지는 부분입니다.
- `lib/`: 판단과 문서 생성의 중심입니다. 사건 분류, 접근경로 정리, 민감정보 감지, 요청서 생성, 공식기관 라우팅, 로컬 저장 정책이 들어 있습니다.
- `tests/`: 안전장치입니다. 분류가 제대로 되는지, 민감정보가 막히는지, 접근경로 증거목록이 문서에 반영되는지, 로컬 저장이 낮춰진 사본으로 되는지 확인합니다.

더 자세한 설명은 [초보자용 프로젝트 해설](docs/beginner-project-guide-v1.6.md)을 먼저 읽으면 됩니다. 개발자가 아니어도 “어느 파일을 보면 무엇을 알 수 있는지” 이해할 수 있도록 적었습니다.

접근경로 증거목록의 설계 의도와 저장 경계는 [접근경로 증거목록 설계 v1.5](docs/evidence-access-ledger-v1.5.md)에, 피해자 직접 삭제 실행 흐름은 [피해자 직접 삭제 희망 플로우 v1.7](docs/victim-direct-deletion-flow-v1.7.md)에 정리했습니다.

## 🚀 실행하기

처음 실행할 때 필요한 패키지를 설치합니다.

```bash
npm install
```

개발 서버를 켭니다.

```bash
npm run dev
```

브라우저에서 엽니다.

```txt
http://localhost:3000
```

공개 페이지:

```txt
https://sinmb79.github.io/jium-ai/
```

## ⚙️ 환경변수

기본 모드는 환경변수가 없어도 동작합니다.

유료 AI provider를 서버에서 명시적으로 켜려면 `.env.example`을 참고해 `.env`를 만듭니다.

```bash
cp .env.example .env
```

가장 안전한 기본값입니다.

```env
AI_MODE=off
AI_PROVIDER=rule
```

## 🧠 지원 가능한 AI provider 구조

현재 공개 UI는 `AI_MODE=off`의 rule-based/local-first 흐름으로 동작합니다.

`lib/ai`에는 서버 런타임에서 붙일 수 있는 provider adapter 골격이 준비되어 있지만, GitHub Pages 공개 버전은 외부 AI API를 호출하지 않습니다.

- rule-based provider
- OpenAI
- Anthropic Claude
- Google Gemini
- NAVER CLOVA Studio
- Upstage Solar
- Azure OpenAI
- OpenAI-compatible endpoint

중요한 사건은 AI보다 안전 라우팅이 먼저입니다. 서버형 배포에서 유료 provider를 켜더라도 민감정보는 redaction pipeline을 거친 뒤에만 전송할 수 있고, 디지털성범죄·차단 수준 민감정보는 rule-based 안전 라우팅으로 되돌립니다.

GitHub Pages 공개 버전은 정적·로컬 우선 모드로 배포됩니다. 서버 측 유료 AI API를 실제로 붙일 때는 Vercel, Netlify, 내부망 Next.js 서버처럼 서버 런타임이 있는 환경에서 `lib/ai` adapter를 연결하세요.

## 🧪 검증

타입 검사를 실행합니다.

```bash
npm run typecheck
```

테스트를 실행합니다.

```bash
npm test
```

프로덕션 빌드를 확인합니다.

```bash
npm run build
```

## 🧱 보안된 환경에서의 권장 운영

- `AI_MODE=off` 유지
- 서버 저장 기능 비활성
- 공용 PC에서는 localStorage 삭제
- 로컬 사건 보드는 기본적으로 URL 경로와 차단 수준 정보를 저장용 문서에서 낮춰 보관하며, 90일이 지난 기록은 로드 시 자동 정리
- 정확한 URL 보관은 개인 기기에서 기관 제출용으로 필요할 때만 명시적으로 선택
- 외부 링크 이동 전 사용자 확인
- 차단 수준 민감정보가 있으면 요청서·신고서 초안 생성 전 입력 정리
- 로그에 사용자 입력 원문 저장 금지
- 피해물 원본 업로드 UI 추가 금지
- 데스크톱 운영에서는 `npm run desktop:vault:describe`로 Windows DPAPI, macOS Keychain, Linux Secret Service bridge 연결 상태를 확인
- 수동 저장 점검은 PowerShell 파이프 인코딩을 피하기 위해 `npm run desktop:vault -- write <key> <utf8-file>` 형식을 권장
- Electron 기반 로컬 앱은 `desktop/electron-preload.cjs`를 preload로 연결해 `window.jiumSecureVault`를 제공
- 데스크톱 정적 산출물은 `npm run desktop:export`로 생성하며, release 전에는 `npm run desktop:release:check`로 channel, HTTPS update URL, signing profile 준비 여부를 확인
- 로컬 데스크톱 배포 산출물은 `npm run desktop:distribution:check`로 `app.asar` 필수 파일, 금지 의존성, artifact 크기와 SHA-256 지문을 점검
- 자동 업데이트 feed는 signed installer와 `latest.yml`이 같은 빌드에서 생성된 뒤 `npm run desktop:update-feed:check -- --feed-dir <배포폴더>`로 버전, SHA-512, 파일 크기 일치 여부를 확인
- 릴리즈 후보 증적은 `npm run desktop:release:bundle`로 `dist/desktop-release-bundle`에 모으며, GitHub Actions의 `Desktop Release Candidate` 수동 워크플로도 같은 bundle과 Windows unpacked package를 artifact로 보관
- signed Windows release는 `desktop:signing-secrets:check`가 `CSC_LINK`/`CSC_KEY_PASSWORD` 또는 Windows 전용 동등 secret 조합을 확인한 뒤 `Desktop Signed Release` 수동 워크플로에서만 진행
- GitHub Release 업로드 직전에는 `npm run desktop:publish:check -- --feed-dir <배포폴더>`로 `JIUM_DESKTOP_RELEASE_TAG`, `package.json` version, update metadata version, human approval, GitHub upload token, 산출물 검증을 한 번 더 확인
- `Desktop Signed Release`의 GitHub Release 업로드 job은 `publish_to_github_release=true`와 `publish_approval=APPROVED`가 모두 있어야 실행되며, 업로드 job만 `contents: write` 권한을 사용
- `desktop:release:json`과 `desktop:release:markdown`은 updater URL 원문, 인증서 경로·hash, team ID, signing key ID, 피해자 지표를 저장하지 않는 redacted 인수인계 리포트를 생성
- 서버 운영 전에는 `npm run security:server-storage`로 감사 원장과 기관 계정 registry 저장소가 repo 외부의 쓰기 가능한 분리 경로인지 확인
- 서버 배포 증적은 `npm run server:deployment:bundle`로 `dist/server-deployment-bundle`에 모으며, runtime·storage·route materialization 리포트를 함께 검토
- 운영 준비 초안은 `npm run ops:onboarding:init`로 생성하며, server env·approval records·storage/key checklist를 git 제외 private 경로에 둠
- 운영 오픈 직전에는 `npm run ops:go-live:check`로 서버 readiness, desktop publish readiness, public HTTPS URL, legal/go-live/data-retention 승인, support/incident-response 지정 여부를 한 번에 확인
- 운영 인수인계 증적은 `npm run ops:handoff:bundle`로 `dist/operational-handoff-bundle`에 모으며, 서버·데스크톱·go-live 리포트와 redacted runbook을 함께 보관
- 외부 심사·승인용 릴리즈 증빙 묶음은 `npm run ops:release-dossier`로 `dist/operational-release-dossier`에 생성하며, 원문 URL·연락처·토큰·초대링크·onion 주소가 들어가지 않았는지 leak scan을 함께 확인
- 첫 진단 화면과 사건 보드에는 악성 확장프로그램, 원격제어, 공용 PC, 가해자 접근 가능성을 확인하는 기기 안전점검을 표시

## 🏷️ 메타

메타 설명: 비용 없이 시작하는 로컬 우선 디지털 권리구제 도우미.

레이블/태그: 개인정보, 권리구제, 디지털성범죄, 삭제요청서, 로컬우선, 무료도구, 22B Labs

## 🌿 제작자의 철학

제4의 길은 인간과 AI가 서로를 소모하지 않고 함께 더 멀리 가는 길입니다.

지움AI도 같은 방향에 서 있습니다. 피해자의 데이터를 더 모으는 기술이 아니라, 피해자가 덜 드러나고도 다시 움직일 수 있게 하는 기술이어야 합니다.

22B Labs · 제4의 길 (The 4th Path)

## v0.3.51 Operational Approval Records

Production go-live now requires a private, redacted approval records packet in addition to environment approval flags.

- `npm run ops:approvals:check` validates the private approval packet.
- `npm run ops:go-live:check` now includes the approval-record gate.
- `npm run ops:handoff:bundle` includes `operational-approval-records-report.json` and `.md`.
- The default private path is `ops/private/operational-approval-records.json`, and `ops/private` is ignored by git.

The approval packet must contain only pseudonymous references, release/package alignment, HTTPS status fields, and required approval types. Do not store raw URLs, contacts, owner names, secrets, tokens, victim indicators, invite links, onion addresses, emails, or phone numbers in the packet.

## v0.3.52 Approval Packet Init

Operators can now create a private approval packet scaffold with:

```bash
npm run ops:approvals:init
```

The generated packet stays BLOCKED until every `REPLACE-ME` placeholder is replaced and each record is changed to `APPROVED` after real human approval. Existing packets are not overwritten unless `-- --force` is passed.

## v0.3.53 Trusted Key Candidate Review

Institution public-key onboarding can now be reviewed from the CLI:

```bash
npm run security:trusted-key:review -- --candidate ./partner-public-key.json --patch-output ./trusted-key-registry.patch.json
```

The review prints a redacted fingerprint/checklist report and writes a registry patch only when the candidate is not blocked. Reports do not include raw public-key modulus values, contacts, URLs, secrets, or victim indicators.

## v0.3.54 Server Runtime Env Init

Server deployments can now create a private env scaffold with:

```bash
npm run server:env:init
```

The scaffold writes `.env.server.local`, generates a 48-byte random server session secret, keeps `NEXT_PUBLIC_INSTITUTION_SESSION_SECRET` out, and intentionally leaves `INSTITUTION_ALLOWED_ORIGINS` plus server storage directories as blocked placeholders until the approved HTTPS operator origin and deployment volumes are known.

## v0.3.55 Server Storage Readiness

Server deployments now have a separate storage gate:

```bash
npm run security:server-storage
npm run security:server-storage:json -- --output ./server-storage-readiness.json
npm run security:server-storage:markdown -- --output ./server-storage-readiness.md
```

The gate requires audit ledger and account registry directories to be absolute, outside the app repository, outside public/build artifact folders, separate from each other, and writable by the server process. Reports redact filesystem paths and record only readiness states.

`npm run security:server-readiness` and `npm run ops:handoff:bundle` now include this storage result, so production handoff is blocked until private server storage is explicitly provisioned.

## v0.3.56 Server Deployment Bundle

Server deployment evidence can now be gathered with:

```bash
npm run server:deployment:bundle
```

The bundle writes runtime readiness, storage readiness, route materialization, summary, and runbook reports under `dist/server-deployment-bundle`. Reports are redacted and include route file names, counts, version, commit, and readiness states only.

## v0.3.57 Production Onboarding Init

Operators can now create a private go-live preparation scaffold with:

```bash
npm run ops:onboarding:init
```

It creates `.env.server.local`, `ops/private/operational-approval-records.json`, and private onboarding checklist/storage/key templates under `ops/private/production-onboarding`. Existing files are not overwritten unless `-- --force` is passed, and command output does not print generated server secrets.

## v0.3.58 Production Onboarding Check

Operators can now validate the completed private onboarding scaffold with:

```bash
npm run ops:onboarding:check
npm run ops:onboarding:check:json -- --output ./production-onboarding-readiness.json
npm run ops:onboarding:check:markdown -- --output ./production-onboarding-readiness.md
```

The check stays BLOCKED until server env values, repo-external server storage, private approval records, operator checklist records, and storage decisions are all approved. Reports store only readiness states, counts, version, and relative private paths; they exclude generated secrets, trusted origins, storage paths, support contacts, victim indicators, raw URLs, invite links, onion addresses, emails, phone numbers, passwords, tokens, and certificate material.

## v0.3.59 Onboarding Gate in Go-Live and Handoff

Production onboarding readiness is now part of the final operating gates:

```bash
npm run ops:go-live:check
npm run ops:handoff:bundle
```

`ops:go-live:check` now blocks if `ops:onboarding:check` would fail. `ops:handoff:bundle` now includes `production-onboarding-readiness-report.json` and `.md` beside server, desktop, approval, and go-live reports.

## v0.3.60 Production Onboarding Upgrade

Operators can safely refresh private onboarding scaffold metadata after an app version bump:

```bash
npm run ops:onboarding:upgrade
npm run ops:onboarding:upgrade:json -- --dry-run
```

The upgrade updates package/release metadata for placeholder scaffolds without marking anything approved. If operational approval records already contain approved release evidence, the command skips them and asks for manual review instead of rewriting old approvals.

## v0.3.61 Operational Action Plan

Operators can turn the redacted operational handoff bundle into an owner-routed launch checklist:

```bash
npm run ops:action-plan
npm run ops:action-plan:json
npm run ops:action-plan:markdown
```

The plan writes `operational-action-plan.json` and `operational-action-plan.md` under `dist/operational-handoff-bundle`. It groups blockers by onboarding, server runtime, server storage, desktop release, approval records, and go-live owner role, then attaches evidence targets and verification commands for each phase.

The action plan remains redacted. It must not contain raw URLs, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or private storage paths.

## v0.3.62 Server Storage Init

Operators can prepare repo-external server storage directories with a redacted helper:

```bash
npm run server:storage:init
npm run server:storage:init -- --storage-root <approved-absolute-storage-root> --write-env
```

The helper creates separate `audit-ledger` and `account-registry` directories outside the repository and can update `.env.server.local` placeholders after review. Existing non-placeholder env values are preserved unless `--force-env` is passed.

Reports do not print absolute storage paths. The private env file may contain real paths and must stay out of git.

## v0.3.63 Server Storage Runbook Integration

The server storage init helper is now included in the operating runbooks:

```bash
npm run server:deployment:bundle
npm run ops:action-plan
```

Both outputs now show `npm run server:storage:init -- --storage-root <approved-absolute-storage-root> --write-env` before the storage readiness checks, so operators can move from selected storage location to validated server readiness without hunting for the helper command.

## v0.3.64 Public Operations Env Init

Production go-live can now prepare reviewed public app, privacy notice, and support route URLs with:

```bash
npm run ops:public-env:init -- --base-url https://example.org/jium-ai/ --write-env
npm run ops:public-env:json -- --base-url https://example.org/jium-ai/ --write-env --output ./public-ops-env.json
npm run ops:public-env:markdown -- --base-url https://example.org/jium-ai/ --write-env --output ./public-ops-env.md
```

The report redacts raw URLs and records only route paths, URL validity states, counts, and env key statuses. The private env file may contain real URLs and must stay out of git.

The static app now also exposes `/privacy/` and `/support/`, so operators can point `JIUM_PRIVACY_NOTICE_URL` and `JIUM_SUPPORT_CONTACT_ROUTE` at reviewed HTTPS pages before the final go-live gate.

## v0.3.65 Public Operations in Production Onboarding

Production onboarding now includes public operations readiness before final go-live:

```bash
npm run ops:onboarding:init
npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env
npm run ops:onboarding:check
```

`ops:onboarding:init` creates `public-operations.template.json`, and `ops:onboarding:check` requires approved pseudonymous evidence for the public app, privacy notice, and support route. The actual URLs stay in private env/deployment settings and are redacted from reports.

## v0.3.66 Evidence Custody Chain

Submission packets now track evidence custody metadata for real operational handoff:

- `collectorRef`
- `deviceRef`
- `hashAlgorithm`
- `verifiedAt`
- `handoffRecipientRef`

These are pseudonymous references only. Names, phone numbers, emails, URLs, invite links, and onion addresses are redacted from custody refs and reported as custody warnings.

The pre-submission checklist now includes `evidence-custody-chain`, so missing custody metadata is visible before a victim or support worker submits the package to an official agency. Details are in [Evidence Custody Chain v0.3.66](docs/evidence-custody-chain-v0.3.66.md).

## v0.3.67 Hosted Security Header Audit Evidence

Hosted security header checks now produce redacted evidence reports for real deployment review:

```bash
npm run security:headers:check -- https://your-approved-domain.example --json --output dist/security-header-audit.json
npm run security:headers:check -- https://your-approved-domain.example --markdown --output dist/security-header-audit.md
```

The report schema is `jium-security-header-url-audit-v1`. Reports intentionally omit the raw target URL, host, path, query, and response header values, while still recording whether the public endpoint is HTTPS-ready, which required headers passed, and which checks block launch. Local HTTP is accepted only for localhost-based automated tests. Details are in [Hosted Security Header Audit v0.3.67](docs/hosted-security-header-audit-v0.3.67.md).

## v0.3.68 Hosted Security Header Go-Live Gate

Final go-live now requires a READY hosted security header audit report:

```bash
npm run security:headers:check -- https://your-approved-domain.example --json --output dist/security-header-audit.json
$env:JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT="dist/security-header-audit.json"
npm run ops:go-live:check
```

The go-live report stores only whether the audit report is present and READY, plus redacted counts. It does not store the audit report path, public URL, host, path, query, response header values, support contact, incident owner, tokens, or victim indicators. Details are in [Hosted Security Header Go-Live Gate v0.3.68](docs/hosted-security-header-go-live-gate-v0.3.68.md).

## v0.3.69 Hosted Security Header Onboarding Gate

Production onboarding now prepares and checks hosted security header audit evidence before final go-live:

```bash
npm run ops:onboarding:init
npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env
npm run security:headers:check -- <approved-https-public-app-url> --json --output ops/private/production-onboarding/hosted-security-header-audit.json
$env:JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT="ops/private/production-onboarding/hosted-security-header-audit.json"
npm run ops:onboarding:check
```

`ops:onboarding:check` now blocks unless the referenced audit report is READY, HTTPS-targeted, fetched successfully, below HTTP 400, and has zero header failures. The report remains redacted and does not store the audit report path, public URL, host, path, query, response header values, contacts, tokens, or victim indicators. Details are in [Hosted Security Header Onboarding Gate v0.3.69](docs/hosted-security-header-onboarding-gate-v0.3.69.md).

## v0.3.70 Secure Static Hosting Bundle

GitHub Pages remains useful for demo access, but it does not enforce the required `_headers` policy. For production-style static hosting, operators can now build a redacted bundle for `_headers`-capable providers:

```bash
npm run public:hosting:bundle
```

The bundle writes `dist/static-hosting-bundle/site` for Cloudflare Pages or Netlify, verifies that exported routes do not use the GitHub Pages base path, and checks that `_headers` exactly matches the repository security policy. Details are in [Secure Static Hosting Bundle v0.3.70](docs/secure-static-hosting-bundle-v0.3.70.md).

## v0.3.71 Static Hosting Go-Live Bridge

The operational handoff and action-plan runbooks now connect the static hosting bundle to the final go-live path. Operators are explicitly guided to build the `_headers`-capable bundle, deploy `dist/static-hosting-bundle/site` to an approved public host, run the hosted security header audit, and attach the redacted audit report before public URL approval.

```bash
npm run ops:handoff:bundle
npm run ops:action-plan
```

The generated action plan keeps public URLs, contacts, tokens, and victim indicators redacted while still requiring the evidence needed for production launch. Details are in [Static Hosting Go-Live Bridge v0.3.71](docs/static-hosting-go-live-bridge-v0.3.71.md).

## v0.3.72 Trusted Key Onboarding Init

Institution server readiness now has a safer first step for trusted public-key onboarding. Operators can generate an RSA signing keypair with the private JWK written only to a repo-external approved directory, while Jium AI writes the public candidate, registry patch, and redacted review report into the operating evidence flow:

```bash
npm run server:trusted-key:init -- --private-key-dir <approved-repo-external-private-key-dir> --key-id <approved-key-id> --issuer <approved-issuer-name>
```

The operational action plan now includes this command in the server-runtime phase before `security:trusted-key:review`. Reports intentionally omit private key values, raw public-key modulus values, private filesystem paths, contacts, URLs, and victim indicators. Details are in [Trusted Key Onboarding Init v0.3.72](docs/trusted-key-onboarding-init-v0.3.72.md).

## v0.3.73 Trusted Key Patch Apply Gate

Approved trusted-key registry patches can now be applied through a guarded command instead of a manual file edit:

```bash
npm run server:trusted-key:apply -- --patch <trusted-key-registry.patch.json> --approval-ref <pseudonymous-approval-reference>
```

The command validates the registry patch, requires a non-placeholder pseudonymous approval reference, writes a redacted apply report, and only then updates `data/trusted-authorized-feed-keys.json`. Reports intentionally omit raw approval references, raw public-key modulus values, absolute paths, contacts, URLs, and victim indicators. Details are in [Trusted Key Patch Apply Gate v0.3.73](docs/trusted-key-patch-apply-v0.3.73.md).

## v0.3.74 Production Onboarding Checklist Approval

Private production onboarding checklist records can now be marked approved through a guarded CLI:

```bash
npm run ops:onboarding:approve-checklist -- --record <checklist-record-id> --evidence-ref <pseudonymous-evidence-reference>
```

The command updates only `ops/private/production-onboarding/operator-checklist.json`, rejects placeholders/raw URLs/contacts/secrets, and writes a redacted evidence report with only a digest of the evidence reference. Details are in [Production Onboarding Checklist Approval v0.3.74](docs/production-onboarding-checklist-approval-v0.3.74.md).

## v0.3.75 Operational Approval Record Approval

Private operational approval records can now be marked approved through a guarded CLI instead of manual JSON editing:

```bash
npm run ops:approvals:approve-record -- --type <approval-record-type> --approved-by-ref <pseudonymous-approver-ref> --reference-id <pseudonymous-approval-reference> --scope <approval-scope> --evidence-digest <sha256-evidence-digest>
```

The command updates only `ops/private/operational-approval-records.json`, accepts the configured desktop release tag, rejects placeholders/raw URLs/contacts/secrets, and writes a redacted evidence report with only SHA-256 digests of pseudonymous approval references. Details are in [Operational Approval Record Approval v0.3.75](docs/operational-approval-record-approval-v0.3.75.md).

## v0.3.76 Production Onboarding Storage Decision Approval

Private onboarding storage-decision sections can now be marked approved through a guarded CLI:

```bash
npm run ops:onboarding:approve-storage-decision -- --section <audit-ledger|account-registry> --evidence-ref <pseudonymous-storage-evidence-reference>
```

The command updates only `ops/private/production-onboarding/storage-decision.template.json`, rejects placeholders/raw URLs/contacts/secrets/storage paths in evidence refs, and writes a redacted report with only a SHA-256 digest of the evidence reference. Details are in [Production Onboarding Storage Decision Approval v0.3.76](docs/production-onboarding-storage-decision-approval-v0.3.76.md).

## v0.3.77 Production Onboarding Public Operations Approval

Private onboarding public-operations sections can now be marked approved through a guarded CLI:

```bash
npm run ops:onboarding:approve-public-operations -- --section <public-app|privacy-notice|support-route> --evidence-ref <pseudonymous-public-operations-evidence-reference>
```

The command updates only `ops/private/production-onboarding/public-operations.template.json`, rejects placeholders/raw URLs/contacts/secrets in evidence refs, and writes a redacted report with only a SHA-256 digest of the evidence reference. Details are in [Production Onboarding Public Operations Approval v0.3.77](docs/production-onboarding-public-operations-approval-v0.3.77.md).

## v0.3.78 Server Origin Approval

Approved institution operator origins can now be applied to `.env.server.local` through a guarded CLI instead of manual editing:

```bash
npm run server:origin:apply -- --origin <approved-https-operator-origin> --approval-ref <pseudonymous-origin-approval-reference>
```

The command writes only to the private server runtime env file, validates HTTPS origin-only values, blocks placeholders/raw contacts/invites/onion values/secrets, and emits redacted approval reports with only origin count plus SHA-256 digests. `security:server-readiness`, `server:deployment:bundle`, and `ops:action-plan` now point operators to this command before server deployment. Details are in [Server Origin Approval v0.3.78](docs/server-origin-approval-v0.3.78.md).

## v0.3.79 Operational Go-Live Env Apply

Approved operational records can now drive go-live approval flags without manual env editing:

```bash
npm run ops:go-live:env:apply -- --incident-owner-ref <pseudonymous-incident-owner-reference>
```

The command only writes approval flags after `ops:approvals:check` would be READY, applies a pseudonymous incident owner reference, rejects raw contacts/URLs/placeholders/secrets, and emits redacted reports with only key statuses plus SHA-256 digests. `ops:go-live:check` and `ops:action-plan` now point operators to this command when approval env flags are missing. Details are in [Operational Go-Live Env Apply v0.3.79](docs/operational-go-live-env-apply-v0.3.79.md).

## v0.3.80 Desktop Release Env Apply

Approved non-secret desktop release configuration can now be applied to the ignored `.env.desktop.local` file through a guarded CLI:

```bash
npm run desktop:release-env:apply -- --channel <approved-release-channel> --update-url <approved-https-update-url> --publish-approval-ref <pseudonymous-desktop-publish-approval-reference>
```

The command writes only the release channel, HTTPS updater URL, release tag, and `JIUM_DESKTOP_PUBLISH_APPROVAL=APPROVED` after validation. Signing certificates, certificate passwords, Azure signing secrets, and GitHub tokens are never read from `.env.desktop.local`; they must stay in the real process environment or GitHub Secrets. `desktop:release:check`, `desktop:signing-secrets:check`, `desktop:publish:check`, and `ops:action-plan` now load or route these non-secret settings through the guarded command. Details are in [Desktop Release Env Apply v0.3.80](docs/desktop-release-env-apply-v0.3.80.md).

## v0.3.81 Hosted Security Header Audit Env Apply

READY hosted security header audit evidence can now be applied to `.env.server.local` through a guarded CLI:

```bash
npm run ops:hosted-audit:apply -- --audit-report ops/private/production-onboarding/hosted-security-header-audit.json
```

The command only accepts a READY `jium-security-header-url-audit-v1` report that targets HTTPS production hosting, fetched successfully, returned below HTTP 400, and has zero header failures. It writes only the relative audit report path to the ignored server env file and emits redacted reports with status fields plus a SHA-256 digest. Details are in [Hosted Security Header Audit Env Apply v0.3.81](docs/hosted-security-header-audit-env-apply-v0.3.81.md).

## v0.3.82 Server Runtime Env File Loading

Operational readiness checks now load allowlisted values from the ignored `.env.server.local` file:

```bash
npm run security:server-readiness
npm run security:server-storage
npm run ops:go-live:check
```

This lets the guarded commands that write `.env.server.local` feed the final readiness gates without undocumented manual shell exports. Process environment values still override file values, and generated reports continue to redact secrets, trusted origins, storage paths, hosted audit paths, public URLs, and contacts. Details are in [Server Runtime Env File Loading v0.3.82](docs/server-runtime-env-file-loading-v0.3.82.md).

## v0.3.83 Operational Go-Live Rehearsal

Operators can now run a safe synthetic rehearsal of the final launch gates:

```bash
npm run ops:go-live:rehearsal
npm run ops:go-live:rehearsal:json -- --output dist/operational-go-live-rehearsal/report.json
```

The command creates a temporary private workspace, fills it with synthetic pseudonymous approvals, HTTPS routes, hosted-audit evidence, server env, server storage, and a trusted-key record, then runs the real server/onboarding/approval/hosted-audit/go-live validators. Desktop publish readiness is explicitly marked as `SIMULATED_SIGNED_ARTIFACTS`, because real signed installers and update metadata still require the approved signing flow. The report is redacted and the temporary workspace is removed after validation. Details are in [Operational Go-Live Rehearsal v0.3.83](docs/operational-go-live-rehearsal-v0.3.83.md).

## v0.3.84 Operational Release Dossier

External release reviewers can now receive one redacted evidence manifest:

```bash
npm run ops:release-dossier
npm run ops:release-dossier:json -- --output dist/operational-release-dossier/report.json
```

The dossier gathers the operational handoff summary, owner-routed action plan, synthetic go-live rehearsal result, required review files, gate counts, external records still needed, and priority actions. It runs a leak scan and blocks if raw URLs, contacts, tokens, invite links, onion addresses, phone numbers, repository paths, or similar unsafe values appear in the generated manifest. `ops:action-plan` now routes final go-live archiving through this command as well. Details are in [Operational Release Dossier v0.3.84](docs/operational-release-dossier-v0.3.84.md).
