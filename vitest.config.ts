import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: [
            'src/**/*.test.{ts,tsx}',
            'src/**/*.integration.test.{ts,tsx}',
            '__tests__/**/*.test.{ts,tsx}',
        ],
        exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
        setupFiles: ['./tests/setup/vitest.setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov', 'json-summary'],
            include: ['src/lib/**', 'src/app/api/**'],
            exclude: ['**/*.test.ts', '**/*.test.tsx', '**/mocks/**'],
            all: true,
            thresholds: {
                statements: 85,
                branches: 80,
                functions: 80,
                lines: 85,
            },
        },
        testTimeout: 15000,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
