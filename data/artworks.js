// data/artworks.js
// 220 个无版权艺术作品种子数据
// 图片来源：Lorem Picsum (https://picsum.photos) - 无版权
// 分类：digital-art / photography / illustration / abstract / 3d-art

const ARTWORKS_SEED_DATA = [
  // 1. digital-art
  {
    id: 1,
    title: "梦境之翼 / Dream Wings",
    description: "这幅作品探索了时间与空间的褶皱，通过绛红霞光的渐变与流动的光影，展露出细腻的情感肌理。以独特的视角诠释了梦境美学的精髓。",
    author: "林梦雨",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art001/800/600",
    likes: 39,
    views: 35300,
    createdAt: "2023-11-26"
  },

  // 2. photography
  {
    id: 2,
    title: "紫色迷雾 / Purple Mist",
    description: "这幅作品探索了宇宙与微观的呼应，通过薰衣草紫的渐变与流动的光影，营造出超现实的视觉体验。唤起观者内心深处最柔软的共鸣。",
    author: "陈墨白",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art002/800/600",
    likes: 156,
    views: 18426,
    createdAt: "2024-01-09"
  },

  // 3. illustration
  {
    id: 3,
    title: "星河倒影 / Galaxy Reflection",
    description: "这幅作品探索了潜意识与现实的边界，通过暖橘金辉的渐变与流动的光影，构筑出宁静而深邃的意境。在静谧中传递出强烈的情感张力。",
    author: "苏晚晴",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art003/800/600",
    likes: 23,
    views: 37294,
    createdAt: "2023-05-03"
  },

  // 4. abstract
  {
    id: 4,
    title: "花语低吟 / Whispering Blooms",
    description: "这幅作品探索了光影与色彩的对话，通过薄荷淡彩的渐变与流动的光影，创造出富有韵律的构图。让人在凝视中感受时间凝固的瞬间。",
    author: "顾北辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art004/800/600",
    likes: 891,
    views: 58295,
    createdAt: "2023-10-04"
  },

  // 5. 3d-art
  {
    id: 5,
    title: "光影交响 / Light Symphony",
    description: "这幅作品探索了梦境与清醒的交织，通过琥珀温润的渐变与流动的光影，打造出沉浸式的感官世界。在静谧中传递出强烈的情感张力。",
    author: "沈星河",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art005/800/600",
    likes: 878,
    views: 55220,
    createdAt: "2023-02-20"
  },

  // 6. digital-art
  {
    id: 6,
    title: "深海呢喃 / Deep Sea Whisper",
    description: "这幅作品探索了时间与空间的褶皱，通过钴蓝渐变的渐变与流动的光影，勾勒出诗意般的画面。引领观者进入一场关于美的深层探索。",
    author: "白若雪",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art006/800/600",
    likes: 495,
    views: 31460,
    createdAt: "2023-01-09"
  },

  // 7. photography
  {
    id: 7,
    title: "霓虹心脏 / Neon Heart",
    description: "这幅作品探索了流动与静止的张力，通过粉紫色调的渐变与流动的光影，编织出如梦似幻的氛围。将瞬间的感动凝固为永恒的画面。",
    author: "江月明",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art007/800/600",
    likes: 884,
    views: 8909,
    createdAt: "2023-10-11"
  },

  // 8. illustration
  {
    id: 8,
    title: "破碎星辰 / Shattered Stars",
    description: "这幅作品探索了自然与科技的融合，通过暖橘金辉的渐变与流动的光影，构建出一个令人沉醉的梦境空间。每一处细节都诉说着关于存在与虚无的思考。",
    author: "宋清欢",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art008/800/600",
    likes: 713,
    views: 83457,
    createdAt: "2023-01-10"
  },

  // 9. abstract
  {
    id: 9,
    title: "液态银河 / Liquid Galaxy",
    description: "这幅作品探索了光影与色彩的对话，通过靛青深邃的渐变与流动的光影，打造出沉浸式的感官世界。让人在凝视中感受时间凝固的瞬间。",
    author: "周慕辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art009/800/600",
    likes: 717,
    views: 47595,
    createdAt: "2023-06-06"
  },

  // 10. 3d-art
  {
    id: 10,
    title: "蝴蝶效应 / Butterfly Effect",
    description: "这幅作品探索了具象与抽象的转换，通过薄荷淡彩的渐变与流动的光影，构筑出宁静而深邃的意境。引领观者进入一场关于美的深层探索。",
    author: "韩雨桐",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art010/800/600",
    likes: 929,
    views: 78617,
    createdAt: "2023-10-16"
  },

  // 11. digital-art
  {
    id: 11,
    title: "晨曦微光 / Dawn Glimmer",
    description: "这幅作品探索了梦境与清醒的交织，通过粉紫色调的渐变与流动的光影，营造出超现实的视觉体验。以独特的视角诠释了梦境美学的精髓。",
    author: "李清风",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art011/800/600",
    likes: 573,
    views: 94812,
    createdAt: "2023-07-09"
  },

  // 12. photography
  {
    id: 12,
    title: "镜中幻境 / Mirror Mirage",
    description: "这幅作品探索了自然与科技的融合，通过翠绿流光的渐变与流动的光影，营造出超现实的视觉体验。在虚与实之间留下无尽的想象空间。",
    author: "吴映雪",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art012/800/600",
    likes: 604,
    views: 77374,
    createdAt: "2024-05-19"
  },

  // 13. illustration
  {
    id: 13,
    title: "燃烧的云 / Burning Clouds",
    description: "这幅作品探索了情感与记忆的沉淀，通过暖橘金辉的渐变与流动的光影，营造出超现实的视觉体验。唤起观者内心深处最柔软的共鸣。",
    author: "张云深",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art013/800/600",
    likes: 945,
    views: 59293,
    createdAt: "2023-08-20"
  },

  // 14. abstract
  {
    id: 14,
    title: "雨后初晴 / After the Rain",
    description: "这幅作品探索了情感与记忆的沉淀，通过翠绿流光的渐变与流动的光影，塑造出独特的视觉语言。每一处细节都诉说着关于存在与虚无的思考。",
    author: "黄思远",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art014/800/600",
    likes: 376,
    views: 80962,
    createdAt: "2024-06-14"
  },

  // 15. 3d-art
  {
    id: 15,
    title: "时间褶皱 / Folds of Time",
    description: "这幅作品探索了情感与记忆的沉淀，通过靛青深邃的渐变与流动的光影，塑造出独特的视觉语言。引领观者进入一场关于美的深层探索。",
    author: "徐若曦",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art015/800/600",
    likes: 75,
    views: 12571,
    createdAt: "2023-09-21"
  },

  // 16. digital-art
  {
    id: 16,
    title: "午夜花园 / Midnight Garden",
    description: "这幅作品探索了流动与静止的张力，通过薰衣草紫的渐变与流动的光影，构筑出宁静而深邃的意境。在静谧中传递出强烈的情感张力。",
    author: "何慕言",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art016/800/600",
    likes: 848,
    views: 42513,
    createdAt: "2023-02-21"
  },

  // 17. photography
  {
    id: 17,
    title: "光的轨迹 / Trail of Light",
    description: "这幅作品探索了自然与科技的融合，通过琥珀温润的渐变与流动的光影，勾勒出诗意般的画面。让人在凝视中感受时间凝固的瞬间。",
    author: "罗星尘",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art017/800/600",
    likes: 39,
    views: 33580,
    createdAt: "2023-08-30"
  },

  // 18. illustration
  {
    id: 18,
    title: "蓝色梦境 / Blue Reverie",
    description: "这幅作品探索了流动与静止的张力，通过薰衣草紫的渐变与流动的光影，塑造出独特的视觉语言。将瞬间的感动凝固为永恒的画面。",
    author: "高雪见",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art018/800/600",
    likes: 40,
    views: 44662,
    createdAt: "2023-04-13"
  },

  // 19. abstract
  {
    id: 19,
    title: "樱花絮语 / Sakura Whispers",
    description: "这幅作品探索了光影与色彩的对话，通过绛红霞光的渐变与流动的光影，勾勒出诗意般的画面。将瞬间的感动凝固为永恒的画面。",
    author: "钱书瑶",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art019/800/600",
    likes: 554,
    views: 19952,
    createdAt: "2024-02-21"
  },

  // 20. 3d-art
  {
    id: 20,
    title: "迷雾森林 / Misty Forest",
    description: "这幅作品探索了时间与空间的褶皱，通过薄荷淡彩的渐变与流动的光影，构建出一个令人沉醉的梦境空间。在虚与实之间留下无尽的想象空间。",
    author: "孙听澜",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art020/800/600",
    likes: 473,
    views: 44242,
    createdAt: "2024-12-21"
  },

  // 21. digital-art
  {
    id: 21,
    title: "极光之舞 / Aurora Dance",
    description: "这幅作品探索了潜意识与现实的边界，通过薄荷淡彩的渐变与流动的光影，构建出一个令人沉醉的梦境空间。让人在凝视中感受时间凝固的瞬间。",
    author: "林梦雨",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art021/800/600",
    likes: 418,
    views: 65422,
    createdAt: "2024-11-20"
  },

  // 22. photography
  {
    id: 22,
    title: "水晶之心 / Crystal Heart",
    description: "这幅作品探索了梦境与清醒的交织，通过琥珀温润的渐变与流动的光影，构筑出宁静而深邃的意境。让光影成为情感最忠实的表达载体。",
    author: "陈墨白",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art022/800/600",
    likes: 978,
    views: 83185,
    createdAt: "2024-06-20"
  },

  // 23. illustration
  {
    id: 23,
    title: "悬浮岛屿 / Floating Islands",
    description: "这幅作品探索了具象与抽象的转换，通过靛青深邃的渐变与流动的光影，构建出一个令人沉醉的梦境空间。让人在凝视中感受时间凝固的瞬间。",
    author: "苏晚晴",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art023/800/600",
    likes: 600,
    views: 4722,
    createdAt: "2024-03-24"
  },

  // 24. abstract
  {
    id: 24,
    title: "记忆碎片 / Memory Fragments",
    description: "这幅作品探索了光影与色彩的对话，通过翠绿流光的渐变与流动的光影，构筑出宁静而深邃的意境。将瞬间的感动凝固为永恒的画面。",
    author: "顾北辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art024/800/600",
    likes: 131,
    views: 66526,
    createdAt: "2024-05-19"
  },

  // 25. 3d-art
  {
    id: 25,
    title: "霓虹丛林 / Neon Jungle",
    description: "这幅作品探索了光影与色彩的对话，通过薰衣草紫的渐变与流动的光影，营造出超现实的视觉体验。引领观者进入一场关于美的深层探索。",
    author: "沈星河",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art025/800/600",
    likes: 44,
    views: 24087,
    createdAt: "2023-12-17"
  },

  // 26. digital-art
  {
    id: 26,
    title: "月下独舞 / Moonlit Solo",
    description: "这幅作品探索了情感与记忆的沉淀，通过靛青深邃的渐变与流动的光影，构筑出宁静而深邃的意境。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "白若雪",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art026/800/600",
    likes: 339,
    views: 6597,
    createdAt: "2023-04-04"
  },

  // 27. photography
  {
    id: 27,
    title: "色彩漩涡 / Color Vortex",
    description: "这幅作品探索了自然与科技的融合，通过钴蓝渐变的渐变与流动的光影，构建出一个令人沉醉的梦境空间。引领观者进入一场关于美的深层探索。",
    author: "江月明",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art027/800/600",
    likes: 89,
    views: 39648,
    createdAt: "2023-08-05"
  },

  // 28. illustration
  {
    id: 28,
    title: "风的形状 / Shape of Wind",
    description: "这幅作品探索了时间与空间的褶皱，通过琥珀温润的渐变与流动的光影，编织出如梦似幻的氛围。让光影成为情感最忠实的表达载体。",
    author: "宋清欢",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art028/800/600",
    likes: 657,
    views: 34132,
    createdAt: "2024-06-12"
  },

  // 29. abstract
  {
    id: 29,
    title: "光与影的对话 / Dialogue of Light and Shadow",
    description: "这幅作品探索了光影与色彩的对话，通过绛红霞光的渐变与流动的光影，创造出富有韵律的构图。让人在凝视中感受时间凝固的瞬间。",
    author: "周慕辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art029/800/600",
    likes: 600,
    views: 41540,
    createdAt: "2023-11-21"
  },

  // 30. 3d-art
  {
    id: 30,
    title: "宇宙尘埃 / Cosmic Dust",
    description: "这幅作品探索了潜意识与现实的边界，通过琥珀温润的渐变与流动的光影，编织出如梦似幻的氛围。在静谧中传递出强烈的情感张力。",
    author: "韩雨桐",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art030/800/600",
    likes: 212,
    views: 76364,
    createdAt: "2024-05-09"
  },

  // 31. digital-art
  {
    id: 31,
    title: "玫瑰星云 / Rose Nebula",
    description: "这幅作品探索了流动与静止的张力，通过钴蓝渐变的渐变与流动的光影，构建出一个令人沉醉的梦境空间。在静谧中传递出强烈的情感张力。",
    author: "李清风",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art031/800/600",
    likes: 741,
    views: 5096,
    createdAt: "2023-10-06"
  },

  // 32. photography
  {
    id: 32,
    title: "海底秘境 / Underwater Secret",
    description: "这幅作品探索了喧嚣与宁静的对比，通过暖橘金辉的渐变与流动的光影，编织出如梦似幻的氛围。以独特的视角诠释了梦境美学的精髓。",
    author: "吴映雪",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art032/800/600",
    likes: 306,
    views: 1327,
    createdAt: "2023-12-17"
  },

  // 33. illustration
  {
    id: 33,
    title: "日落余晖 / Sunset Afterglow",
    description: "这幅作品探索了情感与记忆的沉淀，通过绛红霞光的渐变与流动的光影，构建出一个令人沉醉的梦境空间。以独特的视角诠释了梦境美学的精髓。",
    author: "张云深",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art033/800/600",
    likes: 415,
    views: 68449,
    createdAt: "2024-07-01"
  },

  // 34. abstract
  {
    id: 34,
    title: "晨雾轻纱 / Morning Veil",
    description: "这幅作品探索了喧嚣与宁静的对比，通过粉紫色调的渐变与流动的光影，创造出富有韵律的构图。在虚与实之间留下无尽的想象空间。",
    author: "黄思远",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art034/800/600",
    likes: 216,
    views: 28554,
    createdAt: "2023-09-28"
  },

  // 35. 3d-art
  {
    id: 35,
    title: "星光漫步 / Starlight Stroll",
    description: "这幅作品探索了宇宙与微观的呼应，通过琥珀温润的渐变与流动的光影，展露出细腻的情感肌理。引领观者进入一场关于美的深层探索。",
    author: "徐若曦",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art035/800/600",
    likes: 369,
    views: 77432,
    createdAt: "2023-04-23"
  },

  // 36. digital-art
  {
    id: 36,
    title: "幻影之城 / Phantom City",
    description: "这幅作品探索了情感与记忆的沉淀，通过玫瑰金辉的渐变与流动的光影，塑造出独特的视觉语言。引领观者进入一场关于美的深层探索。",
    author: "何慕言",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art036/800/600",
    likes: 615,
    views: 7577,
    createdAt: "2023-11-11"
  },

  // 37. photography
  {
    id: 37,
    title: "繁花似锦 / Blossom Tapestry",
    description: "这幅作品探索了潜意识与现实的边界，通过翠绿流光的渐变与流动的光影，塑造出独特的视觉语言。让人在凝视中感受时间凝固的瞬间。",
    author: "罗星尘",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art037/800/600",
    likes: 987,
    views: 96180,
    createdAt: "2024-03-18"
  },

  // 38. illustration
  {
    id: 38,
    title: "冰封时刻 / Frozen Moment",
    description: "这幅作品探索了光影与色彩的对话，通过暖橘金辉的渐变与流动的光影，构筑出宁静而深邃的意境。让人在凝视中感受时间凝固的瞬间。",
    author: "高雪见",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art038/800/600",
    likes: 707,
    views: 61732,
    createdAt: "2023-10-05"
  },

  // 39. abstract
  {
    id: 39,
    title: "梦境碎片 / Dream Fragments",
    description: "这幅作品探索了潜意识与现实的边界，通过琥珀温润的渐变与流动的光影，营造出超现实的视觉体验。在虚与实之间留下无尽的想象空间。",
    author: "钱书瑶",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art039/800/600",
    likes: 731,
    views: 85225,
    createdAt: "2024-04-10"
  },

  // 40. 3d-art
  {
    id: 40,
    title: "光之回廊 / Corridor of Light",
    description: "这幅作品探索了潜意识与现实的边界，通过薰衣草紫的渐变与流动的光影，营造出超现实的视觉体验。让人在凝视中感受时间凝固的瞬间。",
    author: "孙听澜",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art040/800/600",
    likes: 982,
    views: 99750,
    createdAt: "2023-01-06"
  },

  // 41. digital-art
  {
    id: 41,
    title: "墨色山水 / Ink Landscape",
    description: "这幅作品探索了情感与记忆的沉淀，通过暖橘金辉的渐变与流动的光影，塑造出独特的视觉语言。每一处细节都诉说着关于存在与虚无的思考。",
    author: "林梦雨",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art041/800/600",
    likes: 240,
    views: 45800,
    createdAt: "2023-02-25"
  },

  // 42. photography
  {
    id: 42,
    title: "流光溢彩 / Flowing Radiance",
    description: "这幅作品探索了潜意识与现实的边界，通过绛红霞光的渐变与流动的光影，塑造出独特的视觉语言。唤起观者内心深处最柔软的共鸣。",
    author: "陈墨白",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art042/800/600",
    likes: 678,
    views: 93266,
    createdAt: "2023-07-29"
  },

  // 43. illustration
  {
    id: 43,
    title: "夜空烟火 / Night Sky Fireworks",
    description: "这幅作品探索了宇宙与微观的呼应，通过琥珀温润的渐变与流动的光影，呈现出迷人的光影层次。在虚与实之间留下无尽的想象空间。",
    author: "苏晚晴",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art043/800/600",
    likes: 117,
    views: 30939,
    createdAt: "2023-12-23"
  },

  // 44. abstract
  {
    id: 44,
    title: "晨露未晞 / Morning Dew",
    description: "这幅作品探索了情感与记忆的沉淀，通过玫瑰金辉的渐变与流动的光影，创造出富有韵律的构图。在虚与实之间留下无尽的想象空间。",
    author: "顾北辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art044/800/600",
    likes: 877,
    views: 21312,
    createdAt: "2023-04-27"
  },

  // 45. 3d-art
  {
    id: 45,
    title: "云海翻涌 / Rolling Cloud Sea",
    description: "这幅作品探索了光影与色彩的对话，通过薄荷淡彩的渐变与流动的光影，创造出富有韵律的构图。引领观者进入一场关于美的深层探索。",
    author: "沈星河",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art045/800/600",
    likes: 374,
    views: 23376,
    createdAt: "2023-08-04"
  },

  // 46. digital-art
  {
    id: 46,
    title: "玻璃花园 / Glass Garden",
    description: "这幅作品探索了喧嚣与宁静的对比，通过薰衣草紫的渐变与流动的光影，构筑出宁静而深邃的意境。让人在凝视中感受时间凝固的瞬间。",
    author: "白若雪",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art046/800/600",
    likes: 301,
    views: 81222,
    createdAt: "2024-12-07"
  },

  // 47. photography
  {
    id: 47,
    title: "彩虹尽头 / End of Rainbow",
    description: "这幅作品探索了梦境与清醒的交织，通过玫瑰金辉的渐变与流动的光影，打造出沉浸式的感官世界。唤起观者内心深处最柔软的共鸣。",
    author: "江月明",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art047/800/600",
    likes: 544,
    views: 79843,
    createdAt: "2024-02-03"
  },

  // 48. illustration
  {
    id: 48,
    title: "银河铁道 / Galaxy Railway",
    description: "这幅作品探索了流动与静止的张力，通过暖橘金辉的渐变与流动的光影，创造出富有韵律的构图。让光影成为情感最忠实的表达载体。",
    author: "宋清欢",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art048/800/600",
    likes: 731,
    views: 67029,
    createdAt: "2024-02-27"
  },

  // 49. abstract
  {
    id: 49,
    title: "光影迷宫 / Light Maze",
    description: "这幅作品探索了流动与静止的张力，通过粉紫色调的渐变与流动的光影，构筑出宁静而深邃的意境。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "周慕辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art049/800/600",
    likes: 455,
    views: 42473,
    createdAt: "2023-09-22"
  },

  // 50. 3d-art
  {
    id: 50,
    title: "永恒瞬间 / Eternal Moment",
    description: "这幅作品探索了自然与科技的融合，通过钴蓝渐变的渐变与流动的光影，勾勒出诗意般的画面。让人在凝视中感受时间凝固的瞬间。",
    author: "韩雨桐",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art050/800/600",
    likes: 153,
    views: 13267,
    createdAt: "2023-04-21"
  },

  // 51. digital-art
  {
    id: 51,
    title: "静谧港湾 / Tranquil Harbor",
    description: "这幅作品探索了时间与空间的褶皱，通过暖橘金辉的渐变与流动的光影，打造出沉浸式的感官世界。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "李清风",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art051/800/600",
    likes: 672,
    views: 16102,
    createdAt: "2023-02-09"
  },

  // 52. photography
  {
    id: 52,
    title: "星尘记忆 / Stardust Memory",
    description: "这幅作品探索了潜意识与现实的边界，通过钴蓝渐变的渐变与流动的光影，塑造出独特的视觉语言。引领观者进入一场关于美的深层探索。",
    author: "吴映雪",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art052/800/600",
    likes: 496,
    views: 6269,
    createdAt: "2024-03-04"
  },

  // 53. illustration
  {
    id: 53,
    title: "雾中风景 / Landscape in Mist",
    description: "这幅作品探索了喧嚣与宁静的对比，通过琥珀温润的渐变与流动的光影，打造出沉浸式的感官世界。在静谧中传递出强烈的情感张力。",
    author: "张云深",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art053/800/600",
    likes: 617,
    views: 13060,
    createdAt: "2024-10-14"
  },

  // 54. abstract
  {
    id: 54,
    title: "光之诗篇 / Poem of Light",
    description: "这幅作品探索了光影与色彩的对话，通过靛青深邃的渐变与流动的光影，编织出如梦似幻的氛围。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "黄思远",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art054/800/600",
    likes: 112,
    views: 62068,
    createdAt: "2024-04-11"
  },

  // 55. 3d-art
  {
    id: 55,
    title: "梦境之翼 / Dream Wings No.2",
    description: "这幅作品探索了流动与静止的张力，通过钴蓝渐变的渐变与流动的光影，呈现出迷人的光影层次。让光影成为情感最忠实的表达载体。",
    author: "徐若曦",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art055/800/600",
    likes: 341,
    views: 64183,
    createdAt: "2024-02-13"
  },

  // 56. digital-art
  {
    id: 56,
    title: "紫色迷雾 / Purple Mist No.2",
    description: "这幅作品探索了具象与抽象的转换，通过玫瑰金辉的渐变与流动的光影，创造出富有韵律的构图。引领观者进入一场关于美的深层探索。",
    author: "何慕言",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art056/800/600",
    likes: 858,
    views: 70897,
    createdAt: "2024-05-18"
  },

  // 57. photography
  {
    id: 57,
    title: "星河倒影 / Galaxy Reflection No.2",
    description: "这幅作品探索了喧嚣与宁静的对比，通过薰衣草紫的渐变与流动的光影，构建出一个令人沉醉的梦境空间。唤起观者内心深处最柔软的共鸣。",
    author: "罗星尘",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art057/800/600",
    likes: 960,
    views: 96702,
    createdAt: "2023-07-01"
  },

  // 58. illustration
  {
    id: 58,
    title: "花语低吟 / Whispering Blooms No.2",
    description: "这幅作品探索了流动与静止的张力，通过粉紫色调的渐变与流动的光影，勾勒出诗意般的画面。唤起观者内心深处最柔软的共鸣。",
    author: "高雪见",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art058/800/600",
    likes: 902,
    views: 8090,
    createdAt: "2023-05-24"
  },

  // 59. abstract
  {
    id: 59,
    title: "光影交响 / Light Symphony No.2",
    description: "这幅作品探索了梦境与清醒的交织，通过玫瑰金辉的渐变与流动的光影，营造出超现实的视觉体验。让光影成为情感最忠实的表达载体。",
    author: "钱书瑶",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art059/800/600",
    likes: 792,
    views: 78553,
    createdAt: "2023-11-29"
  },

  // 60. 3d-art
  {
    id: 60,
    title: "深海呢喃 / Deep Sea Whisper No.2",
    description: "这幅作品探索了宇宙与微观的呼应，通过靛青深邃的渐变与流动的光影，构建出一个令人沉醉的梦境空间。以独特的视角诠释了梦境美学的精髓。",
    author: "孙听澜",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art060/800/600",
    likes: 147,
    views: 11781,
    createdAt: "2024-08-07"
  },

  // 61. digital-art
  {
    id: 61,
    title: "霓虹心脏 / Neon Heart No.2",
    description: "这幅作品探索了喧嚣与宁静的对比，通过薄荷淡彩的渐变与流动的光影，营造出超现实的视觉体验。唤起观者内心深处最柔软的共鸣。",
    author: "林梦雨",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art061/800/600",
    likes: 107,
    views: 29467,
    createdAt: "2023-10-30"
  },

  // 62. photography
  {
    id: 62,
    title: "破碎星辰 / Shattered Stars No.2",
    description: "这幅作品探索了情感与记忆的沉淀，通过琥珀温润的渐变与流动的光影，编织出如梦似幻的氛围。以独特的视角诠释了梦境美学的精髓。",
    author: "陈墨白",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art062/800/600",
    likes: 337,
    views: 27702,
    createdAt: "2023-03-20"
  },

  // 63. illustration
  {
    id: 63,
    title: "液态银河 / Liquid Galaxy No.2",
    description: "这幅作品探索了梦境与清醒的交织，通过钴蓝渐变的渐变与流动的光影，打造出沉浸式的感官世界。让人在凝视中感受时间凝固的瞬间。",
    author: "苏晚晴",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art063/800/600",
    likes: 576,
    views: 98678,
    createdAt: "2023-06-04"
  },

  // 64. abstract
  {
    id: 64,
    title: "蝴蝶效应 / Butterfly Effect No.2",
    description: "这幅作品探索了自然与科技的融合，通过薰衣草紫的渐变与流动的光影，打造出沉浸式的感官世界。唤起观者内心深处最柔软的共鸣。",
    author: "顾北辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art064/800/600",
    likes: 858,
    views: 20087,
    createdAt: "2023-04-05"
  },

  // 65. 3d-art
  {
    id: 65,
    title: "晨曦微光 / Dawn Glimmer No.2",
    description: "这幅作品探索了潜意识与现实的边界，通过薰衣草紫的渐变与流动的光影，展露出细腻的情感肌理。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "沈星河",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art065/800/600",
    likes: 405,
    views: 9920,
    createdAt: "2024-02-15"
  },

  // 66. digital-art
  {
    id: 66,
    title: "镜中幻境 / Mirror Mirage No.2",
    description: "这幅作品探索了时间与空间的褶皱，通过薄荷淡彩的渐变与流动的光影，构筑出宁静而深邃的意境。每一处细节都诉说着关于存在与虚无的思考。",
    author: "白若雪",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art066/800/600",
    likes: 173,
    views: 49369,
    createdAt: "2023-10-18"
  },

  // 67. photography
  {
    id: 67,
    title: "燃烧的云 / Burning Clouds No.2",
    description: "这幅作品探索了流动与静止的张力，通过玫瑰金辉的渐变与流动的光影，创造出富有韵律的构图。唤起观者内心深处最柔软的共鸣。",
    author: "江月明",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art067/800/600",
    likes: 85,
    views: 71526,
    createdAt: "2023-07-09"
  },

  // 68. illustration
  {
    id: 68,
    title: "雨后初晴 / After the Rain No.2",
    description: "这幅作品探索了宇宙与微观的呼应，通过薰衣草紫的渐变与流动的光影，构筑出宁静而深邃的意境。唤起观者内心深处最柔软的共鸣。",
    author: "宋清欢",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art068/800/600",
    likes: 913,
    views: 16882,
    createdAt: "2024-06-22"
  },

  // 69. abstract
  {
    id: 69,
    title: "时间褶皱 / Folds of Time No.2",
    description: "这幅作品探索了自然与科技的融合，通过粉紫色调的渐变与流动的光影，塑造出独特的视觉语言。引领观者进入一场关于美的深层探索。",
    author: "周慕辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art069/800/600",
    likes: 846,
    views: 55329,
    createdAt: "2023-07-21"
  },

  // 70. 3d-art
  {
    id: 70,
    title: "午夜花园 / Midnight Garden No.2",
    description: "这幅作品探索了梦境与清醒的交织，通过钴蓝渐变的渐变与流动的光影，勾勒出诗意般的画面。唤起观者内心深处最柔软的共鸣。",
    author: "韩雨桐",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art070/800/600",
    likes: 693,
    views: 75559,
    createdAt: "2024-06-09"
  },

  // 71. digital-art
  {
    id: 71,
    title: "光的轨迹 / Trail of Light No.2",
    description: "这幅作品探索了梦境与清醒的交织，通过薄荷淡彩的渐变与流动的光影，展露出细腻的情感肌理。在静谧中传递出强烈的情感张力。",
    author: "李清风",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art071/800/600",
    likes: 782,
    views: 40263,
    createdAt: "2024-02-06"
  },

  // 72. photography
  {
    id: 72,
    title: "蓝色梦境 / Blue Reverie No.2",
    description: "这幅作品探索了具象与抽象的转换，通过钴蓝渐变的渐变与流动的光影，勾勒出诗意般的画面。唤起观者内心深处最柔软的共鸣。",
    author: "吴映雪",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art072/800/600",
    likes: 521,
    views: 8333,
    createdAt: "2024-07-10"
  },

  // 73. illustration
  {
    id: 73,
    title: "樱花絮语 / Sakura Whispers No.2",
    description: "这幅作品探索了自然与科技的融合，通过薰衣草紫的渐变与流动的光影，展露出细腻的情感肌理。在静谧中传递出强烈的情感张力。",
    author: "张云深",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art073/800/600",
    likes: 607,
    views: 23860,
    createdAt: "2023-11-10"
  },

  // 74. abstract
  {
    id: 74,
    title: "迷雾森林 / Misty Forest No.2",
    description: "这幅作品探索了时间与空间的褶皱，通过钴蓝渐变的渐变与流动的光影，打造出沉浸式的感官世界。在静谧中传递出强烈的情感张力。",
    author: "黄思远",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art074/800/600",
    likes: 926,
    views: 71737,
    createdAt: "2024-10-30"
  },

  // 75. 3d-art
  {
    id: 75,
    title: "极光之舞 / Aurora Dance No.2",
    description: "这幅作品探索了具象与抽象的转换，通过粉紫色调的渐变与流动的光影，构筑出宁静而深邃的意境。每一处细节都诉说着关于存在与虚无的思考。",
    author: "徐若曦",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art075/800/600",
    likes: 112,
    views: 99855,
    createdAt: "2024-07-20"
  },

  // 76. digital-art
  {
    id: 76,
    title: "水晶之心 / Crystal Heart No.2",
    description: "这幅作品探索了时间与空间的褶皱，通过粉紫色调的渐变与流动的光影，勾勒出诗意般的画面。在虚与实之间留下无尽的想象空间。",
    author: "何慕言",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art076/800/600",
    likes: 740,
    views: 8006,
    createdAt: "2023-08-09"
  },

  // 77. photography
  {
    id: 77,
    title: "悬浮岛屿 / Floating Islands No.2",
    description: "这幅作品探索了宇宙与微观的呼应，通过暖橘金辉的渐变与流动的光影，塑造出独特的视觉语言。在静谧中传递出强烈的情感张力。",
    author: "罗星尘",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art077/800/600",
    likes: 266,
    views: 3080,
    createdAt: "2024-07-01"
  },

  // 78. illustration
  {
    id: 78,
    title: "记忆碎片 / Memory Fragments No.2",
    description: "这幅作品探索了光影与色彩的对话，通过绛红霞光的渐变与流动的光影，塑造出独特的视觉语言。唤起观者内心深处最柔软的共鸣。",
    author: "高雪见",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art078/800/600",
    likes: 529,
    views: 21871,
    createdAt: "2023-06-17"
  },

  // 79. abstract
  {
    id: 79,
    title: "霓虹丛林 / Neon Jungle No.2",
    description: "这幅作品探索了光影与色彩的对话，通过翠绿流光的渐变与流动的光影，呈现出迷人的光影层次。每一处细节都诉说着关于存在与虚无的思考。",
    author: "钱书瑶",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art079/800/600",
    likes: 14,
    views: 19670,
    createdAt: "2023-07-06"
  },

  // 80. 3d-art
  {
    id: 80,
    title: "月下独舞 / Moonlit Solo No.2",
    description: "这幅作品探索了时间与空间的褶皱，通过薰衣草紫的渐变与流动的光影，营造出超现实的视觉体验。在静谧中传递出强烈的情感张力。",
    author: "孙听澜",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art080/800/600",
    likes: 709,
    views: 25767,
    createdAt: "2024-12-10"
  },

  // 81. digital-art
  {
    id: 81,
    title: "色彩漩涡 / Color Vortex No.2",
    description: "这幅作品探索了喧嚣与宁静的对比，通过绛红霞光的渐变与流动的光影，展露出细腻的情感肌理。每一处细节都诉说着关于存在与虚无的思考。",
    author: "林梦雨",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art081/800/600",
    likes: 695,
    views: 65756,
    createdAt: "2023-02-01"
  },

  // 82. photography
  {
    id: 82,
    title: "风的形状 / Shape of Wind No.2",
    description: "这幅作品探索了宇宙与微观的呼应，通过琥珀温润的渐变与流动的光影，创造出富有韵律的构图。让光影成为情感最忠实的表达载体。",
    author: "陈墨白",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art082/800/600",
    likes: 336,
    views: 50527,
    createdAt: "2023-06-01"
  },

  // 83. illustration
  {
    id: 83,
    title: "光与影的对话 / Dialogue of Light and Shadow No.2",
    description: "这幅作品探索了具象与抽象的转换，通过粉紫色调的渐变与流动的光影，勾勒出诗意般的画面。引领观者进入一场关于美的深层探索。",
    author: "苏晚晴",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art083/800/600",
    likes: 183,
    views: 31573,
    createdAt: "2023-12-29"
  },

  // 84. abstract
  {
    id: 84,
    title: "宇宙尘埃 / Cosmic Dust No.2",
    description: "这幅作品探索了喧嚣与宁静的对比，通过琥珀温润的渐变与流动的光影，构筑出宁静而深邃的意境。在静谧中传递出强烈的情感张力。",
    author: "顾北辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art084/800/600",
    likes: 527,
    views: 23385,
    createdAt: "2023-04-07"
  },

  // 85. 3d-art
  {
    id: 85,
    title: "玫瑰星云 / Rose Nebula No.2",
    description: "这幅作品探索了宇宙与微观的呼应，通过绛红霞光的渐变与流动的光影，塑造出独特的视觉语言。每一处细节都诉说着关于存在与虚无的思考。",
    author: "沈星河",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art085/800/600",
    likes: 628,
    views: 92254,
    createdAt: "2023-02-23"
  },

  // 86. digital-art
  {
    id: 86,
    title: "海底秘境 / Underwater Secret No.2",
    description: "这幅作品探索了具象与抽象的转换，通过薄荷淡彩的渐变与流动的光影，塑造出独特的视觉语言。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "白若雪",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art086/800/600",
    likes: 594,
    views: 12172,
    createdAt: "2023-06-26"
  },

  // 87. photography
  {
    id: 87,
    title: "日落余晖 / Sunset Afterglow No.2",
    description: "这幅作品探索了潜意识与现实的边界，通过薄荷淡彩的渐变与流动的光影，创造出富有韵律的构图。在静谧中传递出强烈的情感张力。",
    author: "江月明",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art087/800/600",
    likes: 937,
    views: 86232,
    createdAt: "2023-10-30"
  },

  // 88. illustration
  {
    id: 88,
    title: "晨雾轻纱 / Morning Veil No.2",
    description: "这幅作品探索了潜意识与现实的边界，通过粉紫色调的渐变与流动的光影，构筑出宁静而深邃的意境。让光影成为情感最忠实的表达载体。",
    author: "宋清欢",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art088/800/600",
    likes: 807,
    views: 36624,
    createdAt: "2024-07-16"
  },

  // 89. abstract
  {
    id: 89,
    title: "星光漫步 / Starlight Stroll No.2",
    description: "这幅作品探索了光影与色彩的对话，通过绛红霞光的渐变与流动的光影，勾勒出诗意般的画面。在静谧中传递出强烈的情感张力。",
    author: "周慕辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art089/800/600",
    likes: 864,
    views: 59141,
    createdAt: "2023-04-01"
  },

  // 90. 3d-art
  {
    id: 90,
    title: "幻影之城 / Phantom City No.2",
    description: "这幅作品探索了自然与科技的融合，通过玫瑰金辉的渐变与流动的光影，构建出一个令人沉醉的梦境空间。让人在凝视中感受时间凝固的瞬间。",
    author: "韩雨桐",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art090/800/600",
    likes: 848,
    views: 46173,
    createdAt: "2024-08-09"
  },

  // 91. digital-art
  {
    id: 91,
    title: "繁花似锦 / Blossom Tapestry No.2",
    description: "这幅作品探索了喧嚣与宁静的对比，通过靛青深邃的渐变与流动的光影，展露出细腻的情感肌理。让光影成为情感最忠实的表达载体。",
    author: "李清风",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art091/800/600",
    likes: 791,
    views: 75113,
    createdAt: "2023-06-06"
  },

  // 92. photography
  {
    id: 92,
    title: "冰封时刻 / Frozen Moment No.2",
    description: "这幅作品探索了喧嚣与宁静的对比，通过绛红霞光的渐变与流动的光影，构筑出宁静而深邃的意境。在静谧中传递出强烈的情感张力。",
    author: "吴映雪",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art092/800/600",
    likes: 912,
    views: 64253,
    createdAt: "2023-02-12"
  },

  // 93. illustration
  {
    id: 93,
    title: "梦境碎片 / Dream Fragments No.2",
    description: "这幅作品探索了情感与记忆的沉淀，通过薰衣草紫的渐变与流动的光影，创造出富有韵律的构图。唤起观者内心深处最柔软的共鸣。",
    author: "张云深",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art093/800/600",
    likes: 175,
    views: 94683,
    createdAt: "2023-06-09"
  },

  // 94. abstract
  {
    id: 94,
    title: "光之回廊 / Corridor of Light No.2",
    description: "这幅作品探索了潜意识与现实的边界，通过琥珀温润的渐变与流动的光影，勾勒出诗意般的画面。每一处细节都诉说着关于存在与虚无的思考。",
    author: "黄思远",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art094/800/600",
    likes: 495,
    views: 99496,
    createdAt: "2023-08-25"
  },

  // 95. 3d-art
  {
    id: 95,
    title: "墨色山水 / Ink Landscape No.2",
    description: "这幅作品探索了潜意识与现实的边界，通过薄荷淡彩的渐变与流动的光影，展露出细腻的情感肌理。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "徐若曦",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art095/800/600",
    likes: 652,
    views: 19183,
    createdAt: "2024-12-03"
  },

  // 96. digital-art
  {
    id: 96,
    title: "流光溢彩 / Flowing Radiance No.2",
    description: "这幅作品探索了流动与静止的张力，通过翠绿流光的渐变与流动的光影，展露出细腻的情感肌理。将瞬间的感动凝固为永恒的画面。",
    author: "何慕言",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art096/800/600",
    likes: 827,
    views: 23636,
    createdAt: "2024-02-25"
  },

  // 97. photography
  {
    id: 97,
    title: "夜空烟火 / Night Sky Fireworks No.2",
    description: "这幅作品探索了时间与空间的褶皱，通过薰衣草紫的渐变与流动的光影，构筑出宁静而深邃的意境。将瞬间的感动凝固为永恒的画面。",
    author: "罗星尘",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art097/800/600",
    likes: 833,
    views: 1547,
    createdAt: "2023-01-11"
  },

  // 98. illustration
  {
    id: 98,
    title: "晨露未晞 / Morning Dew No.2",
    description: "这幅作品探索了光影与色彩的对话，通过薰衣草紫的渐变与流动的光影，创造出富有韵律的构图。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "高雪见",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art098/800/600",
    likes: 999,
    views: 15508,
    createdAt: "2024-07-04"
  },

  // 99. abstract
  {
    id: 99,
    title: "云海翻涌 / Rolling Cloud Sea No.2",
    description: "这幅作品探索了宇宙与微观的呼应，通过玫瑰金辉的渐变与流动的光影，打造出沉浸式的感官世界。让光影成为情感最忠实的表达载体。",
    author: "钱书瑶",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art099/800/600",
    likes: 731,
    views: 24509,
    createdAt: "2024-08-01"
  },

  // 100. 3d-art
  {
    id: 100,
    title: "玻璃花园 / Glass Garden No.2",
    description: "这幅作品探索了喧嚣与宁静的对比，通过玫瑰金辉的渐变与流动的光影，构筑出宁静而深邃的意境。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "孙听澜",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art100/800/600",
    likes: 727,
    views: 72643,
    createdAt: "2023-05-28"
  },

  // 101. digital-art
  {
    id: 101,
    title: "彩虹尽头 / End of Rainbow No.2",
    description: "这幅作品探索了情感与记忆的沉淀，通过钴蓝渐变的渐变与流动的光影，塑造出独特的视觉语言。将瞬间的感动凝固为永恒的画面。",
    author: "林梦雨",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art101/800/600",
    likes: 873,
    views: 44901,
    createdAt: "2023-09-12"
  },

  // 102. photography
  {
    id: 102,
    title: "银河铁道 / Galaxy Railway No.2",
    description: "这幅作品探索了时间与空间的褶皱，通过粉紫色调的渐变与流动的光影，构筑出宁静而深邃的意境。将瞬间的感动凝固为永恒的画面。",
    author: "陈墨白",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art102/800/600",
    likes: 798,
    views: 88975,
    createdAt: "2024-07-26"
  },

  // 103. illustration
  {
    id: 103,
    title: "光影迷宫 / Light Maze No.2",
    description: "这幅作品探索了时间与空间的褶皱，通过粉紫色调的渐变与流动的光影，营造出超现实的视觉体验。将瞬间的感动凝固为永恒的画面。",
    author: "苏晚晴",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art103/800/600",
    likes: 93,
    views: 4757,
    createdAt: "2024-08-09"
  },

  // 104. abstract
  {
    id: 104,
    title: "永恒瞬间 / Eternal Moment No.2",
    description: "这幅作品探索了喧嚣与宁静的对比，通过暖橘金辉的渐变与流动的光影，营造出超现实的视觉体验。让人在凝视中感受时间凝固的瞬间。",
    author: "顾北辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art104/800/600",
    likes: 192,
    views: 99038,
    createdAt: "2024-04-28"
  },

  // 105. 3d-art
  {
    id: 105,
    title: "静谧港湾 / Tranquil Harbor No.2",
    description: "这幅作品探索了流动与静止的张力，通过暖橘金辉的渐变与流动的光影，创造出富有韵律的构图。将瞬间的感动凝固为永恒的画面。",
    author: "沈星河",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art105/800/600",
    likes: 946,
    views: 8910,
    createdAt: "2023-12-08"
  },

  // 106. digital-art
  {
    id: 106,
    title: "星尘记忆 / Stardust Memory No.2",
    description: "这幅作品探索了喧嚣与宁静的对比，通过琥珀温润的渐变与流动的光影，编织出如梦似幻的氛围。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "白若雪",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art106/800/600",
    likes: 839,
    views: 89264,
    createdAt: "2024-06-22"
  },

  // 107. photography
  {
    id: 107,
    title: "雾中风景 / Landscape in Mist No.2",
    description: "这幅作品探索了光影与色彩的对话，通过钴蓝渐变的渐变与流动的光影，编织出如梦似幻的氛围。让人在凝视中感受时间凝固的瞬间。",
    author: "江月明",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art107/800/600",
    likes: 864,
    views: 69693,
    createdAt: "2024-03-23"
  },

  // 108. illustration
  {
    id: 108,
    title: "光之诗篇 / Poem of Light No.2",
    description: "这幅作品探索了流动与静止的张力，通过暖橘金辉的渐变与流动的光影，呈现出迷人的光影层次。以独特的视角诠释了梦境美学的精髓。",
    author: "宋清欢",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art108/800/600",
    likes: 96,
    views: 75688,
    createdAt: "2024-07-09"
  },

  // 109. abstract
  {
    id: 109,
    title: "梦境之翼 / Dream Wings No.3",
    description: "这幅作品探索了自然与科技的融合，通过钴蓝渐变的渐变与流动的光影，创造出富有韵律的构图。让人在凝视中感受时间凝固的瞬间。",
    author: "周慕辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art109/800/600",
    likes: 891,
    views: 18141,
    createdAt: "2024-11-01"
  },

  // 110. 3d-art
  {
    id: 110,
    title: "紫色迷雾 / Purple Mist No.3",
    description: "这幅作品探索了自然与科技的融合，通过玫瑰金辉的渐变与流动的光影，塑造出独特的视觉语言。引领观者进入一场关于美的深层探索。",
    author: "韩雨桐",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art110/800/600",
    likes: 814,
    views: 48443,
    createdAt: "2023-03-27"
  },

  // 111. digital-art
  {
    id: 111,
    title: "星河倒影 / Galaxy Reflection No.3",
    description: "这幅作品探索了光影与色彩的对话，通过琥珀温润的渐变与流动的光影，编织出如梦似幻的氛围。在虚与实之间留下无尽的想象空间。",
    author: "李清风",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art111/800/600",
    likes: 156,
    views: 81186,
    createdAt: "2024-02-27"
  },

  // 112. photography
  {
    id: 112,
    title: "花语低吟 / Whispering Blooms No.3",
    description: "这幅作品探索了情感与记忆的沉淀，通过薄荷淡彩的渐变与流动的光影，构建出一个令人沉醉的梦境空间。让人在凝视中感受时间凝固的瞬间。",
    author: "吴映雪",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art112/800/600",
    likes: 167,
    views: 82761,
    createdAt: "2023-07-11"
  },

  // 113. illustration
  {
    id: 113,
    title: "光影交响 / Light Symphony No.3",
    description: "这幅作品探索了自然与科技的融合，通过粉紫色调的渐变与流动的光影，营造出超现实的视觉体验。将瞬间的感动凝固为永恒的画面。",
    author: "张云深",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art113/800/600",
    likes: 955,
    views: 26961,
    createdAt: "2023-03-08"
  },

  // 114. abstract
  {
    id: 114,
    title: "深海呢喃 / Deep Sea Whisper No.3",
    description: "这幅作品探索了梦境与清醒的交织，通过钴蓝渐变的渐变与流动的光影，营造出超现实的视觉体验。让人在凝视中感受时间凝固的瞬间。",
    author: "黄思远",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art114/800/600",
    likes: 48,
    views: 17077,
    createdAt: "2024-09-04"
  },

  // 115. 3d-art
  {
    id: 115,
    title: "霓虹心脏 / Neon Heart No.3",
    description: "这幅作品探索了时间与空间的褶皱，通过靛青深邃的渐变与流动的光影，营造出超现实的视觉体验。在虚与实之间留下无尽的想象空间。",
    author: "徐若曦",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art115/800/600",
    likes: 575,
    views: 75000,
    createdAt: "2024-05-18"
  },

  // 116. digital-art
  {
    id: 116,
    title: "破碎星辰 / Shattered Stars No.3",
    description: "这幅作品探索了喧嚣与宁静的对比，通过琥珀温润的渐变与流动的光影，勾勒出诗意般的画面。唤起观者内心深处最柔软的共鸣。",
    author: "何慕言",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art116/800/600",
    likes: 210,
    views: 96823,
    createdAt: "2023-11-27"
  },

  // 117. photography
  {
    id: 117,
    title: "液态银河 / Liquid Galaxy No.3",
    description: "这幅作品探索了自然与科技的融合，通过薰衣草紫的渐变与流动的光影，呈现出迷人的光影层次。将瞬间的感动凝固为永恒的画面。",
    author: "罗星尘",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art117/800/600",
    likes: 684,
    views: 74837,
    createdAt: "2023-12-01"
  },

  // 118. illustration
  {
    id: 118,
    title: "蝴蝶效应 / Butterfly Effect No.3",
    description: "这幅作品探索了潜意识与现实的边界，通过绛红霞光的渐变与流动的光影，构建出一个令人沉醉的梦境空间。每一处细节都诉说着关于存在与虚无的思考。",
    author: "高雪见",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art118/800/600",
    likes: 40,
    views: 86433,
    createdAt: "2023-03-24"
  },

  // 119. abstract
  {
    id: 119,
    title: "晨曦微光 / Dawn Glimmer No.3",
    description: "这幅作品探索了梦境与清醒的交织，通过粉紫色调的渐变与流动的光影，创造出富有韵律的构图。唤起观者内心深处最柔软的共鸣。",
    author: "钱书瑶",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art119/800/600",
    likes: 485,
    views: 49903,
    createdAt: "2023-03-26"
  },

  // 120. 3d-art
  {
    id: 120,
    title: "镜中幻境 / Mirror Mirage No.3",
    description: "这幅作品探索了流动与静止的张力，通过钴蓝渐变的渐变与流动的光影，构筑出宁静而深邃的意境。唤起观者内心深处最柔软的共鸣。",
    author: "孙听澜",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art120/800/600",
    likes: 986,
    views: 46340,
    createdAt: "2023-09-15"
  },

  // 121. digital-art
  {
    id: 121,
    title: "燃烧的云 / Burning Clouds No.3",
    description: "这幅作品探索了梦境与清醒的交织，通过靛青深邃的渐变与流动的光影，呈现出迷人的光影层次。在虚与实之间留下无尽的想象空间。",
    author: "林梦雨",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art121/800/600",
    likes: 470,
    views: 8834,
    createdAt: "2023-11-26"
  },

  // 122. photography
  {
    id: 122,
    title: "雨后初晴 / After the Rain No.3",
    description: "这幅作品探索了喧嚣与宁静的对比，通过玫瑰金辉的渐变与流动的光影，呈现出迷人的光影层次。在静谧中传递出强烈的情感张力。",
    author: "陈墨白",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art122/800/600",
    likes: 703,
    views: 77678,
    createdAt: "2024-12-30"
  },

  // 123. illustration
  {
    id: 123,
    title: "时间褶皱 / Folds of Time No.3",
    description: "这幅作品探索了自然与科技的融合，通过玫瑰金辉的渐变与流动的光影，创造出富有韵律的构图。将瞬间的感动凝固为永恒的画面。",
    author: "苏晚晴",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art123/800/600",
    likes: 871,
    views: 23162,
    createdAt: "2023-11-18"
  },

  // 124. abstract
  {
    id: 124,
    title: "午夜花园 / Midnight Garden No.3",
    description: "这幅作品探索了流动与静止的张力，通过薄荷淡彩的渐变与流动的光影，构筑出宁静而深邃的意境。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "顾北辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art124/800/600",
    likes: 787,
    views: 33680,
    createdAt: "2024-03-28"
  },

  // 125. 3d-art
  {
    id: 125,
    title: "光的轨迹 / Trail of Light No.3",
    description: "这幅作品探索了梦境与清醒的交织，通过玫瑰金辉的渐变与流动的光影，呈现出迷人的光影层次。在虚与实之间留下无尽的想象空间。",
    author: "沈星河",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art125/800/600",
    likes: 780,
    views: 71921,
    createdAt: "2023-01-15"
  },

  // 126. digital-art
  {
    id: 126,
    title: "蓝色梦境 / Blue Reverie No.3",
    description: "这幅作品探索了潜意识与现实的边界，通过薄荷淡彩的渐变与流动的光影，勾勒出诗意般的画面。每一处细节都诉说着关于存在与虚无的思考。",
    author: "白若雪",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art126/800/600",
    likes: 256,
    views: 96878,
    createdAt: "2024-04-08"
  },

  // 127. photography
  {
    id: 127,
    title: "樱花絮语 / Sakura Whispers No.3",
    description: "这幅作品探索了流动与静止的张力，通过靛青深邃的渐变与流动的光影，呈现出迷人的光影层次。将瞬间的感动凝固为永恒的画面。",
    author: "江月明",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art127/800/600",
    likes: 909,
    views: 52744,
    createdAt: "2024-01-28"
  },

  // 128. illustration
  {
    id: 128,
    title: "迷雾森林 / Misty Forest No.3",
    description: "这幅作品探索了流动与静止的张力，通过薰衣草紫的渐变与流动的光影，构筑出宁静而深邃的意境。每一处细节都诉说着关于存在与虚无的思考。",
    author: "宋清欢",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art128/800/600",
    likes: 633,
    views: 24308,
    createdAt: "2023-03-10"
  },

  // 129. abstract
  {
    id: 129,
    title: "极光之舞 / Aurora Dance No.3",
    description: "这幅作品探索了流动与静止的张力，通过薄荷淡彩的渐变与流动的光影，构建出一个令人沉醉的梦境空间。让人在凝视中感受时间凝固的瞬间。",
    author: "周慕辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art129/800/600",
    likes: 54,
    views: 59363,
    createdAt: "2024-09-17"
  },

  // 130. 3d-art
  {
    id: 130,
    title: "水晶之心 / Crystal Heart No.3",
    description: "这幅作品探索了潜意识与现实的边界，通过绛红霞光的渐变与流动的光影，展露出细腻的情感肌理。让人在凝视中感受时间凝固的瞬间。",
    author: "韩雨桐",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art130/800/600",
    likes: 752,
    views: 57701,
    createdAt: "2023-03-28"
  },

  // 131. digital-art
  {
    id: 131,
    title: "悬浮岛屿 / Floating Islands No.3",
    description: "这幅作品探索了情感与记忆的沉淀，通过暖橘金辉的渐变与流动的光影，打造出沉浸式的感官世界。让光影成为情感最忠实的表达载体。",
    author: "李清风",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art131/800/600",
    likes: 181,
    views: 26414,
    createdAt: "2023-04-10"
  },

  // 132. photography
  {
    id: 132,
    title: "记忆碎片 / Memory Fragments No.3",
    description: "这幅作品探索了时间与空间的褶皱，通过琥珀温润的渐变与流动的光影，打造出沉浸式的感官世界。在虚与实之间留下无尽的想象空间。",
    author: "吴映雪",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art132/800/600",
    likes: 181,
    views: 2192,
    createdAt: "2023-01-15"
  },

  // 133. illustration
  {
    id: 133,
    title: "霓虹丛林 / Neon Jungle No.3",
    description: "这幅作品探索了情感与记忆的沉淀，通过薰衣草紫的渐变与流动的光影，打造出沉浸式的感官世界。每一处细节都诉说着关于存在与虚无的思考。",
    author: "张云深",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art133/800/600",
    likes: 233,
    views: 40228,
    createdAt: "2023-07-25"
  },

  // 134. abstract
  {
    id: 134,
    title: "月下独舞 / Moonlit Solo No.3",
    description: "这幅作品探索了情感与记忆的沉淀，通过薄荷淡彩的渐变与流动的光影，呈现出迷人的光影层次。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "黄思远",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art134/800/600",
    likes: 334,
    views: 69913,
    createdAt: "2023-02-18"
  },

  // 135. 3d-art
  {
    id: 135,
    title: "色彩漩涡 / Color Vortex No.3",
    description: "这幅作品探索了具象与抽象的转换，通过粉紫色调的渐变与流动的光影，构筑出宁静而深邃的意境。每一处细节都诉说着关于存在与虚无的思考。",
    author: "徐若曦",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art135/800/600",
    likes: 554,
    views: 16939,
    createdAt: "2023-01-30"
  },

  // 136. digital-art
  {
    id: 136,
    title: "风的形状 / Shape of Wind No.3",
    description: "这幅作品探索了梦境与清醒的交织，通过钴蓝渐变的渐变与流动的光影，营造出超现实的视觉体验。每一处细节都诉说着关于存在与虚无的思考。",
    author: "何慕言",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art136/800/600",
    likes: 265,
    views: 91898,
    createdAt: "2024-11-17"
  },

  // 137. photography
  {
    id: 137,
    title: "光与影的对话 / Dialogue of Light and Shadow No.3",
    description: "这幅作品探索了流动与静止的张力，通过薰衣草紫的渐变与流动的光影，展露出细腻的情感肌理。唤起观者内心深处最柔软的共鸣。",
    author: "罗星尘",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art137/800/600",
    likes: 15,
    views: 46581,
    createdAt: "2024-08-07"
  },

  // 138. illustration
  {
    id: 138,
    title: "宇宙尘埃 / Cosmic Dust No.3",
    description: "这幅作品探索了潜意识与现实的边界，通过钴蓝渐变的渐变与流动的光影，创造出富有韵律的构图。唤起观者内心深处最柔软的共鸣。",
    author: "高雪见",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art138/800/600",
    likes: 96,
    views: 95280,
    createdAt: "2024-09-04"
  },

  // 139. abstract
  {
    id: 139,
    title: "玫瑰星云 / Rose Nebula No.3",
    description: "这幅作品探索了具象与抽象的转换，通过薰衣草紫的渐变与流动的光影，营造出超现实的视觉体验。每一处细节都诉说着关于存在与虚无的思考。",
    author: "钱书瑶",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art139/800/600",
    likes: 764,
    views: 4587,
    createdAt: "2023-01-12"
  },

  // 140. 3d-art
  {
    id: 140,
    title: "海底秘境 / Underwater Secret No.3",
    description: "这幅作品探索了具象与抽象的转换，通过暖橘金辉的渐变与流动的光影，构筑出宁静而深邃的意境。将瞬间的感动凝固为永恒的画面。",
    author: "孙听澜",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art140/800/600",
    likes: 135,
    views: 47993,
    createdAt: "2023-07-05"
  },

  // 141. digital-art
  {
    id: 141,
    title: "日落余晖 / Sunset Afterglow No.3",
    description: "这幅作品探索了喧嚣与宁静的对比，通过钴蓝渐变的渐变与流动的光影，呈现出迷人的光影层次。在静谧中传递出强烈的情感张力。",
    author: "林梦雨",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art141/800/600",
    likes: 714,
    views: 29090,
    createdAt: "2023-08-28"
  },

  // 142. photography
  {
    id: 142,
    title: "晨雾轻纱 / Morning Veil No.3",
    description: "这幅作品探索了时间与空间的褶皱，通过暖橘金辉的渐变与流动的光影，勾勒出诗意般的画面。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "陈墨白",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art142/800/600",
    likes: 653,
    views: 69670,
    createdAt: "2023-11-03"
  },

  // 143. illustration
  {
    id: 143,
    title: "星光漫步 / Starlight Stroll No.3",
    description: "这幅作品探索了潜意识与现实的边界，通过暖橘金辉的渐变与流动的光影，展露出细腻的情感肌理。唤起观者内心深处最柔软的共鸣。",
    author: "苏晚晴",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art143/800/600",
    likes: 613,
    views: 65824,
    createdAt: "2023-09-08"
  },

  // 144. abstract
  {
    id: 144,
    title: "幻影之城 / Phantom City No.3",
    description: "这幅作品探索了自然与科技的融合，通过薰衣草紫的渐变与流动的光影，呈现出迷人的光影层次。在静谧中传递出强烈的情感张力。",
    author: "顾北辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art144/800/600",
    likes: 334,
    views: 9844,
    createdAt: "2023-11-08"
  },

  // 145. 3d-art
  {
    id: 145,
    title: "繁花似锦 / Blossom Tapestry No.3",
    description: "这幅作品探索了潜意识与现实的边界，通过薰衣草紫的渐变与流动的光影，编织出如梦似幻的氛围。以独特的视角诠释了梦境美学的精髓。",
    author: "沈星河",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art145/800/600",
    likes: 843,
    views: 79021,
    createdAt: "2023-02-23"
  },

  // 146. digital-art
  {
    id: 146,
    title: "冰封时刻 / Frozen Moment No.3",
    description: "这幅作品探索了喧嚣与宁静的对比，通过粉紫色调的渐变与流动的光影，打造出沉浸式的感官世界。在虚与实之间留下无尽的想象空间。",
    author: "白若雪",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art146/800/600",
    likes: 370,
    views: 91748,
    createdAt: "2024-12-20"
  },

  // 147. photography
  {
    id: 147,
    title: "梦境碎片 / Dream Fragments No.3",
    description: "这幅作品探索了光影与色彩的对话，通过绛红霞光的渐变与流动的光影，呈现出迷人的光影层次。在静谧中传递出强烈的情感张力。",
    author: "江月明",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art147/800/600",
    likes: 864,
    views: 29216,
    createdAt: "2023-02-06"
  },

  // 148. illustration
  {
    id: 148,
    title: "光之回廊 / Corridor of Light No.3",
    description: "这幅作品探索了自然与科技的融合，通过粉紫色调的渐变与流动的光影，编织出如梦似幻的氛围。让人在凝视中感受时间凝固的瞬间。",
    author: "宋清欢",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art148/800/600",
    likes: 258,
    views: 24317,
    createdAt: "2024-10-12"
  },

  // 149. abstract
  {
    id: 149,
    title: "墨色山水 / Ink Landscape No.3",
    description: "这幅作品探索了流动与静止的张力，通过翠绿流光的渐变与流动的光影，打造出沉浸式的感官世界。让人在凝视中感受时间凝固的瞬间。",
    author: "周慕辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art149/800/600",
    likes: 318,
    views: 17541,
    createdAt: "2023-03-14"
  },

  // 150. 3d-art
  {
    id: 150,
    title: "流光溢彩 / Flowing Radiance No.3",
    description: "这幅作品探索了宇宙与微观的呼应，通过绛红霞光的渐变与流动的光影，编织出如梦似幻的氛围。唤起观者内心深处最柔软的共鸣。",
    author: "韩雨桐",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art150/800/600",
    likes: 231,
    views: 78882,
    createdAt: "2023-03-26"
  },

  // 151. digital-art
  {
    id: 151,
    title: "夜空烟火 / Night Sky Fireworks No.3",
    description: "这幅作品探索了时间与空间的褶皱，通过翠绿流光的渐变与流动的光影，编织出如梦似幻的氛围。引领观者进入一场关于美的深层探索。",
    author: "李清风",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art151/800/600",
    likes: 803,
    views: 97031,
    createdAt: "2024-07-30"
  },

  // 152. photography
  {
    id: 152,
    title: "晨露未晞 / Morning Dew No.3",
    description: "这幅作品探索了梦境与清醒的交织，通过翠绿流光的渐变与流动的光影，构筑出宁静而深邃的意境。在静谧中传递出强烈的情感张力。",
    author: "吴映雪",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art152/800/600",
    likes: 374,
    views: 34678,
    createdAt: "2024-03-12"
  },

  // 153. illustration
  {
    id: 153,
    title: "云海翻涌 / Rolling Cloud Sea No.3",
    description: "这幅作品探索了自然与科技的融合，通过粉紫色调的渐变与流动的光影，营造出超现实的视觉体验。唤起观者内心深处最柔软的共鸣。",
    author: "张云深",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art153/800/600",
    likes: 341,
    views: 50617,
    createdAt: "2024-01-30"
  },

  // 154. abstract
  {
    id: 154,
    title: "玻璃花园 / Glass Garden No.3",
    description: "这幅作品探索了梦境与清醒的交织，通过玫瑰金辉的渐变与流动的光影，营造出超现实的视觉体验。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "黄思远",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art154/800/600",
    likes: 406,
    views: 89038,
    createdAt: "2024-05-15"
  },

  // 155. 3d-art
  {
    id: 155,
    title: "彩虹尽头 / End of Rainbow No.3",
    description: "这幅作品探索了梦境与清醒的交织，通过玫瑰金辉的渐变与流动的光影，构筑出宁静而深邃的意境。唤起观者内心深处最柔软的共鸣。",
    author: "徐若曦",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art155/800/600",
    likes: 456,
    views: 34934,
    createdAt: "2023-10-20"
  },

  // 156. digital-art
  {
    id: 156,
    title: "银河铁道 / Galaxy Railway No.3",
    description: "这幅作品探索了光影与色彩的对话，通过钴蓝渐变的渐变与流动的光影，塑造出独特的视觉语言。将瞬间的感动凝固为永恒的画面。",
    author: "何慕言",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art156/800/600",
    likes: 118,
    views: 35995,
    createdAt: "2023-06-25"
  },

  // 157. photography
  {
    id: 157,
    title: "光影迷宫 / Light Maze No.3",
    description: "这幅作品探索了自然与科技的融合，通过翠绿流光的渐变与流动的光影，塑造出独特的视觉语言。引领观者进入一场关于美的深层探索。",
    author: "罗星尘",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art157/800/600",
    likes: 975,
    views: 91915,
    createdAt: "2023-12-28"
  },

  // 158. illustration
  {
    id: 158,
    title: "永恒瞬间 / Eternal Moment No.3",
    description: "这幅作品探索了流动与静止的张力，通过靛青深邃的渐变与流动的光影，勾勒出诗意般的画面。将瞬间的感动凝固为永恒的画面。",
    author: "高雪见",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art158/800/600",
    likes: 480,
    views: 9983,
    createdAt: "2023-11-06"
  },

  // 159. abstract
  {
    id: 159,
    title: "静谧港湾 / Tranquil Harbor No.3",
    description: "这幅作品探索了自然与科技的融合，通过靛青深邃的渐变与流动的光影，塑造出独特的视觉语言。让人在凝视中感受时间凝固的瞬间。",
    author: "钱书瑶",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art159/800/600",
    likes: 473,
    views: 26693,
    createdAt: "2023-04-07"
  },

  // 160. 3d-art
  {
    id: 160,
    title: "星尘记忆 / Stardust Memory No.3",
    description: "这幅作品探索了梦境与清醒的交织，通过琥珀温润的渐变与流动的光影，塑造出独特的视觉语言。在虚与实之间留下无尽的想象空间。",
    author: "孙听澜",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art160/800/600",
    likes: 435,
    views: 97335,
    createdAt: "2023-04-11"
  },

  // 161. digital-art
  {
    id: 161,
    title: "雾中风景 / Landscape in Mist No.3",
    description: "这幅作品探索了流动与静止的张力，通过薄荷淡彩的渐变与流动的光影，展露出细腻的情感肌理。让人在凝视中感受时间凝固的瞬间。",
    author: "林梦雨",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art161/800/600",
    likes: 364,
    views: 51401,
    createdAt: "2024-03-01"
  },

  // 162. photography
  {
    id: 162,
    title: "光之诗篇 / Poem of Light No.3",
    description: "这幅作品探索了情感与记忆的沉淀，通过钴蓝渐变的渐变与流动的光影，构建出一个令人沉醉的梦境空间。唤起观者内心深处最柔软的共鸣。",
    author: "陈墨白",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art162/800/600",
    likes: 328,
    views: 14384,
    createdAt: "2023-04-08"
  },

  // 163. illustration
  {
    id: 163,
    title: "梦境之翼 / Dream Wings No.4",
    description: "这幅作品探索了光影与色彩的对话，通过翠绿流光的渐变与流动的光影，营造出超现实的视觉体验。在虚与实之间留下无尽的想象空间。",
    author: "苏晚晴",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art163/800/600",
    likes: 695,
    views: 96974,
    createdAt: "2024-01-20"
  },

  // 164. abstract
  {
    id: 164,
    title: "紫色迷雾 / Purple Mist No.4",
    description: "这幅作品探索了梦境与清醒的交织，通过粉紫色调的渐变与流动的光影，塑造出独特的视觉语言。将瞬间的感动凝固为永恒的画面。",
    author: "顾北辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art164/800/600",
    likes: 24,
    views: 50963,
    createdAt: "2024-08-03"
  },

  // 165. 3d-art
  {
    id: 165,
    title: "星河倒影 / Galaxy Reflection No.4",
    description: "这幅作品探索了流动与静止的张力，通过粉紫色调的渐变与流动的光影，营造出超现实的视觉体验。唤起观者内心深处最柔软的共鸣。",
    author: "沈星河",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art165/800/600",
    likes: 596,
    views: 90644,
    createdAt: "2023-04-27"
  },

  // 166. digital-art
  {
    id: 166,
    title: "花语低吟 / Whispering Blooms No.4",
    description: "这幅作品探索了宇宙与微观的呼应，通过靛青深邃的渐变与流动的光影，构建出一个令人沉醉的梦境空间。每一处细节都诉说着关于存在与虚无的思考。",
    author: "白若雪",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art166/800/600",
    likes: 676,
    views: 82507,
    createdAt: "2024-02-28"
  },

  // 167. photography
  {
    id: 167,
    title: "光影交响 / Light Symphony No.4",
    description: "这幅作品探索了流动与静止的张力，通过绛红霞光的渐变与流动的光影，编织出如梦似幻的氛围。在静谧中传递出强烈的情感张力。",
    author: "江月明",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art167/800/600",
    likes: 372,
    views: 344,
    createdAt: "2024-12-14"
  },

  // 168. illustration
  {
    id: 168,
    title: "深海呢喃 / Deep Sea Whisper No.4",
    description: "这幅作品探索了流动与静止的张力，通过粉紫色调的渐变与流动的光影，塑造出独特的视觉语言。每一处细节都诉说着关于存在与虚无的思考。",
    author: "宋清欢",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art168/800/600",
    likes: 198,
    views: 47347,
    createdAt: "2023-04-04"
  },

  // 169. abstract
  {
    id: 169,
    title: "霓虹心脏 / Neon Heart No.4",
    description: "这幅作品探索了光影与色彩的对话，通过薄荷淡彩的渐变与流动的光影，编织出如梦似幻的氛围。在静谧中传递出强烈的情感张力。",
    author: "周慕辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art169/800/600",
    likes: 296,
    views: 45608,
    createdAt: "2023-06-06"
  },

  // 170. 3d-art
  {
    id: 170,
    title: "破碎星辰 / Shattered Stars No.4",
    description: "这幅作品探索了宇宙与微观的呼应，通过薰衣草紫的渐变与流动的光影，勾勒出诗意般的画面。以独特的视角诠释了梦境美学的精髓。",
    author: "韩雨桐",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art170/800/600",
    likes: 332,
    views: 91018,
    createdAt: "2023-02-04"
  },

  // 171. digital-art
  {
    id: 171,
    title: "液态银河 / Liquid Galaxy No.4",
    description: "这幅作品探索了流动与静止的张力，通过粉紫色调的渐变与流动的光影，勾勒出诗意般的画面。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "李清风",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art171/800/600",
    likes: 46,
    views: 75970,
    createdAt: "2024-11-28"
  },

  // 172. photography
  {
    id: 172,
    title: "蝴蝶效应 / Butterfly Effect No.4",
    description: "这幅作品探索了潜意识与现实的边界，通过翠绿流光的渐变与流动的光影，构建出一个令人沉醉的梦境空间。在虚与实之间留下无尽的想象空间。",
    author: "吴映雪",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art172/800/600",
    likes: 466,
    views: 77853,
    createdAt: "2023-09-11"
  },

  // 173. illustration
  {
    id: 173,
    title: "晨曦微光 / Dawn Glimmer No.4",
    description: "这幅作品探索了情感与记忆的沉淀，通过绛红霞光的渐变与流动的光影，构筑出宁静而深邃的意境。在静谧中传递出强烈的情感张力。",
    author: "张云深",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art173/800/600",
    likes: 814,
    views: 14962,
    createdAt: "2024-11-01"
  },

  // 174. abstract
  {
    id: 174,
    title: "镜中幻境 / Mirror Mirage No.4",
    description: "这幅作品探索了自然与科技的融合，通过薰衣草紫的渐变与流动的光影，营造出超现实的视觉体验。引领观者进入一场关于美的深层探索。",
    author: "黄思远",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art174/800/600",
    likes: 58,
    views: 68286,
    createdAt: "2024-02-13"
  },

  // 175. 3d-art
  {
    id: 175,
    title: "燃烧的云 / Burning Clouds No.4",
    description: "这幅作品探索了具象与抽象的转换，通过靛青深邃的渐变与流动的光影，展露出细腻的情感肌理。引领观者进入一场关于美的深层探索。",
    author: "徐若曦",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art175/800/600",
    likes: 108,
    views: 71017,
    createdAt: "2024-10-13"
  },

  // 176. digital-art
  {
    id: 176,
    title: "雨后初晴 / After the Rain No.4",
    description: "这幅作品探索了情感与记忆的沉淀，通过琥珀温润的渐变与流动的光影，塑造出独特的视觉语言。将瞬间的感动凝固为永恒的画面。",
    author: "何慕言",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art176/800/600",
    likes: 742,
    views: 63549,
    createdAt: "2024-01-09"
  },

  // 177. photography
  {
    id: 177,
    title: "时间褶皱 / Folds of Time No.4",
    description: "这幅作品探索了流动与静止的张力，通过玫瑰金辉的渐变与流动的光影，勾勒出诗意般的画面。在虚与实之间留下无尽的想象空间。",
    author: "罗星尘",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art177/800/600",
    likes: 150,
    views: 15971,
    createdAt: "2024-09-15"
  },

  // 178. illustration
  {
    id: 178,
    title: "午夜花园 / Midnight Garden No.4",
    description: "这幅作品探索了宇宙与微观的呼应，通过翠绿流光的渐变与流动的光影，创造出富有韵律的构图。以独特的视角诠释了梦境美学的精髓。",
    author: "高雪见",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art178/800/600",
    likes: 135,
    views: 16775,
    createdAt: "2024-07-16"
  },

  // 179. abstract
  {
    id: 179,
    title: "光的轨迹 / Trail of Light No.4",
    description: "这幅作品探索了时间与空间的褶皱，通过粉紫色调的渐变与流动的光影，展露出细腻的情感肌理。以独特的视角诠释了梦境美学的精髓。",
    author: "钱书瑶",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art179/800/600",
    likes: 31,
    views: 28654,
    createdAt: "2024-06-23"
  },

  // 180. 3d-art
  {
    id: 180,
    title: "蓝色梦境 / Blue Reverie No.4",
    description: "这幅作品探索了宇宙与微观的呼应，通过翠绿流光的渐变与流动的光影，打造出沉浸式的感官世界。以独特的视角诠释了梦境美学的精髓。",
    author: "孙听澜",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art180/800/600",
    likes: 240,
    views: 10599,
    createdAt: "2024-07-07"
  },

  // 181. digital-art
  {
    id: 181,
    title: "樱花絮语 / Sakura Whispers No.4",
    description: "这幅作品探索了自然与科技的融合，通过靛青深邃的渐变与流动的光影，创造出富有韵律的构图。在虚与实之间留下无尽的想象空间。",
    author: "林梦雨",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art181/800/600",
    likes: 464,
    views: 6702,
    createdAt: "2024-10-16"
  },

  // 182. photography
  {
    id: 182,
    title: "迷雾森林 / Misty Forest No.4",
    description: "这幅作品探索了光影与色彩的对话，通过薰衣草紫的渐变与流动的光影，创造出富有韵律的构图。每一处细节都诉说着关于存在与虚无的思考。",
    author: "陈墨白",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art182/800/600",
    likes: 589,
    views: 1854,
    createdAt: "2024-01-16"
  },

  // 183. illustration
  {
    id: 183,
    title: "极光之舞 / Aurora Dance No.4",
    description: "这幅作品探索了潜意识与现实的边界，通过靛青深邃的渐变与流动的光影，编织出如梦似幻的氛围。唤起观者内心深处最柔软的共鸣。",
    author: "苏晚晴",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art183/800/600",
    likes: 245,
    views: 43846,
    createdAt: "2023-05-17"
  },

  // 184. abstract
  {
    id: 184,
    title: "水晶之心 / Crystal Heart No.4",
    description: "这幅作品探索了具象与抽象的转换，通过粉紫色调的渐变与流动的光影，呈现出迷人的光影层次。在虚与实之间留下无尽的想象空间。",
    author: "顾北辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art184/800/600",
    likes: 17,
    views: 32472,
    createdAt: "2023-05-16"
  },

  // 185. 3d-art
  {
    id: 185,
    title: "悬浮岛屿 / Floating Islands No.4",
    description: "这幅作品探索了流动与静止的张力，通过绛红霞光的渐变与流动的光影，打造出沉浸式的感官世界。将瞬间的感动凝固为永恒的画面。",
    author: "沈星河",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art185/800/600",
    likes: 344,
    views: 74722,
    createdAt: "2024-07-18"
  },

  // 186. digital-art
  {
    id: 186,
    title: "记忆碎片 / Memory Fragments No.4",
    description: "这幅作品探索了具象与抽象的转换，通过绛红霞光的渐变与流动的光影，编织出如梦似幻的氛围。将瞬间的感动凝固为永恒的画面。",
    author: "白若雪",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art186/800/600",
    likes: 82,
    views: 7488,
    createdAt: "2023-02-12"
  },

  // 187. photography
  {
    id: 187,
    title: "霓虹丛林 / Neon Jungle No.4",
    description: "这幅作品探索了潜意识与现实的边界，通过琥珀温润的渐变与流动的光影，打造出沉浸式的感官世界。将瞬间的感动凝固为永恒的画面。",
    author: "江月明",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art187/800/600",
    likes: 700,
    views: 85761,
    createdAt: "2024-02-10"
  },

  // 188. illustration
  {
    id: 188,
    title: "月下独舞 / Moonlit Solo No.4",
    description: "这幅作品探索了潜意识与现实的边界，通过靛青深邃的渐变与流动的光影，打造出沉浸式的感官世界。在虚与实之间留下无尽的想象空间。",
    author: "宋清欢",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art188/800/600",
    likes: 207,
    views: 39134,
    createdAt: "2023-10-28"
  },

  // 189. abstract
  {
    id: 189,
    title: "色彩漩涡 / Color Vortex No.4",
    description: "这幅作品探索了潜意识与现实的边界，通过琥珀温润的渐变与流动的光影，勾勒出诗意般的画面。在静谧中传递出强烈的情感张力。",
    author: "周慕辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art189/800/600",
    likes: 662,
    views: 92997,
    createdAt: "2023-07-30"
  },

  // 190. 3d-art
  {
    id: 190,
    title: "风的形状 / Shape of Wind No.4",
    description: "这幅作品探索了具象与抽象的转换，通过玫瑰金辉的渐变与流动的光影，展露出细腻的情感肌理。唤起观者内心深处最柔软的共鸣。",
    author: "韩雨桐",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art190/800/600",
    likes: 442,
    views: 58344,
    createdAt: "2024-11-05"
  },

  // 191. digital-art
  {
    id: 191,
    title: "光与影的对话 / Dialogue of Light and Shadow No.4",
    description: "这幅作品探索了具象与抽象的转换，通过钴蓝渐变的渐变与流动的光影，展露出细腻的情感肌理。让人在凝视中感受时间凝固的瞬间。",
    author: "李清风",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art191/800/600",
    likes: 95,
    views: 86564,
    createdAt: "2023-09-15"
  },

  // 192. photography
  {
    id: 192,
    title: "宇宙尘埃 / Cosmic Dust No.4",
    description: "这幅作品探索了时间与空间的褶皱，通过玫瑰金辉的渐变与流动的光影，创造出富有韵律的构图。每一处细节都诉说着关于存在与虚无的思考。",
    author: "吴映雪",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art192/800/600",
    likes: 909,
    views: 92251,
    createdAt: "2024-08-02"
  },

  // 193. illustration
  {
    id: 193,
    title: "玫瑰星云 / Rose Nebula No.4",
    description: "这幅作品探索了光影与色彩的对话，通过玫瑰金辉的渐变与流动的光影，构建出一个令人沉醉的梦境空间。引领观者进入一场关于美的深层探索。",
    author: "张云深",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art193/800/600",
    likes: 153,
    views: 41795,
    createdAt: "2023-06-01"
  },

  // 194. abstract
  {
    id: 194,
    title: "海底秘境 / Underwater Secret No.4",
    description: "这幅作品探索了光影与色彩的对话，通过粉紫色调的渐变与流动的光影，呈现出迷人的光影层次。引领观者进入一场关于美的深层探索。",
    author: "黄思远",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art194/800/600",
    likes: 921,
    views: 8889,
    createdAt: "2024-01-11"
  },

  // 195. 3d-art
  {
    id: 195,
    title: "日落余晖 / Sunset Afterglow No.4",
    description: "这幅作品探索了喧嚣与宁静的对比，通过薰衣草紫的渐变与流动的光影，构筑出宁静而深邃的意境。唤起观者内心深处最柔软的共鸣。",
    author: "徐若曦",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art195/800/600",
    likes: 739,
    views: 96823,
    createdAt: "2023-12-26"
  },

  // 196. digital-art
  {
    id: 196,
    title: "晨雾轻纱 / Morning Veil No.4",
    description: "这幅作品探索了梦境与清醒的交织，通过玫瑰金辉的渐变与流动的光影，展露出细腻的情感肌理。在静谧中传递出强烈的情感张力。",
    author: "何慕言",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art196/800/600",
    likes: 747,
    views: 27790,
    createdAt: "2023-08-23"
  },

  // 197. photography
  {
    id: 197,
    title: "星光漫步 / Starlight Stroll No.4",
    description: "这幅作品探索了潜意识与现实的边界，通过暖橘金辉的渐变与流动的光影，呈现出迷人的光影层次。每一处细节都诉说着关于存在与虚无的思考。",
    author: "罗星尘",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art197/800/600",
    likes: 611,
    views: 97482,
    createdAt: "2024-08-16"
  },

  // 198. illustration
  {
    id: 198,
    title: "幻影之城 / Phantom City No.4",
    description: "这幅作品探索了宇宙与微观的呼应，通过翠绿流光的渐变与流动的光影，呈现出迷人的光影层次。让光影成为情感最忠实的表达载体。",
    author: "高雪见",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art198/800/600",
    likes: 69,
    views: 98389,
    createdAt: "2023-08-06"
  },

  // 199. abstract
  {
    id: 199,
    title: "繁花似锦 / Blossom Tapestry No.4",
    description: "这幅作品探索了自然与科技的融合，通过薄荷淡彩的渐变与流动的光影，勾勒出诗意般的画面。在虚与实之间留下无尽的想象空间。",
    author: "钱书瑶",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art199/800/600",
    likes: 150,
    views: 8004,
    createdAt: "2023-05-13"
  },

  // 200. 3d-art
  {
    id: 200,
    title: "冰封时刻 / Frozen Moment No.4",
    description: "这幅作品探索了光影与色彩的对话，通过玫瑰金辉的渐变与流动的光影，展露出细腻的情感肌理。唤起观者内心深处最柔软的共鸣。",
    author: "孙听澜",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art200/800/600",
    likes: 77,
    views: 44319,
    createdAt: "2023-04-30"
  },

  // 201. digital-art
  {
    id: 201,
    title: "梦境碎片 / Dream Fragments No.4",
    description: "这幅作品探索了光影与色彩的对话，通过粉紫色调的渐变与流动的光影，创造出富有韵律的构图。唤起观者内心深处最柔软的共鸣。",
    author: "林梦雨",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art201/800/600",
    likes: 806,
    views: 88624,
    createdAt: "2023-04-06"
  },

  // 202. photography
  {
    id: 202,
    title: "光之回廊 / Corridor of Light No.4",
    description: "这幅作品探索了喧嚣与宁静的对比，通过绛红霞光的渐变与流动的光影，构建出一个令人沉醉的梦境空间。唤起观者内心深处最柔软的共鸣。",
    author: "陈墨白",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art202/800/600",
    likes: 269,
    views: 74012,
    createdAt: "2024-05-31"
  },

  // 203. illustration
  {
    id: 203,
    title: "墨色山水 / Ink Landscape No.4",
    description: "这幅作品探索了宇宙与微观的呼应，通过翠绿流光的渐变与流动的光影，营造出超现实的视觉体验。唤起观者内心深处最柔软的共鸣。",
    author: "苏晚晴",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art203/800/600",
    likes: 233,
    views: 40874,
    createdAt: "2023-12-21"
  },

  // 204. abstract
  {
    id: 204,
    title: "流光溢彩 / Flowing Radiance No.4",
    description: "这幅作品探索了具象与抽象的转换，通过琥珀温润的渐变与流动的光影，打造出沉浸式的感官世界。在虚与实之间留下无尽的想象空间。",
    author: "顾北辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art204/800/600",
    likes: 878,
    views: 59203,
    createdAt: "2024-10-22"
  },

  // 205. 3d-art
  {
    id: 205,
    title: "夜空烟火 / Night Sky Fireworks No.4",
    description: "这幅作品探索了宇宙与微观的呼应，通过薰衣草紫的渐变与流动的光影，营造出超现实的视觉体验。在静谧中传递出强烈的情感张力。",
    author: "沈星河",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art205/800/600",
    likes: 27,
    views: 17689,
    createdAt: "2024-08-17"
  },

  // 206. digital-art
  {
    id: 206,
    title: "晨露未晞 / Morning Dew No.4",
    description: "这幅作品探索了自然与科技的融合，通过粉紫色调的渐变与流动的光影，编织出如梦似幻的氛围。每一处细节都诉说着关于存在与虚无的思考。",
    author: "白若雪",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art206/800/600",
    likes: 994,
    views: 78824,
    createdAt: "2024-05-21"
  },

  // 207. photography
  {
    id: 207,
    title: "云海翻涌 / Rolling Cloud Sea No.4",
    description: "这幅作品探索了光影与色彩的对话，通过薄荷淡彩的渐变与流动的光影，营造出超现实的视觉体验。唤起观者内心深处最柔软的共鸣。",
    author: "江月明",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art207/800/600",
    likes: 201,
    views: 1800,
    createdAt: "2024-01-28"
  },

  // 208. illustration
  {
    id: 208,
    title: "玻璃花园 / Glass Garden No.4",
    description: "这幅作品探索了情感与记忆的沉淀，通过钴蓝渐变的渐变与流动的光影，呈现出迷人的光影层次。引领观者进入一场关于美的深层探索。",
    author: "宋清欢",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art208/800/600",
    likes: 335,
    views: 30509,
    createdAt: "2023-11-02"
  },

  // 209. abstract
  {
    id: 209,
    title: "彩虹尽头 / End of Rainbow No.4",
    description: "这幅作品探索了潜意识与现实的边界，通过薄荷淡彩的渐变与流动的光影，呈现出迷人的光影层次。在虚与实之间留下无尽的想象空间。",
    author: "周慕辰",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art209/800/600",
    likes: 288,
    views: 49942,
    createdAt: "2024-05-29"
  },

  // 210. 3d-art
  {
    id: 210,
    title: "银河铁道 / Galaxy Railway No.4",
    description: "这幅作品探索了自然与科技的融合，通过翠绿流光的渐变与流动的光影，勾勒出诗意般的画面。让光影成为情感最忠实的表达载体。",
    author: "韩雨桐",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art210/800/600",
    likes: 682,
    views: 7991,
    createdAt: "2024-11-21"
  },

  // 211. digital-art
  {
    id: 211,
    title: "光影迷宫 / Light Maze No.4",
    description: "这幅作品探索了情感与记忆的沉淀，通过琥珀温润的渐变与流动的光影，勾勒出诗意般的画面。让人在凝视中感受时间凝固的瞬间。",
    author: "李清风",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art211/800/600",
    likes: 116,
    views: 4248,
    createdAt: "2023-11-16"
  },

  // 212. photography
  {
    id: 212,
    title: "永恒瞬间 / Eternal Moment No.4",
    description: "这幅作品探索了具象与抽象的转换，通过钴蓝渐变的渐变与流动的光影，呈现出迷人的光影层次。每一处细节都诉说着关于存在与虚无的思考。",
    author: "吴映雪",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art212/800/600",
    likes: 21,
    views: 45804,
    createdAt: "2023-11-14"
  },

  // 213. illustration
  {
    id: 213,
    title: "静谧港湾 / Tranquil Harbor No.4",
    description: "这幅作品探索了梦境与清醒的交织，通过粉紫色调的渐变与流动的光影，编织出如梦似幻的氛围。让人在凝视中感受时间凝固的瞬间。",
    author: "张云深",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art213/800/600",
    likes: 250,
    views: 69451,
    createdAt: "2023-02-04"
  },

  // 214. abstract
  {
    id: 214,
    title: "星尘记忆 / Stardust Memory No.4",
    description: "这幅作品探索了时间与空间的褶皱，通过粉紫色调的渐变与流动的光影，构筑出宁静而深邃的意境。每一处细节都诉说着关于存在与虚无的思考。",
    author: "黄思远",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art214/800/600",
    likes: 281,
    views: 30481,
    createdAt: "2024-07-28"
  },

  // 215. 3d-art
  {
    id: 215,
    title: "雾中风景 / Landscape in Mist No.4",
    description: "这幅作品探索了情感与记忆的沉淀，通过绛红霞光的渐变与流动的光影，编织出如梦似幻的氛围。将瞬间的感动凝固为永恒的画面。",
    author: "徐若曦",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art215/800/600",
    likes: 112,
    views: 58085,
    createdAt: "2024-08-09"
  },

  // 216. digital-art
  {
    id: 216,
    title: "光之诗篇 / Poem of Light No.4",
    description: "这幅作品探索了情感与记忆的沉淀，通过翠绿流光的渐变与流动的光影，创造出富有韵律的构图。以独特的视角诠释了梦境美学的精髓。",
    author: "何慕言",
    category: "digital-art",
    imageUrl: "https://picsum.photos/seed/art216/800/600",
    likes: 809,
    views: 77955,
    createdAt: "2024-07-05"
  },

  // 217. photography
  {
    id: 217,
    title: "梦境之翼 / Dream Wings No.5",
    description: "这幅作品探索了自然与科技的融合，通过玫瑰金辉的渐变与流动的光影，呈现出迷人的光影层次。让光影成为情感最忠实的表达载体。",
    author: "罗星尘",
    category: "photography",
    imageUrl: "https://picsum.photos/seed/art217/800/600",
    likes: 748,
    views: 982,
    createdAt: "2023-10-09"
  },

  // 218. illustration
  {
    id: 218,
    title: "紫色迷雾 / Purple Mist No.5",
    description: "这幅作品探索了梦境与清醒的交织，通过靛青深邃的渐变与流动的光影，构筑出宁静而深邃的意境。观者可以在色彩的流动中找到内心的宁静与共鸣。",
    author: "高雪见",
    category: "illustration",
    imageUrl: "https://picsum.photos/seed/art218/800/600",
    likes: 477,
    views: 78459,
    createdAt: "2024-06-12"
  },

  // 219. abstract
  {
    id: 219,
    title: "星河倒影 / Galaxy Reflection No.5",
    description: "这幅作品探索了时间与空间的褶皱，通过绛红霞光的渐变与流动的光影，构筑出宁静而深邃的意境。在静谧中传递出强烈的情感张力。",
    author: "钱书瑶",
    category: "abstract",
    imageUrl: "https://picsum.photos/seed/art219/800/600",
    likes: 289,
    views: 25177,
    createdAt: "2024-12-24"
  },

  // 220. 3d-art
  {
    id: 220,
    title: "花语低吟 / Whispering Blooms No.5",
    description: "这幅作品探索了喧嚣与宁静的对比，通过玫瑰金辉的渐变与流动的光影，打造出沉浸式的感官世界。让人在凝视中感受时间凝固的瞬间。",
    author: "孙听澜",
    category: "3d-art",
    imageUrl: "https://picsum.photos/seed/art220/800/600",
    likes: 439,
    views: 7327,
    createdAt: "2023-04-18"
  }
];

// 确保可在浏览器和Node环境使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ARTWORKS_SEED_DATA;
}

// ES Module export
export default ARTWORKS_SEED_DATA;
export { ARTWORKS_SEED_DATA };
