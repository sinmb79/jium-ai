# 지움AI v1.1 보강 문서

작성자: 22B Labs · 제4의 길 (The 4th Path)

메타 설명: 유료 개인정보 삭제 서비스 벤치마킹, 사용자 불만, 보안, 2차 피해 방지, 다중 AI API 설계를 반영한 지움AI 보강안입니다.

태그: 지움AI, 벤치마킹, 개인정보 삭제, 디지털성범죄, 2차피해방지, AI API, 보안, 무료권리구제

---

## 1. 결론

지움AI는 유료 삭제 대행 서비스의 축소판이 되면 안 됩니다.

유료 서비스가 돈을 받는 이유는 대체로 반복적인 opt-out, 모니터링, 리포트, 상담 인력 때문입니다. 그러나 조사 결과, 이 영역은 성공률이 제한적이고, 삭제 완료 표시와 실제 삭제 사이에 간극이 있으며, 데이터가 다시 나타나는 문제가 반복됩니다.

따라서 지움AI의 방향은 다음이어야 합니다.

- 자동 삭제 대행이 아니라 사용자가 직접 움직일 수 있는 무료 권리구제 도구
- 삭제 성공 보장이 아니라 기대치와 절차를 명확히 알려주는 안내자
- AI 만능 서비스가 아니라 안전한 rule-based 흐름 위에 AI를 선택적으로 얹는 구조
- 피해자에게 추가 비용, 추가 노출, 추가 수치심을 요구하지 않는 도구

핵심 원칙:

> 지움AI는 피해자의 데이터를 더 많이 모으는 서비스가 아니라, 피해자가 덜 드러나고도 움직일 수 있게 하는 서비스다.

---

## 2. 벤치마킹 대상과 배울 점

### 2.1 DeleteMe

DeleteMe는 데이터 브로커와 people-search 사이트에서 이름, 주소, 전화번호, 이메일, 집 사진 등 노출 정보를 제거하는 구독형 서비스입니다. 정기 리포트와 재노출 모니터링을 제공합니다.

지움AI에 반영할 점:

- 사용자가 무엇을 해야 하는지 한 장짜리 리포트로 보여주기
- 삭제 요청 후 상태를 `요청 전 -> 요청 완료 -> 답변 대기 -> 보완 요청 -> 완료/재노출`로 관리하기
- 삭제 완료가 아니라 "현재 확인된 처리 상태"로 표현하기
- 사이트별 난이도와 예상 처리 시간을 보여주기

반영하지 않을 점:

- 유료 구독 중심 구조
- 사용자가 광범위한 개인정보를 먼저 입력해야 하는 구조
- 삭제를 대신 처리한다는 인상을 주는 문구

### 2.2 Optery

Optery는 노출 리포트와 삭제 리포트에 강점이 있습니다. 일부 리포트는 전후 스크린샷으로 사용자가 실제 변화를 확인할 수 있게 합니다. 동시에 Optery도 모든 정보 삭제를 보장하지 않는다고 명시합니다.

지움AI에 반영할 점:

- "증거 기반 상태"를 도입합니다.
- 삭제 요청서 생성 뒤 사용자가 직접 확인한 URL, 확인일, 응답 메일, 캡처 여부를 기록합니다.
- `삭제됨` 대신 `사용자 확인 필요`, `기관/플랫폼 응답`, `재확인 예정` 상태를 둡니다.
- 사용자가 잘못된 완료 표시를 신고하거나 수정할 수 있게 합니다.

### 2.3 Incogni

Incogni는 자동 삭제 요청, 커스텀 삭제 요청, 가족 플랜, 고객 지원을 제공합니다. 장점은 많은 사이트를 자동으로 처리하는 편의성이지만, 사용자는 결국 삭제 요청이 실제 준수되었는지 확인해야 합니다.

지움AI에 반영할 점:

- 커스텀 URL 처리 흐름
- 가족/보호자 지원 흐름
- 사용자에게 "이 요청은 제출 준비자료이며 실제 제출은 사용자가 한다"는 명확한 안내
- 초보자를 위한 단계별 체크리스트

반영하지 않을 점:

- 자동 대량 요청
- 대리 권한 위임
- 피해자가 이해하기 어려운 유료 플랜 차등 구조

### 2.4 Kanary

Kanary는 월간 스캔, 대시보드, 진행 리포트, 예방 조치를 강조합니다.

지움AI에 반영할 점:

- 사건 대시보드에 "오늘 할 일"을 표시합니다.
- 삭제 요청 이후 재확인 리마인더를 제공합니다.
- 예방 조치: 공개 프로필 점검, 검색엔진 캐시 확인, 비밀번호 재사용 점검, 2단계 인증 설정을 안내합니다.

### 2.5 Reputation management 계열

ReputationDefender, NetReputation류 서비스는 검색 결과 억제, 리뷰 관리, 평판 콘텐츠 제작 등을 다룹니다. 이 영역은 비용이 높고, 결과 보장이 어렵고, 공익적 비판이나 소비자 리뷰를 부당하게 억누를 위험이 있습니다.

지움AI에 반영할 점:

- 삭제 가능성과 공익성 충돌을 분리해서 판단합니다.
- 기업 평판관리, 악성 리뷰 삭제, 언론 기사 삭제 자동 요청은 지원하지 않습니다.
- 명예훼손/사생활 침해는 법률 검토 안내로 라우팅합니다.

---

## 3. 사용자 불만과 개선 요구

조사에서 반복적으로 나온 불만은 기능 부족보다 "기대치의 배신"에 가깝습니다.

### 3.1 불만: 삭제율이 낮다

Consumer Reports의 people-search 삭제 서비스 평가에서는 유료 서비스 전체가 4개월 안에 제거한 프로필이 35% 수준이었습니다. 수동 opt-out은 70%로 더 높았지만, 이 역시 완전하지 않았습니다.

지움AI 반영:

- "삭제 가능성"을 과장하지 않습니다.
- 결과 문구를 `높음/중간/낮음/전문기관 필요/법률검토 필요/지원불가`로 나눕니다.
- 각 결과에는 반드시 "왜 그렇게 판단했는지"를 함께 표시합니다.

### 3.2 불만: 대시보드의 완료 표시를 믿기 어렵다

일부 사용자는 서비스가 `removed`로 표시했지만 실제 페이지가 남아 있다고 불만을 제기합니다.

지움AI 반영:

- 상태명에서 `삭제 완료`를 남발하지 않습니다.
- `플랫폼 응답 완료`와 `사용자 직접 확인 완료`를 분리합니다.
- 사용자 확인 일시와 확인 방법을 기록합니다.

### 3.3 불만: 데이터가 다시 나타난다

데이터 브로커와 검색 결과는 새 데이터, 캐시, 미러링, 재게시로 다시 나타날 수 있습니다.

지움AI 반영:

- 사건 상태에 `REAPPEARED`를 유지합니다.
- 7일, 30일, 90일 재확인 체크리스트를 제공합니다.
- 자동 크롤링 대신 사용자가 직접 확인할 검색어와 URL 목록을 정리해 줍니다.

### 3.4 불만: 비용과 플랜이 부담스럽다

많은 유료 서비스는 연간 구독, 가족 추가요금, 커스텀 요청 상위 플랜 등으로 비용이 커집니다.

지움AI 반영:

- 기본 기능은 무료 rule-based 모드로 동작합니다.
- 유료 AI API는 관리자 또는 사용자의 선택 기능으로 둡니다.
- 공공기관/무료 공식 서비스 연결을 가장 먼저 보여줍니다.
- "돈을 내면 더 잘 지워진다"는 흐름을 만들지 않습니다.

### 3.5 불만: 더 많은 개인정보를 맡겨야 한다

삭제 서비스를 쓰려면 이름, 주소, 전화번호, 이메일, 과거 주소 등 민감정보를 다시 입력해야 하는 역설이 있습니다.

지움AI 반영:

- 기본값은 서버 저장 없이 브라우저 로컬 임시 작성입니다.
- 서버 저장은 사용자가 명시적으로 선택할 때만 켭니다.
- AI API 전송 전 민감정보를 자동 마스킹하고 사용자가 확인합니다.
- 비밀번호, 주민등록번호 원문, 피해 성착취물 원본은 절대 저장하지 않습니다.

### 3.6 불만: 초보자가 절차를 이해하기 어렵다

피해자는 법률 용어, 플랫폼 정책, 기관 이름을 처음 보는 경우가 많습니다.

지움AI 반영:

- 첫 화면에서 전문 용어보다 상황 문장으로 시작합니다.
- 예: "내 전화번호가 올라갔어요", "어릴 때 쓴 글을 지우고 싶어요", "딥페이크가 퍼졌어요".
- 30분 안에 할 수 있는 행동만 먼저 제시합니다.
- 모든 문서는 복사 가능한 문안과 체크리스트로 제공합니다.

---

## 4. 무료/저비용 피해자 중심 설계

### 4.1 비용 원칙

- 로그인 없이 진단 가능
- AI API 없이도 핵심 기능 가능
- 공공기관 무료 서비스 우선 안내
- 유료 기능은 숨겨진 필수가 아니라 선택
- 피해자가 비용 때문에 첫 대응을 포기하지 않게 설계

### 4.2 화면 원칙

첫 화면은 마케팅 랜딩이 아니라 바로 진단 화면이어야 합니다.

권장 첫 화면 구조:

1. 상황 선택
2. 짧은 설명 입력
3. URL/플랫폼 선택 입력
4. 민감정보 경고
5. 바로 결과 보기

이후 결과 화면에서 다음을 표시합니다.

- 사건 유형
- 위험도
- 삭제 가능성
- 오늘 할 일 3개
- 복사 가능한 요청서
- 무료 공식기관 연결
- 저장하지 않고 내려받기
- 원하면 사건 보드에 저장

### 4.3 초보자 모드

초보자 모드는 긴 폼을 피합니다.

- 질문은 한 화면에 하나씩
- "잘 모르겠어요" 선택지 제공
- URL이 없어도 진행 가능
- 어려운 기관명 옆에 쉬운 설명 제공
- 결과 화면에 "지금 하지 않아도 되는 것"도 표시

### 4.4 보호자/대리 도움 모드

청소년, 고령자, 디지털 약자는 혼자 신청하기 어렵습니다.

반영 요구사항:

- 14세 미만 또는 미성년 피해자는 보호자 동의/공식기관 안내를 별도 표시
- 보호자가 도와주는 경우에도 피해자 동의 체크를 분리
- 대리인이 볼 수 있는 정보와 피해자만 볼 정보 구분
- 공유용 요약본은 민감정보를 기본 마스킹

---

## 5. 2차 피해 방지와 보안 대책

### 5.1 절대 수집 금지

다음 입력은 서버에 저장하지 않습니다.

- 주민등록번호 원문
- 계정 비밀번호
- 카드번호
- 신분증 원본 이미지
- 불법촬영물 원본
- 성착취물 원본
- 딥페이크 피해 이미지/영상 원본
- 타인의 민감정보 원문

### 5.2 디지털 성범죄 사건의 특별 원칙

디지털 성범죄 사건은 지움AI 내부에서 해결하려 하지 않습니다.

앱은 다음만 합니다.

- 위험 사건으로 분류
- 원본 업로드 금지 안내
- URL, 게시 위치, 게시자 ID, 발견 일시, 협박 여부 같은 최소 정보 정리
- 중앙디지털성범죄피해자지원센터, 1366, 경찰청, 관련 심의기관 연결
- 상담 준비자료 생성

앱은 다음을 하지 않습니다.

- 피해 이미지/영상 업로드
- 미리보기 이미지 생성
- URL 자동 접속 또는 크롤링
- 피해물 재다운로드
- AI 모델에 피해물 전달

### 5.3 링크/URL 보안

피해 URL은 그 자체로 위험할 수 있습니다.

반영 요구사항:

- 앱은 URL을 자동 방문하지 않습니다.
- 링크 미리보기, 썸네일, Open Graph fetch를 금지합니다.
- URL은 문자열로만 저장하고 표시합니다.
- 외부 링크 이동 전 경고 모달을 표시합니다.
- 악성 사이트 가능성이 있으면 사용자가 직접 접속하지 말고 기관에 전달하도록 안내합니다.

### 5.4 AI API 보안

AI API 사용 전 반드시 redaction pipeline을 거칩니다.

흐름:

1. 사용자 입력 수신
2. 비밀번호/주민등록번호/카드번호/전화번호/주소/이메일 패턴 감지
3. 위험 입력은 저장 차단 또는 마스킹 제안
4. 사용자에게 "AI로 보내기 전 가려질 내용" 미리보기
5. 동의한 경우에만 AI API 호출
6. 원문은 로그에 남기지 않음
7. AI 응답은 스키마 검증 실패 시 폐기하고 rule-based fallback 사용

Critical 사건은 기본적으로 AI API에 원문을 보내지 않습니다. 디지털 성범죄, 아동 피해, 협박, 자해 위험은 rule-based safety routing을 우선합니다.

### 5.5 저장 보안

MVP 저장 정책은 두 단계로 둡니다.

기본값:

- 로컬 브라우저 임시 저장
- 서버 계정 없이 진단 가능
- 사용자가 원하면 Markdown/JSON/PDF로 내려받기

선택 저장:

- 서버 저장은 명시적 동의 후에만
- 사건별 자동 만료일 `expiresAt`
- 사용자가 언제든 삭제 가능
- 민감 텍스트는 앱 레벨 암호화
- 감사 로그에는 원문 미저장
- AI provider, model, redaction 여부만 메타데이터 저장

### 5.6 화면 안전장치

- 빠른 나가기 버튼
- 최근 입력 숨기기
- 민감 모드에서 화면 캡처 주의 문구
- 공유용 문서 생성 시 이름/전화번호/주소 자동 마스킹
- 상담기관 전화번호는 항상 표시
- "혼자 감당하지 않아도 된다"는 문구를 안전 화면에 포함

---

## 6. 다중 유료 AI API 설계

### 6.1 기본 원칙

AI는 지움AI의 본체가 아니라 보조 엔진입니다.

필수 요구사항:

- API 키가 없어도 동작
- rule-based 결과가 항상 fallback
- 여러 AI 제공자를 교체 가능
- 모델별 출력은 동일한 내부 JSON 스키마로 정규화
- 민감정보 마스킹 후 호출
- provider 장애 시 사용자에게 원문 노출 없이 fallback
- 비용 상한과 timeout 설정

### 6.2 지원 모드

```txt
AI_MODE=off
- 완전 무료 rule-based 모드
- 기본값

AI_MODE=byok
- 사용자가 자신의 API 키를 브라우저 세션에서만 사용
- 서버 저장 금지
- 고급 사용자용

AI_MODE=server
- 운영자가 서버 환경변수로 유료 API 키 설정
- 사용자는 무료로 사용 가능
- rate limit과 abuse 방지 필수

AI_MODE=local
- 로컬/사내 OpenAI-compatible endpoint 사용
- 민감 환경용
```

### 6.3 Provider adapter 구조

```txt
lib/ai/
├─ types.ts
├─ redaction.ts
├─ providerRouter.ts
├─ schemas.ts
├─ providers/
│  ├─ ruleBasedProvider.ts
│  ├─ openaiProvider.ts
│  ├─ anthropicProvider.ts
│  ├─ geminiProvider.ts
│  ├─ clovaProvider.ts
│  ├─ upstageProvider.ts
│  ├─ azureOpenAIProvider.ts
│  └─ openAICompatibleProvider.ts
└─ safetyPolicy.ts
```

공통 인터페이스:

```ts
export type AiTask = "classify" | "draft_request" | "summarize_case" | "rewrite_plain";

export type AiProviderName =
  | "rule"
  | "openai"
  | "anthropic"
  | "gemini"
  | "clova"
  | "upstage"
  | "azure-openai"
  | "openai-compatible";

export type AiProviderResult<T> = {
  ok: boolean;
  provider: AiProviderName;
  model?: string;
  data?: T;
  redacted: boolean;
  fallbackUsed: boolean;
  safeMessage?: string;
};

export interface AiProvider {
  name: AiProviderName;
  classify(input: RedactedCaseInput): Promise<AiProviderResult<CaseClassification>>;
  generateRequest(input: RedactedRequestInput): Promise<AiProviderResult<RequestDraftOutput>>;
}
```

### 6.4 Provider별 역할

OpenAI:

- 구조화 출력과 schema adherence가 필요한 분류/요청서 생성에 사용
- `gpt-5.4-mini` 또는 비용 효율 모델을 기본 후보로 둠
- 고난도 법률적 표현 판단은 AI가 단정하지 않도록 안전 프롬프트 적용

Anthropic Claude:

- 긴 상담 요약, 문체 정돈, 피해자 친화적 설명에 적합
- Messages API 기반 adapter 사용
- JSON parse 실패 시 schema validator로 폐기 후 rule fallback

Google Gemini:

- 구조화 출력과 저비용 분류 후보
- 다국어/긴 컨텍스트 확장 후보

NAVER CLOVA Studio:

- 한국어 자연스러움과 국내 클라우드 선호 환경에 적합
- Structured Outputs와 OpenAI 호환성을 활용할 수 있음

Upstage Solar:

- 한국어/문서 중심 비용 효율 후보
- 요청서 문체 개선과 문서 추출 확장에 적합

Azure OpenAI:

- 기업/기관 배포, 접근 제어, 감사, 지역/조직 정책이 필요한 경우 후보

OpenAI-compatible:

- 사내 게이트웨이, 로컬 모델, OpenRouter류 aggregator를 붙일 수 있는 확장점
- 단, 민감 피해자 데이터는 aggregator에 보내지 않는 것을 기본 정책으로 함

### 6.5 AI 사용 금지 또는 제한 사건

다음 사건은 AI provider 호출 전 rule-based safety routing을 우선합니다.

- 디지털 성범죄
- 아동·청소년 성착취 의심
- 유포 협박
- 스토킹/신변 위협
- 자해 위험
- 비밀번호/주민등록번호 원문 포함

이 경우 AI가 하더라도 원문이 아니라 마스킹된 상담 준비자료 문체 정돈 정도만 허용합니다.

---

## 7. 데이터 모델 보강안

기존 Prisma 모델에 다음 필드를 추가하는 것을 권장합니다.

```prisma
model Case {
  id                 String      @id @default(cuid())
  userId             String?
  title              String
  description        String
  redactedDescription String?
  caseType           CaseType
  riskLevel          RiskLevel
  status             CaseStatus @default(DRAFT)
  deletionChance     DeletionChance
  storageMode        StorageMode @default(LOCAL_FIRST)
  sensitivityLevel   SensitivityLevel @default(NORMAL)
  aiProviderUsed     String?
  aiModelUsed        String?
  aiRedactionApplied Boolean @default(false)
  verifiedByUserAt   DateTime?
  expiresAt          DateTime?
  deletedAt          DateTime?
  safetyNote         String?
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt
}

enum StorageMode {
  LOCAL_FIRST
  SERVER_OPT_IN
}

enum SensitivityLevel {
  NORMAL
  SENSITIVE
  CRITICAL
}
```

상태 이벤트에는 원문 대신 메타데이터 중심으로 기록합니다.

```prisma
model StatusEvent {
  id          String   @id @default(cuid())
  caseId      String
  eventType   String
  memo        String?
  publicNote  String?
  evidenceRef String?
  createdAt   DateTime @default(now())
}
```

---

## 8. UI/UX 보강 요구사항

### 8.1 누구나 쉽게 쓰는 첫 화면

첫 화면에는 다음 네 가지 버튼을 둡니다.

- 개인정보가 노출됐어요
- 예전 게시물을 지우고 싶어요
- 검색 결과에 계속 떠요
- 긴급한 유포/협박 피해예요

버튼 아래에는 작은 글씨로 다음을 둡니다.

```txt
비밀번호, 주민등록번호, 피해 이미지/영상은 입력하지 마세요.
지움AI는 삭제를 대신하지 않고, 직접 요청할 수 있는 문서와 경로를 준비해 드립니다.
```

### 8.2 결과 화면

결과 화면은 전문 보고서가 아니라 행동 카드여야 합니다.

- 지금 바로 할 일
- 저장하지 않고 문서 만들기
- 공식기관 연결
- 요청서 복사
- 나중에 다시 확인할 날짜
- 사건 보드에 저장하기

### 8.3 안전 화면

디지털 성범죄 안전 화면은 일반 결과 화면과 달라야 합니다.

- 눈에 띄는 긴급 안내
- 원본 업로드 금지
- 공식 상담 전화
- 1366 24시간 안내
- 혼자 증거를 더 찾으러 다니지 말라는 문구
- 링크를 열기 전에 안전한 사람/기관과 함께 확인하라는 문구

### 8.4 문장 기준

금지 문구:

- "삭제해드립니다"
- "완전 삭제 보장"
- "AI가 대신 신고합니다"
- "자동으로 찾아서 지웁니다"

권장 문구:

- "직접 요청할 수 있도록 준비합니다"
- "삭제 가능성은 플랫폼과 기관 판단에 따라 달라질 수 있습니다"
- "위험한 사건은 전문기관 연결이 먼저입니다"
- "비용 없이 시작할 수 있습니다"

---

## 9. 예상 문제점과 개선방안

### 문제 1. 사용자가 삭제 보장을 기대한다

개선:

- 모든 결과 화면에 한 줄 고지
- 삭제 가능성 등급과 이유 표시
- 완료 상태를 사용자 검증 기반으로 분리

### 문제 2. 피해자가 너무 많은 정보를 입력한다

개선:

- 입력 중 민감정보 감지
- 저장 전 마스킹 미리보기
- "이 정보는 입력하지 않아도 됩니다" 안내

### 문제 3. 디지털 성범죄 피해물이 앱에 업로드된다

개선:

- MVP에서 파일 업로드 기능 제거
- 성범죄 키워드 감지 시 업로드 UI 숨김
- 공식 센터 상담 후 증거 제출 안내

### 문제 4. AI가 법률 자문처럼 단정한다

개선:

- AI 출력 schema에 `legalDisclaimer`, `uncertainty`, `recommendedNextStep` 필수화
- 법률 판단성 문구 필터링
- 고위험 사건은 rule-based 기관 연결 우선

### 문제 5. AI API 비용이 운영자를 압박한다

개선:

- 기본값 `AI_MODE=off`
- 캐시 가능한 공통 템플릿은 AI 호출 금지
- rate limit
- per-task provider 설정
- 저비용 모델 우선

### 문제 6. API provider가 장애를 낸다

개선:

- provider timeout 8초
- 1회 fallback
- 최종 rule-based 결과 제공
- 사용자에게는 "기본 모드로 안내했습니다"만 표시

### 문제 7. 개인정보가 로그에 남는다

개선:

- request body logging 금지
- error message에 사용자 입력 포함 금지
- analytics는 이벤트명과 익명 count만
- Sentry/Log 서비스 사용 시 beforeSend redaction 필수

### 문제 8. 피해자가 앱 사용 흔적을 들킨다

개선:

- 빠른 나가기 버튼
- 민감 모드에서 페이지 제목 중립화
- 자동 저장 끄기
- 브라우저 기록과 알림 주의 안내
- 공유용 문서명 중립화

---

## 10. 구현 우선순위 변경

기존 구현 순서를 다음처럼 보강합니다.

1. 프로젝트 뼈대
2. 무료 rule-based 진단 흐름
3. 민감정보 감지/마스킹
4. 디지털 성범죄 안전 라우팅
5. 삭제 요청서/상담 준비자료 생성
6. 공공기관 리소스 라우터
7. 로컬 우선 사건 보드
8. 서버 저장 opt-in
9. 다중 AI provider adapter
10. AI API 비용/장애/fallback 테스트
11. 보안 테스트
12. README와 초보자 문서

---

## 11. 구현 완료 기준 v1.1

기존 완료 기준에 다음을 추가합니다.

- API 키 없이 모든 핵심 기능이 동작한다.
- 디지털 성범죄 사건에서 파일 업로드가 보이지 않는다.
- 비밀번호 입력 시 저장이 차단된다.
- 주민등록번호 패턴 입력 시 마스킹 안내가 뜬다.
- AI API 호출 전 redaction preview가 있다.
- AI provider 장애 시 rule-based fallback이 동작한다.
- `삭제 완료`와 `사용자 확인 완료` 상태가 분리되어 있다.
- 공공기관 링크가 최신 공식 URL로 정리되어 있다.
- 초보자 모드에서 3분 안에 결과 화면까지 갈 수 있다.
- 저장하지 않고도 요청서를 만들 수 있다.
- 사용자가 사건 데이터를 삭제할 수 있다.
- 피해물 원본 업로드를 유도하는 문구가 없다.

---

## 12. 참고 출처

- Consumer Reports, Data Defense: Evaluating People-Search Site Removal Services  
  https://innovation.consumerreports.org/wp-content/uploads/2024/08/Data-Defense_-Evaluating-People-Search-Site-Removal-Services-.pdf
- Consumer Reports, Services That Delete Your Data From People-Search Sites  
  https://www.consumerreports.org/electronics/personal-information/services-that-delete-data-from-people-search-sites-review-a2705843415/
- DeleteMe, What is DeleteMe?  
  https://help.joindeleteme.com/hc/en-us/articles/8159204828819-What-is-DeleteMe
- DeleteMe, How long before my information is removed?  
  https://help.joindeleteme.com/hc/en-us/articles/8171803033491-How-long-before-my-information-is-removed
- Optery, Will Optery be able to remove all of my personal information from the Internet?  
  https://help.optery.com/en/article/will-optery-be-able-to-remove-all-of-my-personal-information-from-the-internet-1phvn81/
- Optery, What is a Removals Report?  
  https://help.optery.com/en/article/what-is-a-removals-report-1ht35vl/
- Incogni, Plans and prices  
  https://support.incogni.com/hc/en-us/articles/26753632381970-Plans-and-prices-of-Incogni-service
- 개인정보 포털, 지우개 서비스  
  https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=260
- 털린 내 정보 찾기 서비스  
  https://kidc.eprivacy.go.kr/intro/service.do
- 중앙디지털성범죄피해자지원센터  
  https://d4u.stop.or.kr/main
- 중앙디지털성범죄피해자지원센터, 삭제지원안내  
  https://d4u.stop.or.kr/delete_consulting?tab=2
- OpenAI API, Structured Outputs  
  https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI API, Models  
  https://developers.openai.com/api/docs/models
- Anthropic Claude API Overview  
  https://platform.claude.com/docs/en/api/overview
- Google Gemini API, Structured outputs  
  https://ai.google.dev/gemini-api/docs/structured-output
- NAVER Cloud CLOVA Studio 개요  
  https://api-gov.ncloud-docs.com/docs/clovastudio-overview
- Upstage API pricing  
  https://www.upstage.ai/pricing/api
