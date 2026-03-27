import { adminClient } from "better-auth/client/plugins";
import { twoFactor } from "better-auth/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [twoFactor(), adminClient()],
});
