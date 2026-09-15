@echo off
chcp 65001 >nul
title Dreamcore 一键启动

echo.
echo   ╔══════════════════════════════════════╗
echo   ║   Dreamcore 梦境艺术平台 - 一键启动   ║
echo   ╚══════════════════════════════════════╝
echo.

echo [1/2] 启动 Edge TTS 语音后端服务...
cd /d "%~dp0server"

if not exist "node_modules" (
  echo   正在安装依赖，请稍候...
  call npm install
)

start "Dreamcore Edge TTS" cmd /k "npm start"

echo [2/2] 启动前端页面服务...
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  start "Dreamcore Frontend" cmd /k "python -m http.server 8080"
  set FRONTEND_URL=http://localhost:8080
) else (
  where npx >nul 2>nul
  if %errorlevel%==0 (
    start "Dreamcore Frontend" cmd /k "npx http-server -p 8080 -c-1"
    set FRONTEND_URL=http://localhost:8080
  ) else (
    echo   未找到 Python 或 Node.js，请手动打开 index.html
    set FRONTEND_URL=文件路径
  )
)

echo.
echo   ✅ 启动完成！
echo.
echo   🌐 前端地址: %FRONTEND_URL%
echo   🔊 TTS后端:  http://localhost:3001
echo   💚 健康检查:  http://localhost:3001/health
echo.
echo   按任意键关闭此窗口（服务会继续运行）...
pause >nul
