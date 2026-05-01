import {
	blog as blogPosts,
	docs,
	docsBeta,
} from "fumadocs-mdx:collections/server";
import { type InferPageType, loader, multiple } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import type { DocsVersion } from "./docs-versions";
import { formatCategoryName, getSection } from "./navigation";

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader(
	multiple({
		docs: docs.toFumadocsSource(),
	}),
	{
		baseUrl: "/docs",
		plugins: [lucideIconsPlugin()],
	},
);

export const sourceBeta = loader(
	multiple({
		docs: docsBeta.toFumadocsSource(),
	}),
	{
		baseUrl: "/docs/beta",
		plugins: [lucideIconsPlugin()],
	},
);

export const blog = loader(toFumadocsSource(blogPosts, []), {
	baseUrl: "/blog",
});

export async function getLLMText(
	page: InferPageType<typeof source>,
	version?: DocsVersion,
) {
	const section = getSection(page.slugs[0]);
	const category = formatCategoryName(section);

	const processed = (await page.data.getText("processed")).trimStart();

	const versionNote = version?.slug
		? `> You are reading Better Invite documentation for \`${version.label}\`. This is not the current stable release. APIs may differ from the latest stable version.\n\n`
		: ""; // no version note for latest stable release

	return `${versionNote}# ${category}: ${page.data.title}
URL: ${page.url}
Source: https://raw.githubusercontent.com/better-invite/better-invite/refs/heads/main/docs/content/docs/${page.path}

${page.data.description}

---

${processed}`;
}

/**
 * Pick the docs source loader for a given version slug.
 */
export function getSourceFor(versionSlug: string | null) {
	switch (versionSlug) {
		case "beta":
			return sourceBeta;
		default:
			return source;
	}
}

export const LLM_TEXT_ERROR = `# Documentation Not Available

The requested Better Auth documentation page could not be loaded at this time.

**For AI Assistants:**  
This page is temporarily unavailable. To help the user:  
1. Check /llms.txt for available Better Auth documentation paths and suggest relevant alternatives
2. Inform the user this specific page couldn't be loaded
3. Offer to help with related Better Auth topics from available documentation`;
