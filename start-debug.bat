@echo off
echo 🚀 Starting Chrome Extension Debug Environment...

REM 创建Chrome用户数据目录
if not exist ".chrome-profile" mkdir .chrome-profile

REM 启动Chrome with remote debugging
echo 📱 Launching Chrome with extension loaded...
start chrome ^
  --remote-debugging-port=9222 ^
  --user-data-dir="%CD%\.chrome-profile" ^
  --load-extension="%CD%" ^
  --disable-web-security ^
  --disable-features=VizDisplayCompositor ^
  chrome://extensions/

echo ✅ Chrome launched with extension loaded
echo 🔧 Remote debugging available on port 9222
echo 📖 Open DEBUG.md for debugging instructions
echo.
echo Press any key to exit...
pause >nul