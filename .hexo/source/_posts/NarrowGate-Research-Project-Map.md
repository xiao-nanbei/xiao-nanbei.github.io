---
title: 'NarrowGate 研究地图：十个研究族如何收敛为 12 篇主研究长文'
date: 2026-08-29 13:30:00
updated: 2026-09-26 20:52:00
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

Last materially modified: 2026-09-26

## 2026-09-26 当前导航

新 Tardis F03 的既定模型比较和完整 Final 已完成，结果及使用历史见[新 13-Head 主文](/2026/08/29/NarrowGate-Causal-13-Head-Source-Aware-v12-Research/)。F01、F04、F05 的有限批次进展应与全族未完范围分开，当前入口与真实状态以[代码研究台账](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json)和各族主报告为准；F05 已有真实十头及一个冻结消费者的负结果，不代表全族完成。新的参数比较、工程组装与实盘激活是不同任务，不从前两者推断当前 live 状态。

下列 9 月 5 日顺序及历史表格保留其当时范围，不再作为今天的未完成清单。当前页面仍按 12 条研究叙事组织；重组计划不等于站点已经改成另一种篇数。

## 2026-09-05 历史阶段：旧研究地图保留，新环境先重建 B0

本页的 12 条叙事总结的是各自冻结环境中的历史研究，不是当前私有 live 的开关清单，也不是新延迟环境的收益结论。当前修复后的 B0 与候选还没有完成新的完整配对经济回测。工程测试通过不能自动更新表中的策略结论，旧 PnL、winner 和参数排名也不能搬进新的 baseline。

下一轮的优先级前移到“承担风险之前是否值得”：首次开仓相对等待、挂单继续保留相对撤单重入，以及再次增仓相对继续等待。项目不是没有事前信号，也不是从未研究这一问题；[F05 英文研究索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/README.md)已经登记 first-opener、决策可见 first-add 和 ADD/WAIT 的阴性结果。缺口是尚未建立可靠的信号→动作→完整路径经济价值映射，而不是简单缺少更多阈值。

| 次序 | 当前工作 | 不得推断的结论 |
| --- | --- | --- |
| 1 | SYS/F10：对齐当前策略配置、分源可见时钟、异步 GLOBAL FIFO、私有回调和退出路径，建立当前 B0 | 共享 C++ 内核 parity 不等于完整调度或经济路径一致 |
| 2 | F10：重新做 BUY/SELL、opener/add/reducing 与完整现金流归因 | 旧日损失构成不代表当前损失构成 |
| 3 | F05/F06/F07/F09：用现有信号、少量明确动作检验首次/继续承担风险的增量价值 | 原来关闭的精确候选不因换名或降低延迟自动获准 |
| 4 | 事前选择有独立增益后，再逐项移除重叠的成交后保护 | 更少保护、更快续单或更少成交不必然更赚钱 |

第一轮两臂保持相同的成交后冷却、markout、风险限制和退出规则，不同时细调 cooldown 时长。候选可以改变自己的请求数量、FIFO 等待、队列与库存，但必须使用共同的行情/外部延迟抽样规则，不能复用 B0 的成交路径。旧环境迁移复验与发现新策略是不同问题，均须在看结果前确定动作、日期、初态和评价口径；不会借复验重新打开旧的 Validation 或 sealed holdout。

完整实施计划与延迟边界见[Replay Evidence Revalidation 的 2026-09-05 更新](/2026/08/29/NarrowGate-Time-Unit-Causality-Repair-Research/)。精确运行配置和原始运维样本在私有证据库，不随公共仓库分发；本页不发布当前账户状态、原始订单或私有 PnL。以下历史结论仍保留原来的适用范围。

## TL;DR：研究 identity 可以很多，读者层面的主文章不应该跟着碎裂

NarrowGate 公共仓库包含十个策略/证据研究族、一个系统工程分支，以及大量 spec、amendment、preflight、failure receipt、producer、parity 和 execution attempt。此前博客把其中 47 个阶段分别写成文章，并称为“48 个真实项目”；这个粒度是错误的。它混淆了用于证据治理的 research identity 与用于解释科学问题的 research narrative。

Research identity 必须严格区分样本、baseline/candidate、fold、estimand 和统计合同：

$$
\mathcal R=(D,B,C,F,\theta,S).
$$

只要其中实质字段改变，机器证据就需要新 identity，不能覆盖旧结果。但一篇面向读者的研究文章应当解释完整问题如何经过这些 identity 演进：为什么换样本、为什么修时钟、为什么预测通过仍不能动作、为什么某个 successor 关闭。Full‑Multiscale 主文章一直采用这种叙事粒度；现在其余研究也统一按同一标准整理。

整理后共有 **12 条主研究叙事**。每篇覆盖一条完整的科学问题、方法演进、反例、经济检验和权限边界；校准版本、时钟修复、prediction gate、mechanics preflight 与失败 attempt 回到对应正文中，不再单独占一篇文章。

## 12 篇主研究长文

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

## 为什么这些合并是必要的

### P3 不是六个互不相干的模型

Normalized-100ms、source-aware v3、volatility-conditioned v4/v4.1、scalar adapter、policy-visible cadence、joint quote value 与 reach-time hazard 依次回答同一条链上的问题。分别阅读时，读者容易把“条件概率预测通过”和“报价动作失败”当成矛盾；合并后可以看见失败发生在 estimand mapping，而不是概率模型自动失效。

### Causal 13-Head 的 v4、v5、v9、v12 与一秒 cadence 是一次持续重建

这些版本更换了 P3、数据身份、taker-tempo、source semantics 和决策频率，但没有改变最高层问题：prediction 是否能穿过 full path 形成经济增量。把每次修复各写一篇，会让局部通过的 head 或某个正 PnL 点估计脱离最终 gate。

### Placement 与 Active-Order Continuation 是同一张订单的前后半段

Placement 决定初始价格与 queue position；KEEP/CANCEL 决定是否保留已经获得的 queue option。Fill CIF、cancel-ACK competing risk 和 lifecycle parity 是动作估值的前置层，不应被包装成与 action value 平行的研究结论。

### Cooldown 五个候选必须放在同一 leverage frontier 上

One-cycle skip 改得太少，stop-until-flat 改得太多，state/recovery/variance-time 在中间寻找可执行区域。只有合并后才能看见结构性阴性结果：当前测试范围内，没有候选同时满足真实 path divergence、活动保留和正 terminal reward lower bound。

### Guard 的共同难点是订单所有权，不是阈值名字

历史 `BER` 实际是 trade-intensity acceleration proxy；BUY q90 是 active-order hazard 分位；ranked toxicity 是 persistent exposure permission。三者信号不同，却都必须处理 feature-ready clock、cancel ACK、terminal risk set、dynamic role 和 carryover ownership。把它们拆开，会重复讲状态机，却看不见同一执行合同如何逐步收紧。

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

## 两篇基础长文不计入 12 个研究项目

[Maker Quote EV、Order-Level Evidence 与 Causal Action Uplift](/2026/06/19/NarrowGate-Maker-Quote-EV-Research-Framework/) 是整个项目的算法、术语与证据框架总览；[回测吞吐与 Live 尾延迟工程](/2026/07/01/NarrowGate-Cpp-Low-Latency-Market-Making/) 是 Python/C++、回放吞吐和运行时延迟的工程专著。它们为各研究主文提供背景，但不因为篇幅更长就被重复计算成策略研究项目。

## 怎样阅读阴性、阻塞与未完成结果

`closed` 只关闭对应冻结 identity，不表示整个研究族没有信息；`prediction supported` 不等于 quote/action supported；`mechanics complete` 不等于经济效果存在；`blocked` 表示必要字段、时钟、支持或生命周期尚未闭合。`withdrawn` 则表示旧数值不再具有当前引用权限，不自动等于反向结论。

同理，owner operational decision 可以显式接受研究尚未闭合的风险，却不能倒写成历史 gate 已通过。每篇主文同时写明“看到了什么”“没有获得什么权限”，并把 K 线、报单、queue、inventory 与 campaign terminal 放在同一机制链中。

精确私有 artifact、OOF rows、缓存、原始 live 记录与 owner-side evidence 不随公共博客分发。公共文章提供可审计的方法、聚合结果、公开仓库链接和证据边界；它不把“公开可审计”夸大成“第三方可端到端复算所有私有结果”。

## 结语：文章应该按问题合并，证据仍要按 identity 分开

合并文章不等于合并证据。正文可以把同一科学问题的失败、修复和 successor 写成一条连贯故事；机器 manifest、fold、artifact 与 receipt 仍必须保持各自不可混用的 identity。前者服务理解，后者保护因果与统计完整性。

这也是 Full-Multiscale 给出的正确模板：不是把每个执行 attempt 单独发布，而是让读者在一篇文章中看到问题、状态空间、nested OOF、one-shot/repeated distinction、BUY/SELL 分侧、结果、失败原因与权限边界。现在其余 NarrowGate 研究也按同一标准阅读。
