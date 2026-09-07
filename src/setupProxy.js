// Dev-server only (ignored by `npm run build`). The deployed backend whitelists
// CORS to dong-bong-league.com, so a browser on localhost gets blocked. Proxying
// /api through the dev server makes the calls same-origin, so CORS never applies.
// Pair with REACT_APP_API_URL='' so the app requests relative /api/... paths.
const { createProxyMiddleware } = require('http-proxy-middleware');

const TARGET =
  process.env.DBL_PROXY_TARGET ||
  'https://dbl-backend-bb5277fb0957.herokuapp.com';

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: TARGET,
      changeOrigin: true,
      // The backend rejects unknown Origins; a server-to-server call has none.
      onProxyReq: proxyReq => proxyReq.removeHeader('origin'),
      logLevel: 'warn',
    })
  );
};
