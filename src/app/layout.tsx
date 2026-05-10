import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GlobalToaster } from "@/components/app/global-toaster";
import { QueryProvider } from "@/components/app/query-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KPlayer Analytics",
  description: "Platform analitik pemain dan klub sepak bola",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        <QueryProvider>
          {children}
          <GlobalToaster />
        </QueryProvider>
      </body>
    </html>
  );
}
