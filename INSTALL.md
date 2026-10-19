# 安装说明

## 一、用脚本安装（推荐，最省事）

脚本会自动完成「安装依赖」+「写入 dsh.profile.bundles」两步。

- **Windows**：解压后双击 `安装.cmd`
- **macOS / Linux**：`./install.sh`（可加参数 `./install.sh desktop`）

装完 **重启 dsh web**（关掉启动器窗口再重新双击）。刷新页面就能看到启动动画。

## 二、手动安装（两步，缺一不可）

### 关键：为什么装完没效果

DSH 靠 **`dsh.profile.bundles`** 这个层堆栈决定加载哪些插件。而
`dsh plugin add` 只是 **`pnpm add` 的转发**，它只把包写进 `dependencies`，
**不会自动把包名加入 `dsh.profile.bundles`**。

只有包名出现在 `dsh.profile.bundles` 里时，插件的 `cordis.patch.yml`
（里面的 `insert`）才会作为一层被 compose，插件的 Host 半侧和浏览器半侧
才会真正被加载。

**所以只跑 `dsh plugin add`、不补 bundles，结果就是：装上了、不报错、
但启动动画不显示、设置页也没有「启动动画」入口。**

### 第 1 步：安装依赖

```bash
dsh plugin --profile web add ./dsh-startup-secret-1.3.1.tgz
```

### 第 2 步：写入 bundles（关键）

打开 `~/.dsh/profiles/web/package.json`，在 `dsh.profile.bundles` 数组里加入
`"dsh-startup-secret"`：

```json
"dsh": {
  "profile": {
    "bundles": [
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "dsh-startup-secret"
    ]
  }
}
```

（desktop profile 同理，文件在 `~/.dsh/profiles/desktop/package.json`。）

### 装完请检查一次

如果你之前是手工在 profile 的 `cordis.patch.yml` 里加了这类条目：

```yaml
- insert:
    - id: dsh-startup-secret
      name: dsh-startup-secret
```

**必须删掉。** 否则插件被注册两次，`apply` 跑两遍，
`ctx.webServer.register()` 对同一路径重复注册会报错。

`安装.cmd` 会自动检测并提示。

---

## 二、手工安装（不用 pnpm）

1. 把 `plugin/` 目录解压到任意位置
2. 让 profile 能解析到它 —— 在 `~/.dsh/profiles/web/node_modules/` 下建目录联接：

   ```cmd
   mklink /J "%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-startup-secret" "解压路径\plugin"
   ```

3. 在 `~/.dsh/profiles/web/cordis.patch.yml` 末尾追加：

   ```yaml
   - insert:
       - id: dsh-startup-secret
         name: dsh-startup-secret
   ```

4. 重启 dsh web

---

## 三、验证装好了

重启后，**没带 token** 访问插件路由：

- `/dsh-startup/splash.js` 返回 **401** → 路由已注册（401 是插件自己的信任栅栏，正常）
- 返回 **404** → 没装成功，或没重启

打开页面后应该看到：黑幕 → DeepSeek 标识 → 过曝洗白 → 暖白底板 →
五步授权序列 → 揭幕。

---

## 四、卸载

```bash
dsh plugin --profile web remove dsh-startup-secret
```

走「二、手工安装」的，删掉目录联接和那两行 patch 条目即可。

---

## 五、配置项

设置页 → **启动动画**（order 26）：

| 分组 | 可调 |
|---|---|
| 播放 | 显示模式（每次会话 / 总是）、速度、是否可跳过 |
| 身份资料 | 身份名称（默认 `JOYCE MOORE`）、编号、权限等级、身份密码 |
| 交互 | **自动播放三档**（见下） |
| 语音与音效 | 语音开关、**语音来源（真声素材 / 系统 TTS）**、音色、语速、音调、音量、播报前提示音、开口前留白；界面音效开关与音量 |
| 背景音乐 | **背景音乐开关（默认开）**、音乐来源（内置合成 / 自定义链接或本机文件）、音乐音量、曲风（电影感氛围 / 工业脉冲） |
| 视觉 | 主题、**人物立绘（含「空」= 不显示）**、**降世事件窗口** |
| 文案 | 中文主字 / 英文副标题 / 日志行 / 按钮文字 |

配置落盘在 `$DSH_HOME/dsh-startup.json`（默认 `~/.dsh/dsh-startup.json`）。

### 自动播放（v1.4.0 起，替代旧的「需要人工确认」开关）

| 取值 | 设置页名称 | 行为 |
|---|---|---|
| `full` | 完全自动播放 | 五步全程不停，不需要任何操作，播完直接进主界面（不显示确认按钮） |
| `once` | 仅需点击一次进入 | 第一步停一次，点按钮 / 按 Enter 之后全自动（该档要求身份密码为空；若设了密码，密码照常拦截） |
| `off` | 不自动播放 | 第 1、2 步都停下来等确认，相当于原来的「需要人工确认」 |

旧配置只有 `requireInteraction`：`true` → `off`，`false` → `full`，升级不会打乱原有习惯；
非法/未知取值一律落到 `off`（不会擅自变成全自动）。

### 降世事件窗口

默认**关闭**。安装后的**首次启动**会弹一次（用 `localStorage` 的
`dsh-startup-screen:event-seen` 记一次性标记），之后不再出现；
勾选「降世事件窗口 · 每次播放都弹出」后，每次动画结束都会弹，Enter / 点击进入主界面。

### 背景音乐（v1.5.0 起，v1.5.1 加自定义音源）

字段：`bgm: true` / `bgmVolume: 0.55` / `bgmStyle: cinematic|pulse` /
`bgmSource: builtin|custom` / `bgmUrl: ''`。

- **内置合成**（默认）整条音乐由 WebAudio 现场合成，**不含任何音乐文件**，
  离线、`file://` 预览都能响。
- **自定义**：把 `bgmSource` 设为 `custom`，`bgmUrl` 填音频直链或本机绝对路径。
  本机路径由 Host 的 `/dsh-startup/bgm?path=…` 路由下发（扩展名白名单、80MB 上限、
  Range、信任栅栏）。填了 `custom` 但 `bgmUrl` 为空会自动退回内置曲。
- 浏览器要求先有一次用户手势，最迟在你第一次点按钮 / 按 Enter 时起播；
  被挂起时画面会出现「点击任意位置开启声音」提示。台词出声时自动压混，
  跳过或播完自动淡出。
- **改了本机文件路径后如果试听没反应**：先确认已经把 DSH 完全退出（含托盘图标）再启动 ——
  `/dsh-startup/bgm` 路由是 Host 在进程启动时注册的，只刷新窗口不会更新 Host。
  1.5.2 起设置页会自己检测并提示这一点。

### 人物立绘「空」

人物立绘下拉最后一项是「空（不显示立绘）」，对应配置值 `mascot: -1`，
选中后右下角不渲染任何立绘。

---

## 六、环境要求

| 项 | 要求 |
|---|---|
| Node | **>= 20** |
| 平台 | DSH **web** profile（`dsh.client.platform = "web"`） |
| 运行时依赖 | **零**（`dependencies` / `peerDependencies` 都是空的） |
| 语音 | 浏览器 Web Speech API；Edge 里能挑到 `... Online (Natural)` 神经网络音色 |
| 真声素材 | 已内置 `lib/assets/`；**取不到会自动回落 TTS**，不影响启动 |

---

## 七、包内容

```
lib/index.js          Host 半：路由 + index.html 注入
lib/splash.js         启动动画运行时
lib/splash.css        全部样式
lib/client.js         设置面板（浏览器半）
lib/assets/           真声台词 x5 + 终幕欢迎语 + 界面音效 x2
cordis.patch.yml      bundle 层声明
preview/index.html    离线预览页
test/                 七套冒烟测试（348 项断言，含背景音乐与本地音频路由）
README.md             完整文档
AUDIO-FIELDS.md       需要音频的字段清单（含背景音乐的谱面与强度曲线）
```

跑测试：`npm test`
