/* ============================================================================
 * dsh-startup-screen — Host 半侧
 * ----------------------------------------------------------------------------
 * 做三件事：
 *   1) 在 index.html 里注入「启动界面」：首屏兜底黑幕 + 关键 CSS + 配置 + 运行时
 *   2) 提供 /dsh-startup/splash.css · splash.js · config 三个路由
 *   3) 把配置持久化到 ~/.dsh/dsh-startup.json（设置页经 /dsh-startup/config 读写）
 *
 * 说明：配置刻意不走 settings 命名空间，而是自带一份 JSON + 自带设置面板
 * （与 dsh-meme 同款做法），这样不受 dsh-settings 版本变更影响。
 * ========================================================================== */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'dsh-startup.json')

const NS = 'dsh-startup-secret'
const ROUTE_BASE = '/dsh-startup'

/** 插件版本：读自己的 package.json，避免源码与版本号两处各写一份。
    读不到就退回占位符（设置页会显示它，不会显示 undefined）。 */
const PLUGIN_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
    const v = String(pkg.version || '').trim()
    return v || '0.0.0'
  } catch (err) {
    return '0.0.0'
  }
})()

/** 默认配置：字段与 lib/splash.js 的 DEFAULTS 一一对应。 */
const DEFAULTS = {
  enabled: true,
  mode: 'session',            // always | session | daily
  theme: 'dark',             // light | dark
  speed: 1,
  autoPlay: 'full',           // full=完全自动播放 / once=仅需点击一次进入（需空密码）/ off=不自动播放
  requireInteraction: true,   // 旧字段：仅用于把老配置迁移到 autoPlay
  allowSkip: false,
  sound: true,                // 界面音效（WebAudio 合成，无音频文件）
  soundVolume: 0.5,
  voice: true,                // 女声播报（Web Speech API）
  voiceLang: 'en',            // en | zh | both
  voiceName: '',              // '' = 自动挑（按分数优先神经网络女声）；另有 zhixing-cn / calmlady-jp / pessimistic-ru / announcer-kr 四档真声音色
  voiceRate: 0.88,            // 电影旁白档：比朗读慢，字与字之间才有重量
  voicePitch: 0.85,           // 压低音调，深沉的 AI 女声
  voiceVolume: 0.9,
  voiceCue: true,             // 念台词前的一声轻提示
  sfx: 'audio',               // 音效来源：audio=lib/assets 里的真素材 / synth=现场合成
  voiceSource: 'asset',       // 语音来源：asset=优先用真声素材（拿不到自动回落 TTS）/ tts=全 TTS
  voiceLead: 240,             // 提示音之后留一小段空白再开口
  bgm: true,                  // 背景音乐（整段动画的底噪，WebAudio 现场合成，无音频文件）
  bgmVolume: 0.55,            // 背景音乐音量（独立于台词与音效）
  bgmStyle: 'cinematic',      // cinematic=电影感氛围 / pulse=工业脉冲
  bgmSource: 'builtin',       // builtin=内置合成 / custom=自定义链接或本机文件
  bgmUrl: '',                 // 自定义音源：http(s) 直链，或本机绝对路径（D:\music\a.mp3）
  mascot: 0,                  // 右下角人物立绘：0=水手服 1=中山装 2=J装 3=最美好的主唱 -1=空（不显示）
  eventWindow: false,         // 降世事件窗口：默认关闭；开启后每次动画结束都弹出（另：首次启动弹一次）
  identity: 'Pavel Korchagin',// ← 设置页里可改的「身份名称」
  identityId: '89757',
  accessLevel: '3',
  identityPassword: '',       // ← 第二步身份确认的访问密码（空 = 不启用密码校验）
  brand1: '银河意识体',
  brand2: 'LONG MARCH  HARNESS',
  brand3a: '长征机',
  brand3b: '人民公仆',
  orgZh: '伟大智能统辖',
  orgEn: 'GREAT INTELLIGENT DOMINATION',
  orgSub: '愿无一人被遗忘',
  welcomeBox: '亚洲人民统辖体',
  footer: 'Powered By LONG MARCH',
  accent: '#c70000',
  glitchA: '#ff3b30',
  glitchB: '#ce0912'
}

const TEXT_KEYS = [
  'identity', 'identityId', 'accessLevel',
  'brand1', 'brand2', 'brand3a', 'brand3b',
  'orgZh', 'orgEn', 'orgSub', 'welcomeBox', 'footer', 'voiceName'
]
const COLOR_KEYS = ['accent', 'glitchA', 'glitchB']
const ENUMS = {
  mode: ['always', 'session', 'daily'],
  theme: ['light', 'dark'],
  voiceLang: ['en', 'zh', 'both'],
  sfx: ['audio', 'synth'],
  voiceSource: ['asset', 'tts'],
  autoPlay: ['full', 'once', 'off'],
  bgmStyle: ['cinematic', 'pulse'],
  bgmSource: ['builtin', 'custom']
}
const BOOL_KEYS = ['enabled', 'requireInteraction', 'allowSkip', 'sound', 'voice', 'voiceCue', 'eventWindow', 'bgm']
/** 数值字段的合法区间（越界即夹取）。 */
const RANGES = {
  speed: [0.35, 3],
  soundVolume: [0, 1],
  voiceRate: [0.5, 2],
  voiceLead: [0, 1200],
  voicePitch: [0, 2],
  voiceVolume: [0, 1],
  bgmVolume: [0, 1]
}

/** 旧字段的真假判定：老配置里可能是 true / 'true' / 1 / '1'，也可能是 undefined(null)。 */
function isFalseish(value) {
  return value === false || value === 'false' || value === 0 || value === '0'
}

function normalize(input) {
  const out = { ...DEFAULTS }
  const src = input && typeof input === 'object' ? input : {}
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in src) || src[key] === undefined || src[key] === null) continue
    const value = src[key]
    if (BOOL_KEYS.includes(key)) {
      out[key] = value === true || value === 'true' || value === 1 || value === '1'
    } else if (ENUMS[key]) {
      out[key] = ENUMS[key].includes(value) ? value : DEFAULTS[key]
    } else if (key === 'speed' || RANGES[key]) {
      const [lo, hi] = RANGES[key] || RANGES.speed
      const n = Number(value)
      out[key] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : DEFAULTS[key]
    } else if (key === 'bgmUrl') {
      /* 链接可能很长（抖音/网盘直链），单独给到 512 字符，不让 TEXT_KEYS 的 64 截断 */
      out[key] = String(value).trim().slice(0, 512)
    } else if (COLOR_KEYS.includes(key)) {
      const s = String(value).trim()
      out[key] = /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : DEFAULTS[key]
    } else if (TEXT_KEYS.includes(key)) {
      out[key] = String(value).slice(0, 64)
    } else {
      out[key] = value
    }
  }
  /* 自动播放三档。注意 requireInteraction 在循环里已经被判成布尔了，
     所以「本次提交是否真的带了 autoPlay」必须用原始输入判断：
       - 带了合法值 → 用它；
       - 没带（老配置 / 老设置页）→ 按 requireInteraction 迁移（true→off，false→full）；
       - 带了非法值 → 落到 off（保守，绝不擅自变全自动）。 */
  const apRaw = typeof src.autoPlay === 'string' ? src.autoPlay.trim() : undefined
  if (apRaw !== undefined && ENUMS.autoPlay.includes(apRaw)) {
    out.autoPlay = apRaw
  } else if (apRaw === undefined) {
    out.autoPlay = isFalseish(src.requireInteraction) ? 'full' : 'off'
  } else {
    out.autoPlay = 'off'
  }
  out.requireInteraction = out.autoPlay === 'off'
  /* 选了「自定义」却没填链接：退回内置曲，别让整段动画静音 */
  if (out.bgmSource === 'custom' && !String(out.bgmUrl || '').trim()) out.bgmSource = 'builtin'
  const mi = parseInt(out.mascot, 10)
  /* -1 = 「空」：不显示立绘 */
  out.mascot = Number.isFinite(mi) ? Math.min(3, Math.max(-1, mi)) : 0
  if (!String(out.identity).trim()) out.identity = DEFAULTS.identity
  if (!String(out.identityId).trim()) {
    out.identityId = String(out.identity).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  }
  if (!String(out.identityId).trim()) out.identityId = 'OPERATOR'
  return out
}

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
    return normalize(JSON.parse(raw))
  } catch (err) {
    return { ...DEFAULTS }
  }
}

function writeConfig(next) {
  const cfg = normalize(next)
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  const tmp = CONFIG_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8')
  fs.renameSync(tmp, CONFIG_FILE)
  return cfg
}

/** 静态文件按 mtime 缓存，改完插件刷新页面即生效。 */
function makeReader(rel) {
  let cache = null
  return function read() {
    const file = path.join(PACKAGE_ROOT, rel)
    try {
      const st = fs.statSync(file)
      if (!cache || cache.mtimeMs !== st.mtimeMs) {
        cache = { mtimeMs: st.mtimeMs, text: fs.readFileSync(file, 'utf8') }
      }
      return cache.text
    } catch (err) {
      return ''
    }
  }
}

const readSplashCss = makeReader('lib/splash.css')
const readSplashJs = makeReader('lib/splash.js')
const readAssetData = makeReader('lib/asset-data.js')

/** 内联脚本里绝对不能出现 `</script>`。 */
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '')
}

/** 首屏兜底：在应用挂载前先把窗口盖住，避免闪出界面本体。 */
const CRITICAL_CSS = [
  'html.dsu-lock,html.dsu-lock body{overflow:hidden!important}',
  '#dsh-startup-root.dsu-boot{position:fixed;inset:0;z-index:2147483000;background:#000}'
].join('')

const BOOTSTRAP_JS = `(function(){try{
var c=window.__DSH_STARTUP__||{};
var root=document.getElementById('dsh-startup-root');
var off=!c.enabled;
if(!off&&c.mode==='session'&&sessionStorage.getItem('dsh-startup-screen:shown')==='1')off=true;
if(!off&&c.mode==='daily'&&localStorage.getItem('dsh-startup-screen:day')===new Date().toISOString().slice(0,10))off=true;
if(off){window.__DSH_STARTUP_SKIP__=true;if(root&&root.parentNode)root.parentNode.removeChild(root);}
else{document.documentElement.classList.add('dsu-lock');/* 兜底：连 splash.js 都没跑起来（404/被拦/语法错）时，9 秒后无条件放行，绝不锁黑屏 */setTimeout(function(){try{var r=document.getElementById('dsh-startup-root');if(r&&r.className&&r.className.indexOf('dsu-boot')!==-1){if(r.parentNode)r.parentNode.removeChild(r);document.documentElement.classList.remove('dsu-lock');if(document.body)document.body.style.overflow='';window.__DSH_STARTUP_FAILED__=true;}}catch(e){}},9000);}
}catch(e){} })()`

const name = NS
const inject = ['webServer', 'connection']

/**
 * 取得 HTTP 载体服务。
 *
 * web profile 与桌面端（DeepSeek Harness Desktop）都会挂 `@deepseek-ai/dsh-web-app`，
 * 其中 `webserver` 这一行提供 `webServer`；但 Electron 也可能改成 `file://` + IPC
 * 直接下发前端（`dsh-host-webserver` 的文档注释就写着 "Electron uses file:// plus
 * IPC instead"）。那种情况下没有 webServer，本插件不该把一颗 fiber 炸掉 ——
 * 交给客户端半侧自举（`lib/client.js` 的 selfBoot）。
 */
function resolveWebServer(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (viaGet) return viaGet
  } catch (err) { /* 取不到就当没有 */ }
  return ctx.webServer
}

function hasRoutes(server) {
  return !!server && typeof server.register === 'function' && typeof server.tapIndex === 'function'
}

function apply(ctx) {
  const disposers = []
  const webServer = resolveWebServer(ctx)

  /** 没有可注册路由的 HTTP 载体：桌面端若走 IPC 下发前端就是这种形态。
      什么都不注册（plugin 仍然 APPLIED，不报错），页面由客户端半侧自举。 */
  if (!hasRoutes(webServer)) {
    try {
      ctx.logger?.warn?.(
        '[' + NS + '] 当前 profile 没有可用的 webServer（桌面端可能用 file:// + IPC 下发前端）；' +
        'Host 半侧跳过路由与首屏注入，改由浏览器半侧自举启动界面。'
      )
    } catch (err) { /* 日志失败不影响加载 */ }
    return
  }

  /** 浏览器信任栅栏：自定义路由必须过一遍，否则可被任意网页读写。 */
  function rejected(req, res) {
    try {
      const conn = (typeof ctx.get === 'function' ? ctx.get('connection') : undefined) || ctx.connection
      if (!conn || typeof conn.requestRejection !== 'function') return false
      const code = conn.requestRejection(req)
      if (code === undefined || code === null || code === false) return false
      res.statusCode = typeof code === 'number' ? code : 403
      res.end()
      return true
    } catch (err) {
      return false
    }
  }

  function registerRoute(route) {
    const inner = route && route.handler
    const wrapped = Object.assign({}, route, {
      handler: async (req, res) => {
        if (rejected(req, res)) return
        return inner(req, res)
      }
    })
    return webServer.register(wrapped)
  }

  function sendJson(res, code, payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function readBody(req, limit = 64 * 1024) {
    return new Promise((resolve) => {
      let size = 0
      const chunks = []
      req.on('data', (c) => {
        size += c.length
        if (size > limit) {
          req.destroy()
          resolve('')
          return
        }
        chunks.push(c)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', () => resolve(''))
    })
  }

  function sendText(res, type, text) {
    const body = Buffer.from(text, 'utf8')
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/splash.css',
    handler: (req, res) => sendText(res, 'text/css; charset=utf-8', readSplashCss())
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/splash.js',
    handler: (req, res) => sendText(res, 'application/javascript; charset=utf-8', readSplashJs())
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/asset-data.js',
    handler: (req, res) => sendText(res, 'application/javascript; charset=utf-8', readAssetData())
  }))

  /* 音频素材已改为打包内联（lib/asset-data.js → 浏览器 window.__DSA_ASSETS__），
     不再提供音频 HTTP 路由，彻底去掉音频的网络请求。
     lib/assets/*.mp3 仍随包发布，作为内联数据的源文件与本地兜底。 */
  /* ── 自定义背景音乐的本地文件路由（1.5.1）──────────────────────────────
     设置里填本机绝对路径时，页面是 http://127.0.0.1:port，读不了 file://，
     所以由 Host 把文件按字节流下发。约束：
       · 只接受绝对路径 + 音频/视频扩展名白名单；· 单文件上限 80MB；
       · 支持 Range，<audio> 能拖动/循环；· 和其它自定义路由一样先过信任栅栏
         （requestRejection），别的网页拿不到。
     例：/dsh-startup/bgm?path=D%3A%5Cmusic%5Ca.mp3 */
  const BGM_TYPES = {
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.m4b': 'audio/mp4',
    '.aac': 'audio/aac',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.oga': 'audio/ogg',
    '.opus': 'audio/ogg',
    '.flac': 'audio/flac',
    '.mp4': 'video/mp4',
    '.webm': 'audio/webm'
  }
  const BGM_MAX_BYTES = 80 * 1024 * 1024

  function sendBgmFile(req, res) {
    let file = ''
    try {
      file = new URL(req.url || '/', 'http://x').searchParams.get('path') || ''
    } catch (err) { file = '' }
    const type = BGM_TYPES[path.extname(file).toLowerCase()]
    if (!file || !type || !path.isAbsolute(file)) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('bad bgm path')
      return
    }
    let stat = null
    try { stat = fs.statSync(file) } catch (err) { stat = null }
    if (!stat || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('not found')
      return
    }
    if (stat.size > BGM_MAX_BYTES) {
      res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('too large')
      return
    }
    const total = stat.size
    const head = {
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store'
    }
    let start = 0
    let end = total - 1
    let code = 200
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim())
    if (m) {
      const a = m[1] === '' ? null : parseInt(m[1], 10)
      const b = m[2] === '' ? null : parseInt(m[2], 10)
      if (a === null && b !== null) {
        start = Math.max(0, total - b)
      } else if (a !== null) {
        start = a
        if (b !== null) end = Math.min(b, total - 1)
      }
      if (!(start >= 0 && start < total && start <= end)) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + total })
        res.end()
        return
      }
      code = 206
      head['Content-Range'] = 'bytes ' + start + '-' + end + '/' + total
    }
    head['Content-Length'] = String(end - start + 1)
    try {
      res.writeHead(code, head)
      const stream = fs.createReadStream(file, { start, end })
      stream.on('error', () => { try { res.destroy() } catch (err) {} })
      stream.pipe(res)
    } catch (err) {
      try { res.writeHead(500); res.end() } catch (err2) { /* noop */ }
    }
  }

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/bgm',
    handler: (req, res) => sendBgmFile(req, res)
  }))

disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/config',
    handler: async (req, res) => {
      const method = (req.method || 'GET').toUpperCase()
      if (method === 'GET') {
        sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: readConfig(), defaults: DEFAULTS, file: CONFIG_FILE })
        return
      }
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const text = await readBody(req)
      let payload = {}
      try {
        payload = text ? JSON.parse(text) : {}
      } catch (err) {
        sendJson(res, 400, { ok: false, error: 'invalid json' })
        return
      }
      try {
        if (payload && payload.action === 'reset') {
          const cfgNow = writeConfig(DEFAULTS)
          sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: cfgNow, defaults: DEFAULTS })
          return
        }
        const current = readConfig()
        const patch = payload && typeof payload.patch === 'object' && payload.patch ? payload.patch : payload
        const cfgNow = writeConfig({ ...current, ...patch })
        sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: cfgNow, defaults: DEFAULTS })
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  disposers.push(webServer.tapIndex((html) => {
    if (!html || html.includes(ROUTE_BASE + '/splash.js')) return html
    const cfg = readConfig()
    const head =
      '<link rel="stylesheet" href="' + ROUTE_BASE + '/splash.css">' +
      '<style id="dsh-startup-critical">' + CRITICAL_CSS + '</style>'
    const body =
      '<div id="dsh-startup-root" class="dsu-root dsu-boot"></div>' +
      '<script>window.__DSH_STARTUP_BOOT__="index";window.__DSH_STARTUP_VERSION__=' + safeJson(PLUGIN_VERSION) + ';window.__DSH_STARTUP_CONFIG_URL__=' + safeJson(ROUTE_BASE + '/config') + ';window.__DSH_STARTUP__=' + safeJson(cfg) + ';' + BOOTSTRAP_JS + '</script>' +
      '<script defer src="' + ROUTE_BASE + '/asset-data.js"></script>' +
      '<script defer src="' + ROUTE_BASE + '/splash.js"></script>'

    let out = html
    if (out.includes('</head>')) out = out.replace('</head>', head + '</head>')
    else out = head + out
    if (out.includes('<body>')) out = out.replace('<body>', '<body>' + body)
    else if (out.includes('</body>')) out = out.replace('</body>', body + '</body>')
    else out = out + body
    return out
  }))

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch (err) { /* noop */ }
    }
  })
}

/* 导出形状对齐 DSH 内部插件（如 dsh-host-open-in-app）：
   只给具名 name / inject / apply。
   两点刻意不做：
   1) 不导出 default —— cordis-plugin-loader 的 unwrapExports 是
      `exports.default ?? exports`，一旦有 default 就只认 default，
      两边都写反而多一个"改一处忘一处"的坑；
   2) 不导出 Config —— Cordis 约定 Config 是 schemastery schema，
      我这份只是普通默认值对象，当 schema 用会炸。本插件也不吃 profile 配置。 */
export { apply, inject, name }
