# 지움AI 실제 운영제품 로드맵 v3.0

작성일: 2026-05-31

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

## 남은 운영제품 개발 단계

### Phase A: 제출 패키지 고도화

- PDF/A 또는 인쇄용 HTML 제출본: 인쇄용 HTML 1차 구현 완료
- ZIP 제출 패키지: Markdown, 담당자 HTML, 증거 체인 manifest JSON, 체크리스트: 1차 구현 완료
- 사건별 `.jiumcase` 암호화 내보내기와 가져오기: 1차 구현 완료
- 제출 패킷 버전 고정과 변경 이력 비교: 1차 구현 완료
- 기관별 준비물 프로필과 제출 준비도: 1차 구현 완료

### Phase B: 데스크톱 보안 저장소

- Tauri 또는 Electron 기반 로컬 앱 검토
- Windows DPAPI, macOS Keychain, Linux Secret Service 연동
- 브라우저 확장프로그램 영향을 줄이는 독립 실행 환경
- 자동 잠금, 세션 타임아웃, 복호화 메모리 초기화: 브라우저 보관함 1차 구현 완료

### Phase C: 기관·전문가 협업

- 기관별 준비물 프로필: 1차 구현 완료
- 지역 디지털성범죄피해자지원센터 라우팅
- 지원자/상담자용 읽기전용 토큰 또는 파일 기반 전달
- 수사·심의기관 제출 전 확인 체크리스트

### Phase D: 운영 보안

- CSP Report-Only 결과 확인 후 단계적 Enforcement 전환: 1차 Enforcement 병행 완료
- 보안 헤더가 정적 호스팅에서도 적용되도록 Netlify/Cloudflare/Vercel별 설정: Netlify/Cloudflare `_headers` 1차 구현 완료
- SAST, dependency audit, secret scan CI: secret scan과 dependency audit CI 1차 구현 완료
- 민감정보 테스트 케이스와 XSS 회귀 테스트

### Phase E: 합법적 데이터 피드

- 공개 범죄 사이트 목록을 제품에 노출하지 않음
- 승인된 파트너/기관 피드만 제한 저장
- 피드별 출처, 확인일, 권한 수준, 보존 기한, 감사로그
- 비식별 통계만 학습 저장

## 공식 경로 기준

- 중앙디지털성범죄피해자지원센터: https://d4u.stop.or.kr/main
- 경찰청 사이버범죄 신고시스템: https://ecrm.police.go.kr
- KISA 개인정보침해 신고센터: https://privacy.kisa.or.kr
- 개인정보보호위원회 개인정보 침해 신고 안내: https://www.pipc.go.kr/np/default/page.do?mCode=D030050000

## 운영 판단

현재 지움AI는 해커톤 시연 MVP를 넘어 실제 운영제품의 뼈대에 들어섰다. 다만 법률·기관 협업·데스크톱 보안 저장소·배포 보안·증거 제출 포맷까지 완성되어야 "현장 운영 가능"이라고 부를 수 있다.
