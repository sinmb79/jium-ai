import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "지움AI",
  description: "비용 없이 시작하는 로컬 우선 디지털 권리구제 도우미",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
