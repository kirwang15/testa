import type { Metadata } from "next";
import { AppHydrationGate } from "@/components/AppHydrationGate";
import { AppLanguageSync } from "@/components/AppLanguageSync";
import { LANGUAGE_BOOTSTRAP_SCRIPT } from "@/lib/language-bootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "Word Trail · 单词冒险",
  description: "适合 3 岁以上全年龄段的纯本地英语词汇学习与快速估算工具。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANGUAGE_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <AppLanguageSync />
        <AppHydrationGate>{children}</AppHydrationGate>
      </body>
    </html>
  );
}
