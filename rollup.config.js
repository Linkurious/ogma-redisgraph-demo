import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import browsersync from 'rollup-plugin-browsersync';
import { terser } from 'rollup-plugin-terser';

const plugins = [
  nodeResolve(),
  commonjs()
];

if (!process.env.production) {
  plugins.push(browsersync({
    proxy: "localhost:8080"
  }));
}

export default [{
  input: './static/index.js',
  output: {
    file: './static/bundle.js',
    format: 'iife',
    name: 'Ogma',
    sourcemap: true,
    sourcemapFile: './static/bundle.js.map'
  },
  plugins
}];
