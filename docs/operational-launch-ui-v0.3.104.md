# 운영 런치 UI v0.3.104

v0.3.104는 redacted 운영 런치 콘솔을 제품 화면 안으로 가져옵니다.

CLI launch console은 이미 어떤 운영 단계가 막혔는지, 누가 담당해야 하는지, P0 작업이 몇 개 남았는지, 다음 검증 명령이 무엇인지 알려줍니다. 하지만 프로그램 책임자나 사건 대응 담당자가 매번 JSON/Markdown 파일을 따로 열어 봐야 했습니다. 새 패널은 그 남은 작업을 사건 보드 안에서 바로 보이게 만듭니다.

## 사용 흐름

1. 기존 redacted 리포트를 생성합니다:

```bash
npm run ops:launch-console:json -- --output dist/operational-launch-console/report.json
```

2. 사건 보드를 열고 운영 런치 패널에 JSON을 붙여넣습니다.
3. 막힌 owner lane, P0 작업 수, 첫 검증 명령을 확인합니다.
4. 내부 인수인계 메모가 필요하면 Markdown 요약을 저장합니다.

## 변경 사항

- 사건 보드에 `OperationalLaunchPanel`을 추가했습니다.
- `parseOperationalLaunchConsoleJson`과 `formatLaunchSurfaceMarkdown`를 추가했습니다.
- JSON을 가져오기 전에도 운영자가 예상 생산 단계를 볼 수 있도록 기본 launch guide를 제공합니다.
- `nextOperatorRunOrder`를 owner-lane 상세와 병합해 UI 카드에 사람이 읽을 수 있는 제목과 작업 수가 유지되도록 했습니다.

## 안전 경계

이 패널은 의도적으로 read-only, local-first입니다. 운영 승인, private approval record 작성, 기관 제출, 데스크톱 산출물 업로드, 기관 연락, 외부 서비스 호출을 하지 않습니다.

가져온 JSON에 실제 URL, 연락처, 토큰, 초대 링크, onion 주소, 전화번호, private filesystem path가 있으면 표시하지 않고 차단합니다. Markdown export에는 launch-console 리포트에서 허용된 redacted 상태 요약, owner role, phase ID, command template만 포함됩니다.

## 검증

```bash
npm test -- --run tests/operationalLaunchSurface.test.ts tests/OperationalLaunchPanel.test.tsx tests/CaseBoard.test.tsx
npm run typecheck
```

이 테스트는 redacted launch-console 파싱, raw value 차단, 기본 guide 렌더링, 가져온 owner-lane 렌더링, CaseBoard 통합을 확인합니다.
