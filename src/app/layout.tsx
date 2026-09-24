import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Pixelify_Sans } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { votingIsClosed } from "@/data/polls";
import { getUser } from "@/lib/auth/session";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const body = Atkinson_Hyperlegible({ variable: "--font-body", weight: ["400", "700"], subsets: ["latin"] });
const pixel = Pixelify_Sans({ variable: "--font-pixel", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sac Retro Game Club",
  description: "A community for retro gaming fans in Sacramento and beyond. We meet up once a month.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    // The head script sets data-theme before React hydrates, hence suppressHydrationWarning.
    <html lang="en" className={`${body.variable} ${pixel.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans text-[17px] leading-relaxed">
        <header className="border-b-[3px] border-ink bg-brand text-white">
          <div className="mx-auto flex max-w-3xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3">
            <Link href="/" className="font-pixel text-2xl">
              Sac Retro Game Club
            </Link>
            <nav className="flex flex-wrap gap-x-5 font-pixel text-lg">
              {!votingIsClosed() && <Link href="/meeting-vote" className="underline-offset-4 hover:underline">Vote</Link>}
              <Link href="/game-of-the-month" className="underline-offset-4 hover:underline">Game of the month</Link>
              {user ? (
                <Link href="/account" className="max-w-[12ch] truncate underline-offset-4 hover:underline">
                  {user.displayName || "Account"}
                </Link>
              ) : (
                <Link href="/sign-in" className="underline-offset-4 hover:underline">Sign in</Link>
              )}
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">{children}</main>
      </body>
    </html>
  );
}
