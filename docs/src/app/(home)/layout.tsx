import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";

export default function Layout({ children }: LayoutProps<"/">) {
	return (
		<HomeLayout
			{...baseOptions()}
			links={[
				{ text: "Documentation", url: "/docs" },
				{ text: "Showcase", url: "https://demo.better-invite.com" },
				{ text: "Blog", url: "/blog" },
				{ text: "Donate", url: "https://patreon.better-invite.com/membership" },
				{
					type: "menu",
					text: "For LLMs",
					items: [
						{
							text: "llms.txt",
							description: "Outline of the documentation",
							url: "/llms.txt",
						},
						{
							text: "llms-full.txt",
							description: "Full text of the documentation",
							url: "/llms-full.txt",
						},
					],
				},
			]}
		>
			{children}
		</HomeLayout>
	);
}
