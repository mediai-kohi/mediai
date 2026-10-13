import { BudgetForecastCategory, buildForecastRows, buildBalancePlanRows, fmtAmount, fmtShare } from './report-types'

// 예산 집행 추계 읽기 전용 표 (미리보기·상세 공용). th/td는 화면별 셀 스타일
export default function BudgetForecastTable({
  forecast,
  th,
  td,
}: {
  forecast: BudgetForecastCategory[]
  th: string
  td: string
}) {
  const rows = buildForecastRows(forecast)
  const plans = buildBalancePlanRows(forecast)
  const num = `${td} text-right tabular-nums`
  const remaining = (n: number, hasValue: boolean) => (hasValue ? n.toLocaleString('ko-KR') : '—')

  return (
    <>
    <table className="w-full border-collapse text-xs min-w-[620px]">
      <thead>
        <tr>
          <th rowSpan={2} className={`${th} w-20`}>비목</th>
          <th rowSpan={2} className={th}>세목</th>
          <th rowSpan={2} className={th}>예산</th>
          <th colSpan={3} className={th}>집행 추계</th>
          <th rowSpan={2} className={th}>예상 잔액</th>
        </tr>
        <tr>
          <th className={th}>국고보조금</th>
          <th className={th}>자기부담금</th>
          <th className={th}>소계</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const hasValue = !!(r.budget || r.subtotal)
          const negative = r.remaining < 0 ? ' text-red-600' : ''
          if (r.kind === 'item') {
            return (
              <tr key={i}>
                {r.categoryRowSpan > 0 && (
                  <td rowSpan={r.categoryRowSpan} className={`${th} font-medium align-middle`}>{r.category}</td>
                )}
                <td className={td}>{r.name || '—'}</td>
                <td className={num}>{fmtAmount(r.budget)}</td>
                <td className={num}>{fmtAmount(r.gov)}</td>
                <td className={num}>{fmtAmount(r.self)}</td>
                <td className={num}>{fmtAmount(r.subtotal)}</td>
                <td className={`${num}${negative}`}>{remaining(r.remaining, hasValue)}</td>
              </tr>
            )
          }
          const isTotal = r.kind === 'total'
          const tone = isTotal ? ' bg-blue-50 font-semibold text-blue-700' : ' bg-gray-50 font-semibold'
          return (
            <tr key={i}>
              {isTotal ? (
                <td colSpan={2} className={`${th} font-bold text-blue-700`}>총 합계</td>
              ) : (
                <>
                  {r.showCategory && <td className={`${th} font-medium align-middle`}>{r.category}</td>}
                  <td className={`${td} bg-gray-50 font-semibold`}>합계</td>
                </>
              )}
              <td className={`${num}${tone}`}>{fmtAmount(r.budget)}</td>
              <td className={`${num}${tone}`}>{fmtAmount(r.gov)}{isTotal && fmtShare(r.gov, r.subtotal)}</td>
              <td className={`${num}${tone}`}>{fmtAmount(r.self)}{isTotal && fmtShare(r.self, r.subtotal)}</td>
              <td className={`${num}${tone}`}>{fmtAmount(r.subtotal)}</td>
              <td className={`${num}${tone}${negative}`}>{remaining(r.remaining, hasValue)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
    {plans.length > 0 && (
      <table className="w-full border-collapse text-xs min-w-[620px] mt-2">
        <thead>
          <tr>
            <th colSpan={5} className={th}>예상 잔액 처리계획</th>
          </tr>
          <tr>
            <th className={`${th} whitespace-nowrap`}>비목</th>
            <th className={`${th} whitespace-nowrap`}>세목</th>
            <th className={`${th} whitespace-nowrap`}>예상 잔액</th>
            <th className={`${th} whitespace-nowrap`}>처리 방법</th>
            <th className={`${th} w-full`}>세부내용</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p, i) => (
            <tr key={i}>
              <td className={`${th} font-medium whitespace-nowrap`}>{p.category}</td>
              <td className={`${td} whitespace-nowrap`}>{p.name || '—'}</td>
              <td className={num}>{p.remaining.toLocaleString('ko-KR')}</td>
              <td className={`${td} text-center whitespace-nowrap`}>{p.method || '—'}</td>
              <td className={`${td} whitespace-pre-wrap`}>{p.detail || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
    </>
  )
}
