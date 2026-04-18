import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
	// Check cookie for optimistic redirects for protected routes
	// Use getSession in your RSC to protect a route via SSR or useAuthenticate client side
	const sessionCookie = getSessionCookie(request);

	if (!sessionCookie) {
		const redirectTo = request.nextUrl.pathname + request.nextUrl.search;
		return NextResponse.redirect(
			new URL(`/auth/sign-in?redirectTo=${redirectTo}`, request.url),
		);
	}

	return NextResponse.next();
}

export const config = {
	// Protected routes
	matcher: ["/account/settings"],
};
