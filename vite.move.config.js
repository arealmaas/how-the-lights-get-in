import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
// minify: false — the default esbuild minifier renames the imported encodeNotesParam binding to a single
// letter, which would still work at runtime but defeats the "codec is inlined" build check (grep for the
// function name in dist-move/index.html); this page is a few hundred bytes either way, so clarity wins.
export default defineConfig({root: 'move', plugins: [viteSingleFile()], build: {outDir: '../dist-move', emptyOutDir: true, minify: false}});
