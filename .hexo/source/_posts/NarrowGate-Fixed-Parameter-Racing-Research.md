---
title: "NarrowGate 报价控制研究：当前结果与待验证交互"
date: 2026-08-29 13:30:00
updated: 2026-10-17 22:06:04
categories:
- Market Making
tags:
- Market Making
- 报价动作
- 因果推断
- 随机化回放
- 研究治理
math: true
---

本文按 2026-10-17 的当前研究口径重新整理。旧数值、图表和关闭判断不作为当前结论；下文把可引用的新数据结果、待验证假设与工程证据分开。

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="报价动作要估计什么"></span>
<span id="新响应基线：完成覆盖不等于证明盈利"></span>
<span id="历史局部报价实验分别回答什么"></span>
<span id="联动系数与不对称偏移：完整报价控制器的比较"></span>
<span id="旧单更新条件：A00-A11-A10-A01"></span>
<span id="基于目标报价方差率的动态向外门槛"></span>
<span id="固定参数竞速"></span>
<span id="研究问题：我们到底在搜索什么"></span>
<span id="输入、动作与-estimand"></span>
<span id="数据与因果时钟：为什么旧冠军榜必须撤回"></span>
<span id="从全局配置到局部干预"></span>
<span id="历史结果：没有可稳定迁移的参数赢家"></span>
<span id="历史结论的适用范围"></span>
<span id="后继研究应怎样提出问题"></span>
<span id="深入推导：为什么历史冠军天然带有乐观偏差"></span>
<span id="一条完整路径：同一个-spread-常数为何会产生相反效果"></span>
<span id="固定常数的三种合法身份"></span>
<span id="参数搜索的-effective-trials-远大于表面-grid"></span>
<span id="Denomination-invariance-是报价参数的最低物理检查"></span>
<span id="固定参数与-regime-interaction-的可视化方式"></span>
<span id="固定局部报价动作"></span>
<span id="研究问题：不是哪个-tick-最赚钱，而是局部动作能否迁移"></span>
<span id="动作、输入与-estimand"></span>
<span id="冻结证据面板与因果时钟"></span>
<span id="一个具体路径例子"></span>
<span id="四臂不是四个独立回测"></span>
<span id="DR-估计器为什么不是“机器学习保证”"></span>
<span id="一个-winner-rotation-的合成解释"></span>
<span id="结果：Development-线索没有穿过-Validation"></span>
<span id="研究演进与数值撤回"></span>
<span id="不确定性为何不能由-pooled-PnL-覆盖"></span>
<span id="Mechanics、activity-与-economics-的联合读法"></span>
<span id="第三方怎样复核而不依赖旧精确-PnL"></span>
<span id="什么才算真正不同的-successor"></span>
<span id="适用范围"></span>
<span id="随机化单位为何必须跟随-库存生命周期-lineage"></span>
<span id="为什么-DR-不能救一个不断旋转的-winner"></span>
<span id="多臂-simultaneous-inference"></span>
<span id="Full-path-随机化仍需检查-execution-integrity"></span>
<span id="BUY-条件加宽"></span>
<span id="为什么单独研究-BUY-add"></span>
<span id="动作、特征与-estimand"></span>
<span id="数据、split-与时钟"></span>
<span id="一个订单例子：外移一-tick并不只改变价格"></span>
<span id="一-tick动作的价值可拆成“是否分叉”与“分叉后符号”"></span>
<span id="为什么无条件略正与条件策略为负并不矛盾"></span>
<span id="35-个特征为什么不等于-35-个独立证据来源"></span>
<span id="Replay-integrity-与-support"></span>
<span id="Development-结果与不确定性"></span>
<span id="为什么“树没学好”不是重开理由"></span>
<span id="Support-通过为什么仍不足以说明-leaf-可用"></span>
<span id="什么结果会真正反驳这次关闭"></span>
<span id="关闭与支持边界"></span>
<span id="条件策略面对的是-policy-learning，不是-subgroup-reporting"></span>
<span id="一-tick分叉的-overlap-该怎样检查"></span>
<span id="Policy-regret-比-leaf-命中率更接近目标"></span>
<span id="Hierarchical-state-可以减少无边界搜索"></span>
<span id="结论：报价变化为何未形成稳定收益"></span>
<span id="公开方法与实验报告"></span>
</div>


## 先分清三个控制层

报价系数与方向偏移改变目标价格；向内、向外更新门槛决定旧单相对目标移动多远才更新；评价时机决定何时重新计算。三者不能用一个“更激进”概括。仓位与订单会在闭环中分化，单项改进不能直接相加。

| 比较对象 | 保持不变 | 要回答的问题 |
| --- | --- | --- |
| 风险系数与方向偏移 | 模型、P3、会计与输入 | 是否存在依赖系数组合的作用？ |
| 向内／向外更新门槛 | 原目标报价公式 | 请求、队列重置与成交之间怎样权衡？ |
| 动态门槛与固定典型尺度 | 就绪与回退规则 | 动态关系是否提供额外价值？ |
| 评价时机 U0/U1 | 价格门槛与原风险规则 | 更多评价是否值得请求和库存成本？ |

## 已验收范围继续保留

当前 Tardis 的系数轴单账户、54 账户方向化门槛及两账户动态尺度比较，保留在 F01 当前报告中；它们不是早期旧数据网格排名。方向化门槛 A10 的合计少亏伴随集中收益、负配对中位数与更高库存；动态 D/S 的两账户合计均弱于各自 B0。这些有限结果不证明固定或动态规则普遍无效。

当前完整 Defense/Urgency 与后续不完整机制消融分开列示，不把独立账户与连续账户拼成一个收益样本。当前库存软控制尚需自己的完整配对结果。

## 怎样继续验证

固定候选和匹配账户，不根据局部盈亏挑日期。除了总净收益，同时看两种单位收益、成交量、请求负担和库存风险。先说明干预改变的是目标、条件还是时机，再解释收益差异。历史“固定参数族已关闭”不再作为停止新研究的依据。

## 当前数据结果与适用边界

新 Tardis 的 Defense/Urgency 原九臂比较已完成：407 日独立账户合计，原 B0 净收益 −1603.031182 USDC，DEFENSE_ON__URGENCY_OFF 为 −1455.222759 USDC。两者仍亏损，库存敞口增加；选择其为后续 B0 不代表已盈利。后来的机制消融扩展由用户看过结果后停止，覆盖不完整。正在进行的库存软控制是另一实验，本文不替它宣布完成。

[当前研究族报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f01_fixed_parameter_racing/README.zh-CN.md) · [原始聚合结果索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json) · [五候选 Final 聚合](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/final107_comparison.json)

![当前研究问题与验证路径](/images/narrowgate/fixed-parameter-research-synthesis.svg)

## 统一待验证登记

- `F01-CONTROL-INTERACTIONS`：固定报价系数与更新门槛的哪些交互在当前数据和基线上仍有价值？

以上 ID 统一存放在[本研究族问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f01_fixed_parameter_racing/research_questions.json)，可从[全研究族索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)扫描发现。登记不是实验完成，不改变运行中的模型、参数或会计。详细模型、逐账户结果和原冻结证据不随公共仓库分发；原报告历史仍保留其原身份。
