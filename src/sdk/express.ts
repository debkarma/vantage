import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { loadConfig } from '../engine/config.js';

const VANTAGE_SERVER = 'http://127.0.0.1:6789';

export const vantageMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.VANTAGE_MODE !== 'record') {
    return next(); // If not in record mode, just pass through
  }

  // Load config dynamically per request to pick up changes, or we could load it once. Let's load once per request for now since dev mode restarts anyway.
  const config = loadConfig();
  const ignorePaths = config.noise?.ignore_paths || [];
  const url = req.originalUrl || req.url;

  const shouldIgnore = ignorePaths.some(pattern => {
    if (pattern.startsWith('*.')) return url.endsWith(pattern.slice(1));
    return url.includes(pattern);
  });

  if (shouldIgnore) {
    return next();
  }
  
  console.log(`[Vantage SDK] Intercepting request: ${req.method} ${url}`);

  // Intercept the response
  const originalSend = res.send;
  const originalJson = res.json;

  let responseBody: any = null;

  res.send = function (body: any) {
    responseBody = body;
    return originalSend.apply(this, [body]);
  };

  res.json = function (body: any) {
    responseBody = body;
    return originalJson.apply(this, [body]);
  };

  res.on('finish', () => {
    // Only parse body if it's JSON or an object
    let parsedBody = responseBody;
    try {
      if (typeof responseBody === 'string') {
        parsedBody = JSON.parse(responseBody);
      }
    } catch(e) {}

    const testCase = {
      request: {
        method: req.method,
        path: req.originalUrl || req.url,
        headers: req.headers,
        body: req.body,
        query: req.query,
      },
      response: {
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsedBody,
      }
    };

    // Asynchronously send to Vantage CLI Server
    axios.post(`${VANTAGE_SERVER}/record`, testCase).catch(() => {
      // Ignore errors if Vantage isn't running
    });
  });

  next();
};
