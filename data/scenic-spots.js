// ============================================================
// data/scenic-spots.js — 智慧导览景点库（热门景点模块）
// 26 精选景区（河南 6 + 全国 20）× 4-6 景点 + 主题路线
// 用途：js/scenic-recommend.js 三级导览（景区列表 → 景区详情 → 景点详情）
// 约束：
//   - themeId 关联 data/culture-knowledge.js 主题（可空），
//     有关联的景区可复用事实卡讲解 / 图鉴跳转 / 创作引流
//   - lng/lat 为景区中心坐标（高德 GCJ-02）；景点导航 = 中心坐标 +
//     确定性小偏移 + 步行指引文案（不凭空编造精确坐标）
//   - walk 为景区内步行微导航文案；free=true 标注免费开放
// ============================================================

export const SCENIC_AREAS = [
  // ---------------- 河南（6） ----------------
  {
    areaId: 'longmen', themeId: 'longmen', name: '龙门石窟', region: '河南洛阳',
    slogan: '中国石刻艺术的巅峰之作', tags: ['世界文化遗产', '5A景区', '石窟艺术'],
    icon: '🗿', lng: 112.471, lat: 34.556,
    spots: [
      { id: 'fengxiansi', name: '奉先寺卢舍那大佛', icon: '🛕', rating: 4.9, free: false, tags: ['必打卡', '唐代皇家石窟'], desc: '龙门石窟规模最大的一龛，卢舍那大佛通高17.14米，相传以武则天容貌为蓝本，被誉为"东方蒙娜丽莎"。', walk: '入园后过漫水桥沿西山栈道南行约800米，台阶上方即达。' },
      { id: 'wanfodong', name: '万佛洞', icon: '🙏', rating: 4.7, free: false, tags: ['一万五千尊小佛', '唐代洞窟'], desc: '因窟内南北壁满刻15000余尊小佛得名，完工于唐永隆元年，后壁莲花观音像姿态优美，是唐代雕刻代表作。', walk: '位于奉先寺北约300米西山栈道中段，沿途有指示牌。' },
      { id: 'binyang', name: '宾阳三洞', icon: '🪨', rating: 4.6, free: false, tags: ['北魏皇家洞窟', '三世佛'], desc: '北魏宣武帝为父祈福开凿，历时24年，中洞释迦牟尼像面容清瘦飘逸，是"秀骨清像"风格的代表。', walk: '西山石窟区北段，近石窟入口约200米处。' },
      { id: 'xiangshan', name: '香山寺', icon: '⛩️', rating: 4.6, free: false, tags: ['武则天幸游地', '蒋宋别墅'], desc: '东山名刹，武则天常驾幸游宴；白居易自号"香山居士"在此度晚年，寺内留有蒋宋别墅与乾隆御碑亭。', walk: '出西山石窟过桥至东山，沿山道上行约15分钟。' },
      { id: 'baiyuan', name: '白园', icon: '🎋', rating: 4.5, free: false, tags: ['白居易墓园', '诗文化'], desc: '白居易长眠之地，依山傍水，琵琶峰上有诗人墓冢，园内诗廊刻有其诗文三千余首中的名篇。', walk: '香山寺南侧沿伊河东岸下行约500米。' }
    ],
    routes: [
      { name: '西山精华线', duration: '3小时', theme: '石刻艺术深度游', stops: ['binyang', 'wanfodong', 'fengxiansi'] },
      { name: '东西山全景环线', duration: '4.5小时', theme: '世界遗产全览', stops: ['binyang', 'wanfodong', 'fengxiansi', 'xiangshan', 'baiyuan'] }
    ]
  },
  {
    areaId: 'shaolin', themeId: 'shaolin', name: '嵩山少林寺', region: '河南登封',
    slogan: '天下功夫出少林', tags: ['禅宗祖庭', '5A景区', '功夫圣地'],
    icon: '🥋', lng: 113.027, lat: 34.508,
    spots: [
      { id: 'changzhuyuan', name: '少林常住院', icon: '🏯', rating: 4.7, free: false, tags: ['千年古刹', '立雪亭'], desc: '少林寺核心建筑群，始建于北魏太和十九年，千佛殿内有少林武僧练功留下的脚坑，立雪亭相传为二祖慧可断臂求法处。', walk: '景区入口沿中轴线步行约600米，山门殿起依次参观。' },
      { id: 'talin', name: '塔林', icon: '🛕', rating: 4.8, free: false, tags: ['全国最大墓塔林', '国保单位'], desc: '唐至清代248座砖石墓塔，是中国现存规模最大的古塔群，每座塔的层数与形制记录着高僧的修行功果。', walk: '常住院西侧约300米，出西便门即达。' },
      { id: 'chuzuan', name: '初祖庵', icon: '⛩️', rating: 4.5, free: false, tags: ['宋代木构', '达摩面壁'], desc: '为纪念达摩而建的宋代木构建筑，大殿梁架与石柱雕刻为北宋原物，是河南现存最古老的木结构建筑。', walk: '塔林后沿山路西行约1公里，坡度较缓。' },
      { id: 'sanhuangzhai', name: '三皇寨', icon: '⛰️', rating: 4.8, free: false, tags: ['嵩山书册崖', '悬空栈道'], desc: '嵩山少林景区自然景观精华，书册崖地质奇观与悬空栈道震撼壮观，"不到三皇寨，不算少林客"。', walk: '建议乘索道至三皇寨口，再步行栈道环线约2小时。' },
      { id: 'wushuguan', name: '武术馆功夫表演', icon: '🥊', rating: 4.6, free: true, tags: ['实景演出', '免费观看'], desc: '少林武僧团每日多场功夫展演，童子功、铁头功、针穿玻璃等真功夫近距离呈现，凭景区门票免费观看。', walk: '常住院对面武术馆，按场次提前15分钟入场。' }
    ],
    routes: [
      { name: '功夫文化线', duration: '3小时', theme: '禅武合一', stops: ['changzhuyuan', 'wushuguan', 'talin', 'chuzuan'] },
      { name: '嵩山山水线', duration: '5小时', theme: '地质奇观徒步', stops: ['sanhuangzhai', 'talin', 'changzhuyuan'] }
    ]
  },
  {
    areaId: 'yinxu', themeId: null, name: '殷墟', region: '河南安阳',
    slogan: '中国考古学的摇篮', tags: ['世界文化遗产', '甲骨文发源地'],
    icon: '🦴', lng: 114.352, lat: 36.118,
    spots: [
      { id: 'gongdian', name: '宫殿宗庙遗址', icon: '🏛️', rating: 4.7, free: false, tags: ['商代都邑', '甲骨窖穴'], desc: '商代晚期都城核心区，YH127甲骨窖穴出土17096片甲骨，被称为"中国最早的档案库"。', walk: '殷墟宫殿区大门入园后沿主道直行约300米。' },
      { id: 'bowuguan', name: '殷墟博物馆新馆', icon: '🏺', rating: 4.8, free: false, tags: ['2024年开馆', '青铜之冠'], desc: '2024年开放的新馆展出青铜器、陶器、甲骨等4000余件文物，其中"司母辛"鼎等重器震撼呈现商代文明。', walk: '宫殿宗庙遗址西侧洹河北岸，过桥即达。' },
      { id: 'jiaguwen', name: '甲骨文碑林', icon: '✍️', rating: 4.5, free: true, tags: ['汉字之源', '免费开放'], desc: '长廊镌刻甲骨文原片与今译对照，可在此临摹"写字"，感受3000多年前汉字的最初模样。', walk: '宫殿宗庙遗址园区东侧碑廊，步行约5分钟。' },
      { id: 'fuhaomu', name: '妇好墓', icon: '👑', rating: 4.6, free: false, tags: ['女将军墓', '殷墟唯一未盗王室墓'], desc: '商王武丁之妻、中国最早女将军妇好之墓，出土随葬品1928件，鸮尊与青铜钺是镇馆之宝。', walk: '宫殿宗庙遗址园区西南角，跟随指示牌约400米。' },
      { id: 'chemakeng', name: '车马坑展厅', icon: '🐎', rating: 4.5, free: false, tags: ['最早车马实物', '殷代战车'], desc: '出土殷代马车与马匹遗骸，是中国迄今发现最早的畜力车实证，车马仪仗再现商代军事力量。', walk: '宫殿宗庙遗址园区中部东侧。' }
    ],
    routes: [
      { name: '商文明寻根线', duration: '2.5小时', theme: '甲骨文探源', stops: ['jiaguwen', 'gongdian', 'fuhaomu', 'chemakeng'] },
      { name: '博物馆深度线', duration: '4小时', theme: '青铜文明全览', stops: ['bowuguan', 'gongdian', 'fuhaomu'] }
    ]
  },
  {
    areaId: 'qingmingshanghe', themeId: null, name: '清明上河园', region: '河南开封',
    slogan: '一朝步入画卷，一日梦回千年', tags: ['宋文化主题园', '5A景区'],
    icon: '🎑', lng: 114.314, lat: 34.797,
    spots: [
      { id: 'hongqiao', name: '虹桥', icon: '🌉', rating: 4.7, free: true, tags: ['园内地标', '无柱飞桥'], desc: '复刻《清明上河图》中著名的木结构虹桥，无柱飞架汴河之上，是全园拍照打卡第一站。', walk: '迎宾门入园沿汴河南岸东行约400米。' },
      { id: 'shangshanmen', name: '上善门', icon: '🏯', rating: 4.5, free: true, tags: ['城门楼', '登高远眺'], desc: '园内最高城门建筑，登上城楼可俯瞰全园宋式街景，城门下的包公巡案表演每日多场。', walk: '虹桥北行过汴河约300米即达城门下。' },
      { id: 'bianhe', name: '汴河漕运', icon: '⛵', rating: 4.6, free: false, tags: ['游船体验', '宋式漕运'], desc: '乘宋式画舫沿汴河而行，两岸市井表演此起彼伏，体验《清明上河图》中的漕运盛景。', walk: '虹桥西侧码头购票登船。' },
      { id: 'dongjingmenghua', name: '《东京梦华》演出', icon: '🎭', rating: 4.8, free: false, tags: ['大型实景演出', '需另购票'], desc: '700余名演员参演的大型宋文化实景演出，七幕词章重现汴京盛世，菊花公主与水中明月场景唯美震撼。', walk: '园区北端露天演出现场，开演前40分钟入场。' },
      { id: 'shijing', name: '宋代市井街', icon: '🏮', rating: 4.6, free: true, tags: [' NPC 沉浸互动', '百戏表演'], desc: '挑担货郎、宋装 NPC 穿行街市，王员外招婿、气功喷火等民俗表演轮番上演，恍若穿越回北宋东京。', walk: '上善门内主街两侧，随表演时刻表游逛。' }
    ],
    routes: [
      { name: '画卷一日线', duration: '6小时', theme: '梦回大宋', stops: ['hongqiao', 'shangshanmen', 'shijing', 'bianhe', 'dongjingmenghua'] },
      { name: '亲子半日线', duration: '3小时', theme: '民俗百戏', stops: ['hongqiao', 'shijing', 'bianhe'] }
    ]
  },
  {
    areaId: 'laojunshan', themeId: null, name: '老君山', region: '河南洛阳·栾川',
    slogan: '远赴人间惊鸿宴，一睹人间盛世颜', tags: ['道教圣地', '云海金顶'],
    icon: '⛰️', lng: 111.650, lat: 33.753,
    spots: [
      { id: 'jinding', name: '金顶道观群', icon: '🏛️', rating: 4.9, free: false, tags: ['必打卡', '云海金顶'], desc: '海拔2200米山巅的金殿建筑群，日落时分金光四射，雪后云海翻涌，被誉为"人间仙境天花板"。', walk: '乘中天索道+二级索道后步行栈道约40分钟登顶。' },
      { id: 'shihuaping', name: '十里画屏', icon: '🖼️', rating: 4.8, free: false, tags: ['石林景观', '滑道下坡'], desc: '滑脱峰林形成的花岗岩峰墙奇观，步移景异如展开的山水长卷，可乘滑道体验穿越石林的乐趣。', walk: '金顶下行方向沿栈道环线游览约1.5小时。' },
      { id: 'yunhai', name: '云海索道观景', icon: '🚡', rating: 4.7, free: false, tags: ['高空索道', '穿云体验'], desc: '全长2632米的中天索道穿越云层，雨后初晴时脚下云海翻腾，是老君山最出片的观景方式。', walk: '山下票务中心旁乘坐。' },
      { id: 'zhuimenggu', name: '追梦谷', icon: '💧', rating: 4.6, free: true, tags: ['溪谷瀑布', '免费区域'], desc: '全长3公里的溪谷景观，三级瀑布层层跌落，夏季清凉宜人，与主峰区联游动静结合。', walk: '景区入口左侧步道入口，沿谷上行即达首级瀑布。' },
      { id: 'liangbaotai', name: '亮宝台', icon: '✨', rating: 4.6, free: false, tags: ['观日胜地', '道教传说'], desc: '相传老子曾在此亮宝传道，平台三面绝壁凌空，是观日出与看金顶全貌的绝佳机位。', walk: '金顶建筑群东侧沿山脊栈道约10分钟。' }
    ],
    routes: [
      { name: '金顶精华线', duration: '4小时', theme: '云海仙山', stops: ['yunhai', 'jinding', 'liangbaotai', 'shihuaping'] },
      { name: '山水全览线', duration: '7小时', theme: '一山观四季', stops: ['zhuimenggu', 'yunhai', 'jinding', 'shihuaping'] }
    ]
  },
  {
    areaId: 'yuntai', themeId: null, name: '云台山', region: '河南焦作·修武',
    slogan: '云台地貌，峡谷奇观', tags: ['世界地质公园', '5A景区'],
    icon: '🏞️', lng: 113.382, lat: 35.421,
    spots: [
      { id: 'hongshixia', name: '红石峡', icon: '🔴', rating: 4.9, free: false, tags: ['必打卡', '丹崖碧水'], desc: '北方罕见红色石英砂岩峡谷，丹崖碧水、飞瀑流泉，温盘峪内四季恒温，被誉为"自然界山水精品廊"。', walk: '乘景区大巴至红石峡站，下台阶入谷环线约1.5小时。' },
      { id: 'tanpuxia', name: '潭瀑峡', icon: '💦', rating: 4.7, free: false, tags: ['三步一潭', '情人瀑'], desc: '"三步一泉、五步一瀑、十步一潭"，情人瀑与水帘洞相映成趣，唐王试剑石留有美丽传说。', walk: '乘大巴至潭瀑峡站，入口步行约2.5公里往返。' },
      { id: 'zhuyufeng', name: '茱萸峰', icon: '🌄', rating: 4.7, free: false, tags: ['王维名篇诞生地', '海拔1297米'], desc: '王维"遥知兄弟登高处"即咏此峰，峰顶真武庙香火绵延，药王洞相传为孙思邈采药炼丹处。', walk: '乘大巴至茱萸峰站，登栈道约1小时登顶。' },
      { id: 'mihougu', name: '猕猴谷', icon: '🐒', rating: 4.5, free: false, tags: ['国家二级保护动物', '亲子首选'], desc: '太行猕猴自然栖息地，可近距离观察野生猕猴群，科普馆内有免费猕猴行为展演。', walk: '潭瀑峡站旁入口，沿谷步行约20分钟。' },
      { id: 'quanpuxia', name: '泉瀑峡', icon: '🌊', rating: 4.6, free: false, tags: ['云台天瀑', '华夏第一高瀑'], desc: '尽头"云台天瀑"落差314米，上吻蓝天、下蹈石坪，丰水期气势磅礴如银河倒挂。', walk: '乘大巴至泉瀑峡站，沿沟谷步行往返约2小时。' }
    ],
    routes: [
      { name: '峡谷精华线', duration: '4小时', theme: '红岩碧水', stops: ['hongshixia', 'tanpuxia', 'mihougu'] },
      { name: '山水全景两日线', duration: '2天', theme: '云台全览', stops: ['hongshixia', 'quanpuxia', 'zhuyufeng', 'tanpuxia'] }
    ]
  },
  // ---------------- 全国（19） ----------------
  {
    areaId: 'gugong', themeId: 'gugong', name: '故宫博物院', region: '北京',
    slogan: '一座紫禁城，半部中国史', tags: ['世界文化遗产', '明清皇宫'],
    icon: '🏯', lng: 116.397, lat: 39.918,
    spots: [
      { id: 'taihedian', name: '太和殿', icon: '👑', rating: 4.9, free: false, tags: ['金銮宝殿', '中轴C位'], desc: '紫禁城等级最高的建筑，重檐庑殿顶、金龙和玺彩绘，皇帝登基大典在此举行，殿前广场可容数万人。', walk: '午门入直行穿太和门，中轴线尽头即达。' },
      { id: 'qianqinggong', name: '乾清宫', icon: '🛏️', rating: 4.7, free: false, tags: ['内廷正殿', '正大光明匾'], desc: '明代至清初皇帝寝宫，殿内"正大光明"匾后曾藏秘密立储诏书，是清宫剧中最著名的场景之一。', walk: '过保和殿沿中轴线北行约400米。' },
      { id: 'yuhuayuan', name: '御花园', icon: '🌳', rating: 4.7, free: false, tags: ['宫廷园林', '连理柏'], desc: '内廷后苑，古柏藤萝与亭台假山相映，堆秀山重阳登高、连理柏姻缘许愿皆是热门打卡点。', walk: '坤宁宫北侧，中轴线北端。' },
      { id: 'jiaolou', name: '角楼', icon: '📸', rating: 4.8, free: false, tags: ['九梁十八柱', '摄影胜地'], desc: '城墙四角的结构精巧奇观，三层重檐七十二条脊，夕阳下护城河倒影是北京最经典的机位之一。', walk: '神武门出宫后沿筒子河步行至西北角，约15分钟。' },
      { id: 'zhenbaoguan', name: '珍宝馆', icon: '💎', rating: 4.7, free: false, tags: ['需另购票', '皇家珍玩'], desc: '宁寿宫区域常设展，金瓯永固杯、大禹治水图玉山等国宝级文物云集，展示皇家审美的极致。', walk: '宁寿宫区位于故宫东北部，钟表馆南侧。' }
    ],
    routes: [
      { name: '中轴经典线', duration: '3小时', theme: '皇家礼制', stops: ['taihedian', 'qianqinggong', 'yuhuayuan'] },
      { name: '深度全览线', duration: '5小时', theme: '国宝寻踪', stops: ['taihedian', 'zhenbaoguan', 'qianqinggong', 'yuhuayuan', 'jiaolou'] }
    ]
  },
  {
    areaId: 'badaling', themeId: 'changcheng', name: '八达岭长城', region: '北京·延庆',
    slogan: '不到长城非好汉', tags: ['世界文化遗产', '5A景区'],
    icon: '🧱', lng: 116.024, lat: 40.359,
    spots: [
      { id: 'haohanpo', name: '好汉坡', icon: '💪', rating: 4.8, free: false, tags: ['必打卡', '北段制高点'], desc: '北八楼至北十二楼间的陡峭路段，登顶后群山尽览，"好汉坡"石碑前合影是登长城的仪式感。', walk: '北线缆车下站后沿城墙北行约40分钟。' },
      { id: 'beibalou', name: '北八楼', icon: '🗼', rating: 4.8, free: false, tags: ['观景最佳', '海拔888米'], desc: '八达岭海拔最高的敌楼，视野最为开阔，秋日层林尽染时俯瞰长城如巨龙盘踞山脊。', walk: '入口北行第四座敌楼，步行约30分钟。' },
      { id: 'dilou', name: '南北敌楼群', icon: '🏰', rating: 4.6, free: false, tags: ['明军防御体系', '垛口射孔'], desc: '八达岭共有敌楼43座，观察垛口、瞭望孔与射洞的构造，可读懂冷兵器时代的边关防御智慧。', walk: '沿城墙南北两线游览均可连续经过。' },
      { id: 'fenghuotai', name: '烽火台', icon: '🔥', rating: 4.5, free: false, tags: ['古代信号系统', '历史现场'], desc: '古时昼燃烟、夜举火传递军情，站在烽火台遗址遥想"烽火戏诸侯"与边关狼烟的历史场景。', walk: '南线方向尽头制高点。' },
      { id: 'lanshe', name: '缆车观景', icon: '🚡', rating: 4.6, free: false, tags: ['省力登城', '空中视角'], desc: '索道直上北七楼附近，空中俯瞰长城蜿蜒山脊，省去陡峭台阶，适合带老人孩子出行。', walk: '景区入口右侧缆车下站购票。' }
    ],
    routes: [
      { name: '好汉挑战线', duration: '3小时', theme: '征服之旅', stops: ['lanshe', 'beibalou', 'haohanpo', 'fenghuotai'] },
      { name: '经典半日线', duration: '2小时', theme: '轻装游长城', stops: ['lanshe', 'beibalou', 'dilou'] }
    ]
  },
  {
    areaId: 'westlake', themeId: 'westlake', name: '杭州西湖', region: '浙江杭州',
    slogan: '欲把西湖比西子，淡妆浓抹总相宜', tags: ['世界文化遗产', '免费开放'],
    icon: '🌸', lng: 120.149, lat: 30.246,
    spots: [
      { id: 'duanqiao', name: '断桥残雪', icon: '🌉', rating: 4.7, free: true, tags: ['白娘子传说', '免费'], desc: '西湖十景之首，冬日雪后桥中间雪化冰融、远望似断非断；更是《白蛇传》许仙白娘子相会之地。', walk: '湖滨北路白堤东端起点，地铁凤起路站步行约10分钟。' },
      { id: 'sudi', name: '苏堤春晓', icon: '🌿', rating: 4.8, free: true, tags: ['六桥烟柳', '免费'], desc: '苏东坡疏浚西湖时以淤泥筑成，全长2.8公里串起映波、锁澜等六桥，春日桃红柳绿最是动人。', walk: '断桥沿白堤过平湖秋月即达苏堤北端。' },
      { id: 'leifengta', name: '雷峰塔', icon: '🗼', rating: 4.6, free: false, tags: ['西湖地标', '可乘电梯'], desc: '"雷峰夕照"所在，塔内藏吴越国鎏金纯银阿育王塔，登塔俯瞰西湖全景，白娘子传说更添传奇。', walk: '苏堤南端出净寺站即达，南屏山路。' },
      { id: 'santan', name: '三潭印月', icon: '🌕', rating: 4.7, free: false, tags: ['湖中三岛', '一元纸币背面'], desc: '西湖三岛中最大的一座，三座石塔亭立湖面，中秋塔中点烛与月影交映，正是人民币一元背面图案。', walk: '需在湖滨、花港等码头乘游船登岛。' },
      { id: 'huagang', name: '花港观鱼', icon: '🐟', rating: 4.6, free: true, tags: ['红鱼成群', '免费'], desc: '临池放养数千尾红鲤，投食时群鱼翻涌如红霞搅碎，康熙御碑亭与牡丹园曲径通幽。', walk: '苏堤中段西侧出口即入园。' }
    ],
    routes: [
      { name: '十景漫步线', duration: '4小时', theme: '诗词里的西湖', stops: ['duanqiao', 'sudi', 'huagang', 'leifengta'] },
      { name: '环湖骑行线', duration: '3小时', theme: '湖光山色', stops: ['duanqiao', 'sudi', 'leifengta', 'santan'] }
    ]
  },
  {
    areaId: 'bingmayong', themeId: 'bingmayong', name: '秦始皇帝陵博物院', region: '陕西西安·临潼',
    slogan: '世界第八大奇迹', tags: ['世界文化遗产', '5A景区'],
    icon: '⚔️', lng: 109.278, lat: 34.384,
    spots: [
      { id: 'yiku', name: '一号坑', icon: '🪖', rating: 4.9, free: false, tags: ['必打卡', '最大军阵'], desc: '6000余件陶俑组成的步兵主力军阵，东端前锋三列横队锐不可当，是发现最早、规模最大的俑坑。', walk: '入园直行主展馆即达，建议早上首批入场避开人流。' },
      { id: 'erku', name: '二号坑', icon: '🏹', rating: 4.7, free: false, tags: ['多兵种混编', '跪射俑'], desc: '由骑兵、战车、弩兵混编的曲尺形军阵，出土的绿脸跪射俑是馆内唯一彩绘保存完好的珍品。', walk: '一号坑北侧连廊直通，步行约3分钟。' },
      { id: 'sanku', name: '三号坑', icon: '🗺️', rating: 4.6, free: false, tags: ['军幕指挥所', '最小俑坑'], desc: '规模最小却地位最高的指挥部，68件陶俑环墙壁排列，出土的鹿角与兽骨印证了秦军战前占卜习俗。', walk: '二号坑西侧，步行约2分钟。' },
      { id: 'tongchema', name: '铜车马馆', icon: '🛞', rating: 4.8, free: false, tags: ['青铜之冠', '3000余零件'], desc: '"青铜之冠"秦陵铜车马按真车1/2铸造，伞盖与辔绳工艺登峰造极，彩绘纹饰历经两千年仍清晰可辨。', walk: '需乘免费摆渡车至丽山园景区。' },
      { id: 'chenlieting', name: '文物陈列厅', icon: '🏺', rating: 4.5, free: false, tags: ['兵器真品', '千人千面'], desc: '展出陶俑出土时手持的真实青铜兵器，铬盐氧化处理技术令现代人称奇，另有典型俑头展示"千人千面"。', walk: '一号坑展馆东侧，步行约5分钟。' }
    ],
    routes: [
      { name: '帝国军团线', duration: '3小时', theme: '大秦军阵', stops: ['yiku', 'erku', 'sanku', 'chenlieting', 'tongchema'] },
      { name: '精华半日线', duration: '2小时', theme: '必看三站', stops: ['yiku', 'tongchema', 'chenlieting'] }
    ]
  },
  {
    areaId: 'mogao', themeId: 'dunhuang', name: '敦煌莫高窟', region: '甘肃敦煌',
    slogan: '沙漠中的千年美术馆', tags: ['世界文化遗产', '佛教艺术宝库'],
    icon: '🪷', lng: 94.661, lat: 40.035,
    spots: [
      { id: 'jiucenglou', name: '九层楼（第96窟）', icon: '🏛️', rating: 4.8, free: false, tags: ['莫高窟地标', '35.5米弥勒大佛'], desc: '莫高窟的标志建筑，窟内弥勒坐佛高35.5米，是世界最大的室内石胎泥塑坐佛，红色飞檐依崖而立。', walk: '窟区栈道南端，参观动线通常由此开始。' },
      { id: 'cangjingdong', name: '藏经洞陈列馆', icon: '📜', rating: 4.7, free: false, tags: ['敦煌学起点', '文物回流'], desc: '第17窟——藏经洞原址陈列，6万余件文书从这里流散世界各地，陈寅恪"伤心史"题词令人唏嘘。', walk: '九层楼北侧沿栈道步行约5分钟。' },
      { id: 'shuzi', name: '数字展示中心', icon: '🎬', rating: 4.7, free: false, tags: ['球幕电影', '预约必看'], desc: '《千年莫高》与《梦幻佛宫》两场球幕电影先导体验，7个经典洞窟高清还原，是正式参观前的必修课。', walk: '位于敦煌市区往莫高窟必经之路，需自驾或乘摆渡车。' },
      { id: 'fiantian', name: '飞天主题窟群', icon: '🕊️', rating: 4.8, free: false, tags: ['飞天艺术', '讲解随机开放'], desc: '讲解员带领参观的8个开放洞窟随机组合，反弹琵琶、双飞天等经典壁画在讲解中重现盛唐气象。', walk: '由讲解员统一带队按窟区栈道行进。' },
      { id: 'meishuguan', name: '敦煌石窟文物保护中心', icon: '🎨', rating: 4.5, free: false, tags: ['复原洞窟', '免费展区'], desc: '8个等比例复原洞窟可自由拍照，弥补窟内禁拍遗憾，壁画临摹与保护过程展示值得细看。', walk: '窟区出口旁，参观结束后顺路即达。' }
    ],
    routes: [
      { name: 'A类票深度线', duration: '4小时', theme: '千年佛国', stops: ['shuzi', 'jiucenglou', 'fiantian', 'cangjingdong', 'meishuguan'] },
      { name: '经典精华线', duration: '2.5小时', theme: '飞天之约', stops: ['shuzi', 'jiucenglou', 'fiantian'] }
    ]
  },
  {
    areaId: 'huangshan', themeId: 'huangshan', name: '黄山风景区', region: '安徽黄山',
    slogan: '五岳归来不看山，黄山归来不看岳', tags: ['世界文化与自然遗产', '奇松怪石'],
    icon: '🌄', lng: 118.167, lat: 30.138,
    spots: [
      { id: 'yingkesong', name: '迎客松', icon: '🌲', rating: 4.9, free: false, tags: ['黄山标志', '必打卡'], desc: '树龄逾千年的黄山松标志，侧枝伸展如展臂迎客，人民大会堂铁画《迎客松》的原型即在于此。', walk: '玉屏索道上站后步行约15分钟至玉屏楼。' },
      { id: 'guangmingding', name: '光明顶', icon: '☀️', rating: 4.8, free: false, tags: ['第二高峰', '观日出日落'], desc: '海拔1860米的黄山第二高峰，地势平坦视野开阔，日出、云海、佛光等奇观在此一览无余。', walk: '玉屏楼经莲花亭北上约1.5小时，或云谷索道方向上行。' },
      { id: 'feilaishi', name: '飞来石', icon: '🪨', rating: 4.7, free: false, tags: ['地质奇观', '红楼梦取景'], desc: '巨石凌空立于峰顶仿佛天外飞来，87版《红楼梦》片头即取景于此，夕阳下剪影最为魔幻。', walk: '光明顶西行约30分钟。' },
      { id: 'xihaai', name: '西海大峡谷', icon: '🏔️', rating: 4.8, free: false, tags: ['网红小火车', '梦幻景区'], desc: '深达千米的花岗岩峡谷，栈道悬于绝壁之上，谷底乘网红小火车攀升而回，步步皆是大片。', walk: '排云亭下入口进入，环线加小火车约3小时。' },
      { id: 'shixin', name: '始信峰', icon: '🗻', rating: 4.6, free: false, tags: ['始信黄山天下奇', '黑虎松'], desc: '"不到始信峰，不见黄山松"，接引崖上三面临空，竖琴松、黑虎松等名松荟萃，云海时如临仙境。', walk: '云谷索道上站后北行约40分钟。' }
    ],
    routes: [
      { name: '经典两日线', duration: '2天', theme: '黄山精华全览', stops: ['yingkesong', 'guangmingding', 'feilaishi', 'xihaai', 'shixin'] },
      { name: '一日速览线', duration: '6小时', theme: '奇松怪石', stops: ['yingkesong', 'guangmingding', 'xihaai'] }
    ]
  },
  {
    areaId: 'taishan', themeId: 'taishan', name: '泰山', region: '山东泰安',
    slogan: '五岳独尊，登泰山而小天下', tags: ['世界文化与自然双遗产', '封禅圣地'],
    icon: '🌅', lng: 117.101, lat: 36.257,
    spots: [
      { id: 'nantianmen', name: '南天门', icon: '⛩️', rating: 4.8, free: false, tags: ['十八盘尽头', '天门云梯'], desc: '十八盘尽头的"天门"，双峰夹峙间飞阁流丹，过此门即入岱顶天界，是泰山最具标志性的画面。', walk: '步行登山者沿十八盘直上；或乘桃花峪索道抵达附近。' },
      { id: 'shibapan', name: '十八盘', icon: '🪜', rating: 4.7, free: false, tags: ['1633级台阶', '挑战自我'], desc: '泰山最险要的一段，1633级台阶近乎垂直而上，两侧崖壁如削，"紧十八、慢十八、不紧不慢又十八"。', walk: '对松亭起至南天门，全程约40-60分钟。' },
      { id: 'yuhuangding', name: '玉皇顶', icon: '⛰️', rating: 4.8, free: false, tags: ['泰山极顶', '1545米'], desc: '海拔1545米的泰山之巅，玉皇庙内"极顶石"铭刻高度，秦始皇封禅台遗址静立庙前，极目齐鲁大地。', walk: '南天门沿天街东行约20分钟。' },
      { id: 'riguanfeng', name: '日观峰', icon: '🌤️', rating: 4.8, free: false, tags: ['观日出圣地', '拱北石'], desc: '泰山观日出的最佳位置，凌晨人手一件军大衣静候云海日出，"拱北石"探海而出是打卡地标。', walk: '玉皇顶东南侧步行约10分钟，建议提前夜宿山顶。' },
      { id: 'daimiao', name: '岱庙', icon: '🏯', rating: 4.6, free: false, tags: ['泰山第一行宫', '汉代古柏'], desc: '历代帝王封禅前驻跸之地，天贶殿与太和殿、大成殿并称中国古代三大宫殿式建筑，汉柏唐槐千年犹存。', walk: '红门登山起点前，泰安市中心北关街。' }
    ],
    routes: [
      { name: '夜爬看日线', duration: '8小时', theme: '十八盘挑战', stops: ['shibapan', 'nantianmen', 'riguanfeng', 'yuhuangding'] },
      { name: '文化一日线', duration: '5小时', theme: '封禅之路', stops: ['daimiao', 'nantianmen', 'yuhuangding', 'riguanfeng'] }
    ]
  },
  {
    areaId: 'suzhougardens', themeId: 'suzhougardens', name: '苏州园林', region: '江苏苏州',
    slogan: '江南园林甲天下，苏州园林甲江南', tags: ['世界文化遗产', '咫尺之内造乾坤'],
    icon: '🌿', lng: 120.624, lat: 31.325,
    spots: [
      { id: 'zhuozhengyuan', name: '拙政园', icon: '🏞️', rating: 4.8, free: false, tags: ['园林之首', '四大名园'], desc: '江南园林的代表作，占地78亩以水为中心，远借北寺塔的"借景"手法堪称中国造园史经典。', walk: '苏州博物馆西侧，拙政园地铁站步行约8分钟。' },
      { id: 'liuyuan', name: '留园', icon: '🪟', rating: 4.7, free: false, tags: ['建筑空间艺术', '冠云峰'], desc: '以建筑空间精妙著称，移步换景曲廊相连，镇园之宝冠云峰高6.5米，是江南园林太湖石的巅峰。', walk: '地铁2号线石路站步行约10分钟。' },
      { id: 'wangshiyuan', name: '网师园', icon: '🌙', rating: 4.6, free: false, tags: ['小巧精致', '夜游出名'], desc: '以小巧精雅著称的"小园极则"，殿春簏曾引来美国大都会博物馆仿建明轩，夜花园曲艺表演别有韵味。', walk: '十全街阔家头巷内，地铁至网师园北站。' },
      { id: 'shizilin', name: '狮子林', icon: '🦁', rating: 4.6, free: false, tags: ['假山迷宫', '亲子首选'], desc: '太湖石假山王国如迷宫探幽，乾隆六次到访仍迷路其中，九条山路三层叠石妙趣横生。', walk: '拙政园南侧步行约5分钟。' },
      { id: 'huqiu', name: '虎丘', icon: '🗼', rating: 4.7, free: false, tags: ['吴中第一名胜', '东方斜塔'], desc: '苏东坡言"到苏州不游虎丘乃憾事也"，云岩寺塔倾而不倒屹立千年，剑池下相传藏吴王阖闾墓之谜。', walk: '地铁1号线转游1路公交至虎丘站。' }
    ],
    routes: [
      { name: '名园精华线', duration: '5小时', theme: '造园艺术', stops: ['zhuozhengyuan', 'shizilin', 'wangshiyuan'] },
      { name: '古城漫步线', duration: '6小时', theme: '水巷园林', stops: ['liuyuan', 'zhuozhengyuan', 'huqiu'] }
    ]
  },
  {
    areaId: 'wuzhen', themeId: 'wuzhen', name: '乌镇', region: '浙江嘉兴',
    slogan: '中国最后的枕水人家', tags: ['江南水乡古镇', '世界互联网大会永久会址'],
    icon: '🚣', lng: 120.487, lat: 30.746,
    spots: [
      { id: 'xizha', name: '西栅夜景', icon: '🏮', rating: 4.8, free: false, tags: ['必打卡', '摇橹船夜游'], desc: '华灯初上时乌篷船摇过枕水人家，灯光倒映河道如流动的星河，是江南夜景的巅峰之作。', walk: '游客中心乘摆渡船入西栅，主河道沿线皆是夜景。' },
      { id: 'ranfang', name: '草木本色染坊', icon: '🌀', rating: 4.7, free: false, tags: ['蓝印花布', '拍照胜地'], desc: '高架上垂落蓝印花布随风轻扬，阳光透过布纹洒下斑驳光影，是乌镇最出片的一景。', walk: '西栅中部安渡坊附近。' },
      { id: 'zhaoming', name: '昭明书院', icon: '📚', rating: 4.6, free: false, tags: ['梁昭明太子读书处', '图书馆'], desc: '南朝梁昭明太子萧统读书之地，现为乌镇图书馆，回廊水榭间书香与枕水人家静气交融。', walk: '西栅北端，沿西市河北行约15分钟。' },
      { id: 'bailianta', name: '白莲塔', icon: '🛕', rating: 4.5, free: false, tags: ['乌镇制高点', '京杭运河畔'], desc: '乌镇最高建筑，塔下即是京杭大运河，登塔可望水乡白墙黛瓦连绵至天际。', walk: '西栅最北端，昭明书院东侧。' },
      { id: 'dongzha', name: '东栅老街', icon: '🏠', rating: 4.5, free: false, tags: ['原住民生活', '茅盾故居'], desc: '保留原住民生活的东栅更为质朴，茅盾故居与三白酒作坊相邻，皮影戏馆每日有传统演出。', walk: '与西栅相距约1.5公里，乘免费班车约10分钟。' }
    ],
    routes: [
      { name: '枕水夜色线', duration: '5小时', theme: '水乡夜游', stops: ['ranfang', 'zhaoming', 'bailianta', 'xizha'] },
      { name: '两栅全览线', duration: '2天', theme: '古镇慢生活', stops: ['dongzha', 'ranfang', 'zhaoming', 'xizha'] }
    ]
  },
  {
    areaId: 'pingyao', themeId: 'pingyao', name: '平遥古城', region: '山西晋中',
    slogan: '保存最完整的明清县城', tags: ['世界文化遗产', '晋商发源地'],
    icon: '🏦', lng: 112.176, lat: 37.197,
    spots: [
      { id: 'rishengchang', name: '日昇昌票号', icon: '💰', rating: 4.7, free: false, tags: ['中国第一家票号', '汇通天下'], desc: '1823年创立的中国第一家票号，"日昇昌"三字拆开是"日日升日日"，地下金库与密押制度尽显晋商智慧。', walk: '古城西大街路北，从下西门进城步行约10分钟。' },
      { id: 'xianya', name: '平遥县衙', icon: '⚖️', rating: 4.6, free: false, tags: ['保存最全县衙', '县官升堂表演'], desc: '始建于北魏的县级衙署，每天定时上演"县太爷升堂"实景剧，牢狱与刑具展区令人脊背生凉。', walk: '古城中心衙门街，日昇昌东南方向步行约15分钟。' },
      { id: 'mingqingjie', name: '明清一条街', icon: '🏮', rating: 4.6, free: true, tags: ['中轴线主街', '免费逛'], desc: '古城中轴南大街，票号、镖局、漆器老号鳞次栉比，夜晚灯笼高挂，恍若穿越回晋商鼎盛的年代。', walk: '县衙北行即达，贯穿古城南北。' },
      { id: 'chengqiang', name: '古城墙', icon: '🧱', rating: 4.7, free: false, tags: ['明代城垣', '俯瞰全城'], desc: '周长6163米的明代城墙，3000个垛口72座敌楼象征孔子三千弟子七十二贤人，日落时分登墙最美。', walk: '大南门（迎薰门）登城口。' },
      { id: 'chenghuangmiao', name: '城隍庙', icon: '🏮', rating: 4.5, free: false, tags: ['三庙一体', '琉璃艺术'], desc: '城隍庙与财神庙、灶君庙"庙中庙"格局罕见，满殿琉璃构件蓝绿生辉，是清代琉璃工艺的露天展厅。', walk: '古城东南城隍庙街，距县衙约600米。' }
    ],
    routes: [
      { name: '晋商文化线', duration: '4小时', theme: '汇通天下', stops: ['rishengchang', 'xianya', 'mingqingjie', 'chenghuangmiao'] },
      { name: '古城环线', duration: '5小时', theme: '明清县城全览', stops: ['chengqiang', 'mingqingjie', 'rishengchang', 'xianya', 'chenghuangmiao'] }
    ]
  },
  {
    areaId: 'qufu', themeId: 'qufu', name: '曲阜三孔', region: '山东济宁·曲阜',
    slogan: '千年礼乐归东鲁，万古衣冠拜素王', tags: ['世界文化遗产', '儒家圣地'],
    icon: '📜', lng: 116.990, lat: 35.580,
    spots: [
      { id: 'dachengdian', name: '孔庙大成殿', icon: '🏛️', rating: 4.8, free: false, tags: ['至圣先师', '十根龙柱'], desc: '孔庙正殿，十根深浮雕蟠龙石柱连皇宫都未敢用，殿前杏坛相传为孔子讲学之地，"大成"取集古圣之大成之意。', walk: '神道路孔庙南门入，沿中轴线穿五进院落即达。' },
      { id: 'kongfu', name: '孔府', icon: '🏠', rating: 4.6, free: false, tags: ['天下第一家', '衍圣公府'], desc: '孔子嫡系后裔世居的府邸，前衙后宅九进院落，"贪"壁绘一贪兽警示子孙戒贪，戒贪图是镇府之训。', walk: '孔庙东侧紧邻，出孔庙后门即达。' },
      { id: 'konglin', name: '孔林', icon: '🌲', rating: 4.5, free: false, tags: ['最大家族墓地', '十万坟冢'], desc: '孔子及其后裔的家族墓地，延续2500年10万余座坟冢举世无双，子贡手植楷与"携子抱孙"墓葬布局蕴含礼制。', walk: '距孔府约1.5公里，可乘马车或观光车前往。' },
      { id: 'xingtang', name: '杏坛', icon: '🍑', rating: 4.6, free: false, tags: ['孔子讲学处', '教育圣地'], desc: '大成殿前重檐十字脊亭，相传孔子在此杏树下设坛授徒，弟子三千贤人七十二，被尊为中国教育的源头。', walk: '孔庙大成殿前院落正中。' },
      { id: 'shisanbei', name: '十三碑亭', icon: '🪦', rating: 4.5, free: false, tags: ['御碑林立', '唐宋至清'], desc: '孔庙十三座碑亭存唐宋金元明清御碑五十余通，记录历代帝王尊孔崇儒的敕令，堪称一部石刻的尊孔史。', walk: '孔庙第六进院落，奎文阁之后。' }
    ],
    routes: [
      { name: '朝圣经典线', duration: '5小时', theme: '儒家文化溯源', stops: ['dachengdian', 'xingtang', 'shisanbei', 'kongfu', 'konglin'] },
      { name: '精华半日线', duration: '3小时', theme: '三孔必看', stops: ['dachengdian', 'kongfu', 'konglin'] }
    ]
  },
  {
    areaId: 'yungang', themeId: 'yungang', name: '云冈石窟', region: '山西大同',
    slogan: '真容巨壮，世法所稀', tags: ['世界文化遗产', '皇家石窟'],
    icon: '⛏️', lng: 113.144, lat: 40.111,
    spots: [
      { id: 'ersiku', name: '第20窟露天大佛', icon: '🧘', rating: 4.9, free: false, tags: ['云冈名片', '13.7米坐佛'], desc: '前壁坍塌后佛像露天而坐千年，13.7米的释迦坐像双肩齐挺面容慈和，是云冈石窟乃至大同的城市名片。', walk: '昙曜广场入窟区后西行至中区尽头即达。' },
      { id: 'tanyao', name: '昙曜五窟', icon: '👑', rating: 4.8, free: false, tags: ['开山之作', '皇帝即佛'], desc: '高僧昙曜主持开凿的第16-20窟，五尊大佛对应北魏五位皇帝，"皇帝即当今如来"的政治理想镌刻石上。', walk: '第20窟所在的核心区域，五窟相邻。' },
      { id: 'wuhua', name: '五华洞', icon: '🌈', rating: 4.7, free: false, tags: ['彩绘保存最好', '音乐窟'], desc: '第9-13窟因清代施彩绚丽得名，第12窟"音乐窟"壁雕47件乐器，一支千年前的"宫廷交响乐队"凝固石间。', walk: '昙曜五窟东侧（第9-13窟），步行约3分钟。' },
      { id: 'yungangbwg', name: '云冈博物馆', icon: '🏺', rating: 4.6, free: false, tags: ['北魏文物', '数字化展陈'], desc: '沉陷式展厅陈列石窟考古发掘文物，3D打印复原的残损佛像与数字化光影重现"山堂水殿"盛景。', walk: '窟区参观终点出口旁，环形动线顺路即达。' },
      { id: 'lingyansi', name: '灵岩寺', icon: '⛩️', rating: 4.5, free: false, tags: ['山堂水殿', '电影取景'], desc: '依据郦道元《水经注》记载复建的北魏风格寺院，湖面倒映石佛容，是《画皮》等多部影片取景地。', walk: '进入窟区后首先经过，位于石窟群前。' }
    ],
    routes: [
      { name: '皇家石窟线', duration: '3.5小时', theme: '北魏平城时代', stops: ['lingyansi', 'tanyao', 'ersiku', 'wuhua'] },
      { name: '深度全览线', duration: '5小时', theme: '石窟艺术全景', stops: ['lingyansi', 'wuhua', 'tanyao', 'ersiku', 'yunGangBWG'] }
    ]
  },
  {
    areaId: 'potala', themeId: 'potala', name: '布达拉宫', region: '西藏拉萨',
    slogan: '世界屋脊上的雪域圣殿', tags: ['世界文化遗产', '宫堡建筑群'],
    icon: '🏰', lng: 91.117, lat: 29.656,
    spots: [
      { id: 'baigong', name: '白宫', icon: '⚪', rating: 4.8, free: false, tags: ['政务之所', '东大殿'], desc: '达赖喇嘛起居与理政的宫殿，东大殿是举行重大宗教政治活动的场所，顶层采光殿日光洒满东、南、西三面。', walk: '沿之字形石阶上行至白宫正门，参观需预约限时。' },
      { id: 'honggong', name: '红宫', icon: '🔴', rating: 4.8, free: false, tags: ['灵塔殿', '8座达赖灵塔'], desc: '布达拉宫核心，八座达赖灵塔中五世达赖灵塔耗黄金3721公斤、镶珠宝上万颗，殊胜三界殿是宫中最高殿堂。', walk: '白宫参观后沿内部木梯上行即入。' },
      { id: 'dazhao', name: '大昭寺', icon: '🙏', rating: 4.7, free: false, tags: ['先有大昭寺后有拉萨', '释迦牟尼12岁等身像'], desc: '松赞干布主持修建，殿内供奉文成公主携来的释迦牟尼12岁等身像，"觉康"佛殿前酥油灯千年不熄。', walk: '布达拉宫东南约2公里八廓街中心，步行或打车约15分钟。' },
      { id: 'bakuo', name: '八廓街', icon: '💫', rating: 4.6, free: true, tags: ['转经道', '免费'], desc: '围绕大昭寺的千年转经道，转经筒与磕长头的信众昼夜不息，玛吉阿米黄房子与各类藏式小店值得慢逛。', walk: '大昭寺正门前即是环道起点。' },
      { id: 'yaowangshan', name: '药王山观景台', icon: '📷', rating: 4.7, free: true, tags: ['50元人民币取景地', '免费'], desc: '布达拉宫西南侧小山头，50元人民币背面的布达拉宫取景机位，清晨与傍晚摄影者云集。', walk: '布达拉宫白塔对面，北京东路路口上山约10分钟。' }
    ],
    routes: [
      { name: '雪域朝圣线', duration: '6小时', theme: '圣城巡礼', stops: ['yaowangshan', 'baigong', 'honggong', 'dazhao', 'bakuo'] },
      { name: '宫堡精华线', duration: '3小时', theme: '宫堡探秘', stops: ['yaowangshan', 'baigong', 'honggong'] }
    ]
  },
  {
    areaId: 'lijiang', themeId: 'lijiang', name: '丽江古城', region: '云南丽江',
    slogan: '小桥流水，纳西风情', tags: ['世界文化遗产', '茶马古道重镇'],
    icon: '🏘️', lng: 100.234, lat: 26.872,
    spots: [
      { id: 'sifangjie', name: '四方街', icon: '🔥', rating: 4.6, free: true, tags: ['古城心脏', '打跳活动'], desc: '茶马古道上的露天集市广场，五花石铺地历经千年磨砺，傍晚纳西阿妈牵起游客围圈打跳，热闹非凡。', walk: '大水车沿东大街南行约300米即达。' },
      { id: 'mufu', name: '木府', icon: '🏯', rating: 4.7, free: false, tags: ['丽江紫禁城', '北有故宫南有木府'], desc: '纳西土司木氏的府邸，徐霞客叹其"宫室之丽拟于王者"，狮子山万古楼可俯瞰整个古城灰瓦连绵。', walk: '四方街东南侧光义街，步行约8分钟。' },
      { id: 'wangulou', name: '万古楼', icon: '🗼', rating: 4.6, free: false, tags: ['古城制高点', '观景最佳'], desc: '狮子山之巅的中国木构第一楼，32根柱擎起飞檐，登楼远眺玉龙雪山与古城全貌尽收眼底。', walk: '木府后沿狮子山石阶上行约20分钟。' },
      { id: 'heilongtan', name: '黑龙潭公园', icon: '💧', rating: 4.7, free: false, tags: ['玉龙雪山倒影', '古城水源头'], desc: '古城用水之源，得月楼与五孔桥前远望玉龙雪山倒映潭中，是丽江明信片上最经典的画面。', walk: '古城北端大研古镇入口外，步行约15分钟。' },
      { id: 'dashuiche', name: '大水车', icon: '🎡', rating: 4.5, free: true, tags: ['古城地标', '合影必选'], desc: '古城北门入口的双轮大水车，江泽民题字石刻立于旁侧，是每位游客抵达丽江的第一张合影。', walk: '古城北入口玉河广场。' }
    ],
    routes: [
      { name: '古城漫游线', duration: '4小时', theme: '纳西风情', stops: ['dashuiche', 'sifangjie', 'mufu', 'wangulou'] },
      { name: '雪山潭水线', duration: '5小时', theme: '山水丽江', stops: ['heilongtan', 'dashuiche', 'sifangjie', 'wangulou'] }
    ]
  },
  {
    areaId: 'zhangjiajie', themeId: 'zhangjiajie', name: '张家界', region: '湖南张家界',
    slogan: '放大三亿八千万年的盆景', tags: ['世界自然遗产', '阿凡达取景地'],
    icon: '🏔️', lng: 110.479, lat: 29.325,
    spots: [
      { id: 'yuanjiajie', name: '袁家界', icon: '🌫️', rating: 4.8, free: false, tags: ['阿凡达悬浮山', '乾坤柱'], desc: '电影《阿凡达》哈利路亚山原型"乾坤柱"所在，迷魂台俯瞰千峰穿云，天下第一桥横跨天然石拱。', walk: '百龙天梯上站换乘环保车至袁家界停车场。' },
      { id: 'tianmenshan', name: '天门山', icon: '🚪', rating: 4.8, free: false, tags: ['天门洞', '玻璃栈道'], desc: '世界海拔最高的天然穿山溶洞天门洞，999级上天梯直入云端，玻璃栈道与99道弯盘山公路挑战胆量。', walk: '市区乘天门山索道直达山顶，游览环线约4小时。' },
      { id: 'jinbianxi', name: '金鞭溪', icon: '🏞️', rating: 4.7, free: false, tags: ['世界最美峡谷', '西游记取景'], desc: '"久旱不断流，久雨碧于秋"的7.5公里溪谷，《西游记》花果山取景地，一路奇峰夹道、猴群出没。', walk: '森林公园大氧吧广场起步，全程平缓步行约2.5小时。' },
      { id: 'shilihualang', name: '十里画廊', icon: '🎨', rating: 4.6, free: false, tags: ['小火车观景', '采药老人'], desc: '5公里峡谷长廊，"采药老人""三姐妹峰"惟妙惟肖，乘观光小火车穿行如在画中游。', walk: '金鞭溪终点水绕四门换乘环保车约10分钟。' },
      { id: 'bailong', name: '百龙天梯', icon: '🛗', rating: 4.6, free: false, tags: ['世界最高户外电梯', '326米'], desc: '垂直高差335米的悬崖观光电梯，66秒直上袁家界，贴崖而升时峡谷峰林扑面而来。', walk: '水绕四门附近下站乘坐。' }
    ],
    routes: [
      { name: '森林公园两日线', duration: '2天', theme: '峰林探秘', stops: ['jinbianxi', 'bailong', 'yuanjiajie', 'shilihualang'] },
      { name: '天门山一日线', duration: '5小时', theme: '极限挑战', stops: ['tianmenshan'] }
    ]
  },
  {
    areaId: 'jiuzhaigou', themeId: null, name: '九寨沟', region: '四川阿坝',
    slogan: '九寨归来不看水', tags: ['世界自然遗产', '童话世界'],
    icon: '💧', lng: 103.918, lat: 33.264,
    spots: [
      { id: 'wuhahai', name: '五花海', icon: '🌊', rating: 4.9, free: false, tags: ['九寨精华', '孔雀蓝'], desc: '九寨沟色彩最艳丽的海子，湖底钙华与藻类交织出孔雀蓝、翡翠绿，"九寨归来不看水"说的就是这里。', walk: '日则沟熊猫海下行栈道步行约15分钟。' },
      { id: 'nuorilang', name: '诺日朗瀑布', icon: '💦', rating: 4.8, free: false, tags: ['中国最宽钙华瀑布', '西游记片尾取景'], desc: '宽达270米的钙华瀑布如银河滑落，《西游记》片尾师徒四人牵马走过的正是此处，三沟交汇的枢纽。', walk: '三条沟观光车换乘中心旁，下车即达。' },
      { id: 'wucaichi', name: '五彩池', icon: '🌈', rating: 4.8, free: false, tags: ['最小最艳', '九寨之眼'], desc: '九寨沟最小而色彩最浓的海子，池水一半碧蓝一半橙绿，传仙女梳妆镜碎落人间化作此池。', walk: '则查洼沟长海下行步行栈道约10分钟。' },
      { id: 'changhai', name: '长海', icon: '🏞️', rating: 4.7, free: false, tags: ['最大海子', '雪山环抱'], desc: '九寨沟最大最深的海子，海拔3100米，雪峰倒映墨蓝湖面，"装不满、漏不干"的奇观流传千年。', walk: '则查洼沟尽头，观光车终点站下车即达。' },
      { id: 'shuzheng', name: '树正群海', icon: '🌿', rating: 4.6, free: false, tags: ['19个海子连缀', '树正寨'], desc: '19个梯级海子首尾相连如翡翠项链，藏式木楼与经幡立于水畔，是九寨沟人文与自然交融的画面。', walk: '树正寨站下车沿栈道下行观赏。' }
    ],
    routes: [
      { name: '一日全景线', duration: '7小时', theme: '海子巡礼', stops: ['changhai', 'wucaichi', 'wuhahai', 'nuorilang', 'shuzheng'] },
      { name: '精华半日线', duration: '4小时', theme: '九寨之水', stops: ['wuhahai', 'nuorilang', 'shuzheng'] }
    ]
  },
  {
    areaId: 'gulangyu', themeId: 'gulangyu', name: '鼓浪屿', region: '福建厦门',
    slogan: '钢琴之岛，万国建筑博览', tags: ['世界文化遗产', '步行岛'],
    icon: '🎹', lng: 118.069, lat: 24.448,
    spots: [
      { id: 'riguangyan', name: '日光岩', icon: '🌞', rating: 4.7, free: false, tags: ['鼓浪屿最高点', '俯瞰全岛'], desc: '海拔92.7米的花岗岩巨石，登顶可环视鼓浪屿全景与对岸厦门天际线，"鼓浪洞天"石刻为厦门二十名景之首。', walk: '三丘田码头下船后沿鼓浪屿商业街南行约20分钟。' },
      { id: 'shuzhuang', name: '菽庄花园', icon: '🌳', rating: 4.6, free: false, tags: ['四十四桥', '藏海于园'], desc: '台湾富商林尔嘉的私家花园，"藏海"手法独步江南，四十四桥曲桥渡海，涨潮时如行波上。', walk: '日光岩南侧港仔后路，步行约10分钟。' },
      { id: 'gangqin', name: '钢琴博物馆', icon: '🎼', rating: 4.6, free: false, tags: ['百年古钢琴', '鼓浪屿之波'], desc: '国内首家钢琴博物馆，藏70余架古董钢琴，从奥地利皇室御用到自动演奏钢琴，琴声与海涛声共鸣。', walk: '菽庄花园听涛轩内，购联票参观。' },
      { id: 'fengqin', name: '风琴博物馆', icon: '🎵', rating: 4.5, free: false, tags: ['世界最大风琴', '八卦楼'], desc: '设于地标八卦楼内，镇馆之宝"诺蔓比尔"大演奏风琴高达6米，千余根音管宛如管风琴宫殿。', walk: '鼓浪屿中部的八卦楼，三丘田码头步行约15分钟。' },
      { id: 'neicuoao', name: '内厝澳老巷', icon: '🚶', rating: 4.4, free: true, tags: ['免费', '文艺小店'], desc: '避开人潮的本地生活区，老别墅、三角梅与文艺咖啡馆藏于巷弄，是鼓浪屿慢时光的正确打开方式。', walk: '岛屿西侧内厝澳码头一带，随心漫游即可。' }
    ],
    routes: [
      { name: '经典环岛线', duration: '5小时', theme: '万国建筑', stops: ['riguangyan', 'shuzhuang', 'gangqin', 'fengqin'] },
      { name: '慢生活线', duration: '4小时', theme: '文艺小岛', stops: ['neicuoao', 'riguangyan', 'shuzhuang'] }
    ]
  },
  {
    areaId: 'dayanta', themeId: 'dayanta', name: '大雁塔·大唐不夜城', region: '陕西西安',
    slogan: '长安十二时辰的现实版', tags: ['唐文化地标', '免费开放'],
    icon: '🗼', lng: 108.964, lat: 34.218,
    spots: [
      { id: 'dayanta-ta', name: '大雁塔', icon: '🛕', rating: 4.8, free: false, tags: ['玄奘译经地', '西安地标'], desc: '玄奘为保存天竺经像主持修建，七层方塔巍然矗立1300余年，登塔可俯瞰曲江，"雁塔题名"曾是进士最高荣耀。', walk: '大慈恩寺内，南广场玄奘像后进寺。' },
      { id: 'buyecheng', name: '大唐不夜城', icon: '🏮', rating: 4.8, free: true, tags: ['免费', '夜游顶流'], desc: '2100米的唐风步行街华灯如昼，不倒翁小姐姐、盛唐密盒互动演出轮番登场，"一步入唐"的氛围感拉满。', walk: '大雁塔南广场向南延伸，日落后前往最佳。' },
      { id: 'penquan', name: '音乐喷泉', icon: '⛲', rating: 4.6, free: true, tags: ['亚洲最大矩阵喷泉', '免费'], desc: '北广场音乐喷泉随交响乐起伏跳跃，水柱最高达60米，夜晚灯光秀与古塔同框震撼人心。', walk: '大雁塔北广场，提前30分钟占位。' },
      { id: 'cien', name: '大慈恩寺', icon: '⛩️', rating: 4.6, free: false, tags: ['唐皇家寺院', '唯识宗祖庭'], desc: '太子李治为追念母亲长孙皇后而建，玄奘任首任主持在此译经十九年，大雄宝殿晨钟暮鼓延续盛唐梵音。', walk: '大雁塔所在寺院，南门购票入内。' },
      { id: 'xuanzang', name: '玄奘广场', icon: '🧘', rating: 4.5, free: true, tags: ['免费', '取景机位'], desc: '执杖远眺的玄奘铜像与身后大雁塔同框，是西安最具文化气息的打卡机位，广场常有街头艺人献演。', walk: '大雁塔正南，步行街北端起点。' }
    ],
    routes: [
      { name: '大唐之夜线', duration: '4小时', theme: '梦回长安', stops: ['dayanta-ta', 'penquan', 'xuanzang', 'buyecheng'] },
      { name: '唐文化一日线', duration: '5小时', theme: '玄奘之路', stops: ['cien', 'dayanta-ta', 'xuanzang', 'buyecheng', 'penquan'] }
    ]
  },
  {
    areaId: 'hukou', themeId: 'hukou', name: '壶口瀑布', region: '山西吉县 / 陕西宜川',
    slogan: '黄河之水天上来', tags: ['中国第二大瀑布', '黄河奇观'],
    icon: '🌊', lng: 110.469, lat: 36.128,
    spots: [
      { id: 'zhupuguanjing', name: '主瀑布观景台', icon: '💦', rating: 4.8, free: false, tags: ['必打卡', '黄色瀑布'], desc: '黄河千里收一壶，300余米宽的洪流骤然束入50米石槽，涛声震天水雾腾空，"风在吼，马在叫"的黄河大合唱灵感源地。', walk: '山西侧观景台距入口步行约10分钟。' },
      { id: 'longdong', name: '龙洞', icon: '🐉', rating: 4.6, free: false, tags: ['仰视瀑布', '独特视角'], desc: '天然石洞正对瀑布下方，仰观黄河之水天上来，雷霆万钧扑面而来，是壶口最震撼的近距离机位。', walk: '主观景台下方下行台阶，注意防滑。' },
      { id: 'shilongcao', name: '十里龙槽', icon: '🏞️', rating: 4.6, free: false, tags: ['地质奇观', '水墨石槽'], desc: '瀑布冲刷出的十里深槽如巨龙潜行，两岸石壁刀削斧劈，是黄河地质演化的活教材。', walk: '沿河谷栈道东行远眺。' },
      { id: 'huangheqiao', name: '黄河大桥视角', icon: '🌉', rating: 4.5, free: true, tags: ['免费', '晋陕两岸'], desc: '横跨黄河的公路桥上可同时眺望晋陕两岸风光，一步跨两省，河风猎猎中心潮澎湃。', walk: '景区入口东侧约500米。' }
    ],
    routes: [
      { name: '黄河怒涛线', duration: '3小时', theme: '母亲河礼赞', stops: ['zhupuguanjing', 'longdong', 'shilongcao', 'huangheqiao'] }
    ]
  },
  {
    areaId: 'jingdezhen', themeId: 'qinghua', name: '景德镇陶阳里', region: '江西景德镇',
    slogan: '千年瓷都的活着的窑火', tags: ['瓷都之源', '御窑遗址'],
    icon: '🏺', lng: 117.215, lat: 29.270,
    spots: [
      { id: 'yuyaochang', name: '御窑厂遗址', icon: '🏛️', rating: 4.7, free: false, tags: ['明清皇家窑厂', '考古现场'], desc: '明清两代专为宫廷烧瓷的皇家窑厂，地下埋藏碎瓷千万片，修复的宣德青花龙纹缸诉说"千里挑一"的严苛。', walk: '中华南路御窑厂国家考古遗址公园入口。' },
      { id: 'taoyangli', name: '陶阳里历史街区', icon: '🏮', rating: 4.7, free: false, tags: ['里弄制瓷聚落', '网红街区'], desc: '"陶阳十三里，烟火十万家"，窑砖里弄与坯房作坊保存完好，如今窑火与咖啡馆、市集共生。', walk: '御窑厂北侧，两者联票步行互通。' },
      { id: 'longzhuge', name: '龙珠阁', icon: '🏯', rating: 4.6, free: false, tags: ['瓷都地标', '官窑博物馆'], desc: '明代官窑标志建筑，红墙金瓦立于珠山之巅，登阁可俯瞰老城，阁内展陈历代官窑修复珍品。', walk: '御窑厂遗址核心区最高点。' },
      { id: 'sanlvmiao', name: '三闾庙古码头', icon: '⛵', rating: 4.5, free: true, tags: ['免费', '瓷运古渡'], desc: '明清瓷器外运的水路码头，青石板留下独轮车辙印，老街明代民居仍有人居住，时光在此停滞。', walk: '昌江畔，陶阳里西北约2公里。' },
      { id: 'taocibwg', name: '中国陶瓷博物馆', icon: '🏺', rating: 4.8, free: false, tags: ['无语菩萨', '文物表情包'], desc: '馆藏瓷器5万余件跨千年，"沉思罗汉"因表情呆萌爆红网络成"无语菩萨"，是年轻人排队合影的顶流文物。', walk: '昌南大道，市区乘公交约20分钟。' }
    ],
    routes: [
      { name: '千年窑火线', duration: '5小时', theme: '瓷都溯源', stops: ['yuyaochang', 'longzhuge', 'taoyangli', 'sanlvmiao'] },
      { name: '网红瓷都线', duration: '4小时', theme: '新潮瓷艺', stops: ['taocibwg', 'taoyangli', 'yuyaochang'] }
    ]
  }
];

// ----------
// 运行时工具
// ----------
const AREA_INDEX = new Map(SCENIC_AREAS.map(a => [a.areaId, a]));

export const SCENIC_AREA_COUNT = SCENIC_AREAS.length;
export const SCENIC_SPOT_COUNT = SCENIC_AREAS.reduce((n, a) => n + a.spots.length, 0);

/** 按景区 id 取景区（含景点与路线） */
export function getAreaById(areaId) {
  return AREA_INDEX.get(areaId) || null;
}

/** 全景区内查找景点：返回 { area, spot, index } 或 null */
export function findSpot(spotId) {
  for (const area of SCENIC_AREAS) {
    const index = area.spots.findIndex(s => s.id === spotId);
    if (index >= 0) return { area, spot: area.spots[index], index };
  }
  return null;
}

/** 亮点标签（供景区卡片展示，取前三个） */
export function areaHighlight(area) {
  return (area.tags || []).slice(0, 3);
}
