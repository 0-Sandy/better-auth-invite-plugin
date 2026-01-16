import type { HookEndpointContext } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import type { UserWithRole } from "better-auth/plugins";
import * as z from "zod";
import {
	ERROR_CODES,
	type InviteTypeWithId,
	type NewInviteOptions,
} from "./types";
import { consumeInvite, getCookieName, redirectToAfterUpgrade } from "./utils";

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

			const user = (await ctx.context.internalAdapter.findUserById(
				userId,
			)) as UserWithRole;

			if (user === null) {
				return;
			}

			// Get cookie name (customizable)
			const cookie = getCookieName({ ctx, options });

			const inviteToken = ctx.getCookie(cookie);

			if (inviteToken === null) {
				return;
			}

			const invite = await ctx.context.adapter.findOne<InviteTypeWithId>({
				model: "invite",
				where: [{ field: "token", value: inviteToken }],
			});

			if (invite === null) {
				return;
			}

			if (invite.expiresAt < options.getDate()) {
				throw ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.INVALID_OR_EXPIRED_INVITE,
				});
			}

			const timesUsed = await ctx.context.adapter.count({
				model: "invite_use",
				where: [{ field: "inviteId", value: invite.id }],
			});

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

			await consumeInvite({
				ctx,
				invite,
				user,
				options,
				userId,
				timesUsed,
				token: inviteToken,
				session,
				newAccount: true,
			});

			ctx.setCookie(cookie, "", {
				path: "/",
				httpOnly: true,
				expires: new Date(0), // Set to epoch to clear
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
