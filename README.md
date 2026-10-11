# AI PMCoach

面向准备转型 AI 产品经理的能力诊断应用，使用 React、Vite 和 Tailwind CSS。

An AI product management assessment tool for aspiring AI PMs, using adaptive quizzes and a six-dimension radar chart to identify skill gaps and guide learning.

在线体验：https://ai-pmcoach-xiaok.tsuyoshikate.chatgpt.site/

## 功能

- 落地页、测评介绍页、答题页和六维度结果页。
- 从 100 道题中逐题抽取 18 题，每个维度 3 题。
- 简化自适应抽题：初始难度 3，答对升一级、答错降一级，范围 1–5。
- 题库当前的基础、进阶、高阶对应难度 2、3、4；目标难度缺题时，在同维度选择最接近的可用难度，并按实际难度计分。
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

题库文件为 src/question-bank.js。导入脚本为 scripts/import-question-bank.mjs，接收标注 Markdown 文件路径。原始 PDF 和 Markdown 附件未包含在本仓库中。

## 可选 AI 诊断

公开版本默认使用规则诊断，下载后无需配置模型即可运行。已提供严格的五段中文诊断指令、输出校验、1秒/3秒重试和24段分档通用诊断；如需使用大模型，请自行接入后端。详见 [诊断指令](docs/AI_DIAGNOSIS_PROMPT.md) 和 [接入说明](docs/AI_DIAGNOSIS_INTEGRATION.md)。仓库不包含作者的本地 GPT 适配器、账号凭据或代理配置。
