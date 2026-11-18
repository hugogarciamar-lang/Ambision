import type { Metadata, Viewport } from "next";
import { Onest, Geist_Mono } from "next/font/google";
import "./globals.css";

const onest = Onest({ subsets: ["latin"], variable: "--font-onest", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "VoxLayer — A computer you can use with no screen and no keyboard",
  description:
    "VoxLayer turns any Windows, macOS or Linux machine into a voice-and-sound system, so people who can’t see or touch it can work completely on their own.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${onest.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
