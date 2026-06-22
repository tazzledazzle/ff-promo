import Link from 'next/link';
import { QueryProvider } from '@/components/providers/query-provider';
import './globals.css';

export const metadata = {
	title: 'ff-promo Dashboard',
	description: 'Feature flag promotion operator dashboard',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>
				<header className="border-b">
					<nav className="container mx-auto flex max-w-6xl gap-4 px-4 py-3 text-sm">
						<Link href="/runs" className="font-medium hover:underline">
							Runs
						</Link>
						<Link href="/pipelines" className="font-medium hover:underline">
							Pipelines
						</Link>
					</nav>
				</header>
				<QueryProvider>{children}</QueryProvider>
			</body>
		</html>
	);
}
