﻿﻿﻿﻿# Dreamcore ollama 服务启动脚本（长驻，须在沙箱外执行）
# 用法：powershell -ExecutionPolicy Bypass -File E:\a\6a578b50553ee2fa56364236\training-env\start-ollama.ps1
$env:OLLAMA_MODELS = 'E:\a\6a578b50553ee2fa56364236\training-env\ollama-models'
$env:OLLAMA_KEEP_ALIVE = '12h'   # 不要加 KV 量化/FlashAttention（会拉低合规率）
$ollama = 'E:\a\6a578b50553ee2fa56364236\training-env\ollama\ollama.exe'
Start-Process -WindowStyle Hidden -FilePath $ollama -ArgumentList 'serve'
Write-Host 'ollama serve 已启动（Hidden 进程），模型目录:' $env:OLLAMA_MODELS
