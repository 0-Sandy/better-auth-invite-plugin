/// <reference types="vitest" />
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		testTimeout: 18000,
		coverage: {
			exclude: [
				...(configDefaults.coverage.exclude ?? []),
				"src/**/*.test.fixtures.ts",
			],
		},
	},
});
