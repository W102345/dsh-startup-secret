/* ============================================================================
 * 第二步「身份资料确认」访问密码校验 —— 交互逻辑验证
 *
 * 用可派发事件的 DOM 桩把 splash.js 跑起来，手动推进到第二步，
 * 验证：设置了 identityPassword 时，输错密码会停留在本步并提示
 *       「密码错误，无法进入」，输对才推进。
 *
 * 用法：node test/verify-password.mjs
 * ========================================================================== */
import fs from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const BUNDLE = fileURLToPath(new URL('../lib/splash.js', import.meta.url))
const code = fs.readFileSync(BUNDLE, 'utf8')

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra !== undefined ? '  → ' + extra : '')) }
}

let MARKUP = ''
const ALL_CREATED = []
const lookupCache = new Map()

function makeEl(tag) {
  const el = {
    tagName: tag,
    _cls: '',
    _text: '',
    _html: '',
    _value: '',
    style: { setProperty() {}, removeProperty() {}, width: '' },
    dataset: {},
    children: [],
    hidden: false,
    offsetWidth: 1,
    parentNode: null,
    _listeners: {},
    appendChild(c) { if (c) { this.children.push(c); c.parentNode = this } return c },
    insertBefore(c) { if (c) { this.children.unshift(c); c.parentNode = this } return c },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c },
    setAttribute() {},
    getAttribute() { return null },
    addEventListener(type, cb) { (this._listeners[type] = this._listeners[type] || []).push(cb) },
    removeEventListener(type, cb) {
      if (this._listeners[type]) this._listeners[type] = this._listeners[type].filter((x) => x !== cb)
    },
    dispatchEvent(ev) { (this._listeners[ev.type] || []).forEach((cb) => cb(ev)) },
    animate() { return { cancel() {}, finish() {} } },
    getTotalLength() { return 120 },
    querySelector(sel) { return lookup(sel) },
    querySelectorAll() { return [] },
    focus() {},
    contains() { return false },
  }
  if (tag === 'input') {
    Object.defineProperty(el, 'value', {
      get() { return el._value },
      set(v) { el._value = v == null ? '' : String(v) },
      configurable: true,
    })
  }
  Object.defineProperty(el, 'className', {
    get() { return el._cls },
    set(v) { el._cls = v == null ? '' : String(v) },
    configurable: true,
  })
  Object.defineProperty(el, 'textContent', {
    get() { return el._text },
    set(v) { el._text = v == null ? '' : String(v) },
    configurable: true,
  })
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html },
    set(v) { el._html = v == null ? '' : String(v); MARKUP = el._html },
    configurable: true,
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
  ALL_CREATED.push(el)
  return el
}

function lookup(sel) {
  if (!sel) return null
  const key = String(sel)
  if (lookupCache.has(key)) return lookupCache.get(key)
  const m = /\.([A-Za-z0-9_-]+)/.exec(key)
  const cls = m ? m[1] : null
  const found = cls !== null && MARKUP.includes(cls)
  const node = found ? makeEl('div') : null
  lookupCache.set(key, node)
  return node
}

function fireClick(el, target) {
  el.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {}, target: target || el })
}

async function drain() {
  for (let i = 0; i < 30; i++) await Promise.resolve()
}

async function waitFor(fn, tries) {
  for (let i = 0; i < (tries || 60); i++) {
    if (fn()) return true
    await Promise.resolve()
  }
  return false
}

async function main() {
  MARKUP = ''
  ALL_CREATED.length = 0
  lookupCache.clear()

  const root = makeEl('div')
  root._cls = 'dsu-root dsu-boot'
  const head = makeEl('head')
  const body = makeEl('body')
  const htmlEl = makeEl('html')

  const documentStub = {
    readyState: 'complete',
    head,
    body,
    documentElement: htmlEl,
    getElementById: (id) => (id === 'dsh-startup-root' ? root : null),
    createElement: (t) => makeEl(t),
    createElementNS: (_ns, t) => makeEl(t),
    createDocumentFragment: () => makeEl('fragment'),
    createTextNode: (t) => { const n = makeEl('#text'); n._text = String(t); return n },
    querySelector: () => null,
    _listeners: {},
    addEventListener(type, cb) { (this._listeners[type] = this._listeners[type] || []).push(cb) },
    removeEventListener() {},
    dispatchEvent(ev) { (this._listeners[ev.type] || []).forEach((cb) => cb(ev)) },
  }

  const windowStub = {
    __DSH_STARTUP__: {
      enabled: true, mode: 'always', theme: 'light', speed: 1,
      requireInteraction: true, allowSkip: true,
      identity: 'JOYCE MOORE', identityId: '0087', accessLevel: '3',
      identityPassword: 'secret-123',
      voice: false, voiceLang: 'en', voiceName: '',
      sound: true, soundVolume: 0.5, voiceSource: 'tts',
    },
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
    speechSynthesis: { getVoices: () => [], speak() {}, cancel() {}, resume() {}, pause() {}, addEventListener() {}, removeEventListener() {} },
    SpeechSynthesisUtterance: function (t) { this.text = t },
    location: { host: '127.0.0.1:3080', href: 'http://127.0.0.1:3080/' },
    _listeners: {},
    addEventListener(type, cb) { (this._listeners[type] = this._listeners[type] || []).push(cb) },
    removeEventListener() {},
    dispatchEvent(ev) { (this._listeners[ev.type] || []).forEach((cb) => cb(ev)) },
    sessionStorage: { getItem: () => null, setItem() {} },
    localStorage: { getItem: () => null, setItem() {} },
    requestAnimationFrame: (fn) => { fn(); return 1 },
    cancelAnimationFrame() {},
    setTimeout: (fn) => { try { fn() } catch (e) {} return -1 },
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    CustomEvent: function (t) { this.type = t },
  }
  windowStub.window = windowStub
  windowStub.self = windowStub
  windowStub.globalThis = windowStub
  windowStub.document = documentStub
  windowStub.console = {
    log() {},
    warn() { console.error('SPLASH WARN:', ...arguments) },
    error() { console.error('SPLASH ERR:', ...arguments) },
  }

  const ctx = vm.createContext(windowStub)
  vm.runInContext(code, ctx)

  await drain()

  const btn = lookup('.dsu-btn')
  check('splash 启动后按钮节点就绪', !!btn)

  /* 推进第一步「需要访问许可」(grant) → 进入第二步「身份资料确认」(confirm) */
  fireClick(btn, btn)
  const reachedStep2 = await waitFor(() => ALL_CREATED.some((e) => e._cls.includes('dsu-pwd-input')))
  check('第二步出现访问密码输入框', reachedStep2)

  const pwdInput = ALL_CREATED.find((e) => e._cls.includes('dsu-pwd-input'))
  const pwdErr = ALL_CREATED.find((e) => e._cls.includes('dsu-pwd-error'))
  const hint = lookup('.dsu-hint')
  check('第二步出现错误提示节点', !!pwdErr)
  check('hint 文案提示需要输入密码', !!hint && /密码/.test(hint._html))

  /* 场景一：输错密码 —— 应停留在本步并提示「密码错误，无法进入」 */
  pwdInput._value = 'wrong-password'
  fireClick(btn, btn)
  await drain()
  check('错误密码：显示「密码错误，无法进入」', !!pwdErr && pwdErr._text.includes('密码错误，无法进入'))
  check('错误密码：未推进（按钮仍 dsu-pulse）', btn && btn.classList.contains('dsu-pulse'))

  /* 场景二：输对密码 —— 应推进到下一步 */
  pwdInput._value = 'secret-123'
  fireClick(btn, btn)
  const advanced = await waitFor(() => !btn.classList.contains('dsu-pulse'), 40)
  check('正确密码：推进到下一步（按钮移除 dsu-pulse）', advanced)

  console.log('')
  console.log('============================')
  console.log('  通过 ' + pass + ' / 失败 ' + fail)
  console.log('============================')
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('运行异常：', e); process.exit(2) })
