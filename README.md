# AI PMCoach

面向准备转型 AI 产品经理的能力诊断应用，使用 React、Vite 和 Tailwind CSS。

An AI product management assessment tool for aspiring AI PMs, using adaptive quizzes and a six-dimension radar chart to identify skill gaps and guide learning.

在线体验：https://ai-pmcoach-xiaok.tsuyoshikate.chatgpt.site/

## 功能

- 落地页、测评介绍页、答题页和六维度结果页。
- 从 314 道题中逐题抽取 18 题，每个维度 3 题。
- 简化自适应抽题：初始难度 3，答对升一级、答错降一级，范围 1–5。
- 难度分 5 档：入门 1、基础 2、进阶 3、高阶 4、专家 5（原 100 题的基础、进阶、高阶对应 2、3、4）。每个维度每档至少 6 题；目标难度缺题时，在同维度选择最接近的可用难度，并按实际难度计分。
- 避免重复出题：优先抽从没做过的题；某维度全部做过后，只从「较早做过的一半」里回用，最近一两次做过的题不会马上再出现。按 18 题一次计算，连续约 12 次测评不重复。
- 主要成绩为正确率，保留一位小数；自适应估计分和六维度雷达图为辅助信息。
- 答题记录与用时保存在当前浏览器的 localStorage，刷新可继续。记录不会上传到服务器。
- 浏览器控制台记录抽题决策和分数变化。

六维度诊断依据用户本次答题记录、原题库考核点及逐项解析生成，包括一句话总结、引用题号的薄弱点与决策卡练习、基于答对题目的鼓励、诊断信心分及完整答题依据。跳过单列为缺少证据，不据此断言能力缺失。信心分为可解释的规则证据分，不是统计置信概率；未调用大模型。已有测评刷新即可生成诊断。

学习计划按钮暂未接入功能。能力估计使用简化规则，未经过心理测量校准。

## 本地运行

需要 Node.js 20.19+ 或 22.12+。

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:4192/ 。

## 测试与构建

```sh
node --test tests/*.test.js
npm run build
```

构建结果位于 dist/。采用 hash 路由。部署到 GitHub Pages 仓库子路径时，运行：

```sh
npm run build -- --base=./
```

然后将 dist/ 作为静态站点发布。

## 计分规则

正确率 = 答对题数 / 18 × 100%，跳过按未答对计算。

每个维度估计分初始为 50，每题更新：旧分 × 0.7 + 本题贡献 × 0.3。

| 实际难度 | 答对贡献 | 答错贡献 |
| --- | --- | --- |
| 1 | 50 | 20 |
| 2 | 60 | 30 |
| 3 | 75 | 45 |
| 4 | 90 | 50 |
| 5 | 100 | 60 |

六维度估计分的平均值作为辅助综合分。跳过参与难度和分数更新。

## 题库

题库文件为 src/question-bank.js，共 314 题：

| 维度 | 题数 |
| --- | --- |
| AI 基础认知 | 50 |
| 用户与场景洞察 | 49 |
| AI 产品设计 | 51 |
| 数据与效果评估 | 49 |
| 项目落地与协作 | 66 |
| 商业与增长 | 49 |

- 001–100：由 scripts/import-question-bank.mjs 从标注 Markdown 导入（原始附件未包含在仓库中）。
- 101–254：源文件在 question-sources/d1.txt–d6.txt（按维度），用 `node scripts/build-extra-questions.mjs <输出.json> 101 question-sources/d1.txt … d6.txt` 生成。题源包括课程《AI 产品经理面试核心 50 题》《AI 产品经理面试题库》、课程知识库，以及人人都是产品经理的公开文章，覆盖 RAG、Agent、评测、幻觉兜底、成本与 ROI 等。每题记录 `source`。
- 255–314：加难批次，源文件 question-sources/h1.txt–h6.txt，用 `node scripts/build-extra-questions.mjs <输出.json> 255 question-sources/h1.txt … h6.txt` 生成。每个维度 10 题（以 3 级为主，加 4、5 级），题干带具体数字和约束，干扰项多为「大方向对、但不符合本题条件」的近似答案。
- 抽题时同一难度先出 101 号以后的新题，旧题（001–100）等新题用完才出，所以第一次测评不会出现旧题。
- 新题的正确选项位置由脚本均衡分配（A–D 各约 25%），并有测试检查「正确项是最长选项」的比例低于 25%，避免凭长度猜答案。

## AI 诊断（Vercel 中转）

部署在 Vercel 时自动开启大模型诊断、学习资源推荐和情景题评分；部署在 GitHub Pages 等静态托管时只用规则诊断。

- `api/` 是 Vercel 的后端函数：`ai-status` 发放 30 分钟有效的会话令牌；`diagnose`、`resources`、`scenario` 校验同源和令牌，**用题库和代码重新计算答题记录、重建提示词**，不转发浏览器传来的任何指令，再调用 DeepSeek。
- 密钥只放在 Vercel 环境变量里，浏览器拿不到。
- 每日限额：每位访客（按 IP 哈希）默认每天 15 次，全站默认每天 300 次，计数存在 Upstash Redis。超额、未配置或模型出错时返回错误，前端按原有逻辑重试后自动改用规则诊断，所以任何配置缺失都不会导致无限花费。
- 环境变量：`DEEPSEEK_API_KEY`（必填）；Upstash 集成会自动加上 `KV_REST_API_URL`、`KV_REST_API_TOKEN`；可选 `DEEPSEEK_MODEL`（默认 `deepseek-v4-flash`）、`DAILY_PER_VISITOR`、`DAILY_TOTAL`。
- 建议在 DeepSeek 平台为本项目单独建一个密钥，账户只保留少量余额，作为最后一道保险。

## AI 诊断的指令与校验（原说明）

公开版本默认使用规则诊断，下载后无需配置模型即可运行。已提供严格的五段中文诊断指令、输出校验、1秒/3秒重试和24段分档通用诊断；如需使用大模型，请自行接入后端。详见 [诊断指令](docs/AI_DIAGNOSIS_PROMPT.md) 和 [接入说明](docs/AI_DIAGNOSIS_INTEGRATION.md)。仓库不包含作者的本地 GPT 适配器、账号凭据或代理配置。
