import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { GitBranch, GitCommitVertical } from "lucide-react";
import {
	docsVersions,
	latestVersion,
	resolveVersionFromSlug,
	versionedDocsHref,
} from "@/lib/docs-versions";
import { baseOptions } from "@/lib/layout.shared";
import { getSourceFor } from "@/lib/source";

export default async function Layout({
	children,
	params,
}: LayoutProps<"/docs/[[...slug]]">) {
	const { slug } = await params;
	const { version } = resolveVersionFromSlug(slug ?? []);
	const src = getSourceFor(version.slug);

	return (
		<DocsLayout
			tree={src.getPageTree()}
			{...baseOptions()}
			sidebar={{
				tabs: [
					...docsVersions.map((v) => {
						const cleanSlug = (slug ?? []).slice(version.slug ? 1 : 0);
						const targetHref = versionedDocsHref(
							`/docs/${cleanSlug?.join("/")}`,
							v,
						);

						return {
							title: v.label,
							url: targetHref,
							icon:
								v === latestVersion ? (
									<GitCommitVertical
										size="16"
										className="h-full justify-self-center"
									/>
								) : (
									<GitBranch size="16" className="h-full justify-self-center" />
								),
						};
					}),
				],
			}}
		>
			{children}
		</DocsLayout>
	);
}
