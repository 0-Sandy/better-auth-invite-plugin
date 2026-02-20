import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import type { UserWithRole } from "better-auth/plugins";
import * as z from "zod";
import { getInviteAdapter } from "../adapter";
import { ERROR_CODES } from "../constants";
import type { NewInviteOptions } from "../types";

export const cancelInvite = (options: NewInviteOptions) => {
	return createAuthEndpoint(
		"/invite/cancel",
		{
			method: "POST",
			use: [sessionMiddleware],
			body: z.object({
				/**
				 * The invite token to cancel.
				 */
				token: z.string().describe("The invite token to cancel."),
			}),
			metadata: {
				openapi: {
					operationId: "cancelInvite",
					description:
						"Cancel an invitation. Only the user that created the invite can cancel it.",
					responses: {
						"200": {
							description: "Invite cancelled successfully",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											status: {
												type: "boolean",
												example: true,
											},
											message: {
												type: "string",
												example: "Invite cancelled successfully",
											},
										},
										required: ["status", "message"],
									},
								},
							},
						},
						"400": {
							description:
								"Invalid token or user does not have permission to cancel this invite",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											message: { type: "string" },
											errorCode: { type: "string" },
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
			const { token } = ctx.body;
			const inviterUser = ctx.context.session.user as UserWithRole;

			const adapter = getInviteAdapter(ctx.context, options);

			const invite = await adapter.findInvitation(token);

			if (!invite) {
				throw ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.INVALID_TOKEN,
					errorCode: "INVALID_TOKEN",
				});
			}

			if (invite.createdByUserId !== inviterUser.id) {
				throw ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
					errorCode: "INSUFFICIENT_PERMISSIONS",
				});
			}

			const canCancelInvite =
				typeof options.canCancelInvite === "function"
					? await options.canCancelInvite({
							inviterUser,
							invite,
							ctx,
						})
					: options.canCancelInvite;

			if (!canCancelInvite) {
				throw ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
					errorCode: "INSUFFICIENT_PERMISSIONS",
				});
			}

			await options.inviteHooks?.beforeCancelInvite?.(ctx, invite);

			await adapter.deleteInviteUses(invite.id);
			await adapter.deleteInvitation(token);

			await options.inviteHooks?.afterCancelInvite?.(ctx, invite);

			return ctx.json({
				status: true,
				message: "Invite cancelled successfully",
			});
		},
	);
};
