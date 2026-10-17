---
title: "NarrowGate 13-Head：用当前 Tardis 结果替换旧模型结论"
date: 2026-08-29 13:30:00
updated: 2026-10-17 22:06:03
categories:
- Market Making
tags:
- Market Making
- 机器学习
- 时间序列
- Causal 13-Head
- 回放
math: true
---

本文按 2026-10-17 的当前研究口径重新整理。旧数值、图表和关闭判断不作为当前结论；下文把可引用的新数据结果、待验证假设与工程证据分开。

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="历史前言：为什么重建整条链路？"></span>
<span id="新特征与标签合同"></span>
<span id="选型、对照与会计"></span>
<span id="本轮结果：相对少亏，不是盈利验证"></span>
<span id="补齐尾片与保留使用历史"></span>
<span id="新模型与-live：历史状态与候选组装分开"></span>
<span id="量纲与时钟：仍须逐消费者核查"></span>
<span id="证据与范围"></span>
<span id="历史源稿（2026-08-30）"></span>
<span id="1-五个版本其实是一场持续的可证伪实验"></span>
<span id="2-研究阶段与证据状态"></span>
<span id="3-v4：Empirical-P3-重训"></span>
<span id="TL-DR：一次严肃的重建，也可能因为三天时钟错误失去-test-authority"></span>
<span id="1-研究问题"></span>
<span id="2-输入、模型与动作"></span>
<span id="3-因果时钟与量纲修复"></span>
<span id="4-冻结面板"></span>
<span id="5-一个五分钟提前可见的具体例子"></span>
<span id="6-当时看到的结果与当前可引用边界"></span>
<span id="7-研究演进为何合并成一篇"></span>
<span id="8-关闭与支持边界"></span>
<span id="共同输入与独立目标模型：错误影响哪一层"></span>
<span id="为什么三天错误不能按比例“打折”"></span>
<span id="一个反事实例子：提前五分钟可见为何会显得异常强"></span>
<span id="泄漏为何会穿过-cross-fitting，而不是只污染三天"></span>
<span id="一个真正-successor-的最小验收面"></span>
<span id="Feature-lineage-ledger-应写到什么粒度"></span>
<span id="一个-leakage-sentinel-的设计"></span>
<span id="Withdrawn-metrics-怎样继续服务研究史"></span>
<span id="9-公共证据"></span>
<span id="4-v5：Normalized-100ms-重建"></span>
<span id="TL-DR：13-head-有预测排序，ML-ON-没有稳定经济晋级；baseline-又确实优于随机生命周期"></span>
<span id="1-研究问题与三种比较"></span>
<span id="2-数据与身份"></span>
<span id="3-因果时钟与订单生命周期"></span>
<span id="4-13-head-prediction-与-clean-ML-A-B"></span>
<span id="5-Queue-sensitivity：为什么不能从-PnL-挑-q"></span>
<span id="6-Random-opportunity-diagnostic-与-executable-null"></span>
<span id="7-BUY-scorers-与-action-boundary"></span>
<span id="8-版本为何合并，何时才算新项目"></span>
<span id="9-关闭、支持与没有获得的权限"></span>
<span id="深入理解三种比较：prediction、策略-A-B-与-executable-null"></span>
<span id="Queue-sensitivity-为什么只能做机制敏感性"></span>
<span id="为什么-baseline-优于随机生命周期仍然重要"></span>
<span id="三类比较各自排除什么解释"></span>
<span id="Queue-sensitivity-应怎样变成可证伪问题"></span>
<span id="为什么阴性经济结果仍推动了研究"></span>
<span id="十三个输出为什么不是一个统一“市场方向分数”"></span>
<span id="Executable-null-应保留哪些机械量"></span>
<span id="从-revalidation-到可部署-bundle-的缺口"></span>
<span id="10-公共证据"></span>
<span id="5-v9：Taker-Tempo"></span>
<span id="TL-DR：预测排序存在，正式三日的-maker-value-全面反向"></span>
<span id="1-研究问题-1"></span>
<span id="2-输入、动作与-estimand"></span>
<span id="3-Causal-maker-side-mapping"></span>
<span id="4-v8-修复了什么"></span>
<span id="5-Chronological-split-与-formal-amendment"></span>
<span id="6-Prediction-diagnostics"></span>
<span id="7-Formal-Test3-与-diagnostic-days"></span>
<span id="8-Deployment-gates-与不确定性"></span>
<span id="9-关闭、支持与没有获得的权限-1"></span>
<span id="深入推导：tempo-ranking-与-maker-动作之间隔着-treatment-effect"></span>
<span id="为什么-BUY-SELL-映射不能靠统一符号解决"></span>
<span id="Formal-Test3-反号应怎样解释"></span>
<span id="Taker-tempo-与-maker-value-中间缺少哪几个条件概率"></span>
<span id="Formal-Test3-全面反向意味着什么"></span>
<span id="Tempo-至少有三种不可互换的定义"></span>
<span id="Threshold-neighborhood-才是动作真正消费的区域"></span>
<span id="Formal-三日反号后的研究纪律"></span>
<span id="10-公共证据-1"></span>
<span id="6-v12：Source-aware-semantics"></span>
<span id="TL-DR：五日-PnL-点估计为正，13-个-prediction-gates-只过-5-个，完整经济门仍然关闭"></span>
<span id="1-研究问题-2"></span>
<span id="2-输入、动作与模型身份"></span>
<span id="3-训练-chronology"></span>
<span id="4-Native-historical-panels-与证据角色"></span>
<span id="5-Prediction-transport"></span>
<span id="6-Full-path-ML-OFF-ON-结果"></span>
<span id="7-一个正点估计为什么仍不能晋级"></span>
<span id="8-版本、Specs-与执行文件为何合并"></span>
<span id="9-关闭、支持与没有获得的权限-2"></span>
<span id="深入推导：十三个-heads-为什么必须使用-joint-gate"></span>
<span id="五日-PnL-正点估计为什么证据仍然弱"></span>
<span id="从-prediction-transport-到-inference-contract"></span>
<span id="十三个-heads-的-joint-gate-为什么不是过度保守"></span>
<span id="五日经济结果的分辨率"></span>
<span id="Source-aware-模型为何仍可能学到年份标签"></span>
<span id="Joint-gate-可以怎样兼顾必要性与可解释性"></span>
<span id="五日结果如何规划样本，而不是提供权限"></span>
<span id="10-公共证据-2"></span>
<span id="7-一秒-cadence-successor"></span>
<span id="TL-DR：1-秒更新减少了-fills，却增加库存时间并恶化-库存生命周期-tails"></span>
<span id="1-研究问题-3"></span>
<span id="2-输入、动作与-estimand-1"></span>
<span id="3-数据与因果时钟"></span>
<span id="4-为什么执行完整性不等于经济成功"></span>
<span id="5-一个更快却更危险的机制例子"></span>
<span id="6-冻结结果"></span>
<span id="7-不确定性与-stop-decision"></span>
<span id="8-研究演进与版本合并"></span>
<span id="9-关闭、未关闭与权限"></span>
<span id="深入推导：更快-cadence-同时改变控制频率与订单年龄"></span>
<span id="一个路径例子：及时撤单为何可能延长库存"></span>
<span id="Cadence-研究需要的三个对照"></span>
<span id="Cadence-是一个控制系统参数，不只是计算频率"></span>
<span id="需要同时观测的四个控制代价"></span>
<span id="Cadence-与-feature-horizon-的-aliasing"></span>
<span id="TTL、requote-与-cancel-ACK-的时钟耦合"></span>
<span id="如何设计“高频监测、低频动作”的后继"></span>
<span id="10-公共证据-3"></span>
<span id="8-结论：模型复杂度增加了，证据门没有因此降低"></span>
</div>


## 训练目标与策略消费者

共同特征并不意味着一个联合目标。方向、收益、波动率各有 10/30/60 秒头，买卖毒性有 5/10 秒头，共十三头；策略实际消费者及后处理决定哪些预测怎样进入报价。模型评分、推理一致性和完整账户收益分层解释。

当前基础比较在固定训练支持上拟合四种时间权重，由 B100 选型，Hinf 被选中；Final 用独立账户评估，不是连续 107 日账户。不能把旧 v4–v12 的正负点估计、少数头通过或旧频率排名接到这条新链上。

## 当前已验收数值

| 原比较 | 完整覆盖 | 净收益 USDC | 解释 |
| --- | --- | ---: | --- |
| 新源 F03 Hinf | 54 独立 Final 账户／107 日 | −189.212148 | 相对 ML-OFF 少亏，仍亏损 |
| 同一比较的 ML-OFF | 同上 | −269.042233 | 不是后来的 urgency-off B0 |

两者差额为 +79.830084 USDC，费用和真实资金费已按原报告计入。ML-OFF 的增加及 Final 以前的查看行为不重置，不能称为全新的盲测或实盘盈利证明。

## 后来的五候选是另一项比较

后续 A/B/C/D/E 使用 `B0_DEFENSE_URGENCY_OFF_20261011`；每候选都完成 54 账户。总收益和两种单位收益均弱于该 B0，未晋升。不能把此处 B0 与上表 ML-OFF 相混，也不能用五个包的结果孤立归因于“训练更规范”或“模型一定无效”。B/C 改变训练支持；C 同时去除日期和类别补权；D/E 才是其余十二头一致的方向输入／模型比较。完整数值见原五候选聚合表。

## 仍待验证

旧文章的 cadence、source transport 与 taker-tempo 主张转为独立问题。要隔离频率效应，必须控制训练支持、特征可见性和执行语义，而不能把不同年代模型包的 PnL 差异当作频率效应。

## 当前数据结果与适用边界

新数据 f03-407-t100-final107-v2 已完成 858 个策略分片。每臂 54 个独立 Final 账户覆盖 107 日，Hinf 净收益 −189.212148 USDC，ML-OFF 为 −269.042233 USDC；少亏不等于盈利，Final 有历史使用。后续五候选比较使用不同的冻结 B0，五个候选的总收益和两种单位收益均不如该 B0；两项结果都不能单独证明决策频率的因果作用。

[当前研究族报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/README.zh-CN.md) · [原始聚合结果索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json) · [五候选 Final 聚合](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/final107_comparison.json)

![当前研究问题与验证路径](/images/narrowgate/causal-13-head-research-synthesis.svg)

## 统一待验证登记

- `F03-CADENCE-TRANSPORT`：在匹配的当前数据执行条件下，特征或决策频率改变能否改善净价值？

以上 ID 统一存放在[本研究族问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/research_questions.json)，可从[全研究族索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)扫描发现。登记不是实验完成，不改变运行中的模型、参数或会计。详细模型、逐账户结果和原冻结证据不随公共仓库分发；原报告历史仍保留其原身份。
