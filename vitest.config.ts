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
		],
	},
});
