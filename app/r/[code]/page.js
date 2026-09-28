import Yokocho from '../../../components/Yokocho';
export async function generateMetadata({ params }) {
  const { code } = await params;
  return { title: `卓番号 ${code}｜麻雀横丁`, description: 'タップして卓に参加' };
}
export default async function Page({ params }) {
  const { code } = await params;
  return <Yokocho route={{ kind: 'room', code: String(code).replace(/\D/g, '').slice(0, 4) }} />;
}
