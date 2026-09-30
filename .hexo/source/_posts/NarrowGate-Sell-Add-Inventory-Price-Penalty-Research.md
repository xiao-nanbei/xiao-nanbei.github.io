---
title: 'NarrowGate Inventory Control：Post-Cooldown Budget、SELL 抑制与 Multi-Short 被动修复'
date: 2026-08-29 13:30:00
updated: 2026-08-30 02:09:00
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

Last materially modified: 2026-08-30

## 1. 少持仓、快修复与赚更多钱是三个不同命题

Post-cooldown inventory budget、SELL-add price penalty 与 multi-short reducing BUY 分别尝试限制新增数量、把风险侧报价移远、以及让减仓报价更积极。三者共同覆盖“抑制进入风险库存”和“加速离开风险库存”两个方向，是同一个 inventory suppression and passive repair 研究子空间。

若 baseline 活动为 $F_0$、candidate 活动为 $F_1$，亏损规模为 $L_0,L_1$，只看亏损下降会把停止交易误写成成功。选择效率至少需要

$$
d_F=1-\frac{F_1}{F_0},\qquad
d_L=1-\frac{L_1}{L_0},\qquad
S_L=d_L-d_F.
$$

同时还要直接比较 assignment-to-terminal value、库存时间、最大库存与 tail。库存代理改善只是机制路径，不是 reward。

## 2. 研究阶段与证据状态

| 阶段 | 它真正问什么 | 结论/权限 |
|---|---|---|
| Post-cooldown budget | 限制后续 exposure fill units 能否形成可用 1/2/3-unit frontier？ | 候选网格退化、动作变化过广、fill 杠杆约 1%；未读 PnL |
| SELL-add price penalty | SHORT 时把 SELL add 外移是否降低尾部且保留价值？ | 库存代理改善，活动下降，reward/tail 未通过 |
| Multi-short reducing BUY | 更积极 maker BUY 能否加快修复并改善终局？ | 修复更快、活动保留；terminal value 与 tail 失败 |

## 3. Post-cooldown budget

### TL;DR：候选网格退化为单点，未读任何 PnL 就关闭

多层 SHORT 库存生命周期 曾承担较多 terminal loss，但“多层库存危险”不自动推出“post-cooldown 限制额外 fill units 有用”。本项目在第一次正常同侧 cooldown release 后，为每条非 flat lineage 设置额外 exposure fill-unit budget $B$；reducing quote 和 hard safety gate 全部保留。SELL 是 primary，BUY 是独立 negative control。

40 日 Development 的 Grade-A unlimited control 显示，SELL 1,753 条支持 lineages 中超过 1 个额外 unit 的仅 3.31%，超过 2 个仅 0.34%；BUY 为 4.64%/0.22%。whole-unit rounding 与 zero-budget exclusion 后，两侧 candidate grid 都只剩 $\{1\}$，未达到预注册的至少两个非零候选。因此根本不存在可以比较的 1/2/3-unit frontier。

完整 $B=1$ 路径又揭示第二个问题：Grade-A SELL 1,659 episodes 中 final quote action change 86.14%，但 fill retention 98.89%、activity retention 98.05%。它广泛改变报单，却只删掉约 1.1% fills，同时超过冻结的 50% action-change 上限。结论是 mechanics lever 不合格，不是 PnL 阴性。项目没有读取 reward、PnL、markout、Validation 或 holdout，也没有创建 randomized action identity。

![Post-cooldown inventory budget 的订单与成交漏斗](/images/narrowgate/post-cooldown-inventory-budget.svg)

*图 1：机制示意。$B=1$ 会阻断许多后续提交/替换，但绝大多数被阻断尝试本来不会成为第二个 fill unit，因而 order-layer 变化没有传到 inventory-layer。*

![Inventory-budget action 的因果传导路径](/images/narrowgate/f09-inventory_lifecycle-action-causal-path.svg)

*图 2：预算在正常 release 后进入状态递归。order mechanics 可以大幅变化，只有真正删掉 additional fill units 才改变库存；经济结果在这两道 mechanics 门通过前保持关闭。*

### 1. 研究问题：限制“还能加多少”而不是“还要等多久”

cooldown rearm 研究改变释放时间；这里改变的是释放后的累计 inventory budget。第一次正常 release 后，control 的额外 exposure-increasing fills 不设上限，candidate 最多再允许 $B$ 个 whole fill units。若 budget 用尽，后续同侧 exposure adds 被阻断，直到 lineage 由 opposite-side fill、flat/reset 或 day censor 结束。

可行性问题不是 $E[Y(B)-Y(\infty)]$，因为本阶段不读 $Y$。它先问两个 outcome-blind 条件：

$$
|\mathcal B_s|\ge2,\qquad
\mathcal B_s=\{B\in\mathbb N^+:B\text{ 在 control distribution 中有支持}\},
$$

以及候选是否具有适度而非极端的 action leverage。只有存在多个有支持预算，才有资格冻结 randomized economic experiment。

### 2. 动作、输入与机制 estimands

| 元素 | 冻结定义 |
|---|---|
| Entry | non-flat 库存生命周期 第一次正常 same-side cooldown release |
| Control | unlimited additional exposure fill units |
| Candidate | whole-unit budget $B$，用尽后阻断 exposure adds |
| Primary side | SELL；BUY 为 negative control |
| 保持不变 | reducing、size、hard limits、queue、P3、latency |
| q90 | control/candidate 均 disabled，故只代表 q90-OFF reference |
| 本阶段可读 | support、quote action change、fill/activity retention、contract parity |
| 禁止读取 | reward、PnL、markout 与锁定 panels |

对 episode $e$ 定义额外 fill units：

$$
U_e=\sum_{j\in e,\ post-release}\text{fill\_units}_j.
$$

候选只允许前 $B$ 个 exposure units。机制杠杆分别从 order 与 fill 层测量：

$$
L_{order}=P(A^{B}_t\ne A^{\infty}_t),\qquad
\rho_{fill}=\frac{N_{fill}^{B}}{N_{fill}^{\infty}}.
$$

高 $L_{order}$、$\rho_{fill}\approx1$ 表示大量报单路径变化没有变成实际库存差异。

### 3. 因果时钟与一个具体例子

budget 只在 baseline cooldown 已真实释放后开始。fill event 必须先经过 exchange sequence、order activation 与 queue depletion 才消耗 unit；submitted quote 本身不消耗预算。opposite-side reducing fill 仍按 frozen lineage semantics 处理，不能把一次 cancel 或 quote replacement 当作 fill unit。

例子：SHORT 库存生命周期 在 release 后 budget $B=1$。第一笔 SELL add 成交，budget 归零。之后 baseline 在五个 cycle 继续提交或替换 SELL quotes，candidate 全部阻断；但若这五笔 baseline orders 都没有触价，最终两臂 fill count 完全相同。此时 action change 可接近 100%，inventory path 却相同。若 baseline 只有第六笔成交，$B=1$ 才少一个 fill unit。

这解释了为什么 order-layer parity 通过仍不代表有足够 economic lever，也解释了为什么不能用“阻断了 86% decisions”夸大动作强度。

### 4. 冻结面板与数据身份

Development 是 exact 40 UTC days，primary 为 24 个 Grade-A days，16 个 Grade-B days 仅做 sensitivity，不进入 primary gate。queue/path 使用 native snapshot/delta full-path Python replay；37 个 contract tests 通过，budget conservation failure 与 one-order overshoot 都为零。

q90 evaluations/actions 在所有路径均为零；infinity-budget 与 disabled-budget equivalence 在冻结 Grade-A check days 及 Grade-B sensitivity day 通过。因此本文只拥有 q90-OFF mechanics authority，不能说等价于当前含 q90 生命周期的 baseline。

原始来源区分 exact native-sequence 与 provider-normalized 数据。后者可以做 causal features、training 或 sensitivity，却没有 Binance native sequence identity，不能静默混入 exact-queue action gate。40 日是本 F09 identity 的冻结 denominator，不宣称是项目所有可用日期的最大集合。

### 5. Unlimited control 的填充单位分布

Grade-A outcome-blind distribution：

| Side | supported lineages | p25 | p50 | p75 | p90 | $U>1$ | $U>2$ |
|---|---:|---:|---:|---:|---:|---:|---:|
| BUY | 1,811 | 0 | 0 | 1 | 1 | 4.64% | 0.22% |
| SELL | 1,753 | 0 | 0 | 1 | 1 | 3.31% | 0.34% |

至少一半 lineages 在 release 后没有任何额外 fill，p90 也只有 1。按冻结 whole-unit rounding 与排除 $B=0$ 后：

$$
\mathcal B_{BUY}=\mathcal B_{SELL}=\{1\}.
$$

预注册要求至少两个 distinct nonzero candidates，因此 grid-resolution gate 立即失败。不能看到退化后临时加入 fractional unit、notional budget 或 $B=0$；那些会改变动作经济含义。

#### 5.1 为什么候选网格必须由 control distribution outcome-blind 地决定

预算 $B$ 只有在 control 经常超过它时才可能产生 treatment。若 $U_e\le1$ 对绝大多数 lineage，$B=2$ 与 unlimited 几乎完全相同；把它列入候选只会制造 nominal arm，没有 action contrast。

冻结 grid 的目标是找到至少两个非零、不同强度、具有支持的预算，从而研究 value 随 control surface 的变化。这里 p90 也只有 1，因此 2/3-unit 候选缺少 exposure。数学上：

$$
\Pr(A^{B}\ne A^{\infty})\le\Pr(U>B).
$$

当右侧约为千分之几，任何经济估计都会由极少 lineage 支配。

$B=0$ 虽能提高 leverage，却变成“release 后仍不允许任何额外 fill”，与 stop-add permission 更接近；fractional unit 需要改变 order-size/fill accounting；notional budget又引入价格量纲。它们不是原 whole-unit grid 的无害补点。

#### 5.2 中位数为零揭示了 control surface 的位置错误

至少一半 lineages 在正常 cooldown release 后没有额外 exposure fill。也就是说真正造成多层库存的决策往往发生在 release 之前、opener、连续 fill multiplier 或其它 lifecycle surface，而不是“release 后还能填几 unit”。

这不证明 multi-level inventory无风险；它说明本 action 把控制杆装在结果已经很少变化的位置。一个相关风险现象能否被干预，取决于动作位置是否位于因果路径上游。F10 的 loss attribution只是告诉我们哪里亏，不能替 F09 证明在哪个节点可控。

### 6. $B=1$ 完整路径：第二个独立关闭理由

尽管 grid 已失败，冻结合同允许把唯一 $B=1$ 路径跑完，检查它到底在 order 和 fill 层有多大作用：

| Panel | Side | Episodes | final quote action change | fill retention | activity retention |
|---|---|---:|---:|---:|---:|
| Grade A | BUY | 1,745 | 86.36% | 98.98% | 97.07% |
| Grade A | SELL | 1,659 | 86.14% | 98.89% | 98.05% |
| Grade B | BUY | 1,238 | 86.51% | 98.19% | 97.10% |
| Grade B | SELL | 973 | 87.46% | 98.73% | 97.67% |

unsupported mass 为零，但 mechanics pass 为 false：action-change 超过冻结 50% 最大值，同时 SELL fill 仅下降约 1.1%。它不是 order no-op，而是 fill-path poor lever。反复 future add attempts 很多，真正成为 additional fills 的很少。

#### 6.1 为什么“动作太广、经济太弱”是一个独立失败类型

86% quote-action change 表示 candidate 会在大量 cycles 与 baseline 不同，增加实现复杂度、日志量与潜在 no-quote gap；98.9% fill retention 又表明库存路径几乎不变。动作承担了广泛执行扰动，却没有相应 treatment strength。

这和 one-cycle skip 的问题相反但相关：one-cycle只改变一次 quote，fill leverage低；$B=1$ 持续改变许多 quotes，fill leverage仍低。两者都说明 submitted-order count 不是经济 exposure 的好代理。

#### 6.2 一个手工可复核的 episode

设 release 后 baseline 连续提交十次 SELL add，只有第一次成交，余下九次被 cancel/reprice 且最终 no-fill。$B=1$ 在第一次 fill 后阻断九次，因此 action-change rate按 decision 接近 90%，但与 unlimited 有相同的一笔额外 fill、相同最大 inventory。这个 episode 对 inventory treatment为零。

只有 baseline 在后九次中又成交时，预算才删掉 marginal unit。control distribution显示这类 episode只占很小比例。完整 path 必须以 fill unit conservation 核对，不能用“阻断九笔订单”声称减少九份库存风险。

### 7. 结果与不确定性：为什么此处没有 PnL 表

这是一项 feasibility study，estimand 是支持分辨率与机制传导，不是 value。没有 PnL 数字正是正确结果：当 candidate grid 退化且动作传导失衡时，打开经济 outcomes 只会消费证据、诱导 post-hoc budget 设计。

3.31% 是 frozen Grade-A distribution 的描述，不是“多层 SHORT 无风险”。此前 attribution 说明 multi-level 库存生命周期 与 loss 相关；本实验只说明 post-cooldown release surface 上的 whole-unit budget 无法形成可辨识 1/2/3 frontier。风险关联与动作可行性是两件事。

Grade-B sensitivity 方向一致，提高了 mechanics 结论的稳健性，却不能替代 primary 或授权 pooling。provider-normalized 日也不能补 exact-queue resolution，因为它们缺少相同 sequence contract。

#### 7.1 不读 outcome 本身是一项可验证结果

研究注册在 mechanics gates 失败时将 `economic_outcomes_read=false`。因此关闭不依赖某个看起来不佳的 PnL，也没有机会在看到 reward 后发明 fractional budget。第三方可以通过报告中的 grid、distribution 与 action/fill rates复核停止条件。

这类 outcome-blind closure 比“跑完发现不赚钱”更节省证据。Development 仍被用于 action mechanics，因此不能无限重新设计同一 surface；但未读 PnL 避免把具体 value pattern 带入 successor。

#### 7.2 一个合法 successor 应改变什么

可能的新杠杆包括从 库存生命周期 起点限制 cumulative notional、按价格连续惩罚 SELL add、或对 reducing BUY 加强修复。这些动作分别改变数量、价格或退出机制，必须重建单位、assignment 与 terminal contract。

successor 不能只把 whole-unit $B=1$ 改名为“风险预算”，也不能把 provider-normalized 更多日期混进 exact queue denominator。先在新的 untreated census 上证明至少两个有支持强度，再注册 economics，才不会重复本项目的退化网格。

#### 7.3 Mechanics closure 与经济阴性有什么不同

这里没有证据说 $B=1$ 的 reward 为正、负或零；这些字段从未读取。能说的是 action surface 缺少多候选分辨率，唯一候选又在 order 与 fill 层之间严重失配。把“未建立可评估动作”写成“回测亏损”同样不准确。

这种区分会影响未来设计：经济阴性要求新 evidence 或新 lever；mechanics closure则先要求把 lever 放到真正能改变 fill/inventory 的上游位置。二者都没有 action 权限，但失败原因不同。

### 8. 研究演进与关闭边界

v1 设计、v1.1 spec、execution errata 与 v1.2 Development 都属于一个 research identity。errata 修复执行合同，没有改变 sample、action、estimand 或统计 gate，因此不拆成文章。

关闭的是 q90-OFF、post-cooldown、whole incremental fill-unit budget。它不关闭 cumulative notional limit、库存生命周期-level permission、price penalty 或 current-live q90-aware action。任何 successor 都必须先定义新经济杠杆和独立 denominator，不能在未读 outcomes 的名义下对已见 distribution 继续搜索 $B$。

### 9. 没有获得的权限

- 没有读取 reward、PnL、markout、Validation 或 sealed holdout；
- 没有创建 randomized action identity；
- 没有 shadow、action、live 或 baseline 变更权限；
- 没有 q90-ON 等价性；
- 没有把 provider-normalized days 当 exact native queue evidence；
- 没有从 historical loss attribution 推出因果动作价值。

### 为什么 control distribution 是动作设计的一部分

inventory budget $B$限制cooldown后还能增加多少个fill units。若control path在大多数eligible episodes本来就不会产生额外add，任何$B\ge1$都与unlimited几乎相同；候选网格在机制上退化。此时先看PnL再挑$B$，只是在噪声中搜索。

outcome-blind设计先估计control的潜在使用量$U_c$分布，再选能产生不同截断率的预算：

$$
A_c(B)=\min(U_c,B).
$$

候选之间真正的action distance取决于$P(U_c>B)$，不是$B$数值看起来相差多大。中位数为零说明大部分episodes位于错误control surface，研究应停止或重新定义eligible event。

### Mechanics closure 与 null economics 的区别

若grid退化，结论是estimand没有足够variation，尚未检验经济价值；若$B=1$确实大范围改变action，但路径收益几乎没有改善，则是动作杠杆存在、经济机制弱。两种失败需要不同后继：前者找更接近add机会的decision surface，后者则要改变budget所控制的对象或价值假说。

文章没有PnL表，是因为冻结协议在outcome-blind门失败后不允许打开结果。这个缺失本身可审计：报告应给control distribution、候选唯一数、action-change率与stop reason，而不是留下一句“数据不足”。治理上的价值是防止研究者利用已经无力识别的grid继续制造冠军。

### 一个可识别的 successor 应怎样设计

可以把预算挂在first-add后真实拥有后续add机会的库存生命周期上，并用remaining inventory capacity或exposure-time定义单位；在读outcome前要求多个$B$产生预注册范围内的差异，同时保留足够baseline activity。若自然路径仍稀疏，可以使用已知propensity的随机budget assignment，而不是依靠观察性小样本。

successor还要明确budget到期/重置：按库存生命周期 flat、固定时间、recovery event还是daily reset。重置规则改变dynamic treatment，不能作为实现细节。只有这些mechanics闭合，terminal 库存生命周期 value与tail才具有解释意义。

### Partial identification 比强行给 PnL 更准确

当候选grid在绝大多数episodes与control相同，数据只能识别“在极少数被截断路径上的可能效应”，无法稳定识别目标策略总体价值。此时可以报告action-rate上界和由单episode最大损失给出的宽bounds，但不应输出一个伪精确均值。

若$M$个库存生命周期中只有$m$个可能分叉，且单个terminal effect有保守范围$[L,U]$，总体日效应只能落在相应缩放区间；当$m$很小，bounds通常跨过所有有意义方向。它定量说明为什么停止是理性的。

### Grid degeneracy 的自动化 gate

preflight可要求每个相邻budget pair至少有预定action-distance、足够distinct days和retention范围；重复mechanics的候选自动合并。只有唯一arms达到最低数量，才生成outcome manifest。

这种gate应与reward文件物理分离，保证研究者无法在决定grid时看到PnL。它把“没读结果”从口头承诺变成可审计执行顺序。

### 10. 公共证据

- [`post_cooldown_incremental_inventory_budget_feasibility_v1_2_development_20260801.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/docs/post_cooldown_incremental_inventory_budget_feasibility_v1_2_development_20260801.md)
- [`post_cooldown_incremental_inventory_budget_feasibility_v1_design.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/docs/post_cooldown_incremental_inventory_budget_feasibility_v1_design.md)
- [`F09 README`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/README.md)

### 结语

这项研究在最应该停止的地方停止：预算网格没有分辨率，$B=1$ 又只在 order layer 广泛变化。没有打开 PnL，不是缺少结果；它正是 outcome discipline 的结果——先证明动作能以合适强度传到 fill，再谈价值。

## 4. SELL-add price penalty

### TL;DR：库存风险变小了，但 candidate 更像压低参与，而不是挑出坏 fills

本研究在 库存生命周期 已经 SHORT 时，只把 exposure-increasing SELL ask 向外移动；惩罚随 short units 增大：一单位 0.5 bps、两单位 1.0 bps、三单位及以上 1.5 bps。flat opener、reducing BUY、size、inventory limit、cooldown 与其他 blockers 都不动。库存生命周期 在第一条 final-eligible SELL-add 路径生成前以 0.5/0.5 随机化一次。

40 日 Development 有 2,371 个 assignments、40,200 total fills；Grade-A primary 24 日中 candidate 对所有 assigned 库存生命周期 都改变最终动作，但 SELL-add fill retention 仅 60.98%，activity retention 73.74%，分别低于 90% 和 75% 门。assignment-to-terminal reward uplift 为 -0.001339 USDC，95% UTC-day interval $[-0.011489,+0.009242]$，正日 12/24；full-policy value 也是负点估计。

candidate 的确减少 max inventory、inventory time 与 库存生命周期 MAE，descriptive q10/CVaR 也改善；可是 randomized multi-level loss protection 没有正下界，剩余 multi-level paths 反而更 adverse。结论是 `risk_control_evidence_only`：这条固定 price curve 有机械效力，却未识别正价值。Validation 与 sealed holdout 未读。

![SELL inventory price penalty 的 K 线报价机制](/images/narrowgate/sell-inventory-price-penalty-kline.svg)

*图 1：机制示意。库存越 short，candidate ask 越向外移；减少的 fills 同时包含 toxic fills 与本可盈利的 maker participation，所以必须追踪到 库存生命周期 terminal。*

![库存价格动作从报价到终局的完整路径](/images/narrowgate/f09-inventory_lifecycle-action-causal-path.svg)

*图 2：price penalty 每次都改变 quote，不代表它选择性删除坏 fills。报价外移经过 activation、queue 和 fill 后改变库存，最后必须同时通过 participation、tail 与 terminal value。*

### 1. 研究问题：用价格而不是 permission 控制加空

stop-until-flat 直接关闭后续 SELL adds，过于粗暴；whole-unit budget 又缺少 fill frontier。价格惩罚提供连续但冻结的经济杠杆：保留报价，只让进一步加空需要更高补偿。

令 inventory $q<0$、每单位 0.001 BTC，则：

$$
n_{short}=\max(0,-q/0.001),
$$

$$
\Delta_{SELL-add}=\min(1.5,0.5n_{short})\ \mathrm{bps}.
$$

candidate quote 以 baseline ask 为起点向外移动相应 basis points，并经过 tick rounding、GTX 与 pair-spread cap。0.5 bps 是此前 observational short-horizon loss scale 附近的经济锚，不是搜索出的 causal optimum；没有 penalty grid。

### 2. 输入、动作与 estimand

| 状态 | Control | Candidate |
|---|---|---|
| flat opener | baseline | baseline |
| SHORT 1 unit | baseline SELL add | ask 外移 0.5 bps |
| SHORT 2 units | baseline SELL add | ask 外移 1.0 bps |
| SHORT ≥3 units | baseline SELL add | ask 外移 1.5 bps |
| reducing BUY | baseline | baseline |

assignment unit 是 库存生命周期，propensity 恰为 0.5。主要 estimand 为：

$$
\tau=E[V_{terminal}(A=1)-V_{decision}(A=1)]-E[V_{terminal}(A=0)-V_{decision}(A=0)].
$$

完整路径重放 quote、cancel/ACK、activation、queue、fill、inventory、cooldown 与 terminal。不能把 candidate 少成交的 baseline toxic fills 全部算作 avoided loss，因为少成交也会失去良性 fills、改变修复时间与后续订单。

### 3. 因果时钟与订单例子

randomization 在第一笔 final-eligible SELL add 路径生成之前，且同一 库存生命周期 assignment 固定。inventory、book、P3 与 blockers 必须在 decision-ready 时可见；outward price 产生新 activation 与 queue，不能继承 baseline queue position。

例子：inventory 为 $-0.002$ BTC，baseline ask 100,000.0，candidate penalty 1.0 bps，理论上约移到 100,010.0，再按 tick/cap 得到有效 maker quote。若 aggressive BUY 只打到 100,005，baseline 可能成交而 candidate 不成交。若之后价格回落，baseline fill 可能贡献 repair；若继续上涨，它扩大 short loss。estimand 是两条 库存生命周期 终局之差，而不是执行价差本身。

BUY q90 在两臂都关闭，所以这是 q90-OFF randomized reference，不能称为当前 live baseline 等价。full C++ tick replay authority 也为 false，Python native snapshot/delta full path 是权威路径。

#### 3.1 bps penalty 如何变成交易所可执行 tick

理论价格移动为：

$$
\Delta p=p^{base}\frac{\Delta_{bps}}{10^4}.
$$

随后必须按 SELL maker 方向向合法 tick 取整，并满足 GTX 与 pair-spread cap。因 BTC 价格水平不同，同样 0.5 bps 对应的绝对价格和 tick 数会变化；所以研究同时记录 requested bps、rounded tick move 与 realized/requested ratio。

101.46% 的 realized ratio 并不表示 candidate 神奇地多执行 1.46% 经济强度，而主要来自离散 tick rounding。cap truncation 为零、action-change 100%，共同证明曲线没有被执行约束吞掉。它们仍只属于 mechanics。

#### 3.2 为什么固定曲线而不是扫描 penalty grid

若同时测试 0.1、0.25、0.5、1.0、2.0 bps 与多个 cap，再挑 terminal PnL最佳值，库存单位与日期噪声会制造一个 winner。这里 0.5 bps/unit 与 1.5 bps cap 在 outcome 前冻结，故只回答一条曲线。

代价是阴性后不能声称“可能 0.25 bps 就通过”并在同一 Development 重跑。那个猜想没有被本文反驳，也没有证据支持；若经济杠杆真不同，应在新分母上注册，而不是把 consumed panel变成超参数搜索集。

### 4. 证据合同与支持

Development 固定 40 UTC days：24 Grade A 进入 primary scorecard，16 Grade B 仅 sensitivity。共有 2,371 assignments，control/candidate 1,181/1,190，propensity 0.5；40,200 replay fills。source gaps、invalid sequences、sync censor、q90 evaluations 与 unsupported mass 都为零；64 个 frozen contract tests 通过。

Grade-A candidate assignment rate 48.90%，actual final-action change 100%，其 95% interval 也是 [100%,100%]。realized/requested penalty 101.46%，cap truncation 0，说明动作既没有被 tick rounding 吃掉，也没有被 spread cap 剪平。

但 SELL-add fill retention 60.98%，activity retention 73.74%。动作保留了报价形式，却移除了约 39% SELL-add fills、约 26% aggregate activity；这是经济上很强的 participation change。

### 5. Grade-A primary 结果

| Metric | Result | Frozen gate | 结论 |
|---|---:|---:|---|
| final-action change | 100.00% | LCB >5% | pass |
| SELL-add fill retention | 60.98% | ≥90% | fail |
| activity retention | 73.74% | ≥75% | fail |
| terminal reward uplift | -0.001339 [-0.011489,+0.009242] | LCB >0 | fail |
| reward-positive days | 12/24 = 50% | ≥55% | fail |
| full-policy value, USDC/day | -0.1401 [-0.8029,+0.4990] | LCB >0 | fail |
| multi-level loss protection | -0.000351 [-0.010248,+0.010289] | LCB >0 | fail |
| max-inventory avoidance | +0.000184 [+0.000121,+0.000247] BTC | LCB ≥0 | pass |
| inventory-time avoidance | +0.1758 [+0.1013,+0.2612] BTC·s | diagnostic | positive |
| 库存生命周期-MAE avoidance | +0.013006 [+0.001395,+0.025091] | LCB ≥0 | pass |

risk reduction 是真实的：进入 multi-level SHORT 的比例从 control 45.51% 降至 candidate 36.28%。但 remaining candidate multi-level paths 更 adverse，随机化 multi-level-loss contrast 没有改善。risk control 与 selection alpha 不能混写。

descriptive q10 从 -0.13235 改善到 -0.10475，CVaR10 从 -0.31089 到 -0.26616；预注册 day-cluster tail lower bounds 仍跨零，mean reward 又下降，因此这两个 arm-level 描述不能救援动作。

#### 5.1 Participation suppression 与 selection 的可检验区别

如果 price penalty 对好坏 fills 一视同仁，fill 数大致按触达概率下降，库存 exposure 与 MAE自然变小；这叫 participation suppression。selection 则要求被删除 fills 的平均 counterfactual value 足够负，使 terminal reward改善得比 activity下降更快。

可用一个边际分解理解：

$$
\Delta V
=
V_{shared\ fills}^{price}
-V_{control-only\ fills}^{lost}
+V_{path\ feedback}.
$$

candidate 减少约 39% SELL-add fills，说明第二项规模很大。若这些 control-only fills 真以 toxic 为主，multi-level loss protection与 terminal reward应有正下界；结果没有。库存 proxy改善只能证明 fills 被删除，不能证明删对了谁。

#### 5.2 为什么 remaining multi-level subgroup 不能做因果解释

candidate 会改变谁进入 multi-level SHORT，所以“candidate 下仍 multi-level 的 库存生命周期”与“control 下 multi-level 的 库存生命周期”不是同一前置人群。条件于 treatment 后的 inventory state，可能打开 selection path：

$$
A\rightarrow MultiLevel\leftarrow MarketPath.
$$

在这个 collider 上比较 terminal value，会让更极端的 market paths集中到 candidate remaining subgroup。研究因此只把“剩余路径更 adverse”作为机制诊断，主结论仍来自 assignment-level随机对比。

#### 5.3 Risk budget 通过、value budget 失败意味着什么

max inventory、inventory-time 和 MAE 的正下界说明 candidate 是有效风险控制器；reward、positive days、full-policy value 与 loss protection失败说明它没有成为价值改进器。两个结论可同时成立。

如果生产目标明确愿意为更低库存支付可量化成本，那应另行注册带风险偏好的效用：

$$
U=E[PnL]-\lambda_1 E[|q|dt]-\lambda_2 CVaR.
$$

本文没有预注册这些 $\lambda$，所以不能在看到负 PnL 后用“风险更小”隐式改变目标函数。

### 6. Grade-B 与不确定性

Grade B 只检验方向稳健性，不能 pooled rescue。其 reward uplift -0.002904，interval $[-0.011452,+0.005987]$；正日 7/16，fill retention 59.79%，activity 74.83%，full-policy value -0.2225 USDC/day。方向与 primary 一致。

不确定性按 UTC day 聚类，而非把 2,371 库存生命周期 当独立 regime。24 日里仅一半为正，说明 market-day variation 不是小噪声。与此同时 retention failure 是大效应，不依赖某个细小 PnL interval。

### 7. 研究演进与关闭边界

spec、随机化 runner、post-run audit 与 scorecard 都属于这一个 fixed curve identity。grade-B sensitivity 也不是新项目。动作结果之后不能用 post-treatment “剩余 multi-level paths”重新定义 eligibility，否则会把 treatment 改变后的 subgroup 当作因果前置状态。

关闭的是 q90-OFF 的 0.5/1.0/1.5 bps curve。它不证明所有 inventory-conditioned price 无效，也不覆盖更 aggressive reducing BUY；后者有不同 role、fee/queue 机制，必须单独注册。不能在本 Development 上把 step 降为 0.25、搜索 cap 或联合 reducing action。

### 8. 没有获得的权限

- Validation 与 sealed holdout 未读；
- 没有 action、shadow、live 或 full C++ tick authority；
- 没有把 q90-OFF 结果称为当前 live 等价；
- 没有搜索 penalty grid、调 step/cap 或基于 post-treatment subgroup 选 policy；
- 没有把 positive inventory diagnostics 写成 terminal alpha。

### Participation suppression 与 selection improvement 的可分解形式

价格penalty使部分订单不再激活或成交，也改变仍成交订单的组成。总效果可以示意分解为

$$
\Delta V
=
\underbrace{\Delta N\cdot \bar V_0}_{participation}
+
\underbrace{N_1(\bar V_1-\bar V_0)}_{selection}
+
\underbrace{\Delta V_{path}}_{inventory/queue\ feedback}.
$$

观察到fills下降、inventory tail改善，不能判断第二项为正；remaining filled subgroup是动作后的选择结果，与baseline fills不在同一可交换总体。必须用paired opportunities或随机assignment比较“同一decision在penalty下是否改变及其全路径结果”。

### Penalty 的单位与非线性执行边界

bps penalty先按价格转换为绝对距离，再向合法maker tick取整。若原报价已受minimum spread、post-only或inventory cap约束，一个小penalty可能完全no-op；跨过一个tick后又突然改变queue level。作用函数是阶梯状而非连续线性：

$$
p'_{sell}=\operatorname{ceil}_{tick}\{p_{sell}(1+b/10^4)\}.
$$

因此不能从一个固定$b$的结果外推“半个penalty会有一半效果”。grid搜索又会引入multiplicity；合理的后继要么预注册少量经济可解释档位，要么先用outcome-blind action-distance选择档位，再锁定economics。

### 风险预算通过、价值预算失败应怎样决策

如果业务目标明确愿意用某个mean成本换取tail下降，应该事先定义utility或hard constraints。例如要求CVaR改善至少$c$、fills retention不低于$r$，再在可行候选中检验mean。看到结果后才说“少赚一点换安全”会让任何负PnL候选都可被解释成风险策略。

当前合同要求价值与风险联合通过；候选主要靠降低参与减少库存，terminal uplift未成立，所以不能晋级。它留下的工程结论是price channel确实能控制SELL adds；留下的研究结论是当前固定曲线没有证明选择性价值。

### Price control 与 permission control 的差别

price penalty仍允许订单存在，只降低激活/成交概率；skip/stop-add直接删除机会。前者保留极端market move时的fill，后者完全没有该订单。它们的tail与participation不能按一个连续“强度”轴简单排序。

价格动作还可能在tick rounding后no-op，而permission永远改变submit。比较两者时应匹配最终action leverage，不是匹配名义bps和skip duration。否则看似penalty温和，只是多数rows没有跨tick。

### Paired daily path 的分解

在同一日两arms从相同initial state开始，第一次candidate-only或baseline-only fill后inventory分叉。之后不能继续强行逐订单匹配；应保留day-levelterminal contrast，并用first divergence时间、side与role解释机制。

对分叉前rows可以报告exact quote differences；分叉后只比较aggregate path measures。这样既利用paired设计降低共同shock，又不制造不存在的same-库存生命周期对应。

### 一个新 penalty 研究需要怎样的独立理由

在已读40日上缩小bps、改变曲线或只选某inventory level，都是当前family内搜索。新候选应由外部风险预算、理论单位或新机制证据确定，并在新chronological panel测试。

若目标从value改为hard inventory cap，也要预先重写scorecard；不能沿用本篇value失败后事后切换目标。权限跟随问题定义，而不是跟随实现复用。

### 9. 公共证据

- [`sell_add_inventory_price_penalty_randomized_replay_v1_development_20260801.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/docs/sell_add_inventory_price_penalty_randomized_replay_v1_development_20260801.md)
- [`post_cooldown_incremental_inventory_budget_feasibility_v1_2_development_20260801.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/docs/post_cooldown_incremental_inventory_budget_feasibility_v1_2_development_20260801.md)
- [`F09 README`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/README.md)

### 结语

向外移动报价比彻底停挂更细腻，却仍可能主要靠少成交来降低风险。这里动作有力、库存指标变好，但 value 与 retention 都不过门。最诚实的结论是风险控制证据，而不是把一个负 reward 点估计包装成“更安全的 alpha”。

## 5. Multi-short reducing BUY

### TL;DR：repair 快 84.82 秒、库存时间下降，但 PnL 与左尾没有改善

SELL price penalty 试图少增加 SHORT；本项目换到另一条经济杠杆：当 inventory 首次达到 $\le-0.002$ BTC 时，以 50% 概率保持 reducing BUY 基线，以 50% 概率把 reducing BUY 持续放在最激进的合法 maker 价，直到 inventory 恢复到 $\ge-0.001$ BTC。动作始终 GTX maker-only，不生成 IOC/taker；exposure SELL、opener、cooldown 与 limits 均不变。

Grade-A 24 日有 627 个 assignments，final-action change 99.37%；total fill retention 103.00%，reducing-BUY fill ratio 102.23%，SELL-exposure fill retention 105.05%，所以不是 no-op 或 participation shutdown。candidate 确实令 inventory-time avoidance +0.277339 BTC·s，95% lower bound +0.100789；repair-time avoidance +84.82 秒，lower bound +18.54 秒。

但 assignment-to-terminal reward uplift 为 -0.004435 USDC，95% interval $[-0.030210,+0.021736]$，正日率 45.83%；candidate q10/CVaR10 还略差。更快修复没有运输成更好 terminal value。Development 关闭，Validation 与 sealed holdout 未读。

![Multi-short reducing BUY aggressive maker 机制](/images/narrowgate/multi-short-reducing-buy-kline.svg)

*图 1：机制示意。candidate 在 multi-short 区间将 reducing BUY 推到最激进 maker tick；它能更快获得修复 fills，但更激进的被动价格也会牺牲 spread/selection value。*

![被动修复动作从触发到 terminal 的完整路径](/images/narrowgate/f09-inventory_lifecycle-action-causal-path.svg)

*图 2：更积极的 reducing BUY 同时改变 execution price、queue、repair speed 与后续 inventory。repair-time 是中介变量；assignment-to-terminal reward 才是随机化总效应。*

### 1. 研究问题：修复速度本身值多少钱？

multi-level SHORT 库存生命周期 的损失归因提示库存持有时间可能重要。减少 exposure-add fills 会同时缩小业务；更积极的 reducing BUY 则保持 SELL exposure surface，不直接阻断新 库存生命周期。问题是：缩短 SHORT duration 的收益，能否覆盖更激进报价带来的价格与 selection 成本？

在首个 $q\le-0.002$ BTC transition 处随机化，estimand 为：

$$
\tau=E[Y(\text{aggressive maker repair})-Y(\text{baseline reducing BUY})],
$$

$Y$ 从 assignment 计到 库存生命周期 terminal。repair time、inventory time、MAE、q10 与 CVaR 是 co-primary/consistency gates，不能取代 terminal reward。

### 2. 动作合同与关键价格公式

candidate reducing BUY price 为：

$$
p^{cand}_{BUY}=\min(ask_1-tick,\max(p^{base}_{BUY},bid_1)).
$$

它至少不比 baseline 消极，又不能跨到 ask 成为 taker。release 条件为 $q\ge-0.001$ BTC。合同如下：

| 元素 | Control | Candidate |
|---|---|---|
| Trigger | 首次 $q\le-0.002$ | 同左，库存生命周期-level 0.5/0.5 |
| Reducing BUY | 当前基线逻辑 | 最激进合法 maker price |
| Release | 库存生命周期 baseline | $q\ge-0.001$ |
| Exposure SELL | baseline | baseline |
| Order type | GTX maker | GTX maker；无 IOC/taker |
| q90 | OFF | OFF |

第一版实现用 floating price arithmetic，可能产生 invalid maker tick，在读取 outcome 前失败。v1.1 改为 integer tick arithmetic，保留同一 frozen action。这是工程修复章节，不是新研究项目，也没有给动作第二次 outcome chance。

#### 2.1 “最激进合法 maker”不是无限接近中价

BUY GTX 的最高合法价格必须低于当时 ask，通常最多到 $ask_1-tick$，同时不低于 baseline 与 bid。若 spread 只有一 tick，$ask_1-tick=bid_1$；若更宽，candidate 可站到 bid 或改善一档。tick arithmetic确保报价落在交易所网格上：

$$
k^{cand}=\min(k_{ask}-1,\max(k^{base},k_{bid})),\qquad p=k\cdot tick.
$$

这避免浮点 99,999.90000000001 在比较时意外跨价。修复发生在 outcome 前，故可保留同一 action identity；如果已读过 PnL 后才改 rounding，旧/new mechanics会对应不同 treatment，不能合并。

#### 2.2 更快成交付出的三类价格

candidate 可能付出：更差的直接 execution edge、更高的 adverse-selection probability、以及 queue reset/reprice成本；得到的是更早降低 short inventory 和可能更短 库存生命周期。粗略价值平衡为：

$$
\Delta V
=
V_{inventory\ relief}
-C_{price\ concession}
-C_{selection}
-C_{path}.
$$

maker-only 只保证不支付 taker fee、不过 ask，并不让后三项为零。站在 bid 顶部的 BUY 更容易接到继续下跌的 aggressive SELL flow；即使它“修复 short”，也可能在下一刻从 flat 变成不利 LONG 或错过更低价格。

### 3. 因果时钟与 path 例子

assignment 必须发生在 inventory 首次跨过 -0.002 的 ready state，之后固定到 release。candidate quote 的 activation、queue-ahead、cancel/replace、fill 与 inventory 都重新生成。若 baseline 与 candidate price 不同，不能共用 future fill。

例子：bid1/ask1 为 99,999.9/100,000.0，tick 0.1，baseline reducing BUY 为 99,999.7。candidate 取 $\min(99,999.9,\max(99,999.7,99,999.9))=99,999.9$。它更靠近 taker flow，queue/成交概率更高，却也少了 0.2 price units 的 maker edge。若快速 fill 使 inventory 从 -0.002 回到 -0.001，action 释放；后续 库存生命周期 仍走 baseline。

这条路径中 repair-time 改善是 mediator。用它筛选“只有快速修复的 candidate rows”会产生 post-treatment selection；必须先看 randomized terminal contrast。

### 4. 冻结面板与支持

Development 共 40 日：24 Grade A primary、16 Grade B sensitivity，禁止 pooling。Grade A 有 627 assignments，candidate rate 50.88%；action change 99.37%，95% lower bound 98.42%。

total fill retention 103.00%，reducing BUY 102.23%，SELL exposure 105.05%。超过 100% 来自重放路径的后续差异，并非复用 baseline fills。全 40 日 candidate quotes 1,015 条，maker violation、action-generated IOC/taker、effective defense-pause override 均为零。动作效果来自更积极的 maker price，不是频繁绕过 safety pause。

### 5. Primary economics：速度通过，价值失败

| Metric | Estimate | 95% interval / control |
|---|---:|---:|
| reward uplift | -0.004435 USDC/assignment | [-0.030210,+0.021736] |
| positive UTC days | 45.83% | gate 55% |
| policy value | -0.151531 USDC/day | [-0.849884,+0.525528] |
| multi-level loss protection | -0.004435 | [-0.030786,+0.022624] |
| candidate q10 | -0.231140 | control -0.211660 |
| candidate CVaR10 | -0.451453 | control -0.448855 |
| inventory-time avoidance | +0.277339 BTC·s | LCB +0.100789 |
| repair-time avoidance | +84.82 s | LCB +18.54 s |

repair probability uplift +0.00336，但 interval 跨零；max inventory 与 库存生命周期 MAE intervals 也跨零。candidate 实现了直接 mechanics，却没有改善平均终局或左尾。更快并不等于更好，因为 aggressively resting bid 可能更早接住仍在下跌的 flow，或者牺牲原本可获得的 maker edge。

Grade B 同向偏负：reward -0.023007，interval $[-0.062423,+0.024066]$，16 日仅 5 日正。sensitivity 没有救援 primary。

### 6. 如何理解“repair-time 显著、reward 不显著”

总效应可概念分解为：

$$
\Delta Y=\underbrace{\beta_T\Delta T_{repair}}_{\text{少持有库存}}
+\underbrace{\Delta V_{execution}}_{\text{更激进价格}}
+\underbrace{\Delta V_{selection/path}}_{\text{成交对象与后续路径}}.
$$

$\Delta T_{repair}$ 明确改善，不表示后两项为零。实验观察到总效应下界未正，说明当前机制下速度收益不足以稳定覆盖执行与路径代价。不能用中介变量显著性替代随机化总效应。

q10/CVaR 略差也提醒：更早成交的 reducing BUY 可能在急跌中带来新 LONG/flat timing risk；maker-only 虽避免 taker fee，却没有避免 adverse selection。

#### 6.1 中介变量不能替代 total effect

repair time $M$ 位于 $A\rightarrow M\rightarrow Y$ 路径上，同时 market path也影响 $M$ 和 $Y$。在随机化之后按“成功快速 repair”筛 candidate，会破坏随机化：

$$
A\rightarrow M\leftarrow MarketPath\rightarrow Y.
$$

因此 +84.82 秒 avoidance 是有意义的 treatment mechanism，却不能在 repaired subgroup内估 PnL来证明动作。总效应按原 assignment保留所有未修复、censor 与反向路径，才回答策略问题。

#### 6.2 速度的经济价值为什么可能随 regime 变号

在持续上涨中，快速 BUY repair short 可以止损，$V_{inventory\ relief}>0$；在快速下跌中，更慢的 baseline BUY 可能以更低价格成交，等待本身有正 option value；在震荡中，candidate可能早修复、随后又被 opener重新建仓。相同 84 秒平均改善混合了这些 regime。

要提出新的 state-conditioned repair，必须在 assignment 前用 causal feature定义 regime，并在新日期评价。不能按事后 price path 把当前 627 assignments 分成“上涨时有效”与“下跌时无效”，那是在 outcome上选择。

#### 6.3 q10/CVaR 略差为何是重要反例

如果“减少库存时间必然降低尾部风险”，candidate 的 q10/CVaR 应至少不差。结果略差说明 inventory duration不是唯一 tail driver；execution timing与新 inventory sign 也可能贡献左尾。

这并不证明 aggressive repair必然增加 tail，因为区间与样本仍有限；它足以拒绝用 inventory-time单调改善替代 tail gate。风险 proxy 与最终分布必须并列报告。

### 7. 研究演进与关闭边界

v1 invalid tick failure 发生在 outcome access 前；v1.1 只修复整数 tick boundary，action、sample、estimand 和 gates 不变。replay-cache DAG 是运行后实现，也不会 retroactively 改变结果。因此一篇文章足以覆盖设计、失败、修正与正式结果。

关闭的是 trigger $-0.002$、release $-0.001$ 与最激进合法 maker price 的 exact action。不能在同一 Development 上调 trigger、release 或 aggressiveness。bounded IOC emergency repair 会引入 taker fee、ACK/fill race 与全新 safety contract，是不同 research identity，本文没有测试。

#### 7.1 为什么不顺手测试 IOC

IOC 会把 fill probability推近一，却同时改变 maker/taker角色、fee、冲击、partial fill与剩余量处理。其价值式至少多出：

$$
-C_{taker\ fee}-C_{crossing\ spread}-C_{impact}+V_{immediate\ risk\ relief}.
$$

这些项在 maker-only replay中没有被识别。把 IOC 当作“aggressiveness再加一级”会跨越执行制度，而不是普通参数敏感性。若未来确有紧急风险 mandate，需独立安全与经济注册。

#### 7.2 这项研究怎样与 SELL price penalty 共同形成边界

price penalty从入口减少 multi-short，确实压低库存却损失参与；aggressive reducing BUY保留参与并加快修复，却未改善 value/tail。两者共同说明“inventory suppression”和“passive repair”这两个冻结杠杆在当前 Development都没有闭合。

这不是说 inventory不可控，而是不能再用相同面板扫 entry penalty、repair trigger或 maker tick。新 evidence应来自不同决策信息、不同执行制度或独立时期，而不是在两条已读路径之间后验拼一个 hybrid。

### 8. 没有获得的权限

- Validation 与 sealed holdout 未读；
- 没有 action、shadow、live 或 current baseline 变更权限；
- 没有 IOC/taker 结论，也没有 full C++ tick authority；
- 没有把 repair-time 改善当作 terminal PnL 证据；
- 没有调 trigger/release/aggressiveness 或在 post-treatment repaired subgroup 重选。

### Repair time 是 mediator，不是目标本身

候选把reducing BUY挂得更激进后，更快回到flat是动作→结果路径中的中介。若只在“最终修复的库存生命周期”里比较duration，会排除未修复或被新fill改变的路径；若按repair speed选择参数再报告PnL，又形成post-selection。

总效应应直接比较terminal 库存生命周期 value、inventory-time与tail；repair time用来解释机制。一个可能的路径是

$$
A\rightarrow\text{faster fill}\rightarrow\text{shorter inventory}
\rightarrow Y_T,
$$

但另一路径是$A\rightarrow$放弃spread/更差selection$\rightarrow Y_T$。速度通过只证明第一条中间边发生，不说明两条总和为正。

### 最激进合法 maker 的执行含义

BUY reducing quote不能跨ask，否则变成taker；通常上界是best ask减一个tick或由post-only规则给出的合法价格。若best bid/ask跳动，取整顺序会影响是否仍maker；cancel/replace还会重置queue。公式必须在每个decision用当前可见book计算，并记录最终exchange-valid price，而不是把理论连续价直接用于回测。

更激进一tick的价值取决于三项：额外fill probability、失去的spread capture、成交条件价格路径。若订单原本已在best bid且queue很优，提价可能丢掉queue option；若离市场很远，提价一tick又可能没有action leverage。这解释了为何平均repair快84.82秒仍未改善mean或tail。

### q10/CVaR 反例怎样约束“降低库存就是降风险”

inventory duration下降常被当作风险必然下降，但更激进repair可能在最差时点付出高价，集中损失于少数库存生命周期。q10/CVaR略差说明库存时间只是risk proxy，不是完整损失分布。持有更短与亏得更少没有逻辑等价。

未来若专门优化risk-adjusted repair，应预注册utility，例如terminal mean、CVaR与BTC-hours的固定组合，并在新面板检验。不能用本次未通过的PnL结果事后给inventory-time赋一个足以翻正的影子价格。

### No-fill opportunity cost 如何进入结果

更激进BUY若成交，可能更快repair；若baseline本可在更低价成交，candidate提前成交就失去价格改善；若两者都未成交，candidate仍可能因cancel/replace失去queue。只分析successful repairs会遗漏后两类。

one-shot paired replay应从同一decision开始，直到库存生命周期 terminal或统一censor，所有路径都计入$Y_T$。mechanism表再分为candidate-only fill、baseline-only fill、both fill with timing/price difference和neither。这样读者能看到84.82秒缩短来自哪类路径。

### Initial inventory level 改变同一动作的风险

在轻微SHORT时，提高BUY price可能只是较小spread让步；在multi-level深SHORT时，repair urgency更高但size、queue和terminal exposure也不同。把所有levels混合会让少数深库存支配BTC-hours，却在库存生命周期 count中占比很小。

报告应按pre-action$|q|$、库存生命周期 age与remaining horizon分层，但这些分层只能解释预注册总效应；不能在已读结果上选一个好看的level授权动作。新level-specific policy需独立冻结。

### 什么结果才会支持 aggressive repair

至少需要terminal mean下界为正或通过预注册risk utility，q10/CVaR不恶化，inventory-time确实下降且activity/fees可接受。仅repair-time通过不够；仅少数worst 库存生命周期改善也不能覆盖总体成本，除非tail action从一开始就是primary。

当前结果提供了强mechanics、弱/负economics的反例，迫使未来设计把“快”与“值”分开。

### 9. 公共证据

- [`multi_short_reducing_buy_aggression_v1_1_development_20260801.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/docs/multi_short_reducing_buy_aggression_v1_1_development_20260801.md)
- [`multi_short_reducing_buy_aggression_v1_implementation_failure_20260801.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/docs/multi_short_reducing_buy_aggression_v1_implementation_failure_20260801.md)
- [`F09 README`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/README.md)

### 结语

这是一项很典型的机制成功、经济失败：candidate 更快修复、少持有库存，而且没有停止参与；但终局价值与左尾并未改善。maker 策略里“更快回到 flat”不是免费的目标，必须把付出的报价与 selection 代价一起计算。

![库存预算 SELL 抑制与 reducing BUY 三种动作的结果收敛](/images/narrowgate/inventory-control-research-synthesis.svg)

*图：限制进入、放慢加空和加快被动修复分别改善了某些库存代理，但没有一项把代理改善闭合成稳定 terminal value。*

## 6. 合并后的结论：进入得少和离开得快都没有自动变成正价值

Budget 研究先证明当前 post-cooldown lineage 无法解析出有意义的数量梯度；SELL penalty 确实减少风险库存，却主要靠削弱参与；reducing BUY 保留成交并明显缩短 repair time，却没有改善终局或左尾。三者共同排除了“库存代理变好就等于策略变好”的推理捷径。

未来库存动作必须提出新的经济 lever，而不是在已消费 panel 上改 penalty 曲线、inventory trigger 或 release threshold。若考虑 IOC、跨价减仓或更复杂 inventory surface，必须重新冻结费用、taker risk、slippage、queue loss 与 risk-capital no-harm gates。
