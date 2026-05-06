# 지움AI 개발구현서 v1.0

> Codex App에서 바로 개발 지시문으로 사용할 수 있는 MVP 개발구현서입니다.

---

## 0. Codex에 처음 붙여넣을 지시문

```md
너는 시니어 풀스택 개발자다.

아래 개발구현서를 기준으로 "지움AI" MVP를 구현해라.

목표:
- 사용자가 개인정보 노출, 자기 게시물 삭제, 검색 노출, 계정 탈퇴, 디지털 성범죄 피해 등 상황을 입력하면
- AI가 사건 유형을 분류하고
- 삭제 가능성, 공공기관 연결 경로, 증거 정리 체크리스트, 삭제 요청서 초안을 생성하며
- 사용자가 사건별 진행 상태를 관리할 수 있는 무료 웹앱을 만든다.

중요 원칙:
- 실제 게시물 삭제를 자동으로 수행하지 않는다.
- 플랫폼 계정 비밀번호를 요구하지 않는다.
- 불법촬영물, 딥페이크, 성착취물 원본 업로드를 요구하지 않는다.
- 자동 대량 신고, 무단 크롤링, 우회 접속, 로그인 자동화는 구현하지 않는다.
- 사용자가 직접 제출할 수 있는 문서/요청서/체크리스트/공공기관 안내만 제공한다.
- 민감정보는 최소 수집, 암호화 저장, 자동 삭제 정책을 둔다.

기술스택:
- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- NextAuth 또는 간단 이메일 인증
- OpenAI API는 선택 기능으로 구현
- API 키가 없으면 규칙 기반 템플릿 생성 모드로 동작

먼저 다음 순서로 구현해라:
1. 프로젝트 초기화
2. DB 스키마 작성
3. 기본 라우팅과 화면 구현
4. 사건 접수 폼 구현
5. 사건 분류 로직 구현
6. 삭제 요청서 생성 로직 구현
7. 공공기관 라우팅 로직 구현
8. 사건 진행 상태 보드 구현
9. 보안/민감정보 안내 문구 추가
10. 테스트 코드와 README 작성

각 단계마다 변경 파일, 실행 명령어, 확인 방법을 요약해라.
```

---

## 1. 프로젝트 개요

### 서비스명

**지움AI**

### 서비스 정의

**지움AI는 사용자가 자신의 디지털 흔적, 개인정보 노출, 유포 피해, 오래된 계정, 검색 노출 문제를 스스로 해결할 수 있도록 돕는 AI 기반 무료 권리구제 도구다.**

### 핵심 방향

지움AI는 “디지털장의사 대행업체”가 아니다.

지움AI는 사용자가 직접 권리를 행사할 수 있도록 다음을 도와준다.

| 기능 | 설명 |
|---|---|
| 사건 분류 | 사용자의 상황을 개인정보 노출, 자기 게시물, 계정 탈퇴, 검색 노출, 디지털 성범죄 등으로 분류 |
| 삭제 가능성 판단 | 삭제 가능, 제한적 가능, 전문기관 필요, 법률 검토 필요로 구분 |
| 증거 정리 | URL, 캡처, 게시 위치, 피해 내용, 요청 사유 정리 |
| 삭제 요청서 생성 | 게시판 관리자, 플랫폼, 검색엔진, 공공기관 제출용 문안 생성 |
| 공공기관 안내 | 지우개 서비스, 개인정보 포털, 털린 내 정보 찾기, 중앙디지털성범죄피해자지원센터 등으로 연결 |
| 진행 관리 | 요청 전, 요청 완료, 답변 대기, 보완 요청, 완료, 재노출 의심 상태 관리 |

참고:
- 개인정보 포털 지우개 서비스: https://www.privacy.go.kr/delete.do
- 개인정보 포털: https://www.privacy.go.kr
- 중앙디지털성범죄피해자지원센터: https://d4u.stop.or.kr
- 털린 내 정보 찾기: https://kidc.eprivacy.go.kr

---

## 2. MVP 범위

### 2.1 반드시 구현할 기능

| 우선순위 | 기능 | 설명 |
|---:|---|---|
| 1 | 랜딩 페이지 | 서비스 설명, 위험 고지, 시작 버튼 |
| 2 | 사건 접수 | 피해 유형, 설명, URL, 키워드, 첨부 여부 입력 |
| 3 | AI/규칙 기반 분류 | 사건 유형과 긴급도 판단 |
| 4 | 삭제 가능성 진단 | 가능/제한/전문기관/법률검토 분류 |
| 5 | 삭제 요청서 생성 | 사용자가 복사해서 보낼 수 있는 문안 생성 |
| 6 | 공공기관 라우팅 | 상황별 공식 서비스 안내 |
| 7 | 사건 보드 | 사건 상태 관리 |
| 8 | 안전 가드레일 | 성범죄·아동·협박·자해 위험 상황 별도 처리 |
| 9 | README | 설치, 실행, 환경변수, 사용법 문서 |

### 2.2 MVP에서 제외할 기능

| 제외 기능 | 이유 |
|---|---|
| 자동 삭제 대행 | 플랫폼 권한 없음 |
| 자동 대량 신고 | 악용 가능성 |
| 정부 사이트 로그인 자동화 | 개인정보/보안 위험 |
| 불법촬영물 원본 업로드 | 2차 피해 및 보관 위험 |
| 해외 불법 사이트 크롤링 | 법적 위험 |
| 기업 평판관리 | 무료 권리구제 목적 훼손 |
| 언론 기사 자동 삭제 요청 | 공익 정보 침해 가능성 |
| 타인 게시물 무단 삭제 | 악용 가능성 |

---

## 3. 사용자 유형

### 3.1 기본 사용자

| 사용자 | 상황 |
|---|---|
| 일반 개인 | 전화번호, 주소, 얼굴, 학교, 직장 정보가 노출됨 |
| 청소년/청년 | 어릴 때 올린 글, 사진, 영상 삭제 희망 |
| 피해자 | 딥페이크, 불법촬영물, 비동의 유포, 유포 협박 피해 |
| 계정 정리 사용자 | 오래된 사이트 탈퇴 희망 |
| 검색 노출 사용자 | 삭제된 글이 검색엔진에 계속 노출됨 |

### 3.2 지원하지 않을 사용자

| 사용자 | 이유 |
|---|---|
| 악성 리뷰 삭제 희망 사업자 | 소비자 표현의 자유 침해 가능성 |
| 공인/정치인의 비판글 삭제 요청 | 공익적 표현 침해 가능성 |
| 범죄·사기 이력 은폐 목적 사용자 | 권리구제 목적 아님 |
| 타인 개인정보 수집 목적 사용자 | 악용 위험 |

---

## 4. 핵심 사용자 플로우

### 4.1 개인정보 노출 플로우

```txt
1. 사용자가 "내 전화번호가 커뮤니티에 올라갔어요" 입력
2. 사건 유형: 개인정보 노출
3. 긴급도: 높음
4. 사용자가 URL 입력
5. AI가 노출 항목 정리
6. 게시판 관리자용 삭제 요청서 생성
7. 검색엔진 노출 시 검색 결과 삭제 요청 안내
8. 사건 보드에 저장
```

### 4.2 어릴 때 쓴 게시물 삭제 플로우

```txt
1. 사용자가 "중학생 때 쓴 글을 지우고 싶어요" 입력
2. 사건 유형: 자기 게시물 삭제
3. AI가 질문:
   - 19세 미만일 때 작성했나요?
   - 개인정보가 포함되어 있나요?
   - 현재 30세 미만인가요?
4. 조건에 따라 지우개 서비스 안내
5. 신청 준비자료 생성
6. 사건 보드에 저장
```

### 4.3 디지털 성범죄 플로우

```txt
1. 사용자가 "딥페이크가 퍼졌어요" 입력
2. 사건 유형: 디지털 성범죄
3. 긴급도: 매우 높음
4. AI는 원본 이미지/영상 업로드를 요구하지 않음
5. 필요한 정보만 안내:
   - URL
   - 게시 위치
   - 게시자 ID
   - 유포 시기
   - 협박 메시지 여부
6. 중앙디지털성범죄피해자지원센터, 1366, ECRM, 방심위 안내
7. 사건 요약서 생성
8. 사건 보드에 저장
```

### 4.4 계정정보 유출 플로우

```txt
1. 사용자가 "내 계정이 유출된 것 같아요" 입력
2. 사건 유형: 계정정보 유출 의심
3. AI는 비밀번호 입력을 받지 않음
4. 털린 내 정보 찾기 서비스 안내
5. 비밀번호 변경 체크리스트 제공
6. 2차 피해 예방 체크리스트 생성
```

---

## 5. 기술 스택

### 5.1 추천 스택

```txt
Frontend:
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui 선택

Backend:
- Next.js Route Handler
- Server Actions 선택

Database:
- PostgreSQL
- Prisma ORM

Auth:
- NextAuth.js
- 또는 MVP에서는 magic link 없는 간단 이메일 로그인

AI:
- OpenAI API optional
- API 키 없을 경우 rule-based fallback

File:
- MVP에서는 파일 업로드 비활성화 또는 메타데이터만 저장
- 추후 S3 호환 저장소 + 암호화

Deployment:
- Vercel 또는 Docker
- DB는 Supabase/Postgres/Railway 등
```

### 5.2 왜 Next.js 단일 스택인가

초보 개발자가 Codex로 빠르게 만들기엔 프론트와 백엔드를 분리하지 않는 게 좋다.

```txt
좋은 점:
- 한 프로젝트 안에서 화면/API/DB 처리 가능
- Codex가 코드 구조를 이해하기 쉬움
- 배포가 쉬움
- MVP 속도가 빠름
```

---

## 6. 프로젝트 구조

```txt
jium-ai/
├─ app/
│  ├─ page.tsx
│  ├─ layout.tsx
│  ├─ globals.css
│  ├─ cases/
│  │  ├─ page.tsx
│  │  ├─ new/
│  │  │  └─ page.tsx
│  │  └─ [id]/
│  │     └─ page.tsx
│  ├─ dashboard/
│  │  └─ page.tsx
│  ├─ resources/
│  │  └─ page.tsx
│  ├─ safety/
│  │  └─ page.tsx
│  └─ api/
│     ├─ classify/
│     │  └─ route.ts
│     ├─ generate-request/
│     │  └─ route.ts
│     └─ cases/
│        ├─ route.ts
│        └─ [id]/
│           └─ route.ts
├─ components/
│  ├─ CaseForm.tsx
│  ├─ CaseCard.tsx
│  ├─ RiskBadge.tsx
│  ├─ RequestDraft.tsx
│  ├─ ResourceRouter.tsx
│  └─ SafetyNotice.tsx
├─ lib/
│  ├─ classifier.ts
│  ├─ requestTemplates.ts
│  ├─ publicResources.ts
│  ├─ riskRules.ts
│  ├─ pii.ts
│  ├─ openai.ts
│  ├─ prisma.ts
│  └─ validators.ts
├─ prisma/
│  └─ schema.prisma
├─ tests/
│  ├─ classifier.test.ts
│  ├─ requestTemplates.test.ts
│  └─ riskRules.test.ts
├─ .env.example
├─ package.json
├─ README.md
└─ DEVELOPMENT.md
```

---

## 7. 데이터베이스 스키마

### 7.1 Prisma Schema

```prisma
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  displayName     String?
  consentVersion  String   @default("v1")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  cases           Case[]
}

model Case {
  id              String      @id @default(cuid())
  userId          String?
  title           String
  description     String
  caseType        CaseType
  riskLevel       RiskLevel
  status          CaseStatus @default(DRAFT)
  deletionChance  DeletionChance
  platform        String?
  targetUrl       String?
  keywords        String?
  exposedInfo     String?
  aiSummary       String?
  safetyNote      String?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  user            User?      @relation(fields: [userId], references: [id])
  evidences       Evidence[]
  requestDrafts   RequestDraft[]
  statusEvents    StatusEvent[]
}

model Evidence {
  id              String   @id @default(cuid())
  caseId          String
  type            EvidenceType
  label           String
  value           String?
  filePath        String?
  createdAt       DateTime @default(now())

  case            Case     @relation(fields: [caseId], references: [id])
}

model RequestDraft {
  id              String        @id @default(cuid())
  caseId          String
  recipientType   RecipientType
  title           String
  body            String
  status          DraftStatus   @default(GENERATED)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  case            Case          @relation(fields: [caseId], references: [id])
}

model StatusEvent {
  id              String   @id @default(cuid())
  caseId          String
  eventType       String
  memo            String?
  createdAt       DateTime @default(now())

  case            Case     @relation(fields: [caseId], references: [id])
}

enum CaseType {
  PERSONAL_INFO_EXPOSURE
  SELF_POST_DELETE
  SEARCH_RESULT_REMOVAL
  ACCOUNT_DELETE
  CREDENTIAL_LEAK
  DIGITAL_SEX_CRIME
  DEFAMATION_PRIVACY
  IMPERSONATION
  UNKNOWN
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum CaseStatus {
  DRAFT
  READY
  REQUESTED
  WAITING_RESPONSE
  NEEDS_MORE_INFO
  COMPLETED
  REAPPEARED
  CLOSED
}

enum DeletionChance {
  HIGH
  MEDIUM
  LOW
  SPECIALIST_REQUIRED
  LEGAL_REVIEW_REQUIRED
  NOT_SUPPORTED
}

enum EvidenceType {
  URL
  SCREENSHOT
  KEYWORD
  PLATFORM
  AUTHOR_ID
  DATE
  DESCRIPTION
  OTHER
}

enum RecipientType {
  PLATFORM_ADMIN
  SEARCH_ENGINE
  PUBLIC_AGENCY
  POLICE
  LEGAL_SUPPORT
  SELF_CHECKLIST
}

enum DraftStatus {
  GENERATED
  COPIED
  SENT_BY_USER
  ARCHIVED
}
```

---

## 8. 사건 분류 로직

### 8.1 분류 기준

```ts
export type CaseClassification = {
  caseType:
    | "PERSONAL_INFO_EXPOSURE"
    | "SELF_POST_DELETE"
    | "SEARCH_RESULT_REMOVAL"
    | "ACCOUNT_DELETE"
    | "CREDENTIAL_LEAK"
    | "DIGITAL_SEX_CRIME"
    | "DEFAMATION_PRIVACY"
    | "IMPERSONATION"
    | "UNKNOWN";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  deletionChance:
    | "HIGH"
    | "MEDIUM"
    | "LOW"
    | "SPECIALIST_REQUIRED"
    | "LEGAL_REVIEW_REQUIRED"
    | "NOT_SUPPORTED";
  recommendedRoute: string[];
  safetyNote?: string;
};
```

### 8.2 규칙 기반 분류 예시

```ts
const DIGITAL_SEX_CRIME_KEYWORDS = [
  "불법촬영",
  "몰카",
  "딥페이크",
  "성착취",
  "유포 협박",
  "나체",
  "성관계 영상",
  "비동의 유포",
];

const CREDENTIAL_LEAK_KEYWORDS = [
  "계정 유출",
  "비밀번호 유출",
  "해킹",
  "다크웹",
  "로그인 기록",
  "털린",
];

const ACCOUNT_DELETE_KEYWORDS = [
  "회원탈퇴",
  "계정 삭제",
  "오래된 계정",
  "가입한 사이트",
  "탈퇴하고 싶",
];

const SELF_POST_KEYWORDS = [
  "내가 쓴 글",
  "어릴 때",
  "초등학생 때",
  "중학생 때",
  "고등학생 때",
  "예전에 올린",
  "흑역사",
];

const SEARCH_REMOVAL_KEYWORDS = [
  "검색 결과",
  "구글에 나와",
  "네이버에 나와",
  "캐시",
  "스니펫",
  "검색 노출",
];

const PERSONAL_INFO_KEYWORDS = [
  "전화번호",
  "주소",
  "주민등록",
  "이메일",
  "학교",
  "직장",
  "얼굴",
  "실명",
  "신상",
  "개인정보",
];

export function classifyCase(input: string): CaseClassification {
  const text = input.toLowerCase();

  if (DIGITAL_SEX_CRIME_KEYWORDS.some((k) => text.includes(k))) {
    return {
      caseType: "DIGITAL_SEX_CRIME",
      riskLevel: "CRITICAL",
      deletionChance: "SPECIALIST_REQUIRED",
      recommendedRoute: [
        "중앙디지털성범죄피해자지원센터",
        "여성긴급전화 1366",
        "경찰청 사이버범죄 신고",
        "방송통신심의 관련 신고",
      ],
      safetyNote:
        "원본 이미지나 영상을 업로드하지 마세요. URL, 게시 위치, 유포자 ID, 협박 메시지 등 최소 정보만 정리하세요.",
    };
  }

  if (CREDENTIAL_LEAK_KEYWORDS.some((k) => text.includes(k))) {
    return {
      caseType: "CREDENTIAL_LEAK",
      riskLevel: "HIGH",
      deletionChance: "SPECIALIST_REQUIRED",
      recommendedRoute: ["털린 내 정보 찾기", "비밀번호 변경", "2단계 인증 설정"],
      safetyNote:
        "서비스 안에 비밀번호를 입력하지 마세요. 공식 유출 확인 서비스에서만 확인하세요.",
    };
  }

  if (ACCOUNT_DELETE_KEYWORDS.some((k) => text.includes(k))) {
    return {
      caseType: "ACCOUNT_DELETE",
      riskLevel: "MEDIUM",
      deletionChance: "MEDIUM",
      recommendedRoute: ["개인정보 포털 웹사이트 회원탈퇴", "사이트 직접 탈퇴"],
    };
  }

  if (SELF_POST_KEYWORDS.some((k) => text.includes(k))) {
    return {
      caseType: "SELF_POST_DELETE",
      riskLevel: "MEDIUM",
      deletionChance: "MEDIUM",
      recommendedRoute: ["지우개 서비스", "플랫폼 직접 삭제 요청"],
    };
  }

  if (SEARCH_REMOVAL_KEYWORDS.some((k) => text.includes(k))) {
    return {
      caseType: "SEARCH_RESULT_REMOVAL",
      riskLevel: "MEDIUM",
      deletionChance: "MEDIUM",
      recommendedRoute: ["검색엔진 삭제 요청", "원본 게시물 삭제 확인"],
    };
  }

  if (PERSONAL_INFO_KEYWORDS.some((k) => text.includes(k))) {
    return {
      caseType: "PERSONAL_INFO_EXPOSURE",
      riskLevel: "HIGH",
      deletionChance: "HIGH",
      recommendedRoute: ["게시판 관리자 삭제 요청", "개인정보침해 신고센터", "검색엔진 삭제 요청"],
    };
  }

  return {
    caseType: "UNKNOWN",
    riskLevel: "LOW",
    deletionChance: "LOW",
    recommendedRoute: ["상황을 더 자세히 입력"],
  };
}
```

---

## 9. 공공기관 라우팅 데이터

### 9.1 `lib/publicResources.ts`

```ts
export const PUBLIC_RESOURCES = [
  {
    id: "eraser",
    name: "지우개 서비스",
    category: "SELF_POST_DELETE",
    description:
      "아동·청소년 시기에 작성한 개인정보 포함 게시물의 삭제 또는 검색 배제를 도와주는 서비스",
    url: "https://www.privacy.go.kr/delete.do",
    caution:
      "모든 게시물이 대상은 아닙니다. 작성 시기, 신청 연령, 개인정보 포함 여부를 확인해야 합니다.",
  },
  {
    id: "privacy-portal-withdrawal",
    name: "개인정보 포털 웹사이트 회원탈퇴",
    category: "ACCOUNT_DELETE",
    description:
      "명의도용이 의심되거나 더 이상 이용하지 않는 웹사이트의 회원탈퇴 신청을 지원하는 서비스",
    url: "https://www.privacy.go.kr",
    caution:
      "모든 사이트가 탈퇴 신청 가능한 것은 아닙니다. 일부 사이트는 직접 탈퇴해야 합니다.",
  },
  {
    id: "kidc",
    name: "털린 내 정보 찾기",
    category: "CREDENTIAL_LEAK",
    description:
      "다크웹 등에서 내 계정정보가 불법 유통되는지 확인하는 서비스",
    url: "https://kidc.eprivacy.go.kr",
    caution:
      "지움AI에는 비밀번호를 입력하지 마세요. 공식 사이트에서만 확인하세요.",
  },
  {
    id: "d4u",
    name: "중앙디지털성범죄피해자지원센터",
    category: "DIGITAL_SEX_CRIME",
    description:
      "디지털 성범죄 피해 상담, 삭제지원, 유포 모니터링, 수사·법률·의료 연계 지원",
    url: "https://d4u.stop.or.kr",
    caution:
      "원본 피해물을 지움AI에 업로드하지 마세요. URL, 게시 위치, 키워드 등 최소 정보만 정리하세요.",
  },
  {
    id: "privacy-kisa",
    name: "KISA 개인정보침해 신고센터",
    category: "PERSONAL_INFO_EXPOSURE",
    description: "개인정보 침해 신고와 상담을 지원하는 창구",
    url: "https://privacy.kisa.or.kr",
    caution: "신고 전 URL, 캡처, 침해 내용, 요청 이력을 정리하세요.",
  },
];
```

---

## 10. 삭제 요청서 템플릿

### 10.1 게시판/플랫폼 관리자용

```ts
export function generatePlatformDeleteRequest(params: {
  targetUrl?: string;
  exposedInfo?: string;
  description: string;
  platform?: string;
}) {
  return `
안녕하세요.

아래 게시물에 제 동의 없이 개인정보 또는 사생활 관련 정보가 노출되어 삭제 또는 비공개 처리를 요청드립니다.

대상 URL:
${params.targetUrl || "[대상 URL 입력]"}

게시 위치:
${params.platform || "[게시판/플랫폼명 입력]"}

노출된 정보:
${params.exposedInfo || "[예: 이름, 전화번호, 주소, 얼굴, 학교, 직장 등]"}

피해 내용:
${params.description}

요청 사항:
1. 해당 게시물의 삭제 또는 블라인드 처리
2. 검색 결과 및 미리보기 노출 제한
3. 동일 정보가 포함된 재게시물 확인 시 추가 조치
4. 처리 결과 회신

본 요청은 제 개인정보와 사생활 보호를 위한 정당한 삭제 요청입니다.
필요한 본인 확인 자료나 추가 정보가 있으면 회신 부탁드립니다.

감사합니다.
`.trim();
}
```

### 10.2 검색엔진 삭제 요청용

```ts
export function generateSearchRemovalRequest(params: {
  targetUrl?: string;
  searchQuery?: string;
  reason?: string;
}) {
  return `
안녕하세요.

삭제되었거나 개인정보가 포함된 페이지가 검색 결과에 계속 노출되어 검색 제외 또는 캐시 삭제를 요청드립니다.

검색 결과에 노출되는 URL:
${params.targetUrl || "[검색 결과 URL 또는 원본 URL 입력]"}

검색어:
${params.searchQuery || "[검색어 입력]"}

요청 사유:
${params.reason || "개인정보 또는 사생활 관련 정보가 검색 결과에 노출되고 있습니다."}

요청 사항:
1. 검색 결과에서 해당 URL 제외
2. 저장된 캐시 또는 스니펫 삭제
3. 개인정보가 포함된 미리보기 문구 제거

감사합니다.
`.trim();
}
```

### 10.3 디지털 성범죄 피해 상담 준비서

```ts
export function generateDigitalSexCrimeSummary(params: {
  description: string;
  targetUrl?: string;
  platform?: string;
  keywords?: string;
}) {
  return `
디지털 성범죄 피해 상담 준비자료

주의:
- 이 서비스에는 피해 이미지나 영상을 업로드하지 마세요.
- 가능한 경우 URL, 게시 위치, 게시자 ID, 유포 시기, 협박 메시지 등만 정리하세요.

피해 상황 요약:
${params.description}

확인된 URL:
${params.targetUrl || "[URL이 있다면 입력]"}

게시 위치/플랫폼:
${params.platform || "[사이트명, SNS명, 메신저명 등]"}

검색 또는 특정 가능한 키워드:
${params.keywords || "[게시물 제목, 유포자 ID, 닉네임 등]"}

확인해야 할 자료:
- 게시물 URL
- 게시자 ID 또는 닉네임
- 게시 일시 또는 발견 일시
- 유포 협박 메시지 여부
- 이미 신고한 기관 여부
- 추가 유포 정황

추천 연결:
- 중앙디지털성범죄피해자지원센터
- 여성긴급전화 1366
- 경찰청 사이버범죄 신고
- 방송통신심의 관련 신고

중요:
완전한 삭제가 어려울 수 있으므로, 전문기관의 삭제지원과 지속 모니터링을 받는 것이 좋습니다.
`.trim();
}
```

### 10.4 계정 유출 대응 체크리스트

```ts
export function generateCredentialLeakChecklist() {
  return `
계정정보 유출 의심 대응 체크리스트

즉시 할 일:
1. 지움AI에 비밀번호를 입력하지 않는다.
2. 공식 "털린 내 정보 찾기" 서비스에서 유출 여부를 확인한다.
3. 유출 의심 계정의 비밀번호를 즉시 변경한다.
4. 같은 비밀번호를 쓰는 다른 사이트도 모두 변경한다.
5. 2단계 인증을 설정한다.
6. 로그인 기록을 확인한다.
7. 모르는 기기/세션을 로그아웃한다.
8. 금융, 쇼핑, 이메일 계정은 우선적으로 점검한다.

주의:
- 문자나 이메일로 온 임시 링크를 무조건 클릭하지 않는다.
- 비밀번호를 캡처해 저장하지 않는다.
- 같은 비밀번호를 여러 사이트에서 재사용하지 않는다.
`.trim();
}
```

---

## 11. API 설계

### 11.1 `POST /api/classify`

#### Request

```json
{
  "description": "내 전화번호가 커뮤니티에 올라갔어요",
  "targetUrl": "https://example.com/post/123",
  "platform": "example community",
  "keywords": "홍길동 전화번호"
}
```

#### Response

```json
{
  "caseType": "PERSONAL_INFO_EXPOSURE",
  "riskLevel": "HIGH",
  "deletionChance": "HIGH",
  "recommendedRoute": [
    "게시판 관리자 삭제 요청",
    "개인정보침해 신고센터",
    "검색엔진 삭제 요청"
  ],
  "safetyNote": null
}
```

### 11.2 `POST /api/generate-request`

#### Request

```json
{
  "caseType": "PERSONAL_INFO_EXPOSURE",
  "description": "제 전화번호와 이름이 커뮤니티에 올라갔습니다.",
  "targetUrl": "https://example.com/post/123",
  "platform": "example community",
  "exposedInfo": "이름, 전화번호"
}
```

#### Response

```json
{
  "title": "개인정보 노출 게시물 삭제 요청",
  "body": "안녕하세요..."
}
```

### 11.3 `POST /api/cases`

#### Request

```json
{
  "title": "커뮤니티 전화번호 노출",
  "description": "제 전화번호가 커뮤니티에 올라갔습니다.",
  "targetUrl": "https://example.com/post/123",
  "platform": "example community",
  "keywords": "홍길동 전화번호",
  "exposedInfo": "이름, 전화번호"
}
```

#### Response

```json
{
  "id": "case_123",
  "status": "READY"
}
```

### 11.4 `PATCH /api/cases/:id`

#### Request

```json
{
  "status": "REQUESTED",
  "memo": "게시판 관리자에게 삭제 요청 메일 발송"
}
```

#### Response

```json
{
  "id": "case_123",
  "status": "REQUESTED"
}
```

---

## 12. 화면 설계

### 12.1 랜딩 페이지

#### 문구

```txt
지움AI

내 개인정보, 오래된 게시물, 검색 노출, 계정 유출 문제를
혼자 해결할 수 있도록 도와주는 무료 AI 도우미입니다.

지움AI는 직접 삭제를 보장하지 않습니다.
대신 삭제 요청서, 증거 정리, 공공기관 연결, 진행 관리를 도와드립니다.
```

#### 버튼

```txt
[내 문제 진단하기]
[공공기관 바로 찾기]
[디지털 성범죄 긴급 도움]
```

---

### 12.2 사건 접수 페이지

#### 입력 필드

| 필드 | 타입 | 필수 |
|---|---|---|
| 제목 | text | 필수 |
| 피해 설명 | textarea | 필수 |
| URL | text | 선택 |
| 플랫폼 | text | 선택 |
| 검색 키워드 | text | 선택 |
| 노출 정보 | checkbox/text | 선택 |
| 긴급 여부 | checkbox | 선택 |

#### 노출 정보 체크박스

```txt
[ ] 이름
[ ] 전화번호
[ ] 주소
[ ] 이메일
[ ] 얼굴 사진
[ ] 학교
[ ] 직장
[ ] 가족 정보
[ ] 계정 ID
[ ] 성적 이미지/영상 관련
[ ] 기타
```

---

### 12.3 분석 결과 페이지

```txt
사건 유형: 개인정보 노출
긴급도: 높음
삭제 가능성: 높음

추천 조치:
1. 게시판 관리자에게 삭제 요청
2. 검색엔진 캐시 삭제 요청
3. 개인정보침해 신고센터 상담 검토

생성 문서:
[삭제 요청서 복사]
[검색엔진 삭제 요청서 복사]
[증거 정리 체크리스트 보기]

진행 상태:
[요청 전] [요청 완료] [답변 대기] [보완 요청] [완료] [재노출 의심]
```

---

### 12.4 디지털 성범죄 안전 화면

```txt
긴급 안내

지움AI에는 피해 이미지나 영상을 업로드하지 마세요.

아래 정보만 정리하세요:
- URL
- 게시 위치
- 게시자 ID
- 발견 일시
- 유포 협박 메시지 여부
- 관련 키워드

추천 연결:
- 중앙디지털성범죄피해자지원센터
- 여성긴급전화 1366
- 경찰청 사이버범죄 신고
- 방송통신심의 관련 신고
```

---

## 13. 보안 요구사항

### 13.1 민감정보 최소 수집

```txt
수집 가능:
- 사건 제목
- 피해 설명
- URL
- 플랫폼명
- 검색 키워드
- 노출 정보 종류
- 진행 상태

수집 금지:
- 주민등록번호 원문
- 계정 비밀번호
- 카드번호
- 피해 성착취물 원본
- 불법촬영물 원본
- 타인의 민감정보
```

### 13.2 저장 정책

```txt
MVP:
- 파일 업로드 비활성화 권장
- URL과 텍스트 메타데이터 중심 저장
- 사용자가 사건 삭제 가능

추후:
- 첨부 파일은 암호화 저장
- 30일/90일 자동 삭제 옵션
- 다운로드 가능한 사건 요약 PDF 제공
```

### 13.3 안전 문구

모든 사건 접수 화면 하단에 표시:

```txt
지움AI는 법률 대리인이나 삭제 대행업체가 아닙니다.
삭제 가능 여부는 플랫폼, 검색엔진, 공공기관, 법적 판단에 따라 달라질 수 있습니다.
긴급한 디지털 성범죄, 협박, 스토킹, 아동 피해는 즉시 전문기관 또는 경찰에 도움을 요청하세요.
```

---

## 14. AI 프롬프트 설계

### 14.1 사건 분류 프롬프트

```ts
export const CLASSIFICATION_SYSTEM_PROMPT = `
너는 개인정보 권리구제 서비스의 사건 분류 도우미다.

역할:
- 사용자의 피해 상황을 분류한다.
- 삭제 가능성을 과장하지 않는다.
- 법률 자문처럼 단정하지 않는다.
- 위험 사건은 전문기관 연결을 우선한다.
- 디지털 성범죄 사건에서는 원본 이미지/영상 업로드를 요구하지 않는다.
- 비밀번호, 주민등록번호, 피해 성착취물 원본 입력을 요구하지 않는다.

출력은 반드시 JSON으로 한다.

출력 형식:
{
  "caseType": "...",
  "riskLevel": "...",
  "deletionChance": "...",
  "recommendedRoute": ["..."],
  "safetyNote": "...",
  "questions": ["추가로 확인할 질문"]
}
`;
```

### 14.2 삭제 요청서 생성 프롬프트

```ts
export const REQUEST_GENERATION_SYSTEM_PROMPT = `
너는 개인정보 삭제 요청서 작성 도우미다.

원칙:
- 정중하고 간결하게 작성한다.
- 사용자가 직접 보낼 수 있는 문안으로 작성한다.
- 삭제 성공을 보장하지 않는다.
- 협박하거나 과장하지 않는다.
- 개인정보 보호, 사생활 침해, 본인 권리 행사를 중심으로 작성한다.
- 공익적 보도, 정당한 리뷰, 타인의 표현 삭제를 부당하게 유도하지 않는다.

출력:
{
  "title": "요청서 제목",
  "body": "요청서 본문",
  "checklist": ["첨부하면 좋은 자료"]
}
`;
```

---

## 15. OpenAI API 선택 구현

### 15.1 동작 방식

```txt
OPENAI_API_KEY 있음:
- LLM으로 분류 보조
- LLM으로 요청서 문안 개선
- 단, riskRules를 먼저 적용해서 고위험 사건은 안전 라우팅

OPENAI_API_KEY 없음:
- 규칙 기반 분류
- 템플릿 기반 요청서 생성
```

### 15.2 `lib/openai.ts`

```ts
export async function optionalAiGenerate(prompt: string) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  // Codex가 실제 SDK 버전에 맞춰 구현하게 한다.
  // 요구사항:
  // - timeout 설정
  // - JSON 파싱 실패 시 fallback
  // - 민감정보 로깅 금지
  // - 에러 메시지에 사용자 입력 원문 노출 금지
}
```

---

## 16. 상태 관리

### 16.1 사건 상태

```txt
DRAFT:
- 사용자가 작성 중

READY:
- 요청서 생성 완료

REQUESTED:
- 사용자가 플랫폼/기관에 요청 보냄

WAITING_RESPONSE:
- 답변 대기 중

NEEDS_MORE_INFO:
- 플랫폼/기관이 보완자료 요청

COMPLETED:
- 삭제 또는 조치 완료

REAPPEARED:
- 재노출 의심

CLOSED:
- 사용자가 종료
```

### 16.2 상태 변경 UI

```txt
[요청 전]
[요청 완료]
[답변 대기]
[보완 요청]
[완료]
[재노출 의심]
[종료]
```

---

## 17. 테스트 시나리오

### 17.1 사건 분류 테스트

```ts
describe("classifyCase", () => {
  it("전화번호 노출은 개인정보 노출로 분류한다", () => {
    const result = classifyCase("내 전화번호가 커뮤니티에 올라갔어요");
    expect(result.caseType).toBe("PERSONAL_INFO_EXPOSURE");
    expect(result.riskLevel).toBe("HIGH");
  });

  it("딥페이크 사건은 디지털 성범죄로 분류한다", () => {
    const result = classifyCase("제 딥페이크 영상이 퍼졌어요");
    expect(result.caseType).toBe("DIGITAL_SEX_CRIME");
    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.deletionChance).toBe("SPECIALIST_REQUIRED");
  });

  it("계정 유출은 비밀번호 입력을 요구하지 않는다", () => {
    const result = classifyCase("비밀번호가 다크웹에 유출된 것 같아요");
    expect(result.caseType).toBe("CREDENTIAL_LEAK");
    expect(result.safetyNote).toContain("비밀번호");
  });
});
```

### 17.2 요청서 생성 테스트

```ts
describe("generatePlatformDeleteRequest", () => {
  it("URL과 노출정보를 포함한다", () => {
    const body = generatePlatformDeleteRequest({
      targetUrl: "https://example.com/post/1",
      exposedInfo: "이름, 전화번호",
      description: "제 개인정보가 노출되었습니다.",
      platform: "Example",
    });

    expect(body).toContain("https://example.com/post/1");
    expect(body).toContain("이름, 전화번호");
    expect(body).toContain("삭제");
  });
});
```

---

## 18. README에 들어갈 내용

````md
# 지움AI

지움AI는 개인정보 노출, 오래된 게시물, 검색 노출, 계정 유출, 디지털 성범죄 피해 상황에서 사용자가 직접 대응할 수 있도록 돕는 무료 AI 도우미입니다.

## 주의

이 서비스는 직접 삭제를 보장하지 않습니다.
법률 대리 서비스가 아닙니다.
디지털 성범죄 피해 이미지나 영상을 업로드하지 마세요.
비밀번호를 입력하지 마세요.

## 설치

```bash
npm install
```

## 환경변수

```bash
cp .env.example .env
```

`.env` 예시:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/jiumai"
OPENAI_API_KEY=""
NEXTAUTH_SECRET="change-me"
NEXTAUTH_URL="http://localhost:3000"
```

## DB 설정

```bash
npx prisma migrate dev
npx prisma generate
```

## 실행

```bash
npm run dev
```

## 테스트

```bash
npm test
```
````

---

## 19. Codex 작업 스레드 분리법

### Thread 1 — 프로젝트 뼈대

```md
Next.js App Router + TypeScript + Tailwind + Prisma + PostgreSQL 기준으로 지움AI 프로젝트를 초기화해라.

요구사항:
- app/page.tsx 랜딩 페이지
- app/cases/new/page.tsx 사건 접수 페이지
- app/dashboard/page.tsx 사건 보드
- components 기본 구성
- lib 기본 구성
- README 작성
- .env.example 작성

아직 AI API는 붙이지 말고 mock 데이터와 rule-based 함수로 동작하게 만들어라.
```

### Thread 2 — DB/Prisma

```md
개발구현서의 Prisma schema를 기준으로 DB 모델을 구현해라.

요구사항:
- User, Case, Evidence, RequestDraft, StatusEvent 모델
- enum 전체 구현
- prisma client 설정
- seed 데이터 작성
- 사건 목록/상세 조회 API 구현
- 사건 생성 API 구현
- 상태 변경 API 구현
```

### Thread 3 — 사건 분류 엔진

```md
lib/classifier.ts를 구현해라.

요구사항:
- 개인정보 노출
- 자기 게시물 삭제
- 검색 결과 삭제
- 계정 탈퇴
- 계정정보 유출
- 디지털 성범죄
- 명예훼손/사생활 침해
- 사칭
- unknown

각 유형별 riskLevel, deletionChance, recommendedRoute, safetyNote를 반환해라.
테스트 코드도 작성해라.
```

### Thread 4 — 삭제 요청서 생성

```md
lib/requestTemplates.ts를 구현해라.

요구사항:
- 플랫폼 관리자용 삭제 요청서
- 검색엔진 삭제 요청서
- 디지털 성범죄 피해 상담 준비서
- 계정 유출 대응 체크리스트
- 지우개 서비스 신청 준비자료
- 개인정보침해 신고 준비자료

사용자가 복사하기 쉬운 문안으로 만들고, 과장 표현이나 삭제 보장 표현은 금지해라.
```

### Thread 5 — UI 구현

```md
사건 접수부터 결과 확인까지 UI를 구현해라.

화면:
- 랜딩 페이지
- 사건 접수 페이지
- 분석 결과 페이지
- 사건 상세 페이지
- 사건 보드
- 공공기관 리소스 페이지
- 디지털 성범죄 긴급 안내 페이지

디자인:
- 모바일 우선
- 카드형 UI
- 위험도 badge
- 복사 버튼
- 상태 변경 버튼
```

### Thread 6 — 안전/보안

```md
지움AI의 안전 가드레일을 구현해라.

요구사항:
- 비밀번호 입력 감지 시 저장하지 않고 경고
- 주민등록번호 패턴 감지 시 마스킹 안내
- 디지털 성범죄 키워드 감지 시 원본 업로드 금지 안내
- 자동 삭제 보장 문구 금지
- 공익 정보 삭제 악용 안내
- 로그에 사용자 입력 원문 저장하지 않기
```

---

## 20. `.codex/config.toml` 예시

```toml
model = "gpt-5.5"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[permissions]
default = ":workspace"
```

초보 개발자라면 `approval_policy = "on-request"`가 안전하다. Codex가 설치, 삭제, 외부 접근을 하려 할 때 확인받는 쪽이 좋다.

---

## 21. 개발 완료 기준

### 21.1 기능 완료 기준

```txt
[ ] 사용자가 사건 설명을 입력할 수 있다.
[ ] 사건 유형이 자동 분류된다.
[ ] 위험도가 표시된다.
[ ] 삭제 가능성이 표시된다.
[ ] 추천 공공기관/대응 경로가 표시된다.
[ ] 삭제 요청서가 생성된다.
[ ] 요청서를 복사할 수 있다.
[ ] 사건을 저장할 수 있다.
[ ] 사건 상태를 변경할 수 있다.
[ ] 디지털 성범죄 사건은 별도 안전 안내로 이동한다.
[ ] 비밀번호/성착취물 원본 업로드를 요구하지 않는다.
[ ] README만 보고 실행할 수 있다.
```

### 21.2 품질 완료 기준

```txt
[ ] TypeScript 에러 없음
[ ] npm run build 성공
[ ] npm test 성공
[ ] 주요 함수 테스트 있음
[ ] 모바일 화면 깨짐 없음
[ ] 개인정보 최소 수집 안내 있음
[ ] 삭제 보장 문구 없음
[ ] 공공기관 링크가 하드코딩 데이터로 정리되어 있음
```

---

## 22. 첫 배포 버전 기능 요약

### v0.1

```txt
- 랜딩 페이지
- 사건 접수
- 규칙 기반 사건 분류
- 삭제 요청서 생성
- 공공기관 안내
- 사건 보드
- 복사 버튼
- 안전 고지
```

### v0.2

```txt
- OpenAI API 선택 연결
- 요청서 문체 개선
- 사건 요약 자동 생성
- PDF 다운로드
- 이메일 알림 대신 브라우저 알림
```

### v0.3

```txt
- 재노출 체크리스트
- 키워드 기반 수동 모니터링
- 기관 제출용 사건 패키지
- 다국어 요청서
```

---

## 23. 절대 넣지 말아야 할 기능

```txt
- 피해 성착취물 원본 업로드
- 사용자 계정 비밀번호 입력
- 정부/플랫폼 로그인 자동화
- 자동 대량 신고
- 무단 크롤링
- 게시물 삭제 성공 보장
- 유료 삭제 대행 결제
- 악성 리뷰 삭제 전용 기능
- 언론 기사 삭제 자동 요청
- 타인 게시물 은폐 기능
```

---

## 24. 최종 구현 목표 문장

```txt
지움AI MVP는 사용자가 자신의 디지털 피해 상황을 입력하면 사건 유형을 분류하고, 삭제 가능성과 위험도를 알려주며, 제출 가능한 삭제 요청서와 증거 정리 체크리스트, 공공기관 연결 경로를 제공하는 무료 웹앱이다.

이 앱은 직접 삭제를 수행하지 않고, 사용자의 권리 행사를 돕는다.
```

---

## 25. 권장 개발 순서

```txt
1. Thread 1 — 프로젝트 뼈대
2. Thread 2 — DB/Prisma
3. Thread 3 — 사건 분류 엔진
4. Thread 4 — 삭제 요청서 생성
5. Thread 5 — UI 구현
6. Thread 6 — 안전/보안
```

---

## 26. v1.1 보강 반영 지시

이 구현서는 `docs/benchmark-user-security-ai-addendum-v1.1.md`와 함께 읽어야 한다.

v1.1 보강 문서는 다음 내용을 반영한다.

```txt
1. 유료 개인정보 삭제/데이터 브로커 제거 서비스 벤치마킹
2. 사용자 불만과 개선 요구사항
3. 피해자 무료/저비용 사용성 요구사항
4. 제2차 피해 방지 보안 대책
5. 다중 유료 AI API provider adapter 설계
6. 예상 문제점과 개선방안
```

기존 v1.0 원칙은 유지하되, 개발 우선순위는 다음처럼 수정한다.

```txt
1. 앱 프로젝트 뼈대
2. 무료 rule-based 진단 흐름
3. 민감정보 감지/마스킹
4. 디지털 성범죄 안전 라우팅
5. 삭제 요청서/상담 준비자료 생성
6. 공공기관 무료 리소스 연결
7. 로컬 우선 사건 보드
8. 서버 저장 opt-in
9. 다중 AI provider adapter
10. AI 장애/fallback/비용 제한
11. 보안 테스트
12. 초보자 README
```

추가 필수 원칙:

```txt
- API 키가 없어도 핵심 기능이 동작해야 한다.
- 피해자는 로그인 없이 진단과 요청서 생성을 할 수 있어야 한다.
- 서버 저장은 기본값이 아니라 명시적 선택이어야 한다.
- AI API 호출 전 민감정보 마스킹 미리보기가 있어야 한다.
- 디지털 성범죄, 아동 피해, 유포 협박, 스토킹, 자해 위험은 AI보다 전문기관 연결을 우선한다.
- 피해 이미지/영상 원본 업로드 기능은 MVP에 넣지 않는다.
- 링크 미리보기, 자동 URL fetch, 자동 크롤링은 금지한다.
- 삭제 완료와 사용자 직접 확인 완료를 분리한다.
- 7일/30일/90일 재확인 체크리스트를 제공한다.
- 유료 AI API는 선택 기능이며, rule-based fallback이 항상 있어야 한다.
```

지원할 AI provider adapter 후보:

```txt
- rule-based provider
- OpenAI
- Anthropic Claude
- Google Gemini
- NAVER CLOVA Studio
- Upstage Solar
- Azure OpenAI
- OpenAI-compatible endpoint
```

AI provider는 모두 같은 내부 스키마를 반환해야 하며, 스키마 검증 실패 시 결과를 폐기하고 rule-based fallback을 사용한다.
