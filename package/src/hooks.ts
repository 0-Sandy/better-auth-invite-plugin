import type { HookEndpointContext } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { expireCookie } from "better-auth/cookies";
import type { UserWithRole } from "better-auth/plugins";
import * as z from "zod";
import { getInviteAdapter } from "./adapter";
import { ERROR_CODES, INVITE_COOKIE_NAME } from "./constants";
import type { NewInviteOptions } from "./types";
import { consumeInvite, redirectError } from "./utils";

export const invitesHooks = (options: NewInviteOptions) => {
	return {
		after: [
			{
				// Run this after sign in/up and callback endpoints to check for invite tokens
				matcher: (context: HookEndpointContext) =>
					context.path === "/sign-up/email" ||
					context.path === "/sign-in/email" ||
					context.path === "/sign-in/email-otp" ||
					context.path === "/callback/:id" ||
					context.path === "/verify-email",

				handler: createAuthMiddleware(async (ctx) => {
					// Make sure we have a new session with a user
					const validation = z
						.object({
							user: z.object({ id: z.string() }),
						})
						.safeParse(ctx.context.newSession);

					if (!validation.success) return;

					const userId = validation.data.user.id;

					// Load the full user
					let invitedUser = (await ctx.context.internalAdapter.findUserById(
						userId,
					)) as UserWithRole | null;

					if (!invitedUser) return;

					// Support two ways of passing the invite token:
					// 1) old flow: signed cookie
					// 2) new flow: body.inviteToken
					const bodyValidation = z
						.object({
							inviteToken: z.string().optional(),
							// Optional callback URL to redirect after accepting the invite
							callbackUrl: z.string().optional(),
						})
						.safeParse(ctx.body);

					const inviteTokenFromBody = bodyValidation.success
						? bodyValidation.data.inviteToken
						: undefined;

					const callbackUrlFromBody = bodyValidation.success
						? bodyValidation.data.callbackUrl
						: undefined;

					let inviteToken = inviteTokenFromBody;
					let callbackUrl = callbackUrlFromBody;

					if (!inviteToken || !callbackUrl) {
						// Fallback to the legacy cookie-based flow
						const maxAge = options.inviteCookieMaxAge ?? 10 * 60;
						const inviteCookie = ctx.context.createAuthCookie(
							INVITE_COOKIE_NAME,
							{ maxAge },
						);

						const cookieValueString = await ctx.getSignedCookie(
							inviteCookie.name,
							ctx.context.secret,
						);

						if (!cookieValueString) return;

						const cookieValue = JSON.parse(cookieValueString) as {
							token: string;
							callbackUrl?: string;
						};

						inviteToken = cookieValue.token;
						callbackUrl = cookieValue.callbackUrl;
					}

					if (!inviteToken) return;

					const adapter = getInviteAdapter(ctx.context, options);

					const invitation = await adapter.findInvitation(inviteToken);
					if (!invitation) return;

					// Validate invite expiration
					if (invitation.expiresAt < options.getDate()) {
						throw APIError.from(
							"BAD_REQUEST",
							ERROR_CODES.INVALID_OR_EXPIRED_INVITE,
						);
					}

					const timesUsed = await adapter.countInvitationUses(invitation.id);

					// Check if the invite was already fully used
					if (!invitation.infinityMaxUses && timesUsed >= invitation.maxUses) {
						throw APIError.from(
							"BAD_REQUEST",
							ERROR_CODES.NO_USES_LEFT_FOR_INVITE,
						);
					}

					// Get active session
					const session =
						ctx.context.newSession?.session ?? ctx.context.session?.session;

					if (!session) {
						throw APIError.from("INTERNAL_SERVER_ERROR", {
							message: "No session found for updating cookie",
							code: "INTERNAL_SERVER_ERROR",
						});
					}

					// Optional hook before accepting the invite
					const before = await options.inviteHooks?.beforeAcceptInvite?.({
						ctx,
						invitedUser,
					});

					if (before?.user) invitedUser = before.user;

					// Consume the invite (update role, refresh session, etc)
					await consumeInvite({
						ctx,
						invitation,
						invitedUser,
						session,
						options,
						adapter,
						meta: {
							userId,
							timesUsed,
							token: inviteToken,
							newAccount: true,
						},
					});

					// Clean up the cookie only when the cookie-based flow was used
					if (!inviteTokenFromBody) {
						const maxAge = options.inviteCookieMaxAge ?? 10 * 60;
						const inviteCookie = ctx.context.createAuthCookie(
							INVITE_COOKIE_NAME,
							{ maxAge },
						);
						expireCookie(ctx, inviteCookie);
					}

					// Optional hook after accepting
					await options.inviteHooks?.afterAcceptInvite?.({
						ctx,
						invitation,
						invitedUser,
					});

					// Redirect user after upgrading their role
					//! We need to fix this, callbackUrl should also be saved in the invite, or in the cookie
					const redirectURL = callbackUrl?.replace("{token}", ctx.params.token);

					return ctx.redirect(redirectError(ctx.context, redirectURL));
				}),
			},
		],
	};
};
