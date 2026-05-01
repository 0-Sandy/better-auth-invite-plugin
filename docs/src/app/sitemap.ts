import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/metadata";
import { blog, source } from "@/lib/source";

export const revalidate = false;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const url = (path: string): string => new URL(path, baseUrl).toString();
	const docPages = source.getPages().map((page) => {
		const lastModified = page.data.lastModified;

		return {
			url: url(page.url),
			lastModified: lastModified ? new Date(lastModified) : undefined,
			changeFrequency: "weekly",
			priority: 0.5,
		} satisfies MetadataRoute.Sitemap[number];
	});

	const blogPages = blog.getPages().map((page) => {
		const lastModified = page.data.lastModified;

		return {
			url: url(page.url),
			lastModified: lastModified ? new Date(lastModified) : undefined,
			changeFrequency: "weekly",
			priority: 0.5,
		} satisfies MetadataRoute.Sitemap[number];
	});

	return [
		{
			url: url("/"),
			changeFrequency: "monthly",
			priority: 1,
		},
		{
			url: url("/blog"),
			changeFrequency: "weekly",
			priority: 1,
		},
		...docPages,
		...blogPages,
	];
}
