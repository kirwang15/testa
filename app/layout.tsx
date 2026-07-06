import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Word Trail MVP",
  description: "A small English word fill puzzle MVP."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
