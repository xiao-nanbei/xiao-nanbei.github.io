---
title: "NarrowGate 敞口过滤：把旧毒性排名改成可验证假设"
date: 2026-08-29 13:30:00
updated: 2026-10-17 22:06:04
categories:
- Market Making
tags:
- Market Making
- Exposure Guard
- Toxicity
- q90
- 订单所有权
math: true
---

本文按 2026-10-17 的当前研究口径重新整理。旧数值、图表和关闭判断不作为当前结论；下文把可引用的新数据结果、待验证假设与工程证据分开。

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="1-三类-Guard-研究的是同一条从风险分数到终局价值的链"></span>
<span id="2-研究阶段与证据状态"></span>
<span id="3-Trade-intensity-proxy-add-only"></span>
<span id="TL-DR：绕过-opener-reducing-后-fills-增加-13-85-，terminal-value-反而少-11-67-USDC"></span>
<span id="名称边界：这里的-BER-不是论文里的-Book-Exhaustion-Rate"></span>
<span id="1-研究问题：BER-应保护所有报价角色，还是只保护加风险？"></span>
<span id="2-BER-时钟与输入一致性"></span>
<span id="2-1-10-秒-publish、1-秒-sample-与-100ms-loop-是三只时钟"></span>
<span id="2-2-Ratio、threshold-与-multiplier-属于三种不同语义"></span>
<span id="3-Role-composition"></span>
<span id="4-因果-denominator：不能由-treatment-path-重建"></span>
<span id="4-1-为什么-cross-arm-requote-count-不应强制相等"></span>
<span id="4-2-Canonical-denominator-如何防止-action-rate自我美化"></span>
<span id="5-Mechanics-结果"></span>
<span id="6-Economic-结果：fills-增加，价值下降"></span>
<span id="6-1-为什么绕过-reducing-与-opener-会同时增加-fills"></span>
<span id="6-2-一个数值一致性检查"></span>
<span id="6-3-Proxy改善为何不能隐式改成风险效用"></span>
<span id="7-一个报价路径例子"></span>
<span id="8-研究演进与证据地位"></span>
<span id="9-关闭边界"></span>
<span id="10-没有获得的权限"></span>
<span id="从代理状态到真正-Book-Exhaustion-Rate-的分界"></span>
<span id="三只时钟如何共同决定一次保护动作"></span>
<span id="Role-safe-失败之后还剩什么可研究"></span>
<span id="11-公共证据"></span>
<span id="结语"></span>
<span id="4-BUY-q90-clock-lifecycle"></span>
<span id="TL-DR：混合时钟几乎删掉了整个-q90-风险集，修好时钟后又暴露出-cancel-ACK-后继续打分的终局缺陷"></span>
<span id="1-q90-到底在哪个风险集上工作"></span>
<span id="2-Source-time-与-feature-ready-time-是不同事实"></span>
<span id="3-旧-mixed-clock-如何删空风险集"></span>
<span id="4-第一版修复为何必须保留为-failure"></span>
<span id="5-v1-1：kernel-锁步通过，same-date-parity-仍失败"></span>
<span id="6-Cancel-ACK：exchange-risk-的硬终点"></span>
<span id="6-1-一条订单路径的逐步推演"></span>
<span id="7-三种状态必须拆开"></span>
<span id="8-两种-quantity-time-exposure"></span>
<span id="9-Fresh-prospective-placement：re-entry-必须从零开始"></span>
<span id="9-1-Active-hazard-与-prospective-placement-是两个-estimand"></span>
<span id="10-One-day-smoke-通过，为何项目仍未闭合"></span>
<span id="10-1-从-smoke-到-economics-还缺四个闭环"></span>
<span id="11-最终状态与没有获得的权限"></span>
<span id="12-公共证据"></span>
<span id="5-BUY-q90-portfolio-attribution"></span>
<span id="TL-DR：q90-ON-确实扩大了-SELL-minus-BUY-fill-imbalance，但“更多-SHORT、更多多层-SHORT、终局更差”都没有成立"></span>
<span id="1-为什么这是-portfolio-path，不是单笔-cancel-study"></span>
<span id="2-预注册的四段机制链"></span>
<span id="2-1-为什么一条链不能靠单个显著-link-成立"></span>
<span id="3-数据、arms-与-causal-boundary"></span>
<span id="4-Grade-A-primary：只有-side-imbalance-通过"></span>
<span id="4-1-一个数值路径说明为何-flow-增加不等于-SHORT-增加"></span>
<span id="5-Grade-B-与-all-40-为什么不能救-primary"></span>
<span id="6-Treatment-strength：历史-replay-与-operational-diagnostic-相差约-190-倍"></span>
<span id="6-1-为什么不能把-105-次动作简单乘以-190"></span>
<span id="7-为什么-terminal-MTM-是必要但仍不充分的终点"></span>
<span id="8-研究支持了什么、没有支持什么"></span>
<span id="8-1-四种容易混淆的结论"></span>
<span id="9-最终状态与权限"></span>
<span id="中介链报告不是自动的因果-mediation"></span>
<span id="Target-rate-transport-应怎样重做"></span>
<span id="Initial-state-与终局窗口"></span>
<span id="10-公共证据"></span>
<span id="6-Ranked-toxicity-carryover-safe-guard"></span>
<span id="TL-DR：一日生命周期-plumbing-通过，40-日-mechanics-与任何经济结论都还没有"></span>
<span id="1-研究问题：预测毒性之后，究竟对哪一张订单做什么？"></span>
<span id="2-Past-only-rank-denominator"></span>
<span id="2-1-为什么-rank-比-raw-score-更可运输，又不是免费的"></span>
<span id="2-2-五日-500-bucket-warmup为什么-fail-closed"></span>
<span id="3-动作、输入与未来-estimand"></span>
<span id="4-ACK-是风险集边界，不是日志装饰"></span>
<span id="5-为什么-v1-的-库存生命周期-边界不够安全"></span>
<span id="5-1-Assignment-owner-与当前-inventory-role-是两个维度"></span>
<span id="5-2-为什么不能强制-washout"></span>
<span id="6-研究演进：失败记录为什么不能拆成新项目"></span>
<span id="7-一日冻结-mechanics-结果"></span>
<span id="7-1-Smoke-test-能证伪什么，不能估计什么"></span>
<span id="7-2-正式-mechanics-应报告的-selectivity-funnel"></span>
<span id="8-不确定性与关闭-支持边界"></span>
<span id="8-1-当前状态为什么是“未完成”，不是正面或阴性经济结果"></span>
<span id="8-2-这项-plumbing-对其它动作有什么公共价值"></span>
<span id="9-没有获得的权限"></span>
<span id="Rank-transport-的优势和隐藏状态"></span>
<span id="Exposure-guard-的-assignment-owner-与动态-role"></span>
<span id="从-one-day-plumbing-到-40-day-scorecard"></span>
<span id="10-公共证据-1"></span>
<span id="结语-1"></span>
<span id="8-结论：一个-guard-经济关闭，一个-guard-身份失效，一个-guard-只完成-plumbing"></span>
</div>


## 从分数到动作

一个分数可以描述已发生的坏成交，却未必能在决策前挑出该阻止的订单。BER proxy、q90、ranked toxicity 还可能采用不同的时间可见性、库存归属与机会分母，不能合成一个“毒性过滤有效／无效”的结论。

## 重做之前要明确

首先定义是否只影响 opener、add 或 reducing；其次说明 pending cancel 到 ACK 之间谁拥有风险、跨库存周期的旧单怎样归属；最后明确被阻止的是意图、已提交订单还是实际成交。没有这些对应关系，请求下降或坏成交减少都可能只是参与减少。

旧总 MTM、日均改善、尾部与成交保留表格已撤出当前结论；原身份问题和缺陷回归保留在工程文档，不能为了重做而忽略。

## 待验证的经济问题

过滤器是否在匹配参与度之后仍能提高总净收益及单位收益，并且不把损失转移到库存修复或终点估值？完整账户与符合方法的配对／随机干预可以回答该问题；单纯统计旧已成交样本不能回答。

## 当前数据结果与适用边界

当前 Defense/Urgency 与机制消融的观察保留在 F01 及各自冻结 B0 下，不扩展为所有冷却、库存价格与敞口过滤函数都有效或无效。正在运行的库存软控制另行验收，本文不将进度当结论。

[当前研究族报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/README.zh-CN.md) · [原始聚合结果索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json) · [五候选 Final 聚合](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/final107_comparison.json)

![当前研究问题与验证路径](/images/narrowgate/inventory-control-research-synthesis.svg)

## 统一待验证登记

- `F09-TEMPORAL-PERMISSION`：冷却或重新准入的时机，能否减少不利敞口且不压制有价值的库存修复？
- `F09-INVENTORY-ACTIONS`：库存相关的加仓价格、数量限制或减仓激进度能否改善净价值？
- `F09-EXPOSURE-GUARD`：决策前可见的敞口过滤器，是改善风险选择还是仅减少交易？

以上 ID 统一存放在[本研究族问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/research_questions.json)，可从[全研究族索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)扫描发现。登记不是实验完成，不改变运行中的模型、参数或会计。详细模型、逐账户结果和原冻结证据不随公共仓库分发；原报告历史仍保留其原身份。
