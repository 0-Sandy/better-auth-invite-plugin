import { setCookieToHeader } from "better-auth/cookies";
import { beforeEach, expect, vi } from "vitest";
import type { InviteTypeWithId } from "../src/types";
import {
	defaultOptions,
	resolveInviteRedirect,
	test,
} from "./helpers/better-auth";
import mock from "./helpers/mocks";
import { createUser } from "./helpers/users";

beforeEach(() => {
	vi.clearAllMocks();
});

// Activate Invite (POST) Tests

test("test activateInvite with an invalid token", async ({ createAuth }) => {
	const { client } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});
	const { error } = await client.invite.activate({
		token: "invalid_token",
		callbackURL: "/auth/sign-in",
	});

	// Should throw an error because the invite token is invalid
	expect(error).toStrictEqual({
		code: "INVALID_INVITE_TOKEN",
		message: "Invalid invite token",
		errorCode: "INVALID_TOKEN",
		status: 400,
		statusText: "BAD_REQUEST",
	});
});

test("test activateInvite with maxUses set to 2", async ({ createAuth }) => {
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

	const { error, data } = await client.invite.activate({
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		message: "Invite activated successfully",
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

	const { error, data } = await client.invite.activate({
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		message: "Invite activated successfully",
	});

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

	const { error } = await client.invite.activate({
		token: tokenValue,
		callbackURL: "/auth/sign-in",
	});

	// Should throw an error because the invite has expired
	expect(error).toStrictEqual({
		code: "INVITE_TOKEN_HAS_EXPIRED",
		message: "Invite token has expired",
		errorCode: "INVALID_TOKEN",
		status: 400,
		statusText: "BAD_REQUEST",
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
	const { error, data } = await client.invite.activate({
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		message: "Invite activated successfully",
	});
});

test("activateInvite uses custom cookie names", async ({ createAuth }) => {
	const { client, signInWithTestUser, db } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
		advancedOptions: {
			cookiePrefix: "testtt",
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
	const tokenValue = token.data?.message;

	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	const newHeaders = new Headers();

	// We activate the invite while being logged in as the invited user
	const { error, data } = await client.invite.activate({
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			async onResponse(context) {
				setCookieToHeader(newHeaders)(context);
			},
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		message: "Invite activated successfully",
		action: "SIGN_IN_UP_REQUIRED",
		redirectTo: "/auth/sign-in",
	});

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

	const { error } = await client.invite.activate({
		token: token.data.message,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers,
		},
	});

	expect(mock.canAcceptInvite).toHaveBeenCalledOnce();
	// Should throw an error because canAcceptInviteMock returns false
	expect(error).toStrictEqual({
		code: "YOU_CANNOT_ACCEPT_THIS_INVITE",
		errorCode: "CANT_ACCEPT_INVITE",
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

	const { error, data } = await client.invite.activate({
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers: newHeaders,
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		message: "Invite activated successfully",
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
		where: [{ field: "email", value: fakeEmail }],
	});
	const token = invite?.token;

	if (!token) {
		throw new Error("Token value is undefined");
	}

	const { error } = await client.invite.activate({
		token,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers: newHeaders,
		},
	});

	// Should throw an error because the logged in user's email doesn't match
	expect(error).toStrictEqual({
		code: "THIS_TOKEN_IS_FOR_A_SPECIFIC_EMAIL_THIS_IS_NOT_IT",
		errorCode: "INVALID_EMAIL",
		message: "This token is for a specific email, this is not it",
		status: 400,
		statusText: "BAD_REQUEST",
	});
});

test("test activateInvite with custom schema", async ({ createAuth }) => {
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

	const { error, data } = await client.invite.activate({
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		message: "Invite activated successfully",
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

test("test activateInvite with infinite maxUses", async ({ createAuth }) => {
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

	expect(invite.maxUses).toBe(Infinity);

	const inviteId = invite.id;

	const { error, data } = await client.invite.activate({
		token: tokenValue,
		callbackURL: "/auth/sign-in",
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);
	expect(data).toStrictEqual({
		status: true,
		message: "Invite activated successfully",
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
	expect(newInvite).not.toBeNull();
});
