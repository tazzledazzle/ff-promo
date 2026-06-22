export class ApiClientError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code?: string,
	) {
		super(message);
		this.name = 'ApiClientError';
	}
}

export function isConflictError(error: unknown): error is ApiClientError {
	return error instanceof ApiClientError && error.status === 409;
}
