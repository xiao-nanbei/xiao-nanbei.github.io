---
title: "NarrowGate 成交质量与 Quote EV：当前 E/C 结果和待验证的成交价值问题"
date: 2026-08-29 13:30:00
updated: 2026-10-17 22:06:04
categories:
- Market Making
tags:
- Market Making
- Fill Quality
- Quote EV
- 库存生命周期
- Action Value
math: true
---

本文按 2026-10-17 的当前研究口径重新整理。旧数值、图表和关闭判断不作为当前结论；下文把可引用的新数据结果、待验证假设与工程证据分开。

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="短期价格变化与完整库存价值"></span>
<span id="从标签到动作：各项实验的比较对象"></span>
<span id="成交前-E-C：独立的配对选择实验"></span>
<span id="完整路径支持什么结论"></span>
<span id="Fill-to-inventory-lifecycle"></span>
<span id="一个-fill-同时启动了三只时钟"></span>
<span id="Micro-markout：它回答的是早期-adverse-selection"></span>
<span id="Inventory-lot：交易所不会告诉你-FIFO-还是-LIFO"></span>
<span id="一个-FIFO-LIFO-都合理却给出不同-duration-的例子"></span>
<span id="Lot-duration-是归因量，inventory-time-是路径量"></span>
<span id="库存生命周期：真正的库存终局通常比-30-秒晚得多"></span>
<span id="生存视角：平均-duration-会被长尾支配"></span>
<span id="Closed-only-mean-的方向性偏差"></span>
<span id="固定30秒与随机terminal为何不能直接比较均值"></span>
<span id="被撤回的-Retained111-数字该怎样阅读"></span>
<span id="数据与因果边界"></span>
<span id="从描述性标签到动作-estimand"></span>
<span id="一个负-markout-对应两个相反动作反事实"></span>
<span id="三种时间权重会给出不同的“典型持有期”"></span>
<span id="库存生命周期-terminal-mark-的选择"></span>
<span id="Dynamic-库存生命周期-attribution"></span>
<span id="研究问题：损失集中在哪里，机制是否真的在动"></span>
<span id="Add-no-add-对比中的选择路径"></span>
<span id="48小时窗口为何只能做机制定位"></span>
<span id="库存生命周期-分类：toxicity-与-repair-是两条不同路径"></span>
<span id="冻结历史窗口：add-loss-集中，但类别内部并非同号"></span>
<span id="Regime-与-P3：缩放真的发生，floor-也确实介入"></span>
<span id="用局部导数理解“参数动了、报价没动”"></span>
<span id="28-9-floor-binding-如何阅读"></span>
<span id="Kappa-与-cap：参数在变化，不代表报价受它控制"></span>
<span id="Cooldown：所谓-dynamic-可能只是离散-staircase"></span>
<span id="阶梯动作的边际效应集中在边界"></span>
<span id="Reducing-side-defense：想修复库存，先确认机制有-support"></span>
<span id="数据、时钟与撤回边界"></span>
<span id="从机制审计到-action-research"></span>
<span id="后续action结果如何反过来校正机制直觉"></span>
<span id="描述性差异的-DAG-为什么不能省略"></span>
<span id="Binding-rate-是-control-authority-的局部地图"></span>
<span id="First-add-terminal-loss"></span>
<span id="为什么从-realized-fill-倒推-decision-会出错"></span>
<span id="Nearest-time-join-会制造怎样的假特征"></span>
<span id="每库存生命周期一行如何防止伪精度"></span>
<span id="Observational-estimand：从-decision-前权益到-库存生命周期-terminal"></span>
<span id="面板：Grade-A-是-primary，Grade-B-只能-sensitivity"></span>
<span id="时钟与因果边界"></span>
<span id="主结果：两侧-primary-mean-都稳定低于零"></span>
<span id="用规模感理解均值，但不能倒推被删除收益"></span>
<span id="日期聚类区间为什么比逐row-t检验更可信"></span>
<span id="为什么稳定负-mean-仍然不能形成-selector"></span>
<span id="Mean、selector-与-action-是三道门"></span>
<span id="Queue-ahead方向未复制说明了什么"></span>
<span id="为什么“直接跳过所有-first-add”也不成立"></span>
<span id="全禁动作还会改变库存生命周期定义本身"></span>
<span id="为什么-first-add-是好决策面，却未必是好action-lever"></span>
<span id="Observational-mean-的可识别边界"></span>
<span id="每-库存生命周期-一行牺牲了什么，又保护了什么"></span>
<span id="Decision-visible-fill-value"></span>
<span id="为什么“平均坏”与“能避开坏”是两回事"></span>
<span id="两种决策角色与各自特征"></span>
<span id="First-add：已经有暴露以后，第一次继续增加库存"></span>
<span id="First-opener：从空仓进入一段新-库存生命周期-的第一次成交"></span>
<span id="数据、时钟与因果边界"></span>
<span id="研究链：先证明标签，再证明增量选择能力"></span>
<span id="四个容易混在一起的-estimand"></span>
<span id="一条完整的合成路径：同一个坏标签可以对应相反动作价值"></span>
<span id="为什么-库存生命周期-state-baseline-是一道必要的科学门"></span>
<span id="日期聚类为什么会推翻逐成交显著性"></span>
<span id="什么结果才会推翻这次阴性结论"></span>
<span id="First-add-结果：负平均值存在，局部增量不存在"></span>
<span id="First-opener-结果：SELL-平均负值明确，选择器方向却没有成立"></span>
<span id="Filled-only-prediction-的选择方程"></span>
<span id="预测如何进入实际报价动作"></span>
<span id="新-Tardis：风险预测怎样进入加宽动作"></span>
<span id="历史-BUY-soft-widen：解除一次放宽"></span>
<span id="为什么旧的-filled-only-模型不能决定动作"></span>
<span id="动作合同：只改一次，只改-BUY，只改-exposure-increasing-quote"></span>
<span id="数据、抽样与-chronological-OOF"></span>
<span id="时钟与因果边界-1"></span>
<span id="One-shot-intervention-的递归定义"></span>
<span id="一条从-K-线到终局的合成算例"></span>
<span id="路径稀疏会制造怎样的学习问题"></span>
<span id="机械验证：不是-no-op"></span>
<span id="为什么价格移动很大，终局路径却很少改变"></span>
<span id="Direct-value-OOF-结果"></span>
<span id="为什么不能“再调一下旧阈值”"></span>
<span id="无条件均值为正，为什么-selector-仍然可以为负"></span>
<span id="这次结果排除了哪些替代解释"></span>
<span id="One-shot-与-repeated-policy-的数学边界"></span>
<span id="为什么报价移动很多、有效路径仍然少"></span>
<span id="结论：损失可被描述，不代表已找到有收益的动作"></span>
<span id="公开方法与实验报告"></span>
</div>


## 不从坏成交直接推导过滤规则

成交后看见不利价格变化，只能描述结果。若只保留已成交订单，会漏掉等待、取消和未成交机会；库存随后如何修复，也会改变某笔成交最终的价值。要研究策略动作，必须从决策前可见状态开始定义机会分母。

| 量 | 回答什么 | 不能替代什么 |
| --- | --- | --- |
| 固定期限 markout | 成交后价格移动 | 净利润或真实退出收益 |
| 边际库存持有时间 | 这部分仓位何时被消化 | 订单挂在簿上的寿命 |
| Flat-to-flat 生命周期 | 整段库存过程 | 单笔订单的因果贡献 |
| 完整账户净收益 | 费用、资金费与终点价值后的结果 | 不同模型／日期的可交换样本 |

## 新源 E/C 的完成范围

E 是 POST/WAIT，C 是 KEEP/CANCEL，EC 是预先声明的组合主候选。其 T100 拟合、A/B/C 诊断与 Final 评价各自有边界；随机对照匹配的是训练拒绝率，不是评估成交量。E 合计少亏不能反向把预先主候选改成 E，也不能把 KEEP/CANCEL 解释成已完成 REENTER。

旧 first-fill、soft-widen、joint-P3 的精确收益和尾部数值不再作为当前结论。新 E/C 能覆盖的是其本身的动作、模型和完整账户范围，未覆盖的问题仍需独立验证。

## 新增的待验证观察

是否有一类挂单更新偏慢，容易在局部不利位置成交？需要区分输入过时、主动 KEEP、撤单确认延迟、队列变化和撤单成交竞态，不能仅按亏损成交倒推。

markout 的期限与持仓生命周期是否有关？固定短期限曲线可以保留为诊断，但不能直接认定 30 秒或某个生命周期百分比最优。已实现的未来退出时刻不能成为决策时输入；自适应期限只能来自历史可见信息。部分平仓、删失、政策依赖退出和终点库存要单独处理。这些问题已登记，不改变当前回放参数。

## 当前数据结果与适用边界

新数据 prefill E/C 已完成 204 独立账户 × 十条路径，四个拟合曲面使用 T100 训练标签。全日历和 Final 各路径均仍亏损；E/EC 相对自己的 B0 减少总亏损，C 的增量方向不一致，E 的 Final 单位成交额收益反而变差。两个随机种子不足以证明稳定选择性。另一个十头风险加宽的有限比较为负；两者都不等于 Full-Multiscale 冷却或全部 first-fill / joint-quote 问题已验证。

[当前研究族报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/README.zh-CN.md) · [原始聚合结果索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json) · [五候选 Final 聚合](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/final107_comparison.json)

![当前研究问题与验证路径](/images/narrowgate/fill-quality-research-synthesis.svg)

## 统一待验证登记

- `F05-JOINT-QUOTE-VALUE`：联合报价与价值映射能否改善完整账户净价值？
- `F05-FIRST-FILL-VALUE`：哪些决策前可见状态能预测包含后续库存修复的边际成交价值？
- `F05-MULTISCALE-COOLDOWN-CURRENT-SOURCE`：多尺度市场状态选择成交后冷却时长，能否改善完整账户净价值，而非仅压低成交或延误有价值的减仓？
- `F05-STALE-QUOTE-ADVERSE-FILL`：是否有一类挂单更新偏慢、容易在局部不利位置成交的情况？
- `F05-MARKOUT-HOLDING-LIFECYCLE`：markout期限应怎样关联持仓生命周期，而不是默认30秒或某个固定百分比最合适？

以上 ID 统一存放在[本研究族问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/research_questions.json)，可从[全研究族索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)扫描发现。登记不是实验完成，不改变运行中的模型、参数或会计。详细模型、逐账户结果和原冻结证据不随公共仓库分发；原报告历史仍保留其原身份。
