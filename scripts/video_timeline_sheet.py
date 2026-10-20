# -*- coding: utf-8 -*-
import io, os, sys, urllib.request
from PIL import Image, ImageDraw, ImageFont

# (second, image_url)
frames = [
(0.0,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/8e88e8da2a8245a692cae9aeae6329e9?preview=1&auth_key=1792517650-r0-u0-37f2ae4499da3b571506162b00ad7d00"),
(8.8,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/b8ae21ce00d94f19b794efc6c6a1f702?preview=1&auth_key=1792517650-r0-u0-978a6222d7b274e3fe960d8d8b382dea"),
(17.6,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/76cfafa1e5d244a58d28ac996b0ee995?preview=1&auth_key=1792517650-r0-u0-c36428562a274187ef574380614413e9"),
(26.4,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/21af8f30f30e44fda2c65027008e9dd3?preview=1&auth_key=1792517650-r0-u0-9420cf537054d7441406f47cce7a1fe8"),
(35.2,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/e1129aa41e744227a2618c9ef38d79e3?preview=1&auth_key=1792517650-r0-u0-1ba8e43568cab43a4cc6dc2d99134a66"),
(44.0,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/2d09285a3b4e4844946e8b159598ccbf?preview=1&auth_key=1792517650-r0-u0-9f05227434d4e76301891029f7a8fc4b"),
(52.8,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/d86de4c14bc944e9838c33ddaca5af6e?preview=1&auth_key=1792517650-r0-u0-96ecd0fd3d150170fced07fbc1a72e17"),
(61.6,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/263b38aab40c49bb8d055ac5fa3ee513?preview=1&auth_key=1792517650-r0-u0-75b2e7e1ddccebdc971b30038fb28c1e"),
(70.4,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/d160868a7f2546279499befdc7b54b27?preview=1&auth_key=1792517650-r0-u0-981814a86211d6623aac25a7d0e4db7b"),
(79.2,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/fa8df8b863314bfa8558145ce3631256?preview=1&auth_key=1792517650-r0-u0-6dadbe8408128f865cd30b0a67ea368a"),
(88.0,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/ceb2da109f394b48b8bb9c1e1e1d87d7?preview=1&auth_key=1792517650-r0-u0-a2bce90eff57745a4f23058b35b1837c"),
(96.8,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/0f79fe5fbf094b85a390df0db34639f1?preview=1&auth_key=1792517650-r0-u0-3d31814e5eacf6794e1f2f92d50d29d9"),
(105.6,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/997f1a7d906a41d894805cb46358ce64?preview=1&auth_key=1792517650-r0-u0-832d4ef37f47acbc2aa6f101ca0d1df0"),
(114.4,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/82223970def14c33955343ffa9180d7f?preview=1&auth_key=1792517650-r0-u0-f3780532b8ae3e63b9a92128afc8ef8d"),
(123.2,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/60dbb52da0f84cadbd9b75e40af9c97d?preview=1&auth_key=1792517650-r0-u0-834bf84fb4fb63136278e46e8a015186"),
(132.0,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/1fe8e3483d3c4f29b808334b5aec3a64?preview=1&auth_key=1792517650-r0-u0-0dcb516612a0c9c46292b8b95b13e809"),
(140.8,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/a53fffbd535c4b42ab5a3a122013cde2?preview=1&auth_key=1792517650-r0-u0-4b28db49a229d7e85c00cc671f73e31b"),
(149.6,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/85b8cc69e27e4fe0a5731826e69cf0f1?preview=1&auth_key=1792517650-r0-u0-93f7acef10cd69df8767d380814c628f"),
(158.4,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/eded99593208498caa7a9f14c49dd7f9?preview=1&auth_key=1792517650-r0-u0-fac897458c3eca83042c7258870f6022"),
(167.2,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/d3dd0bc0ea2e4fc29d52ab0faac83596?preview=1&auth_key=1792517650-r0-u0-01daf4c620fd6acd707f9730796e84e7"),
(176.0,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/b51e0ae8256b4c5aade4740c5fa646ca?preview=1&auth_key=1792517650-r0-u0-7faf03b699135e33f5c2b4ce0aa8921e"),
(184.8,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/1a7f9b2b2499474b9593040237be40b0?preview=1&auth_key=1792517650-r0-u0-ff357f50e9fc1387ff92255910e1e531"),
(193.6,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/f6e9e77b78fe4cac811d41bf9cee5d4f?preview=1&auth_key=1792517650-r0-u0-d210dc695247d968708e9ba9fd6e37f1"),
(202.4,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/da49a98d737e400a979d06304a8d0ff0?preview=1&auth_key=1792517650-r0-u0-9631ad8b6c617a5649773690b4f62e07"),
(211.2,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/5e334a4636424e6c8756a59d3f434fe4?preview=1&auth_key=1792517650-r0-u0-251a8275cbc01bfe46d9964c1dbe947a"),
(220.0,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/96e9fcab3e5b4843ad00715f0c485fd0?preview=1&auth_key=1792517650-r0-u0-206a4674eb8aa33b0c1ad7b56bb23d3c"),
(228.8,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/f1fcb8c1badf4df5aaade740f61f65fa?preview=1&auth_key=1792517650-r0-u0-55d5ca0395b37cee640261380f2a3130"),
(237.6,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/aa39c2e6405446daaae8f85a907ef4b4?preview=1&auth_key=1792517650-r0-u0-00a483abfac7069785c1a0120dcb7839"),
(246.4,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/52304b64dbb54cd48917b4a40135efbc?preview=1&auth_key=1792517650-r0-u0-0bf9381a394e184282d325e05c20c6c1"),
(255.2,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/07dcb15d4cec42f7b7dd72a31b865a1f?preview=1&auth_key=1792517650-r0-u0-09a75b99b80b508940c0a57e2025774a"),
(264.0,"https://2133220278-amk-2128889309-default-658940.vod.cn-north-1.volcvideo.com/974fe58a65c04654906fdf78e16997fe?preview=1&auth_key=1792517650-r0-u0-f80ca2750cd061fae70203b8afb0f10a"),
]

out_dir = r"e:\a\6a578b50553ee2fa56364236\logs\video-frames-timeline"
os.makedirs(out_dir, exist_ok=True)

COLS, ROWS = 4, 4
CELL_W, CELL_H = 460, 260
LABEL_H = 0  # label drawn inside

def load(idx):
    sec, url = frames[idx]
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=60).read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        print("FAIL", idx, e)
        img = Image.new("RGB", (1920, 1018), (30, 30, 30))
    # resize
    img.thumbnail((CELL_W, CELL_H))
    # label
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 90, 30], fill=(255, 110, 35))
    d.text((6, 5), f"{sec:.0f}s", fill=(255, 255, 255))
    return img

sheets = []
per = COLS * ROWS
for s in range(0, len(frames), per):
    batch = frames[s:s+per]
    sheet = Image.new("RGB", (COLS*CELL_W, ROWS*CELL_H), (20, 20, 20))
    for i in range(len(batch)):
        img = load(s + i)
        r, c = divmod(i, COLS)
        sheet.paste(img, (c*CELL_W, r*CELL_H))
    path = os.path.join(out_dir, f"ts_sheet_{s//per}.jpg")
    sheet.save(path, quality=85)
    print("saved", path, sheet.size)

print("done", len(frames), "frames")