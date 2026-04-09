"use client";

import { useT } from "@/lib/i18n";
import SignInButton from "./SignInButton";

export default function LoginCard() {
  const t = useT();

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-icon">ALF</span>
        </div>
        <h1 className="login-title">{t.login.title}</h1>
        <p className="login-description">{t.login.description}</p>
        <SignInButton />
      </div>
    </div>
  );
}
