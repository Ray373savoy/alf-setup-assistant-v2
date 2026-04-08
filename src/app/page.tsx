import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SignInButton from "@/components/auth/SignInButton";

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/steps/input");
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-icon">ALF</span>
        </div>
        <h1 className="login-title">ALF 設計アシスタント</h1>
        <p className="login-description">
          Channel Talk ALF Task 設計を支援する Web アプリ
        </p>
        <SignInButton />
      </div>
    </div>
  );
}
