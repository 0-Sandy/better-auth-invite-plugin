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
import { checkPermissions, normalizeEmails } from "../utils";

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
						"Reject an invitation. Only available for private invites. Only the invitee (user whose email matches the invite for private invites) can reject it.",
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
				throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_TOKEN);
			}

			const emails = normalizeEmails<string[]>(
				invitation.emails ?? invitation.email,
				[],
			);
			const isPrivate = emails.length > 0;

			// Throws error if the invite is public or if the user email doesn’t match the invite
			if (!isPrivate || !invitation.emails?.includes(inviteeUser.email)) {
				throw APIError.from("BAD_REQUEST", ERROR_CODES.CANT_REJECT_INVITE);
			}

			// Throws error if the invite is already rejected, accepted...
			if (invitation.status !== "pending" && invitation.status !== undefined) {
				throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_TOKEN);
			}

			const canRejectInviteOptions =
				typeof options.canRejectInvite === "function"
					? await options.canRejectInvite({
							inviteeUser,
							invitation,
							ctx,
						})
					: options.canRejectInvite;
			const canRejectInvite =
				typeof canRejectInviteOptions === "object"
					? await checkPermissions(ctx, canRejectInviteOptions)
					: canRejectInviteOptions;

			if (!canRejectInvite) {
				throw APIError.from("BAD_REQUEST", ERROR_CODES.CANT_REJECT_INVITE);
			}

			await options.inviteHooks?.beforeRejectInvite?.({ ctx, invitation });

			if (options.cleanupInvitesOnDecision) {
				await adapter.deleteInviteUses(invitation.id);
				await adapter.deleteInvitation(token);
			} else {
				await adapter.updateInvitation(invitation.id, "rejected");
			}

			await options.inviteHooks?.afterRejectInvite?.({ ctx, invitation });

			return ctx.json({
				status: true,
				message: "Invite rejected successfully",
			});
		},
	);
};
