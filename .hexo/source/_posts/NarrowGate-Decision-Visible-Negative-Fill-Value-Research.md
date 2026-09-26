---
title: 'NarrowGate Fill Quality 与 First-Add Quote EV：从 Markout、Campaign Loss 到 Soft-Widen 动作'
date: 2026-08-29 13:30:00
updated: 2026-09-26 20:52:00
categories:
- Market Making
tags:
- Market Making
- Fill Quality
- Quote EV
- 库存生命周期
- Action Value
math: true
---


Last materially modified: 2026-09-26


## 2026-09-26 新 Tardis 有限批次

后续已完成合法训练绑定、双侧十头的真实多日拟合和独立加载，以及一个冻结 `F05RiskWidenPolicy` 消费者的完整开发账户评价；净结果比匹配参照更差，负结果保留，不追调阈值。该 risk-to-widen 消费者不是直接净动作价值估计器，也不同于下文历史 BUY soft-widen；首批完成不关闭整个 F05。来源见[当前 F05 主报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/README.zh-CN.md)。

生命周期成交概率、成交条件 markout（bps）、成交条件不利概率、成交且不利联合风险、机会级预期 maker markout 与完整账户 USDC 净 PnL 分别解释；不把旧 gross markout 或价格差直接当净损益。私有模型、账户轨迹和未公开收益表不在此分发。

## 1. “坏成交”必须沿库存生命周期定义

这条研究从一个看似简单的问题开始：能否在成交前识别负价值 fill？但 30 秒 markout、campaign terminal、first-add decision value、decision-visible classifier 与 soft-widen action 分别处在同一因果链的不同位置。把它们拆成五篇，会让预测失败、机制诊断与动作失败看起来像互不相干的结论；实际上它们共同回答“坏成交从哪里开始、能否提前识别、识别后能否通过一个明确报价动作改善终局”。

一个 fill 的早期 maker-signed markout 可以写成

$$
M_h=\operatorname{side}\,(m_{t+h}-p_{fill})-fee,
$$

而完整决策价值必须继续走到库存 campaign 终点：

$$
Y_T=\sum_{i\in\text{post-decision fills}}\!\operatorname{signedCashflow}_i
+q_T m_T-\text{fees}-\text{incremental costs}.
$$

前者描述 selection 的早期窗口，后者才是动作 reward。历史 add 更差、first-add 平均为负，都不能直接推出“跳过 add”有正因果价值；还必须有 overlap、counterfactual path 和稳定 policy selection。

## 2. 历史五阶段与证据状态

| 阶段 | 它真正问什么 | 结论/权限 |
|---|---|---|
| Fill-to-inventory lifecycle | 30 秒 markout 与 campaign PnL 的关系是什么？ | 保留 estimand；旧绝对数值撤回 |
| Dynamic campaign attribution | add toxicity、repair failure 如何累积为库存尾部？ | 描述机制；不能当动作因果结论 |
| First-add terminal loss | 负价值从哪个决策时刻开始？ | 两侧均值稳定为负；没有稳定可执行 subgroup |
| Decision-visible fill value | 当时可见状态能否提前筛出负价值路径？ | chronological prediction branches 关闭 |
| BUY soft-widen action | 解除一次放宽是否创造直接 assignment-to-terminal value？ | 动作真实发生；两种 role 均负，关闭 |

## 3. Fill-to-inventory lifecycle

### TL;DR：成交后的 30 秒只是早期毒性窗口，库存风险可能再持续几分钟甚至几小时

被动成交以后，研究者很容易在 30 秒处读取 mid-price，计算 maker-signed markout，然后把它叫作“这笔成交赚了多少”。F10 Fill-to-Inventory Lifecycle 审计证明这种命名混合了至少四个不同问题：短期价格是否向不利方向移动、该 fill 创建的库存 lot 何时被 reducing fill 对冲、整个 inventory campaign 何时回到 flat，以及 replay 结束时仍未关闭的库存怎样 censor。

这项研究保留下来的结论是 **estimand contract**，不是旧数字。30 秒 markout 可以作为 early adverse-selection label，却不能替代 lot value 或 campaign-terminal PnL；inventory 是 fungible 的，一笔 reducing fill 究竟关闭哪一笔历史 add fill并不是交易所事实，因此 FIFO 与 LIFO 只能作为两种归因约定；未关闭的 lot 不能假装按 replay 终点成交，必须保留 censoring 或另行计算 terminal MTM。

历史 Retained111 审计曾报告 43,183 个 fill events、21,884 个 exposure lots、97.3% closed rate，并显示大量 lot 在 30 秒后仍然存活。后来确认其 order/fill denominator 使用了旧 mixed-L2 与 operational queue path，这些 count、duration、survival 和 PnL 数字全部撤回，不能作为当前 calibration 或 promotion evidence。**数字被撤回不等于问题消失；恰恰说明 lifecycle estimand 必须与数据、queue 和时钟身份一起冻结。**

本文只复盘公开的历史 Development 方法与撤回边界，不构成交易建议。图中的 K 线、成交、库存和 campaign 路径为合成机制示意，不是实盘记录。

![Fill、30 秒 markout、inventory lot 与 campaign terminal 的生命周期](/images/narrowgate/fill-inventory-lifecycle.svg)

*图 1：同一 opening fill 同时启动短期 markout clock、库存 lot 和更长的 campaign path。30 秒价格标签先结束，不代表库存已经修复；replay boundary 到来时仍未关闭的 lot 只能 censor。*

![从 markout 到 action uplift 的归因阶梯](/images/narrowgate/f10-attribution-evidence-ladder.svg)

*图 2：fill markout、lot、campaign、portfolio mechanism 与 action uplift 是五层不同证据。左侧可以定位毒性与持有风险，只有最右侧完整反事实才回答“改变报价是否值得”。*

### 1. 一个 fill 同时启动了三只时钟

假设 maker BUY 在 $t_f$ 以价格 $P_f$ 成交，创建正库存。第一只时钟是 micro markout clock：在预先冻结的 $h=1,5,20,30$ 秒读取因果可见的 mid-price，测量成交后的短期价格方向。第二只时钟是 lot lifecycle：等待未来 reducing SELL fills 按某种归因规则抵消该 opening quantity。第三只时钟是 campaign lifecycle：从库存离开零开始，直到整个策略库存重新回到 flat。

三只时钟的终点通常不同。价格可能在 30 秒内向上，使 BUY markout 为正，但该库存随后长时间占用风险预算；也可能 30 秒 markout 为负，却在后续 reducing fill 与 spread capture 中修复。只读取任意一个终点都会遗漏其它机制。

因此“fill PnL”不是一个天然字段。研究必须先说明分母是一笔 fill、一个 attributed lot、一次 campaign，还是一个随机化 intervention；再说明终点是固定 horizon、lot close、campaign flat 或 replay terminal MTM。

### 2. Micro markout：它回答的是早期 adverse selection

令 maker side sign 为

$$
s=
\begin{cases}
+1,&\text{BUY maker},\\
-1,&\text{SELL maker}.
\end{cases}
$$

以 fill price 为起点的 $h$ 秒 maker-signed markout 可以写为

$$
M_h
=
s\frac{P_{mid}(t_f+h)-P_f}{P_f}\times10^4
\quad\text{bps}.
$$

$M_h>0$ 表示价格随后向 maker 有利方向移动，$M_h<0$ 表示早期 adverse selection。这个标签适合回答“刚成交的流是否有毒”，但它没有包含订单在 fill 前的 queue cost、后续 inventory holding risk、reducing execution、commission 或 campaign tail。

实际观测还需要区分 target time 与 observation time。若目标是 $t_f+30s$，却只在更晚一次 quote decision 才读取 markout，那么名义 30 秒可能变成 10–20 秒额外延迟。后续 time/unit repair 因此要求用频繁 wall-clock tick 解析 pending markout，并记录 target、actual observation、source age 与 censoring。

### 3. Inventory lot：交易所不会告诉你 FIFO 还是 LIFO

opening/add fill 会增加绝对库存，reducing fill 会降低绝对库存，但 inventory 是 fungible 的。若策略先后买入两笔，再卖出一笔，交易所只知道净数量变化，不知道该 SELL 关闭第一笔 BUY 还是第二笔 BUY。

FIFO 把最早 opening quantity 先关闭，LIFO 把最近 opening quantity 先关闭。对一个 attributed lot $\ell$，可定义

$$
T_{lot,\ell}
=
t_{close,\ell}-t_{open,\ell}.
$$

若 opening 与 reducing 都是 passive fills，closed-lot realized value 可以按配对 quantity、成交价和费用计算。但 FIFO/LIFO 的差异是 model uncertainty，不是 exchange-observed truth。报告一条 lot-duration 曲线时，至少应同时给出两种归因、closed rate、median、tail quantiles 与 censoring rate。

对 replay 结束仍未关闭的 lot，$T_{lot}$ 是右删失。不能把 replay boundary 当作一笔虚构 taker close，也不能无依据扣除假设性 taker fee。若研究需要价值，应独立报告 terminal MTM：

$$
V_{terminal}
=
cash_T+inventory_T\cdot P_{mark,T}-fees_T.
$$

它是窗口终点上的策略权益，不是 realized lot PnL。

#### 3.1 一个 FIFO/LIFO 都合理却给出不同 duration 的例子

假设先后以 100.00、99.90 各 BUY 0.001 BTC，随后以 100.05 SELL 0.001。FIFO认为第一笔在 100.05关闭，lot duration较长、毛价差 +0.05；LIFO认为第二笔关闭，duration较短、毛价差 +0.15。净库存都从 0.002降到0.001，现金与终局权益完全相同。

因此 lot attribution可改变“哪笔fill修复更快、哪笔赚多少”的叙述，却不应改变组合会计：

$$
cash_T+q_TP_T-fees_T
$$

在FIFO/LIFO下相同。若两种规则算出不同terminal equity，说明实现重复或漏记quantity/fee，而不是发现了市场效应。

#### 3.2 Lot duration 是归因量，inventory-time 是路径量

FIFO/LIFO duration依赖配对约定；absolute inventory-time：

$$
I=\int_{t_0}^{T}|q_t|dt
$$

直接由净库存路径确定，不需要指定哪个reducing fill关哪一lot。前者适合解释fill cohort，后者适合衡量策略承担多少库存暴露。两者回答不同问题，最好同时报告。

即使 $I$ 较小，PnL也未必更好：更激进修复可以缩短库存时间却牺牲价格；F09 reducing-BUY实验就是实际反例。inventory-time是risk mechanism，不是价值函数。

### 4. Campaign：真正的库存终局通常比 30 秒晚得多

inventory campaign 从净库存离开零开始，到再次回到零结束。一次 campaign 可以包含 opener、多个 exposure-increasing adds、部分 reducing fills、quote pauses、cancel/re-entry 与其它反馈。一个 early fill 的价值会通过整条路径传递。

对第 $c$ 个 campaign，终局变化可写为

$$
Y_c
=
E_c(T_{flat})-E_c(T_{birth}),
$$

并与 maximum adverse excursion、absolute inventory time、repair latency、duration 和 tail indicator 一起报告。若 campaign 到 replay boundary 仍未 flat，同样必须 censor 或使用冻结 terminal-MTM 规则。

动作研究尤其不能把同一个 $Y_c$ 复制给 campaign 内每个 decision。那会把一次终局损失重复计入多行，产生伪精度。正确做法是每个 intervention identity 只拥有一次 campaign-level attribution，或使用明确的 incremental contribution contract。

### 5. 生存视角：平均 duration 会被长尾支配

令 $T$ 是 lot close 或 campaign flat time，$C$ 是 replay censor time，观察到的是

$$
\widetilde T=\min(T,C),
\qquad
\delta=\mathbf 1[T\le C].
$$

生存函数

$$
S(u)=\Pr(T>u)
$$

回答在 $u$ 时刻仍未修复的比例。仅报告 closed rows 的平均 duration 会丢掉所有长寿 censor，并倾向于把修复速度说得过快。仅报告均值又会被极少数长 campaign 拉高，所以 median、P75、P90、Kaplan–Meier median 与固定 horizon survival 应共同出现。

若 fill、cancel ACK、campaign flat 等结局竞争，还需要 competing-risk 方法，而不是把每个 horizon 当作彼此独立的 binary label。Lifecycle research 的贡献就在于先定义风险集和终局，再谈预测。

#### 5.1 Closed-only mean 的方向性偏差

假设十笔lot中九笔1分钟关闭，一笔到一小时窗口末仍未关闭。只看closed rows，mean为1分钟；真实第十笔至少存活60分钟。把boundary当close，mean变为6.9分钟，却又虚构了一笔执行。两种简化分别向快修复和假realization偏。

Kaplan–Meier把第十笔作为right censor：它贡献“至少活到60分钟”的信息，但不声称之后何时关闭。若censor与市场状态相关，例如趋势日更容易在窗口末仍持仓，还应谨慎解释independent censoring；固定窗口设计不能自动消除informative censoring。

#### 5.2 固定30秒与随机terminal为何不能直接比较均值

30秒markout对每笔fill使用相同horizon；campaign terminal时间随path变化。前者接近横截面早期价格反应，后者混合不同持有时长与后续action。把两者做相关并不能证明30秒“解释了多少PnL”，因为terminal duration本身可能由markout与策略共同决定。

更有用的分解是把 $M_{30s}$ 当predefined mechanism slice，再单独报告post-30s continuation：

$$
Y_{terminal}=V_{0\to30s}+V_{30s\to terminal}.
$$

两项会受数量、费用与inventory定义影响，不能简单把bps markout与USDC terminal相加；但这种结构能显示早期toxicity是否被后续repair抵消。

### 6. 被撤回的 Retained111 数字该怎样阅读

旧审计的历史表如下，**全部只用于说明为何 estimand 不能被压成 30 秒；不得视为当前校准值**：

| Historical withdrawn item | FIFO | LIFO |
|---|---:|---:|
| Closed rate | 97.3% | 97.3% |
| Closed median | 5.8 minutes | 2.3 minutes |
| P90 | 88.3 minutes | 52.1 minutes |
| KM median | 6.3 minutes | 2.5 minutes |
| Alive at 30s | 92.1% | 79.8% |

旧 denominator 还报告 closed campaign fill-to-flat median 11.2 分钟、P90 251.4 分钟。它们曾直观展示“30 秒以后仍有大量库存风险”，但后来 mixed-L2、queue identity、trade-side、merged clock 与 cross-day warmup 修复改变了订单和成交路径，因此这些 exact durations 必须重建。

这里有一个重要的证据治理原则：方法语义可以在数据身份失效后保留，数值却不能。FIFO/LIFO、censoring、lot versus campaign 与 terminal MTM 的区分不依赖某个具体 replay；43,183 fills 或 92.1% survival 则依赖完整 denominator，身份改变后必须撤回。

### 7. 数据与因果边界

一个可用的 lifecycle panel 至少要绑定：exact order/fill identity、maker side、fill quantity、campaign identity、execution price、commission unit、因果可见 mid、reducing fills、terminal inventory/mark、replay boundary，以及 queue、L2、trade 与 clock identities。

固定 horizon markout 只能使用目标时刻已经存在的 historical book；不能用未来第一笔 trade 代替 midpoint。若精确目标没有 book observation，应记录 actual observation 和 age，按冻结规则 censor，而不是向未来搜索一条方便的价格。

lot attribution 可以读取后续 reducing fills来构造 outcome，但这些未来字段绝不能进入 $t_f$ 前的预测 feature。campaign terminal 也只能作为标签。预测 score 与动作触发必须停在 feature-ready cutoff 左侧。

### 8. 从描述性标签到动作 estimand

观察到 $M_{30s}<0$ 或 $Y_c<0$，不等于已经证明取消 opening order 会改善结果。一个 action 会同时改变 fill probability、queue position、inventory birth、后续 adds、reducing path 与 campaign terminal。

动作 $a$ 的完整价值应更接近

$$
V(a)
=
\mathbb E[
\text{fill value}
-\text{incremental campaign cost}
-\text{queue reset cost}
\mid a],
$$

并使用 paired full-path replay、随机化或其它可识别设计。30 秒 markout 可作为机制分量，却不能独自晋级 keep、cancel、widen、skip 或 re-center。

#### 8.1 一个负 markout 对应两个相反动作反事实

BUY fill后30秒mid下跌，$M_{30s}<0$。若candidate在fill前widen，可能完全避开库存，动作有利；也可能只是把fill推迟到更低价格，随后反弹，candidate更有利；还可能错过低位被动成交，稍后以更高价格重新进入，candidate不利。

同一个observed label无法区分这些potential outcomes。需要在同一decision surface上生成baseline/candidate order lifecycle，并让两臂各自承担queue、fill、inventory与terminal。标签研究回答“发生了什么”，动作研究回答“另一种选择会怎样”。

#### 8.2 文章中的旧数字为何必须醒目标注 withdrawn

旧Retained111数字很适合直观说明长尾，却绑定了后来失效的mixed-L2与queue path。若只因为结论方向符合直觉就保留精确百分比，会让读者误以为数值已在修复后复现。

正确做法是保留方法结论、将旧表显式标为historical withdrawn，并在新identity完成前不填“近似当前值”。这比删掉失败历史更透明，也阻止其它文章把92.1%之类数字重新引用成当前事实。

#### 8.3 一份新的 lifecycle completion 应如何报告

新结果至少需要按BUY/SELL、opener/add/reducing role分层，给出fill count、lot quantity、FIFO/LIFO closed rate、KM survival、campaign duration、open inventory MTM、clock coverage与source identity。同时报告同一权益会计在两种lot归因下是否守恒。

如果这些基础项通过，才能把lifecycle artifact交给prediction或action项目。它本身仍不授予“30秒坏就撤单”的阈值，也不证明某种lot规则更接近交易所真相。

### 9. 最终状态与没有获得的权限

项目最终状态是 **lifecycle estimand retained；Retained111 exact numbers withdrawn**。

保留的结论：

- 30 秒 markout 是 early toxicity，不是 fill PnL；
- lot close 与 campaign flat 是不同终点；
- FIFO/LIFO 是归因不确定性；
- open lot/campaign 必须 censor 或按冻结 terminal MTM 处理；
- action reward 不能重复复制 campaign outcome。

没有获得的权限：当前 survival calibration、当前 queue/lifecycle 参数、策略 promotion、Validation 或 sealed holdout 读取、任何 live action 或 baseline 变更。旧数值不能被其它文章重新包装成“长期库存风险已精确量化”。

### 三种时间权重会给出不同的“典型持有期”

按fill等权，每个成交贡献一次；按lot quantity加权，大额fill更重要；按inventory-time抽样，长寿campaign占据更多权重。它们分别回答“随机一笔fill”“随机一BTC lot”“随机一个持仓时刻”的持续时间，不能共用一个平均数。

例如一个1秒小lot与一个1000秒大lot，fill等权中各占50%；在inventory-time风险里后者几乎支配全部暴露。报告应同时给median/quantiles、survival curve与BTC-hours，而不是只给closed lots mean。

### Campaign terminal mark 的选择

自然flat是最清楚的terminal；窗口末端仍有inventory时，需要用当时可见mark进行MTM并标right censor，不能虚构taker close。若campaign跨日，daily PnL rollover不能切断经济身份；但按日统计不确定性时又要保留共同shock。

campaign value可写为

$$
Y_c=\Delta cash_c+q_{c,T}m_T-fees_c,
$$

其中$q_{c,T}=0$时退化为closed value。mark source、timestamp与age必须记录，否则terminal difference可能来自不同价格观测而非策略。

### Lifecycle 报告怎样服务动作研究

描述性报告应建立三层标签：fixed-horizon signed markout用于早期selection；lot duration/value用于成交归因；campaign terminal/value与inventory-time用于完整路径。动作研究根据问题选择终点，但不能把三层混成一个“fill quality”。

例如active cancel可能以10秒hazard作decision feature，却必须以terminal campaign value作primary outcome；30秒markout只是mechanism diagnostic。这样即使短期toxicity改善、长期repair恶化，scorecard也不会把局部指标误当最终成功。

### 10. 公共证据

- [F10 Live/Replay Attribution README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/README.md)
- [Fill Inventory Lifecycle Audit](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/fill_inventory_lifecycle_retained111_20260713.md)
- [Replay Time, Unit, and Causality Repair](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/system_engineering/docs/replay_time_unit_causality_repair_20260715.md)
- [Time and Unit Contract Repair](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/system_engineering/docs/time_unit_contract_repair_20260726.md)

公开仓库保留方法、撤回声明和实现入口；旧 owner-side lot tables 与当前重建 artifacts 不随仓库分发。

## 4. Dynamic campaign attribution

### TL;DR：Add campaign 历史上更差，但这只是机制线索，不是“跳过 add 会赚钱”的因果结论

NarrowGate 的 inventory campaign 并不是由一个固定 spread 参数控制。波动 regime 会缩放报价，P3 floor 会阻止过度收紧，depth kappa 会影响距离，dynamic cap 设定上限，cooldown 以 85 秒阶梯延长，reducing-side defense 又可能暂停或放宽修复报价。F10 Dynamic Campaign Mechanism Attribution 的任务，是把这些机制在真实 campaign 路径上的实际作用拆开，并定位损失更像来自 immediate add toxicity、repair failure，还是控制器没有真正进入 action range。

一个冻结的历史 48 小时窗口包含 508 个 closed campaigns 与其中 1,556 个 fills。408 个 no-add campaigns 的 aggregate terminal PnL 为 $+0.3122$ USDC；100 个 at-least-one-add campaigns 为 $-9.3668$ USDC；worst 20 campaigns 合计 $-8.7043$ USDC。add campaigns 的 first-add 30s maker-signed markout 平均约 $-0.82$ bps。这个分解清楚地说明亏损集中在哪一类路径，却没有识别“若不 add 会发生什么”。

机制审计还显示：历史窗口的 regime scale 平均约 1.53x，P3 floor 在 sampled campaign 中约 28.9% 时刻 binding；dynamic cap 平均约 24.52 bps，却没有 sampled cap hit；cooldown maxima 主要落在 170s 与 255s 的离散台阶。换言之，有些名为 dynamic 的参数在变，有些控制器在普通状态几乎没有连续 action range。

后续发现旧 Development replay 使用了 superseded top-20/q0.70、mixed book/model identity，其精确 add-toxicity、repair-delay、distance、cap-hit、campaign 与 PnL 数字已经撤回。公开历史 live aggregate 只保留为 descriptive evidence。项目最终结论是：**add toxicity 与 repair failure 值得形成新的动作问题，但这项审计本身没有 action uplift。**

本文是历史机制归因复盘，不构成交易建议。图中的 K 线、报价、库存与控制器状态为合成示意，不对应实盘路径。

![Dynamic campaign 中 add toxicity、repair failure 与控制器传导](/images/narrowgate/dynamic-campaign-mechanism-attribution.svg)

*图 1：一个 add fill 可以先产生短期 adverse markout，再通过更长的库存修复路径进入 campaign terminal。Regime、P3、cap、cooldown 与 reducing defense 影响报价，却不等于已经构造出“跳过 add”的反事实。*

![从历史归因到动作价值的证据阶梯](/images/narrowgate/f10-attribution-evidence-ladder.svg)

*图 2：add/no-add campaign差异位于portfolio mechanism层。它能定位损失，但只有新的随机或配对action path才能到达uplift层；30秒markout、库存时长或controller状态都不能单独跨级。*

### 1. 研究问题：损失集中在哪里，机制是否真的在动

这项审计问两个描述性问题。第一，terminal loss 更集中在没有 add、发生 add、immediate toxic add、repair failure 还是二者混合的 campaigns？第二，配置中宣称的动态控制器在实际路径上是否有足够 variation，还是多数时间被 floor、cap、离散阶梯或其它 overlay 固定住？

对 campaign $c$，可观察 terminal outcome 为

$$
Y_c=E_c(T_{flat})-E_c(T_{birth}).
$$

令 $A_c=1$ 表示该 campaign 至少发生一次 exposure-increasing add，则描述性差异为

$$
\Delta_{obs}
=
\mathbb E[Y_c\mid A_c=1]
-
\mathbb E[Y_c\mid A_c=0].
$$

$\Delta_{obs}$ 不是动作效应。是否发生 add 由市场路径、已有库存、baseline quote、queue、fill 和控制器共同选择，因此

$$
\Delta_{obs}
\ne
\mathbb E[Y_c(\text{skip add})-Y_c(\text{baseline add})].
$$

这条不等式是全文最重要的边界。审计可以定位候选机制，不能替代随机化或 paired full-path replay。

#### 1.1 Add/no-add 对比中的选择路径

发生add需要：campaign已存在、baseline permission开放、quote激活、市场触达并完成fill。市场趋势与库存状态同时影响是否add以及terminal outcome。一个简化因果图是：

$$
MarketState\rightarrow AddFill\leftarrow Quote/Queue,
$$

$$
MarketState\rightarrow Terminal,qquad InventoryState\rightarrow AddFill,Terminal.
$$

条件于 $AddFill=1$ 会选择出更容易触达、更长或更困难的campaign。即使add本身没有因果伤害，add group也可能更差；反之，add也可能真增加风险。观察性差异无法区分。

因此100个add campaigns与408个no-add campaigns不是两臂实验。它们最适合回答“哪里集中损失、下一步动作面在哪”，不适合回答“删除100个add会省9.37 USDC”。

#### 1.2 48小时窗口为何只能做机制定位

两天容易被单一趋势、周内时段与少数worst campaigns主导。worst 20承担大部分loss本身就说明重尾；按campaign row做普通区间会低估共同市场冲击。

这个窗口仍有价值，因为它揭示controller是否binding、cooldown staircase与add/repair路径，可用于注册新问题。但稳定side ranking、参数最优值或长期loss share需要更多独立日期和修复后的denominator。

### 2. Campaign 分类：toxicity 与 repair 是两条不同路径

历史审计预先定义 immediate add toxicity 为 first-add 30s maker-signed markout 不高于 $-0.5$ bps，repair failure 为 first add 到 first reducing fill 超过 300 秒。它们是 diagnostic thresholds，不是 treatment rules。

四类路径分别是：

- immediate toxicity only：add 后价格很快不利，但首次 reducing fill 未超过 repair 门；
- repair failure only：短期 markout 未触发 toxicity 门，却长时间没有 reducing fill；
- mixed：早期 adverse 与长时间 repair delay 同时存在；
- other add：发生 add，但不属于前三类。

这一区分避免把所有损失都叫作“toxic fill”。早期方向错与库存长时间卡住会产生不同的动作设计：前者可能需要在 add decision 前改变 exposure，后者可能需要改善 reducing permission、quote geometry 或 lifecycle recovery。

### 3. 冻结历史窗口：add loss 集中，但类别内部并非同号

公开的历史窗口结果为：

| Group | Closed campaigns | Aggregate terminal PnL | Mean PnL | Median duration |
|---|---:|---:|---:|---:|
| No add | 408 | +0.3122 | +0.0008 | 89.8s |
| At least one add | 100 | -9.3668 | -0.0937 | 509.4s |
| Worst 20 | 20 | -8.7043 | -0.4352 | 689.8s |

标签 no_add_net_positive 与 add_net_negative 只描述 aggregate sign，不表示每个 member 同号。100 个 add campaigns 的细分为：

| Add class | Campaigns | Aggregate terminal PnL |
|---|---:|---:|
| Immediate toxicity only | 43 | -4.0939 |
| Repair failure only | 11 | -1.6059 |
| Mixed | 5 | -2.0747 |
| Other add | 41 | -1.5923 |

immediate-toxicity 与 mixed 虽只占一部分 campaigns，却承担较大损失；repair-only 也明显为负。first-add 30s markout 平均约 $-0.82$ bps，说明早期 adverse selection 是机制的一部分，但 other-add 仍为负，说明 30 秒标签没有解释完整 terminal path。

历史窗口中 SHORT add campaigns 的 early markout 与 terminal aggregate 看起来比 LONG 更差，但窗口只有两天。这是 unstable side diagnostic，不能建立 SELL-side action，更不能把短窗口 side ranking 外推为永久市场结构。

### 4. Regime 与 P3：缩放真的发生，floor 也确实介入

regime scale 的历史 campaign mean 约为 1.53x，说明它不是配置中的空变量。P3 pair-spread floor 在 sampled campaigns 中约 28.9% binding，意味着 low-volatility tightening 经常被触达概率约束截断，但也没有永久把报价钉死。

可以把最终 pair spread 抽象为

$$
d_{pair,t}
=
\max\left(
d_{dynamic,t},
d_{P3\ floor,t}
\right).
$$

当 floor binding 时，继续改变 regime 或基础 gamma 未必移动最终报价；只有 $d_{dynamic,t}$ 重新超过 floor，控制器才恢复 action range。研究 controller effect 时必须观察最终 quote geometry，而不是只看内部 parameter changed。

#### 4.1 用局部导数理解“参数动了、报价没动”

若最终spread为 $d=\max(d_{dynamic}(\theta),d_{floor})$，则floor binding时：

$$
\frac{\partial d}{\partial\theta}=0
$$

即使内部参数 $\theta$、regime scale或kappa持续变化，执行价格对它没有局部敏感度。只有dynamic分支超过floor，导数才恢复。

同理，cap未binding时调高cap也有零action effect；spread cap碰撞时又可能把两个内部报价压成同一最终tick。机制审计必须沿“state → internal quote → floor/cap/rounding → final order”逐层记录，而不是把state variation当treatment strength。

#### 4.2 28.9% floor binding 如何阅读

它说明约部分sampled时刻由P3 floor决定下界，不代表另外71.1%都由某一个dynamic参数独占控制；其它floor、tick rounding、inventory skew与safety overlay仍可能参与。比例也来自withdrawn historical denominator，不具当前calibration authority。

因此这项数字的正确用途是历史机制例子：某些内部参数在相当部分路径上无法移动final quote。它不是现在应降低P3 floor的依据，更不是P3 value的因果证据。

### 5. Kappa 与 cap：参数在变化，不代表报价受它控制

审计发现 effective depth kappa 与 empirical P3 kappa 在普通状态非常接近。rare states 会移动它，但大多数 campaigns 中可用的连续动作范围很小。一个看似精细的 depth controller 若长期贴着外部 calibrated surface，就不应被当作主要 campaign adaptation lever。

dynamic cap 的 level 确实变化，历史窗口 mean 约 24.52 bps；但 sampled cap-hit rate 为 0%。因此 cap 是 safety ceiling，而不是当时损失路径中的 active treatment。调一个从未 binding 的 cap，不会自动改变 fill 或 campaign。

这个例子揭示了 mechanism attribution 的必要性：配置文件里有参数，不等于数据里存在 treatment strength。研究动作前必须先证明 candidate 会改变最终 quote、fill 或 lifecycle，而不是只改变一个中间变量。

### 6. Cooldown：所谓 dynamic 可能只是离散 staircase

历史 sampled campaigns 的 maximum cooldown 呈现清楚的 85 秒整数倍：85s 有 3 个、170s 有 61 个、255s 有 30 个、340s 有 8 个、425s 有 2 个。它是状态触发的 staircase，不是连续平滑控制器。

离散阶梯会产生两个后果。第一，两个略有不同的 states 可能落到同一 cooldown bucket，动作实际上相同。第二，跨过一个台阶会一次改变 85 秒 permission，远比 score 的微小变化更强。任何 cooldown action study 都必须冻结具体 transition，而不能把 score slope 当作 treatment size。

#### 6.1 阶梯动作的边际效应集中在边界

如果连续score只在跨过阈值时把cooldown从85变170秒，那么绝大多数score小变化没有action difference，少数边界变化却一次改变85秒。模型若回归score与PnL，估计的是状态关联，不是这条离散jump的效果。

真正action estimand应比较同一个boundary opportunity上是否跨级，并追踪后续permission与campaign。后来的state/recovery/variance-time项目正把不同release规则独立注册；它们不能由本篇staircase统计直接授权。

### 7. Reducing-side defense：想修复库存，先确认机制有 support

减少风险的 reducing quote 也会受到 common overlays、distance 与 pause 影响。历史审计中实际 defense pause 很稀少，inventory emergency quantity threshold 没有在冻结窗口触发；loss-based emergency 与 quantity emergency 又是两条不同机制，不能混成一个“防御开关”。

研究曾为 reducing repair release 预注册每侧最低 campaign、active-day、strict-through interval 与 affected-negative-add rate。支持门未同时满足，因此该动作在读 action economics 前就关闭。touch 或 strict trade-through 也不能当作真实 queue fill counterfactual；一个更激进 reducing quote 是否成交仍需要 queue、latency 和 exact execution path。

后续应该转向 first baseline-eligible exposure-increasing add opportunity，因为这个决策点在 add fill 发生前、具有明确 baseline action，也更接近可识别的预防动作。

### 8. 数据、时钟与撤回边界

historical live aggregate 描述当时实际系统发生过的 closed campaigns；旧 Development replay 则依赖当时的 top-20 queue、q0.70 calibration、book/model identity。二者来源、transport 与 treatment 都不同，不能把 live association 与 replay counterfactual 拼成一个 causal estimate。

后来 normalized 100ms L2、trade-side、calendar、merged clock 与 queue identity 修复改变了 replay denominator。于是旧 Development add-toxicity、repair-delay、distance、cap-hit、campaign 和 PnL exact values 被撤回。本文不复活这些数字，只保留公开状态仍允许的历史 actual-campaign aggregate 和 mechanism semantics。

features 必须在 quote decision 前 ready；first-add markout 与 campaign terminal 只能作 outcome。一个 fill 后才知道的 toxicity class 不能用来决定该 fill 前的动作。

### 9. 从机制审计到 action research

一个可识别的下一步动作需要在 campaign 第一个 baseline-eligible add decision 上冻结：

- $A0$：执行 baseline add quote cycle；
- $A1$：只跳过一个 add quote cycle；
- BUY 与 SELL 分开；
- 每个 campaign 至多一次 50/50 assignment；
- reducing quote、size、inventory limit 与 taker behavior 不变；
- replay 完整 queue、latency、fill 与后续 campaign path。

reward 应从 decision 到 terminal，报告 campaign cost、repair time、tail 与 activity。这个动作后来属于 F09 action-uplift 研究，而不是本篇 descriptive audit 的结果。

#### 9.1 后续action结果如何反过来校正机制直觉

one-cycle skip证明单次quote对fill路径杠杆太低；until-flat证明持久阻断能降风险却近似关掉参与；recovery-event在支持充分时伤害SELL价值；price penalty与aggressive repair分别改善库存proxy和修复速度，却没有terminal uplift。

这些结果不抹掉add/repair机制定位，而是说明从“损失集中”到“可控且有价值”之间有很长的识别链。机制文章应把后续阴性结果链接进叙述，而不能永远停在“下一步可能有效”的悬念。

#### 9.2 什么证据能真正更新本篇结论

修复denominator后的完整campaign panel可更新loss concentration、duration与controller action-range数值；新的randomized action则可更新某个lever的因果价值。两类更新不能互相替代。

若新panel仍显示add group平均更差，它加强descriptive localization；只有同一untreated opportunity的skip/widen/price/full-path contrast为正，才支持action。文章中每个数字都应标明属于哪一层。

### 10. 最终状态与权限

项目最终状态是 **descriptive mechanism only**。

支持：add campaigns 在冻结历史窗口承担绝大多数 aggregate loss；immediate toxicity 与 repair failure 是不同传导机制；regime/P3/cooldown 确实改变内部或报价状态；cap 与部分 defense mechanisms 缺少实际 action range。

不支持：跳过 add 的因果收益、任一 dynamic parameter 的最优值、稳定 side ranking、reducing repair release action、把 live 与 replay 数字合并成政策结论。

没有读取或获得 Validation、sealed holdout、policy promotion、live action、baseline update 或参数调优权限。旧 Development exact values 保持 withdrawn。

### 描述性差异的 DAG 为什么不能省略

令$S$为市场/库存状态，$A$为是否发生add，$F$为后续fills，$Y$为terminal value。原策略根据$S$选择$A$，而$S$也直接影响$Y$：

$$
S\rightarrow A,\qquad S\rightarrow Y,\qquad A\rightarrow F\rightarrow Y.
$$

观察到$E[Y\mid A=1]<E[Y\mid A=0]$同时包含动作效应与state selection。进一步按已fill、已closed或某个post-action campaign type分层，还可能打开collider路径。机制审计可以定位损失集中在哪，却不能把条件均值直接翻译为skip uplift。

### Binding rate 是 control authority 的局部地图

当P3 floor在28.9% decisions绑定时，某些上游参数变化不会传到最终quote；在未绑定区间，局部导数才非零。总体parameter movement与final action movement之间需要一张transmission table：input changed、raw quote changed、floor/cap bound、tick-rounded quote changed、order replaced、fill path changed。

这张表能解释为何动态$\kappa$或cap看起来波动很大，实际订单却很少不同。反过来，若final quote频繁不同但value不变，问题位于市场分离或fill/path层。mechanism attribution的价值就是指出控制链在哪一层失去authority。

### 从“add更差”到随机化 action 的设计

第一步选择decision-visible surface，例如first-add、multi-level add或post-cooldown rearm；第二步定义有限动作keep/widen/skip；第三步在outcome前验证每个arm的合法性、action leverage与retention；第四步用已知propensity或paired replay估计terminal contrast。

这样新的action研究回答$E[Y(a)-Y(a_0)]$，而不是重复比较observed add/no-add。后来的F09结果有些动作机械上强却经济失败，正好证明历史损失集中不能保证简单干预有效。

### 11. 公共证据

- [F10 Live/Replay Attribution README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/README.md)
- [Dynamic Mechanism Campaign Audit v1](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/dynamic_mechanism_campaign_audit_20260722.md)
- [Historical Backtest Evidence Revalidation](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/historical_backtest_evidence_revalidation_20260720.md)

公开报告提供 aggregate decomposition、机制定义和撤回边界；per-campaign rows、runtime receipts 与 owner-side artifacts 不随仓库分发。

## 5. First-add terminal loss

### TL;DR：first-add 决策后的平均终局价值稳定为负，但局部状态没有给出稳定可执行的“避开谁”

Dynamic campaign audit 发现 add campaigns 承担大量 terminal loss，但 realized add fill 是市场与 baseline policy 共同选择后的结果。要把损失真正定位到可研究的决策点，F10 构造了 First-Add Decision-To-Terminal Loss：每个 inventory campaign 只保留第一个后来确实生成 exposure-increasing add fill 的 order decision，并精确追踪 decision → order → fill → campaign terminal。

40 个冻结 Development 日全部完成，24 个 Grade-A primary 日与 16 个 Grade-B sensitivity 日共得到 2,071 个 first-add decisions。Grade A 中 BUY 596 行，平均 decision-to-terminal value 为 $-0.04272$ USDC，95% 日期聚类区间 $[-0.05342,-0.03175]$；SELL 658 行，平均 $-0.05564$，区间 $[-0.07047,-0.04066]$。Grade B 的 BUY 与 SELL 区间同样完全低于零。

这证明 first-add decision 是真实、稳定的 loss denominator。它没有证明“跳过 first add”会改善结果，因为行的资格仍要求 baseline order 后来成交；动作一旦改变 quote 或 skip，fill、queue、inventory 和 campaign continuation 都会改变。冻结 decision-visible mechanism contrasts 也没有跨 Grade A/B 稳定复制，因此研究没有直接产生 action。

项目最终状态是 **Development evidence built, no action authority**。它把问题交给后续 F05 prediction：当时可见的状态能否在 campaign-state baseline 之外识别更差子集；预测仍不等于动作。

本文只讨论历史 Development 聚合证据，不构成交易建议。图中的 K 线、订单与 campaign path 为合成机制示意。

![First-add decision 到 order、fill 与 campaign terminal 的精确身份链](/images/narrowgate/first-add-decision-terminal-loss.svg)

*图 1：特征在 decision cutoff 左侧冻结；order activation、add fill、库存路径和 terminal equity 位于右侧，只用于定义 eligibility 与 outcome。每个 campaign 最多贡献一行。*

![First-add loss 在归因与动作阶梯中的位置](/images/narrowgate/f10-attribution-evidence-ladder.svg)

*图 2：decision-to-terminal比30秒markout更完整，但仍是baseline-filled observational attribution。它先建立loss denominator；predictability与skip/widen action uplift还需后续独立证据。*

### 1. 为什么从 realized fill 倒推 decision 会出错

如果只在 fill tape 上找到第一笔 add，再向附近搜索最近 quote decision，很容易出现 nearest-time misjoin：同一时刻可能有 BUY/SELL、opener/add/reducing 多个 decision，order 还可能经历 replace、cancel、partial fill。错误 join 会把一个 campaign 的 terminal loss贴到另一个 order state 上。

旧 exploratory subset 曾只能匹配一小部分 rows。正式 producer 禁止修补那个 subset，要求 exact native identity：

$$
decision\_id
\rightarrow
order\_id
\rightarrow
fill\_id
\rightarrow
campaign\_id.
$$

每个 eligible campaign 只取第一条完整链，不能因为后续还有更多 adds 就复制 terminal outcome。producer 必须输出 100% eligible rows；open records、identity breaks、native sequence failures 或 q90 parity failures均显式失败。

#### 1.1 Nearest-time join 会制造怎样的假特征

假设同一毫秒策略同时更新BUY add与SELL reducing，随后只有BUY order在几毫秒后成交。若fill按最近timestamp连接，tie-break可能贴到SELL decision；模型看到的side、queue、role与inventory effect全部错位，但campaign terminal仍来自BUY路径。

更隐蔽的是replace：fill order id可能对应三次更早decision中的最后一次activation，而不是最接近fill的quote callback。exact chain要求每个transition有明确parent，不允许用时间距离猜测。

错误率即使很低，也可能集中在高频/高波动时段，恰好是loss较大的rows。仅检查总体match rate不能保证无偏；必须逐链验证role、side、quantity与campaign ownership。

#### 1.2 每campaign一行如何防止伪精度

一个长campaign可能有十次adds，terminal loss只有一次。若把相同 $Y_c$ 复制十行，长且差的campaign自动获得十倍权重，标准误又把十行当近似独立。first-add identity把每个campaign最多保留一次，使cluster unit与经济终局更一致。

这并不表示后续adds无关；它们仍作为first-add之后的路径进入 $Y_i$。研究只是把预测/归因起点固定在第一次add decision，避免重复claim同一terminal。

### 2. Observational estimand：从 decision 前权益到 campaign terminal

对第 $i$ 个 first-add decision，主目标为

$$
Y_i
=
V(T_{campaign,i})
-
V(t_{decision,i}^{-})
\quad\text{USDC/decision}.
$$

$V(t_{decision}^{-})$ 是动作形成之前的策略权益，$V(T_{campaign})$ 是同一 inventory campaign 按冻结终局规则结束时的权益。这个 target 将 add fill 后的后续 adds、reducing fills、inventory duration、fees 与 terminal mark 全部保留在路径里，比 30 秒 markout 更接近风险问题。

但它仍是 prognostic attribution。面板只包含“baseline decision 后来确实生成 add fill”的 rows，因此

$$
\mathbb E[Y_i\mid F_i=1,\pi_0]
$$

不等于

$$
\mathbb E[Y_i(\text{skip})-Y_i(\text{baseline})].
$$

动作会改变 $F_i$ 本身，不能在 baseline-filled denominator 上直接估计 skip uplift。

### 3. 面板：Grade A 是 primary，Grade B 只能 sensitivity

研究预注册 24 个 Grade-A primary Development 日和 16 个 Grade-B gap-censored sensitivity 日。两个 panel 不能 pooled 后声称获得更窄 primary interval，也不能借用已有 Validation 或 holdout 日期补数量。

最终 40/40 日完成，exact join 2,071 行：

| Panel | BUY rows | SELL rows | Role |
|---|---:|---:|---|
| Grade A | 596 | 658 | primary gate |
| Grade B | 459 | 358 | preregistered sensitivity |

queue ahead 对 2,070 行可观察。唯一例外是一条 Grade-B BUY quote，距离 mid 896.5 ticks，其 queue identity 明确标为 unknown，没有按 zero impute。这个细节体现了 support contract：outside observed range 与 known-empty queue 完全不同。

feature-clock violation、open record、native sequence failure 与 q90 parity failure 都为零，因此阴性或负值结果不是来自明显的 join/clock 缺口。

### 4. 时钟与因果边界

决策特征必须满足

$$
t_{feature\ ready}\le t_{decision}.
$$

individual trades 可以用于 exchange-time fill reconciliation，却不能伪装成 decision-visible taker flow。可交易的 flow feature 必须服从其 parent aggregate message 的 receive/feature-ready clock；child trade exchange timestamp 只属于 outcome/matching truth。

campaign terminal、first reducing fill、repair duration、future markout 与 terminal inventory 都在 decision 以后，只能用于 target 或 mechanism audit。producer 的职责是保留未来身份，不是把未来状态回填进 feature row。

100ms book resolution也不能被误解成 100ms action horizon。decision-to-terminal value 的终点由 campaign lifecycle 决定，可能远晚于 first-add fill。

### 5. 主结果：两侧 primary mean 都稳定低于零

| Panel | Side | Rows | Mean USDC | Day-clustered 95% interval |
|---|---|---:|---:|---:|
| Grade A primary | BUY | 596 | -0.04272 | [-0.05342, -0.03175] |
| Grade A primary | SELL | 658 | -0.05564 | [-0.07047, -0.04066] |
| Grade B sensitivity | BUY | 459 | -0.04664 | [-0.06819, -0.02621] |
| Grade B sensitivity | SELL | 358 | -0.03181 | [-0.05136, -0.01178] |

四个 interval 全部低于零，说明 negative mean 不是只由一个 side、一个 panel 或少数日期符号造成。Grade B 不能晋级 primary，却为“first-add denominator 平均负”提供方向性 replication。

这个结果比旧 add/no-add aggregate 更精确：它把起点放在 first-add decision 前，避免把 campaign birth 到该 decision 之前的权益变化算进 add attribution；同时仍保留 decision 之后完整 terminal path。

#### 5.1 用规模感理解均值，但不能倒推被删除收益

Grade-A BUY/SELL均值约 -0.043/-0.056 USDC，说明在该baseline-filled分母里，每个first-add decision后的完整路径平均为负。将均值乘rows可得到该面板的描述性总量级，却不能说skip所有first adds会省下相同总额。

因为skip改变哪些campaign继续、是否fill与terminal，candidate outcomes不是 $-Y_i$。甚至control下一笔add为负时，skip也可能让原有inventory更难repair。均值的用途是证明研究问题有经济尺度，不是直接构造action PnL。

#### 5.2 日期聚类区间为什么比逐row t检验更可信

同日first-adds共享趋势、波动与策略初态。若某个单边日产生几十个负rows，逐row检验会把同一market shock重复计为独立证据。day bootstrap保留整日rows一起重采样，问“换一组日期，mean是否仍负”。

四个Grade/side区间全低于零，建立了稳定descriptive mean；它仍不修复filled-only selection，也不建立局部selector。这说明统计精度与因果问题是正交的：一个估计可以非常精确地回答观察性问题。

### 6. 为什么稳定负 mean 仍然不能形成 selector

研究预先审计若干 decision-visible mechanism contrasts。Grade-A BUY 中，较高 queue ahead 与更差 value 相关，较高 refill/cancel ratio 与较不负 value 相关；这些方向没有在 Grade B 复制。其它 contrasts 要么 support 不足，要么日期聚类区间跨零。

若一个状态 $g(x_i)$ 真能定位可避免的坏 adds，需要同时满足：

$$
\mathbb E[Y_i\mid g(x_i)=1]
<
\mathbb E[Y_i\mid g(x_i)=0]
$$

且差异在 future chronological folds、side-specific support 与 clustered uncertainty 下稳定。全体平均为负不会自动保证某个 feature ranking 有这种 selectivity。

因此 F10 只把证据送入 F05 predictive identity：campaign-state baseline 与 local microstructure model 做 chronological OOF 比较。后续 F05 的结果是局部增量没有稳定成立；两篇属于不同问题，不能因为 target 相同就把 provenance 混在一起。

#### 6.1 Mean、selector 与 action 是三道门

第一道门检验 $\mathbb E[Y]<0$；第二道检验decision-visible $g(X)$是否挑出更负subgroup并超过campaign-state baseline；第三道检验对该subgroup执行action的 $\mathbb E[Y(a)-Y(a_0)]>0$。逻辑关系不是蕴含链：

$$
Mean<0\centernot\Rightarrow Selector\centernot\Rightarrow Action.
$$

F10通过第一道，F05冻结local features未通过第二道，因而没有理由打开第三道。把三篇结果合并成“我们知道坏fill并能避开”会正好抹掉研究最重要的阴性边界。

#### 6.2 Queue-ahead方向未复制说明了什么

Grade A中queue ahead与更差value相关，Grade B未复制。可能是source coverage、market regime、极端queue rows或真实effect漂移。结果不足以选择某个解释，更不足以定threshold。

如果根据Grade A定义high-queue skip，再用Grade B当确认，本来需要在看Grade B前预注册；这里mechanism contrasts属于同一diagnostic审计，不能事后升格。F05 chronological OOF正用更严格方式检查增量，结果仍阴性。

### 7. 为什么“直接跳过所有 first add”也不成立

看到 BUY $-0.04272$、SELL $-0.05564$，最直觉的动作是禁止所有 first adds。但这是一个强 campaign policy，不是这项 diagnostic 的小修正。

全禁 first add 会改变 fill activity、库存上限利用、spread capture、campaign birth/death 与后续 reducing opportunity。它可能少亏，也可能通过丢失 favorable fills、延长已有库存或改变 side balance 产生新的成本。必须用明确 assignment 与完整 paired path评估：

$$
\Delta_{action}
=
\mathbb E[
Y_i(A1)-Y_i(A0)
].
$$

First-add diagnostic 没有 behavior propensity，也没有 replay candidate arm，因此 $\Delta_{action}$ 未识别。

#### 7.1 全禁动作还会改变campaign定义本身

first-add有时使inventory从一层变两层；删除它后campaign可能更早flat，也可能持续原库存更久。后续哪些fills叫add/reducing、何时birth/terminal都会变化。不能在candidate路径上沿用control campaign id与flat time。

一个合格full-path实验应在untreated first-add opportunity随机化，给candidate独立order/campaign state，并从assignment前equity计到各自terminal。activity、fills、inventory-time与tail同时报告，防止动作退化为停止参与。

#### 7.2 为什么 first-add 是好决策面，却未必是好action lever

它发生在进一步增加暴露之前、每campaign最多一次，因果起点清楚，适合预测与随机化。但一笔quote是否最终fill仍受queue与未来flow影响；one-cycle skip后来显示这种短动作常有低fill leverage。

“决策面清楚”解决身份问题，不保证treatment strength。任何successor都应先在outcome-blind mechanics中报告从decision change到fill/path change的漏斗，再决定是否打开economics。

### 8. 研究链与证据治理

完整链为：

> preregister exact first-add decision denominator → build native decision/order/fill/campaign producer → enforce feature-ready cutoff → separate Grade A/B → compute direct decision-to-terminal value → cluster by UTC day → audit mechanism contrasts → hand off prediction question，停止在 action gate 之前。

这个顺序让“loss exists”与“loss is predictable”分开。若直接在 outcome 后调 queue threshold、refill ratio 或 side rule，会在 consumed Development 上选择机制。

机器报告与 per-row evidence 位于不随公共仓库分发的 private evidence store。公共文档提供 aggregate table、方法、身份和权限边界；bare artifact hash 不能替代读者可访问的证据链接。

### 9. 最终状态与没有获得的权限

最终状态为：

$$
\text{development evidence built, no action authority}.
$$

支持：first-add decision-to-terminal value 在 BUY/SELL、Grade A/B 上平均稳定为负；exact native identity 和 causal feature clock完整；它是后续 prediction/action research 的有效 loss denominator。

不支持：稳定 local mechanism subgroup、skip/widen/cancel 动作价值、side-specific policy、live threshold 或 baseline 修改。

Validation 与 sealed holdout 未读；没有 ranking authority、action registration、policy bundle、shadow 或 live deployment 权限。

### Observational mean 的可识别边界

first-add decision后的平均terminal loss回答“当前策略在这些已发生机会上的结果怎样”。它不等于do(skip)反事实，因为是否first-add由库存、市场与旧policy共同选择。形式上

$$
E[Y\mid A=add,X]
\ne
E[Y(add)-Y(skip)\mid X].
$$

即使对$X$建模，也需要positivity：相似状态下add与skip都要有支持。历史策略若几乎总add，skip outcome只能靠强模型外推；最安全方式是随机化或paired replay。

### 每 campaign 一行牺牲了什么，又保护了什么

只取first-add row会丢掉campaign内部许多时序细节，但避免把同一terminal value复制到几十个decision/fill rows造成伪精度。后续fills与状态仍可作为mediator diagnostics，在campaign内汇总；它们不能被当作独立outcomes。

日期cluster再处理同日多个campaign的共同shock。有效统计单位因此远少于原始ticks或fills，这会让interval变宽，却更接近真正可迁移的不确定性。稳定负mean仍有描述价值；局部selector未通过说明现有features没有把负值进一步分成可执行、跨日稳定的action region。

### 全禁 first-add 的 policy paradox

若所有first-add都skip，许多campaign根本不会进入多层状态；未来“first-add机会”的数量、时点与initial inventory也改变。用observed first-add损失逐笔取负再相加，假设其它路径不变，违反dynamic policy反馈。

合法全禁实验必须从每个day初始state重放，允许两arms独立形成campaign，并以terminal daily equity比较。它还应设置activity gate，因为永不加仓可能通过减少业务近似机械改善某些tail。当前观测研究没有执行这项反事实，因此没有给全禁动作授权。

### 10. 公共证据

- [First-Add Diagnostic Preregistration](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/first_add_decision_to_terminal_loss_diagnostic_v1_preregistration_20260729.md)
- [First-Add Decision-To-Terminal Development Result](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/first_add_decision_to_terminal_loss_diagnostic_v1_development_20260729.md)
- [F10 Live/Replay Attribution README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/README.md)

公开仓库不分发 2,071 行 native panel 或 owner-side reports；本文数字来自公开 Development aggregation。

## 6. Decision-visible fill value

### TL;DR：坏成交确实存在，但当时可见的局部状态没有把它们挑出来

这项研究问的不是“成交以后平均会不会亏”，而是一个更严格的问题：**在被动订单真正成为一笔增加风险暴露的成交之前，仅凭当时已经可见的订单、盘口与 campaign 状态，能否稳定识别出价值特别差、因而可能值得未来动作研究回避的那一小群决策？**

F05 用两个互补的冻结身份回答了这个问题。第一条分支观察每个 inventory campaign 的首个 exposure-increasing ADD 决策，BUY 与 SELL 分开；第二条分支聚焦 first-opener fill，以 SELL 为主、BUY 为描述性对照。两条分支的角色不同，但都在检验同一件事：局部微观结构能否在 campaign-state baseline 之上提供可迁移的负价值选择信息。

答案分成两层。第一层成立：在冻结的 Development 分母里，first-add 或 first-opener 的后续平均价值经常为负。第二层没有成立：局部模型没有稳定优于只看 campaign 状态的基线，也没有选出置信区间可靠低于零的“更坏子集”。因此研究关闭的是这套冻结的预测身份，不是“所有 fill quality 信号”，更不是直接证明取消、放宽或抑制订单会赚钱。

本文只讨论历史 Development 研究证据，不构成交易建议。图中的 K 线、报价与成交均为合成机制示意，不是实盘行情。

![决策时可见状态与 campaign-terminal 目标的因果边界](/images/narrowgate/decision-visible-negative-fill-value-kline.svg)

*图 1：模型只能读取决策线左侧已经 feature-ready 的状态；右侧成交、库存路径与 campaign terminal 只用于构造标签。观察到负标签不等于已经识别出一个可执行动作。*

### 1. 为什么“平均坏”与“能避开坏”是两回事

设第 $i$ 个决策发生在 $t_i$，当时的策略权益为 $E_i^{decision}$，同一 campaign 最终终止或按冻结规则记账时的权益为 $E_i^{terminal}$。主目标是直接的 USDC 值：

$$
Y_i
=
E_i^{terminal}-E_i^{decision}.
$$

如果 $\mathbb E[Y_i] < 0$，只能说明这类成交在该 Development 分母里平均较差。要把它变成选择器，还需要一个只使用 $t_i$ 前信息的函数 $f(x_i)$，并证明它挑出的高风险集合真的比其余集合更差，而且这种差异在日期聚类的不确定性下仍然存在。

研究因此比较两个模型：

$$
\widehat Y_i^{M0}
=
f_0(\text{campaign state at }t_i),
$$

$$
\widehat Y_i^{M1}
=
f_1(\text{campaign state},\text{local microstructure at }t_i).
$$

真正的增量问题不是 $M1$ 能否在样本内给出漂亮排序，而是：

$$
\Delta L
=
L(M0)-L(M1)
>0
$$

是否能在严格向前的 chronological OOF 中获得正的同时置信下界。高风险阈值也只能由每个 outer-train 的过去预测分布产生，不能看见 outer-test 的实际价值后再移动。

这套设计刻意不把 maker-signed 30 秒 markout 当成 USDC 动作价值。markout 可以描述成交后的局部价格方向，但它没有自动包含成交数量、费用、后续库存、减仓、campaign 持续时间与终局记账。

### 2. 为什么把 first-add 与 first-opener 写在同一篇

两个冻结身份不是同一行数据，但属于同一个研究项目的两个角色切面。

#### 2.1 First-add：已经有暴露以后，第一次继续增加库存

first-add 分支以每个 campaign 的首个实际 exposure-increasing ADD 成交生成决策为单位。opener 与 reducing 行被排除；BUY 和 SELL 独立训练与报告。

它的 campaign-state baseline 使用：

- 决策前库存；
- campaign age；
- campaign 已实现或记账价值；
- campaign MAE；
- 已发生的 exposure-increasing fill 数；
- 已发生的 reducing fill 数。

增量局部特征包括：

- 报价到参考价的 tick 距离；
- 可用时的 exact queue ahead，以及 queue 是否可用的显式指示；
- microprice shift；
- L2 refresh 与 cancel ratio；
- local toxicity；
- policy-visible parent aggTrade flow imbalance。

队列缺失不能被解释为“观测到零队列”。模型矩阵可以使用确定性占位值，但必须同时携带 unavailable 指示；否则结构性缺失会伪装成有利的空队列状态。

#### 2.2 First-opener：从空仓进入一段新 campaign 的第一次成交

first-opener 分支观察 exact native lifecycle 中的第一笔 opener fill。SELL 是冻结的主侧，BUY 只作描述性运输检查。

其目标仍然是：

$$
Y_i^{opener}
=
E_i^{campaign\ terminal}-E_i^{submit}.
$$

但它是一个 **fill-conditioned observational estimand**：

$$
\mathbb E[Y_i^{opener}\mid F_i=1,x_i].
$$

它回答“已经成交的 opener 后来价值如何”，不回答：

$$
\mathbb E[
Y_i(\text{suppress opener})
-
Y_i(\text{submit baseline opener})
].
$$

后一个式子才是取消、延迟或放宽 opener 的动作效应，需要新的成对或随机 action identity。

### 3. 数据、时钟与因果边界

两条分支都使用 exact lifecycle，而不是靠最近时间戳拼接订单与 campaign。其公共证据边界包括：

1. 决策特征必须在 decision 或 submit clock 前完成：$\text{feature-ready timestamp}\le t_i$。
2. native 100ms L2 目标日要求完整的 previous-natural-day warmup；缺失 warmup 的目标日不能用更早日期悄悄补种。
3. terminal target 来自同一订单与 campaign 身份，不允许 nearest-time join，也不允许用 fallback mid 填补缺失的终局权益。
4. Grade A 是主 Development 证据，Grade B 只作预注册 sensitivity；两者不能池化成更漂亮的样本量。
5. 每个 outer fold 只用更早日期拟合、标准化、确定高风险分位数；test 日不反向参与阈值选择。
6. Validation 与 family-specific sealed holdout 保持未读。

first-add 的冻结面板来自 24 个 Grade-A 与 16 个 Grade-B Development 日；正式 chronological OOF 覆盖 13 个 Grade-A 测试日和 6 个 Grade-B sensitivity 日。first-opener 的 native producer 完成 22 个 Grade-A 与 11 个 Grade-B Development 日，正式评估同样使用 13 个 Grade-A OOF 日与 6 个 Grade-B transport 日。

这些日期是历史 Development 证据，不是 prospective live confirmation。100ms 是盘口源分辨率，也不是动作持有时长。

### 4. 研究链：先证明标签，再证明增量选择能力

完整链路是：

> exact order/campaign identity → decision-time causal feature snapshot → direct decision-to-terminal USDC label → past-only campaign-state M0 → campaign + local-microstructure M1 → chronological OOF loss and high-risk group → day/campaign clustered simultaneous intervals → prediction gate，而不是 action gate。

这个顺序很重要。如果连 direct terminal label 都不能精确绑定，后面的模型再复杂也只是拟合错位标签。如果局部模型没有超过 campaign-state baseline，就不能因为某些成交平均为负而跳过预测证据，直接注册“阻止这些成交”的动作。

![从负价值标签到动作价值的证据阶梯](/images/narrowgate/f05-fill-value-action-ladder.svg)

*图 2：一笔成交的 realized label、决策前可预测性、某张报价的条件价值与改变报价的动作 uplift 是四个不同命题。前一层可以为真而后一层失败；越过任何一层，都会把观察性相关误写成可执行因果结论。*

#### 4.1 四个容易混在一起的 estimand

把四层分别写成式子，会比“预测坏成交”这句口号清楚得多。第一层是成交后才能完整观察的 realized label：

$$
Y_i^{fill}=E_i^{terminal}-E_i^{decision}.
$$

第二层是在 baseline policy 下、并且条件于这笔订单最终成交后的预测问题：

$$
m(x)=\mathbb E[Y_i^{fill}\mid X_i=x,F_i=1,\pi_0].
$$

第三层是某个报价动作 $a$ 本身的条件价值：

$$
Q^{\pi_0}(x,a)=\mathbb E[Y_i(a,\pi_0^{future})\mid X_i=x].
$$

第四层才是动作研究真正关心的 uplift：

$$
\tau(x,a)=Q^{\pi_0}(x,a)-Q^{\pi_0}(x,a_0).
$$

$m(x)$ 的分母已经经过 $F=1$ 选择，而 $Q$ 与 $\tau$ 必须同时容纳“不成交、成交变晚、成交量改变、库存路径改变”这些结果。即使 $m(x)$ 准确地指出某类已成交订单平均亏损，也完全可能出现 $\tau(x,\text{cancel})<0$：取消它以后，策略也许丢掉了更便宜的减仓机会，或者稍后在更差价格重新进入。

这也是为什么本文不把 AUC、rank correlation 或 high-risk bucket 的均值直接称为“可省下的 PnL”。它们最多回答第二层；动作权限至少要穿过第四层。

#### 4.2 一条完整的合成路径：同一个坏标签可以对应相反动作价值

考虑一个纯示意的 BUY first-add 决策。决策前策略已经持有 $0.001$ BTC 多仓，当前 BUY add 报价为 100.00，SELL reducing 报价为 100.04。随后 BUY add 在 100.00 成交，十秒后中价跌到 99.96，30 秒 maker-signed markout 为负；campaign 最终在 100.02 附近减仓，计入费用后该次 decision-to-terminal 标签为 $-0.01$ USDC。

从 realized label 看，它当然是一笔“坏成交”。但若反事实动作是取消这张 BUY add，未来可能至少有两条路径：

| 路径 | baseline | candidate：取消 BUY add | 动作差值 |
|---|---|---|---:|
| A：价格继续下跌 | 100.00 成交后承担下跌 | 没有新增库存 | candidate 较好 |
| B：价格短跌后急升 | 100.00 成交并在 100.04 减仓 | 稍后在 100.03 追入或完全错过修复 | candidate 较差 |

历史只实现其中一条。仅凭 baseline 下观察到的 $Y_i^{fill}<0$，无法同时知道取消后的路径。模型若只学习“跌前的盘口长什么样”，仍然没有识别取消会怎样改变后续订单、队列和库存。

再看 first-opener。空仓时一个 SELL opener 成交后市场上涨，标签为负；抑制 opener 看似自然。然而 opener 也创建了后续 reducing BUY 的角色与 permission。删除 opener 不只是删除一笔坏 SELL fill，它会删除整个 campaign，连同后面所有可能的修复 fill。动作对比必须重放这棵路径树，而不是从历史 PnL 里减掉 opener 那一行。

#### 4.3 为什么 campaign-state baseline 是一道必要的科学门

库存方向、campaign age、此前 add/reducing 次数和已有 MAE，本身就能解释大量 terminal value 差异。一个已经持续很久、库存很深、历史 MAE 很大的 campaign，其下一笔 add 更容易落入负终局，并不需要盘口特征提供任何新信息。

因此 $M0$ 不是“故意做弱的 baseline”，而是对已有风险状态的最小调整。局部盘口模型只有在同样 inventory burden 下仍能区分价值，才可能回答“现在这张订单是否格外危险”。如果直接拿 $M1$ 与常数均值比较，模型很可能只是重新发现：库存越深，终局越差。

用残差语言表达，真正需要预测的是：

$$
R_i=Y_i-\widehat f_0(C_i),
$$

其中 $C_i$ 是 campaign state。局部状态 $Z_i$ 必须对 $R_i$ 提供稳定的未来日期解释力。F05 的结果说明，冻结 $Z_i$ 没有做到这一点；这比“模型总体 MSE 不错”更接近动作研究所需的问题。

#### 4.4 日期聚类为什么会推翻逐成交显著性

同一天的许多 first-add 并不独立。它们共享波动 regime、行情趋势、撮合负载、库存初态和同一套策略参数。一场单边行情可能同时制造几十个负标签。如果把每笔 fill 当独立样本，标准误大约按 $1/\sqrt n$ 缩小，却没有承认真正的独立冲击单位更接近“日”。

因此本文中的区间以日期或 campaign cluster 为基本重采样单位，并对两侧、多个指标和高风险选择同时修正。这个设计牺牲了表面上的显著性，却避免把“一天里重复发生的同一个市场故事”冒充成几十次独立确认。

#### 4.5 什么结果才会推翻这次阴性结论

重开研究不能只换树模型或移动分位数。至少应出现一种新的、事先可陈述的识别增量：例如 exact queue-ahead 的更高覆盖、可因果对齐的跨 venue 冲击、订单角色更细的状态转移，或直接成对生成 suppress/keep 两条完整 replay 路径。

一个合格 successor 应在结果未读前冻结：决策单位、可见特征、M0、候选动作、终局、日期切分、最小支持与同时区间。然后它需要同时证明三件事：局部信息超过 campaign baseline；选择集合在未来日期仍有方向；动作 replay 的 $\tau$ 而不是 realized label 获得正经济下界。只满足第一件，仍然只是预测研究。

### 5. First-add 结果：负平均值存在，局部增量不存在

Grade-A 主 OOF 包含 327 个 BUY 与 346 个 SELL campaign；Grade-B sensitivity 包含 172 个 BUY 与 154 个 SELL campaign。

| Side | MSE improvement，M0 minus local | 预测高风险组平均 USDC | familywise interval | 支持 |
|---|---:|---:|---:|---:|
| BUY | -0.70865 | -0.04115 | [-0.11369, 0.03795] | 否 |
| SELL | -0.000986 | -0.05798 | [-0.14776, 0.01086] | 否 |

两侧预测高风险组的点估计都为负，但同时区间跨过零。更关键的是，局部模型没有以正下界改进 campaign-state baseline；BUY 的冻结损失比较甚至明显更差。

因此，这个分支支持“first-add 平均存在负 downstream value”，但不支持“这些局部字段能可靠定位可避免的负价值子集”。

### 6. First-opener 结果：SELL 平均负值明确，选择器方向却没有成立

corrected Grade-A native OOF 的核心结果是：

| Panel | Side | OOF rows | 平均 terminal value，USDC | simultaneous interval | local MSE improvement | 支持 |
|---|---|---:|---:|---:|---:|---:|
| Grade A | SELL | 2,330 | -0.007151 | [-0.014335, -0.000496] | -0.0000782 | 否 |
| Grade B | SELL | 1,254 | -0.008095 | [-0.020291, -0.000857] | -0.0001753 | 否 |
| Grade A | BUY | 2,228 | -0.011994 | [-0.018521, -0.004809] | +0.0000008 | 否 |
| Grade B | BUY | 1,287 | -0.007831 | [-0.018774, +0.000719] | -0.0000264 | 否 |

Grade-A SELL 的平均值区间完全低于零，因此“已成交 first-opener 平均有负后续价值”得到支持。然而冻结模型挑出的 SELL 高风险组，平均值为 $-0.002960$ USDC，区间仍跨零；selected-minus-complement 的点估计还是正的，意味着被称为“高风险”的组在点估计上反而没有更差。

这不是调一个 threshold 就能修复的问题。模型没有建立出稳定的 conditional selection，继续换高风险分位数、目标时长或模型容量，会是在已经读过的 Development 上追逐噪声。

### 7. 最终结论：预测身份关闭，动作问题仍然开放

这项研究得到三个清楚的边界：

1. **支持**：若干 first-add 与 first-opener 成交在冻结 Development 分母里有负平均 terminal value。
2. **不支持**：冻结的 decision-visible local microstructure 没有稳定超过 campaign-state baseline，也没有可靠挑出更坏子集。
3. **未识别**：取消、放宽、延迟或抑制这些订单的反事实收益。

所以正确状态是：

- first-add negative-value prediction：Development closed；
- SELL first-opener local prediction：Development closed；
- Validation：未读；
- sealed holdout：未读；
- action experiment：未创建；
- live 或 baseline 变更：未授权。

阴性结果并不等于“盘口没有信息”。它说明当时冻结的特征、模型类、决策角色和 direct terminal target 没有产生足够稳定的增量预测。一个未来项目若要重开，必须带来新的因果可见信息或不同的动作机制，而不是在同一 Development 面板上换一个阈值。

### Filled-only prediction 的选择方程

令$F=1$表示订单最终成交，$Y$表示成交后的terminal value。只在fills上拟合得到的是

$$
E[Y\mid F=1,X],
$$

而动作需要比较

$$
E[Y(a)-Y(a_0)\mid X].
$$

$F$同时受quote distance、queue、market path与原策略影响，是动作后的变量。一个feature可以很好地排序已成交样本中的$Y$，却无法告诉我们取消后哪个fill消失、哪个campaign改道，也无法给未成交路径赋值。若候选动作改变$F$，训练和部署面对的条件总体已经不同。

这也解释“负平均fill value”为什么不直接支持skip。删掉一次负fill可能避免adverse selection，也可能留下更久的库存、错过repair或让下一张单失去queue。动作收益包含被删fill之外的完整路径差：

$$
\Delta V_{skip}
=
Y_T(\text{skip})-Y_T(\text{baseline}),
$$

不能用$-Y\mid F=1$替代。

### Campaign-state baseline 为什么是强对手

许多负value可由显而易见的状态解释：已有库存方向、这是第几次add、campaign age、当前spread与volatility。复杂局部特征只有在这些baseline之外仍提供chronological OOF增量，才可能形成新selector。

若模型只重发现“多层inventory更差”，高AUC不代表找到可执行微观机制；它可能只是给campaign severity重新编码。研究把campaign-state baseline放在前面，是为了检验trade/depth局部特征是否真正增加同一decision surface上的分辨率。

### 从阴性 selector 到合法 action 研究

下一步应直接生成baseline与有限候选动作的one-shot counterfactual rows，保留未激活、未成交与terminal inventory。先用outcome-blind mechanics确认动作会改变quote与路径，再用nested chronology学习$\tau(X)$，最后用repeated full-path检验policy feedback。

新的证据若要推翻本篇，需要在新日期上同时满足：相对campaign baseline的增量、足够distinct-day support、稳定方向，以及terminal action uplift。仅增加树深、换loss或在同一filled rows挑新threshold，不会改变estimand。

### 8. 公共证据

公开仓库提供方法、聚合结论和权限边界，不分发 owner-side OOF rows 或机器结果目录。主要公共入口：

- [F05 Fill Quality, Toxicity, And Quote EV README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/README.md)
- [Decision-Visible Negative Fill-Value Evidence M0 v1.1](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/docs/decision_visible_negative_fill_value_evidence_m0_v1_1_development_20260729.md)
- [SELL First-Fill Conditional Value Feasibility v3](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/docs/sell_first_fill_conditional_value_feasibility_v3_development_20260730.md)

这些链接用于理解当前公开叙述。精确复现历史冻结结果时，应使用相应报告声明的 source identity 与 artifact manifest，而不是把滚动的 main 分支当成证据快照。

## 7. BUY soft-widen action

### TL;DR：报价真的向内移动了，但有利的终局路径太稀少，模型反而选中了负价值动作

BUY soft-widen 是一条历史 fill-quality 机制：当某些 BUY 状态看起来更危险时，策略把 BUY 报价向外放宽。早期 filled-only classifier 只能回答“在 baseline 下已经成交的样本后来好不好”，它不能回答解除放宽是否真的改善动作价值。

F05 因此冻结了一个直接反事实：在一个预先抽中的 canonical 10 秒 BUY quote decision 上，如果该侧已有 soft-widen，只把这一次决策的 spread multiplier 上限设为 $1.0$，随后立刻回到原 baseline，会不会改善从决策到自然日终 MTM 的完整路径价值？

动作在机械上很真实：960 个 forks 全部到达精确目标，opener 与 add 的 BUY 报价中位数都向内移动 13 ticks。可是动作通常没有改变成交路径。480 个 opener forks 中只有 20 个出现非零 terminal delta，480 个 add 中只有 15 个。chronological OOF 模型选中的 opener 与 add 动作平均值都为负；add 的 95% 日期聚类区间完全低于零。

所以研究关闭的是“一次性解除现有 BUY soft-widen”这个精确动作。它没有证明所有 tightening 都有害，也没有证明 soft-widen 本身是最优；它只说明旧 filled-only score、旧阈值与这个 one-decision lever 没有形成可晋级的直接 action value。

本文是历史 Development 研究复盘，不是交易建议。图中的 K 线和报价为合成机制图，不对应实盘。

![BUY soft-widen 单次解除的 K 线与报价双路径](/images/narrowgate/buy-soft-widen-release-kline.svg)

*图 1：candidate 只在冻结决策点把 BUY quote 从 widened level 拉回 multiplier 1.0；下一个普通 quote decision 立刻回归相同 baseline。未来完整路径可能相同，也可能因为一次 fill 差异发生分叉。*

### 1. 为什么旧的 filled-only 模型不能决定动作

设 $F=1$ 表示 baseline BUY order 最终成交。旧问题近似为：

$$
\mathbb E[Y\mid F=1,x,\pi_0].
$$

这可以训练一个 fill-quality ranking，但它把分母限制在 baseline 已经成交的样本中。若 candidate 把报价向内移动，它不仅可能改变成交后的 value，还会改变：

- 是否 activation；
- 何时进入 queue；
- 是否 fill、partial fill 或 cancel；
- 后续 inventory 与 cooldown；
- campaign 是否提前出现或延后结束；
- 当日终点的 remaining inventory 与 MTM。

因此动作所需的目标是：

$$
\Delta Q^{\pi_0}(x_t)
=
Y_{t\rightarrow T}
\bigl(\text{release one soft-widen}\bigr)
-
Y_{t\rightarrow T}
\bigl(\text{current baseline}\bigr),
$$

其中 $T$ 是冻结的自然日终 MTM 记账点。两个 forks 在 $t$ 前路径完全相同，只有该次 BUY quote decision 不同；动作以后都回到 $\pi_0$。

这个差分自动消去 pre-assignment PnL：

$$
E_t^{candidate}-E_t^{baseline}=0.
$$

剩余 delta 来自该次 quote 改动引起的 activation、queue、fill、inventory 和后续顺序路径差异，而不是重复计算历史收益。

### 2. 动作合同：只改一次，只改 BUY，只改 exposure-increasing quote

冻结 candidate 可以写成：

$$
m_{BUY}^{candidate}(t)
=
\min\left(m_{BUY}^{baseline}(t),1.0\right).
$$

只有在 baseline 已存在 $m_{BUY}>1.0$ 的 soft-widen 时，动作才有资格进入 opportunity census。

动作边界如下：

- side 固定为 BUY；
- SELL quote 不直接改变；
- reducing quote 不改变；
- opener 与 add 分开拟合、分开过门；
- assignment unit 是一个预冻结 canonical 10s quote decision；
- action duration 只有一个 quote decision；
- 下一次决策起恢复当前 baseline；
- order size、inventory limit 与其它安全边界不改变；
- queue、fill、inventory、cooldown、campaign 和日终路径都在两个 forks 中重新生成。

“单次”很关键。若 candidate 在后续每个决策持续解除 soft-widen，它会成为 repeated policy，改变 action rate、campaign birth/death 与库存分布，不能继承 one-shot 结果。

### 3. 数据、抽样与 chronological OOF

Development panel 含 40 个冻结历史日。outcome-blind census 找到 142,891 个 baseline-eligible、exposure-increasing BUY decisions，且这些决策已有 multiplier $>1.0$。

为了在全路径 forks 的计算预算内保持日期与 role 覆盖，研究在结果未读前按稳定 hash 每日每 role 抽 12 个机会：

| Role | 每日样本 | 总 forks |
|---|---:|---:|
| opener | 12 | 480 |
| add | 12 | 480 |
| 合计 | 24 | 960 |

稳定 hash 只使用日期、decision timestamp、side 与 role，不能看未来 value。

直接价值模型是固定 Ridge，$\alpha=10$，不做 hyperparameter search。它读取冻结的 causal features，包括 toxicity、direction/return/volatility heads、inventory units、baseline quote distance、已有 spread multiplier、BBO spread、microprice、L2 imbalance/refresh/cancel、短期价格变化、taker imbalance 与 VPIN。

chronological OOF 使用 16 个初始 train 日，随后四个各 6 日的未来 test block。每一折只用过去拟合 scaler 与 Ridge。候选阈值冻结为：

$$
\widehat{\Delta Q}(x)\ge 0.0001\ \text{USDC/action}.
$$

不允许看见 test delta 后再调整阈值、role pool 或 feature set。

### 4. 时钟与因果边界

研究把四种时间分开：

1. **Decision clock**：canonical 10s opportunity 的 quote decision timestamp。
2. **Feature-ready clock**：所有模型输入完成可见的时间，必须不晚于 decision。
3. **Exchange lifecycle clock**：activation、GTX、fill、cancel request 与 ACK 的发生顺序。
4. **Economic ownership clock**：从 target decision 开始，到自然日终 MTM 结束。

十秒不是预测未来十秒的固定 horizon，也不是 candidate 强制存活十秒。它只是选择一个可重复的 quote-decision cadence。订单生命周期可以短于或长于十秒，终局 delta 仍由完整当日路径决定。

两 arms 必须使用相同市场路径、初始状态与随机机制；candidate 只能改变目标 quote。若 replay 因 action 分叉产生不同后续 fills 与 inventory，这是 estimand 的一部分，不是需要“修正掉”的噪声。

![从 fill-quality 线索到单次动作价值](/images/narrowgate/f05-fill-value-action-ladder.svg)

*图 2：旧模型停在“已成交样本后来好不好”；本研究把问题推进到“同一决策若释放一次 soft-widen，完整路径相对 baseline 改变多少”。机械动作、路径分叉与经济增益必须分别过门。*

#### 4.1 One-shot intervention 的递归定义

把策略状态记为 $S_t$，市场事件为 $M_{t:t+1}$，基线策略为 $\pi_0$。两条 replay 在目标决策前共享同一历史：

$$
S_t^{(1)}=S_t^{(0)}.
$$

baseline 执行 $a_t^{(0)}=\pi_0(S_t)$；candidate 只在这一点执行 $a_t^{(1)}=\phi(a_t^{(0)})$，其中 $\phi$ 把 BUY soft-widen multiplier 截到 1.0。之后两者都恢复同一个策略函数：

$$
a_u^{(k)}=\pi_0(S_u^{(k)}),\qquad u>t.
$$

注意“恢复同一函数”不等于“恢复同一动作”。如果目标报价制造了不同 fill，$S_{t+1}^{(1)}\ne S_{t+1}^{(0)}$，同一个 $\pi_0$ 也会输出不同后续订单。正是这条状态递归，使 full-path delta 同时包含直接成交价、未来库存角色和 campaign 终点。

#### 4.2 一条从 K 线到终局的合成算例

设目标时刻 BBO 为 100.00/100.02，baseline 因 soft-widen 把 BUY 放在 99.87，candidate 将它拉回 100.00。之后有三种典型情况：

1. 市场最低只到 100.01：两臂都不成交，terminal delta 为零。
2. 市场打到 100.00 后继续跌到 99.80：candidate 新增 BUY fill 并承担下跌，delta 为负。
3. 市场打到 100.00 后反弹到 100.06：candidate 先成交、再由 reducing SELL 修复，delta 可能为正。

报价移动 13 ticks 只证明价格几何改变；真正的 treatment strength 是第二、第三类 path-changing cases 的频率与价值。F05 观察到的非零 terminal path 只有 opener 20/480、add 15/480，说明多数历史市场轨迹根本没有穿过两张报价之间的狭窄区域，或者虽穿过却没有改变最终撮合与库存路径。

这也解释一个反直觉现象：一张报价可以移动很多 ticks，却没有改变 fill count。两个订单可能仍各成交一次，但成交时间与价格不同；也可能目标订单不成交、稍后的 reprice 成交，导致总数相同而 terminal value 不同。因此研究同时检查 target mechanics、订单身份、path delta 和总 fill count，不能只看其中一个。

#### 4.3 路径稀疏会制造怎样的学习问题

当 $D=0$ 时，所有候选特征对应的标签都恰好为零；当 $D=1$ 时，少数 delta 可能正负幅度很大。于是 direct-value learning 实际同时面对两个子问题：

$$
p_D(x)=\Pr(D=1\mid x),
$$

$$
m_D(x)=\mathbb E[\Delta Q\mid D=1,x].
$$

总体价值是 $p_D(x)m_D(x)$。一个模型若只会预测“行情是否会触及 inward quote”，可能提高 $p_D$ 排序，却不能判断分叉后 $m_D$ 的符号；一个只在非零样本上训练的模型又会丢失行动分母，产生选择偏差。冻结 Ridge 直接学习 unconditional delta，虽然保守，却忠实于 action value。

样本中正路径更少：opener 的非零路径为 5 正、15 负，add 为 4 正、11 负。任何复杂模型都很容易围绕这 9 条正路径形成脆弱规则。chronological OOF 的意义就是要求规则先在过去形成，再面对尚未见过的日期；不能让同一条正 campaign 同时参与特征选择和效果展示。

### 5. 机械验证：不是 no-op

960 个 forks 全部：

- 到达精确 target decision；
- 保留冻结 role 与 policy permission；
- 产生与 baseline 不同的可执行 BUY price；
- 完成 mechanics accounting。

报价向内移动幅度为：

| Role | Forks | 平均 inward ticks | 中位数 | 范围 |
|---|---:|---:|---:|---:|
| opener | 480 | 15.35 | 13 | 7–98 |
| add | 480 | 14.86 | 13 | 7–81 |

抽样 Python/C++ mechanics parity 对一个 opener 和一个 add 完全一致，包括 target、role、permission、multiplier 与 effective price。相关合同测试通过。

这证明 candidate 真正改变了报价几何，不是“模型输出了 action，但执行价格没有动”的伪实验。

### 6. 为什么价格移动很大，终局路径却很少改变

动作的 terminal nonzero support 很稀疏：

| Role | 非零 terminal paths | 比例 | 正 delta | 负 delta |
|---|---:|---:|---:|---:|
| opener | 20 / 480 | 4.17% | 5 | 15 |
| add | 15 / 480 | 3.13% | 4 | 11 |

所有 960 个 forks 的总 fill count 都与 baseline 相同。这并不意味着 action 没有效果：同样的 fill count 可能对应不同成交时点、价格、订单身份与后续 campaign path。但它说明绝大多数 one-decision quote change 没有改变最终可见的顺序路径。

如果记 $D_i=1$ 表示 candidate 与 baseline 的 terminal path 不同，则估计对象可以分解为：

$$
\mathbb E[\Delta Q]
=
\Pr(D=1)\,
\mathbb E[\Delta Q\mid D=1].
$$

这里 $\Pr(D=1)$ 只有约 3%–4%。少数分叉的绝对 delta 可能很大，因此 unconditional mean 很容易被几条路径支配；这也是为什么研究需要按 UTC 日 bootstrap、winsorized sensitivity 与正日比例，而不能只看总和。

### 7. Direct-value OOF 结果

冻结 selector 在未来 OOF 的表现是：

| Role | OOF selected | 平均 USDC/action | 95% UTC-day CI | USDC/OOF day | 95% UTC-day CI | 正日 |
|---|---:|---:|---:|---:|---:|---:|
| opener | 92 / 288 | -0.00003478 | [-0.00009626, +0.00000217] | -0.0001333 | [-0.0003500, +0.0000083] | 1 / 24 |
| add | 187 / 288 | -0.00003636 | [-0.00007202, -0.00000656] | -0.0002833 | [-0.0005708, -0.0000500] | 0 / 24 |

两个 role 都有足够 mechanics 与 selected-row support，却都失败经济门：

- opener 的区间跨零，且只有 1/24 OOF 日为正；
- add 的平均值和日总值区间都完全低于零；
- 预测与实际 value 的相关系数为 opener $-0.0562$、add $-0.0272$，方向几乎没有可用关系。

全 480 actions/role 的 unconditional point estimate 被少数大 forks 拉成正值，但日期聚类区间仍跨零。99% winsorized mean 则为：

$$
\text{opener}=-0.00003375,
\qquad
\text{add}=-0.00002606
\quad \text{USDC/action}.
$$

这些 sensitivity 解释结果，却不能替换预注册 OOF gate。

### 8. 为什么不能“再调一下旧阈值”

研究失败不是因为动作没有触发，也不是因为报价只移动了半个 tick。动作平均移动约 15 ticks，mechanics 很明确。

真正失败的是：

1. path-changing events 稀少；
2. 局部 causal features 没有识别出其中有利的 continuation；
3. OOF selector 选中的动作平均为负；
4. role-specific 日期方向没有稳定性。

旧 filled-only classifier 的 score threshold 研究的是另一个分母。把它重新调到一个让 backtest 好看的值，不能补齐 direct action contrast。把 one-shot action 改成多次持续 release 也会创建新的 intervention duration 与 sequential feedback，不能继承本结果。

#### 8.1 无条件均值为正，为什么 selector 仍然可以为负

全体 forks 的 point estimate 被少数大路径拉成正值，而 OOF selector 选择的集合为负，这两者不矛盾。无条件均值回答“每个机会都 release 会怎样”；selector 回答“模型认为值得 release 的机会怎样”。若模型排序方向错误，它可能系统性避开少数正路径、选中更多负路径。

形式上，设 $G(x)=1$ 为模型选中：

$$
\mathbb E[\Delta Q]
=
\Pr(G=1)\mathbb E[\Delta Q\mid G=1]
+
\Pr(G=0)\mathbb E[\Delta Q\mid G=0].
$$

总体略正不要求第一项为正。研究权限取决于预注册 selector 的 OOF 值，而不是在读完结果后改成“全做”或重命名目标。

#### 8.2 这次结果排除了哪些替代解释

mechanics parity 与 960/960 exact target 排除了“动作没有执行”；报价中位数移动 13 ticks 排除了“杠杆太弱到无法观察”；完整 paired path 排除了 pre-action PnL 污染；日期聚类区间排除了逐 action 伪独立；opener/add 分开则避免角色池化造成 Simpson reversal。

仍未排除的是另一种 intervention duration、另一种 BUY 状态表示、持续多决策 release，或完全不同的动作如 farther/skip/re-center。它们会改变 treatment、风险集与后续反馈，必须各自注册，不能把本项目的阴性结论外推成普遍定理。

#### 8.3 一个未来 successor 应怎样设计

如果要重开，最有信息量的方向不是在 960 个已读 forks 上继续扫阈值，而是先扩大 outcome-blind opportunity census，再冻结两阶段目标：第一阶段预测 path change，第二阶段在 path-changing 风险集内估计 signed terminal value，同时用 doubly robust 或随机化 replay 对最终 policy value做独立验证。

候选还应明确 duration，例如 one-shot、连续 3 个决策或直到某个状态解除；三者是三种 treatment。每个 treatment 都要报告 action rate、nonzero-path rate、fills retained、inventory-time、terminal mean、left tail 与正日比例。只有“价格移动”通过而这些经济门失败，仍然不能获得 action authority。

### 9. 最终结论与权限

冻结结论是：

$$
\text{close buy soft-widen release single-decision action value on Development}.
$$

具体边界：

- 关闭：在一个 canonical BUY decision 上解除既有 soft-widen，随后回 baseline；
- 不关闭：所有未来 BUY tightening、其它 duration 或其它 state representation；
- 旧 filled-only model 与旧阈值：只保留历史研究意义；
- multi-decision policy：未创建；
- Validation 与 sealed holdout：未读；
- action、shadow、baseline 或 live 权限：没有获得。

阴性 action study 仍然有价值。它把“模型看起来能预测坏 fill”推进到真正的报价反事实，并发现这个 lever 的 treatment strength 虽然在价格上很大，在终局路径上却非常稀疏。

### One-shot 与 repeated policy 的数学边界

one-shot intervention只在冻结decision $t_0$把baseline quote改成soft-widen/release，之后两arms都回到同一baseline rule，但各自从已经分叉的state继续：

$$
S_{t_0+1}^{a}=F(S_{t_0},M_{t_0:t_1},a),
\qquad
A_{t>t_0}^{a}=\pi_0(S_t^{a}).
$$

它估计一次局部改变的总路径效应。repeated policy则在每个未来eligible decision继续按selector动作，既改变state distribution也改变后续eligibility。两者可能反号，所以one-shot适合发现，不能直接当长期policy value。

### 为什么报价移动很多、有效路径仍然少

quote-changed只说明理论或提交价格不同。要改变terminal outcome，还需订单实际激活、在撤换前走到有差异的queue/fill状态，并让这次差异影响campaign。若两价位同处一个tick、都未触达、都在ACK前撤销或后续迅速被相同repair覆盖，最终path不变。

可以把effective leverage写成漏斗：

$$
r_{eff}
=
r_{quote}\,r_{active}\,r_{market\ separates}\,r_{fill/path}\,r_{terminal}.
$$

每一项都小于1，故大幅quote movement与稀少terminal differences可以同时成立。学习器真正看到的正负action labels数量远小于decision rows；这也是时间外selector容易被少数日支配的原因。

### Release 动作的经济方向为何不由“更积极”决定

向内移动BUY exposure-add可能提高fill和spread capture机会，也可能在下跌前增加LONG。若当前inventory本已SHORT，同样BUY又可能是reducing而非add，因此研究必须锁定role。即便role固定，value仍取决于queue、后续price path与campaign repair。

本篇阴性结果关闭的是当前soft-widen/release selector，不等于所有更积极BUY都差。后继若使用不同action strength、state或持续性，需要先在新outcome-blind面板确认leverage，再冻结nested OOF与repeated replay；不能围绕旧阈值继续调。

### 10. 公共证据

- [BUY Soft-Widen Release Single-Decision Action Value v1](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/docs/buy_soft_widen_release_single_decision_action_value_v1_development_20260804.md)
- [F05 Fill Quality, Toxicity, And Quote EV README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/README.md)

公开报告包含聚合数字、方法与权限边界。精确 fork rows、OOF decisions 与机器 manifest 属于未随公共仓库分发的 evidence store。

![Fill Quality 从 markout 到 randomized quote action 的阶段结果收敛](/images/narrowgate/fill-quality-research-synthesis.svg)

*图：生命周期 estimand 与描述性归因得以保留，但 first-add subgroup、decision-visible selector 和 soft-widen action 都没有形成可执行正价值。*

## 8. 合并后的结论：观察到损失，不等于已经找到可执行过滤器

完整链条给出了三个层次分明的阴性结果。第一，30 秒 markout 只能描述早期 adverse selection，不能替代 campaign terminal。第二，first-add 在历史上平均为负，但 decision-visible state 没有识别出稳定、跨日可执行的负价值 subset。第三，即使 soft-widen 确实改变报价，最终动作价值仍为负。由此不能跳到“所有 first-add 都应该关闭”，更不能把 filled-only classifier 当作 policy。

未来研究若要继续，必须从 assignment 前定义 intervention，保留未成交与取消路径，并让 action-specific activation、fill、inventory continuation 和 terminal value 共同进入评估。只有预测谁会成交、谁的 markout 较差或哪些历史 campaign 较亏，都不足以授权 quote action。
