import type { GenericEndpointContext, Status, statusCodes } from "better-auth";
import {
	createAuthEndpoint,
	originCheck,
	sessionMiddleware,
} from "better-auth/api";
import type { UserWithRole } from "better-auth/plugins";
import * as z from "zod";
import { createInviteBodySchema } from "./body";
import { ERROR_CODES, INVITE_COOKIE_NAME } from "./constants";
import type {
	afterUpgradeTypes,
	InviteType,
	InviteTypeWithId,
	NewInviteOptions,
} from "./types";
import {
	consumeInvite,
	getDate,
	optionalSessionMiddleware,
	redirectCallback,
	redirectError,
	redirectToAfterUpgrade,
	resolveInvitePayload,
	resolveTokenGenerator,
} from "./utils";

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
				tokenType,
				redirectToAfterUpgrade,
				redirectToSignUp,
				redirectToSignIn,
				maxUses,
				expiresIn,
				shareInviterName,
				senderResponse,
				senderResponseRedirect,
			} = resolveInvitePayload(ctx.body, options);

			const inviteType = email ? "private" : "public";

			if (
				inviteType === "private" &&
				!options.sendUserInvitation &&
				!options.sendUserRoleUpgrade
			) {
				ctx.context.logger.warn(
					"Invitation email is not enabled. Pass `sendUserInvitation` or `sendUserRoleUpgrade` to the plugin options to enable it.",
				);
				throw ctx.error("INTERNAL_SERVER_ERROR", {
					message: "Invitation email is not enabled",
				});
			}

			const basicInvitedUser = { email, role };

			const canCreateInvite =
				typeof options.canCreateInvite === "function"
					? options.canCreateInvite({
							invitedUser: basicInvitedUser,
							inviterUser,
						})
					: options.canCreateInvite;

			if (!canCreateInvite) {
				throw ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
				});
			}

			const generateToken = resolveTokenGenerator(tokenType, options);

			const invitedUser =
				email &&
				(await ctx.context.internalAdapter.findUserByEmail(email, {
					includeAccounts: true,
				}));

			// If the user already exists they should sign in, else they should sign up
			const callbackURL = invitedUser ? redirectToSignIn : redirectToSignUp;
			const token = generateToken();
			const now = options.getDate();
			const expiresAt = getDate(expiresIn, "sec");

			await ctx.context.adapter.create({
				model: "invite",
				data: {
					token,
					createdByUserId: inviterUser.id,
					createdAt: now,
					expiresAt,
					maxUses,
					redirectToAfterUpgrade,
					shareInviterName,
					email,
					role,
				} satisfies InviteType,
			});

			const url = `${ctx.context.baseURL}/invite/${token}`;
			const redirectURLEmail = `${url}?callbackURL=${callbackURL}?`;

			// If the invite is private, send the invitation or role upgrade using the configured function
			if (inviteType === "private") {
				const sendFn = invitedUser
					? (options.sendUserRoleUpgrade ?? options.sendUserInvitation) // fallback if it doesn't exist
					: (options.sendUserInvitation ?? options.sendUserRoleUpgrade); // fallback if it doesn't exist

				if (!sendFn) {
					throw ctx.error("INTERNAL_SERVER_ERROR", {
						message: "Invitation email is not enabled",
					});
				}

				try {
					await Promise.resolve(
						sendFn(
							{
								// biome-ignore lint/style/noNonNullAssertion: email is guaranteed to exist for private invites
								email: email!,
								role,
								url: redirectURLEmail,
								token,
							},
							ctx.request,
						),
					);
				} catch (e) {
					ctx.context.logger.error("Error sending the invitation email", e);
					throw ctx.error("INTERNAL_SERVER_ERROR", {
						message: ERROR_CODES.ERROR_SENDING_THE_INVITATION_EMAIL,
					});
				}

				return ctx.json({
					status: true,
					message: "The invitation was sent",
				});
			}

			const redirectTo =
				senderResponseRedirect === "signUp"
					? redirectToSignUp
					: redirectToSignIn;
			const redirectURL = `${url}?callbackURL=${redirectTo}`;
			const returnToken = senderResponse === "token" ? token : redirectURL;

			return ctx.json({
				status: true,
				message: returnToken,
			});
		},
	);
};

/**
 * Can be used calling it form better auth
 * Ex: auth.api.activateInvite()
 */
export const activateInvite = (options: NewInviteOptions) => {
	return createAuthEndpoint(
		"/invite/activate",
		{
			method: "POST",
			use: [
				optionalSessionMiddleware,
				originCheck((ctx) => ctx.body.callbackURL),
			],
			body: z.object({
				/**
				 * Where to redirect the user after sing in/up
				 */
				callbackURL: z
					.string()
					.describe("Where to redirect the user after sing in/up"),
				/**
				 * The invite token.
				 */
				token: z.string().describe("The invite token"),
			}),
			metadata: {
				openapi: {
					operationId: "activateInvite",
					description:
						"Redirects the user to the callback URL with the token in a cookie",
					responses: {
						"200": {
							description: "Invite activated successfully",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											status: { type: "boolean", example: true },
											message: {
												type: "string",
												example: "Invite activated successfully",
											},
											action: {
												type: "string",
												example: "SIGN_IN_UP_REQUIRED",
											},
											redirectTo: {
												type: "string",
												example: "/auth/sign-in",
											},
										},
										required: ["status", "message"],
									},
								},
							},
						},
						"400": {
							description: "Invalid or expired invite token",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											errorCode: { type: "string", example: "INVALID_TOKEN" },
											message: { type: "string" },
										},
									},
								},
							},
						},
						"500": {
							description: "Internal server error",
						},
					},
				},
			},
		},
		async (ctx) => {
			const { token, callbackURL } = ctx.body;

			const error = (
				httpErrorCode: keyof typeof statusCodes | Status,
				errorMessage: string,
				urlErrorCode: string,
			) =>
				ctx.error(httpErrorCode, {
					message: errorMessage,
					errorCode: urlErrorCode,
				});

			const afterUpgrade = () =>
				ctx.json({
					status: true,
					message: "Invite activated successfully",
				});

			const needToSignInUp = () =>
				ctx.json({
					status: true,
					message: "Invite activated successfully",
					action: "SIGN_IN_UP_REQUIRED",
					redirectTo: callbackURL,
				});

			return await activateInviteLogic({
				ctx,
				options,
				token,
				error,
				afterUpgrade,
				needToSignInUp,
			});
		},
	);
};

/**
 * Only used for invite links
 *
 * If an error occurs, the user is redirected to the provided callbackURL
 * with the query parameters "error" and "message".
 */
export const activateInviteCallback = (options: NewInviteOptions) => {
	return createAuthEndpoint(
		"/invite/:token",
		{
			method: "GET",
			use: [
				optionalSessionMiddleware,
				originCheck((ctx) => ctx.query.callbackURL),
			],
			query: z.object({
				/**
				 * Where to redirect the user after sing in/up
				 */
				callbackURL: z
					.string()
					.describe("Where to redirect the user after sing in/up"),
			}),
			metadata: {
				openapi: {
					operationId: "activateInviteCallback",
					description:
						"Redirects the user to the callback URL with the token in a cookie. If an error occurs, the user is redirected to the callback URL with the query parameters 'error' and 'message'.",
					parameters: [
						{
							name: "token",
							in: "path",
							required: true,
							description: "The invitation token",
							schema: {
								type: "string",
							},
						},
						{
							name: "callbackURL",
							in: "query",
							required: true,
							description: "Where to redirect the user after sing in/up",
							schema: {
								type: "string",
							},
						},
					],
					responses: {
						"302": {
							description:
								"Redirects the user to the callback URL. On error, includes 'error' and 'message' query parameters.",
							headers: {
								Location: {
									description: "Redirect destination",
									schema: {
										type: "string",
									},
								},
							},
						},
					},
				},
			},
		},
		async (ctx) => {
			const { token } = ctx.params;
			const { callbackURL } = ctx.query;

			const error = (
				_httpErrorCode: keyof typeof statusCodes | Status,
				errorMessage: string,
				urlErrorCode: string,
			) =>
				ctx.redirect(
					redirectError(ctx.context, callbackURL, {
						error: urlErrorCode,
						message: errorMessage,
					}),
				);

			const afterUpgrade = async (opts: afterUpgradeTypes) =>
				redirectToAfterUpgrade(opts);

			const needToSignInUp = () =>
				ctx.redirect(redirectCallback(ctx.context, callbackURL));

			return await activateInviteLogic({
				ctx,
				options,
				token,
				error,
				afterUpgrade,
				needToSignInUp,
			});
		},
	);
};

const activateInviteLogic = async ({
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
	const invite = (await ctx.context.adapter.findOne({
		model: "invite",
		where: [{ field: "token", value: token }],
	})) as InviteTypeWithId | null;

	if (invite === null) {
		throw error("BAD_REQUEST", "Invalid invite token", "INVALID_TOKEN");
	}

	const timesUsed = await ctx.context.adapter.count({
		model: "invite_use",
		where: [{ field: "inviteId", value: invite.id }],
	});

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
	const invitedUser = sessionObject?.user as UserWithRole | null;

	if (invitedUser && session) {
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
