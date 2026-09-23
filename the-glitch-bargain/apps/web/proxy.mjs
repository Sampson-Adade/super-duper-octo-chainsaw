import http from 'node:http';

const proxyPort = Number(process.env.PROXY_PORT) || 3000;
const webPort = Number(process.env.WEB_PORT) || 3002;
const socketPort = Number(process.env.SOCKET_PORT) || 3001;

function targetPort(url = '') {
  return url.startsWith('/socket.io') || url === '/health' ? socketPort : webPort;
}

function proxyRequest(req, res) {
  const port = targetPort(req.url);
  const upstream = http.request({
    hostname: '127.0.0.1',
    port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${port}` },
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.statusMessage, upstreamRes.headers);
    upstreamRes.pipe(res);
  });

  upstream.on('error', (error) => {
    console.error(`Proxy request to :${port} failed:`, error.message);
    if (!res.headersSent) res.writeHead(502).end('Game service is starting. Refresh in a moment.');
    else res.destroy(error);
  });
  req.pipe(upstream);
}

const server = http.createServer(proxyRequest);
server.on('upgrade', (req, clientSocket, head) => {
  const port = targetPort(req.url);
  const upstreamReq = http.request({
    hostname: '127.0.0.1',
    port,
    path: req.url,
    method: 'GET',
    headers: { ...req.headers, host: `127.0.0.1:${port}` },
  });

  upstreamReq.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
    const headers = Object.entries(upstreamRes.headers)
      .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join('\r\n');
    clientSocket.write(`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}\r\n${headers}\r\n\r\n`);
    if (upstreamHead.length) clientSocket.write(upstreamHead);
    if (head.length) upstreamSocket.write(head);
    upstreamSocket.pipe(clientSocket);
    clientSocket.pipe(upstreamSocket);
    clientSocket.on('error', () => upstreamSocket.destroy());
    upstreamSocket.on('error', () => clientSocket.destroy());
  });

  upstreamReq.on('response', (upstreamRes) => {
    const headers = Object.entries(upstreamRes.headers)
      .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join('\r\n');
    clientSocket.end(`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}\r\n${headers}\r\n\r\n`);
  });
  upstreamReq.on('error', (error) => {
    console.error(`Proxy WebSocket to :${port} failed:`, error.message);
    clientSocket.destroy();
  });
  upstreamReq.end();
});

server.listen(proxyPort, '0.0.0.0', () => console.log(`Game web proxy listening on :${proxyPort}`));
