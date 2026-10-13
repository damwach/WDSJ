import {defineConfig} from 'vitest/config';
import {buildMetadata} from './scripts/build-metadata.mjs';
export default defineConfig({define:buildMetadata(),test:{include:['tests/**/*.test.ts']}});
