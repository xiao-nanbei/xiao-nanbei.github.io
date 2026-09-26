---
title: 'NarrowGate Cooldown Temporal-Permission：从 One-Cycle Skip 到 State、Recovery 与 Variance-Time Rearm'
date: 2026-08-29 13:30:00
updated: 2026-08-30 02:08:00
categories:
- Market Making
tags:
- Market Making
- Cooldown
- State Machine
- Campaign
- Action Uplift
math: true
---


Last materially modified: 2026-08-30


## 1. 五种动作其实在搜索同一个控制轴

SELL one-cycle skip、stop-add-until-flat、85 秒后的 state-conditioned rearm、recovery-event rearm 与 variance-time rearm 都在改变同一个对象：exposure-increasing add 何时重新获得 permission。它们只是控制强度从一个周期、整段 campaign、离散状态阈值、恢复事件到累计方差时钟逐步变化。拆成五篇会看不见最关键的 leverage frontier：弱动作几乎 no-op，强动作接近关机，中间候选虽有支持却没有稳定终局价值。

统一状态机可写成

$$
G_{t+1}=\Phi(G_t,E_t,X_t;\theta),\qquad
A_t=\mathbf 1\{G_t=\text{released}\}\,A_t^{baseline},
$$

其中 $G_t$ 是 permission state，$E_t$ 是 fill/cancel/repair 等事件，$X_t$ 是当时可见状态。不同研究只是在改变 $\Phi$ 与 release condition；reward 始终必须从 assignment 走到 campaign terminal。

## 2. 研究阶段与证据状态

| 阶段 | 它真正问什么 | 结论/权限 |
|---|---|---|
| One-cycle skip | 跳过下一次 SELL add cycle 是否避免坏路径？ | fill leverage 接近 no-op；关闭 |
| Stop-add-until-flat | 持续屏蔽能否改善 SHORT 尾部？ | 删除近九成 add fills；过度抑制，关闭 |
| State-conditioned rearm | 85 秒后按局部恢复状态重启是否更好？ | 两侧先败在支持；无动作权限 |
| Recovery-event rearm | 四重几何恢复分数能否选择释放时刻？ | SELL 有支持但显著更差；关闭 |
| Variance-time rearm | 累计方差预算能否替代日历 85 秒？ | 机制/支持充分；两侧 reward 下界未过零 |

## 3. One-cycle skip

### TL;DR：一次跳过看起来是动作，落到成交路径上却接近 no-op

这项研究只改一个瞬间：SHORT inventory campaign 已经存在、策略原本准备再挂一笔 exposure-increasing SELL add 时，以 50% 概率照常报价，以 50% 概率跳过**恰好一个** eligible cycle；下一周期起重新服从原基线。BUY、reducing、size、inventory limit、queue、latency 与 taker 行为都不变。

冻结 Development 回放得到 2,961 个独立 short campaigns，baseline/skip 为 1,506/1,455。动作分配没有问题，但 baseline 被选中的那一个 SELL quote 只有 53 次成交，即 3.52%。时间外 policy layer 的 766 行里，模型只在 4 行选择 skip，candidate rate 0.52%，低于预注册的 3% 下限；reward lower bound、repair-first、trend-through avoidance 与联合 competing-risk utility 都没有通过。9 日 Validation 与 10 日 sealed holdout 均未读。

随后用当前 replay stack 对相同经济动作做的 40 日机制复核并不是新研究：BUY 2,403 次最终动作机会中成交 172 次，SELL 2,348 次中成交 147 次，对应 7.16% 与 6.26%；两侧 Wilson 95% 上界仍低于预先定义的 10% near-noop 线。它改变了约 99% 的报单决策，却只改变约 6%–7% 的成交路径。结论不是“跳过永远无效”，而是**这个单周期杠杆太短，不能稳定改变 campaign 的经济终点**。

![SELL 单周期跳过与竞争风险机制](/images/narrowgate/sell-one-cycle-skip-kline.svg)

*图 1：机制示意。随机化只发生在一个 SELL add cycle；之后两臂回到相同基线。真正 estimand 必须追踪到 repair、trend-through 或终止，而不是把被跳过的报单直接当作收益。*

![单周期 permission action 的因果漏斗](/images/narrowgate/f09-campaign-action-causal-path.svg)

*图 2：assignment 能改变 quote decision，不代表会改变 fill，更不代表 campaign terminal 分叉。one-cycle action 的关键发现是从 mechanics 到经济路径的杠杆快速衰减。*

### 1. 研究问题：少挂一次，究竟避开毒性还是错过修复？

SHORT campaign 中的 exposure-increasing SELL add 有两种相反解释。若价格继续上涨，它会以较低价格卖出并增加不利空头，是 trend-through 风险；若价格回落，它又可能改善平均开仓价并更快由 reducing BUY 修复。仅看下一笔 markout 无法区分这两条完整路径。

项目把问题写成 campaign-level intervention：

$$
\tau(x)=E\left[Y(\text{skip one cycle})-Y(\text{baseline})\mid X=x\right],
$$

其中 $X$ 只含 decision-ready 的本地 shock、refill、recovery、queue、inventory 与 campaign state；$Y$ 是从该 decision 到 terminal 的净值变化。候选不是暂停 85 秒，也不是直到 flat 都禁止 SELL，更不是改变价格；它只令一个本应提交的 add 不提交一次。

### 2. 输入、动作、结果与竞争风险 estimand

冻结合同如下：

| 元素 | 定义 |
|---|---|
| 风险面 | 已经 SHORT 时的首个 baseline-eligible SELL add cycle |
| $A=0$ | baseline，正常提交该笔 SELL add |
| $A=1$ | 仅跳过该 cycle，随后恢复 baseline |
| 随机概率 | $P(A=0)=P(A=1)=0.5$ |
| 主要结果 | decision-to-terminal reward |
| 路径结果 | 30 分钟内 repair-first、trend-through-first、censor |
| 不变量 | BUY、reducing、size、inventory ceiling、市场路径、P3、queue、latency |

repair 事件定义为 campaign 在 trend-through 前回到 flat；trend-through 定义为 execution trade 先触达 baseline SELL quote 上方一 tick。两个事件互相竞争，不能分别跑两个普通二分类模型后把概率相加。对事件类型 $k$ 的 cumulative incidence 是：

$$
F_k(t)=P(T\le t,J=k),\qquad k\in\{repair,trend\}.
$$

冻结的联合效用要求 reward、repair-first 与 trend-through avoidance 方向一致。即便某个 tree leaf 的 reward 为正，如果它同时降低 repair 概率、提高 trend-through 风险，也不能晋级。

### 3. 数据面板与因果时钟

Development 使用截至 2026-06-23 的 100 个既有 good days；2026-06-24 embargo；之后 9 日 Validation 锁定，再隔一日，另有 10 个 good days 的 family-specific sealed holdout。Development 的 nuisance warmup 为过去 50 日，policy OOF 只在后续 28 个 UTC 日评价。

一行 intervention 的时钟顺序是：market event exchange time 到达 replay，feature 在 receive/ready clock 完成，baseline eligibility 成立，campaign-keyed randomization 产生 $A$，candidate 根据 $A$ 提交或跳过，未来订单与 fills 全路径重放，最后在 flat、day end 或路径终止时登记一次 $Y$。任何发生在 assignment 后的 trade、ACK、repair 状态都不能回流到 $X$。

一个具体例子：SHORT 为 $-0.002$ BTC，baseline 决定在 100,000.1 再挂 0.001 BTC SELL。若候选跳过，而市场下一跳到 100,000.2，候选没有 fill；但若随后迅速跌到 99,999.6，baseline 那笔 SELL 可能盈利并由 BUY 修复。把“跳过后没被上穿”记为收益会遗漏后一段反转。反过来，若市场持续涨到 100,003，baseline 的额外 short 会扩大 terminal loss。只有 replay 两条自洽路径才识别动作价值。

### 4. 随机化与完整性检查

Development 有 2,961 个独立 short campaigns；baseline/skip 1,506/1,455，每个 propensity 都是 0.5，每 campaign 恰好一次 intervention。30 分钟竞争风险计数为 repair 1,073、trend-through 1,887、censored 1；terminal censor 仅 8。reward identity 最大误差 $6.94\times10^{-18}$ USDC。

行为 mixture 相对 control 保留 99.94% fills，campaign 数量为 1.0009 倍，absolute inventory time 为 1.0007 倍。这些数字说明随机化没有把策略变成另一套系统。另一方面，1,506 个 baseline assignments 中只有 53 个 selected-cycle fills：

$$
\widehat p_{fill}=\frac{53}{1506}=3.52\%.
$$

因此“跳过了一笔报单”和“改变了一条 inventory path”完全不是一回事。约 96.5% 的 baseline selected cycles 本来就不成交，两臂很快又重新汇合。

#### 4.1 动作杠杆的三层漏斗

令 $E$ 为 eligible episode、$Q$ 为该 cycle 的报价确实被 skip、$F$ 为 baseline selected order 会成交、$D$ 为 terminal path 改变。action leverage 可写成：

$$
\Pr(D=1\mid E)
=
\Pr(Q=1\mid E)
\Pr(F=1\mid Q,E)
\Pr(D=1\mid F,Q,E).
$$

在 candidate assignment 下，$\Pr(Q=1\mid E)$ 接近一；但历史 selected-cycle fill 只有 3.52%，当前栈复核也只有约 6%–7%。最后一项还可能小于一，因为跳过目标订单后，稍后的 baseline quote 仍会在相似价格成交，使两条 campaign 再次汇合。

这解释了为何“99% episodes 能改变下一个动作”和“经济上 near-noop”可以同时为真。代码路径很活跃，处理对最终状态却很弱。任何用 quote-change count 代替 fill/path-change count 的报告都会高估 treatment strength。

#### 4.2 Competing risk utility 为什么不能由两个边际概率拼成

repair-first 与 trend-through-first 共享一份 first-event survival。若分别训练两个二元模型，可能同时预测 repair 70%、trend 60%，概率和超过一。正确累计发生率满足：

$$
S(t)+F_{repair}(t)+F_{trend}(t)+F_{censor}(t)=1.
$$

更重要的是动作可能同时降低两种事件：skip 后既少了 trend-through fill，也少了可在回落中修复的 add。只报告“trend-through 下降”会忽略 repair 也下降。冻结联合效用要求方向一致，正是为了拒绝这种单指标 cherry-pick。

#### 4.3 一条 quote 没成交，仍可能改变什么；又通常不改变什么

若 baseline submit 后很快被下一次 requote 替换，而 candidate 本来就跳过，两个 arms 在下一周期可能提交同一价格、拥有不同短暂 queue age，却最终都不成交。严格 replay 仍会记录 order-count 与 queue path差异；terminal reward 则为零。

少数情况下，baseline 未成交订单会改变 cancel/replace timing 或被部分成交，进而影响 inventory。研究不能把所有 no-fill 当绝对 no-op，但应报告从 submit 到 nonzero terminal 的逐层转换率。当前结果表明，任何这些间接路径都没有把 one-cycle action 提升到可识别的经济尺度。

### 5. OOF 结果：reward 小正点估计不能掩盖生命周期恶化

policy OOF 有 766 行、28 个未来日，logged baseline/skip 为 393/373，policy ESS 391。浅层 honest tree 只选择 4 行 skip，candidate rate 0.52%。冻结行动预算要求 3%–40%，所以支持门已经失败。

历史冻结结果如下；这些精确经济数值后来随 superseded denominator 撤回当前校准权限，但仍解释当时为何关闭：

| 越高越好的结果 | DR uplift/decision | UTC-day 95% interval |
|---|---:|---:|
| terminal reward | +0.000175 | [-0.000327, +0.000995] |
| campaign-cost avoidance | +0.000177 | [-0.000432, +0.000914] |
| negative-terminal protection | -0.000022 | [-0.000586, +0.000487] |
| repair-first | -0.003671 | [-0.013285, +0.001602] |
| trend-through avoidance | -0.003689 | [-0.013020, +0.001558] |
| competing-risk utility | -0.007177 | [-0.025037, +0.002751] |

唯一 reward 正的受支持 leaf 曾给出 +0.01018，却同时有 repair-first -0.03454、trend-through avoidance -0.03338 与联合效用 -0.06781，因此按冻结规则被拒绝。挑这一个 reward 数字而忽略 co-primary event path，会把 selection bias 写成策略。

### 6. 当前栈复核为何并非第二篇研究

后续修复了 cooldown wall-time、queue、BUY q90 cancel/ACK/recovery、sync-degrade 与 path-dependent blocker。为了判断旧 3.52% 是否只是旧实现产物，研究在同一 40 日 Development 面板上运行 outcome-blind observer；它没有重新随机化，也没有读取 treatment contrast。

| Side | Release episodes | 最终动作机会 | selected-cycle fills | Wilson 95% CI | 平衡设计 MDE |
|---|---:|---:|---:|---:|---:|
| BUY | 2,420 | 2,403 | 172，7.16% | [6.19%, 8.26%] | 0.014365 USDC |
| SELL | 2,367 | 2,348 | 147，6.26% | [5.35%, 7.31%] | 0.015456 USDC |

两侧动作机会约占 release episodes 的 99%，但成交率区间上界仍小于预冻结的 10%。MDE 只是按日内方差推算的设计灵敏度，不是处理效应。当前栈复核改变 denominator 与阻断器 fidelity，没有改变 action、estimand 或统计问题，所以它作为本研究的机制章节，而不是新 project。

### 7. 不确定性、关闭边界与可以学到什么

按 UTC day 聚类是必要的：同一天的 766 行共享趋势与波动，不能按独立 decision 做过窄标准误。candidate 只有 4 行还带来直接 positivity 问题；即便 interval 恰好为正，也缺少可执行频率。

关闭的是“一个 eligible cycle 的 exact skip”。它没有证明较长 cooldown、价格惩罚、recovery event 或外部 fair center 无效。更重要的是，它暴露了 action leverage 的三层漏斗：eligible decision、提交订单、实际 fill。若第一层变化 99%、第三层只有 6%，经济效应自然需要很大才可检测。

未来候选必须改变经济干预本身，并重新冻结面板。增加日期、换 denominator、把 3% 行动下限降到 0.5%、加深树或在 Validation 挑 threshold，都不能让已消费 family 重获独立性。

#### 7.1 MDE 应怎样阅读

当前栈复核给出的约 0.014–0.015 USDC 平衡设计 MDE，是在冻结日间方差、样本与假定平衡分配下可分辨的效果尺度。它不是“动作至少值这么多”，也不是对真实 effect 的区间。

当 fill leverage 只有约 6% 时，要达到这个每 assignment 效果，少数被改变 fills 必须具有很大的单位 terminal 差值。若这种大差值只来自一两天，日期聚类又会显著扩大区间。MDE 因此帮助判断设计是否值得运行，不为阴性结果提供后验借口。

#### 7.2 为什么不能把 action duration 偷偷延长

把 one-cycle 改成三 cycles、85 秒或 until-flat，会提高 fill leverage，但也改变 treatment。持续 action 会影响更多 quote decisions、库存深度、repair 机会和 campaign duration；它的潜在结果不再是 $Y(skip\ one)$。

F09 后续确实单独研究了更长 permission actions，并发现从低 leverage 到 participation shutdown 的另一端问题。它们共同勾勒 action frontier，却不能互相当作参数敏感性。每个 duration 都需要自己的 eligibility、assignment、activity gate 和 terminal outcome。

#### 7.3 阴性结果留下了什么可复用设计知识

未来 action preflight 应在读取 PnL 前先算 selected-order fill rate、path-change rate 与按日期 MDE。若 upper bound 已低于最小 leverage 门，就应像本项目当前栈复核一样停止，不再消耗经济结果。

这条规则节省的不是算力，而是统计独立性：避免在一个注定 near-noop 的 action 上读完 PnL，再根据偶然大路径改 action duration。先过 mechanics，才有资格打开 economics。

### 8. 没有获得的权限

- 9 日 Validation 与 10 日 sealed holdout 未读；
- 没有读取或传播任何原始 live state；
- 没有 action、shadow、live、C++ policy 或配置变更权限；
- 没有把当前机制复核当作同一动作的第二次 outcome trial；
- 没有将旧 DR 精确值作为当前 baseline calibration 使用。

### Action dilution 可以在看收益前量化

从eligible decisions到真正改变terminal path要经过多个漏斗：被随机分到skip、baseline原本会提交、订单会激活、在一个cycle内存在fill/touch机会、该机会又会影响inventory campaign。设每层retention为$r_j$，最终有效分叉率约为

$$
r_{path}=\prod_j r_j.
$$

即使每层有80%保留，五层后只剩32.8%。当$r_{path}$很低，百万decision rows也可能只有很少有信息的campaign。研究应先用outcome-blind mechanics估计可检测效应，再决定是否允许读PnL。

### Skip 的反事实不是“没有这张单”这么简单

跳过一个cycle会让系统在下一decision重新观察market与inventory；baseline订单则可能仍active、部分fill或失去queue。若下一cycle自动恢复，treatment包含一段有限permission gap和一次queue reset。它既可能避免toxic fill，也可能错过reducing fill，还可能因重新排队降低后续成交。

因此utility不能只写成$-P(bad\ fill)$。一个示意分解是

$$
\Delta V_{skip}
=
-P(F_b)V_b
-P(F_g)V_g
+\Delta V_{queue}
+\Delta V_{inventory\ path},
$$

其中避免坏fill是正贡献、错过好fill是负贡献，后二项取决于re-entry和campaign。Competing-risk报告的意义就在于保留这些互斥路径，而不是把bad-fill概率单独当reward。

### 从 one-cycle 到 persistent skip 是新治疗

观察到one-cycle近似no-op，并不能在同一结果上把skip延长到flat或若干秒。持续时间改变action strength、市场状态覆盖与机会成本，是新的dynamic regime。它需要新的support preflight与activity gate；若删除近九成SELL adds，哪怕tail改善也不能假装是同一局部动作的放大版。

这项研究最重要的结果是确定了一个下限：单cycle intervention在当前cadence和lifecycle下不足以稳定改变经济路径。后继要增加持续性时，必须明确付出的participation成本，并把它作为预注册门，而不是只追求更容易显著的强treatment。

### MDE 为什么应在 outcome 前计算

给定有效campaign数、日级方差、assignment比例与action leverage，可以估计研究对业务最小效应的分辨率。若95% interval必然宽于可接受收益，即使点估计略正也不值得开启outcome。

MDE不是失败后说“样本不够”的借口；它应写进preflight。action dilution使有效样本远少于eligible rows，必须按真正path-diverged units和day clusters估计。

### Shadow mechanics 与经济实验的分工

shadow可以验证skip signal、permission duration、quote suppression和fallback，不应把未执行订单的counterfactual fill当真实经济。正式value需要randomized replay或可识别OPE，把baseline与skip完整路径都生成。

若shadow显示几乎没有baseline order会在一个cycle内成交，动作在看outcome前就可判弱；这正是mechanics stop节省统计机会的意义。

### 阴性 one-cycle 仍能校准系统响应

它测出了从permission change到quote/order/fill的实际传导率，为任何更强duration候选提供action-leverage先验。后继需要明确增加多少持续性才能进入可辨识区间，同时设retention下限防止过强。

这类工程知识不能被写成收益支持，却能让下一项研究不再从任意秒数开始搜索。

### 9. 公共证据

- [`sell_add_repair_trend_skip_causal_v4_v1_20260718.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/sell_add_repair_trend_skip_causal_v4_v1_20260718.md)
- [`cooldown_release_one_cycle_mechanics_reaudit_v1_development_20260730.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/cooldown_release_one_cycle_mechanics_reaudit_v1_development_20260730.md)
- [`F09 README`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/README.md)

### 结语

“跳过一次”非常容易实现，也非常容易被高估。这里最可靠的发现不是小小的 reward 点估计，而是动作从 decision 到 fill 的杠杆衰减：绝大多数被跳过的 quote 原本不会成交。把竞争风险与当前栈复核写进同一条研究叙事后，关闭理由比任何单个 PnL 数字都更清楚。

## 4. Stop-add-until-flat

### TL;DR：风险尾部改善了，但代价是移除近九成 SELL add fills

单周期 skip 太弱，于是本项目研究更强的 permission action：SHORT campaign 的首个 eligible SELL add decision 到来时，以 50% 概率保持 baseline，以 50% 概率禁止此后所有 exposure-increasing SELL quotes，直到 inventory 回到 flat。BUY、reducing、size、max inventory 与 taker 不动。

56 个 Development 日产生 1,734 个独立 campaigns，baseline/candidate 883/851；OOF 有 764 个 campaigns、25 个未来日，ESS 383。candidate 确实显著降低 negative terminal、q10 shortfall 与 MAE，但 learned policy 在 85.7% rows 上启用它，预计 SELL add-fill retention 只剩 10.8%，远低于冻结的 85% 门槛。decision-to-terminal reward 的历史点估计为 +0.00815 USDC，UTC-day 95% interval $[-0.02160,+0.03711]$，并无稳定正下界。

所以这个动作被判为 **overbroad risk control**，而不是 selection alpha。它让风险变小的方法近似“停止做这部分业务”，不能以更漂亮的尾部统计绕过活动性要求。Validation 与 sealed holdout 未读，baseline 未改。

![SELL stop-until-flat 权限状态机与 K 线](/images/narrowgate/sell-stop-until-flat-kline.svg)

*图 1：机制示意。candidate 从首个 add decision 起锁住所有后续 SELL adds，只有 flat 才释放；reducing BUY 仍运行。尾部收缩必须与消失的参与度一起解释。*

![持久 permission 从分配到 campaign terminal](/images/narrowgate/f09-campaign-action-causal-path.svg)

*图 2：until-flat 不是在一行数据上打 mask，而是改变此后整段 submit、fill、库存与修复递归。风险门通过时，还必须同时查看 participation 与 terminal economics。*

### 1. 从太弱到太强：研究问题的由来

前一个 one-cycle action 只影响一个报单，selected-cycle fill 率约 3.52%，经济杠杆接近 no-op。自然的反方向实验是把阻断延长到 campaign 结束：如果危险 SHORT campaign 的问题来自反复加仓，停止所有后续 SELL adds 是否能保护 terminal value？

冻结问题为：

$$
\tau=E[Y(K_1)-Y(K_0)],
$$

其中 $K_0$ 是 baseline add permission，$K_1$ 是从第一次 eligible add 起 block later SELL adds until flat，$Y$ 是 decision-to-terminal reward。核心不是只问 $\tau$，而是联合约束活动：

$$
\rho_{fill}=\frac{E[N^{SELL\ add}_{fill}(K_1)]}{E[N^{SELL\ add}_{fill}(K_0)]}\ge 0.85.
$$

若收益只能在 $\rho_{fill}\approx0$ 时出现，动作没有证明能挑出坏 fills；它只是停止产生 fills。

### 2. 输入、动作与 estimand

随机化单位是 campaign，而非每个 quote。第一次 baseline-eligible SELL add 到来时生成一次 assignment，并保持到 flat。这避免同一 campaign 的连续随机数互相污染，也使 potential outcomes 清楚。

| 合同 | 冻结内容 |
|---|---|
| Population | 已 SHORT 且出现第一笔 eligible SELL add 的 campaign |
| Control $K_0$ | 允许本次及后续 SELL adds |
| Candidate $K_1$ | 阻断本次及所有后续 SELL adds，直到 flat |
| Propensity | campaign-level 0.5/0.5 |
| 主要 estimand | decision-to-terminal DR uplift |
| Co-primary | campaign cost、negative terminal、q10、MAE、repair、activity |
| 冻结机制 | BUY、reducing、order size、limits、P3、queue、latency |

外部参考被禁用，所有 state 是 local M0、campaign history、queue 与 shock/refill/recovery 的 decision-ready 表示。action-specific Ridge nuisance models 与 depth-2 honest tree 只能使用 past-only folds；unsupported leaf 自动回 baseline。

### 3. 因果时钟：permission 是持久状态，不是一行 mask

动作顺序是：首个 eligible add 到达 ready clock，assignment 生成，若为 $K_1$ 则 permission state 转为 blocked；此后每个 exposure-increasing SELL decision 都被抑制，但 reducing BUY、cancel/ACK 与 terminal accounting 继续演化；flat 后 campaign 结束并登记一次 outcome。

例如 inventory 为 $-0.001$ BTC 时出现 add。baseline 随后可能在 100,001、100,002 再成交两次，达到 $-0.003$；candidate 保持 $-0.001$，并靠 BUY quote 修复。若市场一路上涨，candidate 的 terminal loss 较小；若市场回落，baseline 的额外 SELL fills 可能贡献 spread 与 repair PnL。动作必须承担这两类 counterfactual，而不能只统计减少的最大库存。

#### 3.1 状态递归为什么让 duration 成为动作的一部分

令 permission $P_t\in\{0,1\}$。control 始终由 baseline 决定；candidate 在 assignment 后满足：

$$
P_{t+1}^{K1}
=
\begin{cases}
0,&q_t<0,\\
1,&q_t=0.
\end{cases}
$$

报价函数读取 $P_t$，fill 又更新库存 $q_{t+1}$，库存反过来决定何时释放。于是 duration 是内生 stopping time，而非固定秒数。行情越单边、repair 越慢，candidate 阻断越久；这正是它能压低尾部、也能大幅删除参与的原因。

如果回放只对已生成的 SELL add rows 做 mask，却仍沿用 baseline 后续 inventory 与 flat timestamp，就会把 candidate 的 release 时刻设成来自另一条路径的未来信息。full-path replay 必须让每个 arm 自己决定何时 flat。

#### 3.2 一个 tail 改善但净值不改善的合成例子

假设十个 campaigns 中，baseline 的八个普通 campaign 各靠后续 SELL add 多赚 0.01 USDC；另两个趋势 campaign 各因额外 short 多亏 0.04。stop-until-flat 删除所有 later adds 后，两个坏尾部各改善 0.04，却也丢掉八个普通收益 0.01，总净变化恰为零。

此时 negative-terminal rate、q10 与 MAE 都可能显著改善，平均 reward 却无正下界。这个例子说明 risk metric 不是假的，只是它和机会成本处在不同加总位置。动作权限需要二者共同闭合。

### 4. 数据与支持

Development 固定 56 日。behavior panel 有 1,734 个独立 campaigns，baseline/candidate 883/851，propensity 恰为 0.5；baseline later SELL add fills 为 986，candidate 为 0，duplicate decisions 为 0，每 campaign 只有一次 intervention。

外层 chronological schedule 是 30 train + 1 embargo + 7 test；OOF 汇总 764 campaigns、25 个未来 UTC 日。policy ESS 为 383。因此失败不是 arms 没重叠，而是候选的经济形状与门槛冲突。

活动效应非常直观：candidate arm 按定义没有 subsequent SELL add fill。learned policy 又在 85.7% OOF rows 上选它，于是估计 fill retention 只有 10.8%。这不是微小的 safety adjustment，而是对主要 participation surface 的广泛关闭。

### 5. Development 结果：tail 与 participation 必须联读

历史冻结面板给出：

| 越高越好的 outcome | DR uplift | UTC-day 95% interval | 正日 |
|---|---:|---:|---:|
| terminal reward | +0.00815 | [-0.02160, +0.03711] | 14/25 |
| campaign-cost avoidance | -0.00025 | [-0.02848, +0.02859] | 12/25 |
| negative-terminal protection | +0.03133 | [+0.00584, +0.06077] | 18/25 |
| Development-q10 protection | +0.02959 | [+0.00896, +0.05594] | 21/25 |
| campaign-MAE avoidance | +0.08434 | [+0.04916, +0.12728] | 23/25 |
| subsequent SELL add fills | -1.09156 | [-1.37413, -0.82771] | 1/25 |

尾部、q10 与 MAE 的方向并非假象：阻止加空确实让 campaign 的库存暴露更小。但 reward lower bound 跨零，campaign-cost、repair 与 censoring 也不过关；更致命的是 10.8% fill retention。scorecard 因此把它标为 `overbroad_risk_control`，而非可部署 policy。

没有 Development campaign 达到 terminal $\le-5$ USDC 的极端事件。零事件只说明面板不支持该 estimand，不能声称 candidate 消除了极端尾部。

### 6. 为什么 downside 改善不等于 action uplift

假设一个策略把所有 exposure adds 都关闭，MAE、inventory time 和负 terminal 大概率会下降；但 maker 的 spread capture、repair opportunity 与市场参与也会消失。风险管理与价值选择的区别可写成：

$$
\text{Net action value}=\text{avoided toxic loss}-\text{lost good fills}-\text{path opportunity cost}.
$$

本实验明确识别了第一项，却没有证明其大于后两项。活动门不是额外装饰，而是防止“通过不交易获得安全”的可证伪约束。

同时，BUY 与 reducing 没有被干预，所以结果不能推到 bilateral pause。candidate 的正 tail effect 只适用于 SHORT campaign 后续 SELL add permission。

#### 6.1 Activity gate 是 estimand 约束，不是商业偏好

若允许 candidate 任意降低参与，最优风险策略总可以退化成“永不提交 exposure-increasing order”。这会让任何 selection 研究失去可证伪性。冻结 $\rho_{fill}\ge0.85$ 的含义是：研究寻找的是在大致保留业务表面的前提下选择性减少坏 fills，而非比较做市与不做市。

10.8% retention 与 85% 门相距太远，不能称作 near miss。即便 reward interval后来变正，这个动作仍回答另一个问题——“关闭绝大部分 SELL add 是否安全”——而不是“能否选择坏 add”。除非新项目明确注册 shutdown-style risk mandate，否则不能删除 activity gate。

#### 6.2 Action frontier：太弱与太强之间不是靠插值保证存在最优点

one-cycle 的 path leverage 约几个百分点，until-flat 则删除近九成 add fills。直觉会说中间 duration 必有甜点，但数据不保证效应随 duration 单调或平滑。库存反馈、repair 与行情 reversal 会使：

$$
\tau(d)=\mathbb E[Y(permission\ blocked\ for\ duration\ d)-Y_0]
$$

出现跳变甚至多次反号。看到两个端点后扫描 5、10、20、40、85 秒并挑 winner，又会产生新的多重选择。

所以后续 state-conditioned、recovery-event 与 variance-time rearm 被当成新的、带经济语义的停止规则，而不是在已读面板上连续调 duration。它们各自必须过 support 与终局价值门。

#### 6.3 为什么 positive-day rate 不能替代 clustered interval

14/25 reward 正日只表示符号略多于一半，不考虑每天幅度。少数大负日可以抵消许多小正日，这对库存尾部尤其重要。日聚类均值区间同时保留幅度与日间变异，而 positive-day rate 是辅助稳定性指标。

反过来，区间跨零也不等于所有日都无效。它表示冻结证据无法把总体方向与 regime variation 分开；研究应该停止，而不是在结果后定义“只在某几类日期使用”。任何 regime rule 都需用决策时可见状态预注册，并在未来日验证。

### 7. 研究演进：版本为何只是一篇文章中的章节

这一身份承接 one-cycle near-noop，探索动作强度的另一端。后来 `action_defense_v1` scorecard 回看同一冻结输出，得到 total score -0.2681、mechanism score -1.0 和 `overbroad_risk_control` 分类；scorecard 当时尚未预注册，所以仅作诊断，不创造新研究版本。

后续 denominator 与 replay 修复撤回了旧精确 PnL、fill、campaign 与 tail 的当前校准权限，但并不撤回“不晋级”。修复不能让已经看过 Development 的相同 stop-until-flat action 获得一次免费重跑，也不能把版本、执行修正或 scorecard 分拆成新文章。

动作强度的已知边界因此是：one-cycle 太弱，until-flat 太强。这个边界启发 recovery-event rearm 等新经济动作，但那些项目必须用新 identity 独立评价。

### 8. 关闭边界与不确定性

关闭的是 $K_1$ 这个持久 permission action，不是所有库存控制。UTC-day cluster interval 跨零意味着 25 日 regime variation 足以覆盖 reward 点估计；56% positive days 也只有轻微多数，不能取代 LCB。

不能通过把最低 fill retention 从 85% 改到 10%、调低 candidate rate、把 MAE 设为唯一 outcome，或打开 Validation 来救援。合理后续必须让 permission 由可观察 recovery event 有选择地恢复，并重新冻结新的行为概率与证据面板。

### 9. 没有获得的权限

- Validation 与 family-specific sealed holdout 未读；
- 没有 live、shadow、action、C++ 或配置变更权限；
- 没有把正 downside 指标称为 fill-selection alpha 的权限；
- 没有降低 activity gate 或用同一面板重调树的权限；
- 没有将历史 exact values 当作当前基线校准。

### Persistent permission 是一个 dynamic treatment regime

一旦触发stop-add，未来动作取决于先前是否已经进入hold、库存是否flat以及期间发生了哪些reducing fills。policy可写成递归状态

$$
H_{t+1}
=
\begin{cases}
1,&H_t=1\land q_{t+1}\ne0,\\
1,&H_t=0\land trigger_t=1,\\
0,&q_{t+1}=0,
\end{cases}
$$

SELL add permission为$1-H_t$。这不是逐row classifier；同一trigger可能删除未来几十个机会，效果取决于何时出现repair。任何OPE或随机化都必须沿lineage保持assignment，不能在hold期间重新抽签。

### Tail improvement 的成本曲线

删除近九成SELL add fills几乎必然收缩极端SHORT tail，但也改变策略的核心参与度。一个risk action是否有价值，应在预注册utility或多指标gate中同时比较mean、q10/CVaR、fills、spread capture与inventory time。

若只优化CVaR，最优解可能是永不报价；若只优化mean，又可能容忍不可接受的库存尾部。可以把候选集合画成$(\Delta mean,\Delta CVaR,retained\ fills)$的Pareto frontier，而不是把所有量压成看过结果后才选择权重的单一分数。当前候选tail方向改善但activity跌破门，属于frontier上过于强的控制。

### 为什么中间强度不能靠线性插值推出

从one-cycle skip几乎no-op到until-flat删除大量fills，看似暗示中间存在sweet spot，但dynamic market path不保证连续。hold多一秒可能刚好跨过一次关键repair，也可能完全没有额外影响；duration与state trigger还有交互。

真正后继应冻结少量可解释的release事件，例如固定短TTL、price recovery、volatility clock或inventory budget，并先用outcome-blind replay检查action leverage与retention。只有mechanics落在可辨识区间，才读terminal economics。当前结果提出了设计问题，却没有为任何中间值提供先验收益证据。

### Dynamic regime 的 off-policy 估计为何困难

until-flat action改变未来是否还能add、何时flat和下一campaign何时开始。历史baseline下很少出现的长hold路径，在candidate下可能常见；逐decision importance weights会连乘并迅速退化：

$$
W_T=\prod_{t\le T}\frac{\pi(A_t\mid H_t)}{e(A_t\mid H_t)}.
$$

只要某一步propensity接近零，整条trajectory失去overlap。因此本类强persistent action更适合paired full-path replay或campaign-level randomized policy，而不是把观察性rows交给通用OPE。

### Campaign terminal 与日终都要报告

until-flat可能把campaign推到回放窗口外。只看closed campaigns会选择性删除最长、风险最大的路径；只看日终MTM又可能受terminal mark和initial state影响。二者应并列：campaign terminal/MTM处理路径，daily terminal equity提供共同市场分母。

若candidate减少campaign births，per-campaign均值与per-day总价值还会方向不同。activity gate正是为了避免通过删除业务把per-campaign表做漂亮。

### 未来 frontier 的 outcome-blind 预筛

候选release rules先只看mechanics：retained SELL add fills、hold duration、reducing fills、terminal-open campaigns和distinct days。选择落在预注册活动区间的两三个规则，才允许开启经济结果。

这种预筛不能看PnL或markout，否则仍会挑winner。它保证后继既不是one-cycle no-op，也不是until-flat过强，为真正可辨识的中间动作创造空间。

### 10. 公共证据

- [`sell_campaign_add_permission_v1_20260722.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/sell_campaign_add_permission_v1_20260722.md)
- [`sell_add_repair_trend_skip_causal_v4_v1_20260718.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/sell_add_repair_trend_skip_causal_v4_v1_20260718.md)
- [`F09 README`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/README.md)

### 结语

这项阴性研究给出了很有用的动作强度上界：阻断直到 flat 的确能减轻风险，却几乎抹去 SELL add participation。把 tail 与 activity 放在同一张 scorecard 上，才能避免把“少做所以少亏”误写成“会选择所以赚钱”。

## 5. State-conditioned rearm

### TL;DR：BUY 有弱正点估计，SELL 偏负，但两侧都先败在可执行支持

NarrowGate 的基线会在 exposure-increasing fill 后阻断同侧 add，实际冷却长度为 $85\text{s}\times$ 连续同侧 fill units。本项目没有搜索另一个固定秒数，而是在基线冷却真正到期后问：若 adverse move、adverse flow persistence、weak refill 与 weak recovery 四项仍同时成立，是否应继续跳过 add quote cycles，直到恢复 hysteresis 退出？

BUY 与 SELL 是两个独立 side-specific identity，却共享一篇主文章，因为研究问题、动作、split 与统计合同相同。56 日 Development 中，SELL/BUY 分别有 1,646/2,396 个 campaign rows，但真正 entry-active 仅 81/82 行；active baseline/effective candidate 为 SELL 42/39、BUY 35/47，都没有达到每臂至少 50 行的冻结 support gate。

时间外 25 日里，SELL reward 历史 DR uplift 为 -0.00504 USDC，95% day-cluster interval $[-0.01314,+0.00226]$；BUY 为 +0.00493，区间 $[-0.00166,+0.01275]$。BUY 的 repair 为负，duration avoidance 更是 $[-0.01204,-0.00025]$，说明弱正 reward 线索伴随更长 campaign。两侧 Development 均关闭，Validation 与 sealed holdout 未读。旧精确经济数值后因 denominator 修复撤回当前校准权限，但 support failure 与无晋级结论不变。

![85秒后状态条件 rearm 的双时钟状态机](/images/narrowgate/state-conditioned-rearm-after85.svg)

*图 1：机制示意。baseline cooldown 到期不是 candidate 的结束，而是随机化入口；只有四项 adverse conjunction 为真才继续 block，recovery hysteresis 退出。*

![状态型 rearm 的完整 campaign action 路径](/images/narrowgate/f09-campaign-action-causal-path.svg)

*图 2：entry 必须由 untreated baseline opportunity 决定；assignment 后 candidate 自己生成阻断、释放、fills 与 terminal。总 campaign 数、active treatment support 和经济结果是三个不同分母。*

### 1. 研究问题：固定时钟到期后，状态还危险怎么办？

固定冷却有一个明显缺点：85 秒只是 wall-clock 规则，不保证盘口、流量与价格已经恢复。但简单延长到 flat 又会过度关闭活动。本项目试图在两者之间构造稀疏且因果可见的状态动作。

对 side $s\in\{BUY,SELL\}$，目标是：

$$
\tau_s=E\left[Y_s(\text{continue block until recovery})-Y_s(\text{baseline rearm})\right].
$$

BUY add 增加 LONG，SELL add 增加 SHORT，所以 adverse flow 与 move 都要用 side-signed 表示，不能 pooled 后假设对称。结果 $Y_s$ 从首个 post-cooldown eligible decision 计到 campaign terminal。

### 2. 动作合同与输入

| 元素 | 冻结定义 |
|---|---|
| Control | actual baseline cooldown 到期后恢复 add |
| Candidate | adverse conjunction 存续时继续跳过 add cycles |
| Assignment | 每 day/campaign 恰好一次，0.5/0.5 |
| Entry | adverse move、persistent adverse flow、weak refill、weak price/microprice recovery 全成立 |
| Exit | separately frozen recovery hysteresis |
| 保持不变 | reducing、size、inventory limit、BUY/SELL 对侧、P3、queue、latency |
| Reward | fill value - incremental campaign cost - queue/reset cost |

四项 conjunction 可以写成：

$$
G_t=\mathbf1\{M_t>m_0,F_t>f_0,R_t<r_0,P_t<p_0\}.
$$

只有 baseline cooldown 已结束且 $G_t=1$ 时，candidate 才产生有效差异；若 $G_t=0$，两臂都 baseline rearm。这正是 active-state 稀疏的来源。

### 3. 双时钟与连续 fill multiplier

因果时钟不能从第一个 fill 简单加 85 秒。若同侧 exposure fills 连续发生，baseline block 是：

$$
t_{release}=t_{fill,last}+85\text{s}\times n_{same-side},
$$

其中 $n_{same-side}$ 按当前 operational contract 计数。market exchange time 决定价格与 L2 事件顺序，receive/ready time 决定状态何时可被策略使用。四个 entry components 必须在 $t_{decision}^{ready}$ 之前完成。

具体例子：BUY campaign 有两个连续 exposure fills，基线不是 85 秒后而是相应 multiplier 到期后重新 eligible。到达 release 时，若价格仍向下、SELL taker flow 持续、bid refill 弱且 microprice 未恢复，candidate 继续 block；若下一 snapshot 恢复条件成立，则从下一 causal decision 起退出。不能用未来 5 秒的最低价判断“当时仍危险”。

#### 3.1 Hysteresis 为什么是 treatment contract，而非防抖细节

若 entry 和 exit 使用同一瞬时阈值，score 在边界附近会让 permission 每个 decision 来回切换。hysteresis 用不同进入/退出条件，要求恢复达到更强标准后才释放；这会改变 block duration、订单数和 fill path，因此属于动作定义。

把 candidate 状态记为 $B_t$：

$$
B_{t+1}=
\begin{cases}
1,&B_t=0,\ G_t^{entry}=1,\\
0,&B_t=1,\ G_t^{exit}=1,\\
B_t,&\text{otherwise}.
\end{cases}
$$

看到结果后改变 exit threshold，并非“平滑参数”，而是改变 potential outcome $Y(B)$。这也是为什么未来不能在同一 Development 上松 conjunction 或 hysteresis。

#### 3.2 四项 conjunction 的稀疏性是乘法问题

即使每个 adverse condition 单独在 30% opportunities 上成立，若近似独立，四项同时成立只有 $0.3^4=0.81\%$。现实中它们相关，但 conjunction 仍会快速收缩 support。总 campaign rows 很多，并不能改变只有 81/82 active rows 的事实。

这个设计刻意寻找非常明确的坏状态，换来的代价是难以估计 action value。放宽为“三项满足两项”或改连续 score 会增加支持，但也定义新 treatment surface；recovery-event successor 正是以新身份完成这种改变，而不是给本项目补样本。

### 4. 证据面板与随机化完整性

同一组 76 个 strict event-L2 good days 分别分配给 BUY/SELL：56 Development、1 embargo、9 Validation、1 embargo、9 sealed holdout。后两块因 Development 失败保持锁定。

| Integrity / support | SELL | BUY |
|---|---:|---:|
| Development rows/campaigns | 1,646 | 2,396 |
| baseline / candidate assignments | 829 / 817 | 1,180 / 1,216 |
| entry-active rows | 81 | 82 |
| active baseline / effective candidate | 42 / 39 | 35 / 47 |
| entry-active days | 43 | 44 |
| multi-cycle candidate rate | 53.85% | 53.19% |
| total blocked add cycles | 174 | 150 |

所有行 propensity 为 0.5、每 campaign 唯一 assignment、role 为 add、size 不变且没有 external reference。最大 reward-identity error 为 SELL $1.11\times10^{-16}$、BUY $5.55\times10^{-17}$。

预注册 support 要求 active baseline 与 candidate 每臂至少 50 行、覆盖至少 10 日。日期覆盖足够，但两侧每臂行数都不足。candidate 确实多周期生效，所以它不是 one-cycle near-noop；失败来自 conjunction 太稀疏。

### 5. Chronological OPE：点估计必须与 repair、duration 联读

30 日 nuisance warmup、1 日 embargo 后，OOF contrast 覆盖 25 个未来 Development 日。越高越好：

| Outcome | SELL uplift [95% day CI] | BUY uplift [95% day CI] |
|---|---:|---:|
| terminal reward, USDC/decision | -0.00504 [-0.01314,+0.00226] | +0.00493 [-0.00166,+0.01275] |
| campaign-cost avoidance | -0.00467 [-0.01250,+0.00189] | +0.00443 [-0.00189,+0.01195] |
| negative-terminal protection | -0.00425 [-0.01141,+0.00240] | +0.00314 [-0.00168,+0.00927] |
| repair within 30m | -0.00658 [-0.01718,+0.00337] | -0.00251 [-0.00810,+0.00363] |
| duration avoidance beyond 30m | -0.00737 [-0.01479,+0.00037] | -0.00603 [-0.01204,-0.00025] |

SELL 只有 7/25 正 reward 日，BUY 8/25。SELL 几乎所有路径指标都偏负。BUY 的 reward 点估计略正，却缺少正 LCB；repair 负、duration 显著变差。如果只展示 BUY reward，会把“更久地持有未修复 campaign”遗漏掉。

两 logged arms 都没有 terminal $\le-5$ USDC 事件。这里的零 contrast 是 tail information missing，不是安全证据。

### 6. 为什么 support failure 不能用更多模型复杂度解决

active rows 只有 81/82，已经是规则本身在 56 日产生的全部干预表面。更深 tree、非线性 nuisance 或更窄 day cluster 不能创造 counterfactual support。有效信息量近似受最小 arm 限制：

$$
n_{eff}\lesssim 4\left(\frac1{n_0}+\frac1{n_1}\right)^{-1},
$$

SELL 由 42/39、BUY 由 35/47 决定，而不是由 1,646/2,396 的总 campaign 数决定。

看到稀疏后松动四项 conjunction、移动阈值或降低每臂 50 行的门槛，会在已读 outcomes 上改变 treatment definition。那是新 family，不是 v1 修补。

#### 6.1 名义样本、active sample 与有效样本

1,646/2,396 campaign rows 是名义分母；81/82 entry-active rows 才是 treatment 能产生差异的样本；按 arm 与日期聚类后的 $n_{eff}$ 更小。大量 $G_t=0$ rows 中两臂行为相同，能够验证 replay identity，却几乎不提供 $Y(1)-Y(0)$ 信息。

因此正确 funnel 是：campaign eligible → cooldown actually releases non-flat → four-way conjunction active → both randomized arms represented → future terminal observed。报告只给第一层会让 action 看似有数千样本，掩盖真正 positivity 失败。

#### 6.2 BUY 弱正点估计为什么不能成为 side-specific loophole

BUY 的 reward 点估计为正，但区间跨零、正日只有 8/25，repair 为负且 duration avoidance interval 完全低于零。若只挑 reward，candidate 可能是在延长未修复 exposure 的同时偶然获得账面收益。

更基础的是 active control 35、candidate 47，未过预注册每臂 50。side-specific policy 也不能跳过自己的 support gate。SELL 偏负不支持 pooled，BUY 弱正也不支持“只开 BUY”；两侧各自关闭是预先分侧设计的必然后果。

#### 6.3 一个合格的状态型 successor 需要什么

首先应在 outcome-blind state census 上证明 entry rate、duration、action-change 和 fill retention落在预注册区间；其次明确 invalid feature 时是继续 block、回 baseline 还是 censor；最后才做 campaign-level assignment-to-terminal评价。

如果使用连续 recovery score，还必须冻结 component scale 与 aggregation，因为 arithmetic mean、geometric mean 和 min operator 对“有一项没有恢复”给出完全不同的动作。模型形式不是装饰，它决定哪些 opportunities 进入 treatment。

### 7. 研究演进、关闭与支持边界

本项目承接 48 小时 observational attribution 提出的 post-cooldown intervention surface，但把它变成了 50/50 randomized full-path replay。它也展示了 one-cycle 与 stop-until-flat 之间不必只有固定时间：状态机确实能多周期生效，只是当前四项 conjunction 没有足够支持。

BUY 与 SELL 因 action side 不同各自拥有身份，但写在一起是因为它们共享同一个科学问题与冻结设计；不是为每个 side、spec 或执行尝试拆一篇文章。

关闭边界只覆盖“85 秒后、四项 conjunction、冻结 hysteresis”的 exact rule。它不证明 85 秒最优，也不关闭 active-order keep/cancel、variance-time 或不同 recovery event。未来机制必须重新冻结 outcome-blind threshold、split 与 score profile。

旧 top-20/q0.70 denominator 后来被修复，所以本文的旧精确 reward/fill/duration 数字不具当前 policy calibration 权限；然而支持不足、interval 不过门和 duration 风险都不会因修复自动反转为晋级。

### 8. 没有获得的权限

- BUY/SELL 的 9 日 Validation 和 9 日 sealed holdout 均未读；
- 没有 action、shadow、live、C++ 或配置变更权限；
- 没有在已读 Development 上松 conjunction、改 hysteresis 或降低 support gate 的权限；
- 没有把 BUY 弱正点估计当作方向性 alpha；
- 没有把旧精确数值用于当前 baseline 标定。

### Positivity 为什么会被 conjunction 快速耗尽

若四个条件各自在40%的active rows成立，在近似独立时四项同时成立只剩$0.4^4=2.56\%$。现实中条件相关可能提高或降低比例，但再叠加side、inventory role、valid feature、candidate price与hysteresis，最终action region往往集中在少数日期。

这类稀疏不能靠增加row频率解决。同一订单每100ms贡献上百rows，独立信息仍主要由order、campaign与day决定。支持应看distinct lineages与date concentration；若一个condition region只有三天，即使有十万rows，chronological transport仍不可识别。

### Hysteresis 的两道阈值怎样改变估计量

设进入hold阈值$u$、退出阈值$l<u$。状态递归为

$$
H_t=\mathbf1[z_t\ge u]\lor\{H_{t-1}\land z_t>l\}.
$$

它避免score在边界抖动，却使action依赖完整过去：两个当前$z_t$相同的orders，若一个此前已进入hold、另一个没有，permission不同。离线panel若只保存当前features而不保存历史state，就无法复现policy。

阈值$u,l$、minimum hold与rearm cadence共同构成treatment。看到结果后只调其中一个，并不能称为同一动作的小修；它改变duration与support，必须创建新的冻结身份。

### 一个更可识别的 successor

当前四项conjunction失败后，合理方向不是加入第五个条件，而是做消融：在outcome-blind面板上选择一到两个具有明确机制的状态，冻结宽support region；先验证它确实改变permission、fills与duration，再看价值。也可以把连续score用于ranked randomized exposure，在已知propensity下估计单调dose response，而不是硬切稀疏叶子。

BUY弱正点估计与SELL偏负提示side可能需要分开，但不能从失败面板中只解锁BUY。新的side-specific研究要有自己的日期门、support与multiplicity账本。这样“简化”是新的可证伪设计，不是从旧结果里挑一个看起来较好的角落。

### Missing state 不应被解释为“恢复”或“危险”

对conjunction rule，任何输入invalid时强制false会延长hold，强制true会提前rearm；两者都把数据质量变成动作方向。正确合同应单独定义`UNKNOWN`，通常fail closed到冻结baseline permission，并记录invalid原因。

若baseline本身是固定85秒rearm，unknown时回baseline和继续hold也不是同一选择；必须在spec中明确。missing rate若集中在volatile days，fallback还会改变treatment population，因此support报告要按day/state拆分。

### Rearm 触发后的 lineage

一旦允许add，后续order、fill与campaign必须携带触发该permission的assignment id；不能在每个decision根据当前条件重新标记。否则成功fill可能被归给最后一次“条件仍成立”，而不是最初release动作。

lineage至少持续到action effect自然终止：该cycle结束、inventory flat或预注册窗口。若不同定义给出不同reward，duration就是treatment的一部分，不能当report细节。

### Support failure 给出的定量信息

它指出四项state rule在目标decision surface过窄，导致有效日期与lineage不足。这个结论比“PnL跨零”更早：即便点估计方向好，也无法可靠区分真实异质性和少数日期。

后继可用更宽的单条件、ranked dose或随机化阈值来增加positivity；但这些是新actions。当前BUY点估计不能被用作只开放BUY的证据，因为side选择本身来自同一失败结果。

### 9. 公共证据

- [`state_conditioned_rearm_after85_v1_20260722.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/state_conditioned_rearm_after85_v1_20260722.md)
- [`dynamic_mechanism_campaign_audit_20260722.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/dynamic_mechanism_campaign_audit_20260722.md)
- [`F09 README`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/README.md)

### 结语

这项研究没有找到可以上线的 rearm rule，却把问题缩得更清楚：状态型动作必须同时有真实持续效果、足够 active support、正 terminal value 与不恶化修复时长。BUY 的弱正点估计只满足了其中最容易误读的一项。

## 6. Recovery-event rearm

### TL;DR：这次不是样本不足，也不是停止交易；候选在有支持时仍显著更差

上一项四条件 conjunction 太稀疏。本项目把恢复状态改写为连续几何分数：shock decay、refill recovery、microprice recovery 与 queue recovery 各映射到 $[0,1]$，用等权几何均值合成。baseline 在实际 85 秒冷却到期后恢复 add；candidate 在 score 未达到 side-specific threshold 时继续 block，看到 causal recovery event 后释放。

阈值选择严格 outcome-blind，只读取 causal state、assignment 与 intervention fill count，在 5%–30% quantile grid 中目标 15% candidate rate，并要求 fills retention 至少 85%。SELL 冻结阈值 0.01600795，candidate rate 约 11%，conservative retention 87.04%；BUY 阈值 0.02147895，candidate rate 15.03%，retention 87.49%。

SELL 是预声明的 first side。56 日 Development 产生 1,644 campaign rows、180 active entry rows、712 OOF rows，support、overlap 和 activity 全部通过；但 reward DR uplift 为 -0.01560 USDC/campaign，UTC-day 95% interval $[-0.02996,-0.00377]$，campaign cost、negative terminal 与 MAE 也显著更差。这是一项干净的 action failure：动作发生了、没有活动崩塌、却降低价值。BUY 只完成 support freeze，outcome panel 未开。Validation 与 sealed holdout 均未读。

![Recovery-event rearm 几何分数状态机](/images/narrowgate/recovery-event-rearm.svg)

*图 1：机制示意。四个 causal components 合成为 recovery score；低于阈值时 candidate block，高于阈值时 rearm。invalid state 不能被当成“恢复”。*

![Recovery-event action 的完整因果路径](/images/narrowgate/f09-campaign-action-causal-path.svg)

*图 2：score 只决定 permission，不能替代终局。支持选择不读 outcome；正式 arm 则从 assignment 重新生成订单与库存，并同时经过 activity、lifecycle 与 economics 门。*

### 1. 研究问题：描述恢复是否等于识别有价值的动作？

盘口恢复可以从多个角度观察：adverse flow 是否衰减、被抽走的深度是否补回、microprice 是否向有利方向移动、当前 queue 是否恢复到 shock 前水平。把这些量组合成 score 很容易；难点是证明“低 score 时多等一会”优于立即恢复报价。

目标 estimand 是：

$$
\tau_s=E[Y_s(\text{block until }S_t\ge c_s)-Y_s(\text{baseline rearm})],
$$

其中 $c_s$ 在读 outcome 前冻结，$Y_s$ 是 decision-to-terminal campaign value。预测坏状态与识别阻断动作的收益不同：低 recovery score 可能只说明 campaign 已经糟糕，却不意味着不挂下一笔 add 能修复它。

### 2. 四个输入与关键公式

在首个 baseline-eligible post-cooldown decision，将四个 causal path components 映射到 $[0,1]$：

$$
d=\operatorname{clip}\left(1-\frac{F^{adv}_{1s}}{\max(F^{adv}_{5s},F^{adv}_{since\ fill},0.05)},0,1\right),
$$

$$
r=\operatorname{clip}(\text{refill recovery ratio},0,1),\quad
m=\operatorname{clip}(\text{microprice recovery ratio},0,1),
$$

$$
q=\operatorname{clip}(\text{current depth}/\text{pre-shock depth},0,1).
$$

composite 使用带 $\epsilon=10^{-6}$ 的等权几何均值：

$$
S=(\max(d,\epsilon)\max(r,\epsilon)\max(m,\epsilon)\max(q,\epsilon))^{1/4}.
$$

几何均值使任何一个近零组件都压低整体 score。`refill` 比较 depleted level 后的恢复，`queue recovery` 比较 shock 前起始深度；二者相关但不是同一分母。

有效行需要 causal path、至少两个 L2 snapshots，且 book age 不超过 2 秒。entry invalid 时回退 baseline；candidate episode 已启动后遇到 invalid observation，则保持等待，不能把缺数据误当恢复。

#### 2.1 几何均值到底表达了怎样的恢复观

等权几何均值接近一种“短板惩罚”：四项都适度恢复时 score 才上升；一个组件接近零会显著压低整体。对 component $x_j$，log score 为：

$$
\log S=\frac14\sum_{j=1}^{4}\log\max(x_j,\epsilon).
$$

所以相对敏感度 $\partial\log S/\partial\log x_j=1/4$ 相同，但在原始尺度上，小值附近绝对导数很大。这个设计与 arithmetic mean 不同：后者允许三个高分补偿一个零分。

它是清楚的机制假设，却不是经济定理。也许 queue 未恢复时应等待，也许恰恰是空 queue 让下一张订单更快成交并有利修复。randomized replay 检验的就是“短板恢复观”能否产生价值，而不是只检查 score 数学是否优雅。

#### 2.2 Invalid state 的方向不能由结果决定

entry 时数据无效就回 baseline，避免用缺失状态创建 treatment；episode 已经 block 后遇到无效则继续等待，避免缺数据被解释为恢复。两个规则不对称，是因为前者控制是否开始干预，后者控制一个已有持久状态何时终止。

这仍是一种冻结的保守选择。若高负载时 L2 更容易 stale，“invalid 后继续 block”可能延长最剧烈行情下的 treatment。正式报告因此必须同时给 invalid frequency 与 duration，而不能只说 feature coverage 很高。

### 3. 动作、时钟与风险集例子

| 项目 | 冻结定义 |
|---|---|
| Control | baseline cooldown 到期即 rearm |
| Candidate | $S_t<c_s$ 时 block，首次 valid $S_t\ge c_s$ 时 rearm |
| Unit | side-specific campaign，最多一次 assignment |
| Propensity | 0.5/0.5 |
| Unchanged | reducing、size、max inventory、taker、external reference off |
| Primary | terminal reward；campaign cost、MAE、repair/time 为共同门 |

例如 SELL campaign 的 cooldown 到期时，$d=0.20,r=0.10,m=0.25,q=0.40$，则 $S\approx0.212$；实际是否低于阈值取决于冻结量纲与变换后的数值。若 score 低，candidate 跳过该 SELL add；几秒后 $r$ 与 $q$ 补回，score 过线，下一 causal decision 才 rearm。baseline 在第一时刻就挂单并可能成交，所以两臂后续 inventory、queue 与 repair 路径不同。

exchange clock 排列 trades/L2；ready clock 决定四组件可用时点。不能用本周期结束后的最低 mid、后来 refill 或终局 campaign PnL参与 $S_t$。一旦这样做，所谓 recovery event 就变成 outcome label。

### 4. Outcome-blind 支持选择

threshold selector 没有读取 reward、PnL、markout、campaign cost、MAE 或 duration，只在 5%–30% quantiles 搜索，目标 candidate rate 15%，每侧 candidate 至少 50 rows/10 days，并保守假设所有与 blocked entry 绑定的 baseline fill 都会丢失。

| Side | score threshold | candidate rate | conservative fill retention | 结论 |
|---|---:|---:|---:|---|
| SELL | 0.01600795 | 11.00% | 87.04% | support pass |
| BUY | 0.02147895 | 15.03% | 87.49% | support pass |

BUY 只获得机制与支持结论，outcome panel 没有开启。这不是漏做，而是 side order 的治理：预先声明 SELL first，SELL 失败后没有理由继续消费 BUY outcomes。

#### 4.1 为什么用 fill retention 的保守下界选择 threshold

selector 无法在不打开结果路径的情况下精确知道 candidate 会丢多少终局价值，但可以用 baseline 与 blocked entries 的机械 overlap 给出保守 fill-retention proxy。阈值必须同时把 candidate rate 放在 5%–30% 且 retention 至少 85%，否则会重演 one-cycle near-noop 或 until-flat shutdown。

这个过程只决定“动作是否有适中杠杆”，不决定“动作是否赚钱”。因此 support pass 只允许打开预声明 SELL economics。把 threshold grid 与 PnL 同时优化，会使 action rate、状态定义和经济方向在一份数据上共同过拟合。

#### 4.2 SELL-first 顺序为什么保护 BUY 证据

BUY 与 SELL 有独立 action identity，但共享方法。预先规定先打开 SELL，可以把 BUY 保留为未来独立分侧证据。如果 SELL 失败后仍打开 BUY，只是为了寻找一个正方向，整个双侧 family 的错误发现率会升高。

这里 SELL 已出现完整负区间，继续消费 BUY outcome 不会修复 SELL action，也不会让共享 score 获得普遍权限。保留 BUY 未读，给真正不同的 BUY-specific hypothesis 留下更干净的证据，而不是把“没算”当作遗憾。

### 5. SELL Development 面板

正式回放覆盖 56 个 Development 日，fresh-start daily state、exact 50/50 propensity 与每 campaign 一次 intervention。共有 1,644 campaign rows；180 个 active entry rows 分布于 51 日，其中 active baseline 97、effective candidate 83。实际 candidate rate 10.95%，conservative fills retention 87.19%。

chronological OOF 有 712 rows，policy ESS 343，unsupported mass 与 overlap violations 都是 0。21.7% effective candidate assignments 阻断超过一个 quote cycle，说明多数 episode 很快恢复，但动作并非纯 one-cycle mask。

### 6. 结果：支持通过后的明确阴性

| 越高越好 | SELL DR uplift | UTC-day 95% interval | 正日率 |
|---|---:|---:|---:|
| reward, USDC/campaign | -0.01560 | [-0.02996,-0.00377] | 24% |
| campaign-cost avoidance | -0.01362 | [-0.02844,-0.00181] | 32% |
| negative-terminal protection | -0.01360 | [-0.02699,-0.00321] | 28% |
| Development-q10 protection | -0.00886 | [-0.02166,+0.00004] | 36% |
| campaign-MAE avoidance | -0.01913 | [-0.03798,-0.00335] | 32% |
| repair within 30m | -0.00352 | [-0.01714,+0.00856] | 28% |
| repair-time avoidance, seconds | -9.27 | [-33.71,+13.66] | 44% |

主要 value、campaign cost、negative terminal 与 MAE 的整个 interval 都在零下。活动保留超过 85%，所以不能用“candidate 停止交易”解释失败；overlap 和 ESS 也足够。冻结 score 捕捉到了低恢复状态，却没有捕捉到“阻断下一个 add 能改善路径”的区域。

没有 terminal $\le-5$ USDC 事件，因此 extreme-tail estimand unsupported。不能把零事件写成 tail safety pass。

### 7. 为什么合理的状态分数仍会产生错误动作

一个风险 score 可以有预测意义而无 treatment-effect 意义。设 $Z$ 是低 recovery state，可能有：

$$
E[Y(0)\mid Z]\ll E[Y(0)\mid \neg Z],
$$

却仍然同时满足：

$$
E[Y(1)-Y(0)\mid Z]<0.
$$

第一式说 $Z$ 预测坏 campaign；第二式说在坏 campaign 中 block 更差。原因可能是被阻断的 SELL add 原本会改善平均开仓价，或者延后参与使 repair opportunity 消失。此实验识别的正是第二式。

#### 7.1 一条负 action path 的合成解释

设 SHORT campaign 在价格上冲后 cooldown 到期，refill 与 queue 尚弱，score 很低。baseline 恢复 SELL add，在短暂高价成交；数秒后价格回落，新增 short 与 reducing BUY 共同贡献修复。candidate 等到 book 看似恢复才 rearm，此时价格已回落，错过更有利的 SELL execution，campaign 反而更久或以更差 value 结束。

这条路径里低 score 对“市场刚受冲击”的描述完全正确，错误发生在把描述映射为“继续禁止加空”。对某些 inventory state，adverse market state 也可能提供更好的 passive entry price；动作效应取决于库存与未来路径，不由风险标签单独决定。

#### 7.2 明确阴性比 support failure 提供了更多信息

上一项 conjunction 因 active rows 不足，无法区分 rule 真无效还是估计太宽。本项目 support、activity、overlap 都通过，reward、campaign cost、negative terminal 与 MAE 却有负下界。这缩小了替代解释：不是 no-op、不是 shutdown、不是 propensity 崩溃，也不是只差一点样本。

因此不能用“再收集更多相同日期类型”作为默认重开理由。真正新项目需要不同 economic mapping，例如价格调整而非 permission、不同 inventory role 或新的 decision-visible evidence；仅重调几何权重是在已观察负结果上找逃生门。

### 8. 研究演进与关闭边界

从稀疏四条件 conjunction 到连续几何 score，经济机制发生了足够变化，因此这是新 research identity；但 support selector、正式 SELL run 与 scorecard 都只是同一 identity 的阶段，不应拆文。

后续 denominator 修复使旧 exact reward/fill/campaign/duration 数值不再用于当前标定；原始 interval 已明确为负，修复也不会自动授予重调 weights、threshold 或 aggregation 的权限。要尝试 arithmetic mean、不同组件或 active-order cancel，必须新注册 action 与面板。

关闭的是这个四组件几何 score 下的 post-85 delayed rearm，尤其是 SELL outcome action。BUY 仅有 support 结论，不能说 BUY value 正或负；它同样没有 outcome 晋级权限。

### 9. 没有获得的权限

- SELL Validation 与 sealed holdout 未读；BUY outcome panel 未开；
- 没有 action、shadow、live、C++ 或 baseline 变更权限；
- 没有在已消费 SELL Development 上重调权重、阈值或 candidate-rate target；
- 没有将几何 score 当作已验证 risk alpha；
- 没有把旧精确经济值当作当前 calibration。

### Recovery score 为什么容易把描述顺序误当动作顺序

价格、spread、flow与volatility都“恢复”到阈值内，只说明当前市场接近某个历史normal region；它不说明重新允许add的边际价值为正。恢复事件往往发生在大冲击之后，库存、queue与opportunity set已经被冲击选择。score越高，可能只是离下一个常态更近，也可能仍处在反弹前的危险过渡期。

几何均值让任一分量接近零时总分显著下降，适合表达conjunctive health，但它隐含各分量可比且乘法补偿。两个score同为0.6的状态，可能一个四项均衡，另一个三项很好、一项临界；动作价值未必相同。冻结研究检验的就是这一个聚合定义，不能把阴性结果推广为所有recovery representations都无效。

### Outcome-blind threshold 选择保护了什么

用control path的fill retention下界选threshold，只看动作强度与support，不看reward。这样可以避免挑出“刚好在这批日赚钱”的切点，并确保候选不是接近no-op。它仍不能保证经济效果，因为retained fills只度量参与度，不度量删掉的是坏fill还是repair fill。

在threshold冻结后，SELL结果显著更差，说明当前recovery事件即便有足够动作杠杆，也没有形成正value。此时再用PnL调score weights、invalid direction或BUY/SELL阈值，会把明确阴性变成无限搜索。合法后继必须改变机制假说或使用新证据面板，而不是围绕旧threshold做局部救援。

### 阴性结果如何缩小下一轮搜索空间

本项目排除了“多个恢复指标的几何均值超过门槛即可安全rearm”这一简单规则。后续可以研究更接近动作价值的状态：active queue option、inventory role、冲击后first-passage time、external reference residual或明确的campaign repair机会。

新模型也应直接估计keep-hold与rearm的terminal contrast，而不是先预测一个无监督normality score再假设高分等于正value。若仍保留recovery features，它们作为$X$进入

$$
\tau(X)=E[Y(rearm)-Y(hold)\mid X],
$$

并用chronological OOF、overlap和full-path replay验证。这样负结果被转化为estimand升级，而不是被遗忘。

### Invalid direction 的敏感性不能事后选择

把invalid当低recovery会延长hold，把invalid当高recovery会提前rearm；删除invalid又改变目标总体。三种处理都可能改变结果。spec必须在outcome前确定fallback，报告各原因和日期集中度。

若missingness与shock相关，简单complete-case也不安全。可以给worst/best-case bounds或把invalid作为独立state随机化验证，但不能看到哪种处理赚钱就选哪种语义。

### 为什么 direct uplift 比 normality score更近

recovery score衡量“像不像正常”，动作真正需要的是rearm相对hold的差值。两个state都很正常，若一个有良好queue repair机会、另一个即将再次冲击，normality相同而uplift不同。

直接模型$\tau(X)$也不是免费答案：需要两动作support、chronological OOF与terminal outcomes。但它至少把训练目标与决策对齐，避免用描述性状态分数替代value。

### 明确阴性后的停止规则

support通过且reward显著更差时，应关闭当前score/threshold/action三元组，并把所有已读subgroup纳入multiplicity账本。只有新的机制或新数据身份才能重开。这样阴性结果真正减少搜索空间，而不是成为下一轮调参的起点。

### 10. 公共证据

- [`recovery_event_rearm_v1_20260722.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/recovery_event_rearm_v1_20260722.md)
- [`state_conditioned_rearm_after85_v1_20260722.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/state_conditioned_rearm_after85_v1_20260722.md)
- [`F09 README`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/README.md)

### 结语

这项研究的价值在于失败得足够明确：阈值是 outcome-blind 的，支持与活动都通过，完整路径却更差。它提醒我们，描述“市场尚未恢复”的分数，不天然回答“此刻少挂一笔是否更好”的动作问题。

## 7. Variance-time rearm

### TL;DR：机制强、路径完整、支持充分，但 BUY 与 SELL 的主 reward 下界都没过零

固定 85 秒把平静市场与剧烈市场视为同样长。本研究把 exposure-increasing add 的 rearm clock 改为累计 realized variance：每个 same-side cooldown lineage 在起点获得一个 side-specific 波动预算，完成的一秒 BBO bucket 按 ready clock 逐步累加；累计 variance 达预算时 rearm。control 仍是 $85\text{s}\times$ consecutive same-side fill units。

研究演进经历 feasibility v1 的错误 trade-close clock、v2.1 的 causal completed-bucket 修复、full-path blocker preflight、C++ BUY-q90 lockstep，最后才注册随机化 action。它们不是五篇研究，而是同一问题从时钟可计算到动作可评价的证据链。

正式 Development 覆盖 40 日（24 Grade A、16 Grade B）、17,460 条 lineages；BUY/SELL 为 9,140/8,320。candidate 的 final-action change 达 37.02%/24.41%，fill retention 104.80%/99.41%，所以既非 no-op 也非 participation shutdown。可是 primary lineage reward 为 BUY +0.000738 USDC，95% UTC-day interval $[-0.002000,+0.003577]$；SELL +0.001875，区间 $[-0.002303,+0.006242]$。两侧 hard gates 均失败，Validation 与 sealed holdout 未读。

![Variance-time add rearm 双时钟机制](/images/narrowgate/variance-time-add-rearm.svg)

*图 1：机制示意。同一价格路径上，wall time 均匀走动，variance time 只在已完成且已 ready 的一秒 bucket 上累积；高波动时可能更早释放，低波动时更晚。*

![Variance-time action 的完整 campaign 因果路径](/images/narrowgate/f09-campaign-action-causal-path.svg)

*图 2：clock difference 只是 mechanics 起点；它还要穿过 downstream blocker、quote action、fill、inventory 与 terminal。timing 改变而最终动作不变时，不会自动产生经济 treatment。*

### 1. 研究问题：同样的 85 秒具有同样的市场信息量吗？

冷却的目的不是崇拜秒数，而是在 toxic fill 后等待足够市场演化。若局部波动剧烈，20 秒可能已经经历大量价格风险；若盘口静止，85 秒可能只包含很少信息。于是候选用“波动时间”衡量 elapsed exposure。

对 lineage $e$、side $s$，control release 为：

$$
T^{wall}_{s,e}=85\text{s}\times\max(1,n_{same-side\ fill\ units}).
$$

candidate budget 与累计量为：

$$
B_{s,e}=\nu_{ref,s}\cdot85\text{s}\cdot\max(1,n_{same-side\ fill\ units}),
\qquad QV_e(u)=\int_0^u\nu_t\,dt.
$$

首个 $u$ 使 $QV_e(u)\ge B_{s,e}$ 时 rearm，并受冻结 liveness min/max bounds 约束。later same-side fills 更新预算但不重新随机化；opposite-side fill、explicit reset 或 daily fresh-start censor 结束 lineage。

### 2. Causal variance clock

每个完成的一秒 bucket 从 executable BBO mid 计算：

$$
\nu_t=10^8\frac{\sigma^2_{p,t}}{m_t^2}\quad[\mathrm{bps}^2/\mathrm{s}].
$$

对 bucket $[t,t+1s)$，只使用 timestamp 严格小于 $t+1s$ 的最后 valid BBO；bucket 在结束时刻加冻结 ready delay 后才可见。missing 或 stale variance 让时钟暂停，不用未来数据回填，也没有默认方差。

前 20 个 Development 日 outcome-blind 拟合 reference rate：BUY 0.3664154173 bps²/s，SELL 0.6020856312 bps²/s。随后 20 日含 3,376 BUY、2,107 SELL episodes；在 0/250/1000ms ready-delay 三个场景中，start-valid 均约 99.6% 以上，valid-clock 约 99.8% 以上，Python/C++ mismatch 为 0。

一个例子：若 BUY budget 为 $0.3664\times85\approx31.15$ bps²，高波动阶段每秒累计 1.5 bps²，约 21 秒可能达到预算；低波动阶段每秒 0.1 bps²，则需更久并受 liveness cap。candidate 既可早于 control，也可晚于 control，这种 two-sided variation 是可识别 action 的必要条件。

#### 2.1 量纲为什么在这里闭合

$\nu_t$ 的单位是 bps²/s，乘以秒得到 bps² budget；累计完成 bucket 的 $\nu_t\Delta t$ 也为 bps²。因此：

$$
[B]=[QV]=\mathrm{bps}^2.
$$

这和报价核心中“60 个 1 秒变化估计方差，再乘风险 horizon”的问题不同。这里的 85 秒不是又乘进价格方差的 AS horizon，而是用于把历史 reference variance rate 转成累计市场演化预算。若把未归一化 price variance 与 bps² reference 混用，budget 会随 BTC 价格水平平方漂移。

completed bucket 还解决了一个时间问题：$[t,t+1s)$ 的方差只有到 $t+1s$ 并经过 ready delay 后才存在。若在区间中间用最终 close，candidate 会提前累计未来波动，通常在剧烈行情中更早 rearm，形成方向性泄漏。

#### 2.2 Two-sided variation 为什么比“总是更久”更可识别

如果 candidate 永远晚于 baseline，它容易退化成 participation suppression；如果永远更早，则近似放松安全门。variance time 在高波动时提前、低波动时延后，提供相反方向的 timing contrasts，使研究能够检验“市场演化量”而不是单纯更保守或更激进。

但 two-sided mechanics 不保证正净效应。高波动早放可能在风险最大时增加 exposure，低波动晚放又可能丢失平稳 spread；两边都可能负。只有 terminal replay 能决定哪种机会成本占主导。

### 3. 输入、动作与 estimand

| 元素 | 冻结内容 |
|---|---|
| Unit | same-side fill-cooldown lineage |
| Assignment | lineage 起点 0.5/0.5，之后固定 |
| Control | explicit wall clock |
| Candidate | frozen variance budget + liveness bounds |
| Unchanged | reducing、size、limits、P3、queue、latency、blockers |
| Primary | decision-to-lineage-terminal direct equity reward |
| Secondary gates | campaign terminal、q10、MAE、repair、censor、inventory time |

authoritative row reward 是 lineage decision 到 terminal 的直接 equity change。审计等式为：

$$
Y=V^{maker}_{30s}-R^{campaign}_{accounting}-C_{queue/reset}.
$$

$R^{campaign}_{accounting}$ 是路径会计残差，不是独立识别的 causal cost；queue reset 没有已识别的 USDC price，显式 cost 设为零，但 reset 导致的 missed/added fills 在路径中真实重放。maker-signed value 从 execution price 起算，不再重复加 half-spread。

### 4. 研究演进：为什么多个版本仍是一项研究

最早 feasibility 用 trade-close 近似 variance clock，无法保证 bucket 在 decision 时已经完成，因此被阻断。v2.1 将 coverage 精确裁到 candidate release，并采用 completed one-second BBO bucket，证明六个 side×delay cells 的 support、clock quality、two-sided variation、liveness 与 Python/C++ mechanics 全通过。

接着 full-path preflight 在同一 40 日独立重放 control/candidate，重新生成 quotes、cancel/ACK、replacement、re-entry、queue、fills、inventory 与 blockers。mechanical episodes 5,490 BUY/3,827 SELL；unmasked action support 72.75%/57.04%。later-ready differences 常被 markout/adverse gates mask，这说明 timing difference 不等于最终 action difference。

C++ q90 lockstep 在两个冻结机制日消费 15,091,226 次 raw book messages、7,154,847 次 q90 evaluations、28,733 activations、57,030 lifecycle calls，event/state/action mismatches 为 0。它只授予 native-book BUY-q90 kernel parity，不是 full C++ tick-replay authority。完成这些前置证据后，才产生 randomized replay identity。

### 5. 正式 Development 支持

40 个 authoritative F09 days 全部 native-sequence 与 normalized-formal eligible，其中 24 Grade A、16 Grade B。17,460 lineages 的 propensity 每行 0.5；BUY/SELL 每个 day×side cell 两臂都有样本。unsupported rows 仅 6，即 0.034%；reward identity 最大误差 $1.11\times10^{-16}$ USDC；source gaps、invalid sequences、BUY-q90 C++ mismatch 与 sync-censored days 均为零。

| Side | candidate assignment | final-action change | 95% day interval | fill retention |
|---|---:|---:|---:|---:|
| BUY | 50.03% | 37.02% | [31.93%,41.91%] | 104.80% |
| SELL | 50.66% | 24.41% | [20.77%,28.10%] | 99.41% |

fill retention 超过 100% 并非复制错误：更早或更晚 rearm 会重排 queue 与后续 fills，candidate 可能多成交。重要的是两侧 participation 没崩塌，且 final action 差异充足。

#### 5.1 从 clock change 到 final-action change 的传导

candidate release 与 wall release 不同，只是潜在 action difference。真实 quote 还可能被 q90、markout guard、consecutive-loss cooldown、sync degrade、inventory limit 或其它 blocker 同时禁止。若两臂最终都不能提交，clock 差异不会进入订单层。

这就是 preflight 同时报告 unmasked support 与 final-action change 的原因。BUY/SELL 37.02%/24.41% 说明传导足够强，却也说明大量 timing differences 被后续机制吸收。一个只模拟 clock、不重放完整 blocker stack 的简化回测会夸大 treatment rate。

#### 5.2 Lineage assignment 防止 later fill 重新随机化

same-side later fills 会扩大 wall 与 variance budget，但 arm 必须保持不变。否则 candidate 早放导致额外 fill，额外 fill又触发新随机数，assignment 本身受 treatment path 影响，破坏 0.5/0.5 propensity。

冻结 lineage 可表达为：

$$
A_e=H(day,side,lineage\ identity),
$$

直到 opposite fill、reset 或 censor 才结束。所有由当前 arm 产生的 same-side fills 继承 $A_e$。这是一种 sequential consistency 约束，不只是去重字段。

### 6. 经济结果与不确定性

所有差异为 candidate-control，interval 用完整 UTC-day cluster bootstrap：

| Side | Metric | Point | 95% UTC-day interval | 正日 |
|---|---|---:|---:|---:|
| BUY | primary lineage reward | +0.000738 | [-0.002000,+0.003577] | 47.5% |
| BUY | campaign terminal value | +0.007607 | [+0.003349,+0.012043] | 65.0% |
| BUY | inventory-time avoidance | +0.009843 BTC·s | [-0.001394,+0.023596] | 57.5% |
| SELL | primary lineage reward | +0.001875 | [-0.002303,+0.006242] | 65.0% |
| SELL | campaign terminal value | -0.000003 | [-0.010238,+0.008853] | 57.5% |
| SELL | inventory-time avoidance | +0.009464 BTC·s | [-0.002802,+0.024931] | 55.0% |

BUY terminal campaign secondary metric 有正下界，却不能覆盖 primary reward、q10、MAE、repair、censor 与 inventory-time 的联合失败。SELL reward 点估计及正日率看起来更好，但 interval 仍跨零，其 terminal 与 tail gates 也失败。BUY/SELL 不允许 pooled rescue，两个 scorecards 均 `ranking_score=null`。

#### 6.1 BUY primary 与 campaign terminal 为什么会给出不同方向强度

primary lineage reward 从 assignment 开始，以 lineage terminal 的直接权益变化为准；campaign terminal 可能包含 assignment 前已经积累的 campaign PnL，或 assignment 后但不完全属于 lineage treatment 的 continuation。若 candidate/control 在进入 assignment 时历史状态稍有不平衡，campaign-level secondary 容易吸收 pre-assignment value。

正确归因要求：

$$
Y_{decision\to terminal}
=
R_{lineage}+C_{post-lineage},
$$

而 pre-assignment campaign PnL只能作 covariate/balance diagnostic。后续 negative-result attribution 正发现 BUY 的漂亮 campaign terminal下界含有这类上游成分；因此 primary failure 不能由 secondary 覆盖。

#### 6.2 机械证据越强，经济阴性越不能归咎于实现

本项目有 causal clock、three-delay sensitivity、full-path blocker、数百万 book/evaluation 的 C++ kernel parity、两臂完整支持和可观 final-action change。它排除了许多常见借口：不是没触发、不是 C++ 算错 q90、不是全部被 blocker mask、也不是停止交易。

剩余结论更集中：在冻结 40 日、budget 与 liveness 下，variance-time 对主 terminal reward 的平均贡献没有建立正下界。机制漂亮并不削弱阴性，反而让它更有解释力。

### 7. 结果边界与剩余不确定性

daily fresh-start replay 不等价于连续 live carry。历史 40 日没有出现真实 q90 cancel-request 到 ACK 之间的 fill branch；该分支只有 synthetic contract coverage，不能声称有历史市场覆盖。AWS receive-time transport 也没有获得支持，exchange-time BBO clock 不能直接转成 live authority。

Development q10 threshold 曾从 pooled control rows 计算，这是 nuisance limitation；它不能用作 side-specific tail artifact。但两侧已分别失败 primary reward 与额外 hard gates，所以该问题不会把关闭反转成晋级。

### 8. 关闭边界与没有获得的权限

关闭的是冻结 variance budget 与 liveness bounds 替代 wall clock 的 action。variance clock 本身仍是可复现 mechanics component，但不是已验证的经济策略。

- Validation 与 sealed holdout 未读；
- 没有 shadow、action、live 或 AWS receive-time authority；
- 没有 full C++ tick-replay authority；
- 没有重调 $\nu_{ref}$、budget、liveness 或 score profile 的权限；
- 没有用 BUY secondary terminal metric 覆盖 primary failure 的权限。

### Variance clock 与固定秒钟回答不同问题

固定85秒把所有市场状态视作同样的信息演化；variance clock累计的是价格路径活动量。若每个小区间absolute-price variance估计为$\hat\sigma^2_j$、长度$\Delta t_j$，累计业务时间为

$$
B(t)=\sum_{j:t_j\le t}\hat\sigma_j^2\Delta t_j.
$$

达到阈值$B^*$时rearm，平静期可能等待更久、剧烈期更快。它不是“vol高就永远延迟”或“总比85秒长”，而是让相同累计variation对应相近的市场演化量。

不过$\hat\sigma_j^2$本身必须在bucket完成后ready，不能用包含未来价格的同区间估计。若缺失state被当零，clock会在数据断档时虚假停滞；若用未来补值，又形成lookahead。完整报告需要区分calendar elapsed、valid variance exposure与invalid hold时间。

### Clock change、action change 与 value change 是三层门

第一层检查$B(t)$是否真的让rearm time相对control双向变化；第二层检查时间变化是否落到permission、quote、activation与fill；第三层才比较terminal value。若clock每次都变但final action被其它guard挡住，economics近似no-op；若action充分分叉却value不改善，才是对机制的有力阴性。

本研究恰好属于后者：lineage、action与support足够，BUY/SELL primary reward下界仍未过零。此时不能把失败解释成“实现没动”或“样本完全没有动作”。强mechanics让经济结论更清楚：累计variation作为单独release clock没有提供稳定terminal uplift。

### 可保留的系统能力与不可保留的动作结论

causal variance clock仍是可复用primitive。它可以用于duration标准化、risk reporting或其它预注册动作，但不能因为工程完整就默认rearm有利。未来若与inventory budget或external recovery结合，组合rule属于新treatment，需要新support；不允许把本篇阴性主效应和另一个弱信号事后相乘寻找winner。

一个更小的后继可以只研究固定秒钟与variance clock在明确campaign role上的one-shot release，并把风险utility预先写明。若目标是降低库存时间而允许轻微mean成本，权重应在结果前冻结；否则“风险更好”与“价值更好”会继续被混用。

### 9. 公共证据

- [`volatility_time_add_rearm_randomized_replay_v1_development_20260729.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/volatility_time_add_rearm_randomized_replay_v1_development_20260729.md)
- [`volatility_time_add_rearm_feasibility_v2_1_development_20260729.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/volatility_time_add_rearm_feasibility_v2_1_development_20260729.md)
- [`volatility_time_add_rearm_full_path_preflight_v1_development_20260729.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/volatility_time_add_rearm_full_path_preflight_v1_development_20260729.md)
- [`volatility_time_add_rearm_cpp_q90_parity_v1_development_20260729.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/volatility_time_add_rearm_cpp_q90_parity_v1_development_20260729.md)

### 结语

variance time 是漂亮且因果可实现的时钟：它有 two-sided action variation、完整路径与跨语言 parity。正因机制证据如此充分，经济阴性才更有解释力——不是“代码没动”，而是这个更聪明的 elapsed-time measure 没有给主 reward 一个稳定正下界。

![五种 cooldown 与 rearm 动作在 temporal permission frontier 上的结果](/images/narrowgate/temporal-permission-research-synthesis.svg)

*图：动作强度从近似 no-op 一直覆盖到 participation shutdown；中间的 state、recovery 与 variance-time 路径仍没有同时取得支持和正 reward 下界。*

## 8. 合并后的结论：已测试 temporal-permission frontier，没有出现“既有杠杆又有价值”的区域

五个动作排成一条强度轴后，阴性结果具有结构。One-cycle 触达路径太少；stop-until-flat 改得太多并牺牲活动；state/recovery 试图寻找中间区域，却分别败在支持和负 reward；variance-time 最接近完整可执行实验，仍未让 BUY 或 SELL 的主下界越过零。由此关闭的是这组冻结 temporal-permission action subspace，而不是所有 state-to-duration 函数。

Full‑Multiscale Boolean cooldown 是另一条更高维、nested OOF 的状态到时长研究，已经在独立主文中处理。不能因为本篇五个手工/低维动作失败就把 Full‑Multiscale 当成已验证 successor，也不能反过来用 Full‑Multiscale 的点信号重写本篇 consumed panels。
