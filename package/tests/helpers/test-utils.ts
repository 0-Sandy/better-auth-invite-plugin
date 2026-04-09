import {
	type BetterAuthClientPlugin,
	type betterAuth,
	resolveBaseURL,
	type Session,
	type User,
} from "better-auth";
import { setCookieToHeader } from "better-auth/cookies";
import { getAdapter } from "better-auth/db/adapter";
import { getMigrations } from "better-auth/db/migration";
import {
	type BetterFetchOption,
	createAuthClient,
	type SuccessContext,
} from "better-auth/react";

// Based in https://github.com/ping-maxwell/better-auth-kit/blob/main/packages/libraries/tests/src/index

interface ClientOptions {
	fetchOptions?: BetterFetchOption;
	plugins?: BetterAuthClientPlugin[];
	baseURL?: string;
	basePath?: string;
	disableDefaultFetchPlugins?: boolean;
}

export async function getTestInstance<C extends ClientOptions>(
	// biome-ignore lint/suspicious/noExplicitAny: same as in original code
	auth_: { api: any; options: any } & Record<string, any>,
	config?: {
		clientOptions?: C;
		port?: number;
		disableTestUser?: boolean;
		testUser?: Partial<User>;
		shouldRunMigrations?: boolean;
	},
) {
	const auth = auth_ as ReturnType<typeof betterAuth>;
	const opts = auth.options;

	const testUser = {
		email: "test@test.com",
		password: "test123456",
		name: "test user",
		...config?.testUser,
	};

	if (config?.shouldRunMigrations) {
		const { runMigrations } = await getMigrations({
			...auth.options,
			database: opts.database,
		});
		await runMigrations();
	}

	async function signUpWithTestUser() {
		if (config?.disableTestUser) {
			throw new Error("Test user is disabled");
		}
		const headers = new Headers();
		const setCookie = (name: string, value: string) => {
			const current = headers.get("cookie");
			headers.set("cookie", `${current || ""}; ${name}=${value}`);
		};
		//@ts-expect-error
		const { data, error } = await client.signUp.email({
			email: testUser.email,
			password: testUser.password,
			name: testUser.name,
			fetchOptions: {
				async onSuccess(context: SuccessContext) {
					setCookieToHeader(headers)(context);
				},
			},
		});
		if (error) {
			console.error(error);
			throw error;
		}
		return {
			session: data.session as Session,
			user: data.user as User,
			headers,
			setCookie,
		};
	}
	async function signInWithTestUser() {
		if (config?.disableTestUser) {
			throw new Error("Test user is disabled");
		}
		const headers = new Headers();
		const setCookie = (name: string, value: string) => {
			const current = headers.get("cookie");
			headers.set("cookie", `${current || ""}; ${name}=${value}`);
		};
		//@ts-expect-error
		const { data, error } = await client.signIn.email({
			email: testUser.email,
			password: testUser.password,
			fetchOptions: {
				onSuccess(context: SuccessContext) {
					setCookieToHeader(headers)(context);
				},
			},
		});
		if (error) {
			console.error(error);
			throw error;
		}
		return {
			session: data.session as Session,
			user: data.user as User,
			headers,
			setCookie,
		};
	}
	async function signInWithUser(email: string, password: string) {
		const headers = new Headers();
		//@ts-expect-error
		const { data } = await client.signIn.email({
			email,
			password,
			fetchOptions: {
				onSuccess(context: SuccessContext) {
					setCookieToHeader(headers)(context);
				},
			},
		});
		return {
			res: data as {
				user: User;
				session: Session;
			},
			headers,
		};
	}

	const customFetchImpl = async (
		url: string | URL | Request,
		init?: RequestInit,
	) => {
		const req = new Request(url.toString(), init);
		return auth.handler(req);
	};

	const ctx = await auth.$context;
	const logger = ctx.logger;

	const client = createAuthClient({
		...(config?.clientOptions as C),
		baseURL: resolveBaseURL(
			opts.baseURL ?? `http://localhost:${config?.port || 3000}`,
			opts.basePath ?? "/api/auth",
		),
		fetchOptions: {
			customFetchImpl,
		},
	});

	async function resetDatabase(
		tables: string[] = ["session", "account", "verification", "user"],
	) {
		const ctx = await auth.$context;
		const adapter = ctx.adapter;
		for (const modelName of tables) {
			const allRows = await adapter.findMany<{ id: string }>({
				model: modelName,
				limit: 1000,
			});
			for (const row of allRows) {
				await adapter.delete({
					model: modelName,
					where: [{ field: "id", value: row.id }],
				});
			}
		}
		console.log("Database successfully reset.");
	}

	return {
		client: client as unknown as ReturnType<typeof createAuthClient<C>>,
		testUser,
		signInWithTestUser,
		signInWithUser,
		cookieSetter: setCookieToHeader,
		customFetchImpl,
		db: await getAdapter(auth.options),
		resetDatabase,
		signUpWithTestUser,
		auth,
		logger,
	};
}

// Based in https://github.com/ping-maxwell/better-auth-kit/blob/main/packages/libraries/tests/src/utils/env.ts

const _envShim = Object.create(null);

export type EnvObject = Record<string, string | undefined>;

const _getEnv = (useShim?: boolean) =>
	globalThis.process?.env ||
	//@ts-expect-error
	globalThis.Deno?.env.toObject() ||
	//@ts-expect-error
	globalThis.__env__ ||
	(useShim ? _envShim : globalThis);

export const env = new Proxy<EnvObject>(_envShim, {
	get(_, prop) {
		const env = _getEnv();
		// biome-ignore lint/suspicious/noExplicitAny: same as in original code
		return env[prop as any] ?? _envShim[prop];
	},
	has(_, prop) {
		const env = _getEnv();
		return prop in env || prop in _envShim;
	},
	set(_, prop, value) {
		const env = _getEnv(true);
		// biome-ignore lint/suspicious/noExplicitAny: same as in original code
		env[prop as any] = value;
		return true;
	},
	deleteProperty(_, prop) {
		if (!prop) {
			return false;
		}
		const env = _getEnv(true);
		// biome-ignore lint/suspicious/noExplicitAny: same as in original code
		delete env[prop as any];
		return true;
	},
	ownKeys() {
		const env = _getEnv(true);
		return Object.keys(env);
	},
});
