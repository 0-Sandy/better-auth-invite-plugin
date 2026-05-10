import { setCookieToHeader } from "better-auth/cookies";
import { beforeEach, expect, vi } from "vitest";
import type { InviteTypeWithId } from "../src/types";
import {
	acceptInviteGet,
	defaultOptions,
	resolveInviteRedirect,
	test,
} from "./helpers/better-auth";
import mock from "./helpers/mocks";
import { createUser } from "./helpers/users";

beforeEach(() => {
	vi.clearAllMocks();
});

// Accept Invite Callback (GET) Tests

test("test acceptInviteCallback with an invalid token", async ({
	createAuth,
}) => {
	const { client } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const { newError } = await acceptInviteGet(client, {
		token: "invalid_token",
		signInUpUrl: "/auth/sign-in",
	});

	expect(newError).toStrictEqual({
		error: "INVALID_TOKEN",
		message: "Invalid or non-existent token",
	});
});

test("test acceptInviteCallback with maxUses set to 2", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const token = await client.invite.create({
		role: "owner",
		senderResponse: "token",
		maxUses: 2,
		fetchOptions: {
			headers,
		},
	});

	expect(token.error).toBe(null);

	const tokenValue = token.data?.message;
	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "token", value: tokenValue }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}

	const inviteId = invite.id;

	const { newError, path } = await acceptInviteGet(client, {
		token: tokenValue,
		signInUpUrl: "/auth/sign-in",
		fetchOptions: {
			headers,
		},
	});

	expect(newError).toBe(null);

	// We should be redirected to the invited page since we used the invitation successfully
	expect(path).toBe("http://localhost:3000/");

	const newInvite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "token", value: tokenValue }],
	});

	const inviteUses = await db.count({
		model: "inviteUse",
		where: [{ field: "inviteId", value: inviteId }],
	});

	// It should still exist because maxUses is 2
	expect(inviteUses).toBe(1);
	expect(newInvite).not.toBeNull();
});

test("invite and inviteUses are deleted after reaching maxUses", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const token = await client.invite.create({
		role: "owner",
		senderResponse: "token",
		maxUses: 1,
		fetchOptions: {
			headers,
		},
	});

	expect(token.error).toBe(null);

	const tokenValue = token.data?.message;

	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "token", value: tokenValue }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}

	const inviteId = invite.id;

	const { newError, path } = await acceptInviteGet(client, {
		token: tokenValue,
		signInUpUrl: "/auth/sign-in",
		fetchOptions: {
			headers,
		},
	});

	expect(newError).toBe(null);

	// We should be redirected to the invited page since we used the invitation successfully
	expect(path).toBe("http://localhost:3000/");

	const newInvite = await db.findOne({
		model: "invite",
		where: [{ field: "token", value: tokenValue }],
	});

	const inviteUses = await db.count({
		model: "inviteUse",
		where: [{ field: "inviteId", value: inviteId }],
	});

	// The invite should have been marked as used but not deleted and an inviteUse should have been created
	expect(newInvite).toEqual(
		expect.objectContaining({
			status: "used",
		}),
	);
	expect(inviteUses).toBe(1);
});

test("test acceptInvite with an expired invite", async ({ createAuth }) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const token = await client.invite.create({
		role: "owner",
		senderResponse: "token",
		expiresIn: 0,
		fetchOptions: {
			headers,
		},
	});

	expect(token.error).toBe(null);

	const tokenValue = token.data?.message;

	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	const { newError } = await acceptInviteGet(client, {
		token: tokenValue,
		signInUpUrl: "/auth/sign-in",
	});

	// Should throw an error because the invite has expired
	expect(newError).toStrictEqual({
		error: "INVALID_OR_EXPIRED_INVITE",
		message: "Invalid or expired invite code",
	});
});

test("acceptInvite skips login step if already logged in", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
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

	// Create a new user
	await createUser(invitedUser, db);

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const token = await client.invite.create({
		role: "owner",
		senderResponse: "token",
		fetchOptions: {
			headers,
		},
	});

	expect(token.error).toBe(null);

	const { headers: newHeaders } = await signInWithUser(
		invitedUser.email,
		invitedUser.password,
	);
	const tokenValue = token.data?.message;

	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	// We accept the invite while being logged in as the invited user
	const { newError, path } = await acceptInviteGet(client, {
		token: tokenValue,
		signInUpUrl: "/auth/sign-in",
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(newError).toBe(null);
	expect(path).toBe("http://localhost:3000/");
});

test("canAcceptInvite is called if it exists", async ({ createAuth }) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			canAcceptInvite: mock.canAcceptInvite,
		},
	});

	const { headers } = await signInWithTestUser();

	const token = await client.invite.create({
		role: "admin",
		senderResponse: "token",
		fetchOptions: {
			headers,
		},
	});

	expect(token.error).toBe(null);

	if (!token.data?.message) {
		throw new Error("Token value is undefined");
	}

	const { newError } = await acceptInviteGet(client, {
		token: token.data.message,
		signInUpUrl: "/auth/sign-in",
		fetchOptions: {
			headers,
		},
	});

	expect(mock.canAcceptInvite).toHaveBeenCalledOnce();
	// Should throw an error because canAcceptInviteMock returns false
	expect(newError).toStrictEqual({
		error: "CANT_ACCEPT_INVITE",
		message: "You cannot accept this invite",
	});
});

test("onInvitationUsed is called with correct payload", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			onInvitationUsed: mock.onInvitationUsed,
		},
	});

	const invitedUser = {
		email: "test@email.com",
		role: "user",
		name: "Test User",
		password: "12345678",
	};
	const newRole = "admin";

	// Create a new user
	await createUser(invitedUser, db);

	const { headers } = await signInWithTestUser();

	const token = await client.invite.create({
		role: newRole,
		senderResponse: "token",
		fetchOptions: {
			headers,
		},
	});

	expect(token.error).toBe(null);

	const { headers: newHeaders } = await signInWithUser(
		invitedUser.email,
		invitedUser.password,
	);

	const tokenValue = token.data?.message;

	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	const { newError, path } = await acceptInviteGet(client, {
		token: tokenValue,
		signInUpUrl: "/auth/sign-in",
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(newError).toBe(null);
	expect(path).toBe("http://localhost:3000/");

	expect(mock.onInvitationUsed).toHaveBeenCalledOnce();
	expect(mock.onInvitationUsed).toHaveBeenCalledWith(
		expect.objectContaining({
			invitedUser: expect.objectContaining({
				email: invitedUser.email,
				name: invitedUser.name,
				role: invitedUser.role,
			}),
			newUser: expect.objectContaining({
				email: invitedUser.email,
				name: invitedUser.name,
				role: newRole,
			}),
			newAccount: false,
		}),
	);
});

test("accept invite callback hooks run in the correct order with the expected arguments", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			inviteHooks: {
				beforeAcceptInvite: mock.beforeAcceptInvite,
				afterAcceptInvite: mock.afterAcceptInvite,
			},
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

	const token = await client.invite.create({
		role: newRole,
		senderResponse: "token",
		fetchOptions: { headers },
	});

	expect(token.error).toBe(null);

	const { headers: newHeaders } = await signInWithUser(
		invitedUser.email,
		invitedUser.password,
	);

	const tokenValue = token.data?.message;
	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	const { newError, path } = await acceptInviteGet(client, {
		token: tokenValue,
		signInUpUrl: "/auth/sign-in",
		fetchOptions: { headers: newHeaders },
	});

	expect(newError).toBe(null);
	expect(path).toBe("http://localhost:3000/");

	expect(mock.beforeAcceptInvite).toHaveBeenCalledTimes(1);
	expect(mock.afterAcceptInvite).toHaveBeenCalledTimes(1);

	const beforeOrder = mock.beforeAcceptInvite.mock.invocationCallOrder[0];
	const afterOrder = mock.afterAcceptInvite.mock.invocationCallOrder[0];
	expect(beforeOrder).toBeLessThan(afterOrder);

	expect(mock.beforeAcceptInvite).toHaveBeenCalledWith(
		expect.objectContaining({
			ctx: expect.objectContaining({
				path: "/invite/:token",
				method: "GET",
				params: expect.objectContaining({ token: tokenValue }),
				query: expect.objectContaining({
					signInUpUrl: "/auth/sign-in",
				}),
				headers: expect.any(Headers),
			}),
			invitedUser: expect.objectContaining({
				email: invitedUser.email,
				name: invitedUser.name,
				role: invitedUser.role,
			}),
		}),
	);
	expect(mock.afterAcceptInvite).toHaveBeenCalledWith(
		expect.objectContaining({
			ctx: expect.objectContaining({
				path: "/invite/:token",
				method: "GET",
				params: expect.objectContaining({ token: tokenValue }),
				query: expect.objectContaining({
					signInUpUrl: "/auth/sign-in",
				}),
				headers: expect.any(Headers),
			}),
			invitation: expect.objectContaining({
				id: expect.any(String),
				token: tokenValue,
				role: newRole,
				createdAt: expect.any(Date),
				expiresAt: expect.any(Date),
			}),
			invitedUser: expect.objectContaining({
				email: invitedUser.email,
				name: invitedUser.name,
				role: invitedUser.role,
			}),
		}),
	);
});

test("throws error when using different email than invite email", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: () => {},
		},
	});

	const invitedUser = {
		email: "test@email.com",
		role: "user",
		name: "Test User",
		password: "12345678",
	};
	const newRole = "admin";
	const fakeEmail = "nottherealemail@test.com";

	// Create a new user
	await createUser(invitedUser, db);

	const { headers } = await signInWithTestUser();

	const { error } = await client.invite.create({
		role: newRole,
		email: fakeEmail,
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);

	const { headers: newHeaders } = await signInWithUser(
		invitedUser.email,
		invitedUser.password,
	);

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "emails", value: JSON.stringify([fakeEmail]) }],
	});
	const token = invite?.token;

	if (!token) {
		throw new Error("Token value is undefined");
	}

	const { newError } = await acceptInviteGet(client, {
		token,
		signInUpUrl: "/auth/sign-in",
		fetchOptions: {
			headers: newHeaders,
		},
	});

	// Should throw an error because the logged in user's email doesn't match
	expect(newError).toStrictEqual({
		error: "INVALID_EMAIL",
		message: "This token is for a specific email, this is not it",
	});
});

test("test acceptInviteCallback with custom schema", async ({ createAuth }) => {
	const { client, db, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			schema: {
				inviteUse: {
					modelName: "customInvite-use",
				},
				invite: {
					modelName: "custom-invite",
				},
			},
		},
	});

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const token = await client.invite.create({
		role: "owner",
		senderResponse: "token",
		maxUses: 2,
		fetchOptions: {
			headers,
		},
	});

	expect(token.error).toBe(null);

	const tokenValue = token.data?.message;
	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "token", value: tokenValue }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}

	const inviteId = invite.id;

	const { newError, path } = await acceptInviteGet(client, {
		token: tokenValue,
		signInUpUrl: "/auth/sign-in",
		fetchOptions: {
			headers,
		},
	});

	expect(newError).toBe(null);

	// We should be redirected to the invited page since we used the invitation successfully
	expect(path).toBe("http://localhost:3000/");

	const newInvite = await db.findOne<InviteTypeWithId>({
		model: "custom-invite",
		where: [{ field: "token", value: tokenValue }],
	});

	const inviteUses = await db.count({
		model: "customInvite-use",
		where: [{ field: "inviteId", value: inviteId }],
	});

	// It should still exist because maxUses is 2
	expect(inviteUses).toBe(1);
	expect(newInvite).not.toBeNull();
});

test("acceptInviteCallback uses redirectAfterUpgrade", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
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

	// Create a new user
	await createUser(invitedUser, db);

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const token = await client.invite.create({
		role: "owner",
		senderResponse: "token",
		fetchOptions: {
			headers,
		},
	});

	expect(token.error).toBe(null);

	const { headers: newHeaders } = await signInWithUser(
		invitedUser.email,
		invitedUser.password,
	);
	const tokenValue = token.data?.message;

	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	// We accept the invite while being logged in as the invited user
	const { newError, path, params } = await acceptInviteGet(client, {
		token: tokenValue,
		callbackUrl: "/auth/invited?token={token}",
		signInUpUrl: "/auth/sign-in",
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(newError).toBe(null);
	expect(path).toBe("http://localhost:3000/auth/invited");
	expect(params?.get("token")).toBe(tokenValue);
});

test("acceptInviteCallback works with undefined callbackUrl", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
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

	// Create a new user
	await createUser(invitedUser, db);

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const token = await client.invite.create({
		role: "owner",
		senderResponse: "token",
		fetchOptions: {
			headers,
		},
	});

	expect(token.error).toBeNull();

	const { headers: newHeaders } = await signInWithUser(
		invitedUser.email,
		invitedUser.password,
	);
	const tokenValue = token.data?.message;

	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	// We accept the invite while being logged in as the invited user
	const { newError, path } = await acceptInviteGet(client, {
		token: tokenValue,
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(newError).toBeNull();
	expect(path).toBe("http://localhost:3000/");
});

test("works with old email field in db", async ({ createAuth }) => {
	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: () => {},
		},
	});

	const invitedUser = {
		email: "test@email.com",
		role: "user",
		name: "Test User",
		password: "12345678",
	};

	// Create a new user
	await createUser(invitedUser, db);

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const token = await client.invite.create({
		email: invitedUser.email,
		role: "owner",
		fetchOptions: {
			headers,
		},
	});

	expect(token.error).toBe(null);

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "emails", value: JSON.stringify([invitedUser.email]) }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}

	await db.update({
		model: "invite",
		where: [{ field: "id", value: invite.id }],
		update: {
			email: invitedUser.email,
			emails: undefined,
		},
	});

	const tokenValue = invite.token;

	const { headers: newHeaders } = await signInWithUser(
		invitedUser.email,
		invitedUser.password,
	);

	// We accept the invite while being logged in as the invited user
	const { newError, path } = await acceptInviteGet(client, {
		token: tokenValue,
		signInUpUrl: "/auth/sign-in",
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(newError).toBe(null);
	expect(path).toBe("http://localhost:3000/");
});

test("acceptInviteCallback uses custom cookie names", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser, db } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
		advancedOptions: {
			cookies: {
				invite_token: {
					name: "invite_test",
				},
			},
		},
	});

	const invitedUser = {
		email: "test@email.com",
		role: "user",
		name: "Test User",
		password: "12345678",
	};

	// Create a new user
	await createUser(invitedUser, db);

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const token = await client.invite.create({
		role: "owner",
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

	// We accept the invite while being logged in as the invited user
	const { path: acceptPath } = await acceptInviteGet(client, {
		token: tokenValue,
		fetchOptions: {
			async onResponse(context) {
				setCookieToHeader(newHeaders)(context);
			},
		},
	});

	expect(acceptPath).toBe("http://localhost:3000/auth/sign-in");

	const cookieHeader = newHeaders.get("cookie");
	expect(cookieHeader).not.toBeNull();
	expect(cookieHeader?.startsWith("invite_test=")).toBe(true);

	const { path } = await resolveInviteRedirect(client.signIn.email, {
		email: invitedUser.email,
		password: invitedUser.password,
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(path).toBe("http://localhost:3000/");
});
