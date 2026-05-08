import type { GenericEndpointContext } from "better-auth";
import {
	APIError,
	createAuthEndpoint,
	getSessionFromCtx,
	originCheck,
} from "better-auth/api";
import type { UserWithRole } from "better-auth/plugins";
import * as z from "zod";
import { getInviteAdapter } from "../adapter";
import {
	ERROR_CODES,
	fullDefaultRedirectAfterUpgrade,
	INVITE_COOKIE_NAME,
} from "../constants";
import type { NewInviteOptions } from "../types";
import { consumeInvite, getMaxUses } from "../utils";

export const activateInvite = (options: NewInviteOptions) => {
	return createAuthEndpoint(
		"/invite/activate",
		{
			method: "POST",
			use: [
				originCheck((ctx) => ctx.body.callbackUrl),
				originCheck((ctx) => ctx.body.signInUpUrl),
			],
			body: z.object({
				/**
				 * Where to redirect the user after activating the invite.
				 * {token} will be replaced by the actual token in the request body.
				 *
				 * @default http://localhost:3000/
				 */
				callbackUrl: z
					.string()
					.describe(
						"Where to redirect the user after activating the invite. {token} will be replaced by the actual token in the request body.",
					)
					.default(fullDefaultRedirectAfterUpgrade),
				/**
				 * Where to redirect the user to sign in/up.
				 * {callbackUrl} will be replaced by the actual callbackUrl in the request body.
				 */
				signInUpUrl: z
					.string()
					.describe("The URL of the sign in/up page.")
					.optional(),
				/**
				 * The invite token.
				 */
				token: z.string().describe("The invite token"),
				/**
				 * The email address of the user to sign in/up to.
				 */
				email: z
					.email()
					.optional()
					.describe("The email address of the user to sign in/up to"),
			}),
			metadata: {
				openapi: {
					operationId: "activateInvite",
					description:
						"Redirects the user to the callback URL with the token in a cookie",
					responses: {
						"200": {
							description: "Invite activated successfully",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											status: { type: "boolean", example: true },
											message: {
												type: "string",
												example: "Invite activated successfully",
											},
											action: {
												type: "string",
												example: "SIGN_IN_UP_REQUIRED",
											},
											email: {
												type: "string",
												example: "user@example.com",
											},
											redirectTo: {
												type: "string",
												example: "/auth/sign-in",
											},
										},
										required: ["status", "message"],
									},
								},
							},
						},
						"400": {
							description: "Invalid or expired invite token",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											errorCode: { type: "string", example: "INVALID_TOKEN" },
											message: { type: "string" },
										},
									},
								},
							},
						},
						"500": {
							description: "Internal server error",
						},
					},
				},
			},
		},
		(ctx) => {
			return activateInviteLogic(options, ctx, ctx.body);
		},
	);
};

/**
 * Handles the invite activation flow.
 *
 * - Makes sure the invite is valid (exists, not expired, not overused)
 * - If the user is logged in => consumes the invite
 * - If not => stores the token and redirects to sign in/up
 */
export const activateInviteLogic = async (
	options: NewInviteOptions,
	ctx: GenericEndpointContext,
	body: {
		token: string;
		callbackUrl: string;
		email?: string;
		signInUpUrl?: string;
	},
) => {
	const adapter = getInviteAdapter(ctx.context, options);

	// Find the invitation
	const invitation = await adapter.findInvitation(body.token);
	if (!invitation) {
		throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_TOKEN);
	}

	const maxUses = getMaxUses(invitation);
	const timesUsed = await adapter.countInvitationUses(invitation.id);

	// Check if the invite was already fully used
	if (timesUsed >= maxUses) {
		throw APIError.from(
			"BAD_REQUEST",
			ERROR_CODES.INVITE_TOKEN_HAS_ALREADY_BEEN_USED,
		);
	}

	// Check if the invite expired
	if (options.getDate() > invitation.expiresAt) {
		throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_OR_EXPIRED_INVITE);
	}

	// Get current session and user
	const sessionData = await getSessionFromCtx(ctx);
	const session = sessionData?.session;
	let user = sessionData?.user as UserWithRole | null;

	// If the user is already logged in, accept the invite
	if (user && session) {
		const before = await options.inviteHooks?.beforeAcceptInvite?.({
			ctx,
			invitedUser: user,
		});

		if (before?.user) user = before.user;

		// Consume the invite (update role, refresh session, etc)
		await consumeInvite({
			ctx,
			invitation,
			invitedUser: user,
			session,
			options,
			adapter,
			meta: {
				userId: user.id,
				token: body.token,
				timesUsed,
				newAccount: false,
			},
		});

		await options.inviteHooks?.afterAcceptInvite?.({
			ctx,
			invitation,
			invitedUser: user,
		});

		return ctx.json({
			status: true,
			message: "Invite activated successfully",
			action: "REDIRECT_TO_AFTER_UPGRADE",
			redirectTo: body.callbackUrl?.replace("{token}", invitation.token),
		});
	}

	// If not logged in, store the token and ask the user to sign in/up
	const maxAge = options.inviteCookieMaxAge ?? 10 * 60;

	const cookie = ctx.context.createAuthCookie(INVITE_COOKIE_NAME, { maxAge });

	await ctx.setSignedCookie(
		cookie.name,
		JSON.stringify({ token: body.token, callbackUrl: body.callbackUrl }),
		ctx.context.secret,
		cookie.attributes,
	);

	const redirectTo = (
		body.signInUpUrl ?? options.defaultRedirectToSignIn
	).replace("{callbackUrl}", body.callbackUrl ?? "");

	return ctx.json({
		status: true,
		message: "Please sign in or sign up to continue.",
		action: "SIGN_IN_UP_REQUIRED",
		redirectTo,
		email: body.email,
	});
};
