import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

const production = !process.env.ROLLUP_WATCH;

export default [
  // Main builds (UMD + ESM)
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/aicw-params-saver.js',
        format: 'umd',
        name: 'ParamsSaver',
        sourcemap: true,
        exports: 'named',
      },
      {
        file: 'dist/aicw-params-saver.esm.js',
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
    ],
  },
  // Minified UMD build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/aicw-params-saver.min.js',
      format: 'umd',
      name: 'ParamsSaver',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      production &&
        terser({
          compress: {
            drop_console: false,
            pure_funcs: [],
          },
          mangle: {
            properties: false,
          },
          format: {
            comments: false,
          },
        }),
    ],
  },
  // TypeScript declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/aicw-params-saver.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
];
