import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";

const display = Montserrat({ variable: "--font-display", subsets: ["latin"], weight: ["700", "800"] });
const body = Inter({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Charleville LTC American Doubles",
  description: "Rounds, partners and rankings for American doubles nights at Charleville Lawn Tennis Club.",
  icons: { icon: "/crest.webp", apple: "/crest.webp" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IE">
      <body className={`${display.variable} ${body.variable} min-h-dvh antialiased`}>{children}</body>
    </html>
  );
}
