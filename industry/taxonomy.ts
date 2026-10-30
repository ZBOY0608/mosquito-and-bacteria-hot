// 这个行业的分类体系：类别、标签词表、机构名录，以及防止张冠李戴的身份词典。
// 模型按这里的词表打标签，主题页（topics.json）按标签归类，筛选栏按类别分组。
// 换行业时：类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 是网址和接口里的身份，上线后不要改。
 * section 是日报里的分节标题（几个类别可以共用一节，按这里的顺序排）；guide 告诉结构抽取模型这一类收什么、
 * 和相邻类别的边界在哪（总的归类原则写在 prompts/structure.md 里）。
 * commentary 标出评论类：日报写过的事又有评论类的后续报道，只占一行快讯（报道它的信源够多时除外）。
 * 没归上类的资料在日报里放进第一个 key 为 industry 的类别所在的节（没有就放最后一节）。
 * tagColor 是飞书推送卡片里跟在标题后面这一类小标签的颜色（飞书 text_tag 的颜色名）。
 * feedLabel 是分类 RSS 标题里的名字（不写就用 label）。公开接口、RSS 和 MCP 里要把一类并进另一类发布，写在站点设置里（site/site.ts 的 PUBLIC_CATEGORIES）。
 *
 * 本站有五条轨道，类别就是轨道。五条不是主题罗列，而是按"这项研究在回答什么问题"分层：
 * 菌能不能用来阻断（symbiont）→ 这群蚊能不能传（transmission）→ 接下来会怎样（prediction）
 * → 病原怎么致病（virus-disease）→ 措施有没有效（control-policy）。
 * 主轨单选，交叉主题靠标签表达（见 docs/tracks.md 的五轨说明）。
 */
export const CATEGORIES = [
  {
    key: "symbiont",
    tagColor: "turquoise",
    label: "共生菌与微生物组",
    feedLabel: "共生菌与微生物组",
    section: "共生菌与微生物组",
    guide:
      "被操作或被测量的是菌、菌群或内共生菌的资料：沃尔巴克氏体等共生菌的垂直与水平传播、人工转染与菌株构建、" +
      "蚊虫菌群调查与群落结构、共生菌对媒介能力或病毒复制的影响、菌-病毒互作的分子机制、" +
      "以共生菌为基础的人群替换（IIT）与现场释放、共生菌与其他防控手段的组合。非蚊媒虫种（蜱、蚜虫、粉虱、沙蝇、采采蝇、蠓、叶蝉等）的微生物组与病毒互作也归此类。" +
      "研究主体是菌或菌群时归此类，即使病毒学终点出现在结果里。",
  },
  {
    key: "transmission",
    tagColor: "blue",
    label: "传播效能与媒介",
    feedLabel: "传播效能与媒介",
    section: "传播效能与媒介",
    guide:
      "被测量的是蚊虫的传递能力或决定它的媒介性状的资料：感染率、播散率、唾液腺感染率、外潜伏期、病毒载量、" +
      "媒介能力与媒介效能；血餐偏好、宿主选择、寿命与适应性代价、蚊虫行为、种群动态与种群遗传结构；" +
      "杀虫剂抗性水平与抗性机制；蚊种间竞争与扩散。研究里没有对菌的处理、也没有构建模型时归此类。" +
      "只测了传播参数、没有建模、也没有共生菌干预的，一律归此类。",
  },
  {
    key: "prediction",
    tagColor: "violet",
    label: "预测与建模",
    feedLabel: "预测与建模",
    section: "预测与建模",
    guide:
      "产出是对未观测情形的推断、且有模型构建或验证过程的资料：气候与环境的驱动建模、时空风险制图、" +
      "机器学习与深度学习的暴发预警、R0 与传播动力学、情景模拟与释放策略优化建模、监测数据同化；" +
      "临床重症预警评分与预后预测模型；分子结构预测、适应性突变预测与计算筛选。" +
      "判断的关键不是有没有出现 predict、model 这类词，而是主要产出是否为模型本身：有训练或拟合、有验证或外推的，才归此类。" +
      "只做描述性统计的监测报告归 virus-disease；只测传播参数不建模的归 transmission。",
  },
  {
    key: "virus-disease",
    tagColor: "orange",
    label: "病毒与疾病",
    feedLabel: "病毒与疾病",
    section: "病毒与疾病",
    guide:
      "被研究的是病毒本身或病人的资料：登革、寨卡、基孔肯雅、黄热、乙脑、西尼罗、奥罗普切等虫媒病毒的" +
      "病毒学与复制机制、致病机制与免疫应答、临床特征与分型、重症与后遗症、诊断方法与分型技术、" +
      "人群血清学调查、暴发调查与疾病负担。研究主体是病毒、病人或人群，而不是媒介或菌时归此类。" +
      "评估某项干预措施效果的归 control-policy；媒介种群与带毒率监测归 transmission。",
  },
  {
    key: "control-policy",
    tagColor: "green",
    label: "防控与政策",
    feedLabel: "防控与政策",
    section: "防控与政策",
    guide:
      "被评估的是一项公共卫生措施的资料：疫苗与抗病毒药物的研发、临床试验与接种策略；" +
      "杀虫剂应用策略与室内滞留喷洒、蚊帐与个人防护；社区干预、健康教育、孳生地清理与社会接受度；" +
      "指南、政策、共识、监管与治理文件；卫生经济与成本效果分析；监测体系与防控项目评估。" +
      "以共生菌或基因驱动品系为手段的干预归 symbiont；只报告措施执行情况的常规工作简报，价值通常较低，但仍在范围内。",
  },
] as const satisfies ReadonlyArray<{ key: string; tagColor: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/**
 * 这个行业最受关注的一类发布。本行业没有对应的“发布”事件，设为 null，日报报头就不显示这个数。
 */
export const RELEASE: { category: string; tag: string; unit: string } | null = null;

/** 周报月报的总述可以直接写、不必在报道里找到出处的行业通用词（小写）。站名会自动算进去。 */
export const PLAIN_TERMS: readonly string[] = [
  "wolbachia", "denv", "zikv", "chikv", "yfv", "jev", "wnv", "orov",
  "iit", "sit", "aedes", "anopheles", "culex", "culicoides",
  "pcr", "elisa", "dna", "rna", "rrna", "cdc", "who", "ecdc", "paho",
  "vector competence", "vectorial capacity", "eip", "r0", "rt", "seir", "ross-macdonald",
  "gis", "roc", "auc", "machine learning", "deep learning",
];

/**
 * 内容理解一步给每篇资料判的“内容类型”（写在 prompts/content-understanding.md 里，改了类型要同步改那份提示词）。
 * 评分提示词（prompts/selection-score.md）按类型给五个维度不同的权重。
 */
export const ITEM_TYPES = [
  "original_research",
  "review_opinion",
  "methods_tools",
  "field_trial",
  "surveillance_epidemiology",
  "clinical_diagnosis",
  "vaccine_antiviral",
  "guideline_policy",
  "modeling_forecast",
] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一（与 ITEM_TYPES 一一对应）。 */
export const CATEGORY_TAGS = [
  "原始研究", "综述与观点", "方法与工具", "现场与中试", "监测与流行病学", "临床与诊断", "疫苗与抗病毒", "指南与政策", "预测与建模",
] as const;

/**
 * 可选的主题标签。分七簇，按「菌 / 病原 / 传播效能 / 预测建模 / 干预 / 蚊种与阶段 / 地域」排列。
 * 加标签前先想清楚它会不会和别的簇重复：一个标签只在它最直接描述的那个簇里出现。
 */
export const TOPIC_TAGS = [
  // 菌
  "沃尔巴克氏体", "其他共生菌", "微生物组", "菌群调查", "人工转染", "paratransgenesis", "菌-病毒互作",
  // 病原
  "登革", "寨卡", "基孔肯雅", "黄热", "乙脑", "西尼罗", "奥罗普切",
  // 传播效能
  "媒介能力", "感染率", "播散率", "唾液腺感染", "外潜伏期", "病毒载量",
  "血餐偏好", "寿命与适应性代价", "蚊虫行为", "种群动态",
  // 预测建模
  "流行病学预测", "气候驱动", "时空模型", "机器学习", "风险制图", "传播动力学",
  "早期预警", "情景模拟", "临床预警评分", "分子预测",
  // 干预
  "IIT人群替换", "SIT", "基因驱动", "杀虫剂抗性", "杀虫剂应用", "疫苗", "抗病毒", "社区干预",
  // 蚊种与阶段
  "埃及伊蚊", "白纹伊蚊", "库蚊", "按蚊", "其他虫种", "体外", "动物", "半野外", "现场",
  // 地域
  "云南", "西双版纳", "磨憨", "东南亚", "全球",
] as const;

/** 可选的实体标签（机构、计划、平台）。 */
export const ENTITY_TAGS = [
  "World Mosquito Program", "Monash University", "云南省寄生虫病防治所", "中国疾控中心",
  "IAEA", "WHO", "CDC", "Institut Pasteur",
  "LSHTM", "Imperial College London", "Johns Hopkins", "ECDC", "PAHO", "Fiocruz",
] as const;

/** 模型常写的近义词，统一成词表里的写法。只收指向明确的写法，别把泛词（prediction、model）也收进来。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  // 菌
  沃尔巴克氏菌: "沃尔巴克氏体", 沃尔巴克氏: "沃尔巴克氏体", wolbachia: "沃尔巴克氏体", wMel: "沃尔巴克氏体", wAlbB: "沃尔巴克氏体",
  昆虫共生菌: "其他共生菌", 共生菌: "其他共生菌", symbiont: "其他共生菌", endosymbiont: "其他共生菌",
  肠道菌群: "微生物组", 菌群: "微生物组", microbiota: "微生物组", microbiome: "微生物组",
  菌群结构: "菌群调查", "community structure": "菌群调查",
  "symbiont-virus interaction": "菌-病毒互作", "wolbachia-virus interaction": "菌-病毒互作",
  // 病原
  登革病毒: "登革", dengue: "登革", denv: "登革",
  寨卡病毒: "寨卡", zika: "寨卡", zikv: "寨卡",
  基孔肯雅热: "基孔肯雅", 基孔肯雅病毒: "基孔肯雅", chikungunya: "基孔肯雅", chikv: "基孔肯雅",
  黄热病: "黄热", "yellow fever": "黄热", yfv: "黄热",
  乙型脑炎: "乙脑", "japanese encephalitis": "乙脑", jev: "乙脑",
  西尼罗病毒: "西尼罗", "west nile": "西尼罗", wnv: "西尼罗",
  奥罗普切热: "奥罗普切", oropouche: "奥罗普切",
  // 传播效能
  "vector competence": "媒介能力", "vectorial capacity": "媒介能力", 媒介效能: "媒介能力",
  "infection rate": "感染率", "infection rates": "感染率",
  "dissemination rate": "播散率", dissemination: "播散率",
  "salivary gland infection": "唾液腺感染", "salivary glands": "唾液腺感染",
  "extrinsic incubation": "外潜伏期", "extrinsic incubation period": "外潜伏期", eip: "外潜伏期",
  "viral load": "病毒载量", "viral titre": "病毒载量", "viral titer": "病毒载量",
  "blood feeding": "血餐偏好", "blood meal": "血餐偏好", "host preference": "血餐偏好", "host seeking": "血餐偏好",
  "fitness cost": "寿命与适应性代价", "fitness costs": "寿命与适应性代价", 适合度代价: "寿命与适应性代价",
  蚊虫行为: "蚊虫行为", "mosquito behaviour": "蚊虫行为", "mosquito behavior": "蚊虫行为",
  "population dynamics": "种群动态", 种群遗传: "种群动态", "population genetics": "种群动态",
  // 预测建模
  forecasting: "流行病学预测", forecast: "流行病学预测", "epidemic forecasting": "流行病学预测",
  "climate-driven": "气候驱动", 气候驱动: "气候驱动", "climate change": "气候驱动",
  "spatial model": "时空模型", "spatio-temporal model": "时空模型", "temporal model": "时空模型",
  "machine learning": "机器学习", "deep learning": "机器学习", "random forest": "机器学习",
  "gradient boosting": "机器学习", xgboost: "机器学习", "neural network": "机器学习",
  "risk map": "风险制图", "risk mapping": "风险制图", "risk maps": "风险制图",
  "transmission model": "传播动力学", "mathematical model": "传播动力学", "reproduction number": "传播动力学", r0: "传播动力学",
  "early warning": "早期预警", "early warning system": "早期预警", nowcast: "早期预警",
  "scenario analysis": "情景模拟", "scenario modelling": "情景模拟", "scenario modeling": "情景模拟",
  "prognostic model": "临床预警评分", "severity prediction": "临床预警评分", "risk score": "临床预警评分", "warning signs": "临床预警评分",
  "in silico": "分子预测", "molecular docking": "分子预测", "protein structure prediction": "分子预测", alphafold: "分子预测",
  // 干预
  转基因蚊: "基因驱动", 基因改造: "基因驱动", "gene drive": "基因驱动",
  不育昆虫技术: "SIT", 昆虫不育技术: "SIT", "sterile insect technique": "SIT",
  昆虫不相容技术: "IIT人群替换", 不相容昆虫技术: "IIT人群替换", "incompatible insect technique": "IIT人群替换",
  "insecticide resistance": "杀虫剂抗性", 抗药性: "杀虫剂抗性", 菊酯抗性: "杀虫剂抗性",
  "insecticide application": "杀虫剂应用", "indoor residual spraying": "杀虫剂应用", 滞留喷洒: "杀虫剂应用",
  vaccination: "疫苗", 疫苗接种: "疫苗", vaccine: "疫苗",
  antiviral: "抗病毒", 抗病毒药物: "抗病毒",
  "community engagement": "社区干预", "health education": "社区干预", 健康教育: "社区干预",
  // 蚊种与阶段
  伊蚊: "埃及伊蚊", "aedes aegypti": "埃及伊蚊", 白纹伊蚊: "白纹伊蚊", "aedes albopictus": "白纹伊蚊",
  anopheles: "按蚊", 按蚊属: "按蚊",
  库蚊属: "库蚊", culex: "库蚊",
  实验室: "体外", "in vitro": "体外", 野外: "现场", 田间: "现场", "field trial": "现场", "semi-field": "半野外", 半田间: "半野外",
  // 分类标签
  研究论文: "原始研究", 研究: "原始研究", 论文: "原始研究", 综述: "综述与观点", 观点: "综述与观点", meta分析: "综述与观点",
  方法: "方法与工具", 工具: "方法与工具", 模型: "预测与建模", 建模: "预测与建模",
  监测: "监测与流行病学", 流行病学: "监测与流行病学", 血清学: "监测与流行病学",
  临床试验: "临床与诊断", 诊断: "临床与诊断", 抗病毒药物研究: "疫苗与抗病毒",
  指南: "指南与政策", 政策: "指南与政策", 现场试验: "现场与中试", 中试: "现场与中试",
};

// ── 机构 ────────────────────────────────────────────────────────────────────────────────

/**
 * 机构主题：id → 显示名、卡片上显示的标签（null 表示只用 entity:<id> 归类）、别名。
 * aliases 给结构抽取模型看；orgNames 是机构发消息时开头用的名字；otherNames 是其他称呼。
 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; orgNames?: string[]; otherNames?: string[] }> = {
  wmp: { name: "World Mosquito Program", displayTag: "WMP", aliases: ["World Mosquito Program", "WMP", "Eliminate Dengue"], orgNames: ["World Mosquito Program", "WMP"], otherNames: ["WMP Global"] },
  monash: { name: "Monash University", displayTag: null, aliases: ["Monash University", "Monash"], orgNames: ["Monash University", "Monash"] },
  yipd: { name: "云南省寄生虫病防治所", displayTag: null, aliases: ["Yunnan Institute of Parasitic Diseases", "云南省寄生虫病防治所", "YIPD"], orgNames: ["云南省寄生虫病防治所", "Yunnan Institute of Parasitic Diseases"] },
  "china-cdc": { name: "中国疾控中心", displayTag: null, aliases: ["Chinese Center for Disease Control and Prevention", "China CDC", "中国疾病预防控制中心", "中国疾控中心"], orgNames: ["中国疾病预防控制中心", "China CDC"] },
  iaea: { name: "IAEA", displayTag: null, aliases: ["International Atomic Energy Agency", "IAEA"], orgNames: ["IAEA"] },
  who: { name: "WHO", displayTag: "WHO", aliases: ["World Health Organization", "WHO", "世界卫生组织"], orgNames: ["World Health Organization", "WHO"] },
  cdc: { name: "US CDC", displayTag: "CDC", aliases: ["Centers for Disease Control and Prevention", "US CDC", "CDC"], orgNames: ["Centers for Disease Control and Prevention", "CDC"] },
  pasteur: { name: "Institut Pasteur", displayTag: null, aliases: ["Institut Pasteur", "Pasteur Institute"], orgNames: ["Institut Pasteur"] },
  lshtm: { name: "LSHTM", displayTag: null, aliases: ["London School of Hygiene & Tropical Medicine", "London School of Hygiene and Tropical Medicine", "LSHTM"], orgNames: ["London School of Hygiene & Tropical Medicine", "LSHTM"] },
  imperial: { name: "Imperial College London", displayTag: null, aliases: ["Imperial College London", "Imperial College"], orgNames: ["Imperial College London"] },
  jhu: { name: "Johns Hopkins", displayTag: null, aliases: ["Johns Hopkins University", "Johns Hopkins Bloomberg School of Public Health", "Johns Hopkins"], orgNames: ["Johns Hopkins University", "Johns Hopkins"] },
  ecdc: { name: "ECDC", displayTag: null, aliases: ["European Centre for Disease Prevention and Control", "ECDC"], orgNames: ["European Centre for Disease Prevention and Control", "ECDC"] },
  paho: { name: "PAHO", displayTag: null, aliases: ["Pan American Health Organization", "PAHO", "Organización Panamericana de la Salud"], orgNames: ["Pan American Health Organization", "PAHO"] },
  fiocruz: { name: "Fiocruz", displayTag: null, aliases: ["Oswaldo Cruz Foundation", "Fiocruz", "Fundação Oswaldo Cruz"], orgNames: ["Oswaldo Cruz Foundation", "Fiocruz"] },
};

/**
 * 身份词典：摘要和标题里出现的机构，必须在原文里也出现过，否则退回原标题、丢掉摘要（防止模型张冠李戴）。
 * 学术文献的机构通常只出现在作者单位，误伤概率高于收益，故置空。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [];

/** 这些域名上的文章，发布方就是对应的机构（学术文献不适用）。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [];

/** 原文里的这些写法也算提到了对应机构。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];
