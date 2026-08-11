import SurveyForm from './SurveyForm'

export default async function SurveyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <SurveyForm code={code} />
}
