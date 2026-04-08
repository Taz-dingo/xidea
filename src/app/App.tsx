import { startTransition, useMemo, useState, type ReactElement } from "react";
import { learnerProfiles, learningUnits, sourceAssets } from "../data/demo";
import { buildStudyPlan } from "../domain/planner";

export function App(): ReactElement {
  const initialProfile = learnerProfiles[1] ?? learnerProfiles[0];
  const initialUnit = learningUnits[0];

  if (initialProfile === undefined || initialUnit === undefined) {
    throw new Error("Demo data must contain at least one learner profile and one learning unit.");
  }

  const [selectedProfileId, setSelectedProfileId] = useState(initialProfile.id);
  const [selectedUnitId, setSelectedUnitId] = useState(initialUnit.id);

  const selectedProfile = useMemo(
    () => learnerProfiles.find((profile) => profile.id === selectedProfileId) ?? initialProfile,
    [initialProfile, selectedProfileId],
  );
  const selectedUnit = useMemo(
    () => learningUnits.find((unit) => unit.id === selectedUnitId) ?? initialUnit,
    [initialUnit, selectedUnitId],
  );
  const studyPlan = useMemo(
    () => buildStudyPlan(selectedUnit, selectedProfile.state),
    [selectedProfile.state, selectedUnit],
  );

  return (
    <main className="page">
      <header className="section">
        <p className="label">Xidea / 当前阶段</p>
        <h1>只保留比赛现阶段真正要讨论的东西。</h1>
        <p className="muted-text">
          现在不追求多模态全铺开，也不追求复杂视觉。先用一个最小 demo 讲清楚两件事：原始材料如何进入系统，以及系统如何基于学习状态安排下一步。
        </p>
      </header>

      <section className="section grid-two">
        <div>
          <p className="label">阶段目标</p>
          <ul className="simple-list">
            <li>把“动态学习路径”讲清楚</li>
            <li>让三个人能稳定并行协作</li>
            <li>把长期记忆文档放进仓库管理</li>
          </ul>
        </div>
        <div>
          <p className="label">当前输入样例</p>
          <ul className="simple-list">
            {sourceAssets.map((asset) => (
              <li key={asset.id}>
                {asset.title} / {asset.kind} / {asset.topic}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section grid-two">
        <div>
          <p className="label">学习者画像</p>
          <div className="stack">
            {learnerProfiles.map((profile) => (
              <button
                className={profile.id === selectedProfile.id ? "choice active" : "choice"}
                key={profile.id}
                onClick={() => {
                  startTransition(() => {
                    setSelectedProfileId(profile.id);
                  });
                }}
                type="button"
              >
                <strong>{profile.name}</strong>
                <span>{profile.role}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="label">学习主题</p>
          <div className="stack">
            {learningUnits.map((unit) => (
              <button
                className={unit.id === selectedUnit.id ? "choice active" : "choice"}
                key={unit.id}
                onClick={() => {
                  startTransition(() => {
                    setSelectedUnitId(unit.id);
                  });
                }}
                type="button"
              >
                <strong>{unit.title}</strong>
                <span>{unit.summary}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <p className="label">系统判断</p>
        <div className="stats">
          <div className="stat">
            <span>掌握度</span>
            <strong>{selectedProfile.state.mastery}%</strong>
          </div>
          <div className="stat">
            <span>混淆风险</span>
            <strong>{selectedProfile.state.confusion}%</strong>
          </div>
          <div className="stat">
            <span>弱信号</span>
            <strong>{selectedProfile.state.weakSignals.join(" / ")}</strong>
          </div>
        </div>
      </section>

      <section className="section">
        <p className="label">学习路径输出</p>
        <h2>{studyPlan.headline}</h2>
        <p className="muted-text">{studyPlan.summary}</p>
        <ol className="plan-list">
          {studyPlan.steps.map((step) => (
            <li className="plan-item" key={step.id}>
              <strong>{step.title}</strong>
              <span>{step.reason}</span>
              <em>目标：{step.outcome}</em>
            </li>
          ))}
        </ol>
      </section>

      <section className="section grid-two">
        <div>
          <p className="label">协作方式</p>
          <ul className="simple-list">
            <li>产品 owner: 负责 story、范围、答辩表达</li>
            <li>学习引擎 owner: 负责状态、planner、规则</li>
            <li>前端 owner: 负责页面、流程、演示稳定性</li>
          </ul>
        </div>
        <div>
          <p className="label">仓库里的长期记忆</p>
          <ul className="simple-list">
            <li>`docs/memory/project-context.md` 保存稳定背景</li>
            <li>`docs/memory/decision-log.md` 保存已确认决策</li>
            <li>`docs/memory/open-questions.md` 保存未决问题</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
