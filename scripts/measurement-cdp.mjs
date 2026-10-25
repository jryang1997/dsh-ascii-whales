import { spawn } from 'node:child_process';
import { readFile, open } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function connectCdp(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let sequence = 0;
  const pending = new Map(), events = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) { if (message.method === 'Runtime.exceptionThrown') events.push(message.params); return; }
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    clearTimeout(task.timer);
    if (message.error) task.reject(new Error(JSON.stringify(message.error)));
    else task.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error('CDP connection closed')); }
    pending.clear();
  });
  return {
    events,
    send(method, params = {}, timeoutMs = 120000) {
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout ${method}`)); }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    async evaluate(expression, timeoutMs = 120000) {
      const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, timeoutMs);
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    },
    close() { socket.close(); },
  };
}

export async function launchChrome({ chrome, profile, headless }, out) {
  const log = await open(path.join(out, 'chrome.log'), 'w');
  const args = ['--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, '--window-size=1280,800', ...(headless ? ['--headless=new'] : []), 'about:blank'];
  const child = spawn(chrome, args, { stdio: ['ignore', 'ignore', log.fd] });
  let exited = false, launchError = null;
  const exit = new Promise(resolve => { child.once('exit', () => { exited = true; resolve(); }); child.once('error', error => { launchError = error; exited = true; resolve(); }); });
  let browser = null, page = null;
  const close = async () => {
    if (browser) { try { await browser.send('Browser.close', {}, 5000); } catch { /* Browser shutdown may close the socket before its reply. */ } }
    if (!exited) await Promise.race([exit, delay(5000)]);
    if (!exited && child.pid) {
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        await once(killer, 'exit');
      } else child.kill('SIGKILL');
      await Promise.race([exit, delay(5000)]);
    }
    page?.close(); browser?.close();
    await log.close();
    if (!exited) throw new Error('Owned Chrome did not exit');
    return { browserExited: true, pid: child.pid };
  };
  try {
    let port = null;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (launchError) throw launchError;
      if (exited) throw new Error('Chrome exited before CDP became ready');
      try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); if (port) break; } catch { /* Chrome writes this file after startup. */ }
      await delay(100);
    }
    if (!port) throw new Error('Chrome CDP startup timeout');
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    browser = await connectCdp(version.webSocketDebuggerUrl);
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find(value => value.type === 'page' && value.url === 'about:blank');
    if (!target) throw new Error('Owned blank target missing');
    page = await connectCdp(target.webSocketDebuggerUrl);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Performance.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.bringToFront');
    return { browser, page, version, args, target, close };
  } catch (error) { await close(); throw error; }
}
