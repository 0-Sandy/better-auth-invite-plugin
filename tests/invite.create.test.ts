import { beforeEach, expect, vi } from "vitest";
import type { InviteTypeWithId } from "../src/types";
import { defaultOptions, test } from "./helpers/better-auth";
import mock from "./helpers/mocks";
import { createUser } from "./helpers/users";

beforeEach(() => {
	vi.clearAllMocks();
});

// Activate Invite Tests

test("test warn when using sendUserRoleUpgrade", async ({ createAuth }) => {
	const { client, db, signInWithTestUser, logger } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: (data, request) =>
				mock.sendUserInvitation(data, request),
			sendUserRoleUpgrade: (data, request) =>
				mock.sendUserRoleUpgrade(data, request),
		},
	});

	const warnSpy = vi.spyOn(logger, "warn");

	const invitedUser = {
		email: "test@email.com",
		role: "user",
		name: "Test User",
		password: "12345678",
	};

	// Create a new user
	await createUser(invitedUser, db);

	const { headers } = await signInWithTestUser();

	// This should be a user creation, because that user doesn't exist
	const { error } = await client.invite.create({
		role: "user",
		email: invitedUser.email,
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);

	expect(mock.sendUserRoleUpgrade).toHaveBeenCalledOnce();
	expect(mock.sendUserRoleUpgrade).toHaveBeenCalledWith(
		expect.objectContaining({
			email: invitedUser.email,
			name: invitedUser.name,
			role: "user",
		}),
		expect.anything(),
	);

	expect(warnSpy).toHaveBeenCalledWith(
		"`sendUserRoleUpgrade` is deprecated. Use `sendUserInvitation` instead (it now receives `newAccount`).",
	);
});

test("uses sendUserInvitation when invited user does not exist", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: (data, request) =>
				mock.sendUserInvitation(data, request),
		},
	});

	const { headers } = await signInWithTestUser();

	// This should be a user creation, because that user doesn't exist
	const { error } = await client.invite.create({
		role: "user",
		email: "test@email.com",
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);

	// The sendUserInvitationMock should have been called
	expect(mock.sendUserInvitation).toHaveBeenCalledOnce();
	expect(mock.sendUserInvitation).toHaveBeenCalledWith(
		expect.objectContaining({
			email: "test@email.com",
			role: "user",
			newAccount: true,
		}),
		expect.anything(),
	);
});

test("uses sendUserRoleUpgrade when invited user exists", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: (data, request) =>
				mock.sendUserInvitation(data, request),
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
	const { error } = await client.invite.create({
		role: "user",
		email: invitedUser.email,
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);

	// The sendUserRoleUpgradeMock should have been called
	expect(mock.sendUserInvitation).toHaveBeenCalledOnce();
	expect(mock.sendUserInvitation).toHaveBeenCalledWith(
		expect.objectContaining({
			email: invitedUser.email,
			name: invitedUser.name,
			role: "user",
			newAccount: false,
		}),
		expect.anything(),
	);
});

test("throws error when sendUserInvitation doesn't exist but the invite is private", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const invitedUserEmail = "test@email.com";

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const { error } = await client.invite.create({
		role: "user",
		email: invitedUserEmail,
		fetchOptions: {
			headers,
		},
	});

	// Should throw an error because no sending function is configured
	expect(error).toStrictEqual({
		code: "INVITATION_EMAIL_IS_NOT_ENABLED",
		message: "Invitation email is not enabled",
		status: 500,
		statusText: "INTERNAL_SERVER_ERROR",
	});
});

test("catches invitation email error and responds with 500", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: (data, request) =>
				mock.sendUserInvitationWithError(data, request),
		},
	});

	const invitedUserEmail = "test@email.com";

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const { error } = await client.invite.create({
		role: "user",
		email: invitedUserEmail,
		fetchOptions: {
			headers,
		},
	});

	// Should throw an error because sending the email failed
	expect(error).toStrictEqual({
		code: "ERROR_SENDING_THE_INVITATION_EMAIL",
		message: "Error sending the invitation email",
		status: 500,
		statusText: "INTERNAL_SERVER_ERROR",
	});
});

// Tokens

test("generateToken should be used if it exists", async ({ createAuth }) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			generateToken: () => mock.generateToken(),
		},
	});

	const { headers } = await signInWithTestUser();

	// canCreateInviteMock should be called because it exists and it overrides
	// default behavior
	const { error, data } = await client.invite.create({
		role: "user",
		senderResponse: "token",
		tokenType: "custom", // Use generateToken function
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);

	// The generateTokenMock should have been called to generate the token
	expect(mock.generateToken).toHaveBeenCalledOnce();
	expect(data?.message).toBe(mock.test_token);
});

// Get Date

test("getDate should be used if it exists", async ({ createAuth }) => {
	const { client, db, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			getDate: () => mock.getDate(),
			sendUserInvitation: async () => {},
		},
	});

	const invitedUserEmail = "test@email.com";

	const { headers } = await signInWithTestUser();

	// canCreateInviteMock should be called because it exists and it overrides
	// default behavior
	const { error } = await client.invite.create({
		role: "user",
		email: invitedUserEmail,
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "email", value: invitedUserEmail }],
	});

	// The getDateMock should have been called to set createdAt
	expect(mock.getDate).toHaveBeenCalledOnce();
	expect(invite?.createdAt).toStrictEqual(mock.test_date);
});

test("returns URL when senderResponse is url", async ({ createAuth }) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			defaultSenderResponse: "url",
		},
	});

	const { headers } = await signInWithTestUser();

	const { error, data } = await client.invite.create({
		role: "user",
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);
	expect(data?.message).toContain("/invite/");
	expect(data?.message).toContain("callbackURL=");
});

test("respects defaultSenderResponseRedirect = signIn", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			defaultSenderResponseRedirect: "signIn",
			defaultRedirectToSignIn: "/auth/test",
		},
	});

	const { headers } = await signInWithTestUser();

	const { error, data } = await client.invite.create({
		role: "user",
		senderResponse: "url",
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);

	expect(data?.message).toContain("/auth/test");
});

test("tokenType=code generates a short token", async ({ createAuth }) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const { headers } = await signInWithTestUser();

	const { error, data } = await client.invite.create({
		role: "user",
		tokenType: "code",
		senderResponse: "token",
		fetchOptions: { headers },
	});

	expect(error).toBe(null);

	expect(data?.message).toHaveLength(6);
});

test("shareInviterName is stored correctly", async ({ createAuth }) => {
	const { client, db, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			defaultShareInviterName: false,
			sendUserInvitation: async () => {},
		},
	});

	const { headers } = await signInWithTestUser();

	const { error } = await client.invite.create({
		role: "user",
		email: "share@test.com",
		fetchOptions: { headers },
	});

	expect(error).toBe(null);

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "email", value: "share@test.com" }],
	});

	// Make sure we respect privacy, the person who sent the invite shouldn’t be shown
	expect(invite?.shareInviterName).toBe(false);
});
