---
title: "NarrowGate 回测证据：工程修复与经济结论分开验收"
date: 2026-08-29 13:30:00
updated: 2026-10-17 22:06:04
categories:
- Market Making
tags:
- Market Making
- Replay
- Causality
- Units
- Evidence Revalidation
math: true
---

本文按 2026-10-17 的当前研究口径重新整理。旧数值、图表和关闭判断不作为当前结论；下文把可引用的新数据结果、待验证假设与工程证据分开。

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="延迟怎样进入策略比较"></span>
<span id="不是从零开始，也不是把旧失败重新命名"></span>
<span id="对照组需要相同的执行环境"></span>
<span id="用三个决策面组织有限的复验"></span>
<span id="1-修复基础设施与重验旧证据是一项研究"></span>
<span id="2-研究阶段与证据状态"></span>
<span id="3-Time-unit-causal-clock-repair"></span>
<span id="TL-DR：单位、feature-ready-clock-或-timer-event-错一个，改变的不只是指标，而是整条订单生命周期"></span>
<span id="1-为什么这些修复是一项研究，而不是九个小-bug"></span>
<span id="2-Variance-unit：不要把价格波动再乘一次-mid"></span>
<span id="2-1-一个量纲算例"></span>
<span id="3-Feature-visibility：index-time-不是-ready-time"></span>
<span id="4-Cross-day-warmup-与-calendar-physical-unit"></span>
<span id="5-Merged-causal-event-clock：没有-trade-时，时间仍在走"></span>
<span id="5-1-一条无成交区间里的事件序列"></span>
<span id="6-Wall-time、exposure-与-capacity"></span>
<span id="7-Markout、partial-fills-与-terminal-equity"></span>
<span id="8-Formal-replay-与-live-alignment必须分离"></span>
<span id="9-验证数字：parity-通过，不等于旧-economics保留"></span>
<span id="9-1-Parity-的三层边界"></span>
<span id="10-causal-v7：修复后的-successor-仍未晋级"></span>
<span id="10-1-修复前后为什么必须划断-evidence-identity"></span>
<span id="11-Strict-ML-A-B-与-BUY-fill-selection-都失败-joint-gate"></span>
<span id="12-最终状态与权限"></span>
<span id="13-公共证据"></span>
<span id="4-Historical-evidence-revalidation"></span>
<span id="TL-DR：旧“不要晋级”仍然安全，旧-PnL、winner-与参数排名却不能继续引用"></span>
<span id="1-Evidence-identity-为什么比文件名重要"></span>
<span id="1-1-一个结果至少有六层身份"></span>
<span id="2-这次-revalidation-面对哪些修复"></span>
<span id="3-四种-revalidation-分类"></span>
<span id="3-1-Retained-correctness"></span>
<span id="3-2-Reproduced-under-corrected-identity"></span>
<span id="3-3-Conservative-decision-retained-estimate-withdrawn"></span>
<span id="3-4-Invalid-for-current-selection"></span>
<span id="3-5-一张可操作的判定表"></span>
<span id="4-Mixed-L2：同一个目录名可能不是同一个数据-identity"></span>
<span id="5-Feature-clock：同一模型树也可能得到非法预测"></span>
<span id="6-Same-input-parity-能证明什么"></span>
<span id="7-为什么-A-B-delta-也会失效"></span>
<span id="7-1-一个最小非线性反例"></span>
<span id="8-什么需要-paired-rerun"></span>
<span id="8-1-重跑不是复制旧命令"></span>
<span id="9-最终保留的证据集"></span>
<span id="10-权限边界"></span>
<span id="11-公共证据"></span>
<span id="5-Formal-replay-identity-不是一个-config，而是一组闭合关系"></span>
<span id="5-1-同一日期不等于同一市场数据身份"></span>
<span id="5-2-Daily-fresh-start-与-continuous-库存生命周期-是不同-estimand"></span>
<span id="5-3-SHA-能证明字节没变，不能证明语义正确"></span>
<span id="6-量纲闭合：数值合理不代表公式经济上合理"></span>
<span id="6-1-Lookback、variance-period-与-risk-horizon-是三只钟"></span>
<span id="6-2-一个-denomination-invariance-测试"></span>
<span id="6-3-订单量不能永远藏在参数里"></span>
<span id="6-4-Return-variance-与-absolute-price-variance-不能凭名字互换"></span>
<span id="7-因果事件钟：没有-trade-的十秒也会发生事情"></span>
<span id="7-1-同毫秒事件不是天然有序"></span>
<span id="7-2-Partial-fill-是状态转移，不是重复完整订单"></span>
<span id="7-3-为什么共同-bug-不会从-paired-A-B-自动消失"></span>
<span id="7-4-Aggregate-parity-近似不等于订单路径一致"></span>
<span id="8-证据迁移：什么能继承，什么必须重跑"></span>
<span id="8-1-撤回数字不等于反向证明"></span>
<span id="8-2-Revalidation-不等于把所有旧-grid-重跑一遍"></span>
<span id="8-3-一个可执行的-successor-合同"></span>
<span id="8-4-四种“通过”必须使用四种语言"></span>
<span id="9-结论：保守决策可以保留，精确经济数字不能跨-identity-搬运"></span>
</div>


## 四种时刻

市场事件发生、数据可见、策略决策和订单生效是不同的时刻。已完成窗口才能进入特征；无成交期间也必须推进定时器、撤单与其他合法事件。修复这些语义会改变路径，但路径改变本身不是 alpha。

## 什么保留，什么重做

| 证据 | 保留方式 | 不可外推 |
| --- | --- | --- |
| 单位和时钟缺陷回归 | 保留触发条件、预期行为及测试 | 不能因旧收益撤出而删掉缺陷知识 |
| 固定输入 Python/C++ parity | 保留输入、实现范围与误差 | 不是原生队列或实盘成交等价 |
| checkpoint 恢复与吞吐 | 保留环境、负载及恢复比较 | 不是收益证明 |
| 旧模型经济数字 | 改成当前待验证问题 | 不继承旧胜者、排名或关闭决定 |
| 新数据已验收结果 | 原数据／模型／账户范围原样引用 | 不冒充未重做的机制 |

## 对工程数据的解释

原工程文档的事件数、数值容差、状态恢复和性能测量继续作为工程证据。任何工程样例中的会计值只用于一致性或路径差异诊断，不能被当成策略收益结论。新源模型与完整账户比较从研究索引读取，不从工程图中的单日金额推断。

旧数据或旧时钟曾被使用这一事实不被删除，也不重新制造 fresh holdout。不能定位原来源的主张保持证据缺口，不用最新实现补写旧身份。

## 当前数据结果与适用边界

固定输入一致性、缺陷回归、恢复与性能测量按原工程范围保留；它们不证明策略盈利。新数据经济比较从研究索引单独查阅。

[当前研究族报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/system_engineering/README.zh-CN.md) · [原始聚合结果索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json) · [五候选 Final 聚合](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/final107_comparison.json)

![当前研究问题与验证路径](/images/narrowgate/replay-revalidation-research-synthesis.svg)

## 统一待验证登记

- `SYS-ECONOMIC-TRANSFER`：数据源、时钟或执行语义改变后，哪些经济主张仍能成立？

以上 ID 统一存放在[本研究族问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/system_engineering/research_questions.json)，可从[全研究族索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)扫描发现。登记不是实验完成，不改变运行中的模型、参数或会计。详细模型、逐账户结果和原冻结证据不随公共仓库分发；原报告历史仍保留其原身份。
