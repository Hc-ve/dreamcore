# Dreamcore Edge TTS 语音后端

基于微软 Edge TTS 的本地语音合成服务，为 Dreamcore 平台 AI 助手「小梦」提供高质量的自然语音。

## 功能特性

- 🎤 **14+ 中文语音**：包含普通话、方言、粤语、台普等多种音色
- 🚀 **本地部署**：无需云端 API，无限免费使用
- 💎 **神经语音**：微软神经网络语音，自然度远超系统 TTS
- 🔄 **三级降级**：Edge TTS → 茜特菈莉 TTS → 系统 TTS
- ⚡ **流式输出**：支持音频流式传输
- 🌐 **CORS 支持**：前端可直接调用

## 快速开始

### 安装依赖

```bash
cd server
npm install
```

### 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3001`

### 修改端口

```bash
# Windows (CMD)
set PORT=4000 && npm start

# Windows (PowerShell)
$env:PORT=4000; npm start

# Linux/Mac
PORT=4000 npm start
```

## API 接口

### 1. 健康检查

```
GET /health
```

响应示例：
```json
{
  "status": "ok",
  "service": "dreamcore-edge-tts",
  "timestamp": 1234567890
}
```

### 2. 获取语音列表

```
GET /api/tts/voices?lang=zh-CN
```

参数：
- `lang` - 语言过滤（可选，默认 zh-CN，传 all 返回全部）

响应示例：
```json
{
  "total": 14,
  "voices": [
    {
      "name": "晓晓 (Xiaoxiao) - 甜美活泼",
      "shortName": "zh-CN-XiaoxiaoNeural",
      "gender": "Female",
      "language": "zh-CN",
      "style": "甜美、活泼、年轻女声，适合AI助手"
    }
  ]
}
```

### 3. 语音合成

```
POST /api/tts/synthesize
Content-Type: application/json
```

请求体：
```json
{
  "text": "你好，我是小梦",
  "voice": "zh-CN-XiaoxiaoNeural",
  "rate": "+0%",
  "pitch": "+0Hz",
  "volume": "+0%"
}
```

参数说明：
- `text` - 要合成的文本（必填，最多 500 字）
- `voice` - 语音名称（可选，默认晓晓）
- `rate` - 语速（可选，如 "+10%"、"-5%"）
- `pitch` - 音调（可选，如 "+100Hz"、"-50Hz"）
- `volume` - 音量（可选，如 "+10%"、"-5%"）

响应：`audio/mpeg` 格式的 MP3 音频流

## 内置语音列表

| 语音名称 | 标识 | 性别 | 风格 |
|---------|------|------|------|
| 晓晓 | zh-CN-XiaoxiaoNeural | 女 | 甜美、活泼、年轻女声 |
| 晓伊 | zh-CN-XiaoyiNeural | 女 | 温柔、知性、成熟女声 |
| 晓晨 | zh-CN-XiaochenNeural | 女 | 元气、活力、少女感 |
| 晓秋 | zh-CN-XiaoqiuNeural | 女 | 温柔、优雅、成熟女声 |
| 晓墨 | zh-CN-XiaomoNeural | 女 | 知性、大方、御姐音 |
| 云希 | zh-CN-YunxiNeural | 男 | 温暖、阳光、年轻男声 |
| 云扬 | zh-CN-YunyangNeural | 男 | 沉稳、磁性、新闻播报 |
| 云健 | zh-CN-YunjianNeural | 男 | 有活力、体育解说风格 |
| 云浩 | zh-CN-YunhaoNeural | 男 | 深沉、有磁性、影视配音 |
| 辽宁-小北 | zh-CN-liaoning-XiaobeiNeural | 女 | 东北方言、活泼可爱 |
| 陕西-晓妮 | zh-CN-shaanxi-XiaoniNeural | 女 | 陕西关中方言、亲切自然 |
| 台湾-晓宇 | zh-TW-HsiaoYuNeural | 女 | 台湾国语、温柔甜美 |
| 香港-晓佳 | zh-HK-HiuGaaiNeural | 女 | 粤语、清新自然 |

## 项目结构

```
server/
├── package.json    # 项目配置
├── server.js       # 主服务文件
└── README.md       # 说明文档
```

## 技术栈

- **Express 4.x** - Web 框架
- **node-edge-tts** - Edge TTS Node.js 封装
- **CORS** - 跨域支持

## 注意事项

1. 首次运行会自动创建临时目录存放音频文件，60秒后自动清理
2. 单条文本最多支持 500 字，长文本请分段合成
3. 服务仅用于本地开发，如需生产部署请添加鉴权机制
