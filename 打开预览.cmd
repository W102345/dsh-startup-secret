@echo off
rem ---------------------------------------------------------------
rem NOTE: do NOT add a chcp line here - see the comment block in
rem the install script for the full explanation. Keep these
rem comments ASCII-only and free of percent signs and quotes.
rem ---------------------------------------------------------------
setlocal

echo ============================================
echo   dsh-startup-secret 离线预览
echo ============================================
echo.

rem 直接用系统默认浏览器打开本地预览页（无需启动 DSH）
if exist "preview\index.html" (
  start "" "preview\index.html"
  echo 已在默认浏览器中打开预览页。
) else (
  echo [错误] 找不到 preview\index.html
)

echo.
pause
endlocal
