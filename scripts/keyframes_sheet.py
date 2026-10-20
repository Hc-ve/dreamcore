# -*- coding: utf-8 -*-
import os, glob
from PIL import Image, ImageDraw

src = r"e:\a\6a578b50553ee2fa56364236\logs\keyframes"
out_dir = r"e:\a\6a578b50553ee2fa56364236\logs\keyframes_sheets"
os.makedirs(out_dir, exist_ok=True)

files = sorted(glob.glob(os.path.join(src, "t_*.jpg")),
               key=lambda p: int(os.path.basename(p)[2:-4]))
print("frames:", [os.path.basename(f) for f in files])

COLS, ROWS = 2, 4
CELL_W, CELL_H = 560, 315

def load(path, sec):
    img = Image.open(path).convert("RGB")
    img.thumbnail((CELL_W, CELL_H))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 86, 40], fill=(255, 90, 30))
    m, s = divmod(sec, 60)
    d.text((6, 6), f"{int(m)}:{int(s):02d}", fill=(255, 255, 255))
    return img

per = COLS * ROWS
for sheet_idx in range(0, len(files), per):
    batch = files[sheet_idx:sheet_idx+per]
    sheet = Image.new("RGB", (COLS*CELL_W, ROWS*CELL_H), (15, 15, 15))
    for i, fp in enumerate(batch):
        sec = int(os.path.basename(fp)[2:-4])
        r, c = divmod(i, COLS)
        sheet.paste(load(fp, sec), (c*CELL_W, r*CELL_H))
    p = os.path.join(out_dir, f"kf_{sheet_idx//per}.jpg")
    sheet.save(p, quality=88)
    print("saved", p, sheet.size)
print("done")