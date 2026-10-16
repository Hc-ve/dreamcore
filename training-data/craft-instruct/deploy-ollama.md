# DreamCraft-1.5B 本地推理部署（竞赛演示）

> 2026-09-23 实测更新：本机已完成部署并验收通过（10/10 合规，0.4s/条）。
> ⚠️ 注意：ollama 0.34 直接导入 transformers 新版导出的 safetensors 会报
> `unsupported MLX architecture: model "Qwen2ForCausalLM"`，必须走 llama.cpp
> GGUF 转换路线（见下文第 2 步，为实测可行的完整命令）。

## 方案：ollama 本地 OpenAI 兼容服务（零成本、离线可用）

### 0. 本机已部署的产物位置

| 产物 | 路径 |
|---|---|
| ollama 便携版（免安装） | `E:\a\6a578b50553ee2fa56364236\training-env\ollama\ollama.exe` |
| 合并后完整模型（safetensors） | `training-env\models\dreamcraft-1.5b-merged\` |
| GGUF 量化版（q8_0，1.6GB） | `training-env\models\dreamcraft-1.5b-q8_0.gguf` |
| ollama Modelfile | `training-env\models\Modelfile.gguf` |
| ollama 模型存储目录 | `training-env\ollama-models\`（需环境变量 `OLLAMA_MODELS` 指向） |

### 1. 启动服务

```powershell
$env:OLLAMA_MODELS='E:\a\6a578b50553ee2fa56364236\training-env\ollama-models'
Start-Process -FilePath 'E:\a\6a578b50553ee2fa56364236\training-env\ollama\ollama.exe' -ArgumentList 'serve' -WindowStyle Hidden
# 验证：(Invoke-WebRequest http://127.0.0.1:11434/api/version).Content
```

> ⚠️ 不要用 `ollama serve | Select-Object -First N` 之类的管道——PowerShell 会在
> 取满 N 行后杀掉服务进程（实测踩坑）。

### 2. 导入模型（首次部署执行一次）

**必须走 GGUF 路线**（safetensors 直接导入有兼容 bug）：

```powershell
# ① HF → GGUF 转换（约 2 分钟，需要 gguf 包：pip install gguf --no-deps）
E:\anaconda\envs\dreamcraft\python.exe `
  "E:\a\6a578b50553ee2fa56364236\training-env\llama.cpp-master\convert_hf_to_gguf.py" `
  "E:\a\6a578b50553ee2fa56364236\training-env\models\dreamcraft-1.5b-merged" `
  --outfile "E:\a\6a578b50553ee2fa56364236\training-env\models\dreamcraft-1.5b-q8_0.gguf" `
  --outtype q8_0

# ② Modelfile 内容（training-env\models\Modelfile.gguf，已就绪）：
#    FROM ./dreamcraft-1.5b-q8_0.gguf
#    TEMPLATE 为 Qwen chat 格式（<|im_start|>...<|im_end|>）
#    PARAMETER stop "<|im_end|>" / num_ctx 4096 / temperature 0.8 / num_predict 320

# ③ 导入
Set-Location 'E:\a\6a578b50553ee2fa56364236\training-env\models'
& 'E:\a\6a578b50553ee2fa56364236\training-env\ollama\ollama.exe' create dreamcraft-1.5b -f Modelfile.gguf
# 确认：ollama list 应显示 dreamcraft-1.5b:latest 1.6GB
```

### 3. 验收

**已通过 2026-09-23 验收**：
- 直接端点验收：`training-env\ollama_accept.py`（10 条生产同款 prompt，100% 合规，0.4s/条）
- 端到端验收：`training-env\e2e_test.py`（5173 dev server → ai-proxy → ollama，
  返回 `provider: "self-trained"`，输出 JSON 全合规）

示例输出：
```json
{"title":"飞天传情·敦煌明信片","subtitle":"腾空而舞的伎乐神女，寄予千年祝福与相思","craftType":"postcard","style":"dunhuang","stickers":["🪔","🎨"]}
```

### 4. 与项目集成

模型服务就绪后，无需任何配置——`netlify/functions/ai-proxy.mjs` 的
`self-trained` provider 默认转发到 `http://127.0.0.1:11434/v1`
（可用环境变量 `SELF_TRAINED_API_BASE` 覆盖，用于云端部署场景）。

前端效果：AI 文创工作台生成成功后徽标显示"⚡ 自研微调模型 DreamCraft-1.5B"。

### 演示降级安全网

ollama 未启动时，ai-craft 生成请求会自动降级回 DashScope qwen-plus，
功能不断（这正是"自研优先、云端兜底"的双保险设计，答辩可作为讲解点）。
