import type { GenericEndpointContext } from "better-auth";
import type { InferOptionSchema, UserWithRole } from "better-auth/plugins";
import type { InviteSchema } from "./schema";

export type InviteOptions = {
	/**
	 * A function to generate the date
	 * @default () => new Date()
	 */
	getDate?: () => Date;
	/**
	 * A function that runs before a user creates an invite
	 * @param invitedUser The role and optionally email of the user to invited user
	 * @param inviterUser The full user with role of the user that created the invite
	 *
	 * @example ```ts
	 * async canCreateInvite({ ctx }) {
	 *   const canCreateInvite = await hasPermission(ctx, 'create-invite');
	 *   return canCreateInvite
	 * }
	 * ```
	 *
	 * @default true
	 */
	canCreateInvite?:
		| ((data: {
				invitedUser: {
					email?: string;
					role: string;
				};
				inviterUser: UserWithRole;
				ctx: GenericEndpointContext;
		  }) => Promise<boolean> | boolean)
		| boolean;
	/**
	 * A function that runs before a user accepts an invite
	 * @param user The user object with the role
	 *
	 * @example ```ts
	 * async canAcceptInvite({ ctx }) {
	 *   const canAcceptInvite = await hasPermission(ctx, 'accept-invite');
	 *   return canAcceptInvite
	 * }
	 * ```
	 *
	 * @default true
	 */
	canAcceptInvite?:
		| ((data: {
				invitedUser: UserWithRole;
				newAccount: boolean;
		  }) => Promise<boolean> | boolean)
		| boolean;
	/**
	 * A function to generate a custom token
	 */
	generateToken?: () => string;
	/**
	 * The default token type, can be:
	 * - Token: () => generateId(24)
	 * - Code: () => generateRandomString(6, "0-9", "A-Z")
	 * - Custom: generateToken(invitedUser) (needs options.generateToken)
	 * @default token
	 */
	defaultTokenType?: TokensType;
	/**
	 * The default redirect to make the user to sign up
	 *
	 * @default /auth/sign-up
	 */
	defaultRedirectToSignUp?: string;
	/**
	 * The default redirect to make the user to sign up
	 *
	 * @default /auth/sign-in
	 */
	defaultRedirectToSignIn?: string;
	/**
	 * The default redirect after upgrading role (or logging in with an invite)
	 */
	defaultRedirectAfterUpgrade: string;
	/**
	 * Whether the inviter's name should be shared with the invitee by default.
	 *
	 * When enabled, the person receiving the invitation will see
	 * the name of the user who created the invitation.
	 *
	 * @default true
	 */
	defaultShareInviterName?: boolean;
	/**
	 * Max times an invite can be used
	 * @default 1 on private invites and infinite on public invites
	 */
	defaultMaxUses?: number;
	/**
	 * How should the sender receive the token by default.
	 * (sender only receives a token if no email is provided)
	 *
	 * @default token
	 */
	defaultSenderResponse?: "token" | "url";
	/**
	 * Where should we redirect the user by default?
	 * (only if no email is provided)
	 *
	 * @default signUp
	 */
	defaultSenderResponseRedirect?: "signUp" | "signIn";
	/**
	 * Send email to the user with the invite link.
	 */
	sendUserInvitation?: (
		data: {
			email: string;
			name?: string;
			role: string;
			url: string;
			token: string;
			newAccount: boolean;
		},
		/**
		 * The request object
		 */
		request?: Request,
	) => Promise<void> | void;
	/**
	 * Send user role upgrade email
	 *
	 * @deprecated Use `sendUserInvitation` instead.
	 */
	sendUserRoleUpgrade?: (
		data: {
			email: string;
			role: string;
			url: string;
			token: string;
		},
		/**
		 * The request object
		 */
		request?: Request,
	) => Promise<void> | void;
	/**
	 * Number of seconds the invitation token is
	 * valid for.
	 * @default 1 hour (60 * 60)
	 */
	invitationTokenExpiresIn?: number;
	/**
	 * Maximum age (in seconds) for the invitation cookie.
	 * This controls how long users have to complete the login flow
	 * before activating the token if they are not logged in.
	 *
	 * @default 600 (10 minutes)
	 */
	inviteCookieMaxAge?: number;
	/**
	 * A callback function that is triggered
	 * when a invite is used.
	 */
	onInvitationUsed?: (
		data: {
			invitedUser: UserWithRole;
			newUser: UserWithRole;
			newAccount: boolean;
		},
		request?: Request,
	) => Promise<void> | void;
	/**
	 * Custom schema for the invite plugin
	 */
	schema?: InferOptionSchema<InviteSchema>;
	/**
	 *
	 */
	inviteHooks?: {
		beforeCreateInvite?: (ctx: GenericEndpointContext) => Promise<void> | void;
		afterCreateInvite?: (
			ctx: GenericEndpointContext,
			invitation: InviteTypeWithId,
		) => Promise<void> | void;
		beforeAcceptInvite?: (
			ctx: GenericEndpointContext,
			invitedUser: UserWithRole,
		) =>
			| Promise<{ user?: UserWithRole }>
			| Promise<void>
			| { user?: UserWithRole }
			| void;
		afterAcceptInvite?: (
			ctx: GenericEndpointContext,
			data: {
				invitation: InviteTypeWithId;
				invitedUser: UserWithRole;
			},
		) => Promise<void> | void;
	};
};

type MakeRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export type NewInviteOptions = MakeRequired<
	InviteOptions,
	| "getDate"
	| "invitationTokenExpiresIn"
	| "defaultShareInviterName"
	| "defaultSenderResponse"
	| "defaultSenderResponseRedirect"
	| "defaultTokenType"
	| "defaultRedirectToSignIn"
	| "defaultRedirectToSignUp"
>;

export type InviteType = {
	token: string;
	createdByUserId: string;
	createdAt: Date;
	expiresAt: Date;
	maxUses: number;
	redirectToAfterUpgrade: string;
	shareInviterName: boolean;
	email?: string;
	role: string;
};

export type InviteTypeWithId = InviteType & {
	id: string;
};

export type TokensType = "token" | "code" | "custom";

export type afterUpgradeTypes = {
	shareInviterName: boolean;
	ctx: GenericEndpointContext;
	invite: InviteTypeWithId;
	signUp: boolean;
};

export type InviteUseType = {
	inviteId: string;
	usedByUserId: string;
	usedAt: Date;
};

export type InviteUseTypeWithId = InviteUseType & {
	id: string;
};
