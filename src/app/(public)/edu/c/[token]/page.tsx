import CheckinForm from './CheckinForm'

export default async function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <CheckinForm token={token} />
}
