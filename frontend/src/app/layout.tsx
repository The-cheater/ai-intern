import type { Metadata } from "next";
import { Inter, Outfit, Geist } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-satoshi",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-cal",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-matter",
});


export const metadata: Metadata = {
  title: "Vidya AI | AI Interview Platform",
  description: "Advanced AI-powered interview platform for modern recruiters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable} ${geist.variable} font-body bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  );
}

