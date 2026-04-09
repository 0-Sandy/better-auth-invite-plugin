import {
	APIError,
	createAuthEndpoint,
	sessionMiddleware,
} from "better-auth/api";
import type { UserWithRole } from "better-auth/plugins";
import * as z from "zod";
import { getInviteAdapter } from "../adapter";
import { ERROR_CODES } from "../constants";
import type { NewInviteOptions } from "../types";
import { checkPermissions } from "../utils";

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

			const invitation = await adapter.findInvitation(token);

			if (!invitation) {
				throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_TOKEN);
			}

			if (invitation.createdByUserId !== inviterUser.id) {
				throw APIError.from(
					"BAD_REQUEST",
					ERROR_CODES.INSUFFICIENT_PERMISSIONS,
				);
			}

			if (invitation.status !== "pending" && invitation.status !== undefined) {
				throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_TOKEN);
			}

			const canCancelInviteOption =
				typeof options.canCancelInvite === "function"
					? await options.canCancelInvite({
							inviterUser,
							invitation,
							ctx,
						})
					: options.canCancelInvite;
			const canCancelInvite =
				typeof canCancelInviteOption === "object"
					? await checkPermissions(ctx, canCancelInviteOption)
					: canCancelInviteOption;

			if (!canCancelInvite) {
				throw APIError.from(
					"BAD_REQUEST",
					ERROR_CODES.INSUFFICIENT_PERMISSIONS,
				);
			}

			await options.inviteHooks?.beforeCancelInvite?.({ ctx, invitation });

			if (options.cleanupInvitesOnDecision) {
				await adapter.deleteInviteUses(invitation.id);
				await adapter.deleteInvitation(token);
			} else {
				await adapter.updateInvitation(invitation.id, "canceled");
			}

			await options.inviteHooks?.afterCancelInvite?.({ ctx, invitation });

			return ctx.json({
				status: true,
				message: "Invite cancelled successfully",
			});
		},
	);
};
