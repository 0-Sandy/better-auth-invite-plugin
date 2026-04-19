import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Banner } from "@/components/banner";
import { GithubLogo } from "@/components/github-button";
import { InstallCommand } from "@/components/install-command";

export default function HomePage() {
	return (
		<div className="relative grow overflow-hidden">
			<Banner
				variant="rainbow"
				id="better-invite"
				rainbowSpeed="7s"
				className="flex-col relative z-1"
				rainbowColors={[
					"rgba(20,20,20,0.95)",
					"rgba(40,40,40,0.9)",
					"rgba(70,70,70,0.85)",
					"rgba(120,120,120,0.75)",
				]}
			>
				<span className="font-medium flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
					<span className="font-semibold">
						Better Auth Invite Plugin is now called <b>Better Invite</b>!
					</span>
					<span className="text-zinc-600 dark:text-zinc-400 hidden md:block">
						|
					</span>
					<Link
						href="/blog/0-5"
						className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 hidden dark:hover:text-blue-300 transition-colors md:block"
					>
						Go see the blog →
					</Link>
				</span>
				<Link
					href="/blog/0-5"
					className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 text-xs dark:hover:text-blue-300 transition-colors md:hidden"
				>
					Go see the blog →
				</Link>
			</Banner>
			{/* Credits: https://github.com/better-auth-ui/better-auth-ui/blob/main/apps/docs/src/routes/index.tsx#L47 */}
			<div className="absolute top-0 left-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-600/20 blur-[120px] dark:bg-sky-600/10" />
			<div className="absolute right-0 top-1/3 h-[400px] w-[400px] translate-x-1/2 rounded-full bg-blue-500/15 blur-[100px] dark:bg-blue-500/5" />

			<div className="absolute inset-0 bg-size-[20px_20px] bg-[radial-gradient(#d4d4d4_1px,transparent_1px)] dark:bg-[radial-gradient(#404040_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
			<div className="relative z-10 flex flex-col items-center px-6 py-12 text-center sm:pt-24 lg:pt-32">
				<div className="flex flex-col justify-center text-center flex-1">
					<h1 className="max-w-4xl text-4xl font-bold sm:text-5xl lg:text-7xl">
						Better{" "}
						<span className="bg-linear-to-r from-sky-700 to-black bg-clip-text text-transparent dark:from-sky-500/80 dark:to-white">
							Invite
						</span>
					</h1>
					<p className="mt-6 max-w-2xl text-lg text-neutral-600 sm:text-xl dark:text-neutral-400">
						A plugin for{" "}
						<a
							href="https://better-auth.com"
							target="_blank"
							rel="noopener noreferrer"
							className="font-medium text-black underline decoration-sky-600/50 underline-offset-4 transition-colors hover:text-sky-700 dark:text-white dark:hover:text-sky-500"
						>
							Better Auth
						</a>{" "}
						that adds an invitation system, allowing you to create, send, and
						manage invites for user sign-ups or role upgrades.
					</p>

					<div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
						<Link
							href="/docs"
							className="group inline-flex items-center justify-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-black dark:bg-white dark:text-black dark:hover:bg-neutral-100"
						>
							Get Started
							<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
						</Link>
						<a
							href="https://github.com/better-invite/better-invite"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white/80 px-6 py-3 text-sm font-semibold text-neutral-700 backdrop-blur-sm transition-all hover:border-neutral-300 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
						>
							<GithubLogo className="h-4 w-4" />
							Star on GitHub
						</a>
					</div>

					<div className="flex justify-center mt-7">
						<InstallCommand />
					</div>
				</div>
			</div>
		</div>
	);
}
