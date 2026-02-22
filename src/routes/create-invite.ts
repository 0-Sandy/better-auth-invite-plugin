import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import type { UserWithRole } from "better-auth/plugins";
import { getInviteAdapter } from "../adapter";
import { createInviteBodySchema } from "../body";
import { ERROR_CODES } from "../constants";
import type { NewInviteOptions } from "../types";
import { resolveInvitePayload } from "../utils";

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
			} = resolveInvitePayload(ctx.body, options);

			const inviteType = email ? "private" : "public";

			if (
				inviteType === "private" &&
				!options.sendUserInvitation &&
				!options.sendUserRoleUpgrade
			) {
				ctx.context.logger.warn(
					"Invitation email is not enabled. Pass `sendUserInvitation` to the plugin options to enable it.",
				);
				throw ctx.error("INTERNAL_SERVER_ERROR", {
					message: "Invitation email is not enabled",
				});
			}

			const basicInvitedUser = { email, role };

			const canCreateInvite =
				typeof options.canCreateInvite === "function"
					? await options.canCreateInvite({
							invitedUser: basicInvitedUser,
							inviterUser,
							ctx,
						})
					: options.canCreateInvite;

			if (!canCreateInvite) {
				throw ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
				});
			}

			const adapter = getInviteAdapter(ctx.context, options);

			await options.inviteHooks?.beforeCreateInvite?.({ ctx });

			const invitedUser =
				inviteType === "private"
					? // biome-ignore lint/style/noNonNullAssertion: email is defined if the invite is private
						await ctx.context.internalAdapter.findUserByEmail(email!, {
							includeAccounts: true,
						})
					: null;

			// If the user already exists they should sign in, else they should sign up
			const callbackURL = invitedUser ? redirectToSignIn : redirectToSignUp;

			const invitation = await adapter.createInvite(ctx.body, inviterUser);

			const url = `${ctx.context.baseURL}/invite/${invitation.token}`;
			const redirectURLEmail = `${url}?callbackURL=${encodeURIComponent(callbackURL)}`;

			// If the invite is private, send the invitation or role upgrade using the configured function
			if (inviteType === "private") {
				const newAccount = !invitedUser;

				if (!newAccount && options.sendUserRoleUpgrade) {
					ctx.context.logger.warn(
						"`sendUserRoleUpgrade` is deprecated. Use `sendUserInvitation` instead (it now receives `newAccount`).",
					);
				}

				const sendFn = newAccount
					? options.sendUserInvitation
					: (options.sendUserRoleUpgrade ?? options.sendUserInvitation);

				if (!sendFn) {
					throw ctx.error("INTERNAL_SERVER_ERROR", {
						message: "Invitation email is not enabled",
					});
				}

				try {
					await sendFn(
						{
							// biome-ignore lint/style/noNonNullAssertion: email is guaranteed to exist for private invites
							email: email!,
							name: invitedUser?.user.name,
							role,
							url: redirectURLEmail,
							token: invitation.token,
							newAccount,
						},
						ctx.request,
					);
				} catch (e) {
					ctx.context.logger.error("Error sending the invitation email", e);
					throw ctx.error("INTERNAL_SERVER_ERROR", {
						message: ERROR_CODES.ERROR_SENDING_THE_INVITATION_EMAIL,
					});
				}

				await options.inviteHooks?.afterCreateInvite?.({ ctx, invitation });

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
			const returnToken =
				senderResponse === "token" ? invitation.token : redirectURL;

			await options.inviteHooks?.afterCreateInvite?.({ ctx, invitation });

			return ctx.json({
				status: true,
				message: returnToken,
			});
		},
	);
};
