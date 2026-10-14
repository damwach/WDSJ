import {defineConfig} from 'vitest/config';
export default defineConfig({test:{setupFiles:['tests/load-athlete.ts'],include:['tests/**/*.test.ts']}});
