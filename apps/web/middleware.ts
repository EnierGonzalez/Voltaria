import { NextResponse, type NextRequest } from "next/server";

const publicPrefixes = [
  "/_next",
  "/api/health",
  "/api/db-health",
  "/api/config-health",
  "/api/rfid/event"
];

const publicPaths = ["/favicon.ico", "/manifest.webmanifest", "/robots.txt"];

export function middleware(request: NextRequest) {
  if (process.env.STAGING_ACCESS_ENABLED !== "true") {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const username = process.env.STAGING_ACCESS_USERNAME?.trim();
  const password = process.env.STAGING_ACCESS_PASSWORD?.trim();

  if (!username || !password || password === "change-me") {
    return new NextResponse("Staging access is not configured.", { status: 503 });
  }

  const authorization = request.headers.get("authorization");

  if (!isAuthorized(authorization, username, password)) {
    return new NextResponse("Authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Voltaria Staging"'
      }
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.).*)", "/api/:path*"]
};

function isPublicPath(pathname: string) {
  return publicPaths.includes(pathname) || publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isAuthorized(authorization: string | null, username: string, password: string) {
  if (!authorization?.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = atob(authorization.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return false;
    }

    const suppliedUsername = decoded.slice(0, separatorIndex);
    const suppliedPassword = decoded.slice(separatorIndex + 1);

    return constantTimeEqual(suppliedUsername, username) && constantTimeEqual(suppliedPassword, password);
  } catch {
    return false;
  }
}

function constantTimeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
}
