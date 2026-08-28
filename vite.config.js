import { defineConfig, loadEnv } from 'vite';
import { handleApiRequest } from './server/api.js';

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [{
      name: 'devtree-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/api/')) return next();
          handleApiRequest(req, res).catch(next);
        });
      }
    }]
  };
});
