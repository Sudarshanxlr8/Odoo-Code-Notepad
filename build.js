const esbuild = require('esbuild');

const args = process.argv.slice(2);
const isMinify = args.includes('--minify');
const isWatch = args.includes('--watch');

async function run() {
  const context = await esbuild.context({
    entryPoints: ['./src/extension.ts'],
    bundle: true,
    outfile: './out/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    minify: isMinify,
    sourcemap: true,
    logLevel: 'info',
  });

  if (isWatch) {
    console.log('Watching for changes...');
    await context.watch();
  } else {
    console.log('Building...');
    await context.rebuild();
    await context.dispose();
    console.log('Build completed successfully.');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
