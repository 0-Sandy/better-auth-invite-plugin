import { beforeEach, expect, vi } from "vitest";
import type { InviteTypeWithId } from "../src/types";
import { activateInviteGet, defaultOptions, test } from "./helpers/better-auth";
import mock from "./helpers/mocks";
import { createUser } from "./helpers/users";

beforeEach(() => {
	vi.clearAllMocks();
});

// Activate Invite Callback (GET) Tests

test("test activateInviteCallback with an invalid token", async ({
	createAuth,
}) => {
	const { client } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const { newError } = await activateInviteGet(client, {
		token: "invalid_token",
		callbackURL: "/auth/sign-in",
	});

	expect(newError).toStrictEqual({
		error: "INVALID_TOKEN",
		message: "Invalid invite token",
	});
});

test("test activateInviteCallback with maxUses set to 2", async ({
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

	const { newError, path } = await activateInviteGet(client, {
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers,
		},
	});

	expect(newError).toBe(null);

	// We should be redirected to the invited page since we used the invitation successfully
	expect(path).toBe("http://localhost:3000/auth/invited");

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

	const { newError, path } = await activateInviteGet(client, {
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers,
		},
	});

	expect(newError).toBe(null);

	// We should be redirected to the invited page since we used the invitation successfully
	expect(path).toBe("http://localhost:3000/auth/invited");

	const newInvite = await db.count({
		model: "invite",
		where: [{ field: "token", value: tokenValue }],
	});

	const inviteUses = await db.count({
		model: "inviteUse",
		where: [{ field: "inviteId", value: inviteId }],
	});

	// They should delete automatically once maxUses is reached
	expect(inviteUses).toBe(0);
	expect(newInvite).toBe(0);
});

test("test activateInvite with an expired invite", async ({ createAuth }) => {
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

	const { newError } = await activateInviteGet(client, {
		token: tokenValue,
		callbackURL: "/auth/sign-in",
	});

	// Should throw an error because the invite has expired
	expect(newError).toStrictEqual({
		error: "INVALID_TOKEN",
		message: "Invite token has expired",
	});
});

test("activateInvite skips login step if already logged in", async ({
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
	createUser(invitedUser, db);

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

	// We activate the invite while being logged in as the invited user
	const { newError, path } = await activateInviteGet(client, {
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(newError).toBe(null);
	expect(path).toBe("http://localhost:3000/auth/invited");
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

	const { newError } = await activateInviteGet(client, {
		token: token.data.message,
		callbackURL: "/auth/sign-in",
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
	createUser(invitedUser, db);

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

	const { newError, path } = await activateInviteGet(client, {
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(newError).toBe(null);
	expect(path).toBe("http://localhost:3000/auth/invited");

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

test("activate invite callback hooks run in the correct order with the expected arguments", async ({
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

	createUser(invitedUser, db);

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

	const { newError, path } = await activateInviteGet(client, {
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: { headers: newHeaders },
	});

	expect(newError).toBe(null);
	expect(path).toBe("http://localhost:3000/auth/invited");

	expect(mock.beforeAcceptInvite).toHaveBeenCalledTimes(1);
	expect(mock.afterAcceptInvite).toHaveBeenCalledTimes(1);

	const beforeOrder = mock.beforeAcceptInvite.mock.invocationCallOrder[0];
	const afterOrder = mock.afterAcceptInvite.mock.invocationCallOrder[0];
	expect(beforeOrder).toBeLessThan(afterOrder);

	expect(mock.beforeAcceptInvite).toHaveBeenCalledWith(
		expect.objectContaining({
			path: "/invite/:token",
			method: "GET",
			params: expect.objectContaining({ token: tokenValue }),
			query: expect.objectContaining({
				callbackURL: "/auth/sign-in",
			}),
			headers: expect.any(Headers),
		}),
		expect.objectContaining({
			email: invitedUser.email,
			name: invitedUser.name,
			role: invitedUser.role,
		}),
	);
	expect(mock.afterAcceptInvite).toHaveBeenCalledWith(
		expect.objectContaining({
			path: "/invite/:token",
		}),
		expect.objectContaining({
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
	createUser(invitedUser, db);

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
		where: [{ field: "email", value: fakeEmail }],
	});
	const token = invite?.token;

	if (!token) {
		throw new Error("Token value is undefined");
	}

	const { newError } = await activateInviteGet(client, {
		token,
		callbackURL: "/auth/sign-in",
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

test("test activateInviteCallback with custom schema", async ({
	createAuth,
}) => {
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

	const { newError, path } = await activateInviteGet(client, {
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers,
		},
	});

	expect(newError).toBe(null);

	// We should be redirected to the invited page since we used the invitation successfully
	expect(path).toBe("http://localhost:3000/auth/invited");

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
