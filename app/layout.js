import './globals.css';

const site = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

export const metadata = {
  metadataBase: new URL(site),
  title: '麻雀横丁',
  description: '仲間内で打てる4人打ち麻雀。部屋を立ててLINEで招待、成績はグループごとに記録。',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: '麻雀横丁', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  openGraph: { title: '麻雀横丁', description: '仲間内で打てる4人打ち麻雀', images: ['/og.png'] }
};
export const viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover', themeColor: '#07090b'
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;700;800&family=Barlow+Condensed:wght@600;700&family=Yuji+Boku&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
