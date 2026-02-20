import type { HookEndpointContext, Status, statusCodes } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { expireCookie } from "better-auth/cookies";
import type { UserWithRole } from "better-auth/plugins";
import * as z from "zod";
import { getInviteAdapter } from "./adapter";
import { ERROR_CODES, INVITE_COOKIE_NAME } from "./constants";
import type { NewInviteOptions } from "./types";
import { consumeInvite, redirectToAfterUpgrade } from "./utils";

export const invitesHook = (options: NewInviteOptions) => {
	return {
		matcher: (context: HookEndpointContext) =>
			context.path === "/sign-up/email" ||
			context.path === "/sign-in/email" ||
			context.path === "/sign-in/email-otp" ||
			// For social logins, newSession is not available at the end of the initial /sign-in call
			context.path === "/callback/:id" ||
			context.path === "/verify-email",

		handler: createAuthMiddleware(async (ctx) => {
			const validation = z
				.object({
					user: z.object({ id: z.string() }),
				})
				.safeParse(ctx.context.newSession);

			if (!validation.success) {
				return;
			}

			const {
				user: { id: userId },
			} = validation.data;

			let invitedUser = (await ctx.context.internalAdapter.findUserById(
				userId,
			)) as UserWithRole | null;

			if (invitedUser === null) {
				return;
			}

			// Get cookie name (customizable)
			const maxAge = options.inviteCookieMaxAge ?? 10 * 60; // 10 minutes
			const inviteCookie = ctx.context.createAuthCookie(INVITE_COOKIE_NAME, {
				maxAge,
			});

			// const inviteToken = ctx.getCookie(cookie);
			const inviteToken = await ctx.getSignedCookie(
				inviteCookie.name,
				ctx.context.secret,
			);

			if (!inviteToken) {
				return;
			}

			const adapter = getInviteAdapter(ctx.context, options);

			const invite = await adapter.findInvitation(inviteToken);

			if (invite === null) {
				return;
			}

			if (invite.expiresAt < options.getDate()) {
				throw ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.INVALID_OR_EXPIRED_INVITE,
				});
			}

			const timesUsed = await adapter.countInvitationUses(invite.id);

			if (!(timesUsed < invite.maxUses)) {
				throw ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.NO_USES_LEFT_FOR_INVITE,
				});
			}

			const session =
				ctx.context.newSession?.session ?? ctx.context.session?.session;

			if (!session) {
				throw ctx.error("INTERNAL_SERVER_ERROR", {
					message: "No session found for updating cookie",
				});
			}

			const before = await options.inviteHooks?.beforeAcceptInvite?.(
				ctx,
				invitedUser,
			);
			if (before?.user) {
				invitedUser = before.user;
			}

			const error = (
				httpErrorCode: keyof typeof statusCodes | Status,
				errorMessage: string,
				urlErrorCode: string,
			) =>
				ctx.error(httpErrorCode, {
					message: errorMessage,
					errorCode: urlErrorCode,
				});

			await consumeInvite({
				ctx,
				invite,
				invitedUser,
				options,
				userId,
				timesUsed,
				token: inviteToken,
				session,
				newAccount: true,
				error,
				adapter,
			});

			// delete the invite cookie
			expireCookie(ctx, inviteCookie);

			await options.inviteHooks?.afterAcceptInvite?.(ctx, {
				invitation: invite,
				invitedUser,
			});

			// return { context: ctx };
			await redirectToAfterUpgrade({
				shareInviterName: invite.shareInviterName,
				ctx,
				invite,
				signUp: false,
			});
		}),
	};
};
