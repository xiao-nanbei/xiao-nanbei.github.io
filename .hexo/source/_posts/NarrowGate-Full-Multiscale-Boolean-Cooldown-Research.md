---
title: 'NarrowGate Full-Multiscale：从多尺度 EMA 到 Boolean Cooldown 的一次阴性研究'
date: 2026-08-29 14:25:53
updated: 2026-09-27 10:45:00
categories:
- Market Making
tags:
- Market Making
- 市场微观结构
- 因果推断
- 机器学习
- 回测
math: true
---

## TL;DR：这是一个有正信号、但没有通过研究门槛的实验

NarrowGate 的 Full-Multiscale 研究问了一个很具体的问题：**在一次 maker 成交增加库存以后，能否根据从 0.5 秒到 256 秒的多尺度市场状态，动态决定下一次允许继续加仓前要等待多久，并且比实验冻结时的精确 owner baseline 获得更好的 库存生命周期-terminal USDC value？**

把它翻译成人话：研究让同一条价格同时经过十把“反应速度不同的尺子”——最快只记得最近约 0.5 秒，最慢保留约 256 秒的背景；任取一快一慢两把尺子，共有 45 种配对。程序不只问“快线在慢线上面吗”，还问“刚交叉多久、两线正在分开还是靠拢、这种排列持续了多久”，然后只用过去日期学习一组有长度上限的 AND / OR / NOT 规则，为当前成交选择一个预先冻结的冷却时长。

这里的“三值”也不是三种动作，而是每个条件有 `true / false / unobserved` 三种状态：数据缺失不能被当成 `false`，取反以后也不能凭空变成证据。动作空间仍是 BUY 与 SELL 各自预先冻结的八档 duration。第 4 节会把 EMA、pair state 和 policy 分别写成式子。

结果并不是“没有信号”。BUY 侧最强候选 `E3_HIGHER_ORDER_BOOLEAN` 相对精确 baseline 的 terminal value 改善 `+0.458577 USDC/day`，已结束库存生命周期 value 改善 `+0.604012 USDC/day`，保留 97.29% 的 fills，四个 outer-fold 平均值全部为正；在匹配 action rate 与 duration distribution 的控制组之上，仍有 `+0.193888 USDC/day` 的额外点估计。

但它仍然没有通过研究门槛：day-level simultaneous interval 跨过零，语义增量的区间也跨过零，冻结的 feature hierarchy 第一层未通过，tail 与 lifecycle gates 同样失败。SELL 没有正的 non-baseline candidate。因此，正确结论是：**这个冻结的 30 日 Development 研究族关闭，`supported_sides=[]`，没有 final refit、没有 Validation、没有 sealed holdout、没有 research-supported action 或 实盘有效性证据。**

这篇文章讲的不是一个“成功上线的策略”，而是一个更有代表性的研究结果：为什么看起来相当漂亮的点估计，仍然不足以证明一个做市动作具有可迁移的增量价值。

项目源码：[GitHub - xiao-nanbei/NarrowGateMaker](https://github.com/xiao-nanbei/NarrowGateMaker)。完整的研究框架见 [Maker Quote EV、Order-Level Evidence 与 Causal Action Uplift](/2026/06/19/NarrowGate-Maker-Quote-EV-Research-Framework/)，执行器与 C++ parity 背景见 [回测吞吐与 Live 尾延迟工程](/2026/07/01/NarrowGate-Cpp-Low-Latency-Market-Making/)。

本文只讨论研究方法和历史 Development 证据，不讨论或建议任何真实交易行为。文中的 PnL、value、fill 和 uplift 都是特定 replay identity 下的研究量，不是收益承诺。

## 1. 问题不是“EMA 能不能预测价格”，而是“状态能不能改变动作价值”

maker 策略里的 cooldown，是一次 exposure-increasing fill 之后暂时不允许同侧继续增加库存的时间。最简单的实现是固定等待，例如按连续成交单位使用 `85 × N` 秒。它的好处是可解释、稳定、容易在 live 和 replay 之间保持一致；缺点是把所有市场状态都压缩成同一个时间常数。

直觉上，固定 cooldown 很可能过于粗糙。一次短促的流动性冲击，可能在几十秒内完成 refill；一次持续性的单边 taker flow，则可能在几分钟后仍未恢复。快慢 EMA 的交叉方向、交叉发生多久、价差是否继续扩张、盘口深度是否恢复，看起来都可能帮助回答“现在恢复加仓是否太早”。

但这不是普通的价格预测问题。即使某个状态能预测未来继续下跌，也不能直接推出“延长 cooldown 更好”。延长等待会同时删除一部分有毒成交和一部分自然修复成交，还会改变后续订单、库存、库存生命周期 长度和终局价值。研究真正要估计的是动作反事实：

$$
\Delta = Y(\text{candidate repeated policy}) - Y(\text{frozen exact baseline policy}).
$$

这里的 $Y$ 不是下一秒方向，也不是 fill 后某个孤立 markout，而是完整顺序路径上的 terminal 或 已结束库存生命周期 USDC value。

因此，Full-Multiscale 的研究映射是：

```text
因果可见的市场、订单与 inventory_lifecycle 状态
-> 只在 inner-train 内进行的有界 Boolean discovery
-> cooldown duration policy
-> untouched outer-test 上的 repeated sequential full-path replay
-> 相对冻结 exact baseline 的 inventory_lifecycle-terminal USDC increment
```

![Full-Multiscale 从状态到动作价值的研究链](/images/narrowgate/full-multiscale-research-loop.svg)

*图 1：one-shot label 只帮助训练；正式结论来自 candidate 与 B0 各自运行的重复顺序完整路径。*

![成交后逐侧 cooldown 如何改变 K 线上的 maker 报单](/images/narrowgate/cooldown-side-selective-kline.svg)

*图 2：以已有多头库存为例，BUY fill 后的 BUY bid 会继续增加暴露，cooldown 因而只屏蔽这一侧；SELL ask 是 reducing quote，原则上继续可用。Full-Multiscale 只在 fill 时刻用因果可见状态选择冻结 duration，不会看见未来 K 线后再改时长。*

图里的红叉才是研究动作真正落到报单层的地方：候选不是预测“下一根 K 线涨跌”，而是决定 exposure-increasing quote 何时恢复。K 线随后怎样走，会通过少接到哪些成交、库存怎样变化和减仓是否完成，进入 repeated full-path 的终局价值。

这是整项研究最重要的边界：**state ranking 不等于 action uplift，one-shot label 也不等于 repeated-policy PnL。**

## 2. 为什么要做 Full-Multiscale successor

这项研究之前，NarrowGate 已经测试过 ADD 与 WAIT、固定八档 cooldown、有限 Boolean predicate、modeled-queue persistent policy，以及 50/71 日 full-path diagnostics。它们暴露了几个不能靠“再加一个特征”解决的问题。

第一，早期 Boolean 搜索并没有真正实现完整 feature hierarchy。部分大 feature block 被压缩成少数 outcome-blind predicates，外层 policy 也退化成很浅的一条规则，所以阴性结果只能关闭那个受限实现，不能证明高阶 multiscale structure 没有价值。

第二，strict-native 历史标签遇到了不可恢复的跨流顺序问题。公开 individual trade 的时间戳精度与 book stream 的子毫秒顺序不足以判断同一毫秒内 trade 与 depth change 谁先发生；强行指定 tie-break 会改变 queue seed 和 fill。正确处理是 censor ambiguity，而不是制造一个看起来精确的顺序。

第三，先前的一次性 duration label 不能直接相加成策略收益。只要一个动作改变订单是否成交，它就会进一步改变库存、后续 eligibility、cooldown lineage 和 库存生命周期 terminal。真正的外层检验必须让 candidate policy 在完整路径上反复触发。

Full-Multiscale successor 因此没有只扩大一个 feature list，而是同时修正了四件事：完整的多尺度状态、interaction-capable Boolean policy、nested chronological discovery，以及 repeated sequential evaluation。

## 3. 证据身份：30 日历史 Development，而不是 prospective 或 strict-live evidence

最早的设计曾考虑建立一个 prospective companion，从冻结时点以后收集 30 个新日期。但该 companion 在部署前被撤回，产生零行数据，也没有修改 live runtime。项目没有把“0/30”误写成历史数据不存在，而是转向纯离线、family-specific 的历史 Development identity。

离线研究在 outcome-blind source audit 后冻结了 30 个按时间排列的历史日期，共有 3,516 个机会。用于此前精确 F05 cooldown-selection chain 的日期被排除为 target；它们最多只能作为 D−1 warmup 或 D+1 washout context。这些日期是“对本研究族未消费”，不是“全项目从未看过”。

证据时钟是 exchange time，queue identity 是 `modeled_queue_with_same_millisecond_ambiguity_censoring`。这意味着同毫秒但没有共同 sequence 的 trade/book 事件会被 censor，而不是被赋予乐观顺序。它不是 receive-time authority、strict exchange-queue truth、current-host transport parity，也不是 exact live-lifecycle confirmation。

### 3.1 同一毫秒不是已经识别的先后顺序

把 book 事件记为 $B_1,B_2,\ldots$，individual trade 事件记为 $T_1,T_2,\ldots$。Book update ID 可以建立 book stream 内部的顺序，trade ID 也可以建立 trade stream 内部的顺序：

$$
B_1\prec B_2\prec\cdots,
\qquad
T_1\prec T_2\prec\cdots.
$$

但当 $\operatorname{ms}(B_j)=\operatorname{ms}(T_k)$ 且数据没有同时覆盖两条流的共同 matching sequence 时，观测只能证明两个事件位于同一个毫秒桶，不能证明 $B_j\prec T_k$，也不能证明 $T_k\prec B_j$。使用 `(timestamp_ms, stream_priority, row_number)` 可以让程序确定性运行，却不会让后两个字段获得交易所因果含义；deterministic 不等于 identified。

这个边界会实际改变 fill。设 replay state 为 $S$，trade 与 book 的状态转移分别是 $F_T$、$F_B$，同一个毫秒桶的两个可行世界为：

$$
S_m^{T\rightarrow B}=F_B\!\left(F_T(S_{m^-})\right),
\qquad
S_m^{B\rightarrow T}=F_T\!\left(F_B(S_{m^-})\right).
$$

Queue replay 通常满足 $F_B\circ F_T\ne F_T\circ F_B$：trade 会消耗 queue ahead，book change 可能改变 displayed depth、重置 queue seed 或让旧 seed 失效。假设模拟订单前面有 $0.6$ BTC，同毫秒出现 $0.5$ BTC aggressive trade 和 $0.4$ BTC displayed-depth decrease；先处理哪一个事件，可能分别得到 fill 与 no-fill。第一次 fill 一旦分叉，库存、cooldown deadline、下一次 eligibility、reducing quote 和 库存生命周期 terminal 都会继续分叉。

因此对机会 $i$，若 $A_i=1$ 表示 active path 遇到会改变结果的 unresolved collision，严格点标签只能写成：

$$
Y_i^{\mathrm{strict}}=
\begin{cases}
Y_i,&A_i=0,\\
\mathrm{UNIDENTIFIED},&A_i=1.
\end{cases}
$$

`UNIDENTIFIED` 不是零 uplift、baseline outcome 或 no fill。机会仍保留在 mechanics denominator 与 support report 中，但不能进入需要精确反事实的 point-label learner。固定 trade-first、固定 book-first、文件行号、随机 jitter，或者把歧义 arm 填成 baseline，都只能定义另一套模型，不能恢复真实历史顺序。

![K 线上的订单生命周期与 exchange visibility 双时钟](/images/narrowgate/dual-clock-order-lifecycle-kline.svg)

*图 3：K 线触及 maker price 后，订单仍要经历 active、queue consumption、partial/full fill、cancel request 与 cancel ACK；cancel request 后、ACK 前仍在风险集。交易所事件时钟和策略可见时钟是两条时钟，同毫秒跨流事件没有共同序号时，图上的左右位置不能用来补造先后。图为机制示意。*

策略可见性只回答另一件事。事件 $e$ 能进入决策 $d$ 的 policy feature，至少要满足：

$$
I_{\mathrm{visible}}(e,d)=\mathbf 1\{t_{\mathrm{ready}}(e)\le t_{\mathrm{decision}}(d)\}.
$$

它阻止 future leakage，却不能反向证明事件在交易所撮合引擎里的顺序。Full-Multiscale 因而使用明确降级的 modeled exchange-time identity，并对有结果影响的同毫秒歧义 censor；早期 strict-native 路径曾因该问题在 41 日请求中得到 0 个 admitted day，这只关闭了那份 strict 点标签身份，并没有证明多尺度状态本身无效。

研究没有创建 shadow、companion、observer、writer、feature dump 或 hypothetical-action log。公开仓库保留方法、Spec、聚合结果和 machine receipt；精确 OOF rows、cache、scorecard 和 owner-side artifacts 位于 private evidence store，不随公共仓库分发。

![从一段 K 线到 45 个 EMA pair 与 nested chronological OOF](/images/narrowgate/full-multiscale-kline-to-oof-pipeline.svg)

*图 4：十个 half-life 形成的 45 个 fast/slow pair 是同一个相关特征全集，不是 45 次独立研究。每个 outer fold 都只在过去日期的 inner folds 里筛状态、编译规则和选 duration，再到紧接着的未来五日运行 repeated full-path replay。*

这张总览图把“特征很多”和“偷看答案”分开了：状态空间可以很丰富，但每一折能使用的数据仍严格向左看；外层测试 K 线不会反过来改阈值、规则或时长。30 日、四个 outer folds 和后来多次执行尝试仍然属于一个冻结研究身份。

## 4. 状态空间：十个 half-life、45 个 EMA pair 和三值逻辑

### 4.1 Half-life 是记忆衰减，不是预测期限

先把最容易把读者劝退的那句话拆开。设 $p_i$ 是时刻 $t_i$ 已经因果可见的本地 mid price，半衰期为 $h$ 的不规则时钟 EMA 按下面的式子更新：

$$
\lambda_{i,h}=\exp\!\left(-\ln 2\,\frac{t_i-t_{i-1}}{h}\right)=2^{-\Delta t_i/h},
\qquad
E_h(t_i)=\lambda_{i,h}E_h(t_{i-1})+(1-\lambda_{i,h})p_i.
$$

$h$ 的直观含义是：经过 $h$ 秒，旧状态在递推权重中的影响衰减一半。因此 $h=0.5s$ 的线会很快追随新价格，$h=256s$ 的线更像缓慢变化的背景。研究冻结的 half-life 集合是：

$$
H=\{0.5,1,2,4,8,16,32,64,128,256\}\ \text{seconds}.
$$

例如 $h=8\text{s}$ 时，4 秒后旧状态权重约为 $2^{-1/2}=0.707$，8 秒后为 $0.5$，16 秒后为 $0.25$。所以 half-life 回答“过去的信息以多快速度淡出”，不是“要预测未来几秒”，也不要求 cooldown duration 等于该 half-life。研究以完成后的 100ms 状态窗口为基础，但 EMA 衰减使用两次有效观测之间真实的 $\Delta t_i$；source gap、stale 或 warmup incomplete 不会被零填充，也不会被伪装成又看到一次相同价格。

任取 $f<s$ 作为 fast 与 slow，就得到 $\binom{10}{2}=45$ 个合法配对。这里不是先在全部 30 天中挑一对“历史赢家”，而是让每个 inner fold 只用自己的过去训练段决定哪些 pair 值得进入规则。

非相邻尺度也有明确语义：$4\text{s}/8\text{s}$ 更像局部弯折，$4\text{s}/64\text{s}$ 描述短冲击相对一分钟背景的偏离，$16\text{s}/256\text{s}$ 则更接近 库存生命周期 级慢状态。45 个 pair 越多，事后挑 winner 的自由度也越大；因此它们必须作为一个相关特征全集进入 nested search，不能被写成 45 次独立实验。

![十个 EMA half-life 与全部 45 个 fast slow 配对](/images/narrowgate/full-multiscale-ema-bank.svg)

*图 5：十个二倍间隔的时间尺度形成 45 个 fast/slow pair；每个方格是一组候选状态，不是一条独立策略。*

对一个配对 $(f,s)$，先定义以 basis point 表示的两线距离与距离速度：

$$
d_{f,s}(t)=10^4\frac{E_f(t)-E_s(t)}{p(t)},
\qquad
v_{f,s}(t)=10^4\frac{\dot E_f(t)-\dot E_s(t)}{p(t)}.
$$

于是当前 ordering 由 $\operatorname{sign}(d_{f,s})$ 给出；last-cross direction 是该符号最近一次翻转后的新符号；cross age 与当前排列的 persistence 分别是：

$$
a^{\text{cross}}_{f,s}(t)=t-t^{\text{last cross}}_{f,s},
\qquad
a^{\mathrm{persist}}_{f,s}(t)=t-t^{\text{current ordering start}}_{f,s}.
$$

两线是否继续分开，可以不用主观命名，直接看乘积：

$$
d_{f,s}(t)v_{f,s}(t)>0\Rightarrow\text{expanding},
\qquad
d_{f,s}(t)v_{f,s}(t)<0\Rightarrow\text{converging}.
$$

单条 EMA 的 slope 是 $\dot E_h$，curvature 是 $\ddot E_h$；配对的 curvature 则来自快慢 acceleration 之差。实现还会按 maker side 统一“有利 / 不利”方向，并在相应特征上使用因果可见的波动尺度做 normalization；上面的式子刻意省略这些符号变换，只保留最容易理解的几何关系。

![一段 K 线如何变成 EMA pair state 并进入三值 Boolean policy](/images/narrowgate/full-multiscale-kline-policy-mechanism.svg)

*图 6：合成 K 线展示 fast/slow EMA 从扩张转为收敛。ordering 尚未反转，但 cross age、persistence、distance、slope、curvature 与 $d\cdot v$ 已经变化；这些状态再与 trade、depth、库存生命周期 和 readiness 拼接，进入有界三值 first-match policy。图不是历史 E3 私有规则或实盘证据。*

从图上看，“fast 仍在 slow 上方”只是一个截面。前半段两线继续拉开，后半段虽然还没发生反叉，却已经开始靠拢；如果只保留 golden/death cross，一个 bit 会把这两个可能对应不同加仓风险的阶段压成同一状态。

![一个 EMA 配对如何产生 cross age distance 与 expansion](/images/narrowgate/full-multiscale-pair-state.svg)

*图 7：同一个交叉方向下，“刚交叉且继续扩张”与“交叉很久且正在收敛”是两种不同的市场状态。*

因此每个 pair 不只提供 golden/death cross，而是提供一组带方向和持续性的状态：

- 当前 fast/slow 的方向与上一次 cross 方向；
- cross age 与 persistence；
- EMA distance 与 normalized distance；
- slope 与 curvature；
- convergence 与 expansion。

后置的 M2 层才允许加入 aggressive trade flow、trade count/tempo、depth imbalance、depletion/refill、目标价 displayed quantity 和 queue state。这样可以回答一个更干净的问题：trade/depth 是否在已经有 库存生命周期 与 EMA 表示以后仍提供增量价值，而不是把所有信息一次性混在一起。

### 4.2 Raw、normalized 与 side-transformed state

Raw distance 保留通道原本的量纲：价格通道是价格单位，数量通道是 BTC，trade-rate 通道是 BTC/s。不同通道和不同波动阶段的绝对距离不能共享一个阈值，因此一般的归一化状态写成：

$$
z_{c,f,s}(t)=\frac{d_{c,f,s}(t)}{S_c(t)},
$$

其中 $S_c(t)>0$ 是 outcome-blind 冻结且在当时因果可见的通道尺度。具体分母与 predicate threshold 必须由冻结 transform 给出，不能看到经济结果后再调整。

Side transform 又是另一层。对具有 maker-favorable 方向的通道，令：

$$
m_s=\begin{cases}+1,&s=\mathrm{BUY},\\-1,&s=\mathrm{SELL},\end{cases}
\qquad
d^{\mathrm{fav}}_{c,f,s}=m_s d_{c,f,s}.
$$

这样“正”统一表示相对目标 maker side 更有利，而不是假设 BUY 与 SELL 的原始价格符号天然对称。Raw unit、normalization 和 side semantics 是三个不同 contract，不能压成一个名为“EMA signal”的标量。

### 4.3 三值 Boolean：缺失不能经由 NOT 变成证据

Boolean 层先把连续状态变成原子条件 $a_j(x_t)\in\{T,F,U\}$，其中 $U$ 表示 `unobserved`。它使用 Kleene 三值逻辑，例如 $\neg U=U$、$T\land U=U$、$F\land U=F$。因此缺失值不会被偷偷当作 `false`，`NOT unobserved` 也不会变成可用证据；source unavailable、warmup incomplete、feature stale、predicate unobserved 与 safety fallback 都有独立 coverage reason。

如果错误地把 $U$ 编成 $F$，就会得到 $\neg U\rightarrow\neg F=T$，把“没有证据判断”伪造成“有证据证明不成立”。强 Kleene 逻辑的 AND/OR 真值表明确阻止这件事：

| $A\land B$ | $T$ | $F$ | $U$ |
|---|---:|---:|---:|
| $T$ | $T$ | $F$ | $U$ |
| $F$ | $F$ | $F$ | $F$ |
| $U$ | $U$ | $F$ | $U$ |

| $A\lor B$ | $T$ | $F$ | $U$ |
|---|---:|---:|---:|
| $T$ | $T$ | $T$ | $T$ |
| $F$ | $T$ | $F$ | $U$ |
| $U$ | $T$ | $U$ | $U$ |

第 $\ell$ 条规则是若干 AND clause 的 OR，写成：

$$
R_\ell(x)=
\bigvee_{c=1}^{m_\ell}
\left(
\bigwedge_{j\in P_{\ell c}}a_j(x)
\land
\bigwedge_{k\in N_{\ell c}}\neg a_k(x)
\right).
$$

多条规则按顺序 first-match。对 side $s$，动作不是 `+1 / 0 / -1`，而是从冻结的时长集合中选择；其中 $\tau_{B0,s}(x)$ 表示该行由 exact owner baseline 给出的时长：

$$
\mathcal A_{\mathrm{BUY}}=\{\tau_{B0}(x),79,173,223,356,640,709,2048\}\text{s},
$$

$$
\mathcal A_{\mathrm{SELL}}=\{\tau_{B0}(x),79,166,211,349,660,686,1748\}\text{s}.
$$

最终 policy 可以简写成：

$$
\tau_s(x)=
\begin{cases}
\tau_{\ell,s}, & R_1(x)=\cdots=R_{\ell-1}(x)=F,\ R_\ell(x)=T,\\
\tau_{B0,s}(x), & \text{没有规则为真，或更早规则为 }U.
\end{cases}
$$

更精确地说，第 $k$ 条规则只有在自己为 $T$ 且所有更早规则都明确为 $F$ 时才拥有动作机会：

$$
k^*(x)=\min\{k:R_k(x)=T\ \land\ \forall j<k,\ R_j(x)=F\}.
$$

若更早规则是 $U$，后面的规则即使单独计算为 $T$ 也不能“补票”，因为缺失字段恢复后，动作所有权可能属于前一条规则。Policy 必须 fail closed 回到逐行 B0，并记录 fallback reason。为了把树叶中的“TRUE 或 FALSE 都可以，但不能 missing”编译成三值规则，实现可以使用 $\operatorname{OBSERVED}(p)\equiv p\lor\neg p$；在二值逻辑里它是恒真式，在三值逻辑里 $p=U$ 时仍得到 $U$，恰好保持 observed-only 约束。

![三值 Boolean first match policy](/images/narrowgate/full-multiscale-boolean-policy.svg)

*图 8：三值属于 predicate；duration action 仍是八档。更早规则若不可观测，policy fail closed 回到 B0，而不会让后规则捡漏。*

搜索是有意限制的。每个 purged inner-training fold 最多经济筛选 1,024 个特征；per-action tree 深度最多 6、最多 32 个叶子，最终 policy 最多 7 条有序规则，每条规则最多 16 个 OR clause、每个 clause 最多 6 个 literal。这个约束减少了自由度，但也决定了结论边界：它是一个 bounded successor，不是对所有 Boolean architecture 的穷尽证明。

## 5. Candidate ladder：从简单 库存生命周期 状态逐层增加信息

研究没有直接把 E3 与一个随意的 85 秒常数比较，而是冻结了逐层 candidate ladder。

| 层级 | 含义 |
|---|---|
| `B0_CURRENT_EXACT` | 实验冻结时逐行复现的 exact owner baseline；不是独立的固定 `CONTROL_85N` 列 |
| `B1_INVENTORY_LIFECYCLE_AGE_ONLY` | 只根据 库存生命周期 age 学习 duration |
| `B2_INVENTORY_LIFECYCLE_PLUS_H16_H256` | 加入 16s/256s cross recency |
| `B3_CURRENT_SEMANTIC_EQUIVALENT` | 用统一的三值与 readiness 语义复现现有规则 |
| `E1_FULL_EMA_BANK` | 让十个 half-life 与 45 个 pair 全部进入 inner-fold screening |
| `E2_DIRECTIONAL_EMA` | 加入 cross direction、age、persistence、distance、slope、curvature 等方向信息 |
| `E3_HIGHER_ORDER_BOOLEAN` | 允许可达的有序多规则 AND/OR/NOT interaction |
| `M2_TRUE_INCREMENTAL` | 在最佳 inventory_lifecycle/EMA representation 上再加入 trade 与 depth |
| `ACTION_MATCHED_CONTROLS` | 为 E1/E2/E3/M2 分别构造 action-rate 与 duration-distribution 匹配控制 |

BUY 与 SELL 分开学习、分开报告、分开晋级；reducing quote 不变。duration vocabulary 也没有在看到结果后重选，BUY 与 SELL 各自继续使用既有的八档动作，包括 `CONTROL_85N` 和七个预先冻结的 fixed-duration arm。

冻结 hierarchy 要求先回答 E1 相对 B0 是否成立，再回答 E2 相对 E1、E3 相对 E2，以及 M2 相对最佳 EMA representation 是否有增量价值。后层即使点估计更好，也不能绕过前层失败变成 confirmatory success。

若 $G(A>B)$ 表示 $A$ 相对 $B$ 通过预先冻结的统计、支持、tail 与 lifecycle gate，那么 E3 的 confirmatory admission 至少要求：

$$
\operatorname{Admit}(E3)=G(E1>B0)\land G(E2>E1)\land G(E3>E2).
$$

这不是声称总 uplift 必须机械拆成三个相邻差分，而是限制解释权限：基础 full-EMA block 尚未成立时，不能从大量高阶组合中挑一个 winner，再倒推“多尺度结构已经确认”。Nested OOF 控制时间上的 selection leakage，feature hierarchy 控制信息层上的越级解释，两者解决的是不同问题。

![Full-Multiscale candidate ladder 与冻结晋级门](/images/narrowgate/full-multiscale-candidate-ladder.svg)

*图 9：BUY E3 是后层最强点信号，但 E1→B0 的第一道确认门已经失败，所以 E3 不能跨级晋级。*

Action-matched control 再把“选了什么状态”与“总体少做多少”拆开。对候选 $C$，matched policy $M(C)$ 只从 outer-training rows 冻结非控制动作率与 duration distribution，并用确定性可复现的伪随机映射分配到未来测试机会；它近似满足：

$$
\Pr_{M(C)}(A_t\ne B0)\approx\Pr_C(A_t\ne B0),
\qquad
\pi_{M(C)}(a)\approx\pi_C(a),
$$

却不复制 candidate 的状态到动作映射。于是：

$$
\Delta_{\mathrm{semantic}}(C)
=\mathbb E[Y(C)-Y(M(C))]
=\Delta_{\mathrm{gross}}(C)-\Delta_{\mathrm{matched}}(C).
$$

这个控制能排除“只因为改变了相同数量、相同时长的动作”这一种解释，但不能自动建立 strict queue、receive-time 可执行性或独立样本稳定性。

## 6. 为什么必须 nested chronological OOF

30 个日期被组织成四个 expanding outer fold：前 10 日训练、接下来 5 日测试；前 15 日训练、接下来 5 日测试；然后是 20→5 和 25→5。最终共有 20 个 untouched outer-test days。

| Outer fold | 训练前缀 | Untouched test | 测试日数 |
|---|---:|---:|---:|
| 1 | 第 1–10 日 | 第 11–15 日 | 5 |
| 2 | 第 1–15 日 | 第 16–20 日 | 5 |
| 3 | 第 1–20 日 | 第 21–25 日 | 5 |
| 4 | 第 1–25 日 | 第 26–30 日 | 5 |

写成集合，$k\in\{1,2,3,4\}$ 时：

$$
T_k=\{d_1,\ldots,d_{10+5(k-1)}\},
\qquad
V_k=\{d_{11+5(k-1)},\ldots,d_{15+5(k-1)}\}.
$$

每个 outer-training block 内还有三组 expanding inner fold。feature census、support calculation、economic screening、complexity selection 和 policy freeze 都只能发生在 purged inner-train。只要某个 assignment 的后代订单、queue、inventory、cooldown 或 库存生命周期 state 穿过测试边界，就必须从训练中 purge。

Inner 层负责在 outer train 内比较 feature/profile/complexity，outer test 只评价已经冻结的学习结果。对候选 profile $c$，第 $k$ 个 outer train 内的 inner OOF 分数可以写成：

$$
\widehat Q_k(c)=\frac{1}{|I_k|}\sum_{d\in I_k}
\left[Y_d\!\left(\pi_{k,c}^{\mathrm{repeated}}\right)-Y_d(B0)\right],
$$

其中 $I_k$ 是三个 inner-test block 的日期并集。分数相同时优先低复杂度，再用稳定名称打破完全平局；outer-test 的经济结果不能反过来选择 tree depth、规则数、阈值、duration 或 continuous comparator。

只要求 `train day < test day` 仍不够。若训练机会 $i$ 的 assignment time、observation end 和 库存生命周期 id 分别为 $a_i,e_i,g_i$，测试段最早 assignment 为 $b_k$、测试 库存生命周期 集为 $G_k^{test}$，则可保留的训练机会满足：

$$
i\in T_k^{\mathrm{purged}}
\iff
e_i<b_k\ \land\ g_i\notin G_k^{test}.
$$

若 $e_i$ 未知、后代订单或 terminal path 跨入测试段，或者同一 库存生命周期 同时出现在两侧，这条训练行必须移除。这比机械空出一天更准确：短路径不会被无谓删除，跨界长尾也不会因为日历翻页就被误判为安全。

这套结构是为了防止两种常见泄漏：一是先在全部 30 日里挑出“看起来最有效”的 EMA pair，再假装 outer fold 没看过；二是用未来 库存生命周期 的 terminal outcome 帮助当前规则选择。

外层测试只执行已经冻结的 fold policy，不再修改 feature、threshold、duration 或 complexity。因而它提供的是“学习算法在不同历史时点会产生什么 policy”的 OOF 证据，而不是一个最后 refit 出来的固定 artifact 的 OOF 证据。

令 $\mathcal A$ 表示 feature screening、profile selection、Boolean fit 与 side-specific action mapping 的完整学习算法，$\pi_k=\mathcal A(T_k^{\mathrm{purged}})$，则外层估计对应：

$$
\widehat\theta_{\mathrm{alg}}
=\frac{1}{20}\sum_{k=1}^{4}\sum_{d\in V_k}
\left[Y_d(\pi_k)-Y_d(B0)\right].
$$

四个 $\pi_k$ 可能拥有不同规则，这个 estimand 评价的是“在不同历史切点重新运行同一学习程序”，不能自动改写成使用全部 30 日 refit 的固定 $\pi_{30}$ 已经获得 OOF 确认。后者若存在，仍需在冻结以后接受独立 evidence。

![30 日 nested chronological out of fold 结构](/images/narrowgate/full-multiscale-nested-oof.svg)

*图 10：四个 expanding outer folds 产生 20 个外层测试日；每个蓝色训练窗内部还要独立完成 inner-fold 搜索与 purge。*

## 7. One-shot label 只负责发现，repeated replay 才负责经济结论

在 outer-training 内，为每个机会生成多个 duration arm 的 one-shot counterfactual label，是为了让 learner 看见“如果这里等待 79 秒、173 秒或更久，局部路径会怎样”。但这些 label 不能直接相加，因为前一个动作会改变下一个机会是否存在。

设 B0 在第 $i$ 个机会到达的历史为 $H_i^{B0}$，动作 $a$ 是一个 cooldown duration，则 one-shot 局部差分是：

$$
\delta_i^{\mathrm{one}}(a)=
y_i(a\mid H_i^{B0})-y_i(a_i^{B0}\mid H_i^{B0}).
$$

它回答“在这个已经发生的 baseline 起点，单独替换一次动作会怎样”，很适合作为 inner-training label；问题在于候选若更早采取了不同动作，第 $i$ 个时刻通常已经不在 $H_i^{B0}$，甚至不存在第 $i$ 个机会。

一个两次成交的反例足以说明。假设 B0 在 10:00 有一次 BUY fill，85 秒后恢复加仓，并在 10:02 又发生一次 BUY fill；one-shot 表分别认为把第一次等待改成 173 秒改善 `+0.08 USDC`，把第二次等待改成 223 秒改善 `+0.06 USDC`。直接相加得到 `+0.14`，但第一次改成 173 秒后，10:02 的 BUY order 根本尚未恢复，第二次 fill 和它的 `+0.06` 属于另一个世界。这组示例数字只说明结构，不是研究结果。

![One shot label 与 repeated sequential replay 的差别](/images/narrowgate/full-multiscale-one-shot-vs-repeated.svg)

*图 11：候选 duration 会改变后续订单、fill、inventory 与 eligibility；把仍按 baseline 世界生成的局部效果相加，不等于 policy PnL。*

外层 evaluation 因此采用 repeated sequential full-path replay：每一次符合条件的 exposure-increasing fill 都调用该 fold 已冻结的 policy，candidate 与 B0 分别重建后续订单、fill、inventory 和 库存生命周期 path。

把策略 $\pi$ 的内生状态写成：

$$
S_t^\pi=(O_t^\pi,q_t^\pi,C_t^\pi,K_t^\pi,E_t^\pi),
$$

其中 $O$ 是订单，$q$ 是库存，$C$ 是 库存生命周期，$K$ 是 cooldown，$E$ 是 EMA state。对外生市场事件 $X_{t+1}$ 和策略动作 $A_t^\pi$，完整路径按：

$$
S_{t+1}^\pi=F(S_t^\pi,X_{t+1},A_t^\pi),
\qquad
Y(\pi)=G(S_0,X_{1:T},A_{1:T}^\pi).
$$

一般不存在 $Y(\pi)-Y(B0)=\sum_i\delta_i^{\mathrm{one}}(\pi(H_i^{B0}))$。Candidate 与 control 可以共享相同外生 market source、visibility clocks 和冻结随机源，但 orders、inventory、库存生命周期、cooldown 与 EMA state 必须分别递推；共享库存或 checkpoint 会把本应分叉的两条策略路径重新压回一个世界。

这也是 action-matched control 的意义。它复制 candidate 的 action rate 与 duration distribution，但不复制其状态语义。如果 candidate 只是通过“少做一点”改善亏损，matched control 应该得到相近结果；只有超出 matched control 的部分，才可能来自状态选择本身。

## 8. 为什么 BUY 与 SELL 必须从输入到权限全程分开

Maker side 与 aggressive taker side 的映射首先要写对：

$$
\text{maker BUY}\longleftarrow\text{aggressive SELL taker},
\qquad
\text{maker SELL}\longleftarrow\text{aggressive BUY taker}.
$$

被动 BUY 挂在 bid，被主动卖单击中；被动 SELL 挂在 ask，被主动买单吃掉。因此研究 maker BUY toxicity 时，直接对手方 flow 是 aggressive SELL，而不是名字相同的 aggressive BUY。更稳妥的 schema 会先保留两侧原始流，再按 maker side 派生 `counterparty_taker_*` 与 `away_taker_*`。

两侧成交对库存的作用也相反。成交数量 $z>0$ 时：

$$
q_{t+}=\begin{cases}
q_t+z,&\text{maker BUY fill},\\
q_t-z,&\text{maker SELL fill}.
\end{cases}
$$

已有多头时，继续 BUY 增加 long exposure，SELL 则是 reducing path；已有空头时角色镜像。Cooldown 不是抽象地“减少成交”，而是一次 exposure-increasing fill 后限制同侧继续增加风险的时间。相同 EMA geometry 经 side transform 后仍可能面对不同 baseline、queue、repair 和 terminal inventory。

因此目标量按侧定义：

$$
\theta_s=\mathbb E_d\left[
Y_d(\pi_s,B0_{-s})-Y_d(B0_s,B0_{-s})
\right],
\qquad s\in\{\mathrm{BUY},\mathrm{SELL}\}.
$$

候选只接管目标侧，另一侧继续执行 B0，reducing quote 不变；feature support、policy fit、replay、interval、tail/lifecycle gate 和 permission 都分别计算。若简单把两侧 E3 点估计等权 pooled，会得到：

$$
\frac{0.458577+(-0.009708)}{2}=0.2244345\ \text{USDC/day},
$$

一个看似正的数，却直接遮住 SELL 没有正 non-baseline candidate。正式支持集合只能逐侧构造：

$$
\mathcal S_{\mathrm{supported}}=
\left\{s:L_s>0\land G_s^{\mathrm{hierarchy}}\land G_s^{\mathrm{tail}}\land G_s^{\mathrm{lifecycle}}\land G_s^{\mathrm{support}}\right\}.
$$

Pooled table 最多是描述性汇总，不能替代 side-specific inference，更不能让一侧给另一侧补票。

## 9. BUY：一个值得保留、但不能晋级的 E3 点信号

BUY E3 是所有非 baseline 候选中最强的经济点结果。

| 指标 | Exact B0 | BUY E3 | 变化 |
|---|---:|---:|---:|
| Terminal value | -2.904117 USDC/day | -2.445540 USDC/day | +0.458577 USDC/day |
| Closed-库存生命周期 value | -3.018197 USDC/day | -2.414185 USDC/day | +0.604012 USDC/day |
| Fills | 8,565 | 8,333 | -232，保留 97.29% |

按这个 modeled replay denominator 计算，terminal loss 降低 15.79%，已结束库存生命周期 loss 降低 20.01%。四个 outer fold 的平均 uplift 全部为正，20 个 OOF test days 中有 13 日改善。

action-matched control 的 fills 从 8,565 降到 8,312，比 E3 还略少，但 terminal uplift 只有 `+0.264689 USDC/day`。E3 在它之上还有 `+0.193888 USDC/day` 的 semantic increment，因此这个结果并不能简单解释成“少成交，所以少亏”。

这正是一个有研究价值的信号：它同时具有跨四个 fold 的正方向、有限的 fill sacrifice，以及超出 matched control 的正点估计。如果只看排行榜，E3 很容易被描述成 winner。

![Full-Multiscale 冻结结果、区间与研究权限](/images/narrowgate/full-multiscale-frozen-result-authority.svg)

*图 12：BUY E3 的绝对 terminal value 仍为负，`+0.458577 USDC/day` 只是相对 baseline 少亏；相对 action-matched control 的 `+0.193888 USDC/day` 也只是语义增量点估计。两条 primary day interval 均跨零，所以权限链停在 Development hard-gate failure。*

这张图必须从左往右读：先看绝对值仍是亏损，再看相对改善，再看不确定区间，最后才看权限。跳过任何一层，都可能把“样本中少亏”误写成“策略盈利”、把“正点估计”误写成“因果确认”，或把 owner decision 倒写成 research authorization。

## 10. 为什么它仍然失败

首先，primary day-level simultaneous band 没有排除伤害。E3 gross terminal uplift 的 simultaneous interval 是：

$$
[-0.348400,\ +1.265554]\ \text{USDC/day}.
$$

week-block simultaneous interval 为 `[+0.140288, +0.917819] USDC/day`，方向更乐观，但冻结合同并不允许在结果出来后只选择更有利的聚类方式。day-level family 仍跨零，所以 primary lower-bound gate 失败。

其次，E3 相对 action-matched control 的 semantic increment 虽然点估计为正，但 day interval 是：

$$
[-0.715169,\ +1.102945]\ \text{USDC/day}.
$$

它仍然无法排除状态语义没有稳定增量，甚至在某些日期造成伤害。

![BUY E3 gross 与 semantic uplift 的 simultaneous intervals](/images/narrowgate/full-multiscale-buy-intervals.svg)

*图 13：week-block interval 为正，但预先规定的 primary day interval 与 semantic day interval 都跨零；不能在看到结果后只挑绿色口径。*

第三，冻结 hierarchy 的第一层 `E1_FULL_EMA_BANK` 对 B0 没有通过。E3 位于 E1/E2 之后；如果最基础的 full EMA feature block 尚未建立 confirmatory increment，就不能用后层 winner 绕过前层门槛。这是在控制多层搜索带来的 winner bias，而不是否认 E3 点估计存在。

第四，tail 与 lifecycle gates 没有被较好的均值补偿。scorecard 记录的失败包括 conditional net-value lower bound 非正、negative-terminal protection 和 q10 shortfall protection 下界为负，以及 repair-event、censoring-avoidance 等指标方向不满足要求。

因此，`ranking_score` 必须保持 null，candidate class 是 `hard_gate_failed`。这不是“保守一点所以暂不部署”，而是正式的 Development failure。

## 11. SELL：没有可以保留为候选的 non-baseline policy

SELL E3 是 enriched candidate 中最不差的一项，但相对 exact B0 的 terminal increment 仍为 `-0.009708 USDC/day`。它保留了 101.18% 的 fills，20 个 OOF test days 中 12 日改善，但 simultaneous lower bound、tail 与 lifecycle gates 都失败。

E1、E2、M2、continuous comparator 和简单 库存生命周期-age candidate 的 terminal point increment 也都是负数。SELL 因此没有 successor candidate，不能靠 pooled BUY/SELL 结果掩盖这一侧的失败。

## 12. `formal-v13` 到 `formal-v27` 不是十五代研究

这项研究的执行历史很长：scheduler、cache schema、C++ lockstep、mmap lifetime、resume identity 和跨执行 cache binding 都出现过失败。历史记录曾使用 `formal-v13` 到 `formal-v27` 等名字，看上去像连续迭代了十五个研究版本。

更准确的身份模型是：它们是同一冻结研究身份下的 execution attempts。样本、B0、candidate ladder、fold、estimand 和 statistical contract 没变；普通运行时 bug 不会创造新的研究问题，也不能让失败 attempt 的部分经济结果继续使用。

把 research identity 写成合同元组：

$$
\mathcal R=(D,B,C,F,\theta,S),
$$

其中 $D$ 是冻结样本与时间支持，$B$ 是 baseline，$C$ 是 candidate/action contract，$F$ 是 chronological folds，$\theta$ 是 estimand，$S$ 是统计与权限门。只有这些科学字段变化，才有新的研究身份：

$$
\mathcal R'\ne\mathcal R
\iff
D'\ne D\lor B'\ne B\lor C'\ne C\lor F'\ne F\lor\theta'\ne\theta\lor S'\ne S.
$$

一次执行尝试则可以写成 $\mathcal A_k=(\mathcal R,G_k,M_k,X_k,O_k,P_k)$，分别绑定同一个研究合同、Git source、pre-run manifest、runtime/cache namespace、output schema 与 permission fields。修复 mmap 或 scheduler 后，$\mathcal A_A\ne\mathcal A_B$，但只要科学合同没变，仍有 $\mathcal R_A=\mathcal R_B$。

正式执行链的顺序应是：

```text
development implementation
-> representative single-day output
-> all-fold zero-economic walk
-> concurrency/cache/mmap/resume durability
-> parity and complete-output smoke
-> clean commit and annotated execution tag
-> pre-run manifest
-> final receipt or failure receipt
```

Git commit 只标识 tracked source，manifest 在运行前绑定研究合同、输入与权限，final receipt 把完整结果绑定回 manifest，failure receipt 则证明尝试在哪里失败。Artifact SHA256 只标识具名字节，不等于公共位置，也不证明经济有效。失败尝试的部分 fold 不能因为文件还在就被拼进下一次结果；修复后必须使用新的 attempt identity，并重新通过零经济与 durability gate。

最终 BUY 与 SELL 分别完成 577 个 cache unit、四个 outer fold、260 个 OOF candidate-day row 和 13 张 scorecard。BUY 使用已经完成并验证的 immutable component，SELL 在修复 runtime 后独立完成；两者只通过 identity-only receipt 组合，没有 pooled retraining、economic re-estimation 或跨执行 strategy-cache reuse。

这个过程留下了一个比性能优化更重要的教训：**执行器应该在冻结正式 evidence 之前完成 single-day、all-fold zero-economic、并发、cache durability、parity 和 complete-output smoke。** 否则，研究 lineage 会被普通软件故障淹没，外部读者也很难分清“模型变了”还是“程序终于跑完了”。

## 13. 这个阴性结果究竟关闭了什么

它关闭的是以下精确身份：

```text
30-day family-specific historical Development panel
+ exact B0 baseline
+ frozen B1/B2/B3/E1/E2/E3/M2 ladder
+ bounded three-valued Boolean search
+ nested chronological OOF
+ repeated sequential modeled-queue replay
+ frozen simultaneous hierarchy and scorecard gates
```

在这个身份下，BUY 与 SELL 都没有 supported side，不能进行 final refit，也不能打开 Validation 或 sealed holdout 来“救”候选。

证据阶段和权限不是同一个开关，而是一条单向链。令第 $k$ 级证据为 $E_k$、预先冻结的通过条件为 $G_k(E_k)$、下一阶段权限为 $A_{k+1}$，则：

$$
A_{k+1}=A_k\land G_k(E_k).
$$

一旦 Development gate 为 false，后面的 artifact refit、Validation、holdout、action 和 live 不会自动存在。每一级实际回答的问题如下：

| 层级 | 回答的问题 | 仍不能证明什么 |
|---|---|---|
| Design / preregistration | 问题、样本、B0、候选、fold、estimand 与 gate 是否在看结果前冻结 | 候选有效 |
| Development OOF | 只用过去数据的学习流程能否产生满足 hard gates 的候选 | 已存在最终固定 artifact |
| Final refit | 用完整 Development 是否得到唯一冻结规则 | 在新数据上复现 |
| Validation | 固定 artifact 是否在未参与 discovery 的日期复现 | 最终独立确认或部署许可 |
| Sealed holdout | 最后一次封存证据是否支持相同结论 | 实时延迟、队列与交易安全 |
| Research-supported action | 是否足以登记明确可执行的 action identity | Owner 必须上线 |
| Canary / live decision | 独立运维流程是否接受代码、配置、资本、资源与回滚风险 | 反向改写研究 gate 已通过 |

统计阶段与执行真实性还是两个独立坐标：

$$
\mathrm{Authority}=\mathrm{Statistical\ stage}\times\mathrm{Execution\ fidelity}.
$$

更高统计阶段不能把 modeled exchange-time queue 变成 strict native/receive-time truth；更好的 Python/C++ parity、cache identity 或 lifecycle engineering 也不能制造经济 uplift。研究链和运维链可以引用同一 artifact，却必须分别记录：

```text
research: design -> Development -> refit -> Validation -> holdout -> supported action
operations: candidate release -> safety gate -> canary -> observation -> promotion or rollback
```

![Full-Multiscale 的证据与权限边界](/images/narrowgate/full-multiscale-evidence-boundary.svg)

*图 14：研究完成到 historical Development OOF，并在门槛处停止；final refit、Validation、holdout、action 与 实盘有效性证据 都没有被创建。*

它没有证明多尺度状态毫无信息，也没有证明所有 state-to-duration policy 都无效。搜索本身是 bounded 的，queue 是 modeled 的，证据是 exchange-time Development，strict-native 同毫秒顺序、receive-time transport、exact lifecycle 和 final-artifact confirmation 都不在它的 authority 内。

BUY E3 可以被保留为高优先级 hypothesis，但未来若确认，必须在读取新证据前冻结 E3 的 feature、rule、threshold、action 和 statistical contract，并建立新的 confirmation identity。不能回到这 30 日上修改 hierarchy、缩窄区间、挑选聚类方法或重调 action rate。

任何后续 owner operational decision 也是独立权限。它可以显式接受未闭合风险，但不能倒写成本文的 research hard gates 已经通过。

## 14. 从这项研究得到的五个方法论结论

第一，**点估计与证据等级是两回事。** `+0.458577 USDC/day`、4/4 正 fold、13/20 正 day 和 97.29% fill retention 足以产生 hypothesis，却不足以覆盖 simultaneous uncertainty、tail 和 lifecycle failure。

第二，**matched control 比单独报告 fill retention 更有解释力。** E3 超出 action-matched control 的正点估计说明信号不完全来自减少参与，但区间跨零又说明这个语义增量尚不稳定。

第三，**feature hierarchy 必须在结果出来前冻结。** 否则研究者总能跳过失败的基础层，直接展示最漂亮的高阶 winner。

第四，**one-shot value 不能冒充 sequential policy value。** 在路径依赖的 maker 系统里，每一个订单动作都会改变后面的训练和评价样本。

第五，**软件修复不是研究创新。** 新 scheduler、新 cache key 或 mmap bugfix 应产生新的 execution attempt，而不是新的研究版本；只有 sample、baseline/candidate、fold、estimand 或 statistics 改变，才应建立新的 research identity。

## 15. 公开证据与阅读顺序

建议按下面的顺序阅读公共材料：

如果想先确认它在整个 NarrowGate 研究谱系中的位置，可先看 [十个研究族与 12 篇主研究长文的研究地图](/2026/08/29/NarrowGate-Research-Project-Map/)；下面的链接则是本项目自身的冻结证据链。

1. [Full-Multiscale prospective design](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f05_fill_quality_quote_ev/docs/causal_multichannel_window_boolean_cooldown_full_multiscale_successor_v1_spec_20260813.md)：原始研究问题与 candidate ladder；该 prospective companion 已撤回。
2. [Prospective withdrawal](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f05_fill_quality_quote_ev/docs/causal_multichannel_window_boolean_cooldown_full_multiscale_successor_prospective_v1_withdrawal_20260813.md)：说明零行 companion 不是历史数据缺失证明，也没有 live 改动。
3. [Offline successor Spec](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f05_fill_quality_quote_ev/docs/causal_multichannel_window_boolean_cooldown_full_multiscale_successor_offline_v1_spec_20260813.md)：30 日历史 Development、source gate、nested OOF 与权限边界。
4. [Formal Development component report](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f05_fill_quality_quote_ev/docs/causal_multichannel_window_boolean_cooldown_full_multiscale_successor_offline_formal_components_development_20260821.md)：BUY/SELL 聚合结果与最终决定。
5. [Public machine receipt](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f05_fill_quality_quote_ev/docs/causal_multichannel_window_boolean_cooldown_full_multiscale_successor_offline_formal_components_development_20260821.json)：结构化 evidence boundary、指标、hard-gate failure 和 permission。
6. [Execution-attempt normalization](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f05_fill_quality_quote_ev/docs/causal_multichannel_window_boolean_cooldown_full_multiscale_successor_execution_attempt_normalization_20260821.md)：解释为什么 `formal-v13` 到 `formal-v27` 是 attempts，而不是研究版本。
7. [Handoff completion audit](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f05_fill_quality_quote_ev/docs/causal_multichannel_window_boolean_cooldown_full_multiscale_successor_handoff_completion_audit_20260821.md)：区分已完成的 offline Development 与未到达的 final-artifact/confirmation 阶段。

## 结语：最值得保留的不是 winner，而是没有给 winner 补票

Full-Multiscale 给出了一个很容易被过度包装的结果：BUY E3 的均值更好，四个 fold 都为正，fill 几乎没有损失，而且胜过 matched control。如果目标只是写一张漂亮的研究图表，到这里已经足够。

但真正困难的部分，是在看到这些数字以后仍然遵守预先冻结的门槛：day-level simultaneous lower bound 跨零，hierarchy 不成立，tail 与 lifecycle 不通过，所以不 refit、不读 Validation、不打开 holdout，也不把 owner decision 写成 research confirmation。

对 maker 研究而言，这种克制本身就是结果。它没有给出一个可以宣布成功的通用 cooldown policy，却把“多尺度状态如何进入动作反事实、如何避免 one-shot aggregation、如何用 matched control 区分选择与减量、以及如何区分 research identity 与 execution attempt”讲得更清楚。

这比再找到一个历史 winner 更接近一套可以长期使用的研究方法。
