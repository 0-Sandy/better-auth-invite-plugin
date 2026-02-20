import type { GenericEndpointContext, Status, statusCodes } from "better-auth";
import type { UserWithRole } from "better-auth/plugins";
import { getInviteAdapter } from "../adapter";
import { INVITE_COOKIE_NAME } from "../constants";
import type { afterUpgradeTypes, NewInviteOptions } from "../types";
import { consumeInvite } from "../utils";

export const activateInviteLogic = async ({
	ctx,
	options,
	token,
	error,
	afterUpgrade,
	needToSignInUp,
}: {
	ctx: GenericEndpointContext;
	options: NewInviteOptions;
	token: string;
	error: (
		httpErrorCode: keyof typeof statusCodes | Status,
		errorMessage: string,
		urlErrorCode: string,
	) => void;
	afterUpgrade: (opts: afterUpgradeTypes) => Promise<unknown>;
	needToSignInUp: () => void;
}) => {
	const adapter = getInviteAdapter(ctx.context, options);

	const invite = await adapter.findInvitation(token);

	if (!invite) {
		throw error("BAD_REQUEST", "Invalid invite token", "INVALID_TOKEN");
	}

	const timesUsed = await adapter.countInvitationUses(invite.id);

	if (!(timesUsed < invite.maxUses)) {
		throw error(
			"BAD_REQUEST",
			"Invite token has already been used",
			"INVALID_TOKEN",
		);
	}

	if (options.getDate() > invite.expiresAt) {
		throw error("BAD_REQUEST", "Invite token has expired", "INVALID_TOKEN");
	}

	const sessionObject = ctx.context.session;
	const session = sessionObject?.session;
	let invitedUser = sessionObject?.user as UserWithRole | null;

	if (invitedUser && session) {
		const before = await options.inviteHooks?.beforeAcceptInvite?.(
			ctx,
			invitedUser,
		);
		if (before?.user) {
			invitedUser = before.user;
		}

		await consumeInvite({
			ctx,
			invite,
			invitedUser,
			options,
			userId: invitedUser.id,
			timesUsed,
			token,
			session,
			newAccount: false,
			error,
			adapter,
		});

		await options.inviteHooks?.afterAcceptInvite?.(ctx, {
			invitation: invite,
			invitedUser,
		});

		return await afterUpgrade({
			shareInviterName: invite.shareInviterName,
			ctx,
			invite,
			signUp: true,
		});
	}

	// If user doesn't already exist, we set a cookie and redirect them to the sign in/up page

	// Get cookie name (customizable)
	const maxAge = options.inviteCookieMaxAge ?? 10 * 60; // 10 minutes
	const inviteCookie = ctx.context.createAuthCookie(INVITE_COOKIE_NAME, {
		maxAge,
	});

	await ctx.setSignedCookie(
		inviteCookie.name,
		token,
		ctx.context.secret,
		inviteCookie.attributes,
	);

	// Redirects the user to sign in/up
	return needToSignInUp();
};
