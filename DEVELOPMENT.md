# 지움AI DEVELOPMENT

작성자: 22B Labs · 제4의 길 (The 4th Path)

메타 설명: 지움AI MVP를 안전하게 구현하기 위한 개발 준비 문서입니다.

태그: 지움AI, 개인정보, 권리구제, Next.js, Prisma, 안전가드레일, 22B Labs

---

## 왜 이 프로젝트가 존재하는가

지움AI는 사용자의 디지털 흔적을 대신 지워주는 서비스가 아닙니다.

이 프로젝트의 목적은 사용자가 자신의 권리를 직접 행사할 수 있도록 사건을 분류하고, 삭제 요청서와 증거 정리 체크리스트, 공공기관 연결 경로, 진행 상태 관리를 제공하는 것입니다.

핵심 문장은 단순합니다.

> 직접 삭제하지 않는다. 대신 사용자가 스스로 움직일 수 있게 만든다.

---

## 현재 폴더 상태

- 기준 문서: `jium-ai-dev-implementation.md`
- v1.1 보강 문서: `docs/benchmark-user-security-ai-addendum-v1.1.md`
- v1.2 법률·형사 서비스 연계 문서: `docs/legal-criminal-service-integration-v1.2.md`
- v1.3 디지털성범죄 대응 매트릭스: `docs/digital-sex-crime-response-matrix-v1.3.md`
- v1.4 전체 재검토 보강 문서: `docs/final-review-hardening-v1.4.md`
- v1.5 주요 사례 기반 대응 보강 문서: `docs/digital-sex-crime-case-lessons-v1.5.md`
- v1.5 접근경로 증거목록 설계 문서: `docs/evidence-access-ledger-v1.5.md`
- v1.7 피해자 직접 삭제 희망 플로우: `docs/victim-direct-deletion-flow-v1.7.md`
- v1.8 첫 사용자 안내서: `docs/first-user-guide-v1.8.md`
- 현재 앱 코드: Next.js App Router 기반으로 구현됨
- `package.json`: 있음
- Git 저장소: `https://github.com/sinmb79/jium-ai`
- 공개 페이지: `https://sinmb79.github.io/jium-ai/`
- `design/` 폴더: 없음
- `docs/` 폴더: 있음

확인된 로컬 도구:

- Node.js: `v24.14.0`
- npm: `11.9.0`
- pnpm: `10.33.0`
- Git: 설치됨
- Yarn: 설치되어 있지 않음

권장 패키지 매니저는 `npm`입니다. 이유는 구현서의 README 예시와 가장 잘 맞고, 초보 사용자도 따라 하기 쉽기 때문입니다.

---

## 구현 기준

권장 스택은 다음과 같습니다.

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- 인증은 MVP에서 간단 이메일 기반 또는 NextAuth
- OpenAI API는 선택 기능
- API 키가 없으면 rule-based fallback으로 동작

초기 구현에서는 AI API보다 규칙 기반 분류와 템플릿 생성이 먼저입니다. 안전한 골격이 없는 지능은 도구가 아니라 위험한 증폭기가 되기 쉽습니다.

v1.1 보강 기준:

- 기본값은 무료 rule-based 모드입니다.
- AI API는 선택 기능이며, 민감정보 마스킹 이후에만 호출합니다.
- OpenAI, Anthropic Claude, Google Gemini, NAVER CLOVA Studio, Upstage Solar, Azure OpenAI, OpenAI-compatible endpoint를 provider adapter로 확장할 수 있게 설계합니다.
- 디지털 성범죄, 아동 피해, 유포 협박, 스토킹, 자해 위험은 AI API보다 안전 라우팅을 우선합니다.
- 원본 피해 이미지/영상, 비밀번호, 주민등록번호 원문은 저장하지 않습니다.

v1.5 접근경로 증거목록 기준:

- 피해 게시물 원본을 저장하거나 자동 접속하지 않습니다.
- URL, 플랫폼, 게시 위치, 게시자 ID·닉네임, 발견 일시, 제출 대상, 처리 상태, 접수번호 메모처럼 기관 제출에 필요한 최소 단서만 기록합니다.
- 한 사건 안에 여러 접근경로를 누적할 수 있어야 합니다.
- 접근경로 증거목록은 삭제 요청서, 디지털성범죄 상담 준비자료, 경찰 신고 준비서, 형사 고소 상담자료, Markdown 내보내기에 같은 내용으로 반영되어야 합니다.
- 로컬 저장은 기본적으로 URL 경로를 숨기고, 정확한 URL 보관은 사용자가 개인 기기에서 기관 제출용으로 명시 선택할 때만 허용합니다.

v1.7 피해자 직접 삭제 희망 플로우 기준:

- 피해자가 직접 삭제를 원해도 삭제 전 증거 보존, 직접 요청, 공식기관 격상, 사용자 확인 완료를 분리합니다.
- 일반 개인정보·사진·이미지 노출은 직접 삭제 요청 플랜을 제공하되 자동 제출하지 않습니다.
- 본인 계정 또는 관리자 권한이 확인된 경우에만 직접 삭제 실행 가능으로 표시합니다.
- 사진 속 당사자이지만 게시자가 아닌 경우, 권한 불명확 상태, 대리 지원 상태는 삭제 요청과 공식기관 연결만 허용합니다.
- 디지털성범죄·유포협박 사건은 피해자 단독 처리보다 전문기관 삭제지원을 우선합니다.
- 삭제 완료와 사용자 직접 확인 완료는 별도 상태로 관리합니다.
- 재노출은 기존 성공 기록을 덮어쓰지 않고 새 접근경로로 추가합니다.

---

## 절대 원칙

다음 기능은 MVP에 넣지 않습니다.

- 실제 게시물 자동 삭제
- 자동 대량 신고
- 정부 사이트 또는 플랫폼 로그인 자동화
- 사용자 비밀번호 입력
- 주민등록번호 원문 저장
- 불법촬영물, 성착취물, 딥페이크 피해물 원본 업로드
- 해외 불법 사이트 크롤링
- 삭제 성공 보장 문구
- 유료 삭제 대행 결제
- 악성 리뷰 삭제 전용 기능
- 타인 게시물 은폐 기능

디지털 성범죄, 아동 피해, 협박, 스토킹, 자해 위험은 서비스 내부 처리보다 전문기관 연결을 우선합니다.

---

## MVP 기능 범위

v0.1에서 반드시 구현할 기능:

1. 랜딩 페이지
2. 사건 접수 폼
3. 규칙 기반 사건 분류
4. 삭제 가능성 진단
5. 삭제 요청서 생성
6. 공공기관 라우팅
7. 사건 상태 보드
8. 안전 가드레일
9. 테스트 코드
10. README

v1.1에서 추가로 반드시 반영할 기능:

1. 초보자 모드
2. 저장하지 않고 진단/요청서 생성
3. 로컬 우선 사건 보드
4. 서버 저장 opt-in
5. 민감정보 감지와 마스킹 미리보기
6. AI provider 장애 시 rule-based fallback
7. `삭제 완료`와 `사용자 확인 완료` 상태 분리
8. 빠른 나가기/민감 모드
9. 링크 미리보기와 자동 URL fetch 금지
10. 7일/30일/90일 재확인 체크리스트
11. 접근경로 증거목록과 기관 제출용 문서 반영
12. 정확한 URL 보관 opt-in

OpenAI API 연결, PDF 다운로드, 브라우저 알림, 다국어 요청서는 v0.2 이후로 미룹니다.

---

## 첫 개발 순서

다음 순서로 진행합니다.

1. 프로젝트 뼈대 생성
2. 무료 rule-based 진단 흐름 구현
3. 민감정보 감지/마스킹 구현
4. 디지털 성범죄 안전 라우팅 구현
5. 삭제 요청서/상담 준비자료 생성 구현
6. 공공기관 라우팅 데이터 구현
7. 로컬 우선 사건 보드 구현
8. 서버 저장 opt-in과 Prisma 스키마 구현
9. 다중 AI provider adapter 구현
10. AI 비용/장애/fallback 테스트
11. 보안/민감정보 안내 문구 추가
12. 테스트와 README 작성

첫 커밋 후보는 `Thread 1 - 프로젝트 뼈대`입니다.

---

## Thread 1 실행 목표

첫 개발 착수 시 목표는 앱의 숨결을 만드는 것입니다. 아직 완전한 DB나 AI가 없어도, 사용자가 첫 화면에서 사건 접수와 결과 흐름을 볼 수 있어야 합니다.

생성할 주요 파일:

- `app/page.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `app/cases/new/page.tsx`
- `app/dashboard/page.tsx`
- `app/resources/page.tsx`
- `app/safety/page.tsx`
- `components/CaseForm.tsx`
- `components/CaseCard.tsx`
- `components/RiskBadge.tsx`
- `components/RequestDraft.tsx`
- `components/ResourceRouter.tsx`
- `components/SafetyNotice.tsx`
- `lib/classifier.ts`
- `lib/requestTemplates.ts`
- `lib/publicResources.ts`
- `lib/riskRules.ts`
- `lib/validators.ts`
- `.env.example`
- `README.md`

초기에는 DB 저장 대신 mock data 또는 local-first 흐름으로 UI와 핵심 로직을 먼저 검증합니다. 피해자가 계정을 만들거나 서버에 저장하지 않아도 진단과 요청서 생성이 가능해야 합니다.

---

## 초기 명령 후보

현재 폴더에서 바로 시작할 경우:

```powershell
npm create next-app@latest . -- --ts --tailwind --eslint --app --src-dir false --import-alias "@/*"
```

그 다음:

```powershell
npm install prisma @prisma/client zod
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npx prisma init
```

구현 후 검증:

```powershell
npm run lint
npm run build
npm test
```

주의: 현재 폴더에는 구현서와 이 문서가 이미 있으므로, 초기화 명령이 비어 있지 않은 폴더 경고를 낼 수 있습니다. 경고가 발생하면 임시 폴더에 생성한 뒤 파일을 병합하는 방식이 안전합니다.

---

## 완료 기준

개발 완료는 화면이 보이는 것만으로 판단하지 않습니다.

- 사용자가 사건 설명을 입력할 수 있다.
- 사건 유형이 자동 분류된다.
- 위험도와 삭제 가능성이 표시된다.
- 추천 공공기관과 대응 경로가 표시된다.
- 삭제 요청서가 생성되고 복사할 수 있다.
- 사건을 저장하거나 최소한 진행 상태로 관리할 수 있다.
- 디지털 성범죄 사건은 원본 업로드 없이 별도 안전 안내로 연결된다.
- 비밀번호 입력을 요구하지 않는다.
- TypeScript 에러가 없다.
- `npm run build`가 성공한다.
- 핵심 로직 테스트가 있다.
- README만 보고 실행할 수 있다.
- API 키 없이 핵심 기능이 동작한다.
- AI API 호출 전 민감정보 마스킹 미리보기가 있다.
- AI provider 장애 시 rule-based fallback이 동작한다.
- 디지털 성범죄 사건에서는 파일 업로드가 보이지 않는다.
- 링크 미리보기와 자동 URL fetch가 없다.
- 빠른 나가기/민감 모드가 있다.
- 사건 데이터 삭제와 만료 정책이 있다.
- 접근경로 증거목록이 여러 URL을 안전하게 정리한다.
- 기관 제출용 문서와 내보내기 파일에 접근경로 증거목록이 포함된다.
- 로컬 저장 기본값은 URL 경로를 숨기고, 정확한 URL 보관은 opt-in이다.

---

## 다음 착수 문장

바로 개발을 시작할 때는 이렇게 진행하면 됩니다.

```md
DEVELOPMENT.md, jium-ai-dev-implementation.md, docs/benchmark-user-security-ai-addendum-v1.1.md를 기준으로 Thread 1 - 프로젝트 뼈대를 구현해줘.
Next.js App Router + TypeScript + Tailwind 기준으로 초기화하고, 아직 AI API는 붙이지 말고 rule-based/local-first 흐름으로 랜딩, 초보자 사건 접수, 결과, 대시보드, 리소스, 디지털 성범죄 안전 안내 화면까지 연결해줘.
비밀번호/주민등록번호/피해물 원본 업로드 금지, 민감정보 마스킹, 빠른 나가기, 저장하지 않고 요청서 생성, 공식기관 무료 연결을 첫 버전에 반영해줘.
```
