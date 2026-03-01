import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { FeedbackWidget } from "@/components/feedback-widget";
import { getActiveUser } from "@/lib/active-user";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WalletLens",
  description: "Personal finance dashboard — track spending, investments, and net worth from bank statements",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const activeUser = await getActiveUser();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex h-screen">
          <Sidebar
            activeUser={
              activeUser
                ? {
                    id: activeUser.id,
                    name: activeUser.name,
                    avatarColor: activeUser.avatarColor,
                  }
                : null
            }
          />
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
          <FeedbackWidget />
        </div>
      </body>
    </html>
  );
}
