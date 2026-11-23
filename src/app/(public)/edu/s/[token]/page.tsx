import SurveyEntry from './SurveyEntry'

export default async function SurveyEntryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SurveyEntry token={token} />
}
