---
title: "NarrowGate P3 研究：触达、成交与报价价值之间的待验证关系"
date: 2026-08-29 13:30:00
updated: 2026-10-17 22:06:04
categories:
- Market Making
tags:
- Market Making
- P3
- 生存分析
- Quote EV
- 因果时钟
math: true
---

本文按 2026-10-17 的当前研究口径重新整理。旧数值、图表和关闭判断不作为当前结论；下文把可引用的新数据结果、待验证假设与工程证据分开。

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="1-P3-研究真正经历了什么"></span>
<span id="2-研究阶段与证据状态"></span>
<span id="3-归一化-100ms-复现"></span>
<span id="TL-DR：曲线复现了，但这只证明-P-touch-稳定"></span>
<span id="1-研究问题"></span>
<span id="2-输入、输出与-estimand"></span>
<span id="3-数据与因果时钟"></span>
<span id="4-研究演进：只换输入身份，不换问题"></span>
<span id="5-一个-10-秒窗口到底发生了什么"></span>
<span id="6-为什么“几乎一样”仍然要生成新-artifact"></span>
<span id="7-冻结结果"></span>
<span id="8-不确定性与替代解释"></span>
<span id="9-支持边界与没有获得的权限"></span>
<span id="深入推导：一条十秒触达曲线隐含了什么"></span>
<span id="一个数值例子：同样的-P3，不同的执行价值"></span>
<span id="为什么-identity-drift-会改变曲线而不仅是小数位"></span>
<span id="复算视角：怎样从-BBO-路径得到一条不偷看未来的-P3-曲线"></span>
<span id="稳定曲线仍可能在策略中失效的三种路径"></span>
<span id="一条-100ms-路径的逐格标注"></span>
<span id="delta-star-与-kappa-eff-的统计不确定性"></span>
<span id="复算时最容易混淆的五个字段"></span>
<span id="10-公共证据"></span>
<span id="4-Source-aware-静态扩样本"></span>
<span id="TL-DR：更多数据不等于更好的同一条曲线"></span>
<span id="1-研究问题-1"></span>
<span id="2-输入、候选与-estimand"></span>
<span id="3-面板与因果时钟"></span>
<span id="4-研究演进：先验证数据，再拒绝静态池化"></span>
<span id="5-预测结果"></span>
<span id="6-完整报价路径结果"></span>
<span id="7-关闭与支持边界"></span>
<span id="深入推导：扩样本为什么会制造-Simpson-型错觉"></span>
<span id="一个合成例子：两类日期如何改变静态曲线"></span>
<span id="从预测-replacement-到报价-replacement-还缺哪座桥"></span>
<span id="Source-aware-不应只是在模型里加一个来源类别"></span>
<span id="一个-successor-应怎样避免再次得到“更精确的错误平均”"></span>
<span id="曲线差异可拆成-mixture-shift-与-within-state-shift"></span>
<span id="Overlap-day-parity-与跨年-transport-的实验顺序"></span>
<span id="为什么“给旧数据较小权重”仍不是自动答案"></span>
<span id="8-公共证据"></span>
<span id="5-波动率条件面"></span>
<span id="TL-DR：模型质量全过，原研究仍然失败；事后改门槛必须留下痕迹"></span>
<span id="1-研究问题-2"></span>
<span id="2-输入、输出与模型约束"></span>
<span id="3-面板与因果时钟-1"></span>
<span id="4-v4-结果：预测结构通过，完整-identity-失败"></span>
<span id="5-v4-1：为什么它是同一篇文章里的新合同，而不是“修复版”"></span>
<span id="6-为什么预测面不能直接成为报价"></span>
<span id="7-支持边界与没有获得的权限"></span>
<span id="深入推导：从一条曲线到条件概率曲面"></span>
<span id="一个曲面单元格怎样影响报价，又为何不能直接决定报价"></span>
<span id="为什么-v4-1-不能抹掉-v4-的失败"></span>
<span id="条件曲面的-support-geometry"></span>
<span id="从-prediction-surface-到-action-surface-的最小实验"></span>
<span id="Calibration-不等于只画一条-reliability-curve"></span>
<span id="Coverage-缺口可能不是随机缺失"></span>
<span id="State-feature-自己也必须有-horizon-contract"></span>
<span id="8-公共证据-1"></span>
<span id="6-标量报价-adapter"></span>
<span id="2026年8月历史案例：两个标量能否保留报价价值？"></span>
<span id="1-研究问题：prediction-pass-怎样才能变成-quote-value"></span>
<span id="2-映射公式：从两张曲面到两个标量"></span>
<span id="3-数据与因果时钟-1"></span>
<span id="4-一个具体机制例子"></span>
<span id="5-旧输入与旧基线下的24日历史结果"></span>
<span id="6-为什么-errata-必须并入同一篇文章"></span>
<span id="7-关闭、未关闭与权限"></span>
<span id="深入推导：曲面压成两个标量为什么是不可逆的"></span>
<span id="冻结反例：更多成交为何带来更差终局"></span>
<span id="怎样设计不会重复同一错误的-successor"></span>
<span id="为什么-kappa-eff-甚至不是一个稳定的曲面摘要"></span>
<span id="这次失败如何定位，而不是简单归咎于“过度成交”"></span>
<span id="Scalar-adapter-怎样在报价公式里被重复使用"></span>
<span id="数量单位为何让旧-ABI-更危险"></span>
<span id="如何读完整路径里的库存时间下降"></span>
<span id="8-公共证据-2"></span>
<span id="7-策略可见时钟-transport"></span>
<span id="TL-DR：预测质量通过，完整-transport-identity-因样本支持停止"></span>
<span id="1-研究问题：为什么需要一项独立的时钟研究"></span>
<span id="2-输入、输出与-estimand-1"></span>
<span id="3-两套时钟"></span>
<span id="4-冻结面板"></span>
<span id="5-结果"></span>
<span id="6-为什么不能进入-value-fitting"></span>
<span id="7-版本与-errata-为什么合并"></span>
<span id="8-支持、关闭与权限"></span>
<span id="深入推导：transport-不是把时间戳列重命名"></span>
<span id="一个双时钟例子：同一笔-trade-何时可以被模型使用"></span>
<span id="为什么预测通过后还会败在支持门"></span>
<span id="Decision-weighted-与-time-weighted-estimand-不相同"></span>
<span id="Support-gate-应回答哪些具体问题"></span>
<span id="Event-sampling-与-fixed-grid-sampling-的选择偏差"></span>
<span id="Continuous-gap-对-rolling-state-的影响"></span>
<span id="Transport-pass-后的最小-value-panel"></span>
<span id="9-公共证据"></span>
<span id="8-联合报价价值"></span>
<span id="TL-DR：概率曲面能排序，不代表它能选出有经济价值的报价"></span>
<span id="1-P3-到底是什么，不是什么"></span>
<span id="2-十三个联合报价候选"></span>
<span id="3-决策时钟与数据边界"></span>
<span id="3-1-从触达到终局价值，缺了哪些随机变量"></span>
<span id="3-2-一个-13-臂决策的具体数值例子"></span>
<span id="3-3-“bucket-value”为什么只是一个受限代理"></span>
<span id="4-第一阶段：结果未读前，支持门已经失败"></span>
<span id="5-Owner-continuation：接受风险，不改写硬门"></span>
<span id="6-结果：缺的不是-value-rows，而是经济分辨率与时间稳定性"></span>
<span id="6-1-为什么-0-126-baseline-fallback-是结果，不是“模型没有工作”"></span>
<span id="6-2-支持不足不是“少几天”这么简单"></span>
<span id="6-3-读者应怎样复算这项结论"></span>
<span id="7-为什么“概率模型通过”不能救这个价值-selector"></span>
<span id="8-最终边界"></span>
<span id="十三臂问题里的-winner’s-curse"></span>
<span id="Activation、fill-与-no-fill-共同构成-quote-value"></span>
<span id="一个可复算的-support-scorecard"></span>
<span id="9-公共证据-1"></span>
<span id="9-Reach-time-hazard-successor"></span>
<span id="TL-DR：不再只问“十秒会不会碰到”，而是估计何时、碰到多远"></span>
<span id="1-研究问题：为什么固定-horizon-不够"></span>
<span id="2-100ms-discrete-hazard"></span>
<span id="3-输入、约束与-estimand"></span>
<span id="4-数据与因果时钟"></span>
<span id="5-研究演进：design、spec-与-execution-都属于一个项目"></span>
<span id="6-结果"></span>
<span id="7-残余风险：near-distance-calibration"></span>
<span id="8-支持边界与没有获得的权限"></span>
<span id="深入推导：固定-horizon-概率怎样展开成到达时间分布"></span>
<span id="一个可计算例子：早触达与晚触达为何对报价不同"></span>
<span id="Calibration-要怎样读，near-distance-风险为何更重要"></span>
<span id="Competing-distance-bands-怎样避免重复计算同一路径"></span>
<span id="从-hazard-到订单寿命的反事实"></span>
<span id="右删失与-coverage-censor-不能共用一个标签"></span>
<span id="Integrated-Brier-通过仍需看-hazard-calibration"></span>
<span id="一个-hazard-to-value-实验的冻结接口"></span>
<span id="9-公共证据-2"></span>
<span id="10-结论：P3-成功回答了概率问题，却没有跨过报价价值的桥"></span>
</div>


## 三种概率不能混用

P3 描述给定距离与期限内的市场触达。自己的 maker 单还要经过提交生效、排队、部分成交、撤单和终止，因此触达不是自己的成交概率，更不是成交后的净价值。

![同侧 BBO 距离的机制示意](/images/narrowgate/orderbook/orderbook_p3_same_side_bbo_distance.png)

这幅图只说明距离定义，不是拟合曲线或收益证据。静态 P3、波动率条件 P3、方向条件曲面和 reach-time 分布是不同对象，不能用一个校准通过替代全部问题。

## 从曲面到动作需要明确映射

| 层次 | 目标 | 尚需验证的转换 |
| --- | --- | --- |
| Touch | 市场是否到达指定距离 | 数据缺口、可见性和状态迁移 |
| Reach-time | 首次到达的时间分布 | 决策时钟与订单生效时间 |
| Fill | 自己的订单是否成交 | 队列、取消及竞争终止 |
| Quote value | 完整路径净价值 | 库存、费用、资金费和终点估值 |

旧 scalar-adapter 的价差、成交数与 MTM 对照已从正文、表格和结果图撤出，改成可检验问题：把条件曲面压缩为双侧标量，是否丢失方向、状态或期限结构？更窄报价若增加成交，增加的究竟是有价值参与还是不利敞口？目前没有用新静态 P3 的完成来替这个问题作答。

## 重做的关键

训练与校准只读取声明支持；不同曲面在共同可见机会和共同缺失规则上比较。先确认单位与触达定义，再固定报价映射比较完整账户。旧门槛、旧最优距离和历史胜者不作为新默认值；历史使用记录仍保留。

## 当前数据结果与适用边界

新数据链已经使用仅在训练支持上校准的静态 P3；这不能覆盖条件触达曲面、双侧标量报价映射或 reach-time 的经济问题。当前 scalar-adapter 重做有独立归属，尚不能借其他模型的验收宣称它通过或失败。

[当前研究族报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/README.zh-CN.md) · [原始聚合结果索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json) · [五候选 Final 聚合](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/final107_comparison.json)

![当前研究问题与验证路径](/images/narrowgate/p3-research-synthesis.svg)

## 统一待验证登记

- `F02-TOUCH-TRANSFER`：条件触达概率能否跨波动率、距离、方向和决策时钟迁移？
- `F02-REACH-TIME`：触达时间分布能否改善可执行的报价决策？
- `F02-SCALAR-ADAPTER-CURRENT-SOURCE`：条件触达概率经双侧标量映射后，能否在当前数据和冻结B0上改善净价值，还是主要增加成交和不利库存暴露？

以上 ID 统一存放在[本研究族问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/research_questions.json)，可从[全研究族索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)扫描发现。登记不是实验完成，不改变运行中的模型、参数或会计。详细模型、逐账户结果和原冻结证据不随公共仓库分发；原报告历史仍保留其原身份。
