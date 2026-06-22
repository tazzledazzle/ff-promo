export class TelemetryAdapterError extends Error {
	constructor(
		message: string,
		readonly context?: Record<string, unknown>,
	) {
		super(message);
		this.name = 'TelemetryAdapterError';
	}
}

export class TelemetryApiError extends TelemetryAdapterError {
	constructor(
		message: string,
		readonly status: number,
		readonly body?: unknown,
		context?: Record<string, unknown>,
	) {
		super(message, context);
		this.name = 'TelemetryApiError';
	}
}

export class UnsupportedMetricTypeError extends TelemetryAdapterError {
	constructor(
		message: string,
		readonly metricType: string,
		context?: Record<string, unknown>,
	) {
		super(message, context);
		this.name = 'UnsupportedMetricTypeError';
	}
}
