// PM2 entry point — loads tsx CJS hook then runs bot.ts
require('./node_modules/tsx/dist/cjs/index.cjs');
require('./src/bot.ts');

