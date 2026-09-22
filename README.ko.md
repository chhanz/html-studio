# HTML Studio

HTML 슬라이드 덱을 보고, 고치고, 점검하고, 발표하는 [Kiro Crew](https://kiro.dev) 앱입니다.

- 덱(슬라이드 1개 = HTML 파일 1개)을 찾아 라이브 미리보기로 표시
- 미리보기에서 요소를 가리켜 코멘트를 남기면 에이전트가 수정 적용
- 덱 점검(넘침, 금지 패턴, 커버 누락, 대비)
- 현재 슬라이드부터 발표, 발표자 노트와 레이저 포인터
- PDF 내보내기
- 테마는 [DESIGN.md](https://github.com/VoltAgent/awesome-design-md) 형식을 따름

상태: 초기 개발 중. 영문 문서는 `README.md`를 참고하세요.

## 개발

```bash
cd ui && npm install && npm run build      # ui/dist/index.mjs 생성
python3 -m unittest backend/tests/test_server.py
kirocrew app install /path/to/html-studio
kirocrew app enable html-studio
```

## 검증

```bash
./verify.sh quick   # 백엔드 테스트, 타입체크, 빌드, 호스트 클래스 린트
./verify.sh         # 위 항목 + E2E 하네스(헤드리스 Chromium)
```

`e2e/`는 빌드된 UI 번들을 실제 백엔드와 함께, 대시보드를 대신하는 하네스(SDK shim + 서명 프록시) 안에서 실행합니다. `e2e/fixtures/`의 가상 샘플 덱을 사용합니다. `e2e/check-classes.mjs`는 대시보드의 미리 컴파일된 스타일시트에 없는 Tailwind 클래스를 UI가 쓰면 실패합니다. 처음 한 번: `cd e2e && npm install && npx playwright install chromium`.

## 라이선스

MIT
