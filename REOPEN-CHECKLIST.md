# mediai 재오픈 체크리스트

2026년 의료AI 보건의료인 직무교육사업 주간 실적보고 서비스(mediai)를 2026년 사업 종료 후 내리면서, 다시 열 때 필요한 정보와 할 일을 정리한 문서입니다.

## 종료 방식 (전제)

- 개발 PC의 프로젝트 폴더·백업·환경변수 파일은 **모두 삭제**했습니다.
- Vercel·Supabase·OpenAI는 **무료 플랜으로 내리고 사용을 중지**했습니다.
- Supabase 무료 프로젝트는 사용이 없으면 자동 일시정지되고, 오래 지나면 대시보드에서 재개할 수 없습니다. **재오픈 때는 DB가 없다고 보고 백업에서 새로 만드는 것이 기본**입니다.
- 남아 있는 것은 두 가지뿐입니다.
  1. **GitHub 저장소** `mediai-kohi/mediai` (코드, 이 문서, DB 스키마 마이그레이션)
  2. **외부 보관 백업** (DB 데이터, 업로드 파일, 환경변수). 보관 위치는 아래 0번 표에 적습니다.

---

## 이 파일을 받은 AI에게

사용자가 이 파일을 올리고 "다시 열려면 뭘 해야 해?" 같은 질문을 하면, 다음 방식으로 답해 주세요.

1. **0번 표 확인**: 백업 보관 위치와 내용이 적혀 있는지 봅니다. 비어 있으면 사용자에게 백업을 어디에 두었는지부터 물어보세요. 백업이 없으면 데이터 없이 새로 시작해야 한다는 점을 먼저 알려 주세요.
2. **사용자에게 물어볼 것** (답에 따라 할 일이 달라집니다):
   - 올해 사업 기간(시작일·종료일)과 주간보고 시작 주차
   - 작년 데이터(리포트, 사용자 계정)를 이어 쓸지, 기관 목록만 가져와 새로 시작할지
   - 참여 기관과 담당자 변동
   - 예산 비목과 보고 양식 변경 여부
   - 작업할 PC에 Node.js·Git이 설치되어 있는지
   - 유료 플랜을 다시 쓸 예산이 있는지 (Vercel·Supabase, 아래 2번 참고)
3. **답변 형식**: 아래 1~7단계를 사용자 상황에 맞게 추려 **순서가 있는 체크리스트**로 보여 주세요. 항목마다 누가 하는지(사용자가 대시보드에서 직접 / 개발자·AI가 코드로)와 대략 걸리는 시간을 붙여 주세요.
4. 서비스·라이브러리 정책(요금제 한도, 모델 단종, Node.js 버전)은 이 문서 작성 후 바뀌었을 수 있으니 최신 공식 문서로 확인하세요.
5. 운영 DB에 쓰는 작업(스키마 생성, 데이터 입력)은 실행 전에 반드시 사용자 확인을 받으세요.

---

## 0. 종료 시점 기록 (종료할 때 채워 두기)

| 항목 | 값 |
|---|---|
| 서비스 종료일 | |
| 마지막 커밋 / 태그 | 태그 `v2026-final` (서비스 종료 시점 코드 + 이 문서) |
| **백업 보관 위치** (PC 외부) | |
| 백업 접근 방법 (담당자, 암호 보관처) | |
| 백업 폴더 이름 | `backups/2026-11-23T07-22-20-259Z` (최종 운영 백업) |
| 개인정보 처리 | 보관(근거·보유기한: ____) / 파기(일자: ____) |
| Supabase 운영 프로젝트 | `gmlhpcvxbogjldzeerxx` / 종료 후: 무료 전환·일시정지·삭제 |
| Vercel 프로젝트 | `mediai` / 종료 후: 무료 전환·삭제 |
| 서비스 도메인 | 주소: ____ / 소유·갱신 담당: ____ |
| OpenAI | API 키 폐기함 / 자동 충전 해제함 |
| 남기는 메모 | |

### 백업에 들어 있어야 하는 것

| 내용 | 확인 |
|---|---|
| DB 구조 복원 스크립트 `_schema_restore.sql` (테이블, 함수, 트리거, RLS 정책, 버킷, 예약 작업). 복원 방법은 백업 폴더의 `RESTORE.md` | [x] 2026-11-23 |
| 테이블별 데이터 JSON (`scripts/backup-supabase.mjs` 결과) | [x] 2026-11-23 |
| Storage 파일: `attachments`(리포트 첨부), `documents`(AI 참고 문서 PDF) | [x] 2026-11-23 |
| 로그인 계정 목록 (id, 이메일, 메타데이터, 비밀번호 제외) | [x] 2026-11-23 |
| 환경변수 원본 (`.env.local.production.bak` 내용) | [ ] |
| 이 문서 사본 | [ ] |

---

## 1. 서비스 구성 한눈에 보기

| 구성 | 내용 |
|---|---|
| 코드 | GitHub `mediai-kohi/mediai`, Next.js 16 (App Router, webpack 빌드), Node.js 24로 운영 |
| 배포 | Vercel |
| DB·인증·파일 | Supabase (Postgres + pgvector + Auth + Storage) |
| Storage 버킷 | `attachments`, `documents` |
| AI | OpenAI `gpt-4o-mini`(요약·챗봇), `text-embedding-3-small`(문서 임베딩, 1536차원) |
| 푸시 알림 | Web Push (VAPID 키), 서비스워커 `worker/index.js` |
| 정기 작업 (`vercel.json`) | 리포트 독촉 매주 목 10시 KST, 채팅 정리 매일 12시 KST, 보안 알림 **매시간** |

### 필요한 환경변수

| 이름 | 어디서 받나 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 위와 같음 |
| `SUPABASE_SERVICE_ROLE_KEY` | 위와 같음 (외부 노출 금지) |
| `NEXT_PUBLIC_APP_URL` | 서비스 주소 |
| `OPENAI_API_KEY` | OpenAI 대시보드에서 새로 발급 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | 백업의 작년 값. 없으면 `npx web-push generate-vapid-keys`로 새로 만들고, 사용자는 알림을 다시 허용해야 함 |
| `CRON_SECRET` | 임의의 긴 문자열 |

Supabase 값은 새 프로젝트를 만들면 새로 발급되므로, 백업의 작년 값은 VAPID 키 외에는 참고용입니다.

---

## 2. 요금제 결정 (먼저 정하기)

| 서비스 | 무료로 운영할 때 문제 | 권장 |
|---|---|---|
| Vercel | 무료(Hobby)는 **비상업·개인 용도**로 제한. 크론은 **하루 1회까지**만 가능해 매시간 보안 알림 크론이 있으면 배포가 실패할 수 있음 | 기관 서비스이므로 **Pro**. 무료로 쓸 수밖에 없다면 보안 알림 크론 주기를 하루 1회로 바꾸거나 제거 |
| Supabase | 무료는 1주일 사용이 없으면 일시정지, 자동 백업 없음, 용량 제한 | 운영 기간에는 **Pro** (일일 백업 포함) |
| OpenAI | 무료 플랜 없음. 선불 크레딧 충전 필요 | 크레딧 충전 + 월 사용 한도 설정 |

---

## 3. 개발 환경 다시 만들기 (새 PC)

1. Node.js LTS와 Git을 설치합니다.
2. 코드를 받습니다.
   ```
   git clone https://github.com/mediai-kohi/mediai.git
   cd mediai
   git checkout v2026-final   # 종료 시점 코드. 이후 커밋이 없다면 main에서 시작해도 됨
   npm install
   ```
3. 루트에 `.env.local`을 만들고 1번 표의 환경변수를 채웁니다 (Supabase를 새로 만든 뒤).
4. `npm run dev` → http://localhost:3000 에서 로그인 화면이 뜨는지 확인합니다.
5. `npm run build`가 성공하는지 확인합니다. 실패하면 5번(의존성 점검)부터 합니다.

---

## 4. 인프라 다시 만들기

### 4-1. Supabase (새 프로젝트)

> 작년 프로젝트(`gmlhpcvxbogjldzeerxx`)가 혹시 남아 있고 재개된다면 그대로 써도 됩니다. 이 경우 아래 2~7은 건너뜁니다.

1. 새 프로젝트를 만듭니다 (리전: 서울 `ap-northeast-2`).
2. **스키마·데이터 복원**
   - **백업 폴더에 `_schema_restore.sql`과 `RESTORE.md`가 있으면 그 문서를 따릅니다 (권장).** 종료 시점의 실제 DB 구조입니다.
   - **없으면** 저장소 파일로 다시 만듭니다.
     1. Database → Extensions에서 `vector`를 켭니다.
     2. 루트의 초기 스키마 `*.sql`(`supabase-schema.sql`, `admin-schema.sql`, `organizations-setup.sql`, `reports-schema-v2.sql`, `ai-qa-schema.sql`, `attachments-schema.sql` 등)이 필요한지 확인해 먼저 실행합니다. 이후 `supabase/migrations/*.sql`을 **파일명 순서대로** 실행합니다. 이 순서는 검증된 적이 없으므로 오류가 나면 하나씩 확인하며 진행합니다.
     3. 로그인 계정을 백업의 계정 목록과 **같은 UUID로** 다시 만듭니다 (Auth Admin API `createUser`에 `id` 지정). UUID가 다르면 `profiles`·리포트와 연결되지 않습니다.
     4. 테이블 JSON을 외래키 참조 순서대로 넣습니다 (`organizations` → `profiles` → 나머지).
3. Storage 버킷 `attachments`, `documents`를 만들고 백업 파일을 같은 경로로 올립니다 (`supabase/migrations/20260715_recreate_documents_bucket.sql` 참고).
4. 비밀번호는 백업되지 않을 수 있으므로, 사용자에게 비밀번호 재설정을 안내합니다.
5. Authentication → URL Configuration에서 Site URL과 Redirect URL을 서비스 도메인으로 맞춥니다.
6. AI 참고 문서는 관리자 화면에서 다시 업로드하거나 임베딩을 다시 생성합니다.
7. Pro 플랜이면 일일 백업이 켜져 있는지 확인합니다.

### 4-2. Vercel
1. Add New → Project에서 GitHub 저장소 `mediai-kohi/mediai`를 import합니다 (작년 프로젝트가 남아 있으면 그것을 씁니다).
2. 환경변수를 Production / Preview에 등록합니다.
3. 도메인을 연결합니다.
4. 크론: 종료할 때 `vercel.json`의 `crons`를 지웠다면 되돌립니다. 무료 플랜이면 2번 표를 참고해 주기를 조정합니다.
5. Settings에서 Node.js 버전이 지원 중인지 확인합니다.

### 4-3. OpenAI
1. 새 API 키를 발급하고, 크레딧 충전과 월 사용 한도를 설정합니다.
2. `gpt-4o-mini`, `text-embedding-3-small`이 아직 제공되는지 확인합니다. 단종됐다면 아래 파일의 모델명을 바꿉니다.
   - `src/app/api/admin/summarize/route.ts`
   - `src/app/api/chat/route.ts`
   - `src/app/api/admin/embed/route.ts`
3. 임베딩 모델을 바꾸면 벡터 차원(현재 1536)이 달라질 수 있어 DB 컬럼 변경과 문서 임베딩 재생성이 필요합니다.

---

## 5. 코드·의존성 점검

1. `npm run audit:check`로 보안 취약점을 확인하고 보안 업데이트만 먼저 적용합니다.
2. Next.js·Supabase·AI SDK 메이저 업그레이드는 서비스를 연 뒤 여유 있을 때 따로 합니다.
3. 2026-10-13에 교육 모듈(edu)과 보건복지부 주간업무보고(moh) 코드를 지웠습니다. 그 시점의 코드(미커밋 작업 포함)는 GitHub 보관 브랜치 `archive/edu-moh-2026-10-13`에 있습니다. main에 병합하지 않은 별도 브랜치입니다. 작년 운영 DB에는 `moh_weekly_reports` 테이블과 `moh_editor`·`ministry_viewer` 역할이 남아 있었습니다.

---

## 6. 코드에서 연도·일정을 바꿔야 하는 곳

2026년 사업에 맞춘 날짜와 문구가 코드에 직접 들어가 있습니다.

| 무엇 | 파일 | 현재 값 | 할 일 |
|---|---|---|---|
| **마감 공지 팝업** | `src/components/layout/ClosureNoticeModal.tsx` (`src/app/(app)/layout.tsx`에서 사용) | `11월 1주(11.2.~11.9.)` 마감 안내, 접속마다 표시 | **반드시 제거하거나 숨김** (안 그러면 첫 화면에 작년 마감 공지가 뜸) |
| **공휴일 목록** | `src/lib/holidays.ts` | 2025~2026년만 있음 | **새 연도 공휴일 추가 필수** (주차·마감 계산에 사용) |
| 보고서 제목 | `src/app/(app)/admin/reports/page.tsx` (약 252행) | `2026년 의료AI 보건의료인 직무교육사업 주간 실적보고` | 연도·사업명 수정 |
| Word 다운로드 제목 | `src/app/api/admin/ai-reports/word/route.ts` (약 252행) | 위와 같음 | 연도·사업명 수정 |
| 요약 화면 기본 연도 | `src/app/(app)/admin/reports/page.tsx` (약 115행) | `useState(2026)` | 새 연도로 |
| 연도 선택 목록 | `admin/reports/page.tsx` (약 637행), `src/app/(app)/reports/ReportForm.tsx` (약 1286행) | `[2024, 2025, 2026, 2027]` | 새 연도 포함 |
| 예산 집행 추계 시작 주차 | `src/app/(app)/reports/report-types.ts` (`BUDGET_FORECAST_START`) | `'2026-10-12'` | 새 일정에 맞게 변경 |
| 사업 종료일 문구 `~11.30.` | `reports/BudgetForecastTable.tsx`, `reports/ReportForm.tsx`, `reports/report-types.ts`, `src/app/(print)/weekly-summary/[id]/bulk-print/page.tsx`, `src/lib/reportDownload.ts` | `예상 집행금액 (~11.30.)` | 새 종료일로 (상수 하나로 묶으면 다음부터 편함) |
| LMS 최종 확인 팝업 | `src/app/(app)/reports/LmsCheckNoticeModal.tsx` (`LMS_CHECK_NOTICE_WEEK`) | `'2026-11-02'`, 본문 `11월 6일까지` | 새 마지막 주차로 바꾸거나 비활성화 |
| 예산 비목 | `report-types.ts` (`BUDGET_CATEGORIES`) | 인건비·운영비·여비·업무추진비 | 바뀌었으면 수정 |
| AI 요약 프롬프트 | `src/app/api/admin/summarize/route.ts` | "사업종료일까지 집행 추계" 문구 | 양식이 바뀌면 함께 수정 |
| 일정 가져오기 예시 | `src/app/(app)/calendar/ImportModal.tsx` | 예시 날짜 `2026-06-10` 등 | 선택 사항 |

> 이 목록은 2026-11-23에 `2026`, `11.30`, `11월`로 코드를 검색해 만들었습니다. 재오픈 때 같은 검색을 다시 해서 빠진 곳이 없는지 확인하세요.

---

## 7. 데이터 정리와 오픈 전 확인

### 새 사업 연도 데이터
- 작년 리포트를 남길지(연도로 구분), 지울지 정합니다.
- 기관(organizations) 추가·삭제·이름 변경을 반영합니다.
- 사용자 계정: 담당자 변경을 반영하고 비밀번호 재설정을 안내합니다.
- 작년 공지·캘린더 일정을 정리합니다.
- AI 참고 문서를 올해 사업 지침서로 바꿉니다.

### 오픈 전 최종 확인
- [ ] 관리자·기관 사용자 계정으로 각각 로그인
- [ ] 주간 리포트 작성 → 첨부 업로드 → 제출 → 관리자 승인
- [ ] 관리자 주간 요약 생성(AI) 및 Word·인쇄 다운로드
- [ ] AI 챗봇이 올해 참고 문서로 답변
- [ ] 푸시 알림 수신 (리포트 독촉 크론을 수동 호출해 확인)
- [ ] 첫 화면에 작년 마감 공지·LMS 팝업이 뜨지 않음
- [ ] 주차 계산에 새 연도 공휴일 반영
- [ ] 사용자에게 재오픈 공지와 비밀번호 재설정 안내
