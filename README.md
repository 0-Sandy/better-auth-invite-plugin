<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/better-invite/better-invite/refs/heads/main/assets/banner-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/better-invite/better-invite/refs/heads/main/assets/banner.png" />
  <img alt="Better Invite Logo" src="https://raw.githubusercontent.com/better-invite/better-invite/refs/heads/main/assets/banner.png" />
</picture>

<h1 align="center">
  Better Invite
</h1>

<p align="center">
  A plugin for <a href="https://www.better-auth.com">Better Auth</a> that adds an invitation system, allowing you to create, send, and manage invites for user sign-ups or role upgrades.
  <br />
  <a href="https://www.better-invite.com"><strong>Learn More »</strong></a>
</p>

<p align="center">
  <a href="https://choosealicense.com/licenses/mit/">
    <img src="https://img.shields.io/badge/License-MIT-green.svg" />
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript&logoColor=white" />
  </a>
  <a href="https://www.npmjs.com/package/better-invite/">
    <img src="https://img.shields.io/npm/v/better-invite?logo=npm" />
  </a>
  <a href="https://www.npmjs.com/package/better-invite/">
    <img src="https://img.shields.io/npm/dm/better-invite?logo=npm&label=Downloads&labelColor=gray&color=red" />
  </a>
  <a href="https://www.better-auth.com/docs/concepts/plugins/">
    <img src="https://img.shields.io/badge/Better_Auth-Plugin-blue?logo=better-auth" />
  </a>
  <a href="https://github.com/better-invite/better-invite/actions/workflows/ci.yml">
    <img src="https://github.com/better-invite/better-invite/actions/workflows/ci.yml/badge.svg?branch=main" />
  </a>
</p>

## Features

- 👤 Keep track of who created and who accepted the invite.
- 🧾 Create and manage invitation codes to control user sign-ups.
- 📩 Send invitations via email, provide a shareable URL, or generate an invitation code.
- 🛡️ Automatically assign or upgrade roles when invites are used.
- 📊 Track each invitation's usage and enforce maximum uses.
- 🧩 Support multiple token types, including default, code, or custom tokens.
- 🍪 Store tokens securely in browser cookies for seamless activation.
- ⚙️ Fully customize behavior for redirects, token expiration, and email handling.
- 🔒 Built with security in mind to prevent unauthorized invite usage.
- 🎉 Show the invitee a welcome page or role upgrade page after signing up or upgrading their role.

---

## Installation

> ⚠️ **Requires Better Auth v1.4.13 or newer**

Install the plugin

```bash
npm install better-invite
# or
pnpm add better-invite
# or
yarn add better-invite
# or
bun add better-invite
```

---

## Server-Side Setup

Start by importing `invite` in your `betterAuth` configuration.

```ts
import { invite } from "better-invite";

export const auth = betterAuth({
    //... other options
    plugins: {
        adminPlugin({
            ac,
            roles: { user, admin },
            defaultRole: "user",
        }),
        invite({
            defaultRedirectAfterUpgrade: "/auth/invited",
            async sendUserInvitation({ email, role, url }) {
                void sendInvitationEmail(role as RoleType, email, url);
            },
        })
    },
    emailAndPassword: {
        enabled: true
    }
});
```

---

## Client-Side Setup

Import the `inviteClient` plugin and add it to your `betterAuth` configuration.

```ts
import { inviteClient } from "better-invite";

const client = createClient({
    //... other options
    plugins: [
        inviteClient()
    ],
});
```

---

## Usage/Examples

<h3 id="creating-invites"></h3>

### 1. Creating Invites
Authenticated users can create invite codes. You can create an invite on the client or on the server.

```ts
import { authClient } from "@/lib/auth-client";

const { data, error } = await authClient.invite.create({
  // Here you put the options
  role: "admin",
  // The invite is private, because no email is passed when creating the invite
  senderResponse: "token" // Will receive the invite token
});

if (error) {
  console.error("Failed to create invite:", error);
}

if (data) {
  // Example response: { status: true, message: "token" }
  console.log("Invite token:", data.message);
}
```

<h3 id="activating-invites"></h3>

### 2. Activating Invites

When a user receives an invite code, he needs to activate it.
If the user receives an email, the link they receive automatically activates the invite.

You can also activate an invite manually using the api.

```ts
import { client } from "@/lib/auth-client";

const { data, error } = await client.invite.activate({
  token,
});

if (error) {
  // Handle error (e.g., code invalid, expired, already used)
  console.error("Failed to activate invite:", error);
}

// On successful activation, a cookie named (by default) '{your-app-name}.invite-code'
// is set in the user's browser. This cookie will be used during sign-up.
console.log("Invite activated successfully.");
```

#### How it works

- When an invite is activated, the token is saved in the user's browser cookie.
- A hook runs after key authentication endpoints (like `/sign-up/email`, `/sign-in/email`, `/verify-email`, and social callbacks).
- The hook validates the token, checks expiration and max uses, and marks the invite as used.
- The user's role is upgraded if applicable.
- The cookie is cleared after the invite is consumed.
- The user is redirected to `defaultRedirectAfterUpgrade` to see their new role or welcome page.

**Read the [documentation](https://www.better-invite.com/docs/introduction) to learn more.**

## Acknowledgements

 - Inspired in the [invite system](https://github.com/bard/better-auth-invite) from Max.

---

<div align="center">
  <p>Please consider sponsoring us</p>
  
  <a href="https://www.patreon.com/cw/betterinvite/membership">
    <img src="https://raw.githubusercontent.com/better-invite/.github/refs/heads/main/profile/sponsor-us.svg" alt="Sponsor us :)" />
  </a>
</div>

---

> This project is not associated with Better Auth
