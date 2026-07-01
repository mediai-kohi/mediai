# 계정 변경 마이그레이션 계획

작성일: 2026-06-24

## 현재 구조

```
GitHub (k2silver39-spec/eduops)
  └─ Vercel (mediai-kohi.vercel.app)
       └─ 환경변수 → Supabase, OpenAI, VAPID
Supabase (gqldyiawpbszocfmdpiz)
  ├─ Auth 사용자
  ├─ DB 테이블 (보고서, 문의, 조직, 이벤트 등)
  ├─ Storage (첨부파일)
  └─ pgvector 임베딩 (AI 문서)
```

---

## Phase 1 — 신규 계정 준비 (다운타임 없음)

### 1-1. GitHub 저장소 이전

새 GitHub 계정/조직에서 신규 저장소 생성 후 전체 히스토리 push.

```bash
git remote add new-origin <새_저장소_URL>
git push new-origin main --tags
```

구 저장소는 이전 완료 확인 후 삭제.

### 1-2. OpenAI 신규 API 키 발급

새 계정에서 API 키 생성 후 메모. 코드 변경 없음 — 환경변수만 교체.

### 1-3. 새 Supabase 프로젝트 생성

- 새 계정에서 프로젝트 생성
- 지역을 기존과 동일하게 설정
- URL / ANON KEY / SERVICE ROLE KEY 메모

### 1-4. 새 Vercel 계정 생성 + 신규 GitHub 연결

- 새 Vercel 계정에서 신규 GitHub 저장소를 연결해 프로젝트 생성
- 환경변수는 Phase 3에서 일괄 입력

---

## Phase 2 — Supabase 데이터 마이그레이션

> 가장 복잡한 단계. 순서를 반드시 지킬 것.

### 2-1. 스키마 복제

새 프로젝트 SQL Editor에서 아래 순서대로 실행.

```
1.  supabase-schema.sql
2.  reports-schema.sql
3.  reports-schema-v2.sql
4.  admin-schema.sql
5.  ai-qa-schema.sql
6.  attachments-schema.sql
7.  reports-approval-migration.sql
8.  reports-dedup-migration.sql
9.  agency-type-migration.sql
10. privacy-consent-migration.sql
11. multimodal-migration.sql
12. weekly-summaries.sql
13. supabase/migrations/ 전체 (파일명 날짜순)
14. organizations-setup.sql
15. user-deletion-data-retention.sql
```

### 2-2. 테이블 데이터 복사

Supabase Dashboard → Table Editor에서 CSV export / import.

복사 우선순위:
```
profiles
reports → weekly_summaries
inquiries → inquiry_replies
events → notices
documents
notifications → admin_notifications
organizations
audit_log → login_attempt_log
push_subscriptions  (VAPID 키 동일 유지 시에만 의미 있음)
```

### 2-3. Storage 첨부파일 마이그레이션

- 구 프로젝트 Storage 버킷에서 파일 다운로드
- 새 프로젝트 동일 버킷명으로 업로드
- DB의 `storage_path` 컬럼 값은 경로 구조가 같으므로 그대로 유지

### 2-4. Auth 사용자 마이그레이션 ⚠️

Supabase Auth의 비밀번호 해시는 직접 복사 불가.

**선택 A (권장)**: Supabase 지원팀에 `auth.users` 덤프 전달 요청
- dashboard.supabase.com → Support 티켓 생성
- 구 프로젝트 ref(`gqldyiawpbszocfmdpiz`)와 새 프로젝트 ref 명시

**선택 B**: 전환 후 전체 사용자에게 비밀번호 재설정 안내

### 2-5. pgvector 임베딩 재생성

문서 임베딩 벡터는 OpenAI API 키가 바뀌면 재생성 필요.
전환 후 관리자 페이지 `/admin/documents` → 임베딩 재생성 실행.

---

## Phase 3 — 환경변수 일괄 교체

새 Vercel 프로젝트에 아래 환경변수 설정.

| 변수명 | 값 |
|--------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | 새 Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 새 anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 새 service role key |
| `OPENAI_API_KEY` | 새 OpenAI key |
| `NEXT_PUBLIC_APP_URL` | 새 배포 URL |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 재생성값 |
| `VAPID_PRIVATE_KEY` | 재생성값 |
| `VAPID_SUBJECT` | 새 관리자 이메일 |
| `CRON_SECRET` | 신규 발급 (랜덤 문자열) |

**VAPID 키 재생성 명령어:**
```bash
npx web-push generate-vapid-keys
```

> VAPID 키를 새로 생성하면 기존 사용자 푸시 구독이 무효화됨.
> 전환 후 DB `push_subscriptions` 테이블 전체 삭제 → 사용자가 마이페이지에서 재구독.

**CRON_SECRET 생성 예시:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Phase 4 — 전환 (다운타임 최소화)

1. **사전 공지**: 사용자에게 점검 시간(30분) 안내
2. **구 시스템 잠금**: Vercel 환경변수에 `MAINTENANCE=true` 추가 또는 로그인 일시 차단
3. **최종 데이터 복사**: 점검 직전 변경분 incremental 복사
4. **새 Vercel 첫 배포**: `vercel --prod` 실행
5. **도메인 전환**:
   - 커스텀 도메인이 있는 경우 → DNS를 새 Vercel로 변경
   - 없는 경우 → 새 `.vercel.app` URL 사용자에게 안내
6. **동작 확인 후 구 서비스 종료**

---

## 위험 요소 및 대응

| 항목 | 위험 수준 | 대응 방안 |
|------|---------|----------|
| Auth 사용자 비밀번호 이전 | 높음 | Supabase 지원 요청 또는 전체 재설정 안내 |
| 푸시 구독 무효화 | 중간 | VAPID 키 동일 유지하거나 재구독 안내 |
| AI 임베딩 벡터 손실 | 낮음 | 전환 후 관리자 페이지에서 재생성 |
| 점검 중 데이터 누락 | 낮음 | 전환 직전 최종 incremental 복사로 최소화 |

---

## 체크리스트

### Phase 1
- [ ] 신규 GitHub 저장소 생성 및 코드 push 완료
- [ ] 신규 OpenAI API 키 발급
- [ ] 신규 Supabase 프로젝트 생성 (키 3종 메모)
- [ ] 신규 Vercel 프로젝트 생성 및 GitHub 연결

### Phase 2
- [ ] 스키마 SQL 순서대로 실행 완료
- [ ] 주요 테이블 데이터 복사 완료
- [ ] Storage 파일 마이그레이션 완료
- [ ] Auth 사용자 이전 방식 결정 및 완료

### Phase 3
- [ ] VAPID 키 신규 생성
- [ ] CRON_SECRET 신규 생성
- [ ] Vercel 환경변수 전체 입력 완료

### Phase 4
- [ ] 사용자 점검 공지 완료
- [ ] 최종 데이터 복사 완료
- [ ] 새 Vercel 배포 및 정상 동작 확인
- [ ] 도메인/URL 전환 완료
- [ ] push_subscriptions 테이블 초기화
- [ ] AI 임베딩 재생성 완료
- [ ] 구 서비스 종료
