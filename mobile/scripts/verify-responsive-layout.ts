import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter((value): value is string => Boolean(value));
const chrome = chromeCandidates.find(existsSync);
if (!chrome) throw new Error('未找到 Chrome 或 Edge；可通过 CHROME_PATH 指定浏览器路径');

const baseUrl = process.env.LAYOUT_URL ?? 'http://localhost:8081/';
const port = 9327;
const outputDir = join(tmpdir(), 'suisui-responsive-layout');
const profileDir = join(outputDir, 'chrome-profile');
mkdirSync(profileDir, { recursive: true });

const browser = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=1200,1000',
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true },
);

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function pageWebSocketUrl(): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as {
        type: string;
        webSocketDebuggerUrl: string;
      }[];
      const page = targets.find((target) => target.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome 可能仍在启动调试端口。
    }
    await delay(100);
  }
  throw new Error('Chrome 调试端口未就绪');
}

async function main() {
  const socket = new WebSocket(await pageWebSocketUrl());
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error('无法连接 Chrome 调试会话')), { once: true });
  });
  let nextId = 0;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as {
      id?: number;
      result?: unknown;
      error?: { message: string };
    };
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  const send = <T>(method: string, params: Record<string, unknown> = {}) =>
    new Promise<T>((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async <T>(expression: string): Promise<T> => {
    const response = await send<{ result: { value: T }; exceptionDetails?: unknown }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.exceptionDetails) throw new Error(`页面脚本执行失败：${expression}`);
    return response.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  const widths = [320, 390, 443, 1200];
  const reports: {
    page: 'home' | 'design-preview';
    width: number;
    innerWidth: number;
    scrollWidth: number;
    today: string;
    overflow: string[];
    bottomClearance: number | null;
    screenshotPath: string;
  }[] = [];
  for (const width of widths) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send('Page.navigate', { url: `${baseUrl}?layout-check=${width}` });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      ready = await evaluate<boolean>(
        `document.body.innerText.includes('今天 ') && !document.body.innerText.includes('正在读取事项')`,
      );
      if (ready) break;
      await delay(100);
    }
    if (!ready) throw new Error(`${width}px 页面在 10 秒内未完成数据读取`);
    const metrics = await evaluate<{
      innerWidth: number;
      scrollWidth: number;
      today: string;
      overflow: string[];
    }>(`(() => {
      const viewport = document.documentElement.clientWidth;
      const overflow = [...document.querySelectorAll('*')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' &&
            (rect.left < -0.5 || rect.right > viewport + 0.5);
        })
        .slice(0, 8)
        .map((element) => element.tagName + ':' + (element.textContent || '').trim().slice(0, 30));
      const today = [...document.querySelectorAll('*')]
        .map((element) => (element.textContent || '').trim())
        .find((text) => /^今天 \\d{4} 年 \\d{1,2} 月 \\d{1,2} 日 星期[一二三四五六日]$/.test(text)) || '';
      return {
        innerWidth: window.innerWidth,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        today,
        overflow,
      };
    })()`);
    const screenshot = await send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = join(outputDir, `home-${width}.png`);
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    reports.push({ page: 'home', width, ...metrics, bottomClearance: null, screenshotPath });
  }

  for (const width of [390, 518, 1200]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send('Page.navigate', { url: `${baseUrl}design-preview?layout-check=${width}` });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      ready = await evaluate<boolean>(
        `document.body.innerText.includes('近期重要日子') && document.body.innerText.includes('岁岁日历')`,
      );
      if (ready) break;
      await delay(100);
    }
    if (!ready) throw new Error(`视觉预览 ${width}px 页面在 10 秒内未完成渲染`);
    const metrics = await evaluate<{
      innerWidth: number;
      scrollWidth: number;
      today: string;
      overflow: string[];
    }>(`(() => {
      const viewport = document.documentElement.clientWidth;
      const overflow = [...document.querySelectorAll('*')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' &&
            (rect.left < -0.5 || rect.right > viewport + 0.5);
        })
        .slice(0, 8)
        .map((element) => element.tagName + ':' + (element.textContent || '').trim().slice(0, 30));
      return {
        innerWidth: window.innerWidth,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        today: document.body.innerText.includes('近期重要日子') ? 'today-ready' : '',
        overflow,
      };
    })()`);
    const screenshot = await send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = join(outputDir, `design-preview-${width}.png`);
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    const bottomClearance = await evaluate<number>(`(async () => {
      const last = document.querySelector('[aria-label^="阿宁的生日，"]');
      const navigation = document.querySelector('[role="tablist"]');
      if (!(last instanceof HTMLElement) || !(navigation instanceof HTMLElement)) return -999;
      let scroller = last.parentElement;
      while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) {
        scroller = scroller.parentElement;
      }
      if (!scroller) return -998;
      scroller.scrollTop = scroller.scrollHeight;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return navigation.getBoundingClientRect().top - last.getBoundingClientRect().bottom;
    })()`);
    const bottomScreenshot = await send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    writeFileSync(
      join(outputDir, `design-preview-${width}-bottom.png`),
      Buffer.from(bottomScreenshot.data, 'base64'),
    );
    reports.push({ page: 'design-preview', width, ...metrics, bottomClearance, screenshotPath });
  }
  socket.close();
  console.log(JSON.stringify(reports, null, 2));
  const failed = reports.filter(
    (report) =>
      report.innerWidth !== report.width ||
      report.scrollWidth > report.width ||
      report.overflow.length ||
      (report.bottomClearance !== null && report.bottomClearance < -0.5),
  );
  if (failed.length)
    throw new Error(`响应式布局存在越界：${failed.map((item) => `${item.page}-${item.width}px`).join('、')}`);
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => browser.kill());
