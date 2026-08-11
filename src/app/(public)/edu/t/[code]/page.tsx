import Certificate from './Certificate'

export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <Certificate code={code} />
}
