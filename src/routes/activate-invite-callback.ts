import type { Status, statusCodes } from "better-auth";
import { createAuthEndpoint, originCheck } from "better-auth/api";
import * as z from "zod";
import type { afterUpgradeTypes, NewInviteOptions } from "../types";
import {
	optionalSessionMiddleware,
	redirectCallback,
	redirectError,
	redirectToAfterUpgrade,
} from "../utils";
import { activateInviteLogic } from "./activate-invite-logic";

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
