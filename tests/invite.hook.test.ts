import { setCookieToHeader } from "better-auth/cookies";
import { expect } from "vitest";
import {
	defaultOptions,
	resolveInviteRedirect,
	test,
} from "./helpers/better-auth";
import { createUser } from "./helpers/users";

// Invite Hook Tests

test("test invite hook after sign-in/email", async ({ createAuth }) => {
	const { client, db, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const invitedUser = {
		email: "test@email.com",
		role: "user",
		name: "Test User",
		password: "12345678",
	};
	const newRole = "admin";

	await createUser(invitedUser, db);

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const token = await client.invite.create({
		role: newRole,
		senderResponse: "token",
		fetchOptions: {
			headers,
		},
	});

	expect(token.error).toBe(null);

	const tokenValue = token.data?.message;
	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	const newHeaders = new Headers();

	const { error, data } = await client.invite.activate({
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers: newHeaders,
			onSuccess(context) {
				setCookieToHeader(newHeaders)(context);
			},
		},
	});

	expect(data).toStrictEqual({
		status: true,
		message: "Invite activated successfully",
		action: "SIGN_IN_UP_REQUIRED",
		redirectTo: "/auth/sign-in",
	});
	expect(error).toBe(null);

	const { path } = await resolveInviteRedirect(client.signIn.email, {
		email: invitedUser.email,
		password: invitedUser.password,
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(path).toBe("http://localhost:3000/auth/invited");
});

test("invite hook deletes invite cookie after sign-up/email", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const invitedUser = {
		email: "test@email.com",
		name: "Test User",
		password: "12345678",
	};
	const newRole = "admin";

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const token = await client.invite.create({
		role: newRole,
		senderResponse: "token",
		fetchOptions: {
			headers,
		},
	});

	expect(token.error).toBe(null);

	const tokenValue = token.data?.message;
	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	const newHeaders = new Headers();

	const { error, data } = await client.invite.activate({
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers: newHeaders,
			onSuccess(context) {
				setCookieToHeader(newHeaders)(context);
			},
		},
	});

	expect(data).toStrictEqual({
		status: true,
		message: "Invite activated successfully",
		action: "SIGN_IN_UP_REQUIRED",
		redirectTo: "/auth/sign-in",
	});
	expect(error).toBe(null);

	const { path } = await resolveInviteRedirect(client.signUp.email, {
		...invitedUser,
		fetchOptions: {
			headers: newHeaders,
			// Use onResponse, because redirects (302) are treated as errors, so onSuccess won't run.
			onResponse(context) {
				setCookieToHeader(newHeaders)(context);
			},
		},
	});

	expect(newHeaders.get("cookie")).toContain("better-auth.invite_token=;");
	expect(path).toBe("http://localhost:3000/auth/invited");
});

test("invite hook doesn't run if no invite cookie is present", async ({
	createAuth,
}) => {
	const { client } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const testUser2 = {
		email: "test@email.com",
		name: "Test User",
		password: "12345678",
	};

	const headers = new Headers();

	const { error, data } = await resolveInviteRedirect(client.signUp.email, {
		...testUser2,
		fetchOptions: {
			headers,
			onResponse(context) {
				setCookieToHeader(headers)(context);
			},
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		token: expect.any(String),
		user: expect.objectContaining({
			name: testUser2.name,
			email: testUser2.email,
		}),
	});
});
