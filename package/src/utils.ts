import {
	APIError,
	type AuthContext,
	type BetterAuthPlugin,
	type GenericEndpointContext,
	generateId,
	type Session,
} from "better-auth";
import { getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import type { admin, UserWithRole } from "better-auth/plugins";
import type { InviteAdapter } from "./adapter";
import { ERROR_CODES } from "./constants";
import type { CreateInvite } from "./routes/create-invite";
import type {
	InviteOptions,
	InviteTypeWithId,
	NewInviteOptions,
	Permissions,
	TokensType,
} from "./types";

export const resolveInviteOptions = (
	opts: InviteOptions,
): NewInviteOptions => ({
	getDate: opts.getDate ?? (() => new Date()),
	invitationTokenExpiresIn: opts.invitationTokenExpiresIn ?? 60 * 60,
	defaultShareInviterName: opts.defaultShareInviterName ?? true,
	defaultSenderResponse: opts.defaultSenderResponse ?? "token",
	defaultSenderResponseRedirect: opts.defaultSenderResponseRedirect ?? "signUp",
	defaultTokenType: opts.defaultTokenType ?? "token",
	defaultRedirectToSignIn: opts.defaultRedirectToSignIn ?? "/auth/sign-in",
	defaultRedirectToSignUp: opts.defaultRedirectToSignUp ?? "/auth/sign-up",
	canCreateInvite: opts.canCreateInvite ?? true,
	canAcceptInvite: opts.canAcceptInvite ?? true,
	canCancelInvite: opts.canCancelInvite ?? true,
	canRejectInvite: opts.canRejectInvite ?? true,
	cleanupInvitesAfterMaxUses: opts.cleanupInvitesAfterMaxUses ?? false,
	cleanupInvitesOnDecision: opts.cleanupInvitesOnDecision ?? false,
	...opts,
});

export const resolveInvitePayload = (
	body: CreateInvite,
	options: NewInviteOptions,
) => ({
	tokenType: body.tokenType ?? options.defaultTokenType,
	redirectToSignUp: body.redirectToSignUp ?? options.defaultRedirectToSignUp,
	redirectToSignIn: body.redirectToSignIn ?? options.defaultRedirectToSignIn,
	maxUses: body.maxUses ?? options.defaultMaxUses,
	expiresIn: body.expiresIn ?? options.invitationTokenExpiresIn,
	redirectToAfterUpgrade:
		body.redirectToAfterUpgrade ?? options.defaultRedirectAfterUpgrade,
	shareInviterName: body.shareInviterName ?? options.defaultShareInviterName,
	senderResponse: body.senderResponse ?? options.defaultSenderResponse,
	senderResponseRedirect:
		body.senderResponseRedirect ?? options.defaultSenderResponseRedirect,
	customInviteUrl: body.customInviteUrl ?? options.defaultCustomInviteUrl,
});

export const resolveTokenGenerator = (
	tokenType: TokensType,
	options: NewInviteOptions,
): (() => string) => {
	if (tokenType === "custom" && options.generateToken) {
		return options.generateToken;
	}

	const tokenGenerators: Record<TokensType, () => string> = {
		code: () => generateRandomString(6, "0-9", "A-Z"),
		token: () => generateId(24),
		custom: () => generateId(24), // secure fallback
	};

	return tokenGenerators[tokenType];
};

export const consumeInvite = async ({
	ctx,
	invitation,
	invitedUser,
	options,
	userId,
	timesUsed,
	token,
	session,
	newAccount,
	adapter,
}: {
	ctx: GenericEndpointContext;
	invitation: InviteTypeWithId;
	invitedUser: UserWithRole;
	options: NewInviteOptions;
	userId: string;
	timesUsed: number;
	token: string;
	session: Session;
	newAccount: boolean;
	adapter: InviteAdapter;
}) => {
	const emails = normalizeEmails<string[]>(
		invitation.emails ?? invitation.email,
		[],
	);
	const isPrivate = emails.length > 0;

	if (isPrivate && !emails.includes(invitedUser.email)) {
		throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_EMAIL);
	}

	if (invitation.status !== "pending" && invitation.status !== undefined) {
		throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_TOKEN);
	}

	const canAcceptInviteOptions =
		typeof options.canAcceptInvite === "function"
			? await options.canAcceptInvite({ invitedUser, newAccount })
			: options.canAcceptInvite;
	const canAcceptInvite =
		typeof canAcceptInviteOptions === "object"
			? await exports.checkPermissions(ctx, canAcceptInviteOptions) // fix vitest errors with vi.spyOn (https://github.com/vitest-dev/vitest/issues/6551)
			: canAcceptInviteOptions;

	if (!canAcceptInvite) {
		throw APIError.from("BAD_REQUEST", ERROR_CODES.CANT_ACCEPT_INVITE);
	}

	await ctx.context.adapter.update({
		model: "user",
		where: [{ field: "id", value: userId }],
		update: {
			role: invitation.role,
		},
	});

	const updatedUser = {
		...invitedUser,
		role: invitation.role,
	};
	/**
	 * Update the session cookie with the new user data
	 */
	await setSessionCookie(ctx, {
		session,
		user: updatedUser,
	});

	const usedAt = options.getDate();

	const isLastUse = timesUsed === invitation.maxUses - 1;
	const shouldCleanup = isLastUse && options.cleanupInvitesAfterMaxUses;
	const shouldCreateInviteUse = !shouldCleanup;

	if (shouldCleanup) {
		await adapter.deleteInviteUses(invitation.id);
		await adapter.deleteInvitation(token);
	}

	if (isLastUse && !options.cleanupInvitesAfterMaxUses) {
		await adapter.updateInvitation(invitation.id, "used");
	}

	if (shouldCreateInviteUse) {
		await adapter.createInviteUse({
			inviteId: invitation.id,
			usedByUserId: userId,
			usedAt,
		});
	}

	if (options.onInvitationUsed) {
		// After all the logic, we run onInvitationUsed
		try {
			await Promise.resolve(
				options.onInvitationUsed({
					invitedUser,
					newUser: updatedUser,
					newAccount,
				}),
			);
		} catch (e) {
			ctx.context.logger.error("Error sending the invitation email", e);
		}
	}
};

export function normalizeEmails<T = string[] | undefined>(
	email: string | string[] | undefined = undefined,
	undefinedVal: T = undefined as T,
): string[] | T {
	return email ? (Array.isArray(email) ? email : [email]) : undefinedVal;
}

export const getDate = (span: number, unit: "sec" | "ms" = "ms") => {
	return new Date(Date.now() + (unit === "sec" ? span * 1000 : span));
};

export function redirectError(
	ctx: AuthContext,
	callbackURL: string | undefined,
	query?: Record<string, string> | undefined,
): string {
	const url = callbackURL
		? new URL(callbackURL, ctx.baseURL)
		: new URL(`${ctx.baseURL}/error`);
	if (query) {
		for (const [k, v] of Object.entries(query)) {
			url.searchParams.set(k, v);
		}
	}

	return url.href;
}

export function redirectCallback(
	ctx: AuthContext,
	callbackURL: string,
	query?: Record<string, string> | undefined,
): string {
	const url = new URL(callbackURL, ctx.baseURL);
	if (query) {
		for (const [k, v] of Object.entries(query)) {
			url.searchParams.set(k, v);
		}
	}

	return url.href;
}

export const checkPermissions = async (
	ctx: GenericEndpointContext,
	permissions: Permissions,
) => {
	const session = await getSessionFromCtx(ctx);

	if (!session?.session) {
		throw APIError.from("UNAUTHORIZED", {
			message: "Unauthorized",
			code: "UNAUTHORIZED",
		});
	}

	const adminPlugin = getPlugin<AdminPlugin>(
		"admin" satisfies AdminPlugin["id"],
		ctx.context,
	);

	if (!adminPlugin) {
		ctx.context.logger.error("Admin plugin is not set-up.");
		throw APIError.from(
			"FAILED_DEPENDENCY",
			ERROR_CODES.ADMIN_PLUGIN_IS_NOT_SET_UP,
		);
	}

	try {
		return await adminPlugin.endpoints.userHasPermission({
			...ctx,
			body: {
				userId: session.user.id,
				permissions: { [permissions.statement]: permissions.permissions },
			},
			returnHeaders: true,
		});
	} catch {
		return false;
	}
};

type AdminPlugin = ReturnType<typeof admin>;

const getPlugin = <P extends BetterAuthPlugin = BetterAuthPlugin>(
	id: string,
	context: AuthContext,
) => {
	return context.options.plugins?.find((p) => p.id === id) as P | undefined;
};

export const createRedirectURL = ({
	ctx,
	invitation,
	callbackURL,
	customInviteUrl,
}: {
	ctx: GenericEndpointContext;
	invitation: InviteTypeWithId;
	callbackURL: string;
	customInviteUrl?: string;
}) => {
	if (!customInviteUrl) {
		return `${ctx.context.baseURL}/invite/${invitation.token}?callbackURL=${encodeURIComponent(callbackURL)}`;
	}

	return customInviteUrl
		.replace("{token}", invitation.token)
		.replace("{callbackURL}", encodeURIComponent(callbackURL));
};
