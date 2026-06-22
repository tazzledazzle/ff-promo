export class ApiError extends Error {
	constructor(
		public readonly statusCode: number,
		message: string,
		public readonly code?: string,
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export function conflict(message: string) {
	return new ApiError(409, message, 'conflict');
}

export function notFound(message: string) {
	return new ApiError(404, message, 'not_found');
}

export function unauthorized(message = 'Unauthorized') {
	return new ApiError(401, message, 'unauthorized');
}
