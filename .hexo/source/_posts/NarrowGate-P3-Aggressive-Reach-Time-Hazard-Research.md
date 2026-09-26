---
title: 'NarrowGate Empirical P3：从十秒触达曲线到 Reach-Time Hazard 与报价价值'
date: 2026-08-29 13:30:00
updated: 2026-08-30 02:02:00
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


Last materially modified: 2026-08-30


## 1. P3 研究真正经历了什么

P3 的主问题不是“能不能拟合一条好看的概率曲线”，而是：在决策时刻、给定 side、报价距离与当时市场状态，未来价格何时会主动触达该坐标；这个 first-passage 概率能否经过策略可见时钟、queue/lifecycle 与终局价值，最终支持一个报价动作？归一化 100ms 复现、source-aware 扩样本、波动率条件面、标量报价 adapter、policy-visible transport、joint quote value 和 reach-time hazard 都是这一个问题的连续阶段。

统一 estimand 从固定期限的

$$
P_{\mathrm{touch},s}(H,d\mid X_t)=P(T_{\mathrm{reach},s}(d)\le H\mid X_t)
$$

扩展为完整的条件到达面

$$
F_{\mathrm{reach},s}(u,d\mid X_t)=P(T_{\mathrm{reach},s}(d)\le u\mid X_t),
$$

但它始终不是 $P(\mathrm{fill})$，也不是 GLFT 的 execution-intensity slope $\kappa$。touch/reach 之后还隔着订单是否提交、是否激活、队列位置、撤改、竞争风险、成交后 selection 和库存终局。此前把整条研究拆成六篇，反而遮蔽了最重要的结论：预测层确有进步，两个报价映射却都没有获得动作价值。

## 2. 研究阶段与证据状态

| 阶段 | 它真正问什么 | 结论/权限 |
|---|---|---|
| 归一化 100ms 复现 | 固定十秒 P(touch) 在严格盘口坐标上是否稳定？ | 曲线复现；只获得 touch 证据 |
| Source-aware 静态扩样本 | 更多来源与日期能否共享同一静态曲线？ | 历史 transport 变差；replacement 关闭 |
| 波动率条件面 | 条件状态能否改善概率校准？ | prediction supported；门槛覆写非独立确认 |
| 标量报价 adapter | 能否把 BUY/SELL 曲线压成 delta_star/kappa_eff 接旧 ABI？ | 报价收窄、fills 增加、终局恶化；adapter 关闭 |
| 策略可见时钟 transport | 条件面能否在真实报价坐标和可见时钟上保持质量？ | 预测门通过；天数/fold 与 feature-state 支持不足 |
| 联合报价价值 | 完整 BUY/SELL 曲线能否直接选择 joint quote？ | 126 个 OOF bucket 全选 baseline；selector 关闭 |
| Reach-time hazard successor | 能否从固定十秒改为完整 first-passage time surface？ | Development prediction 通过；无 queue/fill/action 权限 |

## 3. 归一化 100ms 复现

### TL;DR：曲线复现了，但这只证明 `P(touch)` 稳定

NarrowGate 的经验 P3 是一个很容易被误读的量。它估计的是：从当前同侧最优价出发，side-correct aggressive flow 在固定时间内是否到达距离 $d$。它不是订单进入队列后的 fill probability，不包含 queue priority、cancel/refill，也不回答成交以后是否赚钱。

当历史 BBO 从 mixed-cadence 目录迁移到统一的 normalized 100ms identity 后，项目保留原来的 117 日 chronological split 和 aggTrades 输入，只替换 BBO 根并重新拟合 5 秒与 10 秒曲线。结果非常稳定：`delta_star` 完全不变，`kappa_eff` 相对变化不超过约 0.2%，日/side touch-rate 的新旧相关性至少为 `0.99995`。

这个结果支持“经验触达曲线在正确 BBO 身份下可复现”，却不恢复任何旧 queue、fill、campaign 或 action-uplift 数字，也没有自动修改 live artifact。它是一篇数据身份与 estimand 边界都很清楚的校准研究。

![归一化前后 P3 触达概率曲线](/images/narrowgate/p3-normalized-100ms-recalibration-curves.svg)

*图 1：冻结聚合结果示意。normalized 100ms 重建前后的 10 秒触达曲线几乎重合；图强调的是曲线身份稳定，不是订单 fill 或 PnL。*

本文只讨论公开历史研究证据，不建议任何真实交易行为。

### 1. 研究问题

历史 P3 曲线曾使用一个混合了一秒与 100ms 容器的 BBO 根。即使输出数值看起来合理，只要输入 manifest 不再是当前研究允许的盘口身份，就必须重新回答：

> 保持日期、aggTrades、窗口、估计器和 split 全部不变，只把 BBO 换成 normalized 100ms v2，经验 touch curve 是否发生实质变化？

这不是“寻找更优 P3”，也不是参数 sweep。它是同一 estimand 在修复后输入身份上的复现检验。

### 2. 输入、输出与 estimand

设 $b_s(t)$ 是 side $s$ 在窗口起点因果可见的同侧最优报价，$R_s(t,H)$ 是未来 $H$ 秒内 side-correct aggressive flow 相对该报价达到的最大距离。触达标签可以写成：

$$
Z_{s,d,H}(t)=\mathbf 1\{R_s(t,H)\ge d\}.
$$

P3 曲线估计：

$$
P_{touch,s}(d;H)=P\bigl(Z_{s,d,H}=1\bigr).
$$

历史 runtime 需要两个标量摘要。`delta_star` 是距离收益代理 $dP_{touch}(d)$ 的网格最大点；`kappa_eff` 是该点附近 log-probability 对距离的局部斜率：

$$
\delta^*=\arg\max_d dP_{touch}(d),
\qquad
\kappa_{eff}\approx-\frac{\partial\log P_{touch}(d)}{\partial d}\bigg|_{d=\delta^*}.
$$

这两个量的单位分别是 `USDC/BTC` 与 `(USDC/BTC)^-1`。`delta_star` 不是 tick 数，`kappa_eff` 也不是订单到达率。

### 3. 数据与因果时钟

比较覆盖同一 117 个 UTC 日：69 train、24 validation、24 test。每个窗口只使用起点已经可见的 BBO；官方 aggTrades 提供未来窗口内的 side-correct reach label。BBO 与 trades 文件一一绑定，窗口不跨日借用未来状态。

这个 estimand 不需要 native queue，也不需要 D−1 完整 L2 warmup，因为它不会从前一日恢复活动订单或盘口队列；每个非重叠窗口只从自己起点的 last-known BBO 开始。这个便利只属于 F02 touch study，不能外推给 full-path replay。

100ms 还只是观察网格，不是事件发生网格。若某次盘口在两个 snapshots 之间先向外移动又恢复，起点坐标只采用窗口开启时最后已知的 snapshot；未来 reach 则由逐笔 aggressive trades 判断。这样避免拿未来 snapshot 修正起点，却也意味着研究没有重建 snapshot 间的完整 book path。曲线复现回答的是同一离散观察合同下的稳定性，而不是证明任意毫秒时刻的 touch 都被逐事件捕获。

### 4. 研究演进：只换输入身份，不换问题

旧版 mixed-BBO artifact 被视为 superseded，不是因为数值一定错得很大，而是因为输入 manifest 不再满足当前研究身份。

normalized-100ms v2 保持原 split、aggTrades、距离网格和估计器不变，并分别生成 5s 与 10s artifact。它没有在看到结果后调 horizon、改 grid 或挑 favorable days。

后来的 source-aware v3、volatility-conditioned v4 和 reach-time hazard 是新的问题：它们分别改变 source pool、条件状态或 estimand。那些版本不应被误写成这次复现的“实现更新”，也不应反过来篡改 v2 的历史结论。

### 5. 一个 10 秒窗口到底发生了什么

假设 12:00:00.000 的 BUY-side best quote 是 `99,986 USDC/BTC`，mid 是 `100,000`，研究要检查距离 14 USDC/BTC。窗口冻结起点后，程序观察接下来十秒内能够把价格向 BUY maker 不利方向推进的 aggressive flow；如果 reach 超过 14，标签为 1，否则为 0。

这个标签与“挂在 99,986 的真实订单是否成交”不同。真实订单还要考虑它何时提交、何时 ACK、前面有多少 queue、同价位期间有多少成交量、是否被 cancel、盘口是否 refill，以及一次 touch 是只碰到价格还是消耗到本单。因此同一个窗口可以出现 `touch=1, fill=0`，也可以在其他机制下出现较早 fill。

normalized 100ms BBO 的作用，是给每个窗口一个稳定、可审计的起点坐标。它把不一致 cadence 的历史容器换成统一快照语义，却没有把 100ms snapshot 伪装成逐事件 queue truth。

| 层级 | 本研究使用 | 本研究不声称 |
| --- | --- | --- |
| 起点报价 | normalized 100ms last-known BBO | exact active-order queue |
| 未来标签 | official aggTrades 的 side-correct reach | order fill、cancel 或 campaign outcome |
| 时间边界 | 5s/10s 非重叠窗口 | 最优自然 horizon |
| 输出 | distance curve、`delta_star`、`kappa_eff` | 可直接执行的 quote action |

### 6. 为什么“几乎一样”仍然要生成新 artifact

在研究治理里，artifact identity 不是用肉眼比较几个参数决定的。旧 mixed-BBO 与 normalized-BBO 即使给出几乎相同的 `delta_star`，也绑定不同的 source manifest；后续研究若使用旧文件，就无法证明自己的输入来自当前允许的数据身份。

可以把这件事类比成两份内容相同但签名来源不同的测量报告。数值接近说明结论稳健，不能让旧报告自动获得新报告的来源证明。当前研究应引用 normalized artifact；旧 artifact 只保留历史 reproduction 身份。

这也解释了为什么 SHA256 只是一种完整性元数据。它能证明“我拿到的是哪一组 bytes”，不能告诉公共读者这些 bytes 在哪里，也不能替代对 event type、horizon、distance unit 和 source clock 的文字说明。

### 7. 冻结结果

5 秒 `delta_star` 在新旧身份下都是 `10.999128 USDC/BTC`，10 秒都是 `13.999086 USDC/BTC`。

5 秒 `kappa_eff` 从 `0.08311357` 变为 `0.08325351`，相对变化 `+0.168%`；10 秒从 `0.06743811` 变为 `0.06735643`，相对变化 `-0.121%`。

训练集在 `delta_star` 处的 probability 变化不足 `0.02%`；test probability 在两个 horizon 上都改变不到 `0.00006`。按 day/side 分格，best price、10 USDC 与 20 USDC 阈值的新旧 touch-rate 相关性至少 `0.99995`，平均绝对日差约 `0.00022–0.00049`。

因此可以说，旧曲线形状在正确的 normalized 100ms BBO 身份上独立复现到约 0.2% 范围内。但旧 artifact 仍不能继续作为当前研究输入，因为“数值接近”不等于“manifest 相同”。

结果还提供一个有用的反事实。若旧 mixed-cadence BBO 是 P3 数值的主要驱动错误，那么修复后 `delta_star`、slope 或分侧触达率应出现系统性移动；实际没有。这把后续注意力从“BBO cadence 让 P3 完全失真”转向更准确的问题：即使 touch curve 本身稳定，把它当作 fill intensity 或 quote optimum 是否合理？后来的 scalar-adapter 研究正是在这个边界上给出阴性经济结果。

稳定性也不是永恒属性。这里冻结的是 117 日、5s/10s、unconditional curve 与同一 aggTrades source。改变年份、引入条件状态、扩展到 30 秒或切换 receive-time source，都会产生新的估计问题，不能引用本次 0.2% 复现作为普遍保证。

### 8. 不确定性与替代解释

这次报告主要比较曲线参数、概率点和日/side rate，而不是为“新旧差恰好为零”建立一个 promotion test。它最强的证据是跨 117 日、多个距离阈值都高度一致；最弱的地方是，它不告诉我们市场 regime 改变时 unconditional curve 是否 transport。

另一个替代解释是，100ms sampling 对十秒 reach label 本来就不敏感：窗口内只要发生明显 aggressive move，起点附近几十到几百毫秒的小差异可能很少改变是否最终跨过距离。这不是缺陷，而是 estimand 的性质；它同时说明本研究不能用于证明 subsecond queue mechanics 已经精确。

因此后继若研究 placement 或 active-order value，应使用符合其问题的 native snapshot/delta、individual trades、decision/feature-ready clocks 和 lifecycle identity，而不是借用本次 P3 稳定性跳过自己的数据门。

### 9. 支持边界与没有获得的权限

本研究支持：固定 5s/10s 经验 touch curve 对 mixed-to-normalized BBO 修复不敏感；normalized artifact 是后续研究应绑定的正确输入身份。

它不支持：touch 等于 fill、局部 log-slope 等于 fill intensity、曲线能优化 quote、更多 touches 会改善 PnL、旧 queue/campaign 证据被恢复。

本次校准没有 quote action、artifact replacement、Validation 晋级、sealed holdout、shadow 或 live 权限。任何把 P3 映射到报价的研究，都必须另行冻结 mapping 和 full-path economic A/B。

### 深入推导：一条十秒触达曲线隐含了什么

对固定报价距离 $\delta$，令首次触达时间为 $T_\delta$。十秒 P3 曲线报告的是累积分布的一点：

$$
P_{10}(\delta)=P(T_\delta\le 10\text{s}).
$$

如果把时间离散为 100ms bucket，并令 $h_k(\delta)$ 为在此前尚未触达时第 $k$ 个 bucket 首次触达的条件概率，则：

$$
P_{10}(\delta)=1-\prod_{k=1}^{100}\left(1-h_k(\delta)\right).
$$

所以同一条十秒曲线可以由许多完全不同的时间结构产生：一种市场可能在前 500ms 集中触达，另一种可能把相同总概率均匀分散在十秒内。二者对 1 秒决策、5 秒订单寿命和撤单时钟的意义并不相同。v2 recalibration 证明固定 horizon 的聚合曲线在规范化盘口下稳定，却没有识别这 100 个 hazard bucket。

距离维度也一样。合理曲线通常满足 $\delta_1<\delta_2\Rightarrow P_{10}(\delta_1)\ge P_{10}(\delta_2)$，但单调性只是一种 shape constraint。它不能告诉我们触达后前方 queue 有多少、是否轮到自己的订单、成交后价格是否继续穿越，更不能告诉我们未成交的机会成本。

![P3 从触达到完整动作价值的 estimand 阶梯](/images/narrowgate/f02-p3-estimand-ladder.svg)

*图 2：`P(touch)`、reach-time hazard、queue-conditioned fill、fill value 与 campaign action value 是五级不同 estimand。v2 位于第一级。*

### 一个数值例子：同样的 P3，不同的执行价值

假设离 mid 0.5 USDC 的 BUY quote 在十秒内有 40% 触达概率。场景 A 中，盘口前方只有很小队列，触达后本单有 70% 概率成交；场景 B 中，前方深度很厚，成交概率只有 10%。即便忽略撤单，两者的粗略成交概率已经分别是 $0.4\times0.7=28\%$ 与 $0.4\times0.1=4\%$。

再假设 A 的成交多发生在单边下跌开始时，成交后 30 秒 maker-signed value 均值为 -0.8 USDC；B 的少量成交主要发生在均值回归阶段，均值为 +0.3 USDC。相同的 P3 可以对应完全不同的 fill value。把 40% 直接叫作 fill probability，或把它压成一个“有效 $\kappa$”，会同时丢掉 queue conversion 与成交条件价值。

这个例子也说明 recalibration 的正确用途：它可以检查“给定距离，市场多久会走到这里”，可以作为报价可达性、订单寿命和 support 设计的输入；它不能单独决定应该把报价放在哪里。报价动作至少需要联合：

$$
V(\delta)=P(\text{fill}\mid \delta, X)\,E[Y_{fill}\mid \text{fill},\delta,X]
-C_{queue/cancel}(\delta,X)-C_{inventory}(\delta,X).
$$

其中任何一项缺失，都不能由更精确的 $P(touch)$ 替代。

### 为什么 identity drift 会改变曲线而不仅是小数位

100ms 规范化不仅改变文件路径。它固定了 book snapshot 的时间边界、档位深度、价格与数量单位、缺失 bucket 的处理、跨日 warmup 和 source-day admission。若旧数据在某些时段更稀疏，距离较近的触达可能被低估；若时间标签提前，未来价格变化会被错误归入当前窗口，曲线可能被高估。

因此“新旧曲线几乎重合”并不意味着 recalibration 多余。它表示在更严格 identity 下，一个旧形状获得了新的、可审计的支持；同时也把不允许继承的部分说清楚：旧 artifact 的 hash、面板与本地路径不能继续充当现行证据，旧报价 adapter 的经济结果也不会因为曲线相近而自动恢复。

### 复算视角：怎样从 BBO 路径得到一条不偷看未来的 P3 曲线

对每个决策起点 $t$，先用当时可见的 best bid/ask构造参考价 $m_t$。BUY 与 SELL 必须分开定义未来的aggressive reach：BUY报价关注未来卖压是否把可成交边界推到$m_t-\delta$，SELL报价关注未来买压是否推到$m_t+\delta$。在半开窗口$[t,t+H)$内，只要对应边界首次达到目标距离，label就是1；否则在数据覆盖完整的前提下记0。

真正困难的不是写出indicator，而是保证三个分母一致。起点必须有合法BBO；整个forward horizon必须有足够覆盖；day-end不足$H$的尾部不能被当作“未触达”。若不同distance使用不同可用rows，曲线单调性可能只是分母变化造成。规范化recalibration应让同一起点的整组distance labels共享coverage decision，再在day与side内聚合。

静态曲线可以用生存函数理解。对连续距离$D_H=\max_{u\in[t,t+H)}|m_u-m_t|$，有

$$
P_H(\delta)=P(D_H\ge\delta)=1-F_{D_H}(\delta^-).
$$

因此它本质上是未来最大位移的尾分布，而不是订单成交通道。这个表述还提供了一个直接复算方法：先对每个起点求未来最大有向位移，再对各距离阈值计算经验生存率。若离散tick、side符号和窗口边界都固定，曲线应随$\delta$单调不增、随$H$单调不减。

### 稳定曲线仍可能在策略中失效的三种路径

第一种是寿命错配。十秒P3被用于一秒后就会撤换的订单时，真正相关的是$P(T_\delta\le1s)$，不是$P(T_\delta\le10s)$。第二种是queue错配：价格触达并不意味着排在前面的数量已经耗尽。第三种是value错配：成交恰好可能发生在最不利的价格延续阶段。

这三种路径说明recalibration的“几乎不变”应怎样使用：它允许后续研究把normalized v2作为稳定的reachability baseline，不需要把所有失败归咎于BBO cadence；它不允许把稳定性扩写成策略有效性。若一个quote adapter失败，应该检查估计量映射、订单寿命和fill条件价值，而不是重新宣称P3曲线本身不可靠。

### 一条 100ms 路径的逐格标注

假设BUY侧起点mid为60,000.0，未来十秒的最低可见ask依次到达59,999.8、59,999.3、59,998.9后反弹。对$\delta=0.5$，首次触达发生在ask不高于59,999.5的第一个bucket；对$\delta=1.0$，发生在不高于59,999.0的bucket；对$\delta=1.5$则整个窗口censor为未触达。三个labels共享同一条路径，而不是三次独立观测。

若在中间有500ms source gap，不能简单用下一张snapshot把整个gap解释成连续价格路径。最保守做法是按预注册freshness/coverage规则把该起点从所有距离分母删除；若只删远距离label、保留近距离，就会让曲线的不同点基于不同样本。day end最后十秒同理：没有完整未来窗口不是负例。

BUY与SELL也不能把absolute move共用后再随手乘负号。BUY reach用下行边界，SELL reach用上行边界；spread与tick rounding可能让两侧可执行距离不同。规范化曲线要先在side内估计，再决定是否用共享参数汇总。

### `delta_star` 与 `kappa_eff` 的统计不确定性

`delta_star`常由曲线跨过某个固定概率的位置插值，`kappa_eff`由选定区间的log slope得到。二者不是原始观测：一个cell概率的小变化，在曲线很平时可能造成较大的交点移动；clipping与grid边界也会让估计非光滑。

因此新旧artifact比较不应只给两个点参数，还要比较整条曲线、day/side cells与source-overlap。若参数近似相同而局部实际报价区间差异较大，策略仍可能改变；反之，远端小概率cell差异即使相对百分比很大，也可能与实际quote无关。

一个更严格的bootstrap会按日重采样整条曲线，每次重新计算$\delta_\star$与$\kappa_{eff}$，保留它们的联合变化。不能把数百万重叠100ms windows当独立样本，否则置信区间会虚假狭窄。

### 复算时最容易混淆的五个字段

第一是reference price：mid、weighted-mid proxy还是某侧BBO。第二是distance单位：USDC/BTC、ticks还是bps。第三是horizon：5秒/10秒及半开端点。第四是time identity：exchange snapshot还是策略ready。第五是event object：价格触达、aggressive trade reach还是本单fill。

只要这五项没有写在artifact contract里，即使SHA吻合，读者也无法判断曲线语义。本文把v2定位在normalized BBO的固定horizon price-touch层，就是为了让后续hazard、queue与action项目能明确知道自己在此基础上增加了什么，而不是不断复用一个含糊的P3名字。

### 10. 公共证据

- [F02 Empirical P3 Touch README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/README.md)
- [P3 Touch Recalibration on Normalized 100ms v2](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_touch_recalibration_normalized100ms_v2_20260725.md)

大型输入文件、artifact 和逐日报告位于不随公共仓库分发的证据存储中；公开文档提供可审计的聚合结论与权限边界。

## 4. Source-aware 静态扩样本

### TL;DR：更多数据不等于更好的同一条曲线

P3 source-aware expanded v3 把 93 个 provider-normalized 2025 日加入 69 个 2026 current-train 日，希望得到一条更稳健的统一 10 秒 touch curve。数据本身通过了 source admission，2026 current curve 也被精确复现；失败发生在模型假设：把两个年份、两种 source identity 和不同 regime 池化成同一条静态曲线，并没有稳定 transport 到 2026。

在历史 validation 上，expanded v3 的 integrated Brier point estimate 变差；在 late diagnostic 上虽有小幅改善点估计，区间仍跨零。更直接的 44 日 native full quote-path diagnostic 中，expanded v3 把平均 raw half-spread 收窄约 11.23%，fills 增加 14.27%，却让 terminal MTM 相对 current v2 下降 `36.5138 USDC`。

因此项目关闭的是“2025+2026 pooled static replacement”，不是外部 provider 数据，也不是条件 P3。93 日 reach cache 与 source-specific curves 被保留，后继问题改成让 probability 显式依赖 volatility、side、spread 和 regime。

![静态 P3 池化如何收窄报价并改变成交路径](/images/narrowgate/p3-source-aware-static-quote-path.svg)

*图 1：机制示意。跨 regime 池化后，静态曲线给出更陡的局部斜率，quote band 变窄、fills 增加，但完整库存与 campaign 路径可能更差。图不是实盘 K 线。*

本文只讨论历史 Development 与 diagnostic evidence，不构成任何交易建议。

### 1. 研究问题

v2 的静态曲线主要来自 2026 数据。F02 随后获得了 93 个通过 provider normalization 的 2025 日，于是一个自然问题是：

> 在 estimand 与估计器不变的前提下，把 2025 和 2026 合并拟合，能否降低 2026 历史面板上的 proper score，并在完整 maker path 上不伤害经济结果？

这里的关键不是样本量，而是 transport。若 2025 与 2026 的 touch geometry、volatility mixture 或 source translation 不同，pooled estimator 可能更精确地估计一个并不适用于当前 regime 的平均值。

### 2. 输入、候选与 estimand

基础 estimand 仍是：

$$
P\bigl(\text{side-correct aggressive flow 在 10s 内触达距离 }d\bigr).
$$

研究比较两条静态曲线：

$$
P_{v2}(d)=\widehat P(d\mid 2026\ train),
$$

$$
P_{v3}(d)=\widehat P(d\mid 2025\ provider\cup 2026\ train).
$$

预测层的 primary score 是在完整距离网格上均匀积分的 Brier：

$$
IBS=\frac1{|D|}\sum_{d\in D}\frac1N\sum_i\bigl(Z_i(d)-\hat P_i(d)\bigr)^2.
$$

经济层不把 Brier 当作 action value，而是只替换 P3 artifact，保持模型、queue、latency、cooldown、inventory 和 safety mechanism 相同，运行 current v2 与 expanded v3 的完整 quote path。

### 3. 面板与因果时钟

Development fit 使用 93 个 2025 provider 日；current reproduction 与 fit 使用 69 个 2026 日。已经读取过的 24 日 historical validation 和 24 日 historical test 只作为 transport diagnostics，不是独立确认。

2025 provider BBO 与 2026 normalized native BBO 都按各自 causal source contract 在窗口起点可见；官方 BTCUSDC aggTrades 给出 10 秒 reach label。因为是同日起点触达 estimand，不要求 D−1 native book warmup。

另有 44 个历史 native 日用于 full quote-path diagnostic。这 44 日已经是历史 Development/diagnostic evidence，不能被描述成 sealed holdout。

### 4. 研究演进：先验证数据，再拒绝静态池化

第一步冻结 93 日 source manifest，确保 provider 数据不是看见 outcome 后挑选的“好年份”。2026 train curve 与 current v2 的 probability grid 最大差异为零，说明数据迁移没有改变 estimator。

第二步拟合 2025-only、2026-only、pooled，以及 BUY/SELL 分侧曲线。2025 的 BUY/SELL 静态形状接近，排除了一个简单的 side coding bug，却同时暴露出年份间 level/slope 差异。

第三步打开已声明的 2026 historical proper-score panels。最后才运行只切换 P3 的 full quote path，检查概率变化是否真正传入 quote coordinates、fills、inventory 与 terminal value。

整个过程没有在读到结果后调 source weight、删日期或挑一个 favorable distance。

这里也解释了为什么 v3 是独立研究项目，而不是 v2 的“数据追加版”。v2 只问同一 117 日 estimand 在修复 BBO identity 下能否复现；v3 改变了拟合总体，把 2025 provider 与 2026 native 混合，并预先要求向 2026 panels transport，还增加了 full-path economic diagnostic。sample、candidate、estimand contract 和证据用途都发生了实质变化。

反过来，day manifest、quote-path Spec 与执行 report 并不是三个项目。manifest 冻结日期，Spec 冻结比较，report 执行同一问题；它们应成为一篇文章的数据、方法和结果章节。

### 5. 预测结果

2025 provider curve 使用约 `1.607M` windows，`delta_star=13.800048`、`kappa_eff=0.09021619`；2026 current train 使用约 `1.188M` windows，`delta_star=13.999086`、`kappa_eff=0.06735643`。pooled curve 的 `kappa_eff=0.08195513`，明显更接近更陡的 2025 结构。

以 `Brier_expanded-Brier_v2` 表示差值，historical validation 的 mean delta/day 是 `+0.00025709`，95% day-clustered interval 为 `[-0.00021786,+0.00074713]`；late diagnostic 是 `-0.00021497`，区间 `[-0.00053257,+0.00009091]`。两个面板都没有形成稳定 transport pass，validation 的 BUY 与 SELL point estimate 均变差。

### 6. 完整报价路径结果

44 日 full-path 中，current v2 terminal MTM 为 `-124.7455 USDC`，expanded v3 为 `-161.2593 USDC`，候选差值 `-36.5138 USDC`。fills 从 `15,248` 增加到 `17,424`；inventory time 增加 `2.58%`。

mean raw half-spread 从 `23.6635` 收窄到 `21.0063 USDC/BTC`，mean final pair spread 从 `50.6266` 收窄到 `45.2073`。P3 floor binding rate 从 `26.65%` 升到 `33.27%`。

Development 的平均日 PnL delta 为 `-0.6475 USDC/day`，区间 `[-1.7420,+0.5050]`；late diagnostic 为 `-1.0122 USDC/day`，区间 `[-1.7435,-0.3039]`。44 日中仅 13 日为正。

这说明 source expansion 不是一次无害的 `delta_star` 微调。两条路径第一次出现不同 fill 后，库存与后续机会也会分叉；matched quote diagnostics 只能证明机制强度，完整价值仍必须由 full path 给出。

一个直观例子是：pooled curve 的 slope 更陡，使普通状态的报价向内十几或几十 ticks。开始几次 fill 可能只是活动增加，但一次新增 exposure-increasing fill 会改变库存偏斜，随后 reducing side 与 adding side 的报价不再与 baseline 同步；后续同一市场事件便作用在不同 campaign state 上。把每次 matched quote difference 乘一个静态 markout 再相加，会漏掉这种顺序反馈。

44 日结果中，99.27% 的 matched prices 已发生变化，平均绝对差约 29.74 ticks。这证明候选 action strength 很强，却不是 same-state causal effect：matched rows 只在两条路径仍有共同 timestamp/side 时存在，不能为分叉后消失的机会构造虚假配对。

不确定性也有两层。Development interval 跨零，说明仅凭该段不能排除日级方向变化；late diagnostic interval 完全为负，提供更强的历史反证。但两者都已经是历史已读 panels，所以不能再通过调 source weights 或选择性丢弃日来搜索一个“能过”的 pooled curve。

### 7. 关闭与支持边界

支持：93 个 2025 provider 日可用于 F02；source-specific reach cache 和曲线具有后续研究价值；年份与 regime 条件不能被忽略。

关闭：`p3_touch_source_aware_expanded_v3` 作为统一静态 replacement。不得在已读 24+24 日上调 source weight、重选 distance 或只跑 favorable dates。

未关闭：volatility-conditioned、side-specific 或 reach-time surface。研究后继应更接近：

$$
P_{touch}\left(d,\frac{d}{\sigma_{price}\sqrt H},side,spread,regime\right).
$$

本项目没有 artifact replacement、quote/action、Validation 晋级、shadow 或 live 权限。

### 深入推导：扩样本为什么会制造 Simpson 型错觉

静态 pooled 曲线隐含一个很强的假设：所有来源和日期共享同一个距离—触达关系。若来源 $s$、日期状态 $z$ 下的真实曲线为 $p(\delta\mid s,z)$，pooled 估计实际是：

$$
p_{pool}(\delta)=\sum_{s,z}w_{s,z}(\delta)\,p(\delta\mid s,z).
$$

关键在于权重 $w_{s,z}(\delta)$ 也可能随距离变化。高波动日会产生更多远距离可观测样本，稀疏来源可能只在某些时段完整；于是近端和远端不是同一组 regime 的平均。即使每个来源内部都满足稳定单调关系，混合后的斜率仍可能改变，甚至让旧样本上的最佳参数在扩样本后反转。

这不是“更多数据把信号冲淡”这么简单。更多数据提高了对目标混合分布的精度，但如果目标本身被错误地定义为一个无条件 pooled population，估计会更精确地回答错误问题。source-aware v3 的价值在于让这种异质性显性化，并要求任何 replacement 都在冻结的 common rows 上与旧模型比较。

![P3 的 estimand 阶梯与双时钟边界](/images/narrowgate/f02-p3-estimand-ladder.svg)

*图 2：扩充来源只扩大第一级 `P(touch)` 的支持；它不会跨过 queue、fill value 与 action value 的边界。*

### 一个合成例子：两类日期如何改变静态曲线

假设 quiet days 占旧面板 80%，离 mid 1 USDC 的十秒触达率为 10%；volatile days 占 20%，同距离触达率为 60%。旧 pooled 值是 20%。扩样本以后，volatile days 因来源覆盖改善占到 50%，pooled 值变成 35%。模型没有“坏掉”，它只是面对了不同的日期混合。

若训练时把这种变化解释为全局 $\kappa$ 下降，报价会在所有日期一起向内收；quiet days 于是被过度激进地报价，volatile days 又可能仍然没有正确反映尾部。正确做法不是再找一个折中的静态常数，而是把 source、volatility、age 或其他决策时可见状态放进条件曲面，并在完全相同的日期权重下比较增量。

同一原则也适用于训练和评价。逐行 pooled log loss 会让高频、完整、活跃日期支配结果；逐日配对指标则把每个 UTC day 作为 cluster。若研究目标是跨日迁移，后者更接近问题本身：

$$
\Delta=\frac1D\sum_{d=1}^D\left[L_d(M_0)-L_d(M_1)\right],
$$

而不是把所有 rows 混在一起后计算一个看似精确的小数。

### 从预测 replacement 到报价 replacement 还缺哪座桥

v3 的静态 replacement 失败，不能被表述成“P3 没用”。它只说明新的 pooled static curve 没有在冻结 prediction 与完整报价路径上成为更好的替代。若条件模型改善 log loss，还需要单独回答三件事：第一，改善发生在哪些 distance/horizon cells，是否位于实际报价支持内；第二，queue conversion 与 fill value 是否同向；第三，把曲面映射为报价动作时是否保留了这些异质性。

因此后继研究分成 volatility-conditioned surface、policy-visible transport、reach-time hazard 与 quote mapping，并不是把一个失败项目拆碎；它们分别补不同缺口。source-aware static v3 关闭的是“扩大数据以后仍用一条全局曲线替换 v2”的路径。

### Source-aware 不应只是在模型里加一个来源类别

把`source`作为一个categorical feature，仍可能掩盖transport问题。若来源A只覆盖早期年份、来源B只覆盖后期年份，source与regime、spread、volatility和market design几乎共线；模型可以在样本内识别source，却无法知道未来目标环境属于哪种结构。真正的source-aware设计至少要区分三个问题：同一日期重叠区间的measurement parity、不同日期上的distribution shift，以及目标策略decision surface上的economic transport。

重叠日可以估计同一市场路径被两套采集系统观测后的差异。非重叠日只能描述来源与时期的联合变化，不能把差异单独归因给provider。即使prediction transport通过，报价replacement仍需要在共同full-path denominator上比较，因为两条曲线会通过不同fill路径改变后续库存。

一个更安全的层级模型写法是

$$
\operatorname{logit}p_{d,s}(\delta)
=
\alpha_d+\beta_s+f(\delta)+g_s(\delta)+h(X_d,\delta),
$$

其中$\alpha_d$吸收日级regime，$\beta_s$只表示来源层偏移，$g_s$允许来源与距离交互，$h$处理决策时可见状态。模型还必须在source-overlap与future-source panels上分别报告calibration；如果只在pooled rows上优化，较大来源会通过样本量支配曲线。

### 一个 successor 应怎样避免再次得到“更精确的错误平均”

下一代问题不应是“怎样给2025和2026找到最佳混合权重”，因为在已读结果上调权重会形成新的winner’s curse。更好的做法是先冻结目标部署分布：目标年份、side、decision cadence、spread/volatility support与source availability；再把来源只当作measurement layer，要求模型在共同状态上transport。

若目标环境没有source A，A可以帮助估计共享shape，却不能通过训练占比决定目标先验。可以用chronological folds让每个fold只由更早日期训练，并在target-source日期上评分；同时报告按日等权和按决策频率加权的两个estimand。前者回答跨日稳健性，后者回答目标运行中平均一次决策的误差，两者不能混成一个分数。

最后，只有当conditional curve在实际报价支持内改善、queue/fill转换可识别且full-path paired value通过，才有replacement问题。v3的阴性结果把“静态池化”关掉，留下的是更清晰的设计空间，而不是一项等待换权重救活的旧候选。

### 曲线差异可拆成 mixture shift 与 within-state shift

令$Z$表示波动、spread和时段等状态，来源/时期为$S$。两个面板的无条件曲线差可以写成

$$
p_A(\delta)-p_B(\delta)
=
\sum_z\{w_A(z)-w_B(z)\}p_B(\delta\mid z)
+\sum_z w_A(z)\{p_A(\delta\mid z)-p_B(\delta\mid z)\}.
$$

第一项是状态混合比例变化，第二项才是相同状态下的条件关系变化。pooled static v3把两项压成一个参数，所以无法判断斜率差来自更多高波动日，还是market microstructure本身改变。后继conditional surface正是要把这两类变化拆开。

### Overlap-day parity 与跨年 transport 的实验顺序

先在同一日期、同一100ms grid、同一BBO freshness mask上比较两来源，检查价格、touch labels和curve predictions；这一步隔离measurement差异。通过后，再用早期来源训练、后期native日期测试，评估时间transport；最后才在policy-visible decisions和full-path quotes上看经济效果。

若第一步失败，跨年差异无法解释；若第一步通过、第二步失败，问题更像regime shift；若前两步都通过、经济层失败，问题位于curve-to-action mapping。把三步混在一个pooled PnL中，会失去定位能力。

### 为什么“给旧数据较小权重”仍不是自动答案

任何权重$w$都会定义新的目标总体

$$
p_w(\delta)=w p_{old}(\delta)+(1-w)p_{new}(\delta).
$$

在已读Development上寻找最优$w$，等同增加连续超参数；由于full-path response非线性，可能找到一个偶然兼顾若干日期的权重，却没有未来解释。权重应来自目标部署频率、measurement reliability或预先冻结的时间衰减，而不是回测收益。

如果目标明确是当前native market，最自然的主估计应以native日期为target，旧provider数据只通过层级先验或representation training提供信息，并让新数据主导calibration。这样扩样本是在减少方差，而不是改变目标分布。

### 8. 公共证据

- [Source-Aware Expanded v3 Development 报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_touch_source_aware_expanded_v3_development_20260803.md)
- [冻结 Spec](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_touch_source_aware_expanded_v3_spec_20260803.json)
- [公开 day manifest](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_touch_source_aware_expanded_v3_day_manifest_20260803.json)

公开仓库不分发大型 reach caches 与 full-path reports；本文只引用公开报告已经披露的聚合结果。

## 5. 波动率条件面

### TL;DR：模型质量全过，原研究仍然失败；事后改门槛必须留下痕迹

静态 P3 把所有波动环境压成一条 `P(touch|distance)` 曲线。volatility-conditioned v4 改问：同样的 14 USDC/BTC 距离，在平静与剧烈市场里显然不是同一个问题，能否让 probability 同时依赖 raw distance、volatility-normalized distance、side、spread 和 regime？

答案在预测层很强。历史 native OOF 的四个 proper-score cells 全部改善，48 个 calibration cells 全部通过，197,231,404 次距离单调性比较没有一个 violation，provider/native prediction transport 也通过。可原 v4 仍然失败，因为冻结合同要求每个 source-day 至少 98% context coverage，而三天只有 `96.85%–97.74%`。

项目 owner 在读到结果后把 coverage gate 改成 95%，形成 v4.1。没有重训、删日或重算 prediction；同一证据因此通过新门槛。正确写法不是“v4 后来修好了”，而是：**v4 按原合同失败；v4.1 是明确 outcome-informed 的统计合同覆写，只支持已读历史 Development prediction，不是独立确认。**

![平静与高波动状态下的条件 P3 触达面](/images/narrowgate/p3-volatility-conditioned-kline-surface.svg)

*图 1：机制示意。同一报价距离在低/高波动 K 线下对应不同标准化距离与 touch probability；缺失的连续盘口窗口被 censor，不会前向填充。*

本文只讨论历史预测证据，不建议任何真实交易行为。

### 1. 研究问题

source-aware v3 已经说明，把更多年份池化进同一静态曲线不能解决 transport。v4 因而冻结了条件 estimand：

$$
P_{touch}\left(
d,
\frac{d}{\sigma_{price}\sqrt{10s}},
side,
spread,
regime
\right).
$$

它仍然估计 10 秒 aggressive reach，不是 placement fill、queue conversion、order arrival intensity 或 action value。研究问题是 conditional prediction structure 是否优于 current static v2，并满足因果输入、覆盖、校准、单调性和跨 source transport 的完整合同。

### 2. 输入、输出与模型约束

模型输入包括 raw distance、volatility-normalized distance、BUY/SELL、current spread、fast/slow causal volatility 与 causal volatility regime。raw 与 normalized distance 都施加 probability 随距离不增加的约束：

$$
d_1<d_2\Rightarrow \hat P_{touch}(d_1\mid x)\ge \hat P_{touch}(d_2\mid x).
$$

source identity 与 calendar year 只参与 translation/transport diagnostics，不进入 tradable feature vector，避免模型把“这是 2025 provider”本身当作交易信号。

候选与 baseline 的 proper-score 差为：

$$
\Delta IBS=IBS_{conditional\ v4}-IBS_{static\ v2}.
$$

负值表示 conditional surface 更好。它是 prediction estimand；本项目没有报价动作。

### 3. 面板与因果时钟

训练结合 93 个 provider-normalized 2025 日与严格先于测试日的 native 2026 data。48 个已经读取过的 native historical days 被分为四个 chronological 12-day OOF folds；每折 calibration 只使用最后八个严格先前 native days，并共享一个正斜率 Platt transform。

每个 reach window 的 BBO、volatility、spread 与 regime 必须在窗口起点因果可见。真实连续 BBO interruption 会产生 context missing；研究既不 forward-fill，也不插值，更不会在看到 score 后丢掉失败日期。

provider/native overlap 只检验 source prediction transport，不重复加权同一天 outcome。

| 层级 | 冻结时钟 | 证据用途 |
| --- | --- | --- |
| BBO 与 spread | reach window 起点前已可见 | distance 与当前市场坐标 |
| fast/slow volatility | 仅使用起点前历史 | normalized distance 与 regime |
| aggressive reach | 起点之后 10 秒 | prediction label，不能回流 feature |
| provider/native overlap | 各 source 自己的 causal clock | translation/transport diagnostic |
| historical OOF day | 只用严格过去 folds 训练/校准 | Development prediction evidence |

这个表尤其重要：volatility 是条件变量，不是用未来十秒 realized volatility 回填的标签。若在窗口结束后才知道的波动被放入 $x$，模型会获得直接的 future-path clue，Brier 再好也没有策略可见性。

### 4. v4 结果：预测结构通过，完整 identity 失败

historical validation 上，full-distance mean Brier delta/day 为 `-0.00590204`，95% day-clustered interval `[-0.00833032,-0.00412380]`；current-policy support 为 `-0.01393824`，区间 `[-0.02041990,-0.00936985]`。

late diagnostic 对应值为 `-0.00461838` 与 `-0.01105226`，区间同样完全小于零。BUY 与 SELL 在每个 panel/metric cell 上都改善，没有用 pooled score 掩盖弱 side。

48 个支持充分的 calibration cells 全部通过；最大 candidate-minus-current integrated calibration-error delta 为 `-0.00538532`。六个 source-overlap diagnostics 的最大 mean absolute prediction difference 约 `0.001610`，低于冻结的 `0.01` gate。

结构检查共执行 `197,231,404` 次 adjacent-distance comparisons，violations 为零。代表性状态在 `d=14 USDC/BTC` 时给出约 `0.0189–0.2439` 的 touch probability，证明它不是伪装成条件模型的近常数曲线。

然而三天 context coverage 分别只有 `97.5330%`、`96.8497%` 与 `97.7415%`，低于预注册的 98%。缺口是约 11 分钟的真实连续 BBO interruption，不是 cache bug。原 v4 的 canonical decision 因而是 `conditional_v4_prediction_gate_failed_development`。

### 5. v4.1：为什么它是同一篇文章里的新合同，而不是“修复版”

owner 在读取 v4 结果后，把唯一一个字段 `minimum_fraction` 从 0.98 改为 0.95。v4.1 没有重训模型、删除日期、重算 probability 或修改其他 gate；minimum observed coverage `96.849664%` 因而通过。

v4.1 的正确权限是 `historical_development_prediction_supported_owner_coverage_override`。它证明同一 conditional surface 在一个明确披露、较宽松的 coverage contract 下通过；它不洗掉 v4 的原始失败，也不是 prospective 或 independent confirmation。

把 v4 与 v4.1 拆成两篇“成功/失败新闻”会掩盖最关键的治理事实。它们应当作为同一研究演进中的两个统计身份：原门槛结果与事后覆写结果并列展示。

可以用一个简单的门函数说明：

$$
G_c=\mathbf 1\left\{\min_d coverage_d\ge c\right\}.
$$

同一组 predictions 在 $c=0.98$ 时 $G_c=0$，在 $c=0.95$ 时 $G_c=1$。变的是统计合同，不是市场事实。因为 $c$ 在看到 minimum coverage 后才改变，v4.1 的 pass 必须带着 `owner coverage override` 标签，不能被宣传成预注册成功。

同时，missing windows 仍然被 censor。v4.1 不是把缺失补齐，也不是把三天排除；它只是接受每日至少 95% 的可用上下文作为 sufficient support。这种治理选择可以合理，但必须与独立确认严格区分。

### 6. 为什么预测面不能直接成为报价

条件 surface 的输出是 $P_{touch}(d\mid x)$，而 maker 需要比较不同 quote coordinates 的净价值。至少还缺三个环节：touch 后是否轮到本单、fill 的 maker-signed value、以及 fill 对 inventory/campaign 后续路径的影响。

若只因为某个高波动状态的 near-distance touch probability 很高就收窄报价，策略可能恰好在最容易被 adverse flow 穿越的状态增加 fills。相反，简单 widen 又可能删除有价值 repair fills。prediction ranking 不能决定动作方向。

后来的 scalar-adapter full-path test 正好验证了这一点：把 v4.1 压成动态 `delta_star/kappa_eff` 后，报价大幅收窄、fills 大增、terminal value 明显恶化。那个结果关闭特定 adapter，不改变本项目的 prediction evidence，却证明权限分层不是形式主义。

### 7. 支持边界与没有获得的权限

支持：conditional P3 structure 在已读历史 panels 上显著优于 static v2；distance monotonicity、calibration 和 aggregate source transport 均强。

不支持：exact receive-time transport、fill probability、maker value 或 quote action。v4.1 的通过不能自动替换 current v2 artifact，也不能把 conditional curve 压成一个 scalar kappa 后直接输入 AS/GLFT。

本项目没有 artifact replacement、quote mapping、action experiment、Validation、sealed holdout、shadow 或 live authority。经济使用必须另行冻结 curve-to-quote mapping，并用完整 maker path 检验 fills、campaign value 与 tail。

### 深入推导：从一条曲线到条件概率曲面

静态 P3 估计 $p(\delta)$，条件版本估计：

$$
p(\delta,h\mid v,x)=P(T_\delta\le h\mid V_t=v,X_t=x),
$$

其中 $v$ 是决策时可见的波动状态，$x$ 可以包含 side、spread、盘口 age 等冻结协变量。一个可用曲面至少要同时满足三类结构：随距离增大不应系统性上升；随 horizon 增大不应下降；相邻 volatility bins 不应因为样本稀疏出现无法解释的锯齿。模型质量门不只是总 log loss，还要检查 calibration、ranking、support 与 shape violations。

条件化的价值在于区分“同样远”的不同市场。离 mid 1 USDC 在低波动时可能是极远报价，在高波动时却接近下一秒可达范围。若仍用一条静态曲线，模型只能把两种状态平均，既低估高波动触达，也高估低波动触达。

![P3 条件曲面仍位于动作价值阶梯的第一层](/images/narrowgate/f02-p3-estimand-ladder.svg)

*图 2：增加 volatility 条件提高了 `P(touch)` 的状态分辨率，但没有自动增加 queue、fill value 或 campaign 反事实。*

### 一个曲面单元格怎样影响报价，又为何不能直接决定报价

考虑 BUY 侧两个状态。低波动 cell 中，$P(touch\le10s\mid\delta=1)=0.08$；高波动 cell 中为 0.32。若目标只是保持某个触达率，报价器可能在高波动时外移。但这仍有两种相反的经济解释。

第一，高波动状态下触达更容易，同时 adverse continuation 更强，外移可能减少负价值成交；第二，高波动状态也可能伴随更快 repair 与更厚回补，外移反而错过有利成交。P3 只给出路径到达概率，不能判断哪一种占主导。需要把触达概率与条件 fill value 联合起来：

$$
Q(\delta,X)=p_{touch}(\delta,X)\times p_{fill\mid touch}(\delta,X)
\times E[V_{terminal}\mid fill,\delta,X].
$$

实际完整价值还要减去 cancel/re-entry、queue reset 与库存机会成本。任何直接从第一项推出 widen/recenter 的规则，都把未估计部分默认为常数。

### 为什么 v4.1 不能抹掉 v4 的失败

v4 的预注册 gate 包含结果出来前冻结的门槛。结果显示 prediction structure 有价值，但完整 identity 未通过。看到结果以后调整阈值，可以形成一个新的、明确标注 outcome-informed 的 screening contract；它不能把原失败重写成“原来就通过”。

这是多重选择问题。若研究者可以在看到 20 个指标以后任选门槛 $c$，则事件“至少有一个指标超过某个看起来合理的门槛”的概率远高于单个指标的 nominal level。治理上保留 v4 与 v4.1 的关系，是为了让读者知道哪一部分是 prospective、哪一部分是看过结果后的工程判断。

v4.1 因而可以支持 prediction artifact 继续被研究，却不授予 action、Validation 或 live 权限。下一步必须冻结映射和新的证据面板，而不是继续在同一曲面上寻找更好看的阈值。

### 条件曲面的 support geometry

条件模型最容易被总样本量误导。假设总共有数百万rows，但高波动、远距离、SELL侧、长horizon这一cell只出现在两天；它的标准误和regime依赖仍然很大。有效支持应至少同时记录row count、distinct days、日期集中度与相对baseline的overlap。只报全局coverage会让密集的普通状态遮住真正影响报价的稀疏角落。

可以用一个归一化距离帮助理解状态迁移：

$$
z=\frac{\delta}{\sigma_p\sqrt H}.
$$

若价格增量近似尺度稳定，许多波动状态在$z$坐标上会更接近；但maker市场并不保证高斯或独立增量，spread、jump、trade intensity与venue state仍会改变曲面。因此$z$适合作为结构特征或诊断，不应强制所有state collapse成一条universal curve。

shape constraint同样有经济边界。距离单调与horizon单调是路径概率的逻辑约束；volatility单调却不一定成立，因为volatility measure、mean reversion与spread会共同作用。若强行规定“vol越高touch越高”，模型可能在某些regime把真实交互抹平。冻结研究正确地把可证明的distance结构与需要数据识别的state关系分开。

### 从 prediction surface 到 action surface 的最小实验

一个可解释的后继不需要立刻优化连续报价。可以先冻结几个离散quote actions，例如baseline、向外一tick、向内一tick；对每个decision row记录完整P3局部截面、queue state、inventory role与candidate可执行性，再进行paired或有overlap保证的action-value估计。

其目标不是最大化$P_{touch}$，而是比较

$$
\Delta V(a,X)
=
E[Y_T(a)-Y_T(a_0)\mid X],
$$

并检查P3提供的异质性是否真的排序$\Delta V$。若高P3状态中widen改善terminal value、低P3状态中keep更好，才说明曲面具有动作意义；若P3只改善预测却无法排序action uplift，它仍可用于风险描述，却不应进入报价控制。

实验还必须锁定coverage rule。v4与v4.1已经表明，一个看似微小的95%/98%选择会改变pass标签。successor应在新面板结果出现前冻结minimum coverage、missing-state fallback与哪些cells允许动作，避免再次通过事后门槛获得权限。

### Calibration 不等于只画一条 reliability curve

条件surface同时跨distance、horizon、side与volatility。若把所有cells合并，低概率远端rows会主导reliability plot；实际quote附近的系统性低估可能被平均掉。至少应报告按经济支持分层的observed/expected、proper score、slope/intercept与日期分布。

对cell $c$，可以检查

$$
CE_c=\left|\frac1{n_c}\sum_{i\in c}y_i-\frac1{n_c}\sum_{i\in c}\hat p_i\right|,
$$

并把$n_c$、distinct days和quote occupancy一并展示。一个小$CE_c$但只有一天，不具有transport；一个总score改善但near-distance $CE_c$恶化，也不应进入报价。

### Coverage 缺口可能不是随机缺失

三天连续BBO interruption恰好可能发生在高负载、高波动或venue异常时。如果这些时段更容易触达，complete-case calibration会偏向平静状态。v4.1把门从98%降到95%，只改变允许缺多少，不证明missing at random。

合理sensitivity包括：按缺口前后regime比较；把缺失窗口的outcome界定在最有利/最不利范围内做bounds；检查source-overlap是否在同类负载下也缺失。若结果只能在假定缺失与touch无关时成立，文章应明确依赖。

### State feature 自己也必须有 horizon contract

若volatility用过去60秒估计，它的lookback是60秒；P3预测horizon可能是10秒；订单TTL又可能5秒。三者不是同一个“短期”。状态必须完全由$t$前数据计算，且其尺度只描述当前regime；不能用未来10秒realized volatility作为conditioner，否则P3会得到明显但非法的分层。

报告应写明variance/volatility是absolute price还是return、sampling cadence、lookback、annualization与ready time。否则一张二维surface看似直观，读者却无法复算坐标。条件模型的深度首先来自状态语义闭合，而不是增加更多bins。

### 8. 公共证据

- [v4 Development 报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_touch_volatility_conditioned_v4_development_20260803.md)
- [v4.1 coverage-override 报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_touch_volatility_conditioned_v4_1_development_20260803.md)
- [v4 冻结 Spec](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_touch_volatility_conditioned_v4_spec_20260803.json)

公共文档提供聚合 score、覆盖失败与权限；模型与逐窗口 artifacts 不随公共仓库分发。

## 6. 标量报价 adapter

### TL;DR：失败的是“压成两个标量再喂给旧公式”，不是条件 P3 本身

volatility-conditioned P3 v4.1 在历史 Development 上给出了明显优于静态 v2 的 touch probability。一个很自然的下一步是：既然预测面更准，能否把它压缩成旧 quote ABI 已经认识的 `delta_star` 与 `kappa_eff`，从而自动改善报价？

NarrowGate 冻结了一个没有可调 gain、cap、side weight 或事后 shrinkage 的适配器。它先把 BUY 与 SELL curves 等权平均，再取 $dP(d)$ 最大点作为动态 `delta_star`，用邻近网格的 log-probability slope 作为动态 `kappa_eff`，最后把这两个标量传入旧 AS/GLFT 报价公式。

机制非常强：平均 raw half-spread 从 `24.5822` 收窄到 `13.4900 USDC/BTC`，matched executable quote 的 `99.073%` 发生变化，fills 从 `8,799` 增加到 `21,597`。经济结果却非常明确地更差：24 日 terminal MTM 从 `-59.4706` 变为 `-175.1314 USDC`，候选差值 `-115.6608 USDC`；平均日差 `-4.8192 USDC/day`，95% day-clustered interval 为 `[-5.9779,-3.6146]`，仅 1/24 日为正。

这不是“动作太弱”或 coverage 不足。它说明一个更深的 estimand mismatch：10 秒 touch probability 不是 1 秒 fill-arrival intensity；touch curve 的 log-slope 不是 AS/GLFT 强度弹性；同一曲线又同时改变 `kappa_eff` 与 spread floor，相当于让一个信号通过两个通道重复收窄报价。

因此项目关闭 `conditional_p3_scalar_compression_adapter_v1`，但不关闭 side-specific conditional curve、queue conversion、fill value 与 campaign economics 联合决定报价的更一般路线。

![条件 P3 标量压缩如何收窄报价并增加有毒成交](/images/narrowgate/p3-conditional-scalar-adapter-kline.svg)

*图 1：机制示意。完整 BUY/SELL probability surfaces 被压成一对标量后同时作用于报价中心与 spread floor，报价明显收窄；更多 touches/fills 并不保证更高 terminal value。*

本文只讨论历史 OOF replay，不建议任何真实交易行为。

### 1. 研究问题：prediction pass 怎样才能变成 quote value

条件 P3 的输出是一张随状态与距离变化的曲面：

$$
P_{BUY}(d\mid x),\qquad P_{SELL}(d\mid x).
$$

旧 runtime ABI 却只接收全局或当期的一对标量 `delta_star` 与 `kappa_eff`。这造成一个工程诱惑：先把曲面压缩成两个数，就不必重写 quote core，也能快速做 full-path A/B。

真正需要回答的问题不是“适配器能不能跑”，而是：

> 在保持 conditional model、queue、latency、inventory、cooldown 与 safety rules 不变时，这个预先冻结的 scalar compression 是否相对 current v2 提高完整 maker path 的 terminal value，并且不以异常 activity、tail 或 side harm 为代价？

这个问题独立于 v4.1 的 prediction pass。Brier 改善只说明 $P_{touch}$ 更接近触达标签，不说明把曲面压成旧强度参数以后，动作反事实一定为正。

### 2. 映射公式：从两张曲面到两个标量

适配器先构造 pair curve：

$$
P_{pair}(d\mid x)=\frac{P_{BUY}(d\mid x)+P_{SELL}(d\mid x)}2.
$$

然后在冻结距离网格 $D$ 上选择：

$$
\delta^*(x)=\min\arg\max_{d\in D} dP_{pair}(d\mid x).
$$

若最优点不是边界，局部 slope 用中心差分近似：

$$
\kappa_{eff}(x)=
-\frac{\log P_{pair}(d+\Delta\mid x)-\log P_{pair}(d-\Delta\mid x)}{2\Delta}.
$$

missing、invalid 或 boundary optimum bucket 全部回退 current v2。研究没有另外搜索 gain、clip、multiplier、minimum spread、side weight 或 smoothing 参数。

两条冻结 arms 是：

| Arm | P3 输入 | 其他机制 |
| --- | --- | --- |
| `current_v2` | 静态 `delta_star=13.9991`、`kappa_eff=0.067356` | 与候选完全相同 |
| `conditional_v4_1_oof` | 当日严格 OOF curve 压成动态标量 | 与 baseline 完全相同 |

因此经济差异可以写成：

$$
\Delta Y_d=Y_d(\text{conditional scalar adapter})-Y_d(\text{current v2}).
$$

$Y_d$ 的 primary view 是 daily terminal MTM；同时检查 fills、inventory time、daily q10 和两个历史 temporal panels 的方向。

### 3. 数据与因果时钟

正式 denominator 包含 24 个历史 native OOF 日，其中九日来自已经读取过的 historical validation，十五日来自 late diagnostic。它们不是新 Validation，也不是 sealed holdout。

每个日使用该日所属 chronological fold 的 OOF conditional artifact；没有把全样本 refit model 回填到训练期。曲面按 10 秒 bucket 的 feature-ready clock 更新，full replay 继续使用相同 native book、individual trades、queue、latency、cooldown、inventory 与 campaign accounting。

适配器只有在 context 和 mapping 都有效时才改变标量。minimum daily causal-context coverage 为 `99.7917%`，minimum valid-mapping coverage 为 `99.7569%`。这两个数字非常高，因此失败不能归因于 v4/v4.1 的 coverage controversy。

同一时刻两条 arm 的 quote 坐标可以直接比较；但第一次不同 fill 以后，库存、cooldown 与后续 opportunities 都会分叉。正式价值必须来自两条完整顺序路径，不能把 matched quote-time differences 当成可相加的静态收益。

### 4. 一个具体机制例子

假设某个高波动 bucket 中，conditional curve 认为近距离 reach probability 很高。$dP(d)$ 的最大点向内移动，同时 log-probability slope 变陡，于是适配器给出更小的 `delta_star` 和更大的 `kappa_eff`。

旧 quote core 可能同时通过两条通道响应：更大的 `kappa_eff` 改变 AS/GLFT spread term，更小的 `delta_star` 又让 P3 floor 向内。即使两者都来自同一张曲线，它们并不是两个独立证据，却会共同收窄最终报价。

价格随后向 maker 不利方向移动时，近价订单更容易触达并成交；这些 fills 又增加库存，触发 cooldown、改变另一侧 reducing quote 与后续 campaign path。于是“预测到了高 touch probability”转化成了“更积极地接受高 touch state”，这可能恰好增加 adverse selection。

若没有单独估计 queue conversion 与 fill value，适配器不知道某个 touch 是自然 repair、无害扫单还是有毒价格穿越。它优化的是 reach geometry，不是价值。

### 5. 冻结结果

机制层面，候选确实被执行：matched executable quote change rate 为 `99.0730%`；mean quote-time `delta_star` 从 `13.9991` 降到 `10.3851 USDC/BTC`，mean `kappa_eff` 从 `0.067356` 升到 `0.168434 (USDC/BTC)^-1`。

mean raw half-spread 从 `24.5822` 降到 `13.4900 USDC/BTC`。因此不能用“候选几乎没有改变订单”解释阴性结果。

经济层面：

| Metric | Current v2 | Conditional adapter | Candidate minus current |
| --- | ---: | ---: | ---: |
| Terminal MTM PnL | -59.4706 | -175.1314 | -115.6608 USDC |
| Mean daily PnL | -2.4779 | -7.2971 | -4.8192 USDC/day |
| Fills | 8,799 | 21,597 | +145.45% |
| Absolute inventory time | 3,160.81 | 2,309.01 | ratio 0.7305 |
| Daily PnL q10 | -6.0534 | -10.3795 | -4.3261 USDC |

平均日 PnL 差的 95% interval 完全小于零；historical validation OOF 为 `-50.8004 USDC`，late diagnostic OOF 为 `-64.8604 USDC`，两个 temporal panels 方向一致。较低 inventory time 没有补偿价值和 q10 的恶化。

### 6. 为什么 errata 必须并入同一篇文章

原始标题“Conditional P3 Curve To Quote Mapping”容易让读者以为完整 conditional-curve route 已经被否定。后续 contract errata 没有改变任何 artifact、结果或研究身份，只把 tested mechanism 准确命名为 `conditional_p3_scalar_compression_adapter_v1`。

它指出三类 mismatch：touch probability 不是 fill intensity；log-touch slope 不是 AS/GLFT elasticity；同一 compressed curve 通过 `kappa_eff` 与 floor 被传输两次。

这是一项解释边界修正，不是新实验。若把 errata 拆成独立文章，读者会看见两个文件，却看不见它们共同描述同一个失败适配器。

### 7. 关闭、未关闭与权限

关闭：pair-averaged scalar compression、当前 grid/central-slope mapping，以及任何在这 24 个已读 OOF 日上追加 kappa cap、shrinkage、side weight 或 favorable-day filtering 的救援。

未关闭：保持 BUY/SELL 分离、显式建模 queue conversion、fill value、campaign terminal economics，并直接优化一对 quote coordinates 的新 mapping。那必须是新的 ex-ante identity。

本项目没有 prediction promotion、artifact replacement、quote authority、action registration、Validation、sealed holdout、shadow 或 live authority。current v2 继续作为 operational baseline dependency。

### 深入推导：曲面压成两个标量为什么是不可逆的

条件 P3 的自然对象是一组按 side、distance、horizon 与 state 索引的概率：

$$
\mathcal P(X)=\{p_s(\delta_j,h_k\mid X):s\in\{BUY,SELL\},j,k\}.
$$

旧报价接口只接收类似 $\delta^*$ 与 $\kappa_{eff}$ 的两个标量。任何映射 $g:\mathcal P\rightarrow\mathbb R^2$ 都是强压缩：存在大量不同曲面 $\mathcal P_1\ne\mathcal P_2$，却满足 $g(\mathcal P_1)=g(\mathcal P_2)$。如果差异恰好位于实际报价距离附近、短 horizon 或某一 side，压缩后就会把最有经济意义的信息删除。

例如，两张 BUY 曲面都可能在十秒 50% 触达点给出 $\delta^*=1$，整体指数拟合也得到同一 $\kappa_{eff}$。第一张曲面可能在 0.2–0.5 USDC 附近陡降，第二张却在 1–2 USDC 才陡降；若实际 maker quotes 主要落在 0.3 USDC，二者的局部可达性完全不同。两个标量相同并不意味着动作等价。

更根本的问题是语义错位。GLFT 的 $\kappa$ 描述成交订单到达强度随距离的指数衰减：

$$
\lambda(\delta)=A e^{-\kappa\delta}.
$$

P3 描述固定时间内市场价格是否触达某价位。除非 queue conversion、order lifetime、cancel policy 与成交条件价值都有额外模型，把 P3 拟合斜率叫作 `kappa_eff` 也不会让它变成同一个 estimand。

![曲面、hazard、fill 与动作价值不能跨级替代](/images/narrowgate/f02-p3-estimand-ladder.svg)

*图 2：scalar adapter 试图从第一级跨接到第五级；中间三层没有因为接口兼容而消失。*

### 冻结反例：更多成交为何带来更差终局

这项研究最有解释力的不是 prediction 指标，而是完整路径反例。adapter 把平均半价差从约 24.58 缩到 13.49，fills 从 8,799 增到 21,597；如果只看参与度，会认为更准确的概率模型成功提高了成交机会。但终局 MTM 反而恶化约 115.66 USDC。

这组数字揭示了三件事。第一，报价更近确实改变了动作，不是 no-op。第二，更多 fills 没有被自动转化为更高价值，说明 fill conversion 与 adverse selection 的联合分布没有被两个标量表达。第三，路径反馈很强：新增 fill 改变库存，库存改变 reservation price，进而改变后续两侧 quotes 和 campaign tail。

可以把增量粗略分解为：

$$
\Delta Y=\underbrace{\Delta N_{fill}\,\bar v_{common}}_{\text{参与度}}
+\underbrace{N_{new}(\bar v_{new}-\bar v_{common})}_{\text{新增成交质量}}
+\underbrace{\Delta C_{path}}_{\text{库存、queue 与后续路径}}.
$$

第一项为正并不足够；新成交质量和路径成本可以更负。adapter 的失败正是一个“预测改善—动作恶化”案例，而不是 P3 曲面毫无信息。

### 怎样设计不会重复同一错误的 successor

后继接口不应先问“怎样生成一个旧 $\kappa$”，而应直接在可执行候选集合上估计联合价值。对每个 side 和离散报价 $a\in\{\delta_1,\ldots,\delta_m\}$，保留原曲面局部形状、queue state 和库存状态，估计：

$$
V(a,X)=E[Y(a)-Y(B_0)\mid X].
$$

候选动作必须通过 common-support、known propensity 或完整 paired replay；unsupported cells 回退 baseline。这样 P3 作为一个输入参与 action-value，而不是伪装成旧模型参数。关闭 scalar adapter 恰恰为这种强类型接口留下了空间。

### 为什么 `kappa_eff` 甚至不是一个稳定的曲面摘要

若在距离区间$[d_1,d_2]$上用log概率斜率定义

$$
\kappa_{eff}
=
-\frac{\log P_{touch}(d_2)-\log P_{touch}(d_1)}{d_2-d_1},
$$

它会同时依赖horizon、选取的距离区间、floor/clipping与条件state。同一曲面在近端可能平、远端可能陡；换一组grid就会得到另一个$\kappa_{eff}$。这不是估计噪声，而是曲面本来不必服从单指数形状。

更严重的是，即便touch曲线恰好指数化，GLFT里的arrival intensity还包含时间尺度$A$：$\lambda(\delta)=Ae^{-\kappa\delta}$。固定horizon touch概率若在Poisson近似下写成

$$
P_{touch,H}(\delta)=1-e^{-\lambda_{touch}(\delta)H},
$$

从$P$恢复的也是“价格触达事件强度”，不是排队后本单成交的market-order arrival intensity。queue conversion随距离与状态变化时，两者连比例关系都不保证。把touch slope塞进旧$kappa$位置，实际上把模型形式相似误当成物理对象相同。

### 这次失败如何定位，而不是简单归咎于“过度成交”

候选报价更窄、fills增加、terminal MTM恶化，至少排除了no-op，但仍存在多个机制分支：新增fills可能集中在不利side；相同side内可能来自更toxic状态；更早fill会改变inventory reservation price；更多cancel/requote会重置queue；floor又可能让曲面信息在某些状态被重复放大。

要区分这些分支，successor应报告从decision到terminal的分层分解：候选改变了多少报价、多少订单激活、多少touch、多少fill、哪些fill增加exposure、campaign持续多久，以及未成交路径的机会成本。特别要避免只在filled rows比较markout，因为action本身选择了谁会fill。

一个合格的negative conclusion因此不是“更窄一定不好”，而是：在冻结scalar-compression mapping、当前queue与完整path identity下，增加的参与度没有补偿选择与库存路径成本。它关闭这一个ABI，不关闭条件P3、离散quote action或显式fill-value模型。

### Scalar adapter 怎样在报价公式里被重复使用

如果曲面先通过$\delta_\star$给出minimum half-spread floor，又用同一log slope生成$\kappa_{eff}$进入AS/GLFT spread term，同一touch信息会沿两条通道影响最终距离。floor在某些状态绑定时，$\kappa$变化无效；未绑定时两者又可能同向收窄，产生非线性放大。

最终quote可示意为

$$
\delta_{final}
=
\max\left\{\delta_\star(X),
\delta_{AS/GLFT}(\gamma,\sigma^2,H,\kappa_{eff}(X),q)\right\},
$$

但$\delta_\star$与$\kappa_{eff}$来自同一曲面且都不是fill value。这不是两个独立证据源。报告必须给floor-binding率和对每条通道的消融，否则无法知道动作强度来自哪一项。

### 数量单位为何让旧 ABI 更危险

AS/GLFT推导常把订单量规范化为1；实际库存以BTC计、每单数量又可能是0.001 BTC。如果公式没有显式订单量$z$，$\gamma$或$q$就隐含依赖denomination。再把以USDC/BTC距离拟合的touch slope作为$\kappa$，单位虽表面是inverse price，经济尺度仍未闭合。

最小检查是denomination invariance：把BTC改成mBTC、USDC改成cent后，换回原单位的quotes必须一致。其次把risk horizon、P3 horizon、requote interval和TTL分别记录。scalar adapter失败不仅是统计问题，也暴露了旧接口让不同物理对象“只要是float就能互换”的类型债务。

### 如何读完整路径里的库存时间下降

candidate fills更多但absolute inventory time下降，可能因为更积极的两侧交易更快来回穿越flat；它并不说明每次fill质量更好。高turnover可以缩短持仓，同时支付更多adverse selection与fees，terminal MTM仍更差。

所以inventory-time是risk exposure diagnostic，不能作为PnL替代。若业务真的愿意以价值换更低BTC-hours，应在实验前定义shadow price或hard risk constraint；不能在看到负PnL后临时用inventory改善为candidate辩护。

### 8. 公共证据

- [Conditional P3 Curve to Quote Mapping v1 Development](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_touch_conditional_curve_quote_mapping_v1_development_20260803.md)
- [Contract Errata](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_touch_conditional_curve_quote_mapping_v1_contract_errata_20260803.md)
- [Public Spec](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_touch_conditional_curve_quote_mapping_v1_spec_20260803.json)

公共报告披露冻结 aggregates；逐 bucket curves、full-path traces 与大型 artifacts 不随仓库分发。

## 7. 策略可见时钟 transport

### TL;DR：预测质量通过，完整 transport identity 因样本支持停止

在窗口起点上证明 conditional P3 比 static v2 更准，还不足以说明策略真正做决定时能看到同样的状态。F02 的 policy-visible decision-cadence transport 把 v4.1 surface 查询搬到 F06 的 baseline-eligible quote opportunities：BUY/SELL 各看七个精确可执行距离，也看当时实际 current distance，并重建冻结的 sampled visibility BBO。

结果有两层。第一层很强：467,093 个 decisions 上，context coverage 为 `98.6726%`；BUY/SELL、七距离/current-distance 四个 Brier intervals 都明显支持 v4.1，calibration 也从约 `0.052–0.054` 改善到约 `0.0029–0.0030`，2,762,748 次 ordered-distance comparisons 没有 violation。

第二层决定了权限：immutable overlap 只有 28 个 UTC 日、3 个 OOF folds，低于预冻结的 30 日/4 folds。与此同时，下游 joint-quote value preflight 的最稀疏 `side × role × action` cell 只有 1 个 fill，远低于 30。研究因此停止在 direct value fitting 之前。

后续实现审计还把证据解释进一步收窄：current BBO coordinate 能精确复现 sampled quote coordinate，但 60 秒 context 是对 61 个 synthetic query points 独立应用 latency sampler 的 deterministic sensitivity，不是 F06 persisted feature-state parity，也不是实测 receive-time event clock。

![P3 从市场事件到策略决策的双时钟](/images/narrowgate/p3-policy-visible-dual-clock.svg)

*图 1：机制示意。exchange-time BBO 先经过冻结的 visibility sampler 才成为 decision-visible coordinate；60 秒上下文是合成敏感性路径，不能冒充真实持久化 feature history。*

本文只讨论历史 Development transport，不建议任何真实交易行为。

### 1. 研究问题：为什么需要一项独立的时钟研究

预测模型通常在规则网格上训练，例如每 10 秒生成一组 probability surface。真实 maker decision 却由 quote cadence、order event、inventory change 与 sampled visibility 共同触发。若研究直接用 raw last-known BBO 对 decision rows 评分，就可能让模型看到策略当时还不可见的坐标。

前驱 audit 曾得到约 68%–69% 的 side coverage。后来发现，它遗漏了冻结的 visibility-age layer：F06 并不是在 decision 时直接读 raw BBO，而是用 keyed sampler 选择更早的可见状态。

因此本项目问：

> 在复现 baseline quote coordinate 的同一 policy-visible clock 上，v4.1 的完整 side-specific distance surface 是否仍比 static v2 更准，并拥有足够的 chronological/fold/role support 进入 value fitting？

### 2. 输入、输出与 estimand

每个 baseline-eligible decision $i$ 有 side $s_i$、可见 best quote、候选距离集合 $D_i$ 与十秒内 aggressive-reach labels。模型比较：

$$
\Delta Brier_{i,d}=
\bigl(Z_{i,d}-\hat P_{v4.1}(d\mid x_i)\bigr)^2
-\bigl(Z_{i,d}-\hat P_{v2}(d)\bigr)^2.
$$

研究分别汇总 BUY/SELL、七距离 surface 与 current distance，不允许 pooled result 掩盖某一 side。

它还检查 calibration 与 ordered-distance monotonicity。候选距离覆盖、context coverage、days 与 OOF folds 是 hard gates。只有完整 transport identity 通过，才允许后继拟合 quantity-weighted terminal value。

本项目没有 action。它不会 widen、recenter、cancel 或改 size，也不会把 prediction point estimate 当作 PnL。

### 3. 两套时钟

可以把 raw market clock 与 policy-visible clock 写成：

$$
t^{visible}_{i}=t^{exchange}_{i}+L_i,
$$

其中 $L_i$ 不是任意常数，而是由冻结 profile、seed 与 decision key 决定的 visibility age。某条 BBO 只有在 $t^{visible}\le t^{decision}$ 时可用。

current coordinate 的重建使用与 F06 quote path 相同的 keyed SplitMix64 sampler，并要求重建的 BUY/SELL integer ticks 与 placement row 完全相等。这个等式是 coordinate parity gate。

但 v4.1 需要 60 秒 volatility context。F06 没有持久化完整 61-point history，于是研究对 synthetic one-second query points 独立应用 sampler。它回答“在这套确定性可见性敏感性下 prediction 是否保持”，不能回答“真实 runtime 当时究竟看见了哪 61 个 event states”。

两者必须分开：

| 证据 | 能证明 | 不能证明 |
| --- | --- | --- |
| current BBO coordinate parity | 当前 BUY/SELL quote coordinate 被正确重建 | 完整 feature state 一致 |
| synthetic 60s context | 固定 visibility sensitivity 下的模型表现 | observed receive time、event-lockstep parity |
| aggressive-reach labels | 历史未来触达 truth | queue fill 或 maker value |

### 4. 冻结面板

immutable denominator 有 467,093 个 baseline-eligible decisions。支持上下文 460,893 个，pooled context coverage `98.6726%`，minimum daily coverage `98.3724%`。

6,144 行缺少完整 60 秒 history，另有 56 行 current BBO unavailable/stale；这些行留在 denominator 中并明确标记 unsupported，不从 canonical 10 秒 context 或未来状态回填。

统计支持只有 28 个 distinct UTC days 与 3 个 chronological OOF folds。研究合同在 outcomes 前冻结最低 30 日与 4 folds，因此预测指标再漂亮，也不能更改 denominator gate。

### 5. 结果

negative Brier delta 表示 v4.1 更好：

| Side | Surface | Mean delta | 95% day-clustered interval |
| --- | --- | ---: | ---: |
| BUY | 七距离 | -0.009663 | [-0.012454,-0.007143] |
| BUY | current distance | -0.009671 | [-0.012443,-0.007156] |
| SELL | 七距离 | -0.009826 | [-0.012407,-0.007377] |
| SELL | current distance | -0.009806 | [-0.012327,-0.007416] |

calibration 的 integrated absolute error 也从 v2 的约 `0.0519/0.0538` 降至 v4.1 的约 `0.0029/0.0030`。minimum candidate-distance coverage 为 BUY `97.3075%`、SELL `98.2830%`。

共执行 `2,762,748` 次 ordered-distance comparisons，monotonicity violations 为零。由此可以支持：在冻结 sampled-visibility sensitivity 下，side-specific conditional P3 对十秒 aggressive reach 的预测显著优于 static v2。

### 6. 为什么不能进入 value fitting

第一个 blocker 是 28 日/3 folds 不够预冻结的 30 日/4 folds。增加模型复杂度、把 decisions 当作独立样本或改用 pooled bootstrap，都不能替代 day-level chronological support。

第二个 blocker 来自下游 joint-quote preflight：只有 282 个 paired quote buckets，最稀疏的 `side × role × action` cell 只有一个 fill。即使 prediction transport component 通过，也没有足够 overlap 估计 action-specific terminal value。

因此没有训练 M0/M1 value model，没有选择 simultaneous-LCB action，也没有创建 F09 randomized identity。`prediction_quality_component_passed=true` 与 `decision_cadence_transport_supported=false` 可以同时成立。

### 7. 版本与 errata 为什么合并

最初 Development report 已披露 sampled BBO correction 与 28 日 blocker。后续 errata 没有重算任何 outcome，只纠正“exact F06 parity”的过宽表述：coordinate parity 是 exact，60 秒 feature-state parity 不是。

这是同一 experiment 的解释收窄，不是新 estimand、面板或 action。独立拆文会让读者错把一次 evidence correction 当作第二次研究结果。

### 8. 支持、关闭与权限

支持：v4.1 在可复现的 sampled current-BBO clock 上保持强 Brier、calibration 与 monotonicity evidence。

关闭/阻塞：当前 28-day/3-fold transport identity 不允许 direct value fitting；synthetic history 不具有 receive-time 或 exact persisted-state authority。

本研究没有 quote mapping、action、Validation、sealed holdout、artifact replacement、shadow 或 live authority。未来 successor 需要持久化完整 feature state，或提供 event-lockstep replay parity，并重新冻结足够的 chronological support。

### 深入推导：transport 不是把时间戳列重命名

archive prediction 面板与真实策略 decision surface 之间至少有三类分布变化。第一是时间抽样：固定 100ms rows 与每 5–10 秒或事件驱动的报价决策并不等权。第二是状态选择：策略只在可报价、未触发 hard pause、订单角色明确时产生决策。第三是可见性：archive exchange time 上已经完整的 trade/L2 bucket，在 live feature-ready clock 上可能尚未到达。

令 $P_{arc}(X,Y)$ 为 archive rows，$P_{dec}(X,Y)$ 为实际 decision rows。即使模型在前者上 calibration 良好，也需要确认：

$$
E_{P_{dec}}[\ell(Y,\hat p(X))]-E_{P_{dec}}[\ell(Y,p_0(X))]<0.
$$

不能用 $P_{arc}$ 上的改善替代这个不等式。若 decision rows 主要集中在窄 spread、低库存或某些 cooldown 阶段，archive 中的大量容易样本会让总指标显得更好，却不代表 policy surface 有增量。

![P3 transport 的 estimand 与双时钟位置](/images/narrowgate/f02-p3-estimand-ladder.svg)

*图 2：transport 研究把第一级 P3 从 exchange-time archive 搬到 feature-ready decision surface；它仍未跨入 fill 或 action-value 层。*

### 一个双时钟例子：同一笔 trade 何时可以被模型使用

假设一笔 individual trade 在交易所时间 `12:00:00.420` 发生，它属于一个随后由公共 `aggTrade` parent 封装的 child block。撮合和 queue outcome 可以按 child exchange time 排序；但策略只能在 parent 消息到达并完成特征更新后看见整块信息。若 parent 的 feature-ready time 是 `12:00:00.610`，则 `12:00:00.500` 的报价决策不能使用这笔 trade，`12:00:00.700` 的决策才可以。

历史对齐若直接把 child exchange time 当作 feature time，就向早一拍的 decision 注入未来信息。这种泄漏可能只有 100–200ms，却会系统性挑中“刚好发生在价格变化前”的 rows。policy-visible transport 必须在 row builder 中冻结：

$$
t_{feature}(event)\le t_{decision},
$$

并对缺少 parent mapping、stale book 或 readiness 不明的行 fail closed，而不是用最近值填充。

### 为什么预测通过后还会败在支持门

transport prediction pass 只说明在实际 cadence 的共同可评分 rows 上，模型仍保留某种排序或校准增量。下一步 value fitting 需要更严格的 support：候选 quotes 必须在足够日期、side、distance 与 order role 上实际可达；outcome 必须能从 activation 追踪到 fill/cancel/terminal；不同候选必须共享因果 denominator。

若模型只在极少数 decision rows 有效，价值估计会面临两个问题。其一，effective sample size 远小于表面 row count；其二，候选 action 可能只发生在某一 regime，无法与 baseline 做同状态比较。此时停在 support gate 是研究结果，不是“缺一个训练脚本”。

transport 文章因此应被读成一座桥的承重测试：archive prediction 已经搬到策略可见时钟，但桥的另一端——具有完整 lifecycle 和 action overlap 的 value panel——没有足够支撑。它支持继续改进 canonical data，却不许可在稀疏 rows 上外推经济效果。

### Decision-weighted 与 time-weighted estimand 不相同

若策略在波动大时更频繁requote，按decision row平均会自然给高波动时段更大权重。令$N_d$为第$d$日决策数，decision-weighted loss是

$$
L_{decision}
=
\frac{\sum_d\sum_{i=1}^{N_d}\ell_{di}}{\sum_d N_d},
$$

而day-weighted loss是

$$
L_{day}
=
\frac1D\sum_d\frac1{N_d}\sum_{i=1}^{N_d}\ell_{di}.
$$

前者回答随机抽取一次真实决策时模型表现怎样，后者回答随机抽取一天时平均表现怎样。若少数活跃日同时更容易预测，两个指标可能方向不同。transport报告应两者并列，并把不确定性按日期cluster，而不是把上百万相关rows当作独立样本。

更进一步，决策cadence本身受策略状态影响。candidate若改变inventory或cooldown，就会改变未来decision times；此时拿baseline decision rows给candidate离线打分，只能评价固定surface prediction，不能评价candidate诱导出的新状态分布。完整action研究必须让两arms各自递归生成decision path，或明确限制为one-shot estimand。

### Support gate 应回答哪些具体问题

一个`coverage=97%`数字不够。需要知道缺失是否连续集中、是否只发生在高波动状态、BUY/SELL是否对称、靠近实际quote distance的cells是否有共同支持、invalid原因是source gap还是lifecycle语义。连续十分钟缺失与全日随机散落3%对state reconstruction的影响完全不同。

在value fitting之前，至少应冻结：每个side与action的distinct-day门槛；最大单日权重；feature-ready age上限；source gap与stale book规则；unsupported row回退baseline；以及候选与baseline的共同可执行集合。有效样本量可用权重集中度表示：

$$
n_{eff}=\frac{(\sum_i w_i)^2}{\sum_i w_i^2}.
$$

当少数日期或状态承担大部分权重时，表面rows很多、$n_{eff}$仍可能很小。本项目停在support门，保护的正是后续经济估计不被这种伪规模支配。

### Event sampling 与 fixed-grid sampling 的选择偏差

固定100ms grid在平静和活跃时段近似按wall time取样；event-driven decision则在book change、timer、fill或risk trigger附近过采样。模型若只在grid上评价，可能主要学会“绝大多数时刻没有touch”；搬到decision rows后，base rate与feature distribution都会改变。

这种shift不一定能用简单importance weight修复，因为decision occurrence本身受历史policy state影响。权重$w(X)=p_{dec}(X)/p_{grid}(X)$只有在两分布共同支持且decision mechanism由已观测$X$解释时才成立。若inventory/cooldown lineage缺失，transport是结构问题。

### Continuous gap 对 rolling state 的影响

缺11分钟并不只丢11分钟rows。一个60秒EMA在gap后需要重新warm，6小时/24小时state受影响更久；parent aggregate continuity与queue path也可能断开。coverage应传播到每个feature的ready validity，而不是gap结束就立即恢复全支持。

可以为每个feature记录`last_complete_source_time`和`ready_time`，decision合法需同时满足lookback完整与age上限。不同lookback会产生不同valid masks；模型输入必须使用共同交集，不能用部分fresh、部分stale的向量再靠missing imputation掩盖。

### Transport pass 后的最小 value panel

每行应绑定decision id、pre-action state、baseline/candidate quote、合法性、activation、order lineage、terminal campaign outcome与censor reason。候选若只在某side/distance有共同支持，动作权限就限制在该region；其它rows固定fallback baseline。

先做one-shot paired action可减少feedback复杂度，再用repeated full-path确认。只有prediction transport、lifecycle completeness、action overlap和terminal value全部通过，P3才从policy-visible probability升级为quote input。本项目只完成了前半座桥。

### 9. 公共证据

- [Decision-Cadence Transport Development](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_touch_policy_visible_decision_cadence_transport_v1_development_20260803.md)
- [Contract Errata](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_touch_policy_visible_decision_cadence_transport_v1_contract_errata_20260803.md)
- [Public Spec](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_touch_policy_visible_decision_cadence_transport_v1_spec_20260803.json)

大型 decision rows 与 reports 不随公共仓库分发；公开文档保留聚合 metrics、clock boundary 与 stop decision。

## 8. 联合报价价值

### TL;DR：概率曲面能排序，不代表它能选出有经济价值的报价

Conditional P3 是一张条件触达概率曲面：给定决策时已经可见的状态 $x$、maker side $s$ 与报价距离 $d$，估计未来十秒内主动成交是否到达该价格。F05 的问题不是重新证明这张概率曲面有没有预测信息，而是更往前走一步：**能否把 side-specific P3 当成普通输入，在十三个联合报价候选中选出终局价值优于当前 baseline 的报价？**

这项研究先走标准硬门路径。结果只有 28 个支持日、3 个 chronological OOF folds，最稀薄的 side-role-action cell 只有 1 笔 fill，低于预先冻结的 30 日、4 folds、每格 30 fills。按正常治理，它应该在读经济结果前停止。

随后 owner 明确接受该支持不足，只授权一次 outcome-informed Development diagnostic，同时保留原硬门失败。这个继续分支重建了 269/282 个完整 terminal overlay bucket，在 13 个 OOF 日上评估 126 个 bucket；最后仍没有任何非 baseline action 通过过去数据内的同时经济筛选，126/126 全部回退 baseline。最强早期点估计约 $3.7\times10^{-5}$ USDC/bucket，低于冻结 $10^{-4}$ 经济阈值的一半，后续 folds 的区间跨零。

因此关闭的是当前 **P3-to-joint-quote value selector**，不是 Conditional P3 的概率预测证据。研究也没有生成十三臂完整顺序回放、随机 action identity 或 live 权限。

本文只讨论历史 Development 研究，不构成交易建议。图中的 K 线与报价是合成机制示意，不是历史或实盘记录。

![Conditional P3 联合报价候选的 K 线机制图](/images/narrowgate/conditional-p3-joint-quote-kline.svg)

*图 1：同一个十秒 canonical decision 产生 baseline 与单侧 closer/farther 候选。P3 只描述价格被主动流触达的概率；F05 还要求对应 terminal overlay value 在未来日期上稳定为正。*

### 1. P3 到底是什么，不是什么

令 $R_{s,d}$ 表示十秒内 aggressive counterparty flow 是否到达 maker side $s$ 距离 $d$ 的价格。Conditional P3 估计：

$$
P_3(s,d\mid x_t)
=
\Pr(R_{s,d}=1\mid x_t).
$$

它保留 side、inventory role、距离与决策状态，而不是把所有触达样本压成一条全局指数曲线。对同一个决策，随着报价离 BBO 更远，触达概率应保持有序。

但以下等式通常不成立：

$$
\arg\max_a P_3(a\mid x)
\neq
\arg\max_a V(a\mid x).
$$

更靠近市场的报价可能更容易被触达，也可能接到更有毒的成交；更远的报价可能改善成交价格，却失去大量自然修复机会。真正的报价价值还取决于 activation、GTX、queue、fill quality、后续 inventory、cooldown、campaign terminal 与跨侧相互作用。

早期曾尝试把 BUY 与 SELL 的条件概率平均成一个 scalar，再压缩成动态报价参数。这个映射把触达概率斜率误当作另一种报价模型里的 fill-hazard elasticity，并在 spread core 与 spread floor 中重复收窄。它已经关闭。后来的 F05 分支不再做这种代数替换，而是把 side-specific P3 当成普通特征，直接问候选报价有没有 USDC value。

### 2. 十三个联合报价候选

每个 canonical 十秒机会有一个 baseline joint quote：

$$
a_0
=
(\text{BUY current},\text{SELL current}).
$$

其余十二个候选每次只移动一侧：

$$
\mathcal A
=
\{a_0\}
\cup
\{
\text{BUY closer/farther }1,2,4\text{ ticks}
\}
\cup
\{
\text{SELL closer/farther }1,2,4\text{ ticks}
\}.
$$

另一侧保持 current。研究不假设：

$$
V(\Delta BUY,\Delta SELL)
=
V(\Delta BUY,0)+V(0,\Delta SELL).
$$

换句话说，单侧 overlay 只能研究单侧相对 baseline 的局部差异，不能凭空识别双侧同时改变的 inventory feedback。

一 tick 保留为 negative control；两 tick 与四 tick 是正式距离。Conditional P3 的十秒触达概率进入未来直接价值模型，但不能在模型外简单相乘成“概率 × 平均 markout”。

### 3. 决策时钟与数据边界

这个项目的时钟合同很窄：

- 每个 side 在每个 canonical 10s boundary 最多形成一个权威机会；
- decision timestamp 来自 placement submit 的 exchange-time 身份；
- 决策处必须有 same-timestamp BBO；
- 所有输入必须满足 $\text{feature-ready timestamp}\le \text{decision timestamp}$；
- P3 预测所用状态不能读取十秒窗口内的未来价格；
- terminal overlay 来自冻结的 paired lifecycle 分母；
- Validation 与 sealed holdout 不读。

这个十秒 cadence 是决策采样合同，不代表订单一定活十秒，也不是任意 markout horizon。订单的 activation、fill 与 cancel ACK 仍由 lifecycle 路径决定。

证据来自 F06 已经冻结的 paired placement 分母。它是机制 informed Development successor，而不是独立 confirmation。公共报告同时明确：历史 owner-side 机器结果不随仓库分发，公开文档只提供研究边界与聚合数字。

![P3、报价价值与动作价值的层级关系](/images/narrowgate/f05-fill-value-action-ladder.svg)

*图 2：P3 位于“价格是否被触达”的概率层；联合报价 selector 位于“候选报价的终局价值”层；真正的策略变更还要经过 full-path action uplift。概率排序成立，只能为下一层提供输入，不能替下一层给出结论。*

#### 3.1 从触达到终局价值，缺了哪些随机变量

对一个 maker BUY 候选 $a$，可以把价值链写得更完整：

$$
\begin{aligned}
Q(x,a)
={}&\Pr(A=1\mid x,a)\\
&\times\Pr(F=1\mid A=1,x,a)\\
&\times\mathbb E[V^{fill}\mid F=1,A=1,x,a]\\
&+\Pr(F=0\mid x,a)\,\mathbb E[V^{no\ fill}\mid F=0,x,a]\\
&-C^{replace}(x,a).
\end{aligned}
$$

$A$ 表示订单通过 GTX 并激活，$F$ 表示生命周期内成交。P3 更靠近“未来 aggressive flow 是否到达价格”的分量，却没有自动给出 activation、queue-to-fill conversion、partial fill、cancel race、成交后的 markout 或 inventory terminal。尤其是：价格被触达时，排在前面的队列可能已经吸收全部流量；价格没有被触达时，远离市场的订单也可能通过后续 reprice 改变 campaign。

所以把 $P_3$ 直接乘一个历史平均 fill value，只在非常强的可分离假设下才成立：

$$
V^{fill}\perp a\mid P_3,x,
$$

且 queue、activation 与未来策略路径都不随 $a$ 变化。真实 maker 系统恰恰违反这些假设。

#### 3.2 一个 13 臂决策的具体数值例子

假设当前 BUY 报价距参考价 4 ticks，SELL 距离 5 ticks。P3 给出 BUY 在 10 秒内的触达概率：向内 2 ticks 为 0.62、baseline 为 0.41、向外 2 ticks 为 0.23。只看概率，向内报价似乎最有吸引力。

但若将后续量写进来，三臂可能呈现：

| BUY 动作 | 触达概率 | 条件成交价值 | no-fill/后续路径价值 | 粗略总价值 |
|---|---:|---:|---:|---:|
| closer 2 | 0.62 | -0.0030 | -0.0002 | -0.0021 |
| baseline | 0.41 | -0.0010 | 0 | -0.0004 |
| farther 2 | 0.23 | +0.0005 | -0.0008 | -0.0005 |

这只是合成演算，不是历史结果，却展示了关键非单调性：更高触达概率可以对应更差价值；更远报价即使改善成交价，也可能因丢失修复而变差。SELL 侧的变化还会通过库存角色影响 BUY 的未来价值，因此 13 臂不是两条独立的一维曲线。

#### 3.3 “bucket value”为什么只是一个受限代理

continuation 使用 terminal overlay bucket，是为了在不读取完整未来策略反事实的情况下先做低成本筛选。它把同一个 canonical decision 下的候选映射到已冻结 lifecycle 结果，适合回答“在有共同覆盖的局部事件里，这个报价移动有没有足够大的价值迹象”。

但 overlay 不会重新执行下面的递归：

$$
S_{t+1}=g(S_t,a_t,M_{t:t+1},F_{t:t+1}),
$$

$$
a_{t+1}=\pi_0(S_{t+1}).
$$

一旦 $a_t$ 改变 fill，下一时刻状态 $S_{t+1}$、库存角色、cooldown 与下一张报价都会改变。overlay 仍沿用 baseline 的后续容器，因此只能当筛选器，不能当 full-path 策略 PnL。正因如此，本项目把“没有 proxy candidate”作为停止理由；如果 proxy 已通过，也仍不能直接晋级 live。

### 4. 第一阶段：结果未读前，支持门已经失败

标准 preflight 的冻结要求与观察值是：

| 支持项 | 观察值 | 冻结要求 | 结果 |
|---|---:|---:|---:|
| 支持日 | 28 | 30 | 失败 |
| OOF folds | 3 | 4 | 失败 |
| 最小 side × role × action fills | 1 | 30 | 失败 |
| paired joint-quote buckets | 282 | diagnostic | 不作为通过门 |
| exact BBO clock | 是 | 是 | 通过 |
| 全 candidate grid activation | 是 | 是 | 通过 |

最薄的 cell 是 SELL add 的 farther 4 ticks，仅 1 笔 fill。其他 role-action cells 也有明显稀疏。

支持门的作用不是追求一个好看的样本量，而是避免高维直接价值面用极少 lifecycle 事件估计每个报价动作。若一个 cell 只有一笔 fill，模型很容易把一次 campaign 的偶然大值当成动作规律。

因此标准路径作出：

$$
\text{support sufficient}=\text{false},
$$

并且在该路径下：

$$
\text{economic outcomes read}=\text{false}.
$$

### 5. Owner continuation：接受风险，不改写硬门

owner 随后明确接受实际支持，授权一次 Development continuation。这个授权有两个限制：

1. 原来的 $30/4/30$ 门仍然是失败，不能回写成通过；
2. 新结果即使有正点估计，也只能是 proxy diagnostic，不能直接形成 action。

继续分支以 baseline campaign-terminal overlay 为基础，为十三个候选构造 quantity-weighted 单侧 delta：

$$
\Delta V_i(a)
=
Y_i^{overlay}(a)-Y_i^{overlay}(a_0).
$$

它没有重放完整 action-dependent inventory、cooldown、queue、campaign birth/death 或双侧相互作用。因此它不是：

$$
Y_i^{full\ path}(a)-Y_i^{full\ path}(a_0).
$$

即使 proxy 结果为正，仍需要新的 full-path candidate identity 才能研究真实顺序反馈。

### 6. 结果：缺的不是 value rows，而是经济分辨率与时间稳定性

继续分支的覆盖与 OOF 结果如下：

| 指标 | 结果 |
|---|---:|
| 完整 terminal-overlay buckets | 269 / 282 |
| value coverage | 95.39% |
| OOF buckets | 126 |
| OOF 日 | 13 |
| chronological folds | 3 |
| 通过 past-only simultaneous screen 的 action-fold cells | 0 |
| OOF 非 baseline selections | 0 / 126 |
| baseline fallback | 126 / 126 |
| selected-value mean | 0 USDC/bucket |

269/282 的完整 coverage 说明“广泛缺失 terminal value”不是主要 blocker。真正的问题是数值太小、随日期不稳定。

这里的 126 个 OOF buckets 也不能被误读为 126 次彼此独立的随机试验。它们来自 13 个未来日期、共享相同市场路径与候选集合，因此不确定性必须保留日期聚类和同日多臂相关性。若把 bucket 当独立样本做普通标准误，区间会被人为压窄，早期微小正值也会显得比实际更可靠。

最强早期信号是 BUY farther 4 ticks：

$$
\widehat{\Delta V}
\approx
3.7\times 10^{-5}\ \text{USDC/bucket}.
$$

其早期 simultaneous lower bound 约为 $1.6\times10^{-5}$，看起来高于零，却仍低于冻结经济阈值：

$$
\theta_{econ}=10^{-4}\ \text{USDC/bucket}.
$$

后两个 folds 的 lower bounds 又跨过零。一个只在早期出现、随后失去方向，而且经济量级不到阈值一半的 proxy，不足以支付十三臂 full-path 回放的研究成本，更不足以进入 action gate。

#### 6.1 为什么 0/126 baseline fallback 是结果，不是“模型没有工作”

每个 OOF bucket 的 selector 先在过去训练区间检查某个非 baseline action 是否同时满足支持、方向和经济阈值。没有动作通过时，预注册行为就是返回 $a_0$。因此 126 次全部 fallback 并不是程序没有生成候选，而是候选生成、估计与筛选都执行后，没有一臂取得足够证据。

这个区别很重要。若 selector 被迫每次选一个非 baseline winner，十三臂里总会有一个样本均值最大；在纯噪声下也一样。允许 baseline 作为“拒绝行动”类别，才让研究能够诚实地输出“当前不知道”。

多臂 winner’s curse 可以粗略写成：

$$
\mathbb E\left[\max_{a\in\mathcal A}\widehat\epsilon_a\right]>0,
$$

即便所有真实 $\Delta V_a=0$，最大观测噪声仍倾向为正。十三臂、多个 role 和多个 fold 叠在一起时，单看最佳 point estimate 几乎必然过度乐观；同时区间与经济阈值正是对这类选择偏差的约束。

#### 6.2 支持不足不是“少几天”这么简单

28 天比 30 天少两天只是最醒目的表面失败。更严重的是最小 side-role-action cell 只有 1 个 fill。经济信息量由 lifecycle outcome 决定，而不是由 decision row 数决定：十万个 no-fill rows 不能替代远距 SELL add 的一条 terminal path。

可以把有效分辨率理解为：

$$
n_{eff}(a,r,s)
\approx
\frac{\left(\sum_i w_i\right)^2}{\sum_i w_i^2},
$$

其中权重反映同日相关和覆盖。若一臂的事件集中在一两个日期，名义 fill 数即便增加，$n_{eff}$ 仍可能很低。这里既有日数不足，也有 cell coverage 与时间运输不足，不能靠池化 BUY/SELL 或 opener/add 来掩盖。

#### 6.3 读者应怎样复算这项结论

在不接触私有 OOF rows 的公共边界内，读者仍可核对逻辑闭合性：候选集合是否确为 13 臂；一 tick 是否仅作 negative control；标准门是否在结果未读时关闭；owner continuation 是否保留原失败；269/282 coverage 是否排除了大规模 label 缺失；0/126 是否来自同时 screen 而非执行错误；最佳量级是否低于冻结经济阈值。

若未来公开可复现数据，最关键的复算不是重训一个更复杂模型，而是按日期重新构造 outer folds，在每折 train 内完成所有标准化、模型拟合、阈值与 action screening，再在未来日期评估。任何用全样本选择 action 后再做交叉验证的流程，都会把未来 bucket 的信息漏进候选选择。

### 7. 为什么“概率模型通过”不能救这个价值 selector

F02 的后续 policy-visible audit 支持 Conditional P3 的 side-specific 概率排序与有序性。这是 P3 自己的预测证据。

它不能补齐 F05 的三个缺口：

- 稀薄 side-role-action lifecycle support；
- terminal overlay 的经济量级；
- chronological stability。

概率层与价值层的关系可以写成：

$$
V(a\mid x)
=
\sum_j
\Pr(O_j\mid a,x)
\cdot
\mathbb E[Y_j\mid O_j,a,x]
-
C(a,x),
$$

其中 $O_j$ 不只有触达，还包括 activation、exact/through fill、cancel ACK、queue reset 与 campaign continuation。P3 只覆盖其中一部分机制。它表现良好，不会自动让完整 $V(a\mid x)$ 获得正下界。

### 8. 最终边界

这项研究的精确结论是：

- Conditional P3 probability prediction：没有被本项目关闭；
- 早期 scalar quote mapping：关闭；
- side-specific thirteen-arm sparse value selector：Development 关闭；
- 标准 hard-gate route：失败；
- owner-risk continuation：也没有 candidate；
- full-path 13-arm replay：未授权、未运行；
- Validation 与 sealed holdout：未读；
- action experiment、shadow 或 live：未创建、未授权。

研究没有证明“移动报价没有价值”，也没有证明“P3 无用”。它证明在这套冻结 overlap、candidate set、overlay estimand 与经济阈值下，没有可执行的联合报价候选。

### 十三臂问题里的 winner's curse

即使每个候选的真实价值都等于baseline，有限样本中13个估计量也会有一个最大值。若再按side、state、日期和多个value proxy查看，隐含选择次数更大。选中的arm点估计天然乐观，必须通过nested chronological OOF或同时置信下界控制。

对每个decision $i$，内层只能用过去fold选择$\hat a_i$；外层才评价$Y_i(\hat a_i)-Y_i(a_0)$。若先在全部Development找winner再对同一rows计算value，所谓OOF outcome model也不能消除action selection bias。

### Activation、fill 与 no-fill 共同构成 quote value

候选报价$a$的完整价值可以写成

$$
V(a,X)
=
P(ACT\mid a,X)
\left[
P(F\mid ACT,a,X)E[Y_F\mid F,a,X]
+P(\bar F\mid ACT,a,X)E[Y_{NF}\mid\bar F,a,X]
\right]
+P(\overline{ACT}\mid a,X)E[Y_{NA}],
$$

其中activation、fill与未成交路径都是action-dependent。只在filled rows拟合$Y_F$会忽略候选无法激活、等待后取消、失去queue与库存机会成本。P3又只接近activation/touch的一部分，不包含其它项。

这也是0/126 selector fallback的重要性：模型有rows、有候选，却无法在冻结外层fold稳定选择非baseline arm，说明表面价值差没有可运输分辨率。强行选择每fold最大点估计只会把噪声变成动作。

### 一个可复算的 support scorecard

每个arm至少应报告eligible decisions、合法candidate prices、quote-changed fraction、activation、touch、fill、terminal-complete rows、distinct days与最大单日占比。importance weights下再给$n_{eff}$和overlap tails。只有从decision到terminal每层都不坍塌，value比较才有解释力。

此外应给baseline fallback率与winner rotation。若inner folds不断选不同arm、outer folds全部回退baseline，它本身就是时间不稳定证据，而不是“模型太保守”。后继可缩小arms或使用连续value surface，但必须创建新合同与新面板。

### 9. 公共证据

- [Conditional P3 Joint Quote Value Preflight](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/docs/conditional_p3_joint_quote_value_preflight_v1_development_20260803.md)
- [Conditional P3 Joint Quote Sparse Value Diagnostic](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/docs/conditional_p3_joint_quote_sparse_value_diagnostic_v1_development_20260804.md)
- [Conditional P3 Quote-Mapping Status Closure](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/docs/conditional_p3_quote_mapping_status_closure_v1_20260804.md)
- [F05 family README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/README.md)

公开链接解释方法与聚合结论。精确机器证据位于未随公共仓库分发的 evidence store；公开 SHA 只标识字节，不是下载位置。

## 9. Reach-time hazard successor

### TL;DR：不再只问“十秒会不会碰到”，而是估计何时、碰到多远

固定 10 秒 P3 把一条完整 first-passage path 压成单个 Bernoulli label。两个状态即使十秒 touch probability 相同，也可能一个在 300ms 内就穿越近价，另一个直到第九秒才慢慢到达；对 quote cadence、queue 与 cancel 来说，它们不是同一机制。

`p3_aggressive_reach_time_conditioned_hazard_v1` 因此建立 100ms discrete-time risk set，按 BUY/SELL 分开估计从当前同侧 best quote 出发、在距离 $d$ 上第一次被 side-correct aggressive flow 触达的 hazard，并把它积分成完整 reach-time CDF。30 秒是 administrative censoring boundary，不是假设订单一定活 30 秒。

冻结的 normal research path 使用 200 个唯一 UTC source-days、四个 expanding chronological OOF folds 和 48 个 provider/native overlap diagnostics。BUY 与 SELL 的 integrated-Brier improvement 分别为 `+0.004463` 与 `+0.004428`，day-clustered 95% intervals 都完全大于零；overall context coverage `99.835%`，distance/time monotonicity violations 全为零。

结论仍然只属于 prediction：模型不估 activation、queue conversion、fill-before-cancel、terminal value 或 PnL。近距离 5–100 tick cells 仍有系统性 underprediction，任何报价使用都必须另行冻结 action 与 full-path A/B。

![Aggressive reach 的距离与时间 first-passage 面](/images/narrowgate/p3-aggressive-reach-time-hazard.svg)

*图 1：机制示意。价格路径依次穿越不同距离阈值，每一行 risk set 只在首次触达前存活；hazard 沿时间积分成 distance-specific CDF。图不是历史私有市场路径。*

本文只讨论公开 Development prediction evidence，不建议任何真实交易行为。

### 1. 研究问题：为什么固定 horizon 不够

固定 P3 标签写成：

$$
Z_{d,H}=\mathbf 1\{T_d\le H\},
$$

其中 $T_d$ 是 aggressive reach 首次到达距离 $d$ 的时间。若只固定 $H=10s$，模型只能学习 $P(T_d\le10s)$，看不见 $T_d$ 的完整分布。

full reach-time surface 则估计：

$$
F_s(t,d\mid x)=P(T_{s,d}\le t\mid x),
\qquad 0<t\le30s.
$$

它同时回答三个问题：随着 $t$ 增加，触达概率怎样累积；随着 $d$ 增加，触达概率怎样下降；同一 $t,d$ 下，side 与 causal state 怎样改变分布。

### 2. 100ms discrete hazard

把时间离散成 100ms bins，定义在尚未触达时的 conditional hazard：

$$
h_{s,k,d}(x)=P(T_{s,d}\in(t_{k-1},t_k]\mid T_{s,d}>t_{k-1},x).
$$

对应 survival 与 CDF 为：

$$
S_s(t_k,d\mid x)=\prod_{j=1}^{k}\bigl(1-h_{s,j,d}(x)\bigr),
$$

$$
F_s(t_k,d\mid x)=1-S_s(t_k,d\mid x).
$$

如果 30 秒内没有触达，行在 administrative boundary 被 right-censor；它不会被当成“永远不触达”。这种表示允许一个共享模型学习近距离早期 hazard 与远距离慢速 tail，而不为每个 horizon 建一套互相矛盾的独立 classifier。

### 3. 输入、约束与 estimand

输入包含 raw distance、fast/slow volatility-normalized distance、side、spread、causal volatility/regime 与 source-ready context。source identity 与 year 只用于 diagnostics，不作为 tradable feature。

模型对 raw distance 和两个 normalized distances 施加 nonincreasing constraints。最终输出还必须满足：

$$
d_1<d_2\Rightarrow F(t,d_1\mid x)\ge F(t,d_2\mid x),
$$

$$
t_1<t_2\Rightarrow F(t_1,d\mid x)\le F(t_2,d\mid x).
$$

primary estimand 是相对冻结 baseline 的 day-level integrated-Brier improvement。设 $IBS_0$ 为 baseline、$IBS_1$ 为 conditioned hazard，则报告：

$$
I_d=IBS_{0,d}-IBS_{1,d}.
$$

正值表示新模型在该日改善。BUY 与 SELL 分开做 day-cluster uncertainty，不用 pooled rows 虚增样本量。

### 4. 数据与因果时钟

weighted source panel 有 200 个唯一 UTC days：93 个 2025 provider fit days、63 个 2026 native fit days，以及 44 个已读 2026 diagnostic days。48 个 provider/native overlap days 只做 transport comparison，不双重加权。

四个 expanding chronological OOF folds 在训练前冻结。最终报告的 OOF denominator 含 BUY/SELL 各 84 个 OOF days；每个 outer test 日只能使用严格过去拟合的 hazard。

reach truth 使用 exchange-time aggressive events；feature 只能在窗口起点的 causal ready clock 可见。这个身份不是 receive-time queue truth，也不宣称同毫秒跨流 event 的精确订单先后。

30 秒 censor boundary 只是报告与支持上限。它不是当前订单的真实 lifetime，也不能直接成为 cancel timer。

### 5. 研究演进：design、spec 与 execution 都属于一个项目

设计阶段先定义 cumulative maximum reached distance cache。一个 source-day 只存每个时间点已达到的最大 tick 距离，多个 $(t,d)$ labels 从同一缓存派生，避免为每个 horizon 复制市场状态。

冻结 Spec 随后确定 source panels、four-fold chronology、constraints、proper score、coverage、transport 与权限。模型训练和 report 只是执行这份研究合同，不产生新的项目。

固定 10 秒 v2、volatility-conditioned v4 与 reach-time hazard 是不同 estimands，所以它们各自成文；而 `surface design`、JSON Spec、cache manifest 与训练 report 是本项目的不同章节，不应拆成“设计文章”“实现文章”“结果文章”。

### 6. 结果

BUY integrated-Brier improvement 为 `+0.004463`，95% day-clustered interval `[+0.002155,+0.007202]`，positive-day rate `60.71%`。

SELL improvement 为 `+0.004428`，interval `[+0.002829,+0.006285]`，positive-day rate `75.00%`。四个 expanding folds 在两侧都独立通过。

overall context coverage 为 `99.835%`，高于冻结的 98% gate。distance-CDF、distance-hazard 与 time-CDF monotonicity violations 均为零，最大 probability-mass error 只有 `2.554e-15`。

48 个 provider/native overlap 日的 aggregate prediction MAE 为 BUY `0.006089`、SELL `0.005553`，低于 `0.01` gate。最大单日 MAE 分别达到 `0.015121` 与 `0.012421`，所以研究只支持 aggregate source transport，不声称 daily-uniform transport。

44 个已读 native diagnostic days 的 score direction 仍为正，但不参与任何 gate，也不是 independent confirmation。

### 7. 残余风险：near-distance calibration

在 5–20 tick 与 21–100 tick 的若干 cells，尤其 5–30 秒 report horizons，模型低估 observed reach。integrated Brier 可以通过，同时局部区域仍有 bias；这正是 proper score 与 cell diagnostics 都需要保留的原因。

对 maker 来说，near-distance region 往往最接近实际 quote support。若直接把一个整体通过的 CDF 用作 quote action，局部 underprediction 可能导致过于积极的 placement。下一项经济研究必须先冻结如何从 CDF、queue conversion 和 fill value 得到 action，而不能只以 overall IBS pass 为依据。

### 8. 支持边界与没有获得的权限

支持：side-specific conditioned first-passage hazard 在历史 Development 上相对 baseline 有稳定 proper-score improvement，结构与 aggregate source transport gates 通过。

不支持：activation probability、queue fill、cancel/reentry value、campaign terminal PnL、当前 runtime artifact replacement 或 sub-100ms transport。

本项目没有 quote mapping、action registration、Validation、sealed holdout、shadow 或 live authority。operational fixed-10s P3 v2 保持不变。

### 深入推导：固定 horizon 概率怎样展开成到达时间分布

把未来分成 $K$ 个 100ms intervals。对给定距离 $\delta$，离散 hazard 定义为：

$$
h_k(\delta,X)=P(T_\delta=k\mid T_\delta\ge k,X).
$$

survival 与 cumulative incidence 分别是：

$$
S_k(\delta,X)=\prod_{j=1}^{k}(1-h_j),\qquad
F_k(\delta,X)=1-S_k(\delta,X).
$$

固定十秒 P3 只是 $F_{100}$。hazard 展开以后，可以区分“前一秒很危险、随后迅速衰减”和“十秒内持续小概率靠近”两种路径；它也能自然处理到订单终止仍未触达的右删失，而不用把未触达一律标成负例。

多距离研究还要避免逻辑冲突：若更远价位先被记录为触达，而更近价位尚未触达，说明时间对齐或路径构造有问题。对同一连续价格路径，first-passage times 应满足嵌套关系。模型可以对每个 band 使用 cause-specific hazard，最终用共同 survival 归一化，而不是训练互相独立、概率和超过 1 的 heads。

![Reach-time hazard 在 P3 estimand 阶梯中的位置](/images/narrowgate/f02-p3-estimand-ladder.svg)

*图 2：hazard 把固定 horizon 的第一级展开为完整时间结构，但仍未加入 queue conversion、fill value 与 campaign action。*

### 一个可计算例子：早触达与晚触达为何对报价不同

假设两种状态的十秒触达概率都为 30%。状态 A 的前十个 100ms buckets 每个 hazard 约 3.5%，之后接近零；状态 B 的 100 个 buckets 每个 hazard 约 0.36%。两者 $F_{100}$ 相近，但对一张预计 1 秒后就会 requote 的订单，A 的可达性远高于 B。

若订单 TTL 为 5 秒，应该使用 $F_{50}$；若策略每秒重算但旧单可能继续 active，又必须结合实际 cancel ACK 和 remaining quantity。固定十秒概率把这些工程时钟压成一个数，hazard 才能与不同寿命做一致积分：

$$
P(T_\delta\le L)=1-S_{\lfloor L/0.1s\rfloor}.
$$

不过即便 A 更早触达，也不能推出报价应外移。早触达可能意味着高成交机会，也可能意味着 adverse jump 已在路上。动作仍取决于触达后的 queue、fill cause 与终局价值。

### Calibration 要怎样读，near-distance 风险为何更重要

overall Brier 或 log loss 可能被大量低概率、远距离 cells 主导，而实际 maker quotes 集中在近距离。一个模型即使总体改善，如果在 near-distance 高支持区域系统性低估 hazard，接入报价后仍会过度靠近市场。

因此需要按距离 band、side、horizon 和日期分别报告 observed/expected、ranking 与 calibration，并用 day cluster 构造 uncertainty。near-distance 的误差还应按实际 quote occupancy 加权，而不是由远端样本稀释。原研究保留的 near-distance calibration 风险，正是 prediction pass 以后不能继续越级的原因之一。

未来若把 hazard 接到 queue 或 action value，必须冻结订单寿命与 policy-ready clock，使用真实 activation 到 cancel ACK 的风险集，并把 touch、fill、cancel、jump、repair 作为语义不同的事件。否则只是把一个更精细的时间模型重新压回错误对象。

### Competing distance bands 怎样避免重复计算同一路径

如果分别训练“5 ticks内触达”“10 ticks内触达”“20 ticks内触达”三个独立binary heads，同一条价格穿越20 ticks的路径会同时成为三个正例，而模型输出又可能违反嵌套。更自然的做法是把首次到达的最远band视作按时间推进的ordered state：每个100ms bucket里，尚未触达的路径要么继续生存，要么首次进入某个distance band。

设$J_k\in\{5,10,20,\varnothing\}$表示第$k$个bucket首次跨过的最大新band，则cause-specific hazard为

$$
h_{k,j}=P(J_k=j\mid T\ge k,X),
\qquad
\sum_j h_{k,j}\le1.
$$

共同survival$S_{k-1}$把各cause转换为CIF：$F_{k,j}=\sum_{u\le k}S_{u-1}h_{u,j}$。这样总概率质量天然闭合，远距离到达也会隐含近距离已经经过。实际实现可以使用累积最大reached-distance cache，但报告仍应检查distance-CDF、time-CDF与mass conservation三类不变量。

### 从 hazard 到订单寿命的反事实

hazard模型最直接的用途不是找一个“最佳十秒概率”，而是对候选寿命$L$积分。若一张订单在第$r$个bucket收到cancel ACK，它的reach opportunity只累积到$r$；若在第$f<r$个bucket被部分成交，remaining quantity的后续风险集又发生变化。

候选寿命的粗略可达概率是$1-S_L$，但经济价值还要联合三类随时间变化的量：queue fill conversion$c_k$、成交条件价值$v_k$以及未成交后重挂成本$g_k$。一个示意式为

$$
V(L,\delta)
=
\sum_{k=1}^{L}S_{k-1}h_k(\delta)c_k(\delta) v_k
-G_{cancel/reentry}(L).
$$

这说明相同的累计十秒P3为何可能支持不同TTL：早期hazard高且$v_k<0$时，缩短寿命可能有利；早期hazard对应有利repair时，过快cancel则删除价值。Reach-time研究只识别了$h_k$，所以它为寿命实验提供坐标，却没有替实验作出动作结论。

### 右删失与 coverage censor 不能共用一个标签

订单/路径在完整观察窗结束前尚未触达，是正常right censor或survival；source中断、day-end不足horizon或timestamp失序则是数据不可观测。前者提供“至少生存到这里”的信息，后者不一定。把两者都记作0会系统性压低hazard。

离散likelihood对完整未触达路径贡献$\log S_K$，对第$k$ bucket事件贡献$\log S_{k-1}+\log h_k$。若在第$c$ bucket因合法administrative censor结束，只贡献$\log S_c$；若coverage未知，通常应从可识别起点排除或给出bounds，而不是假设没有事件。

### Integrated Brier 通过仍需看 hazard calibration

IBS对整个时间区间平均，早期与晚期误差可以互相抵消。实际订单寿命若集中在1–5秒，30秒后改善对动作价值很小。报告应同时给policy-weighted IBS、关键TTL上的CDF calibration和near-distance cells。

另一个检查是survival probability mass：$S_k+\sum_jF_{k,j}=1$，随时间$S$单调下降、CIF单调上升。数值上零violation说明实现结构闭合，但不保证市场transport；每个日期、source与side仍要分别看误差。

### 一个 hazard-to-value 实验的冻结接口

对每个合法active/placement state，输入完整hazard slice而不是单个十秒概率；候选actions只改变quote distance或TTL。queue conversion与fill-conditioned terminal value使用独立模型或paired replay，三者的输入/输出类型明确区分。

预注册scorecard先要求hazard在实际action support内校准，再要求candidate产生足够路径分叉，最后比较terminal value与tail。若经济失败，不能回头选择另一个horizon cell；那会把完整曲面的多重选择重新引入旧adapter问题。

### 9. 公共证据

- [Aggressive Reach-Time Development 报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_aggressive_reach_time_conditioned_hazard_v1_development_20260804.md)
- [冻结人类可读 Spec](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_aggressive_reach_time_conditioned_hazard_v1_spec_20260804.md)
- [Reach-Time Surface Design](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_aggressive_reach_time_surface_v1_design_20260804.md)
- [Source-Day Manifest](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f02_empirical_p3_touch/docs/p3_reach_time_source_day_manifest_v1_20260804.json)

模型文件、cache 与逐行 OOF reports 不随公共仓库分发；公开文档提供可复核的身份、聚合结果和权限。

![P3 从十秒触达曲线到 reach-time hazard 的阶段结果与权限边界](/images/narrowgate/p3-research-synthesis.svg)

*图：P3 的概率层多次得到支持，但标量 adapter 给出了关键经济反例；joint quote selector 也没有找到优于 baseline 的 OOF 动作。*

## 10. 合并后的结论：P3 成功回答了概率问题，却没有跨过报价价值的桥

这条研究链留下了一个可复用的 first-passage probability 基础设施，也留下了一个实质性反例：更好的概率模型通过错误 adapter 接入旧报价 ABI，可以让报价更激进、成交更多，却让 terminal MTM 更差。失败的不是概率建模本身，而是把不同 estimand 压成相似标量的工程捷径。

未来若再次从 P3 走向动作，必须直接评价候选 joint quote 的完整价值，而不是先构造一个貌似 GLFT 的 $\kappa_{eff}$。最低合同包括 side-specific exact-distance surface、policy-visible feature-ready clock、submit/activation/queue/cancel/fill path、assignment 后的 campaign terminal USDC，以及足够日期和 chronological folds。达到这些条件之前，P3 是 prediction evidence，不是 fill probability、Quote EV 或 live authority。
