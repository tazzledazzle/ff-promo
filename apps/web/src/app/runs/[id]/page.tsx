import { RunDetail } from './run-detail';

type RunDetailPageProps = {
	params: Promise<{ id: string }>;
};

export default async function RunDetailPage({ params }: RunDetailPageProps) {
	const { id } = await params;
	return <RunDetail runId={id} />;
}
