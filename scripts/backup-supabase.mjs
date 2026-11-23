// Supabase 프로젝트 데이터 백업 (service_role 키로 REST/Storage API를 직접 호출).
// 스키마(DDL)는 supabase/migrations/*.sql로 이미 git에 백업되어 있으므로,
// 이 스크립트는 "데이터"(테이블 로우 + Storage 파일)만 로컬에 받아둔다.
// DB 접속 비밀번호나 `supabase login` 없이, .env.local의 service_role 키만으로 동작한다.
//
// 사용법:
//   node scripts/backup-supabase.mjs
//   (다른 프로젝트를 백업하려면 SUPABASE_BACKUP_URL / SUPABASE_BACKUP_SERVICE_KEY로 override)

import fs from 'node:fs'
import path from 'node:path'

const SUPABASE_URL = process.env.SUPABASE_BACKUP_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_BACKUP_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[backup] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다 (.env.local 확인).')
  process.exit(1)
}

const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const outDir = path.join('backups', timestamp)
fs.mkdirSync(outDir, { recursive: true })

async function listTables() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers })
  if (!res.ok) throw new Error(`스키마 조회 실패: ${res.status}`)
  const spec = await res.json()
  return Object.keys(spec.definitions || {}).sort()
}

async function dumpTable(table) {
  const rows = []
  const pageSize = 1000
  let offset = 0
  for (;;) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${offset}`,
      { headers }
    )
    if (!res.ok) {
      console.warn(`  [skip] ${table}: HTTP ${res.status}`)
      return null
    }
    const batch = await res.json()
    rows.push(...batch)
    if (batch.length < pageSize) break
    offset += pageSize
  }
  fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2))
  return rows.length
}

async function listBuckets() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, { headers })
  if (!res.ok) return []
  return res.json()
}

async function walkBucket(bucketId, bucketDir, prefix) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucketId}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  })
  if (!res.ok) return 0
  const items = await res.json()
  let count = 0
  for (const item of items) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id == null) {
      count += await walkBucket(bucketId, bucketDir, itemPath)
      continue
    }
    const fileRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucketId}/${itemPath}`, { headers })
    if (!fileRes.ok) {
      console.warn(`  [skip file] ${bucketId}/${itemPath}: HTTP ${fileRes.status}`)
      continue
    }
    const buf = Buffer.from(await fileRes.arrayBuffer())
    const localPath = path.join(bucketDir, itemPath)
    fs.mkdirSync(path.dirname(localPath), { recursive: true })
    fs.writeFileSync(localPath, buf)
    count += 1
  }
  return count
}

async function dumpBucket(bucket) {
  const bucketDir = path.join(outDir, 'storage', bucket.name)
  fs.mkdirSync(bucketDir, { recursive: true })
  return walkBucket(bucket.id, bucketDir, '')
}

async function main() {
  console.log(`[backup] target: ${SUPABASE_URL}`)
  console.log(`[backup] output: ${outDir}`)

  const tables = await listTables()
  console.log(`[backup] ${tables.length} tables found`)
  const tableSummary = {}
  for (const table of tables) {
    const count = await dumpTable(table)
    tableSummary[table] = count
    console.log(`  - ${table}: ${count === null ? 'skipped' : count + ' rows'}`)
  }

  const buckets = await listBuckets()
  console.log(`[backup] ${buckets.length} storage buckets found`)
  const bucketSummary = {}
  for (const bucket of buckets) {
    const fileCount = await dumpBucket(bucket)
    bucketSummary[bucket.name] = fileCount
    console.log(`  - ${bucket.name}: ${fileCount} files`)
  }

  fs.writeFileSync(
    path.join(outDir, '_summary.json'),
    JSON.stringify({ source: SUPABASE_URL, timestamp, tables: tableSummary, buckets: bucketSummary }, null, 2)
  )
  console.log(`[backup] done -> ${outDir}`)
}

main().catch((err) => {
  console.error('[backup] failed:', err)
  process.exit(1)
})
