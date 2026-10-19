@echo off
rem ---------------------------------------------------------------
rem NOTE: do NOT add a chcp line to this file.
rem This file is saved as UTF-8. cmd.exe seeks the next line by BYTE
rem COUNT, so switching the console to codepage 65001 desyncs it on
rem lines containing multi-byte CJK chars: the following line gets
rem truncated and run as an external command, and variables vanish.
rem Verified: UTF-8 file + default console codepage renders Chinese
rem correctly and keeps variables intact.
rem Keep comments in this file ASCII-only, and never put a percent
rem sign or a double quote inside a rem line - both break parsing.
rem ---------------------------------------------------------------
setlocal enabledelayedexpansion

echo ============================================
echo   dsh-startup-secret 安装脚本
echo ============================================
echo.

rem 1. 定位本目录下的 tgz 包
set "TGZ="
for %%f in (dsh-startup-secret-*.tgz) do set "TGZ=%%~ff"
if "%TGZ%"=="" (
  echo [错误] 当前目录没有找到 dsh-startup-secret-*.tgz 安装包。
  echo        请把 tgz 和本脚本放在同一目录后重试。
  pause
  exit /b 1
)
echo 找到安装包: %TGZ%
echo.

rem 2. 定位 dsh 命令（优先 PATH，其次 DeepSeek Harness 内置 CLI）
set "DSH="
where dsh >nul 2>nul && set "DSH=dsh"
if "%DSH%"=="" (
  if exist "%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" (
    set "DSH=%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd"
  )
)
if "%DSH%"=="" (
  echo [错误] 找不到 dsh 命令。
  echo        请先安装 DeepSeek Harness，或把 dsh 加入系统 PATH。
  pause
  exit /b 1
)
echo 使用 dsh: %DSH%
echo.

rem 2.5 定位 node（用于把插件写入 dsh.profile.bundles）
set "NODE="
where node >nul 2>nul && set "NODE=node"
if "%NODE%"=="" (
  if exist "%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\bin\node.exe" (
    set "NODE=%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\bin\node.exe"
  )
)

rem 3. 询问安装到哪个 profile（web / desktop）
set "PROFILE=web"
set /p PROFILE=请输入目标 profile（web / desktop，默认 web）: 
if "%PROFILE%"=="" set "PROFILE=web"
echo.

rem 4. 若安装到 desktop，提示先退出桌面端
if /i "%PROFILE%"=="desktop" (
  echo [提示] 安装到 desktop profile 前，请先完全退出 DeepSeek Harness Desktop
  echo        （含系统托盘图标右键退出），否则写入会被覆盖。
  echo.
  pause
)

rem 5. 执行安装（pnpm add）
echo 正在安装到 %PROFILE% profile ...
"%DSH%" plugin --profile %PROFILE% add "%TGZ%"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [错误] 安装失败，退出码 %RC%。请检查上方错误信息。
  echo.
  pause
  exit /b %RC%
)

rem 6. 关键步骤：把插件加入 dsh.profile.bundles
rem    dsh plugin add 只是 pnpm add 的转发，只写 dependencies，
rem    不会把包名加入 dsh.profile.bundles。而 DSH 只有把插件列进
rem    dsh.profile.bundles 才会加载它的 cordis.patch.yml（否则完全无效果）。
rem    这里用 node 幂等地补上这一步。
if "%NODE%"=="" (
  echo.
  echo [警告] 未找到 node，跳过「写入 dsh.profile.bundles」步骤。
  echo        插件将无法自动生效。请手工打开下面文件，在 dsh.profile.bundles
  echo        数组里加入 "dsh-startup-secret" 后重启 DSH：
  echo          %%USERPROFILE%%\.dsh\profiles\%PROFILE%\package.json
  echo.
  pause
  exit /b 0
)

set "PROFILE_PKG=%USERPROFILE%\.dsh\profiles\%PROFILE%\package.json"
"%NODE%" -e "const fs=require('fs');const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,'utf8'));j.dsh=j.dsh||{};j.dsh.profile=j.dsh.profile||{};j.dsh.profile.bundles=j.dsh.profile.bundles||[];if(!j.dsh.profile.bundles.includes('dsh-startup-secret')){j.dsh.profile.bundles.push('dsh-startup-secret');fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n','utf8');console.log('已把 dsh-startup-secret 加入 dsh.profile.bundles');}else{console.log('dsh-startup-secret 已在 dsh.profile.bundles 中');}" "%PROFILE_PKG%"
set "BRC=%ERRORLEVEL%"

if not "%BRC%"=="0" (
  echo.
  echo [警告] 自动写入 dsh.profile.bundles 失败，退出码 %BRC%。
  echo        请手工打开下面文件，在 dsh.profile.bundles 数组里加入
  echo        "dsh-startup-secret" 后重启 DSH：
  echo          %PROFILE_PKG%
  echo.
  pause
  exit /b 0
)

echo.
echo ============================================
echo   安装成功！
echo   已写入: dsh.profile.bundles
echo   请重启 DSH（%PROFILE%）后刷新页面查看启动动画。
echo ============================================
echo.
pause
endlocal
