import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import type { UserWithRole } from "better-auth/plugins";
import * as z from "zod";
import { getInviteAdapter } from "../adapter";
import { ERROR_CODES } from "../constants";
import type { NewInviteOptions } from "../types";

export const rejectInvite = (options: NewInviteOptions) => {
	return createAuthEndpoint(
		"/invite/reject",
		{
			method: "POST",
			use: [sessionMiddleware],
			body: z.object({
				/**
				 * The invite token to reject.
				 */
				token: z.string().describe("The invite token to reject."),
			}),
			metadata: {
				openapi: {
					operationId: "rejectInvite",
					description:
						"Reject an invitation. Only the invitee (user whose email matches the invite for private invites) can reject it.",
					responses: {
						"200": {
							description: "Invite rejected successfully",
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
												example: "Invite rejected successfully",
											},
										},
										required: ["status", "message"],
									},
								},
							},
						},
						"400": {
							description:
								"Invalid token or user does not have permission to reject this invite",
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
			const inviteeUser = ctx.context.session.user as UserWithRole;

			const adapter = getInviteAdapter(ctx.context, options);

			const invitation = await adapter.findInvitation(token);

			if (!invitation) {
				throw ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.INVALID_TOKEN,
					errorCode: "INVALID_TOKEN",
				});
			}

			const inviteType = invitation.email ? "private" : "public";

			if (inviteType === "public" || invitation.email !== inviteeUser.email) {
				throw ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.CANT_REJECT_INVITE,
					errorCode: "CANT_REJECT_INVITE",
				});
			}

			const canRejectInvite =
				typeof options.canRejectInvite === "function"
					? await options.canRejectInvite({
							inviteeUser,
							invitation,
							ctx,
						})
					: options.canRejectInvite;

			if (!canRejectInvite) {
				throw ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.CANT_REJECT_INVITE,
					errorCode: "CANT_REJECT_INVITE",
				});
			}

			await options.inviteHooks?.beforeRejectInvite?.({ ctx, invitation });

			await adapter.deleteInviteUses(invitation.id);
			await adapter.deleteInvitation(token);

			await options.inviteHooks?.afterRejectInvite?.({ ctx, invitation });

			return ctx.json({
				status: true,
				message: "Invite rejected successfully",
			});
		},
	);
};
