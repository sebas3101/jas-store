module.exports = {
  apps: [{
    name: 'jas-bot',
    script: 'start.cjs',
    cwd: __dirname,
    interpreter: 'node',
    env: { NODE_ENV: 'production' },
    restart_delay: 3000,
    max_restarts: 10,
  }],
};
