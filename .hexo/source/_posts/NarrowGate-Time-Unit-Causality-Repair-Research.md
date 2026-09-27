---
title: 'NarrowGate Replay Evidence Revalidation：时间、量纲与因果时钟修复后，旧结论还剩什么'
date: 2026-08-29 13:30:00
updated: 2026-09-27 10:45:00
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



回测中的时间与量纲不是显示细节。它们决定策略何时看见信息、订单何时生效，以及哪笔成交进入账户。修复这些定义以后，旧结果需要按受影响的执行路径重新判断；保留历史研究过程，不等于保留已经失效的精确收益。

## 延迟怎样进入策略比较

以下讨论源于 2026-09-05 的环境复验设计，描述当时的方法与证据范围，不是今天的运行进度。

当时的 B0（不增加候选动作的对照策略）与候选尚无该环境下的完整配对经济结果。下面的执行设计不构成新的收益证据。

环境复验要回答的是：**在已经测量到的延迟环境中，这一次首次开仓、再次增仓或继续保留挂单，相比等待是否值得？** NarrowGate 并非没有事前控制：决策可见的毒性、方向、收益预测和 weighted-mid proxy 可以影响报价；成交后的冷却、markout 反馈和风险退出也能保护下一次决策。尚未充分闭合的是从信号到可执行动作，再到完整 campaign 终点增量价值的证据链。

### 不是从零开始，也不是把旧失败重新命名

公开研究已经检验过 [SELL first-opener 的条件价值](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/docs/sell_first_fill_conditional_value_feasibility_v3_development_20260730.md)、[首次增仓的决策可见负价值](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/docs/decision_visible_negative_fill_value_evidence_m0_v1_1_development_20260729.md)，以及 [ADD NOW 相对 WAIT ONE EXTERNAL EPOCH](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/docs/multiscale_ema_add_wait_incremental_value_v1_2_development_20260809.md)。这些冻结身份没有证明稳定的选择增益。因此，正确说法是“选择能力尚未验证”，不是“从未研究事前选择”。用未来的 campaign 结果构造训练标签也不等于事后动作；关键是输入何时可见、动作何时生效，以及训练是否只使用过去的数据。

旧关闭结论继续约束原候选与原面板；新的延迟环境只提供明确标注的环境迁移复验理由，不自动开启旧 holdout，不允许一边观察新结果一边改阈值。复验未通过时，不把失败解释成冷却常数已经最优，也不据此否定所有不同的状态或动作模型。

### 对照组需要相同的执行环境

延迟不能压成一个额外常数，也不能把多个阶段的 p99 相加。需要分别表示源消息产生与到达、特征完成、决策计算、GLOBAL FIFO 请求等待、交易所生效，以及 HTTP 返回与私有回调可见时间。Depth 总年龄还包含源更新间隔和快照调度等待，不能整段再作为网络延迟采样，否则会重复计算等待。不能从平均 RTT 或 RTT/2 推断不可观测的交易所生效时刻。

本轮可取得的原始运维样本保存在私有证据库，不随公共仓库分发。短窗口的百级请求样本只能提供有限的经验分布和实现诊断，不能冒充长期稳定的尾延迟分布。无法识别的时刻保留为显式假设及敏感性范围；原始尾部不因数字难看而默认截去。本轮没有可公开声称的完整 market-event→exchange-effective 实测 p99。

两臂共享行情交付和外部网络扰动的生成规则，能够对应的请求使用相同 keyed draws；候选改变请求数量以后，各自的 FIFO 等待、订单队列、成交、库存和 campaign 必须独立演化。不能强行给两臂相同的最终等待时间，也不能把 B0 的成交路径缓存给候选。Python/C++ 共享内核一致不等于完整运行机制一致；缺少当前机制的 backend 不用于出具当前环境的经济结论。

实现方面，确定 native 字段、统一加载边界和日志复用已验证模型 metadata 的调整见[源码修复提交](https://github.com/xiao-nanbei/NarrowGateMaker/commit/13d44967)；root-private 部署环境文件的受限元数据读取见[部署修复提交](https://github.com/xiao-nanbei/NarrowGateMaker/commit/db0122cd)。这些是工程变更，不构成延迟收益或策略收益证明；新的异步生命周期与分源可见性覆盖仍须由完整 replay 验证，不能用公共模板或旧 40/50 日金额代替实际 B0。

### 用三个决策面组织有限的复验

| 决策面 | 要比较什么 | 必须保持的边界 |
| --- | --- | --- |
| 首次承担风险 | 当前方向、价格和数量的 opener 相对等待 | BUY/SELL 分开；等待期限和重新进入规则在结果前确定 |
| 挂单继续暴露 | 保留队列位置相对撤单、等待终态再重入 | 撤单真正生效前仍可成交；unknown 不释放 ownership |
| 再次增仓 | 基线允许的 ADD 相对继续等待 | 市场恢复与计时到期不是同一对象；减仓和风险退出不受选择器阻挡 |

共同目标是固定后续保护策略下的增量价值，而不是单独预测某笔成交后的涨跌：

$$
\Delta V(s)=\mathbb E\!\left[R_{\mathrm{terminal}}\mid s,\mathrm{action},\pi_0\right]-\mathbb E\!\left[R_{\mathrm{terminal}}\mid s,\mathrm{wait},\pi_0\right].
$$

这里的终点收益来自完整现金流和剩余库存计价；不把同一个 campaign 的终点 PnL 重复算给每个决策。历史价格档数据不能恢复全部订单级队列身份，queue/fill 仍须作为模型假设报告，而不是要求模拟成交与 live 逐笔相同。

执行顺序是：先补齐当前 B0 与 no-op 对照；再重做 BUY/SELL、opener/add/reducing 的损失归因；随后用现有信号和少量预先确定的动作检验事前选择的独立增益。SELL 增仓过滤等候选先经过支持和机制检查，不先扩展成新的大参数网格。此前的 deadline-floor 和细分 cooldown 暂不作为优先调参对象；它们保留原定义，供后续有明确增量问题时复验。

第一轮固定相同的成交后冷却、markout、库存限制和退出规则，避免“增加事前选择”和“撤掉事后保护”混成一个处理。只有事前机制在完整配对路径中显示稳定增益，才逐项做事后保护的消融。必须同时报告分侧成交、maker 毛收益、taker 与费用、terminal MTM、tail、库存 MAE、修复时间和 quote uptime；少成交或短期 markout 改善本身不能证明策略更好。

截至该历史设计阶段，工程进展尚未形成新的完整经济结果。 旧临时交付包未找回时，任务记录只能恢复研究线索，不能替代原始报告、补丁与输出；不会把残缺旧结果拼成新 B0，也不新增 live shadow 来代替离线复验。


## 1. 修复基础设施与重验旧证据是一项研究

时间单位、方差 ABI、feature-ready clock、timer event、commission 与 campaign accounting 的修复，不只是工程 housekeeping；它们会改变事件先后、订单生命周期和两个策略 arm 的分叉方式。因此需要进一步核对历史证据：先说明 identity 为什么变，再判断旧结论中哪些方向仍安全、哪些精确数字必须撤回。

reservation-price 风险项提供了最直观的量纲检查：

$$
r=s-q\gamma\sigma_{\text{price}}^2H.
$$

这里 $q$、$\gamma$、绝对价格方差与风险期限必须闭合；60 个 1 秒观测构造的短期方差 lookback，不等于固定 $H=1s$ 就经济正确。类似地，replay 中一个缺失 timer event 会改变 cancel、fill 与 inventory transition 的先后，错误不再是两 arm 可相消的共同常数。

## 2. 研究阶段与证据状态

| 阶段 | 它真正问什么 | 结论/权限 |
|---|---|---|
| Time/unit/causal-clock repair | 单位、窗口和事件时钟怎样改变完整订单路径？ | 缺陷修复；旧 replay identity 失效 |
| Historical evidence revalidation | 修复后哪些旧结论还能保留？ | no-promotion 方向保留；旧 PnL/winner/rankings 撤回 |

## 3. Time/unit/causal-clock repair

### TL;DR：单位、feature-ready clock 或 timer event 错一个，改变的不只是指标，而是整条订单生命周期

maker replay 常被误认为“把历史 trades 依次送进策略”。NarrowGate 的系统审计发现，真实 replay 还需要正确处理 variance unit、quote horizon、feature bucket visibility、cross-day warmup、markout observation、partial-fill quantity、book/timer events、wall-clock duration、calendar physical unit、commission asset、tick/lot 与 terminal equity。

早期系统把一秒 absolute-price variance 的平方根同时乘 inventory 和 mid，单位错误；使用 per-second variance却没有明确 integration horizon；把左标 10 秒 feature bucket在 bucket开始暴露，形成 lookahead；主要靠 trades推进 quote timers，导致 sparse periods中的 TTL、cooldown、requote、stale-book、markout 与 inventory-time停滞；又用“有 trade 的 unique seconds”和 event count估计 day exposure与 capacity，混淆事件与时间。

修复后的 replay使用 causal merged stream：individual execution trades、historical BBO/L2 state changes 与固定 100ms timer deadlines。合成 book/timer rows可以推进状态，却不能消费 queue或制造 fill。一个 real-data 10分钟 parity window中，Python/C++ 都产生 2 fills、9,461 clock events、101 requotes，PnL差仅 $2.2\times10^{-15}$ USDC。

修复的非线性影响也很直观：同一 full-day public-template diagnostic 从 legacy trade clock的178 fills / $-0.97$ USDC变为 merged clock的184 fills / $+1.18$ USDC。这不是 alpha result，而是证明旧 evidence不能继续引用。

后续 time/unit contract又修复 calendar microsecond→1970 bug、commission asset、daily PnL rollover、post-fill volatility、tick/lot、bar ns/ms和标签语义，形成 causal-v7。42 日 formal replay完成 776,048 order rows；相对旧 v6，raw PnL改变 $-3.7363$ USDC、fills $+88$、absolute inventory time $+205.02$ BTC-hours。13-head bundle虽完整，strict ML A/B的 raw/terminal evidence仍未通过，inference保持 disabled。

因此 SYS 项目的最终结论是：**defects repaired；old replay evidence superseded；successor model/action still no promotion**。正确性修复是研究的必要条件，不是策略收益。

本文只讨论公开 system-engineering evidence，不构成交易建议。图中的 K 线、event stream 与订单状态为合成机制图，不是实盘。

![NarrowGate replay 的单位、feature clock 与 merged causal event stream](/images/narrowgate/time-unit-causality-repair.svg)

*图 1：价格 variance 先按 horizon积分并乘 BTC quantity；feature 只能在 bucket end ready；trades、book changes 与 100ms timers共同推进生命周期。任何一层错误都会改变 fills、inventory与 terminal value。*

![从物理单位、因果时钟到策略证据的修复栈](/images/narrowgate/sys-replay-causality-repair-stack.svg)

*图 2：修复按依赖顺序向上推进。底层单位和时间不成立时，上层Python/C++ parity只会稳定地复现同一个错误；event与state正确后，才轮到action economics。*

### 1. 为什么这些修复是一项研究，而不是九个小 bug

这些缺陷看似分散：一个公式多乘 mid、一个 timestamp单位错、一个 timer没有 tick、一个 commission asset丢失。但它们都回答同一个系统研究问题：**历史 replay 是否在正确单位、正确可见时间和完整 wall clock 上重现策略可执行的状态转移？**

研究 identity 的终点也一致：建立一个 frozen formal replay contract，让 Python/C++ 对相同 causal inputs锁步，再看修复后的模型或动作是否通过 promotion gate。各项实现修正属于必要条件，不是独立的收益增量。

### 2. Variance unit：不要把价格波动再乘一次 mid

若 $\sigma_p^2$ 是一秒 absolute-price variance，单位为

$$
[\sigma_p^2]
=
(\mathrm{USDC/BTC})^2/\mathrm{s},
$$

则 horizon $H$、inventory quantity $q$ 的 PnL volatility为

$$
\sigma_{PnL,USDC}
=
\sqrt{\sigma_p^2 H}\,|q|.
$$

单位检查：

$$
\frac{USDC}{BTC\sqrt{s}}
\times\sqrt{s}
\times BTC
=
USDC.
$$

旧实现又乘 mid-price，会多出 USDC/BTC，结果不再是 USDC。这个错误会扭曲 circuit breaker、exit urgency 与 quote risk，而不是只让 report label难看。

quote_horizon_s 与 pnl_volatility_horizon_s 也必须分开。per-second variance没有天然的“10 秒风险”；当前 public quote horizon明确为 1 秒，PnL risk horizon是另一项冻结参数，不能从 quote horizon推断。

ML-OFF 时 neutral prediction令 vol_10s=0，不能拿 dimensionless realized-return volatility替换 absolute-price variance。Post-fill接口则明确接收 volatility_bps，live/replay按同一公式转换。

#### 2.1 一个量纲算例

假设absolute-price volatility为 $20\ \mathrm{USDC/BTC}/\sqrt{s}$，风险horizon为10秒，inventory为$0.01\ BTC$。正确的PnL标准差是

$$
20\times\sqrt{10}\times0.01
\approx0.632\ \mathrm{USDC}.
$$

若再乘一个60,000 USDC/BTC的mid，数值会膨胀到约37,947，而且单位变成$\mathrm{USDC}^2/\mathrm{BTC}$，已经不是损益。这个例子说明“vol是价格还是收益”“variance按秒还是按窗口”“quantity以BTC还是订单单位计”必须作为接口类型，而不能留给参数调优吸收。

同理，若输入已经是10秒累计variance，再乘$H=10$会重复积分；若输入是dimensionless return variance，则必须先乘价格尺度才能转成absolute-price风险。数值相近不能替代量纲闭合。

### 3. Feature visibility：index time 不是 ready time

左标 10 秒 row at $t$ 覆盖区间 $[t,t+10s)$。策略直到 bucket结束才可能知道完整统计，因此

$$
t_{feature\ ready}=t_{index}+10s.
$$

replay lookup必须用 $t_{ready}$，不是 raw index。旧 cache在 timestamp semantics变化后整体失效，不能只改 metadata让历史 predictions看起来 causal。

同样规则适用于 five-minute metrics、external joins 与 parent aggregate trades。一个 child trade在 exchange time已发生，不代表 policy-visible flow在 parent message ready前可用。

forward labels也必须冻结半开区间 $[t,t+h)$，排除恰在 $t+h$开始的 bar。历史兼容名 label_ret_10s/label_dir_10s 实际可能表示 decision到 fill最多 $h$，fill后再 markout $h$，总 span在 $h$到$2h$之间；metadata必须说出真实语义。

### 4. Cross-day warmup 与 calendar physical unit

rolling 6h/24h/7d state不能在 UTC midnight清零。修复后的 daily feature generation最多读取七个 immediately contiguous prior days作 causal warmup，遇到第一个缺日即停止；external joins与 labels在 warmup后 slice回 target day，未来日不能进入目标。

Parquet datetime index可能保存为 ms、us或ns。旧 converter先把 datetime cast成数字，再用 magnitude阈值猜单位；microseconds被当作 nanoseconds，十九个 training days的 calendar/session features落到1970年。

修复先保留 physical dtype，再按 seconds/milliseconds/microseconds/nanoseconds显式转换；calendar tables超出 declared local-year support时 fail fast。即使 validation/test没有这个特定 bug，training distribution已改变，旧 model也不能继续 authoritative。

### 5. Merged causal event clock：没有 trade 时，时间仍在走

旧 Python/C++ tick loops主要在 execution trade到来时推进 quote timer。若市场数秒没有 trade，现实中的 TTL、cooldown、cancel ACK deadline、requote、stale-book guard与 pending markout仍会到期，旧 replay却像时间停止。

formal replay的新 stream为

$$
\mathcal S
=
\mathcal T_{trades}
\cup
\mathcal B_{book\ changes}
\cup
\mathcal D_{100ms\ deadlines},
$$

按 causal timestamp稳定合并。synthetic book/timer row携带最新可见 execution price、quantity zero，可以推进 state machine和 inventory-time integral；它不能 consume queue、create fill或制造 inferred touch。real trades同毫秒保留 stable input order。

formal mode拒绝 trade-only clock，并要求 positive timer interval。exploratory mode可以显式重现 legacy diagnostic，但没有 promotion eligibility。

#### 5.1 一条无成交区间里的事件序列

设订单在12:00:00.000激活，TTL为5秒，requote interval为1秒，12:00:00.400之后直到12:00:07.000没有execution trade，但BBO在12:00:02.300变化。现实系统仍会在每个timer edge检查quote，在12:00:02.300读取新book，并最迟于12:00:05.000触发expiry/cancel逻辑。

trade-only replay却会把状态冻结到12:00:07.000：订单虚构地多暴露两秒，cooldown与markout也同时停摆；若12:00:07的trade触及旧价，replay甚至可能给一张现实中已经撤掉的订单记fill。merged stream并非为了制造更多event，而是为了让“时间经过”本身成为可观测状态转移。

synthetic timer row的quantity为零这一约束非常关键。若为了推进clock而复制上一笔trade quantity，它会同时消耗queue；若timer row可以触发touch，它会凭空制造fill。clock completeness与market-event authority必须是两个独立字段。

### 6. Wall time、exposure 与 capacity

旧 day exposure使用

$$
\frac{\#\{seconds\ containing\ trades\}}{86400},
$$

这衡量 activity coverage，不是 replay elapsed time。一个完整但稀疏的 UTC day可能被报成“半天”，fills/day随之虚高。

旧 PnL-curve capacity又用 event_count / interval_ms，把无量纲 count除以 milliseconds当成时间。修复后 duration、campaign age、inventory time与 capacity全部从 merged stream的 elapsed milliseconds推导。

inventory exposure按 wall clock积分：

$$
I_{abs}
=
\int |q(t)|\,dt
\quad[BTC\cdot s].
$$

它不能由“有 trade的秒数”近似。

### 7. Markout、partial fills 与 terminal equity

canonical order-level markout按 fill quantity加权：

$$
\overline M_{bps}
=
\frac{\sum_i M_{i,bps}q_i}{\sum_i q_i}.
$$

若预测的是 per-BTC EV，total USDC为

$$
EV_{USDC}
=
\sum_i EV_{i,USDC/BTC}q_i.
$$

不能 event-weight partial fills，也不能把 USDC/BTC price difference直接相加成 USDC。

maker-signed markout在 BUY/SELL都以 favorable为正；旧 audit scorer对 SELL double sign flip的结果撤回。fixed-horizon midpoint必须来自目标时刻可见 BBO/L2，并记录 actual observation与 age，不能取未来第一笔 trade冒充 mid。

terminal equity为

$$
E_T=cash_T+inventory_T\cdot mark_T,
$$

不在窗口末尾虚构 taker close。commission asset必须保留：quote/settlement commission直接计入，base-asset commission按 fill price转换；未知 nonzero asset让策略停止继续 quote，而不是静默当零。

### 8. Formal replay 与 live alignment必须分离

formal replay用于 baseline/candidate strategy evidence，要求 strict calibration、frozen identity与 promotion-eligible inputs。live_alignment只诊断单位、event clock、state transition与 gate order，不要求与某一 warm-start historical process逐 campaign或PnL相同。

formal默认 fresh_start：inventory=0、entry price=0、无 inherited orders/cooldown/markout/campaign state。若使用 frozen_standard，只允许一个已绑定的标准 inventory/entry artifact；完整 live active-order state只属于 alignment。

每个 arm共享 config、models、P3、queue、trade source、merged clock、initial state、latency samples与 seeds。action override可以不同。deterministic keyed latency保证一个 arm多 cancel不会移动另一个 arm所有后续随机 draws。

这种 separation防止“为了匹配一段历史 live”把 warm start、receive trace或 process stall变成隐含 strategy parameter。

### 9. 验证数字：parity 通过，不等于旧 economics保留

10分钟 real-data parity window的冻结结果：

| Check | Python | C++ |
|---|---:|---:|
| Fills | 2 | 2 |
| Merged clock events | 9,461 | 9,461 |
| Requotes | 101 | 101 |
| PnL absolute difference | — | $2.2\times10^{-15}$ USDC |

这个结果支持 implementations对同一 causal inputs一致。它没有证明 queue model等于 exchange priority，也没有证明策略 profitable。

full-day public-template diagnostic更能说明修复影响：

| Clock | Fills | PnL |
|---|---:|---:|
| Legacy trade clock | 178 | -0.97 USDC |
| Causal merged clock | 184 | +1.18 USDC |

这是 migration diagnostic，不是 live baseline或 alpha。它证明 timer/order lifecycle改变后，旧 exact values和A/B deltas都不应继续使用。

#### 9.1 Parity 的三层边界

第一层是kernel parity：同一个feature vector进入Python与C++，输出是否一致。第二层是lifecycle parity：相同event stream下，两侧是否以同样顺序产生submit、ACK、fill、cancel、inventory与cash。第三层是environment validity：event stream、queue与latency是否足以代表目标市场。

前两层通过只能排除实现漂移，不能证明第三层。两套runtime完全一致地使用一秒snapshot、错误queue或不完整ACK，也会得到漂亮的零差异。相反，若第三层输入正确而kernel parity失败，economics仍然不可解释。研究报告因此必须同时说清“对什么输入一致”和“这些输入代表什么”。

### 10. causal-v7：修复后的 successor 仍未晋级

后续 contract把 calendar、commission、daily PnL、tick/lot、post-fill volatility与bar clock纳入 authoritative replacement causal-v7。bundle含742,998 train、172,798 validation、172,799 historical test rows；13 heads每个195个 strict metadata features。

selected test diagnostics包括 dir_10s AUC 0.5363、ret_10s IC 0.0396、vol_10s IC 0.5779、toxicity heads AUC约0.5413–0.5726。它们是 prediction diagnostics，不是 action/PnL evidence。

42日 corrected formal replay完成776,048 order rows。相对 v6同日 denominator：

$$
\Delta PnL=-3.7363\ \text{USDC},
\quad
\Delta fills=+88,
\quad
\Delta I_{abs}=+205.02\ \text{BTC-hours}.
$$

不能把差异单独归因于 calendar bug，因为多个 semantics共同变化；它只证明 v6 nonlinear results没有跨 identity存活。

#### 10.1 修复前后为什么必须划断 evidence identity

causal-v7不是把v6的某几列更正后继续追加一行，而是换了calendar、fees、clock、tick/lot、volatility和label semantics的联合数据生成过程。每个变化都可能改变feature分布或订单路径，联合变化更不可能用一个线性adjustment还原旧PnL。

因此迁移后的正确比较有两类：一类是同一新identity内的paired arms，用于回答action question；另一类是old-vs-new migration diagnostic，只用于量化修复有多material。把后一类的$-3.7363$解释为新系统更差，或把$+88$ fills解释为新模型更好，都把系统差异误当成策略效应。

### 11. Strict ML A/B 与 BUY fill-selection 都失败 joint gate

strict ML A/B只改变 ML OFF vs causal-v7 13 heads，BUY actions disabled。Validation20 raw PnL delta总计 $+1.038$，daily interval跨零；terminal delta $-2.6465$，区间也跨零；fills减少772，absolute inventory time增加276.65 BTC-hours。Historical Test17 raw与terminal deltas均为负、interval跨零。

inventory-adjusted diagnostic有局部正值，不能补偿 raw/terminal、activity与inventory-time gates。13-head inference因此不 promoted，保持 disabled。

BUY fill-selection的四个 targets也没有同时改善 markout、terminal campaign value、bad rate与tail。例如 non_toxic hit组20s/30s markout更好，却terminal PnL/campaign差 $-0.1053$、bad rate高 $+0.2001$、tail高 $+0.0368$。prediction slice好看没有形成 joint action value。

queue q0.55–q1.00 sensitivity显著改变 fills、campaigns、tail与inventory time，PnL却不单调。q0.70保留外部 calibration baseline，不能用 replay PnL反选 queue quantile。

### 12. 最终状态与权限

项目最终状态是：

$$
\text{defects repaired}
\land
\text{old evidence superseded}
\land
\text{successor no promotion}.
$$

支持：单位与时钟 contracts、merged replay、causal feature visibility、quantity/commission/terminal accounting、same-input parity、formal/live-alignment identity separation。

不支持：任何 pre-repair exact PnL、causal-v5/v6 model authority、causal-v7 live promotion、BUY fill-selection action、queue quantile selection。

13-head inference保持 disabled；没有 live config、queue baseline或strategy action改变。sealed holdout未用来救结果，也没有新的 deployment或 action authority。

### 13. 公共证据

- [Replay Time, Unit, and Causality Repair](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/system_engineering/docs/replay_time_unit_causality_repair_20260715.md)
- [Time and Unit Contract Repair](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/system_engineering/docs/time_unit_contract_repair_20260726.md)
- [Formal Replay Contract v1](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/system_engineering/docs/formal_replay_contract_20260722.md)
- [SYS Low-Latency And Replay Parity README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/system_engineering/README.md)

公开仓库提供 formulas、contracts、aggregate diagnostics与权限边界；owner-side model/replay artifacts不随仓库分发。

## 4. Historical evidence revalidation

### TL;DR：旧“不要晋级”仍然安全，旧 PnL、winner 与参数排名却不能继续引用

回测系统修复单位、feature clock、merged event clock、L2 identity、trade side、calendar、commission、tick/lot 或 queue semantics 后，最危险的反应是保留旧结果，只补一句“新系统更准确”。非线性 maker replay 中，一个时钟修复会改变 requote、cancel、queue、fill、inventory 与 campaign path；旧 arm delta 也可能随之改变。

F10 Historical Backtest Evidence Revalidation 因此不重新挑选策略，而是逐项判定旧 evidence：哪些是与数据无关的 correctness conclusion，哪些能在新 identity 下复现，哪些只保留 conservative governance decision，哪些 exact numbers 与 rankings 必须撤回。

结论很明确。Unit/causality repair、feature-ready-before-decision、merged clock、quantity-weighted markout、terminal MTM、deployment fail-closed guard 等 correctness conclusions继续有效。Empirical P3 的 shape 在 normalized 100ms BBO 上复现：10s $\delta_\star$ 基本不变，$\kappa_{eff}$ 从 0.06743811 变为 0.06735643，只移动 $-0.121\%$；但旧 artifact/hash仍 superseded。

Python/C++ same-input parity仍证明实现对冻结输入一致，却不证明真实 exchange queue。一个历史 mechanism-alignment run得到 139 vs 135 fills、11 vs 11 breakers、decision counts差约 1%，只够说明结构接近，不能支持 exact PnL parity。

必须撤回的是 pre-repair exact PnL、fill/tail/winner/arm rankings、fixed gamma/P3/cap/guard/cooldown“最优”结论、旧 BUY/SELL scorer buckets、mixed-L2 lifecycle durations，以及依赖 left-labelled features 或 cross-day snapshot 缺陷的 model/replay metrics。许多旧 action families 当时已经 do not promote，这个保守决定继续安全；产生决定的 exact estimate却不自动有效。

最终状态是：**no old result proves a profitable action on the corrected baseline**。留下的是更窄但更可信的证据集，而不是一张可以继续下单的旧排行榜。

本文是历史证据治理复盘，不构成交易建议。图中的回测曲线、证据卡与时间线为机制示意，不是实盘或当前收益曲线。

![历史回测证据在 identity 修复后的保留、复现与撤回分类](/images/narrowgate/historical-backtest-evidence-revalidation.svg)

*图 1：修复不会把全部历史简单归零。Correctness contract 可保留，重新复现的 shape 可降级保留，conservative no-promote decision 可继续安全；exact PnL、winner 与 rankings 则必须撤回。*

![从输入身份修复到重新生成动作证据的系统栈](/images/narrowgate/sys-replay-causality-repair-stack.svg)

*图 2：历史结论是否存活，取决于它位于哪一层。单位不变量可以跨数据集保留；触及feature、event、queue或full-path outcome的数字，则必须在修复后的共同身份上重算。*

### 1. Evidence identity 为什么比文件名重要

一个 replay claim 可以抽象为

$$
\mathcal E
=
f(
\text{estimand},
\text{data identity},
\text{clock},
\text{queue},
\text{latency},
\text{implementation},
\text{initial state}
).
$$

只要其中一个维度发生 material change，旧 $\mathcal E$ 就不再自动与新 baseline可比较。即使 strategy parameter完全相同，订单是否存在、何时 cancel、是否 fill、campaign 是否形成都可能改变。

SHA256 只能标识某份 bytes，不能替代 reader-accessible provenance，更不能让 superseded bytes重新获得 current authority。正确做法是把 claim 与输入、语义、source commit/manifest和权限一起绑定。

#### 1.1 一个结果至少有六层身份

第一层是问题：估计的是touch、fill、markout、campaign value还是action uplift。第二层是观测：market data、calendar与initial state。第三层是可见性：source、receive、feature-ready与decision clocks。第四层是执行：queue、latency、cancel/ACK、fees与tick/lot。第五层是统计：split、cluster、multiplicity与scorecard。第六层才是权限：exploratory、Development、Validation、action或live。

两个文件即使参数表相同，只要其中一层不同，就不应共用一个“版本号+收益”标签。反过来，SHA完全不同的两个artifact也可能支持同一条抽象correctness不变量，例如“左标窗口必须在右边界后才可见”。Revalidation研究的核心就是按claim层级判断，而不是按文件新旧一刀切。

### 2. 这次 revalidation 面对哪些修复

历史链陆续确认了：

- absolute-price variance 被错误再乘 mid，单位不成立；
- quote math 使用 per-second variance，却没有显式 integration horizon；
- left-labelled feature row 在 bucket开始就暴露，造成 lookahead；
- rolling state 在 UTC midnight错误重置；
- markout half-life 名称与真实 EMA span不一致；
- markout只在 later requote解析，名义 horizon漂移；
- partial fills按 event而不是 quantity加权；
- replay clock主要由 trades推进，timer/order lifecycle在 sparse periods停滞；
- duration 与 capacity混用 active-trade seconds、event count和 wall time；
- top-level L2 identity混合不同 frequency/depth；
- calendar physical unit把 microseconds错读成 1970 dates；
- commission、daily PnL、tick/lot、bar ns/ms 与 post-fill volatility语义不完整。

这些不是 cosmetic bugs。它们改变 feature、quote、order、fill、inventory 和 report denominator，因此旧 exact economics不能靠“两个 arms 同样错”保留。

### 3. 四种 revalidation 分类

#### 3.1 Retained correctness

与具体市场数值无关、且修复后仍构成必要不变量的结论可以保留。例如 feature必须在 decision前 ready；formal replay需要 merged event clock；terminal equity不能虚构 end-of-window taker close；markout要按 quantity加权；action reward不能重复 campaign outcome。

这些结论不声称哪个 strategy赚钱，只约束怎样生成可信 evidence。

#### 3.2 Reproduced under corrected identity

某些 shape在 corrected source上重新计算后仍近似存在，可以保留新结果，但旧 artifact必须 superseded。Empirical P3 就是例子：normalized 100ms BBO上 10s $\delta_\star$不变，$\kappa_{eff}$仅从 0.06743811移到0.06735643。

复现的是 shape，不是旧 hash，更不是一个 PnL knob。$\kappa_{eff}$ 的单位是 inverse price distance，来自

$$
\kappa_{eff}
=
-\frac{d\log P_{touch}(\delta)}{d\delta},
$$

它不是 order-arrival intensity。

#### 3.3 Conservative decision retained, estimate withdrawn

若旧 action family 本来就 failed 或 do not promote，修复后保留“不把它上线”是安全的。可是旧 DR point estimate、fill leverage、campaign value 与 ranking不能继续当方向证据。

Fixed local actions、BUY conditional widen、SELL one-cycle skip 等历史 families 都属于这类：不晋级仍成立；若要重新研究，必须创建新的 frozen denominator和 paired current baseline，不能把旧 failure数字改名成 current evidence。

#### 3.4 Invalid for current selection

pre-repair gamma/cap/guard/cooldown winner、historical survivor ranking、run-local arm ID、旧 exact live/replay PnL、mixed-clock BUY score buckets、cross-day snapshot修复前的 results以及 model days含 premature five-minute features 的 outputs都不得用于 current selection。

删除旧结果表不是“隐藏失败”，而是防止 reader把已知 invalid numbers继续比较。

#### 3.5 一张可操作的判定表

| Claim 类型 | 修复是否改变输入/状态路径 | 可否保留旧数字 | 可否保留旧决策 |
|---|---|---|---|
| 量纲、因果可见性不变量 | 否，属于逻辑约束 | 不涉及数字 | 可以 |
| 在新身份下独立复现的shape | 是，但已重算 | 只能引用新数字 | 可作为弱先验 |
| 旧candidate未晋级 | 可能改变 | 不可以 | 保守的“不上线”可以 |
| winner、PnL、fill、tail排名 | 是 | 不可以 | 不可以用于当前选择 |
| live运行记录 | 描述旧process | 可作为历史事实 | 不证明corrected策略 |

这里最反直觉的是第三行。保留“不上线”并不是声称旧负效应仍真，而是权限单调性：证据失效不会自动产生更强权限。若旧研究没有授权某动作，修复后在没有新正证据前仍不能授权；但研究者也不能继续用旧点估计宣称动作确定有害。

### 4. Mixed L2：同一个目录名可能不是同一个数据 identity

旧 top-level BBO/L2后来确认混合 approximately one-second/top-10 与 100ms/top-20 files。文件都叫 L2，不代表 depth、frequency、sequence与 warmup contract相同。

queue、touch、fill 与 lifecycle duration依赖 event geometry。更稀的 snapshot可能错过短暂 touch、把 cancel-ahead压成不可见、改变 activation path。于是 old empirical P3 artifact、lifecycle durations和所有依赖它的 replay numbers必须撤回。

P3 后来在 normalized source上近似复现，只说明概率曲面 shape robust；旧 mixed source hash仍不能冒充新 evidence。Lifecycle audit 的“30 秒不是 full value”语义保留，5.8-minute、92.1% 等 exact values必须重建。

### 5. Feature clock：同一模型树也可能得到非法预测

left-labelled 10s feature row at $t$ 实际包含 $[t,t+10s)$。若 replay在 $t$ 就读取，它使用了未来十秒信息。correct contract是

$$
t_{ready}=t_{index}+10s.
$$

后来发现三个 historical test days 的 five-minute metrics也在 interval start 暴露，而不是 bucket end。即使只影响少数 test days，blocked cross-fitting 会把受影响训练/validation information传播到多个 scorer folds，因此 causal-v4 test metrics和 BUY scorer bucket values整体撤回。

不能只删掉三天 output后保留其它 folds，因为模型和 threshold已被污染。需要 corrected feature rebuild和新的 identity。

### 6. Same-input parity 能证明什么

Python/C++ parity将相同 causal inputs送入两个 implementations，比较 quotes、actions、fills、inventory 与 PnL accounting。real-data window曾得到双方 2 fills、9,461 clock events、101 requotes，PnL差约 $2.2\times10^{-15}$ USDC。

另一个历史 mechanism comparison在 corrected replay与 observed process间得到 139 vs135 fills、11 vs11 breakers、decision counts约1%差异。它说明核心 state machine order接近，却不能证明 exchange queue priority、warm start、asynchronous ACK/fill或 exact terminal PnL一致。

因此 parity是 implementation gate，不是 market validity或 alpha gate。

### 7. 为什么 A/B delta 也会失效

常见辩护是“lookahead 或 wrong clock 同时作用于 baseline与candidate，difference会抵消”。Maker system不满足线性抵消。

一次 feature timing差异可能让一个 arm多 cancel一次；从那以后两个 arms的active orders、queue positions、fills、inventory与campaign identities都分叉。effect不是同一 outcome减一个共同 bias，而是两个不同 nonlinear trajectories：

$$
\Delta
=
Y(\pi_1;\mathcal I_{old})
-Y(\pi_0;\mathcal I_{old})
$$

不能当作

$$
Y(\pi_1;\mathcal I_{new})
-Y(\pi_0;\mathcal I_{new}).
$$

repair audit中，一个 full-day public-template diagnostic从 legacy trade clock的178 fills / $-0.97$ USDC变成 merged clock的184 fills / $+1.18$ USDC。它不是 alpha result，却直接反驳“timing repair不影响结果”的假设。

#### 7.1 一个最小非线性反例

设 baseline在 $t_0$ 有一张BUY单，candidate因score略高在 $t_1$发cancel。旧trade-only clock没有在$t_1$推进timer，于是两arms都等到$t_2$的下一笔trade才处理；该trade先成交，两arms路径看起来相同，A/B delta为零。修复后的merged clock在$t_1$先处理cancel：candidate收到ACK并失去fill，baseline在$t_2$成交，库存从此分叉。

即使同一个clock defect同时存在于两arms，它也与action发生交互。共同错误项不是可以从$Y_1-Y_0$里约掉的常数，而是policy-dependent state transition。相同逻辑适用于tick rounding、queue depletion、commission asset和feature-ready：只要错误影响“哪个事件先发生”，差分结果就没有跨identity不变性。

### 8. 什么需要 paired rerun

只有仍值得研究的 hypothesis 才重跑。新 rerun必须在 outcomes前冻结：code/config/model/P3 identities、event-L2与 individual-trade identity、initial inventory/order/campaign state、strict queue、latency profile、random seeds、action probabilities和 scorecard。

如果重启 global parameter work，至少要先有 corrected strict baseline，再逐步研究 gamma、kappa/depth/cap interaction、guard、cooldown/execution，最后才考虑新的 broad search。旧 Sobol survivors不能直接带入新 baseline。

更优先的是明确 action value：一套小 candidate family、known overlap、chronological panels、paired full path和 terminal campaign outcome。Revalidation不是邀请回到无边界参数挖掘。

#### 8.1 重跑不是复制旧命令

真正的successor需要先写迁移清单：旧estimand是否仍值得问；输入日是否满足新source contract；feature能否按ready time重建；initial orders与inventory如何处理；candidate在新baseline上是否仍有support；旧threshold是否属于模型的一部分还是可以重新训练。任何一项变化都应得到新的research identity。

重跑报告还应同时给出“保持不变的东西”和“故意改变的东西”。前者保证paired contrast可解释，后者说明它为何是successor而非偷偷覆盖历史。若新结果方向相反，正确说法是新身份下的证据更新了结论，不是旧报告当时计算错误的数字被神奇修正。

### 9. 最终保留的证据集

最终留下：

- corrected accounting、time/unit/causal contracts；
- normalized source上复现的 empirical P3 shape；
- same-input Python/C++ implementation parity；
- weak但真实的 state-ranking clues；
- 若干明确 closed 的 action identities；
- fixed global knobs多在重新分配 activity、inventory与tail risk的警告。

没有留下：任何旧 result对 corrected baseline上的 profitable live action证明、任何旧 winner table、任何 pre-repair exact PnL authority。

### 10. 权限边界

Historical revalidation没有读取新的 Validation或 sealed holdout，没有晋级模型、action或baseline，也没有 live/deployment authority。它只改变旧 evidence应该怎样引用。

历史 operational records仍可描述旧 process当时做了什么，却不能 retroactively验证 corrected semantics。新的 current claim必须引用新 identity下的 evidence。

### 11. 公共证据

- [Historical Backtest Evidence Revalidation](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/historical_backtest_evidence_revalidation_20260720.md)
- [Replay Time, Unit, and Causality Repair](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/system_engineering/docs/replay_time_unit_causality_repair_20260715.md)
- [Time and Unit Contract Repair](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/system_engineering/docs/time_unit_contract_repair_20260726.md)
- [Legacy L2 Evidence Revalidation](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/docs/legacy_l2_evidence_revalidation_20260725.md)

公共文档保留 claim classification与聚合复现结果；superseded owner-side outputs不因仍存在于存储中而获得 current authority。

## 5. Formal replay identity 不是一个 config，而是一组闭合关系

很多回测争论停在“代码版本相同”“YAML 一致”或“用了同一批日期”。这些条件都必要，却不足以定义同一个 maker replay。完整身份至少可以写成：

$$
\mathcal I=(D,M,C,U,S_0,Q,L,A,T),
$$

其中 $D$ 是数据与日期，$M$ 是市场事件及其排序，$C$ 是 feature-ready 与决策时钟，$U$ 是单位/精度合同，$S_0$ 是初始 inventory、orders 与 campaign state，$Q$ 是 queue/activation/fill 机制，$L$ 是 latency/ACK 机制，$A$ 是 accounting、fee 与 mark source，$T$ 是 terminal/censoring 规则。只绑定 config 而不绑定这些字段，相当于只给实验写了标题，没有写样本、测量仪器和终点。

策略路径是递归系统：

$$
S_{k+1}=G(S_k,M_{k:k+1},A_k;\mathcal I),
\qquad
A_k=\pi(X_k,S_k;\mathcal I).
$$

身份中的任一元素改变，都可能先改变一次动作，再通过 $G$ 改变以后所有订单、成交和库存。回放不是逐行独立预测表，因此不能只比较两个版本最终输出的列名或日汇总是否相似。

### 5.1 同一日期不等于同一市场数据身份

一个 UTC 日可以来自 bar、retained BBO、native snapshot/delta、mixed L2 或 sequence-valid event book。它们可能都有相同日期文件名，却包含不同时间戳、深度、gap、bootstrap 和 warmup。只要 queue matcher 或 touch coordinate 会读取这些差异，source identity 就已经改变。

严格 source manifest 要冻结目标日、完整前一自然日 warmup、每小时覆盖、snapshot bootstrap、`U/u/pu` 连续性、individual trades、aggTrade parent 映射、外部 venue availability，以及被拒绝日期与原因。后来供应商补回一个缺失小时，也不能静默让旧实验多一天；那会改变 denominator、regime mix 和 fold composition。

### 5.2 Daily fresh start 与 continuous campaign 是不同 estimand

每日以零库存、零挂单、零 cooldown state 开始，测量的是 daily-fresh-start 策略；连续运行则把前一日 inventory、active orders、queue age、pending cancel 与 campaign state 带到下一日。设日界前状态为 $S_{d^-}$，两者分别是

$$
S_d=S_{reset}
\quad\text{与}\quad
S_d=S_{d^-}.
$$

如果策略有 inventory-conditioned quote、guard 或 cooldown，第一批动作就会不同。把每日结果相加不能重建 continuous path，正如把多个 one-shot fork 相加不能重建 repeated policy。

### 5.3 SHA 能证明字节没变，不能证明语义正确

Commit、manifest 与 artifact SHA 的作用是固定身份、阻止悄悄漂移。它们不会验证 variance 单位、feature-ready clock 或 terminal route 是否科学合法。一个 hash 完全匹配的 future feature 仍然是 lookahead；一个叫 `current` 的 bundle 也不会自动获得当前经济权限。

因此人类文档需要同时给出 artifact 名称、它解决的问题、是否公开、证据级别与权限。裸 hash 既不是下载地址，也不是结论。

## 6. 量纲闭合：数值合理不代表公式经济上合理

以 reservation price 为例。若 $s$ 的单位是 USDC/BTC，$q$ 是 BTC，$\sigma_p^2$ 是绝对价格方差率 $(\mathrm{USDC/BTC})^2/s$，$H$ 是秒，则

$$
q\sigma_p^2H
\sim
\mathrm{BTC}\times\frac{(\mathrm{USDC/BTC})^2}{s}\times s
=\frac{\mathrm{USDC}^2}{\mathrm{BTC}}.
$$

为了让 $q\gamma\sigma_p^2H$ 回到 USDC/BTC，$\gamma$ 必须带 $1/\mathrm{USDC}$ 的单位。若代码把库存从 BTC 改为 mBTC 或“订单单位数”，而 $\gamma$ 数值不变，报价会随 denomination 改变；这说明参数并未形成单位不变的合同。

### 6.1 Lookback、variance period 与 risk horizon 是三只钟

“最近 60 个 1 秒变化的方差”描述 estimator lookback。该样本若估计每秒 price-variance rate，乘 $H$ 才得到未来 $H$ 秒累计方差；若输入已经是十秒累计方差，再乘十秒就重复积分。必须分别记录：

$$
L_{lookback},\qquad \Delta t_{variance},\qquad H_{risk}.
$$

60×1s 的统计计算可以完全正确，但固定 $H=1s$ 仍可能与 5–10 秒订单寿命、10 秒 P3、85 秒 cooldown 或数分钟 campaign 风险错位。这不是“公式抄错”，而是经济期限没有闭合。

### 6.2 一个 denomination-invariance 测试

同一状态分别用 BTC 与 mBTC 表示。令 $q'=1000q$；若物理报价应不变，数量敏感参数必须满足

$$
q\gamma\sigma^2H=q'\gamma'\sigma^2H,
$$

因此在其它 convention 不变时 $\gamma'=\gamma/1000$。把价格从 USDC 改成 cent 时，$s$、$\sigma^2$ 与 $\gamma$ 也要协同变换。最有力的测试不是断言一个常量“大概合理”，而是单位变换后证明 bid/ask 只发生可预期的显示换算。

### 6.3 订单量不能永远藏在参数里

AS/GLFT 文献常把一笔成交量规范化为 1，工程系统却使用 BTC inventory 与具体 order size。若订单量 $z$ 没有显式进入 spread 或 inventory transition，$\gamma$、$\kappa$ 与库存单位就必须说明如何吸收 $z$。否则把 order size 改一倍会同时改变库存步长与隐含风险厌恶，却没有可审计的参数变换。

### 6.4 Return variance 与 absolute-price variance 不能凭名字互换

若 $r_t=\Delta p_t/p_t$，return variance 无量纲；absolute-price variance 的单位是 $(\mathrm{USDC/BTC})^2$。二者在局部可通过 $p_t^2$ 近似转换：

$$
\operatorname{Var}(\Delta p)\approx p_t^2\operatorname{Var}(r).
$$

遗漏 $p_t^2$ 会让同一波动率在 BTC 价格翻倍后仍产生相同绝对报价偏移；重复乘 $p_t^2$ 又会把风险放大四次方。ABI 应明确字段是 rate 还是 cumulative、return 还是 price、采样间隔和 annualization convention，而不是只叫 `volatility`。

## 7. 因果事件钟：没有 trade 的十秒也会发生事情

旧 trade-driven replay 容易只在成交到来时推进策略。真实系统中，即使十秒没有 trade，timer、requote、order age、cancel timeout、feature bucket close 与 campaign clock 仍然前进。事件集合应是多个流的并：

$$
\mathcal E=
\mathcal E_{book}\cup
\mathcal E_{trade}\cup
\mathcal E_{timer}\cup
\mathcal E_{ack}\cup
\mathcal E_{feature-ready}.
$$

Merged scheduler 每次取下一个合法事件并更新状态，不能拿 `trade_ts` 代替全局时钟。若 timer 位于两笔 trade 之间，candidate 可能在该时刻 cancel，而 baseline keep；忽略 timer 后，后续 trade 的 fill attribution 已经不同。

![没有成交的十秒里 legacy trade clock 与 merged causal stream 的差异](/images/narrowgate/replay-no-trade-clock-timeline.svg)

*图：旧 replay 在两笔 trade 之间冻结订单生命周期；merged stream 让 book、100ms timer、feature-ready 与 cancel ACK 各自在合法时钟推进，同时禁止 synthetic timer 消费 queue 或制造 fill。*

### 7.1 同毫秒事件不是天然有序

Trade 与 L2 update 即使共享毫秒，也未必有跨流 sequence number。把文件读取顺序当作 exchange order，会制造 queue 优势或 adverse jump 的伪先后。合法处理只有三类：来源提供共同序列时按序列排序；来源只提供 receive order 时把主张限制为该 host 的 receive-time；无法识别时 censor 或报告两种边界敏感性。

同样，cancel request 在本地策略钟发生，cancel ACK 才终止 exchange fill risk。Pending-cancel 区间仍可能成交；把 request 当 terminal 会低估 fills，把 ACK 后旧订单继续留在风险集又会高估 hazard exposure。二者方向相反，却都可能经库存反馈形成复杂 PnL 偏差。

### 7.2 Partial fill 是状态转移，不是重复完整订单

一张数量 $Q$ 的订单发生部分成交 $q_1$ 后，剩余风险变成

$$
Q_{k+1}=Q_k-q_k.
$$

Queue position、inventory 与 fee accounting 已变化。若每个 fill row 都复制整张订单数量，会同时放大成交额、库存和 terminal PnL；若只记录最后一笔，又会丢失早期 latency 与 campaign attribution。Markout 可以按 fill slice 计算，campaign value 必须按完整现金流汇总，不能把同一 terminal PnL 复制给每个 slice。

### 7.3 为什么共同 bug 不会从 paired A/B 自动消失

只有误差是与策略无关的加性常数时，$Y_1+b-(Y_0+b)$ 才能消掉。Replay defect 往往进入状态转移，而且 $A_k^1\ne A_k^0$，所以两个 arm 的偏差是 $b_1\ne b_0$。

设两臂都在 bid 挂一张订单，candidate 在 $t_1$ 因 guard cancel，baseline keep；timer bug 让 cancel 延迟到 $t_2$ trade 之后。旧 replay 中两臂都先 fill，库存相同。修复后 candidate 先 ACK、baseline 后 fill，两个库存分别为 0 和正值；下一轮 reservation price、哪侧是 add/reducing、cooldown 与 campaign id 全部分叉。旧 difference 不是在新路径上加一个修正数，而是在比较两棵不同状态树。

### 7.4 Aggregate parity 近似不等于订单路径一致

同日 fill 数、breaker 数或 PnL 很接近，无法证明订单逐一对应。少量差异可能集中在一个长 inventory campaign，决定全天左尾；也可能是相互抵消的短 opener。需要先比较 decision IDs、quote coordinates、activation、first fill、cancel route、remaining quantity 与 campaign lineage，再解释 aggregate economics。

Python/C++ same-input lockstep 只能说明两个实现一致。如果二者共同读取未来 feature、共同缺 timer 或共同采用错误 quantity unit，它们会精确地一起错。因此 parity 是 implementation evidence，不是 estimand validity。

## 8. 证据迁移：什么能继承，什么必须重跑

修复后不应只有“全部作废”和“全部保留”两个选项。更精确的迁移矩阵是：

| 旧证据 | 修复后处理 | 原因 |
|---|---|---|
| 纯解析/schema 单测 | 条件保留 | 修复未改变对应字节和语义时仍有效 |
| Same-input Python/C++ parity | 保留为实现证据 | 不能扩张成经济正确性 |
| 方向性的 no-promotion 决定 | 保守保留 | 没有新证据授权旧候选 |
| Absolute PnL、winner、参数排名 | 撤回 | 依赖旧路径与 accounting identity |
| Action A/B uplift | 通常重跑 | defect 与 action/state transition 交互 |
| Prediction score | 按 feature/label clock 判断 | ready time 或 label span 改变即失效 |
| Operational historical fact | 只保留历史描述 | 不能证明 corrected replay 或当前 live |

### 8.1 撤回数字不等于反向证明

旧 winner 的 PnL authority 被撤回，不代表它现在被证明为 loser；旧正点估计失效，也不等于真实效应为负。合法说法只是该数值对新 identity 不可迁移。只有修复后预冻结 paired rerun 得到新结果，才可以更新方向。

旧 no-promotion 决定可以继续作为权限状态，因为“不部署一个未获新证据支持的候选”仍然安全；但不能用旧失败数字关闭 materially different successor。治理权限和科学效应大小是两个对象。

### 8.2 Revalidation 不等于把所有旧 grid 重跑一遍

优先级应由当前决策价值决定：是否仍影响 baseline、是否存在未关闭问题、是否有合法 action support、重跑能否改变 owner 决策。已经在多个独立 gate 失败且没有当前消费者的 winner table，只需保留撤回记录；仍作为当前 baseline dependency 的模型或参数，才需要 strict successor reproduction。

### 8.3 一个可执行的 successor 合同

新的 formal replay 在读取 economics 前应完成：

1. 冻结 Development、Validation、sealed holdout、embargo、D-1 warmup 与 source rejection。
2. 绑定 baseline/candidate 的 code、config、model、P3、queue、latency、initial state、fees 与 random seed。
3. 用 zero-economic preflight 走完所有日期/fold，证明 feature-ready、timer、ACK、partial fill、campaign lineage 与 terminal route 可完整生成。
4. 在代表日做逐事件 lockstep，而不是只比日汇总。
5. 证明 action 在冻结 denominator 上真实发生，报告 candidate rate、path divergence、activation、fill 与 retained activity。
6. 最后才打开 assignment-to-terminal reward、tail、inventory time 与 campaign duration，并按日 cluster 不确定性。

报告还应把两类差异分开：baseline-vs-candidate 回答动作价值，old-vs-new migration diagnostic 回答修复有多 material。把两者混在一张 PnL 表里，会让读者无法区分策略变化与测量系统变化。

### 8.4 四种“通过”必须使用四种语言

数据完整性通过，只能写 source admitted；Python/C++ 逐事件一致，只能写 implementation parity；模型 proper score 通过，只能写 prediction supported；paired terminal reward 与 tail gate 通过，才可能写 action supported。Live authority 还需要单独的 owner admission、部署身份、rollback 与运行健康证明。把这些层统一叫“验证通过”，会让一个底层工程事实沿文档引用链不断升格，最后看起来像经济结论。

同理，“blocked”“closed”“superseded”和“withdrawn”不是同义词。Blocked 表示必要证据尚不可得；closed 表示冻结 identity 已在允许 panel 上得出停止决定；superseded 表示后来有新语义身份，但不自动反转旧结论；withdrawn 表示旧数值失去引用权限。清楚地区分这些词，正是 replay repair 能长期改善研究质量的地方。

![Replay 从量纲和可见时钟修复到历史证据重验的结果收敛](/images/narrowgate/replay-revalidation-research-synthesis.svg)

*图：单位、feature-ready clock 与 merged event stream 一起改变 replay identity；旧 no-promotion 决策可保守保留，但旧绝对 PnL、winner 和排名必须撤回或重跑。*

## 9. 结论：保守决策可以保留，精确经济数字不能跨 identity 搬运

修复后的正确结论不是“所有历史研究都毫无价值”。旧研究得出的不晋级决定仍然保守安全，因为没有新证据把它们变成通过；但旧 absolute PnL、winner、参数排名与 side attribution 依赖已经失效的 replay identity，不能继续引用。相同代码 commit、相同 config 名或共同 bug 都不足以证明 paired difference 可迁移。

未来比较必须在同一修复后 identity 内重新冻结 baseline/candidate、source manifest、initial state、timer/feature clocks、queue、fees 与 terminal accounting。Old-vs-new 只能作为 migration diagnostic，不能冒充 action A/B。真正值得继承的是已经闭合的时间、单位、事件与权限合同；它们让后续研究更难得到一个漂亮 winner，却让每个剩下的结论更接近可执行事实。
