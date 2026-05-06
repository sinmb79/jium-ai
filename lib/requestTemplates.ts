import type { CaseClassification, CaseInput, RequestDraftOutput } from "@/lib/types";

export function generateRequestDraft(input: CaseInput, classification: CaseClassification): RequestDraftOutput {
  switch (classification.caseType) {
    case "DIGITAL_SEX_CRIME":
      return generateDigitalSexCrimeSummary(input);
    case "CREDENTIAL_LEAK":
      return generateCredentialLeakChecklist(input);
    case "SEARCH_RESULT_REMOVAL":
      return generateSearchRemovalRequest(input);
    case "SELF_POST_DELETE":
      return generateEraserPreparation(input);
    case "ACCOUNT_DELETE":
      return generateAccountDeletePreparation(input);
    case "DEFAMATION_PRIVACY":
      return generateLegalReviewPreparation(input);
    default:
      return generatePlatformDeleteRequest(input);
  }
}

export function generatePlatformDeleteRequest(input: CaseInput): RequestDraftOutput {
  const exposed = input.exposedInfo.length ? input.exposedInfo.join(", ") : "[노출된 정보 종류 입력]";
  return {
    title: "개인정보 또는 사생활 정보 노출 게시물 조치 요청",
    recipientType: "PLATFORM_ADMIN",
    checklist: ["대상 URL", "게시 위치", "노출된 정보 종류", "발견 일시", "본인 확인에 필요한 최소 자료"],
    body: `
안녕하세요.

아래 게시물에 제 동의 없이 개인정보 또는 사생활 관련 정보가 노출되어 삭제 또는 비공개 처리를 요청드립니다.

대상 URL:
${input.targetUrl || "[대상 URL 입력]"}

게시 위치:
${input.platform || "[게시판/플랫폼명 입력]"}

노출된 정보:
${exposed}

피해 내용:
${input.description}

요청 사항:
1. 해당 게시물의 삭제 또는 블라인드 처리
2. 검색 결과 및 미리보기 노출 제한
3. 동일 정보가 포함된 재게시물 확인 시 추가 조치
4. 처리 결과 회신

본 요청은 제 개인정보와 사생활 보호를 위한 정당한 조치 요청입니다.
필요한 본인 확인 자료나 추가 정보가 있으면 회신 부탁드립니다.

감사합니다.
`.trim(),
  };
}

export function generateSearchRemovalRequest(input: CaseInput): RequestDraftOutput {
  return {
    title: "검색 결과 제외 또는 캐시 삭제 요청",
    recipientType: "SEARCH_ENGINE",
    checklist: ["검색어", "검색 결과 URL", "원본 URL", "원본 삭제 여부", "검색 결과 확인 일시"],
    body: `
안녕하세요.

삭제되었거나 개인정보가 포함된 페이지가 검색 결과에 계속 노출되어 검색 제외 또는 캐시 삭제를 요청드립니다.

검색 결과에 노출되는 URL:
${input.targetUrl || "[검색 결과 URL 또는 원본 URL 입력]"}

검색어:
${input.keywords || "[검색어 입력]"}

요청 사유:
${input.description || "개인정보 또는 사생활 관련 정보가 검색 결과에 노출되고 있습니다."}

요청 사항:
1. 검색 결과에서 해당 URL 제외
2. 저장된 캐시 또는 스니펫 삭제
3. 개인정보가 포함된 미리보기 문구 제거

감사합니다.
`.trim(),
  };
}

export function generateDigitalSexCrimeSummary(input: CaseInput): RequestDraftOutput {
  return {
    title: "디지털 성범죄 피해 상담 준비자료",
    recipientType: "PUBLIC_AGENCY",
    checklist: ["URL", "게시 위치", "게시자 ID 또는 닉네임", "발견 일시", "유포 협박 메시지 여부", "이미 신고한 기관"],
    body: `
디지털 성범죄 피해 상담 준비자료

주의:
- 이 서비스에는 피해 이미지나 영상을 업로드하지 않습니다.
- 가능한 경우 URL, 게시 위치, 게시자 ID, 유포 시기, 협박 메시지 등 최소 정보만 정리합니다.
- 혼자 추가 검색하거나 피해물을 다시 내려받지 않습니다.

피해 상황 요약:
${input.description}

확인된 URL:
${input.targetUrl || "[URL이 있다면 입력]"}

게시 위치/플랫폼:
${input.platform || "[사이트명, SNS명, 메신저명 등]"}

검색 또는 특정 가능한 키워드:
${input.keywords || "[게시물 제목, 유포자 ID, 닉네임 등]"}

추천 연결:
- 중앙디지털성범죄피해자지원센터
- 여성긴급전화 1366
- 경찰청 사이버범죄 신고
- 방송통신심의 관련 신고

중요:
완전한 삭제가 어려울 수 있으므로 전문기관의 삭제지원과 지속 모니터링을 먼저 받는 것이 좋습니다.
혼자 감당하지 않아도 됩니다.
`.trim(),
  };
}

export function generateCredentialLeakChecklist(input?: Partial<CaseInput>): RequestDraftOutput {
  return {
    title: "계정정보 유출 의심 대응 체크리스트",
    recipientType: "SELF_CHECKLIST",
    checklist: ["비밀번호 변경", "2단계 인증", "로그인 기록 확인", "동일 비밀번호 사용처 점검"],
    body: `
계정정보 유출 의심 대응 체크리스트

즉시 할 일:
1. 지움AI에 비밀번호를 입력하지 않습니다.
2. 공식 "털린 내 정보 찾기" 서비스에서 유출 여부를 확인합니다.
3. 유출 의심 계정의 비밀번호를 즉시 변경합니다.
4. 같은 비밀번호를 쓰는 다른 사이트도 모두 변경합니다.
5. 2단계 인증을 설정합니다.
6. 로그인 기록을 확인합니다.
7. 모르는 기기/세션을 로그아웃합니다.
8. 금융, 쇼핑, 이메일 계정은 우선적으로 점검합니다.

상황 메모:
${input?.description || "[의심 상황을 간단히 기록]"}

주의:
- 문자나 이메일로 온 임시 링크를 무조건 클릭하지 않습니다.
- 비밀번호를 캡처해 저장하지 않습니다.
- 같은 비밀번호를 여러 사이트에서 재사용하지 않습니다.
`.trim(),
  };
}

export function generateEraserPreparation(input: CaseInput): RequestDraftOutput {
  return {
    title: "지우개 서비스 신청 준비자료",
    recipientType: "PUBLIC_AGENCY",
    checklist: ["작성 당시 나이", "현재 나이대", "개인정보 포함 여부", "URL 또는 검색어", "본인 작성 근거"],
    body: `
지우개 서비스 신청 준비자료

상황:
${input.description}

게시 위치:
${input.platform || "[사이트명 또는 앱 이름]"}

URL 또는 검색어:
${input.targetUrl || input.keywords || "[URL 또는 검색어]"}

확인할 점:
1. 아동·청소년 시기에 작성한 게시물인지
2. 게시물에 개인정보가 포함되어 있는지
3. 본인이 작성했거나 본인과 관련된 정보인지
4. 삭제 요청 또는 검색 배제가 필요한 이유

이 자료는 신청 준비를 돕기 위한 초안입니다. 실제 대상 여부는 개인정보 포털 지우개 서비스 안내에 따라 확인해야 합니다.
`.trim(),
  };
}

export function generateAccountDeletePreparation(input: CaseInput): RequestDraftOutput {
  return {
    title: "웹사이트 회원탈퇴 준비자료",
    recipientType: "PUBLIC_AGENCY",
    checklist: ["사이트명", "가입 추정 이메일", "계정 ID", "본인확인 방법", "탈퇴 전 백업 여부"],
    body: `
웹사이트 회원탈퇴 준비자료

탈퇴하려는 서비스:
${input.platform || "[사이트명]"}

계정 관련 단서:
${input.keywords || "[이메일, 계정 ID 등. 비밀번호는 쓰지 마세요.]"}

상황:
${input.description}

준비할 일:
1. 개인정보 포털 웹사이트 회원탈퇴 서비스 대상인지 확인합니다.
2. 사이트에서 직접 탈퇴해야 하는 경우 고객센터 경로를 확인합니다.
3. 탈퇴 전 필요한 데이터가 있는지 확인합니다.
4. 비밀번호는 이 문서에 적지 않습니다.
`.trim(),
  };
}

export function generateLegalReviewPreparation(input: CaseInput): RequestDraftOutput {
  return {
    title: "법률 검토 상담 준비자료",
    recipientType: "LEGAL_SUPPORT",
    checklist: ["게시물 URL", "문제 표현", "사실과 다른 부분", "피해 내용", "공익성 가능성"],
    body: `
법률 검토 상담 준비자료

게시물 또는 표현:
${input.targetUrl || "[URL 또는 게시 위치]"}

피해 내용:
${input.description}

정리할 점:
1. 어떤 표현이 문제인지
2. 사실과 다른 부분이 무엇인지
3. 사생활 정보가 포함되어 있는지
4. 공익적 비판이나 소비자 리뷰에 해당할 가능성이 있는지
5. 이미 요청하거나 신고한 이력이 있는지

주의:
명예훼손·사생활 침해 사안은 표현의 자유와 충돌할 수 있으므로 삭제 가능성을 단정하지 않습니다.
`.trim(),
  };
}
