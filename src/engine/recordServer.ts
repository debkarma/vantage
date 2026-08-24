import express from 'express';
import { saveTestCase } from './storage.js';
import { loadConfig } from './config.js';
import axios from 'axios';

export function startRecordServer(
  port: number,
  testSetDir: string,
  appPort: number | null,
  proxyPort: number | undefined,
  onRecord: (id: string, path: string) => void
) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.raw({ type: '*/*', limit: '50mb' }));

  const config = loadConfig();
  const ignorePaths = config.noise?.ignore_paths || [];

  function shouldIgnore(url: string): boolean {
    return ignorePaths.some(pattern => {
      if (pattern.startsWith('*.')) return url.endsWith(pattern.slice(1));
      return url.includes(pattern);
    });
  }

  if (proxyPort) {
    // Reverse Proxy Mode: Intercept, forward, and record all traffic
    app.use(async (req, res) => {
      try {
        const targetUrl = `http://localhost:${proxyPort}${req.originalUrl}`;
        const startTime = Date.now();

        const outgoingHeaders = { ...req.headers };
        delete outgoingHeaders['host'];
        delete outgoingHeaders['content-length']; // Let Axios recalculate this based on data

        // Forward request
        let forwardData = req.body;
        if (req.headers['content-type']?.includes('application/x-www-form-urlencoded') && typeof forwardData === 'object') {
          forwardData = new URLSearchParams(forwardData).toString();
        }

        const axiosRes = await axios({
          method: req.method,
          url: targetUrl,
          headers: outgoingHeaders,
          data: forwardData,
          validateStatus: () => true, // Don't throw on 4xx/5xx
        });

        // Save recorded pair
        const requestData = {
          method: req.method,
          path: req.originalUrl,
          headers: req.headers as Record<string, string>,
          query: req.query as Record<string, any>,
          body: req.body,
        };

        const responseData = {
          status: axiosRes.status,
          headers: axiosRes.headers as Record<string, string>,
          body: axiosRes.data,
        };

        if (!shouldIgnore(req.originalUrl)) {
          const id = saveTestCase(testSetDir, { request: requestData, response: responseData }, appPort);
          onRecord(id, req.originalUrl);
        }

        // Relay actual response to client
        const headersToRelay = { ...axiosRes.headers };
        delete headersToRelay['transfer-encoding'];
        delete headersToRelay['content-length'];
        
        res.status(axiosRes.status).set(headersToRelay).send(axiosRes.data);
      } catch (e: any) {
        console.error('Proxy error:', e.message);
        res.status(502).json({ error: 'Bad Gateway', details: e.message });
      }
    });
  } else {
    // SDK Mode: Listen for explicitly sent req/res pairs
    app.post('/record', (req, res) => {
      try {
        const { request, response } = req.body;
        if (!shouldIgnore(request.path)) {
          const id = saveTestCase(testSetDir, { request, response }, appPort);
          onRecord(id, request.path);
          res.status(200).json({ success: true, id });
        } else {
          res.status(200).json({ success: true, ignored: true });
        }
      } catch (e) {
        console.error('Error saving record:', e);
        res.status(500).json({ success: false });
      }
    });
  }

  const server = app.listen(port, () => {
    // Server started silently — the UI handles logging
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[ERROR] Port ${port} is already in use! A previous record session is still running. Please stop it or kill the process on port ${port} first.\n`);
      process.exit(1);
    } else {
      console.error('Record server error:', err);
    }
  });

  return server;
}
