import { findSiblings } from "fumadocs-core/page-tree";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { GithubInfo } from "fumadocs-ui/components/github-info";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
	EditOnGitHub,
	PageLastUpdate,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Heart, MilestoneIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LLMCopyButton, ViewOptions } from "@/components/ai/page-actions";
import { APIMethod } from "@/components/api-method";
import DatabaseTable from "@/components/database-table";
import { Feedback, FeedbackBlock } from "@/components/feedback/client";
import { GithubUser } from "@/components/github-user";
import { Mermaid } from "@/components/mdx/mermaid";
import { NpmButton } from "@/components/npm-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
	type DocsVersion,
	docsVersions,
	resolveVersionFromSlug,
	scopeDocsHref,
} from "@/lib/docs-versions";
import { onBlockFeedbackAction, onPageFeedbackAction } from "@/lib/github";
import { createMetadata, getPageImage } from "@/lib/metadata";
import { getSourceFor } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
	const { slug } = await props.params;
	const { version, relSlug } = resolveVersionFromSlug(slug ?? []);
	const src = getSourceFor(version.slug);
	const page = src.getPage(relSlug);

	if (!page) notFound();

	// Upstream content always lives at docs/content/docs on each branch;
	// `content/docs-beta` is only a local sync target, not in the repo tree.
	const rawBase = `https://raw.githubusercontent.com/better-invite/better-invite/${version.branch}/docs/content/docs`;
	const githubBase = `https://github.com/better-invite/better-invite/blob/${version.branch}/docs/content/docs`;

	// Keep every absolute /docs link scoped to the version being viewed.
	const scope = (href: string | undefined) => scopeDocsHref(href, version);
	const DefaultAnchor = defaultMdxComponents.a;

	// TODO: Remove gitConfig and GithubInfo
	const gitConfig = {
		user: "better-invite",
		repo: "better-invite",
		branch: "main",
	};
	const npmName = "better-invite";

	const lastModifiedTime = page.data.lastModified;
	const MDX = page.data.body;

	return (
		<DocsPage toc={page.data.toc} full={page.data.full}>
			{version.slug === "beta" && <BetaBanner version={version} />}
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription className="mb-0">
				{page.data.description}
			</DocsDescription>
			<div className="flex flex-row gap-2 items-center border-b pb-6">
				<LLMCopyButton markdownUrl={`${rawBase}.mdx`} />
				<ViewOptions
					markdownUrl={`${page.url}.mdx`}
					githubUrl={`${githubBase}/${page.path}`}
				/>
				<NpmButton packageName={npmName} />
			</div>
			<DocsBody>
				<MDX
					components={getMDXComponents({
						// this allows you to link to other pages with relative file paths
						a: (props: React.ComponentProps<"a">) => (
							<DefaultAnchor {...props} href={scope(props.href)} />
						),
						Link: ({
							href,
							className,
							...props
						}: React.ComponentProps<typeof Link>) => (
							<Link
								href={typeof href === "string" ? (scope(href) ?? href) : href}
								className={cn(
									"font-medium underline underline-offset-4",
									className,
								)}
								{...props}
							/>
						),
						Step,
						Steps,
						Callout,
						Tabs,
						Tab,
						APIMethod,
						GithubInfo: (props) => (
							<GithubInfo
								owner={gitConfig.user}
								repo={gitConfig.repo}
								{...props}
							/>
						),
						TypeTable,
						Accordions,
						Accordion,
						FeedbackBlock: ({ children, ...props }) => (
							<FeedbackBlock {...props} onSendAction={onBlockFeedbackAction}>
								{children}
							</FeedbackBlock>
						),
						GithubUser,
						DatabaseTable,
						Mermaid,
						DocsCategory: ({ url }) => {
							return <DocsCategory url={url ?? page.url} src={src} />;
						},
					})}
				/>
			</DocsBody>
			<Feedback onSendAction={onPageFeedbackAction}>
				<div className="flex flex-row items-center flex-wrap gap-y-2 gap-x-4">
					<Link
						href="https://patreon.better-invite.com"
						target="_blank"
						rel="noreferrer noopener"
						className={buttonVariants({
							variant: "secondary",
							className: "group text-foreground text-xs py-1.5 gap-1.5",
						})}
					>
						<Heart
							className="size-3.5 transition-all duration-300 
											fill-transparent stroke-current
											group-hover:fill-red-500 
											group-hover:stroke-red-500
											group-hover:scale-110
											group-hover:drop-shadow-[0_0_6px_rgba(255,0,0,0.7)]"
						/>
						Donate
					</Link>
					<EditOnGitHub
						href={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/docs/content/docs/${page.path}`}
					/>
				</div>
			</Feedback>
			{lastModifiedTime && <PageLastUpdate date={lastModifiedTime} />}
		</DocsPage>
	);
}

function BetaBanner({ version }: { version: DocsVersion }) {
	return (
		<div className="mb-2 flex items-center gap-3 py-2.5 text-sm text-blue-600 dark:text-blue-400 text-pretty">
			<MilestoneIcon size={18} className="shrink-0" fill="currentColor" />
			<p>
				You are currently viewing documentation for{" "}
				<span className="bg-blue-600/10 dark:bg-blue-400/15 px-1 py-0.5 rounded-lg font-medium tracking-wider">
					{version.label}
				</span>
			</p>
		</div>
	);
}

export async function generateStaticParams() {
	return docsVersions.flatMap((v) => {
		const src = getSourceFor(v.slug);
		return src.generateParams().map((p) => ({
			slug: v.slug ? [v.slug, ...(p.slug ?? [])] : p.slug,
		}));
	});
}

export async function generateMetadata(
	props: PageProps<"/docs/[[...slug]]">,
): Promise<Metadata> {
	const { slug } = await props.params;
	const { version, relSlug } = resolveVersionFromSlug(slug ?? []);
	const src = getSourceFor(version.slug);
	const page = src.getPage(relSlug);
	if (!page) return notFound();

	const title = version.slug
		? `${version.label} - ${page.data.title}`
		: page.data.title;

	const description =
		page.data.description ??
		"A plugin for Better Auth that adds an invitation system, allowing you to create, send, and manage invites for user sign-ups or role upgrades.";

	const ogUrl = getPageImage(page).url;

	return createMetadata({
		title,
		description,
		openGraph: {
			title,
			description,
			type: "article",
			images: [
				{
					url: ogUrl,
					width: 1200,
					height: 630,
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: [ogUrl],
		},
	});
}

function DocsCategory({
	url,
	src,
}: {
	url: string;
	src: ReturnType<typeof getSourceFor>;
}) {
	return (
		<Cards>
			{findSiblings(src.getPageTree(), url).flatMap((item) => {
				if (item.type === "separator") return [];
				if (item.type === "folder") {
					if (!item.index) return [];
					item = item.index;
				}

				return (
					<Card key={item.url} title={item.name} href={item.url}>
						{item.description}
					</Card>
				);
			})}
		</Cards>
	);
}
