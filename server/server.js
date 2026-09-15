const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { EdgeTTS } = require('node-edge-tts');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const tempDir = path.join(os.tmpdir(), 'dreamcore-edge-tts');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const VOICE_LIST = [
  {
    name: '晓晓 (Xiaoxiao) - 甜美活泼',
    shortName: 'zh-CN-XiaoxiaoNeural',
    gender: 'Female',
    language: 'zh-CN',
    style: '甜美、活泼、年轻女声，适合AI助手'
  },
  {
    name: '云希 (Yunxi) - 温暖亲切',
    shortName: 'zh-CN-YunxiNeural',
    gender: 'Male',
    language: 'zh-CN',
    style: '温暖、阳光、年轻男声'
  },
  {
    name: '晓伊 (Xiaoyi) - 温柔知性',
    shortName: 'zh-CN-XiaoyiNeural',
    gender: 'Female',
    language: 'zh-CN',
    style: '温柔、知性、成熟女声'
  },
  {
    name: '云扬 (Yunyang) - 沉稳磁性',
    shortName: 'zh-CN-YunyangNeural',
    gender: 'Male',
    language: 'zh-CN',
    style: '沉稳、磁性、新闻播报风格'
  },
  {
    name: '晓晨 (Xiaochen) - 元气少女',
    shortName: 'zh-CN-XiaochenNeural',
    gender: 'Female',
    language: 'zh-CN',
    style: '元气、活力、少女感'
  },
  {
    name: '云健 (Yunjian) - 体育解说',
    shortName: 'zh-CN-YunjianNeural',
    gender: 'Male',
    language: 'zh-CN',
    style: '有活力、体育解说风格'
  },
  {
    name: '晓秋 (Xiaoqiu) - 温柔女声',
    shortName: 'zh-CN-XiaoqiuNeural',
    gender: 'Female',
    language: 'zh-CN',
    style: '温柔、优雅、成熟女声'
  },
  {
    name: '云浩 (Yunhao) - 影视配音',
    shortName: 'zh-CN-YunhaoNeural',
    gender: 'Male',
    language: 'zh-CN',
    style: '深沉、有磁性、影视配音风格'
  },
  {
    name: '晓墨 (Xiaomo) - 知性御姐',
    shortName: 'zh-CN-XiaomoNeural',
    gender: 'Female',
    language: 'zh-CN',
    style: '知性、大方、御姐音'
  },
  {
    name: '云溪 (Yunxi) - 少年音',
    shortName: 'zh-CN-YunxiNeural',
    gender: 'Male',
    language: 'zh-CN',
    style: '少年、清澈、年轻男声'
  },
  {
    name: '辽宁-小北 (Xiaobei) - 东北话',
    shortName: 'zh-CN-liaoning-XiaobeiNeural',
    gender: 'Female',
    language: 'zh-CN-liaoning',
    style: '东北方言、活泼可爱'
  },
  {
    name: '陕西-晓妮 (Xiaoni) - 陕西话',
    shortName: 'zh-CN-shaanxi-XiaoniNeural',
    gender: 'Female',
    language: 'zh-CN-shaanxi',
    style: '陕西关中方言、亲切自然'
  },
  {
    name: '台湾-晓宇 (Xiaoyu) - 台普',
    shortName: 'zh-TW-HsiaoYuNeural',
    gender: 'Female',
    language: 'zh-TW',
    style: '台湾国语、温柔甜美'
  },
  {
    name: '香港-晓佳 (Xiaojia) - 粤语',
    shortName: 'zh-HK-HiuGaaiNeural',
    gender: 'Female',
    language: 'zh-HK',
    style: '粤语、清新自然'
  }
];

function cleanupTemp(filePath) {
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      // ignore
    }
  }, 60000);
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'dreamcore-edge-tts', timestamp: Date.now() });
});

app.get('/api/tts/voices', (req, res) => {
  const startTime = Date.now();
  try {
    const lang = req.query.lang || 'zh-CN';
    let filtered = VOICE_LIST;
    if (lang && lang !== 'all') {
      const langLower = lang.toLowerCase();
      filtered = VOICE_LIST.filter(v =>
        v.language.toLowerCase().startsWith(langLower)
      );
    }
    filtered.sort((a, b) => {
      if (a.gender === 'Female' && b.gender !== 'Female') return -1;
      if (a.gender !== 'Female' && b.gender === 'Female') return 1;
      return a.name.localeCompare(b.name, 'zh');
    });
    console.log(`[${new Date().toISOString()}] GET /api/tts/voices - ${filtered.length} voices - ${Date.now() - startTime}ms`);
    res.json({ total: filtered.length, voices: filtered });
  } catch (err) {
    console.error('获取语音列表失败:', err.message);
    res.status(500).json({ error: '获取语音列表失败', message: err.message });
  }
});

app.post('/api/tts/synthesize', async (req, res) => {
  const startTime = Date.now();
  const { text, voice, rate, pitch, volume } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text 参数不能为空' });
  }
  if (text.length > 500) {
    return res.status(400).json({ error: 'text 长度不能超过 500 字' });
  }

  const options = {};
  if (voice) options.voice = voice;
  if (rate !== undefined) options.rate = rate;
  if (pitch !== undefined) options.pitch = pitch;
  if (volume !== undefined) options.volume = volume;

  const tempFile = path.join(tempDir, `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`);

  try {
    const tts = new EdgeTTS(options);
    await tts.ttsPromise(text, tempFile);

    if (!fs.existsSync(tempFile)) {
      throw new Error('音频文件生成失败');
    }

    const fileSize = fs.statSync(tempFile).size;
    console.log(`[${new Date().toISOString()}] POST /api/tts/synthesize - "${text.slice(0, 20)}..." - ${fileSize} bytes - ${Date.now() - startTime}ms`);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');

    const stream = fs.createReadStream(tempFile);
    stream.pipe(res);
    stream.on('end', () => {
      cleanupTemp(tempFile);
    });
    stream.on('error', (err) => {
      console.error('流式传输错误:', err.message);
      cleanupTemp(tempFile);
    });
  } catch (err) {
    console.error('语音合成失败:', err.message);
    cleanupTemp(tempFile);
    res.status(500).json({ error: '语音合成失败', message: err.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║   Dreamcore Edge TTS 语音服务       ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  console.log(`  🚀 服务运行在: http://localhost:${PORT}`);
  console.log(`  💚 健康检查:   http://localhost:${PORT}/health`);
  console.log(`  🎤 语音列表:   http://localhost:${PORT}/api/tts/voices`);
  console.log('');
  console.log('  按 Ctrl+C 停止服务');
  console.log('');
});
