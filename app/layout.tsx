import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '对照 · 文档 AI 评测台',
  description: '匿名评分、方案对比与可追溯的评测报告。',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
