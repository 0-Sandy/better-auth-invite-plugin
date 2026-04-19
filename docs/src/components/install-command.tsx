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
		<button
			type="button"
			onClick={handleCopy}
			aria-label="Copy install command to clipboard"
			className="group flex w-fit items-center gap-3 rounded-xl border border-neutral-200/60 bg-neutral-50/80 px-5 py-3 shadow-sm backdrop-blur-sm transition-all hover:border-neutral-300 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/8 dark:shadow-[0_0_24px_#ffffff18] dark:hover:shadow-[0_0_32px_#ffffff28]"
		>
			<code className="flex items-center gap-1.5 font-mono text-xs md:text-sm">
				<span className="select-none text-neutral-400 dark:text-neutral-500">
					$
				</span>
				<span className="text-neutral-500 dark:text-neutral-400">pnpm add</span>
				<span className="font-semibold text-fuchsia-700 dark:text-fuchsia-300">
					better-invite
				</span>
			</code>

			<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-400 shadow-xs transition-all group-hover:border-neutral-300 group-hover:text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-500 dark:group-hover:border-white/20 dark:group-hover:text-neutral-300">
				{copied ? (
					<Check className="h-3.5 w-3.5 text-emerald-500" />
				) : (
					<Copy className="h-3.5 w-3.5" />
				)}
			</span>
		</button>
	);
}
