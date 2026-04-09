import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginCard from "@/components/auth/LoginCard";

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/steps/input");
  }

  return <LoginCard />;
}
