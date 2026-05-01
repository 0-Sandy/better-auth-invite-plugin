import { NextResponse } from "next/server";
import { formatCategoryName, getSection } from "@/lib/navigation";
import { source } from "@/lib/source";

export const revalidate = false;

interface PageInfo {
	title: string;
	description: string;
	url: string;
	category: string;
}

function groupPagesByCategory(pages: any[]): Map<string, PageInfo[]> {
	const grouped = new Map<string, PageInfo[]>();

	for (const page of pages) {
		const category = getSection(page.slugs[0]);

		const pageInfo: PageInfo = {
			title: page.data.title,
			description: page.data.description || "",
			url: `/llms.mdx${page.url}`,
			category: category,
		};

		if (!grouped.has(category)) {
			grouped.set(category, []);
		}
		grouped.get(category)?.push(pageInfo);
	}

	return grouped;
}

export async function GET() {
	const pages = source.getPages();
	const groupedPages = groupPagesByCategory(pages);

	let content = `# Better Invite

> A Better Auth plugin for secure invitations and automatic role assignment.

## Table of Contents

`;

	const categories = Array.from(groupedPages.keys());

	for (const category of categories) {
		const categoryPages = groupedPages.get(category)!;
		const formattedCategory = formatCategoryName(category);

		content += `### ${formattedCategory}\n\n`;

		for (const page of categoryPages) {
			const description = page.description ? `: ${page.description}` : "";
			content += `- [${page.title}](${page.url})${description}\n`;
		}

		content += "\n";
	}

	return new NextResponse(content, {
		headers: {
			"Content-Type": "text/markdown",
		},
	});
}
