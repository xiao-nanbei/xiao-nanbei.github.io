---
title: 'NarrowGate External Market Alpha：三交易所参考、信息衰减、First-Add 与 Fair-Center 动作'
date: 2026-08-29 13:30:00
updated: 2026-08-30 02:04:00
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


Last materially modified: 2026-08-30


## 1. BABEL 外部市场研究是一张并行路线图

Bitget、Bybit 与 OKX 的价格和主动成交可以提供本地 BTCUSDC 之外的信息，但“外部市场有预测增量”离“应当移动本地报价”相隔多层。Stage 0、information decay、causal fair price、first-add M0/M1、adverse-edge guard 和 fair-center randomized replay 都属于同一 BABEL 研究计划的不同桥段：先建立信息与时钟，再建立坐标，再问状态价值，最后才允许动作。

统一结构可以写成

$$
\text{external messages}
\rightarrow \text{causal visible state}
\rightarrow \text{local fair coordinate}
\rightarrow \text{quote action}
\rightarrow \text{queue/fill/inventory}
\rightarrow Y_T.
$$

任何中间箭头通过都不自动证明下一条。尤其 provider exchange-time bars、AWS receive-time state 与本地 policy-ready clock 是不同证据层；two-of-three consensus 的稳健性也不等于 leave-one-venue-out 的经济稳定性。

## 2. 研究阶段与证据状态

| 阶段 | 它真正问什么 | 结论/权限 |
|---|---|---|
| Global Reference Stage 0 | 三 venue 状态是否提供可证伪的本地增量？ | 描述/预测线索存在；无 action |
| External information decay | 外部创新在几秒后失去增量？ | 1–7 秒 prediction increment；prediction only |
| Causal fair price | 如何消除 basis 并构造 2-of-3 稳健坐标？ | coordinate/mechanics evidence；无 alpha 权限 |
| First-add M0/M1 | 外部 receive-time state 能否识别负价值 first-add？ | 数量门完成；exact lifecycle/common-row 阻塞 |
| Adverse-edge guard | 外部 adverse edge 能否安全外移 exposure quote？ | mechanics 可动但支持率过低；无 action |
| Fair-center randomized action | 平移整对 bid/ask 是否改善 terminal value？ | 点估计正但 CI 与 LOO 反向；关闭 |

## 3. Global Reference Stage 0

### TL;DR：三家交易所提高了可证伪性，却没有把秒级残差变成稳定 maker alpha

这项研究把 Bitget、Bybit 与 OKX 的现货和永续逐笔成交转换成因果可见的一秒状态，再用 Binance BTCUSDT 永续和 USDCUSDT 现货把外部价格翻译到 BTCUSDC 坐标。三家来源不是为了投票得出一个“必涨”信号，而是为了建立 2-of-3 共识、加权中位数、异常源剔除和逐家 leave-one-venue-out（LOO）反证。

冻结面板覆盖 111 个保留 UTC 日。OKX 永续含 `399,947,490` 笔标准化成交和 `8,742,874` 个一秒状态，OKX 现货含 `69,915,914` 笔成交和 `5,846,509` 个状态，USDCUSDT 锚含 `46,776,513` 笔聚合成交和 `8,792,656` 个一秒 bars。三交易所现货与永续联接后有 `7,547,083` 个状态；层级 reference 最终有 `6,247,083` 个状态，其中 `4,659,028` 个同时通过新鲜度、2-of-3、方向一致、离散度与因果 basis gates。

最值得保留的线索是 `SELL submit 1s`：它是唯一在全来源和三个 LOO 版本中，30 秒与 campaign delta 均保持正向的 global-residual row。但量级只有约 `+0.05` 到 `+0.10 bps`，5 秒效果为负，逐日方向接近一半；`SELL fill + divergent` 虽有更大的 30 秒线索，却不能在短时、campaign repair 与 LOO 中稳定复现。因此 Stage 0 没有授权 re-center、cancel、tighten、size 或 lifecycle 动作。

更重要的勘误是：旧报告里 maker markout、fill、campaign 与 PnL 的精确表使用了后来被替换的本地 mixed-L2/queue denominator，现已撤回。仍成立的是外部逐笔成交的一秒因果状态构造和 LOO 方法，以及“本次 Stage 0 不足以授权动作”。它不等于“外部信息没有价值”，也不能否定 receive-time BBO/trades 对亚秒 fill toxicity 的价值。

![三交易所外部状态到BTCUSDC参考坐标的因果链](/images/narrowgate/three-venue-global-reference-stage0.svg)

*图 1：机制示意。三家现货/永续价格先做因果 basis 与共识，再经 BTCUSDT/USDCUSDT bridge 进入 BTCUSDC 坐标；一秒状态只能在右边界可见。图中 K 线与数值位置为机制说明，不是实盘行情。*

本文只复述冻结的公开 Development 证据，不建议任何真实交易行为。

### 1. 研究问题：外部市场“先动”能否排序本地 maker 结果

BTCUSDC 的本地订单簿并不孤立。BTCUSDT 流动性更深，多个交易所的现货和永续也可能先出现共同方向、spot/perp 分歧或某家异常。直觉上，外部市场先跌时，继续在本地卖出似乎更安全，继续买入似乎更危险；但这个直觉混合了价格翻译、时间可见性、来源故障与交易动作四件不同的事。

Stage 0 把问题收窄为：在不改变报价、尺寸、库存限制、撤单或成交的前提下，一个由三交易所逐笔成交构造的秒级 external state，能否稳定排序之后 5 秒、30 秒与 campaign 层结果？

这首先是 diagnostics，而不是策略。若状态连结果排序都不稳定，就没有理由进一步做 action；若排序稳定，也仍需要另一个冻结动作实验来回答“移动报价是否改善价值”。

### 2. 输入、状态、动作与 estimand

外部输入分成三层：Bitget、Bybit、OKX 现货形成 robust spot innovation；同三家的永续形成 derivatives innovation；Binance BTCUSDT 永续提供本地 level bridge，USDCUSDT 现货提供稳定币换算。Binance BTCUSDC 现货只作 cross-check 与 freshness fallback，不作为第四张独立选票。

设交易所 $v$、市场层 $m$ 的一秒对数收益为 $r_{v,m,t}$，通过新鲜度和因果 basis 后保留有效来源集合 $V_t$。方向共识可抽象为：

$$
c_{m,t}=\operatorname{median}_{v\in V_t} r_{v,m,t},\qquad |V_t|\ge 2.
$$

再把外部共识相对本地 bridge 的残差写成：

$$
e_t=10^4\left[\log P^{ext}_t-\log\left(\frac{P^{BTCUSDT}_t}{P^{USDCUSDT}_t}\right)\right].
$$

这里 $e_t$ 只是 bps 坐标中的 state，不是订单。研究中的“动作”仍是历史 maker event 的 submit 或 fill 类型，用来切片结果；实验没有真的改变任何订单。主要 estimand 是条件状态下未来本地结果相对基线的差异，例如：

$$
\Delta_h(s)=E[M_{t,h}\mid S_t=s]-E[M_{t,h}\mid S_t\in baseline],
$$

其中 $h\in\{5s,30s\}$，另有 campaign terminal/repair diagnostics。由于本地 outcome denominator 后来被撤回，今天不能再把旧精确数字当成可用经济估计；只保留其方向稳定性不足所支持的 no-action decision。

### 3. 数据面板与两只时钟

每个历史外部 row 使用右边界可见性：在区间 $[t,t+1s)$ 内发生的逐笔成交，最早只能在 $t+1s$ 被特征使用。正确的因果写法是：

$$
T^{visible}_{t}=\max_i T^{event}_i\text{ in }[t,t+1s)+1\text{ bucket edge},
$$

而不是把左标签 $t$ 当作当时已知。这个一秒延迟既避免未来泄漏，也决定了研究能力上限：数据不能辨认 50ms 与 100ms 的信息衰减，更不能证明一个亚秒撤单策略可执行。

| 证据层 | 冻结定义 | 能回答什么 | 不能回答什么 |
| --- | --- | --- | --- |
| 外部成交 | 111 个 retained UTC 日 | 来源覆盖与一秒共识 | receive-time 亚秒输运 |
| 状态时钟 | $[t,t+1s)$ 在 $t+1s$ 可见 | 秒级因果排序 | bucket 内最佳时点 |
| 来源反证 | all + 三个单源 LOO | 是否依赖某一家 | 所有来源同时故障 |
| 本地结果 | 历史 maker outcome slices | 仅保留诊断性方向 | 已撤回 denominator 的精确 economics |
| 动作层 | 没有 intervention | 无 | 报价变化的因果收益 |

面板规模本身不是有效性的替代品。数百万一秒 rows 高度相关，真正的稳定性应按 UTC 日与来源删除来检验；如果只把每秒 row 当独立样本，置信度会被夸大。

### 4. 层级 reference 如何避免“某一家带偏”

三交易所设计最重要的价值是 falsification。两家来源方向一致、第三家偏离时，可以用 2-of-3 和中位数降低单源异常的影响；若删去任意一家后结果方向改变，则原信号更可能是 venue-specific artifact，而不是跨市场共同状态。

每个状态还必须通过五类 gates：数据足够新鲜；至少两家有效；spot 或 perp 的方向规则成立；跨来源离散度不过大；稳定币与 venue basis 只用过去观测更新。basis 的更新顺序必须是“先读过去状态、再输出当前、最后提交当前观测”，否则当前价格会反向污染用于校正自己的参数。

举例说，若 Bitget 永续突然下跌，而 Bybit、OKX 以及现货层都没有同方向变化，简单平均会产生假的 external-down residual。2-of-3 会拒绝它；LOO 还会显示结果只在包含 Bitget 时存在。这种“让信号更少”的机制看似保守，却比追求更高触发率更适合 Stage 0。

### 5. 冻结数据结果

| 数据构件 | 规模 |
| --- | ---: |
| OKX 永续 normalized trades | 399,947,490 |
| OKX 永续 causal 1s states | 8,742,874 |
| OKX 现货 normalized trades | 69,915,914 |
| OKX 现货 causal 1s states | 5,846,509 |
| USDCUSDT aggTrades | 46,776,513 |
| USDCUSDT 1s bars | 8,792,656 |
| 三交易所 spot states | 7,747,571 |
| 三交易所 perp states | 9,225,272 |
| spot/perp joined states | 7,547,083 |
| hierarchical reference states | 6,247,083 |
| strict gates passed | 4,659,028 |

大覆盖证明 reference 可以构造，不证明 maker action 有价值。冻结审计里，只有 `SELL submit 1s` 在全来源和三种 LOO 中同时保留正的 30 秒与 campaign delta；但它的 30 秒量级约 `+0.05` 至 `+0.10 bps`，5 秒为负，逐日正负接近各半。

`SELL fill + divergent` 的较长 horizon clue 更大，却在 5 秒接近零或翻转，删除某家后 campaign 与 repair 也不稳定。`BUY submit + perp_only_up`、`SELL fill + perp_only_up` 只是局部长时线索；`spot_leading` 小桶则样本不足。这样的结果适合生成下一步问题，不适合把 threshold 写进报价器。

### 6. 为什么旧 maker 数字必须撤回

后续数据治理发现，原报告所联接的本地 BTCUSDC outcomes 使用了已经被 normalized/native replay 取代的 mixed L2/queue identity。它会影响 fill、queue 与 campaign denominator，所以即使外部 state 本身无误，也不能继续引用旧 markout、fill、campaign 或 PnL 精确表。

撤回不是把整个研究删除。可复用部分包括：来源翻译、一秒右边界、2-of-3、LOO、因果 basis、严格 gates 和对短长 horizon 不一致的观察。不可复用部分是基于旧本地 denominator 的经济量级。把这两部分分开，比用“结果大概没变”强行保留数字更诚实。

### 7. 研究演进为何合并为一篇

这个项目曾出现 Stage-0 report、中文 review memo、cross-venue reference-to-alpha roadmap 和早期七日 OKX provenance。它们不是四个独立研究项目：七日版本被 111 日审计取代；review memo解释相同 LOO 与 false-negative 风险；roadmap只是说明从 data/reference 到 prediction/action 的权限阶梯。

真正的 research identity 始终是“逐笔成交的一秒三来源 reference 能否稳定排序 maker outcomes”。版本和勘误应作为本文章节保存，因为它们改变证据可信度，却没有提出新的 estimand。

### 8. 不确定性、关闭边界与下一步

Stage 0 冻结并关闭继续在同一个一秒聚合状态上搜索更多 threshold。反复试 residual cutoff、divergence bucket 或 horizon 会把同一面板变成训练集，LOO 也无法修复多重搜索。

它关闭的链条是：

$$
\text{archived trades}\rightarrow\text{causal 1s state}\rightarrow\text{maker action}.
$$

它没有关闭：

$$
\text{receive-time BBO/trades}\rightarrow\text{flow/depletion}\rightarrow\text{fill toxicity}.
$$

第二条链需要真实接收与 feature-ready clock、10/25/50/100/250/500ms windows、当前 native local outcomes，以及独立 prediction/action 注册。不能把本研究的负结果拿去阻止那个问题，也不能把本研究的零星线索直接当作动作先验。

### 9. 没有获得的权限

本项目没有读取 Validation 或 sealed holdout，没有获得 prediction promotion、quote action、re-center、cancel、widen/tighten、size、shadow deployment 或 live authority。保留全部六个外部 spot/perp 来源作为未来研究输入，只表示数据层有价值，不表示任一策略已获准运行。

### 深入推导：global reference 为什么首先是一个稳健坐标问题

多个 venue 的 mid 不能直接平均。不同合约有 basis、不同 tick、不同 freshness 与偶发 stale source。Stage 0 的合理结构是先把每个 venue 转成与本地 BTCUSDC 可比的过去时标度，再做稳健聚合：

$$
r_v(t)=\frac{m_v(t)}{b_v(t^-)},\qquad
G_t=\operatorname{wmed}\{r_v(t);w_v(t^-)\}.
$$

$b_v(t^-)$ 与 $w_v(t^-)$ 必须只用过去数据估计；当前或未来本地价格不能参与“校准”外部 venue。weighted median 的好处是单一 venue 暂时偏离时不会像均值一样被直接拉走，但它也不是万能：若三家共享同一美元流动性冲击、或多数 source 同时 stale，稳健聚合仍会失败。

![外部市场从 source clock 到 maker action 的证据链](/images/narrowgate/f04-external-signal-to-action-clock.svg)

*图 2：Stage 0 只建立外部 reference 与本地残差的预测/诊断坐标；center shift、widen 或 guard 属于后续独立动作。*

### Residual 可预测不等于 maker fill 有价值

令本地残差为 $e_t=m_{local,t}-\alpha_t G_t$。若 $e_t$ 在未来数秒均值回归，方向模型可能有正 AUC 增量；但 maker action 还取决于当前 order role。BUY add 看到本地低于 global fair，可能意味着本地即将上行、挂 BUY 有利；也可能意味着外部已经跳动而本地盘口尚未更新，眼前 BUY quote 正暴露在 stale-book 风险中。

两种解释需要不同动作，一个可能 recenter，另一个可能 widen/cancel。仅凭 residual 符号无法区分，必须加入 source age、lead/lag、local flow、queue 与 inventory，再在完整路径上估计。

这也是旧 maker 数字撤回后仍可保留 Stage 0 mechanics 的原因：稳健 reference 的计算与 prediction increment 可以独立审计，而旧 quote mapping、P3、queue 或 timing defect 会使经济结果失效。

### Leave-one-venue-out 应怎样用

跨 venue 信号最常见的伪稳定，是其实由一家主导。对每个 venue $v$，应计算移除后的 reference $G_t^{(-v)}$，并比较 prediction 与动作差值。若结果只在包含某一家时存在，结论应写成“该 source 在该面板提供增量”，不能泛化为“三市场共识”。

LOO 还要结合 freshness。移除一个经常 stale 的 venue，结果改善可能只是数据质量；移除最领先 venue 后消失，则可能是真实信息贡献。两者的后续工程完全不同。Stage 0 提高可证伪性的意义，正在于让这些来源假设可被逐一拆解，而不是把所有 external rows 混成一个黑箱 feature。

### 三个 venue 并不等于三个独立样本

Binance、OKX与Bybit常被同一全球冲击驱动，venue residual也会通过套利迅速相关。因此“有三家交易所同时先动”不能按三次独立证据计算。层级reference的价值主要在robustness：某一家source gap、异常print或局部basis漂移时，weighted median不至于被单点拖走。

统计不确定性仍应按时间块或日期cluster，而不是按venue倍增样本量。Leave-one-venue-out回答的是结论是否依赖某一家：

$$
\hat g^{(-v)}(h)
=
E[r_{local,t+h}\mid R_t^{global,-v}],
$$

若去掉任何venue后方向都保留，说明reference较稳健；若只有包含某一家才显著，应该把它标为single-source hypothesis，而不是“全球信号”。

### 从 reference residual 到 maker action 还差一次条件化

global residual预测本地未来中价，不自动预测某张maker单的价值。假设external reference显示本地价格偏高，预期回落：对BUY exposure-add可能危险，对SELL exposure-add可能有利；但对已有SHORT的BUY reducing单，回落前是否成交、随后是否repair又会改变符号。动作方向必须同时条件于side与inventory role。

更完整的对象是

$$
\Delta V(a\mid R_t,q_t,role_t,queue_t),
$$

而不是$E[\Delta mid\mid R_t]$。Stage0只检验reference与residual的可预测结构，合理地停在动作前。若后继要进入报价，应冻结一组局部actions，使用同一global reference、相同book与latency路径做paired full-path比较，并检查venue dropout、signal age和state support。

### 为什么阴性 Stage0 仍然有价值

秒级maker alpha没有稳定出现，排除了“多接两家交易所就能直接预测赚钱”的简单故事。但项目同时建立了past-only basis、venue内融合、跨venue稳健中心与source outage处理，这些是任何后继外部信号研究的公共坐标系。

阴性结论还限制了调参空间：不能在已读窗口上挑lead lag、venue subset或权重救结果；新的hypothesis必须说明为什么某个state、action或更短延迟能改变Stage0的失败机制，并在新身份上验证。这样三venue建设不是白费基础设施，而是把一个宽泛叙事压缩成更可证伪的问题。

### 价格归一化不只是除以一个汇率

不同venue可能交易BTCUSDC、BTCUSDT或不同contract multiplier。统一成USDC/BTC需要处理stablecoin basis、spot/perpetual basis、funding/expiry结构和tick rounding。短期signal若来自perpetual，还可能混入本地mark/index机制，而不是纯粹领先现货。

past-only basis只能用$t$前信息估计，且要给age与uncertainty。source stale、basis jump或symbol state异常时，venue应降权而不是用最后值永久参与median。三家里两家同时stale，weighted median也会稳定地给出错误中心。

### Residual prediction 的 benchmark 应有多强

M0至少包含本地自身滞后、spread、volatility与session state，否则external模型可能只是补上本地遗漏的惯性。M1增加外部reference后，比较必须在相同common mask、相同loss和日期权重上进行。若M1只在外部齐全的容易时段评分，增量会被missing selection污染。

预测horizon也应扣除ready/submit latency。Stage0在秒级残差上无稳定maker alpha，不能通过选择更短但不可执行的exchange-time horizon救援。后继若主张低延迟优势，必须提供policy-ready clock和目标环境延迟分布。

### 一条端到端的反事实时间线

外部venue在$t_e$先动，消息在$t_r$ ready；策略于$t_d$ decision，订单在$t_a$ ACK。只有$t_a$之后market尚未完成本地调整，signal才可能影响fill path。有效领先窗口为

$$
L_{usable}=t_{local\ adjust}-t_a.
$$

若$L_{usable}\le0$，历史相关性无法交易。即使大于零，还要比较recenter/widen/skip哪个动作在inventory role下有价值。Stage0的阴性使这条时间线成为未来研究的第一张检查表。

### 10. 公共证据

- [Three-Venue Global Reference Stage 0](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/docs/global_reference_stage0_retained111_20260711.md)
- [Global Market Reference Review Memo](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/docs/global_market_reference_review_memo_20260711.md)
- [F04 External Market Alpha README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/README.md)

公共材料只发布冻结方法、聚合规模、状态与权限边界；原始逐笔数据、逐日路径和未发布机器工件不随文章分发。

## 4. External information decay

### TL;DR：外部增量在 1 秒边界最强，1–7 秒通过 simultaneous lower bound

“外部市场比本地先动”不是一个没有时间尺度的命题。NarrowGate 先做过 1/3/5 秒的历史 granularity audit：在保守的一整个 bucket 可见性延迟下，3 秒 direction 是当时唯一在旧 screening、chronological test 和三个 later days 上保持同向的头；而 production-style 10 秒方向增量几乎为零。这个结果提示信息衰减很快，但从三个预选 horizon 中挑出 3 秒，仍可能把研究者的选择写进结论。

正式 `external_information_decay_v1` 因此冻结完整的 1–18 秒整数曲线。M0 使用本地 BTCUSDC 与 Binance BTCUSDT 状态，M1 在同样模型上增加 Bitget、Bybit、OKX 的现货/永续状态；目标是未来 BTCUSDC 方向。训练用 69 个时序日、内部过去七日 early-stopping tail 与一天 embargo，Development screening 用 20 个共同 UTC 日。选择统计量是逐日配对 AUC 增益的均值，并用 2,000 次 day-cluster bootstrap 构造覆盖全部 18 个 horizon 的双侧 95% simultaneous max-absolute band。

结果非常清楚又很有限：1–7 秒的 simultaneous lower bound 均为正；1 秒 mean daily AUC gain 为 `+0.002910`，18/20 日为正，simultaneous LCB `+0.001393`，成为 bootstrap 中最佳 horizon 的频率为 `76.5%`。2 秒与 3 秒分别为 `+0.002728`、`+0.002292`；经验 post-peak half-gain horizon 是 9 秒。正式结果取代“3 秒是自然最佳 target”的旧说法。

但 1 秒是档案分辨率的左边界，不是被观测到的内部峰值。研究能说“在 1–18 秒中，Development 最支持 1 秒”，不能说“市场的真正最优 horizon 正好是 1 秒”，更不能推导亚秒撤单、改价或 live action。Test 与 late panels 没有在 v1 中读取；通过的只是 prediction candidate，动作仍需另一项研究。

![外部市场领先、本地滞后与1至18秒信息衰减曲线](/images/narrowgate/external-information-decay-kline.svg)

*图 1：冻结聚合结果与机制示意。左侧 K 线表示外部价格先发生创新、本地随后反应；右侧曲线显示 M1−M0 日均 AUC 增量随 target horizon 衰减。K 线不是实盘行情。*

本文只讨论历史 Development prediction evidence，不建议任何真实交易行为。

### 1. 研究问题：信息有多长的“可预测寿命”

若外部 venue 的价格创新在本地完全同步体现，加入它不会增加预测力；若外部先动，它可能在短 horizon 上提升方向预测。但 maker 关心的不是抽象 lead，而是这个增量能否活过观测、聚合、特征计算与决策时钟。

研究问题因此是：在固定的因果一秒可见性合同下，外部三 venue 状态相对本地 baseline 的方向预测增量，在 $h=1,2,\ldots,18$ 秒上如何衰减？应该选哪一个 horizon 进入独立确认，而不是一次性把所有 horizon 都带入策略？

这个问题与“哪个 feature lookback 最好”不同。内部仍保留固定 multiscale basis；实验只改变 future-direction target horizon。也与“是否取消当前订单”不同：方向 prediction 没有定义 action cost、queue loss、inventory feedback 或 campaign terminal value。

### 2. M0、M1 与 estimand

M0 是本地信息模型：本地 BTCUSDC 加 Binance BTCUSDT trade state。M1 在 M0 上加入 Bitget、Bybit、OKX 的 spot/perp states。对每个 horizon $h$，两者使用同一 UTC 日与同一可评分 rows，比较：

$$
\Delta_{d,h}=AUC_{d,h}(M1)-AUC_{d,h}(M0).
$$

正式 estimand 不是把全部 rows 混在一起后的 pooled AUC 差，而是逐日配对均值：

$$
\bar\Delta_h=\frac{1}{D}\sum_{d=1}^{D}\Delta_{d,h},\qquad D=20.
$$

这样每天是统计 cluster，防止数百万高度相关的一秒 rows 伪装成数百万独立样本。M1 的问题也被准确限定为 incremental value：M1 自身 AUC 高，不代表外部信息有用；只有相对同一 M0 baseline 的增量才回答研究问题。

选择不是简单取最大的 $\bar\Delta_h$。对 18 个 horizon 同时搜索会产生 winner's curse，因此 bootstrap 对每次 day-cluster 重采样计算完整曲线，并用最大绝对偏差形成 family-wise band：

$$
LCB_h=\bar\Delta_h-q_{0.95}\left(\max_j|\bar\Delta_j^*-\bar\Delta_j|\right).
$$

冻结规则选择 simultaneous LCB 最大的 horizon；“最佳 horizon 频率”则报告某个 $h$ 在 bootstrap replicas 中成为最大增量的频率，它是选择稳定性描述，不是 posterior probability。

### 3. 为什么上界是 18 秒

参数支持没有从外部预测结果倒推。预规格前的 current-order placement panel 覆盖 40 日、`659,358` 个已激活且能观测 terminal lifetime 的订单，active lifetime 的 p25/p50/p75/p95 为 `5.005 / 5.706 / 7.633 / 17.378s`。研究把 p95 向上取整为 18 秒，得到完整的 $1..18s$ grid。

这是一条 judgmental engineering rule：如果大多数当前订单在 18 秒内已经终结，更长方向 target 与订单生命周期的直接关联变弱。它不是市场理论常数；换交易所、订单策略或 cooldown，support ceiling 都可能变化。

完整网格还有一个治理作用。旧 1/3/5 秒研究容易在看到结果后讲“3 秒符合直觉”；现在每一个整数 horizon 都在结果前声明，1 秒、4 秒或 7 秒也同样有资格获选。

### 4. 数据与因果时钟

外部逐笔成交先聚成一秒状态。在 $[t,t+1s)$ 内的交易必须到右边界 $t+1s$ 后才可见，且研究再施加一个完整的一秒外部 visibility delay。历史 archive 没有同一 collector 的精确 receive time，因此这个模型是保守的 bucket 级可执行近似，不是亚秒 transport 测量。

| 层级 | 冻结合同 |
| --- | --- |
| Target support | 每个整数 horizon 1–18 秒 |
| Feature visibility | right-edge causal 1s + 一整秒外部延迟 |
| Training | 69 chronological days |
| Inner tuning | 过去七日 early-stopping tail + 一日 embargo |
| Development | 20 common UTC days，2026-05-12 至 2026-06-12 |
| Cluster | UTC day |
| Multiplicity | 18-horizon simultaneous max-absolute band |
| 未读面板 | frozen test 与 late |

early stopping 必须只使用 training 内的过去 tail。较早实现曾允许 outer screening panel 参与 early stopping；正式 v1 在任何 target 拟合前修复为 fail-closed。缺失或延迟的 external age 也不能填零冒充 fresh，而是映射为非常陈旧状态。这些是同一研究 identity 的因果修复，不是新项目。

### 5. 冻结的 1–18 秒结果

| Horizon | Mean daily AUC gain | Positive days | Simultaneous 95% LCB | Best frequency |
| ---: | ---: | ---: | ---: | ---: |
| 1s | +0.002910 | 18/20 | +0.001393 | 76.5% |
| 2s | +0.002728 | 20/20 | +0.001211 | 14.0% |
| 3s | +0.002292 | 19/20 | +0.000775 | 0.6% |
| 4s | +0.002452 | 18/20 | +0.000935 | 8.0% |
| 5s | +0.002168 | 15/20 | +0.000651 | 0.05% |
| 6s | +0.001781 | 17/20 | +0.000264 | 0.05% |
| 7s | +0.001677 | 16/20 | +0.000160 | 0.0% |
| 8s | +0.001491 | 16/20 | -0.000026 | 0.0% |
| 9s | +0.001072 | 13/20 | -0.000445 | 0.0% |
| 10s | +0.001290 | 14/20 | -0.000226 | 0.05% |
| 18s | +0.001019 | 11/20 | -0.000498 | 0.0% |

1–7 秒全部有正 simultaneous LCB，说明短 horizon 增量不是只靠挑中一根最高柱子；8 秒以后 lower bound 开始跨零。曲线并非严格单调，例如 4 秒略高于 3 秒、10 秒略高于 9 秒，这是有限日样本中的正常波动。冻结选择仍是 LCB 最大的 1 秒。

post-peak half-gain horizon 为 9 秒：它描述经验曲线从 1 秒峰值下降到一半附近所需的时间，不是说 9 秒一定无用。事实上 10 秒 mean gain 仍为正，只是其 uncertainty 无法排除零；“大部分方向增量在 10 秒前消失”比“10 秒没有任何信息”更准确。

### 6. 历史 3 秒结果如何被合并，而不是另写一篇

前身 audit 只比较 fast `1s/3s/5s` 与旧 10 秒 bundle。在一整 bucket 延迟下，3 秒 M1−M0 AUC gain 在旧 screening、test 与三个 later days 分别约 `+0.00365`、`+0.00413`、`+0.00381`，正日为 20/20、20/20 与 3/3；绝对 AUC 约 `0.59445`、`0.59611`、`0.62382`。相反，旧 10 秒 direction gain 只有约 `+0.000050`、`+0.000055`、`+0.000151`，实质接近平坦。

这些历史结果提供了“衰减在数秒内发生”的动机，但它们已经看过旧命名为 validation/test/later 的面板，不能再被包装为 v1 的 untouched confirmation。正式 v1 更换为完整支持、明确 Development 角色、past-only early stopping 和 simultaneous selection，并推翻了“3 秒天然最佳”的叙事。

因此 granularity audit、正式 decay curve 和执行中的 target-name collision 都属于同一个 research project 的演进。`fast1s/dir_10s` 与历史 `10s/dir_10s` 曾发生名字冲突，修复只是让 cadence 进入 target identity；1–9 秒已完成 artifacts 被严格校验后复用，10–18 秒继续拟合。没有 feature、label 或 model parameter 被借故改变，也不值得单独写成“执行修复研究”。

### 7. 一个具体的时钟例子

假设外部市场在 `12:00:00.200` 到 `12:00:00.800` 连续下跌。该创新进入标记为这一秒的 archive state，但最早在 `12:00:01` 右边界可见；再加一个完整 visibility bucket 后，模型按冻结合同使用的时间更晚。一个 1 秒 target 此时已经非常接近数据能表达的最快边界。

如果真实 collector 在几十毫秒内看见该变化，archive 研究会低估可用时长；如果真实网络在拥塞时更慢，它又可能高估执行可用性。于是 1 秒胜出只说明需要 receive-time event study，而不是许可直接把 1 秒 prediction 接入报价。

### 8. 关闭、支持与未获权限

支持：外部 venue state 对未来本地方向有短寿命的 Development 增量；在声明的数据与模型 identity 下，1 秒是进入独立确认的 prediction candidate，1–7 秒的 family-wise lower bound 为正。

关闭：继续从同一 Development curve 重新挑 2 秒、3 秒或任意 lookback；把历史“3 秒自然最佳”当现行结论；把旧 10 秒 bundle 当当前生产模型说明。

未关闭：亚秒 receive-time decay、side-specific maker fill quality、动态 event-time kernels，以及任何经济 action estimand。

没有获得：Test/late 读取、Validation promotion、cancel、widen、re-center、quote replacement、shadow 或 live authority。prediction qualification 也不能跨层继承为 action permission。

### 深入推导：为什么必须对整条 horizon 曲线同时推断

若分别对 18 个 horizons 计算 95% interval，再挑点估计最大者，family-wise false positive 会远高于 5%。研究使用 day-cluster bootstrap 的 max-absolute statistic，本质上在每次重采样中保留整条曲线的共同波动：

$$
q_{.95}=Q_{.95}\left(\max_h|\bar\Delta_h^*-\bar\Delta_h|\right),\qquad
LCB_h=\bar\Delta_h-q_{.95}.
$$

这样 1–7 秒 lower bounds 同时为正，含义比“七个单独 p-values 显著”更强；8 秒以后跨零，也不能写成增量精确等于零，只能说 simultaneous evidence 不足。

![外部信息从创新、衰减到动作价值的完整时钟](/images/narrowgate/f04-external-signal-to-action-clock.svg)

*图 2：decay curve 位于 prediction 层；source innovation 到 feature-ready 的延迟会消耗可用 horizon，action 还需额外跨过订单与库存路径。*

### 信息半衰期与系统延迟如何配对

假设外部增量的经验衰减可近似为 $g(h)=g_0e^{-h/\tau}$。post-peak half-gain horizon $h_{1/2}$ 满足 $g(h_{1/2})=g_0/2$，所以 $\tau=h_{1/2}/\ln2$。但这只是 target horizon 上的统计衰减，不是端到端可交易寿命。

从外部撮合到本地动作至少经历 source publish、网络 receive、bucket close、feature compute、decision cadence、order submit 与 exchange ACK。若总延迟为 $L$，真正剩余的信息窗口更接近 $h-L$。1 秒 horizon 在 archive 上最强，可能同时意味着：信号确实很快；当前 1 秒 bucket 已位于分辨率边界；任何额外处理延迟都会吃掉大部分增量。

因此下一步不是把 1 秒标签直接接入撤单，而是先测 receive-time decay 和 decision-time common support。若 $L$ 的高分位接近 1 秒，prediction candidate 可能在 live 不可执行；若 $L$ 只有几十毫秒，也仍需动作实验判断 queue reset 与库存反馈。

### 如何阅读 1 秒胜出而不把边界当峰值

网格从 1 秒开始，所以 1 秒是左边界 winner。研究没有观察 100ms、250ms 或 500ms；真实峰值可能更短，也可能在 1 秒附近形成平台。统计上只能说：在冻结的 $1..18s$ 支持内，1 秒 simultaneous LCB 最大，并在 bootstrap 中最常成为 leader。

这一区分很重要。若把边界 winner 写成自然常数，工程团队会围绕“正好 1 秒”设计 TTL 和 cadence；正确做法是把它当作亚秒/receive-time successor 的方向性证据。旧 3 秒 winner 被完整曲线推翻，也说明 horizon 选择对候选网格敏感。

### 同时置信带为什么比逐 horizon 星号更重要

18个horizons共享同一批起点和重叠未来窗口，误差高度相关。逐点95% interval只控制每个$h$单独犯错的概率；在看完18个点后挑最远仍为正的那个，会显著提高family-wise false positive。研究真正想声明的是“从1秒到某个连续边界都存在增量”，所以需要对整条曲线的最小下界进行同时推断。

设$\Delta(h)$为M1相对M0的score improvement，可以用按日block bootstrap在每次重采样中计算全部$h$，再用最大标准化偏差构造simultaneous band。通过条件近似为

$$
\min_{h\in\mathcal H_0}LB^{sim}(h)>0.
$$

当前1–7秒通过说明这段集合的下界共同为正；8秒以后未通过不等于真实效应恰好在7.000秒消失，只说明现有分辨率和不确定性无法支持更长声明。

### 可用信息寿命要扣除整条系统延迟

预测horizon从source event开始计时，但策略实际利用信号还需经历transport、parent aggregation、feature update、decision scheduling、order submit与exchange ACK。若总延迟为$L$，订单真正享受的剩余预测窗口最多约为$h-L$；当$L\ge h$时，再强的历史关系也没有可执行空间。

延迟也不是一个常数。可以分解为

$$
L=L_{feed}+L_{aggregate}+L_{feature}+L_{decision}+L_{submit}+L_{ack}.
$$

不同venue与事件类型的尾部可能远高于中位数。因此把“1秒边界最强”解释成系统应在1秒内动作，还需要用高分位latency而不是平均值，并确认feature-ready时钟没有把parent child提前暴露。

### Decay curve 对后继实验的具体约束

第一，外部signal若只能在5秒后ready，就不该引用1–3秒prediction pass。第二，holding或order TTL若超过7秒，超出部分不能假设增量继续存在。第三，若策略每10秒才decision一次，随机到达的信号平均等待接近5秒，很多短寿命信息在下一次决策前已经衰减。

这些约束不直接给出widen/recenter/skip动作，却能淘汰时间上不可能的设计。一个后继应先画source→ready→decision→ACK时间线，再选择与剩余信息寿命匹配的action；否则它测试的是陈旧信号，而不是本研究识别的外部增量。

### Decay curve 是 signal 与 target dynamics 的卷积

观察到的$\Delta(h)$不一定等于一条单指数信息衰减。它混合外部冲击强度、本地吸收速度、feature aggregation与label horizon。不同事件类型的快慢成分叠加后，曲线可能先升后降或出现平台。

因此“半衰期”若由拟合$Ae^{-h/\tau}$得到，只是描述性摘要；除非模型fit和residual diagnostics支持，不能把$\tau$当物理常数。当前最稳健陈述是1–7秒simultaneous lower bound为正、1秒边界最强，而不是声称真实峰值精确位于1秒。

### Horizon rows 的重叠怎样影响不确定性

同一event起点贡献1–18秒全部labels，相邻起点的future windows也重叠。row-level IID标准误会把一段价格趋势重复计为大量独立证据。按UTC day或足够长time block重采样，才能保留共同shock与曲线内相关。

若日期很少，simultaneous band仍可能不稳定；应报告positive-day rate、最大单日贡献和leave-one-day-out边界。一个horizon只有删掉某天才通过，说明transport弱，而不是可以把那天叫异常后排除。

### 从 decay 到系统 SLO

信息寿命可反推工程预算：feed、feature、decision与submit各层的高分位延迟之和必须明显低于有支持的horizon。若7秒是最远共同正下界，系统不能把7秒全部花在处理上；还要留给订单激活与市场分离。

SLO应监控端到端ready-to-ACK与source-to-ready，而不是只看本机函数耗时。性能优化只有在缩短最主要延迟分量并保持事件语义时才可能增加可用信息；把parent child提前暴露虽然“更快”，却是因果错误。

### 9. 公共证据

- [External Information Decay v1 Development Result](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/docs/external_information_decay_v1_development_20260727.md)
- [External Venue Model Granularity Audit](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/docs/external_venue_model_granularity_20260713.md)
- [F04 External Market Alpha README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/README.md)

公开文档提供冻结 curve、选择规则、聚合结果与权限；模型 bundles、逐日 score rows 和未发布数据不随文章分发。

## 5. Causal fair price

### TL;DR：这是一条稳健价格坐标，不是 alpha，也不是改价许可

NarrowGate 的 `cross_venue_causal_fair_price_v1` 试图回答一个比“外部市场会不会涨”更基础的问题：如何把 Bitget、Bybit、OKX 的 BTCUSDT 现货和永续，在只使用当时可见信息的前提下，翻译成一个 BTCUSDC 公允价格坐标？

构造分四步。先用过去信息估计每个 venue/market 相对本地币种坐标的对数 basis；再在同一 venue 内按 freshness 与 tracking error 合并 spot/perp；然后在三家之间取至少 2-of-3 的 weighted median；最后用 signal-to-noise gain 把外部 fair 与本地 mid 的差收缩到 baseline reservation price 上。来源不足、离散度过大、稳定币锚过期或 basis/gain 未 warmup 时，一律回退本地 baseline。

历史 Development sensitivity 覆盖 40 个 UTC 日，冻结 all venues 与 leave-Bitget/Bybit/OKX-out 四个 variants。为了不让不同 variants 各自在自己最有利的 rows 上比较，四者共享交集 validity mask：overall common support 为 `0.896466724537037`，最低单日为 `0.667349537037037`。

这个数字证明“坐标在大部分历史一秒 states 上可以按合同计算”，不证明它能预测 campaign value，更不证明中心平移有正收益。历史适配器使用 provider/event-time 的一秒 individual-trade bars，只能做 coverage 与 sensitivity；真实 receive-time BBO 的输运、feature-ready clock 与执行 parity 必须另证。

项目的最终状态是 frozen coordinate evidence。它输出 `causally_visible_cross_venue_fair_price_usdc_per_btc`，没有读取 Validation 或 sealed holdout，没有获得 prediction、action、shadow collection、部署或 live authority。后来的独立对称 fair-center shift 动作失败，也不能倒推出这个坐标“错误”；coordinate 与 action 是不同 estimand。

![三交易所价格经basis和weighted median形成收缩公允中心](/images/narrowgate/cross-venue-causal-fair-price.svg)

*图 1：机制示意。三家 spot/perp 路径先去除 past-only basis，再经 2-of-3 weighted median 与在线收缩系数，得到相对本地 baseline 的 candidate center。K 线和报价位置不代表实盘数据。*

本文只讨论冻结的历史 Development coordinate evidence，不建议任何真实交易行为。

### 1. 研究问题：先把价格说成同一种语言

跨市场信号最常见的错误，是把不同合约、不同稳定币与不同持续 basis 的价格直接平均。BTCUSDT 永续可能长期高于现货，USDT 与 USDC 也不永远严格为 1；某一家来源还会因为维护、稀疏成交或短暂失真偏离其他 venue。

因此研究问题不是“找一个领先交易所”，而是：能否构造一个对单源异常稳健、对币种和 spot/perp basis 有因果校正、在信息不足时 fail closed 的外部 BTCUSDC fair-price coordinate？

输出必须满足三点。第一，任何参数都只能由当前时刻之前的数据更新；第二，删除任一 venue 后仍能在共同 rows 上形成可比 variant；第三，坐标本身不携带 action authority。第三点尤其重要：一个统计上合理的 center 可以在执行中因 spread、queue、fees 与 inventory feedback 而亏损。

### 2. 输入、输出与非目标

输入包括三家 venue 的 BTCUSDT spot/perp，Binance USDCUSDT 稳定币锚，本地 BTCUSDC mid 与 baseline reservation price。每家 venue 可以贡献零、一或两个 market layers；cross-venue 聚合至少需要两家有效 venue。

输出是：

$$
F_t^{ext}=\text{causally visible external fair price in USDC/BTC},
$$

以及经收缩的候选中心：

$$
C_t^{cand}=C_t^{base}+g_t(F_t^{ext}-M_t^{local}).
$$

$C_t^{base}$ 已含本地 inventory reservation 等 baseline 逻辑，$M_t^{local}$ 是本地 mid，$g_t\in[0,1]$ 是 outcome-blind 在线 gain。这个公式不会直接生成 bid/ask，也不决定 move、cancel、size 或 keep。若未来动作要移动整对报价，它必须冻结 spread-preserving rule、tick rounding、GTX clamp、queue reset 和经济 estimand。

非目标包括未来方向分类、campaign value prediction、fill toxicity 和动作收益。即使 $F_t^{ext}$ 看起来领先，本项目也不读取这些 labels 来调 basis、half-life、dispersion gate 或 gain。

### 3. Past-only basis：当前观测不能校正自己

设 venue $v$、market $m$ 的可见价格为 $P_{v,m,t}$，本地可比 anchor 为 $A_t$。对数 basis observation 为：

$$
b^{obs}_{v,m,t}=\log P_{v,m,t}-\log A_t.
$$

但用于当前价格校正的 $\hat b_{v,m,t^-}$ 只能来自过去状态：

$$
\tilde P_{v,m,t}=P_{v,m,t}\exp(-\hat b_{v,m,t^-}).
$$

执行顺序必须是“read past state → emit current fair → commit current observation”。若先把 $b^{obs}_t$ 更新进均值再输出，当前异常会同时改变原始价格和校正量，相当于让观测参与定义自己的基准，削弱因果解释。

冻结 half-life 为 360 秒，minimum basis samples 为 30，maximum absolute basis 为 100 bps。这些都是工程 resilience rules，不是市场定律，也没有按 outcome tuning。warmup 不完整或 basis 超限时，该 source 不参与。

稳定币锚把 BTCUSDT 翻译到 BTCUSDC：

$$
P^{USDC/BTC}_{v,t}=\frac{P^{USDT/BTC}_{v,t}}{P^{USDT/USDC}_t}.
$$

锚本身有 30 秒 maximum age；过期时回退，而不是默认 USDCUSDT 恰好等于 1。

### 4. Venue 内融合与跨 venue weighted median

同一 venue 的 spot 与 perp 经 basis 校正后，按 freshness 与 tracking-error noise 加权：

$$
F_{v,t}=\frac{\sum_m w_{v,m,t}\tilde P_{v,m,t}}{\sum_m w_{v,m,t}}.
$$

权重越高表示状态越新、历史 tracking error 越小。它不表示该 venue “更会预测未来”。在三家 $F_{v,t}$ 之间采用 weighted median，而非均值：只要至少两家有效且形成多数，单一极端值不能任意拉动 aggregate。

2-of-3 是 resilience rule，不是多数一定正确的保证。若三家整体共同跳跃，median 会跟随；若两家同时因共同数据问题偏离，median 也可能错误。因此还需 freshness、max 2 bps dispersion 和 LOO variants。

一个例子：Bitget、Bybit、OKX 校正后分别为 `100.00`、`100.02`、`100.90`。简单平均约为 `100.31`，会被第三个值拖动；weighted median 接近 `100.02`。如果删去 Bitget 后仅剩 `100.02` 与 `100.90`，dispersion gate 可能拒绝并回退 baseline。这个“拒绝给答案”的行为正是 fail-closed 设计。

### 5. Online gain：外部 lead 不是一比一平移

外部 fair 与本地 mid 的差记为 $L_t$。研究用过去的 lead variance 与 measurement-noise variance 构造收缩：

$$
g_t=\frac{\sigma^2_{lead,t^-}}{\sigma^2_{lead,t^-}+\sigma^2_{noise,t^-}}.
$$

当跨 venue 分歧和 tracking noise 大时，$g_t$ 变小，候选中心靠近 baseline；当外部 lead 相对稳定而测量噪声小，$g_t$ 增大。gain 也使用 360 秒 half-life、30 samples warmup 与 variance floor，并遵守先输出再更新。

这不是监督学习的“最优 hedge ratio”。没有 future label 进入 gain；它只是一个 outcome-blind signal-to-noise shrinkage。即使 gain 接近 1，也不表示报价应该移动全部差值，因为执行动作还有 spread cap、tick、inventory 与经济约束。

### 6. 两只时钟与历史适配器的能力上限

理论实时合同区分 truth clock 与 visibility clock：市场事件发生于 exchange event time，但特征只有在本地接收并计算完成后才能用于某次 decision。形式上必须满足：

$$
T^{feature\ ready}_{i}\le T^{decision}.
$$

历史 sensitivity 没有精确的同路径 receive-time BBO，而是 right-edge 一秒 individual-trade bars。因此它能检查价格翻译、coverage、basis 更新、2-of-3 与 LOO sensitivity，不能证明实时网络输运，也不能把 provider event time 当成本地可见时间。

| 层 | 历史 Development 支持 | 仍需独立证明 |
| --- | --- | --- |
| Symbol/currency translation | 支持 | 当前 feed parity |
| Past-only basis | 支持 | receive-time update parity |
| 2-of-3 weighted median | 支持 | outage/failover mechanics |
| Common-mask LOO | 支持 | current lifecycle transport |
| Quote-center economics | 不支持 | randomized replay/OPE |
| Live action | 不支持 | promotion 与安全审查 |

### 7. 40 日 common-mask 结果

历史 cache 冻结四个 variants：all venues、leave Bitget out、leave Bybit out、leave OKX out。四者不是分别使用自己的 valid rows，而是取交集 mask；任何 variant 无效时，全部 variant 在该 row 回退 baseline。这防止 all variant 在容易时段有值、LOO variant 只在另一组容易时段有值，造成不可比。

40 日 overall common-valid fraction 为：

$$
0.896466724537037\approx89.65\%.
$$

minimum daily common-valid fraction 为：

$$
0.667349537037037\approx66.73\%.
$$

这说明大多数一秒 states 能构造四路共同坐标，但某些日仍有三分之一左右时间因来源、锚、warmup 或 dispersion 回退。support 并非 100%，所以任何后续 action 必须把 fallback rows 保留在 denominator 中，而不能只报告 candidate-active rows。

没有预测指标或 PnL 指标可报告，这是有意的。该研究 frozen at evidence-only before action outcome read；参数 grid/outcome tuning 被禁止。

### 8. 研究演进与相邻项目为何不能合并

cross-venue price translation、fair-price spec、historical cache audit、feature DAG 与 coordinate parity 都在回答同一个 identity：坐标怎样被因果地计算。它们是本文的版本/实现章节，不应拆成多篇“研究”。

而 Stage 0 global residual、external information decay 和后来的 fair-center shift action 必须保持独立。Stage 0 问一秒状态是否排序结果；decay 问未来方向的 target horizon；本项目只定义 fair coordinate；动作 sibling 才问移动 bid/ask 是否改善 campaign economics。输入相似不代表 estimand 相同。

后来的对称 center-shift 动作在另一研究族的 24-day Grade-A Development 上点估计为正，但 lower bound 跨零，leave-Bybit-out 的 reward 与 USDC/day 方向为负，因此 action 关闭。这个结果不删除本 coordinate，也不授权改成 outward-only guard；每个动作需要自己的冻结身份。

### 9. 关闭、支持与权限边界

支持：在 40 日历史一秒 sensitivity source 上，past-only basis、2-of-3 weighted median、online gain 和四路 common-mask LOO 可以稳定产出一条有明确 fallback 的 BTCUSDC coordinate，overall support 约 89.65%。

未支持：方向 prediction、campaign value、fill quality、quote-center economic uplift、receive-time transport 与亚秒执行。common support 高不等于收益高。

没有获得：Validation、sealed holdout、参数 outcome tuning、quote mutation、action experiment、shadow collection、model promotion、部署或 live authority。早期 spec 中任何历史性工程许可都不能被解释成当前运行授权；本文采用当前公开 README 的更严格边界。

### 深入推导：past-only basis 与 online gain 各解决什么

外部合约与本地 BTCUSDC 之间可能有稳定 basis。若直接用当前窗口同时估计 basis 和 residual，当前本地价格会部分校正自己，降低表面误差并制造非因果贴合。past-only basis 把变换冻结在 $t^-$：

$$
\tilde m_{v,t}=\frac{m_{v,t}}{\widehat b_{v,t^-}},
\qquad
\widehat b_{v,t^-}=\operatorname{robust\_fit}\{m_{v,u}/m_{local,u}:u<t\}.
$$

online gain 则回答外部变化应有多少投射到本地：

$$
\Delta f_t=\widehat\beta_{t^-}\Delta G_t.
$$

$\widehat b$ 对齐价格水平，$\widehat\beta$ 对齐短时变化幅度；把两者混成一个系数会让长期 basis 漂移和短时 lead/lag 相互污染。

![Cross-venue fair price 的 source、ready 与 action 边界](/images/narrowgate/f04-external-signal-to-action-clock.svg)

*图 2：causal fair price 是价格坐标层，使用 past-only transforms；真正改变报价仍需独立 action-value。*

### Weighted median 的稳健性边界

三 venue weighted median 能抵抗一个孤立异常源，但只有在至少两个有效来源围绕共同价格时成立。需要同时报告 source age、可用来源数、各 venue leave-one-out 差异和共振事件。在极端行情中，如果所有衍生品同时跳动而现货延迟，median 可能代表真实领先，也可能代表共享拥堵；仅看截面一致性无法区分。

因此 reference 输出应携带 provenance：哪些 venue 入选、各自 freshness、权重与 basis age。unsupported 或 stale 状态回退本地 baseline，而不是用零填充或沿用旧 external value。一个没有 provenance 的单一 fair scalar 很难在后续研究中审计。

### 为什么 fair-price MAE 改善仍不是报价证据

若 $f_t$ 对未来本地 mid 的 MAE 更低，说明坐标预测更准。但 maker 的执行价格不是未来 mid；报价向 $f_t$ 移动会同时改变两侧距离、queue priority 与 inventory skew。一个公平中心整体上移，可能让 BUY 更激进、SELL 更保守：前者增加 long exposure，后者减少 repair 机会。

所以 center action 的完整差值应分解为：

$$
\Delta V=\Delta V_{BUY\ fill}+\Delta V_{SELL\ fill}
+\Delta V_{inventory}+\Delta C_{queue/cancel}.
$$

坐标 MAE 只与其中一部分相关。F04 的 causal fair price 因而保留 mechanics/prediction evidence；F09 的 cross-venue fair-center randomized replay 才回答 action value，两篇不能互相授予权限。

### Basis 与 gain 的识别顺序不能交换

venue价格差同时包含稳定basis、短期lead-lag和measurement noise。若先用当前local move拟合gain，再用同一观测校正basis，模型可以把将要预测的变化吸入当期reference。past-only basis要求在$t$之前冻结$b_{v,t^-}$；随后只用已ready的external innovation估计gain。

抽象地，venue$v$的校正价格为

$$
\tilde p_{v,t}=p_{v,t}-b_{v,t^-},
$$

外部创新为$u_{v,t}=\tilde p_{v,t}-\tilde p_{v,t^-}$，最终fair shift才是$\sum_v g_{v,t^-}u_{v,t}$的稳健组合。把$t$时刻local outcome参与$b$或$g$更新，会让同一个价格变化既当输入又当标签。

online gain也必须有shrinkage与support gate。短窗口内某venue偶然领先，不应立刻获得大权重；source stale或basis跳变时，weight应下降或fail closed。weighted median保护单点幅度，但不能修复三家共同的clock错误或共同stablecoin shock。

### Fair-center 改善为什么可能让报价更差

设baseline center误差较大但quotes较宽，candidate center MAE更小却把BUY与SELL整对平移。若平移方向在inventory-exposure side增加了更多toxic fills，terminal value仍会恶化。反过来，一个center prediction总体无显著MAE改善，也可能在特定inventory-reducing role上有动作价值。

因此从fair price到quote至少要区分pair-preserving recenter与side-specific width。前者保持spread但改变两侧相对本地book的位置；后者改变成交机会。完整研究需要记录candidate quote是否cross、距best多少ticks、queue seed、fill role与campaign outcome，而不是把价格预测误差直接换算成PnL。

一个安全的后继顺序是：先在common-mask上验证causal fair price；再做leave-one-venue-out和signal-age敏感性；然后冻结一个很小的recenter action；最后做paired full-path replay。每层失败都停止，不能用后层偶然PnL给前层补票。

### Weighted median 的 breakdown point 与共同故障

weighted median只要错误venue权重未超过一半，就能限制单点幅度影响；这比加权均值对fat-finger或stale quote更稳健。但若最大venue本身权重大于50%，或两家共享同一错误clock/basis，breakdown保护消失。

所以权重应有cap与health gate，并报告每时刻effective venue count。LOO结果不仅是model diagnostic，也是聚合器的故障演练：去掉任何一家后fair center是否仍定义、误差是否可接受、信号方向是否保持。

### Price accuracy 的三个 benchmark

第一是local mid random walk，检验external是否超过“未来等于现在”。第二是local-only causal model，检验增量是否只是本地惯性。第三是robust multi-venue ablation，检验改善是否依赖单源。所有模型在同一common mask和ready clock上比较。

MAE适合中心误差，但maker还关心signed error、tail和turnover。一个高频抖动center可能略降MAE，却导致大量requotes与queue loss；因此进入action前要加center variation、tick-crossing与staleness diagnostics。

### Fair-price artifact 的运行时安全边界

输出应包含value、ready time、source ages、contributing venues、basis/gain state与valid reason。任一必需source超时、calendar/basis越界或number非有限时回退本地baseline，不允许沿用不知年龄的最后fair price。

这些字段使fair center可以被审计为research input；真正quote action仍需单独artifact和权限。把data-quality fallback写进接口，避免“模型没信号”与“数据没到”在运行时变成同一个零值。

### 10. 公共证据

- [Cross-Venue Causal Fair Price v1 Spec](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/docs/cross_venue_causal_fair_price_v1_spec_20260801.json)
- [F04 External Market Alpha README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/README.md)
- [BABEL External-Market Research Map](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/docs/babel_external_market_research_map.md)

公开证据给出公式、参数来源、common support 与权限。原始 venue tapes、逐秒 paths 和未发布机器工件不随文章分发。

## 6. First-add M0/M1

### TL;DR：30 日数量门已完成，但 exact lifecycle 与共同分母仍未闭合，因此没有模型结果

First-Add M0/M1 研究的目标不是预测下一秒涨跌，而是识别 maker campaign 中第一次 exposure-increasing add 是否会带来负的 campaign-terminal value。M0 只使用 campaign state 与本地因果微观结构；M1 在完全相同的 first-add rows 上加入 Bitget、Bybit、OKX 的真实接收时钟外部状态，包含 10/25/50/100/250/500ms 多尺度窗口。

冻结 target 是直接经济结果：

$$
Y=V(T_{campaign})-V(t_{first\ add}),
$$

单位为每个 first-add decision 的 USDC。未来方向、独立 markout、fill-conditioned toxicity 都不能替代它，因为那些 target 不包含后续加仓、修复、库存持有与 campaign 终结。

早期公开 preregistration 写着“等待 30 个不同 UTC 日”，当时快照只有 16 个完整 windows、15 个不同日。后来的公开 BABEL evidence map 更新了状态：历史采集已关闭，共 `31` 个 valid full windows、覆盖 `30` 个 distinct UTC days；同一天的重复 window 只计一次。因此 count gate 已通过，不再是当前 blocker。

但是研究没有开始拟合，也没有经济结论。它仍被 corrected exact-lifecycle successor 以及逐行共同分母、source transport、因果时钟、true leave-one-venue-out、BUY/SELL 分侧、Grade A/B、chronological split 与 late-panel admission gates 阻塞。数量够了，不等于样本身份正确；在 exact first-add decision、campaign lineage 与 external feature-ready time 对齐前，任何 M0/M1 AUC 或 score 都会回答错误问题。

最终状态是“preregistered、count-complete、evidence-blocked”。没有 Validation 或 sealed holdout 读取，没有模型、阈值或 action 结果，也没有获得 shadow collection、quote action 或 live authority。若未来两侧都不能通过冻结 prediction gates，该 first-add classifier route 将关闭并转向经济结构重设计；即使某一侧通过，也只得到 prediction evidence，仍需独立 action experiment。

![first-add决策、外部多尺度状态与campaign终值的因果链](/images/narrowgate/first-add-external-m0-m1.svg)

*图 1：机制示意。在一段 maker campaign 中，第一次 exposure-increasing add 是唯一 assignment row；M0 与 M1 读取决策前可见状态，target 到 campaign terminal 才确定。K 线与订单位置不是实盘记录。*

本文只说明预注册和公开状态，不建议任何真实交易行为。

### 1. 研究问题：为什么只研究“第一次加仓”

maker campaign 往往从 flat/opening 开始，随后可能加仓、减仓、修复并最终回到 flat。把所有 fills 混在一起，会把动作角色混淆：一个 reducing fill 降低风险，一个 exposure-increasing fill 增加风险；同一次 campaign 的多个 adds 还共享后续 terminal value，不能当作独立样本。

First-add identity 把 decision unit 冻结为：已有非零或刚建立方向性 exposure 后，第一次会增加绝对库存的 maker add 决策。BUY/SELL 分开建模，因为买侧 adverse state 和卖侧 adverse state 不必对称。

设 decision 前 signed position 为 $q_{t^-}$，候选 side 的单位变化为 $\delta q_s$。exposure-increasing 条件是：

$$
|q_{t^-}+\delta q_s|>|q_{t^-}|.
$$

“first” 要由完整 campaign lifecycle 确定，而不是从某条 quote log 推测。若一笔订单先 partial fill、cancel-reject 后继续成交，或同一 decision 产生 replace，新旧 order identity 必须沿 lineage 归属于同一次决策；否则 first-add denominator 会重复或错位。

### 2. 直接 target 为什么不可替代

$V(t)$ 是冻结 accounting contract 下，campaign 在时刻 $t$ 的已实现加未实现价值。直接 target：

$$
Y_i=V_i(T_i)-V_i(t_i)
$$

从 first-add decision $t_i$ 一直计算到同一 campaign 的 terminal $T_i$。若 $Y_i<0$，表示从该决策到 campaign 结束净价值为负；它自然包含后续成交、价格变化、fees、inventory repair 与 terminal realization。

相比之下，5 秒 markout 只看固定 horizon 价格，未来 direction 只看符号，fill toxicity 又通常以“已经成交”为条件。它们可以是 feature diagnostics，却不能回答“若在这个 first-add decision 上识别高风险，是否找到负价值子集”。F10 的先行 evidence 说明 first-add 平均价值两侧为负，F05 的本地 campaign/microstructure 模型没有找到稳定负值子集；本研究问外部 receive-time state 是否提供增量。

### 3. M0、M1 与 estimand

M0 的输入是 decision 前 campaign state 与本地 causal microstructure。可包括当前 signed inventory/role、campaign age、已有 fills、local book/flow、queue/lifecycle 可见状态，但每一列必须在 $t_i$ 前 ready。

M1 为：

$$
X_i^{M1}=\left[X_i^{M0},X_i^{ext}(10,25,50,100,250,500\text{ms})\right].
$$

外部特征来自 Bitget、Bybit、OKX，并在 full-all 与逐家 true LOO 下从原始 venue tapes 重建。LOO 不是训练一次后把某几列置零；必须重新聚合 source state，使共识、age、dispersion 和可见性都反映“这家从未存在”。

BUY 和 SELL 分开使用 standardized Ridge，$\alpha=1$，不做 hyperparameter search。主要 incremental estimand 可以写为 proper-score 改善：

$$
\Delta^{score}_{d,s}=Score_{d,s}(M0)-Score_{d,s}(M1),
$$

正值表示 M1 误差更小。高风险子集则要求 M1 标记的 rows 真正有负 terminal value，并对多种 profile 做 simultaneous uncertainty。模型复杂度固定，是为了把差异尽量归因于外部输入，而不是 M1 获得更多调参自由。

### 4. 数据与因果时钟

每个 row 至少有三只时钟：first-add decision time、外部 event/receive time 和 feature-ready time。合法输入必须满足：

$$
T^{feature\ ready}_{i,k}\le T^{first\ add\ decision}_i.
$$

外部 event time 早于 decision 仍不够；如果网络接收或计算在 decision 后完成，特征不可用。10–500ms windows 是既有 receive-time ABI 的工程支持，不是从 first-add outcome 上挑出的“最佳 horizon”。

target 则严格位于未来，直到 campaign terminal 才完成。训练/评分生成 labels 可以读取 $T_i$，但 feature builder、row admission 和模型输入都不能。embargo 还需阻止相邻 campaign 或跨日未闭合路径把未来信息带回训练。

| 层级 | 冻结要求 |
| --- | --- |
| Decision unit | exact first exposure-increasing add |
| Target | decision-to-campaign-terminal USDC |
| Sides | BUY、SELL 独立 |
| Quality | Grade A primary；Grade B sensitivity |
| M0 | campaign + local causal microstructure |
| M1 | M0 + 三 venue receive-time multiscale state |
| Source robustness | full + 三个 true LOO，同 rows |
| 最小时序 | 20 train + 1 embargo + 5 test + 4 late days |
| 模型 | standardized Ridge，$\alpha=1$，不调参 |

### 5. 数量门：为什么 31 个 windows 只等于 30 日

预注册要求至少 30 个不同 UTC 日，每个 admitted valid window 至少 3,500 秒。多个 windows 落在同一 UTC 日，只增加数据覆盖，不增加 chronological day denominator。这样可以避免通过重复采集某一天来伪造跨日稳定性。

早期 preregistration 的状态快照为 16 full windows / 15 distinct days，因此当时正确地标为 blocked。当前公开 BABEL map 是后来的权威状态：closed ledger 有 31 valid full windows / 30 distinct days，一个重复日只计一次。采集任务已经结束，数量 gate 完成。

文章同时保留两个数字，是为了区分“文件写作时的历史状态”和“当前研究状态”，而不是制造矛盾。预注册合同仍有效，但 status line 已被后来的 evidence map supersede。

### 6. 为什么 count-complete 仍不能拟合

30 日门只回答 chronology 是否有最低支持，不回答 rows 是否正确。正式拟合前必须闭合：exact first-add lifecycle；每个 decision 的稳定 ID；signed inventory 与 role；campaign terminal lineage；无重复或缺失 terminal；外部 source/feature-ready clocks；M0/M1 与所有 LOO 的 common-row intersection；Grade A/B quality；两侧最低样本；train/test/late 隔离。

举例说，若旧 quote row 只有写日志的毫秒时间而没有 decision-start 时间，外部状态可能在实际 decision 后、日志前变为可见。把它 join 进来会产生几十毫秒级 look-ahead。又如，若 order replace 后失去 origin decision ID，同一 first-add 可能被算成两次。样本量越大，只会让这种系统误差的置信区间越窄。

所以当前没有 AUC、proper score、high-risk subset mean 或 economic table。对一个 preregistered-but-blocked 项目，“无结果”是诚实的最终状态，而不是文章不完整。

### 7. 通过门槛与不确定性

对任一 side，至少需要 day-clustered proper-score improvement lower bound 为正；M1 high-risk subset 的 simultaneous upper bound 小于零；删除任一 venue 后方向不反转；Grade B 不反转 Grade A；frozen late panel 不反转 Development/test 结论。

这些 gates 不是把所有指标都当同等主终点。proper score 回答整体增量，高风险 subset 回答是否真的定位负值，LOO/Grade B/late 是 robustness。若某侧样本不足，结果是 defer，不是降低阈值；若两侧均完成且失败，关闭当前 classifier route。

即便一侧通过，也只支持“外部 state 对这个 exact target 有 incremental prediction”。下一步若要 test ADD/NO-ADD、widen 或 cancel，需要在 F09 类 action identity 下冻结 intervention、propensity、共同支持、campaign reward 与 tail gates。prediction model 的 high-risk label 不能自动成为政策。

### 8. 与 Adverse-Edge Guard 为什么不是一个项目

两者都使用外部三 venue receive-time state，但 denominator 和 estimand 不同。First-Add P1 只看 exact first exposure-increasing add，目标是 campaign-terminal value；Adverse-Edge mechanics P2 看所有 paired quote-opportunity 中的 opener/add，且 outcome-blind，只问信号是否及时可见并能把 quote 向外移动。

P2 的 26 个 changes 中只有 6 个是 adds，20 个是 openers，所以不能拿它的 trigger rate 代替 P1 的 prediction support。P1 的 30 日 collection 也不能自动成为 P2 exact-opener tape。BABEL map 把它们画成并行路线，只有未来在同一个 exact surface 上重新注册，才可能会合。

### 9. 研究演进与版本合并

项目包含 preregistration、capture-count updates、transport amendments、ledger admission 和 BABEL routing。它们都服务同一个问题：M1 是否相对 M0 改善 first-add terminal-value prediction。采集 attempt、重复日说明或 exact-lifecycle 修复不是新 estimand，因此不单独生成文章。

当前应以公开 BABEL map 的 count-complete/blocker 状态覆盖旧 preregistration 顶部的 count-blocked 文案，同时保留原始 frozen comparison、target 与 gates。这样既不改写历史，也不误报已经拟合。

### 10. 关闭、支持与权限边界

已支持：count gate 达到 30 distinct UTC days；first-add direct target、M0/M1、LOO 与 split 合同已预注册。

仍阻塞：corrected exact lifecycle、row-level/common-mask、source transport、causal clock、side/quality 与 late-panel admission。当前没有 prediction 或 economics result。

没有获得：Validation 或 sealed holdout 读取、模型拟合后的 promotion、阈值选择、ADD/NO-ADD、cancel、widen、re-center、shadow collection、外部 feed action 或 live authority。

### 深入推导：为什么 first-add 是一个自然 decision surface

Campaign opener 把库存从零变成非零，first add 则把已有暴露进一步加深。后者发生时，策略已经拥有一段 campaign history：初次成交价格、当前库存、已等待时间、repair 是否失败、外部市场是否继续领先。它既比任意 add 更同质，又直接对应“是否继续增加风险”的动作问题。

目标不应从 realized fill rows 倒推。正确 row 在 baseline 首次满足 add eligibility 的 decision 时产生，无论候选最终是否成交；reward 从 decision 前权益一直追到 campaign terminal。否则只保留发生了 fill 的路径，会把 action-dependent selection 写进训练集。

![First-add 外部增量从 source clock 到 campaign terminal](/images/narrowgate/f04-external-signal-to-action-clock.svg)

*图 2：M1 外部状态必须在 first-add decision 前 ready；terminal 只能作为标签。数量门完成并不代表 lifecycle 这条路径可识别。*

### M0/M1 增量究竟检验什么

M0 应包含本地 decision-visible state：inventory、campaign age、local flow、spread、queue/placement、P3 与波动等。M1 只增加冻结的 external state。比较对象不是两个模型各自的 AUC，而是共同 rows 上的增量：

$$
\Delta_{M1}=L_{OOF}(M0)-L_{OOF}(M1).
$$

若 M1 改善，才能说外部信息在本地状态之外提供额外解释；若只看 M1 自身表现，模型可能完全依赖本地 inventory 或 campaign age。即使增量通过，也只建立 observational value prediction，动作仍需 randomized/paired add versus no-add。

### 为什么 30 日 count complete 仍然不是 usable panel

一天有至少一个 capture window，只证明日期数量达到门槛。正式 first-add row 还需要在同一 causal interval 上连接 external trades、local L2、policy decision、order activation、fill/cancel ACK、inventory campaign 与 terminal equity。任一关键字段缺失，都可能使 M0/M1 看到不同 rows 或让 reward 截断。

特别是 exact lifecycle gate：若不知道某张订单何时真正 active、何时 cancel ACK，无法判断它在风险集中多久；若 campaign terminal 缺失，不能把最后一个 markout 当作 flat。共同分母要求 M0 与 M1 对完全相同 rows 可评分，不能让外部缺失只删除 M1 的难例。

所以项目停在 count complete 是严谨的阻塞状态。继续训练一个“能跑”的模型会换成较窄 estimand，再把它误写成原问题答案。

### First-add row 怎样避免把结果条件化进输入

一条campaign可以有许多候选时刻，但本项目的decision unit是第一次允许增加absolute inventory的机会。row必须在动作发生前确定：campaign id、current inventory、side/role、candidate quote、internal state、external features与feature-ready ages。随后才附上activation、fill、campaign terminal outcome等未来字段。

若只保留实际发生first-add的campaign，会条件化在baseline action与execution上；若只保留filled first-add，又会进一步形成fill collider。正确面板应包含所有合法decision opportunities，包括最终未激活、未成交与campaign在窗口末端censor的路径，并明确各自outcome是否可识别。

M0与M1的增量比较也必须在共同rows上完成。设$L_d(M)$是第 $d$ 日loss，则主要estimand是

$$
\Delta_{ext}
=
\frac1D\sum_d\{L_d(M0)-L_d(M1)},
$$

而不是比较两个模型各自最容易评分的row集合。external source缺失若与高波动相关，complete-case结果会偏向平静期；因此coverage、missing reason与fallback都属于estimand。

### 为什么 exact lifecycle 是模型训练前的条件

first-add价值依赖这次动作是否真正进入exchange、何时成交、随后是否触发更多adds、何时repair/flat以及窗口末端剩余库存。若order activation与cancel ACK不完整，一行label可能把“从未暴露”当成“暴露但未成交”；若campaign join用nearest timestamp，可能把后一个campaign的terminal outcome归给前一个decision。

这类错误无法靠更强模型修复。模型会学习数据管线的错误选择机制，甚至在OOF取得稳定增量。数量门完成只说明日期和机会可能足够，不说明label semantics成立；停止在fit前，是避免生成一张看似精确、实际对象不明确的分数表。

### 从可用面板到动作结论还需两阶段

第一阶段可以做outcome-blind panel audit和M0/M1 prediction：external信息是否在internal state之外增加对terminal loss或fill value的排序。第二阶段才冻结一个具体动作，如keep vs one-tick widen或skip first-add，并用paired full-path估计action uplift。

即使M1显著优于M0，也只证明信息增量；若动作映射在缺乏overlap的高风险状态频繁改变报价，经济结论仍不可靠。相反，预测增量很小但一个简单action在明确状态下稳定改善，也可能形成独立策略证据。把两阶段分开，是first-add研究没有在count-complete时急于训练的根本原因。

### 数量门应基于 cluster，而不是总 rows

first-add每campaign一行后，表面样本已经更接近经济单位，但同日campaign仍共享趋势、波动与source outage。可检测能力主要由distinct days、每日日志完整度和effect dispersion决定；把30日内数千campaign当IID会高估精度。

preflight可在不读outcome方向的情况下统计每side的eligible campaigns、terminal-complete比例、最大单日占比、external-valid rate与candidate action overlap。若某side由三天贡献一半，即使总count过门，也应降低证据等级或增加日期。

### Exact lifecycle 的守恒条件

每个decision只能绑定一个campaign；每个order lifecycle的submitted、ACK、partial fills、cancel与terminal数量必须守恒；terminal campaign value只能归属一次。对first-add动作，还要确认pre-action inventory非零且fill方向增加$|q|$，否则row可能是opener或reducing。

在两arms full-path分叉后，campaign ids可以不同，不能强行按编号匹配。paired unit应是共同起始day/initial state，或在one-shot设计中是冻结decision。把action后的campaign nearest-join到一起会引入错误对应。

### 为什么“没有模型结果”比弱模型表更诚实

lifecycle与common denominator未闭合时训练M0/M1，任何loss差都同时包含label错配和missing selection。即使点估计漂亮，也无法知道external信息是否有增量。停止使后续修复可以在未看outcome的状态下完成，保留真正的确认机会。

等面板合法后，原预注册问题仍可执行；这不是永久阴性。文章明确区分`count complete`、`panel usable`、`prediction result`和`action result`，让读者不会把工程进度误读为科学结论。

### 11. 公共证据

- [First-Add External Incremental Value M0/M1 v1 Preregistration](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/docs/first_add_external_incremental_value_m0_m1_v1_preregistration_20260730.md)
- [BABEL External-Market Research Map](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/docs/babel_external_market_research_map.md)
- [F04 External Market Alpha README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/README.md)

公开材料只发布 estimand、admission gates、count 状态和 authority；原始 receive-time tapes、逐 row lifecycle 和未发布机器工件不随文章分发。

## 7. Adverse-edge guard

### TL;DR：机制能动，支持度太低；v2 修正 denominator，但没有采集正式 tape

External Adverse Quote Edge Guard 是一个 outcome-blind mechanics 项目：当三交易所 fair-price 的全来源与所有 leave-one-venue-out（LOO）版本都判断某侧 quote 有不利外部 edge 时，只允许把 exposure-increasing opener/add quote 向外移动；reducing quote 保持原样。它先问信号是否在 decision 前可见、能否改变预期坐标、会不会被 spread cap 吃掉，以及可能引起多少 replace/queue reset，不读取 PnL、reward、markout 或 campaign terminal。

v1 历史面板的 immutable ledger 有 19 个 valid full windows / 18 个不同 UTC 日；quote logs 实际覆盖 17 windows / 16 日，形成 `9,138` 个 paired quote decisions，即 `18,276` 个 side opportunities。外部输入包含 `50,359,162` 个 public book events；`feature_ready_ts_ns` 有 `4,481` 次输入顺序回退，最大 `209.563275ms`，全部在冻结的 5,000ms bounded reorder 内复原，评估 rows 没有 future-feature violation。

关键结果不是“触发后效果好”，因为 economics 根本没读；而是 support 极稀疏。在 `7,786` 个 guard-eligible opener/add side opportunities 中只有 `26` 次 outward coordinate changes，candidate rate `0.334%`，约为冻结 5% selective-action floor 的十五分之一。BUY/SELL triggers 分别只有 18/8；在额外 500ms delay 下存活率为 61.1%/75.0%，但样本太小，只能描述。按 0.5 随机 assignment，预期真正改变的路径约 13 条，无法支撑一个 action experiment。

v1 还暴露了 denominator 问题：`inventory_ratio` 是 $|q|/q_{max}$，没有符号，不能判断 opener/add/reducing；历史 quote timestamp 是 post-decision log-write clock，不是 exact decision start；缺稳定 decision ID 和权威 order/ACK/queue lineage。v2 因此把 formal denominator 改为 native exact opener opportunities，记录 signed inventory、feature-ready time、baseline/candidate coordinates 与完整 lifecycle。v2.1/v2.2 继续强化 schema、runtime binding、writer health、hot-start quarantine、cancel-reject、crash recovery 和 atomic admission。

这些版本是同一个研究项目的 evidence chain，不是多篇独立“修复研究”。正式 prospective tape 最终仍处于 disabled、未采集状态，所以不能声称 v2 已得到新的 support rate。项目的冻结结论是：v1 成功证明有限的 clock/coordinate mechanics，却因 0.334% support 不能注册动作；v2 只完成 infrastructure contract，没有 prediction、action、Validation、holdout 或 live authority。

![外部不利edge推动报价向外并经历延迟和生命周期的机制](/images/narrowgate/external-adverse-edge-guard-kline.svg)

*图 1：机制示意。外部 fair 下移时，BUY exposure-increasing quote 只向外远离 touch；信号还必须通过 all/LOO、可见性、signed-role、spread cap 与 exact lifecycle。K 线和 tick 距离不是实盘数据。*

本文只讨论冻结的 Development mechanics evidence，不建议任何真实交易行为。

### 1. 研究问题：先证明 guard 能被精确定义

外部 fair 与本地 quote 之间可能出现 adverse edge。例如准备买入时，外部 fair 已低于本地 bid；继续挂在原坐标可能更容易被有信息的卖方击中。一个保守 guard 可以把该 BUY quote 向下移，而不把 reducing sell 一起推远。

但在问“这样做是否赚钱”前，必须回答：外部状态在 decision 前是否真的 ready？全来源与每个 LOO 是否同向？当前 side 是 opener、add 还是 reducing？candidate 是否相对 baseline 向外？tick/GTX/spread cap 后是否仍改变？如果发生 replace，order origin、cancel ACK、partial fill 与 queue reset 能否追溯？

因此本项目处于 BABEL engineering/mechanics 层。它刻意 outcome-blind，避免在 action registration 前根据收益挑 threshold。研究问题是机制和支持度，不是经济 uplift。

### 2. 输入、角色与候选坐标

设本地 mid 为 $M_t$，三 venue causal fair 为 $F_t^{all}$，逐家 LOO fair 为 $F_t^{-v}$。对 BUY side，可定义 adverse signed edge：

$$
e_t^{buy}=10^4\frac{F_t-M_t}{M_t};
$$

当它足够负，表示外部参考低于本地。SELL 使用相反符号。conservative edge 必须在 all 与所有 LOO 上方向一致：

$$
\operatorname{sign}(e_t^{all})=\operatorname{sign}(e_t^{-Bitget})
=\operatorname{sign}(e_t^{-Bybit})=\operatorname{sign}(e_t^{-OKX}).
$$

候选只允许 outward movement。若 tick size 为 $\tau$、请求移动 $k_t$ ticks，则：

$$
P_{buy}^{cand}=P_{buy}^{base}-k_t\tau,\qquad
P_{sell}^{cand}=P_{sell}^{base}+k_t\tau.
$$

最终还要经过 tick rounding、GTX 与 pair-spread cap。只要任一 gate 失败，candidate 等于 baseline；没有 inward tighten。

角色必须由 strictly-prior signed position $q_{t^-}$ 推导。对 side delta $\delta q_s$：

$$
role=
\begin{cases}
opener,&q_{t^-}=0,\\
add,&|q_{t^-}+\delta q_s|>|q_{t^-}|,\\
reducing,&|q_{t^-}+\delta q_s|<|q_{t^-}|.
\end{cases}
$$

历史 `inventory_ratio=|q|/q_{max}` 丢失符号。第一版若把它当 signed role，会把同样 ratio 的 LONG 与 SHORT 混为一谈；该草稿在发布前丢弃。v1 权威 run 改用独立 signed-position journal，只取严格早于 quote row 的状态；同毫秒 update 视为 role ambiguous 并排除。

### 3. v1 数据与两只时钟

历史 ledger 有 19 valid full windows/18 distinct days，但其中两个 valid days 没有 quote-opportunity rows，所以正式 v1 mechanics panel 只有 17 windows/16 days。`9,138` 个 paired quote decisions 各有 BUY/SELL 两侧，总计 `18,276` opportunities。

外部 public-book tape 有 `50,359,162` events。由于多来源并行写入，按 `feature_ready_ts_ns` 观察到 `4,481` 次小范围 input-order regressions，最大 `209.563275ms`。runner 使用预先冻结的 5,000ms bounded reorder；全部 tapes 通过，最终 evaluation rows 的 feature-ready time 都不晚于 quote-log opportunity time。

但“quote-log opportunity time”自身只是毫秒级 post-decision write time。真正的合法条件应是：

$$
T^{feature\ ready}\le T^{decision\ start},
$$

而 v1 只能验证：

$$
T^{feature\ ready}\le T^{post\ decision\ log}.
$$

二者之间的间隙使 v1 成为 clock sensitivity，而非 exact subsecond transport proof。bounded reorder 解决文件输入乱序，不会把 post-decision timestamp 变成 decision-start timestamp。

### 4. 冻结 support 结果

| Side / role | Opportunities | Guard eligible | Triggers | Rate over eligible |
| --- | ---: | ---: | ---: | ---: |
| BUY opener | 2,671 | 2,329 | 15 | 0.644% |
| BUY add | 3,213 | 1,558 | 3 | 0.193% |
| SELL opener | 2,671 | 2,669 | 5 | 0.187% |
| SELL add | 3,254 | 1,230 | 3 | 0.244% |
| Reducing, both sides | 6,467 | 0 | 0 | unchanged |
| Total opener/add | 11,809 | 7,786 | 26 | 0.334% |

BUY 只在 7/16 日触发，SELL 在 5/16 日触发。26 次变化中 20 次是 opener、6 次是 add，因此它既不是 exact-opener denominator，也不是 First-Add denominator。

只有 89/9,138 个 quote pairs 形成 conservative all/LOO-consistent adverse direction。最常见的非触发原因是 conservative edge 非负（6,021 pairs）和 LOO direction disagreement（1,911 pairs）；warmup 与 source-invalid 单独计数。低 rate 主要来自预先声明的稳健共识，而非 spread cap 把动作裁掉。

候选 rate 与 5% floor 的比例约为：

$$
\frac{0.334\%}{5\%}\approx0.0668.
$$

也就是候选约少十五倍。若随机 assignment probability $p=0.5$，期望 altered paths 为：

$$
E[N_{changed}]=26\times0.5=13.
$$

这不足以估计 day-cluster campaign reward 或 side-specific tails；因此没有理由在 v1 后读取 economics。

### 5. 延迟存活、报价距离与 lifecycle leverage

| Added visibility delay | BUY survival | SELL survival |
| ---: | ---: | ---: |
| 10ms | 88.9% | 87.5% |
| 100ms | 72.2% | 75.0% |
| 500ms | 61.1% | 75.0% |

BUY/SELL 的 denominator 只有 18/8 triggers，所以这些百分比不是精密的 side transport estimates。SELL 75% 在三个 delay 下不变，可能只是 8 个样本的离散结果；不能据此说 SELL signal “500ms 不衰减”。

18 个 BUY triggers 请求的 outward distance median 为 43 ticks、p90 117.5 ticks；8 个 SELL triggers median 21.5 ticks、p90 86.6 ticks。没有 trigger 被 frozen 20bps pair-spread cap 裁剪。projected mix 为 13 places 和 13 replaces，因而最多 13 次 projected queue resets；但历史 seven-tape capture 没有权威 order/ACK/queue journal，所以 replace 与 reset 只能作为 upper bounds。

trigger episode 的历史 median duration 约五秒，也继承稀疏 quote-log cadence，不是连续 100ms state-duration estimand。每一个数字都要跟它的 denominator 一起读。

### 6. v2 为什么改成 Exact-Opener

v1 把所有 historical paired quote rows 作为机会面板，角色又靠旁路 signed-state join 推导。v2 把 formal denominator 冻结为 native exact baseline-eligible opener decisions，并要求每个 decision 有稳定 ID、exact decision/feature-ready timestamps、signed inventory、baseline/candidate coordinates，以及由该 decision 发出的 order lineage。

order origin ID 必须跨 REST acknowledgment、activation、cancel request/ACK、partial/full fill、reject、expiry 和 queue reset 保持。validator outcome-blind：拒绝 PnL、markout、reward、future price 与 campaign-terminal columns；但可以读取 operational terminal/lifecycle events，以确认订单是否实际进入所声明的 mechanics path。读取 lifecycle 不等于读取 economic outcome。

BUY 与 SELL 分开计算 unchanged 5% support floor。若任一侧仍不足，该 guard 对 action support 关闭。不能为了过 gate 临时去掉 LOO，或按当天排名强行凑 5%；那会成为新的 research identity，必须重新预注册。

### 7. v2.1/v2.2：执行合同不是新科学项目

v2.1 增加 exact schema allowlist、non-null stable IDs、unique strict lifecycle sequences、每单最多一个 terminal outcome，以及精确 baseline/candidate denominator rule。一次 collection preflight 随后发现，冻结 validator 仍不足以证明 producer/runtime/config identity、writer health、继承订单隔离、cancel-reject journaling 与 atomic admission，因此 prospective collection 在 tape 启用前被撤回。

v2.2 解决这些执行合同：绑定 producer 与配置/Feature DAG/engine identity；writer 发布 queue depth、heartbeat、drops、errors 和 flush health；hot start 先 quarantine 旧订单；cancel rejection 恢复 active/partial lifecycle；crash 留下的 partial bytes 不可 admission；正常关闭后才生成 hash-bound ready artifact，且 admission 验证 schema、rows、canonical hash、UTC day 与 event interval并拒绝重叠。

这些改进说明未来怎样可信地收集 exact tape，不说明 tape 已经存在。公开状态明确是 prospective collection disabled，formal support counting 尚未开始。把“preflight 通过”写成“收集完成”会越过证据边界。

### 8. 版本为何必须写在同一篇

v1、v2、v2.1、v2.2 都围绕同一个 hypothesis surface：conservative all/LOO adverse edge 是否在正确 clock 与 role 上，产生足够多的 outward opener/action candidates。v1 给 clock-limited mechanics 与稀疏 support；v2 修 formal opportunity；v2.1/v2.2 修数据生产和 admission。

它们没有产生四个不同的经济 estimand，也没有四次 outcome read。preflight failure、execution amendment、runtime health spec 都是 evidence-quality evolution，拆成独立博客会让读者误以为做了多次研究或得到多份结果。主文章应保留完整 lineage，并只给最终 authority。

### 9. 关闭、支持与不确定性边界

支持：保守 all/LOO adverse state 在 v1 记录 clock 下可见，能把 eligible opener/add quote 向外移动；tick/GTX/cap mechanics 没有吞掉 26 个 triggers；bounded reorder 在历史 tapes 上通过。

关闭：用 v1 denominator 进入 randomized action；把 0.334% candidate rate 当成足够 support；把 18/8 个 survival 样本当 side transport 结论；把 projected replace/reset 当权威 lifecycle。

待证：v2 exact-opener side rates、正式 receive-time transport、真实 place/replace/activation/cancel/fill lineage，以及任何 reward uplift。prospective v2 tape 未收集，所以没有“改进后的 rate”。

没有获得：prediction、PnL/reward/markout read、Validation、sealed holdout、F09 action registration、prospective collection、quote mutation、shadow deployment 或 live authority。

### 深入推导：adverse quote edge 应怎样定义

对 BUY quote，外部 causal fair 低于本地 placement price 时可能存在 adverse edge；SELL 则方向相反。一个 side-signed 定义可以写成：

$$
E^{adv}_{s,t}=\operatorname{sign}(s)\,[p^{quote}_{s,t}-f^{causal}_t],
$$

其中符号约定必须让正值统一表示“当前 exposure-increasing quote 相对外部 fair 过于激进”。guard 的候选动作可以是外移、停止 add 或保持 baseline，但必须在结果前冻结；不能看到哪种动作 PnL 好再解释 edge。

edge 还需要净掉 fee、tick rounding 与最小可执行移动。若 $E^{adv}$ 小于一 tick 或小于端到端误差带，理论方向正确也不会产生不同订单。机制门首先要证明：eligible rows 足够、candidate 真正改变 final quote、GTX 与 safety 没有把动作压回 baseline。

![External adverse edge 从 fair coordinate 到 exact opener action](/images/narrowgate/f04-external-signal-to-action-clock.svg)

*图 2：外部 fair、edge guard 与 campaign action 分属三层；v2 exact-opener 解决动作定位，但 formal action-value 仍未产生。*

### 延迟存活不是一个固定毫秒阈值

外部 innovation 在 feature-ready 后还要经过本地 decision、submit 与 ACK。设信号强度随延迟 $\ell$ 衰减为 $g(\ell)$，一次 guard 的有效 edge 近似为：

$$
E^{net}=g(\ell)E^{adv}-C_{tick}-C_{queue\ reset}.
$$

若用平均 latency 代替分布，高延迟尾部会被掩盖。应使用与 source、host、runtime epoch 匹配的 latency profile，至少检查 p50/p90/p99 sensitivity。历史 transport 测量只能作为其原 host/epoch 的 prior，不能标成当前 live 精确延迟。

即使 $E^{net}>0$，也只说明动作有几何空间；完整价值还取决于 guard 是否优先删除 toxic fills，还是按比例删除所有 fills。需要 fill retention、toxic reduction surplus、inventory time 与 campaign tail 的共同门。

### Exact-opener 为什么改变识别而不改变研究主题

v1 在较宽 surface 上统计 guard 支持，可能把 opener、add、reducing 或实际未进入交易所风险集的请求混在一起。v2 把 intervention 锚定到 exact opener lifecycle：从 baseline eligibility、submit、activation 到 terminal 都有明确 identity。这样 denominator 不会由候选路径事后重建。

这是同一研究的执行语义修复，因为问题仍是“外部 adverse edge 能否安全改变首个风险增加报价”。v2.1/v2.2 的 plumbing 和冻结合同不产生新的经济假设。最后没有 formal tape，不应把 mechanics completion 写成 action failure，更不能写成成功；准确状态是 support 太低/证据未到达经济层。

### 10. 公共证据

- [External Adverse Quote Edge Guard Mechanics v1 Development](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/docs/external_adverse_quote_edge_guard_mechanics_v1_development_20260802.md)
- [Exact-Opener Mechanics v2 Registration](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/docs/external_adverse_quote_edge_guard_exact_opener_mechanics_v2_registration_20260802.md)
- [Exact-Opener Mechanics v2.2 Execution Contract](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/docs/external_adverse_quote_edge_guard_exact_opener_mechanics_v2_2_20260803.md)
- [BABEL External-Market Research Map](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/docs/babel_external_market_research_map.md)
- [F04 External Market Alpha README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/README.md)

公开材料给出冻结 mechanics、聚合 counts、版本 lineage 和权限；原始 receive-time tapes、运行 receipts、逐单 lifecycle 与任何未发布经济结果不随文章分发。

## 8. Fair-center randomized action

### TL;DR：动作每次都发生、保留 97% fills，却依赖单一 venue 且主区间跨零

这项研究不用外部价格决定 BUY 或 SELL，而是把 NarrowGate 的整对 bid/ask 按 causal cross-venue fair-price adjustment 连续平移，同时保持 pair spread、size、cooldown、inventory/reducing logic、latency、queue 与 GTX 约束。campaign 在两条 full paths 生成前以 0.5/0.5 随机化。

Grade-A 24 日有 9,164 个 campaign rows，candidate/control 4,542/4,622；action-change 100%，activity retention 92.35%，fill retention 97.00%。reward uplift +0.001446 USDC/assignment，但 95% UTC-day interval $[-0.002732,+0.006053]$，正日 54.17% 略低于 55% 门；HT policy value +0.6351 USDC/day，区间 $[-1.0143,+2.3994]$。

BUY 点估计 +0.003324，SELL -0.000429；Grade-B sensitivity 为正且 interval 过零上方，但不能救援 primary。更关键的是 leave-Bybit-out 后 Grade-A uplift 反转为 -0.000632，而 leave Bitget/OKX 仍正，违反预注册 leave-one-venue-out direction gate。因此它是有希望的描述性线索，不是 transport-stable three-venue alpha。Validation 与 sealed holdout 未读。

![Cross-venue fair center 对整对报价的平移机制](/images/narrowgate/cross-venue-fair-center-kline.svg)

*图 1：机制示意。三个外部 venue 的 causal trade bars 形成 fair adjustment，candidate 同量平移 bid/ask；spread 不变。leave-one-out 是依赖性检验，不是事后挑 venue。*

![Cross-venue center shift 的完整 maker action path](/images/narrowgate/f09-campaign-action-causal-path.svg)

*图 2：外部 fair adjustment 只定义动作起点；整对报价平移仍会改变两侧 queue、fill mix、inventory 与 terminal。100% action-change 与 97% fill retention 证明杠杆适中，但不能替代价值和运输门。*

### 1. 研究问题：外部价格领先能否变成 maker action value？

跨 venue signal 可能预测本地 mid，但 maker 行动面临 queue reset、fill selection 与双边报价风险。预测 IC 正不代表把 quote center 平移会赚钱。本项目直接随机化完整行动路径：

$$
\tau=E[Y(\text{local center}+g\hat\delta^{XV})-Y(\text{local center})].
$$

$\hat\delta^{XV}$ 由 Bitget、Bybit、OKX 的 past-only one-second individual-trade bars 在共同支持上构成，$g$ 与 basis/eligibility 在 outcome 前冻结。主要 $Y$ 是 assignment-to-campaign-terminal USDC。

### 2. 动作与因果输入

candidate 对 pair 做相同平移：

$$
p^{cand}_{bid}=p^{base}_{bid}+\delta_t,\qquad
p^{cand}_{ask}=p^{base}_{ask}+\delta_t.
$$

因此：

$$
p^{cand}_{ask}-p^{cand}_{bid}=p^{base}_{ask}-p^{base}_{bid}.
$$

| 冻结元素 | 定义 |
|---|---|
| Assignment | campaign prospective 0.5/0.5 |
| Control | current local quote center |
| Candidate | causal cross-venue fair adjustment 平移整对 quote |
| 保持 | pair spread、size、cooldown、inventory/reducing、queue、latency、GTX |
| Common support | all-venue 与 true leave-one-out 共同历史支持 |
| q90 | 两臂均 OFF |
| Primary | terminal value；tail、repair、activity 为 hard gates |

common support 外两臂都回 local baseline center，避免 candidate 在缺少某 venue 时偷用插值。historical trade-bar evidence 没有 AWS receive-time transport authority，所以不能直接投射到 live arrival order。

### 3. 双时钟与 K 线例子

外部 individual trades 先按 exchange time 归入 completed one-second bars，再经过 ready delay 成为可用 feature。本地 decision 只能读取 $t_{ready}\le t_{decision}$ 的 bar。若在 bar 未完成时使用 close，等于偷看未来数百毫秒。

例子：local bid/ask 为 100,000.0/100,000.2，外部 fair adjustment 为 +0.1，则 candidate 为 100,000.1/100,000.3，spread 仍 0.2。BUY quote 更容易成交、SELL 更难成交；若本地随后上涨，平移可能改善 selection，若信号短暂反转则 queue reset 与错过 fills 造成损失。必须重放两条 quote/cancel/queue/fill/campaign path。

BUY 与 SELL contribution 分开检查，因为同一个正 center shift 对两侧作用相反。pooled 正点估计不能隐藏 SELL 伤害。

#### 3.1 整对平移保留了什么，又改变了什么

同量平移保持 nominal pair spread：

$$
\Delta spread=(p_{ask}+\delta)-(p_{bid}+\delta)-(p_{ask}-p_{bid})=0.
$$

但它不保持相对本地 BBO 的距离。正 $\delta$ 使 bid 更积极、ask 更消极；负 $\delta$ 相反。因此 pair 的 quoted width不变，side-specific fill hazard、queue position和inventory drift仍会改变。

这也是为何 center shift比“按 signal 只关一侧”更对称，却仍不能 pooled解释。若外部 fair长期偏上，BUY可能更早成交并有利，SELL则失去 fills；终局是否改善取决于两侧 value与当前 inventory role。

#### 3.2 Historical completed bar 与 live transport 是两道时钟

研究可保证一秒 bar 只在结束且 frozen delay后进入 replay，但 historical exchange-time bar并不包含真实 receive order、venue-specific网络尾部与 clock skew。三 venue signal的 live ready time应是：

$$
t_{ready}=\max_v(t_{bar,end}^{v}+L_{receive}^{v}+L_{feature}^{v}).
$$

若为了等三 venue共同支持而延迟，signal可能衰减；若不等，缺失 venue又改变 estimator。Development action证据即便通过，也仍需独立 receive-time transport；这里 action本身已经失败，更没有理由越过该门。

### 4. Development 支持与动作强度

面板沿用 F09 40 日 identity：24 Grade-A primary、16 Grade-B sensitivity only。Grade A 9,164 rows，candidate 4,542、control 4,622，assignment rate 49.56%。

candidate action-change 100%，activity retention 92.35%，fill retention 97.00%。这排除了两个简单解释：动作不是 no-op，也没有靠 broad participation shutdown 产生点估计。common support overall 89.65%，单日最低 66.73%；其余区域安全回 baseline。

### 5. Primary 结果

| Metric | Grade-A result |
|---|---:|
| reward uplift | +0.001446 USDC/assignment |
| 95% day interval | [-0.002732,+0.006053] |
| positive days | 54.17% |
| HT policy value | +0.6351 USDC/day |
| HT 95% interval | [-1.0143,+2.3994] |
| BUY uplift | +0.003324 [-0.002637,+0.010096] |
| SELL uplift | -0.000429 [-0.004671,+0.003930] |

descriptive q10 从 -0.08577 改善为 -0.08239，CVaR10 从 -0.20246 改善为 -0.18990；repair time avoidance +16.42 秒，interval [7.80,25.33]。但 negative-terminal、q10 shortfall、MAE、repair-event 与 censoring intervals 未通过 scorecard，primary value LCB 仍不正。

positive-day 54.17% 只差 55% 很近，也不能四舍五入为 pass。门槛是在结果前冻结，差一点正是门槛存在的意义。

### 6. Grade-B 与 leave-one-venue-out transport

Grade B reward +0.004647，interval [+0.000915,+0.007513]；HT +1.9308 USDC/day，区间 [+0.3410,+3.4592]。但 Grade B 被预先定义为 sensitivity，不进入 primary，不能在 Grade A 失败后换 panel。

true LOO Grade-A 结果：

| Variant | reward uplift | HT USDC/day | direction |
|---|---:|---:|---|
| all venues | +0.001446 | +0.6351 | positive |
| leave Bitget out | +0.000274 | +0.0524 | positive |
| leave Bybit out | -0.000632 | -0.1986 | negative |
| leave OKX out | +0.000872 | +0.1871 | positive |

Bybit leave-out reversal 表明结果 materially depends on one venue，违反冻结 direction gate。LOO 的意义不是让研究者选择“保留 Bybit 的最佳组合”，而是检验三 venue fair center 是否有运输稳定性。看到依赖后重调 venue weights、basis window 或 gain 会是 post-selection。

#### 6.1 LOO 检验的不是“哪个 venue 最好”

三 venue组合若代表广义外部共识，删除任一来源后方向应至少不反转。LOO 不是要求数值完全相同，而是要求信号不靠单一 venue撑住符号。否则 estimator更像 Bybit signal加两个旁观者，而不是三市场 consensus。

形式上，冻结门近似要求：

$$
\operatorname{sign}(\widehat\tau_{-v})
=
\operatorname{sign}(\widehat\tau_{all})
$$

对每个 $v$ 成立，并结合不确定性。leave-Bybit-out 反号直接失败。结果后选择“那就必须保留 Bybit”会把稳健性测试变成 venue-selection算法，需要新数据确认。

#### 6.2 Grade B 为正为何不能改变 primary

Grade A/B在 source、质量或可审计性上预先分层。若 primary失败后把 Grade B池入，研究者实际上根据 outcome改变样本定义。Grade B 正结果可以说明方向值得未来新研究，却不能补 Grade A 的日间区间和 LOO失败。

两个 panel差异本身也是 transport warning：若相同动作只在 sensitivity层稳定为正，需要解释是 market regime、source identity还是 sample composition，而不能简单说“更多天以后显著”。

#### 6.3 54.17% 与 55% 的门槛为何不能四舍五入

24 天中 54.17% 对应 13 个正日，55%要求至少更高的离散计数。门槛不是对真实 probability的精确估计，而是预先声明“方向不能只由少数大日贡献”的辅助条件。

即使把它视为 near miss，primary interval仍跨零、SELL偏负、LOO反转。四个失败不是同一项四舍五入误差。称为 near pass 会忽略证据链中其它独立门。

### 7. 为什么这不是 near pass

primary interval 跨零、positive days 未过门、SELL 偏负、LOO 反转，是四个相互独立的警告。Grade B 与 BUY point estimate 提供后续研究动机，但不能合成 deployment authority。

HT estimator 将 campaign assignment 推到 full-policy value：

$$
\widehat V_{HT}=\sum_i\left(\frac{A_iY_i}{p_i}-\frac{(1-A_i)Y_i}{1-p_i}\right)/D,
$$

其中 $D$ 按 UTC days 归一。其区间很宽，显示有限日 regime uncertainty；不能只引用 +0.6351 点估计。

#### 7.1 HT 日价值为何比每 assignment 更不稳定

HT 将每条 assignment按 propensity扩展到政策总量，再按日归一。campaign数量、值的尾部与当日市场 regime共同进入估计，所以 +0.6351 USDC/day 的区间跨约 3.4 USDC，远宽于点估计。

这个量更接近“如果整天采用 candidate会怎样”，也更暴露 capacity与日间风险。每 assignment微小正值若来自极少高活动日，HT区间会如实放大不确定性；不能只选尺度看起来更大的 USDC/day进行宣传。

#### 7.2 一个未来 cross-venue successor 应先解决什么

先在 receive-time 数据上冻结每个 venue 的 ready clock、staleness 与 missing rule，再用 leave-one-venue-out检查预测和 action方向；之后才决定 center gain。若先在 historical bars上优化 gain，再做 live transport，latency decay可能使最优点失效。

新 action也可改为 side-specific，但这会放弃“整对平移保持 spread”的原 treatment，必须重新约束库存漂移与双侧参与。不能从本结果中只保留正 BUY contribution，称为同一 candidate 的修正。

### 8. 研究演进与关闭边界

v1 implementation failure 与 v1.1 正式 run 共享 action/estimand；前者是执行修复，不拆文。live-shadow code 即使存在也只是 code-only，并未激活，也不改变 Development-closed 状态。

关闭的是这个 historical one-second, three-venue, frozen gain 的 continuous pair-center shift。它不证明 cross-venue information 没用；新研究可探索真正 receive-time causal prediction、side-specific action 或不同经济杠杆，但必须新 identity，不能在此面板上调 weights/basis/gain/eligibility。

### 9. 没有获得的权限

- Validation 与 sealed holdout 未读；
- 没有 shadow、action、live 或 full C++ tick authority；
- historical trade bars 没有 AWS receive-time live transport authority；
- 没有用 Grade B、BUY point estimate 或保留 Bybit 的组合救援 primary；
- 没有在已读结果后重调 venue weights、window、gain 或 side scaling。

### Pair translation 的局部几何

若baseline quotes为$(b,a)$、candidate center shift为$g_t$，理想pair translation给出$(b+g_t,a+g_t)$，spread$a-b$保持不变。但相对本地best bid/ask的距离分别改变；经过tick rounding、post-only clamp和inventory skew后，两侧实际位移也未必相等。

因此“97% fills保留”只说明参与度相近，不能证明同一订单被更好定价。candidate可能删除一部分BUY fills又增加SELL fills，campaign path仍会分叉。完整mechanics要报告理论shift、round后shift、clamp rate、side fill变化和role composition。

### 单一 venue 依赖为何是 transport failure

如果leave-one-venue-out去掉某一家后效应消失，可能是该venue真的拥有独特lead，也可能是它在当前时期承担了时钟、liquidity或stablecoin regime proxy。现有数据不能把这两种解释分开。部署时该venue延迟、symbol规则或basis变化，signal就可能失效。

LOO不是从三家里选PnL最高者，而是stress test。一个可推广global signal应在主要dropout scenarios下保持方向，或预先声明“仅在venue V健康时有效”并有source-health gate。结果出现后把模型缩成表现最好的单venue，会创建新的候选和新的multiplicity。

### 54.17% 为什么不是“实质上等于55%”

阈值是研究合同的一部分。若预注册要求至少55%的日方向一致，54.17%就是失败；四舍五入或强调只差一天等价于根据结果放宽门。更重要的是primary interval也跨零、LOO又失败，所以这不是单一机械阈值阻止了一个全面通过的候选。

一个新successor可以根据当前结果提出更窄机制，例如只在basis稳定、信号fresh且多venue一致时recenter，但必须先冻结这些状态并用新日期评价。当前证据支持cross-venue center能频繁改变quote并大致保留activity，不支持稳定terminal action value。

### Signal age 应进入 action contract

同一个fair shift在ready后100ms与5秒消费，不是同一信号。候选应记录source age并在预注册上限内才recenter；过期回baseline。若只在结果后发现年轻signal更好并筛选，属于新subgroup。

source health还应包含venue count、basis jump、staleness与disagreement。多venue方向不一致时，median center可能仍有限，但动作confidence下降；fallback必须由mechanics定义，不能由PnL挑。

### Pair recenter 与 inventory skew 的组合顺序

先recenter再加inventory skew，与先skew再对整对平移在clamp/tick rounding下可能不同。implementation parity必须锁定顺序，并报告哪一层最终绑定。否则Python与C++即使raw fair shift相同，也会产生不同orders。

这也说明fair-center action不是一个单float插入：它改变quote pipeline中的坐标，必须与floor、post-only与inventory guard一起接受full-path测试。

### 未来证据的最小门

至少要求Grade-A primary区间、positive-day rate、LOO source robustness、action/fill retention与terminal tail同时满足预注册标准。任何Grade-B或单venuediagnostic只能解释，不能覆盖primary。

当前候选在多个独立门失败，所以“near pass”叙事不成立。新机制需要新days，而不是把54.17%改写成55%。

### 10. 公共证据

- [`cross_venue_fair_center_shift_randomized_replay_v1_1_development_20260801.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/cross_venue_fair_center_shift_randomized_replay_v1_1_development_20260801.md)
- [`cross_venue_fair_center_shift_randomized_replay_v1_implementation_failure_20260801.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/cross_venue_fair_center_shift_randomized_replay_v1_implementation_failure_20260801.md)
- [`F09 README`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/README.md)

### 结语

这是比“预测分数好看”严格得多的检验：动作每次发生，fill 与 activity 保留充分，完整路径点估计也偏正；但时间日不确定性、SELL 方向与 Bybit 依赖共同阻止晋级。一个可信的 cross-venue alpha 必须同时跨过价值与运输门，而不只是保留一个漂亮均值。

![三交易所外部市场研究从信息坐标到 maker action 的结果收敛](/images/narrowgate/external-market-research-synthesis.svg)

*图：短时外部信息和稳健 fair coordinate 可以保留；first-add、adverse-edge 与 fair-center 仍未取得稳定的完整路径动作价值。*

## 9. 合并后的结论：外部市场是信息源，不是免费动作

三市场研究最稳定的发现是短时信息确实存在，而且可以用 past-only basis、two-of-three aggregation 与 leave-one-venue-out 构造可审计的 fair coordinate。最不稳定的部分恰恰是从坐标到动作：first-add 路径缺 exact common lifecycle，adverse-edge candidate rate 太低，symmetric fair-center 的主区间跨零并依赖具体 venue。

所以当前结论不是“跨市场无效”，也不是“外部 fair price 已能交易”，而是 prediction/mechanics 与 action value 仍分层。后继动作必须在同一 receive-time denominator 上同时冻结 feature-ready clock、venue availability、LOO、signed inventory role、quote coordinates、native lifecycle 与 terminal reward；不能把历史 provider-time prediction 拼接到另一批本地订单结果上。
