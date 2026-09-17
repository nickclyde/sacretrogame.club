import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Pixelify_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const body = Atkinson_Hyperlegible({ variable: "--font-body", weight: ["400", "700"], subsets: ["latin"] });
const pixel = Pixelify_Sans({ variable: "--font-pixel", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sac Retro Game Club",
  description: "Help pick when and where the Sac Retro Game Club meets.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${pixel.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[17px] leading-relaxed">
        <header className="border-b-[3px] border-ink bg-purple text-white">
          <div className="mx-auto flex max-w-3xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3">
            <Link href="/" className="font-pixel text-2xl">
              Sac Retro Game Club
            </Link>
            <nav className="flex gap-5 font-pixel text-lg">
              <Link href="/meeting-vote" className="underline-offset-4 hover:underline">Vote</Link>
              <Link href="/results" className="underline-offset-4 hover:underline">Results</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">{children}</main>
      </body>
    </html>
  );
}
