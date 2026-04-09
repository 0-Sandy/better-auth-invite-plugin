import { createAuthEndpoint, originCheck } from "better-auth/api";
import * as z from "zod";
import type { NewInviteOptions } from "../types";
import { redirectCallback, redirectError } from "../utils";
import { activateInviteLogic } from "./activate-invite";

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
			use: [originCheck((ctx) => ctx.query.callbackURL)],
			query: z.object({
				/**
				 * Where to redirect the user after sing in/up
				 */
				callbackURL: z
					.string()
					.describe("Where to redirect the user after sing in/up")
					.optional(),
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
			let res: Awaited<ReturnType<typeof activateInviteLogic>> | null = null;
			try {
				res = await activateInviteLogic(options, ctx, ctx.params);
			} catch (e) {
				const err = e as
					| { body?: { code?: string; message?: string } }
					| undefined;

				const error = err?.body?.code ?? "SERVER_ERROR";
				const message = err?.body?.message ?? "Internal server error";

				return ctx.redirect(
					redirectError(ctx.context, ctx.query.callbackURL, { message, error }),
				);
			}

			if (!res) {
				return;
			}

			if (res.action === "REDIRECT_TO_AFTER_UPGRADE" && res.redirectTo) {
				const redirectURL = res.redirectTo?.replace(
					"{token}",
					ctx.params.token,
				);
				return ctx.redirect(redirectError(ctx.context, redirectURL));
			}

			if (res.action === "SIGN_IN_UP_REQUIRED")
				return ctx.redirect(
					redirectCallback(
						ctx.context,
						res.redirectTo ?? options.defaultRedirectToSignIn,
					),
				);

			// Fallback (unknown error)
			redirectError(ctx.context, ctx.query.callbackURL, {
				message: "Internal server error",
				error: "SERVER_ERROR",
			});
		},
	);
};
