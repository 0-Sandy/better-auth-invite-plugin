"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

const COMMAND = "pnpm add better-invite";

export function InstallCommand() {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(COMMAND);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// fallback for older browsers
			const el = document.createElement("textarea");
			el.value = COMMAND;
			document.body.appendChild(el);
			el.select();
			document.execCommand("copy");
			document.body.removeChild(el);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<div className="w-fit overflow-hidden rounded-lg border border-neutral-200/80 bg-neutral-50 shadow-lg dark:border-white/10 dark:bg-neutral-900 dark:shadow-[0_0_40px_#ffffff20]">
			{/* Terminal header */}
			<div className="flex items-center gap-2 border-b border-neutral-200/80 bg-neutral-100/80 px-4 py-2.5 dark:border-white/5 dark:bg-white/5">
				<div className="flex gap-1.5">
					<span className="h-3 w-3 rounded-full bg-red-400/80 dark:bg-red-500/70" />
					<span className="h-3 w-3 rounded-full bg-yellow-400/80 dark:bg-yellow-500/70" />
					<span className="h-3 w-3 rounded-full bg-green-400/80 dark:bg-green-500/70" />
				</div>
				<span className="ml-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
					Terminal
				</span>
			</div>

			{/* Terminal body */}
			<button
				type="button"
				onClick={handleCopy}
				aria-label="Copy install command to clipboard"
				className="group flex w-full items-center justify-between gap-6 px-5 py-4 transition-colors hover:bg-neutral-100/60 dark:hover:bg-white/5"
			>
				<code className="flex items-center gap-2 font-mono text-xs md:text-sm">
					<span className="select-none text-emerald-600 dark:text-emerald-400">
						~
					</span>
					<span className="select-none text-sky-600 dark:text-sky-400">
						$
					</span>
					<span className="text-neutral-600 dark:text-neutral-300">
						pnpm add
					</span>
					<span className="font-semibold text-fuchsia-600 dark:text-fuchsia-300">
						better-invite
					</span>
				</code>

				<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-400 shadow-sm transition-all group-hover:border-neutral-300 group-hover:text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-500 dark:group-hover:border-white/20 dark:group-hover:text-neutral-300">
					{copied ? (
						<Check className="h-4 w-4 text-emerald-500" />
					) : (
						<Copy className="h-4 w-4" />
					)}
				</span>
			</button>
		</div>
	);
}
