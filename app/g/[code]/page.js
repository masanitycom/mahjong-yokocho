import Yokocho from '../../../components/Yokocho';
export const metadata = { title: 'グループへの招待｜麻雀横丁', description: 'タップしてグループに参加' };
export default async function Page({ params }) {
  const { code } = await params;
  return <Yokocho route={{ kind: 'group', code: String(code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) }} />;
}
