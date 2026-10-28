---
title: 'NarrowGate 研究地图：从市场预测、订单决策到完整账户收益'
date: 2026-08-29 13:30:00
updated: 2026-10-29
categories:
- Market Making
tags:
- Market Making
- 研究治理
- 因果推断
- 回测
- 市场微观结构
math: true
---

> 2026-10-29 公开范围更新：NarrowGate 的具体研究内容、实验方案、生产策略实现、实效参数及结果不再对外公布。对研究或课题感兴趣、有疑问的朋友，欢迎邮件私聊：[xuantan650@gmail.com](mailto:xuantan650@gmail.com)。以下为历史文章导航，不代表当前研究状态；旧仓库链接可能已不再提供相关内容。当前公开入口为[基础研究方向](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/docs/research_directions.zh-CN.md)。

这张地图把原文更新时的已验收证据、待验证问题和工程验证分开。历史报告的胜负、概率指标或关闭决定，不应作为当前研究状态。

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="从哪个问题开始"></span>
<span id="从报价控制到更新时机：五组实验的归属"></span>
<span id="主文与实验范围"></span>
<span id="研究之间的依赖"></span>
<span id="按研究族寻找文章"></span>
<span id="基础阅读与结果边界"></span>
</div>


## 按问题进入研究族

| 研究族 | 当前证据入口 | 待验证问题入口 |
| --- | --- | --- |
| F01 | [当前报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f01_fixed_parameter_racing/README.zh-CN.md) | [统一问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f01_fixed_parameter_racing/research_questions.json) |
| F02 | [当前报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/README.zh-CN.md) | [统一问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/research_questions.json) |
| F03 | [当前报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/README.zh-CN.md) | [统一问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/research_questions.json) |
| F04 | [当前报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/README.zh-CN.md) | [统一问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/research_questions.json) |
| F05 | [当前报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/README.zh-CN.md) | [统一问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/research_questions.json) |
| F06 | [当前报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/README.zh-CN.md) | [统一问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/research_questions.json) |
| F07 | [当前报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/README.zh-CN.md) | [统一问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/research_questions.json) |
| F08 | [当前报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/README.zh-CN.md) | [统一问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/research_questions.json) |
| F09 | [当前报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/README.zh-CN.md) | [统一问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/research_questions.json) |
| F10 | [当前报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/README.zh-CN.md) | [统一问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/research_questions.json) |
| SYS | [当前报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/system_engineering/README.zh-CN.md) | [统一问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/system_engineering/research_questions.json) |

## 文章导航

- F01：[ 报价控制研究：当前结果与待验证交互 ](/2026/08/29/NarrowGate-Fixed-Parameter-Racing-Research/)
- F02：[ P3 研究：触达、成交与报价价值之间的待验证关系 ](/2026/08/29/NarrowGate-P3-Aggressive-Reach-Time-Hazard-Research/)
- F03：[ 13-Head：用当前 Tardis 结果替换旧模型结论 ](/2026/08/29/NarrowGate-Causal-13-Head-Source-Aware-v12-Research/)
- F04：[ 外部市场：当前联合方向结果与仍待验证的公允价格假设 ](/2026/08/29/NarrowGate-Three-Venue-Global-Reference-Stage0-Research/)
- F05：[ 成交质量与 Quote EV：当前 E/C 结果和待验证的成交价值问题 ](/2026/08/29/NarrowGate-Decision-Visible-Negative-Fill-Value-Research/)
- F05：[ 多尺度冷却：从旧结果转为待验证的状态—时长假设 ](/2026/08/29/NarrowGate-Full-Multiscale-Boolean-Cooldown-Research/)
- F07：[ 订单续接：当前时机比较与待验证的队列价值 ](/2026/08/29/NarrowGate-Active-Order-Queue-Value-Keep-Cancel-Research/)
- F08：[ 主动成交流：当前响应模型与待验证的订单风险集 ](/2026/08/29/NarrowGate-Side-Taker-Flow-Research/)
- F09：[ 冷却与重新准入：待验证的时间控制问题 ](/2026/08/29/NarrowGate-Volatility-Time-Add-Rearm-Research/)
- F09：[ 库存动作：价格、数量与修复速度的待验证取舍 ](/2026/08/29/NarrowGate-Sell-Add-Inventory-Price-Penalty-Research/)
- F09：[ 敞口过滤：把旧毒性排名改成可验证假设 ](/2026/08/29/NarrowGate-Ranked-Toxicity-Exposure-Guard-Research/)
- SYS：[ 回测证据：工程修复与经济结论分开验收 ](/2026/08/29/NarrowGate-Time-Unit-Causality-Repair-Research/)

## 不能互相覆盖的结果

新 F03 Hinf/ML-OFF、五候选 Final、Defense/Urgency、prefill E/C 和 U0/U1 保留各自已经验收的覆盖。它们不是同一基线，不能合成一个总收益排行。新联合方向模型不能覆盖旧三交易所公允价格，E/C 不能覆盖 Full-Multiscale，U0/U1 不能覆盖 REENTER。

扫描[机器可读研究族注册表](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)中的 `research_questions`，选择 `pending_validation` 即可发现后续问题。索引记录具体缺口与既有归属，不自动启动实验。工程一致性、恢复与性能数据留在工程文档，不当作收益主张。

方法总入口：[Maker Quote EV](/2026/06/19/NarrowGate-Maker-Quote-EV-Research-Framework/)。当前响应模型：[Response baseline](/2026/10/08/NarrowGate-Response-Action-Baseline/)。
