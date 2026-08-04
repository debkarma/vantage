import express from 'express';
import { saveTestCase } from './storage.js';

export function startRecordServer(
  port: number,
  testSetDir: string,
  appPort: number | null,
  onRecord: (id: string, path: string) => void
) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.post('/record', (req, res) => {
    try {
      const { request, response } = req.body;
      const id = saveTestCase(testSetDir, { request, response }, appPort);
      onRecord(id, request.path);
      res.status(200).json({ success: true, id });
    } catch (e) {
      console.error('Error saving record:', e);
      res.status(500).json({ success: false });
    }
  });

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
