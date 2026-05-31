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

기관·파트너 운영자 세션은 `jium-authorized-operator-credential-signed-v1` credential로 열 수 있습니다. credential은 같은 신뢰 공개키 체계로 검증되며, subjectId는 이메일·전화번호·URL·초대링크가 아닌 가명 운영자 ID여야 합니다. 로컬 확인 문장 세션은 네트워크 없는 현장용 보조 장치이며, 운영 배포에서는 서명 credential 또는 서버 기반 기관 계정 인증을 우선해야 합니다.

서버 기반 기관 계정 세션은 역할별 capability matrix와 MFA 요구사항을 통과해야 합니다. PROGRAM_ADMIN의 신뢰 공개키 검토 같은 고위험 권한은 `SERVER_SESSION_MFA`와 `mfaVerifiedAt` 검증이 필요합니다.

```bash
npm run security:auth
```

서버 배포에서 기관 계정 세션 토큰을 발급할 때는 `INSTITUTION_SESSION_SECRET` 같은 서버 전용 HMAC secret을 사용해야 합니다. 이 값은 32바이트 이상 고엔트로피 secret이어야 하며, `NEXT_PUBLIC_*`, 브라우저 번들, 저장소, 클라이언트 JSON에 넣지 않습니다. 토큰 검증 코어는 변조, 만료, 약한 secret, 비활성 key를 거부합니다.

기관 세션 쿠키는 운영 환경에서 `__Host-jium_institution_session` 이름의 `HttpOnly; Secure; SameSite=Strict; Path=/` 쿠키로만 발급합니다. 개발용 HTTP 환경에서만 별도 dev 쿠키 이름을 사용하며, 운영 쿠키에는 `Domain`을 붙이지 않습니다.

CI는 Node.js 24 런타임을 직접 지원하는 GitHub Actions major 버전을 사용합니다. 향후 Actions 경고가 발생하면 강제 환경변수로 덮지 말고, 해당 공식 action의 최신 major와 보안 공지를 먼저 확인합니다.

## 신고

보안 문제는 GitHub issue에 민감정보를 쓰지 말고, 재현 조건과 영향만 최소한으로 남겨 주세요.
