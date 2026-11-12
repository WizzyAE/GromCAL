const {chromium} = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const {existsSync} = require('node:fs');
const path = require('node:path');
exports.startServer = async (folder = 'dist') => {
  const root = path.resolve(__dirname, '..', folder);
  const server = http.createServer(async (req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {
      const requested = !path.extname(file) ? path.join(root, 'index.html') : file;
      const data = await fs.readFile(requested);
      res.writeHead(200, {'Content-Type': ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff':'font/woff','.woff2':'font/woff2'})[path.extname(requested)] || 'application/octet-stream'}).end(data);
    } catch {res.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve))};
};
exports.launchBrowser = async () => {
  const executablePath = [process.env.GROMCAL_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
  return chromium.launch({headless:true,...(executablePath ? {executablePath} : {})});
};
