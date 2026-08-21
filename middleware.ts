import { NextRequest, NextResponse } from "next/server";
export function middleware(request: NextRequest) { const path = request.nextUrl.pathname; const publicPath = path.startsWith("/login") || path.startsWith("/api/auth/"); if (!publicPath && !path.startsWith("/api/") && !request.cookies.has("vase-crm-session")) return NextResponse.redirect(new URL("/login", request.url)); return NextResponse.next(); }
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
