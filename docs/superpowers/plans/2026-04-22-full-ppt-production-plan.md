# Full PPT Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the full Xidea competition presentation deck as editable PowerPoint files plus the supporting script and media manifest, aligned with the approved PPT design spec.

**Architecture:** Build the deck from the approved narrative spec into three concrete artifacts: a slide-by-slide content script, a media manifest for screenshots/video/GIF inserts, and the editable `.pptx` deck itself. Keep vision-vs-MVP framing explicit, use one source of truth for slide copy, and verify that the final deck supports both the 5-6 minute main talk and appendix-driven Q&A.

**Tech Stack:** Markdown docs, local repo assets, PowerPoint skill / `.pptx` output workflow, shell verification commands, git

---

## File Structure

### Production Artifacts

- Create: `docs/pitch/README.md`
  - Purpose: explain where the deck, script, and media files live and how to update them
- Create: `docs/pitch/2026-04-22-xidea-defense-script.md`
  - Purpose: slide-by-slide source of truth for titles, on-slide copy, and voiceover notes
- Create: `docs/pitch/2026-04-22-xidea-defense-media-manifest.md`
  - Purpose: exact list of screenshots, GIFs, and demo clips required by the deck
- Create: `docs/pitch/assets/.gitkeep`
  - Purpose: reserve the asset directory for exported screenshots, GIFs, and video clips
- Create: `docs/pitch/2026-04-22-xidea-defense-main.pptx`
  - Purpose: main 23-slide presentation deck
- Create: `docs/pitch/2026-04-22-xidea-defense-appendix.pptx`
  - Purpose: appendix deck or appendix section exported as its own editable file

### Design Inputs

- Read: `docs/superpowers/specs/2026-04-22-full-ppt-design.md`
- Read: `docs/superpowers/specs/2026-04-21-demo-modules-design.md`
- Read: `docs/reference/competition-defense-kit.md`

## Task 1: Set Up Pitch Artifact Structure

**Files:**
- Create: `docs/pitch/README.md`
- Create: `docs/pitch/assets/.gitkeep`

- [ ] **Step 1: Create the pitch directory and asset folder**

Run:

```bash
mkdir -p docs/pitch/assets
touch docs/pitch/assets/.gitkeep
```

Expected: `docs/pitch/` and `docs/pitch/assets/` both exist.

- [ ] **Step 2: Write the pitch README**

Add:

```markdown
# Pitch Artifacts

This directory stores the Xidea competition presentation artifacts.

- `2026-04-22-xidea-defense-script.md`: slide-by-slide script for the main deck
- `2026-04-22-xidea-defense-media-manifest.md`: media checklist for screenshots, GIFs, and videos
- `2026-04-22-xidea-defense-main.pptx`: main presentation deck
- `2026-04-22-xidea-defense-appendix.pptx`: appendix / backup slides
- `assets/`: exported screenshots, GIFs, short demo clips, and other visual inserts

Update the script before editing slide copy. Update the media manifest before recording or replacing any demo asset.
```

- [ ] **Step 3: Verify the structure exists**

Run:

```bash
find docs/pitch -maxdepth 2 -type f | sort
```

Expected output contains:

```text
docs/pitch/README.md
docs/pitch/assets/.gitkeep
```

- [ ] **Step 4: Commit the structure**

Run:

```bash
git add docs/pitch/README.md docs/pitch/assets/.gitkeep
git commit -m "docs(pitch): initialize presentation artifact structure"
```

Expected: commit succeeds with only the two new pitch structure files staged.

## Task 2: Write the Slide-By-Slide Main Deck Script

**Files:**
- Create: `docs/pitch/2026-04-22-xidea-defense-script.md`
- Read: `docs/superpowers/specs/2026-04-22-full-ppt-design.md`

- [ ] **Step 1: Draft the script header and deck rules**

Add:

```markdown
# Xidea Defense Deck Script

## Main Deck Rules

- Main talk target: 5-6 minutes
- Language: Chinese-first, key terms keep English (`scope`, `session`, `agent`, `memory`, `feedback`)
- Tone: technical product + AI innovation pitch
- Main deck target: 23 slides
- Main case: 按 LLM 学习主题做持续学习，但演示知识点保持浅显易懂

## Slide Template

For each slide, capture:

1. Slide title
2. On-slide copy
3. Visual form
4. Voiceover notes
5. Promise this slide proves
```

- [ ] **Step 2: Write slides 1-9 for opportunity and product definition**

Add:

```markdown
## Slide 1
- Title: Xidea：AI 学习编排系统
- On-slide copy:
  - 用 AI 把分散的学习环节重新整合成持续学习系统
- Visual form: strong cover slide
- Voiceover notes:
  - 我们不是做一个单点学习工具，而是想把问答、材料理解、练习和复习重新放回同一个系统
- Promise: establish product category

## Slide 2
- Title: 一句话定义
- On-slide copy:
  - 用 AI 把分散的学习环节重新整合成持续学习系统
- Visual form: single-statement slide
- Voiceover notes:
  - 重点不是功能更多，而是系统第一次能拿到完整学习上下文
- Promise: define the product in one sentence

## Slide 3
- Title: 现有产品解决的是分散环节
- On-slide copy:
  - Anki：科学复习
  - AI tutor：即时辅导
  - 材料理解工具：资料整理
  - 语言训练产品：场景化训练
- Visual form: competitor landscape diagram
- Voiceover notes:
  - 市面上已经有很多好工具，但它们大多各自解决学习闭环中的一段
- Promise: show fragmentation

## Slide 4
- Title: 为什么要做整合
- On-slide copy:
  - 整合多个学习环节
  - 上下文更完整
  - 状态判断更准
  - 编排更成立
- Visual form: arrow/value-chain diagram
- Voiceover notes:
  - 只有把这些环节放回一个系统里，AI 才可能真正知道用户卡在哪里、下一步该怎么学
- Promise: justify the new layer

## Slide 5
- Title: 学习编排层，才是新的产品机会
- On-slide copy:
  - 不是再做一个功能更全的学习工具
  - 而是补出“判断和编排”这一层
- Visual form: strong statement slide
- Voiceover notes:
  - 创新不在单点功能，而在学习编排层
- Promise: lock the opportunity thesis

## Slide 6
- Title: 我们是什么，不是什么
- On-slide copy:
  - 是：按学习主题 `scope` 持续推进的学习系统
  - 不是：AI tutor / AI summary / 单点刷题工具
- Visual form: left-right contrast
- Voiceover notes:
  - 这一步是为了先把评委的参照系摆正
- Promise: prevent category confusion

## Slide 7
- Title: 按学习主题 scope 组织持续学习
- On-slide copy:
  - 一个主题 scope
  - 多轮材料、知识点、session、feedback
- Visual form: scope-centered concept diagram
- Voiceover notes:
  - 当前比赛版用 Project 承载这个 scope，但 Project 不是长期唯一产品形态
- Promise: explain organizing principle

## Slide 8
- Title: 系统如何运作
- On-slide copy:
  - scope → materials → knowledge points → sessions → feedback
- Visual form: product system diagram
- Voiceover notes:
  - 这条主线会贯穿后面的功能介绍、demo 和技术方案
- Promise: define the core system flow

## Slide 9
- Title: 当前比赛版如何收敛
- On-slide copy:
  - 长期：chat-first / AI-assisted scope discovery
  - 当前：grounded material flow MVP
- Visual form: bridge slide
- Voiceover notes:
  - 长期上我们希望 AI 能帮助确定 scope 边界；当前比赛版先用材料上传跑通最小闭环
- Promise: bridge vision and MVP
```

- [ ] **Step 3: Write slides 10-18 for feature proof and demo**

Add:

```markdown
## Slide 10
- Title: 材料如何变成知识点
- On-slide copy:
  - 材料不会只被总结
  - 会变成可学习、可追踪、可复习的知识点
- Visual form: screenshot + callouts
- Voiceover notes:
  - 这页是 grounded 入口成立的第一个证据
- Promise: show object formation

## Slide 11
- Title: 为什么需要研讨 session
- On-slide copy:
  - 澄清问题
  - 补上下文
  - 调整知识点边界
- Visual form: short clip or three-frame sequence
- Voiceover notes:
  - 研讨不是闲聊，而是在整理学习对象
- Promise: justify discussion mode

## Slide 12
- Title: 为什么学习和复习要分开
- On-slide copy:
  - 学习：针对还没掌握的知识点
  - 复习：针对已经学过但需要巩固的知识点
- Visual form: side-by-side comparison
- Voiceover notes:
  - 这里要强调“系统按状态决定动作”
- Promise: prove differentiated modes

## Slide 13
- Title: 复习反馈如何驱动持续学习
- On-slide copy:
  - 本轮 feedback 不会停留在当前 session
  - 会进入下一轮安排
- Visual form: circular feedback diagram
- Voiceover notes:
  - 持续学习的关键，不在于做了题，而在于结果会回流
- Promise: show continuous learning

## Slide 14
- Title: 系统真的在维护状态
- On-slide copy:
  - 画像
  - 热力图
  - 状态视图
- Visual form: proof collage
- Voiceover notes:
  - 不展开算法，只证明系统真的在维护状态对象
- Promise: prove state maintenance

## Slide 15
- Title: 功能证据
- On-slide copy:
  - materials
  - knowledge points
  - sessions
  - feedback
- Visual form: screenshot / GIF collage
- Voiceover notes:
  - 这页不讲新概念，只建立“已经做出来了”的真实感
- Promise: accumulate product evidence

## Slide 16
- Title: Demo 主链
- On-slide copy:
  - LLM learning scope
  - 导入材料
  - 生成知识点
  - 学习 / 复习
  - feedback
- Visual form: clean demo roadmap
- Voiceover notes:
  - 告诉评委接下来要看什么，不要边演边解释大结构
- Promise: orient the live demo

## Slide 17
- Title: Demo 演示 1
- On-slide copy:
  - scope / materials / knowledge points
- Visual form: live demo or embedded clip
- Voiceover notes:
  - 聚焦前半链路，不解释太多 UI 细节
- Promise: show front half of the loop

## Slide 18
- Title: Demo 演示 2
- On-slide copy:
  - session / feedback / next round
- Visual form: live demo or embedded clip
- Voiceover notes:
  - 重点证明 feedback 会进入下一轮
- Promise: show back half of the loop
```

- [ ] **Step 4: Write slides 19-23 for technology and closing**

Add:

```markdown
## Slide 19
- Title: Agent + Memory 如何支撑学习编排闭环
- On-slide copy:
  - Agent
  - Memory
  - Learning loop
- Visual form: system architecture summary
- Voiceover notes:
  - 技术部分不讲全栈，只讲为什么这套系统能成立
- Promise: frame the technical section

## Slide 20
- Title: Agent：状态与决策
- On-slide copy:
  - 状态
  - 决策
  - 动作
- Visual form: decision loop diagram
- Voiceover notes:
  - agent 围绕知识点、学习状态和复习状态运行，不是只看当前一句话
- Promise: explain the agent core

## Slide 21
- Title: Memory：如何记录、组织、更新
- On-slide copy:
  - 记录学习对象
  - 组织主题上下文
  - 更新用户状态
  - 变成 LLM 可用上下文
- Visual form: layered memory diagram
- Voiceover notes:
  - 这是这套系统和普通 chat + tools 最本质的差异之一
- Promise: explain durable context management

## Slide 22
- Title: 为什么这不是 chat + tools
- On-slide copy:
  - Agent 负责决策
  - Memory 负责连续性
  - 两者一起形成持续学习闭环
- Visual form: conclusion slide with small diagram
- Voiceover notes:
  - 前端只是承载面，真正的系统能力在状态、决策和写回
- Promise: close the technical proof

## Slide 23
- Title: 最后一句话
- On-slide copy:
  - 别人解决学习中的单点
  - 我们解决跨环节的判断、组织与持续推进
- Visual form: strong ending slide
- Voiceover notes:
  - 最后轻提未来会扩到 chat-first scope discovery、多模态和更完整 review engine
- Promise: land the final thesis
```

- [ ] **Step 5: Verify the script contains all 23 slides**

Run:

```bash
rg -n '^## Slide ' docs/pitch/2026-04-22-xidea-defense-script.md | wc -l
```

Expected output:

```text
23
```

- [ ] **Step 6: Commit the main deck script**

Run:

```bash
git add docs/pitch/2026-04-22-xidea-defense-script.md
git commit -m "docs(pitch): add main deck script"
```

Expected: commit succeeds with the new script file only.

## Task 3: Write the Media Manifest

**Files:**
- Create: `docs/pitch/2026-04-22-xidea-defense-media-manifest.md`

- [ ] **Step 1: Add the media manifest header and recording rules**

Add:

```markdown
# Xidea Defense Deck Media Manifest

## Recording Rules

- Each clip proves one thing only
- Keep clips between 8 and 20 seconds
- If the product is slow, trim waiting time in post
- Prefer GIF or MP4 for feature proof slides
- Prefer live demo or stitched MP4 for the two main demo slides
```

- [ ] **Step 2: List the required graphics**

Add:

```markdown
## Graphics

1. `assets/competitor-landscape.png`
   - Used by: Slide 3
   - Content: Anki / tutor / language training / material understanding occupy separate segments

2. `assets/integration-value-chain.png`
   - Used by: Slide 4
   - Content: integration -> richer context -> better state judgment -> better orchestration

3. `assets/product-system-flow.png`
   - Used by: Slide 8
   - Content: scope -> materials -> knowledge points -> sessions -> feedback -> next round

4. `assets/agent-memory-loop.png`
   - Used by: Slide 19
   - Content: Memory feeds Agent, Agent updates Memory
```

- [ ] **Step 3: List the required screenshots and clips**

Add:

```markdown
## Screenshots / Clips

1. `assets/material-to-knowledge-points.gif`
   - Used by: Slide 10
   - Proves: material upload creates knowledge points

2. `assets/discussion-session.gif`
   - Used by: Slide 11
   - Proves: discussion session helps refine learning scope and knowledge-point boundaries

3. `assets/study-review-session.gif`
   - Used by: Slide 12
   - Proves: study and review are different action paths

4. `assets/feedback-loop.gif`
   - Used by: Slide 13
   - Proves: feedback updates later learning

5. `assets/state-views-collage.png`
   - Used by: Slide 14
   - Proves: profile, heatmap, and state views exist

6. `assets/feature-proof-collage.png`
   - Used by: Slide 15
   - Proves: the product is implemented beyond concept mockups

7. `assets/demo-part-1.mp4`
   - Used by: Slide 17
   - Proves: front half of the main demo path

8. `assets/demo-part-2.mp4`
   - Used by: Slide 18
   - Proves: back half of the main demo path
```

- [ ] **Step 4: Verify the manifest names every media file under `docs/pitch/assets/`**

Run:

```bash
rg -o 'assets/[A-Za-z0-9._-]+' docs/pitch/2026-04-22-xidea-defense-media-manifest.md | sort -u
```

Expected output contains all eight asset paths above.

- [ ] **Step 5: Commit the media manifest**

Run:

```bash
git add docs/pitch/2026-04-22-xidea-defense-media-manifest.md
git commit -m "docs(pitch): add defense deck media manifest"
```

Expected: commit succeeds with the manifest file only.

## Task 4: Produce the Main Deck

**Files:**
- Create: `docs/pitch/2026-04-22-xidea-defense-main.pptx`
- Read: `docs/pitch/2026-04-22-xidea-defense-script.md`
- Read: `docs/pitch/2026-04-22-xidea-defense-media-manifest.md`

- [ ] **Step 1: Build the slide content in deck order**

Use this condensed deck order as the production checklist:

```markdown
1. Cover
2. One-liner
3. Competitor landscape
4. Why integration
5. Orchestration layer opportunity
6. What we are / are not
7. Organizing by learning scope
8. Product system flow
9. MVP bridge
10. Material -> knowledge points
11. Discussion session
12. Study vs review
13. Feedback loop
14. State views
15. Feature proof collage
16. Demo roadmap
17. Demo part 1
18. Demo part 2
19. Agent + Memory overview
20. Agent
21. Memory
22. Not just chat + tools
23. Final thesis
```

- [ ] **Step 2: Generate the editable main deck**

Implementation target:

```text
Output file: docs/pitch/2026-04-22-xidea-defense-main.pptx
Slide count: 23
Visual direction: technical product base + AI innovation pitch lift
Language: Chinese-first, keyword English
```

- [ ] **Step 3: Verify the main deck file exists**

Run:

```bash
ls -lh docs/pitch/2026-04-22-xidea-defense-main.pptx
```

Expected: one `.pptx` file exists at that path and is non-empty.

- [ ] **Step 4: Verify the deck matches the script count**

Run:

```bash
python3 - <<'PY'
from zipfile import ZipFile
from pathlib import Path
deck = Path("docs/pitch/2026-04-22-xidea-defense-main.pptx")
with ZipFile(deck) as z:
    slides = [n for n in z.namelist() if n.startswith("ppt/slides/slide") and n.endswith(".xml")]
print(len(slides))
PY
```

Expected output:

```text
23
```

- [ ] **Step 5: Commit the main deck**

Run:

```bash
git add docs/pitch/2026-04-22-xidea-defense-main.pptx
git commit -m "feat(pitch): add main competition deck"
```

Expected: commit succeeds with the deck file only.

## Task 5: Produce the Appendix Deck

**Files:**
- Create: `docs/pitch/2026-04-22-xidea-defense-appendix.pptx`

- [ ] **Step 1: Define the appendix slide list**

Use:

```markdown
1. Competitor detail table
2. State object / memory layering
3. Current MVP vs long-term vision
4. Roadmap
5. Backup demo screenshots
6. Q&A reserve
```

- [ ] **Step 2: Generate the appendix deck**

Implementation target:

```text
Output file: docs/pitch/2026-04-22-xidea-defense-appendix.pptx
Slide count: 6
Purpose: backup support, not main-stage narrative
```

- [ ] **Step 3: Verify the appendix deck file exists**

Run:

```bash
ls -lh docs/pitch/2026-04-22-xidea-defense-appendix.pptx
```

Expected: one non-empty `.pptx` file exists at that path.

- [ ] **Step 4: Verify appendix slide count**

Run:

```bash
python3 - <<'PY'
from zipfile import ZipFile
from pathlib import Path
deck = Path("docs/pitch/2026-04-22-xidea-defense-appendix.pptx")
with ZipFile(deck) as z:
    slides = [n for n in z.namelist() if n.startswith("ppt/slides/slide") and n.endswith(".xml")]
print(len(slides))
PY
```

Expected output:

```text
6
```

- [ ] **Step 5: Commit the appendix deck**

Run:

```bash
git add docs/pitch/2026-04-22-xidea-defense-appendix.pptx
git commit -m "feat(pitch): add appendix deck"
```

Expected: commit succeeds with the appendix deck only.

## Task 6: Final QA and Handoff

**Files:**
- Modify: `docs/pitch/README.md`

- [ ] **Step 1: Add final artifact checklist to the README**

Append:

```markdown
## Final Checklist

- Main deck exists and has 23 slides
- Appendix deck exists and has 6 slides
- Main script matches the shipped deck
- Media manifest lists every required screenshot / GIF / MP4
- Main deck supports the 5-6 minute talk without appendix
```

- [ ] **Step 2: Run the final artifact inventory**

Run:

```bash
find docs/pitch -maxdepth 2 -type f | sort
```

Expected output contains:

```text
docs/pitch/2026-04-22-xidea-defense-appendix.pptx
docs/pitch/2026-04-22-xidea-defense-main.pptx
docs/pitch/2026-04-22-xidea-defense-media-manifest.md
docs/pitch/2026-04-22-xidea-defense-script.md
docs/pitch/README.md
docs/pitch/assets/.gitkeep
```

- [ ] **Step 3: Commit the final handoff update**

Run:

```bash
git add docs/pitch/README.md
git commit -m "docs(pitch): add deck handoff checklist"
```

Expected: commit succeeds with the README update only.

## Self-Review

### Spec Coverage

This plan covers the spec by mapping:

- core narrative and opportunity framing -> main deck slides 2-5
- product definition and system flow -> main deck slides 6-9
- feature explanation and local proof -> main deck slides 10-15
- demo proof -> main deck slides 16-18
- Agent + Memory technical framing -> main deck slides 19-22
- final thesis and forward edge -> main deck slide 23
- appendix / Q&A support -> appendix deck task

### Placeholder Scan

Search before execution:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path("docs/superpowers/plans/2026-04-22-full-ppt-production-plan.md").read_text()
flags = [
    "T" + "BD",
    "TO" + "DO",
    "implement" + " later",
    "fill in " + "details",
    "appro" + "priate",
    "edge " + "cases",
    "similar " + "to Task",
]
hits = [flag for flag in flags if flag in text]
print(hits)
PY
```

Expected output:

```text
[]
```

### Consistency Check

Keep these filenames and counts consistent throughout execution:

- `docs/pitch/2026-04-22-xidea-defense-main.pptx` -> 23 slides
- `docs/pitch/2026-04-22-xidea-defense-appendix.pptx` -> 6 slides
- `docs/pitch/2026-04-22-xidea-defense-script.md` -> 23 slide entries
- `docs/pitch/2026-04-22-xidea-defense-media-manifest.md` -> 8 named media artifacts
