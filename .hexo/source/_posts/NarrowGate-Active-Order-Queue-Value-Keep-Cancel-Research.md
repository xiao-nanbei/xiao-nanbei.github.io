---
title: 'NarrowGate Order-Level Quote Value：Placement Distance、Queue Value 与 Active-Order Continuation'
date: 2026-08-29 13:30:00
updated: 2026-08-30 02:06:00
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


Last materially modified: 2026-08-30


## 1. 一张订单的价值从 placement 开始，在 continuation 中结束

F06 研究订单提交前应该离 touch 多远，F07 研究订单激活后遇到 adverse state 应该 KEEP 还是 CANCEL/RE-ENTER。它们在仓库中分属 placement 与 continuation 两个 family，却共同构成一张订单的完整决策问题：placement 决定初始价格与 queue position，continuation 决定是否保留已经获得的 queue option。把二者拆成三篇文章，会误以为 fill-CIF 校准、placement action value 与 active-order queue value 可以分别得出动作结论。

提交时的 placement action $a_0$ 与存续期 action $a_t$ 共同生成终局：

$$
Y_T=Y_T(a_0,a_{t_1},a_{t_2},\ldots;M_{0:T}),
$$

其中 $M_{0:T}$ 是同一市场事件路径。订单进入 adverse state 后，KEEP 保留队列位置但继续暴露于有毒成交，CANCEL/RE-ENTER 删除风险也放弃 queue priority。在时刻 $t$ 的订单状态 $H_t$ 下，continuation 真正需要比较的是

$$
\Delta V(H_t)=V_{\mathrm{keep}}(H_t)-V_{\mathrm{cancel/ack/reenter}}(H_t).
$$

这个差值不能由单一 fill hazard 推出；同样，placement 上更浅的报价 fill 更多，也不能推出它更有价值。KEEP、CANCEL 与距离动作都会改变后续风险集、queue rank、成交 side、库存与 campaign 终局；cancel request 也不是 cancel ACK。生命周期 CIF 负责回答“在继续存活条件下各事件何时发生”，动作试验才回答“选择哪条路径更好”。

## 2. 研究阶段与证据状态

| 阶段 | 它真正问什么 | 结论/权限 |
|---|---|---|
| Placement distance 与 marginal fill value | 更浅/更深的一、二、四 tick 报价是否产生可识别终局价值？ | 2/4 tick fill 差异可辨；signed marginal value 不可识别，关闭 |
| Queue-value KEEP/CANCEL | 保留 queue 还是取消并等状态退出后重进？ | 净 hazard successor 删除大量 fills 但不具选择性；动作关闭 |
| 100ms lifecycle CIF | 如何建立动态 risk set、competing risks 与双引擎锁步？ | mechanics/training/parity 完成；尚无经济动作 |

## 3. Placement distance 与 marginal fill value

### TL;DR：把报价移远确实会少成交，但“少成交”没有变成可识别的正终局价值

F06 Placement Fill CIF 研究从一个看似简单的问题出发：**同一个 maker 决策上，把被动报价向市场靠近或远离若干 ticks，成交概率会怎样变化？**

这个问题很快暴露出三个层次：

1. **mechanics**：同一未来行情路径上，更深的被动报价不能成交而更浅的报价不成交；否则 matcher 或路径合同有问题。
2. **probability**：需要估计 activation 后、cancel ACK 前的完整 fill cumulative incidence，而不是把 1s、5s、10s 当成三个互不相干的分类任务。
3. **value**：即使两 tick 或四 tick 的 fill probability 差异显著，也必须证明多出来或少掉的边际 fills 有稳定、带符号的 campaign-terminal USDC value。

研究链最终得到一个很清楚的阴性结论。配对 replay 修复后，fill 曲线严格随报价距离单调；相邻一 tick 的差异在同时推断下不可识别，而单侧两 tick与四 tick 差异可识别。但在最终 24 个正式 side-role-contrast value cells 中，没有一个 terminal-value interval 单侧越过冻结的 $0.0001$ USDC/decision 经济预算，所有区间都跨零；campaign attribution coverage 也没有一个达到 95%。

因此 F06 关闭的是 **placement-distance value path**，而不只是某一版 fill model。结论不是“距离不影响成交”，恰好相反：距离明确影响成交；但这份 Development 证据没有把成交差异转化成有方向的终局动作价值。

本文只讨论历史 Development 研究，不构成交易建议。图中的 K 线和七档报价是合成示意，不是实盘数据。

![Placement distance 七价位配对回放的 K 线机制图](/images/narrowgate/placement-distance-paired-kline.svg)

*图 1：同一 decision、同一 activation clock、同一未来市场路径上同时展开 closer 4/2/1、current、farther 1/2/4 ticks。机械层先问 fill 是否有序，价值层再问边际 fills 是否值得。*

### 1. 为什么整个 F06 只是一项研究项目

公共目录里有 fixed-horizon CIF、full-curve CIF、competing risk、role calibration、policy clock、request-state race、pending nuisance、ordered support、action resolution 与 marginal value 等许多名字。它们不是互相独立的博客项目，而是同一个 placement intervention 在不断修正 estimand 与证据合同。

稳定不变的核心问题是：

> 在一个新被动订单提交决策上，改变相对 baseline 的报价距离，是否产生可预测的 lifecycle fill 差异，以及这种差异是否有带符号的完整经济价值？

修订之所以必要，是因为 fill 的风险起点、cancel request 的政策时钟、ACK race、pending fill、common-support clock 与 terminal attribution 不能被一张静态概率表替代。每一次修正都在补齐同一条因果链，而不是制造一个新的策略想法。

active-order KEEP/REPLACE 不属于 F06 placement estimand。placement 从新订单 submit 开始，queue 在 activation 时重置；KEEP 从一个已经 active 的订单开始并保留 queue priority。两者的风险起点和动作语义不同，后者属于 F07。

### 2. 最初的陷阱：独立策略世界制造了假的一 tick 反转

早期 fixed-spread replay 在每个距离上运行一个独立策略世界。一档距离发生 fill 后，会改变 inventory、cooldown、后续 quote decision 与分母；另一个距离的路径则继续不同发展。这样比较出来的“fill probability”不再是同一决策上的 placement contrast。

旧 matcher 还把 strictly-through trade 错当成 exact-price trade，只消费当前打印数量。结果出现了违反被动订单几何的现象：更深价位 fill，而相应更浅价位没有 fill。

正确配对合同让同一 side-decision 创建一个 cohort。cohort 内各距离共享：

- decision timestamp；
- sampled new-order latency；
- activation-time Post-Only book；
- TTL 与 cancel-request schedule；
- cancel-ACK latency；
- order size；
- 完全相同的未来交易与盘口路径。

counterfactual fills 不反馈到 baseline inventory，也不改变下一次 baseline quote。这样可以逐 cohort 检查：

$$
\mathbf 1\{F(d_{shallower})=1\}
\ge
\mathbf 1\{F(d_{deeper})=1\}.
$$

修复后的 25-distance paired diagnostic 在 62 个 formal 日上没有 pathwise 或 aggregate monotonicity violation。纠正后的 0 到 1 tick lifecycle fill probability 为：

| Side | current | farther 1 tick | 变化 |
|---|---:|---:|---:|
| BUY | 51.08% | 48.66% | -2.41 percentage points |
| SELL | 50.18% | 48.96% | -1.22 percentage points |

旧的“一 tick 更深反而更容易成交”因此被撤回。条件量 $\Pr(F\mid touch)$ 仍可能随距离上升，因为更深价位的 touch 本身选择了更强的市场路径；它不能替代无条件 fill probability。

### 3. Placement fill estimand：activation、fill 与 cancel ACK 必须在一个生命周期里

对新 placement action $a$，完整目标是：

$$
P_F^\pi(a,t\mid x_0)
=
\Pr\left(
T_{fill}\le t,\
T_{fill}<T_{cancelACK}^{\pi}
\mid do(a),x_0
\right).
$$

action-specific GTX activation 也必须进入：

$$
P_F^\pi(a,t\mid x_0)
=
\Pr(A_a\mid do(a),x_0)
\Pr\left(
T_{fill}\le t,\
T_{fill}<T_{cancelACK}^{\pi}
\mid A_a,do(a),x_0
\right).
$$

研究把 exact-price queue fill 与 strictly-through fill 作为 mechanism decomposition。总 fill CIF 是两者 cause-specific cumulative incidence 之和，但“fill given active touch”不被称作 queue conversion，因为它混合 exact queue depletion、later-through 与 strictly-through 选择。

初始 direct CIF 在 40 个 Development 日上产生 664,335 个 placement cohorts。动作是 closer 1 tick、current 与 farther 1 tick，报告切片为 1s、5s、10s。所有 18 个 side × role × horizon cells 的 Brier improvement lower bound 都为正，ranking lift 也存在；但 absolute calibration gate 18/18 失败。

这说明模型能排序，却还不能把绝对 probability 当作 quote value 输入。

### 4. 从固定 horizon 到 full curve

订单没有一个天然统一的 1s、5s 或 10s 寿命。baseline policy 可能在不同状态下提前 request cancel，ACK latency 又使订单在 request 后继续短暂可成交。

full-curve identity 改为 100ms grid 上的 cause-specific hazards：

$$
S_j
=
S_{j-1}
\left(
1-h_j^{fill}-h_j^{cancelACK}
\right),
$$

$$
F_j^{fill}
=
F_{j-1}^{fill}
+
S_{j-1}h_j^{fill},
$$

$$
F_j^{cancel}
=
F_{j-1}^{cancel}
+
S_{j-1}h_j^{cancelACK}.
$$

三者必须满足：

$$
S_j+F_j^{fill}+F_j^{cancel}=1.
$$

50 日 Development panel 包含 831,635 cohorts、2,494,905 action lifecycles 与 7,202,322 chronological OOF rows。曲线训练到 Development p99 support 的 34.5 秒；经验 p25/p50/p75 的 5.010s、5.816s、7.900s 只是报告点，不是三个新 estimands。

full-curve fill ranking 与 proper score 较稳定，但 cancel-ACK CIF 暴露了系统性 calibration drift。对 opener 与 reducing roles，cancel mass 经常被低估。静态 side offset、role-aware trailing calibration 与 inner-OOF Platt maps 都没有稳定修复；最严格的 nested role calibration 甚至让六条 cancel curves 全部明显低估。

这不是“模型调参不够”，而是在提醒：baseline cancel request 很大程度上是已知 policy stopping rule，不应被当成一个从 placement 起持续存在的平稳自然 hazard。

### 5. Policy clock：cancel request 是动作，ACK 才是 exchange terminal race

cancel request time 的正确表示是：

$$
T_{request}
=
\inf\{t:\pi(\mathcal H_t)=\text{cancel}\}.
$$

随后：

$$
T_{cancelACK}
=
T_{request}+L_{ACK}.
$$

订单在 $[T_{request},T_{cancelACK})$ 仍可能 partial 或 full fill。因此 F06 把 lifecycle 分成：

1. activation 后、request 前的 pre-request fill process；
2. baseline policy 决定的 request clock；
3. request-time causal state 条件下的 ACK survival；
4. pending interval 内 fill-before-ACK 的稀有 competing cause。

policy-clock Development 在 40 日、664,335 个 current-placement lifecycles 上实现 exact request parity。625,845 个 cancel requests 与 625,619 个 ACK 保持时间与 reason identity；198 个 pending-cancel fills 被保留，而不是在 request 时错误终止风险集。

request-to-ACK latency 的 p25/p50/p75 为 6/7/9ms。这个极短 race 解释了为什么 pending fill 是稀有 cause，也解释了为何一个复杂 pending-fill ML head 很难获得独立 proper-score gain。

### 6. Request-state race：哪些组件真的学到了东西

三阶段 request-state Development panel 扩大到 50 日、800,853 placement cohorts 与 2,402,559 action rows。六个 expanding folds 产生 29 个 OOF 日。

结果不是“整条链都失败”：

| Component | BUY roles | SELL roles | 结果 |
|---|---:|---:|---|
| pre-request fill | 3/3 | 3/3 | support、Brier、absolute calibration 全过 |
| conditional cancel ACK | 3/3 | 3/3 | 全过 |
| pending fill before ACK | 0/3 | 0/3 | 无 role 有正 Brier lower bound |
| joint pending fill/ACK/no-event | 3/3 | 3/3 | proper score 过，但由 ACK 主导 |

pending head 在最大 9ms 报告点的 events 很少，例如 BUY add 23、SELL add 7。没有一个 pending-fill curve 相对 exposure-only baseline 建立正 Brier lower bound。

这促使后续把 pending fill 当作 past-only empirical nuisance，而不是强行训练更灵活的模型。fresh-book SELL states 随后又暴露 posterior-predictive undercoverage；加入预冻结 fresh-book hierarchy 修复 coverage 后，经济 uncertainty 仍然过大。

这条链显示了一个常被忽略的区别：一个 nuisance 可以足以完成概率记账，却未必精确到能分辨每笔 $10^{-4}$ USDC 量级的动作差异。

### 7. Common support 与共同预测时钟

paired actions 要比较距离单调性，必须在相同 exposure clock 上积分：

$$
F_{closer}(H)
\ge
F_{current}(H)
\ge
F_{farther}(H).
$$

如果 closer action 因为早 fill 而只积分到 fill time，farther action 因为存活而积分到更晚 request time，那么即使 hazard 对距离严格单调，三个 CIF 在不同 $H_a$ 上也可能看起来反转。

ordered common-support v1 正是在这里失败。模型训练时对 distance 加了 decreasing monotone constraint，但 evaluator 使用了 action-specific realized exposure。1,042 个 apparent violations 全部来自不相同的 clocks；399 个 affected cohorts 的 clock spread 中位数约 3.7 秒。

这被分类为 implementation-contract failure，不是市场机制的非单调证据。结果没有用 post-outcome isotonic projection 修饰，也没有在读过结果后重跑成“通过”。

同时，该 identity 还失败于：

- activation absolute calibration 仅 11/18 cells 通过；
- all-three support calibration 仅 9/18；
- pending-fill economic uncertainty 0/36 cells 低于冻结预算。

因此下一步没有继续堆一个 ordered model，而是先问原始 paired paths 到底能分辨多大的 action gap。

### 8. 原始动作分辨率：一 tick 太细，两 tick与四 tick可见

paired action-resolution audit 不训练模型。每个 cohort 展开七个价格：

$$
\{-4,-2,-1,0,+1,+2,+4\}\text{ ticks relative to current},
$$

其中负号表示 closer，正号表示 farther。所有 actions 共享同一 market path、baseline lifecycle、latency identity，以及 activation 后 5,000ms 的共同工程时钟。

50 日 Development replay 提交 800,853 cohorts，800,692 个七臂全部 activation，rate 为 99.9799%。冻结三价位 parity 的 2,402,559 rows 在 activation、first-fill timestamp 与 filled quantity 上零 mismatch。

原始 fill difference 的 simultaneous 结果：

| 距离比较 | 正 lower bound cells |
|---|---:|
| closer 1 vs current | 0/6 |
| current vs farther 1 | 0/6 |
| closer 1 vs farther 1，总跨度 2 ticks | 6/6 |
| 单侧 2 ticks | 12/12 |
| 单侧 4 ticks | 12/12 |

单侧一 tick 的平均 probability increment 约 0.00049–0.00056，但所有同时区间跨零；两 tick 约 0.00099–0.00104，四 tick 约 0.00200–0.00203，正式 cells 均可识别。

这说明 ordered model 近乎零的一 tick 输出不完全是模型 defect；原始日期聚类数据本身就没有足够 resolution。

### 9. Fill difference 不是 action value

对 deeper 与 shallower 报价，最终价值 audit 分解为：

$$
\Delta V_{deep-shallow}
=
V_{\text{shared-fill price improvement}}
-
V_{\text{shallower-only marginal fills}}
-
\Delta C_{\text{campaign/pending}}.
$$

shared fills 在 deeper 价位成交能获得确定性的 execution price improvement；shallower-only fills 则是靠近市场才多出来的边际成交，其后续 value 可能正也可能负。

早期 conservative audit 用 100bps stress envelope 包围未知 marginal-fill value。即使最宽对比，deterministic shared-fill improvement 也只有约 $3.284\times10^{-5}$ USDC/decision，小于当时 pending uncertainty 的九分之一。54 个 economic cells 中 0 个区间单侧。

最终 marginal-value identity 不再用粗 100bps absolute envelope，而是直接绑定同路径 marginal fills 的 quantity-weighted 1s、5s、30s 与 campaign-terminal overlay，并使用 paired pending differential。

主指标是：

$$
\text{campaign-terminal overlay delta USDC/decision}.
$$

它仍是 no-policy-feedback feasibility estimand，不是完整 randomized strategy value；但比固定 markout 更接近真正问题。

![从配对 placement 到边际终局价值的反事实桥梁](/images/narrowgate/f06-placement-counterfactual-bridge.svg)

*图 2：近、中、远三张虚拟订单共享同一条未来市场路径，各自保留 activation、fill 与 cancel-ACK 生命周期。共同风险集先识别 fill CIF 差异，再把 shared fills 的价差收益与 shallower-only marginal fills 的终局价值合并。*

#### 9.1 为什么 pathwise pairing 比“分别跑三次策略”更强

设 $U_i$ 表示第 $i$ 个决策以后所有共同的市场事件、延迟抽样与撮合随机性。正确的局部 placement 对比是：

$$
Y_i(a)-Y_i(a_0)
=
g(a,U_i)-g(a_0,U_i).
$$

两臂共享同一个 $U_i$，市场路径噪声在差分中大量抵消。若分别运行两套策略，则实际比较变成 $g(a,U_i^{(a)},S_i^{(a)})$ 与 $g(a_0,U_i^{(0)},S_i^{(0)})$；早先某次 fill 已经改变库存和未来报价，后面的 decision denominator 也不再相同。那种差值混合了 placement effect、policy feedback 与样本选择。

F06 的 cohort replay 刻意不让 counterfactual fills 反馈到 baseline，换取干净的局部识别。代价是它不能宣称完整策略价值。这个取舍不是缺陷，而是研究阶段：先确认 matcher、概率和边际事件，再决定是否值得支付全路径顺序回放的成本。

#### 9.2 一个两 tick 对比的完整算例

假设 BUY current 为 100.00，farther 2 ticks 为 99.98，订单量为 $z$。同一行情路径可能产生三类 cohort：

| 事件类型 | current | farther 2 | 对价值差的贡献 |
|---|---|---|---|
| shared fill | 两者都成交 | 两者都成交 | farther 每单位改善 0.02，但可能更晚成交 |
| current-only marginal fill | 成交 | 不成交 | 贡献该 fill 的完整后续 terminal value |
| shared no-fill | 不成交 | 不成交 | 局部 placement delta 近似为零 |

若 shared-fill 比例为 $p_s$，current-only 比例为 $p_m$，忽略示意中未写出的成本，则：

$$
\Delta V_{farther-current}
\approx
p_s\cdot z\cdot 0.02
-
p_m\cdot\mathbb E[V_{marginal}].
$$

第一项容易精确计算，第二项决定符号。如果 marginal fills 都很有毒，移远值得；如果它们多数帮助库存修复，移远反而有害。F06 识别了 $p_m>0$，却没有把 $\mathbb E[V_{marginal}]$ 的 terminal 贡献估到足够窄。这正是“成交概率通过、价值失败”的数学位置。

#### 9.3 一 tick不可识别是一条工程尺度结论

一 tick 的 effect 小，并不等于永远为零。它说明在当前 tick size、订单量、日间相关、TTL/cancel policy 和 50 日 Development 路径下，单侧一 tick的原始 probability increment 约为五个万分点，低于同时推断能稳定分辨的尺度。

这对工程设计有直接含义：如果执行层允许连续扫描大量相邻 tick，并用同一批数据选 winner，就会在 resolution 以下追逐噪声。两 tick与四 tick的 mechanics effect 可见，才适合作为正式 value contrast；一 tick保留为 negative control，可以检验模型是否凭空放大一个原始数据并不支持的微小差异。

#### 9.4 从 feasibility 到 full-path policy 还缺哪一座桥

若某个 cell 的 overlay value 真正通过，下一步仍应重新运行完整两臂策略：target decision 之后让 fill 反馈库存、角色、cooldown、reprice 与 campaign birth/death，直到共同 terminal。此时 estimand 才是：

$$
\tau^{policy}(a)
=
\mathbb E[E_T^{\pi(a)}-E_T^{\pi(a_0)}].
$$

full-path 还要报告 action rate、fills retained、inventory-time、campaign duration、terminal left tail 和跨日方向，而不能只报告每 decision 的平均值。F06 在更便宜的 feasibility 层已经 0/24，因此没有理由打开这项更昂贵的 successor；这是一种预先承诺的停止规则，不是因为没有能力继续算。

### 10. 最终 Development 结果

最终 replay 形成 6,882,642 contrast rows。每个正式 cell 的 shallower-only marginal fills 为 40–740 笔，占决策的约 0.068%–0.365%。

24 个正式两 tick与四 tick side-role-contrast cells 的结果：

| Gate | 通过 |
|---|---:|
| terminal-value 单侧区间超过 0.0001 USDC/decision | 0/24 |
| campaign attribution coverage 至少 95% | 0/24 |
| 至少 30 支持日 | 24/24 |
| daily direction stability | 0/24 |
| differential pending uncertainty 小于 economic LCB | 0/24 |
| campaign tail non-worsening | 0/24 |
| 完整 feasibility contract | 0/24 |

一 tick negative control 也是 0/12。

campaign-terminal point estimates 的范围是：

$$
-1.64994\times10^{-5}
\quad\text{到}\quad
+2.28411\times10^{-5}
\ \text{USDC/decision}.
$$

所有 simultaneous intervals 跨零。最小 lower endpoint 约 $-5.42665\times10^{-5}$，最大 lower endpoint 仍为负，约 $-1.49260\times10^{-5}$。即使最大正点估计也低于 $10^{-4}$ 经济预算。

paired pending analysis 把 uncertainty radius 收窄到约 $1.00191\times10^{-5}$ USDC/decision，证明旧 absolute pending envelope 不是唯一 blocker；primary terminal-value lower bound 本身仍然全部跨零。

campaign attribution coverage 只有 71.40%–94.88%，没有 cell 达到冻结的 95%。即使假设 coverage 完美，0/24 terminal intervals 单侧的结果也不会因此变成 positive action evidence。

### 11. 短 horizon hint 为什么不能救 terminal estimand

某些四 tick cells 在 30s markout slice 上出现正区间。最接近候选的是 SELL add、current vs farther 4 ticks：30s total interval 约为

$$
[1.29\times10^{-7},3.16\times10^{-5}]
\ \text{USDC/decision}.
$$

但同一 cell 的 campaign-terminal interval 是：

$$
[-3.64\times10^{-5},+3.91\times10^{-5}].
$$

30s 是 mechanism slice，不是自然终点。更浅报价多接到的 fills 可能在 30 秒内看起来好，却通过后续 inventory 与 campaign continuation 抵消。读过 terminal 结果后把 primary estimand 改成 30s，会是 outcome-driven rescue。

### 12. 最终边界与没有获得的权限

F06 最终状态是：

$$
\text{closed placement distance value unidentified}.
$$

支持的事实：

- paired execution geometry 修复后严格有序；
- 距离增加会降低无条件 fill probability；
- 一 tick 太细，两 tick与四 tick raw fill differences 可识别；
- pre-request fill 与 conditional ACK 某些模型组件有 Development prediction value。

不支持的事实：

- 没有 side-role-distance cell 建立 signed terminal value；
- 没有 action candidate；
- 没有证明 farther 或 closer policy 更好；
- 没有 Value、randomized action、shadow 或 live 权限。

Validation 与 sealed holdout 没有用于救这个 Development chain。重开需要外生改变，例如 tick/lot/fee 合同变化、不同的 queue-preserving action、独立 policy-feedback counterfactual 或市场结构迁移；再换 calibration、再加日期、重画 horizon 或降低 uncertainty budget 都不构成新问题。

### 13. 公共证据

- [F06 Placement Fill CIF README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/README.md)
- [Paired Fixed-Spread Monotonic Replay v2](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/paired_fixed_spread_monotonic_v2_20260726.md)
- [Placement Fill CIF v1 Development Evidence](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/placement_fill_cif_v1_development_20260726.md)
- [Placement Fill Full-Curve CIF v3](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/placement_fill_full_curve_cif_v3_development_20260727.md)
- [Placement Fill Request-State Race v2](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/placement_fill_request_state_race_v2_development_20260728.md)
- [Ordered Common-Support Fill Surface v1](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/ordered_common_support_fill_surface_v1_development_20260728.md)
- [Paired Action Resolution Feasibility v1](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/paired_action_resolution_feasibility_v1_development_20260728.md)
- [Placement Marginal Fill Value Feasibility v1](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/placement_marginal_fill_value_feasibility_v1_development_20260729.md)

公开仓库不分发原始市场数据、owner-side model bundles 或 OOF parquet。本文数字来自公共 Development 报告的聚合投影；精确复现需要报告绑定的 immutable artifacts。

## 4. Queue-value KEEP/CANCEL

### TL;DR：撤单确实删除了大量成交，但没有优先删除有毒成交，最终动作价值为负或不确定

active maker order 同时暴露在 adverse fill 风险中，也拥有已积累的 queue priority。看到危险状态后撤单，可能避开坏成交，也可能把排队期权一起丢掉。

F07 因此研究一个直接动作：

- **K0 KEEP**：保留 active order 与当前 queue position；
- **K1 CANCEL/RE-ENTER**：请求撤单，等待真实 cancel ACK 与冻结的状态退出条件，再把第一个 baseline-authorized re-entry order 绑定回同一次 intervention。

整个项目经历了 top-20 queue approximation、deep-book audit、strategy-independent native scheduler、native keep/cancel、explicit net-hazard value 与 corrected dynamic fill risk set。它们都是同一个 KEEP/CANCEL 项目的证据链，不是六篇独立文章。

结论很一致。旧 top-20 结果不能解释 exact active-price queue；native queue identity 修复后，严格 support 又低于冻结门，方向性 ITT 区间跨零；最后的 net-hazard action 在 17 个 Development 日上只保留 7.67% intervention fills，却以几乎相同比例删除 toxic fills，pooled reward 为 $-0.01448$ USDC/intervention，95% 日期区间 $[-0.02577,-0.00239]$。BUY 显著有害，SELL 没有正证据。

后续 dynamic-fill M0 修正了风险集，adverse-fill heads 表现很好，但 favorable-fill heads 没有相对基线获得正 Brier skill。没有 favorable queue option value，就不能只拿 adverse head 注册另一个撤单动作。

所以项目证明的是：**state prediction quality 不等于 action uplift；广泛减少成交也不等于有选择地避开毒性。** Validation、sealed holdout、live action 与 baseline 变更都没有得到授权。

本文是历史 Development 研究复盘，不构成交易建议。图中 K 线、订单和 queue 均为合成机制示意。

![Active-order KEEP 与 CANCEL/RE-ENTER 的 K 线生命周期双路径](/images/narrowgate/active-order-keep-cancel-kline.svg)

*图 1：K0 保留 queue position，K1 经 cancel request、ACK、state exit 后 fresh re-entry。两条路径面对相同市场，但订单生命周期、fill 与后续 campaign 可能分叉。*

### 1. 为什么 active order 不是 placement order

placement action 在 submit 前选择价格，activation 后从新的 queue position 开始。active-order continuation 的风险起点已经晚了一步：订单已在交易所 active，可能排在同价位队列的某个位置，也已经经历了一段市场与 refill path。

因此 KEEP 的价值包含一项不能忽略的 queue option：

$$
V_{keep}(x)
=
V_{\text{favorable fill}}
-
V_{\text{adverse fill}}
-
V_{\text{adverse jump}}
+
V_{\text{existing queue priority}}.
$$

CANCEL/RE-ENTER 的价值则包含：

$$
V_{cancel}(x)
=
V_{\text{avoided adverse exposure}}
+
V_{\text{fresh re-entry option}}
-
C_{\text{lost queue}}
-
C_{\text{cancel/ACK/GTX latency}}.
$$

真正需要判断的是：

$$
\Delta V(x)
=
V_{cancel}(x)-V_{keep}(x).
$$

只预测“未来价格可能不利”不够。如果订单同时有很高的 favorable fill option，撤单会把两者一起删除。

### 2. 冻结动作与 campaign attribution

每个 inventory campaign 最多干预一次。eligibility 是第一个 baseline-eligible、active、exposure-increasing order 进入冻结 adverse 或 negative-value state 的时刻。

K0 不发送研究动作，继续 baseline lifecycle。K1 的完整状态机是：

1. 对原 active order 发送 cancel request；
2. 原订单在 ACK 前仍然可以 fill；
3. 收到真实 cancel ACK 后，继续等待冻结 state exit；
4. baseline eligibility 恢复后，第一个 re-entry submit 继承 intervention identity；
5. re-entry activation、GTX、queue reset、fill 与后续 terminal 都归同一动作；
6. 若 campaign 在 re-entry 前 flatten，intervention 自然结束。

behavior probability 冻结为：

$$
\Pr(K0)=\Pr(K1)=0.5.
$$

reward 使用 campaign-level accounting：

$$
R_i
=
\text{fill value}_i
-
\text{incremental campaign cost}_i
-
\text{queue-reset cost}_i.
$$

terminal MTM、MAE、campaign duration、inventory time 与 tail 是并列报告项。不能把同一个 campaign terminal PnL 复制到多个 decision rows，也不能在 maker-signed fill value 已从 execution price 起算后再加一次 half-spread。

![KEEP 与 CANCEL/RE-ENTER 的竞争风险路径](/images/narrowgate/f07-active-order-competing-risks-path.svg)

*图 2：KEEP 延续旧 queue option；CANCEL 先进入仍可成交的 pending race，ACK 后才退出，满足状态退出与 baseline permission 后才以 fresh queue re-enter。动作价值必须覆盖整条路径，不能在 cancel request 处截断。*

#### 2.1 CANCEL 不是一个瞬时二元开关

在简化表格里，K0/K1 看似一个 0/1 treatment；在交易所生命周期里，K1 是一个持续状态机。若请求在 $t_c$ 发出、ACK 在 $t_a$ 到达、重新激活在 $t_r$，则三个区间的风险不同：

$$
[t_0,t_c):\text{old queue active},
$$

$$
[t_c,t_a):\text{cancel pending but still fillable},
$$

$$
[t_a,t_r):\text{no old-order exchange exposure}.
$$

$t_r$ 以后 candidate 以 fresh queue 回到市场。若在 $[t_c,t_a)$ 成交，不能把它记作“撤单已经避开的 fill”；若 baseline permission 从未恢复，也不能人为制造 re-entry。任何一个简化都会系统性偏袒 K1。

#### 2.2 Queue option value 的经济分解

旧订单排队优先权可以看成一项状态依赖期权。粗略地：

$$
V_{keep}(x)
=
p_f(x)\,v_f(x)
+p_a(x)\,v_a(x)
+p_c(x)\,v_c(x),
$$

其中 favorable fill value $v_f>0$，adverse fill value $v_a<0$，而自然 cancel/replace 的价值 $v_c$ 还包括未来机会。CANCEL 同时改变三组概率，并增加 ACK delay、无报价区间和 fresh-queue cost：

$$
V_{cancel}(x)
=
V_{pending}(x)-C_{gap}(x)-C_{reset}(x)+V_{reentry}(x).
$$

只估 $p_a$ 会把 $p_fv_f$ 设成不可见的零。后续 dynamic-fill 结果正说明这不是无害近似：adverse heads 可预测，但 favorable heads 没有建立可用于净值计算的增量 skill。缺一半期权价值时，撤单阈值没有经济单位。

#### 2.3 一条合成路径为何会让“预测正确、动作错误”

设一张 active BUY 已排在同价位前列，状态模型正确预测未来一秒下跌概率升高。K1 发起撤单，但 ACK 前 aggressive SELL 仍打到该价，candidate 与 KEEP 都成交；这时动作没有删除 adverse fill，却可能额外产生控制与重挂成本。

另一条路径里 ACK 先到，价格短暂下跌后反弹。KEEP 本可在低价成交并由后续 SELL 修复；K1 避开了这笔在短 markout 上看似“危险”、但 terminal 上有利的 fill，重新进入时又失去 queue priority。风险预测方向完全正确，动作价值仍然为负。

所以研究要求 selectivity：candidate 删除 adverse fills 的速度必须显著快于删除全部 fills。若两者同速，机制只是 participation suppression，而不是 toxicity selection。

### 3. 两套时钟：策略看到什么，交易所先发生什么

F07 的核心不是“用更深 L2 就好”，而是保持两条因果时钟：

| 数据流 | 时钟 | 作用 |
|---|---|---|
| policy-visible BBO/top-20 L2 | 冻结的 feature-ready 延迟 | quote feature、state、entry/exit decision |
| native snapshot/delta 与 individual trades | exchange transaction time | exact active-price queue、fill、cancel/refill mechanics |

native state 不能因为策略恰好查询了某个价位才被构建。strategy-independent scheduler 必须解析完整 snapshot/delta stream，维护所有公开价位，然后让任意 active order 在 activation 时查询对应 price level。

activation at $t$ 只能使用严格早于 $t$ 的 native state：

$$
Q_{seed}(t)
=
Q_{book}(t^-).
$$

若 trade、book update、activation 或 cancel ACK 在同一毫秒发生，但没有共享 sequence key，就不能发明有利顺序。该 order path 必须标为 ambiguous 或 censored。known-zero price level 与 outside-snapshot-range 也必须区分；两者都显示为“当前没有正 quantity”，但只有前者是精确零队列证据。

exchange-time native queue 可以支持历史 mechanics，却不自动证明部署环境的 receive-time transport。由于 KEEP/CANCEL 在 Development 已经失败，研究没有用额外 live evidence 去救这个动作。

### 4. 第一阶段：top-20 queue state 能预测，但动作没有正下界

最初的 queue-value v1 用 100ms reconstructed L2、individual trades、queue/campaign state 与 empirical microprice。side-specific local hazard 与 first-hit direction models 相对 constant null 有改进。

56 个 Development 日上，每个 campaign 最多一次 50/50 intervention，共 3,263 campaigns：

| Side | K0 | K1 |
|---|---:|---:|
| BUY | 981 | 961 |
| SELL | 649 | 672 |
| Pooled | 1,630 | 1,633 |

K1 明确改变机制：direct intervention-fill probability 相对 K0 pooled 下降 0.460，BUY 下降 0.475，SELL 下降 0.439。

但是 direct doubly robust contrast 的区间全部跨零：

| Scope | Reward uplift | 95% day interval | 正日 |
|---|---:|---:|---:|
| Pooled | +0.01314 | [-0.03131, +0.06600] | 15/25 |
| BUY | +0.01192 | [-0.03662, +0.06733] | 10/25 |
| SELL | +0.01814 | [-0.05531, +0.11091] | 13/25 |

overlap 并不是 blocker：两 arms 都有充分 ESS、unsupported mass 为零、最大 weight 为 2。失败来自负 lower bound、弱 day sign 与极端 tail 分母不足。

SPIBB 对每个 state 要求 K0/K1 各至少 100 rows、K1 ESS 至少 100、direct-uplift lower bound 大于零。BUY 与 SELL 各 8 个 states，接受数都是 0，policy 全部 fallback KEEP。

### 5. Cancel/re-enter repair：生命周期补全了，价值仍然不支持

后续 audit 发现旧 re-entry attribution 不完整：早期实现曾遗漏 re-entry fills、没有把 first re-entry order 绑定 intervention，并存在向过去日期应用未来 fit bundle 的风险。

corrected action 等待真实 ACK，然后由 ordinary baseline eligibility 控制 re-entry。25 个 action Development 日形成 909 interventions：454 K0、455 K1。445 个 K1 campaign 成功 submit re-entry，另 10 个在 re-entry 前 flatten；没有 re-entry 早于原订单 cancel ACK。

raw means 看起来有改善：K1 的 mean terminal MTM 从 $-0.07755$ 到 $-0.06646$，median campaign duration 从 530.2s 降至 427.8s。但 chronological DR 才是正式 contrast：

$$
\widehat{\Delta R}=+0.00443
\quad
95\%\ CI=[-0.04567,+0.04516]
\ \text{USDC}.
$$

daily positive rate 只有 44.4%，低于冻结要求。完整 randomized strategy path 的 aggregate PnL 还比 control 低 8.62 USDC，25 日中只有 9 日改善。

这些数字没有 action authority；更重要的是，下一阶段发现当时的 top-20 queue input 根本不能解释 active price 的真实 queue。

### 6. Deep queue audit：旧 K1 机制为什么不能被解释成 exact queue value

active quote 常常远离 BBO，top-20 container 不包含该价位。旧 replay 用 calibrated fallback 初始化 queue，看起来每个 order 都有一个数，却不代表那个数来自真实 active-price public depth。

代表性 full-day audit 把 retained top-20 与 native deep reconstruction 对比：

| Metric | retained top-20 | native deep |
|---|---:|---:|
| active-order rows | 19,378 | 19,042 |
| fills | 1,595 | 2,062 |
| campaigns | 669 | 895 |
| median initialized queue | 0.116182 BTC | 0 BTC |
| zero initialized queue | 0.083% | 54.732% |

只有两个 decision IDs 在两条策略轨迹中重合。queue seed 一变，fill、inventory、campaign 与后续 decision 全部改变；这不是“queue feature 稍有漂移”。

旧 panel 的 52 个 BUY-add entries 中，48 个 active prices 落在 deep range；其中 19 个有正 public quantity，29 个是 valid known-zero，只有 4 个 outside range。把 known-zero 当作 fitted positive queue 会系统性夸大 queue ahead。

watch-specific sparse tape 随策略轨迹变化，也没有达到 fixed point：改变 queue seed 会改变策略订单集合，下一代又出现新的 watched levels。项目没有一直迭代到一个“方便的稳定路径”，而是更换成 trajectory-independent native scheduler。

因此旧 top-20 数值被 supersede 用于机制解释，但其保守“不晋级”决定仍有效。

### 7. Strategy-independent native scheduler

新的 Historical Exchange Book Scheduler 直接消费 raw snapshot/delta tape：

- 每条 source message 都做 sequence audit；
- 完整 price-level map 独立于 strategy order；
- activation 查询 exact、known-zero 或 unknown；
- same-millisecond collision 显式 ambiguity；
- snapshot reset 使已 active counterfactual path invalid；
- native support 不参与 action eligibility 选择。

代表性 strict full-day replay有 18,868 active-order rows：7,912 exact、10,952 known-zero、4 unknown；214 rows 有 same-ms ambiguity，2 条 path 因 snapshot reset invalid。优化前后 strategy 与 queue output 保持一致，证明 scheduler 可以在不选择订单轨迹的情况下提供 exact-level state。

这只是 data/mechanics gate。它不能把旧 K1 threshold 自动升级成 native action identity，所以项目重新冻结了 native keep/cancel Development family。

### 8. Native KEEP/CANCEL：支持不足，方向性 ITT 仍不稳定

native family 使用 12 个 state-fit 日、1 日 embargo、5 个 calibration 日、1 日 transition embargo、17 个 action Development 日；后续 Validation 与 holdout 保持锁定。

17 日 randomized replay 有 1,448 campaigns：741 K0、707 K1。所有 K1 都收到 cancel ACK，328 个达到 state exit 并 submit 一个 linked re-entry，其中 18 个 fill。

严格 support gate 失败：

| Gate | 观察 | 要求 |
|---|---:|---:|
| activation support | 1,386 / 1,448 = 95.718% | 98% |
| complete native outcome support | 1,301 / 1,448 = 89.848% | 98% |

unsupported outcomes 是 action-dependent post-treatment state，不能简单删除后做 complete-case DR。用 $[-50,50]$ USDC reward bounds 得到 pooled Manski interval 约：

$$
[-10.0183,+10.0275]
\ \text{USDC/intervention}.
$$

全 rows mixed-simulator ITT 只能作为 direction diagnostic：

$$
+0.00556,
\qquad
95\%\ CI=[-0.00585,+0.01745].
$$

BUY 点估计为负，SELL 为正，但两侧区间都跨零。K1 把 intervention fills 降低约 40.9 percentage points；paired daily trajectory 的 PnL 只改善 1.4769 USDC，17 日中 8 日好、9 日差。

因此 exact native queue 修复没有让这个 coarse cancel-until-state-exit action 获得支持。

### 9. Net-hazard value：从手调阈值转向显式订单价值

下一阶段不再调 adverse-state cutoff，而是分别拟合 active exposure-increasing order 的 cause hazards：

- favorable fill；
- adverse fill；
- cancel；
- adverse price jump；
- campaign repair；
- queue recovery transition。

entry state 由显式差值决定：

$$
D(x)
=
V_{keep}(x)-V_{cancel/reenter}(x).
$$

阈值来自 calibration quantiles，目标 candidate rate 为 15%，允许预算 5%–30%。BUY 与 SELL 分开；reducing quotes、size、inventory limit 与 external state 不变。

17 个 Development 日形成 1,101 interventions：563 keep、538 cancel；eligible campaign rate 17.10%，mechanics 触发充分。

### 10. Selectivity：删除 92% 成交，却没有更快删除 toxic fills

防守动作可以减少成交，但必须证明损失下降快于 activity。定义：

$$
r_F
=
1-\frac{F_1}{F_0},
\qquad
r_T
=
1-\frac{T_1}{T_0},
$$

以及 reduction surplus：

$$
S_T=r_T-r_F.
$$

若 $S_T>0$，toxic fills 被删除得更快；若接近零，动作只是广泛 shutdown。

Development 结果：

| Metric | 点估计 | 95% UTC-day interval |
|---|---:|---:|
| intervention fill retention | 7.67% | [4.07%, 12.22%] |
| toxic fill retention | 8.29% | [3.89%, 13.97%] |
| toxic reduction | 91.71% | [86.03%, 96.11%] |
| all-fill reduction | 92.33% | [87.78%, 95.93%] |
| reduction surplus $S_T$ | -0.0061 | [-0.0326, +0.0222] |

toxic fills 反而比全部 fills 保留得稍多。这个 action 没有成为 selective toxicity filter，而是把有利与不利 queue option 一起删除。

#### 10.1 用比率看 selectivity，为什么仍需看绝对价值

也可定义保留率 $r_{all}=N_{fill}^{K1}/N_{fill}^{K0}$，毒性保留率 $r_{toxic}=N_{toxic}^{K1}/N_{toxic}^{K0}$。理想 guard 至少需要 $r_{toxic}<r_{all}$，而且差异在日期聚类下稳定。这里二者几乎同速下降，说明 action 没有优先筛掉毒性。

但即使 $r_{toxic}<r_{all}$，也还不够。被删除的少量 favorable fills 可能单位价值很高，或 no-quote gap 可能扩大 inventory tail。因此 selectivity 是机制门，terminal reward 是经济门；两者必须同时通过，不能让比率替代 USDC。

#### 10.2 为什么 BUY 与 SELL 必须分开

同样的 CANCEL 动作对 BUY add 与 SELL add 会沿不同库存方向作用。BUY cancel 可能减少加多，也可能延迟对既有空头的修复；SELL cancel 则相反。市场趋势和当前 campaign role 会使 pooled mean 出现抵消。

F07 的 BUY 结果显著有害、SELL 不确定，因此 pooled 数值不能解释为“一半有效”。它意味着至少一个预注册主侧已经产生方向性反证，而另一侧没有建立正证据。除非新项目事先定义不同 side-specific action，否则不能在结果后只保留看起来较好的侧。

### 11. Net-hazard randomized ITT：BUY 显著有害

primary all-row ITT 为：

| Scope | K1 − K0 reward，USDC/intervention | 95% UTC-day interval | 正日 |
|---|---:|---:|---:|
| Pooled | -0.01448 | [-0.02577, -0.00239] | 4/17 |
| BUY | -0.02310 | [-0.04377, -0.00449] | 5/17 |
| SELL | -0.00347 | [-0.02352, +0.01550] | 6/16 |

BUY 的区间完全低于零；SELL 没有正支持。MAE 与 repair time 有所改善，但不能补偿负 action reward、失败的 selectivity 与缺失的严格 support。

完整 randomized path 曾显示小幅 aggregate PnL 改善，但只有 7/17 日为正。whole-path aggregate 包含 campaign birth/death 与 interference；它不能覆盖 common eligible population 上的注册 action ITT。

最终 scorecard 因 reward、selectivity、terminal protection 与 support failures 返回 diagnostic-only，ranking score 为空。

![KEEP CANCEL net-hazard 的成交选择效率与 reward 区间](/images/narrowgate/queue-value-selectivity-result.svg)

*图：candidate 只保留约 7.67% intervention fills，同时仍保留约 8.29% toxic fills；BUY 与 pooled reward 区间完全位于零以下。动作删掉的是 participation，而不是优先删掉毒性。*

### 12. Dynamic Fill Hazard：为什么不能只保留 adverse head

net-hazard 以后，F07 又纠正了预测 estimand：

- fill 是 dynamic discrete-time start/stop risk set；
- cancel request 是 policy action/censor，不是自然 terminal；
- native price jump 是 non-absorbing transition；
- campaign repair 在 inventory 非零且 reducing quote active 后 delayed entry；
- BUY/SELL 分开；
- 历史不可 live-reproduce 的 child-count 特征排除。

17 个 Development 日产生 3,057,751 fill-risk rows、291,695 orders；另有 1,469,566 repair rows 与 6,200 campaigns。四个 expanding folds 的结果：

| Side / Cause | OOF rows | Events | AP lift | ROC AUC | Brier skill | Result |
|---|---:|---:|---:|---:|---:|---|
| BUY adverse | 746,266 | 2,647 | 12.012 | 0.889 | +0.00285 | 通过 |
| BUY favorable | 746,266 | 886 | 7.226 | 0.831 | -0.00565 | 失败 |
| SELL adverse | 734,319 | 2,534 | 11.307 | 0.871 | +0.00106 | 通过 |
| SELL favorable | 734,319 | 968 | 9.173 | 0.828 | -0.00131 | 失败 |

favorable heads 有 ranking lift，却没有相对 exposure-only baseline 的正 proper-score gain。KEEP/CANCEL value 同时需要 adverse cost 与 favorable queue option；只保留成功 adverse head，会再次制造“能减少毒性，但更大比例丢掉好成交”的动作。

因此预先命名的 dynamic-fill randomized action 没有创建，DR、ESS、tail 与 selectivity 指标属于 not applicable，而不是零。

### 13. 项目最终边界

整个 Active-order Queue Value 项目的结论是：

- state 与 hazard models 能描述部分 queue/fill 风险；
- exact native queue 显著改变旧 top-20 路径，证明 input identity 很重要；
- KEEP/CANCEL treatment strength 很强，不是 no-op；
- 但各冻结动作没有正、稳定、side-specific 的 action uplift；
- 最严格 net-hazard K1 是 broad participation shutdown，BUY 显著有害；
- dynamic-fill prediction 又因 favorable heads 失败而没有注册动作。

没有获得的权限：

- Validation：未读；
- sealed holdout：未读；
- policy bundle：未晋级；
- live action、shadow、baseline update：未授权；
- external-market rescue：未运行。

未来研究若要重开，必须改变 action semantics，例如更好地保留 favorable queue option 或设计不同的 re-entry，而不是在已经消费的 Development 上调 entry/exit quantile。

### 14. 公共证据

- [F07 Active Order Continuation README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/README.md)
- [Queue-Value Keep/Cancel v1](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/docs/queue_value_keep_cancel_v1_20260719.md)
- [Queue-Value Cancel/Re-enter v3](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/docs/queue_value_cancel_reenter_v3_development_20260720.md)
- [Deep Active-Order Queue Probe](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/docs/deep_active_order_queue_probe_20260720.md)
- [Native Exchange-Book Replay Scheduler](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/docs/native_exchange_book_replay_scheduler_20260720.md)
- [Queue Value Net Hazard Keep/Cancel v2](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/docs/queue_value_net_hazard_keep_cancel_v2_20260722.md)
- [Dynamic Fill Hazard M0 v2](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/docs/dynamic_fill_hazard_m0_v2_20260723.md)

公开仓库提供方法、聚合结论与权限边界；精确 OOF、randomized rows、latency inputs 与机器 artifacts 不随仓库分发。

## 5. 100ms lifecycle CIF

### TL;DR：这项研究校准的是订单生命周期概率，不是撤单动作价值

一个 maker order 激活以后，不会只面对“十秒内成交或不成交”这一种二元结局。它可能先部分成交、继续保留剩余数量；可能收到撤单请求却仍在交易所风险集中；可能被拒绝撤单后重新回到 active；也可能最终被完整成交、收到 cancel ACK，或以其它受支持的交易所终局结束。若把这些事件压成互相独立的四个二元分类器，概率质量会重复；若把 cancel request 当作终局，风险集会过早消失；若把本地回放结束当作交易所终局，模型又会学到一个不存在的市场事件。

F07 Active-Order Lifecycle CIF 因此冻结了一个更窄、也更基础的问题：**对一段具有正 remaining quantity 的 active-order risk spell，在严格 100ms 因果可见网格上，如何联合估计 favorable fill、adverse fill、cancel ACK 与 other terminal 的 cumulative incidence，并让 Python 与 C++ 在每一个事件、每一条概率曲线和 checkpoint 恢复后保持锁步？**

完整研究链依次经过概率合同、journal 预检、双时钟、strict-native queue 资格、40 日 replay、event lockstep、CIF 训练与 native parity；这些都是同一 lifecycle-CIF 项目的完成门。

最终 Development mechanics 结果覆盖 40 日、2,712,262 个 lifecycle events 与 686,224 个 journal rows。665,831 个 exact-native eligible spells 贡献 5,172,921.02 秒风险暴露，另有 20,393 个 spells 因 native queue 证据不足而显式 censor。终局由 636,186 个 cancel ACK 与 29,645 个 full fill 构成；120 个 CIF cells 分布在 30 个 parent cells。Python/C++ event mismatch 为零，post-terminal hazard 或 queue reuse 为零，CIF 最大绝对差为 $1.1102230246251565\times10^{-16}$，checkpoint-resume 最大绝对差为零。

这证明了历史 replay 上的 lifecycle 与概率 mechanics 可以被确定性复现。它**没有**证明当前环境的 score calibration，没有比较 KEEP 与 CANCEL 的因果价值，没有读取 PnL、reward、markout、Validation 或 sealed holdout，也没有给予 q90 action、部署或 baseline 变更权限。

本文是历史 Development mechanics 复盘，不构成交易建议。图中的状态机是冻结合同的抽象图，右侧 CIF 曲线为合成概率示意，不是行情、实盘订单或经济结果。

![Active-order 生命周期状态机与 100ms 竞争风险 CIF](/images/narrowgate/active-order-lifecycle-cif-state-machine.svg)

*图 1：左侧严格区分风险阶段、非终局转移与交易所终局；右侧以联合归一化的 100ms hazard 更新 survival 和四条 cause-specific CIF。示意曲线只解释概率守恒，不代表任何实盘校准。*

### 1. 为什么 snapshot fill probability 不够

静态 fill classifier 常问：给定当前状态 $x_t$，订单在未来 $H$ 秒内是否成交？其目标可写成

$$
\Pr(T_{fill}\le H\mid x_t).
$$

这个问题适合排序，却无法完整描述 active order。第一，同一订单会随着时间进入不同 phase；在 cancel request 已发送、ACK 尚未可见时，它仍可能成交。第二，部分成交改变 remaining quantity 和 queue exposure，却不一定结束订单。第三，cancel ACK 与 fill 会竞争：一旦其中一个终局先发生，其它终局在这个 spell 上就不可能再发生。第四，模型若只预测“最终成交”，无法回答概率质量在 favorable、adverse、cancel 与其它终局之间如何分配。

因此 F07 的观测单位不是某一张快照，也不是整个 order_id 的一行摘要，而是 **remaining-quantity risk spell**。一个 spell 从 authoritative activation 或上一段 partial-fill 边界开始，只在 causal visibility 已经允许模型看到的 100ms edges 上累积风险。它在完整成交、cancel ACK 或其它受支持的交易所终局到来时停止；本地回放结束、缺失 exact-native queue path 等情况则保持为明确 censor，而不是伪造终局。

这个定义把两个常被混淆的问题拆开：CIF 负责回答“如果继续暴露，未来各类终局的联合概率如何累积”；action study 才负责回答“现在 KEEP 或 CANCEL 哪个终局价值更高”。前者是状态概率，后者是政策反事实。即使 CIF 完美，也不能在没有动作对照和经济标签的情况下越级得到 action uplift。

### 2. State machine：请求撤单不等于已经退出风险集

冻结状态机有三个风险阶段：ACTIVE、PARTIALLY_FILLED、CANCEL_PENDING；EXCHANGE_TERMINAL 是吸收态。概率 kernel 不自行猜测事件类型，所有 phase 与 terminal cause 都由上游 lifecycle adapter 按冻结语义给出。

ACTIVE 表示订单已经具备交易所 active 语义且 remaining quantity 为正。PARTIALLY_FILLED 表示订单发生了部分成交、仍有正余量；这一事件结束当前 remaining-quantity spell，并以新的 spell_id、相同的 last evaluated edge 和重置后的 survival/CIF 启动下一段 spell。这样，成交前的旧余量风险不会被错误继承到成交后的新余量。

CANCEL_PENDING 表示撤单请求已经成为策略可见事实，但 cancel ACK 尚未成为可见的交易所终局。这个阶段仍属于 fill-risk：订单在请求与 ACK 之间可能被成交。把 request timestamp 当作 terminal 会系统性漏掉 request/ACK race，并让高延迟区间看起来异常安全。

cancel reject 也不是终局。它把生命周期送回 ACTIVE 或 PARTIALLY_FILLED，继续使用同一个订单语义上的风险阶段。cancel ACK 才以 cause cancel_ack 终止当前风险集。full fill 使 remaining quantity 归零，并使用独立冻结的上游分类把它路由为 favorable_fill 或 adverse_fill。其它受支持的交易所终局进入 other_terminal；kernel 不得从 PnL、reward 或 markout 反推这些 cause。

partial fill 的边界尤其重要。若把它当作 complete fill，后续剩余量风险会被丢弃；若完全忽略它，模型又会把不同 remaining quantity、不同 queue state 的时间拼成一条虚假的长 spell。正确做法是“order 未终止，risk spell 重启”，同时保证 last edge 不倒退、不重复。

![Active order 的阶段转移与互斥终局](/images/narrowgate/f07-active-order-competing-risks-path.svg)

*图 2：partial fill 是 remaining-quantity spell 的重置点，不是整个订单终局；cancel request 只是进入 pending phase，ACK 才吸收。四种终局 cause 共享同一 survival mass。*

#### 2.1 为什么以 remaining quantity 为风险单位

假设订单初始数量为 0.003 BTC，在同一价格先成交 0.001，剩余 0.002。部分成交前后的风险不应简单相加：queue ahead 已改变，剩余量变小，订单 age 与行情状态也更新。若继续沿用旧 spell 的 survival，模型相当于假设“0.003 BTC 从未成交”；若把订单直接终止，又丢掉 0.002 BTC 的真实暴露。

因此在 partial fill edge 上，旧 spell 以事件边界结束，新 spell 从同一 causal edge、更新后的 remaining quantity 开始：

$$
q_{r}^{new}=q_r^{old}-q_{fill},
$$

$$
S_{new}(0)=1,\qquad F_{k,new}(0)=0.
$$

订单 identity 保留，spell identity 变化。这使概率解释保持明确：每条 CIF 都针对“当前这份剩余量从本段开始以后”的终局风险，而不是一个会在部分成交后语义漂移的对象。

#### 2.2 同毫秒事件为什么不能凭业务直觉排序

若 trade、book delta 与 cancel ACK 都标在同一毫秒，但数据没有共享 sequence key，至少存在两种物理路径：trade 先发生则订单可能成交；ACK 先发生则订单已退出风险集。选择其中一个顺序会直接改变 terminal cause。

研究对这种路径 fail closed 或 censor，而不是用“通常 ACK 比 trade 晚”补序。原因不是过度保守，而是不可识别：

$$
\Pr(J=fill\mid\text{timestamp tie})
$$

无法仅由相同的毫秒标签恢复。把 ties 全部排成对策略有利的顺序，会同时污染 label、hazard 与未来动作评估。

#### 2.3 CIF 与普通分类概率的本质区别

一个 5 秒 fill classifier 往往把 5 秒前 cancel 的订单标为 no-fill。它没有区分“仍存活但没成交”与“早已因 ACK 离开风险集”，于是不同 cancel policy 会改变负样本组成。CIF 则把 cancel ACK 作为竞争终局：

$$
F_{fill}(5s)
=
\int_0^{5s}S(u^-)\,dH_{fill}(u),
$$

其中 $S(u)$ 已经扣除了此前所有终局 cause 的概率质量。这使 fill probability 的含义绑定在明确 policy/lifecycle 下，而不是一个混合的“5 秒内有没有 1”。

也正因为绑定 policy，CIF 不能无条件迁移到另一个 cancel cadence。更快撤单会改变 $H_{cancelACK}$，继而机械改变 $F_{fill}$；这不是模型 drift，而是 estimand 已变。

### 3. 100ms 联合 hazard：四个 cause 只能共享一份事件概率

设当前 100ms interval 上四个 cause-specific rates 为 $\lambda_{k,t}\ge0$，网格宽度为 $\Delta=0.1$ 秒，并令

$$
\Lambda_t=\sum_{j=1}^{4}\lambda_{j,t}.
$$

当 $\Lambda_t>0$ 时，第 $k$ 个 cause 在该 interval 的条件事件概率为

$$
h_{k,t}
=
\frac{\lambda_{k,t}}{\Lambda_t}
\left(1-e^{-\Delta\Lambda_t}\right),
$$

而 interval 内没有任何终局事件的概率为

$$
p_{0,t}=e^{-\Delta\Lambda_t}.
$$

因此概率质量在同一个 interval 上严格守恒：

$$
p_{0,t}+\sum_{k=1}^{4}h_{k,t}=1.
$$

若进入 interval 前的 survival 为 $S_t$，第 $k$ 个 cause 的 cumulative incidence 为 $F_{k,t}$，更新为

$$
S_{t+\Delta}=S_t p_{0,t},
$$

$$
F_{k,t+\Delta}=F_{k,t}+S_t h_{k,t}.
$$

于是每个被接受的 grid edge 都必须满足

$$
S_t+\sum_{k=1}^{4}F_{k,t}=1,
$$

同时 $S_t$ 单调不增，每条 $F_{k,t}$ 单调不减。零 rate interval 保持全部状态不变；非有限 rate、负 rate、概率质量破坏或 edge 顺序错误全部 fail closed。

一个纯说明性的合成例子可以看出联合归一化的意义。假设某一 edge 的每秒 rates 依次为 0.02、0.04、0.30、0.01，则 $\Lambda=0.37$，100ms 内任一终局概率约为 $1-e^{-0.037}=3.6324\%$。这份 3.6324% 的概率质量按 rate 比例分成约 0.1963%、0.3927%、2.9452% 与 0.0982%，no-event 约为 96.3676%。四个 cause 不是各自从一整份 100% 概率中取值。

若分别训练四个二元概率再各自归一化，很容易得到 interval event probabilities 之和大于一，或者在各 cause 单独看似校准时破坏整体 survival。竞争风险 CIF 的核心不是“多画四条曲线”，而是让四种互斥终局共同消费同一份条件风险质量。

### 4. 两个时钟：市场发生时间与策略可见时间不能互换

研究使用严格的 causal visibility grid。也就是说，一个 100ms edge 能使用的信息，必须在该 edge 的策略可见时间之前已经 feature-ready。交易所时间用于识别事件物理顺序与终局语义，visibility time 决定模型何时允许消费这条信息。二者相等是一种特殊情况，不是默认假设。

若 exchange event 先发生、网络或处理链稍后才让策略看到，模型不能在 visibility 之前提前停止风险或使用 terminal label。反过来，若时间戳发生回归、event visibility 早于其允许的上游因果事实，记录也不能靠排序或插值“修好”。缺失 exchange timestamp 可以带明确 invalid reason，但不能默默用 visibility timestamp 代替。

100ms 只是概率状态网格，不是行情 bar，也不是固定持有期。重复 edge、反向 edge 或跳过一个应评估 edge 都会失败；kernel 不为错过的 edge 回填。这个限制保证 Python 与 C++ 对“已经消费到哪里”的理解完全一致，也让 checkpoint 恢复具有可验证含义。

UTC 日同样只是历史 replay 的数据分片和统计单位，不是订单生命周期边界。一个 prospective order 可能跨过午夜，因此未来 transport 若要继承 mechanics，必须保留完整 session/epoch cursor 或冻结的 delayed-entry 状态，不能因为换日就把 survival 重置为一。40 日结果只证明其绑定的 historical replay contract，不能自动外推到不同 clock 或 cursor 语义。

### 5. 输入、输出与 estimand 边界

Lifecycle CIF 的输入不是经济 outcome。它消费的是经过 admission 的 lifecycle event stream、risk phase、remaining quantity、spell identity、grid identity、因果可见的冻结 conditioning state，以及各 cause 的 rate matrix。strict-native queue 是否有效是资格与 censor 条件；market-context book 不能冒充 exact queue authority。

模型输出包括每个 interval 的四个 hazards、no-event probability、survival、四条 cumulative incidence 和可恢复的 final probability state。对于 horizon $u$，主预测 estimand 是

$$
F_k(u\mid x_{0:u})
=
\Pr(T\le u, J=k\mid x_{0:u},\text{spell remains observable}),
$$

其中 $T$ 是当前 spell 的终局时间，$J$ 是四个冻结 terminal causes 之一，$x_{0:u}$ 只包含沿 causal grid 已经可见的 time-varying state。

它不输出 campaign-terminal USDC，不估计 KEEP 与 CANCEL 的 potential-outcome difference，也不把 q90 threshold 当作 estimand。经济字段在这条 mechanics 链中保持关闭。这样做不是缺少一步“顺手评估”，而是防止 probability mechanics 在尚未证明 transport、动作定义与共同 support 时偷渡成政策结论。

### 6. 数据 admission：unknown 不能当作 zero

研究最早的 training preflight 没有打开 lifecycle rows，只检查 baseline identity 与 journal metadata 能否支持注册训练身份。它把 readiness 拆成四层：baseline epoch 完整绑定、lifecycle tape admission、40 日 training identity 注册，以及 chronological Python/C++ lockstep execution readiness。

初始预检失败并不是一篇阴性模型文章，而是本项目的第一道工程证据：当时的 snapshot-style journal 不能证明一次 callback 内的 activation 与 fill 都被无损持久化，也没有完整的 batch cursor、writer-health、atomic admission、spell/censor 与 dual-clock 证据。未知的 dropped-event count 不能按零处理，缺少的 partial-fill spell count 不能靠推断补齐，本地 shutdown 也不能沿用旧 terminal 编码。

后续链路因此要求每个 callback 发布所有未见事件，事件批次与 cursor 原子提交，并在训练前绑定 schema、event identity、order/lifecycle identity、clock coverage、queue authority 与唯一 terminal/censor。每个 target day 还需要冻结的 warmup 与市场输入，使 active order 的开始状态不是凭空出现。

exact-native queue 是本项目的一条资格边界。只要从 activation 开始的 fill-risk path 使用了 fitted、top-N、稀疏观察或后来失效的 queue approximation，该 spell 可以保留在 baseline replay 轨迹中，却必须从 CIF eligible denominator 显式 censor。最终 20,393 个 native queue-censored spells 正是这种 fail-closed 规则的可见结果，而不是把不完整证据偷偷丢掉。

orphan adoption 也不能伪造完整历史。若系统首次权威观察某个已存在订单，只能在第一次可见时 delayed entry，并记录 entry reason 与 timestamp。左侧未观测暴露不会被补成零风险。相似地，本地回放结束只构成 right censor；它没有资格变成 other_terminal。

### 7. 为什么许多 spec、amendment 与 execution attempt 仍只算一个项目

公共目录里的 probability spec、preflight、journal adapter、input admission、native queue authority、event lockstep、C++ parity 与 40-day completion 都服务于同一个 estimand：相同 event stream 产生相同 spell transitions，相同 rates 产生相同 probability state，checkpoint 后仍相同。它们改变的是证据成熟度，不是研究问题；实现修正与失败 execution attempts 也不能被包装成新的 alpha 项目。

### 8. Python/C++ 锁步到底验证什么

Python 端拥有 lifecycle authority：创建 spell、partial-fill reset、phase transition 与 terminal routing。C++ 端实现相同的概率状态更新，并消费 chronological cause-specific rate matrix。锁步因此分两层。

第一层是 event lockstep。对同一冻结 journal，双方必须在每个 event 后同意当前 order 是否处于 fill-risk、phase 是什么、remaining quantity 与 spell_id 是什么、是否已经 terminal/censored，以及 terminal 之后是否还错误复用 queue 或 hazard state。只比较最终行数不够，因为中间一次短暂错位可能随后“碰巧”回到相同终态，却已经污染 exposure。

第二层是 inference lockstep。对每个 100ms edge，双方比较 interval hazards、no-event probability、survival、四条 CIF 与最终可恢复状态。suite 还覆盖 time-varying rates、zero-rate intervals、invalid-rate rejection、duplicate/missed edges、monotonicity 与 probability-mass conservation。

checkpoint/restore 必须保存 identity、grid、spell ownership、phase、remaining quantity、last edge、survival、所有 CIF 以及 terminal metadata。恢复不是重新从一开始计算再比较，而是从序列中间的冻结状态继续消费后续事件。任何 schema、identity、mass 或 edge mismatch 都拒绝恢复。

早期 native kernel 修复过一个纯浮点边界：如果先独立舍入每个 hazard，再用普通求和检查总概率，合法有限 rate vector 也可能因为末位舍入被误拒。后续实现用 residual complement 构造 no-event mass，没有改变 estimand，只消除了虚假的数值失败。正式 40 日结果中，CIF 最大绝对差仅为 $1.1102230246251565\times10^{-16}$，checkpoint-resume 差为零，说明不同语言没有产生可观测的累计漂移。

### 9. 40 日完成面板：数字如何互相校验

最终 Development mechanics 面板汇总如下：

| Evidence item | Frozen aggregate |
|---|---:|
| Development days | 40 |
| Lifecycle events | 2,712,262 |
| Journal rows | 686,224 |
| Exact-native eligible spells | 665,831 |
| Native queue-censored spells | 20,393 |
| Risk exposure | 5,172,921.02 seconds |
| Cancel ACK terminals | 636,186 |
| Full-fill terminals | 29,645 |
| Unsupported terminal causes | 0 |
| CIF cells / parent cells | 120 / 30 |
| Python/C++ event mismatches | 0 |
| Post-terminal hazard/queue reuse | 0 |
| CIF maximum absolute difference | $1.1102230246251565\times10^{-16}$ |
| Checkpoint-resume maximum difference | 0 |

两个主要 terminal counts 之和恰好等于 eligible spells：

$$
636{,}186+29{,}645=665{,}831.
$$

这项等式是 accounting cross-check：eligible denominator 没有未解释的 terminal residue，20,393 个 native-queue censors 也没有混入 event causes。event、journal row 与 spell 本来就是不同层级的计数单位；要求是各自语义冻结、identity 可追踪并逐事件锁步，而不是强迫它们相等。120 个 CIF cells 则统一服从同一套守恒、单调与 checkpoint 合同。

#### 9.1 为什么机器精度 parity 既重要又有限

$1.11\times10^{-16}$ 的 CIF 最大差说明，在相同 event stream 和 rates 下，两种语言实现的是同一数值递推。它排除了线上 C++ 与研究 Python 因浮点更新、edge cursor 或 checkpoint state 不同而逐步分叉。

但 parity 是条件命题：

$$
\text{same inputs}+\text{same contract}\Rightarrow\text{same outputs}.
$$

它不证明输入事件真实无漏损，不证明 rates 校准，不证明 terminal cause 的经济定义最佳，也不证明预测能改善动作。把 parity 说成“模型有效”会把实现一致性偷换成统计或经济有效性。

#### 9.2 一个读者可以手工核对的三步不变量

即使没有私有 lifecycle rows，公开聚合仍允许三步 sanity check。第一，eligible spells 应由互斥终局完全解释；这里 636,186 加 29,645 恰好为 665,831。第二，queue-censored 20,393 应在 eligible denominator 之外，不能被记成 no-event。第三，每个 edge 与最终 cell 都必须满足 $S+\sum_kF_k=1$，且 terminal 后没有 hazard reuse。

这三步分别约束计数身份、admission 身份与概率身份。它们不会验证经济结论，却能防止最常见的“unknown 当 zero、censor 当 terminal、四个概率各算各的”错误。

### 10. 这份证据支持什么

它支持四件具体的事：冻结 adapter 能正确路由 risk phases、terminal causes 与 censors；100ms update 在长期累计后仍保持联合概率守恒；strict-native admission 会明确隔离证据不完整的 spells；同一 rate stream 的 Python/C++ inference 达到机器精度级 parity，checkpoint 恢复不改变后续状态。换言之，未来独立 transport 与 calibration audit 已有可执行 kernel，而不是只有数学说明。

### 11. 这份证据没有支持什么

Mechanics completion 不等于 prediction calibration completion。公开聚合没有证明新 prospective epoch 的 CIF 仍与观察频率一致，也没有跨 epoch drift audit；40 日历史 exposure 不能替代新的可见性合同。

Mechanics completion 更不等于 action value。CIF 不知道 CANCEL 丢失多少 favorable queue option、何时 re-entry 或怎样改变库存 campaign。KEEP/CANCEL 仍需要独立 treatment、共同 eligibility、完整路径与经济 estimand；adverse CIF 高不能直接翻译成“应该撤”。

这条研究链明确没有读取或获得：

- PnL、reward、markout 或 campaign-terminal value；
- Validation 或 family-specific sealed holdout；
- q90 action threshold 变更；
- randomized KEEP/CANCEL action registration；
- prospective deployment、baseline update 或实盘权限；
- 对当前环境 calibration、跨午夜 cursor 或 transport 的公共背书。

因此项目最终状态应该写成 **40-day lifecycle/CIF mechanics complete；经济、动作与 prospective transport closed**，而不是“策略通过”或“模型上线”。

### 12. 失败门与未来重开条件

这套合同在任何一个关键不变量被破坏时都应失败：重复、反向或遗漏 100ms edge；terminal 后继续评估 hazard；partial fill 不重置 spell；cancel request 被当作 ACK；local shutdown 被写成 exchange terminal；event visibility 倒穿因果时钟；缺失 queue authority 却进入 eligible denominator；checkpoint identity 不一致；四个 causes 的概率质量不守恒。

下一阶段需要独立、完整绑定的 prospective epoch/session transport，而不是继续调历史 cell 或 q90 阈值。它必须保持 lossless batching、dual-clock、cross-midnight cursor 或明确 delayed entry、zero post-terminal reuse，并在新可见性环境中通过 calibration 与 parity audit。

只有 transport 与 current calibration 独立通过后，才可以另行预注册经济研究。那项新研究需要明确 action、eligibility、randomization 或可识别的 counterfactual、campaign-terminal estimand、成本与不确定性门；它不会因为本文 mechanics 成功而自动继承权限。

### 13. 最终结论

Active-Order Lifecycle CIF 的主要贡献不是找到一个赚钱信号，而是把 active order 中最容易偷换的语义冻结下来：

$$
\text{event semantics}
\rightarrow
\text{risk spell}
\rightarrow
\text{causal 100ms grid}
\rightarrow
\text{joint hazards}
\rightarrow
\text{survival/CIF}
\rightarrow
\text{event and checkpoint lockstep}.
$$

40 日结果证明这条 mechanics 链在绑定的 Development replay 上闭合。它也以同样清楚的方式证明了一条边界：**概率会计做对，是动作研究的必要条件，却从来不是经济权限。**

### 14. 公共证据

- [F07 Active Order Continuation README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/README.md)
- [Active-Order Competing-Risk CIF 100ms v1 Spec](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/docs/active_order_competing_risk_cif_100ms_v1_spec_20260804.md)
- [Lifecycle-CIF Training Preflight v1](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/docs/active_order_cif_training_preflight_v1_design_20260804.md)
- [Authoritative Python Replay Adapter](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/docs/order_lifecycle_journal_v2_authoritative_python_replay_adapter_v1_20260805.md)
- [Lifecycle v2 Event Lockstep Implementation](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/docs/order_lifecycle_v2_event_lockstep_v1_implementation_20260805.md)
- [C++ Inference Parity v1](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/docs/active_order_competing_risk_cif_cpp_inference_parity_v1_20260805.md)
- [Lifecycle CIF 100ms v1.6 40-Day Completion](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f07_active_order_continuation/docs/active_order_lifecycle_cif_100ms_v1_6_40day_completion_20260808.md)

公共仓库提供合同、实现入口、聚合数字与权限边界；原始 lifecycle rows、机器 artifacts、prospective telemetry 与 owner-side evidence 不随仓库分发。

![Order-Level Quote Value 从 placement 到 KEEP CANCEL 与动态 CIF 的结果收敛](/images/narrowgate/order-level-research-synthesis.svg)

*图：placement probability、KEEP/CANCEL action value 与 lifecycle CIF 是三层证据；更准确的动态风险集没有把已失败的 continuation 动作改写成通过。*

## 6. 合并后的结论：更准确的生命周期模型不会自动复活失败动作

Placement 研究证明二、四 tick 的 raw fill difference 可以被识别，但 marginal fills 太稀、campaign attribution 不完整、terminal interval 全部跨零；KEEP/CANCEL 的随机化证据又显示，候选大量删除 intervention fills，却几乎按同比例保留 toxic fills，选择效率接近零，pooled ITT 为负。后续 100ms CIF 把 activation、fill、cancel、jump、repair 与持续生存放回合法风险集，并完成 Python/C++ lockstep；这提升了机制建模质量，却没有把旧动作结果倒写成通过。

下一次 order-level action 必须基于新的、预注册的 decision surface，并直接评价 placement 与 continuation 的完整路径。CIF calibration、距离单调性、推断 parity 或较低 adverse-fill probability 都只构成前置证据。
