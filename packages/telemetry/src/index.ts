export { createPrometheusClient } from './client/prometheus-client.js';
export type {
	PrometheusClient,
	PrometheusInstantQueryData,
} from './client/prometheus-client.js';
export {
	TelemetryAdapterError,
	TelemetryApiError,
	UnsupportedMetricTypeError,
} from './errors/telemetry-adapter-error.js';
export { evaluateGatePolicy } from './evaluate/evaluate-gate-policy.js';
export { evaluateStageGates } from './evaluate/evaluate-stage-gates.js';
export { runPreflightChecks } from './preflight/run-preflight.js';
export {
	buildErrorRateQuery,
	buildLatencyP95Query,
	buildMetricQuery,
	buildSampleCountQuery,
	escapePromqlLabelValue,
} from './query/build-promql.js';
export {
	parseInstantQueryResult,
	type ParseResult,
} from './query/parse-response.js';

export type {
	GateEvaluationResult,
	GateRunContext,
	PreflightReport,
	PrometheusClientConfig,
	StageGateEvaluation,
} from '@ff-promo/contracts';
