import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIPmark - Pマーク取得支援AI",
  description: "AIエージェントによるPマーク取得支援システム",
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
