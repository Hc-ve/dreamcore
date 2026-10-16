@echo off
REM ================================================================
REM 一键 UV 修复包装
REM 查找 Blender（PATH 或常见安装位置），调用 fix_uv.py
REM ================================================================

setlocal

REM 找 Blender 可执行文件
set BLENDER=

REM 1. 先看 PATH 里有没有
where blender >nul 2>&1
if %errorlevel% equ 0 (
    set BLENDER=blender
    goto :found
)

REM 2. 找常见安装路径
for %%P in (
    "C:\Program Files\Blender Foundation\Blender 4.4\blender.exe"
    "C:\Program Files\Blender Foundation\Blender 4.3\blender.exe"
    "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"
    "C:\Program Files\Blender Foundation\Blender 4.1\blender.exe"
    "C:\Program Files\Blender Foundation\Blender 4.0\blender.exe"
    "C:\Program Files\Blender Foundation\Blender 3.6\blender.exe"
    "C:\Program Files (x86)\Blender Foundation\Blender 4.4\blender.exe"
    "C:\Program Files (x86)\Blender Foundation\Blender 3.6\blender.exe"
) do (
    if exist %%P (
        set BLENDER=%%~P
        goto :found
    )
)

echo.
echo [ERROR] 找不到 Blender！
echo 请先安装 Blender (https://www.blender.org/download/)，然后：
echo   a) 把 blender.exe 加到 PATH，或
echo   b) 编辑本脚本开头的 BLENDER 变量，写完整路径
echo.
pause
exit /b 1

:found
echo Blender: %BLENDER%
echo.

REM 脚本路径（相对于本 bat 文件）
set SCRIPT_DIR=%~dp0
set PY_SCRIPT=%SCRIPT_DIR%fix_uv.py

if not exist "%PY_SCRIPT%" (
    echo [ERROR] 找不到 fix_uv.py，检查脚本路径
    pause
    exit /b 1
)

REM 没有参数 → 打印用法
if "%~1"=="" (
    echo 用法: fix_uv.bat ^<输入.glb^> [输出.glb] [--method lightmap^|smart] [--normalize]
    echo.
    echo 示例:
    echo   fix_uv.bat 书签.glb                       # 输出 书签_fixed.glb
    echo   fix_uv.bat 书签.glb 书签_out.glb         # 指定输出
    echo   fix_uv.bat 书签.glb --normalize          # 额外归一化尺寸
    echo   fix_uv.bat 书签.glb --method smart       # 用 Smart UV（Organic 友好）
    echo.
    pause
    exit /b 0
)

"%BLENDER%" --background --python "%PY_SCRIPT%" -- %*

echo.
pause
endlocal
