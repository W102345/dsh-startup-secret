# 需要音频的字段清单

本文件列出启动动画里**所有会出声的槽位**，以及每个槽位当前用的是哪份素材。
数值与文件名直接从 `lib/splash.js` 抓取。

---

## 一、语音台词 —— 5 个槽位，全部用真声素材（终幕不出人声）

素材来自你提供的 `52xo4-igqdo-001.aac`，一一对应如下：

| 槽位 | 中文主字 | 英文副标题 | 素材文件 | 源素材 | 素材时长 | 出声时机 |
|---|---|---|---|---|---|---|
| `line-1` | 需要访问许可 | `ACCESS PERMISSION REQUIRED` | `lib/assets/line-1.mp3` | V1 (7.40–9.36s) | **1.96s** | 洗白后第一步，与文字渐显同时 |
| `line-2` | 身份资料确认 | `IDENTITY VERIFICATION` | `lib/assets/line-2.mp3` | V2 (11.29–12.45s) | **1.16s** | 第二步（身份卡 + 等确认） |
| `line-3` | 接收访问需求 | `ACCESS REQUEST RECEIVED` | `lib/assets/line-3.mp3` | V4 (14.76–15.83s) | **1.07s** | 第三步（鲸鱼标识一笔画成） |
| `line-4` | 开始读取权限 | `PERMISSION READ STARTED` | `lib/assets/line-4.mp3` | V5 (17.11–18.29s) | **1.18s** | 第四步（十六进制瀑布） |
| `line-5` | 读取完毕 · 核验通过 | `READ COMPLETE · VERIFIED` | `lib/assets/line-5.mp3` | V6 (19.71–21.41s) | **1.70s** | 第五步（环形准星扫描） |

**V3（13.04–14.09s）是用户名字独白，按你的要求不使用。**

### 素材取不到时

`voiceSource = 'asset'`（默认）时优先用素材；**素材缺失或解码失败会自动回落到 TTS**
（`say` 字段就是回落用的文本）。设置页可强制 `tts`。

### 终幕不出人声

按你的要求，**终幕「欢迎 `<身份名称>` 访问」只有画面与和声钟，不播人声**。
`finale()` 里调用 `voice.stop()` 收尾，源码中已无 `voice.tts(` 调用
（`test/smoke-splash.mjs` 第 8 节有回归断言钉住这条）。

将来的备选：如果想把终幕也配上人声，可以
① 让名字固定死 → 做成素材；② 补一条「欢迎访问」的通用素材（不含名字）。

---

## 二、界面音效 —— 8 个槽位

| # | 槽位 | 出声时机 | 素材 | 状态 |
|---|---|---|---|---|
| 1 | `cue` | **每次念台词之前**的两声轻提示 | 合成（1046.5 + 1568 Hz） | 合成 |
| 2 | `tick` | 文字逐字渐显 | `lib/assets/sfx-tick.mp3` | ✅ 真素材 |
| 3 | `step` | 每个阶段推进 | 同上 | ✅ 真素材 |
| 4 | `confirm` | 点按钮 / 按 Enter 确认 | 同上 | ✅ 真素材 |
| 5 | `tickRun` | 十六进制瀑布开始滚动 | `lib/assets/sfx-ticks-run.mp3` | ✅ 真素材 |
| 6 | `sweep` | 黑幕 → 暖白底板的洗白过场 | 合成（带通噪声扫频） | 合成 |
| 7 | `rise` | 黑幕上 DeepSeek 标识出现 | 合成（220→990 Hz 上行） | 合成 |
| 8 | `chime` | 终幕揭幕 | 合成（三音和声钟） | 合成 |

`tick` / `step` / `confirm` 目前**共用同一个「哒」**（音量不同）。
如果想让它们各用不同音效，补素材即可。

### 为什么 4 个还是合成

你给的音频里 **0–6.90s 是纯静音**：

- `rise` 对应原片约 3.9–5.5s → **原音频那里没有声音**
- `sweep` 对应原片约 6.2–6.7s → **同上**
- `chime` 对应 22.62–27.40s，但那是**配乐**不是音效

---

## 三、素材清单

```
lib/assets/
├─ line-1.mp3          40.3 KB   V1  需要访问许可
├─ line-2.mp3          24.5 KB   V2  身份资料确认
├─ line-3.mp3          23.0 KB   V4  接收访问需求
├─ line-4.mp3          25.0 KB   V5  开始读取权限
├─ line-5.mp3          35.2 KB   V6  读取完毕 · 核验通过
├─ sfx-tick.mp3         2.1 KB   单声「哒」（20ms，质心 7.5kHz）
└─ sfx-ticks-run.mp3   10.2 KB   整串 10 个「哒」，每 45ms 一个
```

Host 经 `/dsh-startup/asset/<文件名>` 只读下发（正则白名单 + 防目录穿越）。
6 段真声素材的 40–120Hz 能量都在 −25 ~ −34 dB（片尾配乐是 −1.3 dB），
**素材本身干净，没有配乐底**。

---

## 四、时长怎么定

**不再写死。** 每一步的停留时间 = `max(视觉基准, 实际音频时长 + 240ms 收尾)`：

```js
var spoke = voice.line(step.say, step.zh, step.audio)   // Promise<这一句实际播了多久>
function holdFor(spoken) {
  var target = Math.max(ms(step.hold), (spoken || 0) + ms(240))
  return wait(Math.max(0, target - (spoken || 0)))
}
```

素材播多长，动画就等多久；**用户点得快也不掐断语音**。
只有「跳过 / 揭幕」才真的 `cancel()`。

按素材时长，五步的语音段落约：
`1.96s → 1.16s → 1.07s → 1.18s → 1.70s`（另加每次 240ms 的开头留白）。

---

## 五、有字但故意不配音的字段

`en`（中央大字）· `log` / `logEn`（底部日志）· `btnZh` / `btnEn`（按钮）· `badge`（阶段计数）·
`brand1/2/3`、`orgZh/orgEn/orgSub`、`welcomeBox`、`footer`（品牌与页脚）

---

## 六、相关设置项

| 设置项 | 作用 |
|---|---|
| `voice` | 语音播报总开关 |
| `voiceSource` | `asset`=优先真声素材 / `tts`=全 TTS |
| `voiceLang` | `en` / `zh` / `both`（只影响 TTS 回落时念什么） |
| `voiceName` / `voiceRate` / `voicePitch` / `voiceVolume` | TTS 音色与语调 |
| `voiceCue` | 念台词前的提示音开关 |
| `voiceLead` | 提示音之后留多久再开口（默认 240ms） |
| `sound` / `soundVolume` | 界面音效总开关与音量（**不连坐语音素材**） |
| `sfx` | 音效来源：`audio`=真素材 / `synth`=全合成 |
| `bgm` / `bgmVolume` | 背景音乐总开关与音量（**不连坐台词与音效**） |
| `bgmStyle` | 曲风：`cinematic`=电影感氛围（84 BPM）/ `pulse`=工业脉冲（100 BPM） |
| `bgmSource` | 音源：`builtin`=内置合成 / `custom`=自定义链接或本机文件 |
| `bgmUrl` | 自定义音源：音频直链，或本机绝对路径（最长 512 字符） |

---

## 七、背景音乐（v1.5.0 新增）

**这里没有素材文件。** 整条音乐由 WebAudio 现场合成，和界面音效共用同一个
AudioContext，所以离线、`file://` 预览、没有声卡环境的机器都不会因为"加载不到文件"
而失声。谱面直接写在 `lib/splash.js` 的 `MUSIC` 表里，改谱不用碰任何二进制资源。

| 层 | 音色与做法 | 作用 |
|---|---|---|
| 低频 | sub bass（正弦，或工业脉冲用低通锯齿的八分推子）+ 四拍底鼓（126→42 Hz 下滑 + 30ms 高通噪声打击头） | 撑住「机器在运转」的推力 |
| 和声 | 两个 ±6~7 音分微失谐锯齿波 + 一个高八度三角波，过低通 950 Hz 铺满一小节 | 暗色和声带（电影感：Dm–Bb–F–C；工业：Am–F–C–G），48 秒内不重复够用 |
| 高音 | 16 分琶音（三角/方波，22ms 衰减）+ 短噪声镲（7.2 kHz 高通） | 电子设备的呼吸感 |

### 强度曲线（`bgm.setTier`）

| 时机 | 档位 | 听感 |
|---|---|---|
| 黑幕 / 厂牌标识 | 1 | 只有薄垫 + 一声很轻的心跳，不抢开场的静 |
| 过曝洗白 → 授权五步 | 2 | 鼓点、琶音进来，和声铺满 |
| 揭幕（`bgm.swell()`） | 3 | 上行扫频 + 底鼓 + 四拍全开，托住最后那下光爆 |
| 镜头后撤 | — | 1.6 秒淡出，不硬切 |

### 压混（duck）

`bgm.duckUntil(promise)`：每句台词起手时音乐 160ms 内压到 34%，
promise 落地后 550ms 抬回 100%。用 `duckDepth` 计数，多句重叠不会互相提前抬起；
跳过 / 收尾时 `bgm.stop()` 直接淡出，不会留在主界面上继续响。

### 起播的浏览器策略

`bgm.start()` 进页面就调；上下文被策略挂起时挂一次性的
`pointerdown` / `keydown` / `touchstart`，在手势事件里**同步**调 `resume()`
（放到 `setTimeout` 里 Chrome 不认），再以 120ms 间隔重试最多 25 次接上排期。
挂起期间画面底部显示「点击任意位置开启声音」（`.dsu-audiohint`，`pointer-events: none`），
起播后淡出。桌面端（Electron）通常不要求手势，`start()` 自己就能起。

### 响度（v1.5.1 重调）

`master = clamp(bgmVolume) × 1.25`，默认 `bgmVolume = 0.55` → 0.6875；
各层增益见 `padChord` / `kick` / `schedule`；主输出过一道
`threshold −14 dB / ratio 3.5` 的压缩器当限幅，开到 100% 也不会削顶。
1.5.0 是 `0.4 × 0.85`，实际只有 −30 dB 上下，在笔记本扬声器上几乎听不见。

---

## 八、自定义背景音乐（v1.5.1 新增）

`bgmSource: 'custom'` + `bgmUrl`（直链或本机绝对路径）。**刻意不用 WebAudio 解码**：
跨域音频交给 `createMediaElementSource` 会被 CORS 判死（静音），而 `<audio>` 自己播
不需要 CORS。于是播放链路变成：

| 环节 | 做法 |
|---|---|
| 播放 | `new Audio(src)`，`loop = true`，`preload = 'auto'` |
| 音量 | `element.volume = clamp(bgmVolume)`（不再乘 1.25，媒体元素上限就是 1） |
| 压混 | 台词期间 `volume × 0.34`，念完还原（同样用 `duckDepth` 计数） |
| 起播 | `play()` 被拒（自动播放策略）就挂手势，点击后重试 |
| 淡入/淡出 | 40ms 步进的 `volume` 线性过渡（1.8s 进 / 1.2s 出） |
| 失效回落 | `<audio>` 的 `error` 事件 → 自动切回内置合成曲，不会让动画变哑 |

**本机路径**（`D:\music\a.mp3` 或 `file:///D:/a.mp3`）由 Host 的
`/dsh-startup/bgm?path=…` 路由下发：

- 只认绝对路径 + `.mp3/.m4a/.m4b/.aac/.wav/.ogg/.oga/.opus/.flac/.mp4/.webm`；
- 单文件上限 80 MB；
- 支持 `Range`（`<audio>` 循环 / 拖动都不卡）；
- 走 `requestRejection` 信任栅栏，别的网页读不到。

**抖音 / B 站 / 网易云的分享链接是网页不是音频文件**，`bgmUrl` 里填了也放不出来 ——
必须先下载到本机再填路径。


