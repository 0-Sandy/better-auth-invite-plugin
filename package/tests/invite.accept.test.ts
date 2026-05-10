import { beforeEach, expect, vi } from "vitest";
import type { InviteTypeWithId } from "../src/types";
import * as utils from "../src/utils";
import { defaultOptions, test } from "./helpers/better-auth";
import mock from "./helpers/mocks";
import { createUser } from "./helpers/users";

beforeEach(() => {
	vi.clearAllMocks();
});

// accept Invite (POST) Tests

test("test acceptInvite with an invalid token", async ({ createAuth }) => {
	const { client } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});
	const { error } = await client.invite.accept({
		token: "invalid_token",
	});

	// Should throw an error because the invite token is invalid
	expect(error).toStrictEqual({
		code: "UNAUTHORIZED",
		message: "Unauthorized",
		status: 401,
		statusText: "UNAUTHORIZED",
	});
});

test("test acceptInvite with maxUses set to 2", async ({ createAuth }) => {
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

	const { error, data } = await client.invite.accept({
		token: tokenValue,
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		action: "REDIRECT_TO_AFTER_UPGRADE",
		message: "Invite accepted successfully",
		redirectTo: "http://localhost:3000/",
	});

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

	const { error, data } = await client.invite.accept({
		token: tokenValue,
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		action: "REDIRECT_TO_AFTER_UPGRADE",
		message: "Invite accepted successfully",
		redirectTo: "http://localhost:3000/",
	});

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

	const { error } = await client.invite.accept({
		token: tokenValue,
	});

	// Should throw an error because the invite has expired
	expect(error).toStrictEqual({
		code: "UNAUTHORIZED",
		message: "Unauthorized",
		status: 401,
		statusText: "UNAUTHORIZED",
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
	const { error, data } = await client.invite.accept({
		token: tokenValue,
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		action: "REDIRECT_TO_AFTER_UPGRADE",
		message: "Invite accepted successfully",
		redirectTo: "http://localhost:3000/",
	});
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

	const { error } = await client.invite.accept({
		token: token.data.message,
		fetchOptions: {
			headers,
		},
	});

	expect(mock.canAcceptInvite).toHaveBeenCalledOnce();
	// Should throw an error because canAcceptInviteMock returns false
	expect(error).toStrictEqual({
		code: "CANT_ACCEPT_INVITE",
		message: "You cannot accept this invite",
		status: 400,
		statusText: "BAD_REQUEST",
	});
});

test("canAcceptInvite supports Permissions objects", async ({ createAuth }) => {
	const checkPermissionsSpy = vi
		.spyOn(utils, "checkPermissions")
		.mockResolvedValue(false);

	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			canAcceptInvite: {
				statement: "invite",
				permissions: ["accept"],
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
	createUser(invitedUser, db);

	const { headers } = await signInWithTestUser();

	const token = await client.invite.create({
		role: "admin",
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

	const res = await client.invite.accept({
		token: tokenValue,
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(checkPermissionsSpy).toHaveBeenCalledOnce();
	expect(res.data).toBeNull();
	expect(res.error).toStrictEqual({
		code: "CANT_ACCEPT_INVITE",
		message: "You cannot accept this invite",
		status: 400,
		statusText: "BAD_REQUEST",
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

	const { error, data } = await client.invite.accept({
		token: tokenValue,
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		action: "REDIRECT_TO_AFTER_UPGRADE",
		message: "Invite accepted successfully",
		redirectTo: "http://localhost:3000/",
	});

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

test("accept invite hooks run in the correct order with the expected arguments", async ({
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

	const { error, data } = await client.invite.accept({
		token: tokenValue,
		fetchOptions: { headers: newHeaders },
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		action: "REDIRECT_TO_AFTER_UPGRADE",
		message: "Invite accepted successfully",
		redirectTo: "http://localhost:3000/",
	});

	expect(mock.beforeAcceptInvite).toHaveBeenCalledTimes(1);
	expect(mock.afterAcceptInvite).toHaveBeenCalledTimes(1);

	const beforeOrder = mock.beforeAcceptInvite.mock.invocationCallOrder[0];
	const afterOrder = mock.afterAcceptInvite.mock.invocationCallOrder[0];
	expect(beforeOrder).toBeLessThan(afterOrder);

	expect(mock.beforeAcceptInvite).toHaveBeenCalledWith(
		expect.objectContaining({
			ctx: expect.objectContaining({
				path: "/invite/accept",
				method: "POST",
				body: expect.objectContaining({
					token: tokenValue,
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
				path: "/invite/accept",
				method: "POST",
				body: expect.objectContaining({
					token: tokenValue,
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

	const res = await client.invite.create({
		role: newRole,
		email: fakeEmail,
		fetchOptions: {
			headers,
		},
	});

	expect(res.error).toBe(null);

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

	const { error } = await client.invite.accept({
		token,
		fetchOptions: {
			headers: newHeaders,
		},
	});

	// Should throw an error because the logged in user's email doesn't match
	expect(error).toStrictEqual({
		code: "INVALID_EMAIL",
		message: "This token is for a specific email, this is not it",
		status: 400,
		statusText: "BAD_REQUEST",
	});
});

test("test acceptInvite with custom schema", async ({ createAuth }) => {
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

	const { error, data } = await client.invite.accept({
		token: tokenValue,
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		action: "REDIRECT_TO_AFTER_UPGRADE",
		message: "Invite accepted successfully",
		redirectTo: "http://localhost:3000/",
	});

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

test("test acceptInvite with infiniteMaxUses", async ({ createAuth }) => {
	const { client, db, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			defaultMaxUses: undefined,
		},
	});

	const { headers } = await signInWithTestUser();

	// MaxUses should be Infinite, because the invite is public and we are not overwriting the default value
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

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "token", value: tokenValue }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}

	expect(invite.infinityMaxUses).toBe(true);

	const inviteId = invite.id;

	const { error, data } = await client.invite.accept({
		token: tokenValue,
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		action: "REDIRECT_TO_AFTER_UPGRADE",
		message: "Invite accepted successfully",
		redirectTo: "http://localhost:3000/",
	});

	const newInvite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "token", value: tokenValue }],
	});

	const inviteUses = await db.count({
		model: "inviteUse",
		where: [{ field: "inviteId", value: inviteId }],
	});

	// It should still exist because maxUses is infinite
	expect(inviteUses).toBe(1);
	expect(newInvite).toMatchObject({
		token: tokenValue,
		status: "pending",
		infinityMaxUses: true,
	});
});

test("acceptInvite uses callbackUrl", async ({ createAuth }) => {
	const { client, signInWithTestUser, signInWithUser, db } = await createAuth({
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
	const tokenValue = token.data?.message;

	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	const { headers: newHeaders } = await signInWithUser(
		invitedUser.email,
		invitedUser.password,
	);

	// We accept the invite while being logged in as the invited user
	const { error, data } = await client.invite.accept({
		token: tokenValue,
		callbackUrl: "/auth/invited/{token}",
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(error).toBeNull();
	expect(data).toStrictEqual({
		status: true,
		action: "REDIRECT_TO_AFTER_UPGRADE",
		message: "Invite accepted successfully",
		redirectTo: `/auth/invited/${tokenValue}`,
	});
});

test("acceptInvite supports no redirectAfterUpgrade", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser, signInWithUser, db } = await createAuth({
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
	const tokenValue = token.data?.message;

	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	const { headers: newHeaders } = await signInWithUser(
		invitedUser.email,
		invitedUser.password,
	);

	// We accept the invite while being logged in as the invited user
	const { error, data } = await client.invite.accept({
		token: tokenValue,
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(error).toBeNull();
	expect(data).toStrictEqual({
		status: true,
		action: "REDIRECT_TO_AFTER_UPGRADE",
		message: "Invite accepted successfully",
		redirectTo: "http://localhost:3000/",
	});
});

test("cannot reuse an invite after it has already been used", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const invitedUser = {
		email: "reuse@email.com",
		role: "user",
		name: "Reuse User",
		password: "12345678",
	};

	await createUser(invitedUser, db);

	const { headers } = await signInWithTestUser();

	// Create invite with maxUses = 1
	const tokenRes = await client.invite.create({
		role: "admin",
		senderResponse: "token",
		maxUses: 1,
		fetchOptions: { headers },
	});

	expect(tokenRes.error).toBeNull();

	const tokenValue = tokenRes.data?.message;
	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	const { headers: invitedHeaders } = await signInWithUser(
		invitedUser.email,
		invitedUser.password,
	);

	// First activation (should succeed)
	const firstUse = await client.invite.accept({
		token: tokenValue,
		fetchOptions: { headers: invitedHeaders },
	});

	expect(firstUse.error).toBeNull();
	expect(firstUse.data).toStrictEqual({
		status: true,
		action: "REDIRECT_TO_AFTER_UPGRADE",
		message: "Invite accepted successfully",
		redirectTo: "http://localhost:3000/",
	});

	// Second activation (should fail)
	const secondUse = await client.invite.accept({
		token: tokenValue,
		fetchOptions: { headers: invitedHeaders },
	});

	expect(secondUse.data).toBeNull();
	expect(secondUse.error).not.toBeNull();

	// Optional: si tu implementación marca el invite como "used"
	const invite = await db.findOne({
		model: "invite",
		where: [{ field: "token", value: tokenValue }],
	});

	expect(invite).toEqual(
		expect.objectContaining({
			status: "used",
		}),
	);
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
	const newRole = "admin";

	await createUser(invitedUser, db);

	const { headers } = await signInWithTestUser();

	const token = await client.invite.create({
		email: invitedUser.email,
		role: newRole,
		fetchOptions: { headers },
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

	const { error, data } = await client.invite.accept({
		token: tokenValue,
		fetchOptions: { headers: newHeaders },
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		action: "REDIRECT_TO_AFTER_UPGRADE",
		message: "Invite accepted successfully",
		redirectTo: "http://localhost:3000/",
	});
});

test("private invite includes email in default redirect URL", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: mock.sendUserInvitation,
		},
	});

	const email = "test@email.com";

	const { headers } = await signInWithTestUser();

	await client.invite.create({
		role: "user",
		email,
		fetchOptions: { headers },
	});

	const call = mock.sendUserInvitation.mock.calls[0][0];
	const url = call.url;

	expect(url).toContain("/invite/");
	expect(url).toContain("signInUpUrl=");
	expect(url).toContain(`email=${encodeURIComponent(email)}`);
});

test("private invite includes email in custom invite URL", async ({
	createAuth,
}) => {
	const customInviteUrl =
		"/invite/{token}?redirect={signInUpUrl}&email={email}";

	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: mock.sendUserInvitation,
		},
	});

	const email = "test@email.com";

	const { headers } = await signInWithTestUser();

	await client.invite.create({
		role: "user",
		email,
		customInviteUrl,
		fetchOptions: { headers },
	});

	const call = mock.sendUserInvitation.mock.calls[0][0];
	const url = call.url;

	expect(url).toContain(`/invite/`);
	expect(url).toContain(`email=${encodeURIComponent(email)}`);

	expect(url).not.toContain("{email}");
	expect(url).not.toContain("{token}");
	expect(url).not.toContain("{signInUpUrl}");
});
