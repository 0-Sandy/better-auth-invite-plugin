import {
	APIError,
	createAuthEndpoint,
	getSessionFromCtx,
} from "better-auth/api";
import type { UserWithRole } from "better-auth/plugins";
import * as z from "zod";
import { getInviteAdapter } from "../adapter";
import { ERROR_CODES } from "../constants";
import type { NewInviteOptions } from "../types";
import { normalizeEmails } from "../utils";

export const getInvite = (options: NewInviteOptions) => {
	return createAuthEndpoint(
		"/invite/get",
		{
			method: "GET",
			query: z.object({
				/**
				 * The invite token to look up.
				 */
				token: z.string().describe("The invite token to look up."),
			}),
			metadata: {
				openapi: {
					operationId: "getInvite",
					description:
						"Get basic information about an invitation, including inviter details. For private invites, the requester must match the invite email.",
					responses: {
						"200": {
							description: "Invite found",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											status: {
												type: "boolean",
												example: true,
											},
											inviter: {
												type: "object",
												properties: {
													email: { type: "string" },
													name: { type: "string", nullable: true },
													image: { type: "string", nullable: true },
												},
											},
											invitation: {
												type: "object",
												properties: {
													email: { type: "string", nullable: true },
													emails: { type: "string[]" },
													createdAt: { type: "string", format: "date-time" },
													role: { type: "string" },
													newAccount: { type: "boolean" },
												},
											},
										},
										required: ["status", "inviter", "invitation"],
									},
								},
							},
						},
						"400": {
							description: "Invalid or non-existent invite token",
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
			const { token } = ctx.query;

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

			const session = await getSessionFromCtx(ctx);
			const sessionUser = session?.user as UserWithRole | null;

			// For private invites, the requester must exist, match the invite email, and the invite must have a creator.
			if (
				(isPrivate && (!sessionUser || !emails?.includes(sessionUser.email))) ||
				!invitation.createdByUserId
			) {
				throw APIError.from("BAD_REQUEST", ERROR_CODES.INVALID_TOKEN);
			}

			const inviter = (await ctx.context.internalAdapter.findUserById(
				invitation.createdByUserId,
			)) as UserWithRole | null;

			if (!inviter) {
				throw APIError.from("BAD_REQUEST", ERROR_CODES.INVITER_NOT_FOUND);
			}

			return ctx.json({
				status: true,
				inviter: {
					email: inviter.email,
					name: inviter.name,
					image: inviter.image,
				},
				invitation: {
					email: invitation.email,
					emails,
					createdAt: invitation.createdAt,
					role: invitation.role,
					newAccount: invitation.newAccount,
				},
			});
		},
	);
};
