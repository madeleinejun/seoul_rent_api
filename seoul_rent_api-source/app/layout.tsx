import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "서울 전월세 2026 | 동별 실거래 조회",
  description: "서울 자치구와 동을 선택해 2026년 전월세 실거래 신고 데이터를 확인합니다.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
