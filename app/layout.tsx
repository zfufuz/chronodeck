import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    metadataBase: new URL(origin),
    title: "时序舱 · ChronoDeck",
    description: "看见时间，重组节奏。一个兼顾计划、容量与专注的个人时间操作系统。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "时序舱 · ChronoDeck",
      description: "看见时间，重组节奏。",
      url: origin,
      siteName: "时序舱",
      locale: "zh_CN",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "时序舱个人时间操作系统" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "时序舱 · ChronoDeck",
      description: "看见时间，重组节奏。",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
