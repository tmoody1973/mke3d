import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {defineConfig} from 'vite';

// Publish the city and every standalone landmark review alongside it.
export default defineConfig({
  build: {
    rolldownOptions: {
      input: readdirSync(import.meta.dirname)
        .filter(file=>file.endsWith('.html'))
        .map(file=>resolve(import.meta.dirname,file)),
    },
  },
});
