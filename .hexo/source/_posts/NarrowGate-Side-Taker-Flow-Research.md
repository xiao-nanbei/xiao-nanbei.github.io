---
title: 'NarrowGate Side-Taker Lifecycle：微观流、双时钟 Trade Identity 与动态 Risk Set'
date: 2026-08-29 13:30:00
updated: 2026-10-08 16:00:00
categories:
- Market Making
tags:
- Market Making
- Taker Flow
- Event Identity
- Risk Set
- 双时钟
math: true
---

## 阅读范围与后续响应动作研究

本文保留历史 side-flow／hazard 与 aggTrade parent 可见性合同。下文“特征只能等 parent 可见”是该历史输入合同的限制，不是所有后续 live 适配必须使用 aggTrade；旧 hazard 的关闭和阴性结论不改写。

后续[主动成交—盘口响应动作价值研究](/2026/10/08/NarrowGate-Response-Action-Baseline/)使用不同的输入、模型目标和动作合同，已经完成 204 个独立账户／407 日经济执行与身份收尾。冻结主候选晋升为后续研究 B0，不代表历史 hazard 成功，也不代表可部署交易。完整报告区分研究完成、live 代码存在、离线测试及真实环境尚缺证据。

## 1. 同一笔成交同时属于两种时间真相

Side-taker 研究最初想检验主动买卖流能否预示 maker fill quality，但很快发现输入事件、策略可见时间和订单风险集没有闭合。individual trades 提供 exchange-time 的撮合顺序；aggTrade parent 才接近 live 策略能整体看到的消息；订单自身又经历 submit、activation、partial fill、cancel request、cancel ACK 与 terminal。因此，流量特征、风险率和事件身份必须在同一条订单生命周期上对齐。

maker side 与 counterparty taker 的映射必须冻结：

$$
\text{BUY maker}\leftarrow\text{aggressive SELL},\qquad
\text{SELL maker}\leftarrow\text{aggressive BUY}.
$$

政策特征只能在 parent 的 feature-ready time 一次可见，queue matching 可以使用 child exchange order；两条时钟不能互相替代。订单 hazard row 也只能在区间起点仍处于 at-risk 状态时创建。

## 2. 研究阶段与证据状态

| 阶段 | 它真正问什么 | 结论/权限 |
|---|---|---|
| Side-specific taker flow | BUY/SELL 微观流是否对短时冲击有分侧信息？ | 描述信号存在；无 action |
| Static hazard M0 | 静态 side slope 能否复现并形成 gate？ | 标签/normalizer/支持不闭合；关闭 |
| Trade-clock parity | individual child 与 aggTrade parent 如何映射到 live 可见性？ | recorder contract 通过；finalized-parent parity 仍阻塞 |
| Event identity and risk set | Cancel、jump、repair、fill 应如何进入动态 lifecycle？ | v2 panel/gate 尚未完成；无 action |

## 3. Side-specific taker flow

### TL;DR：方向不是一个可以随手乘以正负号的变量

这项研究问的是：**BUY maker 与 SELL maker 在订单决策附近面对的主动成交流是否具有相同分布，以及短时对手方 taker flow 是否与随后成交质量稳定相关。** 对 maker 而言，BUY 单的直接对手是 aggressive SELL taker，SELL 单的直接对手则是 aggressive BUY taker。若先把方向混在一起，再用一个共享阈值解释所有订单，模型很容易把两种不同的库存语义和市场冲击压成一条假想的“对称规律”。

冻结的 Development 诊断确实发现了一个值得追踪的线索：在最初的订单决策状态里，亚秒级 aggressive SELL taker 更集中；BUY maker 成交附近的 100ms net counterparty pressure 与 maker-signed markout 呈负向关系。但这仍是 exchange-time、fill-conditioned association，不是“遇到这种流就应 cancel、widen 或 skip”的动作价值。更宽的 denominator 后来没有复现原始 100ms 信号，因此正确状态是**描述性线索保留，动作权限为零**。

![分侧 taker flow 与 maker 决策的机制示意](/images/narrowgate/side-taker-flow-kline.svg)

*图 1：机制示意。红色主动卖出流直接冲击 BUY maker；蓝色主动买入流直接冲击 SELL maker。研究状态只能在对应 `aggTrade` 的 feature-ready 时刻以后进入决策。*

### 1. 研究问题

“市场主动买入很多”对两侧 maker 并不意味着同一件事。正确的执行映射是：

$$
\text{BUY maker}\leftarrow\text{aggressive SELL taker},\qquad
\text{SELL maker}\leftarrow\text{aggressive BUY taker}.
$$

研究首先检验市场状态本身是否分侧，而不是直接搜索策略。它保留原始 BUY/SELL taker 字段，同时按 maker side 派生 `counterparty_taker_*` 与 `away_taker_*`。这样，“方向差异”指向可解释的对手方流，而不是模型内部一个含义模糊的 side dummy。

### 2. 输入、状态与 estimand

输入是 Binance futures individual trades 以及订单决策时的本地市场状态。成交按 100ms 右边界聚合，窗口为 100/250/500/1000/5000ms，状态包含 count、quantity、quote notional、arrival rate、same-side run、sweep range、burst ratio 与 maker-side adverse move。

若事件落在 $[t,t+100\text{ms})$，最早可用时刻是 $t+100\text{ms}$：

$$
t_{visible}=\left\lceil t_{event}/100\text{ms}\right\rceil 100\text{ms}.
$$

这项研究没有 treatment。主要 estimand 是同一可见市场状态下的分侧 flow 差异，以及 actual fills 内 flow 与 maker-signed markout 的描述性关联。它不是 action uplift，也没有 propensity、DR reward 或 库存生命周期 counterfactual。

为了避免把方向名词混成一个抽象分数，面板先保留两侧原始流，再构造 maker 语义。以窗口 $w$ 为例：

$$
P^{BUY\ maker}_w=\frac{Q^{SELL\ taker}_w-Q^{BUY\ taker}_w}{Q^{SELL\ taker}_w+Q^{BUY\ taker}_w+\varepsilon},
$$

$$
P^{SELL\ maker}_w=\frac{Q^{BUY\ taker}_w-Q^{SELL\ taker}_w}{Q^{BUY\ taker}_w+Q^{SELL\ taker}_w+\varepsilon}.
$$

这两个量都叫 counterparty pressure，却分别指向直接可能成交 BUY maker 和 SELL maker 的主动方。maker-signed markout 也必须统一“越大越有利”的符号：

$$
M_h(s)=s\frac{m_{t+h}-p_{fill}}{p_{fill}}10^4,
\qquad s=+1\ (BUY),\ s=-1\ (SELL).
$$

这样 BUY 成交后价格下跌与 SELL 成交后价格上涨都会得到负 markout，而不会因为 SELL 再翻一次符号制造假差异。

#### 一个具体的 100ms 例子

假设某个 BUY maker 决策前的一个完成窗口里，aggressive SELL taker 共成交 0.18 BTC，aggressive BUY taker 共成交 0.06 BTC。则 BUY maker 的 counterparty pressure 约为 $(0.18-0.06)/(0.18+0.06)=0.5$。这只说明当时直接冲向 bid 的流更强。若这组 child trades 直到窗口末端以后才被 parent `aggTrade` 发布，那么决策在 parent ready 之前仍必须使用旧状态；不能因为历史文件已经列出 child，就把 0.5 提前写进 feature。

如果该 BUY maker 随后成交，30 秒后 mid 比成交价低 0.8bps，那么 $M_{30s}=-0.8$bps。这个观测可以进入“高 pressure fill 的后续质量”描述，却不能回答：若当时 widen 一 tick，订单是否还会成交、库存是否会由后续 reducing fill 修复、库存生命周期 terminal 是否更好。后一个问题需要完整反事实 replay。

### 3. 数据与因果时钟

冻结输出包含 17 个 Development 日、1,448 个 库存生命周期-level order-decision states，BUY/SELL actual fills 各 170。Validation 与 sealed holdout 均未读取。

历史 individual trades 只有 exchange timestamp。它们可以用于撮合与 outcome truth，却不能假装成 live 策略即时看到的消息。正式策略特征必须等待 individual child 所属的 parent `aggTrade` 到达并完成 feature 处理：

$$
t_{policy}=t_{parent\ feature\ ready}\geq\max_i t_{child,i}.
$$

因此当前面板明确标为 `exchange_time_diagnostic`、`policy_eligible=false`。逐笔块内 interarrival 和 receive order 永久属于 diagnostic-only。

![Individual trade、aggregate parent 与策略可见双时钟](/images/narrowgate/f08-trade-parent-child-dual-clock.svg)

*图 2：child trades 决定 exchange outcome，但 parent 在最后一笔 child 完成并经过传输、特征处理后才可进入 policy state。若在第一笔 child 时就使用 parent 总量，就提前读取了其余 children。*

#### 3.1 为什么“100ms flow”有两种完全不同的定义

exchange-time 诊断可以把所有 child trades 按物理成交时刻落入 $[t-100ms,t)$，得到：

$$
Q^{ex}_{100}(t)=\sum_i q_i\mathbf 1\{t-100ms\le T_i^{ex}<t\}.
$$

策略可执行版本必须按 parent 的 ready time 入桶：

$$
Q^{ready}_{100}(t)=\sum_p Q_p\mathbf 1\{t-100ms\le T_p^{ready}<t\}.
$$

二者既不要求数值相同，也不要求最强窗口相同。parent 可能跨过多个 100ms 边界，且发布延迟具有长尾；同一串 child 在 exchange-time 图上表现为连续 burst，在 policy-time 图上可能是稍后一次跳变。研究若用前者发现信号、用后者执行，就发生了 feature identity transport，而不是无缝上线。

#### 3.2 Side mapping 不是符号翻转，而是条件分布变化

若只构造全市场 signed flow $I=(Q_B-Q_S)/(Q_B+Q_S)$，再给 SELL maker 乘以 $-1$，数学上虽然得到相反符号，却默认 BUY 与 SELL 的响应函数镜像：

$$
\mathbb E[M_h\mid I,x,side=BUY]
=
\mathbb E[M_h\mid -I,x',side=SELL].
$$

这个假设通常过强。两侧的 inventory role、spread distance、queue depth、baseline guard 与市场趋势分布都可能不同。正确做法是先统一“counterparty pressure 越高越危险”的语义，再分侧估计、分侧校准和分侧报告支持；不能因为字段公式互为相反数，就把样本也当成可交换。

一个典型的 Simpson 问题是：BUY fills 多出现在下跌日、SELL fills 多出现在上涨日。池化后 flow 与 markout 相关，可能只是 side/day composition；在 side 与 date 内部，关系接近零。宽 denominator 的复核正是在检验这类 composition shift，而不是单纯“增加样本量”。

#### 3.3 Burst、run 与 sweep 各自描述什么

数量 imbalance 只看方向总量；arrival rate 看单位时间事件强度；same-side run 看方向持续性；sweep range 看同一主动流跨越多少价格；burst ratio 则比较短窗与长窗强度。它们不是同一个“成交强度”的重复字段。

例如两个 100ms 窗口都包含 0.20 BTC aggressive SELL：窗口 A 是一笔 0.20 BTC、只在一个价位；窗口 B 是 20 笔各 0.01 BTC、连续扫过三档。总量相同，queue depletion 与信息含义可能完全不同。反过来，若这些 children 属于一个尚未 finalize 的 parent，live policy 在完成前又不能消费完整 run 或 sweep。

因此任何后续模型都应先声明字段所依赖的 source identity：哪些只需 parent price/side/quantity，哪些依赖 child sequence，哪些在历史数据中只能诊断。没有这个表，模型特征名即使相同，也可能在 research 与 live 中表示不同随机变量。

### 4. 研究演进

第一阶段只问“分布是否对称”，并在 1,448 行 eligible-state 面板上做窗口比较。第二阶段把同一思路带到更宽的 order-value denominator，检验早期 BUY 100ms 线索是否延续。第三阶段才考虑 hazard；它后来因 event identity、risk set 与复现失败而关闭。这里的版本是证据演进，不是三个可独立宣传的策略。

### 5. 结果与不确定性

在初始面板中，100ms BUY/SELL taker quote ratio 为 0.549，same-side max-run ratio 为 0.730；两项日聚类区间都支持亚秒方向差异。到 1s 和 5s，区间普遍穿过零，说明差异主要集中在短时尺度。

actual BUY fills 中，100ms net counterparty pressure 的 high-minus-low maker-signed markout 约为 -0.086bps，12 个可估日的日 bootstrap 95% 区间为 $[-0.815,-0.040]$bps。其他 BUY 窗口和全部 SELL 窗口均没有排除零。

但更宽的 277,368 行 denominator 中，100ms BUY/SELL quote ratio 变为 1.0022，BUY fill high-minus-low 变为 -0.0121bps，95% 区间 $[-0.1088,+0.0619]$bps。原始线索没有稳定复现。

可以把证据压缩成下表：

| 问题 | 初始 Development | 宽 denominator | 权限含义 |
|---|---:|---:|---|
| 100ms BUY/SELL quote ratio | 0.549 | 1.0022 | 方向差异未稳定复现 |
| BUY fill high-minus-low markout | 约 -0.086bps | -0.0121bps | 宽样本区间跨零 |
| SELL 各窗口 markout | 多数区间跨零 | 未形成稳定排序 | 不支持共享或分侧 action |
| policy clock | exchange-time proxy | parent ready 必需 | 当前 panel 不可执行 |

初始日 bootstrap 区间虽然没有跨零，但它只量化在那组日期上聚合差异的不确定性，并不包含窗口选择、fill conditioning、历史/live clock 差异和 denominator 迁移的不确定性。宽样本复核正是用来暴露这些没有进入最初区间的研究风险。

### 6. 为什么相关性不能直接变成动作

假设高 counterparty pressure 的 BUY fills 平均更差，至少有三种完全不同的机制解释。第一，pressure 真正使当前 resting order 更容易发生有毒成交，此时 cancel 或 widen 可能有价值。第二，pressure 只是标记一个已经恶化的 库存生命周期，删除当前 fill 会失去本可较快修复库存的机会。第三，订单只有在 queue、距离和 baseline eligibility 特定组合下才会成交，fill-conditioned 样本把选择机制带进了相关性。

动作价值必须比较同一个 decision surface 上的潜在结果：

$$
\Delta(x)=E[Y(\text{candidate})-Y(\text{baseline})\mid X=x],
$$

并让两条路径分别重放 cancel、ACK、queue reset、fill、inventory 与 terminal。当前研究没有这个设计，所以最诚实的输出是 hypothesis，而不是 policy。

#### 6.1 Fill-conditioned association 的 collider 问题

进入 actual-fill 子集本身由报价距离、queue ahead、未来 taker flow 和 baseline cancel policy共同决定。用因果图语言，$F$ 同时受 flow $X$ 与订单状态 $Q$ 影响；条件于 $F=1$ 后，原本弱相关的 $X$ 与 $Q$ 可能被人为关联。于是：

$$
\mathbb E[M\mid X,F=1]
$$

不等于同一 decision denominator 上改变 $X$ 或报价动作的效果。高 pressure bucket 更差，可能只是高 pressure 让本来排得更深、状态更脆弱的订单进入了成交样本。

要减轻这个问题，下一步至少应在所有 baseline-eligible decisions 上保留 no-fill rows、activation 与 queue state，并用明确 lifecycle target。最终若研究 cancel/widen，还需要动作分配或同路径 counterfactual，而不是对 filled-only 分数加阈值。

#### 6.2 原始线索为什么值得保留，却不能作为“失败后删除”

初始 BUY 100ms 结果有清楚的方向与日期区间，它仍然是可审计的 hypothesis origin。宽 denominator 没有复现，意味着当前 identity 的 transport 失败，而不是早期数字从未发生。保留两者可以防止以后又在同一小分母上重复发现相同线索并误称为新证据。

真正能重开的结果应同时满足：预先冻结 maker-side mapping；使用 parent-ready 特征；在未参与窗口选择的未来日期复现；相对于只含 inventory_lifecycle/order state 的 M0 有增量；并且有足够 top-risk support。之后最多获得 action-registration eligibility，仍不是动作通过。

#### 6.3 读图时应把 K 线放在哪一层

K 线只是把 price path 压成可视窗口。红色长阴线附近 aggressive SELL flow 增强，既可能是信息型卖出导致下跌，也可能是下跌触发更多市价卖出；仅从同一窗口无法辨别方向。研究通过“只用决策前完成窗口、未来 markout 只作标签”阻止最直接的时间穿越，却没有创造外生冲击。

所以图 1 的用途是解释 maker side 与流向，图 2 的用途是解释信息何时可见。两张图都不是“看到红 K 就撤 BUY”的策略图。一个可执行图还必须画出 baseline 与 candidate 两条订单/库存路径，并以 terminal value 收尾；本项目尚未到那一层。

#### 为什么版本必须写进同一主文

窗口描述、maker-side mapping、宽 denominator 复核和 hazard gate 回答的是同一条研究链上的不同问题。只有输入状态、目标、面板和统计契约共同冻结后，才形成可以单独下结论的 research identity。这些实现检查没有增加独立验证样本；Validation 与 holdout 从未打开。

### 7. 关闭与支持边界

这项研究支持三件事：maker side 必须按真实对手方映射；亚秒流可能比分秒级聚合更不对称；任何策略特征必须服从 parent `aggTrade` 的可见时钟。

它不支持把一个窗口、一个相关系数或一个 fill-conditioned bucket 变成动作。初始信号也不能因“方向符合直觉”而跳过宽 denominator 复核。

### 8. 没有获得的权限

- 没有 keep/cancel、widen、recenter 或 cooldown action 权限；
- 没有 Validation、sealed holdout 或 live 权限；
- 没有 raw individual receive-time 的可执行特征权限；
- 没有把 BUY 结论复制给 SELL 的权限。

### 从交易方向到 maker side 的完整映射

aggressor BUY表示主动买方跨过spread、消耗ask；它直接冲击的是挂在ask上的maker SELL订单。aggressor SELL消耗bid，直接冲击maker BUY。若研究的是“同侧未来价格延续”，符号可能与订单受击side相反；若研究的是inventory role，又必须结合当前$q_t$判断该fill是在add exposure还是reduce inventory。

因此一笔trade至少有三种side标签：taker aggressor side、resting maker side、inventory role。它们的映射为

$$
maker\_side=-taker\_side,
\qquad
role=\operatorname{sign}(\Delta |q|),
$$

第二个等式只在给定fill前库存后才能判断。把三个字段压成一个BUY/SELL，会让同一flow在不同文章里看似反号。一个可审计panel应同时保留原始aggressor flag、归一化maker side与pre-fill inventory。

### Parent/child 聚合为何会制造假 burst

公共aggTrade parent可能包含多个individual executions。若既保留parent quantity，又把所有child quantity相加，flow会重复计算；若只取parent最终记录并把ready time回填到第一个child，又会提前暴露尚未完成的aggregate。正确做法取决于用途：matching/queue使用individual child exchange sequence；策略flow feature可以在parent ready后原子发布聚合值。

设parent $P$有children $i=1,\ldots,n$，则可见flow应在$t_{ready}(P)$一次增加$\sum_i q_i$，而不是在每个$t_i^{exchange}$逐个可见。对exchange truth则保留每个$t_i$的价格、数量与stable order。两条序列可以来自同一原始家族，却服务不同因果事实。

### 一个合法 action successor 应怎样使用 flow

首先在未条件化fill的decision rows上评估flow对future touch、fill cause与markout的增量；随后按maker side与inventory role分层。只有某个state同时满足足够日期、非退化action overlap与稳定条件价值，才冻结局部动作如widen、cancel或keep。

动作实验还必须在flow unavailable时回退baseline，不能把missing映射成零；burst/run/sweep thresholds必须在新outcomes前冻结。若只发现“高SELL flow后的BUY fills更差”，仍不能推出取消所有BUY，因为filled-only样本遗漏了被动作改变的未成交与repair路径。最终判断仍需要paired 库存生命周期 terminal value。

### Flow normalization 与 price impact 不是同一个对象

raw signed quantity会随总体交易活跃度放大；除以总量得到imbalance又在低量bucket里极不稳定。可以同时保留signed BTC、signed notional、imbalance和event count，但每个字段有不同单位与missing规则。不能从中看哪个与outcome相关就事后选一个叫“flow”。

flow与价格还存在机械同步：aggressive BUY通常在ask成交，本身就与短时上行同源。研究未来return时要确保feature window结束在label window开始前，并用本地price/volatility baseline判断外部或side信息的增量。否则模型只是重述当前价格已经动了。

### 负对照可以发现哪些时钟错误

将flow time整体向未来错移一个bucket不应改善causal score；使用尚未ready的parent-complete quantity若异常强，提示lookahead。随机打乱同日parent顺序应破坏短期关系而保留日级activity；若仍高分，模型可能只学日期regime。

这些negative controls不能代替lineage audit，却能快速暴露聚合、side或clock实现错误。通过后仍只获得prediction资格，动作层必须另行验证。

### 9. 公共证据

- [`side_specific_taker_flow_research_20260723.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/docs/side_specific_taker_flow_research_20260723.md)
- [`side_taker_hazard_m0_v1_20260723.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/docs/side_taker_hazard_m0_v1_20260723.md)
- [`F08 README`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/README.md)

### 结语

分侧不是把同一个模型复制两份，而是先承认两侧面对的对手方、库存风险和修复路径不同。这个研究留下的是一条可检验线索和一条严格时钟边界，不是一条可以上线的规则。

## 4. Static hazard M0

### TL;DR：模型关闭，不是因为 AUC 不够漂亮，而是问题本身没有被正确识别

`side_taker_hazard_m0_v1` 试图用分侧 taker-flow 与订单状态预测 favorable fill 和 adverse fill。SELL split 的 balanced loss 一度优于 pooled model，看起来像“分侧模型有效”；审计却发现，fill、baseline cancel、legacy price jump 和 库存生命周期 repair 被塞进同一个 first-event competing-risk 表，pooled 与 split 还使用了不同 normalizer、intercept 和正则几何。更宽 denominator 也没有复现最初 BUY 100ms markout 信号。

因此，这不是一个可以靠调阈值、加 cause 或换模型救活的弱阳性结果。正确结论是：**静态 M0 关闭，Validation 与 holdout 不读，先重建 event identity 和 start-stop risk set。**

![Side-Taker Hazard M0 的事件竞争与错误混合](/images/narrowgate/side-taker-hazard-m0-kline.svg)

*图 1：机制示意。订单激活后，fill 属于市场 outcome；cancel request 是策略动作；price jump 是状态转移；repair 是 delayed-entry 库存生命周期 事件。把四者当作同质 first cause 会改变 estimand。*

### 1. 研究问题

研究原本希望回答：给定决策时可见的分侧 flow 与盘口状态，订单在下一时段发生 favorable/adverse fill 的风险是否可以稳定排序，并且 side-specific model 是否优于 pooled model。

离散时间 hazard 可写成：

$$
h_{s,k}(x_t)=P(T\in[t_k,t_{k+1}),J=s\mid T\ge t_k,x_t),
$$

其中 $s$ 应当是定义清楚的市场 outcome。若 cancel 是 behavior-policy stopping time、jump 后订单仍存活、repair 只有在 inventory 非零且 reducing path active 后才进入风险集，它们就不能与 fill 共享一个从 decision timestamp 开始的齐次 risk set。

### 2. 输入、输出与 estimand

冻结面板有 277,368 行、18 日，包含 native book state、分侧 taker-flow、订单 first event 与 库存生命周期 字段。模型比较 pooled 与 BUY/SELL split 的 favorable/adverse fill heads，输出 balanced log loss 与 AUC。它没有动作，也没有 库存生命周期 reward。

冻结标签的真实身份是 `exact_order_id_mixed_market_policy_inventory_lifecycle_first_event.v2`，不是纯市场 competing risk。171,839 个 adverse-jump first events 全部来自 legacy `adverse_price_jump_ts_ns`；只有 26,304 个与 native future-mid first-hit 完全一致。

模型在每个离散区间里用 logistic link 估计 cause-specific probability：

$$
\operatorname{logit}h_{j,k}=\alpha_{j,k}+\beta_j^\top x_k.
$$

如果每条 row 的 outcome 是 one-hot cause，常见损失可以写成：

$$
\mathcal L=-\sum_{i,k,j}w_{i,k,j}\left[y_{i,k,j}\log h_{i,k,j}+(1-y_{i,k,j})\log(1-h_{i,k,j})\right].
$$

这里的数学没有错，问题在 $y$ 与 at-risk set 的语义。把 baseline cancel ACK 标成自然 cause，会让模型学习当前策略何时取消，而不是订单在“不取消”条件下会怎样；把 repair 从 decision 时刻起算，则会给尚未持有库存的订单虚构 repair exposure。

#### 一个会改变结论的事件例子

设订单在 10:00:00.200 激活，10:00:01.000 策略发出 cancel request，网络与交易所延迟使 ACK 到 10:00:01.080 才生效。订单在 10:00:01.050 partial fill。若表只保留“第一事件为 cancel ACK”，这 50ms 的真实 fill risk 和 pending-cancel fill 会消失；若把 request 当 terminal，又会把合法成交错当未来信息。正确 interval 至少是：

| start | stop | remaining before | event | 风险含义 |
|---|---|---:|---|---|
| activation | cancel request | 0.001 BTC | none | 普通 active fill risk |
| cancel request | partial fill | 0.001 BTC | fill 0.0004 | pending-cancel 仍可成交 |
| partial fill | cancel ACK | 0.0006 BTC | ACK | ACK 终止剩余 exchange risk |

这种差异不是实现细节。keep/cancel action 的反事实正发生在 request 到 ACK 之间，丢失区间会系统性扭曲 action cost 或收益。

### 3. 数据与因果时钟

chronological OOF 有 135,610 行、9 个 future test folds，但训练/测试最晚日期早于最初假设窗口。它是 internal chronological OOF，不是相对于假设形成过程的 confirmatory future evidence。

individual trades 只能提供 exchange-time matching truth。策略侧 taker-flow 还必须等待 mapped parent `aggTrade` 的 feature-ready clock。块内 child receive order、interarrival 与 feature-ready time不可被历史 replay 发明。

![Outcome child 与 policy parent 的双时钟边界](/images/narrowgate/f08-trade-parent-child-dual-clock.svg)

*图 2：hazard label 可以用 individual-trade outcome truth；hazard covariate 只能在 aggregate parent 完成并 feature-ready 后更新。同一批成交若同时以 child 时间充当输入和未来 outcome，会形成隐蔽的自我预测。*

#### 3.1 一个合法 start-stop 面板应长什么样

静态一行表通常把订单从 decision 到 first event 压成 $(x,T,J)$。动态面板应拆成：

$$
(id,t_{start},t_{stop},q_{remaining},phase,x(t_{start}),event).
$$

只有当订单已经 activation、remaining quantity 为正且尚未 exchange-terminal 时，fill-risk indicator 才为一。partial fill 会结束当前 quantity spell 并启动下一段；jump 只更新 $x$；cancel request 改变 phase；ACK 才使旧订单吸收。

这样模型估计的是：

$$
\Pr(J=j,T\in[t,t+\Delta)\mid Y_F(t)=1,\mathcal H_t),
$$

而不是“从一个尚未存在的订单决策开始，先看到哪个日志字段”。二者在 cancel 较多、fill 较少时会产生完全不同的 loss 权重。

#### 3.2 Parent-ready feature 为什么必须落在 interval 左端

一个 interval 的 covariate 应是其开始时已经可见的状态。若 parent 在区间中间才完成，最早只能进入下一条或在完成时切出新 interval；不能把其全量回填到区间开头。形式上要求：

$$
t_{feature-ready}\le t_{start}.
$$

如果为了方便将 feature 与最近 exchange timestamp 对齐，某个 adverse fill 所属 parent 的总量可能被写进 fill 发生前的 covariate。模型会“预测”它正在用作 label 的同一事件，AUC 看起来提高，却没有任何实时可执行意义。

### 4. 研究演进

早期版本把 native book 的存在误写成“native first-hit label 已用于 competing risk”。corrected audit 将标签、comparison geometry 和 day count 逐项核对；`event_identity_and_riskset_v1` 随后把根因冻结为 estimand 不可识别，并要求 v2 输出 activation、remaining quantity、cancel request/ACK、partial fill 和 delayed-entry repair。修正报告与风险集 successor 是同一研究主线，不是多个独立项目。

版本合并的理由很具体：旧 report、corrected report、v1 blocker audit 和 v2 lifecycle contract 都围绕同一个 foreground question——“分侧 taker flow 能否在正确生命周期上预测 fill risk”。其中 report correction 没改变研究问题；risk-set v2 则改变了未来可接受的 estimand，但仍是同一项目的必要 successor。若把每个文件写成独立文章，读者会误以为已经有四次经济实验，实际上一次动作实验都没有发生。

### 5. 结果与不确定性

BUY favorable/adverse split AUC 为 0.507/0.514，balanced-loss composite 更差。SELL 为 0.467/0.532；corrected composite 只能使用 7 个双-head 完整日。SELL 的 loss 改善主要来自整体概率校准，排序仍接近随机。

更重要的是，初始 1,448 行面板中的 BUY 100ms flow-to-markout 线索没有在宽样本延续：high-minus-low 从约 -0.086bps 缩到 -0.0121bps，日聚类区间跨零。这个变化说明不能把一次小面板上的方向感当作稳定 predictive identity。

结果的完整读法如下：

| Maker side | Head | 1s OOF events | Split AUC | Split-minus-pooled loss |
|---|---|---:|---:|---:|
| BUY | favorable fill | 26 | 0.507 | +0.05538 |
| BUY | adverse fill | 30 | 0.514 | +0.00597 |
| SELL | favorable fill | 26 | 0.467 | -0.04793 |
| SELL | adverse fill | 41 | 0.532 | -0.00823 |

负 loss delta 只表示在各自缩放、intercept 和 regularization 下的概率损失更低，不能归因于 side-specific slopes。尤其 SELL favorable AUC 低于 0.5、adverse 仅略高于 0.5，说明“校准改善”与“排序出可行动高风险订单”是两回事。

#### 5.1 pooled 与 split 若比较几何不同，loss 差不再是 side 信息

要把 split-minus-pooled loss 解释成“分侧斜率有增量”，两者至少要共享 feature transform、训练权重、regularization grid、intercept 处理和 outer test rows。否则差值可以来自：

$$
\Delta L
=
\Delta L_{side slopes}
+\Delta L_{scaling}
+\Delta L_{intercept}
+\Delta L_{regularization}
+\Delta L_{rows}.
$$

旧 identity 没有把后四项冻结为零。因此 SELL loss 较低不能归因给 side-specific taker-flow；它可能只是在各侧单独拟合 base rate。corrected composite 只有 7 个双-head 完整日，又进一步限制了时间外解释。

一个公平 successor 应在同一 nested chronological fold 内拟合 pooled 与 split，所有 preprocessing 只在 train 完成，test rows 完全相同，并把“只允许 side intercept”作为独立 M0。split slopes 只有超过这个 M0，才说明方向性交互不只是两侧基准概率不同。

#### 5.2 AUC、balanced loss 与 action support 各回答不同问题

AUC 只关心随机正例是否排在随机负例前；balanced loss 同时关心概率幅度，并人为平衡稀少 cause；action support 则关心 top-risk 区域有多少真实机会和生命周期。一个 head 可能 AUC 略高却严重失准，也可能 loss 改善却所有高分集中在一两天。

对撤单候选，最小可读报告还应包括：top-$q$ score 的 eligible orders、support days、fills、adverse/favorable 分解、common-risk-set overlap，以及 score threshold 在每个 outer train 中的来源。没有这些，0.532 的 AUC 既不能说明经济大小，也不能说明能执行多少动作。

#### 5.3 结构性失败为什么比统计阴性更强

如果只是区间跨零，未来更多独立数据可能提高精度；这里 event identity 本身混合了 outcome、policy stop 与 state transition。样本量趋于无穷时，模型会更精确地学习这个混合对象：

$$
J^{old}=\min(Fill,CancelPolicy,LegacyJump,RepairEntry),
$$

而不是目标 $J^{fill}$。因此“不打开 Validation”不是保守偏好，而是防止用宝贵未来数据评估一个没有可解释目标的问题。

### 6. 正确 successor 必须回答什么

新的 dynamic hazard 不能简单把旧表换成长表。它必须同时满足四个条件：activation 后才进入 fill risk；cancel request/ACK 与 pending fill 分开；native jump 作为 non-absorbing transition；repair 使用 delayed entry。预测 feature 还必须在 mapped parent `aggTrade` ready 后才可见。

若这些条件通过，评价也不能只看 AUC。至少需要 side-specific Brier skill、calibration、day-cluster uncertainty、top-risk support，以及未来动作表面的 overlap。一个有效 prediction 最多允许登记新的 randomized action experiment；它本身不能设置 `action_family_allowed=true`。

预测到“高 adverse-fill hazard”仍不等于 cancel 有正值。动作会丢掉 queue position、改变 re-entry、fill mix 与后续 库存生命周期，正式 reward 至少需要：

$$
R=V_{fill}-C_{库存生命周期}-C_{queue\ reset}.
$$

M0 没有 propensity 或 paired full path，因此没有能力估计这个量。

### 7. 关闭边界

静态 M0 的精确特征、标签、比较结构与面板已经关闭。不能通过删除 unfavorable head、换成更多 bins、调整正则或打开 Validation 来救它。

关闭 M0 不等于所有 time-varying side hazard 都无效。新的身份必须先通过 lifecycle v2 与 historical/live aggregate-clock parity，再在没有参与窗口选择的 retained later days 上复现原始信号。

### 8. 没有获得的权限

- `predictive_split_gate_passed=false`；
- `followup_randomized_experiment_registration_eligible=false`；
- `action_family_allowed=false`；
- Validation、sealed holdout、live 均未获得权限。

### Start-stop 风险集里的三个经典陷阱

第一个是immortal time：若一张订单必须存活到第一个完整100ms bucket才入样，那么从activation到该bucket的时间不能被悄悄忽略；它要么作为暴露进入risk set，要么明确left truncation。第二个是post-event leakage：一旦fill/cancel/terminal发生，之后的rows必须停止，不能继续用已知幸存状态生成负例。第三个是same-time ambiguity：feature ready、trade与terminal在同一毫秒但缺少先后时，应censor或标unknown，不能用文件行序猜顺序。

离散competing-risk数据可写为每个订单的区间序列$(L_k,R_k]$，仅当订单在$L_k$仍at risk才创建row。cause-specific outcome包括fill、cancel ACK、expiry等；no event只表示该区间内继续生存。这样模型估计的是

$$
h_{k,c}=P(T\in(L_k,R_k],J=c\mid T>L_k,X_{L_k}),
$$

而不是对所有时间戳做普通classification。

### Pooled 与 side-split 的公平比较

要检验side-aware信息，pooled M0与BUY/SELL split M1必须使用相同rows、相同时间grid、相同baseline family与相同proper score。若split模型获得不同censor rule、更多features或不同regularization，loss差混合了side与pipeline变化。

一个干净的增量写法是在pooled model中加入side interaction，再与无interaction版本比较：

$$
\eta_{k,c}
=
f_c(X_k)+\mathbf1[side=BUY]g_c(X_k).
$$

若$g_c$在chronological OOF中改善proper loss且两侧support充分，才说明side结构有预测增量。即便如此，action还需要知道hazard cause后的value；更高fill hazard可能是机会，也可能是adverse selection。

### 结构失败之后为什么不能继续报 AUC

当risk-set start/stop、parent-ready或比较几何不一致时，标签和可见特征不再指向同一estimand。此时AUC可以非常高：模型可能只识别订单年龄、终局残留或提前可见的parent completion。漂亮分数反而是泄漏警报，而不是保留模型的理由。

正确successor先在不看outcome的情况下验证row counts、exposure conservation、terminal stop与clock ordering，再进行prediction。只有数据对象通过，AUC、Brier与calibration才有意义；只有prediction通过，才轮到动作价值。本项目的关闭因此比“模型没显著”更基础：旧M0/M1 comparison geometry本身不能继续解释。

### Hazard calibration 应按 risk time 而不是 row count阅读

订单早期和晚期rows的base hazard不同；大量长寿低风险rows可能让总体Brier好看。应按age band、side、event cause与day比较predicted/observed，并给at-risk exposure。若模型在最常触发action的早期区间失准，总体AUC没有补救作用。

多cause概率还需满足每bucket总和不超过1，survival与CIF质量守恒。一个head单独calibrated、合起来却超过1，说明独立binary construction无法作为competing-risk系统消费。

### Outcome-blind risk-set validator

在训练前可验证：每个order只有一个activation、remaining quantity单调不增、terminal后零rows、区间时间严格正、source/ready不倒退、same-time ambiguity有明确标记、各cause terminal唯一。再按order重算暴露与row builder汇总对账。

这些检查不读取哪个模型更好，所以可在不花费统计确认机会的情况下反复修复。M0的结构失败告诉后继先把validator做到零违例，再谈side split。

### 9. 公共证据

- [`side_taker_hazard_m0_v1_20260723.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/docs/side_taker_hazard_m0_v1_20260723.md)
- [`event_identity_and_riskset_v1_20260723.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/docs/event_identity_and_riskset_v1_20260723.md)
- [`side_specific_taker_flow_research_20260723.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/docs/side_specific_taker_flow_research_20260723.md)

### 结语

一个 hazard 模型首先必须知道“谁在风险集中、什么事件终止风险、什么事件只是策略动作”。当这些身份没有分开时，模型分数再精细也不能获得动作含义。

## 5. Trade-clock parity

### TL;DR：撮合真相与策略可见信息不是同一条时间线

Binance Vision individual trades 适合回答“撮合按什么顺序发生、队列消耗了多少”；live USD-M `aggTrade` 才回答“策略在什么时刻看见一组主动成交”。把 child exchange timestamp 直接当成策略特征时钟，会让 replay 比 live 提前知道一个尚未发布完成的 aggregate block。

这项研究建立了 child-to-parent 映射、recorder source contract 和 historical/live parity。结果是：recorder-v2 的身份、方向、价格、时间和 parent-prefix gate 通过；但 finalized historical parent 可能在 live slice 之后继续吸收同价同方向成交，所以 `q/f/l` 的 exact payload replay 不能仅凭日后下载的 finalized parent 宣称完成。

![Individual trade、aggregate parent 与策略可见时钟](/images/narrowgate/binance-trade-clock-parity.svg)

*图 1：冻结机制图。上轴是 exchange-time child truth；下轴是 parent `aggTrade` 的 receive/feature-ready 时钟。队列可在上轴消费，policy feature 只能在下轴更新。*

![Parent/child 身份与 live 可见性的拆分](/images/narrowgate/f08-trade-parent-child-dual-clock.svg)

*图 2：结果层按 child 保留精确撮合顺序；输入层按 finalized-at-the-time parent 更新。历史最终对象比 live slice 更完整，不代表新增 children 在早先决策时已经可见。*

### 1. 研究问题

目标不是寻找 alpha，而是回答一个数据身份问题：历史 individual trades、历史 finalized `aggTrades` 与 live `aggTrade` slice 能否构成一个不会制造未来信息的重放合同。

若一个 parent 覆盖 child IDs $[f,l]$，基本守恒条件为：

$$
Q_{parent}=\sum_{i=f}^{l}q_i,
$$

并同时核对 price、aggressor side、timestamp span 与 ID continuity。存在内部 ID gap 时，aggregate timing 仍可保留，但 `queue_outcome_exact=false`。

### 2. 输入、动作与 estimand

输入包括 Vision individual trades、Vision/REST aggregate parents，以及同窗 live USD-M `aggTrade` recorder。没有策略动作。估计对象是 mapping coverage、field parity、canonical-prefix compatibility、trade-to-receive lag 和 feature-processing latency。

策略可见下界冻结为：

$$
t_{ready}=\max(t_{parent\ transact},\max_i t_{child,i})+L_{receive}+L_{feature}.
$$

零延迟或空 latency profile 只能用于 diagnostics。

#### 一个 parent extension 的具体例子

live recorder 在某一时刻收到 aggregate ID `278461494`，当时 slice 覆盖 child `541603974..978`，数量为 0.049 BTC。日后 REST finalized parent 覆盖到 `541603974..982`，数量变成 0.265 BTC；新增四笔均在首笔后 95ms 内发生，并且价格、方向一致。

对 live 策略而言，前一个 slice 就是当时完整可见的信息；对日后数据库而言，后一个 parent 才是 finalized object。两者可以满足 prefix relation：

$$
[f_{live},l_{live}]\subseteq[f_{final},l_{final}],\qquad Q_{live}\le Q_{final},
$$

却不满足 exact payload identity。研究因此同时报告 `canonical_parent_prefix_compatible=true` 与 `exact_quantity_complete_fl=false`，而不是让一个布尔值覆盖另一个。

### 3. 数据面板与两个时钟

2026-07-20 全日含 986,452 条 individual rows、480,479 条 aggregate rows；480,435 个 aggregate ranges 精确，44 个 range 有内部 ID gap。它们的现有 child 在价格、方向与数量上仍守恒，但不能进入 strict queue outcome。

2026-07-23 的 600 秒 recorder-v2 capture 含 2,421 个 BTCUSDC live aggregates。所有 live IDs 都与官方 parent 对齐，price/side/timestamp/first child 为 100%，每个 live slice 都是 canonical parent 的合法前缀。

三个数据对象的权限应当明确分工：

| 数据对象 | 精确支持 | 不能支持 |
|---|---|---|
| Vision individual trades | exchange-time matching order、child quantity、queue consumption | live receive time、块内 policy visibility |
| Vision/REST finalized aggTrades | parent lineage、日后完整 `f..l` 与 aggregate conservation | 当时 live slice 的 exact payload |
| live recorder-v2 aggTrade | receive/feature-ready、实时 slice、source contract | 未落盘的未来 parent extension |

只有三者在各自角色内对齐，replay 才能同时保留 outcome truth 与信息可用性。

#### 3.1 一个 parent 是“随时间增长的对象”还是“一条不可变记录”

日后下载的 aggregate row 看起来像不可变记录，但 live 观察到的是一个时间切片。更安全的抽象是累积过程：

$$
P_p(u)=\{i:f_p\le id_i\le l_p(u),\ T_i^{ex}\le u\},
$$

其中 $l_p(u)$ 与累计 quantity 随 parent 尚在延伸而增长。历史 finalized row 是 $P_p(\infty)$；live recorder 在 receive 时保存的是 $P_p(u_r)$。两者 aggregate ID 相同，不代表 payload at time 相同。

如果 replay 只有 finalized row，却把全量 $Q_p(\infty)$ 放到第一个 child 的时刻，就同时犯了两次提前：提前知道 parent 已经结束，也提前知道之后才发生的 quantity。prefix-compatible 合同只能证明 live slice 属于最终 parent，不能证明最终 payload 可用于 slice 时刻。

#### 3.2 Queue truth 与 information truth 为什么可以使用不同 source

撮合模拟需要知道 aggressive quantity 如何按价位消耗公开队列，因此 child 的 exchange order、price、qty 是 outcome mechanics。策略特征则只能使用当时收到的消息。两套 source 并用并不矛盾，只要身份边界明确：

$$
\mathcal H_t^{market\ outcome}
\supseteq
\mathcal H_t^{policy\ visible}.
$$

回放引擎可以用更完整的 outcome history 决定“订单实际上是否会成交”，却必须向策略屏蔽尚未 ready 的部分。就像离线仿真知道未来 K 线，也不能把未来收盘价喂给当时模型。双时钟 adapter 的职责正是维持这条信息防火墙。

#### 3.3 Internal gap 为什么只影响 strict queue，不必删除整天

44 个 aggregate ranges 有 child ID gap。若缺失 child 的价位或数量未知，严格 queue consumption 不能证明完整；但 parent lineage、已观察 price/side 和保守 ready time 仍可能有效。正确做法是按用途降级：

- strict queue outcome：该 range fail closed；
- aggregate policy clock：若 source contract 完整，仍可保留 parent ready；
- child-derived run/interarrival：unsupported；
- 其它无关时段：不必整日删除。

这种字段级 authority 比“数据日好/坏”的单布尔更精确，也避免把少量 gap 变成幸存者偏差：只保留完全平静的日期，可能反而改变市场分布。

### 4. 研究演进

recorder-v1 没保存 `f/l`、typed schema 和 source contract，因此即使基础字段全部匹配，正式状态仍 blocked。v2 增加 aggregate ID、`f/l`、range-derived child count、`q/nq` 与 source identity。随后发现一条 live slice 的 parent 在 95ms 内继续扩展：live 当时看到的是 child 974..978，REST 最终 parent 延伸到 982。这不是 recorder bug，而是实时切片与日后 finalized database object 的语义差异。

这条 lineage 里有 recorder 版本、mapping audit 和 parity result，但只有一个研究项目：建立可执行 trade-information contract。v1 的字段缺失是采集契约不足；v2 的 source contract 是同一项目的修正；parent extension 是研究发现。三项变化都属于输入契约的修正，不应计为三次独立实验。

### 5. 结果与不确定性

recorder/live source contract 通过；2,421/2,421 aggregate IDs matched；exact quantity 和完整 `f..l` 为 99.958695%，其中 1 个 parent 发生扩展。

该窗口的 trade-to-receive lag p50/p95 为 109.64ms/1,293.12ms，feature latency p50/p95 为 106.32us/3.808ms。前者包含 Binance 聚合与发布等待，不能命名为纯网络延迟。

一个扩展样本足以阻止“finalized payload 精确复刻 live slice”的绝对声明，却不能否定 recorder contract。这里的不确定性是数据对象在时间中的演化，不是传统置信区间。

gate 面板更清楚地说明这一点：

| Gate | 结果 |
|---|---:|
| recorder/live source contract | passed |
| matched aggregate IDs | 2,421 / 2,421 |
| price / side / timestamp / first child | 100% |
| canonical-prefix compatibility | 100% |
| exact quantity and complete `f..l` | 99.958695% |
| parent extensions | 1 / 2,421 |

不能把 99.958695% 四舍五入成“100% 因果复刻”。一个错误发生率很低的字段，只要进入 policy threshold 或 queue count，就可能在关键订单上改变动作。fail-closed 的意义正是让罕见身份差异保留为显式 unsupported mass。

#### 5.1 延迟分布不是一个可随手相加的常数

trade-to-receive p50 约 109.64ms、p95 约 1,293.12ms，包含 parent 聚合等待、venue publish、网络、host scheduling 与 recorder path。feature latency p50 约 106.32us、p95 约 3.808ms，则是收到消息后的本地处理部分。端到端 ready lag 是联合分布：

$$
L_{ready}=L_{aggregate/publish/network/receive}+L_{feature}.
$$

不能用两个边际 p95 相加宣称端到端 p95，也不能把第一个量命名为“网络延迟”。若未来 replay 需要采样 latency，应保存 paired observations 或保守 joint profile；随机独立拼接两个边际会改变尾部。

这对 100ms 特征尤其关键：当 receive lag p95 超过 1 秒时，exchange-time 的 100ms burst 可能在策略时钟里晚很多个决策窗口到达。一个只在零延迟回放有效的亚秒特征，必须单独过 transport gate。

#### 5.2 五层 parity，不应压成一个 pass/fail

这项研究实际区分：source contract、aggregate ID mapping、price/side/first-child parity、prefix compatibility、exact payload completeness。前四层通过而第五层 99.958695%，所以结论既不是“全部失败”，也不是“完全一致”。

层级化报告能告诉下游哪些字段可用。仅依赖 parent direction 的模型可能继续研究；依赖 finalized quantity 或 child count 的模型必须做 extension sensitivity；依赖块内 interarrival 的模型则根本没有 live feature identity。用单一 `parity=true` 会把不同权限混在一起。

### 6. 哪些特征仍然可以研究

同窗 receive tape 支持 aggregate message count、quantity、quote notional、side、price path、aggregate-ready interarrival 与 side run。由 `f..l` 推导的 child count 也只能整块在 parent ready 时揭示。

仅有 finalized parent 时，可以安全研究 parent price/side 与保守 ready lower bound；quantity、notional 和 child count 必须做 source-extension sensitivity。individual block 内 child interarrival、receive order 和 child feature-ready 永久 diagnostic-only，因为 aggregate message从未公开这些顺序。

#### 6.1 一个安全字段的最小 lineage

任何可执行 trade feature 至少应能沿以下链条追踪：source stream → aggregate ID → receive timestamp → parser completion → feature state version → quote decision。形式上，每个决策读取的最新状态版本 $v$ 应满足：

$$
t_{ready}(v)\le t_{decision}<t_{ready}(v+1).
$$

这条不等式让审计者能回答“为什么这次决策看见了 P9，却没有看见 P10”。只保存最后一个滚动 imbalance 数值而不保存版本/ready lineage，无法排除重放时按 exchange timestamp 回填。

对历史 finalized-only 数据，安全默认不是把 latency 设为零，而是声明字段级 uncertainty：price/side 可能有 conservative lower-bound clock，quantity/count 做 prefix sensitivity，无法恢复的块内属性直接禁用。研究精度会降低，但不会制造不存在的信息。

#### 6.2 如何把这个合同带进后续模型

训练 artifact 应绑定 feature source mode，例如 `live_slice_exact`、`finalized_parent_prefix` 或 `child_exchange_diagnostic`。同一模型不能在训练时用最后一种、回放时用第二种、live 时用第一种，却仍宣称 input ABI 相同。

运输检查也不只比较字段名和均值。它应比较 ready-lag 分布、parent extension rate、missing/gap rate、窗口非零率、极值与 threshold crossing rate。因为真正决定策略的不是总体 correlation，而是有多少 quote decisions 在不同 source mode 下跨过动作阈值。

### 7. 支持与关闭边界

支持：individual trades 作为 exchange-time matching/queue truth；live `aggTrade` 作为 policy information clock；parent-prefix compatible 的历史映射。

不支持：用 finalized parent quantity、child count 或块内 interarrival 精确重建 live 可见 payload。缺同窗 receive tape 时，这些字段必须 fail closed 或作为 source-extension sensitivity。

可复核输出还必须同时记录 source-contract version、aggregate ID、`f/l`、是否存在 internal gap、parent 是否只满足 prefix、ready lower bound 的构造方式与 latency profile identity。缺任一字段都不能只凭“价格和方向相同”升级为 exact parity。这样第三方才能区分数据映射正确、实时切片正确和历史 finalized payload 完全相等这三个层级。

### 8. 没有获得的权限

- 没有 hazard、action 或 live strategy 权限；
- 没有未文档化 futures raw `@trade` stream 的假定权限；
- 没有把 trade-to-receive lag 当成纯网络延迟的权限；
- 没有用 individual child timestamp 提前更新 policy feature 的权限。

### 一条 parent 从开始到 ready 的状态机

把parent aggregate视作随child到达增长的对象时，可以定义`OPEN → EXTENDED → FINAL/READY`。第一个child只创建parent identity，后续children扩展数量、价格范围与结束时间；只有收到能够证明parent边界的消息后，策略feature才原子看见最终aggregate。若source协议不能确定结束，ready规则必须明确依赖provider message，而不能根据“暂时没有下一个child”猜测。

同一child还要在两个账本出现：exchange ledger按原始撮合时间用于queue depletion；information ledger按parent ready time用于flow feature。二者通过稳定event identity关联，数量守恒必须满足

$$
Q_P=\sum_{i\in children(P)}Q_i,
$$

但不能因此在两个ledger都消费queue。任何duplicate、missing child或parent extension after ready都应触发明确invalid reason。

### 延迟分解怎样进入 transport

source-to-ready延迟不是简单的网络ping。它包含交易所撮合到公共聚合、feed传输、本地decode、parent completion、feature计算与调度。不同field可能在不同阶段ready：price/quantity child用于exchange replay，聚合tempo直到parent complete才用于policy。

因此transport应比较条件分布$P(L\mid venue,event\ type,burst\ size,regime)$，而不是只比一个median。若高burst parent恰好延迟更长，使用统一常数会选择性提前暴露最有预测性的事件。尾部分位数、missing parent rate、same-ms ambiguity与fallback fraction都应进入gate。

### Parity contract 如何防止“相同输出、不同原因”

只比较最终feature数值可能漏掉路径差异：Python先发布partial parent再修正，C++等到final一次发布，最终sum相同但中间decision不同。完整parity应逐层比较event identity、ready timestamp、atomic batch membership、feature state hash、evaluation rows与action。

同样，零mismatch只证明两runtime实现同一合同。若合同错误地用source time当ready time，它们会一致地look ahead。本项目最重要的产物不是一串延迟统计，而是把“撮合事实”和“策略可见事实”变成两套不可混用的类型；后继模型只能消费标注了lineage和ready semantics的字段。

### Field-level authority 为什么优于整行 authority

同一记录里的exchange price/quantity可能适合matching，parent completion与receive metadata适合policy visibility，local ingest time只适合诊断。若规定“整行都以provider time为准”，会把不同事实错误绑在同一clock上。

schema应给关键字段标注authority和ready semantics。下游builder按用途选择，而不是复制一个万能timestamp。缺少某字段authority时只让依赖它的strict feature invalid；不必删除整天其它可识别对象。

### Atomic ready batch 的 deterministic ordering

多个parents或book updates同一ready timestamp到达时，策略应先原子更新可见state，再在固定phase评估，避免文件顺序导致Python/C++分叉。若exchange内部同毫秒先后不可识别，matching truth保持stable input order或标ambiguity，不能借policy batch重排。

这套规则让“同一毫秒”从隐含偶然变成显式合同。后继q90项目正是通过exact-ready batch和ambiguity propagation取得event lockstep。

### 9. 公共证据

- [`binance_trade_lifecycle_contract_v2_20260723.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/docs/binance_trade_lifecycle_contract_v2_20260723.md)
- [`side_specific_taker_flow_research_20260723.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/docs/side_specific_taker_flow_research_20260723.md)

### 结语

历史数据可以比 live 更完整，却不能因此被当作 live 当时已经知道的内容。双时钟合同的价值，就是把“事后完整”与“当时可见”永久分开。

## 6. Event identity and risk set

### TL;DR：订单从“尚未激活”到“终止”之间，不是一条只有一个终点的直线

旧 panel 从 `decision_ts` 开始，把 fill、cancel ACK、adverse jump 和 库存生命周期 repair 当作同质 first events。审计表明，这种表无法识别 dynamic fill hazard：订单激活前不在 fill risk set；cancel request 是 behavior-policy stopping time；ACK 前仍可能成交；jump 后订单仍可能存活；repair 只在 inventory 非零且 reducing path 已进入可修复状态后才 at risk。

`event_identity_and_riskset_v1` 因此 blocked，v2 改成 start-stop lifecycle。这个结果没有说“fill hazard 不可研究”，只说在事件身份没有拆开前，任何漂亮 hazard 都不具备动作含义。

![订单生命周期与 start-stop 风险集](/images/narrowgate/event-identity-riskset.svg)

*图 1：状态机示意。fill risk 从 activation 开始，到 full fill 或 cancel ACK 结束；jump 只更新状态；repair 使用独立 delayed-entry risk set。*

![成交 outcome 与策略可见输入的 parent/child 双时钟](/images/narrowgate/f08-trade-parent-child-dual-clock.svg)

*图 2：risk-set 的终局可以用 individual child 识别，但区间协变量只能在 parent feature-ready 后更新。事件身份与信息可见性是两道独立约束。*

### 1. 研究问题

研究要识别三个不同对象：订单在真实 exchange exposure 下的 fill hazard、策略 cancel 对风险集的截断，以及 库存生命周期 repair 的 delayed-entry transition。它们必须有各自的 at-risk indicator。

fill risk indicator 可写成：

$$
Y_F(t)=\mathbf 1\{t_{activation}\le t<t_{terminal},\ q_{remaining}(t)>0\}.
$$

repair 则是：

$$
\lambda_R(t\mid\mathcal H_t)=Y_R(t)\widetilde\lambda_R(t\mid\mathcal H_t),
$$

其中 $Y_R(t)$ 只有在 库存生命周期 active、inventory 非零、reducing quote active 且 eligible 时才为 1。

### 2. 输入、动作与 estimand

输入是订单 submit/activation、GTX reject、partial/full fills、remaining quantity、cancel request/ACK、pending-cancel fill、native snapshot/delta jump、库存生命周期 repair 与 censoring。

该项目没有候选策略动作。它的 estimand 是事件身份和 start-stop interval 的可识别性：一行必须说明区间前后剩余量、事件顺序、进入/退出风险集的理由，而不是给旧 first-event 表补几个字段。

cancel 需要一个独立 stopping-time 表达。若 request 时刻为 $\tau_r$，ACK latency 依赖当时历史与系统状态，则：

$$
\tau_{ack}=\tau_r+L_{cancel}(\mathcal H_{\tau_r},s_{system}).
$$

在 $[\tau_r,\tau_{ack})$ 内，订单仍有 exchange exposure；partial fill 会减少 remaining quantity，但不会抹掉 request。ACK 只终止尚未成交的剩余部分。因此 `cancel_request`、`cancel_ack`、`fill_while_cancel_pending` 必须同时存在。

对 price jump，状态更新可写为 $x(t^+)=g(x(t^-),\Delta book_t)$，但 $Y_F(t^+)$ 仍可能为 1。也就是说 jump 改变 hazard covariates，不自动吸收 order。把 jump 设为 terminal cause，会截断 jump 后真正发生的 fill。

#### 2.1 四类日志对象为什么不能共享一个 `event_type`

订单研究里至少有四种语义：

| 类别 | 例子 | 对风险集的作用 |
|---|---|---|
| exchange terminal | full fill、cancel ACK | 吸收当前订单剩余量 |
| non-terminal transition | partial fill、price jump、cancel reject | 更新 state 或重启 quantity spell |
| policy action | cancel request、replace decision | 改变未来机制，但非交易所终局 |
| 库存生命周期 event | inventory nonzero、repair、flat | 属于另一 delayed-entry process |

如果数据库只保存一列 first event，这四类会竞争同一个位置；较早的 jump 会让后续 fill 消失，较早的 cancel request 会把 ACK 前风险删除，repair 又可能在根本尚未 at risk 时参与竞争。模型学到的是日志产生顺序，而不是一个可解释的市场过程。

更稳妥的数据结构是 event journal 加派生 risk intervals。journal 保留每个原子事实；adapter 根据冻结状态机生成多个 estimand-specific 面板。这样 fill、ACK、repair 可以共享原始 identity，却不用共享同一个 risk set。

#### 2.2 Multi-state 表达比 first-event 表多了什么

把状态记为 $Z(t)$：

$$
Z(t)\in\{not\ active,active,partial,cancel\ pending,terminal\}.
$$

允许的转移构成有方向图，而非所有 cause 从同一起点互斥。例如 active 可以经 partial 回到 partial-risk，active 或 partial 可进入 cancel pending，cancel pending 可 fill 或 ACK。repair 则属于库存生命周期 的另一张图。

multi-state 强迫研究者说明每条边：谁触发、是否可见、是否吸收、remaining quantity 如何变化。first-event 表把这些边压成一个标签，表面简单，却失去对 action 最重要的 request/ACK race 和 post-jump survival。

#### 一条完整路径示例

某 BUY order 在 200ms 激活，700ms 遭遇 adverse mid jump，900ms 策略请求取消，940ms 成交 40%，980ms 收到 ACK。正确记录至少包含三个 start-stop interval：active-before-jump、active-after-jump、pending-cancel-after-partial。若库存由这次 partial fill 变为非零，repair risk 还要等 reducing quote 真实 active 后才独立进入。

| 事件 | fill risk | repair risk | 是否吸收订单 | 策略动作 |
|---|:---:|:---:|:---:|:---:|
| activation | on | off | 否 | 否 |
| native jump | on | off | 否 | 否 |
| cancel request | on | 依 库存生命周期 而定 | 否 | 是 |
| pending partial fill | on，剩余量更新 | 可能进入 | 否 | 否 |
| cancel ACK | off | 可继续 | 是 | 否 |
| repair | 与该订单无关 | terminal/transition | 否 | 否 |

### 3. 数据与因果时钟

v1 审计读取 277,368 行、18 日的 order-value panel。旧表含 1,264 个 favorable/adverse fills、102,703 个 cancel ACK、171,839 个 adverse jumps、1,544 个 库存生命周期 repairs。

事件需要两个时钟：exchange-time 决定撮合、queue consumption 和 lifecycle truth；feature-ready 决定策略当时能使用哪些 flow/book features。同一毫秒跨 trade 与 book 且无共同 sequence 的顺序保持 ambiguity，不能通过排序规则“修复”。

例如 trade 与 depth delta 都标为 12:00:00.123，但两条 stream 没有共同 sequence。若先处理 trade，queue-ahead 可能被消耗后成交；若先处理 delta，挂单可能先被撤走。两种路径产生不同 outcome。正确合同是标记 ambiguity、从 strict rows censor，而不是固定“book before trade”后宣称 exact queue truth。

### 4. 研究演进

v1 的作用是冻结阻塞原因，而不是保留一个可运行的旧模型。v2 要求 replay 原生输出完整 lifecycle artifact 与 risk intervals，并禁止缺这些文件的 partial cache 复用。版本变化改变了 risk-set estimand，因此属于同一研究项目的实质 successor；普通缓存、序列化或执行修复不产生新文章。

v2 需要的最小 row identity 包括 decision、order、库存生命周期、activation、interval start/stop、remaining quantity before/after、event kind、event sequence、cancel state、repair-at-risk indicator 和 censor reason。旧 cache 即使拥有相同 day 与 config hash，只要缺 lifecycle artifact，也不能被“补默认值”后继续使用。

### 5. 结果与不确定性

旧 jump label 与 native first hit 严重不一致：171,839 个 legacy jump 中，只有 26,304 个 timestamp 与 native first hit 相同，145,535 个不同；另有 447 个 0ms exposure 和 1 行同时间歧义。

这不是参数不确定性，而是结构性不可识别。即便统计样本很多，只要 cancel、jump、repair 的状态角色错误，更多行只会更精确地估计错误问题。

v1 counts 还揭示了失真规模：102,703 个 cancel ACK 远多于 1,264 个 fill events；171,839 个 legacy jumps 又支配了 first-event 表。如果把这些行直接拟合，loss 几乎必然主要由 baseline policy 与 jump-label 生成规则决定，而不是由稀少的 favorable/adverse fill 区分能力决定。

风险集修复还改变分母。一个 order 的 partial fill 不会生成一条“新订单”，却会把 remaining quantity 从 $q_0$ 改为 $q_1$，并在下一 interval 继续贡献 exposure。适合的数量加权 exposure 是：

$$
E_i=\sum_j q_{ij}^{remaining}(t_{j}^{start})\,(t_{j}^{stop}-t_{j}^{start}).
$$

若直接按 row count 计算 hazard，频繁 book updates 的订单会被赋予更多权重；若只按 order count，又会忽略 partial 后剩余风险。v2 必须同时保留 interval、order 与 quantity 三种 denominator，报告它们之间的映射。这个要求也是为什么“把旧表再聚合一次”不能补救结构错误。

#### 5.1 0ms exposure 与 same-time ambiguity 应怎样处理

447 个 0ms exposure 可能来自 activation 与 terminal 同时间戳、时钟分辨率不足或上游排序压缩。它们不能自动算作“瞬时高 hazard”，因为真实 exposure 长度未知；也不能全删后不报告，否则 fast fills 会被选择性移除。

合理做法是显式 reason code：有共同 sequence 可排序的事件按 sequence 处理；只有粗时间戳的进入 ambiguity/censor sensitivity；真正 exchange reject 则根本不进入 active fill risk。报告需说明每类数量及其对 denominator 的上下界影响。

same-ms ambiguity 类似。若两种合法顺序产生相同 terminal，可保留；若产生不同 terminal 或 queue fill，则 strict identity 不可用。这个标准按“结论是否依赖未知顺序”判断，比固定任意 tie-break 更符合因果边界。

#### 5.2 Unknown、censor 与 no-event 是三种不同答案

no-event 表示在一段已观测、已 at-risk 的区间内没有终局；right censor 表示观测在订单仍有风险时结束；unknown 表示证据不足以知道是否 at risk 或发生什么。三者对应不同 likelihood contribution，不能统一编码为 0。

对离散 hazard，no-event row 贡献 $\log(1-h)$；right censor 只贡献到最后可观测 edge；unknown 通常应退出 strict likelihood 并保留 admission count。把 unknown 当 no-event 会系统性降低 hazard，尤其当高负载时期更容易缺消息时，还会形成与市场状态相关的缺失偏差。

#### 5.3 为什么更多旧行不会修复 estimand

旧表中 cancel ACK 与 legacy jump 数量远大于 fills。即使再增加一年数据，模型 loss 仍由 policy stopping 与 legacy label 占主导；统计方差下降，结构偏差不消失。可以写成：

$$
\widehat\theta_n\xrightarrow[n\to\infty]{}\theta_{mixed},
\qquad
\theta_{mixed}\ne\theta_{fill-risk}.
$$

这就是本项目选择 blocked 而不是“收集更多样本”的原因。只有重建 lifecycle 使目标变成 $\theta_{fill-risk}$，新增数据才有意义。

### 6. v2 通过后仍然不能直接做什么

正确 lifecycle 只是 prediction prerequisite。接下来还需要同 denominator 的 trade-clock parity、side-specific calibration、past-only chronological folds 与 uncertainty gate。即使 prediction 成功，也只能登记一个 propensity 已知、完整 replay 的 action experiment。

对 keep/cancel 之类动作，正式 reward 至少应包含 fill value、incremental 库存生命周期 cost 与 queue reset cost：

$$
R=V_{fill}-C_{库存生命周期}-C_{queue\ reset}.
$$

v2 lifecycle 能让这些路径被追踪，却不会自动识别 $C_{queue\ reset}$ 或 counterfactual reward。

#### 6.1 从事件 gate 到动作 gate 的最短合法路径

完整顺序应是：event accounting 通过 → parent-ready covariate parity 通过 → chronological prediction/calibration 通过 → action support preflight → randomized 或 paired full-path replay → terminal economics gate。每一步都可以停止。

特别是高 adverse-fill CIF 只说明 KEEP 路径的一部分风险。CANCEL 会删除 favorable fill、产生 no-quote gap，并在 re-entry 时丢 queue。只有把两个 potential outcomes 放在同一 eligibility surface 上，才有：

$$
\tau(x)=\mathbb E[Y(CANCEL)-Y(KEEP)\mid X=x].
$$

因此 v2 若未来完成，获得的是“可以开始评估预测”的资格，而不是对 F07 KEEP/CANCEL 阴性结论的绕过。

### 7. 当前状态与边界

v1 冻结为 blocked。v2 生命周期代码可以表达正确事件，但正式 Development panel 仍须重建并通过身份审计。通过事件 gate 只解决 label/risk-set；live taker-flow parity 仍是另一个必要条件。

正式 gate 至少要逐日核对：activation coverage、remaining-quantity conservation、request-before-ACK、ACK 前 fill 数量、terminal 后 hazard reuse、native sequence gap、same-ms ambiguity、repair entry/exit 与 order/day/inventory_lifecycle censoring。任何一项缺失都应给出明确 unsupported reason，而不是把 row 删除后只报告一个更好看的模型样本量。

### 8. 没有获得的权限

- `dynamic_fill_hazard_event_gate_passed=false`；
- `dynamic_fill_hazard_allowed=false`；
- `action_family_allowed=false`；
- 没有 Validation、holdout 或 live 修改权限。

### Occupancy、transition 与 cumulative incidence 是三种数据产品

在某时刻看到订单处于ACTIVE，是state occupancy；观察它在下一bucket是否fill，是transition hazard；统计activation后十秒内是否曾fill，是cumulative incidence。三者可以从同一生命周期生成，却不能共享一张标签表。

occupancy会对长寿订单过采样，因为它们贡献更多时间rows；per-order cumulative label则忽略事件何时发生；hazard保留时间结构但必须正确维护risk set。若研究问题是“当前active单是否该cancel”，hazard最接近决策面；若问题是“一个placement最终会怎样”，multi-state trajectory或CIF更自然。

### Multi-state 路径中的数量守恒

partial fill使状态不仅取决于event type，还取决于remaining quantity。设初始数量$Q_0$，fills为$q_i$，则每个事件后必须满足

$$
Q_{rem}(t)=Q_0-\sum_{t_i\le t}q_i\ge0.
$$

cancel ACK只能终止剩余量，不能抹掉此前fills；full fill后任何cancel ACK是晚到确认，不应重新创建risk。replacement/re-entry是新order identity，即便继承同一库存生命周期与经济意图，也不能继承queue、age或active cursor。

这些守恒检查比模型指标更先验。若remaining变负、terminal后继续暴露、同一fill被parent/child重复记账或0ms exposure被当成确定先后，任何下游hazard都会学习错误状态机。

### 从 risk-set 修复到 action value 的桥

事件语义通过后，仍要定义动作反事实。对active order，keep与cancel不仅改变当前fill hazard，还改变cancel latency内残余风险、queue option value与未来re-entry。一个局部价值可以写成

$$
V_{keep-cancel}
=
E[Y_T(keep)-Y_T(cancel)\mid H_t],
$$

其中$H_t$必须只包含$t$前可见的完整path。若只比较observed keep orders与observed cancels，会把策略原有选择混入结果；需要随机化、已知propensity或可信的paired replay。

因此v2 event identity pass只开放了“可以构建合法action panel”的权限。它没有告诉我们keep或cancel更好，也不授权任何threshold。结构研究的成功标准就是把下一步问题变成可识别，而不是提前回答下一步。

### 一张最小 event ledger 应有哪些键

稳定的`order_id`、`generation`、`event_id`、exchange/source time、feature-ready/receive time、event type、price、quantity、remaining quantity、side、库存生命周期 lineage与terminal reason。replacement必须增加generation；同一个client id复用也不能让新旧queue cursor相连。

每条derived risk row还应指回start event与stop event，保存为何valid/censor/unknown。这样aggregate hazard出现异常时，可以沿provenance回到原事件，而不是靠nearest timestamp猜。

### Ambiguity bounds 比强行选顺序更诚实

若同毫秒trade与cancel ACK先后未知，可分别计算“trade先”和“ACK先”两个合法边界；若研究结论在两种顺序下相同，获得robustness；若不同，就把该episode标unknown或报告identified interval。

强行按CSV行序选择会产生一个精确但未经识别的答案。对低延迟研究，承认部分识别比伪造纳秒顺序更科学，也避免模型学习采集器排序习惯。

### 9. 公共证据

- [`event_identity_and_riskset_v1_20260723.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/docs/event_identity_and_riskset_v1_20260723.md)
- [`binance_trade_lifecycle_contract_v2_20260723.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/docs/binance_trade_lifecycle_contract_v2_20260723.md)
- [`F08 README`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/README.md)

### 结语

风险集不是“从决策到第一个事件”的便捷切片，而是订单实际暴露、策略动作与 库存生命周期 状态共同决定的对象。先把事件身份做对，预测才有资格开始。

![Side-Taker 从描述性微观流到双时钟动态风险集的结果收敛](/images/narrowgate/side-taker-research-synthesis.svg)

*图：旧静态 hazard 已关闭；parent-child 可见时钟和 start-stop risk set 是动态 successor 的前置合同，而不是现成 action。*

## 7. 结论：静态 side signal 关闭，动态生命周期问题仍然开放

早期 side-taker M0 没有在更严格 denominator 上复现，且把 non-absorbing jump、策略 cancel 与 库存生命周期 repair 混进了错误的事件结构。双时钟与 risk-set 审计解释了为什么：输入可见性和订单生存状态不是一个静态 row 可以表达的。这个诊断关闭旧 M0，却没有否定所有 side-specific taker information。

合法 successor 必须先通过 historical/live aggTrade feature-time parity，再用统一 normalizer、side intercept 与动态 start-stop panel 估计 cause-specific hazards。即便 prediction 通过，也只能注册新的 randomized action；不能直接生成 live guard。
