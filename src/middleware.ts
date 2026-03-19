export { edgeAuth as middleware } from "@/lib/auth-edge";

export const config = {
  matcher: [
    "/((?!api/auth|api/health|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
