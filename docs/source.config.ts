import { pageSchema } from "fumadocs-core/source/schema";
import {
	applyMdxPreset,
	defineCollections,
	defineConfig,
	defineDocs,
	metaSchema,
} from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { z } from "zod";

// You can customise Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
	dir: "content/docs",
	docs: {
		schema: pageSchema,
		postprocess: {
			includeProcessedMarkdown: true,
		},
		async mdxOptions(environment) {
			const { remarkFeedbackBlock } = await import(
				"fumadocs-core/mdx-plugins/remark-feedback-block"
			);
			const { remarkMdxMermaid } = await import(
				"fumadocs-core/mdx-plugins/remark-mdx-mermaid"
			);

			return applyMdxPreset({
				remarkPlugins: [remarkMdxMermaid, remarkFeedbackBlock],
			})(environment);
		},
	},
	meta: {
		schema: metaSchema,
	},
});

export const docsBeta = defineDocs({
	dir: "./content/docs-beta",
	docs: {
		schema: pageSchema,
		postprocess: {
			includeProcessedMarkdown: true,
		},
		async mdxOptions(environment) {
			const { remarkFeedbackBlock } = await import(
				"fumadocs-core/mdx-plugins/remark-feedback-block"
			);
			const { remarkMdxMermaid } = await import(
				"fumadocs-core/mdx-plugins/remark-mdx-mermaid"
			);

			return applyMdxPreset({
				remarkPlugins: [remarkMdxMermaid, remarkFeedbackBlock],
			})(environment);
		},
	},
	meta: {
		schema: metaSchema,
	},
});

export const blog = defineCollections({
	type: "doc",
	dir: "content/blog",
	schema: pageSchema.extend({
		date: z.date(),
		author: z.object({
			name: z.string(),
			github: z.string().optional(),
		}),
		image: z.string(),
	}),
	mdxOptions: applyMdxPreset({
		remarkNpmOptions: {
			persist: {
				id: "package-manager",
			},
		},
	}),
});

export default defineConfig({
	mdxOptions: {
		remarkNpmOptions: {
			persist: {
				id: "persist-install",
			},
		},
	},
	plugins: [lastModified()],
});
