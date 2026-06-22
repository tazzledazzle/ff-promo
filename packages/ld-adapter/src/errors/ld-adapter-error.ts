export class LdAdapterError extends Error {
	constructor(
		message: string,
		readonly context?: Record<string, unknown>,
	) {
		super(message);
		this.name = 'LdAdapterError';
	}
}

export class UnresolvedVariationError extends LdAdapterError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, context);
		this.name = 'UnresolvedVariationError';
	}
}

export class UnresolvedRuleError extends LdAdapterError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, context);
		this.name = 'UnresolvedRuleError';
	}
}

export class LdRateLimitError extends LdAdapterError {
	constructor(
		message: string,
		readonly retryAfterMs?: number,
		context?: Record<string, unknown>,
	) {
		super(message, context);
		this.name = 'LdRateLimitError';
	}
}

export class LdApiError extends LdAdapterError {
	constructor(
		message: string,
		readonly status: number,
		readonly body?: unknown,
		context?: Record<string, unknown>,
	) {
		super(message, context);
		this.name = 'LdApiError';
	}
}

export class ApprovalRequiredError extends LdAdapterError {
	constructor(
		message: string,
		readonly environmentKey?: string,
		context?: Record<string, unknown>,
	) {
		super(message, context);
		this.name = 'ApprovalRequiredError';
	}
}
