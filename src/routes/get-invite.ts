import { createAuthEndpoint } from "better-auth/api";
import type { UserWithRole } from "better-auth/plugins";
import * as z from "zod";
import { getInviteAdapter } from "../adapter";
import { ERROR_CODES } from "../constants";
import type { NewInviteOptions } from "../types";
import { optionalSessionMiddleware } from "../utils";

export const getInvite = (options: NewInviteOptions) => {
	return createAuthEndpoint(
		"/invite/get",
		{
			method: "POST",
			use: [optionalSessionMiddleware],
			body: z.object({
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
										},
										required: ["status", "inviter"],
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
			const { token } = ctx.body;

			const adapter = getInviteAdapter(ctx.context, options);

			const invite = await adapter.findInvitation(token);

			const invalid = () =>
				ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.INVALID_TOKEN,
					errorCode: "INVALID_TOKEN",
				});

			if (!invite) {
				throw invalid();
			}

			const sessionObject = ctx.context.session;
			const sessionUser = sessionObject?.user as UserWithRole | null;

			// For private invites (with email), the requester must match the invite email.
			if (invite.email) {
				if (!sessionUser || sessionUser.email !== invite.email) {
					throw invalid();
				}
			}

			if (!invite.createdByUserId) {
				throw invalid();
			}

			const inviter = (await ctx.context.internalAdapter.findUserById(
				invite.createdByUserId,
			)) as UserWithRole | null;

			if (!inviter) {
				throw ctx.error("BAD_REQUEST", {
					message: ERROR_CODES.INVITER_NOT_FOUND,
					errorCode: "INVITER_NOT_FOUND",
				});
			}

			return ctx.json({
				status: true,
				inviter: {
					email: inviter.email,
					name: inviter.name,
					image: inviter.image,
				},
			});
		},
	);
};
