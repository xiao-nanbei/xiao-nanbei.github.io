---
title: "NarrowGate 订单续接：当前时机比较与待验证的队列价值"
date: 2026-08-29 13:30:00
updated: 2026-10-17 22:06:03
categories:
- Market Making
tags:
- Market Making
- Placement
- Queue Value
- Competing Risks
- 订单生命周期
math: true
---

本文按 2026-10-17 的当前研究口径重新整理。旧数值、图表和关闭判断不作为当前结论；下文把可引用的新数据结果、待验证假设与工程证据分开。

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="1-一张订单的价值从-placement-开始，在-continuation-中结束"></span>
<span id="2-研究阶段与证据状态"></span>
<span id="与响应动作基线的区别"></span>
<span id="U0-U1：事件驱动报价评价"></span>
<span id="3-Placement-distance-与-marginal-fill-value"></span>
<span id="TL-DR：把报价移远确实会少成交，但“少成交”没有变成可识别的正终局价值"></span>
<span id="1-为什么整个-F06-只是一项研究项目"></span>
<span id="2-最初的陷阱：独立策略世界制造了假的一-tick-反转"></span>
<span id="3-Placement-fill-estimand：activation、fill-与-cancel-ACK-必须在一个生命周期里"></span>
<span id="4-从固定-horizon-到-full-curve"></span>
<span id="5-Policy-clock：cancel-request-是动作，ACK-才是-exchange-terminal-race"></span>
<span id="6-Request-state-race：哪些组件真的学到了东西"></span>
<span id="7-Common-support-与共同预测时钟"></span>
<span id="8-原始动作分辨率：一-tick-太细，两-tick与四-tick可见"></span>
<span id="9-Fill-difference-不是-action-value"></span>
<span id="9-1-为什么-pathwise-pairing-比“分别跑三次策略”更强"></span>
<span id="9-2-一个两-tick-对比的完整算例"></span>
<span id="9-3-一-tick不可识别是一条工程尺度结论"></span>
<span id="9-4-从-feasibility-到-full-path-policy-还缺哪一座桥"></span>
<span id="10-最终-Development-结果"></span>
<span id="11-短-horizon-hint-为什么不能救-terminal-estimand"></span>
<span id="12-最终边界与没有获得的权限"></span>
<span id="13-公共证据"></span>
<span id="4-Queue-value-KEEP-CANCEL"></span>
<span id="TL-DR：撤单确实删除了大量成交，但没有优先删除有毒成交，最终动作价值为负或不确定"></span>
<span id="1-为什么-active-order-不是-placement-order"></span>
<span id="2-冻结动作与-库存生命周期-attribution"></span>
<span id="2-1-CANCEL-不是一个瞬时二元开关"></span>
<span id="2-2-Queue-option-value-的经济分解"></span>
<span id="2-3-一条合成路径为何会让“预测正确、动作错误”"></span>
<span id="3-两套时钟：策略看到什么，交易所先发生什么"></span>
<span id="4-第一阶段：top-20-queue-state-能预测，但动作没有正下界"></span>
<span id="5-Cancel-re-enter-repair：生命周期补全了，价值仍然不支持"></span>
<span id="6-Deep-queue-audit：旧-K1-机制为什么不能被解释成-exact-queue-value"></span>
<span id="7-Strategy-independent-native-scheduler"></span>
<span id="8-Native-KEEP-CANCEL：支持不足，方向性-ITT-仍不稳定"></span>
<span id="9-Net-hazard-value：从手调阈值转向显式订单价值"></span>
<span id="10-Selectivity：删除-92-成交，却没有更快删除-toxic-fills"></span>
<span id="10-1-用比率看-selectivity，为什么仍需看绝对价值"></span>
<span id="10-2-为什么-BUY-与-SELL-必须分开"></span>
<span id="11-Net-hazard-randomized-ITT：BUY-显著有害"></span>
<span id="12-Dynamic-Fill-Hazard：为什么不能只保留-adverse-head"></span>
<span id="13-项目最终边界"></span>
<span id="14-公共证据"></span>
<span id="5-100ms-lifecycle-CIF"></span>
<span id="TL-DR：这项研究校准的是订单生命周期概率，不是撤单动作价值"></span>
<span id="1-为什么-snapshot-fill-probability-不够"></span>
<span id="2-State-machine：请求撤单不等于已经退出风险集"></span>
<span id="2-1-为什么以-remaining-quantity-为风险单位"></span>
<span id="2-2-同毫秒事件为什么不能凭业务直觉排序"></span>
<span id="2-3-CIF-与普通分类概率的本质区别"></span>
<span id="3-100ms-联合-hazard：四个-cause-只能共享一份事件概率"></span>
<span id="4-两个时钟：市场发生时间与策略可见时间不能互换"></span>
<span id="5-输入、输出与-estimand-边界"></span>
<span id="6-数据-admission：unknown-不能当作-zero"></span>
<span id="7-为什么许多-spec、amendment-与-execution-attempt-仍只算一个项目"></span>
<span id="8-Python-C-锁步到底验证什么"></span>
<span id="9-40-日完成面板：数字如何互相校验"></span>
<span id="9-1-为什么机器精度-parity-既重要又有限"></span>
<span id="9-2-一个读者可以手工核对的三步不变量"></span>
<span id="10-这份证据支持什么"></span>
<span id="11-这份证据没有支持什么"></span>
<span id="12-失败门与未来重开条件"></span>
<span id="13-最终结论"></span>
<span id="14-公共证据-1"></span>
<span id="6-结论：更准确的生命周期模型不会自动复活失败动作"></span>
</div>


## 决策对象是正在存在的订单

新订单放在哪里，与已有订单是否继续等待不是同一个问题。KEEP 保留排队位置；CANCEL 需要等待确认并承受竞态；REENTER 又产生新队列位置和延迟。只比较一个静态成交概率，无法覆盖这些成本。

![订单竞争终止的机制示意](/images/narrowgate/active-order-lifecycle-cif-state-machine.svg)

## 要保留的状态

| 状态 | 用途 |
| --- | --- |
| 激活、订单年龄与剩余数量 | 定义实际风险集，而非从提交意图计时 |
| Pending cancel 与确认 | 区分仍可成交和已终止 |
| 部分成交与队列位置 | KEEP 与替换的路径差异 |
| 订单终止原因 | 成交、取消、过期等竞争事件 |

F06 的位置曲面研究单独登记；F07 的动态 hazard 与 queue continuation 分开登记。概率校准、C++ 推理 parity 与生命周期正确性属于工程／预测层，不等于动作获利。

## 当前可引用的比较

U0/U1 保持价格条件，改变评价时机与合并待执行计算请求；它不删除市场、订单或成交事件，也不是每个事件都撤换单。八账户结果中的少亏伴随单位收益、请求与库存代价，完整边界见当前 F07 报告。E/C 也只覆盖其原 KEEP/CANCEL 选择，不把 REENTER 自动算完成。

旧队列过滤的成交保留率和 reward 表格已改为问题：是否真的更好选择了风险，而不是几乎停止参与？重做需相同初始订单状态的配对续接与完整终点会计。

## 当前数据结果与适用边界

保留当前数据 E/C 和八账户 U0/U1 各自的验收范围。U1 合计少亏，但单位成交额收益变差，请求数量及库存敞口增加，未晋升。这不完成训练型队列价值、REENTER 或整个 F07。

[当前研究族报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/README.zh-CN.md) · [原始聚合结果索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json) · [五候选 Final 聚合](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/final107_comparison.json)

![当前研究问题与验证路径](/images/narrowgate/order-level-research-synthesis.svg)

## 统一待验证登记

- `F07-QUEUE-CONTINUATION`：计入队列重置与撤单成交竞态后，KEEP/CANCEL/REENTER 选择还有增量价值吗？
- `F07-DYNAMIC-HAZARD`：动态订单风险模型能否跨订单年龄、方向和生命周期状态迁移？

以上 ID 统一存放在[本研究族问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/research_questions.json)，可从[全研究族索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)扫描发现。登记不是实验完成，不改变运行中的模型、参数或会计。详细模型、逐账户结果和原冻结证据不随公共仓库分发；原报告历史仍保留其原身份。
