module.exports = {
  apps: [{
    name: 'jas-bot',
    script: './node_modules/tsx/dist/cli.mjs',
    args: 'src/bot.ts',
    cwd: __dirname,
    watch: false,
    restart_delay: 3000,
    max_restarts: 10,
    env: {
      NODE_ENV: 'production',
    },
  }],
};
