import * as z from "zod";
import { Tokens } from "./types";

export const createInviteBodySchema = z.object({
	/**
	 * The role to give the invited user.
	 */
	role: z.string().describe("The role to give the invited user"),
	/**
	 * The email address of the user to send a invitation email to.
	 */
	email: z
		.email()
		.describe("The email address of the user to send a invitation email to")
		.optional(),
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
});
