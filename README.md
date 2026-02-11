
# Better Auth Invite Plugin

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![npm](https://img.shields.io/npm/v/better-auth-invite-plugin?logo=npm)](https://www.npmjs.com/package/better-auth-invite-plugin/)
[![npm beta](https://img.shields.io/npm/v/better-auth-invite-plugin/beta?logo=npm)](https://www.npmjs.com/package/better-auth-invite-plugin/)
[![Better Auth Plugin](https://img.shields.io/badge/Better_Auth-Plugin-blue?logo=better-auth)](https://www.better-auth.com/docs/concepts/plugins/)
[![CI](https://github.com/0-Sandy/better-auth-invite-plugin/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/0-Sandy/better-auth-invite-plugin/actions/workflows/ci.yml)

A plugin for [Better Auth](https://www.better-auth.com) that adds an invitation system, allowing you to create, send, and manage invites for user sign-ups or role upgrades.

📘 Learn More: [Documentation](https://better-auth-invite.vercel.app).

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

## Installation

> ⚠️ **Requires Better Auth v1.4.13 or newer**

Install the plugin

```bash
npm install better-auth-invite-plugin
# or
pnpm add better-auth-invite-plugin
# or
yarn add better-auth-invite-plugin
```

## Server-Side Setup

Start by importing `invite` in your `betterAuth` configuration.

Basic example:

```ts
import { invite } from "better-auth-invite-plugin";

export const auth = betterAuth({
    //... other options
    database,
    plugins: {
        adminPlugin({
            ac,
            roles: { user, admin },
            defaultRole: "user",
        }),
        invite({
            defaultMaxUses: 1,
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

If you want, you can use a lot more options, here's an example using all the options

<details>
<summary>Advanced example</summary>

```ts
import { invite}  from "better-auth-invite-plugin";

export const auth = betterAuth({
  //... other options
  database,
  plugins: {
    adminPlugin({
      ac,
      roles: { user, admin, owner },
      defaultRole: "user",
    }),
    invite({
      getDate: () => new Date(), // Don't know why would you change the getDate function, but you can if you want
      canCreateInvite({ invitedUser, inviterUser }) { // Can a user create an invite? By default he can create an invite, can also be a boolean
        if (!inviterUser.role) return false;

        const RoleHierarchy = {
          user: 1,
          admin: 2,
          owner: 3,
        } as const;

        return ( // If the inviter isn't trying to invite a user with a higher role than his, he can create the invite
          RoleHierarchy[inviterUser.role as RoleType] >=
          RoleHierarchy[invitedUser.role as RoleType]
        );
      },
      canAcceptInvite({ invitedUser, newAccount }) { // Can a user accept an invite? By default he can accept an invite, can also be a boolean
        return newAccount; // Can only accept an invite to create an account, they cannot upgrade their role
      },
      generateToken() { // If you want you can create your own custom tokens
        return String(Math.floor(Math.random() * 9) + 1); // Totally not ideal, since this only allows 9 different tokens
      }
      defaultTokenType: "token", // Token is recommended for email invites
      defaultRedirectToSignUp: "/auth/sign-up", // The url to sign up the user
      defaultRedirectToSignIn: "/auth/sign-in", // The url to sign in the user
      defaultRedirectAfterUpgrade: "/auth/invited", // You should put a welcome message on this page
      defaultShareInviterName: true, // Will be passed as an argument to the defaultRedirectAfterUpgrade
      defaultMaxUses: 1,
      defaultSenderResponse: "url", // If no email is provider, the sender will receive a URL to share with friends!
      defaultSenderResponseRedirect: "signUp", // If no email is provided and defaultSenderResponse is "url", the user will be redirected to the sign-up page when they open that URL
      async sendUserInvitation({ email, role, url, newAccount }) { // Implement your logic to send an email
        if (newAccount)
          return void sendInvitationEmail(role as RoleType, email, url);

        void sendRoleUpgradeEmail(role as RoleType, email, url);
      },
      invitationTokenExpiresIn: 3600, // The token is only valid for 1 hour (in seconds)
      inviteCookieMaxAge: 600, // The invite cookie will expire in 10 minutes (in seconds)
      async onInvitationUsed({ invitedUser, newAccount }) {
        // Send the user an email after they use an invitation
        if (newAccount) // If it's a new account send them a welcome email
          return void sendWelcomeEmail(invitedUser.name, invitedUser.email);
               
        // If it's not a new account, send them an email telling them their new role
        void sendRoleUpgradeEmail(invitedUser.name, invitedUser.email, invitedUser.role);
      },
      schema: { // Customize the table and column names
        invite: {
          fields: {
            token: "invite_token" // The field "token" is now "invite_token"
          },
        },
      },
    })
  },
  emailAndPassword: {
    enabled: true
  }
});
```

</details>

## Invite Options

<details>
<summary>Click to expand</summary>

? = Optional

| Property | Type | Description | Default |
| :------- | :--- | :---------- | :------ |
| `getDate?` | `() => Date` | Function to generate the date. | `() => new Date()` |
| `canCreateInvite?` | `((data: { invitedUser: {email?: string; role: string }}, inviterUser: UserWithRole) => boolean) \| boolean` | Function that runs before creating an invite. | — |
| `canAcceptInvite?` | `((data: { invitedUser: UserWithRole, newAccount: boolean }) => boolean) \| boolean` | Function that runs before accepting an invite. | — |
| `generateToken?` | `() => string` | Function to generate a custom token. | — |
| `defaultTokenType?` | `"token" \| "code" \| "custom"` | Default token type. | `token` |
| `defaultRedirectToSignUp` | `string` | URL to redirect the user to sign up. | `/auth/sign-up` |
| `defaultRedirectToSignIn` | `string` | URL to redirect the user to sign in. | `/auth/sign-in` |
| `defaultRedirectAfterUpgrade` | `string` | URL to redirect the user after upgrading role. | — |
| `defaultShareInviterName?` | `boolean` | Whether the inviter's name is shared with the invitee by default. | `true` |
| `defaultMaxUses` | `number` | Max number of uses for an invite. | `1` |
| `defaultSenderResponse?` | `"token" \| "url"` | How the sender receives the token if no email is provided. | `token` |
| `defaultSenderResponseRedirect?` | `"signUp" \| "signIn"` | Where to redirect the user if no email is provided. | `signUp` |
| `sendUserInvitation?` | `(data: { email: string; role: string; url: string; token: string, newAccount: boolean }, request?: Request) => Promise<void>` | Function to send the invitation email. | — |
| `invitationTokenExpiresIn?` | `number` | Number of seconds the token is valid for. | `3600` |
| `inviteCookieMaxAge` | `number` | Number of seconds before the invite cookie expires | `600` |
| `onInvitationUsed?` | `(data: { invitedUser: UserWithRole, newUser: UserWithRole, newAccount: boolean}, request?: Request) => Promise<void>` | Callback when an invite is used. | — |
| `schema?` | `InferOptionSchema<InviteSchema>` | Custom schema for the invite plugin. | — |

</details>

## Client-Side Setup

Import the `inviteClient` plugin and add it to your `betterAuth` configuration.

```ts
import { inviteClient } from "better-auth-invite-plugin";

const client = createClient({
    //... other options
    plugins: [
        inviteClient()
    ],
});
```

## Additional Info

An invite is considered `private` when an email is provided when creating an invite. Otherwise, it is considered `public`.
By default, the invite cookie is named `{your-app-name}.invite-code`, but it can be customized (see ["Custom Cookies"](https://www.better-auth.com/docs/concepts/cookies#custom-cookies)).

## Usage/Examples

<h3 id="creating-invites"></h3>

### 1. Creating Invites
Authenticated users can create invite codes. You can create an invite on the client or on the server.

<details>
<summary>Create an invite on the server</summary>

Use `authClient.invite.create` to create one.

```ts
import { client } from "@/lib/auth-client";

const { data, error } = await client.invite.create({
  // Here you put the options
  role: "admin",
  senderResponse: "token"
});

if (error) {
  console.error("Failed to create invite:", error);
}

if (data) {
  // Example response: { status: true, message: "token" }
  console.log("Invite token created:", data.message);
}
```
</details>

<details>
<summary>Create an invite on the client</summary>

Use `auth.api.createInvite` to create one.

```ts
import { auth } from "@/lib/auth";

const { data, error } = await auth.api.createInvite({
  headers: ..., // The user headers, req.headers on api, await headers() on NextJS
  body: { // In the body you put the options
    role: "admin",
    senderResponse: "token"
  }
});

if (error) {
  console.error("Failed to create invite:", error);
}

if (data) {
  // Example response: { status: true, message: "token" }
  console.log("Invite token created:", data.message);
}
```
</details>

#### [Create invite options](#create-invite-options)

<h3 id="activating-invites"></h3>

### 2. Activating Invites

When a user receives an invite code, he needs to activate it.
If the user receives an email, the link they receive automatically activates the invite.
Also you can activate an invite on the client or on the server (manually).

<details>
<summary>Activating an invite manually</summary>

To manually activate an invite, you can use one of the following methods depending on whether you are working on the server or client side.

<details>
<summary>Create an invite on the server</summary>

Use `authClient.invite.activate` to create one.

```ts
import { client } from "@/lib/auth-client";

const { data, error } = await client.invite.activate({
  token,
  callbackURL: "/auth/sign-up" // Where to redirect the user
});

if (error) {
  // Handle error (e.g., code invalid, expired, already used)
  console.error("Failed to activate invite:", error);
}

// On successful activation, a cookie named (by default) '{your-app-name}.invite-code'
// is set in the user's browser. This cookie will be used during sign-up.
console.log("Invite activated successfully.");
```
</details>

<details>
<summary>Create an invite on the client</summary>

Use `auth.api.activateInvite` to create one.

```ts
import { auth } from "@/lib/auth";

const { data, error } = await auth.api.activateInvite({
  headers: ..., // The user headers, req.headers on api, await headers() on NextJS
  body: { // In the body you put the options
    token,
    callbackURL: "/auth/sign-up" // Where to redirect the user to sign in/up
  }
});

if (error) {
  // Handle error (e.g., code invalid, expired, already used)
  console.error("Failed to activate invite:", error);
}

// On successful activation, a cookie named (by default) '{your-app-name}.invite-code'
// is set in the user's browser. This cookie will be used during sign-up.
console.log("Invite activated successfully.");
```
</details>

</details>

<details>
<summary>Activating an invite automatically</summary>

When you create a private invite (see ["Creating Invites"](#creating-invites)), an email will be sent to that user. The system checks whether a user with that email already exists:

- If the user does **not** exist, the email invites them to **sign up** and create an account.  
- If the user **already exists**, the email invites them to **upgrade their role**.  

When the user follows the link, the token is automatically activated. After completing the action (creating an account or upgrading their role), they are redirected to `redirectToAfterUpgrade` to see their new account or updated role.
</details>

#### [Activate invite options](#activate-invite-options)

### 3. Signing up

The invite system works alongside the standard sign-up and sign-in flow. The outcome depends on whether the user has an active invite.

#### How it works

- When an invite is activated, the token is saved in the user's browser cookie.
- A hook runs after key authentication endpoints (like `/sign-up/email`, `/sign-in/email`, `/verify-email`, and social callbacks).
- The hook validates the token, checks expiration and max uses, and marks the invite as used.
- The user's role is upgraded if applicable.
- The cookie is cleared after the invite is consumed.
- The user is redirected to `defaultRedirectAfterUpgrade` to see their new role or welcome page.

#### Scenario 1: Using an Active Invite

1. **Activate Invite:** The user activates an invite code (see ["Activating Invites"](#activating-invites)), which sets a invite cookie.
2. **Sign Up / Sign In:** The user completes the normal sign-up or sign-in process (e.g., using email and password).
3. **Role Upgrade:** If a valid invite cookie exists:
   - The invite is validated.
   - The user's role is upgraded.
   - The invite is marked as used in the database.
   - The invite cookie is cleared.

#### Scenario 2: Without an Invite

1. **Sign Up:** The user signs up without activating an invite or if the activated invite is invalid, expired, or already used.
2. **Default Role:** 
   - The user is created with the default role defined in the admin plugin.
   - The invite system does not affect this user.

This approach allows capturing user interest even if invites are limited. Roles can be upgraded later using a valid invite or administrative actions.

## Security

The invite system provides several built-in mechanisms to ensure secure management of invitations and role upgrades.

### Token Types

Each invite has a token, which is used to validate and track its use:

- Token - Default type. A long, random string generated with generateId(24) from better-auth. Recommended for email and url invitations.
- Code - Shorter, human-readable codes. Generated with random alphanumeric characters. Use with care, as they are easier to guess.
- Custom - Allows defining your own token generator function via generateToken.

### Invite Permissions

- Creating invites: By default, a user can create an invite.
- This behavior can be customized using the canCreateInvite function in the invite options.

### Accepting invites

- By default, all users can accept invites
- This behavior can be customized using the canAcceptInvite function in the invite options.

### Expiration and Usage Limits

- Each invite has an expiration date (expiresAt) and a maximum number of uses (maxUses), preventing unlimited sharing or misuse.
- Expired invites or invites that have reached their usage limit are automatically rejected and deleted.

### Secure Delivery

- Invites that were send to a certain email can only be used by that exact email.
- The token is stored in an HTTP-only cookie when the invite is activated, protecting it from client-side access.

### Best Practices

- Use the default token type for most invitations, as it provides the highest entropy.
- Ensure canCreateInvite is properly configured to prevent users from inviting others to roles above their own.
- Never expose the token in client-side code or logs.
- Monitor maxUses and expiresAt to avoid old invites being exploited.

## API Reference

<details>
<summary>POST /invite/create (Create an invite)</summary>

It creates a token using all the configuration, if you call this
endpoint with an email, it will send them an email to create their
account or to upgrade their role.

```http
POST /invite/create
```

<h3 id="create-invite-options"></h3>
? = Optional

| Parameter | Type | Description | Default value | Where  |
| :-------- | :--- | :---------- | :------------ | :----- |
| `role` | `string` | The role to give the invited user. | — | `BODY` |
| `email?` | `email` | The email address of the user to send a invitation email to. | — | `BODY` |
| `tokenType?` | `"token" \| "code" \| "custom"` | Type of token to use, 24 character token, 6 digit code or custom options.generateToken. | `options.defaultTokenType` | `BODY` |
| `redirectToSignUp?` | `string` | The URL to redirect the user to create their account. | `options.defaultRedirectTo` | `BODY` |
| `redirectToSignIn?` | `string` | The URL to redirect the user to upgrade their role. | `options.defaultRedirectToSignIn` | `BODY` |
| `maxUses?` | `number` | The number of times an invitation can be used. | `options.defaultMaxUses` | `BODY` |
| `expiresIn?` | `number` | Number of seconds the invitation token is valid for. | `options.invitationTokenExpiresIn` | `BODY` |
| `redirectToAfterUpgrade?` | `string` | The URL to redirect the user to after upgrade their role (if the user is already logged in). | `options.defaultRedirectAfterUpgrade` | `BODY` |
| `shareInviterName?` | `boolean` | Whether the inviter's name should be shared with the invitee. | options.defaultShareInviterName | `BODY` |
| `senderResponse?` | `"token" \| "url"` | How should the sender receive the token (sender only receives a token if no email is provided) | `options.defaultSenderResponse` | `BODY` |
| `senderResponseRedirect?` | `"signUp" \| "signIn"` | Where should we redirect the user? (only if no email is provided) | `options.defaultSenderResponseRedirect` | `BODY` |

</details>

<details>
<summary>POST /invite/activate (Activate an invite)</summary>

It saves the token in the user's cookie, for later use in a hook,
but if user is already signed in, it will only consume the token
and upgrade their role.

```http
POST /invite/activate
```

<h3 id="activate-invite-options"></h3>
? = Optional

| Parameter | Type | Description | Default value | Where  |
| :-------- | :--- | :---------- | :------------ | :----- |
| `token` | `string` | The invitation token. | — | `BODY` |
| `redirectTo?` | `string` | Where to redirect the user to sign in/up. | — | `BODY` |

</details>


<details>
<summary>GET /invite/:token (Activate an invite callback)</summary>

It saves the token in the user's cookie, for later use in a hook,
but if user is already signed in, it will only consume the token
and upgrade their role. 

This endpoint is meant to be used as a **callback**.  
It is the URL sent in invitation emails and when senderResponse is set to "url"

Unlike `POST /invite/activate`, this endpoint uses **GET**, and is intended to be called via a URL and should not be called directly from the API (auth.api.activateInvite or authClient.invite.activate)

```http
GET /invite/:token
```

<h3 id="invite-callback-options"></h3>
? = Optional

| Parameter | Type | Description | Default value | Where  |
| :-------- | :--- | :---------- | :------------ | :----- |
| `token` | `string` | The invitation token. | — | `URL` |
| `redirectTo?` | `string` | Where to redirect the user to sign in/up. | — | `QUERY` |

</details>

## Database Schema

<details>
<summary>Invite Table</summary>

? = optional

### `invite` table

| Column | Type | Description | References |
|--------|------|-------------|------------|
| `token` | `string` | The unique invite code. | — |
| `createdAt` | `date` | Timestamp when the invite was created. | — |
| `expiresAt` | `date` | Timestamp when the invite expires. | — |
| `maxUses` | `number` | Maximum number of times the invite can be used. | — |
| `createdByUserId?` | `string` | ID of the user who created the invite. | `user.id` |
| `redirectToAfterUpgrade` | `string` | URL to redirect the user after their role is upgraded. | — |
| `shareInviterName` | `boolean` | Whether to share the inviter's name with the invitee. | — |
| `email?` | `string` | Email of the invited user. Optional if sending a URL directly. | — |
| `role` | `string` | Role to assign to the invited user. | — |
</details>

<details>
<summary>InviteUse Table</summary>

? = optional

### `inviteUse` table

| Column | Type | Description | References |
|--------|------|-------------|------------|
| `inviteId` | `string` | ID of the invite being used. | `invite.token` |
| `usedAt` | `date` | Timestamp when the invite was used. | — |
| `usedByUserId?` | `string` | ID of the user who used the invite. | `user.id` |
</details>

## Troubleshooting

### `Export expireCookie doesn't exist in target module`

If you see an error like:

```txt
./node_modules/.pnpm/better-auth-invite-plugin@.../dist/hooks.js:2:1
Export expireCookie doesn't exist in target module
  1 | import { createAuthMiddleware } from "better-auth/api";
> 2 | import { expireCookie } from "better-auth/cookies";
    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
...
The export expireCookie was not found in module .../better-auth/dist/cookies/index.mjs
```
This means your better-auth version is too old.

**Fix**: upgrade Better Auth to v1.4.13 or newer

## Acknowledgements

 - Partially based in [better auth invite from bard](https://github.com/bard/better-auth-invite)

## License

[MIT](https://choosealicense.com/licenses/mit/)

