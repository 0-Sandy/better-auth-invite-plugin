import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
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
			} = resolveInvitePayload(ctx.body, options);

			const emails = normalizeEmails<string[]>(email, []);
			const isPrivate = emails.length > 0;

			// If the invite is public we use [undefined] so the loop runs once and knows it's as a public invite
			const targets = isPrivate ? emails : [undefined];

			const invitations: InviteTypeWithId[] = [];

			if (isPrivate && !options.sendUserInvitation) {
				ctx.context.logger.warn(
					"Invitation email is not enabled. Pass `sendUserInvitation` to the plugin options to enable it.",
				);
				throw ctx.error("INTERNAL_SERVER_ERROR", {
					message: "Invitation email is not enabled",
				});
			}

			const basicInvitedUser = { email, role };

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
				throw ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
					errorCode: "INSUFFICIENT_PERMISSIONS",
				});
			}

			const adapter = getInviteAdapter(ctx.context, options);

			await options.inviteHooks?.beforeCreateInvite?.({ ctx });

			// Loop for creating and sending invites
			for (const email of targets) {
				// If the invite is public (this is where we use the undefined inside targets) we create the invite, but we don't send any email
				if (!email) {
					const invitation = await adapter.createInvite(
						ctx.body,
						inviterUser,
						undefined,
					);

					invitations.push(invitation);
					continue;
				}

				const invitedUser = await ctx.context.internalAdapter.findUserByEmail(
					email,
					{
						includeAccounts: true,
					},
				);

				const callbackURL = invitedUser ? redirectToSignIn : redirectToSignUp;

				const newAccount = !invitedUser;

				const invitation = await adapter.createInvite(
					{ ...ctx.body, email },
					inviterUser,
					newAccount,
				);

				invitations.push(invitation);

				// If the invite is private, send the user an email
				if (isPrivate) {
					const redirectURLEmail = createRedirectURL({
						ctx,
						invitation,
						callbackURL,
						customInviteUrl,
					});

					// This should never happen because we check it at the beginning of the function, but we check it again to make TypeScript happy
					if (!options.sendUserInvitation) {
						throw ctx.error("INTERNAL_SERVER_ERROR", {
							message: "Invitation email is not enabled",
						});
					}

					try {
						await options.sendUserInvitation(
							{
								email,
								name: invitedUser?.user.name,
								role,
								url: redirectURLEmail,
								token: invitation.token,
								newAccount,
							},
							ctx.request,
						);
					} catch (e) {
						ctx.context.logger.error("Error sending the invitation email: ", e);
						throw ctx.error("INTERNAL_SERVER_ERROR", {
							message: ERROR_CODES.ERROR_SENDING_THE_INVITATION_EMAIL,
						});
					}
				}
			}

			await options.inviteHooks?.afterCreateInvite?.({
				ctx,
				invitations,
			});

			// If the invitation is private, we return
			if (isPrivate)
				return ctx.json({
					status: true,
					message:
						emails.length === 1
							? "The invitation was sent"
							: "The invitations were sent",
				});

			// If the invite is public, we return the token
			const invitation = invitations[0];

			const redirectTo =
				senderResponseRedirect === "signUp"
					? redirectToSignUp
					: redirectToSignIn;

			const redirectURL = createRedirectURL({
				ctx,
				invitation,
				callbackURL: redirectTo,
				customInviteUrl,
			});

			const returnToken =
				senderResponse === "token" ? invitation.token : redirectURL;

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
	 *
	 * @default options.defaultRedirectTo
	 */
	redirectToSignUp: z
		.string()
		.describe(
			"The URL to redirect the user to create their account. If the token isn't valid or expired, it'll be redirected with a query parameter `?error=INVALID_TOKEN`. If the token is valid, it'll be redirected with a query parameter `?token=VALID_TOKEN",
		)
		.optional(),
	/**
	 * The URL to redirect the user to upgrade their role.
	 * @default options.defaultRedirectToSignIn
	 */
	redirectToSignIn: z
		.string()
		.describe("The URL to redirect the user to upgrade their role.")
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
	 * @default options.defaultRedirectAfterUpgrade
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
	 * Use {token} and {callbackUrl}, this will be replaced with their values
	 */
	customInviteUrl: z
		.string()
		.describe("The user will be redirected here to activate their invite")
		.optional(),
});

export type CreateInvite = z.infer<typeof createInviteBodySchema>;
