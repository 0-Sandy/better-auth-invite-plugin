import {
	APIError,
	createAuthEndpoint,
	sessionMiddleware,
} from "better-auth/api";
import type { UserWithRole } from "better-auth/plugins";
import * as z from "zod";
import { getInviteAdapter } from "../adapter";
import { ERROR_CODES, Tokens } from "../constants";
import type { InviteTypeWithId, NewInviteOptions } from "../types";
import {
	checkPermissions,
	createRedirectURL,
	normalizeEmails,
	resolveInvitePayload,
} from "../utils";

export const createInvite = (options: NewInviteOptions) => {
	return createAuthEndpoint(
		"/invite/create",
		{
			method: "POST",
			body: createInviteBodySchema,
			use: [sessionMiddleware],
			metadata: {
				openapi: {
					operationId: "createInvitation",
					description: "Create an invitation",
					responses: {
						"200": {
							description: "Success",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											status: {
												type: "boolean",
											},
											message: {
												type: "string",
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		async (ctx) => {
			const inviterUser = ctx.context.session.user as UserWithRole;

			const { email, role } = ctx.body;
			const {
				redirectToSignUp,
				redirectToSignIn,
				senderResponse,
				senderResponseRedirect,
				customInviteUrl,
				redirectToAfterUpgrade,
			} = resolveInvitePayload(ctx.body, options);

			// Normalize the input to always work with an array internally.
			const emails = normalizeEmails(email);
			const isPrivate = emails.length > 0;

			const invitations: InviteTypeWithId[] = [];

			if (isPrivate && !options.sendUserInvitation) {
				ctx.context.logger.warn(
					"Invitation email is not enabled. Pass `sendUserInvitation` to the plugin options to enable it.",
				);
				throw APIError.from(
					"INTERNAL_SERVER_ERROR",
					ERROR_CODES.INVITATION_EMAIL_NOT_ENABLED,
				);
			}

			// Pass the full email list to permission checks when this is a private invite.
			const basicInvitedUser = {
				email: isPrivate ? emails : email,
				role,
			};

			const canCreateInviteOption =
				typeof options.canCreateInvite === "function"
					? await options.canCreateInvite({
							invitedUser: basicInvitedUser,
							inviterUser,
							ctx,
						})
					: options.canCreateInvite;

			const canCreateInvite =
				typeof canCreateInviteOption === "object"
					? await checkPermissions(ctx, canCreateInviteOption)
					: canCreateInviteOption;

			if (!canCreateInvite) {
				throw APIError.from(
					"BAD_REQUEST",
					ERROR_CODES.INSUFFICIENT_PERMISSIONS,
				);
			}

			const adapter = getInviteAdapter(ctx.context, options);

			await options.inviteHooks?.beforeCreateInvite?.({ ctx });

			// For private invites, resolve each recipient first so we can create one shared invite.
			const recipients = isPrivate
				? await Promise.all(
						emails.map(async (recipientEmail) => {
							const invitedUser =
								await ctx.context.internalAdapter.findUserByEmail(
									recipientEmail,
									{
										includeAccounts: true,
									},
								);

							return {
								email: recipientEmail,
								invitedUser,
								signInUpUrl: invitedUser ? redirectToSignIn : redirectToSignUp,
								redirectToAfterUpgrade,
								newAccount: !invitedUser,
							};
						}),
					)
				: [];

			// Create a single invitation for all emails.
			// The invite record stores the full list when this is a private invite.
			const sharedNewAccount = isPrivate
				? recipients.every(({ newAccount }) => newAccount)
					? true
					: recipients.every(({ newAccount }) => !newAccount)
						? false
						: undefined
				: undefined;

			const invitation = await adapter.createInvite(
				isPrivate ? { ...ctx.body, email: emails } : ctx.body,
				inviterUser,
				sharedNewAccount,
			);

			invitations.push(invitation);

			// Send one email per recipient, but reuse the same invitation/token.
			if (isPrivate && options.sendUserInvitation) {
				for (const recipient of recipients) {
					const redirectURLEmail = createRedirectURL({
						ctx,
						invitation,
						signInUpUrl: recipient.signInUpUrl,
						customInviteUrl,
						email: recipient.email,
						callbackUrl: recipient.redirectToAfterUpgrade,
					});

					const realBaseURL = new URL(ctx.context.baseURL);
					const pathname =
						realBaseURL.pathname === "/" ? "" : realBaseURL.pathname;
					const basePath = pathname ? "" : ctx.context.options.basePath || "";
					const url = new URL(
						`${pathname}${basePath}/${redirectURLEmail}`,
						realBaseURL.origin,
					);

					try {
						await options.sendUserInvitation(
							{
								email: recipient.email,
								name: recipient.invitedUser?.user.name,
								role,
								url: url.toString(),
								token: invitation.token,
								newAccount: recipient.newAccount,
							},
							ctx.request,
						);
					} catch (e) {
						ctx.context.logger.error("Error sending the invitation email: ", e);
						throw APIError.from(
							"INTERNAL_SERVER_ERROR",
							ERROR_CODES.ERROR_SENDING_THE_INVITATION_EMAIL,
						);
					}
				}
			}

			await options.inviteHooks?.afterCreateInvite?.({
				ctx,
				invitations,
			});

			// Private invite: we already sent the emails, so we just return success.
			if (isPrivate) {
				return ctx.json({
					status: true,
					message:
						emails.length === 1
							? "The invitation was sent"
							: "The invitations were sent",
				});
			}

			// Public invite: return the token or the redirect URL.
			const signInUpUrl =
				senderResponseRedirect === "signUp"
					? redirectToSignUp
					: redirectToSignIn;

			const redirectURL = createRedirectURL({
				ctx,
				invitation,
				signInUpUrl,
				customInviteUrl,
				callbackUrl: redirectToAfterUpgrade,
			});

			const returnToken =
				senderResponse === "token" ? invitation.token : redirectURL.toString();

			return ctx.json({
				status: true,
				message: returnToken,
			});
		},
	);
};

export const createInviteBodySchema = z.object({
	/**
	 * The role to give the invited user.
	 */
	role: z.string().describe("The role to give the invited user"),
	/**
	 * The email (or emails) address of the user to send a invitation email to.
	 */
	email: z
		.union([z.email(), z.array(z.email())])
		.optional()
		.describe(
			"The email (or emails) address of the user to send a invitation email to",
		),
	/**
	 * Type of token tu use, 24 character token,
	 * 6 digit code or custom options.generateToken.
	 * @default options.defaultTokenType
	 */
	tokenType: z
		.enum(Tokens)
		.describe(
			"Type of token tu use, 24 character token, 6 digit code or custom options.generateToken",
		)
		.optional(),
	/**
	 * The URL to redirect the user to create their account.
	 * If the token isn't valid or expired, it'll be redirected with a query parameter `?
	 * error=INVALID_TOKEN`. If the token is valid, it'll be redirected with a query parameter `?
	 * token=VALID_TOKEN
	 * {callbackUrl} will be replaced by the actual callbackUrl in the request body.
	 *
	 * @default options.defaultRedirectTo
	 */
	redirectToSignUp: z
		.string()
		.describe(
			"The URL to redirect the user to create their account. {callbackURL} will be replaced by the actual callbackURL in the request body.",
		)
		.optional(),
	/**
	 * The URL to redirect the user to upgrade their role.
	 * {callbackUrl} will be replaced by the actual callbackUrl in the request body.
	 *
	 * @default options.defaultRedirectToSignIn
	 */
	redirectToSignIn: z
		.string()
		.describe(
			"The URL to redirect the user to upgrade their role. {callbackURL} will be replaced by the actual callbackURL in the request body.",
		)
		.optional(),
	/**
	 * The number of times an invitation can be used.
	 * @default options.defaultMaxUses
	 */
	maxUses: z
		.number()
		.describe("The number of times an invitation can be used")
		.optional(),
	/**
	 * Number of seconds the invitation token is
	 * valid for.
	 * @default options.invitationTokenExpiresIn
	 */
	expiresIn: z
		.number()
		.describe("Number of seconds the invitation token is valid for.")
		.optional(),
	/**
	 * The URL to redirect the user to after upgrade their role (if the user is already logged in).
	 * {token} will be replaced with the user's actual token.
	 *
	 * @default /
	 */
	redirectToAfterUpgrade: z
		.string()
		.describe(
			"The URL to redirect the user to after upgrade their role (if the user is already logged in)",
		)
		.optional(),
	/**
	 * Whether the inviter's name should be shared with the invitee.
	 *
	 * When enabled, the person receiving the invitation will see
	 * the name of the user who created the invitation.
	 *
	 * @default options.defaultShareInviterName
	 */
	shareInviterName: z
		.boolean()
		.describe("Whether the inviter's name should be shared with the invitee")
		.optional(),
	/**
	 * How should the sender receive the token.
	 * (sender only receives a token if no email is provided)
	 *
	 * @default options.defaultSenderResponse
	 */
	senderResponse: z
		.enum(["token", "url"])
		.describe(
			"How should the sender receive the token (sender only receives a token if no email is provided)",
		)
		.optional(),
	/**
	 * Where should we redirect the user?
	 * (only if no email is provided)
	 *
	 * @default options.defaultSenderResponseRedirect
	 */
	senderResponseRedirect: z
		.enum(["signUp", "signIn"])
		.describe(
			"Where should we redirect the user? (only if no email is provided)",
		)
		.optional(),
	/**
	 * The user will be redirected here to activate their invite
	 * Use {token}, {callbackUrl} and {email}, this will be replaced with their values
	 */
	customInviteUrl: z
		.string()
		.describe("The user will be redirected here to activate their invite")
		.optional(),
});

export type CreateInvite = z.infer<typeof createInviteBodySchema>;
