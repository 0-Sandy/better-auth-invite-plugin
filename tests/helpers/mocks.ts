import { vi } from "vitest";

const test_token = "test_token";
const test_date = new Date("2025-01-01T10:00:00Z");

const sendUserInvitation = vi.fn();
/**
 * @deprecated
 */
const sendUserRoleUpgrade = vi.fn();
const sendUserInvitationWithError = vi.fn().mockImplementation(() => {
	throw new Error("Test Error");
});
const canCreateInvite = vi.fn().mockReturnValue(true);
const generateToken = vi.fn().mockReturnValue(test_token);
const getDate = vi.fn().mockReturnValue(test_date);
const canAcceptInvite = vi.fn().mockReturnValue(false);
const onInvitationUsed = vi.fn();
const beforeCreateInvite = vi.fn();
const afterCreateInvite = vi.fn();

export default {
	test_token,
	test_date,
	sendUserInvitation,
	sendUserRoleUpgrade,
	sendUserInvitationWithError,
	canCreateInvite,
	generateToken,
	getDate,
	canAcceptInvite,
	onInvitationUsed,
	beforeCreateInvite,
	afterCreateInvite,
};
