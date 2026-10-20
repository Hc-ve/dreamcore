# -*- coding: utf-8 -*-
import os, glob
from PIL import Image, ImageDraw

src = r"e:\a\6a578b50553ee2fa56364236\logs\precise"
out_dir = r"e:\a\6a578b50553ee2fa56364236\logs\precise_sheets"
os.makedirs(out_dir, exist_ok=True)

files = sorted(glob.glob(os.path.join(src, "f_*.jpg")))
print("frames:", len(files))

COLS, ROWS = 5, 4
CELL_W, CELL_H = 340, 210
INTERVAL = 4  # seconds per frame

def load(path, sec):
    img = Image.open(path).convert("RGB")
    img.thumbnail((CELL_W, CELL_H))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 76, 34], fill=(255, 90, 30))
    m, s = divmod(sec, 60)
    d.text((6, 4), f"{int(m)}:{int(s):02d}", fill=(255, 255, 255))
    return img

per = COLS * ROWS
for sheet_idx in range(0, len(files), per):
    batch = files[sheet_idx:sheet_idx+per]
    sheet = Image.new("RGB", (COLS*CELL_W, ROWS*CELL_H), (18, 18, 18))
    for i, fp in enumerate(batch):
        n = int(os.path.basename(fp).split("_")[1].split(".")[0])  # 1-based
        sec = (n - 1) * INTERVAL
        r, c = divmod(i, COLS)
        sheet.paste(load(fp, sec), (c*CELL_W, r*CELL_H))
    p = os.path.join(out_dir, f"sheet_{sheet_idx//per}.jpg")
    sheet.save(p, quality=85)
    print("saved", p, sheet.size)
print("done")