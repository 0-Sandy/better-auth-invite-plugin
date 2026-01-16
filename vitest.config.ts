/// <reference types="vitest" />
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		testTimeout: 10000,
		coverage: {
			exclude: [
				...(configDefaults.coverage.exclude ?? []),
				"src/**/*.test.fixtures.ts",
			],
		},
	},
});
