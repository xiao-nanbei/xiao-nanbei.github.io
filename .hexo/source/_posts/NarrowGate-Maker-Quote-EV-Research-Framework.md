---
title: 'NarrowGate：Maker Quote EV、Order-Level Evidence 与 Causal Action Uplift'
date: 2026-06-19 16:50:48
updated: 2026-10-26
categories:
- Market Making
tags:
- Market Making
- 市场微观结构
- 数据质量
- 机器学习
- 回测
math: true
---

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="被动报价、成交质量与库存风险"></span>
<span id="报价期望价值与机会级代理"></span>
<span id="不同统计量回答不同问题"></span>
<span id="阅读路线：先问题，再证据"></span>
<span id="证据术语：不要把三种日期隔离都叫-OOS"></span>
<span id="第一部分：Maker-量化算法与数据假设"></span>
<span id="1-1-为什么叫-NarrowGate"></span>
<span id="1-2-从-AS-报价骨架开始"></span>
<span id="1-3-参数映射：量纲正确，不等于经济期限已经对齐"></span>
<span id="1-4-Side-Policy-的逐侧加宽与暂停"></span>
<span id="固定-fill-cooldown-不是理论终点"></span>
<span id="1-5-三种“斜率”不能合并：execution、touch-与-depth"></span>
<span id="1-6-第一场真正的麻烦来自数据，而不是模型"></span>
<span id="1-6-1-审计结果成为硬边界"></span>
<span id="1-6-2-物理数据也同步清理"></span>
<span id="1-6-3-rolling-与-label-使用同一套连续段定义"></span>
<span id="1-7-为什么加入-BTCUSDT-和-spot-后，结果反而更差"></span>
<span id="1-8-多市场-reference：历史-receive-time-诊断层与权限边界"></span>
<span id="1-9-报价机会的成交质量建模"></span>
<span id="1-10-Shadow-概念与“不得默认新建研究-shadow”边界"></span>
<span id="1-10-1-Promotion-gate：方向对还不够，必须校准过关"></span>
<span id="1-10-2-Shadow-Replay-与-Shadow-Simulation-不是同一种证据"></span>
<span id="1-10-3-Rolling-baseline：live、mechanics-与-economic-control-必须分层"></span>
<span id="1-10-4-参数选择：从“找最优点”改成-racing-约束优化"></span>
<span id="1-11-只看-PnL-还不够：把库存风险写成积分"></span>
<span id="1-12-库存终局：被动斜率不是万能退出路径"></span>
<span id="1-13-微观振幅与宏观趋势：成交概率锚和库存风险锚"></span>
<span id="第二部分：回放验证与证据边界"></span>
<span id="2-1-为什么-bar-回测不够"></span>
<span id="2-2-Promotion-gate：从漂亮数字到可用证据"></span>
<span id="2-2-1-从-score-到-action-value：离线-policy-evaluation"></span>
<span id="2-3-2026-07-28-时点最诚实的结论"></span>
<span id="2-4-Null、score-与-action-必须分层"></span>
<span id="2-5-先排除实现归因，再继续找-alpha"></span>
<span id="2-6-2026-07-15：旧-ML-精确数值失效后的正式重校准"></span>
<span id="2-7-2026-07-17：BUY-scorer-与-shared-side-policy-完成双引擎-parity"></span>
<span id="2-8-2026-07-18：causal-v4-empirical-P3-formal-research-baseline"></span>
<span id="2-9-2026-07-18：从-score-ranking-到带已知-propensity-的-action-value-evaluation"></span>
<span id="2-10-2026-07-25：normalized-100ms-与-causal-v5-历史账本"></span>
<span id="2-11-Fixed-spread-与成交概率：先拆-touch，再谈-fill"></span>
<span id="触达统计、成交风险与报价用途"></span>
<span id="2-12-重建后的-null-与-Python-C-parity"></span>
<span id="2-13-2026-07-28：从-cancel-policy-clock-到-ordered-common-support-surface"></span>
<span id="2-14-2026-08-03：causal-v12-control、连续价值口径与研究族收口"></span>
<span id="causal-v12-为什么可以运行，却还不能写成独立研究确认"></span>
<span id="日末库存降权，不等于库存风险被取消"></span>
<span id="一个历史-q90-shadow-与一个退役-selector-为什么都没有研究-action-权限"></span>
<span id="各研究族的公开证据停在哪里"></span>
<span id="连续日历回放是共享底座，不是第十一个策略族"></span>
<span id="2026-08-12-历史-checkpoint：multichannel-Boolean-cooldown-当时检验了什么"></span>
<span id="2026年8月-Development-历史结果与证据范围"></span>
<span id="结论：窄门不是参数，而是证据门槛"></span>
</div>


## 一个贯穿完整路径的问题

预测概率并不是报价价值。报价必须经历可见信息、计算、提交、生效、排队、成交、库存持有与修复，最后在费用、资金费和终点库存估值后解释净收益。一个环节的改进不自动传给下一个环节。

## 术语与可验证对象

| 对象 | 需要声明的口径 | 常见误读 |
| --- | --- | --- |
| P(touch) | 距离起点、方向、期限与观察规则 | 当作自己的 P(fill) |
| Fill probability | 激活后风险集、队列和竞争终止 | 当作条件净收益 |
| Markout | 成交价／中价、方向、固定期限、gross/net | 当作完整持仓收益 |
| Quote EV | POST/WAIT 或 KEEP/CANCEL 的动作与完整成本 | 只删除坏成交后重算 |
| 库存生命周期 | 部分减仓、flat-to-flat、终点删失 | 和订单存续时间混用 |
| 完整账户 | 独立重置或连续状态、费用与资金费 | 任意跨实验相加 |

## AS 终点、固定风险窗与持仓退出

2026-10-26 补充：当前 AS-shaped 核心的库存中心项和价差风险项使用 `sigma_sq * risk_horizon_s`。H 是显式配置的固定积分长度，不随持仓年龄、普通报价周期、日切或回放剩余时间自动递减。`quote_horizon_s`、P3／预测标签期限与 `pnl_volatility_horizon_s` 分别有自己的消费者。持仓时间紧迫度和超时另有启用条件，不等于 AS 的 `T-t`。对应实现见固定版本的 [Python 核心](https://github.com/xiao-nanbei/NarrowGateMaker/blob/a086ff4b59ba2766ca3c50af476f9b31cb0c318a/strategy/quote_core.py#L1701-L1740)和 [C++ 核心](https://github.com/xiao-nanbei/NarrowGateMaker/blob/a086ff4b59ba2766ca3c50af476f9b31cb0c318a/cpp/narrowgate_cpp/quote_core.cpp#L735-L749)。

[AS 2008 正式发表版](https://math.nyu.edu/~avellane/HighFrequencyTrading.pdf)第 221 页式 (29)–(30)的近似 reservation price 为 `s-q*gamma*sigma²*(T-t)`，总价差为 `gamma*sigma²*(T-t)+(2/gamma)*log(1+gamma/k)`，不能漏掉风险期限项。其终端财富目标 `X_T+q_T*S_T` 不自动要求 `q_T=0`；固定其他量时，库存风险偏移随剩余期限缩短而减弱，不是临近截止就强制清仓。当前归一化库存、经验系数、固定 H 和后续投影不是论文最优解。

库存容忍度还涉及价格判断、退出能力和资金约束，振幅或方差都不能单独证明回归。这里澄清的是机制与期限，不授权改变参数，也没有给历史实验补写新的收益或实盘验收。

## 当前已验收结果代替对应旧结论

| 问题 | 当前可引用的证据 | 边界 |
| --- | --- | --- |
| 13-Head 包是否优于对应 ML-OFF | 新 Tardis Final：Hinf −189.212148，ML-OFF −269.042233 USDC | 每臂 54 独立账户，仍亏损、非 fresh holdout |
| 后续五训练／输入候选是否优于 urgency-off B0 | 五个候选总收益及两种单位收益均更差 | 同一完整 Final107；不能隔离所有训练因素 |
| 防御／紧迫度组合 | 原九臂新数据比较已完成；保留原 B0 与后续选择身份 | 少亏伴随库存暴露增加，不是盈利证明 |
| E/C 成交前动作选择 | 204 账户 × 十路径完整评价；E/EC 少亏，C 增量不一致 | 随机对照只匹配训练拒绝率，不是评估成交量 |
| U0/U1 旧单评价时机 | 八账户合计少亏，同时请求和库存代价增加 | 不等于队列价值模型或 REENTER 已验证 |

这里使用的是各自原验收结果，不把它们换成同一个 B0。具体源记录见[新数据重算索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json)、[F03 聚合](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/results_20260922.json)和[五候选 Final](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/final107_comparison.json)。公开聚合可核对范围，但购买数据、模型与逐行结果未公开，不等于第三方可从源码直接复算全部实验。

## 旧结论现在以问题进入研究族

条件 P3 的标量映射能否改善净价值？多尺度冷却是否只是减少参与？队列过滤是否保留了更有价值的成交？外部公允坐标能否穿过可见性和执行成本？库存修复加速是否值得付出价格成本？这些问题没有被不相干的新模型结果自动覆盖。

旧数值、置信区间、赢家与关闭判断已从本文正文和图表撤出，原历史记录不改写成新实验。统一问题 ID、已知缺口与下一步方法在[研究族注册表](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)指向的各族 `research_questions.json` 中，而不是散落在文章末尾。

## 持仓生命周期与 markout

研究期限应与机制有关，但没有证据表明固定 30 秒或持仓时间的某个百分比天然正确。短期价格曲线、边际库存消化时间及完整账户会计可以并列观察；真实未来退出时刻不能提前作为决策输入。挂单更新迟缓与局部不利成交的关系已登记为 F05 假设，需要含未成交／取消机会的分母和真实可见状态。

## 工程证据独立保留

Python/C++ 一致性、因果时钟、数值单位、checkpoint 恢复和吞吐测量仍然有效于其原测试范围，不能拿来证明盈利，也不因旧经济结论待验证而撤销。机制图里的归一化价格是示意，不是新的实盘样本。

下一步只按已授权研究问题执行，不改变正在跑的冻结候选。已看过的 Final 不重新变成盲测，局部缺失或工程失败也不能冒充经济不通过。
