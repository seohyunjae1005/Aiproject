# 1주차 산출물 - 문제 정의, 소스 조사, 성공 기준

작성일: 2026-09-03  
상태: 1차 조사 완료, 사용자 기준시간 측정 및 실제 수집 테스트 대기

## 1. 문제 정의

### 현재 방식

반도체 취업 준비생이 삼성전자, SK하이닉스와 주요 장비사의 기술 변화를 파악하려면 각 회사의 뉴스룸을 반복 방문하고 신규 글을 찾은 뒤, 직무와 관련된 내용인지 직접 판단해야 한다.

### 핵심 비효율

1. 정보가 여러 공식 사이트에 분산되어 있다.
2. 신규 글과 이미 확인한 글을 수작업으로 구분해야 한다.
3. 소비자 제품, 인사, 재무 등 공정 직무와 관련성이 낮은 글이 섞여 있다.
4. 장비 기술 발표를 관련 공정과 생산·품질 지표로 다시 해석해야 한다.
5. 생성형 AI로 단순 요약하면 사실과 추론이 섞이거나 근거 없는 영향 분석이 생성될 수 있다.

### 해결 가설

공식 채널의 신규 글을 매일 자동 수집하고, 출처를 보존한 상태에서 AI가 기술 분야·관련 공정·KPI를 구조화하면 수작업 탐색 시간을 줄일 수 있다. 사실과 영향 가설을 분리하고 사람의 검토 결과를 반영하면 AI 분석의 신뢰성도 개선할 수 있다.

## 2. 프로젝트 범위

### 최소 성공 범위 - 6개사

- 삼성전자
- SK하이닉스
- ASML
- Applied Materials
- Lam Research
- Tokyo Electron

### 목표 범위 - 10개사

최소 범위에 Micron, Kioxia, TSMC, KLA를 추가한다.

### 이번 학기 제외 범위

- 로그인이나 개인정보 제출이 필요한 백서
- 유료 기사와 비공개 자료
- 특허·논문 전체 검색
- 사용자가 임의 URL을 입력하는 기능
- 개인별 로그인 대시보드
- 스펙·자소서 분석 서비스
- 자동차·방산 등 타 산업 수집

위 기능은 향후 확장 방향으로만 남긴다.

## 3. 공식 채널 1차 조사 결과

| 회사 | 유형 | 공식 채널 | 1차 판단 | 구현 메모 |
|---|---|---|---|---|
| 삼성전자 | 메모리/IDM | Samsung Newsroom Semiconductor | RSS 우선 | 전체 RSS 수집 후 반도체 범주 필터 검증 |
| SK하이닉스 | 메모리/IDM | SK hynix Newsroom | 조사 필요 | 일부 자동 접근에서 차단 가능성, 피드·목록 구조 확인 필요 |
| Micron | 메모리/IDM | Investor News Releases | RSS 우선 | 현재 RSS 주소와 본문 추출 검증 필요 |
| Kioxia | 메모리/IDM | Kioxia News | HTML 가능 | IR·공지·제품 뉴스 분류 필요 |
| TSMC | 파운드리 | TSMC Latest News | HTML 가능 | 재무 공지와 기술 뉴스 분류 필요 |
| ASML | 장비 | Press Releases | 조사 필요 | 목록이 동적으로 표시될 수 있어 내장 데이터 확인 필요 |
| Applied Materials | 장비 | Investor News Releases | RSS 적합 | 공식 RSS 제공 확인 |
| Lam Research | 장비 | Newsroom Press Releases | HTML 적합 | 제목·날짜·요약·링크가 목록에 노출됨 |
| Tokyo Electron | 장비 | News Room | HTML 적합 | Products/Services 등 주제 필터 활용 가능 |
| KLA | 장비 | IR Press Releases | HTML 가능 | 재무성 공지와 기술 뉴스 분류 필요 |

## 4. 소스 조사에서 확인한 위험

- 회사별로 RSS 제공 여부와 목록 구조가 다르다.
- ASML처럼 일부 환경에서 동적 목록이 비어 보이는 사이트가 있다.
- SK하이닉스 뉴스룸은 자동 접근 방식에 따라 응답이 달라질 수 있다.
- 삼성전자 전체 뉴스룸은 가전·모바일 등 비반도체 글이 많아 범주 필터가 필요하다.
- Kioxia, TSMC, KLA 목록에는 기술 뉴스와 재무·지배구조 공지가 섞여 있다.
- 목록 페이지가 개편되면 선택자 기반 수집기가 깨질 수 있다.

## 5. 설계 결정

### 수집 방식 우선순위

1. 공식 RSS 또는 Atom
2. 공식 sitemap 또는 정적 목록 HTML
3. 페이지 내부에 포함된 공개 JSON 데이터
4. 회사별 HTML 어댑터

브라우저 자동화는 유지비가 크므로 이번 학기에는 최후 수단으로만 검토한다. 접근이 제한된 사이트를 우회하지 않는다.

### 데이터 최소 스키마

- `source_id`
- `company`
- `company_group`
- `title`
- `published_at`
- `canonical_url`
- `content_text`
- `content_hash`
- `collected_at`
- `collection_status`

### AI 출력 최소 스키마

- `verified_facts`
- `technology_topics`
- `process_steps`
- `kpi_links`
- `impact_hypotheses`
- `evidence`
- `confidence`
- `needs_human_review`

## 6. 성공 기준

### 기능 기준

- 최소 6개 회사에서 신규 게시물 수집
- URL과 본문 해시를 이용한 중복 방지
- 원문 URL, 회사, 날짜가 포함된 분석 카드 생성
- GitHub Pages 자동 갱신
- opt-in 사용자 대상 이메일 발송
- 오류 발생 시 회사별 실패 로그 기록

### 평가 기준

- 평가 게시물 최소 30건
- 출처 연결률 목표 95% 이상
- 공정 분류 일치율 목표 80% 이상
- 수작업 대비 검토시간 목표 60% 이상 단축
- 2주간 예약 실행 성공률 목표 95% 이상

목표치는 계획 단계의 기준이며 결과보고서에는 실제 측정값만 사용한다.

## 7. 수작업 기준시간 측정 절차

자동화 전 기준시간은 프로젝트 당사자가 직접 측정해야 한다.

1. 필수 6개 회사 공식 채널을 브라우저로 연다.
2. 최근 24시간 또는 마지막 확인 이후의 신규 글을 찾는다.
3. 반도체 공정·장비와 관련된 글만 선별한다.
4. 제목, 회사, 날짜, URL, 핵심 내용, 관련 공정을 표에 기록한다.
5. 시작 시각과 종료 시각을 기록한다.
6. 다른 날짜에 같은 작업을 최소 3회 반복한다.

기록 항목:

| 측정일 | 확인 회사 수 | 신규 글 수 | 관련 글 수 | 소요시간(분) | 누락/중복 메모 |
|---|---:|---:|---:|---:|---|
| 미측정 | 6 | - | - | - | 사용자 실측 필요 |

## 8. 1주차 남은 작업

- 사용자가 수작업 기준시간 1회차 측정
- Python 실행환경과 Git 설치 여부 확인
- 로컬 프로젝트에서 삼성전자 RSS 파싱 시험
- SK하이닉스 뉴스룸의 허용 가능한 공개 수집 경로 확인
- GitHub에 `Aiproject` 원격 저장소 생성 후 로컬 폴더 연결

## 9. 공식 출처

- Samsung Newsroom: https://news.samsung.com/global/
- SK hynix Newsroom: https://news.skhynix.co.kr/
- Micron News Releases: https://investors.micron.com/news-releases
- Kioxia News: https://www.kioxia-holdings.com/en-jp/news.html
- TSMC Press Center: https://pr.tsmc.com/english/latest-news
- ASML Press Releases: https://www.asml.com/en/news/press-releases
- Applied Materials News: https://ir.appliedmaterials.com/news-releases/
- Lam Research Press Releases: https://newsroom.lamresearch.com/press-releases?l=100
- Tokyo Electron News: https://www.tel.com/news/
- KLA Press Releases: https://ir.kla.com/news-events/press-releases

