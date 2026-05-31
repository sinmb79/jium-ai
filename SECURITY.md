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

CI는 Node.js 24 런타임을 직접 지원하는 GitHub Actions major 버전을 사용합니다. 향후 Actions 경고가 발생하면 강제 환경변수로 덮지 말고, 해당 공식 action의 최신 major와 보안 공지를 먼저 확인합니다.

## 신고

보안 문제는 GitHub issue에 민감정보를 쓰지 말고, 재현 조건과 영향만 최소한으로 남겨 주세요.
