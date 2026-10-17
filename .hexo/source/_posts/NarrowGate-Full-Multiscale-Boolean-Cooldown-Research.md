---
title: "NarrowGate 多尺度冷却：从旧结果转为待验证的状态—时长假设"
date: 2026-08-29 14:25:53
updated: 2026-10-17 22:06:04
categories:
- Market Making
tags:
- Market Making
- 市场微观结构
- 因果推断
- 机器学习
- 回测
math: true
---

本文按 2026-10-17 的当前研究口径重新整理。旧数值、图表和关闭判断不作为当前结论；下文把可引用的新数据结果、待验证假设与工程证据分开。

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="阅读范围：2026年8月的历史实验，不是当前实验结论"></span>
<span id="1-问题不是“EMA-能不能预测价格”，而是“状态能不能改变动作价值”"></span>
<span id="2-为什么要做-Full-Multiscale-successor"></span>
<span id="3-证据身份：30-日历史-Development，而不是-prospective-或-strict-live-evidence"></span>
<span id="3-1-同一毫秒不是已经识别的先后顺序"></span>
<span id="4-状态空间：十个-half-life、45-个-EMA-pair-和三值逻辑"></span>
<span id="4-1-Half-life-是记忆衰减，不是预测期限"></span>
<span id="4-2-Raw、normalized-与-side-transformed-state"></span>
<span id="4-3-三值-Boolean：缺失不能经由-NOT-变成证据"></span>
<span id="5-Candidate-ladder：从简单-库存生命周期-状态逐层增加信息"></span>
<span id="6-为什么必须-nested-chronological-OOF"></span>
<span id="7-One-shot-label-只负责发现，repeated-replay-才负责经济结论"></span>
<span id="8-为什么-BUY-与-SELL-必须从输入到权限全程分开"></span>
<span id="9-BUY：一个值得保留、但不能晋级的-E3-点信号"></span>
<span id="10-为什么它仍然失败"></span>
<span id="11-SELL：没有可以保留为候选的-non-baseline-policy"></span>
<span id="12-formal-v13-到-formal-v27-不是十五代研究"></span>
<span id="13-这个阴性结果究竟关闭了什么"></span>
<span id="14-从这项研究得到的五个方法论结论"></span>
<span id="15-公开证据与阅读顺序"></span>
<span id="结语：最值得保留的不是-winner，而是没有给-winner-补票"></span>
</div>


## 研究问题

多尺度市场状态能否决定成交后何时重新允许增加敞口，并改善完整账户净价值？关键不是找到一个局部收益最高的时长，而是区分减少坏成交、减少全部参与和延误必要修复。

## 方法对象

完成的市场窗口形成不同时间尺度的状态摘要；阈值化后得到 Boolean 条件，再映射成候选冷却时长或持续准入规则。单次解除冷却与每次成交后反复执行是不同干预。加仓侧与减仓侧也不能一起关闭后再声称只改变风险进入。

| 阶段 | 需要明确的内容 |
| --- | --- |
| 特征 | 只有决策时已完成且可见的窗口 |
| 训练 | 当前支持、标签结束时刻、purge 与选择过程 |
| 执行 | 一次性动作还是反复策略；加仓与减仓角色 |
| 比较 | 同账户原 B0、参与度对照、库存路径和净收益 |

## 为什么不继续展示八月数字

旧 BUY E3 点估计、旧候选绝对损失、置信区间和特征层级判定，属于旧数据及旧选择流程，不能回答当前模型的问题。正文、表格和图表不再用它们作当前支持或拒绝结论；原记录和历史使用仍保持原身份。

当前已授权重做先审查方法并绑定新训练支持，不把选择模型的表现冒充最终 refit 的独立确认。E/C 的新结果不是多尺度冷却重做结果。此问题当前仍为待验证，不用旧门槛失败来阻止合理新实验，也不靠删除失败条件获得“通过”。

## 当前数据结果与适用边界

新数据 prefill E/C 已完成 204 独立账户 × 十条路径，四个拟合曲面使用 T100 训练标签。全日历和 Final 各路径均仍亏损；E/EC 相对自己的 B0 减少总亏损，C 的增量方向不一致，E 的 Final 单位成交额收益反而变差。两个随机种子不足以证明稳定选择性。另一个十头风险加宽的有限比较为负；两者都不等于 Full-Multiscale 冷却或全部 first-fill / joint-quote 问题已验证。

[当前研究族报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/README.zh-CN.md) · [原始聚合结果索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json) · [五候选 Final 聚合](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/final107_comparison.json)

![当前研究问题与验证路径](/images/narrowgate/full-multiscale-frozen-result-authority.svg)

## 统一待验证登记

- `F05-JOINT-QUOTE-VALUE`：联合报价与价值映射能否改善完整账户净价值？
- `F05-FIRST-FILL-VALUE`：哪些决策前可见状态能预测包含后续库存修复的边际成交价值？
- `F05-MULTISCALE-COOLDOWN-CURRENT-SOURCE`：多尺度市场状态选择成交后冷却时长，能否改善完整账户净价值，而非仅压低成交或延误有价值的减仓？
- `F05-STALE-QUOTE-ADVERSE-FILL`：是否有一类挂单更新偏慢、容易在局部不利位置成交的情况？
- `F05-MARKOUT-HOLDING-LIFECYCLE`：markout期限应怎样关联持仓生命周期，而不是默认30秒或某个固定百分比最合适？

以上 ID 统一存放在[本研究族问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/research_questions.json)，可从[全研究族索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)扫描发现。登记不是实验完成，不改变运行中的模型、参数或会计。详细模型、逐账户结果和原冻结证据不随公共仓库分发；原报告历史仍保留其原身份。
