# -*- coding: utf-8 -*-
import subprocess, os

BASE = r"e:\a\6a578b50553ee2fa56364236"
ASS = os.path.join(BASE, "logs", "subtitle.ass")
BODY = os.path.join(BASE, "logs", "full_body.mp4")
FINAL = os.path.join(BASE, "竞赛材料", "路演视频-精剪版.mp4")

def ts(s):
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = s % 60
    whole = int(sec)
    cs = int(round((sec - whole) * 100))
    if cs >= 100:
        whole += 1
        cs -= 100
    return f"{h}:{m:02d}:{whole:02d}.{cs:02d}"

# 旁白字幕（修正错字/截断后的完整句 + 映射后时间）
narr = [
    (34.88, 37.62, "呼伦贝尔草原，位于内蒙古东北部，是世界四大草原之一"),
    (50.00, 51.00, "江南园林的代表作"),
    (51.00, 51.80, "占地七十八亩"),
    (51.80, 52.68, "以水为中心"),
    (52.68, 53.96, "远借北寺塔的借景手法"),
    (53.96, 55.36, "堪称中国造园史经典"),
    (55.36, 57.00, "游览指引：苏州博物馆西侧"),
    (57.00, 57.76, "拙政园地铁站"),
    (57.76, 58.78, "步行约八分钟"),
    (71.36, 72.92, "皮影人物借灯光投影于白色幕布"),
    (72.92, 73.28, "进行表演"),
    (73.28, 74.12, "的古老戏曲形式"),
    (74.12, 75.26, "配以唱腔与打击乐"),
]

# 章节提示（每段开头 4 秒，顶部）
chap = [
    (4.0, 8.0, "产品定位 · AI 遇见文旅"),
    (12.0, 16.0, "一键发布文创作品"),
    (24.0, 28.0, "AI 文化解读「光影说」"),
    (48.0, 52.0, "智慧导览 · AI 智能讲解"),
    (68.0, 72.0, "AI 文化识图 · 智能评分"),
    (84.0, 88.0, "AI 一键生成 · 智能修图"),
    (132.0, 136.0, "作品管理 · 3D 模型能力"),
]

header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1018
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Nar,Microsoft YaHei,44,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,50,50,46,1
Style: Chap,Microsoft YaHei,38,&H00356BFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,8,50,50,56,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

lines = []
for s, e, t in chap:
    lines.append(f"Dialogue: 0,{ts(s)},{ts(e)},Chap,,0,0,0,,{t}")
for s, e, t in narr:
    lines.append(f"Dialogue: 0,{ts(s)},{ts(e)},Nar,,0,0,0,,{t}")

with open(ASS, "w", encoding="utf-8") as f:
    f.write(header + "\n".join(lines) + "\n")

print("ASS written:", ASS)
print("done")