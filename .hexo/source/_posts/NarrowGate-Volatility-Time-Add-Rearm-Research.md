---
title: "NarrowGate 冷却与重新准入：待验证的时间控制问题"
date: 2026-08-29 13:30:00
updated: 2026-10-17 22:06:04
categories:
- Market Making
tags:
- Market Making
- Cooldown
- State Machine
- 库存生命周期
- Action Uplift
math: true
---

本文按 2026-10-17 的当前研究口径重新整理。旧数值、图表和关闭判断不作为当前结论；下文把可引用的新数据结果、待验证假设与工程证据分开。

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="1-五种动作其实在搜索同一个控制轴"></span>
<span id="2-研究阶段与证据状态"></span>
<span id="3-One-cycle-skip"></span>
<span id="TL-DR：一次跳过看起来是动作，落到成交路径上却接近-no-op"></span>
<span id="1-研究问题：少挂一次，究竟避开毒性还是错过修复？"></span>
<span id="2-输入、动作、结果与竞争风险-estimand"></span>
<span id="3-数据面板与因果时钟"></span>
<span id="4-随机化与完整性检查"></span>
<span id="4-1-动作杠杆的三层漏斗"></span>
<span id="4-2-Competing-risk-utility-为什么不能由两个边际概率拼成"></span>
<span id="4-3-一条-quote-没成交，仍可能改变什么；又通常不改变什么"></span>
<span id="5-OOF-结果：reward-小正点估计不能掩盖生命周期恶化"></span>
<span id="6-当前栈复核为何并非第二篇研究"></span>
<span id="7-不确定性、关闭边界与可以学到什么"></span>
<span id="7-1-MDE-应怎样阅读"></span>
<span id="7-2-为什么不能把-action-duration-偷偷延长"></span>
<span id="7-3-阴性结果留下了什么可复用设计知识"></span>
<span id="8-没有获得的权限"></span>
<span id="Action-dilution-可以在看收益前量化"></span>
<span id="Skip-的反事实不是“没有这张单”这么简单"></span>
<span id="从-one-cycle-到-persistent-skip-是新治疗"></span>
<span id="MDE-为什么应在-outcome-前计算"></span>
<span id="Shadow-mechanics-与经济实验的分工"></span>
<span id="阴性-one-cycle-仍能校准系统响应"></span>
<span id="9-公共证据"></span>
<span id="结语"></span>
<span id="4-Stop-add-until-flat"></span>
<span id="TL-DR：风险尾部改善了，但代价是移除近九成-SELL-add-fills"></span>
<span id="1-从太弱到太强：研究问题的由来"></span>
<span id="2-输入、动作与-estimand"></span>
<span id="3-因果时钟：permission-是持久状态，不是一行-mask"></span>
<span id="3-1-状态递归为什么让-duration-成为动作的一部分"></span>
<span id="3-2-一个-tail-改善但净值不改善的合成例子"></span>
<span id="4-数据与支持"></span>
<span id="5-Development-结果：tail-与-participation-必须联读"></span>
<span id="6-为什么-downside-改善不等于-action-uplift"></span>
<span id="6-1-Activity-gate-是-estimand-约束，不是商业偏好"></span>
<span id="6-2-Action-frontier：太弱与太强之间不是靠插值保证存在最优点"></span>
<span id="6-3-为什么-positive-day-rate-不能替代-clustered-interval"></span>
<span id="7-研究演进：版本为何只是一篇文章中的章节"></span>
<span id="8-关闭边界与不确定性"></span>
<span id="9-没有获得的权限"></span>
<span id="Persistent-permission-是一个-dynamic-treatment-regime"></span>
<span id="Tail-improvement-的成本曲线"></span>
<span id="为什么中间强度不能靠线性插值推出"></span>
<span id="Dynamic-regime-的-off-policy-估计为何困难"></span>
<span id="库存生命周期-terminal-与日终都要报告"></span>
<span id="未来-frontier-的-outcome-blind-预筛"></span>
<span id="10-公共证据"></span>
<span id="结语-1"></span>
<span id="5-State-conditioned-rearm"></span>
<span id="TL-DR：BUY-有弱正点估计，SELL-偏负，但两侧都先败在可执行支持"></span>
<span id="1-研究问题：固定时钟到期后，状态还危险怎么办？"></span>
<span id="2-动作合同与输入"></span>
<span id="3-双时钟与连续-fill-multiplier"></span>
<span id="3-1-Hysteresis-为什么是-treatment-contract，而非防抖细节"></span>
<span id="3-2-四项-conjunction-的稀疏性是乘法问题"></span>
<span id="4-证据面板与随机化完整性"></span>
<span id="5-Chronological-OPE：点估计必须与-repair、duration-联读"></span>
<span id="6-为什么-support-failure-不能用更多模型复杂度解决"></span>
<span id="6-1-名义样本、active-sample-与有效样本"></span>
<span id="6-2-BUY-弱正点估计为什么不能成为-side-specific-loophole"></span>
<span id="6-3-一个合格的状态型-successor-需要什么"></span>
<span id="7-研究演进、关闭与支持边界"></span>
<span id="8-没有获得的权限-1"></span>
<span id="Positivity-为什么会被-conjunction-快速耗尽"></span>
<span id="Hysteresis-的两道阈值怎样改变估计量"></span>
<span id="一个更可识别的-successor"></span>
<span id="Missing-state-不应被解释为“恢复”或“危险”"></span>
<span id="Rearm-触发后的-lineage"></span>
<span id="Support-failure-给出的定量信息"></span>
<span id="9-公共证据-1"></span>
<span id="结语-2"></span>
<span id="6-Recovery-event-rearm"></span>
<span id="TL-DR：这次不是样本不足，也不是停止交易；候选在有支持时仍显著更差"></span>
<span id="1-研究问题：描述恢复是否等于识别有价值的动作？"></span>
<span id="2-四个输入与关键公式"></span>
<span id="2-1-几何均值到底表达了怎样的恢复观"></span>
<span id="2-2-Invalid-state-的方向不能由结果决定"></span>
<span id="3-动作、时钟与风险集例子"></span>
<span id="4-Outcome-blind-支持选择"></span>
<span id="4-1-为什么用-fill-retention-的保守下界选择-threshold"></span>
<span id="4-2-SELL-first-顺序为什么保护-BUY-证据"></span>
<span id="5-SELL-Development-面板"></span>
<span id="6-结果：支持通过后的明确阴性"></span>
<span id="7-为什么合理的状态分数仍会产生错误动作"></span>
<span id="7-1-一条负-action-path-的合成解释"></span>
<span id="7-2-明确阴性比-support-failure-提供了更多信息"></span>
<span id="8-研究演进与关闭边界"></span>
<span id="9-没有获得的权限-1"></span>
<span id="Recovery-score-为什么容易把描述顺序误当动作顺序"></span>
<span id="Outcome-blind-threshold-选择保护了什么"></span>
<span id="阴性结果如何缩小下一轮搜索空间"></span>
<span id="Invalid-direction-的敏感性不能事后选择"></span>
<span id="为什么-direct-uplift-比-normality-score更近"></span>
<span id="明确阴性后的停止规则"></span>
<span id="10-公共证据-1"></span>
<span id="结语-3"></span>
<span id="7-Variance-time-rearm"></span>
<span id="TL-DR：机制强、路径完整、支持充分，但-BUY-与-SELL-的主-reward-下界都没过零"></span>
<span id="1-研究问题：同样的-85-秒具有同样的市场信息量吗？"></span>
<span id="2-Causal-variance-clock"></span>
<span id="2-1-量纲为什么在这里闭合"></span>
<span id="2-2-Two-sided-variation-为什么比“总是更久”更可识别"></span>
<span id="3-输入、动作与-estimand"></span>
<span id="4-研究演进：为什么多个版本仍是一项研究"></span>
<span id="5-正式-Development-支持"></span>
<span id="5-1-从-clock-change-到-final-action-change-的传导"></span>
<span id="5-2-Lineage-assignment-防止-later-fill-重新随机化"></span>
<span id="6-经济结果与不确定性"></span>
<span id="6-1-BUY-primary-与-库存生命周期-terminal-为什么会给出不同方向强度"></span>
<span id="6-2-机械证据越强，经济阴性越不能归咎于实现"></span>
<span id="7-结果边界与剩余不确定性"></span>
<span id="8-关闭边界与没有获得的权限"></span>
<span id="Variance-clock-与固定秒钟回答不同问题"></span>
<span id="Clock-change、action-change-与-value-change-是三层门"></span>
<span id="可保留的系统能力与不可保留的动作结论"></span>
<span id="9-公共证据-2"></span>
<span id="结语-4"></span>
<span id="8-结论：已测试-temporal-permission-frontier，没有出现“既有杠杆又有价值”的区域"></span>
</div>


## 墙钟时间和市场活动时间

相同墙钟长度未必包含相同市场变化；variance-time 可按过去可见波动累积，但它只是候选状态尺度，不是已经证明更优的计时器。

## 不同干预分别定义

| 动作 | 主要风险 |
| --- | --- |
| 跳过一次加仓机会 | 实际订单差异可能很小 |
| 直到回到 flat 前禁止加仓 | 可能同时消除有价值参与 |
| 状态／恢复条件重新准入 | 阈值与可见性、迟滞及库存反馈交织 |
| 波动时间重新准入 | 需区分时间归一化与新的选择信号 |

旧 candidate rate、fill retention、reward 和“该动作族关闭”图表已转成这些待验证问题，不继续用旧观测宣布当前函数无效。F01 当前防御／紧迫度结果只覆盖其原动作；当前库存软控制也不能提前回答全部重新准入函数。

## 评价方式

配对账户中保持输入、初始状态、手续费、资金费与终点估值一致；记录实际受影响的角色、机会与订单，而不是只数被过滤的日志。总收益、单位收益、参与度和库存修复共同解释。删失或未完成账户不是经济负结果。

## 当前数据结果与适用边界

当前 Defense/Urgency 与机制消融的观察保留在 F01 及各自冻结 B0 下，不扩展为所有冷却、库存价格与敞口过滤函数都有效或无效。正在运行的库存软控制另行验收，本文不将进度当结论。

[当前研究族报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/README.zh-CN.md) · [原始聚合结果索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json) · [五候选 Final 聚合](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/final107_comparison.json)

![当前研究问题与验证路径](/images/narrowgate/inventory-control-research-synthesis.svg)

## 统一待验证登记

- `F09-TEMPORAL-PERMISSION`：冷却或重新准入的时机，能否减少不利敞口且不压制有价值的库存修复？
- `F09-INVENTORY-ACTIONS`：库存相关的加仓价格、数量限制或减仓激进度能否改善净价值？
- `F09-EXPOSURE-GUARD`：决策前可见的敞口过滤器，是改善风险选择还是仅减少交易？

以上 ID 统一存放在[本研究族问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/research_questions.json)，可从[全研究族索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)扫描发现。登记不是实验完成，不改变运行中的模型、参数或会计。详细模型、逐账户结果和原冻结证据不随公共仓库分发；原报告历史仍保留其原身份。
