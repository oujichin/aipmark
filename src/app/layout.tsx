import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIPmark5 - プライバシーマーク管理システム",
  description: "個人情報保護マネジメントシステム（PMS）管理プラットフォーム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
