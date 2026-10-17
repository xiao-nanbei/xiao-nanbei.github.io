---
title: "NarrowGate 主动成交流：当前响应模型与待验证的订单风险集"
date: 2026-08-29 13:30:00
updated: 2026-10-17 22:06:04
categories:
- Market Making
tags:
- Market Making
- Taker Flow
- Event Identity
- Risk Set
- 双时钟
math: true
---

本文按 2026-10-17 的当前研究口径重新整理。旧数值、图表和关闭判断不作为当前结论；下文把可引用的新数据结果、待验证假设与工程证据分开。

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="阅读范围与后续响应动作研究"></span>
<span id="1-同一笔成交同时属于两种时间真相"></span>
<span id="2-研究阶段与证据状态"></span>
<span id="3-Side-specific-taker-flow"></span>
<span id="TL-DR：方向不是一个可以随手乘以正负号的变量"></span>
<span id="1-研究问题"></span>
<span id="2-输入、状态与-estimand"></span>
<span id="一个具体的-100ms-例子"></span>
<span id="3-数据与因果时钟"></span>
<span id="3-1-为什么“100ms-flow”有两种完全不同的定义"></span>
<span id="3-2-Side-mapping-不是符号翻转，而是条件分布变化"></span>
<span id="3-3-Burst、run-与-sweep-各自描述什么"></span>
<span id="4-研究演进"></span>
<span id="5-结果与不确定性"></span>
<span id="6-为什么相关性不能直接变成动作"></span>
<span id="6-1-Fill-conditioned-association-的-collider-问题"></span>
<span id="6-2-原始线索为什么值得保留，却不能作为“失败后删除”"></span>
<span id="6-3-读图时应把-K-线放在哪一层"></span>
<span id="为什么版本必须写进同一主文"></span>
<span id="7-关闭与支持边界"></span>
<span id="8-没有获得的权限"></span>
<span id="从交易方向到-maker-side-的完整映射"></span>
<span id="Parent-child-聚合为何会制造假-burst"></span>
<span id="一个合法-action-successor-应怎样使用-flow"></span>
<span id="Flow-normalization-与-price-impact-不是同一个对象"></span>
<span id="负对照可以发现哪些时钟错误"></span>
<span id="9-公共证据"></span>
<span id="结语"></span>
<span id="4-Static-hazard-M0"></span>
<span id="TL-DR：模型关闭，不是因为-AUC-不够漂亮，而是问题本身没有被正确识别"></span>
<span id="1-研究问题-1"></span>
<span id="2-输入、输出与-estimand"></span>
<span id="一个会改变结论的事件例子"></span>
<span id="3-数据与因果时钟-1"></span>
<span id="3-1-一个合法-start-stop-面板应长什么样"></span>
<span id="3-2-Parent-ready-feature-为什么必须落在-interval-左端"></span>
<span id="4-研究演进-1"></span>
<span id="5-结果与不确定性-1"></span>
<span id="5-1-pooled-与-split-若比较几何不同，loss-差不再是-side-信息"></span>
<span id="5-2-AUC、balanced-loss-与-action-support-各回答不同问题"></span>
<span id="5-3-结构性失败为什么比统计阴性更强"></span>
<span id="6-正确-successor-必须回答什么"></span>
<span id="7-关闭边界"></span>
<span id="8-没有获得的权限-1"></span>
<span id="Start-stop-风险集里的三个经典陷阱"></span>
<span id="Pooled-与-side-split-的公平比较"></span>
<span id="结构失败之后为什么不能继续报-AUC"></span>
<span id="Hazard-calibration-应按-risk-time-而不是-row-count阅读"></span>
<span id="Outcome-blind-risk-set-validator"></span>
<span id="9-公共证据-1"></span>
<span id="结语-1"></span>
<span id="5-Trade-clock-parity"></span>
<span id="TL-DR：撮合真相与策略可见信息不是同一条时间线"></span>
<span id="1-研究问题-2"></span>
<span id="2-输入、动作与-estimand"></span>
<span id="一个-parent-extension-的具体例子"></span>
<span id="3-数据面板与两个时钟"></span>
<span id="3-1-一个-parent-是“随时间增长的对象”还是“一条不可变记录”"></span>
<span id="3-2-Queue-truth-与-information-truth-为什么可以使用不同-source"></span>
<span id="3-3-Internal-gap-为什么只影响-strict-queue，不必删除整天"></span>
<span id="4-研究演进-2"></span>
<span id="5-结果与不确定性-2"></span>
<span id="5-1-延迟分布不是一个可随手相加的常数"></span>
<span id="5-2-五层-parity，不应压成一个-pass-fail"></span>
<span id="6-哪些特征仍然可以研究"></span>
<span id="6-1-一个安全字段的最小-lineage"></span>
<span id="6-2-如何把这个合同带进后续模型"></span>
<span id="7-支持与关闭边界"></span>
<span id="8-没有获得的权限-2"></span>
<span id="一条-parent-从开始到-ready-的状态机"></span>
<span id="延迟分解怎样进入-transport"></span>
<span id="Parity-contract-如何防止“相同输出、不同原因”"></span>
<span id="Field-level-authority-为什么优于整行-authority"></span>
<span id="Atomic-ready-batch-的-deterministic-ordering"></span>
<span id="9-公共证据-2"></span>
<span id="结语-2"></span>
<span id="6-Event-identity-and-risk-set"></span>
<span id="TL-DR：订单从“尚未激活”到“终止”之间，不是一条只有一个终点的直线"></span>
<span id="1-研究问题-3"></span>
<span id="2-输入、动作与-estimand-1"></span>
<span id="2-1-四类日志对象为什么不能共享一个-event-type"></span>
<span id="2-2-Multi-state-表达比-first-event-表多了什么"></span>
<span id="一条完整路径示例"></span>
<span id="3-数据与因果时钟-2"></span>
<span id="4-研究演进-3"></span>
<span id="5-结果与不确定性-3"></span>
<span id="5-1-0ms-exposure-与-same-time-ambiguity-应怎样处理"></span>
<span id="5-2-Unknown、censor-与-no-event-是三种不同答案"></span>
<span id="5-3-为什么更多旧行不会修复-estimand"></span>
<span id="6-v2-通过后仍然不能直接做什么"></span>
<span id="6-1-从事件-gate-到动作-gate-的最短合法路径"></span>
<span id="7-当前状态与边界"></span>
<span id="8-没有获得的权限-3"></span>
<span id="Occupancy、transition-与-cumulative-incidence-是三种数据产品"></span>
<span id="Multi-state-路径中的数量守恒"></span>
<span id="从-risk-set-修复到-action-value-的桥"></span>
<span id="一张最小-event-ledger-应有哪些键"></span>
<span id="Ambiguity-bounds-比强行选顺序更诚实"></span>
<span id="9-公共证据-3"></span>
<span id="结语-3"></span>
<span id="7-结论：静态-side-signal-关闭，动态生命周期问题仍然开放"></span>
</div>


## 事件身份先于预测

主动买单消耗 ask，主动卖单消耗 bid；聚合成交父事件与逐笔子事件不能当成重复的独立样本。策略可见时刻取决于事件何时完整可用，而标签可以观察其后的结果。这两类时钟不可倒置。

![主动买单消耗卖盘的机制示意](/images/narrowgate/orderbook/orderbook_aggressive_buy_consumes_asks.png)

盘口数量减少也不必然全是成交，还可能含取消、补单与更新。仅凭一个深度差不能恢复原生逐订单队列。

## 当前新模型与旧假设的边界

当前 response 模型使用成交与盘口特征、明确的 action-value 目标和完整账户比较。旧静态 M0 hazard 的 AUC、bps 或“关闭”结论不再是当前入口；response 的完成也不能被重新命名为旧 hazard 重做成功。

## 仍需回答

构造从真实订单激活开始的动态风险集，把未成交、取消和部分成交都纳入；检验分方向流特征是否在当前数据支持下具有增量，并区分预测目标与实际干预。未来若改变特征或消费者，要重新绑定对应研究，不能只从已有模型中挑一个好看的指标。

## 当前数据结果与适用边界

当前 Tardis response 模型、47/39 特征比较及完整会计见 response_baseline。其原候选作为 B0_RESPONSE_20261007 完成 204 独立账户、407 日覆盖。它不是旧静态 taker-hazard 的目标，不能替旧订单风险假设作结论。

[当前研究族报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/README.zh-CN.md) · [原始聚合结果索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json) · [五候选 Final 聚合](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/final107_comparison.json)

![当前研究问题与验证路径](/images/narrowgate/side-taker-research-synthesis.svg)

## 统一待验证登记

- `F08-TAKER-RISKSET`：分方向主动成交流能否改善动态订单风险与动作价值？

以上 ID 统一存放在[本研究族问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/research_questions.json)，可从[全研究族索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)扫描发现。登记不是实验完成，不改变运行中的模型、参数或会计。详细模型、逐账户结果和原冻结证据不随公共仓库分发；原报告历史仍保留其原身份。
