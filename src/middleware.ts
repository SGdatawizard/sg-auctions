import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the Supabase auth token cookie
  const authCookie =
    request.cookies.get("sb-access-token") ??
    request.cookies.getAll().find((c) => c.name.includes("auth-token"));

  const isAuthPage = pathname.startsWith("/login");
  const isDashboard = pathname.startsWith("/dashboard");

  // If trying to access dashboard with no cookie, send to login
  if (isDashboard && !authCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If on login page with a cookie, send to dashboard
  if (isAuthPage && authCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
