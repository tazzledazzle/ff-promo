import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

const packageRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);

let container: StartedPostgreSqlContainer | undefined;
let connectionString: string | undefined;

export function isTestcontainersSkipped(): boolean {
	return process.env.SKIP_TESTCONTAINERS === "1";
}

export async function startTestDatabase(): Promise<string> {
	if (isTestcontainersSkipped()) {
		const url = process.env.DATABASE_URL;
		if (!url) {
			throw new Error("SKIP_TESTCONTAINERS=1 requires DATABASE_URL to be set");
		}
		connectionString = url;
		process.env.DATABASE_URL = url;
		return url;
	}

	container = await new PostgreSqlContainer("postgres:16-alpine").start();
	connectionString = container.getConnectionUri();
	process.env.DATABASE_URL = connectionString;

	execSync("pnpm exec prisma migrate deploy", {
		cwd: packageRoot,
		env: process.env,
		stdio: "inherit",
	});

	return connectionString;
}

export async function stopTestDatabase(): Promise<void> {
	if (container) {
		await container.stop();
		container = undefined;
	}
	connectionString = undefined;
}

export function getTestDatabaseUrl(): string | undefined {
	return connectionString;
}
