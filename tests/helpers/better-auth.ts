import { type BetterAuthAdvancedOptions, betterAuth } from "better-auth";
import { adminClient } from "better-auth/client/plugins";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { admin as adminPlugin } from "better-auth/plugins";
import Database from "better-sqlite3";
import { test as baseTest } from "vitest";
import { type InviteClientPlugin, invite, inviteClient } from "../../src";
import type { InviteOptions } from "../../src/types";
import { getTestInstance } from "./test-utils";
import { ac, admin, owner, user } from "./users";

type AdminClientPlugin = ReturnType<typeof adminClient<object>>;

export const test = baseTest.extend<{
	createAuth: (opts: {
		pluginOptions: InviteOptions;
		advancedOptions?: BetterAuthAdvancedOptions;
	}) => ReturnType<
		typeof getTestInstance<{
			plugins: [InviteClientPlugin, AdminClientPlugin];
		}>
	>;
}>({
	createAuth: async ({ task: _task }, use) => {
		const database = new Database(":memory:");

		await use(
			async ({
				pluginOptions,
				advancedOptions,
			}: {
				pluginOptions: InviteOptions;
				advancedOptions?: BetterAuthAdvancedOptions;
			}) => {
				const auth = betterAuth({
					database,
					plugins: [
						adminPlugin({
							ac,
							roles: { user, admin, owner },
							defaultRole: "user",
						}),
						invite(pluginOptions),
					],
					emailAndPassword: { enabled: true },
					advanced: advancedOptions,
				});

				const testInstance = await getTestInstance(auth, {
					shouldRunMigrations: true,
					clientOptions: {
						plugins: [inviteClient(), adminClient()],
					},
				});

				const { db, testUser } = testInstance;

				const { id: userId } = await db.create({
					model: "user",
					data: { ...testUser, role: "user" },
				});

				await db.create({
					model: "account",
					data: {
						password: await hashPassword(testUser.password),
						accountId: generateRandomString(16),
						providerId: "credential",
						userId,
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				});

				return testInstance;
			},
		);

		database.close();
	},
});

export const defaultOptions: InviteOptions = {
	defaultRoleForSignUpWithoutInvite: "user",
	defaultMaxUses: 1,
	defaultRedirectToSignUp: "/auth/sign-up",
	defaultRedirectToSignIn: "/auth/sign-in",
	defaultRedirectAfterUpgrade: "/auth/invited",
};

export async function activateInviteGet(
	// biome-ignore lint/suspicious/noExplicitAny: client doesn't have a specific type here
	client: any,
	{
		token,
		callbackURL,
		fetchOptions: customFetchOptions,
	}: {
		token: string;
		callbackURL: string;
		// biome-ignore lint/suspicious/noExplicitAny: default any type for fetch options
		fetchOptions?: Omit<any, "params">;
	},
): Promise<{
	error: {
		status: number;
		statusText: string;
	} | null;
	newError: {
		error: string | null;
		message: string | null;
	} | null;
	path: string | null;
	data: Record<string, never> | null;
}> {
	let location: string | null = null;

	const res = await client.invite[":token"]({
		query: {
			callbackURL,
		},
		fetchOptions: {
			...customFetchOptions,
			params: {
				token,
			},
			onResponse({ response }: { response: Response }) {
				location = response.headers.get("location");
			},
		},
	});

	if (!location) {
		return res;
	}

	// biome-ignore lint/style/noNonNullAssertion: it will NOT be undefined
	const { params, path } = parseInviteError(location!);

	// We have newError because a redirect to a successful page shouldn't be considered an error
	// newError fixes this
	const newError =
		res.error && !(res.error.status === 302 && !params.error) ? params : null;

	return {
		...res,
		path,
		newError,
	};
}

export async function resolveInviteRedirect(
	// biome-ignore lint/suspicious/noExplicitAny: client endpoint types vary
	call: (args: any) => Promise<any>,
	args: Record<string, unknown>,
): Promise<{
	error: {
		status: number;
		statusText: string;
	} | null;
	newError: {
		error: string | null;
		message: string | null;
	} | null;
	path: string | null;
	data: Record<string, never> | null;
}> {
	let location: string | null = null;

	const res = await call({
		...args,
		fetchOptions: {
			...((args.fetchOptions as Record<string, unknown> | undefined) ?? {}),
			onResponse(ctx: { response: Response }) {
				(
					args.fetchOptions as
						| { onResponse?: (ctx: { response: Response }) => void }
						| undefined
				)?.onResponse?.(ctx);

				location = ctx.response.headers.get("location");
			},
		},
	});

	if (!location) {
		return res;
	}

	const { params, path } = parseInviteError(location);

	const newError =
		res.error && !(res.error.status === 302 && !params.error) ? params : null;

	return {
		...res,
		path,
		newError,
	};
}

function parseInviteError(location: string) {
	const [path, queryString] = location.split("?");
	const params = new URLSearchParams(queryString ?? "");

	return {
		params: {
			error: params.get("error"),
			message: params.get("message"),
		},
		path,
	};
}
