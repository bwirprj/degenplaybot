module.exports = {
  apps: [{
    name: 'degenplaybot',
    script: 'src/index.js',
    watch: false,
    env: {
      NODE_ENV: 'production'
    },
    restart_delay: 5000,
    max_restarts: 10,
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    time: true
  }]
};
