/* ============================================================================
 * 2026-10-18 三个新功能的冒烟测试
 *
 *   1) 自动播放三档：full（完全自动）/ once（仅需点击一次，需空密码）/ off（不自动）
 *      - 老配置只有 requireInteraction，必须按 true→off、false→full 迁移
 *   2) 降世事件窗口：默认关闭；装好后的首次启动弹一次；勾选后每次都弹
 *   3) 人物立绘「空」：mascot = -1 时不渲染任何立绘图片
 *
 * 做法与 smoke-splash.mjs 一致：最小 DOM 桩 + vm 里跑真实的 splash.js。
 * 运行时状态（C）挂在 __DSH_STARTUP_API__.config 上，直接断言它。
 *
 * 用法：node test/new-options.mjs
 * ========================================================================== */
import fs from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const BUNDLE = fileURLToPath(new URL('../lib/splash.js', import.meta.url))
const HOST = fileURLToPath(new URL('../lib/index.js', import.meta.url))

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra !== undefined ? '  → ' + extra : '')) }
}

/* ── 最小 DOM 桩（与 smoke-splash.mjs 同款，够用即可）───────────────────── */
function makeEl(tag) {
  const el = {
    tagName: tag,
    _cls: '',
    _text: '',
    _html: '',
    style: { setProperty() {}, removeProperty() {} },
    dataset: {},
    children: [],
    hidden: false,
    offsetWidth: 1,
    parentNode: null,
    appendChild(c) { this.children.push(c); if (c) c.parentNode = this; return c },
    insertBefore(c) { this.children.unshift(c); if (c) c.parentNode = this; return c },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c },
    setAttribute() {},
    getAttribute() { return null },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    animate() { return { cancel() {}, finish() {} } },
    getTotalLength() { return 120 },
    querySelector(sel) { return lookup(sel) },
    querySelectorAll() { return [] },
    focus() {},
    contains() { return false },
  }
  Object.defineProperty(el, 'className', {
    get() { return el._cls },
    set(v) { el._cls = v == null ? '' : String(v) },
  })
  Object.defineProperty(el, 'textContent', {
    get() { return el._text },
    set(v) { el._text = v == null ? '' : String(v) },
  })
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html },
    set(v) { el._html = v == null ? '' : String(v); MARKUP = el._html },
  })
  el.classList = {
    add(...cs) { cs.forEach((c) => { if (!el._cls.split(' ').includes(c)) el._cls = (el._cls + ' ' + c).trim() }) },
    remove(...cs) { cs.forEach((c) => { el._cls = el._cls.split(' ').filter((x) => x && x !== c).join(' ') }) },
    toggle(c, on) {
      const has = el._cls.split(' ').includes(c)
      const want = on === undefined ? !has : !!on
      if (want && !has) el.classList.add(c)
      if (!want && has) el.classList.remove(c)
    },
    contains(c) { return el._cls.split(' ').includes(c) },
  }
  return el
}

let MARKUP = ''
/* 固定节点表：同一个选择器永远返回**同一个**节点，断言才看得见 splash.js 的操作 */
const FIXED = {}
function lookup(sel) {
  if (!sel) return null
  const key = String(sel)
  if (FIXED[key]) return FIXED[key]
  const m = /\.([A-Za-z0-9_-]+)/.exec(key)
  return m && MARKUP.includes(m[1]) ? makeEl('div') : null
}

/* ── 跑一次 splash.js ──────────────────────────────────────────────────────
   opts.storageSeen = true 表示"这台机器已经弹过首次事件窗口"
   opts.config    = 注入 window.__DSH_STARTUP__ 的配置
   返回：windowStub 上的 API、立绘节点上挂了几张图、事件层是否出现过 */
function run(opts) {
  MARKUP = ''
  const o = opts || {}
  const stored = {}
  if (o.storageSeen) stored['dsh-startup-screen:event-seen'] = '1'

  const root = makeEl('div')
  root._cls = 'dsu-root dsu-boot'
  const mascot = makeEl('div')
  const images = []
  /* querySelector 必须返回**同一个**节点，否则断言看到的是另一个对象 */
  const bySelector = { '.dsu-mascot': mascot }
  FIXED['.dsu-mascot'] = mascot

  const documentStub = {
    readyState: 'complete',
    head: makeEl('head'),
    body: makeEl('body'),
    documentElement: makeEl('html'),
    getElementById: (id) => (id === 'dsh-startup-root' ? root : null),
    createElement: (t) => {
      const el = makeEl(t)
      if (t === 'img') images.push(el)
      return el
    },    createElementNS: (_ns, t) => makeEl(t),
    querySelector: (sel) => (bySelector[String(sel)] || null),
    addEventListener() {},
    removeEventListener() {},
    querySelectorAll() { return [] },
  }

  const timers = []
  const windowStub = {
    __DSH_STARTUP__: Object.assign({
      enabled: true, mode: 'always', theme: 'light', speed: 1,
      /* 与 Host DEFAULTS 一致：1.3.1 时代 requireInteraction 出厂为 true */
      requireInteraction: true,
      identity: 'JOYCE MOORE', identityId: '0087', accessLevel: '3',
      voice: true, voiceLang: 'en', voiceName: '',
      sound: true, soundVolume: 0.5,
    }, o.config || {}),
    AudioContext: function () {
      return {
        state: 'running', currentTime: 0, sampleRate: 48000, destination: {},
        resume() {},
        createOscillator() { return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} } },
        createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } },
        createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) } },
        createBufferSource() { return { buffer: null, connect() {}, start() {} } },
        createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} } },
      }
    },
    location: { host: '127.0.0.1:3080', href: 'http://127.0.0.1:3080/' },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    sessionStorage: { getItem: () => null, setItem() {} },
    localStorage: {
      getItem: (k) => (k in stored ? stored[k] : null),
      setItem: (k, v) => { stored[k] = String(v) },
    },
    fetch: () => Promise.reject(new Error('no network in test')),
    requestAnimationFrame: (fn) => { fn(); return 1 },
    cancelAnimationFrame() {},
    /* 小延时同步跑（语音留白），时间线入队不自动跑：测试只关心配置与渲染 */
    setTimeout: (fn, ms) => {
      if ((ms || 0) <= 400) { fn(); return -1 }
      timers.push(fn)
      return timers.length
    },
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    CustomEvent: function (t) { this.type = t },
  }
  windowStub.window = windowStub

  const sandbox = {
    window: windowStub,
    document: documentStub,
    console: { log() {}, warn() {}, error() {} },
    Promise, Object, Array, JSON, String, Number, Math, Date, Error, RegExp, isFinite, parseInt,
    setTimeout: windowStub.setTimeout,
    clearTimeout: windowStub.clearTimeout,
    setInterval: windowStub.setInterval,
    clearInterval: windowStub.clearInterval,
    requestAnimationFrame: windowStub.requestAnimationFrame,
  }
  sandbox.globalThis = sandbox
  sandbox.self = sandbox

  vm.createContext(sandbox)
  let thrown = null
  try {
    vm.runInContext(fs.readFileSync(BUNDLE, 'utf8'), sandbox, { filename: 'splash.js' })
  } catch (e) { thrown = e }

  return {
    thrown,
    api: windowStub.__DSH_STARTUP_API__,
    stored,
    timers,
    mascot,
    mascotImages: images.filter((img) => img._cls === 'dsu-mascot-img'),
    root,
  }
}

/* ═══ 1. 自动播放三档 ════════════════════════════════════════════════════ */
console.log('\n[1] 自动播放三档')
{
  const full = run({ config: { autoPlay: 'full' } })
  check('full：初始化不抛异常', full.thrown === null, full.thrown && full.thrown.message)
  check('full：C.autoPlay = full', full.api && full.api.config.autoPlay === 'full', full.api && full.api.config.autoPlay)
  check('full：不再要求逐步确认（requireInteraction=false）', full.api && full.api.config.requireInteraction === false)

  const once = run({ config: { autoPlay: 'once' } })
  check('once：C.autoPlay = once', once.api && once.api.config.autoPlay === 'once', once.api && once.api.config.autoPlay)
  check('once：不进入逐步确认档', once.api && once.api.config.requireInteraction === false)

  const off = run({ config: { autoPlay: 'off' } })
  check('off：C.autoPlay = off', off.api && off.api.config.autoPlay === 'off')
  check('off：进入逐步确认档（第 1、2 步都停）', off.api && off.api.config.requireInteraction === true)

  const bad = run({ config: { autoPlay: 'whatever' } })
  check('非法值回落到 off（保守，不擅自全自动）', bad.api && bad.api.config.autoPlay === 'off', bad.api && bad.api.config.autoPlay)

  const init = run({})
  check('不给 autoPlay 时按旧 requireInteraction 默认值 → off', init.api && init.api.config.autoPlay === 'off', init.api && init.api.config.autoPlay)
}

console.log('\n[2] 老配置迁移（真实 1.3.1 用户升级不会被打乱）')
{
  const oldOn = run({ config: { requireInteraction: true } })
  check('旧 requireInteraction=true → off（保持原样等确认）', oldOn.api && oldOn.api.config.autoPlay === 'off', oldOn.api && oldOn.api.config.autoPlay)
  const oldOff = run({ config: { requireInteraction: false } })
  check('旧 requireInteraction=false → full（原来就是全自动）', oldOff.api && oldOff.api.config.autoPlay === 'full', oldOff.api && oldOff.api.config.autoPlay)
  const both = run({ config: { autoPlay: 'once', requireInteraction: true } })
  check('新字段优先于旧字段', both.api && both.api.config.autoPlay === 'once', both.api && both.api.config.autoPlay)
}

console.log('\n[3] 仅需点击一次 + 密码的约定（该档要求空密码）')
{
  const src = fs.readFileSync(BUNDLE, 'utf8')
  check('once 档跳过第二步密码闸（否则「点一次」变成「必输密码」）',
    /if \(C\.autoPlay === 'once'\) needPwd = false/.test(src))
  check('once 档只在第一步（grant）等一次',
    /C\.autoPlay === 'once' && !\(step && step\.action === 'grant'\)/.test(src))
  check('off 档第 1、2 步都等',
    /C\.autoPlay === 'off' && !isWaitStep/.test(src))
}

/* ═══ 4. 降世事件窗口 ════════════════════════════════════════════════════ */
console.log('\n[4] 降世事件窗口：默认关闭 + 首次启动弹一次')
{
  const fresh = run({})
  check('没勾选时 eventWindow = false（默认关闭）', fresh.api && fresh.api.config.eventWindow === false, fresh.api && fresh.api.config.eventWindow)
  check('全新安装首次启动：eventOnce = true（这一次会弹）', fresh.api && fresh.api.config.eventOnce === true, fresh.api && fresh.api.config.eventOnce)
  check('首次启动时写下了一次性标记', fresh.stored['dsh-startup-screen:event-seen'] === '1', JSON.stringify(fresh.stored))

  const second = run({ storageSeen: true })
  check('之后启动：不再弹（eventOnce = false）', second.api && second.api.config.eventOnce === false, second.api && second.api.config.eventOnce)
  check('之后启动：eventWindow 仍是 false', second.api && second.api.config.eventWindow === false)

  const always = run({ storageSeen: true, config: { eventWindow: true } })
  check('勾选后每次都弹（eventWindow = true）', always.api && always.api.config.eventWindow === true)
  check('勾选时不会误标"首次已弹"', always.api && always.api.config.eventOnce === false)
  check('勾选时不动一次性标记', always.stored['dsh-startup-screen:event-seen'] === '1')

  const gateSrc = fs.readFileSync(BUNDLE, 'utf8')
  check('事件闸门同时认 eventWindow 与 eventOnce', /if \(!C\.eventWindow && !C\.eventOnce\) return Promise\.resolve\(\)/.test(gateSrc))
}

/* ═══ 5. 人物立绘「空」 ══════════════════════════════════════════════════ */
console.log('\n[5] 人物立绘 = 空（不显示立绘）')
{
  const empty = run({ config: { mascot: -1 } })
  check('mascot = -1 被接受', empty.api && empty.api.config.mascot === -1, empty.api && empty.api.config.mascot)
  check('showMascot = false', empty.api && empty.api.config.showMascot === false)
  check('不往立绘容器里塞任何图片', empty.mascot.children.length === 0, '子节点 ' + empty.mascot.children.length)
  check('立绘容器保持隐藏', empty.mascot.hidden === true)

  const first = run({ config: { mascot: 0 } })
  check('默认（0）仍然渲染立绘', first.mascotImages.length === 1 && first.mascot.children.length === 1)
  check('默认时 showMascot = true', first.api && first.api.config.showMascot === true)

  const other = run({ config: { mascot: 2 } })
  check('其它编号照常渲染', other.mascotImages.length === 1)

  const overflow = run({ config: { mascot: 99 } })
  check('越界编号回落到 0', overflow.api && overflow.api.config.mascot === 0, overflow.api && overflow.api.config.mascot)

  const showSrc = fs.readFileSync(BUNDLE, 'utf8')
  check('showAction 里也守了立绘开关（空时不亮出容器）',
    /C\.showMascot !== false && C\.mascot >= 0 && \(step\.action === 'grant' \|\| step\.action === 'confirm'\)/.test(showSrc))
}

/* ═══ 6. 「立即预览」拿到最新配置 ════════════════════════════════════════ */
console.log('\n[6] 立即预览：重播前先拉最新配置')
{
  const src = fs.readFileSync(BUNDLE, 'utf8')
  check('暴露了 __DSH_STARTUP_CONFIG_URL__ 的读取', /window\.__DSH_STARTUP_CONFIG_URL__/.test(src))
  check('replay 走 replayLatest（先 refresh 再 injectSelf）', /replay: replayLatest,\n/.test(src) && /return refresh\(\)\.then\(injectSelf, injectSelf\)/.test(src))
  check('refresh 失败也不阻塞重播', /\.catch\(function \(\) \{ resolve\(false\) \}\)/.test(src))
  check('重播前先解开滚动锁（避免移除 root 后页面锁死）', /document\.documentElement\.classList\.remove\('dsu-lock'\)\s*\n\s*document\.documentElement\.style\.overflow = ''/.test(src))

  const host = fs.readFileSync(HOST, 'utf8')
  check('Host 注入配置接口地址', /__DSH_STARTUP_CONFIG_URL__/.test(host))
  check('Host ENUMS 认 autoPlay 三档', /autoPlay: \['full', 'once', 'off'\]/.test(host))
  check('Host 迁移旧 requireInteraction（没带 autoPlay 时按它推）', /out\.autoPlay = isFalseish\(src\.requireInteraction\) \? 'full' : 'off'/.test(host))
  check('Host 对非法 autoPlay 落到 off', /else \{\s*\n\s*out\.autoPlay = 'off'/.test(host))
  check('Host 承认字符串形式的 requireInteraction', /function isFalseish/.test(host))
  check('Host mascot 允许 -1', /Math\.max\(-1, mi\)/.test(host))
  check('Host eventWindow 默认关闭', /eventWindow: false,/.test(host))
}

console.log('\n============================')
console.log(`  通过 ${pass} / 失败 ${fail}`)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
