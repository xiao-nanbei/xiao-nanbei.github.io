---
title: 'NarrowGate 研究地图：从市场预测、订单决策到完整账户收益'
date: 2026-08-29 13:30:00
updated: 2026-09-27 10:45:00
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

做市研究的难点，是把市场信息变成值得执行的订单。预测价格方向或触达概率只是起点；订单还要经历提交、排队、成交、库存持有和减仓，最终由完整账户收益检验。这里按这条链组织 NarrowGate 的研究入口，方便读者从具体问题找到方法、实验和限制。

## 从哪个问题开始

- **报价为什么在这里？** 阅读报价动作与 P3：前者比较价格和中心的改变，后者区分市场触达与实际成交。
- **预测提供了什么信息？** 阅读新 Tardis 13-Head、外部市场和主动成交流：分别讨论本地预测、跨市场信息和订单风险集。
- **这笔风险是否值得承担？** 阅读 Fill Quality、订单级价值和库存控制：区分成交后的标签、决策前可见状态与真正的动作差额。
- **怎样知道回测证据可信？** 阅读时间量纲与因果时钟、工程主文：先确定数据到达、订单生效、成交通知和会计口径，再解释收益。

这些问题相互依赖，但一个环节通过不替代下一环节。触达预测改善不代表成交价值改善，库存时间下降也不保证净收益提高。首次下单相对等待（POST/WAIT）以及挂单保留相对撤销（KEEP/CANCEL）需要各自的完整路径检验；这里不把尚未完成的成交前 E/C 选择研究写成有效策略。

## 主文与实验范围

下表中的历史结论只属于相应冻结实验。新 Tardis F03 已有模型比较与完整 Final 结果；F05 已有双侧十头与一个固定风险加宽消费者的开发账户负结果，详见各自文章。执行进度和维护入口由[仓库研究台账](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json)记录，不由本页推断实盘状态。

| # | 主研究 | 覆盖研究族 | 完整问题 | 原冻结环境的结论 |
|---:|---|---|---|---|
| 1 | [报价动作：从固定参数竞速到随机化 Widen/Recenter](/2026/08/29/NarrowGate-Fixed-Parameter-Racing-Research/) | F01、F09 | 参数 winner 能否升级为有反事实支持的报价动作？ | 固定参数仅可 screening；已测局部动作与 BUY 条件加宽均无稳定晋级 |
| 2 | [Empirical P3：从十秒触达到 Reach-Time Hazard 与报价价值](/2026/08/29/NarrowGate-P3-Aggressive-Reach-Time-Hazard-Research/) | F02、F05 | P(touch) 能否经过策略时钟、queue 与终局价值变成报价动作？ | Prediction successor 有支持；scalar adapter 与 joint quote selector 关闭 |
| 3 | [NarrowGate 新 13-Head：Tardis 因果特征、时间加权选型与负收益结果](/2026/08/29/NarrowGate-Causal-13-Head-Source-Aware-v12-Research/) | F03 | 十三个预测头能否跨数据修复、来源和频率形成完整 maker alpha？ | 旧 v4–v12／cadence 阶段：局部 prediction 存在，完整经济 identity 未晋级；新 Tardis 结果见链接正文 |
| 4 | [External Market Alpha：三交易所参考、信息衰减与 Fair-Center](/2026/08/29/NarrowGate-Three-Venue-Global-Reference-Stage0-Research/) | F04、F09 | 外部市场信息如何从 receive-time state 走到本地报价动作？ | 短时信息与 fair coordinate 有证据；first-add/guard/action 链未闭合 |
| 5 | [Fill Quality 与 First-Add Quote EV](/2026/08/29/NarrowGate-Decision-Visible-Negative-Fill-Value-Research/) | F05、F10 | 坏成交从何处开始，能否提前识别并用 soft-widen 改善？ | 历史损失存在；无稳定 decision-visible subset，直接动作关闭 |
| 6 | [Full-Multiscale Boolean Cooldown](/2026/08/29/NarrowGate-Full-Multiscale-Boolean-Cooldown-Research/) | F05 | 多尺度 EMA Boolean state 能否选择重复执行的 cooldown duration？ | BUY 有 point signal，但 simultaneous gate 未过；`supported_sides=[]` |
| 7 | [Order-Level Quote Value：Placement、Queue Value 与 Continuation](/2026/08/29/NarrowGate-Active-Order-Queue-Value-Keep-Cancel-Research/) | F06、F07 | 报价应放多远，激活后应 KEEP 还是 CANCEL/RE-ENTER？ | 2/4 tick fill 差可辨；marginal value 与 continuation action 均未通过 |
| 8 | [Side-Taker Lifecycle：微观流、双时钟与 Risk Set](/2026/08/29/NarrowGate-Side-Taker-Flow-Research/) | F08 | 主动成交流如何在合法可见时钟上进入订单动态风险集？ | 静态 M0 关闭；双时钟与 v2 risk-set 前置仍未完成 |
| 9 | [Cooldown Temporal-Permission Action Frontier](/2026/08/29/NarrowGate-Volatility-Time-Add-Rearm-Research/) | F09 | One-cycle、stop-until-flat、state、recovery、variance-time 哪个控制强度有效？ | 从 near-noop 到 participation shutdown 均无稳定正终局价值 |
| 10 | [Inventory Control：Budget、SELL 抑制与 Passive Repair](/2026/08/29/NarrowGate-Sell-Add-Inventory-Price-Penalty-Research/) | F09 | 少进入风险库存或更快减仓，能否同时改善 terminal value？ | 库存代理可改善，但 reward、tail 或 action resolution 失败 |
| 11 | [Exposure Guards：BER Proxy、BUY q90 与 Ranked Toxicity](/2026/08/29/NarrowGate-Ranked-Toxicity-Exposure-Guard-Research/) | F09、F10 | 风险分数如何绑定合法订单、ACK 风险集和跨 campaign ownership？ | 旧 add-only guard 有经济伤害；q90 身份失效；新 guard 仅完成 plumbing |
| 12 | [Replay Evidence Revalidation：时间、量纲与因果时钟](/2026/08/29/NarrowGate-Time-Unit-Causality-Repair-Research/) | F10、SYS | 基础时钟/单位修复后，旧回测证据还能保留什么？ | No-promotion 权限方向保留；旧 PnL、winner 与排名撤回 |

## 研究之间的依赖

**概率到报价。** P3 的条件概率、距离目标和实际报价映射是不同对象。触达之后还有激活、队列和撤改单；因此概率层的改进可以与报价动作的负结果同时存在。

**下单到续单。** Placement 决定初始价格和排队位置，KEEP/CANCEL 决定是否保留已有队列位置的价值。二者需要共同的订单生命周期，不能将独立的填单概率模型直接当成订单净价值。

**成交到库存。** 短期 markout、库存归因与完整终局分别回答价格变化、损失位置和账户结果。冷却或加仓限制可能减少风险，也可能切断后续修复；它们需要与参与度和终局收益一起比较。

**特征到证据。** 本地与外部信息都必须在决策前可见，标签则可以读取后续结果。时钟或撮合规则修复可能使旧精确数字失效；保留历史失败决定不等于把旧数值重新当成当前标定。

## 按研究族寻找文章

| 研究族 | 应阅读的主文 |
|---|---|
| F01 Fixed Parameter Racing | 报价动作主文 |
| F02 Empirical P3 | P3 主文 |
| F03 Causal 13-Head | Causal 13-Head 主文 |
| F04 External Market Alpha | External Market Alpha 主文 |
| F05 Fill Quality / Quote EV | P3、Fill Quality、Full-Multiscale 三篇 |
| F06 Placement Fill CIF | Order-Level Quote Value 主文 |
| F07 Active Order Continuation | Order-Level Quote Value 主文 |
| F08 Side-Taker Lifecycle | Side-Taker Lifecycle 主文 |
| F09 Campaign Action Uplift | 报价动作、External、Cooldown、Inventory、Exposure Guards 五篇 |
| F10 Live/Replay Attribution | Fill Quality、Exposure Guards、Replay Revalidation 三篇 |
| SYS | Replay Evidence Revalidation 主文 |

## 基础阅读与结果边界

[Maker Quote EV、Order-Level Evidence 与 Causal Action Uplift](/2026/06/19/NarrowGate-Maker-Quote-EV-Research-Framework/) 给出术语、价值函数与比较方法；[回测吞吐与 Live 尾延迟工程](/2026/07/01/NarrowGate-Cpp-Low-Latency-Market-Making/) 说明执行与运行时约束。

阅读结果时，需要区分三种情况：负结果表示指定实验没有支持收益主张；支持不足表示信息量尚不能回答问题；已撤回表示旧精确数字不再可用，并不等于反向结论。历史候选关闭不证明整个研究族无效，工程组装通过也不表示已经开始实盘。

公共文章提供方法、已公开聚合结果和来源链接。不同实验的数据、基线、候选、日期划分与统计方法分别保留，不合成一个看似连续的“总实验”。
