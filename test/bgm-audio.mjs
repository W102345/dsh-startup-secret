/* ============================================================================
 * 1.5.0 背景音乐的冒烟测试
 *
 *   1) 配置：默认开、音量夹取、曲风只认两个内置值
 *   2) 生命周期：进页面就试着起 → 手势后补起 → 跳过 / 结束必须停
 *   3) 降级：没有 WebAudio（隐私模式 / 老环境）不许抛异常，也不许锁住动画
 *   4) 接线：台词期间压混、揭幕上扬、Host 与设置页都有这几项
 *
 * 做法与 new-options.mjs 一致：最小 DOM 桩 + vm 里跑真实的 splash.js。
 *
 * 用法：node test/bgm-audio.mjs
 * ========================================================================== */
import fs from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const BUNDLE = fileURLToPath(new URL('../lib/splash.js', import.meta.url))
const HOST = fileURLToPath(new URL('../lib/index.js', import.meta.url))
const CLIENT = fileURLToPath(new URL('../lib/client.js', import.meta.url))
const PKG = fileURLToPath(new URL('../package.json', import.meta.url))

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra !== undefined ? '  → ' + extra : '')) }
}

/* ── 最小 DOM 桩 ─────────────────────────────────────────────────────────── */
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
    querySelector() { return null },
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
    set(v) { el._html = v == null ? '' : String(v) },
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

/* 可计数的 WebAudio 桩：每次建振荡器 / 增益都记一笔，用来看"音乐到底有没有真在排期" */
function makeAudioStub(state) {
  const ctx = {
    state: state || 'running',
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    stats: { oscillators: 0, gains: 0, noise: 0, resumed: 0, compressors: 0 },
    /* 模拟浏览器策略：没有用户手势时 resume() 不会真的把上下文放行 */
    allowResume: state === 'running',
    resume() { ctx.stats.resumed++; if (ctx.allowResume) ctx.state = 'running' },
    createOscillator() {
      ctx.stats.oscillators++
      return {
        type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        detune: { setValueAtTime() {} },
        connect() {}, start() {}, stop() {},
      }
    },
    createGain() {
      ctx.stats.gains++
      return {
        gain: {
          value: 1,
          setValueAtTime() {}, exponentialRampToValueAtTime() {},
          cancelScheduledValues() {}, linearRampToValueAtTime() {},
        },
        connect() {}, disconnect() {},
      }
    },
    createBuffer(ch, len) {
      ctx.stats.noise++
      return { getChannelData: () => new Float32Array(len) }
    },
    createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} } },
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} } },
  }
  return ctx
}

/* ── 跑一次 splash.js ────────────────────────────────────────────────────── */
function run(opts) {
  const o = opts || {}
  const listeners = {}
  const root = makeEl('div')
  root._cls = 'dsu-root dsu-boot'
  /* 同一个选择器永远返回同一个节点：splash.js 要往里 appendChild */
  const fixed = {}
  const lookup = (sel) => {
    const key = String(sel)
    if (!fixed[key]) fixed[key] = makeEl('div')
    return fixed[key]
  }
  root.querySelector = lookup

  const documentStub = {
    readyState: 'complete',
    head: makeEl('head'),
    body: makeEl('body'),
    documentElement: makeEl('html'),
    getElementById: (id) => (id === 'dsh-startup-root' ? root : null),
    createElement: (t) => makeEl(t),
    createElementNS: (_ns, t) => makeEl(t),
    querySelector: lookup,
    querySelectorAll: () => [],
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn) },
    removeEventListener(type, fn) {
      const list = listeners[type] || []
      const i = list.indexOf(fn)
      if (i >= 0) list.splice(i, 1)
    },
  }

  const timers = []
  const audioCtx = o.audio === 'none' ? null : makeAudioStub(o.audio === 'suspended' ? 'suspended' : 'running')
  /* 自定义音源用的 <audio> 桩：只关心 src / loop / play 有没有被调用 */
  const audioEls = []

  const windowStub = {
    __DSH_STARTUP__: Object.assign({
      enabled: true, mode: 'always', theme: 'dark', speed: 1,
      requireInteraction: true, autoPlay: 'full',
      identity: 'JOYCE MOORE', identityId: '0087', accessLevel: '3',
      voice: false, sound: true, soundVolume: 0.5,
    }, o.config || {}),
    location: { host: '127.0.0.1:3080', href: 'http://127.0.0.1:3080/' },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    sessionStorage: { getItem: () => null, setItem() {} },
    localStorage: { getItem: () => '1', setItem() {} },
    fetch: () => Promise.reject(new Error('no network in test')),
    requestAnimationFrame: (fn) => { fn(); return 1 },
    cancelAnimationFrame() {},
    /* 小延时同步跑；时间线入队不自动跑：这里只关心"音乐起没起" */
    setTimeout: (fn, ms) => {
      if ((ms || 0) <= 400) { fn(); return -1 }
      timers.push(fn)
      return timers.length
    },
    clearTimeout() {},
    setInterval: (fn) => { timers.push(fn); return timers.length },
    clearInterval() {},
    CustomEvent: function (t) { this.type = t },
    Audio: function () {
      const el = {
        src: '', volume: 0, loop: false, preload: '', currentTime: 0,
        played: 0, paused: 0, handlers: {},
        addEventListener(t, fn) { (el.handlers[t] = el.handlers[t] || []).push(fn) },
        play() { el.played++; return Promise.resolve() },
        pause() { el.paused++ },
      }
      audioEls.push(el)
      return el
    },
  }
  if (audioCtx) windowStub.AudioContext = function () { return audioCtx }
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
    audioCtx,
    audioEls,
    body: documentStub.body,
    listeners,
    fire(type) {
      /* 真实浏览器里手势是解锁的钥匙：先放行上下文再派发事件 */
      if (audioCtx) audioCtx.allowResume = true
      const list = (listeners[type] || []).slice()
      list.forEach((fn) => fn({ type, preventDefault() {}, stopPropagation() {} }))
      return list.length
    },
  }
}

/* ═══ 1. 配置：默认值 / 夹取 / 枚举 ══════════════════════════════════════ */
console.log('\n[1] 配置')
{
  const d = run({})
  check('初始化不抛异常', d.thrown === null, d.thrown && d.thrown.message)
  check('默认开启背景音乐（C.bgm = true）', d.api && d.api.config.bgm === true, d.api && d.api.config.bgm)
  check('默认音量 0.55（1.5.0 的 0.4 听不出来）', d.api && d.api.config.bgmVolume === 0.55, d.api && d.api.config.bgmVolume)
  check('默认曲风 cinematic', d.api && d.api.config.bgmStyle === 'cinematic', d.api && d.api.config.bgmStyle)
  check('默认音源 builtin', d.api && d.api.config.bgmSource === 'builtin', d.api && d.api.config.bgmSource)
  check('默认没有自定义链接', d.api && d.api.config.bgmUrl === '', JSON.stringify(d.api && d.api.config.bgmUrl))

  const off = run({ config: { bgm: false } })
  check('关掉时 C.bgm = false', off.api && off.api.config.bgm === false)
  const offStr = run({ config: { bgm: 'false' } })
  check('字符串 "false" 也认作关', offStr.api && offStr.api.config.bgm === false)

  const hi = run({ config: { bgmVolume: 5 } })
  check('音量上越界夹到 1', hi.api && hi.api.config.bgmVolume === 1, hi.api && hi.api.config.bgmVolume)
  const lo = run({ config: { bgmVolume: -3 } })
  check('音量下越界夹到 0', lo.api && lo.api.config.bgmVolume === 0, lo.api && lo.api.config.bgmVolume)
  const nan = run({ config: { bgmVolume: 'abc' } })
  check('非数字回落到默认 0.55', nan.api && nan.api.config.bgmVolume === 0.55, nan.api && nan.api.config.bgmVolume)

  const pulse = run({ config: { bgmStyle: 'pulse' } })
  check('曲风 pulse 被接受', pulse.api && pulse.api.config.bgmStyle === 'pulse')
  const bad = run({ config: { bgmStyle: 'noise' } })
  check('非法曲风回落到 cinematic', bad.api && bad.api.config.bgmStyle === 'cinematic', bad.api && bad.api.config.bgmStyle)

  const custom = run({ config: { bgmSource: 'custom', bgmUrl: 'https://cdn.example.com/a.mp3' } })
  check('选了自定义且填了链接 → bgmSource = custom', custom.api && custom.api.config.bgmSource === 'custom', custom.api && custom.api.config.bgmSource)
  const emptyCustom = run({ config: { bgmSource: 'custom', bgmUrl: '   ' } })
  check('选了自定义但没填链接 → 退回 builtin（不会静音）', emptyCustom.api && emptyCustom.api.config.bgmSource === 'builtin', emptyCustom.api && emptyCustom.api.config.bgmSource)
  const longUrl = run({ config: { bgmSource: 'custom', bgmUrl: 'https://x/' + 'a'.repeat(900) + '.mp3' } })
  check('超长链接被截到 512 字符', longUrl.api && longUrl.api.config.bgmUrl.length === 512, longUrl.api && longUrl.api.config.bgmUrl.length)
}

/* ═══ 1b. 自定义音源：链接 / 本机路径 ═══════════════════════════════════ */
console.log('\n[1b] 自定义音源')
{
  const remote = run({ config: { bgmSource: 'custom', bgmUrl: 'https://cdn.example.com/a.mp3' } })
  check('初始化不抛异常', remote.thrown === null, remote.thrown && remote.thrown.message)
  check('起了自定义音源（api.bgm() = true）', remote.api && remote.api.bgm() === true)
  check('建了一个 <audio> 并播了', remote.audioEls.length === 1 && remote.audioEls[0].played > 0, remote.audioEls.length)
  check('直链原样作为 src', remote.audioEls[0].src === 'https://cdn.example.com/a.mp3', remote.audioEls[0].src)
  check('设了循环播放', remote.audioEls[0].loop === true)
  check('自定义音源时不再排内置曲', remote.audioCtx.stats.oscillators === 0, remote.audioCtx.stats.oscillators)

  const local = run({ config: { bgmSource: 'custom', bgmUrl: 'D:\\music\\军歌 mix.mp3' } })
  const src = local.audioEls.length ? local.audioEls[0].src : ''
  check('本机路径走 Host 的 /dsh-startup/bgm 路由', src.indexOf('/dsh-startup/bgm?path=') === 0, src)
  check('路径做了 URL 编码（空格 / 反斜杠 / 中文）', src === '/dsh-startup/bgm?path=' + encodeURIComponent('D:\\music\\军歌 mix.mp3'), src)

  const fileUrl = run({ config: { bgmSource: 'custom', bgmUrl: 'file:///D:/music/a.mp3' } })
  const fsrc = fileUrl.audioEls.length ? fileUrl.audioEls[0].src : ''
  check('file:// 前缀被剥掉再转路由', fsrc.indexOf('/dsh-startup/bgm?path=') === 0 && fsrc.indexOf('file:') < 0, fsrc)

  const stopped = run({ config: { bgmSource: 'custom', bgmUrl: 'https://cdn.example.com/a.mp3' } })
  stopped.api.finish()
  check('结束后自定义音源被暂停', stopped.audioEls[0].paused > 0 || stopped.api.bgm() === false)
}

/* ═══ 2. 生命周期：起 / 手势补起 / 停 ════════════════════════════════════ */
console.log('\n[2] 生命周期')
{
  const live = run({})
  check('AudioContext 已 running 时进页面就起播', live.api && live.api.bgm() === true)
  check('真的排了音（建过振荡器）', live.audioCtx.stats.oscillators > 0, live.audioCtx.stats.oscillators)

  const suspended = run({ audio: 'suspended' })
  check('被浏览器挂起时先不起', suspended.api && suspended.api.bgm() === false)
  check('挂了一次性手势监听（pointerdown）', (suspended.listeners.pointerdown || []).length > 0)
  const hintOf = (r) => r.body.children.filter((c) => String(c.className).indexOf('dsu-audiohint') >= 0)[0]
  check('同时给出「点击任意位置开启声音」提示', !!hintOf(suspended), hintOf(suspended) && hintOf(suspended).className)
  suspended.fire('pointerdown')
  check('用户第一次点击后补起播', suspended.api && suspended.api.bgm() === true)
  check('补起播时调了 resume', suspended.audioCtx.stats.resumed > 0)
  check('起播后提示开始淡出（摘掉 dsu-in）', hintOf(suspended) && !hintOf(suspended).classList.contains('dsu-in'))

  const stopped = run({})
  stopped.api.finish()
  check('结束后音乐停（api.bgm() = false）', stopped.api.bgm() === false)

  const off = run({ config: { bgm: false } })
  check('开关关闭时完全不启动', off.api && off.api.bgm() === false && off.audioCtx.stats.oscillators === 0, off.audioCtx.stats.oscillators)
}

/* ═══ 3. 没有 WebAudio 的环境 ════════════════════════════════════════════ */
console.log('\n[3] 降级：没有 WebAudio')
{
  const none = run({ audio: 'none' })
  check('不抛异常', none.thrown === null, none.thrown && none.thrown.message)
  check('api.bgm() 安全返回 false', none.api && none.api.bgm() === false)
  check('动画 API 照常暴露', none.api && typeof none.api.replay === 'function' && typeof none.api.finish === 'function')
}

/* ═══ 4. 接线：压混 / 上扬 / 退场 与 Host、设置页 ═══════════════════════ */
console.log('\n[4] 接线与配置面板')
{
  const src = fs.readFileSync(BUNDLE, 'utf8')
  check('run() 第一件事就是 bgm.start()', /function run\(\) \{\s*\n[\s\S]{0,220}?bgm\.start\(\)/.test(src))
  check('底板出来后抬到第二档', /bgm\.setTier\(2, 2\.2\)/.test(src))
  check('每句台词都压混', /bgm\.duckUntil\(spoke\)/.test(src))
  check('终幕欢迎语也压混', /bgm\.duckUntil\(welcome\)/.test(src))
  check('揭幕前上扬', /bgm\.swell\(\)/.test(src))
  check('暂停 / 跳过时收掉音乐', /bgm\.stop\(0\.7\)/.test(src))
  check('镜头后撤时淡出', /bgm\.stop\(1\.6\)/.test(src))
  check('重播前先停旧实例（不叠两层）', /if \(bgm && bgm\.stop\) bgm\.stop\(0\)/.test(src))
  check('压混用计数，重叠台词不会互相提前抬起', /duckDepth\+\+/.test(src) && /if \(duckDepth > 0/.test(src))
  check('调度器用 40ms 前瞻', /setInterval\(tick, 40\)/.test(src))
  check('共用音频模块的上下文（不另开一个）', /context: function \(force\) \{ return ac\(force\) \}/.test(src))
  check('两套曲风都写进了谱面', /cinematic: \{/.test(src) && /pulse: \{/.test(src))
  check('注释说明了不含任何音乐文件', /不打包任何音乐文件/.test(src))

  const host = fs.readFileSync(HOST, 'utf8')
  check('Host DEFAULTS 有 bgm', /bgm: true,/.test(host))
  check('Host DEFAULTS 音量是 0.55', /bgmVolume: 0\.55,/.test(host))
  check('Host ENUMS 认两种曲风', /bgmStyle: \['cinematic', 'pulse'\]/.test(host))
  check('Host ENUMS 认两种音源', /bgmSource: \['builtin', 'custom'\]/.test(host))
  check('Host 把 bgm 当布尔字段', /BOOL_KEYS = \[[^\]]*'bgm'\]/.test(host))
  check('Host 夹取 bgmVolume', /bgmVolume: \[0, 1\]/.test(host))
  check('Host 把 bgmUrl 放到 512 字符', /slice\(0, 512\)/.test(host))
  check('Host 注册了本地音频路由 /dsh-startup/bgm', /ROUTE_BASE \+ '\/bgm'/.test(host))
  check('本地音频只放行音频/视频扩展名', /BGM_TYPES/.test(host) && /'\.mp3': 'audio\/mpeg'/.test(host))
  check('本地音频只认绝对路径', /path\.isAbsolute\(file\)/.test(host))
  check('本地音频支持 Range（<audio> 能循环 / 拖动）', /'Accept-Ranges': 'bytes'/.test(host) && /Content-Range/.test(host))
  check('本地音频有体积上限', /BGM_MAX_BYTES/.test(host) && /80 \* 1024 \* 1024/.test(host))

  const client = fs.readFileSync(CLIENT, 'utf8')
  check('设置页有「背景音乐」分组', /'背景音乐'/.test(client))
  check('设置页有曲风下拉', /'电影感氛围（默认）'/.test(client) && /'工业脉冲'/.test(client))
  check('设置页有「音乐来源」下拉', /'音乐来源'/.test(client) && /'自定义 · 链接或本机文件'/.test(client))
  check('设置页有链接 / 本机路径输入框与试听按钮', /'音频链接 \/ 本机路径'/.test(client) && /试听 12 秒/.test(client))
  check('设置页提示抖音分享链接放不出来', /抖音 \/ B 站 \/ 网易云的分享链接是网页不是音频文件/.test(client))
  check('设置页兜底值含 bgmVolume 0.55', /bgmVolume: 0\.55/.test(client))
  /* v1.5.2：试听失败必须说出原因，而不是静默 */
  check('试听有「正在读取本机文件」状态', /正在读取本机文件/.test(client))
  check('试听会提示「Host 文件路由没起来，请完全退出重开」', /Host 侧的文件路由没起来/.test(client))
  check('试听会提示解码失败（换成 mp3/m4a）', /浏览器解不开这个文件/.test(client))
  check('设置页检测 Host 半侧是否还是旧版', /hostStale/.test(client) && /j\.defaults\.bgmSource === undefined/.test(client))
  check('旧版 Host 时给出醒目提示（含托盘退出）', /Host 半侧仍是旧版/.test(client) && /含托盘图标/.test(client))

  const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'))
  check('版本号是 1.5.2', pkg.version === '1.5.2', pkg.version)
  check('测试脚本纳入 bgm-audio', /test\/bgm-audio\.mjs/.test(pkg.scripts.test))
}

console.log('\n============================')
console.log(`  通过 ${pass} / 失败 ${fail}`)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
