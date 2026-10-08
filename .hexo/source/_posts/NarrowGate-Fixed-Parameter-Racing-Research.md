---
title: 'NarrowGate 报价控制研究：系数与偏移、方向化门槛和动态改单'
date: 2026-08-29 13:30:00
updated: 2026-10-08 06:30:00
categories:
- Market Making
tags:
- Market Making
- 报价动作
- 因果推断
- 随机化回放
- 研究治理
math: true
---

参数搜索比较的是：在指定历史范围内，哪一套完整配置表现更好。局部报价动作进一步追问：在某个决策时可见的状态下，改变这一次报价，是否比保持原报价带来更高的后续净收益？两者都需要回放订单与库存，但比较的对象不同。

Widen 将增加风险暴露的一侧报价向外移动，Recenter 将报价向合理中心收回，Prevent-Over-Widen 则阻止额外的外移。它们先改变订单价格和排队位置，再通过成交与库存影响收益：挂得更远可能避开不利成交，也可能错过正常价差或减仓机会。因此，参数排名、实际订单变化和相对基线的净收益变化需要分别检验。

## 报价动作要估计什么

### 新响应基线：完成覆盖不等于证明盈利

后续主动成交与盘口响应研究中的冻结候选 `TRADE_BOOK_RESPONSE_VALUE`，已由所有者选为新的离线研究参照 `B0_RESPONSE_20261007`。旧 B0 及下文历史比较保留原身份，不能将历史结果改名归给新参照。这一选择不是实盘部署，也不是宣称候选已经盈利。

新参照的经济回执已覆盖 204 个账户、407 日：Development 为 150 个独立两日账户，Final 为 53 个两日账户加最后一日。已完成的候选 Final 结果只按原身份复用一次；独立账户的汇总不等于单账户连续 407 日。Development 包含训练日期，Final 也已有使用史，因此不能称为全样本外检验。完整净收益仍为负；私有逐账户收益、模型和运行材料不随博客公开。全部完整结果已在本机保留，冻结响应模型、授权源码overlay、计算耗时、输入身份、日期和账务绑定复核通过；这不等于实盘一致性或可直接部署。

完整模型身份、47／39 特征消融、204 账户汇总及 live 接线边界见[响应动作研究报告](/2026/10/08/NarrowGate-Response-Action-Baseline/)。下一项 Defense/Urgency 实验冻结九组控制方案和既有模型，先在指定 B 组选择，再读取后续候选收益，并另做真正连续 Final107 的状态承接检查。基线收尾时只有合同／纯规则验收；后续私有冻结工程与分阶段执行是另一版本和证据，不能拿本次文档发布冒充全实验或连续账户完成。完整状态以[研究族文档](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f01_fixed_parameter_racing/README.zh-CN.md)为准。

核心 estimand 是

$$
\tau(a\mid x)=E\!\left[Y_T(a)-Y_T(a_0)\mid X=x\right],
$$

其中 $a_0$ 是冻结 baseline，$a$ 是明确的报价动作，$X$ 只能包含决策时可见状态，$Y_T$ 必须穿过 submit、queue、fill、inventory 与 库存生命周期 terminal。完整配置的配对回放估计策略差值；若要回答这里的局部条件动作价值，还需在同一决策状态上定义干预与后续路径。直接配对模拟依赖冻结的撮合与延迟假设；随机化日志的离线策略评估（OPE）还需要真实分配概率和共同支持。

<span id="三类实验分别回答什么"></span>

## 历史局部报价实验分别回答什么

| 实验 | 比较对象 | 公开结果的范围 |
|---|---|---|
| 固定参数竞速 | 全局参数 winner 能否被称为 alpha？ | 只能 screening；旧 winner 与精确排名撤回 |
| 固定局部报价动作 | Widen、Recenter、Prevent-Over-Widen 是否稳定优于 baseline？ | 随机化 Development 没有稳定赢家 |
| BUY 条件加宽 | 状态模型能否只在负价值区域加宽一 tick？ | 无条件点估计不足以支持 chronological policy；关闭 |

## 联动系数与不对称偏移：完整报价控制器的比较

后续 F01 沿两个轴交叉比较：一组联动风险系数，以及不对称报价偏移。历史 gamma 只是当时联动轴的名称，不意味着当前库存、价差和单笔风险字段可以合并成一个参数。这里的 A/B/C/D 也不是下文改单门槛的 A00/A11/A10/A01。

同一完整开发账户中，提高系数且不加偏移的路径少亏最多，但库存峰值增加；较低系数下加入偏移也少亏，而较高系数下加入相同偏移却抵消了大部分改善。四臂仍均亏损。可得出的结论是两轴通过订单和库存路径发生交互，不能将单独改善直接相加，也不能从单账户推出不对称偏移普遍有利或某系数最优。首批风险不劣条件未通过的结论保留；后来选择 D 作为离线参照，不等于该四臂比较证明了 D 最优。

## 旧单更新条件：A00/A11/A10/A01

另一类实验改变的是何时按原目标更新旧单，不是 Widen/Recenter 的目标价格公式。向外表示 BUY 降低买价、SELL 提高卖价；向内相反。价格门槛减少 5 ticks 不等于额外将目标移动 5 ticks。后续成交、库存和预测消费路径分叉后，目标仍可能自然不同，不能声称四臂逐时刻目标永远相同。

| 分析臂 | 普通向外门槛 ticks | 普通向内门槛 ticks | 减仓门槛 ticks |
| --- | ---: | ---: | ---: |
| A00 | 15 | 15 | 15 |
| A11 | 10 | 10 | 15 |
| A10 | 10 | 15 | 15 |
| A01 | 15 | 10 | 15 |

A00 复用原 B0；A11 是先完成的统一降门槛实验，后来仅加入四臂分析命名，不重命名原实验或复制结果。只新增 A10/A01。每臂覆盖相同 Final107 的 54 个独立账户，不是单账户连续 107 日，也不是随机化单次改单。这组名称与风险系数轴的 A/B/C/D 不同。

该样本中 A11 基本持平略差；A10 少亏，但改善集中于少数账户、配对差额中位数为负、库存峰值增加；A01 整体更差。未证明稳定最优，未晋升 B0，更不能概括为“向外越快越好”或“所有向内调整有害”。具体私有收益表不公开，完成范围与采用边界见[仓库 F01 主报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f01_fixed_parameter_racing/README.zh-CN.md)。

完整路径的交互必须保留：

```text
I = P11 - P10 - P01 + P00
P11 - P00 = (P10 - P00) + (P01 - P00) + I
```

相同种子不保证闭环分叉后逐请求获得同一样本；两个单方向效应不能忽略交互直接相加。Final 已查看，本比较不是新盲测。该方向化批次未装入本地报价计算耗时样本，不表示原 REST/订单延迟为零；后续加入计算耗时是另一执行场景，不倒改这些历史结果。

## 基于目标报价方差率的动态向外门槛

固定方向化门槛之后，F01 进一步问：普通向外改单能否按目标报价变化的强弱调整门槛？这不是额外加宽目标报价，也不是重新训练成交价值模型。经验控制函数为：

$$
h_t=(12R_0v_t)^{1/4}.
$$

`h_t` 是价格距离，除以价格 tick 后按既定整数成本规则选择门槛，最少一 tick，不设置 10 或 15 的上限。`v_t` 是策略已经生成的目标报价方差率代理，按 BUY/SELL 分别因果更新；它包含预测、库存和风控反馈，不能称为纯市场方差。`R0` 的单位是价格平方乘秒，是经验尺度，不是已经测出的真实撤改单成本比，也不使该公式成为异步订单系统的严格最优解。

完成目标发布观察与保存恢复检查后，有限探索使用两个完整开发账户，复用已经加入本地报价计算耗时的同场景 B0。单一 `R0` 在读取候选收益前由已有 B0 目标记录确定。动态 D 使用自身闭环目标序列更新 `v_t`；静态 S 使用同一参考分布的典型整数尺度。两者只改变普通向外门槛，保留向内、减仓及其他订单条件；就绪和缺失回退规则相同，因此 S 用于区分“动态变化有价值”与“只是换了固定尺度”。

两账户合计 D 和 S 都比 B0 更差。D 相对 S 合计略好，但逐账户方向不一致，部分单位成交额指标改善没有变成更好的总净 PnL。这次结果不支持采用该动态门槛，也没有证明动态关系相对固定尺度的稳定额外价值。它只检验了一个预定尺度，不否定所有 R；两个账户同时用于输入诊断和尺度定义，因此属于开发探索，不是独立验证。没有因负结果继续扫描参数或给门槛临时加上限。

这三类后续实验都由 [F01 维护](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f01_fixed_parameter_racing/README.zh-CN.md)。系数与偏移决定如何形成目标，固定/动态门槛决定多大变动才更新旧单；[F07 的 U0/U1](/2026/08/29/NarrowGate-Active-Order-Queue-Value-Keep-Cancel-Research/)则改变何时重新评价。不同控制层的结果不能互相替代，也不混用各自的 B0 执行场景。

<span id="3-固定参数竞速"></span>

## 固定参数竞速

历史搜索覆盖过风险系数、距离衰减、冷却、库存上限和价差约束。它能比较整套配置，却也同时改变参与度和风险暴露。以下先说明怎样构造可比差值，再讨论参数排名的选择偏差。

![固定参数在不同市场状态下产生不同路径](/images/narrowgate/fixed-parameter-racing-regime-kline.svg)

*图 1：机制示意。相同的固定 spread/cooldown 在低波动、单边冲击和修复阶段会删除不同类型的成交；“参与更少”不能自动解释为“选择更好”。图中不是历史私有交易或实盘 K 线。*

本文只讨论历史研究方法和公开结论，不建议任何真实交易行为。文中的 PnL、fill、inventory 与 库存生命周期 指标都是特定 replay identity 下的研究量，不是收益承诺。

<span id="1-研究问题：我们到底在搜索什么"></span>

### 研究问题：我们到底在搜索什么

固定参数竞速最朴素的形式，是在一个参数集合 $\Theta$ 上运行完整策略回放，并选择 pooled score 最大的 arm：

$$
\hat\theta=\arg\max_{\theta\in\Theta}\widehat J(\theta).
$$

这里的 $\theta$ 可能同时包含风险厌恶、订单到达曲线、加仓冷却、库存上限、报价上限和保护阈值；$\widehat J$ 可能是 raw PnL、terminal MTM、Sharpe、inventory-adjusted PnL，或它们的加权组合。

问题在于，maker 策略不是把一个静态预测直接换成一次收益。参数会改变 bid/ask 坐标、place/replace/cancel、queue position、fill、库存、后续 eligibility、cooldown lineage 和 库存生命周期 终局。两个 arm 的差异应当在同一天、同一数据身份、同一随机种子与相同非候选机制下成对估计：

$$
\Delta_d(\theta)=Y_d(\theta)-Y_d(B_0),
\qquad
\widehat\Delta(\theta)=\frac1D\sum_{d=1}^{D}\Delta_d(\theta),
$$

其中 $B_0$ 是冻结的 rolling baseline，$Y_d$ 至少要同时报告 terminal value、库存生命周期 tail、fills/activity 与 inventory exposure。仅凭 pooled $\widehat J$ 选 winner，会把日期 regime、参与度下降和尾部风险重新分配混成一个数字。

真正的问题因此不是“哪个参数在全样本 PnL 最高”，而是：

> 在 side、order role、queue state、volatility、flow 与 库存生命周期 state 都不同的情况下，同一个固定动作是否仍具有正的条件净价值，并且能从 Development 转移到后续面板？

<span id="2-输入、动作与-estimand"></span>

### 输入、动作与 estimand

F01 的输入是完整 maker replay 所需的本地市场状态、策略状态、订单生命周期和账户状态。历史 arms 覆盖过 `gamma / kappa ratio / 深度流动性缩放 / cap / guard / cooldown / max inventory` 的联合 sweep，也覆盖过 `prevent_over_widen`、`widen_1tick`、`recenter_1tick`、固定跳过一个 add cycle 等离散报价动作。

连续参数 arm 的“动作”是整套策略坐标发生变化；离散 local action 的动作则是某个 eligible decision 上保持 baseline 或执行冻结的 widen/re-center/skip。两者不能混成一个 estimand：两者均须明确比较对象和完整路径归因。历史随机化／logged-policy OPE 分析需要真实分配概率、overlap 及相应识别假设；直接完整配对模拟不伪造 propensity，但结论只在冻结模拟假设下成立，不自动获得线上因果解释。

F01 最终采用的研究判断至少要求同时看：

$$
\text{value uplift},\quad
\text{fill retention},\quad
\text{inventory time},\quad
\text{库存生命周期 q10/CVaR},\quad
\text{side/role transfer}.
$$

比较参与程度与亏损时，可以使用一个描述指标。此处 $F$ 明确定义为成交笔数，$L$ 为正的亏损额（不是带符号 PnL），下标0和1分别表示基线与候选。两者仍亏损且基线分母非零时：

$$
d_F=1-\frac{F_1}{F_0},\qquad
d_L=1-\frac{L_1}{L_0},\qquad
S_L=d_L-d_F.
$$

$S_L$ 描述亏损变化相对交易活动变化的快慢，不识别减少参与与状态选择的因果贡献。成交活动本身受策略干预影响，交易时点、买卖侧、持仓时间和库存风险仍可能不同；$S_L>0$ 不证明选择有效，$S_L\le0$ 也不单独证明模型毫无信息。若改用 BTC 双边数量或报价货币双边成交额，必须重新标明 $F$ 的定义，不能混用。基线接近零、没有成交或候选转为盈利时，不以普通亏损减少比例作为主要结论。随机逐机会否决概率相同不保证最终成交量相同，事后匹配成交量也不自动解决公平比较。

<span id="3-数据与因果时钟：为什么旧冠军榜必须撤回"></span>

### 数据与因果时钟：为什么旧冠军榜必须撤回

历史参数竞速跨过多代 replay identity。后来审计发现，其中一部分使用了左标签特征、错误的 trade 可见时钟、旧 P3 override、近似 queue、mixed-cadence L2 或历史 live incident 语义。它们不是可以通过改一列标签就修好的小误差，因为 arm 之间的订单、fill、库存和 库存生命周期 路径已经发生分叉。

一旦输入时钟或执行机制改变，旧日级差值不再估计同一个 $Y_d(\theta)$。因此旧的 48/512/1024-arm 精确 PnL、retained39/blocked71/late4 排名与 winner 身份被正式撤回；“当时没有晋级”的治理决定可以保留，但不能把旧数值重新称为当前因果证据。

这也是为什么数据修复不能自动复活一个已经读取过 outcome 的 family。若再次搜索相同 grid，研究者已经知道哪些区域曾经看起来好；如果不建立新的 action semantics、数据身份、chronological split 和统计合同，所谓重跑只是对已消费面板的再优化。

### 从全局配置到局部干预

第一阶段是大规模 global parameter racing。它证明 runner 能覆盖大量 arm，也暴露了 pooled rank 对 replay identity 和面板的高度敏感。

第二阶段把动作缩窄到 side-specific 固定报价变化，例如 baseline、prevent-over-widen、widen one tick 与 recenter one tick。Development 领先动作没有稳定转移到 Validation，并出现 winner rotation；极端 库存生命周期 tail 又缺乏足够支持。

第三阶段测试 BUY add 的固定 widen、SELL add 的固定 skip，以及 85 秒之后的固定/状态条件 rearm。结论不是“shock、refill、recovery 没有信息”，而是被冻结的动作映射没有产生可靠 uplift：描述路径较差，不等于继续停止加仓更好，因为等待也可能切断 repair fill。

第四阶段用 native queue 与 competing-risk/value 机制检查 keep/cancel。简单阈值动作把 intervention fills 大幅削掉，却没有更快削掉 toxic fills，进一步说明固定防守规则容易退化为停止参与。

这组比较逐步缩小了干预范围：从整套配置，缩到单侧的一次报价，再检验状态是否能帮助选择。范围缩小让机制更容易解释，却不保证经济效果更强；一次报价可能根本没有改变后续成交。

### 历史结果：没有可稳定迁移的参数赢家

公开关闭报告保留了五类结论。

第一，没有一组历史 fixed arm 在 corrected causal replay、side/role transfer、库存生命周期 tail 和 action-uplift 口径下保持稳定为正。

第二，某些参数看似改善 PnL，实质上是在降低 fills、延长库存持有或改变尾部构成。没有选择效率与条件净价值，就不能把 participation reduction 写成 alpha。

第三，BUY 与 SELL、opener/add/reducing 对同一动作的反应不同。一个 pooled winner 会掩盖失败的 side 或 role。

第四，参数写成函数也不自动变成 state-conditioned alpha。只有函数实际改变订单路径，并在冻结反事实下提高终局价值，才具有策略意义。

第五，固定值仍然不可或缺。tick/lot、fee、GTX 语义、hard inventory limit、circuit breaker、pair-spread cap、随机种子、latency profile 和 rolling baseline 都需要冻结。区别在于它们的权限：它们是交易所规则、安全约束、经验校准或实验控制，而不是从一次 PnL sweep 推导出的市场常数。

### 历史结论的适用范围

旧参数排名已撤回，历史筛选结果不构成当前标定或实盘依据。这不否定 AS/GLFT 的库存感知坐标、经验校准和固定实验对照，也不证明所有固定参数都无效。

<span id="7-后继研究应怎样提出问题"></span>

### 后继研究应怎样提出问题

新的研究应把问题从“再找一组常数”改写为：在一个明确 decision surface 上，KEEP、CANCEL、REENTER、ADD、NO-ADD、WIDEN 或 RECENTER 哪个动作相对 baseline 有更高的条件净价值？

比较需要明确订单侧别与角色、完整库存生命周期收益、有效日期数、尾部风险和参与度。随机化日志另需核对分配概率、共同支持与有效样本量；直接配对模拟则检查共同输入和两条独立执行路径。两种方法都应明确缺乏支持时如何回到基线。

固定参数竞速最有价值的产物并不是一个 winner，而是一条研究纪律：**参数可以被冻结，证据不能被混用；screening 可以排序，排序不能越级变成策略权限。**

### 深入推导：为什么历史冠军天然带有乐观偏差

设每个 arm 的真实条件价值为 $J(\theta)$，历史估计为 $\widehat J(\theta)=J(\theta)+\varepsilon_\theta$。即便所有 arm 的真实价值完全相同，只要研究者从 $K$ 个含噪估计中选择最大者，就通常有：

$$
E\left[\max_{1\le k\le K}\varepsilon_k\right]>0.
$$

这就是 grid winner 最基本的选择偏差。扩大 grid 会增加找到“漂亮数字”的机会，却不会自动增加可迁移信息。若不同参数还会改变 fills 数量、库存方向与 库存生命周期 长度，误差项之间也不再是同方差、相互独立的；交易活跃的 arm 可能承受更大的 PnL 波动，保守 arm 则可能靠少参与获得更窄的表面尾部。此时只按最大 pooled PnL 排名，相当于同时选择参数、参与度和风险暴露。

市场状态混合又增加第二层偏差。设日期状态为 $Z_d\in\{\text{quiet},\text{trend},\text{repair}\}$，则全样本价值其实是：

$$
J_{pool}(\theta)=\sum_z P(Z=z)J(\theta\mid Z=z).
$$

一个 arm 可以只在样本中占比最大的 quiet regime 获利，同时在短而剧烈的 trend regime 造成主要尾部损失。只要换一个月份，$P(Z=z)$ 改变，winner 就可能旋转。可迁移结论需要同时报告条件差值、逐日符号、leave-one-regime-out 稳定性，以及最坏状态下的 no-harm，而不是把 regime 权重隐藏在一个总数里。

![固定参数从历史冠军到动作价值的识别阶梯](/images/narrowgate/f01-fixed-parameter-identification-stack.svg)

*图 2：固定参数要从 pooled grid 走到可识别动作价值，至少需要同日配对、side/role overlap、完整路径以及参与度—尾部共同门。任何一层失败，都不能由更高的历史 PnL 排名补偿。*

### 一条完整路径：同一个 spread 常数为何会产生相反效果

考虑一段合成行情。时刻 $t_0$，mid 为 100,000 USDC，maker 当前持有 $+0.002$ BTC。Arm A 使用较窄的固定半价差，Arm B 比它外移一 tick；其他订单大小、安全限制、随机延迟与 reducing quote 完全相同。

在 quiet regime 中，A 的 BUY add 可能先成交，随后 SELL reducing 在数秒内完成，额外捕获价差；B 没有成交，因此少赚一段正常往返。若只看“坏 fill 比例”，B 可能显得更安全，但 terminal value 更低。

在下跌冲击中，A 的 BUY add 同样先成交，却让长库存暴露在连续 aggressive SELL flow 下；reducing SELL 离市场越来越远，库存生命周期 在 30 秒 markout 以后仍未结束。B 因为外移而没有成交，这一次确实避开了 adverse fill。两段路径使用同一个参数差，却有相反动作价值。

真正的 paired replay 必须从报价分叉点继续推进两条世界：订单是否进入 queue、何时部分成交、库存怎样改变下一次 reservation price、cooldown 是否启动、reducing quote 是否出现、最终何时 flat。把第二条路径的“未成交”直接记作避免了一笔负 markout，会漏掉第一条 quiet 路径中的修复收益，也会把后续库存反馈删掉。

这也解释了为什么 `gamma`、`kappa`、spread cap 与 cooldown 不能只按单笔 fill label 调参。它们控制的是一个递归系统：

$$
S_t\rightarrow Q_t(\theta)\rightarrow O_t(\theta)\rightarrow F_t(\theta)
\rightarrow I_{t+1}(\theta)\rightarrow S_{t+1}^{policy}(\theta).
$$

一旦 $F_t$ 不同，后面的 policy state 就已经不是共同样本。完整路径 A/B 才能保留这种反馈。

### 固定常数的三种合法身份

同一个数值出现在配置里，不代表它拥有同一种科学含义。

| 身份 | 例子 | 需要什么证据 | 可以宣称什么 |
|---|---|---|---|
| 交易所/工程常数 | tick、lot、fee、最小名义金额 | 交易所合同与实现 parity | 精确执行坐标 |
| 安全与风险预算 | hard inventory limit、circuit breaker | owner 风险约束与 fail-closed 测试 | 最坏情况下不越界 |
| 经验校准 | latency profile、queue sensitivity、波动尺度 | source-matched calibration | 给冻结模型提供量纲 |
| Alpha 参数 | state-conditioned widen/skip/rearm | paired full-path uplift、尾部与 transfer gates | 相对 baseline 的条件净价值 |

F01 关闭的是最后一行中“一个全局固定 winner 可以跨状态充当 alpha”的主张，不是否定前三行。把这些身份分开以后，仓库仍然可以有稳定默认值，却不会再用一次历史冠军榜为它们补上不存在的市场规律。

### 参数搜索的 effective trials 远大于表面 grid

如果研究不仅试了$K$组参数，还试了多个日期切法、PnL定义、queue假设、图表窗口与停止时点，实际选择次数远大于$K$。即使每个单次估计都无偏，winner的最大值仍有正向选择偏差：

$$
E\left[\max_{k\le K}\hat\mu_k\right]
\ge
\max_{k\le K}E[\hat\mu_k].
$$

参数之间相关会降低但不会消除偏差。更隐蔽的是researcher degrees of freedom：一个不利winner可以通过换queue quantile、删异常日或改terminal mark继续比赛。只要这些选择发生在看过结果之后，它们就属于同一搜索账本，不能按“新版本”重置multiplicity。

因此固定参数研究需要search ledger：所有尝试过的arms、输入身份、读过的panels、scorecard与淘汰原因都留在同一研究家族。Formal successor应先冻结极小候选集，再在chronologically later panel上比较；不是把旧top-N带到另一套有缺陷的replay里继续赛。

### Denomination invariance 是报价参数的最低物理检查

如果inventory从BTC改写成mBTC，或者价格从USDC改成cent，经济上同一状态不应产生不同quote。设数量单位缩放$q'=cq$，price unit缩放$p'=dp$；公式中的risk coefficient、variance与order size必须按对应维度变换，使最终quote在还原单位后相同。

这类测试能暴露“参数在一次回测里看起来好，却依赖隐含单位”的问题。尤其AS/GLFT近似中，inventory、order size、risk aversion、absolute-price variance和distance elasticity必须闭合。若订单量$z$被归一化为1，文档应明确$\gamma$或$q$使用的是order units；若$q$仍是BTC，就应显式保留$z$并做BTC→mBTC不变性测试。

同理，risk horizon、requote interval、order TTL 与库存生命周期 horizon 不是一个时钟。固定 $\gamma$ 只能在指定 variance 定义与 horizon 下解释；报价检查间隔不保证订单寿命，标签期限也不等于库存持有时间。固定参数作为工程 baseline 的前提是语义和单位明确，而不是曾经赢过一张表。

### 固定参数与 regime interaction 的可视化方式

与其画一条总PnL冠军线，更有信息的是按日期把候选相对baseline的差值与volatility、spread、activity和initial inventory并列。若参数A只在高波动日好、B只在平静日好，总平均winner可能仅由样本regime占比决定。逐日paired scatter与累积差值能显示winner rotation和尾部集中。

但这些图只能生成后继假说，不能在同一数据上定义regime selector再宣称通过。selector需在inner folds训练、outer chronology评价；否则“按图分段”只是把全局参数搜索变成更大conditional search。

<span id="4-固定局部报价动作"></span>

## 固定局部报价动作

局部动作实验将变化限制在已有库存的加仓侧：订单规模、减仓报价、风险限制、队列与延迟规则保持不变，只改变一次报价的几何位置。下表给出具体动作与随机分配方式。

![固定局部报价动作在 K 线与报单上的含义](/images/narrowgate/fixed-local-quote-actions-kline.svg)

*图 1：机制示意。四个动作只改变 exposure-increasing add 的局部报价；reducing quote、size、inventory limit 和市场路径保持冻结。*

![库存生命周期 动作从分配到终局的完整路径](/images/narrowgate/f09-inventory_lifecycle-action-causal-path.svg)

*图 2：同一个 untreated opportunity 先冻结 eligibility，再随机分配报价动作。candidate 必须自行生成 submit、queue、fill、inventory 与 库存生命周期 terminal；mechanics、participation、risk 和 economics 是四道不同的门。*

<span id="1-研究问题：不是哪个-tick-最赚钱，而是局部动作能否迁移"></span>

### 研究问题：不是哪个 tick 最赚钱，而是局部动作能否迁移

maker 策略很容易产生局部直觉：盘口恶化时再 widen 一 tick，过度 widening 时撤回一部分，或者让报价重新靠近合理中心。传统参数回测会在很多 tick 距离中挑赢家，却无法区分随机波动、日期选择与动作本身。

本项目把问题冻结为一个 库存生命周期-level intervention。每个 库存生命周期 最多有一次 exposure-increasing add intervention；opener 与 reducing 没有动作 overlap，因此不能继承结果。形式上，动作价值是：

$$
\tau_a=E[Y(a)-Y(a_0)],
$$

其中 $a_0$ 是 baseline，$Y$ 是从 intervention decision 到 库存生命周期 terminal 的完整路径价值，而不是当前订单的孤立 30 秒 markout。

<span id="2-动作、输入与-estimand"></span>

### 动作、输入与 estimand

行为向量冻结为：

| 动作 | Propensity | 报价变化 | 其他机制 |
|---|---:|---|---|
| baseline | 0.40 | 原始 quote | 全部冻结 |
| prevent_over_widen | 0.20 | 阻止额外外移 | size/reducing 不变 |
| widen_1tick | 0.20 | exposure-add 外移一 tick | queue 重新生成 |
| recenter_1tick | 0.20 | 向中心回收一 tick | GTX 与 safety 不变 |

每一行记录完整 propensity vector 和实际 assignment。库存生命周期 reward 只记一次：

$$
R=V_{fill}-C_{库存生命周期}-C_{queue\ reset}.
$$

maker-signed fill value 已从 execution price 开始，不能再重复加 half-spread；terminal 库存生命周期 PnL 也不能复制到多个 decision rows。动作改变报价后，订单、queue、fills、inventory 与后续 库存生命周期 都必须各自重放。

离线评估使用 clipped doubly robust estimator：

$$
\widehat V_{DR}(\pi)=\frac1n\sum_i\left[\widehat\mu(X_i,\pi(X_i))+\frac{\mathbf1\{A_i=\pi(X_i)\}}{p_i(A_i\mid X_i)}\left(Y_i-\widehat\mu(X_i,A_i)\right)\right].
$$

已知 propensity 让 overlap 可以核对，却不会自动消除模型误设、库存生命周期 interference 或 replay identity 缺陷。

<span id="3-冻结证据面板与因果时钟"></span>

### 冻结证据面板与因果时钟

面板按时间冻结为 80 个 Development 日、1 日 embargo、20 个 Validation 日、1 日 embargo 和 20 个 family-specific sealed holdout 日。holdout 只是本动作族未读，不宣称在所有 NarrowGate 假设上全球 untouched。

Development 产生 5,746 个 interventions，Validation 产生 1,508 个；BUY/SELL 与四动作均有支持。Development behavior mixture 的 control/random fills 为 47,901/47,890，Validation 为 12,277/12,285，说明随机化没有靠整体停止交易制造表面收益。

特征必须在 decision timestamp 前 ready。市场、queue、P3、latency seed 与 initial state 在所有 arms 相同。一个 extra cancel 不能让后续所有随机延迟错位，因此 latency 使用 keyed deterministic path，而不是顺序 RNG。

<span id="4-一个具体路径例子"></span>

### 一个具体路径例子

假设 BUY add baseline price 为 99,999.9，tick 为 0.1，当前 inventory 已为 +0.001 BTC。`widen_1tick` 把 bid 改为 99,999.8。若 baseline order 在队列前端原本会成交，而 widened order 没成交，candidate 不仅少一个 fill，也少一段库存、一个 reducing quote 和后续 cooldown。不能把“没吃到那笔 -0.2bps markout”直接当收益；必须把失去的修复机会与 queue reset 一起算到 terminal。

相反，`recenter_1tick` 可能增加 fills，却也可能以更差选择进入库存。局部价格变化的经济含义来自完整路径，不来自 quote 距离本身。

<span id="4-1-四臂不是四个独立回测"></span>

#### 四臂不是四个独立回测

每个 库存生命周期 只能观察一个实际 assignment。四臂价值由同一随机行为分布识别，而不是分别选择四个“最好日期”运行。设行为概率为 $p(a)$，某个目标 policy 为 $\pi(x)$，则 inverse-propensity correction 只在日志动作恰好等于目标动作时启用：

$$
\frac{\mathbf 1\{A_i=\pi(X_i)\}}{p(A_i\mid X_i)}.
$$

由于 baseline 概率 0.4、其余各 0.2，稀有动作匹配行权重更高。clipping 可控制方差，却也改变 estimand 附近的偏差—方差权衡。因此 clipping 是冻结合同，不是看到哪个动作区间差一点就调哪个。

四臂共享同一天行情和相似 库存生命周期 状态，动作估计也彼此相关。对每个动作分别做 95% 区间、再挑唯一正的一个，会放大 familywise 假阳性。正确 scorecard 要同时约束动作族、side、tail 与日期方向。

<span id="4-2-DR-估计器为什么不是“机器学习保证”"></span>

#### DR 估计器为什么不是“机器学习保证”

DR 的双重稳健性指：在一定正则条件下，propensity 或 outcome model 至少一方正确可带来一致性。这里 propensity 由 replay 已知，是强项；但仍需要 consistency、no interference、正确 reward 与稳定的 库存生命周期 assignment。

如果同一 库存生命周期 被随机多次，早期 action 改变后来 $X$，那么后续行不是独立的静态 contextual bandit。项目将 intervention 限为每 库存生命周期 一次，就是为了让：

$$
Y_i=Y_i(A_i)
$$

保持清楚。known propensity 不能修复错误的订单 lifecycle、重复 terminal PnL 或时间穿越特征；这些都属于 DR 公式之外的识别前提。

<span id="4-3-一个-winner-rotation-的合成解释"></span>

#### 一个 winner rotation 的合成解释

假设 Development 恰有较多缓慢下跌日。BUY widen 少接到一些 add fills，点估计领先；SELL recenter 在反弹段增加修复，亦略正。Validation 若趋势组成改变，BUY widen 的优势缩小，SELL recenter 可能反号，而 prevent-over-widen 偶然领先。

这不必意味着“市场规律每月彻底相反”。当真实 action effect 接近零、日间噪声大于信号时，最大样本均值本来就会旋转。若四个真值都为零：

$$
\Pr\left(\arg\max_a\widehat\tau_a^{Dev}
=
\arg\max_a\widehat\tau_a^{Val}\right)
$$

并不会很高。winner rotation 因此是弱信号与选择噪声的自然诊断，不能成为在 Validation 再选一次动作的理由。

<span id="5-结果：Development-线索没有穿过-Validation"></span>

### 结果：Development 线索没有穿过 Validation

历史冻结报告中，Development 每个动作的 DR interval 都跨零。点估计领先者是 BUY `widen_1tick` 与 SELL `recenter_1tick`；它们只被记录为 diagnostic candidates，并未通过晋级门。

Validation 不回灌训练。BUY widen 仍是很小的正点估计，但日正率低于 50%；SELL recenter 反号；Validation 中最大的 SELL 点估计反而来自 Development 为负的 `prevent_over_widen`。这种 winner rotation 是不稳定性证据，不是让研究者在 Validation 再挑一次赢家的许可。

| 证据层 | 观察 | 正确解释 |
|---|---|---|
| Development | 多个点估计正负混合，区间全跨零 | 无可晋级 candidate |
| Validation | leader 旋转、部分方向反转 | 不能 selection on validation |
| Tail | candidate 极端事件支持不足 | 零事件不是零风险 |
| Holdout | 未读 | 失败 family 不用 holdout 救援 |

预注册极端尾部为 terminal 库存生命周期 MTM 不高于 -5 USDC，并要求每个候选至少五个 logged events。Development 与 Validation 的候选动作都没有足够事件。缺事件只能标为 unsupported，不能说动作“消除了尾部”。

<span id="6-研究演进与数值撤回"></span>

### 研究演进与数值撤回

原 action identity 建立在当时的 causal-v4、queue、P3 与数据合同上。随后 normalized L2、trade-side、time/unit 和 replay identities 被修复，旧精确 DR、PnL、fill、库存生命周期、tail 与 winner ordering 因而撤回。

这不生成一个“v2 重跑义务”。研究身份由 sample、action set、folds、estimand 与统计合同共同定义。数据修复说明旧数值不能做当前标定，却没有让一个已看过 Development/Validation 的动作重新获得独立性。若未来重启，必须提出真正不同的 action、重新冻结 split 和 score profile，而不是用修复过的数据复刻同一局部 tick family。

<span id="7-不确定性为何不能由-pooled-PnL-覆盖"></span>

### 不确定性为何不能由 pooled PnL 覆盖

行为 mixture 的 raw aggregate delta 只是 sanity check。DR uncertainty 以 UTC day cluster 为单位，因为同一天的 库存生命周期 共享 market regime。若把 5,746 个 interventions 当独立样本，区间会虚假收窄。

BUY 与 SELL 也必须分开。一个 pooled positive estimate 可能由 BUY 支撑、同时掩盖 SELL 伤害；opener、add、reducing 则必须拥有实际 action overlap 才能获得角色结论。本项目只有 add overlap。

还要区分 assignment support 与 outcome information。四臂都有足够随机化行，只能说明 $p_i(a\mid X_i)>0$；极端 tail 每个 candidate 少于五个事件，则对应的有效信息仍接近零。用总 fills 或总 库存生命周期 给 tail interval “补样本”会混淆 estimand。一个直观反例是：一万个普通 terminal rows 加上零个 $Y\le-5$ 的 candidate event，仍然不能估计 candidate 对这一阈值事件的保护率。因而 scorecard 同时保留 overlap、daily cluster、tail-event count 与 activity gates，任何单一均值都不能覆盖其余缺口。

此外，known propensity 只解决行为分配，不解决 interference。一个动作改变当前 queue 后可能改变同 库存生命周期 的下一次 eligible decision；这也是 intervention 被限制为每 库存生命周期 至多一次、reward 登记一次的原因。若把后续 rows 再当独立 assignments，标准误与 treatment count 都会被重复放大。

<span id="7-1-Mechanics、activity-与-economics-的联合读法"></span>

#### Mechanics、activity 与 economics 的联合读法

一个动作要有意义，至少要沿三层漏斗：被分配后是否真的改变可执行价格；价格变化是否改变 activation/fill/path；改变的路径是否带来足够 terminal value。第一层失败是 no-op，第二层过弱是低 leverage，第二层过强又可能是 shutdown；只有第三层给出经济方向。

因此“control/random fills 几乎相同”在本项目只是完整性检查：随机化没有让系统总体停摆。它不能证明四个 action 的 path-changing rate 相同，也不能证明新增或删除 fills 的质量。后者必须由 action-specific full path 与 terminal scorecard 决定。

<span id="7-2-第三方怎样复核而不依赖旧精确-PnL"></span>

#### 第三方怎样复核而不依赖旧精确 PnL

即使旧数值因 replay identity 修复而撤回，第三方仍可检查研究决定是否保守：四臂 propensity 是否冻结；Development 是否没有正下界；Validation 是否 leader rotation；tail 是否缺候选事件；holdout 是否未读；修复后是否没有把同一已消费 family 重跑成新确认。

这些结构事实足以支持“不晋级”。它们不支持重新引用具体动作排名，也不支持说某个 tick 永久无效。把决定与数值 authority 分开，是历史证据 revalidation 的核心。

<span id="7-3-什么才算真正不同的-successor"></span>

#### 什么才算真正不同的 successor

改变 action lever 会产生新项目，例如从静态一 tick移动改为保留 queue 的 active-order action、外部 fair-center 对整对报价的连续平移，或库存条件的持久 permission。仅更换模型、clip、树深、日期数量或阈值，仍在追问同一个已消费问题。

新 successor 还需重新建立 untreated eligibility、独立 split 和经济预算，并说明与旧四臂的重叠。旧结果可以作为设计先验，例如避免低 leverage 或 participation shutdown，但不能作为新 policy 的训练标签或确认数据。

### 适用范围

这项历史实验只覆盖加仓侧的四个局部动作，不包含首次开仓或减仓角色。Development 与 Validation 没有建立稳定收益，封存测试集未读，也没有据此改变实盘。后续时钟和执行修复使其精确数值撤回；历史不晋级决定保留，不把旧排名当作当前参数依据。

### 随机化单位为何必须跟随 库存生命周期 lineage

如果每个100ms row独立随机keep/widen/recenter/skip，同一订单会在生命周期中不断换arm；后续fill无法归因给哪次assignment，action还会通过库存影响未来rows。更安全的单位是在冻结decision opportunity上随机一次，并把assignment沿订单或库存生命周期 lineage携带到terminal outcome。

令$Z_c$为库存生命周期 $c$的首次合法assignment，结果为$Y_c(Z_c)$。随机化保证在共同支持内

$$
Z_c\perp\{Y_c(a):a\in\mathcal A\}\mid X_c,
$$

但不同库存生命周期仍可能在同一日期共享market shock，所以interval要按日cluster。若一个库存生命周期的action改变后续另一个库存生命周期是否存在，还需要把full-day policy value作为更高层estimand；不能把库存生命周期 outcomes当完全无干扰。

### 为什么 DR 不能救一个不断旋转的 winner

Doubly robust估计器在propensity或outcome model至少一个正确时具有稳健性，但前提是positivity、稳定treatment与正确row identity。若某arm在关键状态几乎从不被分配，权重会爆炸；若库存生命周期 lineage错配，两个模型都在回答错误问题。

一个常见形式是

$$
\hat V(a)=\frac1n\sum_i\left[\hat m_a(X_i)+\frac{\mathbf1(A_i=a)}{\hat e_a(X_i)}\{Y_i-\hat m_a(X_i)\}\right].
$$

它不会消除从多个arms、subgroups和日期切片中事后挑winner的选择偏差。Development里胜出的动作若在Validation旋转，说明异质性、噪声或模型选择没有transport；正确反应是关闭当前family，而不是用更复杂DR learner重新排序同一已读面板。

### 多臂 simultaneous inference

四个arms相对baseline产生多个pairwise contrasts。若逐个看95% interval，再挑唯一为正者，family-wise错误率超过单检验。可以用按日bootstrap每次同时计算所有arms，并以最大t统计量构造共同下界；或者在spec中指定唯一primary arm、其它只作diagnostic。

Development用于选arm、Validation用于确认时，Validation门还必须考虑selection：它确认的是完整选择程序，而不是把winner当事先固定。winner rotation表明选择程序没有迁移。

### Full-path 随机化仍需检查 execution integrity

随机assignment正确不代表replay正确。各arms应共享market events、queue inputs、latency key和initial state；submit/cancel/fill数量守恒；unsupported action回退规则一致。arm-specific action多产生event是treatment结果，不应强制event count相等。

随机化balance表应在pre-action covariates、day和role上检查，但不能按post-action fills重新配平。后者会删除真实action路径并引入collider。

<span id="5-BUY-条件加宽"></span>

## BUY 条件加宽

接下来的实验只在 BUY 报价会增加已有多仓时外移一 tick，SELL、减仓侧和数量保持原样。与前面的固定动作比较不同，这里还训练一个条件规则，检验它能否在未来日期选择更有价值的机会。

![BUY Add 条件加宽的 K 线与完整路径](/images/narrowgate/buy-conditional-widen-kline.svg)

*图 1：机制示意。候选只把 exposure-increasing BUY bid 外移一 tick；是否少一个 fill 会继续改变 inventory、reducing quote、cooldown 与 terminal。*

![BUY conditional action 的完整 库存生命周期 路径](/images/narrowgate/f09-inventory_lifecycle-action-causal-path.svg)

*图 2：CATE tree 只决定在什么 untreated opportunity 上执行 widen；真正结果仍由 candidate 自己的订单、queue、fill、inventory 与 terminal 生成。全局 overlap 通过，不代表每个 leaf 都有经济信息。*

<span id="1-为什么单独研究-BUY-add"></span>

### 为什么单独研究 BUY add

BUY add 与 SELL add 不是一组正负号。BUY add 增加 LONG inventory，它面对的直接流是 aggressive SELL taker；它的后续修复由 reducing SELL 完成。一个同样的“一 tick 外移”在 SHORT 库存生命周期 上对应不同对手方、queue 与修复路径。

研究问题因此冻结为：

$$
\tau_{BUY}(x)=E[Y(W=1)-Y(W=0)\mid X=x,\ role=add,\ side=BUY],
$$

其中 $W=1$ 是 widen one tick，$W=0$ 是 exact baseline，$Y$ 是 decision-to-库存生命周期-terminal reward。

<span id="2-动作、特征与-estimand"></span>

### 动作、特征与 estimand

行为 policy 为 exact 0.5/0.5：

| 项目 | 冻结值 |
|---|---|
| Surface | BUY exposure-increasing add |
| Control | baseline quote |
| Candidate | widen one tick |
| SELL | baseline only |
| Unit | 库存生命周期 最多一次 intervention |
| External reference | excluded |
| Size / reducing / inventory limit | unchanged |

35 个 local-only features 在 decision time 前可见，涵盖 shock、refill、recovery、queue、库存生命周期 与 BUY markout state。action-specific Ridge nuisance models 先在过去日期拟合潜在结果，再用 cross-fitted DR pseudo-outcome：

$$
\widehat\psi_i=\widehat\mu_1(X_i)-\widehat\mu_0(X_i)
+\frac{W_i(Y_i-\widehat\mu_1(X_i))}{p_i}
-\frac{(1-W_i)(Y_i-\widehat\mu_0(X_i))}{1-p_i}.
$$

第二层 depth-2 honest treatment tree 只能在更早 pseudo-outcomes 上选择结构，并在不相交日期估计 leaf value。unsupported leaf 回退 baseline。

<span id="3-数据、split-与时钟"></span>

### 数据、split 与时钟

Development 是此前已检查的 100 个 good days，截至 2026-06-23；随后一日 embargo。Validation 为 9 日并锁定，再经过一日 embargo；sealed holdout 为 10 个 good days，同样锁定。

Development replay 产生 4,387 个 unique BUY 库存生命周期，baseline/widen rows 为 2,207/2,180，assignment rate 49.69%，每行 propensity 0.5。46 个 库存生命周期 在 replay 边界 censor，reward identity 最大误差仅 $2.78\times10^{-17}$ USDC。

market feature、P3、queue 与 latency 都必须在 decision 前 ready。widen 后的 order activation、queue-ahead 与 fill 重新生成；不能把 baseline fill 复制给 candidate 再改 markout。

<span id="4-一个订单例子：外移一-tick并不只改变价格"></span>

### 一个订单例子：外移一 tick并不只改变价格

假设 baseline BUY add 为 100,000.0，candidate 为 99,999.9，order size 0.001 BTC。后续 aggressive SELL trade 最低打到 99,999.95。baseline order 可能在 queue 支持下成交，candidate 则不触价。candidate 看似“避开”了一笔 fill，但真正差额是：

$$
\Delta Y=Y(\text{no fill, altered future path})-Y(\text{fill, inventory repair path}).
$$

若 baseline fill 后几秒内 reducing SELL 以更好价格修复，widen 反而失去 maker spread；若市场继续下跌，widen 可能避免 toxic inventory。模型必须在 decision-visible state 上稳定区分这两种路径，而不能只预测下一段价格方向。

<span id="4-1-一-tick动作的价值可拆成“是否分叉”与“分叉后符号”"></span>

#### 一 tick动作的价值可拆成“是否分叉”与“分叉后符号”

令 $D=1$ 表示 baseline 与 widen 最终产生不同路径。则：

$$
\mathbb E[\Delta Y\mid X=x]
=
\Pr(D=1\mid x)\,
\mathbb E[\Delta Y\mid D=1,x].
$$

第一项近似由未来价格是否进入两张 bid 之间、activation 与 queue 决定；第二项还要看成交后的 trend、repair 与 terminal。一个价格方向模型可能预测第一项，却未必预测第二项。若一 tick 间隔很少改变 fill，$\Pr(D=1)$ 很小，conditional value 也会变成由少量路径支配的稀疏标签。

因此动作强度不能只用“widen 在 50% 库存生命周期 上分配”衡量。assignment rate、quote-change rate、path-change rate 与 terminal-nonzero rate 是四个不同层级；只有最后两个直接决定可学习的经济信息。

<span id="4-2-为什么无条件略正与条件策略为负并不矛盾"></span>

#### 为什么无条件略正与条件策略为负并不矛盾

无条件动作值是：

$$
\tau_{all}=\mathbb E[\psi].
$$

conditional policy 只在集合 $G(X)=1$ 上 widen，其值取决于：

$$
\tau_G=\mathbb E[\psi\mid G(X)=1].
$$

如果 treatment heterogeneity 很弱，而 tree 在有限样本中按 noisy pseudo-outcomes 切分，它可能把总体少量正值留在 baseline leaf、把负噪声误识别为 candidate leaf。于是 $\tau_{all}>0$ 与 $\tau_G<0$ 可以同时发生。

这也是 honest tree 分离结构选择与 leaf value估计的原因。但 honest 不会凭空创造 signal；它只是降低同一噪声既选 split 又评估 split 的偏差。未来日仍然没有正下界，说明冻结特征没有形成稳定 effect modifier。

<span id="4-3-35-个特征为什么不等于-35-个独立证据来源"></span>

#### 35 个特征为什么不等于 35 个独立证据来源

shock、refill、queue、库存生命周期 与 markout state 之间高度相关，许多又来自同一段 BBO/trade history。feature count 不能当成信息维度。depth-2 tree 最多形成少量 leaves，却仍在大量候选 split 中选择；若不在 inner train 中完成，阈值搜索会泄漏到 OOF。

研究把结构学习限制在过去 pseudo-outcomes，并让 unsupported leaf回退 baseline，正是为了允许“没有条件区域”这一答案。强迫每棵树选一个 positive leaf，只会把最大噪声命名为 regime。

<span id="5-Replay-integrity-与-support"></span>

### Replay integrity 与 support

相对 no-randomization control，fills、placed actions、库存生命周期 分别保留 99.988%、99.979%、99.945%，inventory time 约 1.0009 倍。由此可以排除“候选停止报价，所以少亏”的粗糙解释。

conditional policy 层在 28 个未来评估日上覆盖 1,267 rows，candidate rate 37.96%，policy ESS 642。support 与 overlap 通过，所以 failure 不是 propensity 崩溃或样本完全不足。

<span id="6-Development-结果与不确定性"></span>

### Development 结果与不确定性

冻结历史报告给出的 conditional DR reward 为 -0.00742 USDC/decision，day-cluster 95% interval 为 $[-0.02657,+0.01304]$。库存生命周期-cost avoidance、negative-terminal protection、Development-q10 protection 与 intervention-fill probability 的区间也都跨零；repair probability 仅有很小正点估计。

对所有 nuisance-OOF rows 无条件 widen 的历史诊断点估计为 +0.01087 USDC，但区间 $[-0.01934,+0.04151]$。这说明“平均上或许不坏”没有转化成“过去学习的条件规则在未来稳定选对”。

| Gate | 历史结果 | 当前解释 |
|---|---|---|
| overlap / support | pass | 行为实验可评估 |
| conditional reward LCB | fail | 无稳定正价值 |
| 库存生命周期 cost / terminal | fail | path outcome 不支持 |
| q10 / tail | fail或无事件 | 不能声称防尾部 |
| Validation | unread | Development 失败即停止 |

旧 numeric estimates 因后续 data/replay repair 不再是当前 calibration authority；但所有 interval 原本就未过门，因此撤回数值不会把 family 变成候选。

<span id="7-为什么“树没学好”不是重开理由"></span>

### 为什么“树没学好”不是重开理由

depth-2 tree 很简单，这确实限制 interaction capacity。但 action、feature surface、tree depth、threshold 与 split 都是冻结身份的一部分。看到结果后换更深树、删弱特征或降低 candidate-rate gate，会在已消费 Development 上进行 post-selection。

若未来提出 interaction-capable 新机制，需要新 family identity、新 split 与新 score profile；它不能沿用 `buy_add_conditional_widen_causal_v4_v1` 名字，也不能打开旧 Validation 来验证新树。

<span id="7-1-Support-通过为什么仍不足以说明-leaf-可用"></span>

#### Support 通过为什么仍不足以说明 leaf 可用

policy ESS 642 衡量的是整个学得 policy 相对于日志行为的权重集中度。它没有保证某个 split 两侧跨足够日期，也没有保证 path-changing fills 足够。一个 leaf 可能有数百 assignment rows，却只有几条真正因一 tick移动而改变 terminal 的路径。

因此 leaf audit 还需要支持日数、两臂 assignment、path-change count、positive/negative terminal delta 与最大单日权重。只报告全局 ESS 会把大量 zero-delta rows 当成精确的 treatment information。

<span id="7-2-什么结果会真正反驳这次关闭"></span>

#### 什么结果会真正反驳这次关闭

不是在相同 100 日上找到更深树，而是在新的、未参与当前假设形成的日期上，事先注册一个不同 state representation 或 intervention，建立稳定的 path-change support，并让 decision-to-terminal reward 的日期聚类下界为正，同时 库存生命周期 cost、tail、fills 与 inventory consistency 不恶化。

如果新项目仍然是 exact BUY add one-tick widen、相同 features 与相同 Development，只改算法名字，它只是对已消费噪声的再次搜索。反之，若动作变为连续 inventory price penalty 或 active-order KEEP/CANCEL，则 treatment 与生命周期已经不同，应独立研究，不能说是“修复这棵树”。

<span id="8-关闭与支持边界"></span>

### 关闭与支持边界

关闭的是 BUY exposure-add 上“baseline vs widen exactly one tick”、35-feature local surface 与冻结 CATE contract。它不关闭 BUY selection research，不证明所有 quote-distance action 无效，也不把 SELL 纳入结论。

这个 family 的合理后续不是“再 widen 0.5 tick”或“等更多日期”，而是寻找真正不同的经济杠杆，例如 active-order keep/cancel、inventory-conditioned price 或可识别外部 fair center，并从 outcome-blind identity 重新开始。

这里的支持结论也有明确范围：99.988% fill retention 证明随机化行为路径没有整体停摆，policy ESS 642 证明 0.5/0.5 logging overlap 可用；它们不证明任何特定 tree leaf 有足够 treatment-effect information。leaf-level 仍受未来日数量、candidate count 与日内相关性限制，所以不能用全局 ESS 为某个小 leaf 背书。

Validation 的 9 日与封存测试的 10 日未读。这里的负结果只约束冻结的 BUY 条件加宽实验，不给实盘动作提供依据。

### 条件策略面对的是 policy learning，不是 subgroup reporting

在Development上先找“widen表现好的rows”，再报告这些rows的收益，会把outcome同时用于定义subgroup和评价subgroup。合法policy learning必须nested：外层fold只评价由更早inner data训练、选择threshold并冻结的policy。每个外层row的action在看到该row outcome前已经确定。

policy value可写为

$$
V(\pi)=E[Y(\pi(X))],
\qquad
\Delta V=V(\pi)-V(a_0).
$$

它与$E[Y(widen)-Y(keep)]$的无条件平均不同。即使平均widen略正，learner若在错误state触发，$\Delta V$也可以为负；反过来，平均action为负也可能存在一个稳定正subgroup。关键证据是chronological OOF policy value与support，而不是某棵树的in-sample leaf means。

### 一 tick分叉的 overlap 该怎样检查

对每个decision row，keep与widen都必须是合法maker quotes，并且queue/lifecycle outcome可由paired replay或随机assignment识别。若widen后价格落到未被市场路径覆盖的深度，candidate outcome更多依赖queue模型；若keep会cross或被risk guard替换，两arms不再是预注册的一tick比较。

支持报告至少应包含：报价确实不同的fraction、两arms都激活的共同机会、fill路径分叉率、distinct days、每个leaf的effective sample、最大单日贡献与inventory-role composition。全局ESS通过不能补救一个被policy频繁选中的稀疏leaf。

### Policy regret 比 leaf 命中率更接近目标

一个selector可能在大多数rows预测action符号正确，却在少数大损失库存生命周期上选错，terminal value仍差。策略学习真正关心相对最好可行动作的regret：

$$
R(\pi)=E\left[Y(a^*(X))-Y(\pi(X))\right].
$$

$a^*$在现实中不可观测，只能通过随机化/paired outcomes和可信模型近似。因此报告应同时给policy value、action frequency、worst-day/tail与fallback；classification accuracy不是替代。

### Hierarchical state 可以减少无边界搜索

BUY add先按库存生命周期 level、inventory magnitude与quote distance形成少量机制层，再在层内用有限features排序，比35维树直接切叶更可审计。层级必须在旧outcomes之外定义，并保证每层有多个日期与两动作support。

若粗层没有任何稳定异质性，增加细粒度feature大概率只提高过拟合自由度；若某粗层稳定，再在新数据上细化。这种先机制、后模型的顺序能把“树没学好”的无限借口变成可停止的研究程序。

## 结论：报价变化为何未形成稳定收益

固定 grid 的 winner 只是选择机制的输出，不能说明离开原样本后仍成立；随机化局部动作解决了 counterfactual，却暴露出不同日期与不同 side 的异质性；条件模型试图利用这种异质性，又败在 chronological OOF 的稳定性与终局下界。研究不是没有产生信息，而是把“参数有效”逐步缩窄为“动作必须在可执行支持上改善完整路径”。

这些结果限制的是各自已测试的配置、动作与条件规则，不是所有固定参数或报价控制。新问题可以继续比较，但应记录已使用样本，并预先确定候选、执行假设与评价范围。新 Tardis 的有限固定参数比较和后续离线研究参照见[公开 F01 主报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f01_fixed_parameter_racing/README.zh-CN.md)；历史 g 是联动实验轴标签，不是当前配置键。研究参照的选择也不等于实盘参数或独立样本外确认。

## 公开方法与实验报告

各报告分别保留自己的数据、动作、日期和撤回范围。

- [F01 Fixed Parameter Racing README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f01_fixed_parameter_racing/README.md)
- [固定参数策略研究族关闭报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f01_fixed_parameter_racing/docs/fixed_parameter_strategy_family_closed.md)
- [Paired Screen v2 Architecture](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f01_fixed_parameter_racing/docs/paired_screen_v2_architecture_20260727.md)
- [`side_specific_action_uplift_existing_split_20260718.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/docs/side_specific_action_uplift_existing_split_20260718.md)
- [`F09 README`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/README.md)
- [`historical_backtest_evidence_revalidation_20260720.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/historical_backtest_evidence_revalidation_20260720.md)
- [`buy_add_conditional_widen_causal_v4_v1_20260718.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/docs/buy_add_conditional_widen_causal_v4_v1_20260718.md)
