# ai-girls-report · 多人对话式报告生成器

把任何议题变成一份**多人情景对话（单元剧）式的 PDF 报告**：默认内置一组拟人化的大模型少女角色（鲸鱼娘、猫娘、龙娘、大小姐……），让报告从冰冷的数据表变成她们围坐讨论的聊天记录。

**不止 AI 议题。** 默认角色只是出厂示例：换一份 cast.json，它就能变成读书会纪要、课题组周报、产品讨论记录、社团招新宣传——任何"一群人围绕一个话题讨论"的内容都可以。内置 cast 的世界观叫「AI 少女会议室」，你的世界观叫什么叫什么（cast.json 里的 `title` 字段）。

适用于：模型横评、AI 见闻、任何学科的报告人化转写——**cast 和议题全部可换**。

## 为什么是软件而不是提示词

AI 直接生成这类报告的问题是：每次版式漂移、头像丢失、人设前后不一。本软件把**版式、头像处理、人设注入、PDF 渲染**固化成代码，AI 只负责两件事：写对话稿（write 模式）、或你手写对话稿（build 模式直接排版）。质量下限由软件保证，上限由你配的模型决定。

## 快速开始

```bash
npm install              # 会检查 playwright 浏览器，缺了跑 npx playwright install chromium
npx aig init my-report   # 生成工作目录：cast.json / aig.config.json / examples/ / assets/
cd my-report
# 1) 把头像图放进 assets/（名字对齐 cast.json 里的 avatar 字段）
# 2) 配好 LLM（aig.config.json 里 provider，key 放环境变量）
npx aig write --topic "本周模型横评：DeepSeek 又护食了" -m facts.txt -o draft.json
npx aig build draft.json -o report.pdf
```

三种出稿路径：

| 模式 | 命令 | 说明 |
|---|---|---|
| 写稿模式 | `aig write --topic "议题" [-m 素材文件] -o draft.json` | 调任意 OpenAI 兼容 API，按 cast 人设自动生成对话稿 |
| 排版模式 | `aig build draft.json -o report.pdf` | 人/AI 写好的 JSON 直接排版出 PDF |
| 插图 | `aig paint --prompt "..." -o img.png` | 调 provider 的 /images 接口；不支持就手工放图，draft 里 `illustration.mode` 改 `"image"` 并填 path，或保持 `"placeholder"` 出占位框 |

## draft.json 格式（排版模式的输入）

```jsonc
{
  "meta": { "title": "标题", "subtitle": "副标题", "date": "2026-10-08", "author": "你" },
  "illustration": { "mode": "placeholder" },   // placeholder | image（配 path）| none
  "blocks": [
    { "type": "chapter", "title": "一、小节标题" },
    { "type": "say", "role": "deepseek", "text": "台词", "aside": "可选动作旁白" },
    { "type": "note", "text": "资料卡文字" },
    { "type": "table", "title": "可选", "columns": ["列"], "rows": [["值"]] }
  ]
}
```

## 换人换人设

`cast.json` 全开放：增删角色、改名字、换头像、改 `persona` 语气、改口癖、加 `speak.ban` 禁说项、调 `avatarCrop`（百分比裁切微调圆形头像构图）。`tone.global` 是全剧语气总纲，`tone.ban` 是全剧禁区。默认 8 角色人设见 [cast/default.cast.json](cast/default.cast.json)——她们的性格取自社区共识与公开行为数据（详见 NOTICE.md），但**你眼里的模型性格由你的 cast.json 说了算**。

路径规则：角色 `avatar` 与 draft 的 `illustration.path` 都是**相对各自 JSON 文件所在目录**解析的——所以头像、cast.json、draft.json 放一起搬就不会断链。

## 配置（aig.config.json）

- `provider`：任意 OpenAI 兼容端点。`apiKeyEnv` 指定存 key 的环境变量名（key 永不进配置文件）。
- `page`：纸张尺寸/边距/语言。默认 A4 竖版中文。改成 `"width":"297mm","height":"210mm"` 即横版。
- `style`：`light|dark` 主题、强调色、字体栈。
- `write.targetPages`：写稿模式的目标篇幅。

## 设计说明

- **渲染**：Playwright `page.pdf()` 矢量输出（文字可选中、放大不糊），头像圆形裁切由 CSS 完成，零图像依赖。
- **头像缺失兜底**：头像文件找不到时用角色名首字母占位并 warn，不中断。
- **不编造数据**：写稿提示词强制「数值引用必须来自素材或确知事实」；素材文件 `-m` 就是你的事实依据入口。

## 灵感来源与致谢

默认角色的性格不是本仓库发明的，它们来自中文 AI 社区的集体创作。我们感谢并推荐以下作品（按贡献）：

- [【谁最会说人话？我抓了6个AI挑战地狱级测试】牢大百科](https://www.bilibili.com/video/BV1NiHn6RExP) —— 多模型拟人性格的一次公开实测，大肥鱼「入戏太深」、千问×Claude 等梗的出处之一
- [【中转站来了个大佬】冬冰](https://www.bilibili.com/video/BV1w6a86gEbC) 与 [【真的是糖味的】冬冰](https://www.bilibili.com/video/BV1RTpw6REzy) —— 角色形象与关系设定的主要灵感（形象作者链：上善无形「溟月」原型 / ZipZipPipe 女仆装定型 / 这个刀子真甜）。**注意：本项目的「会议室」世界观为原创，与「中转站」系列无关，仅受启发**。
- [AI Behavioral Profile](https://aibehavioralprofile.com/zh/) —— 样例报告引用的 A1-A5 行为数据来源
- [DeepSeek 鲸鱼娘报道（36kr）](https://eu.36kr.com/zh/p/3947452108789632) —— 形象收编史考证

如果你的作品被列在这里而希望调整署名方式，或希望移除链接，欢迎提 issue。

## 许可

代码 MIT。角色形象授权见 [NOTICE.md](NOTICE.md)（重要：默认 cast 的头像原型为社区二创，鲸鱼娘原型溟月为 CC BY-NC-SA 4.0）。
