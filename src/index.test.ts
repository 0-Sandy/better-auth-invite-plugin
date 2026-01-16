import { getTestInstance } from "@better-auth-kit/tests";
import { betterAuth } from "better-auth";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { admin as adminPlugin, createAccessControl } from "better-auth/plugins";
import {
	adminAc,
	defaultStatements,
	userAc,
} from "better-auth/plugins/admin/access";
import Database from "better-sqlite3";
import { test as baseTest, beforeEach, expect, vi } from "vitest";
import { type InviteClientPlugin, invite, inviteClient } from ".";
import type { InviteOptions, InviteTypeWithId } from "./types";

const test_token = "test_token";

const sendUserInvitationMock = vi.fn();
const sendUserRoleUpgradeMock = vi.fn();
const sendUserInvitationWithErrorMock = vi.fn().mockImplementation(() => {
	throw new Error("Test Error");
});
const canCreateInviteMock = vi.fn();
const generateTokenMock = vi.fn().mockReturnValue(test_token);
const getDateMock = vi.fn().mockReturnValue(new Date("2025-01-01T10:00:00Z"));

const statement = { ...defaultStatements } as const;
const ac = createAccessControl(statement);
const user = ac.newRole({ ...userAc.statements });
const admin = ac.newRole({ ...userAc.statements });
const owner = ac.newRole({ ...adminAc.statements });

const defaultOptions: InviteOptions = {
	defaultRoleForSignUpWithoutInvite: "user",
	defaultMaxUses: 1,
	defaultRedirectToSignUp: "/auth/sign-up",
	defaultRedirectToSignIn: "/auth/sign-in",
	defaultRedirectAfterUpgrade: "/auth/invited",
};

const test = baseTest.extend<{
	createAuth: (opts: {
		pluginOptions: InviteOptions;
		advancedOptions?: { database: { generateId: () => string } };
	}) => ReturnType<
		typeof getTestInstance<{
			plugins: Array<InviteClientPlugin>;
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
				advancedOptions?: { database: { generateId: () => string } };
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
					clientOptions: { plugins: [inviteClient()] },
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

beforeEach(() => {
	vi.clearAllMocks();
});

const signIn = async (
	user: { email: string; password: string },
	// biome-ignore lint/suspicious/noExplicitAny: client type doesn't exist
	client: any,
	// biome-ignore lint/suspicious/noExplicitAny: sessionSetter type doesn't exist
	sessionSetter: any,
) => {
	const headers = new Headers();

	await client.signIn.email(
		{
			email: user.email,
			password: user.password,
		},
		{
			onSuccess: sessionSetter(headers),
		},
	);

	return headers;
};

// Test send emails

test("uses sendUserInvitation when invited user does not exist", async ({
	createAuth,
}) => {
	const { client, testUser, sessionSetter } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: (data, request) =>
				sendUserInvitationMock(data, request),
			sendUserRoleUpgrade: (data, request) =>
				sendUserRoleUpgradeMock(data, request),
			canCreateInvite: () => true,
		},
	});

	const headers = await signIn(testUser, client, sessionSetter);

	// This should be a user creation, because that user doesn't exist
	const res = await client.invite.create({
		role: "user",
		email: "test@email.com",
		fetchOptions: {
			headers,
		},
	});

	expect(res.error).toBe(null);

	expect(sendUserInvitationMock).toHaveBeenCalledOnce();
	expect(sendUserInvitationMock).toHaveBeenCalledWith(
		expect.objectContaining({ email: "test@email.com", role: "user" }),
		expect.anything(),
	);

	expect(sendUserRoleUpgradeMock).not.toHaveBeenCalled();
});

test("uses sendUserRoleUpgrade when invited user exists", async ({
	createAuth,
}) => {
	const { client, testUser, sessionSetter, db } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: (data, request) =>
				sendUserInvitationMock(data, request),
			sendUserRoleUpgrade: (data, request) =>
				sendUserRoleUpgradeMock(data, request),
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

	const headers = await signIn(testUser, client, sessionSetter);

	// This should be a role upgrade, because user already exists
	const res = await client.invite.create({
		role: "user",
		email: invitedUserEmail,
		fetchOptions: {
			headers,
		},
	});

	expect(res.error).toBe(null);

	expect(sendUserRoleUpgradeMock).toHaveBeenCalledOnce();
	expect(sendUserRoleUpgradeMock).toHaveBeenCalledWith(
		expect.objectContaining({ email: invitedUserEmail, role: "user" }),
		expect.anything(),
	);

	expect(sendUserInvitationMock).not.toHaveBeenCalled();
});

test("uses sendUserInvitation when invited user exists but sendUserRoleUpgrade doesn't exist", async ({
	createAuth,
}) => {
	const { client, testUser, sessionSetter, db } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: (data, request) =>
				sendUserInvitationMock(data, request),
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

	const headers = await signIn(testUser, client, sessionSetter);

	// This should be a role upgrade, because user already exists
	const res = await client.invite.create({
		role: "user",
		email: invitedUserEmail,
		fetchOptions: {
			headers,
		},
	});

	expect(res.error).toBe(null);

	expect(sendUserInvitationMock).toHaveBeenCalledOnce();
	expect(sendUserInvitationMock).toHaveBeenCalledWith(
		expect.objectContaining({ email: invitedUserEmail, role: "user" }),
		expect.anything(),
	);

	expect(sendUserRoleUpgradeMock).not.toHaveBeenCalled();
});

test("throws error when sendUserInvitation and sendUserRoleUpgrade doesn't exist but an email is present", async ({
	createAuth,
}) => {
	const { client, testUser, sessionSetter } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			canCreateInvite: () => true,
		},
	});

	const invitedUserEmail = "test@email.com";

	const headers = await signIn(testUser, client, sessionSetter);

	// This should be a role upgrade, because user already exists
	const res = await client.invite.create({
		role: "user",
		email: invitedUserEmail,
		fetchOptions: {
			headers,
		},
	});

	expect(res.error).toStrictEqual({
		code: "NO_INVITATION_SENDING_FUNCTION_CONFIGURED",
		message: "No invitation sending function configured",
		status: 500,
		statusText: "INTERNAL_SERVER_ERROR",
	}); // We should have an error
});

test("throws error when sendUserInvitation and sendUserRoleUpgrade doesn't exist but an email is present", async ({
	createAuth,
}) => {
	const { client, testUser, sessionSetter } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			canCreateInvite: () => true,
			sendUserInvitation: (data, request) =>
				sendUserInvitationWithErrorMock(data, request),
		},
	});

	const invitedUserEmail = "test@email.com";

	const headers = await signIn(testUser, client, sessionSetter);

	// This should be a role upgrade, because user already exists
	const res = await client.invite.create({
		role: "user",
		email: invitedUserEmail,
		fetchOptions: {
			headers,
		},
	});

	expect(res.error).toStrictEqual({
		code: "ERROR_SENDING_THE_INVITATION_EMAIL",
		message: "Error sending the invitation email",
		status: 500,
		statusText: "INTERNAL_SERVER_ERROR",
	}); // We should have an error
});

// Test roles

test("throws error when user is defaultRoleForSignUpWithoutInvite by default", async ({
	createAuth,
}) => {
	const { client, testUser, sessionSetter } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const headers = await signIn(testUser, client, sessionSetter);

	// This should throw an error, because by default a user can't create an invite
	// if their role is defaultRoleForSignUpWithoutInvite
	const res = await client.invite.create({
		role: "user",
		fetchOptions: {
			headers,
		},
	});

	expect(res).toStrictEqual({
		data: null,
		error: {
			code: "USER_DOES_NOT_HAVE_SUFFICIENT_PERMISSIONS_TO_CREATE_INVITE",
			message: "User does not have sufficient permissions to create invite",
			status: 400,
			statusText: "BAD_REQUEST",
		},
	}); // We should have an error
});

test("canCreateInvite should be called if it exists", async ({
	createAuth,
}) => {
	const { client, testUser, sessionSetter } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			canCreateInvite: (invitedUser, inviterUser) =>
				canCreateInviteMock(invitedUser, inviterUser),
		},
	});

	const invitedUserEmail = "test@email.com";

	const headers = new Headers();

	const data = await client.signIn.email(
		{
			email: testUser.email,
			password: testUser.password,
		},
		{
			onSuccess: sessionSetter(headers),
		},
	);
	const user = data.data?.user;

	// canCreateInviteMock should be called because it exists and it overrides
	// default behavior
	await client.invite.create({
		role: "user",
		email: invitedUserEmail,
		fetchOptions: {
			headers,
		},
	});

	expect(canCreateInviteMock).toHaveBeenCalledOnce();
	expect(canCreateInviteMock).toHaveBeenCalledWith(
		expect.objectContaining({ email: invitedUserEmail, role: "user" }),
		expect.objectContaining(user),
	);
});

// Tokens

test("generateToken should be used if it exists", async ({ createAuth }) => {
	const { client, testUser, sessionSetter } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			canCreateInvite: () => true,
			generateToken: () => generateTokenMock(),
		},
	});

	const headers = await signIn(testUser, client, sessionSetter);

	// canCreateInviteMock should be called because it exists and it overrides
	// default behavior
	const res = await client.invite.create({
		role: "user",
		senderResponse: "token",
		tokenType: "custom", // Use generateToken function
		fetchOptions: {
			headers,
		},
	});

	expect(generateTokenMock).toHaveBeenCalledOnce();
	expect(res.data?.message).toBe(test_token);
});

// Get Date

test("getDate should be used if it exists", async ({ createAuth }) => {
	const { client, testUser, sessionSetter, db } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			canCreateInvite: () => true,
			getDate: () => getDateMock(),
		},
	});

	const invitedUserEmail = "test@email.com";

	const headers = await signIn(testUser, client, sessionSetter);

	// canCreateInviteMock should be called because it exists and it overrides
	// default behavior
	await client.invite.create({
		role: "user",
		email: invitedUserEmail,
		fetchOptions: {
			headers,
		},
	});

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "email", value: invitedUserEmail }],
	});

	expect(getDateMock).toHaveBeenCalledOnce();
	expect(invite?.createdAt).toStrictEqual(new Date("2025-01-01T10:00:00Z"));
});

// Activate Invite

// Need to fix activateInvite, ctx.context.session can sometimes be undefined
/*test("uses sendUserInvitation when invited user exists but sendUserRoleUpgrade doesn't exist", async ({
	createAuth,
}) => {
	const { client, testUser, sessionSetter, db } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			canCreateInvite: () => true,
		},
	});

	const invitedUser = {
		email: "test@email.com",
		role: "user",
		name: "Test User",
		password: "12345678",
	};

	// Create a new user
	const { id: userId } = await db.create({
		model: "user",
		data: invitedUser,
	});
	await db.create({
		model: "account",
		data: {
			password: await hashPassword(invitedUser.password),
			accountId: generateRandomString(16),
			providerId: "credential",
			userId,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});

	const headers = await signIn(testUser, client, sessionSetter);

	// This should be a role upgrade, because user already exists
	const token = await client.invite.create({
		role: "owner",
		senderResponse: "token",
		fetchOptions: {
			headers,
		},
	});

	const tokenValue = token.data?.message;
	expect(tokenValue).toBeTruthy();

	await client.invite.activate({
		// biome-ignore lint/style/noNonNullAssertion: it will NOT be undefined
		token: tokenValue!,
		callbackURL: "/",
		fetchOptions: {
			headers,
		},
	});

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		// biome-ignore lint/style/noNonNullAssertion: it will NOT be undefined
		where: [{ field: "token", value: tokenValue! }],
	});

	expect(invite).not.toBeNull();

	const inviteId = invite?.id;

	const inviteUses = await db.count({
		model: "invite_use",
		// biome-ignore lint/style/noNonNullAssertion: it will NOT be undefined
		where: [{ field: "inviteId", value: inviteId! }],
	});

	expect(inviteUses).toBe(1);
});
*/
