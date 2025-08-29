// app/layout.tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"], // ใช้น้ำหนักได้ครบ
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ikkist's item",
  description: "รวมรีวิวไอเท็ม",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${plex.variable} antialiased min-h-dvh bg-transparent`}>
        {children}
      </body>
    </html>
  );
}
