import os, urllib.request

HOST = "https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/"
AUTH = "?preview=1&auth_key=1792517155-r0-u0-dba0ecb8bce1325491df722c0fcb2be6"
keys = [
"795bf656d2b94fe088458f95ea19fc19","01afbc1ce711403ea41287cf1dbaa82a","89ab7a01bf0145efa4007a9a919d7a7b","f4bd6bc5022e40b5b38f8cfe3feaa766",
"d9036285b76f492cb6e97c12311290e5","3737a20eb1164755be3a949f4b54cf5d","6c43038912cd4b83a0b9864a242a6ea4","2ed5506056c64908a8c488c4cab175db",
"8ea51ba1f565404092c354a7f55250a6","6f89879c781c4e95b3eacb940e66a9ba","2b1c59b18aa24f9d8d5948b6f67ca3a8","c7fd6253bedb4d62abe7fa490c2eb4d2",
"204580a8a0694bfcb1c8fe0f13fbbc5c","0599b5e5982b42118727948866d4a92f","500dbf35b40d4c84a8f3dbf664e64389","c97f68423e4b4a87b92541b3449b48b4",
"1254f624482c48d997d512c5aa957aaa","1364c0ae52864361b12338107cde15b7","c15297832f2b4bae8b8bf27be2630cf5","c83b5c4f3b114aa79ac963031f546b77",
"c7f350d0a92f48c38aa1133dc216d583","0906015387ea40928d64f134a8db0acb","6ba57afb12d548d7a5965472a816119e","1fdd69f285d04f279b67081593905aca",
"bc0148f8b37d462cb5702107f3ca4c84","2e09401059624aaab4c9610052db8ef2","f18451a7b0bc455ab5a0aa66902fdc75","7907f85b1c62408eaff3a3cb2507bd55",
"db2ae447a2c64e908e41e6321e46f69c","2bd3e5c4e2d84271a032ea5b1e66ef06","48eec507df83410f874b314a5a0d894c","ed6b63d7110744c2ba9856cbfc95f8d4",
"f1f0f0c212cb43eea88435f9c68e517e","d2463cded21d4bb7b123a4dd2ecb2d2c","e75bdaae30df4e12be5792d74235472d","ba650c9c77964f9c8ad6466c2f187d72",
"49dece6078d84cb68c38fa4ab63f47e5","6ceffa0952dc40ed8af74e42c1d7a6e1","9bdc889e09ad4e628a985a4c408ba1c3","b14e1cef6dda41cda682e95f2b8d01e5",
]

out_dir = r"e:\a\6a578b50553ee2fa56364236\logs\video-frames"
os.makedirs(out_dir, exist_ok=True)

# 每张帧对应的 URL（auth_key 各不相同，这里用同一 base，实际下载逐个按 key 走）
# 注意：以上 auth_key 是第1帧的，各帧 auth_key 不同，需要完整 URL。下面重新用完整列表。

full = [
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/795bf656d2b94fe088458f95ea19fc19?preview=1&auth_key=1792517155-r0-u0-dba0ecb8bce1325491df722c0fcb2be6",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/01afbc1ce711403ea41287cf1dbaa82a?preview=1&auth_key=1792517155-r0-u0-3bbb95c9b9ce5051cb5a436fbe2c974a",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/89ab7a01bf0145efa4007a9a919d7a7b?preview=1&auth_key=1792517155-r0-u0-5e2a64d0b3aa67ee5dceaa672b04e7bd",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/f4bd6bc5022e40b5b38f8cfe3feaa766?preview=1&auth_key=1792517155-r0-u0-a8ffbc11ef2fd384b0b826f0b83ff2e0",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/d9036285b76f492cb6e97c12311290e5?preview=1&auth_key=1792517155-r0-u0-57fb152ff904da0dbede27e63562e922",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/3737a20eb1164755be3a949f4b54cf5d?preview=1&auth_key=1792517155-r0-u0-78d5f4cd66a0d509f58dcc36dba178fa",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/6c43038912cd4b83a0b9864a242a6ea4?preview=1&auth_key=1792517155-r0-u0-77efd67d3c696c152350b3837ce876db",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/2ed5506056c64908a8c488c4cab175db?preview=1&auth_key=1792517155-r0-u0-8a0beca54638873079344fc04a4e2001",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/8ea51ba1f565404092c354a7f55250a6?preview=1&auth_key=1792517155-r0-u0-fd85567e6751ec569b9013b7a2623cf8",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/6f89879c781c4e95b3eacb940e66a9ba?preview=1&auth_key=1792517155-r0-u0-550670e0227534b0f3c13e84e98ffd4e",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/2b1c59b18aa24f9d8d5948b6f67ca3a8?preview=1&auth_key=1792517155-r0-u0-5ef8a36e36f4792f5015ff58f49634d2",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/c7fd6253bedb4d62abe7fa490c2eb4d2?preview=1&auth_key=1792517155-r0-u0-f14a2826d2396570e7ef278bebf405e1",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/204580a8a0694bfcb1c8fe0f13fbbc5c?preview=1&auth_key=1792517155-r0-u0-c1b7a4762d11fe4b2a8808bc9fd3c88a",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/0599b5e5982b42118727948866d4a92f?preview=1&auth_key=1792517155-r0-u0-316d4cf769590160391dc01e203c1a17",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/500dbf35b40d4c84a8f3dbf664e64389?preview=1&auth_key=1792517155-r0-u0-2d96b103c2f772b95e1831b016680b15",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/c97f68423e4b4a87b92541b3449b48b4?preview=1&auth_key=1792517155-r0-u0-592a67d345c24817f6f35b9e70d73a5c",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/1254f624482c48d997d512c5aa957aaa?preview=1&auth_key=1792517155-r0-u0-e2f245a4f8620e1b69713999cf9011d7",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/1364c0ae52864361b12338107cde15b7?preview=1&auth_key=1792517155-r0-u0-4b5dc268bfb01ea9c6e77bc6a4e87fea",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/c15297832f2b4bae8b8bf27be2630cf5?preview=1&auth_key=1792517155-r0-u0-a99e6e56bd0e6b1ecf78a24d2d5be89c",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/c83b5c4f3b114aa79ac963031f546b77?preview=1&auth_key=1792517155-r0-u0-0602f989a200e15938d914189c632851",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/c7f350d0a92f48c38aa1133dc216d583?preview=1&auth_key=1792517155-r0-u0-2cea704d3dfa50b04a3ba3083903e1d4",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/0906015387ea40928d64f134a8db0acb?preview=1&auth_key=1792517155-r0-u0-179eadb99873f8d4d02f6fce68702f26",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/6ba57afb12d548d7a5965472a816119e?preview=1&auth_key=1792517155-r0-u0-0809a9652f7e0524b77e64b4230bb3a5",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/1fdd69f285d04f279b67081593905aca?preview=1&auth_key=1792517155-r0-u0-99cd7b082b6e5d133369d6c057f4e5eb",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/bc0148f8b37d462cb5702107f3ca4c84?preview=1&auth_key=1792517155-r0-u0-8a3f6ba070a4e6cc6502d03837e82dd7",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/2e09401059624aaab4c9610052db8ef2?preview=1&auth_key=1792517155-r0-u0-3ef70b49db8cbf3885e18746d9c122e0",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/f18451a7b0bc455ab5a0aa66902fdc75?preview=1&auth_key=1792517155-r0-u0-b8bbdf8bde51a8a2111fbe1b9ff6689a",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/7907f85b1c62408eaff3a3cb2507bd55?preview=1&auth_key=1792517155-r0-u0-bea2c60a7f389c6d46178eb5e04cc3a2",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/db2ae447a2c64e908e41e6321e46f69c?preview=1&auth_key=1792517155-r0-u0-57dd158918090cfe3e3cbc8ae9c470cb",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/2bd3e5c4e2d84271a032ea5b1e66ef06?preview=1&auth_key=1792517155-r0-u0-33eb58d1e4b8d14057e6dd74f507d6f7",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/48eec507df83410f874b314a5a0d894c?preview=1&auth_key=1792517155-r0-u0-5cae6679faf3875779fe871fe0fa3ffb",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/ed6b63d7110744c2ba9856cbfc95f8d4?preview=1&auth_key=1792517155-r0-u0-fe3de06b013f864b2ca4643049911d01",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/f1f0f0c212cb43eea88435f9c68e517e?preview=1&auth_key=1792517155-r0-u0-4b71bfdfa8271eb08e5a4d6a1f616fa7",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/d2463cded21d4bb7b123a4dd2ecb2d2c?preview=1&auth_key=1792517155-r0-u0-d786590e35406a7952d2199166233e4c",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/e75bdaae30df4e12be5792d74235472d?preview=1&auth_key=1792517155-r0-u0-f3a0ecd84e4a8f190a10e2d686cb506e",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/ba650c9c77964f9c8ad6466c2f187d72?preview=1&auth_key=1792517155-r0-u0-f4a106ef65909069c79999e0e088f15b",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/49dece6078d84cb68c38fa4ab63f47e5?preview=1&auth_key=1792517155-r0-u0-2c718d0da7ae0aaf800a7241ba63f8e6",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/6ceffa0952dc40ed8af74e42c1d7a6e1?preview=1&auth_key=1792517155-r0-u0-25668500937a6cefa00c7f3e83adc950",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/9bdc889e09ad4e628a985a4c408ba1c3?preview=1&auth_key=1792517155-r0-u0-910991a02847cb58ee417a6ac6ec5773",
"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/b14e1cef6dda41cda682e95f2b8d01e5?preview=1&auth_key=1792517155-r0-u0-2e0fadc04748c9ad101c7d7864f2fc57",
]

for i, u in enumerate(full):
    p = os.path.join(out_dir, "f%02d.jpg" % i)
    if not os.path.exists(p):
        try:
            urllib.request.urlretrieve(u, p)
            print("ok", i)
        except Exception as e:
            print("FAIL", i, e)

print("downloaded:", len(os.listdir(out_dir)))

# 拼接 contact sheet（分4张，每张10帧 2列x5行）
try:
    from PIL import Image
    frames = [os.path.join(out_dir, "f%02d.jpg" % i) for i in range(40)]
    for sheet_idx in range(4):
        subset = frames[sheet_idx*10:(sheet_idx+1)*10]
        thumbs = []
        for p in subset:
            im = Image.open(p).convert("RGB")
            im.thumbnail((640, 640))
            thumbs.append(im)
        tw = max(im.width for im in thumbs)
        th = max(im.height for im in thumbs)
        cols, rows = 2, 5
        sheet = Image.new("RGB", (cols*tw, rows*th), (0,0,0))
        for idx, im in enumerate(thumbs):
            x = (idx % cols) * tw
            y = (idx // cols) * th
            sheet.paste(im, (x + (tw-im.width)//2, y + (th-im.height)//2))
        out = os.path.join(out_dir, "sheet_%d.jpg" % sheet_idx)
        sheet.save(out, quality=88)
        print("saved", out, sheet.size)
except ImportError:
    print("PIL not available, install pillow for contact sheet")