import { loadWebEnv } from '@/lib/env';

const env = loadWebEnv();

type RouteContext = {
	params: Promise<{ path?: string[] }>;
};

async function proxyRequest(request: Request, context: RouteContext) {
	const { path = [] } = await context.params;
	const incomingUrl = new URL(request.url);
	const targetUrl = new URL(`/v1/${path.join('/')}`, env.API_URL);
	targetUrl.search = incomingUrl.search;

	const headers = new Headers(request.headers);
	headers.delete('host');
	if (env.API_KEY) {
		headers.set('X-API-Key', env.API_KEY);
	}

	const response = await fetch(targetUrl, {
		method: request.method,
		headers,
		body:
			request.method === 'GET' || request.method === 'HEAD'
				? undefined
				: await request.text(),
	});

	return new Response(await response.text(), {
		status: response.status,
		headers: {
			'Content-Type':
				response.headers.get('Content-Type') ?? 'application/json',
		},
	});
}

export async function GET(request: Request, context: RouteContext) {
	return proxyRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
	return proxyRequest(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
	return proxyRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
	return proxyRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
	return proxyRequest(request, context);
}
