import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import {readFileSync} from 'node:fs';
import {defineConfig} from 'rollup';
import pkg from '../package.json' with {type: 'json'};

const STATIC_ASSETS = [
	'osman.css',
	'images/logo.svg',
	'images/layers.svg',
	'images/marker-icon.svg',
	'images/marker-shadow.svg'
];

/** @type {import('rollup').OutputPlugin} */
const staticAssetsPlugin = {
	name: 'static-assets',
	generateBundle() {
		for (const fileName of STATIC_ASSETS) {
			const source = readFileSync(new URL(`../src/${fileName}`, import.meta.url));
			this.emitFile({type: 'asset', fileName, source});
		}
	},
};

const banner = `/* @preserve
 * Osman ${pkg.version}, a JS library for urban analysis map visualizations.
 */
`;

/** @type {import('rollup').OutputOptions} */
const commonOptions = {
	banner,
	sourcemap: true
};

/** @type {import('rollup').OutputOptions} */
const umdOptions = {
	...commonOptions,
	name: 'Osman',
	format: 'umd',
	freeze: false,
	noConflict: true,
	amd: {
		id: pkg.name
	}
};

export default defineConfig({
	input: './src/index.js',
	plugins: [json()],
	output: [
		{
			...commonOptions,
			file: pkg.exports['.'],
			plugins: [staticAssetsPlugin]
		},
		{
			...commonOptions,
			file: './dist/osman.js',
			plugins: [terser()],
		},
		{
			...umdOptions,
			file: './dist/osman-global-src.js',
		},
		{
			...umdOptions,
			file: './dist/osman-global.js',
			plugins: [terser()],
		}
	]
});
