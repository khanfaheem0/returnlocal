import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const beVietnamPro = Be_Vietnam_Pro({
  weight: ["300", "400", "500", "600"],
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReturnLocal",
  description: "Local returns, verified handoffs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${beVietnamPro.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col font-body bg-surface text-on-surface">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
