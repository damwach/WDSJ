import {defineConfig} from 'vite';
import {buildMetadata} from './scripts/build-metadata.mjs';

export default defineConfig({define: buildMetadata()});
