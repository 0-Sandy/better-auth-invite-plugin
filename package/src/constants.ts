import { defineErrorCodes } from "better-auth";
import type { TokensType } from "./types";

export const ERROR_CODES = defineErrorCodes({
	USER_NOT_LOGGED_IN: "User must be logged in to create an invite",
	INSUFFICIENT_PERMISSIONS:
		"User does not have sufficient permissions to create invite",
	NO_SUCH_USER: "No such user",
	NO_USES_LEFT_FOR_INVITE: "No uses left for this invite",
	INVALID_OR_EXPIRED_INVITE: "Invalid or expired invite code",
	INVALID_TOKEN: "Invalid or non-existent token",
	INVALID_EMAIL: "This token is for a specific email, this is not it",
	CANT_ACCEPT_INVITE: "You cannot accept this invite",
	CANT_REJECT_INVITE: "You cannot reject this invite",
	INVITER_NOT_FOUND: "Inviter not found",
	ERROR_SENDING_THE_INVITATION_EMAIL: "Error sending the invitation email",
	ADMIN_PLUGIN_IS_NOT_SET_UP: "Admin plugin is not set-up",
	INVITATION_EMAIL_NOT_ENABLED: "Invitation email is not enabled",
	INVITE_TOKEN_HAS_ALREADY_BEEN_USED: "Invite token has already been used",
});

export const Tokens: TokensType[] = ["token", "code", "custom"];

export const INVITE_COOKIE_NAME = "invite_token";
