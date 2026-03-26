import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.{ts,tsx}', '__tests__/**/*.test.{ts,tsx}'],
        coverage: {
            reporter: ['text', 'html'],
            include: ['src/lib/**'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
