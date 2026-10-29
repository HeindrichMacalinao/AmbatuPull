'use strict';

const { createApp } = require('./app');
const { loadEnv } = require('./config/env');

let env;
try {
  env = loadEnv();
} catch (err) {
  console.warn('[config] Notice: environment not fully configured, falling back to defaults:\n', err.message);
  env = { port: Number(process.env.PORT) || 3000 };
}

const app = createApp();
const PORT = env.port || 3000;

const server = app.listen(PORT, () => {
  console.log(`Hope ERP server is running on port ${PORT}`);
});

module.exports = server;
