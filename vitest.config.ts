import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

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
					name: "api",
					root: "./apps/api",
					include: ["src/**/*.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "web",
					root: "./apps/web",
					environment: "jsdom",
					setupFiles: ["./src/__tests__/setup.ts"],
					include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
				},
				resolve: {
					alias: {
						"@": path.resolve(__dirname, "./apps/web/src"),
					},
				},
				plugins: [react()],
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
