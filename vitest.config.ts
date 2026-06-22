import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: "db",
					root: "./packages/db",
					include: ["src/**/*.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "worker",
					root: "./apps/worker",
					include: ["src/**/*.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "ld-adapter",
					root: "./packages/ld-adapter",
					include: ["src/**/*.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "telemetry",
					root: "./packages/telemetry",
					include: ["src/**/*.test.ts"],
				},
			},
		],
	},
});
