---
title: "NarrowGate 外部市场：当前联合方向结果与仍待验证的公允价格假设"
date: 2026-08-29 13:30:00
updated: 2026-10-17 22:06:04
categories:
- Market Making
tags:
- Market Making
- 跨市场
- Lead-Lag
- Fair Price
- 因果推断
math: true
---

本文按 2026-10-17 的当前研究口径重新整理。旧数值、图表和关闭判断不作为当前结论；下文把可引用的新数据结果、待验证假设与工程证据分开。

<!-- Preserve historical inbound section links; content now uses the current question/evidence scope. -->
<div aria-hidden="true" style="height:0;overflow:hidden">
<span id="1-BABEL-外部市场研究是一张并行路线图"></span>
<span id="2-研究阶段与证据状态"></span>
<span id="3-Global-Reference-Stage-0"></span>
<span id="TL-DR：三家交易所提高了可证伪性，却没有把秒级残差变成稳定-maker-alpha"></span>
<span id="1-研究问题：外部市场“先动”能否排序本地-maker-结果"></span>
<span id="2-输入、状态、动作与-estimand"></span>
<span id="3-数据面板与两只时钟"></span>
<span id="4-层级-reference-如何避免“某一家带偏”"></span>
<span id="5-冻结数据结果"></span>
<span id="6-为什么旧-maker-数字必须撤回"></span>
<span id="7-研究演进为何合并为一篇"></span>
<span id="8-不确定性、关闭边界与下一步"></span>
<span id="9-没有获得的权限"></span>
<span id="深入推导：global-reference-为什么首先是一个稳健坐标问题"></span>
<span id="Residual-可预测不等于-maker-fill-有价值"></span>
<span id="Leave-one-venue-out-应怎样用"></span>
<span id="三个-venue-并不等于三个独立样本"></span>
<span id="从-reference-residual-到-maker-action-还差一次条件化"></span>
<span id="为什么阴性-Stage0-仍然有价值"></span>
<span id="价格归一化不只是除以一个汇率"></span>
<span id="Residual-prediction-的-benchmark-应有多强"></span>
<span id="一条端到端的反事实时间线"></span>
<span id="10-公共证据"></span>
<span id="4-External-information-decay"></span>
<span id="TL-DR：外部增量在-1-秒边界最强，1–7-秒通过-simultaneous-lower-bound"></span>
<span id="1-研究问题：信息有多长的“可预测寿命”"></span>
<span id="2-M0、M1-与-estimand"></span>
<span id="3-为什么上界是-18-秒"></span>
<span id="4-数据与因果时钟"></span>
<span id="5-冻结的-1–18-秒结果"></span>
<span id="6-历史-3-秒结果的适用范围"></span>
<span id="7-一个具体的时钟例子"></span>
<span id="8-关闭、支持与未获权限"></span>
<span id="深入推导：为什么必须对整条-horizon-曲线同时推断"></span>
<span id="信息半衰期与系统延迟如何配对"></span>
<span id="如何阅读-1-秒胜出而不把边界当峰值"></span>
<span id="同时置信带为什么比逐-horizon-星号更重要"></span>
<span id="可用信息寿命要扣除整条系统延迟"></span>
<span id="Decay-curve-对后继实验的具体约束"></span>
<span id="Decay-curve-是-signal-与-target-dynamics-的卷积"></span>
<span id="Horizon-rows-的重叠怎样影响不确定性"></span>
<span id="从-decay-到系统-SLO"></span>
<span id="9-公共证据"></span>
<span id="5-Causal-fair-price"></span>
<span id="TL-DR：这是一条稳健价格坐标，不是-alpha，也不是改价许可"></span>
<span id="1-研究问题：先把价格说成同一种语言"></span>
<span id="2-输入、输出与非目标"></span>
<span id="3-Past-only-basis：当前观测不能校正自己"></span>
<span id="4-Venue-内融合与跨-venue-weighted-median"></span>
<span id="5-Online-gain：外部-lead-不是一比一平移"></span>
<span id="6-两只时钟与历史适配器的能力上限"></span>
<span id="7-40-日-common-mask-结果"></span>
<span id="8-研究演进与相邻项目为何不能合并"></span>
<span id="9-关闭、支持与权限边界"></span>
<span id="深入推导：past-only-basis-与-online-gain-各解决什么"></span>
<span id="Weighted-median-的稳健性边界"></span>
<span id="为什么-fair-price-MAE-改善仍不是报价证据"></span>
<span id="Basis-与-gain-的识别顺序不能交换"></span>
<span id="Fair-center-改善为什么可能让报价更差"></span>
<span id="Weighted-median-的-breakdown-point-与共同故障"></span>
<span id="Price-accuracy-的三个-benchmark"></span>
<span id="Fair-price-artifact-的运行时安全边界"></span>
<span id="10-公共证据-1"></span>
<span id="6-First-add-M0-M1"></span>
<span id="TL-DR：30-日数量门已完成，但-exact-lifecycle-与共同分母仍未闭合，因此没有模型结果"></span>
<span id="1-研究问题：为什么只研究“第一次加仓”"></span>
<span id="2-直接-target-为什么不可替代"></span>
<span id="3-M0、M1-与-estimand"></span>
<span id="4-数据与因果时钟-1"></span>
<span id="5-数量门：为什么-31-个-windows-只等于-30-日"></span>
<span id="6-为什么-count-complete-仍不能拟合"></span>
<span id="7-通过门槛与不确定性"></span>
<span id="8-与-Adverse-Edge-Guard-为什么不是一个项目"></span>
<span id="9-研究演进与版本合并"></span>
<span id="10-关闭、支持与权限边界"></span>
<span id="深入推导：为什么-first-add-是一个自然-decision-surface"></span>
<span id="M0-M1-增量究竟检验什么"></span>
<span id="为什么-30-日-count-complete-仍然不是-usable-panel"></span>
<span id="First-add-row-怎样避免把结果条件化进输入"></span>
<span id="为什么-exact-lifecycle-是模型训练前的条件"></span>
<span id="从可用面板到动作结论还需两阶段"></span>
<span id="数量门应基于-cluster，而不是总-rows"></span>
<span id="Exact-lifecycle-的守恒条件"></span>
<span id="为什么“没有模型结果”比弱模型表更诚实"></span>
<span id="11-公共证据"></span>
<span id="7-Adverse-edge-guard"></span>
<span id="TL-DR：机制能动，支持度太低；v2-修正-denominator，但没有采集正式-tape"></span>
<span id="1-研究问题：先证明-guard-能被精确定义"></span>
<span id="2-输入、角色与候选坐标"></span>
<span id="3-v1-数据与两只时钟"></span>
<span id="4-冻结-support-结果"></span>
<span id="5-延迟存活、报价距离与-lifecycle-leverage"></span>
<span id="6-v2-为什么改成-Exact-Opener"></span>
<span id="7-v2-1-v2-2：执行合同不是新科学项目"></span>
<span id="8-版本为何必须写在同一篇"></span>
<span id="9-关闭、支持与不确定性边界"></span>
<span id="深入推导：adverse-quote-edge-应怎样定义"></span>
<span id="延迟存活不是一个固定毫秒阈值"></span>
<span id="Exact-opener-为什么改变识别而不改变研究主题"></span>
<span id="10-公共证据-2"></span>
<span id="8-Fair-center-randomized-action"></span>
<span id="TL-DR：动作每次都发生、保留-97-fills，却依赖单一-venue-且主区间跨零"></span>
<span id="1-研究问题：外部价格领先能否变成-maker-action-value？"></span>
<span id="2-动作与因果输入"></span>
<span id="3-双时钟与-K-线例子"></span>
<span id="3-1-整对平移保留了什么，又改变了什么"></span>
<span id="3-2-Historical-completed-bar-与-live-transport-是两道时钟"></span>
<span id="4-Development-支持与动作强度"></span>
<span id="5-Primary-结果"></span>
<span id="6-Grade-B-与-leave-one-venue-out-transport"></span>
<span id="6-1-LOO-检验的不是“哪个-venue-最好”"></span>
<span id="6-2-Grade-B-为正为何不能改变-primary"></span>
<span id="6-3-54-17-与-55-的门槛为何不能四舍五入"></span>
<span id="7-为什么这不是-near-pass"></span>
<span id="7-1-HT-日价值为何比每-assignment-更不稳定"></span>
<span id="7-2-一个未来-cross-venue-successor-应先解决什么"></span>
<span id="8-研究演进与关闭边界"></span>
<span id="9-没有获得的权限-1"></span>
<span id="Pair-translation-的局部几何"></span>
<span id="单一-venue-依赖为何是-transport-failure"></span>
<span id="54-17-为什么不是“实质上等于55-”"></span>
<span id="Signal-age-应进入-action-contract"></span>
<span id="Pair-recenter-与-inventory-skew-的组合顺序"></span>
<span id="未来证据的最小门"></span>
<span id="10-公共证据-3"></span>
<span id="结语"></span>
<span id="9-结论：外部市场是信息源，不是免费动作"></span>
</div>


## 信息路径

外部信息先经过各来源可见性和时效检查，再做过去信息的基差处理；候选公允价格或预测只有在本地决策前可用，才可能改变报价。交易所事件时间、数据商时间和策略可见时间不自动相等。

三交易所现货／永续参考、BTCUSDT 联合方向模型、中心平移和单侧放宽是不同设计。新数据上的联合方向结果可以替代对应当前模型效果的旧说法，但不证明三交易所参考已重做，也不复活旧接收时钟或衰减曲线。

## 可直接引用的新结果

五候选中的 A 使用固定 100 日联合方向输入，其余十二头沿用原 B0；D/E 采用逐有效标签等权，另外十二头字节一致。A 相对 B0 的总收益与两种单位收益均更差；D 比 E 少亏，但 D 自身仍弱于该 B0。不得把 D/E 的包差异扩成外部信息普遍有利，也不得把 A 的负结果扩成所有跨市场方法无效。

## 两个尚未被覆盖的问题

| 问题 | 要控制的混杂 |
| --- | --- |
| 外部信息还有多少可用增量？ | 本地共同信号、基差、时效、训练支持 |
| 公允价格坐标如何变成有价值动作？ | 中心平移与价差放宽、队列变化、库存角色 |

原三交易所优势、信息衰减 AUC 与 fair-center 收益数值已撤出当前展示。重做时要先核来源覆盖及因果 as-of，再决定比较何种动作；缺少真实接收时钟时，只声明所采用的模拟可见性。

## 当前数据结果与适用边界

新数据五候选 Final 比较已经完成。联合方向输入的 A 净收益 −159.670159 USDC，同账户冻结 B0 为 −157.501448 USDC，两种单位收益也更差。D/E 只改变方向头输入和拟合模型，另十二头字节一致。这不能替代三交易所公允价格、信息衰减或外部过滤动作的重做。

[当前研究族报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/README.zh-CN.md) · [原始聚合结果索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/recompute_407.json) · [五候选 Final 聚合](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/final107_comparison.json)

![当前研究问题与验证路径](/images/narrowgate/external-market-research-synthesis.svg)

## 统一待验证登记

- `F04-MULTIVENUE-DECAY`：外部市场信息在可见性、基差及执行成本之后还有多少增量？
- `F04-EXTERNAL-ACTION`：外部公允价格坐标改变能否改善报价或动作价值？

以上 ID 统一存放在[本研究族问题索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/research_questions.json)，可从[全研究族索引](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/registry.json)扫描发现。登记不是实验完成，不改变运行中的模型、参数或会计。详细模型、逐账户结果和原冻结证据不随公共仓库分发；原报告历史仍保留其原身份。
