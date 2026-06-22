'use client';

import { useState } from 'react';
import type { PipelineCreateInput, StageInput } from '@ff-promo/contracts';
import { Button } from '@/components/ui/button';

const DEFAULT_STAGES: StageInput[] = [
	{
		orderIndex: 0,
		environment: 'dev',
		displayName: 'Development',
		gatePolicies: [
			{ metricType: 'error_rate', threshold: 0.01, serviceName: 'demo-service' },
			{ metricType: 'latency_p95', threshold: 500, serviceName: 'demo-service' },
		],
	},
	{
		orderIndex: 1,
		environment: 'staging',
		displayName: 'Staging',
		gatePolicies: [
			{ metricType: 'error_rate', threshold: 0.01, serviceName: 'demo-service' },
			{ metricType: 'latency_p95', threshold: 500, serviceName: 'demo-service' },
		],
	},
	{
		orderIndex: 2,
		environment: 'prod',
		displayName: 'Production',
		gatePolicies: [
			{ metricType: 'error_rate', threshold: 0.01, serviceName: 'demo-service' },
			{ metricType: 'latency_p95', threshold: 500, serviceName: 'demo-service' },
		],
	},
];

type PipelineFormProps = {
	onSubmit: (input: PipelineCreateInput) => Promise<void>;
	isSubmitting?: boolean;
	submitError?: string | null;
};

export function PipelineForm({
	onSubmit,
	isSubmitting = false,
	submitError,
}: PipelineFormProps) {
	const [name, setName] = useState('');
	const [flagKey, setFlagKey] = useState('');
	const [projectKey, setProjectKey] = useState('default');
	const [stages, setStages] = useState<StageInput[]>(DEFAULT_STAGES);
	const [validationError, setValidationError] = useState<string | null>(null);

	const updateStage = (
		index: number,
		field: 'displayName' | 'serviceName' | 'errorRate' | 'latencyP95',
		value: string,
	) => {
		setStages((current) =>
			current.map((stage, stageIndex) => {
				if (stageIndex !== index) {
					return stage;
				}
				if (field === 'displayName') {
					return { ...stage, displayName: value };
				}
				const gatePolicies = stage.gatePolicies.map((policy) => {
					if (field === 'serviceName') {
						return { ...policy, serviceName: value };
					}
					if (field === 'errorRate' && policy.metricType === 'error_rate') {
						return { ...policy, threshold: Number(value) };
					}
					if (field === 'latencyP95' && policy.metricType === 'latency_p95') {
						return { ...policy, threshold: Number(value) };
					}
					return policy;
				});
				return { ...stage, gatePolicies };
			}),
		);
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setValidationError(null);

		if (!name.trim() || !flagKey.trim() || !projectKey.trim()) {
			setValidationError('Name, flag key, and project key are required.');
			return;
		}

		for (const stage of stages) {
			for (const policy of stage.gatePolicies) {
				if (!policy.serviceName.trim() || policy.threshold <= 0) {
					setValidationError('All thresholds must be positive and service names required.');
					return;
				}
			}
		}

		await onSubmit({
			name: name.trim(),
			flagKey: flagKey.trim(),
			projectKey: projectKey.trim(),
			stages,
		});
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			{validationError ? (
				<div
					role="alert"
					className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{validationError}
				</div>
			) : null}
			{submitError ? (
				<div
					role="alert"
					className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{submitError}
				</div>
			) : null}

			<div className="grid gap-4 sm:grid-cols-3">
				<div className="space-y-2">
					<label htmlFor="name" className="text-sm font-medium">
						Name
					</label>
					<input
						id="name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						disabled={isSubmitting}
						className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
					/>
				</div>
				<div className="space-y-2">
					<label htmlFor="flagKey" className="text-sm font-medium">
						Flag key
					</label>
					<input
						id="flagKey"
						value={flagKey}
						onChange={(event) => setFlagKey(event.target.value)}
						disabled={isSubmitting}
						className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 font-mono text-sm"
					/>
				</div>
				<div className="space-y-2">
					<label htmlFor="projectKey" className="text-sm font-medium">
						Project key
					</label>
					<input
						id="projectKey"
						value={projectKey}
						onChange={(event) => setProjectKey(event.target.value)}
						disabled={isSubmitting}
						className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
					/>
				</div>
			</div>

			<div className="space-y-4">
				<h2 className="text-lg font-medium">Stages</h2>
				{stages.map((stage, index) => {
					const errorRate = stage.gatePolicies.find(
						(p) => p.metricType === 'error_rate',
					)?.threshold;
					const latencyP95 = stage.gatePolicies.find(
						(p) => p.metricType === 'latency_p95',
					)?.threshold;
					const serviceName = stage.gatePolicies[0]?.serviceName ?? '';

					return (
						<fieldset
							key={stage.environment}
							className="rounded-lg border p-4 space-y-3"
						>
							<legend className="px-1 text-sm font-medium capitalize">
								{stage.environment}
							</legend>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-2">
									<label
										htmlFor={`displayName-${index}`}
										className="text-sm font-medium"
									>
										Display name
									</label>
									<input
										id={`displayName-${index}`}
										value={stage.displayName}
										onChange={(event) =>
											updateStage(index, 'displayName', event.target.value)
										}
										disabled={isSubmitting}
										className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
									/>
								</div>
								<div className="space-y-2">
									<label
										htmlFor={`serviceName-${index}`}
										className="text-sm font-medium"
									>
										Service name
									</label>
									<input
										id={`serviceName-${index}`}
										value={serviceName}
										onChange={(event) =>
											updateStage(index, 'serviceName', event.target.value)
										}
										disabled={isSubmitting}
										className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
									/>
								</div>
								<div className="space-y-2">
									<label
										htmlFor={`errorRate-${index}`}
										className="text-sm font-medium"
									>
										Error rate threshold
									</label>
									<input
										id={`errorRate-${index}`}
										type="number"
										step="0.001"
										min="0"
										value={errorRate}
										onChange={(event) =>
											updateStage(index, 'errorRate', event.target.value)
										}
										disabled={isSubmitting}
										className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
									/>
								</div>
								<div className="space-y-2">
									<label
										htmlFor={`latencyP95-${index}`}
										className="text-sm font-medium"
									>
										Latency P95 threshold (ms)
									</label>
									<input
										id={`latencyP95-${index}`}
										type="number"
										min="1"
										value={latencyP95}
										onChange={(event) =>
											updateStage(index, 'latencyP95', event.target.value)
										}
										disabled={isSubmitting}
										className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
									/>
								</div>
							</div>
						</fieldset>
					);
				})}
			</div>

			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Creating…' : 'Create pipeline'}
			</Button>
		</form>
	);
}
