<h1 align="center">
  Better Invite Starter
</h1>

<p align="center">
  A template/starter for <a href="https://www.better-invite.com">Better Invite</a>, made with <a href="https://better-auth.com">Better Auth</a>, <a href="https://better-auth-ui.com">Better Auth Ui</a>, <a href="https://nextjs.org">Next.js</a> and <a href="https://ui.shadcn.com">Shadcn</a>.
  <br />
  <a href="https://demo.better-invite.com" align="center"><strong>Demo »</strong></a>
</p>

---

<div align="center">
  <p>Please consider sponsoring us</p>
  
  <a href="https://patreon.better-invite.com/membership">
    <img src="https://raw.githubusercontent.com/better-invite/.github/refs/heads/main/profile/sponsor-us.svg" alt="Sponsor us :)" />
  </a>
</div>

---

> Better Invite Starter code is also available on a separate [repository](https://github.com/better-invite/better-invite-starter/tree/main)

## Installation

First, create a PostgreSQL Database then configure your environment variables.

You can generate a `BETTER_AUTH_SECRET` [here](https://www.better-auth.com/docs/installation#set-environment-variables).

```bash
BETTER_AUTH_SECRET=""
DATABASE_URL=""
```

Then generate your schema and perform migrations with drizzle-kit.

```bash
npx @better-auth/cli generate
npx drizzle-kit generate
npx drizzle-kit migrate
```

## Features:

[Better Invite](https://www.better-invite.com)

[Better Auth](https://better-auth.com)

[Better Auth UI](https://better-auth-ui.com)

[shadcn/ui](https://ui.shadcn.com)

[TailwindCSS](https://tailwindcss.com)

[Drizzle ORM](https://orm.drizzle.team)

[PostgreSQL](https://postgresql.org)

[Biome](https://biomejs.dev)

[Next.js](https://nextjs.org)

[Turborepo](https://turbo.build)

## Next.js

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

> Based in [Better Auth Starter](https://github.com/daveyplate/better-auth-nextjs-starter)

Original Author Links:

- Original's author Twitter: [@daveycodez](https://x.com/daveycodez)
☕️ [Buy the original author a coffee](https://buymeacoffee.com/daveycodez)