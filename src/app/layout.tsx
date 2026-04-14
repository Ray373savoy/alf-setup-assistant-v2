import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import SessionProvider from "@/components/auth/SessionProvider";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "チャネルトークタスクビルダー",
  description: "Channel Talk ALF Task設計を支援するWebアプリ",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="ja">
      <body>
        <SessionProvider>
          {session ? (
            <div className="app-layout">
              <Sidebar />
              <main className="main-content">{children}</main>
            </div>
          ) : (
            children
          )}
        </SessionProvider>
      </body>
    </html>
  );
}
