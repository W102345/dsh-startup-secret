/**
 * dsh-startup-secret — 浏览器半侧（设置页「启动动画」）
 * ----------------------------------------------------------------------------
 * 以 dsh.client bundle 格式加载（手写 ModuleLoader bundle，无需构建）：
 * 在 DSH 设置里注册一个 `settings.section`，用来改启动动画的身份名称、
 * 权限等级、配色、速度、交互开关等等。
 *
 * 数据不走 settings 命名空间，而是走 Host 半侧自带的 HTTP API
 * （GET/POST /dsh-startup/config）——与 dsh-meme 同款做法，少受
 * dsh-settings 版本变更影响。注册 id 必须等于 loader entry 名
 * （dsh-startup-secret），否则 ModuleLoader 会报
 * "loaded without registering dsh-startup-secret"。
 */
window.__ModuleLoader__.load({
  id: 'dsh-startup-secret',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var h = react.createElement

    var API = '/dsh-startup/config'

    /* ── CSS ─────────────────────────────────────────────────────────────── */
    var CSS = [
      '.__ss_root{max-width:620px;display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.__ss_version{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_group{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:11px}',
      '.__ss_groupTitle{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_field{display:flex;flex-direction:column;gap:5px}',
      '.__ss_label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.__ss_hint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.__ss_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font-size:13px;box-sizing:border-box;width:100%;outline:none}',
      '.__ss_input:focus{border-color:var(--dsw-alias-state-business-primary)}',
      '.__ss_inputMono{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.06em}',
      '.__ss_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;min-width:180px}',
      '.__ss_check{display:flex;align-items:flex-start;gap:8px;cursor:pointer}',
      '.__ss_check input{margin-top:2px;accent-color:var(--dsw-alias-state-business-primary)}',
      '.__ss_checkText{display:flex;flex-direction:column;gap:2px}',
      '.__ss_two{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.__ss_actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px}',
      '.__ss_btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}',
      '.__ss_btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}',
      '.__ss_btn:disabled{opacity:.5;cursor:default}',
      '.__ss_btnPrimary{border-color:var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}',
      '.__ss_status{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_ok{font-size:12px;color:var(--dsw-alias-state-business-primary)}',
      '.__ss_err{font-size:12px;color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.__ss_swatch{width:38px;height:26px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;cursor:pointer}',
      '.__ss_preview{margin-top:2px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.__ss_previewText{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.5}'
    ].join('')
    var tagId = 'dsh-startup-screen/main.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-startup-screen'
      tag.dataset.pluginCss = tagId
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /* ── 表单原子 ────────────────────────────────────────────────────────── */
    function Field(props) {
      return h('div', { className: '__ss_field' },
        h('label', { className: '__ss_label' }, props.label),
        props.children,
        props.hint ? h('div', { className: '__ss_hint' }, props.hint) : null
      )
    }

    function TextInput(props) {
      return h('input', {
        className: '__ss_input' + (props.mono ? ' __ss_inputMono' : ''),
        type: props.type || 'text',
        value: props.value == null ? '' : String(props.value),
        placeholder: props.placeholder || '',
        maxLength: props.maxLength || 64,
        spellCheck: false,
        onChange: (e) => props.onChange(e.target.value)
      })
    }

    function Select(props) {
      return h('select', {
        className: '__ss_select',
        value: props.value,
        onChange: (e) => props.onChange(e.target.value)
      }, props.options.map((o) => h('option', { key: o[0], value: o[0] }, o[1])))
    }

    function Check(props) {
      return h('label', { className: '__ss_check' },
        h('input', {
          type: 'checkbox',
          checked: !!props.checked,
          onChange: (e) => props.onChange(e.target.checked)
        }),
        h('span', { className: '__ss_checkText' },
          h('span', null, props.label),
          props.hint ? h('span', { className: '__ss_hint' }, props.hint) : null
        )
      )
    }

    function ColorInput(props) {
      return h('input', {
        className: '__ss_swatch',
        type: 'color',
        value: props.value,
        onChange: (e) => props.onChange(e.target.value)
      })
    }

    function Range(props) {
      return h('div', { className: '__ss_row' },
        h('input', {
          type: 'range',
          min: props.min, max: props.max, step: props.step || 0.05,
          value: props.value,
          style: { flex: '1 1 200px' },
          onChange: (e) => props.onChange(Number(e.target.value))
        }),
        h('span', { className: '__ss_status' }, props.display)
      )
    }

    /* ── 语音：读系统里可用的音色，女声排在前面 ─────────────────────────── */
    var NATURAL_HINTS = ['natural', 'neural', 'online', 'premium', 'enhanced', 'siri', 'google']
    var FEMALE_HINTS = [
      'aria', 'jenny', 'michelle', 'emma', 'ava', 'libby', 'sonia', 'maisie',
      'zira', 'samantha', 'karen', 'moira', 'tessa', 'victoria', 'serena', 'allison',
      'susan', 'fiona', 'hazel', 'female', 'woman',
      'xiaoxiao', 'xiaoyi', 'xiaomo', 'huihui', 'yaoyao', '晓晓', '晓伊', '女声'
    ]
    var MALE_HINTS = ['david', 'mark', 'guy', 'ryan', 'george', 'daniel', 'alex', 'fred',
      'male', 'yunxi', 'yunjian', 'kangkang']

    function hits(name, list) {
      for (var i = 0; i < list.length; i++) if (name.indexOf(list[i]) !== -1) return true
      return false
    }
    /** 神经网络音色优先，其次女声，最后剔掉男声 —— 和运行时 splash.js 的打分口径一致 */
    function scoreVoice(name, lang, want) {
      var sc = 0
      if (hits(name, NATURAL_HINTS)) sc += 60
      if (hits(name, FEMALE_HINTS)) sc += 40
      if (hits(name, MALE_HINTS)) sc -= 45
      if (String(lang || '').indexOf(want) === 0) sc += 25
      return sc
    }

    function readVoices() {
      try {
        var s = window.speechSynthesis
        if (!s || typeof s.getVoices !== 'function') return []
        var list = s.getVoices() || []
        var want = 'en'
        var scored = list.map(function (v, i) {
          var name = String(v.name || '').toLowerCase()
          return {
            v: v,
            natural: hits(name, NATURAL_HINTS),
            female: hits(name, FEMALE_HINTS),
            sc: scoreVoice(name, String(v.lang || '').toLowerCase(), want),
            i: i
          }
        })
        scored.sort(function (a, b) {
          if (a.sc !== b.sc) return b.sc - a.sc
          return a.i - b.i
        })
        return scored.map(function (x) { return x.v })
      } catch (e) { return [] }
    }

    function speakSample(text, draft) {
      try {
        var s = window.speechSynthesis
        if (!s) return false
        s.cancel()
        var u = new window.SpeechSynthesisUtterance(text || 'Access permission required.')
        var list = readVoices()
        var target = null
        for (var i = 0; i < list.length; i++) if (list[i].name === draft.voiceName) target = list[i]
        if (target) { u.voice = target; u.lang = target.lang }
        u.rate = Math.min(2, Math.max(0.5, Number(draft.voiceRate) || 1))
        u.pitch = Math.min(2, Math.max(0, Number(draft.voicePitch) || 1))
        u.volume = Math.min(1, Math.max(0, Number(draft.voiceVolume) || 0.9))
        /* 两者本体都是内置真声；以下仅作素材缺失时的 TTS 兜底 */
        if (draft.voiceName === 'zhixing-cn') { u.text = '需要访问许可，验证通过。'; u.lang = 'zh-CN' }
        else if (draft.voiceName === 'calmlady-jp') { u.text = 'アクセス権限が必要です。'; u.lang = 'ja-JP' }
        else if (draft.voiceName === 'pessimistic-ru') { u.text = 'Требуется разрешение на доступ.'; u.lang = 'ru-RU' }
        else if (draft.voiceName === 'announcer-kr') { u.text = '접근 권한이 필요합니다.'; u.lang = 'ko-KR' }
        else { u.text = 'Access permission required.'; u.lang = 'en-US' }
        s.speak(u)
        return true
      } catch (e) { return false }
    }

    /** 试听：按当前音色放对应素材集的首段（line-1 / line-cn-1 / line-jp-1 / line-ru-1）。 */
    function previewVoice(draft) {
      try {
        var an = 'line-1'
        if (draft.voiceName === 'zhixing-cn') an = 'line-cn-1'
        else if (draft.voiceName === 'calmlady-jp') an = 'line-jp-1'
        else if (draft.voiceName === 'pessimistic-ru') an = 'line-ru-1'
        else if (draft.voiceName === 'announcer-kr') an = 'line-kr-1'
        /* 素材已从打包内联（window.__DSA_ASSETS__），本地播放，不走 HTTP */
        var uri = (window.__DSA_ASSETS__ && window.__DSA_ASSETS__[an]) || ''
        if (!uri) return false
        var a = new Audio(uri)
        a.volume = Math.min(1, Math.max(0, Number(draft.voiceVolume) || 0.9))
        a.play().catch(function () {})
        return true
      } catch (e) { return false }
    }

    function VoicePicker(props) {
      var opts = [
        ['', '自动（优先神经网络女声）-US'],
        ['zhixing-cn', '智性少女音-CN'],
        ['calmlady-jp', '清冷优雅-日语'],
        ['pessimistic-ru', '清冷脆弱-俄语'],
        ['announcer-kr', '威严铿锵宣示-朝鲜语']
      ]
      return h('div', { className: '__ss_field' },
        h('label', { className: '__ss_label' }, '音色'),
        h('div', { className: '__ss_row' },
          h(Select, { value: props.value || '', options: opts, onChange: props.onChange }),
          h('button', {
            className: '__ss_btn',
            type: 'button',
            onClick: props.onPreview
          }, '试听')
        ),
        h('div', { className: '__ss_hint' },
          '五个音色都是插件内置真声（各 6 段剪好的音频，音量/提示音受下方设置控制）：'
            + '自动（优先神经网络女声）-US = 英文神经网络女声真声；'
            + '智性少女音-CN = 中文智性少女真声；'
            + '清冷优雅-日语 = 日文清冷优雅女声真声；'
            + '清冷脆弱-俄语 = 俄文清冷脆弱女声真声；'
            + '威严铿锵宣示-朝鲜语 = 朝鲜语威严铿锵宣示真声。'
        )
      )
    }

    /* ── 面板 ────────────────────────────────────────────────────────────── */
    /* 本地兜底默认值：Host 半侧若是旧版本（配置里还没有语音字段），
       面板也要能正常显示这些控件，而不是一片 undefined。 */
    var FALLBACK = {
      voice: true, voiceLang: 'zh', voiceName: '', voiceRate: 0.88, voicePitch: 0.85,
      voiceVolume: 0.9, voiceCue: true, voiceLead: 240, voiceSource: 'asset',
      sound: true, soundVolume: 0.5,
      bgm: true, bgmVolume: 0.55, bgmStyle: 'cinematic',
      bgmSource: 'builtin', bgmUrl: '',
      identityPassword: '',
      autoPlay: 'full',
      mascot: 0,
      eventWindow: false
    }

    /* ── 自动播放三档 ─────────────────────────────────────────────────────
       完整配置 → 三档之一。旧配置只有 requireInteraction，按它迁移：
       false → 完全自动播放；true → 不自动播放。 */
    var AUTOPLAY_MODES = ['full', 'once', 'off']
    function autoPlayMode(cfg) {
      var ap = cfg && cfg.autoPlay
      if (AUTOPLAY_MODES.indexOf(ap) >= 0) return ap
      return (cfg && cfg.requireInteraction === false) ? 'full' : 'off'
    }
    function hasPassword(cfg) {
      return !!(cfg && String(cfg.identityPassword || '').trim())
    }
    function num(v, d) {
      var n = Number(v)
      return isFinite(n) ? n : d
    }

    /* 设置页「试听」：把填的链接 / 路径直接放 12 秒。
       本机路径必须走 Host 的 /dsh-startup/bgm 路由（http 页面读不了 file://）。
       1.5.1 修：原来失败时完全静默，用户只看到"点了没声"。现在每一步都有回话：
       加载中 / 路由没起来（Host 还是旧版）/ 解码失败 / 被自动播放策略挡住。 */
    var auditionEl = null
    function bgmSrcFor(url) {
      var raw = String(url || '').replace(/^file:\/{2,3}/i, '')
      var local = /^[a-zA-Z]:[\\/]/.test(raw) || raw.charAt(0) === '/' || raw.indexOf('\\\\') === 0
      if (!local) return { src: String(url || ''), local: false }
      return { src: '/dsh-startup/bgm?path=' + encodeURIComponent(raw), local: true }
    }
    function stopAudition() {
      try { if (auditionEl) { auditionEl.pause(); auditionEl = null } } catch (e) { /* noop */ }
    }
    function auditionBgm(url, volume, onState) {
      var say = typeof onState === 'function' ? onState : function () {}
      stopAudition()
      var raw = String(url || '').trim()
      if (!raw) { say('请先填一个音频链接或本机路径'); return false }
      var target = bgmSrcFor(raw)

      function playIt(src) {
        try {
          var a = new Audio(src)
          a.volume = Math.min(1, Math.max(0, num(volume, 0.55)))
          a.addEventListener('playing', function () { say('正在播放… 12 秒后自动停止') })
          a.addEventListener('error', function () {
            say('浏览器解不开这个文件（可能是视频没有音轨，或编码不支持）；换成 mp3 / m4a 最稳。')
          })
          var p = a.play()
          if (p && typeof p.catch === 'function') {
            p.catch(function () {
              say('被浏览器的自动播放策略挡住了：再点一次「试听 12 秒」。')
            })
          }
          auditionEl = a
          setTimeout(function () {
            if (auditionEl === a) {
              try { a.pause() } catch (e) { /* noop */ }
              auditionEl = null
              say('')
            }
          }, 12000)
        } catch (e) {
          say('试听失败：' + String(e && e.message ? e.message : e))
        }
      }

      if (!target.local) {
        say('正在加载…')
        playIt(target.src)
        return true
      }

      /* 本机文件先探一下 Host 路由：旧版 Host 没有 /bgm，会 404 —— 这正是
         「点了没声」最常见的原因，必须直接说出来，而不是干等。 */
      say('正在读取本机文件…')
      fetch(target.src, { headers: { Range: 'bytes=0-0' }, cache: 'no-store' })
        .then(function (r) {
          if (r && (r.status === 200 || r.status === 206)) { playIt(target.src); return }
          if (r && (r.status === 404 || r.status === 401)) {
            say('读不到本机文件：Host 侧的文件路由没起来。请把 DeepSeek Harness 完全退出（含托盘图标）再启动，然后重试。')
            return
          }
          say('读不到本机文件（HTTP ' + (r ? r.status : '?') + '）：检查路径是否存在、扩展名是否受支持。')
        })
        .catch(function (e) {
          say('读取失败：' + String(e && e.message ? e.message : e))
        })
      return true
    }

    /* 版本号的来源，按可靠性排序：
       1) 面板自己从 /dsh-startup/config 拿到的（Host 读的是它自己的 package.json）
       2) Host 往 index 里注入的 window.__DSH_STARTUP_VERSION__
          —— 桌面端走浏览器半侧自举时没有 1，就靠这一条
       3) 下面这个常量：两份都没拿到时的兜底，别让面板显示 undefined
       版本号本身只在 lib/index.js 里读一次，这里不重复维护。 */
    var FALLBACK_VERSION = '1.5.2'
    function readInjectedVersion() {
      try {
        var v = window.__DSH_STARTUP_VERSION__
        return v ? String(v) : ''
      } catch (e) { return '' }
    }

    function Panel() {
      var [draft, setDraft] = react.useState(null)
      var [defaults, setDefaults] = react.useState(null)
      var [file, setFile] = react.useState('')
      var [version, setVersion] = react.useState(readInjectedVersion)
      var [error, setError] = react.useState(null)
      var [notice, setNotice] = react.useState(null)
      var [busy, setBusy] = react.useState(false)
      /* 试听状态（正在读取 / 正在播放 / 失败原因），空串 = 不显示 */
      var [audition, setAudition] = react.useState('')
      /* Host 半侧是否还是 1.5.0（没有 bgmSource 字段 / 没有 /bgm 路由） */
      var [hostStale, setHostStale] = react.useState(false)

      function load() {
        setError(null)
        return fetch(API, { headers: { Accept: 'application/json' } })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'load failed')
            setDraft(Object.assign({}, FALLBACK, j.config))
            setDefaults(Object.assign({}, FALLBACK, j.defaults))
            setFile(j.file || '')
            if (j.version) setVersion(String(j.version))
            /* 关键诊断：Host 的 DEFAULTS 里没有 bgmSource，说明跑的还是 1.5.0 的
               Host 半侧 —— 本地文件路由不存在，试听必然静音。 */
            setHostStale(!!(j.defaults && j.defaults.bgmSource === undefined))
          })
          .catch((e) => setError('读取配置失败：' + String(e && e.message ? e.message : e)))
      }

      react.useEffect(() => { load() }, [])

      function set(key, value) {
        setNotice(null)
        setDraft((d) => Object.assign({}, d, { [key]: value }))
      }

      function save() {
        if (!draft) return
        setBusy(true); setNotice(null); setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch: draft })
        })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'save failed')
            setDraft(j.config)
            setNotice('已保存。下次打开 DSH 生效；点「立即预览」可以先看效果。')
          })
          .catch((e) => setError('保存失败：' + String(e && e.message ? e.message : e)))
          .then(() => setBusy(false))
      }

      function reset() {
        setBusy(true); setNotice(null); setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' })
        })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'reset failed')
            setDraft(j.config)
            setNotice('已恢复默认。')
          })
          .catch((e) => setError('恢复默认失败：' + String(e && e.message ? e.message : e)))
          .then(() => setBusy(false))
      }

      /** 用当前页面上的运行时做一次即时预览。
          重播前 splash.js 会从 /dsh-startup/config 拉一次最新配置，
          所以刚保存的设置（自动播放 / 事件窗口 / 立绘）也能立刻看到。
          没有运行时（动画已被跳过、只暴露了空壳 API）就退回刷新页面。 */
      function preview() {
        var api = window.__DSH_STARTUP_API__
        if (api && typeof api.replay === 'function' && !window.__DSH_STARTUP_SKIP__) {
          Promise.resolve(api.replay()).catch(function () {})
          return
        }
        window.location.reload()
      }

      /* 版本号常驻顶部，不进骨架屏 —— 它不依赖配置接口，
         接口挂了也该看得见当前装的是哪一版。 */
      var versionLine = h('div', { className: '__ss_version' }, '版本 v' + (version || FALLBACK_VERSION))

      if (!draft) {
        return h('div', { className: '__ss_root' },
          versionLine,
          h('div', { className: '__ss_status' }, error ? error : '读取配置中…'),
          error ? h('div', { className: '__ss_actions' },
            h('button', { className: '__ss_btn', onClick: load }, '重试')
          ) : null
        )
      }

      var modeOptions = [
        ['session', '每个浏览器会话一次'],
        ['daily', '每天一次'],
        ['always', '每次打开都播放']
      ]

      return h('div', { className: '__ss_root' },
        versionLine,

        /* 开关 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '播放'),
          h(Check, {
            label: '启用启动动画',
            hint: '关闭后直接进主界面，不再显示启动界面。',
            checked: draft.enabled,
            onChange: (v) => set('enabled', v)
          }),
          h(Field, { label: '播放时机' },
            h(Select, { value: draft.mode, options: modeOptions, onChange: (v) => set('mode', v) })
          ),
          h(Field, { label: '速度倍率', hint: '0.35 慢放 · 1 原速 · 3 快放；参考片时长约 27 秒，默认整套约 16 秒。' },
            h('div', { className: '__ss_row' },
              h('input', {
                type: 'range', min: 0.35, max: 3, step: 0.05,
                value: draft.speed,
                style: { flex: '1 1 240px' },
                onChange: (e) => set('speed', Number(e.target.value))
              }),
              h('span', { className: '__ss_status' }, Number(draft.speed).toFixed(2) + '×')
            )
          )
        ),

        /* 身份 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '身份资料'),
          h(Field, {
            label: '身份名称',
            hint: '终幕「欢迎 xxx 访问 / WELCOME, XXX」里的 xxx，也出现在第二步的身份卡上。'
          }, h(TextInput, { value: draft.identity, placeholder: '例如：JOYCE MOORE', onChange: (v) => set('identity', v) })),
          h('div', { className: '__ss_two' },
            h(Field, { label: '身份编号', hint: '显示在第二步身份卡上，建议用数字（如 0087）。' },
              h(TextInput, { value: draft.identityId, mono: true, onChange: (v) => set('identityId', v) })),
            h(Field, { label: '权限等级' },
              h(TextInput, { value: draft.accessLevel, mono: true, onChange: (v) => set('accessLevel', v) }))
          ),
          h(Field, {
            label: '身份密码',
            hint: '设置后，第二步「身份资料确认」会要求输入此密码才能继续；留空 = 不启用密码。'
          }, h(TextInput, { type: 'password', value: draft.identityPassword || '', placeholder: '留空则不启用密码', onChange: (v) => set('identityPassword', v) }))
        ),

        /* 交互 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '交互'),
          h(Field, {
            label: '自动播放',
            hint: '完全自动播放：整段动画不用任何操作，播完直接进主界面。'
              + '仅需点击一次进入：开头停一次等你点按钮 / 按 Enter，之后全自动（需要身份密码为空）。'
              + '不自动播放：第 1、2 步都停下来等确认（原来的「需要人工确认」）。'
          }, h(Select, {
            value: autoPlayMode(draft),
            options: [
              ['full', '完全自动播放'],
              ['once', '仅需点击一次进入'],
              ['off', '不自动播放']
            ],
            onChange: (v) => {
              set('autoPlay', v)
              /* 同时写旧字段：老版运行时 / 老 Host 只认它，别让两份配置打架 */
              set('requireInteraction', v === 'off')
            }
          })),
          hasPassword(draft) ? h('div', { className: '__ss_hint' },
            '当前设了身份密码，所以整段都会停下来等你输入密码：自动播放相关的等待规则会被密码闸覆盖。'
          ) : null,
          h(Check, {
            label: '允许跳过',
            hint: '右上角显示 SKIP，按 Esc 也能直接进主界面。',
            checked: draft.allowSkip,
            onChange: (v) => set('allowSkip', v)
          }),
          h(Check, {
            label: '音效',
            hint: '默认关闭；开启后在交互确认时有轻微电子音（浏览器需先有一次用户操作）。',
            checked: draft.sound,
            onChange: (v) => set('sound', v)
          })
        ),

        /* 语音与音效 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '语音与音效'),
          h(Check, {
            label: '女声播报',
            hint: '照参考片里那位女声的节奏：文字出现的同一时刻念出来。'
              + '三个音色均为插件内置真声（各 6 段剪好的音频），选下方「音色」即可决定用哪一组。'
              + '动画会等这句话念完再走下一步，不会把语音掐断；浏览器要求先有一次点击才准出声，'
              + '所以第一次点按钮/按 Enter 时会把当前这行补念一次。',
            checked: draft.voice,
            onChange: (v) => set('voice', v)
          }),
          draft.voice ? h(VoicePicker, {
            value: draft.voiceName,
            onChange: (v) => {
              set('voiceName', v)
              set('voiceSource', 'asset')   // 四个音色均为内置真声素材
            },
            onPreview: () => previewVoice(draft)
          }) : null,
          draft.voice ? h('div', { className: '__ss_row' },
            h('button', {
              className: '__ss_btn',
              type: 'button',
              onClick: () => {
                set('voiceName', '')
                set('voiceSource', 'asset')
                set('voiceCue', true)
              }
            }, '↺ 恢复默认语音档'),
            h('span', { className: '__ss_hint' }, '自动（优先神经网络女声）-US 内置真声 · 开启播报前提示音（语速/音调/留白三项已移除，它们对真声素材本就不生效）')
          ) : null,
          draft.voice ? h(Field, { label: '音量' },
            h(Range, { value: num(draft.voiceVolume, 0.9), min: 0, max: 1, display: Math.round(num(draft.voiceVolume, 0.9) * 100) + '%', onChange: (v) => set('voiceVolume', v) })
          ) : null,
          draft.voice ? h(Check, {
            label: '播报前提示音',
            hint: '念台词之前先响两声轻提示 —— 真声素材与 TTS 兜底都会先响，是「系统播报」AI 感的关键。',
            checked: draft.voiceCue,
            onChange: (v) => set('voiceCue', v)
          }) : null,
          h(Check, {
            label: '界面音效',
            hint: '咔哒 / 双音确认 / 过场噪声扫频 / 结尾和声钟，全部 WebAudio 现场合成，不含音频文件。',
            checked: draft.sound,
            onChange: (v) => set('sound', v)
          }),
          draft.sound ? h(Field, { label: '音效音量' },
            h(Range, { value: num(draft.soundVolume, 0.5), min: 0, max: 1, display: Math.round(num(draft.soundVolume, 0.5) * 100) + '%', onChange: (v) => set('soundVolume', v) })
          ) : null
        ),

        /* 背景音乐 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '背景音乐'),
          h(Check, {
            label: '背景音乐',
            hint: '整段动画的底噪。可以只用内置合成曲，也可以填一首自己的（链接或本机文件）。'
              + '浏览器要求先有一次点击才准出声：动画里出现「点击任意位置开启声音」时点一下即可。',
            checked: draft.bgm !== false,
            onChange: (v) => set('bgm', v)
          }),
          draft.bgm !== false ? h(Field, {
            label: '音乐来源',
            hint: '内置合成：三层 WebAudio 现场合成，不打包音乐文件、不联网；'
              + '自定义：播放你指定的音频文件，换成那首曲子。'
          },
            h(Select, {
              value: draft.bgmSource === 'custom' ? 'custom' : 'builtin',
              options: [['builtin', '内置合成（默认）'], ['custom', '自定义 · 链接或本机文件']],
              onChange: (v) => set('bgmSource', v)
            })
          ) : null,
          draft.bgm !== false && draft.bgmSource === 'custom' && hostStale ? h('div', { className: '__ss_hint', style: { color: '#ff9a7a' } },
            '检测到 Host 半侧仍是旧版（1.5.0）：本地文件要靠 Host 的 /dsh-startup/bgm 路由下发，'
              + '旧版没有这条路由，试听会读不到文件。请把 DeepSeek Harness 完全退出（含托盘图标）再启动。'
          ) : null,
          draft.bgm !== false && draft.bgmSource === 'custom' ? h(Field, {
            label: '音频链接 / 本机路径',
            hint: '支持：mp3 / m4a / aac / wav / ogg / flac / mp4 的直链，'
              + '或本机绝对路径（例如 D:\\music\\jun-ge.mp3，支持中文路径）。'
              + '注意：抖音 / B 站 / 网易云的分享链接是网页不是音频文件，粘进来放不出来 —— '
              + '需要先把音频下载到本机，再填它的路径。'
          },
            h('div', { className: '__ss_row' },
              h(TextInput, {
                value: draft.bgmUrl || '',
                maxLength: 512,
                placeholder: 'https://…/bgm.mp3 或 D:\\music\\bgm.mp3',
                onChange: (v) => set('bgmUrl', v)
              }),
              h('button', {
                className: '__ss_btn',
                type: 'button',
                onClick: () => auditionBgm(draft.bgmUrl, draft.bgmVolume, setAudition)
              }, '试听 12 秒')
            ),
            audition ? h('div', { className: '__ss_hint' }, audition) : null
          ) : null,
          draft.bgm !== false && draft.bgmSource !== 'custom' ? h(Field, {
            label: '曲风',
            hint: '电影感氛围：84 BPM，慢、暗、留白多，配暗色「技术档案」底板；'
              + '工业脉冲：100 BPM，八分音符推子 + 四拍底鼓，更硬更快。'
          },
            h(Select, {
              value: draft.bgmStyle === 'pulse' ? 'pulse' : 'cinematic',
              options: [['cinematic', '电影感氛围（默认）'], ['pulse', '工业脉冲']],
              onChange: (v) => set('bgmStyle', v)
            })
          ) : null,
          draft.bgm !== false ? h(Field, {
            label: '音乐音量',
            hint: '独立于台词与音效，互不连坐；台词出声时音乐会自动压低，念完再抬回来。'
          },
            h(Range, {
              value: num(draft.bgmVolume, 0.55),
              min: 0, max: 1,
              display: Math.round(num(draft.bgmVolume, 0.55) * 100) + '%',
              onChange: (v) => set('bgmVolume', v)
            })
          ) : null
        ),

        /* 视觉 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '视觉'),
          h(Field, { label: '主题' },
            h(Select, {
              value: draft.theme,
              options: [['light', '浅色 · 暖白档案底板（参考片原色）'], ['dark', '深色 · 暗底板']],
              onChange: (v) => set('theme', v)
            })
          ),
          h(Field, { label: '人物立绘', hint: '动画右下角的人物形象，赛博电子风霓虹线稿。选「空」则不显示立绘。' },
            h(Select, {
              value: String(draft.mascot == null ? 0 : draft.mascot),
              options: [
                ['0', '长征（水手服）'],
                ['1', '长征（中山装）'],
                ['2', '长征（J装）'],
                ['3', '长征（最美好的主唱）'],
                ['-1', '空（不显示立绘）']
              ],
              onChange: (v) => set('mascot', Number(v))
            })
          ),
          h(Check, {
            label: '降世事件窗口 · 每次播放都弹出',
            hint: '默认关闭：装好后的首次启动会弹一次「降世」事件窗口，之后不再出现。'
              + '勾选后每次动画结束都弹，按 Enter 或点击按钮进入主界面。',
            checked: draft.eventWindow === true,
            onChange: (v) => set('eventWindow', v)
          }),
          h('div', { className: '__ss_two' },
            h(Field, { label: '' },
              h('div', { className: '__ss_row' },
                h(ColorInput, { value: draft.accent, onChange: (v) => set('accent', v) }),
                h('span', { className: '__ss_status' }, draft.accent)
              )
            ),
            h(Field, { label: '' },
              h('div', { className: '__ss_row' },
                h(ColorInput, { value: draft.glitchB, onChange: (v) => set('glitchB', v) }),
                h('span', { className: '__ss_status' }, draft.glitchB)
              )
            )
          )
        ),

        /* 文案 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '文案'),
          h('div', { className: '__ss_two' },
            h(Field, { label: '左上 · 主标题' }, h(TextInput, { value: draft.brand1, onChange: (v) => set('brand1', v) })),
            h(Field, { label: '左上 · 产品行' },
              h('div', { className: '__ss_row' },
                h(TextInput, { value: draft.brand3a, onChange: (v) => set('brand3a', v) }),
                h('span', { className: '__ss_status' }, '+'),
                h(TextInput, { value: draft.brand3b, onChange: (v) => set('brand3b', v) })
              )
            )
          ),
          h(Field, { label: '左上 · 副标题' }, h(TextInput, { value: draft.brand2, maxLength: 40, onChange: (v) => set('brand2', v) })),
          h('div', { className: '__ss_two' },
            h(Field, { label: '黑幕 · 中文' }, h(TextInput, { value: draft.orgZh, onChange: (v) => set('orgZh', v) })),
            h(Field, { label: '黑幕 · 英文' }, h(TextInput, { value: draft.orgEn, mono: true, onChange: (v) => set('orgEn', v) }))
          ),
          h('div', { className: '__ss_two' },
            h(Field, { label: '黑幕 · 小字' }, h(TextInput, { value: draft.orgSub, mono: true, onChange: (v) => set('orgSub', v) })),
            h(Field, { label: '终幕 · 黑框' }, h(TextInput, { value: draft.welcomeBox, onChange: (v) => set('welcomeBox', v) }))
          ),
          h(Field, { label: '右下 · 页脚' }, h(TextInput, { value: draft.footer, mono: true, onChange: (v) => set('footer', v) }))
        ),

        /* 预览 + 操作 */
        h('div', { className: '__ss_preview' },
          h('div', { className: '__ss_previewText' },
            '「立即预览」会先拉取最新保存的配置再重播，自动播放 / 事件窗口 / 立绘的改动都能马上看到；'
              + '如果动画本轮已被跳过，则改为刷新页面。',
            file ? h('div', { style: { marginTop: '4px', opacity: 0.75 } }, '配置文件：' + file) : null
          ),
          h('button', { className: '__ss_btn', onClick: preview }, '立即预览')
        ),

        h('div', { className: '__ss_actions' },
          h('button', {
            className: '__ss_btn __ss_btnPrimary',
            disabled: busy,
            onClick: save
          }, busy ? '处理中…' : '保存'),
          h('button', { className: '__ss_btn', disabled: busy, onClick: reset }, '恢复默认'),
          h('button', { className: '__ss_btn', disabled: busy, onClick: load }, '放弃修改'),
          notice ? h('span', { className: '__ss_ok' }, notice) : null,
          error ? h('span', { className: '__ss_err' }, error) : null
        )
      )
    }

    /* ── 桌面端自举 ──────────────────────────────────────────────────────── */
    /* Host 半侧靠 ctx.webServer.tapIndex 往 index.html 里注入启动界面。
       web profile 一定走这条路；但 Electron 也可能改用 file:// + IPC 直接下发
       前端（dsh-host-webserver 的注释就写着 "Electron uses file:// plus IPC
       instead"），那时 index 注入整条不生效。所以浏览器半侧自己兜一层：
       没被 Host 接管时，由本侧建根节点 + 拉 splash.css/splash.js 自举。

       判定全在 window 上，不去猜宿主类型：
         __DSH_STARTUP_BOOT__  Host 已经注入过（index）/ 本侧已经自举过（client）
         __DSH_STARTUP_SKIP__  Host 侧的兜底脚本已判定"这次不播"
         __DSH_STARTUP__       配置已就位（Host 注入的）
       Host 判定失效时不该被静默吃掉，所以这里在拦到 SKIP 之前，还要看一眼
       Host 侧根本没跑过（BOOT 标记为空）这种情况：把兜底脚本的同款判定补做一遍。 */
    var BOOT_ROUTE = '/dsh-startup'

    function readFlag(store, key) {
      try {
        var s = window[store]
        return s ? s.getItem(key) : null
      } catch (e) { return null }
    }

    function writeFlag(store, key, value) {
      try {
        var s = window[store]
        if (s) s.setItem(key, value)
      } catch (e) { /* 隐私模式下可能抛，忽略 */ }
    }

    function markBooted() {
      try { window.__DSH_STARTUP_BOOT__ = 'client' } catch (e) { /* noop */ }
    }

    /** 挂一个 <script src>；失败时调 fail(err)。 */
    function loadScript(src, fail) {
      var s = document.createElement('script')
      s.src = src
      s.async = false
      if (typeof fail === 'function') {
        s.addEventListener('load', function () { fail(null) })
        s.addEventListener('error', function () { fail(new Error('script load failed: ' + src)) })
      }
      ;(document.head || document.documentElement).appendChild(s)
    }

    /** 挂一份 <link rel=stylesheet>；失败时调 fail(err)。 */
    function loadCss(href, fail) {
      var link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      if (typeof fail === 'function') {
        link.addEventListener('load', function () { fail(null) })
        link.addEventListener('error', function () { fail(new Error('css load failed: ' + href)) })
      }
      ;(document.head || document.documentElement).appendChild(link)
    }

    /** 移除根节点、解开滚动锁定 —— 自举任何一步失败都要把页面还回去。 */
    function release(ok) {
      if (ok) return
      try {
        var r = document.getElementById('dsh-startup-root')
        if (r && r.parentNode) r.parentNode.removeChild(r)
        if (document.documentElement.classList) document.documentElement.classList.remove('dsu-lock')
        if (document.body && document.body.style) document.body.style.overflow = ''
        window.__DSH_STARTUP_FAILED__ = true
      } catch (e) { /* 兜底不再抛 */ }
    }

    function injectRoot(cfg) {
      var root = document.getElementById('dsh-startup-root')
      if (!root) {
        root = document.createElement('div')
        root.id = 'dsh-startup-root'
        document.body.appendChild(root)
      }
      root.className = 'dsu-root dsu-boot'
      if (document.documentElement.classList) document.documentElement.classList.add('dsu-lock')
      if (document.body && document.body.style) document.body.style.overflow = 'hidden'

      /* 样式与运行时都从 Host 路由取 —— 同一份文件，不额外维护内联副本 */
      var failed = false
      var cssReady = false
      var scriptReady = false
      function guard(err) {
        if (err) {
          if (!failed && typeof console !== 'undefined' && console.warn) {
            console.warn('[dsh-startup-screen] 启动界面自举失败，已放开页面：', err.message)
          }
          failed = true
          release(false)
          return
        }
        if (cssReady && scriptReady) release(true)
      }

      loadCss(BOOT_ROUTE + '/splash.css', function (err) {
        if (err) { guard(err); return }
        cssReady = true
        guard(null)
      })

      /* 配置先落 window：splash.js 载入时直接读它 */
      window.__DSH_STARTUP__ = cfg || {}
      try {
        delete window.__DSH_STARTUP_LOADED__
      } catch (e) { window.__DSH_STARTUP_LOADED__ = undefined }
      /* 音频素材内联脚本，先于 splash.js 载入，供其读取 window.__DSA_ASSETS__ */
      loadScript(BOOT_ROUTE + '/asset-data.js', function () {})
      loadScript(BOOT_ROUTE + '/splash.js?t=' + Date.now(), function (err) {
        if (err) { guard(err); return }
        scriptReady = true
        guard(null)
      })

      /* 自愈：样式与脚本都拿到了、这个标记还在，就说明动画没接管，放行 */
      setTimeout(function () {
        try {
          var r = document.getElementById('dsh-startup-root')
          if (r && r.className && r.className.indexOf('dsu-boot') !== -1) release(false)
        } catch (e) { /* 兜底不再抛 */ }
      }, 9000)
    }

    function selfBoot() {
      try {
        if (typeof window === 'undefined' || typeof document === 'undefined') return
        if (!document.body) return
        if (window.__DSH_STARTUP_BOOT__) return          /* 已被 Host 或本侧接管 */
        if (window.__DSH_STARTUP__) return               /* 配置已在页面上：Host 注入过 */
        if (document.getElementById('dsh-startup-root')) return
        /* 已经出过错的地方不要再扑一次 */
        if (window.__DSH_STARTUP_FAILED__ === true) return
        markBooted()
        fetch(API, { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json() })
          .then(function (j) { return j && j.ok === true ? j.config : null })
          .catch(function () { return null })
          .then(function (cfg) {
            cfg = cfg || { enabled: true, mode: 'session', speed: 1 }
            if (cfg.enabled === false) return
            var today = new Date().toISOString().slice(0, 10)
            if (cfg.mode === 'session' && readFlag('sessionStorage', 'dsh-startup-screen:shown') === '1') return
            if (cfg.mode === 'daily' && readFlag('localStorage', 'dsh-startup-screen:day') === today) return
            /* 回填判定标记，保证与 Host 侧同款语义（splash.js 会读这两个键） */
            if (cfg.mode === 'session') writeFlag('sessionStorage', 'dsh-startup-screen:shown', '1')
            if (cfg.mode === 'daily') writeFlag('localStorage', 'dsh-startup-screen:day', today)
            return injectRoot(cfg)
          })
          .catch(function () { /* 自举失败就算了，页面本来就是好的 */ })
      } catch (e) { /* 自举是兜底，绝不许把宿主带崩 */ }
    }

    /* ── 插件 ────────────────────────────────────────────────────────────── */
    var inject = ['slots']

    function apply(ctx) {
      /* 桌面端兜底：Host 的 index 注入不生效时，由这里自举启动界面。
         正常 web 流程下 __DSH_STARTUP__/__DSH_STARTUP_BOOT__ 已就位，本调用直接返回。 */
      selfBoot()
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          { name: 'settings.section', id: 'startup-screen', order: 26, label: '启动动画' },
          function () { return h(Panel, {}) }
        )
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
