// ============================================================
// data/craft-products.js — 文创产品全品类知识库（全品类映射方案）
// 依据：文创设计参考/文创类型 10 张分类参考图（10 大类约 230 种产品）
//      + 国博/陕历博/故宫爆款品类调研（冰箱贴/徽章/书签/盲盒/丝巾为高频爆款）
// 职责：
//   1. CRAFT_CATEGORIES 10 大类定义
//   2. CRAFT_PRODUCTS 全品类产品清单，每条映射到 5 种设计画布（canvasType）
//   3. 查询 API：getProductsByCategory / searchProducts / hotProducts / getProductByName
// canvasType 映射规则（画面比例与用途）：
//   wallpaper 16:9 横幅大画面 / poster 3:4 竖版叙事 / card 2:3 竖版小卡
//   postcard 3:2 横版寄递 / template 1:1 社交方图
// form3d 字段（3D 实物预览形态，js/craft-3d.js 程序化几何建模，22 种）：
//   mug 马克杯 / tumbler 保温杯 / cushion 抱枕 / standee 亚克力立牌 /
//   toteBag 帆布袋 / phoneCase 手机壳 / notebook 笔记本 / scroll 挂轴 /
//   framedArt 装饰画 / fridgeMagnet 冰箱贴 / scarf 丝巾织物 / puzzle 拼图 /
//   tshirt T恤 / badge 徽章 / keychain 钥匙扣 / nightLamp 夜灯 /
//   powerBank 充电宝盒 / umbrella 雨伞 / tapeRoll 贴纸卷 / mousePad 垫子 /
//   cardStack 卡片堆 / blindBox 方盒（盲盒/收纳盒）
//   无 form3d 字段 → 实物预览自动回退 2D 场景（craft-mockup.js）
// ============================================================

/** 10 大文创产品大类 */
export const CRAFT_CATEGORIES = [
  { key: 'stationery', label: '文具类', icon: 'fa-pen-ruler', desc: '书写记录与阅读陪伴' },
  { key: 'office', label: '办公类', icon: 'fa-briefcase', desc: '办公收纳与商务场景' },
  { key: 'creative', label: '创意类', icon: 'fa-lightbulb', desc: '创意生活方式好物' },
  { key: 'accessory', label: '饰品类', icon: 'fa-gem', desc: '佩戴装饰与随身配饰' },
  { key: 'life', label: '生活类', icon: 'fa-mug-hot', desc: '餐饮日用与生活护理' },
  { key: 'digital', label: '电子类', icon: 'fa-plug', desc: '数码周边与智能小物' },
  { key: 'sports', label: '运动类', icon: 'fa-person-running', desc: '运动健身与户外补给' },
  { key: 'toy', label: '玩具类', icon: 'fa-puzzle-piece', desc: '玩偶桌游与收藏玩具' },
  { key: 'textile', label: '家纺类', icon: 'fa-shirt', desc: '服饰配件与箱包织物' },
  { key: 'home', label: '家居类', icon: 'fa-couch', desc: '家居陈设与香氛照明' }
];

/**
 * 全品类产品清单（约 230 条）
 * @property {string} key       - 产品标识（拼音）
 * @property {string} category  - 所属大类 key
 * @property {string} name      - 产品中文名
 * @property {string} canvasType - 映射画布 wallpaper/poster/card/postcard/template
 * @property {boolean} hot      - 爆款权重（依据博物馆文创市场调研）
 */
export const CRAFT_PRODUCTS = [
  // ---- 文具类（31）----
  { key: 'shuqian', category: 'stationery', name: '书签', canvasType: 'card', hot: true, form3d: 'cardStack' },
  { key: 'chizi', category: 'stationery', name: '尺子', canvasType: 'template' },
  { key: 'huixingpi', category: 'stationery', name: '回形针', canvasType: 'template' },
  { key: 'biji', category: 'stationery', name: '笔记本', canvasType: 'card', form3d: 'notebook' },
  { key: 'shouzhang', category: 'stationery', name: '手账本', canvasType: 'card', hot: true, form3d: 'notebook' },
  { key: 'yuanzhubi', category: 'stationery', name: '圆珠笔', canvasType: 'template' },
  { key: 'xiangpi', category: 'stationery', name: '橡皮', canvasType: 'template' },
  { key: 'yin_zhang', category: 'stationery', name: '印章', canvasType: 'card' },
  { key: 'qianzibi', category: 'stationery', name: '签字笔', canvasType: 'template' },
  { key: 'gangbi', category: 'stationery', name: '钢笔', canvasType: 'template' },
  { key: 'qianbi', category: 'stationery', name: '铅笔', canvasType: 'template' },
  { key: 'bidai', category: 'stationery', name: '笔袋', canvasType: 'wallpaper', form3d: 'toteBag' },
  { key: 'wenjuhe', category: 'stationery', name: '文具盒', canvasType: 'wallpaper', form3d: 'blindBox' },
  { key: 'xiaobidao', category: 'stationery', name: '削笔刀', canvasType: 'template' },
  { key: 'xianquanshu', category: 'stationery', name: '线圈本', canvasType: 'card', form3d: 'notebook' },
  { key: 'bianlitie', category: 'stationery', name: '便利贴', canvasType: 'template', form3d: 'cardStack' },
  { key: 'mingxinpian_wenju', category: 'stationery', name: '明信片', canvasType: 'postcard', hot: true, form3d: 'cardStack' },
  { key: 'heka', category: 'stationery', name: '贺卡', canvasType: 'postcard', hot: true, form3d: 'cardStack' },
  { key: 'wenjianjia', category: 'stationery', name: '文件夹', canvasType: 'wallpaper' },
  { key: 'bitong', category: 'stationery', name: '笔筒', canvasType: 'template', form3d: 'tumbler' },
  { key: 'dingshuji', category: 'stationery', name: '订书机', canvasType: 'template' },
  { key: 'naozhong', category: 'stationery', name: '闹钟', canvasType: 'template' },
  { key: 'tiezhi', category: 'stationery', name: '贴纸', canvasType: 'template', hot: true, form3d: 'tapeRoll' },
  { key: 'shuli', category: 'stationery', name: '书立', canvasType: 'card' },
  { key: 'shutao', category: 'stationery', name: '书套', canvasType: 'wallpaper' },
  { key: 'jiaodai', category: 'stationery', name: '胶带', canvasType: 'template', form3d: 'tapeRoll' },
  { key: 'zhijiaodai', category: 'stationery', name: '纸胶带', canvasType: 'template', hot: true, form3d: 'tapeRoll' },
  { key: 'hongbao', category: 'stationery', name: '红包', canvasType: 'postcard', hot: true, form3d: 'cardStack' },
  { key: 'baozhuangzhi', category: 'stationery', name: '包装纸', canvasType: 'wallpaper' },
  { key: 'wenjianjia2', category: 'stationery', name: '文件架', canvasType: 'card' },
  { key: 'wenjianbao', category: 'stationery', name: '文件包', canvasType: 'wallpaper' },

  // ---- 办公类（28）----
  { key: 'wenjiandai', category: 'office', name: '文件袋', canvasType: 'wallpaper' },
  { key: 'dangandai', category: 'office', name: '档案袋', canvasType: 'wallpaper' },
  { key: 'xinfeng', category: 'office', name: '信封', canvasType: 'postcard', form3d: 'cardStack' },
  { key: 'xinZhi', category: 'office', name: '信纸', canvasType: 'postcard', form3d: 'cardStack' },
  { key: 'upan', category: 'office', name: 'U盘', canvasType: 'template', form3d: 'cardStack' },
  { key: 'rili', category: 'office', name: '日历', canvasType: 'poster', hot: true, form3d: 'deskCalendar' },
  { key: 'jiazi', category: 'office', name: '夹子', canvasType: 'template' },
  { key: 'katao', category: 'office', name: '卡套', canvasType: 'card', form3d: 'cardStack' },
  { key: 'jingzi', category: 'office', name: '镜子', canvasType: 'card' },
  { key: 'jisuanqi', category: 'office', name: '计算器', canvasType: 'template' },
  { key: 'penzai', category: 'office', name: '盆栽', canvasType: 'template' },
  { key: 'jiangbei', category: 'office', name: '奖杯奖牌', canvasType: 'card', form3d: 'cardStack' },
  { key: 'diaopai', category: 'office', name: '吊牌', canvasType: 'card', form3d: 'keychain' },
  { key: 'zhuomianlipai', category: 'office', name: '桌面立牌', canvasType: 'card', hot: true, form3d: 'standee' },
  { key: 'tingchepai', category: 'office', name: '停车牌', canvasType: 'card', form3d: 'standee' },
  { key: 'gongzuopai', category: 'office', name: '工作牌', canvasType: 'card', form3d: 'standee' },
  { key: 'wenhuashan', category: 'office', name: '文化衫', canvasType: 'wallpaper', form3d: 'tshirt' },
  { key: 'mingpianhe', category: 'office', name: '名片盒', canvasType: 'template' },
  { key: 'zhiwujia', category: 'office', name: '置物架', canvasType: 'wallpaper' },
  { key: 'datouzhen', category: 'office', name: '大头钉', canvasType: 'template' },
  { key: 'jiandao', category: 'office', name: '剪刀', canvasType: 'template' },
  { key: 'meigongdao', category: 'office', name: '美工刀', canvasType: 'template' },
  { key: 'jiaoshui', category: 'office', name: '胶水', canvasType: 'template' },
  { key: 'xinglixiang', category: 'office', name: '行李箱', canvasType: 'wallpaper' },
  { key: 'xinglipai', category: 'office', name: '行李牌', canvasType: 'card', form3d: 'keychain' },
  { key: 'liwuhe', category: 'office', name: '礼物盒', canvasType: 'template', form3d: 'blindBox' },
  { key: 'shounehe', category: 'office', name: '收纳盒', canvasType: 'template', form3d: 'blindBox' },

  // ---- 创意类（17）----
  { key: 'bingqilinbei', category: 'creative', name: '冰淇淋杯', canvasType: 'template' },
  { key: 'zhongzhibao', category: 'creative', name: '种植包', canvasType: 'template' },
  { key: 'zhongzizhi', category: 'creative', name: '种子纸', canvasType: 'postcard', form3d: 'cardStack' },
  { key: 'shalou', category: 'creative', name: '沙漏', canvasType: 'template' },
  { key: 'weiguanpenzai', category: 'creative', name: '微观盆栽', canvasType: 'template' },
  { key: 'xuelabei', category: 'creative', name: '雪拉杯', canvasType: 'template' },
  { key: 'luyingdeng', category: 'creative', name: '露营灯', canvasType: 'template', form3d: 'nightLamp' },
  { key: 'luyingdian', category: 'creative', name: '露营垫', canvasType: 'wallpaper' },
  { key: 'luyingtan', category: 'creative', name: '露营毯', canvasType: 'wallpaper' },
  { key: 'luyingxiang', category: 'creative', name: '露营箱', canvasType: 'wallpaper' },
  { key: 'luyingdengdeng', category: 'creative', name: '露营凳', canvasType: 'template' },
  { key: 'shaokaolu', category: 'creative', name: '烧烤炉', canvasType: 'template' },
  { key: 'feipan', category: 'creative', name: '飞盘', canvasType: 'template', hot: true },
  { key: 'xuyuanping', category: 'creative', name: '许愿瓶', canvasType: 'template' },
  { key: 'yushou', category: 'creative', name: '御守', canvasType: 'card', form3d: 'keychain' },
  { key: 'litihua', category: 'creative', name: '立体画', canvasType: 'poster', form3d: 'framedArt' },
  { key: 'yishuzhuangshihua', category: 'creative', name: '艺术装饰画', canvasType: 'poster', hot: true, form3d: 'framedArt' },

  // ---- 饰品类（17）----
  { key: 'huizhang', category: 'accessory', name: '徽章', canvasType: 'card', hot: true, form3d: 'badge' },
  { key: 'jinianbi', category: 'accessory', name: '纪念币', canvasType: 'card', hot: true, form3d: 'badge' },
  { key: 'xiongzhen', category: 'accessory', name: '胸针', canvasType: 'card', form3d: 'badge' },
  { key: 'faka', category: 'accessory', name: '发卡', canvasType: 'card', form3d: 'badge' },
  { key: 'fagu', category: 'accessory', name: '发箍', canvasType: 'card', form3d: 'badge' },
  { key: 'tousheng', category: 'accessory', name: '头绳', canvasType: 'card', form3d: 'badge' },
  { key: 'erhuan', category: 'accessory', name: '耳环', canvasType: 'card', form3d: 'badge' },
  { key: 'erding', category: 'accessory', name: '耳钉', canvasType: 'card', form3d: 'badge' },
  { key: 'jiezhi', category: 'accessory', name: '戒指', canvasType: 'card', form3d: 'badge' },
  { key: 'xianglian', category: 'accessory', name: '项链', canvasType: 'card', hot: true, form3d: 'badge' },
  { key: 'shoulian', category: 'accessory', name: '手链', canvasType: 'card', form3d: 'badge' },
  { key: 'xiukou', category: 'accessory', name: '袖扣', canvasType: 'card', form3d: 'badge' },
  { key: 'huazhuangbao', category: 'accessory', name: '化妆包', canvasType: 'wallpaper', form3d: 'toteBag' },
  { key: 'xiangshui', category: 'accessory', name: '香水', canvasType: 'template', form3d: 'tumbler' },
  { key: 'xiangkuang', category: 'accessory', name: '相框', canvasType: 'card', form3d: 'framedArt' },
  { key: 'chegua', category: 'accessory', name: '车挂', canvasType: 'card', form3d: 'keychain' },
  { key: 'shouhuan', category: 'accessory', name: '手环', canvasType: 'card', form3d: 'badge' },

  // ---- 生活类（30）----
  { key: 'yanzhao', category: 'life', name: '眼罩', canvasType: 'template', form3d: 'scarf' },
  { key: 'kouzhao', category: 'life', name: '口罩', canvasType: 'template' },
  { key: 'tangciBei', category: 'life', name: '搪瓷杯', canvasType: 'template', hot: true, form3d: 'mug' },
  { key: 'baowenbei', category: 'life', name: '保温杯', canvasType: 'template', form3d: 'tumbler' },
  { key: 'zhutongbei', category: 'life', name: '竹筒杯', canvasType: 'template', form3d: 'mug' },
  { key: 'makebei', category: 'life', name: '马克杯', canvasType: 'template', hot: true, form3d: 'mug' },
  { key: 'bolibei', category: 'life', name: '玻璃杯', canvasType: 'template', form3d: 'tumbler' },
  { key: 'zhediebei', category: 'life', name: '折叠杯', canvasType: 'template', form3d: 'tumbler' },
  { key: 'beidian', category: 'life', name: '杯垫', canvasType: 'template', form3d: 'mousePad' },
  { key: 'candian', category: 'life', name: '餐垫', canvasType: 'template', form3d: 'mousePad' },
  { key: 'kuaizi', category: 'life', name: '筷子', canvasType: 'template' },
  { key: 'wan', category: 'life', name: '碗', canvasType: 'template' },
  { key: 'panzi', category: 'life', name: '盘子', canvasType: 'template' },
  { key: 'yusan', category: 'life', name: '雨伞', canvasType: 'poster', form3d: 'umbrella' },
  { key: 'zhediesan', category: 'life', name: '折叠伞', canvasType: 'poster', form3d: 'umbrella' },
  { key: 'maotan', category: 'life', name: '毛毯', canvasType: 'wallpaper', form3d: 'cushion' },
  { key: 'yulian', category: 'life', name: '浴帘', canvasType: 'wallpaper', form3d: 'scroll' },
  { key: 'maojin', category: 'life', name: '毛巾', canvasType: 'wallpaper', form3d: 'scarf' },
  { key: 'shoupa', category: 'life', name: '手帕', canvasType: 'template', form3d: 'scarf' },
  { key: 'shanzi', category: 'life', name: '扇子', canvasType: 'poster', hot: true, form3d: 'standee' },
  { key: 'biandanghe', category: 'life', name: '便当盒', canvasType: 'template', form3d: 'blindBox' },
  { key: 'dianrefanhe', category: 'life', name: '电热饭盒', canvasType: 'template', form3d: 'blindBox' },
  { key: 'nuanshoubao', category: 'life', name: '暖手宝', canvasType: 'template', form3d: 'powerBank' },
  { key: 'tengbianhe', category: 'life', name: '藤编盒', canvasType: 'template', form3d: 'blindBox' },
  { key: 'anmobang', category: 'life', name: '按摩棒', canvasType: 'template' },
  { key: 'diandongyashua', category: 'life', name: '电动牙刷', canvasType: 'template' },
  { key: 'zhajiangji', category: 'life', name: '榨汁机', canvasType: 'template' },
  { key: 'quwenshouhuan', category: 'life', name: '驱蚊手环', canvasType: 'card', form3d: 'keychain' },
  { key: 'shuzi', category: 'life', name: '梳子', canvasType: 'template' },
  { key: 'guashaban', category: 'life', name: '刮痧板', canvasType: 'card' },

  // ---- 电子类（30）----
  { key: 'erji', category: 'digital', name: '耳机', canvasType: 'template' },
  { key: 'erjihe', category: 'digital', name: '耳机盒', canvasType: 'template', form3d: 'powerBank' },
  { key: 'chongdianxian', category: 'digital', name: '充电线', canvasType: 'template', form3d: 'powerBank' },
  { key: 'shoujisheng', category: 'digital', name: '手机绳', canvasType: 'card', form3d: 'keychain' },
  { key: 'shoujike', category: 'digital', name: '手机壳', canvasType: 'poster', hot: true, form3d: 'phoneCase' },
  { key: 'shoujizhihuan', category: 'digital', name: '手机指环支架', canvasType: 'card', form3d: 'keychain' },
  { key: 'shoujinangqizhijia', category: 'digital', name: '手机气囊支架', canvasType: 'card', form3d: 'keychain' },
  { key: 'shoujibao', category: 'digital', name: '手机包', canvasType: 'template', form3d: 'powerBank' },
  { key: 'chongdianbao', category: 'digital', name: '充电宝', canvasType: 'template', form3d: 'powerBank' },
  { key: 'shujuxian', category: 'digital', name: '数据线', canvasType: 'template', form3d: 'powerBank' },
  { key: 'lanyayinxiang', category: 'digital', name: '蓝牙音箱', canvasType: 'template', form3d: 'powerBank' },
  { key: 'yinxiang', category: 'digital', name: '音箱', canvasType: 'template', form3d: 'powerBank' },
  { key: 'bayinhe', category: 'digital', name: '八音盒', canvasType: 'template', form3d: 'blindBox' },
  { key: 'chexiangxun', category: 'digital', name: '车载香薰', canvasType: 'card', form3d: 'keychain' },
  { key: 'fenweideng', category: 'digital', name: '氛围灯', canvasType: 'template', form3d: 'nightLamp' },
  { key: 'luodideng', category: 'digital', name: '落地灯', canvasType: 'poster' },
  { key: 'shudeng', category: 'digital', name: '书灯', canvasType: 'card', form3d: 'nightLamp' },
  { key: 'taideng', category: 'digital', name: '台灯', canvasType: 'template', form3d: 'nightLamp' },
  { key: 'zhediaodeng', category: 'digital', name: '纸雕灯', canvasType: 'card', hot: true, form3d: 'nightLamp' },
  { key: 'jianpan', category: 'digital', name: '键盘', canvasType: 'wallpaper' },
  { key: 'shubiao', category: 'digital', name: '鼠标', canvasType: 'template' },
  { key: 'shubiaodian', category: 'digital', name: '鼠标垫', canvasType: 'wallpaper', form3d: 'mousePad' },
  { key: 'diannaobao', category: 'digital', name: '电脑包', canvasType: 'wallpaper', form3d: 'powerBank' },
  { key: 'zaoyeqi', category: 'digital', name: '皂液器', canvasType: 'template' },
  { key: 'anmoyi', category: 'digital', name: '按摩仪', canvasType: 'template', form3d: 'powerBank' },
  { key: 'huyanyi', category: 'digital', name: '护眼仪', canvasType: 'template', form3d: 'powerBank' },
  { key: 'xiaokaoxiang', category: 'digital', name: '小烤箱', canvasType: 'template' },
  { key: 'zipaigan', category: 'digital', name: '自拍杆', canvasType: 'template' },
  { key: 'tizhicheng', category: 'digital', name: '体脂秤', canvasType: 'template' },
  { key: 'xiangji', category: 'digital', name: '相机', canvasType: 'template' },

  // ---- 运动类（15）----
  { key: 'tiaosheng', category: 'sports', name: '跳绳', canvasType: 'template' },
  { key: 'wanliqiu', category: 'sports', name: '腕力球', canvasType: 'template' },
  { key: 'huashengqiu', category: 'sports', name: '花生球', canvasType: 'template' },
  { key: 'yujiaDian', category: 'sports', name: '瑜伽垫', canvasType: 'wallpaper', form3d: 'mousePad' },
  { key: 'yaling', category: 'sports', name: '哑铃', canvasType: 'template' },
  { key: 'danbaibei', category: 'sports', name: '蛋白杯', canvasType: 'template', form3d: 'tumbler' },
  { key: 'dundunbei', category: 'sports', name: '吨吨杯', canvasType: 'template', form3d: 'tumbler' },
  { key: 'fadai', category: 'sports', name: '发带', canvasType: 'card', form3d: 'scarf' },
  { key: 'huxi', category: 'sports', name: '护膝', canvasType: 'card', form3d: 'scarf' },
  { key: 'huwan', category: 'sports', name: '护腕', canvasType: 'card', form3d: 'scarf' },
  { key: 'yundongshuibei', category: 'sports', name: '运动水杯', canvasType: 'template', form3d: 'tumbler' },
  { key: 'yundongmaojin', category: 'sports', name: '运动毛巾', canvasType: 'wallpaper', form3d: 'scarf' },
  { key: 'yundongshouhuan', category: 'sports', name: '运动手环', canvasType: 'card', form3d: 'keychain' },
  { key: 'yundongbao', category: 'sports', name: '运动包', canvasType: 'wallpaper', form3d: 'toteBag' },
  { key: 'tanliDai', category: 'sports', name: '弹力带', canvasType: 'card', form3d: 'scarf' },

  // ---- 玩具类（18）----
  { key: 'pvcwanou', category: 'toy', name: 'PVC玩偶', canvasType: 'card' },
  { key: 'dijiaowanou', category: 'toy', name: '滴胶玩偶', canvasType: 'card' },
  { key: 'shuzhiwanou', category: 'toy', name: '树脂玩偶', canvasType: 'card' },
  { key: 'yakeliwanou', category: 'toy', name: '亚克力玩偶', canvasType: 'card', hot: true, form3d: 'standee' },
  { key: 'maorongwanou', category: 'toy', name: '毛绒玩偶', canvasType: 'card', hot: true, form3d: 'cushion' },
  { key: 'mofang', category: 'toy', name: '魔方', canvasType: 'template', form3d: 'blindBox' },
  { key: 'kapai', category: 'toy', name: '卡牌', canvasType: 'card', hot: true, form3d: 'cardStack' },
  { key: 'majiang', category: 'toy', name: '麻将', canvasType: 'template' },
  { key: 'wangyuanjing', category: 'toy', name: '望远镜', canvasType: 'template' },
  { key: 'legao', category: 'toy', name: '乐高', canvasType: 'template' },
  { key: 'shouyouji', category: 'toy', name: '手游机', canvasType: 'template' },
  { key: 'pintu', category: 'toy', name: '拼图', canvasType: 'poster', hot: true, form3d: 'puzzle' },
  { key: 'pukpai', category: 'toy', name: '扑克牌', canvasType: 'postcard', form3d: 'cardStack' },
  { key: 'jimu', category: 'toy', name: '积木', canvasType: 'template', form3d: 'blindBox' },
  { key: 'jieyaqiu', category: 'toy', name: '解压球', canvasType: 'template' },
  { key: 'qiqiaohe', category: 'toy', name: '七巧盒', canvasType: 'template', form3d: 'blindBox' },
  { key: 'niudan', category: 'toy', name: '扭蛋', canvasType: 'card' },
  { key: 'manghe', category: 'toy', name: '盲盒', canvasType: 'card', hot: true, form3d: 'blindBox' },

  // ---- 家纺类（23）----
  { key: 'maozi', category: 'textile', name: '帽子', canvasType: 'card' },
  { key: 'yufumao', category: 'textile', name: '渔夫帽', canvasType: 'card' },
  { key: 'toujin', category: 'textile', name: '头巾', canvasType: 'template', form3d: 'scarf' },
  { key: 'sijin', category: 'textile', name: '丝巾', canvasType: 'template', hot: true, form3d: 'scarf' },
  { key: 'weijin', category: 'textile', name: '围巾', canvasType: 'template', form3d: 'scarf' },
  { key: 'lingdai', category: 'textile', name: '领带', canvasType: 'template', form3d: 'scarf' },
  { key: 'tXu', category: 'textile', name: 'T恤', canvasType: 'wallpaper', hot: true, form3d: 'tshirt' },
  { key: 'bingXiu', category: 'textile', name: '冰袖', canvasType: 'template', form3d: 'scarf' },
  { key: 'wazi', category: 'textile', name: '袜子', canvasType: 'template' },
  { key: 'baobao', category: 'textile', name: '包包', canvasType: 'wallpaper', form3d: 'toteBag' },
  { key: 'qianbao', category: 'textile', name: '钱包', canvasType: 'card', form3d: 'toteBag' },
  { key: 'butie', category: 'textile', name: '布贴', canvasType: 'template', form3d: 'cardStack' },
  { key: 'chuangpin', category: 'textile', name: '床品套装', canvasType: 'wallpaper', form3d: 'cushion' },
  { key: 'menlian', category: 'textile', name: '门帘', canvasType: 'wallpaper', form3d: 'scroll' },
  { key: 'lingjie', category: 'textile', name: '领结', canvasType: 'card', form3d: 'badge' },
  { key: 'yuyi', category: 'textile', name: '雨衣', canvasType: 'wallpaper' },
  { key: 'fangshaiyi', category: 'textile', name: '防晒衣', canvasType: 'wallpaper', form3d: 'tshirt' },
  { key: 'dubangzhibao', category: 'textile', name: '杜邦纸包', canvasType: 'template', form3d: 'toteBag' },
  { key: 'fanbubao', category: 'textile', name: '帆布包', canvasType: 'template', hot: true, form3d: 'toteBag' },
  { key: 'pvcbao', category: 'textile', name: 'PVC包', canvasType: 'template', form3d: 'toteBag' },
  { key: 'pixiang', category: 'textile', name: '皮箱', canvasType: 'wallpaper', form3d: 'toteBag' },
  { key: 'maozhanbao', category: 'textile', name: '毛毡包', canvasType: 'template', form3d: 'toteBag' },
  { key: 'shuangjianbao', category: 'textile', name: '双肩包', canvasType: 'wallpaper', form3d: 'toteBag' },

  // ---- 家居类（27）----
  { key: 'fengbaoping', category: 'home', name: '风暴瓶', canvasType: 'template' },
  { key: 'jiashiqi', category: 'home', name: '加湿器', canvasType: 'template' },
  { key: 'diannuanqi', category: 'home', name: '电暖器', canvasType: 'template' },
  { key: 'chaju', category: 'home', name: '茶具', canvasType: 'template', hot: true, form3d: 'mug' },
  { key: 'ciqi', category: 'home', name: '瓷器', canvasType: 'template', form3d: 'mug' },
  { key: 'xiangxunlu', category: 'home', name: '香薰炉', canvasType: 'card' },
  { key: 'xiangxunlazhu', category: 'home', name: '香薰蜡烛', canvasType: 'template', form3d: 'tumbler' },
  { key: 'kuoxiangshi', category: 'home', name: '扩香石', canvasType: 'card' },
  { key: 'xiangpai', category: 'home', name: '香牌', canvasType: 'card', form3d: 'keychain' },
  { key: 'bingxiangtie', category: 'home', name: '冰箱贴', canvasType: 'card', hot: true, form3d: 'fridgeMagnet' },
  { key: 'kaipingqi', category: 'home', name: '开瓶器', canvasType: 'template' },
  { key: 'chouzhihe', category: 'home', name: '抽纸盒', canvasType: 'template', form3d: 'blindBox' },
  { key: 'yaoshikou', category: 'home', name: '钥匙扣', canvasType: 'card', hot: true, form3d: 'keychain' },
  { key: 'chayeGuan', category: 'home', name: '茶叶罐', canvasType: 'template', form3d: 'tumbler' },
  { key: 'zhuomianfengshan', category: 'home', name: '桌面风扇', canvasType: 'template' },
  { key: 'shouchifengshan', category: 'home', name: '手持风扇', canvasType: 'template' },
  { key: 'shourbao', category: 'home', name: '收纳包', canvasType: 'template', form3d: 'toteBag' },
  { key: 'cunqianguan', category: 'home', name: '存钱罐', canvasType: 'card', form3d: 'blindBox' },
  { key: 'tuoxie', category: 'home', name: '拖鞋', canvasType: 'template' },
  { key: 'xiaoyedeng', category: 'home', name: '小夜灯', canvasType: 'card', form3d: 'nightLamp' },
  { key: 'yueqiudeng', category: 'home', name: '月球灯', canvasType: 'card', form3d: 'nightLamp' },
  { key: 'uxingzhen', category: 'home', name: 'U型枕', canvasType: 'template', form3d: 'cushion' },
  { key: 'baozhen', category: 'home', name: '抱枕', canvasType: 'template', hot: true, form3d: 'cushion' },
  { key: 'kaodian', category: 'home', name: '靠垫', canvasType: 'template', form3d: 'cushion' },
  { key: 'xiangnang', category: 'home', name: '香囊', canvasType: 'card', form3d: 'keychain' },
  { key: 'denglong', category: 'home', name: '灯笼', canvasType: 'poster', form3d: 'nightLamp' },
  { key: 'canjinZhi', category: 'home', name: '餐巾纸', canvasType: 'template' }
];

// 名称 → 产品 索引（O(1) 查找）
const PRODUCT_INDEX = new Map(CRAFT_PRODUCTS.map(p => [p.name, p]));

/**
 * 按大类取产品列表
 * @param {string} categoryKey
 * @returns {object[]}
 */
export function getProductsByCategory(categoryKey) {
  return CRAFT_PRODUCTS.filter(p => p.category === categoryKey);
}

/**
 * 按关键词搜索产品名（包含匹配）
 * @param {string} keyword
 * @returns {object[]}
 */
export function searchProducts(keyword) {
  const k = (keyword || '').trim();
  if (!k) return [];
  return CRAFT_PRODUCTS.filter(p => p.name.includes(k));
}

/**
 * 爆款产品清单（市场调研权重）
 * @returns {object[]}
 */
export function hotProducts() {
  return CRAFT_PRODUCTS.filter(p => p.hot);
}

/**
 * 按精确产品名取产品定义
 * @param {string} name
 * @returns {object|null}
 */
export function getProductByName(name) {
  return PRODUCT_INDEX.get(name) || null;
}

/**
 * 大类定义查找
 * @param {string} categoryKey
 * @returns {object|null}
 */
export function getCategory(categoryKey) {
  return CRAFT_CATEGORIES.find(c => c.key === categoryKey) || null;
}
