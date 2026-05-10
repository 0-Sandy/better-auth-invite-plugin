import { createAuthEndpoint, originCheck } from "better-auth/api";
import * as z from "zod";
import { fullDefaultRedirectAfterUpgrade } from "../constants";
import type { NewInviteOptions } from "../types";
import { acceptInviteLogic } from "./accept-invite";

let alreadyWarned = false;

/**
 * @deprecated Use accept invite endpoint instead, which has the same logic but works only with authenticated users
 * this to make accept invite match the flow of reject invite. Now only accept invite callback supports both authenticated and non-authenticated users.
 */
export const activateInvite = (options: NewInviteOptions) => {
	return createAuthEndpoint(
		"/invite/activate",
		{
			method: "POST",
			use: [
				originCheck((ctx) => ctx.body.callbackUrl),
				originCheck((ctx) => ctx.body.signInUpUrl),
			],
			body: z.object({
				/**
				 * Where to redirect the user after activating the invite.
				 * {token} will be replaced by the actual token in the request body.
				 *
				 * @default http://localhost:3000/
				 */
				callbackUrl: z
					.string()
					.describe(
						"Where to redirect the user after activating the invite. {token} will be replaced by the actual token in the request body.",
					)
					.default(fullDefaultRedirectAfterUpgrade),
				/**
				 * Where to redirect the user to sign in/up.
				 * {callbackUrl} will be replaced by the actual callbackUrl in the request body.
				 */
				signInUpUrl: z
					.string()
					.describe("The URL of the sign in/up page.")
					.optional(),
				/**
				 * The invite token.
				 */
				token: z.string().describe("The invite token"),
				/**
				 * The email address of the user to sign in/up to.
				 */
				email: z
					.email()
					.optional()
					.describe("The email address of the user to sign in/up to"),
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
											email: {
												type: "string",
												example: "user@example.com",
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
		(ctx) => {
			if (!alreadyWarned) {
				ctx.context.logger.warn(
					"Activate invite is deprecated. Use accept invite instead.",
				);
				alreadyWarned = true;
			}

			return acceptInviteLogic(options, ctx, ctx.body);
		},
	);
};
