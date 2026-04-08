import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/api/auth")
  );
}

export default async function middleware(req: NextRequest) {
  // Public paths are always accessible
  if (isPublicPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  try {
    const session = await auth();
    if (!session) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  } catch {
    // If auth() fails (e.g. missing env vars), block access
    return NextResponse.redirect(new URL("/", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
