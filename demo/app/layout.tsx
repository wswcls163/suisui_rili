import type { Metadata } from 'next';
import './globals.css';
import './calendar.css';

export const metadata: Metadata = {
  title: '岁岁日历 · 农历月历',
  description:
    '记住亲友的农历生日。体验生日管理、逐年日期换算和当天提醒的交互演示。',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
