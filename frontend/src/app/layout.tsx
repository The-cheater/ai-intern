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
  title: "Examiney.AI | AI Interview Platform",
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
        {/* Desktop-only enforcement — block mobile/tablet access */}
        <div className="hidden max-[1023px]:flex fixed inset-0 z-[9999] bg-[#f5f1eb] flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-8">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6C63FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
            </svg>
          </div>
          <h1 style={{fontFamily:"serif"}} className="text-3xl font-bold mb-4 tracking-tight">Desktop Required</h1>
          <p className="text-gray-500 text-base max-w-xs leading-relaxed">
            This platform is designed for desktop use only. Please open it on a laptop or desktop computer with a screen width of at least 1024px.
          </p>
        </div>
        <div className="max-[1023px]:hidden">
          {children}
        </div>
      </body>
    </html>
  );
}

