---
title: "NarrowGate 库存动作：价格、数量与修复速度的待验证取舍"
date: 2026-08-29 13:30:00
updated: 2026-10-17 22:06:04
categories:
- Market Making
tags:
- Market Making
- 库存控制
- 库存生命周期
- Quote Placement
- Tail Risk
math: true
---

本文按 2026-10-17 的当前研究口径重新整理。旧数值、图表和关闭判断不作为当前结论；下文把可引用的新数据结果、待验证假设与工程证据分开。

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="1-少持仓、快修复与赚更多钱是三个不同命题"></span>
<span id="2-研究阶段与证据状态"></span>
<span id="3-Post-cooldown-budget"></span>
<span id="TL-DR：候选网格退化为单点，未读任何-PnL-就关闭"></span>
<span id="1-研究问题：限制“还能加多少”而不是“还要等多久”"></span>
<span id="2-动作、输入与机制-estimands"></span>
<span id="3-因果时钟与一个具体例子"></span>
<span id="4-冻结面板与数据身份"></span>
<span id="5-Unlimited-control-的填充单位分布"></span>
<span id="5-1-为什么候选网格必须由-control-distribution-outcome-blind-地决定"></span>
<span id="5-2-中位数为零揭示了-control-surface-的位置错误"></span>
<span id="6-B-1-完整路径：第二个独立关闭理由"></span>
<span id="6-1-为什么“动作太广、经济太弱”是一个独立失败类型"></span>
<span id="6-2-一个手工可复核的-episode"></span>
<span id="7-结果与不确定性：为什么此处没有-PnL-表"></span>
<span id="7-1-不读-outcome-本身是一项可验证结果"></span>
<span id="7-2-一个合法-successor-应改变什么"></span>
<span id="7-3-Mechanics-closure-与经济阴性有什么不同"></span>
<span id="8-研究演进与关闭边界"></span>
<span id="9-没有获得的权限"></span>
<span id="为什么-control-distribution-是动作设计的一部分"></span>
<span id="Mechanics-closure-与-null-economics-的区别"></span>
<span id="一个可识别的-successor-应怎样设计"></span>
<span id="Partial-identification-比强行给-PnL-更准确"></span>
<span id="Grid-degeneracy-的自动化-gate"></span>
<span id="10-公共证据"></span>
<span id="结语"></span>
<span id="4-SELL-add-price-penalty"></span>
<span id="TL-DR：库存风险变小了，但-candidate-更像压低参与，而不是挑出坏-fills"></span>
<span id="1-研究问题：用价格而不是-permission-控制加空"></span>
<span id="2-输入、动作与-estimand"></span>
<span id="3-因果时钟与订单例子"></span>
<span id="3-1-bps-penalty-如何变成交易所可执行-tick"></span>
<span id="3-2-为什么固定曲线而不是扫描-penalty-grid"></span>
<span id="4-证据合同与支持"></span>
<span id="5-Grade-A-primary-结果"></span>
<span id="5-1-Participation-suppression-与-selection-的可检验区别"></span>
<span id="5-2-为什么-remaining-multi-level-subgroup-不能做因果解释"></span>
<span id="5-3-Risk-budget-通过、value-budget-失败意味着什么"></span>
<span id="6-Grade-B-与不确定性"></span>
<span id="7-研究演进与关闭边界"></span>
<span id="8-没有获得的权限"></span>
<span id="Participation-suppression-与-selection-improvement-的可分解形式"></span>
<span id="Penalty-的单位与非线性执行边界"></span>
<span id="风险预算通过、价值预算失败应怎样决策"></span>
<span id="Price-control-与-permission-control-的差别"></span>
<span id="Paired-daily-path-的分解"></span>
<span id="一个新-penalty-研究需要怎样的独立理由"></span>
<span id="9-公共证据"></span>
<span id="结语-1"></span>
<span id="5-Multi-short-reducing-BUY"></span>
<span id="TL-DR：repair-快-84-82-秒、库存时间下降，但-PnL-与左尾没有改善"></span>
<span id="1-研究问题：修复速度本身值多少钱？"></span>
<span id="2-动作合同与关键价格公式"></span>
<span id="2-1-“最激进合法-maker”不是无限接近中价"></span>
<span id="2-2-更快成交付出的三类价格"></span>
<span id="3-因果时钟与-path-例子"></span>
<span id="4-冻结面板与支持"></span>
<span id="5-Primary-economics：速度通过，价值失败"></span>
<span id="6-如何理解“repair-time-显著、reward-不显著”"></span>
<span id="6-1-中介变量不能替代-total-effect"></span>
<span id="6-2-速度的经济价值为什么可能随-regime-变号"></span>
<span id="6-3-q10-CVaR-略差为何是重要反例"></span>
<span id="7-研究演进与关闭边界-1"></span>
<span id="7-1-为什么不顺手测试-IOC"></span>
<span id="7-2-这项研究怎样与-SELL-price-penalty-共同形成边界"></span>
<span id="8-没有获得的权限-1"></span>
<span id="Repair-time-是-mediator，不是目标本身"></span>
<span id="最激进合法-maker-的执行含义"></span>
<span id="q10-CVaR-反例怎样约束“降低库存就是降风险”"></span>
<span id="No-fill-opportunity-cost-如何进入结果"></span>
<span id="Initial-inventory-level-改变同一动作的风险"></span>
<span id="什么结果才会支持-aggressive-repair"></span>
<span id="9-公共证据-1"></span>
<span id="结语-2"></span>
<span id="6-合并后的结论：进入得少和离开得快都没有自动变成正价值"></span>
</div>


## 三种改变不是一种策略

增加敞口一侧的价格外移，改变的是成交选择；限制后续加仓数量，改变的是可进入库存；提高减仓侧 maker 激进度，改变的是修复路径。若同时改变三者，就不能把净收益差额归给某一个机制。

## 需要区分的输出

| 指标 | 解释边界 |
| --- | --- |
| 绝对库存与库存时间积分 | 风险暴露，不是净收益 |
| 修复时间 | 更快退出可能更昂贵 |
| 成交保留与请求负担 | 参与及执行代价，不自动等于质量 |
| 总净收益与单位收益 | 必须包含费用、资金费与终点库存价值 |

旧价格惩罚曲线、修复时间改善量和 reward 区间已从当前结果图与表中撤出。假设仍保留：在什么状态下，更慢加仓或更快减仓能改善完整账户价值？它不由旧局部代理指标回答。

## 当前研究关系

F01 的已验收当前数据对照可供其自身机制引用，不可替代这里的加仓价格或被动修复干预。当前库存软控制的实际运行状态从其 owner 读取，本文不以尚未完成的局部结果宣布此族结论。

## 当前数据结果与适用边界

当前 Defense/Urgency 与机制消融的观察保留在 F01 及各自冻结 B0 下，不扩展为所有冷却、库存价格与敞口过滤函数都有效或无效。正在运行的库存软控制另行验收，本文不将进度当结论。

[当前研究族报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/README.zh-CN.md) · [原始聚合结果索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json) · [五候选 Final 聚合](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/final107_comparison.json)

![当前研究问题与验证路径](/images/narrowgate/inventory-control-research-synthesis.svg)

## 统一待验证登记

- `F09-TEMPORAL-PERMISSION`：冷却或重新准入的时机，能否减少不利敞口且不压制有价值的库存修复？
- `F09-INVENTORY-ACTIONS`：库存相关的加仓价格、数量限制或减仓激进度能否改善净价值？
- `F09-EXPOSURE-GUARD`：决策前可见的敞口过滤器，是改善风险选择还是仅减少交易？

以上 ID 统一存放在[本研究族问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/research_questions.json)，可从[全研究族索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)扫描发现。登记不是实验完成，不改变运行中的模型、参数或会计。详细模型、逐账户结果和原冻结证据不随公共仓库分发；原报告历史仍保留其原身份。
