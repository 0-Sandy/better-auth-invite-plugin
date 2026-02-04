import type { GenericEndpointContext } from "better-auth";
import type { InferOptionSchema, UserWithRole } from "better-auth/plugins";
import type { InviteSchema } from "./schema";

export type InviteOptions = {
	/**
	 * The role that users that sign up without a invitation should have
	 * @example User
	 */
	defaultRoleForSignUpWithoutInvite: string;
	/**
	 * A function to generate the date
	 * @default () => new Date()
	 */
	getDate?: () => Date;
	/**
	 * A function that runs before a user creates an invite
	 * @param invitedUser The role and optionally email of the user to invited user
	 * @param inviterUser The full user with role of the user that created the invite
	 */
	canCreateInvite?: (
		inviteUserd: {
			email?: string;
			role: string;
		},
		inviterUser: UserWithRole,
	) => boolean;
	/**
	 * A function that runs before a user accepts an invite
	 * @param user The user object with the role
	 */
	canAcceptInvite?: (data: {
		user: UserWithRole;
		newAccount: boolean;
	}) => boolean;
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
	 */
	defaultRedirectToSignUp: string;
	/**
	 * The default redirect to make the user to sign up
	 */
	defaultRedirectToSignIn: string;
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
	 * Max token uses
	 * @default 1
	 */
	defaultMaxUses: number;
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
	 * Custom cookie name. You can include `{prefix}` in the string.
	 * @default {prefix}.invite-token
	 */
	customCookieName?: string;
	/**
	 * send user invitation email
	 */
	sendUserInvitation?: (
		/**
		 * @param email the email address of the user to send the
		 * invitation email to
		 * @param role the role to assign to the invited user
		 * @param url the URL to send the invitation email to
		 * @param token the token to send to the user (could be used instead of sending the url
		 * if you need to redirect the user to custom route)
		 */
		data: { email: string; role: string; url: string; token: string },
		/**
		 * The request object
		 */
		request?: Request,
	) => Promise<void>;
	/**
	 * send user role upgrade
	 */
	sendUserRoleUpgrade?: (
		/**
		 * @param email the email address of the user to send the
		 * invitation email to
		 * @param role the role to assign to the invited user
		 * @param url the URL to send the invitation email to
		 * @param token the token to send to the user (could be used instead of sending the url
		 * if you need to redirect the user to custom route)
		 */
		data: { email: string; role: string; url: string; token: string },
		/**
		 * The request object
		 */
		request?: Request,
	) => Promise<void>;
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
		data: { user: UserWithRole; newUser: UserWithRole; newAccount: boolean },
		request?: Request,
	) => Promise<void>;
	/**
	 * Custom schema for the invite plugin
	 */
	schema?: InferOptionSchema<InviteSchema> | undefined;
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
