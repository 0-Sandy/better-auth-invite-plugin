import { beforeEach, expect, vi } from "vitest";
import type { InviteTypeWithId } from "../src/types";
import { defaultOptions, test } from "./helpers/better-auth";
import mock from "./helpers/mocks";

beforeEach(() => {
	vi.clearAllMocks();
});

// Activate Invite Tests

test("uses sendUserInvitation when invited user does not exist", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: (data, request) =>
				mock.sendUserInvitation(data, request),
			sendUserRoleUpgrade: (data, request) =>
				mock.sendUserRoleUpgrade(data, request),
			canCreateInvite: () => true,
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
		expect.objectContaining({ email: "test@email.com", role: "user" }),
		expect.anything(),
	);

	expect(mock.sendUserRoleUpgrade).not.toHaveBeenCalled();
});

test("uses sendUserRoleUpgrade when invited user exists", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: (data, request) =>
				mock.sendUserInvitation(data, request),
			sendUserRoleUpgrade: (data, request) =>
				mock.sendUserRoleUpgrade(data, request),
			canCreateInvite: () => true,
		},
	});

	const invitedUserEmail = "test@email.com";

	// Create a new user
	await db.create({
		model: "user",
		data: {
			email: invitedUserEmail,
			name: "Test User",
			role: "user",
		},
	});

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const { error } = await client.invite.create({
		role: "user",
		email: invitedUserEmail,
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);

	// The sendUserRoleUpgradeMock should have been called
	expect(mock.sendUserRoleUpgrade).toHaveBeenCalledOnce();
	expect(mock.sendUserRoleUpgrade).toHaveBeenCalledWith(
		expect.objectContaining({ email: invitedUserEmail, role: "user" }),
		expect.anything(),
	);

	expect(mock.sendUserInvitation).not.toHaveBeenCalled();
});

test("fallbacks to sendUserInvitation when invited user exists but sendUserRoleUpgrade doesn't exist", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: (data, request) =>
				mock.sendUserInvitation(data, request),
			canCreateInvite: () => true,
		},
	});

	const invitedUserEmail = "test@email.com";

	// Create a new user
	await db.create({
		model: "user",
		data: {
			email: invitedUserEmail,
			name: "Test User",
			role: "user",
		},
	});

	const { headers } = await signInWithTestUser();

	// This should be a role upgrade, because user already exists
	const { error } = await client.invite.create({
		role: "user",
		email: invitedUserEmail,
		fetchOptions: {
			headers,
		},
	});

	expect(error).toBe(null);

	// The sendUserInvitationMock should have been called as a fallback
	expect(mock.sendUserInvitation).toHaveBeenCalledOnce();
	expect(mock.sendUserInvitation).toHaveBeenCalledWith(
		expect.objectContaining({ email: invitedUserEmail, role: "user" }),
		expect.anything(),
	);

	expect(mock.sendUserRoleUpgrade).not.toHaveBeenCalled();
});

test("throws error when sendUserInvitation and sendUserRoleUpgrade doesn't exist but an email is present", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			canCreateInvite: () => true,
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
		code: "NO_INVITATION_SENDING_FUNCTION_CONFIGURED",
		message: "No invitation sending function configured",
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
			canCreateInvite: () => true,
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

// Test roles

test("throws error when user is defaultRoleForSignUpWithoutInvite by default", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const { headers } = await signInWithTestUser();

	// This should throw an error, because by default a user can't create an invite
	// if their role is defaultRoleForSignUpWithoutInvite
	const { error } = await client.invite.create({
		role: "user",
		fetchOptions: {
			headers,
		},
	});

	// Should throw an error because user can't create invite
	expect(error).toStrictEqual({
		code: "USER_DOES_NOT_HAVE_SUFFICIENT_PERMISSIONS_TO_CREATE_INVITE",
		message: "User does not have sufficient permissions to create invite",
		status: 400,
		statusText: "BAD_REQUEST",
	});
});

test("canCreateInvite should be called if it exists", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			canCreateInvite: (invitedUser, inviterUser) =>
				mock.canCreateInvite(invitedUser, inviterUser),
			sendUserInvitation: async () => {},
		},
	});

	const invitedUserEmail = "test@email.com";

	const { headers, user } = await signInWithTestUser();

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

	// The canCreateInviteMock should have been called
	expect(mock.canCreateInvite).toHaveBeenCalledOnce();
	expect(mock.canCreateInvite).toHaveBeenCalledWith(
		expect.objectContaining({ email: invitedUserEmail, role: "user" }),
		expect.objectContaining(user),
	);
});

// Tokens

test("generateToken should be used if it exists", async ({ createAuth }) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			canCreateInvite: () => true,
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
			canCreateInvite: () => true,
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
			canCreateInvite: () => true,
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
			canCreateInvite: () => true,
			defaultSenderResponseRedirect: "signIn",
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

	expect(data?.message).toContain(defaultOptions.defaultRedirectToSignIn);
});

test("tokenType=code generates a short token", async ({ createAuth }) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			canCreateInvite: () => true,
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
			canCreateInvite: () => true,
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
