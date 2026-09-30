---
title: 'NarrowGate：Maker Quote EV、Order-Level Evidence 与 Causal Action Uplift'
date: 2026-06-19 16:50:48
updated: 2026-10-01 03:20:00
categories:
- Market Making
tags:
- Market Making
- 市场微观结构
- 数据质量
- 机器学习
- 回测
math: true
---

Last materially modified: 2026-10-01

## 被动报价、成交质量与库存风险

**NarrowGate** 是研究被动报价的框架：一笔限价单被成交，到底是在获得价差，还是在承接更快的信息交易者转移的风险？回答这个问题需要一起观察报价动作、排队与撤改单、成交后的价格变化，以及库存持有期间的完整账务，而不是只看成交次数或最后一个 PnL 数字。

库存生命周期是库存从空仓变为非零，经历持有和加减仓，直到重新归零的过程。一段库存生命周期可以包含多张订单和多次成交；风险需要沿整个持仓过程衡量，而不能只看某次成交后的短期价格变化。下单未成交不建立库存，撤单不结束已有库存；跨零成交拆为平掉原持仓与建立反向持仓。观察窗口结束仍有库存时按终点价格 MTM，不视作已经平仓，也不自动强平。

源码：[NarrowGateMaker](https://github.com/xiao-nanbei/NarrowGateMaker)。文中代码链接用于定位相关实现；具体实验结论以对应的数据范围、配置和结果说明为准。工程细节见[回测吞吐与尾延迟工程](/2026/07/01/NarrowGate-Cpp-Low-Latency-Market-Making/)。公开源码不含私有行情、模型权重和运行配置。

### 报价期望价值与机会级代理

报价期望价值（quote expected value）首先是动作相对基线的完整净权益增量：

$$
\Delta V(a;x)=\mathbb{E}[W_T(a)-W_T(a_0)\mid X_t=x].
$$

两臂从共同状态出发，必须说明共同终点 $T$ 和各自动作后的后续策略。$W_T$ 包含原会计口径的实际费用、资金费和终点库存估值；成交、撤单、后续加减仓及库存风险都可能改变它。

完整账户净 PnL 包括交易损益、手续费、有符号资金费与期末库存 MTM，并与账户权益变化对齐。闭合库存生命周期和未闭合库存可以分别诊断，但生命周期持续时间的删失不意味着可以省略期末库存价值。终点估值不等于实际清仓或免费平仓；现金字段已包含的费用不能重复扣除。独立账户 PnL 求和也不是单一账户连续复利收益。

当前 [`QuoteEVModel.predict()`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/quote_ev.py) 的 `ev` 则是 `fill_prob * fill_markout`：**每次报价机会的预期30秒 maker markout**，不是直接预测完整账户 USDC 净 PnL。这里的30秒从成交时刻起算；E/C 标签的决策后30秒窗口是另一种时钟。成交价到未来中价的 markout 已包含入场价差，不能再加一次 spread edge。

### 不同统计量回答不同问题

| 对象 | 定义 | 用途与限制 |
|---|---|---|
| GLFT 成交强度斜率 | 指数成交到达强度的距离斜率，公式见下文 | 描述成交到达强度随距离衰减；不是固定窗口触达概率 |
| F02 P3 | 给定距离和市场状态，10秒内同侧最优报价触达目标价位的概率；不含己方排队和完整撤改单生命周期 | 触达概率的局部距离斜率**不等于**成交强度的距离斜率；公式见表后 |
| 深度流动性倍率 | 近端平均深度相对 `depth_liquidity_baseline` 的有界比值 | `use_depth_liquidity_scaling` 控制是否将该比值乘到报价距离衰减系数；不是成交强度拟合 |
| weighted-mid proxy | 买侧总数量给最优卖价加权，卖侧总数量给最优买价加权，再除以总数量 | `weighted_mid_proxy_from_book()` 用所选档位数量和最优买卖价描述盘口不平衡 |
| 成交强度加速保护 | 快慢时间尺度成交强度 EMA 的比较 | `trade_intensity_acceleration_guard_active` 配合保护倍数影响报价；没有盘口耗尽量，不能解释为盘口耗尽率 |

$$
P_{\mathrm{touch}}(\delta,x)=\Pr(\tau_{\mathrm{touch}}\le 10\,\mathrm{s}\mid\delta,x),\qquad k_{\mathrm{touch}}=-\partial_\delta\log P_{\mathrm{touch}}\ne k_{\mathrm{exec}}.
$$

P3 的距离以实际同侧 BBO 原点为准，不能与 GLFT 相对 mid 的距离混用。报价模块先验证 P3 的期限、距离单位与来源；启用 `p3_pair_spread_projection_enabled` 时使用触达统计构造双边价差下限与斜率投影。这仍不把触达概率变成实际成交概率。双边价差下限也不保证偏斜和取整后每一侧到 BBO 的距离。

盘口数量加权中价不等于通过状态转移估计的 $\mathbb{E}[S_{t+h}\mid \mathrm{LOB\ state}]$。P3 触达统计、成交强度加速保护和深度缩放因子各有用途，不能因符号相似就当成同一个模型参数。

研究结果也有明确范围。F02 的一项 scalar-adapter 对照中，平均半价差由24.58缩到13.49、成交数由8,799增到21,597，终点 MTM 却恶化115.66 USDC，说明更多成交不是价值证据。Full-Multiscale 的30日 Development 中，BUY E3 相对改善为0.458577 USDC/day，但候选自身约为−2.445540 USDC/day；同时置信下界与特征层级门槛失败，`supported_sides=[]`，Validation 与 holdout 未读取。这只属于该冷却实验。F05 还包含机会级成交质量、风险加宽消费者，以及 POST/WAIT、KEEP/CANCEL 配对选择；它们的标签、动作、执行范围与经济结论分别记录，不能互相替代。公开聚合报告可以审计这些限制，未公开的逐行预测与输入则不能由第三方独立复算；模块存在不等于特定回测或 live 已启用。

## 阅读路线：先问题，再证据

如果只看现在的代码目录，很容易以为 NarrowGate 是一个“AS + LightGBM + tick replay”的技术拼盘。实际演进顺序恰好相反：每一层都是上一层暴露问题后的修正。

| 阶段 | 最初假设 | 真实问题 | 后续修正 |
|---|---|---|---|
| AS 与 1s-bar 原型 | spread、波动和库存足以描述报价 | bar touch 无法表示 maker 排队、延迟和逆向选择 | 引入逐笔回放、BBO/L2、queue ahead 和 maker fill gate |
| 原生盘口接入 | 有文件就能重建盘口 | CryptoHFTData 存在缺小时、低 snapshot coverage；gap 会污染 rolling 和未来 label | audit 成为硬边界，物理清理坏数据，并统一 continuous segment / horizon guard |
| BTCUSDT reference | 高流动性参考市场应提升收益 | reference 同时包含信息冲击和已被本地吸收的流动性冲击，统一开关会误杀机会 | 由布尔开关转向 shock attribution 和逐侧 quote EV |
| enhanced spot | 更多市场能让模型更健壮 | 特征有信息不等于 policy 有正 EV，bid/ask 响应还不对称 | 降级为 risk label / moderator，优先用 retained canonical data 做 bucket 与 offline quote-EV research |
| quote EV | 用条件 fill value 研究逐侧报价动作 | 机会级 markout 不能代表完整账户净权益增量 | 在共同初始状态、终点和后续策略下比较动作与基线 |
| 库存生命周期风险 | 用 库存生命周期 状态直接驱动 stop-add/rearm | 状态排序不能替代动作反事实，旧结果不构成有效研究证据 | 只保留 causal feature 与 outcome label，不直接改 live |
| 连续跨日/月度 replay | 长窗口汇总更稳定 | 无合同拼接坏日/gap 会污染状态；但 daily fresh-start 又不能表示 live 的带仓跨日 | 历史 identity 保留 UTC 日度 fresh-start；新建 versioned continuous/restart-aware substrate，midnight 只作统计切片 |

各项研究的结论和限制如下：

| 状态 | 内容 | 当前处理 |
|---|---|---|
| **作废** | 连续跨日/月度 replay 结论、坏日/gap 污染下的 quote EV A/B、markout EMA latch 污染下的 adverse 参数、fills/day 用错分母 | 不再用于选择 live 参数，只作为事故复盘 |
| **保留** | 数据质量体系、identity-specific fresh-start、continuous segment/horizon guard、hard gate、库存时间积分、live/replay 机制量对齐 | 作为后续所有实验的入场条件；是否跨日 carry 必须由 Spec 明示 |
| **共享底座尚未产生完整验证结果** | continuous state/restart/accounting contract 与三层 replay-cache DAG | shared tick-runner 绑定检查尚未通过；F05 的 71 日结果仅覆盖对应研究族的重启会计诊断 |
| **causal-v4/v5/v9 历史 checkpoint** | bucket-end visibility、normalized-100ms、merged clock 与 13-head lineage | 保留为历史因果/数据修复证据；当前模型身份已滚动到 causal-v12 semantics-v6 |
| **固定 local action 已否决** | BUY/SELL `prevent-over-widen / widen-1tick / recenter-1tick`，以及后续 BUY conditional-widen、SELL repair-trend skip 两个窄 family | development/validation 或 development gate 未过；对应 sealed holdout 保持未读，不等待新日期重跑同一 family |
| **source-aware 数据身份** | 45 个 2026 native days + 67 个 provider-normalized target days；后者来自 Tardis top-20/100ms | 2025 provider days可训练 causal features，不能获得 native sequence/exact queue 权限 |
| **Full-Multiscale research** | 30 日 Development、BUY E3 为最强 point candidate | `supported_sides=[]`；Validation/holdout 未读，不能据此确认报价动作有效 |
| **v12 50 日比较结果的适用范围** | causal-v12 semantics-v6、daily-fresh-start 实验 | 仅描述该实验采用的会计和成交顺序，不能替代当前执行器的经济验证 |
| **固定参数研究族** | 报价控制器的库存与价差系数、cooldown/cap/max-inventory 与固定一档动作的 pooled winner search | 已作为完成的阴性研究族关闭；固定值只能是 baseline、经验校准或安全边界，不因字段名就被视为论文估计量 |
| **F06 placement-distance closure** | ordered surface、paired 1/2/4-tick resolution、direct marginal-fill terminal value | 0/24 正式 value cells 一侧区间通过，`closed_placement_distance_value_unidentified`；Value/Action 未创建 |
| **BUY q90 baseline-integrity work** | 历史 100ms adverse-fill shadow、dual-clock exposure、terminal risk-set 与 fresh recovery | 40 日 exact-native mechanics 已完成；首次 prospective transport 因 duplicate activation 与缺 exact feature-ready companion fail closed；当时 action OFF/shadow ON，后来的冻结 no-shadow 快照中两者均关闭，但这不回答当前进程状态 |
| **BUY fill-selection** | 冻结 40 日 ON-OFF 点估计 -16.7946 USDC，CI 跨零 | `unsupported_negative_point_estimate`；历史运维记录显示 action 与 shadow 后续停用，不能写成已证明普遍有害，也不由本文推断今日状态 |
| **spread-fill 新证据面** | 128 日、25 个固定距离的 paired counterfactual；BUY/SELL 与 exact/through touch、queue、lifecycle 分解 | v1 的 0→1 tick 反转已撤回；v2 的无条件曲线单调，远端 queue fallback 仍高，尚未形成 live lookup 或 spread policy |
| **参数快筛** | baseline-gated C++ replay、summary-only Sobol/random search | 可以扩大候选覆盖，但 survivor 必须回到 daily/inventory_lifecycle audit；公开 `live/config.yaml` 只是示例，不是实际 rolling baseline |

受数据连续性、会计或状态更新缺陷影响的实验排名不构成特征选择或报价动作的有效证据。

### 证据术语：不要把三种日期隔离都叫 OOS

按日隔离有不同含义：

| 名称 | 当前含义 | 能证明什么 |
|---|---|---|
| blocked-day cross-fit | `fill_selection_score.py` 当前按 `date_digits % folds` 分组；同一天不同时进入 train/test，但训练集可能包含测试日之后的数据 | 避免同日样本混入，不能模拟生产式“只用过去预测未来” |
| chronological walk-forward | 训练日严格早于测试日，train/test 之间可加 embargo | 时间前推检验；是否采用及其覆盖需由具体实验记录证明，不能从 scorer 接口推断 |
| model test panel | 不参与该模型训练与超参数选择的时间后段 | 只能复核该模型 identity 的泛化；不能自动成为后续 action family 的 untouched holdout |
| family-specific sealed holdout | 在 action、eligibility、propensity、reward、feature 与 gate 冻结后，为该 family 保留的一次性确认面板 | 只在该 family 内称 sealed；日期可能已被无关研究使用，不能称 globally untouched |

修复前反复打开的 retained/blocked 面板不再被当作 OOS，也不再保留它们的参数排名。此后文中没有限定词的 OOS 只表示“相对某次 discovery 的隔离面板”，不等价于 chronological walk-forward 或永久 late holdout。

causal-v4 **model** identity 在 122 日上使用 `80 train + 1 embargo + 20 validation + 1 embargo + 20 test`；独立的 action-family manifest 才把同一日期宇宙分配为 `80 development + 1 embargo + 20 validation + 1 embargo + 20 family-specific sealed holdout`。model test 与 action holdout 是两种身份，不能混写成一个没有限定词的“retained/OOS/sealed”。

截至本次更新，当前研究链路可以概括成：

![NarrowGate maker live hot path](/images/narrowgate/maker-hot-path.svg)

```text
Binance Vision / native CryptoHFTData / Tardis / AWS receive-time tapes
        │
        ▼
source-aware data audit + good-day intersection + D-1 warmup
        │
        ▼
static Feature DAG + strict bucket cutoff + normalized L2 100ms
        │
        ├──► native sequence-valid subset：queue/lifecycle evidence
        ├──► provider-normalized subset：prediction/source sensitivity
        └──► closed source-bound receive-time tapes：BABEL historical evidence
        │
        ├──► causal-v12 13-head：10s completed-bucket prediction
        │
        ▼
AS-shaped empirical quote core + explicit research/action permissions
        │
        ▼
tick replay / live execution：dual clocks / queue / cancel-ACK / remaining qty
        │
        ▼
order-level denominator + fill markout + inventory_lifecycle labels
        │
        ▼
prediction -> transport -> economic resolution -> randomized action gate
```

这条链路很重要，因为 quote EV、fill-selection score 和 库存生命周期风险 score 都不是从原始行情直接训练出来的万能模型。它们依赖上游报价轨迹、成交路径、未来 markout 和 cross-market context；任何一层的数据边界或执行口径出错，最后得到的 AUC 和 PnL 都可能只是被污染后的精确数字。文中后续保留的 quote-EV 伪代码或 shadow calibration 都是历史抽象，不能通过环境变量重新启用，也不是创建新 live shadow 的建议。

这也是为什么数据源需要先分层，而不是全部丢进一个 dataframe。NarrowGate 里至少有五类数据：

![NarrowGate research data lineage](/images/narrowgate/data-lineage.svg)

| 数据层 | 主要来源 | 在项目中的角色 | 最容易出错的地方 |
|---|---|---|---|
| execution trades | 所选传输与模型合同声明的 aggregate 或 individual trade；历史文件也须保留来源类型 | `LiveExecutionFeatures.aggregate_trade()` 与 `individual_trade()` 消费不同协议；后者接收真实 trade 消息，不从聚合包虚构子成交 | 聚合包数、个体成交数和原生订单身份不是同一信息；接口支持不证明当前端点可用或实际部署已订阅，也不把成交数据变成全市场 MBO |
| native execution orderbook | CryptoHFTData BTCUSDC hourly price-level snapshot/delta | 原生 sequence/warmup 合格日上的 formal queue、lifecycle 与 action replay | 小时缺失、无 snapshot、sequence gap，或把 top-20/MBP 写成全市场 MBO truth |
| provider-normalized orderbook | Tardis `incremental_book_L2` + `book_ticker`，重建 top-20/100ms | 2025 source-aware causal-v12 training 与 provider sensitivity；双源重叠日可做一致性审计 | 没有 Binance native `U/u/pu` authority，也不是 AWS live receive time，不能用于 exact queue/action authorization |
| slow market context | Binance OI、long/short ratio、funding/premium 等日度慢变量 | regime 与慢速风险上下文 | 采样频率和 quote-time 动作尺度不同，不能直接当成毫秒级价格发现信号 |
| cross-market anchors | BTCUSDT perp、BTCUSDT spot、BTCUSDC spot、`USDCUSDT` spot | Binance BTCUSDT 做本地 level bridge；`BTCUSDT / USDCUSDT` 换算到 USDC；BTCUSDC spot 做 cross-check/fallback | 多个 Binance 市场高度相关，不能伪装成独立 venue consensus；交易对正式 symbol 是 USDCUSDT，不是反向乘法 |
| historical independent-venue capture | Bitget v3 `books1/publicTrade`、Bybit `orderbook.1/publicTrade`、OKX `bbo-tbt/trades`，以及 retained111 历史 trades | 历史 receive-time flow/toxicity、cross-venue consensus、leader/divergence 与 库存生命周期-moderator 研究 | current external/Flow/Ref 与全部 shadow 均 OFF；保留 tape 只作离线历史证据；L1 BBO 不是 exact L2，spot/perp 也不是六张独立选票 |

因此本文里的“数据清理”不是普通 ETL 卫生问题，而是模型定义的一部分。maker 的 label 常常是条件事件：先有候选 quote，再看是否 fill，fill 后再看 1s/5s/30s mid。只要 orderbook 缺口或长 gap 横跨这个链条，`P(fill)`、`E(markout | fill)` 和库存风险都会被误标。

为了避免后面术语来回跳，这里先给一个小词典。它不是交易教材，只是本文后续代码和公式里的统一含义：

| 术语 | 在 NarrowGate 里的含义 |
|---|---|
| maker | 挂被动限价单，等待别人主动成交；不是追着价格打单，而是在盘口提供流动性 |
| taker | 主动吃掉盘口流动性的人；他的成交方向常被用来估计短期 flow pressure |
| BBO | best bid / best ask，即当前最优买一和卖一 |
| mid | `(best_bid + best_ask) / 2`，最简单的中间价 |
| 盘口数量加权中价 | 用 top-N 数量与 BBO 构造的加权中价；它只表达当前盘口不平衡，不是 Stoikov 的未来价格条件期望估计器 |
| spread edge | maker 买在 bid、卖在 ask 所获得的价格让步；这是毛收益来源，不等于最终收益 |
| queue ahead | 自己挂单前方同价位或更优价位的可见数量；价格碰到不代表一定轮到自己成交 |
| markout | 明确价格起点、终点与单位的估值差；从成交价起算时包含成交时相对中价的价格优势 |
| maker-signed markout | 买方向取正号、卖方向取负号的估值差；正值不单独说明成交后中价向有利方向移动 |
| adverse selection | 成交后价格向不利方向移动；直觉上就是“我被更快或更有信息的一方打到了” |
| toxicity | 某侧成交后出现 adverse markout 的概率或强度估计 |
| quote EV | 不是预测价格涨跌，而是问“这一侧、这个价格、这一笔被动挂单，成交之后是否值得” |
| TTL / cooldown | 挂单最长存活时间 / 成交后短时间限制同侧继续暴露 |

## 第一部分：Maker 量化算法与数据假设

这一部分只讨论策略研究本身：maker 订单为什么有条件 EV，AS/GLFT 公式如何提供报价坐标系，数据源和 quote labels 为什么必须经过连续性校验。暂时不谈工程实现，因为如果算法假设和数据边界没立住，任何优化都只是更快地产生错误结论。

### 1.1 为什么叫 NarrowGate

NarrowGate 取自“窄门”的意象。对 maker 策略来说，市场里的机会并不是越多越好。每一个 tick 都可以触发报价，但真正值得暴露的窗口必须经过几道门：

1. 当前 spread 是否提供了足够的流动性补偿；
2. 报价相对 mid/BBO 的位置是否合理；
3. 主动成交和盘口压力是短期流动性冲击，还是信息驱动的重定价；
4. reference perp 与 spot 是否确认了这个变化；
5. 库存、挂单 TTL 和撤单频率是否仍在风险预算内。

因此 NarrowGate 不是“预测涨跌然后追单”的趋势策略。它研究的是被动限价单：当别人为了立刻成交而付出成本时，maker 是否值得站在另一边接住这笔流动性。

NarrowGate 研究被动报价、参与选择和库存管理。订单所有权、数据有效性和账户状态等执行安全条件必须满足；不满足时按相应规则禁止操作。方向、波动与成交质量是统计性市场信号，经具体策略影响报价和参与，其经济价值需要完整路径检验。负向过滤只是可研究的机制之一，不是整个项目的唯一目标，也不意味着模型能识别“绝对负价值”的机会。

这里最关键的分界是：

- **流动性冲击**：某一侧突然有主动成交，但价格影响短暂，其他市场没有持续确认，本地盘口可能很快恢复；
- **信息冲击**：BTCUSDT perp、spot 或更广泛的盘口同时重定价，此时在旧价格继续挂单，往往是在给更快的信息交易者提供退出流动性。

每一侧 quote 都可以研究条件价值。下式仅是以完整价格 markout 为基础的机会级效用示意，不是当前执行器的完整净动作价值模型。令 $z$ 为固定成交数量、$M_h=s(m_{t_f+h}-p_f)$ 为完整价格 markout，费用 $C$ 与惩罚 $R$ 均按账户货币计量：

$$
\widetilde V_{\text{side}}(x)
\approx
P(\operatorname{fill}\mid x)
\left(
  z\,\mathbb{E}[M_h\mid \operatorname{fill},x]-\mathbb{E}[C\mid\operatorname{fill},x]
\right)
- R_{\text{inventory/tail}}(x)
$$

完整价格 markout 已包含成交时价格优势，不能再加一次 spread edge。价格单位转换为货币价值需要乘数量；随机部分成交时应在期望内处理实际数量，不能直接套用固定 $z$。费用只扣一次；库存或尾部惩罚是所选效用目标，不是已经发生的现金费用。这个简式没有自动包含排队、撤改、后续库存路径、全部资金费或共同终点权益。

`P(fill)` 高不一定是好事。一个几乎必然成交、但成交后价格立刻向不利方向移动的报价，可能比完全不成交更糟。

下面是分层机制示意，不是可直接执行的当前 API。参考永续、执行市场现货和参考市场现货均为可选输入能力：仅在所选输入合同、配置与消费者允许时传入，不表示每个任务都加载它们。

```python
def on_requote_tick(state, market, models, cfg):
    # 1. 更新短周期市场状态：mid、BBO、depth、trade flow、reference/spot
    signal = signal_engine.compute(
        exec_trades=market.btcusdc_trades,
        exec_book=market.btcusdc_l2,
        ref_perp=optional_admitted_input("reference_perp"),
        exec_spot=optional_admitted_input("execution_spot"),
        ref_spot=optional_admitted_input("reference_spot"),
    )

    # 2. 主模型只回答状态问题：短期 ret / vol / toxicity
    pred = models.main.predict(signal.feature_vector)

    # 3. AS quote core 给出报价坐标系
    quote = compute_quote_core(
        mid=market.mid,
        inventory=state.position,
        sigma_sq=pred.vol_10s,
        ret_10s=pred.ret_10s,
        tox_bid=pred.tox_bid,
        tox_ask=pred.tox_ask,
        depth=market.l2_topN,
        cfg=cfg.quote,
    )

    # 4. 该冻结 identity 的 side policy 只消费 guard、库存和 lifecycle 状态
    bid_policy = build_side_policy(
        side="bid",
        quote_ctx=quote.bid_ctx,
        inventory=state.position,
        fill_cooldown=state.fill_cooldown,
        active_guards=state.active_guards,
    )
    ask_policy = build_side_policy(
        side="ask",
        quote_ctx=quote.ask_ctx,
        inventory=state.position,
        fill_cooldown=state.fill_cooldown,
        active_guards=state.active_guards,
    )

    # 5. routing 只做本次订单动作：保留、撤单、换价、新挂
    decision = route_orders(
        quote=quote,
        bid_policy=bid_policy,
        ask_policy=ask_policy,
        live_orders=state.live_orders,
        filters=market.exchange_filters,
    )
    # 6. order outcome 之后才进入 denominator/inventory_lifecycle/shadow evidence。
    # delayed would-fill 需要未来 L2/trades 重放，不是决策时刻的已知事实。
    evidence_log.record_decision(signal, quote, bid_policy, ask_policy, decision)
    return decision
```

报价期望价值模型用于离线校准、订单级打分和库存生命周期风险分析。模型分数本身不是报价动作；动作价值必须在共同输入、队列和完整会计下比较。

这段伪代码也解释了为什么工程优化不能只盯着某一个公式。`compute_quote_core()` 的浮点数学很短；真正决定行为的是 feature state、quote context、side policy 和 routing decision 是否共享同一套语义。若只优化报价公式，却让回测、shadow 和 live 在 policy 边界上分叉，速度越快，错误结论也会来得越快。

### 1.2 从 AS 报价骨架开始

项目最早使用经典 Avellaneda-Stoikov 做市模型。它给出了两个很有用的结构：reservation price 和最优 spread。

$$
r(s,q,t)=s-q\gamma\sigma^2(T-t)
$$

$$
\delta
=\gamma\sigma^2(T-t)
+\frac{2}{\gamma}\ln\left(1+\frac{\gamma}{k_{\mathrm{exec}}}\right)
$$

$$
\operatorname{bid}=r-\frac{\delta}{2},\qquad
\operatorname{ask}=r+\frac{\delta}{2}
$$

其中 $q$ 是库存，$\sigma$ 是短期波动，`k_exec` 描述**成交订单到达强度**随报价距离的衰减速度，不是固定 10 秒内的 touch probability 斜率。直觉上，库存偏多时 reservation price 下移，报价会更愿意卖出、更不愿继续买入；波动上升时 spread 变宽，以补偿更高的逆向选择风险。

![同一段 K 线下库存如何移动 reservation center 与双边报价](/images/narrowgate/reservation-inventory-kline.svg)

*机制图：在 K 线、fair price、波动和 half-spread 都相同的控制对照里，正库存先把 reservation center 下移，再让 bid 与 ask 同量下移。它不是只关掉 bid：bid 变远意味着减少继续买入，ask 变近意味着更愿意卖出减仓。图为合成示意，不是实盘证据。*

读图时可以把蓝线看成“报价围绕的中心”，绿线和红线分别看成最终 bid/ask 的连续轨迹。库存项决定三条线整体往哪边移；half-spread 决定 bid/ask 离中心有多远。这两个自由度不能混成一个参数。

这几个式子背后的论文假设可以压缩成三步。

第一步，Avellaneda-Stoikov 假设中间价近似服从扩散过程：

$$
dS_t=\sigma\,dW_t
$$

做市商持有库存 `q`，财富受现金和库存市值共同影响，并使用 CARA utility：

$$
U(x)=-\exp(-\gamma x)
$$

在这个设定下，多持有一单位库存会暴露未来价格方差，CARA + Brownian price 的风险惩罚项近似为：

$$
\operatorname{inventory\ penalty}
\approx q\gamma\sigma^2(T-t)
$$

于是 reservation price 可以理解成“愿意用来给库存做无差异估值的价格”：

$$
r=s-q\gamma\sigma^2(T-t)
$$

第二步，论文用一个很简洁的到达率假设描述“报价离中间价越远，越不容易成交”：

$$
\lambda_{\mathrm{exec}}(\delta)=A\exp(-k_{\mathrm{exec}}\delta)
$$

$$
\delta_{\mathrm{bid}}=m-p_{\mathrm{bid}},\qquad
\delta_{\mathrm{ask}}=p_{\mathrm{ask}}-m.
$$

$\delta$ 是单侧报价距离，不是双边总价差。距离与斜率必须使用对应单位，使 $k_{\mathrm{exec}}\delta$ 无量纲；$\lambda$ 是每单位时间的成交到达强度，不是10秒触达概率。

<a id="glft-distance-illustration"></a>

![GLFT 单侧卖价距离与相对成交强度：三个互斥备选方案](/images/narrowgate/glft-orderbook-distance.svg)

图中参数仅作示意，不是项目校准结果；三个卖价是互斥的报价备选方案，不是同时提交三张订单。盘口数量不参与这张距离—强度示意图的坐标。

在 CARA utility 下最大化一次被动成交的效用增量，会得到每一侧报价距离中的 log 项：

$$
\operatorname{edge\ term}
=\frac{1}{\gamma}\ln\left(1+\frac{\gamma}{k_{\mathrm{exec}}}\right)
$$

再叠加库存持有风险，得到总 spread：

$$
\operatorname{total\ spread}
=\gamma\sigma^2(T-t)
+\frac{2}{\gamma}\ln\left(1+\frac{\gamma}{k_{\mathrm{exec}}}\right)
$$

上式默认把每次成交数量规范化为 1。若订单量是 $z$（base asset），而库存 $q$ 也按 base asset 计量，数量感知的近似应把 $\gamma z$ 与距离衰减率配对：

$$
\psi(z)
\approx
\gamma z\sigma^2\tau
+\frac{2}{\gamma z}
\ln\left(1+\frac{\gamma z}{k_{\mathrm{exec}}}\right).
$$

这里 $\gamma$ 的单位是逆报价货币，$k_{\mathrm{exec}}$ 的单位是逆价格，所以 $\gamma z$ 与后者同量纲。当前报价接口分别接收 `inventory_reference_qty`、`eta_inventory`、`a_spread` 和 `risk_per_order`，各自消费者见下文；它是 AS 形状的经验控制器，不是任意订单数量下的精确 AS/GLFT 最优解。

第三步，GLFT/Guéant 体系把“指数到达率”推广成更一般的强度函数 `Lambda(delta)`。这时不必假设所有市场都满足 `A exp(-kappa delta)`，而是通过 Hamiltonian 写成：

$$
H(p)=
\sup_{\delta}
\Lambda(\delta)
\left(1-\exp\left[-\gamma(\delta-p)\right]\right)
$$

指数强度只是一个特例；如果真实 execution arrival 对报价距离的衰减不是纯指数，就应该校准 `Lambda_exec`，而不是把任意单调下降的 touch 曲线改名为 `kappa_eff`。NarrowGate 保留 AS 骨架，是因为它给出了可解释的库存坐标系；但 P3 touch slope、execution-intensity slope 与 depth multiplier 必须保持不同类型。

以上属于论文结构与假设。当前 Python `_compute_quote_core_py()` 是经验控制器，其基础计算与条件分支如下，不应把论文最优解直接当作当前执行公式：

![NarrowGate quote ladder](/images/narrowgate/quote-ladder.svg)

$$
\operatorname{mid}=\frac{b_{\text{best}}+a_{\text{best}}}{2}
$$

$$
 m_w
=
\frac{a_{\text{best}}Q_b+b_{\text{best}}Q_a}{Q_b+Q_a}
$$

$$
\operatorname{fair}=\begin{cases}
m_w,&\text{盘口可用且启用 weighted-mid proxy},\\
\operatorname{mid},&\text{否则}.
\end{cases}
$$

本地报价中心由执行市场价格状态构造。方向预测、收益预测及参考市场信息是否改变报价，分别取决于输入合同、配置和实际订单消费者。收益偏移在后续条件分支修改 reservation center，并须通过收益动作合同兼容检查；诊断中计算出的参考价格不自动进入报价。这里不宣称今天的 live 使用了任何可选路径。

$$
n=\frac{q}{q_{\mathrm{ref}}},\quad
v_H=\sigma^2\,\mathrm{risk\_horizon\_s},\quad
r_0=\operatorname{fair}-n\,g_{\mathrm{eff}}v_H
$$

$$
h_{\text{controller}}
=\frac{1}{2}\left[
\rho v_H
+\frac{2}{\rho}\ln\left(1+\frac{\rho}{k_{\mathrm{spread}}}\right)
\right]
$$

其中 $\rho$ 对应 `risk_per_order`，$k_{\mathrm{spread}}$ 对应代码中经来源选择、可选深度流动性倍率与 `kappa_ratio` 得到的有效距离斜率；$g_{\mathrm{eff}}$ 从 `eta_inventory` 出发，按适用的库存幅度和方向条件调整。库存使用 `inventory / inventory_reference_qty`，而非直接把 BTC 库存数量当无量纲值。`a_spread` 是独立接收、验证并记录的字段；当前这个 Python 基础价差表达式不直接消费它，不能因为某组配置数值相同就与 `risk_per_order` 合并解释。

后续不是可任意交换的乘积，而是条件化的执行顺序：基础总价差 → 已启用的状态倍率 → 成交强度加速、markout 与深度调整 → P3 双边投影下限 → 费用下限 → 所选价差上限模式 → 中心/不对称调整、逐侧保护与价格约束。深度流动性倍率对距离斜率的作用已在基础式之前发生，不能与后续深度毒性调整混为一步。`max`、乘法、截断和逐侧调整不交换顺序，各任务也不一定启用所有步骤。

核心先对原始目标价作买向下/卖向上的 tick 处理，再做中价保护与必要的再次取整。Post-Only 防穿价检查针对**对侧**：

```python
# 当前 Python 核心中的局部防穿价检查；不是完整最终订单算法。
if best_bid > 0 and ask_price <= best_bid:
    ask_price = best_bid + tick
if best_ask > 0 and bid_price >= best_ask:
    bid_price = best_ask - tick
```

“不吃掉对侧挂单”不等于“永远不能改善同侧最优价”。可选的 `apply_p3_side_bbo_floor()` 是另一项逐侧 BBO 距离约束，不是 Post-Only 的定义。核心内仍有最终 cap/P3 处理；核心输出之后，live/replay 的订单规划还会应用逐侧策略、数量和风险约束，并可能再次处理 cap、精度及合法价格。不能把核心返回值等同于最终提交订单。

![K 线冲击下中心位移与价差变宽的区别](/images/narrowgate/center-shift-vs-spread-widening-kline.svg)

*机制图：左图只改变 weighted-mid proxy 对报价中心的偏移，bid/ask 同向移动而宽度不变；右图只提高风险 half-spread，bid/ask 反向远离中心。真实冲击可以同时触发两条机制，但解释和校准必须分开。图为合成示意，不是实盘证据。*

这张图也给出了读 K 线时最重要的区分：上涨或下跌本身不会唯一决定报单动作。盘口数量不平衡可能移动中心，波动、流动性和 adverse guard 可能改变宽度，库存又会额外移动 reservation center；最终 bid/ask 是这些正交分量叠加后再经过 tick、BBO 与 Post-Only 约束的结果。

`weighted_mid_proxy_from_book()` 计算盘口数量加权中价：买侧数量更大时，加权中价向最优卖价偏移；反过来则向最优买价偏移。它没有估计订单簿状态转移，也没有输出未来价格的条件期望，因此不是 Stoikov micro-price estimator。

把 weighted-mid proxy 写成这个形式，只能把它理解为当前 top-N 数量不平衡的坐标。若 `bid_qty` 远大于 `ask_qty`，它靠近 `best_ask`；这本身不等于“下一笔成交方向概率”已经被估计：

$$
m_w-\operatorname{mid}
=
\frac{1}{2}\operatorname{spread}
\cdot
\frac{Q_b-Q_a}{Q_b+Q_a}
$$

这也是为什么它只能作为局部盘口压力，而不能替代未来收益模型。一个厚 bid 可能是支撑，也可能只是即将撤掉的虚假流动性；真正进入策略时，还必须经过 freshness、depth coverage、reference confirmation 和 fill 后 markout 验证。

side policy 则在候选价格之后再做一次门控：

```text
allow_bid =
    fresh_book
    and not bid_adverse_pause
    and not bid_local_extreme_pause
    and inventory < max_inventory
    and not fill_cooldown_blocks_bid

allow_ask =
    fresh_book
    and not ask_adverse_pause
    and not ask_local_extreme_pause
    and inventory > -max_inventory
    and not fill_cooldown_blocks_ask
```

当库存偏多时，bid 是增加风险的一侧，ask 是降低风险的一侧；库存偏空时反过来。因此同一个 adverse guard 对 bid/ask 的含义并不对称，这也是 quote EV 必须按 side 训练和评估的原因。

![成交后 cooldown 如何逐侧影响 K 线上的报单](/images/narrowgate/cooldown-side-selective-kline.svg)

*机制图：在已有多头库存的例子里，BUY fill 之后继续挂 bid 会增加暴露，cooldown 因而屏蔽或延后这一侧；SELL ask 是减仓方向，原则上继续可用。Full-Multiscale 研究的是在 fill 时刻用因果可见状态选择冻结时长，而不是看见未来 K 线后再改时长；其公开研究状态仍是 `supported_sides=[]`。*

如果图中的 K 线在 fill 后继续下跌，屏蔽加仓 bid 可以减少在 adverse path 上连续接单；如果随后反弹，仍可用的 reducing ask 给库存留下退出路径。这里的“仍可用”不绕过 freshness、Post-Only、inventory limit 或其他硬安全门，它只说明 cooldown 自身不应误伤减仓方向。

但真实盘口不会只服从这几个变量。因此项目后来逐步加入：

- 盘口数量加权中价与盘口 imbalance；
- P3 触达概率的距离斜率 与近端 depth liquidity multiplier；
- fee-aware spread floor；
- LightGBM 的波动率、收益和 toxicity 预测；
- CJP 风格库存偏移和库存衰减；
- adverse guard、defense guard 与逐侧暂停；
- adaptive/fragile TTL 与 cooldown；
- BTCUSDT reference perp、BTCUSDC/BTCUSDT spot；
- quote EV 对 fill probability、markout bucket 和 extreme adverse 的建模。

AS 在这里不是一个直接给答案的“万能公式”，而是稳定的报价坐标系。机器学习和策略 guard 不应该随意取代这个坐标系，而应该回答更局部的问题：这一侧现在是否值得挂、要离 BBO 多远、该暴露多久、库存代价是否已经过高。

主模型和 quote EV 在这里扮演不同角色。主 LightGBM 描述市场状态，例如短期收益、波动与 toxicity；quote EV 则站在某一笔候选报价的角度，估计“是否会成交、成交后是否有利、尾部是否危险”。前者回答市场正在发生什么，后者回答这一侧是否值得承担一次具体的 maker 暴露。把二者混成一个方向预测器，反而会丢掉 maker 最关心的条件性。

项目也因此从早期 1s-bar 回测逐渐转向 tick replay。bar 回测适合快速检查公式和参数方向，但只知道价格是否触及；maker 是否真的成交，还取决于挂单前方的队列、订单到达时间、撤单延迟和同价位主动成交量。没有这些状态，回测很容易把“价格碰到过”错误地当成“我成交了”。

![K 线触价与 maker 真正成交的对照](/images/narrowgate/touch-vs-fill-kline.svg)

*机制图：两段 K 线都碰到同一条 maker bid；左边前方队列没有被主动卖单耗尽，所以只有 touch、没有 fill，右边主动量穿透 queue ahead 后才轮到自己的订单。固定期限 $P(\text{touch})$ 不能直接当成 $P(\text{fill})$ 或 execution-arrival intensity。图为合成示意，不是实盘证据。*

因此 K 线在这里是价格路径的可视化，不是成交判定器。真正的 fill 还要求订单已经 active、主动成交方向与价格能够穿过我方报价、前方数量被消耗，并且订单没有在 cancel ACK 或 full fill 后离开风险集。

简化后的 queue/fill 逻辑可以写成：

![NarrowGate maker order lifecycle](/images/narrowgate/order-lifecycle.svg)

```python
def process_aggressive_trade(order, trade):
    if not order.is_live:
        return None

    # BUY maker order fills only when sell aggressor trades at or below bid.
    # SELL maker order fills only when buy aggressor trades at or above ask.
    if not trade.crosses(order.side, order.price):
        return None

    remaining = trade.qty

    # Visible queue ahead must be consumed before our order can fill.
    eaten = min(order.queue_left, remaining)
    order.queue_left -= eaten
    remaining -= eaten

    if remaining <= 0:
        return None

    fill_qty = min(order.remaining_qty, remaining)
    order.remaining_qty -= fill_qty

    return Fill(side=order.side, price=order.price, qty=fill_qty)
```

成交后再按 maker 方向计算 markout：

$$
\operatorname{markout}_{\text{buy}}(h)
=\operatorname{mid}(t+h)-p_{\text{fill}}
$$

$$
\operatorname{markout}_{\text{sell}}(h)
=p_{\text{fill}}-\operatorname{mid}(t+h)
$$

这是从成交价起算的完整价格 markout。令 $s=+1$ 表示买入、$s=-1$ 表示卖出，则

$$
s(m_{t_f+h}-p_f)=s(m_{t_f}-p_f)+s(m_{t_f+h}-m_{t_f}).
$$

右侧分别是成交时相对中价的价格优势与成交后的中价变化。正 markout 只表示未来估值相对成交价仍有正价格优势，不单独证明后续中价方向有利。例如合成买入价99.90、成交时中价100.00、未来中价99.95：完整价格 markout 为+0.05，后续中价变化却为−0.05。价格差乘成交数量才成为毛货币价值；markout 仍不是完整库存生命周期或账户净 PnL。

### 1.3 参数映射：量纲正确，不等于经济期限已经对齐

AS 公式里的几个参数在代码里有非常具体的含义：

| 参数 / 信号 | 代码里的来源 | 对报价的直接影响 | 调参时主要看什么 |
|---|---|---|---|
| `eta_inventory` / `risk_per_order` / `a_spread` | 分别接收的经验系数 | 当前 Python 核心以 `eta_inventory` 构造库存系数、以 `risk_per_order` 构造基础价差；`a_spread` 独立接收、验证和记录，不能按名称推断其直接进入该公式 | 库存时间暴露、单位一致性、实际消费者 |
| `sigma_sq` | 已完成 bar 的绝对价格变化方差，单位为 `(USDC/BTC)^2/s`；可按配置与同单位预测混合 | 乘 `risk_horizon_s` 后进入 reservation/spread | lookback × risk horizon × coefficient 的配对 replay |
| P3 触达概率距离斜率 | 10s same-side-BBO 触达概率曲线的局部 log slope | 在启用触达投影时参与双边价差下限与距离斜率投影；不是成交到达强度斜率 | touch calibration 与真实 fill/queue/lifecycle 分开报告 |
| 深度流动性倍率 | top-N 平均深度相对 `depth_liquidity_baseline` 的有界乘数 | `use_depth_liquidity_scaling` 控制报价距离衰减系数的缩放 | depth bucket sensitivity；不是成交强度的拟合 |
| `dir_10s` | 合同允许的方向概率 | 按配置影响库存风险系数、中心偏移或不对称；不是无条件全部启用 | 方向分桶 markout、库存是否被方向信号放大 |
| `ret_10s` | 合同允许的未来收益预测 | 收益动作兼容检查通过且相应消费者启用后，按系数、库存状态与限幅作用于中心 | 逐侧 markout、实际动作差异 |
| `tox_bid/ask` | LightGBM 逐侧 toxicity | side adverse widen / shrink / pause | toxic bucket realized markout、false pause rate |
| markout EMA | fill 后 maker-signed markout | markout spread scale、hybrid pause latch | pause 时长、恢复后 fill markout |

先把本文经常混在一起的时钟拆开：

| 时钟 | 当前/历史口径 | 含义 |
|---|---:|---|
| variance lookback | `60 × 1s` completed bars | 估计每秒绝对价格方差；这个计算在量纲上成立 |
| variance risk integration | `risk_horizon_s` | 当前核心的方差风险积分期限，不等于 `quote_horizon_s` 或实际订单寿命 |
| quote check interval | 按所选运行配置 | 重新考虑目标报价的间隔，不保证撤单重挂 |
| actual order residence | 从经济生效到成交、撤单生效、到期或其他终态 | 由真实订单路径决定，不是固定检查间隔 |
| F02 P3 label | 固定 `10s` | touch opportunity 的标签期限，不是订单 TTL 或 fill horizon |
| replace throttling | 目标价相对现有订单价的差异及时间条件 | 普通/reducing 按风险角色选择，不是买/卖分组；还受 force_update、pending 和订单状态约束 |
| cancel request / effective / ACK | 分别记录 | 请求发送、交易所经济生效、本机确认可见是不同时间；未收到 ACK 不证明订单仍可成交 |
| 库存生命周期 horizon | 可跨多次 requote、甚至跨 UTC 日 | 库存风险与 已结束库存生命周期 value 的经济期限 |

这些时钟需要分别核验，不能由检查间隔推断订单寿命，也不能把工程风险期限直接等同论文的 $T-t$。回放中某个固定延迟字段为零，不表示所选异步网关、延迟样本及事件可见性路径都没有延迟。

报价核心入口是 `compute_quote_core(state, cfg, pred, depth)`。`state` 提供市场与库存状态，`cfg` 提供明确单位的报价参数，`pred` 提供预测，`depth` 提供盘口数量。函数返回候选买卖价和诊断量，不负责发送订单。库存中心项使用归一化库存与 `eta_inventory`；基础价差消费 `risk_per_order`、`risk_horizon_s` 及有效报价距离斜率。weighted-mid proxy、模型收益偏移、深度流动性倍率和触达投影分别受自己的合同、参数与开关控制。

再往后才是逐侧 policy：

```python
if tox_bid >= adverse_toxicity_threshold:
    bid_policy.spread_mult = max(bid_policy.spread_mult, adverse_spread_mult)
    bid_policy.size_mult = min(bid_policy.size_mult, 0.70)
    bid_policy.allow_exposure_increase = False

if bid_side_adverse_pause:
    bid_policy.allow_post = False
```

所以机器学习不是直接“预测价格然后下单”。它有三类入口：

1. **改变物理 quote**：`vol_10s`、`ret_10s`、`dir_10s` 影响 reservation、spread、asymmetry；
2. **改变 policy gate**：`tox_bid/ask`、markout EMA、weighted-mid proxy shift 影响 widen/shrink/pause；
3. **改变风险读法**：quote EV 与 offline/historical-shadow calibration 不直接替代 AS，而是判断某一侧 quote 是否值得继续提供流动性。

实操调参时，不应该先问“哪个 `gamma` PnL 最高”，而应该按顺序看：

```text
1. spread/cap sanity：spread<100、cap hit、final spread distribution
2. execution sanity：placed orders/day、fills/day、fills/order
3. adverse sanity：1s/5s/30s maker-signed markout by side
4. inventory sanity：abs inventory-time、InvAdj、pnl per inventory-hour
5. calibration sanity：toxicity / quote EV bucket 是否和 realized markout 对齐
```

如果一个参数组合 raw PnL 更高，但靠库存时间暴露翻倍换来，或者只在 cap_hit 很高的状态下好看，它就不是更稳的参数。

<span id="1-4-Side-Policy-的逐侧-pause：高波动先-widening，信息冲击才-pause"></span>

### 1.4 Side Policy 的逐侧加宽与暂停

很多人一听到 “pause” 会理解成：市场波动大，所以不挂单。这个理解不够精确。

加宽与暂停是不同控制动作。波动、价差上限、数据有效性、库存及逐侧保护都可能影响参与资格；例如 `pause_exposure` 可因所需价差超过配置边界阻断增险，并不要求先证明信息冲击或净动作价值为负。暂停可能减少正常成交机会，其经济影响仍需完整路径比较。

核心判断可以写成人话：

- **widen**：这一侧可能更危险，但还可以用更差的价格提供流动性；
- **pause**：某项已启用规则暂时不允许参与，不等于已经识别出负净价值；
- **cooldown**：市场刚打过这一侧，短时间内不急着恢复；
- **decay**：如果很久没有新证据，旧的 adverse 不能永久锁死策略。

maker 的这条 markout EMA 消费绝对价格差，不是 bps。以下是对应 hybrid latch 的机制示意，不替代完整函数中的准入检查：

```python
def update_side_pause(now, resolved_markout_price, state):
    dt = now - state.last_update_ts
    if state.tau_s > 0 and state.last_update_ts > 0 and dt > 0:
        state.markout_ema *= math.exp(-dt / state.tau_s)
    state.last_update_ts = now
    if resolved_markout_price is not None:
        state.markout_ema = (
            state.alpha * resolved_markout_price
            + (1.0 - state.alpha) * state.markout_ema
        )
        if state.hybrid_enabled and state.adverse_pause_enabled and state.markout_ema < -state.threshold_price:
            ttl = clamp(state.base_pause_s * abs(state.markout_ema) / state.threshold_price,
                        state.min_pause_s, state.max_pause_s)
            state.pause_until = max(state.pause_until, now + ttl)
    return (state.hybrid_enabled and state.markout_ema < -state.threshold_price
            and now < state.pause_until)
```

在策略层面还要区分“增加库存风险的一侧”和“降低库存风险的一侧”：

```python
def is_exposure_increasing(side, inventory, quantity):
    signed_qty = quantity if side == "bid" else -quantity

    if inventory == 0.0 or inventory * signed_qty >= 0.0:
        return True                  # 开仓或同向加仓
    if abs(signed_qty) <= abs(inventory):
        return False                 # partial close 或 exact close
    return True                      # 穿越零点后的 remainder 会反向开仓
```

Adverse 保护主要约束增加风险的一侧；defense 是针对减仓方向的另一套可选控制，结合 markout、已配置方向条件，并包含库存/损失紧急状态例外。Local-extreme 是独立机制，由 `evaluate_common_side_policy()` 分别处理，不能用一段“非减仓方向禁止”的伪代码代替 defense。退出紧迫度、执行安全与各保护规则的优先级以所选消费者为准。

`max_spread_bps` 只有在 `pause_exposure` 模式下才是负向风险闩：风险要求的点差超过边界时，停止 exposure-increasing quote。历史 `compress` 会把风险要求的宽报价向内压，因此不能称为 safety cap；它只允许作为显式研究 arm，不能成为公开或 mechanics-safety successor 的默认值。exact close 与 partial reduce 不应承受 adverse widening 或 size reduction；穿越零点的成交则必须拆成 closing leg 与 opening leg。

订单账本也不能依赖请求时间附近的 fudge window。成交累计量必须 finite、非负、单调且不超过订单量；terminal 后到达的更高累计成交仍要精确补记新增部分。REST snapshot reconciliation 使用 trade/order identity、累计成交量与 exchange snapshot cursor 做幂等证明，无法证明时 fail closed。

因此，风险或执行安全规则、市场预测、动作净价值估计必须分别解释。触发暂停既不是盈利证明，也不单独证明被挡机会有毒；不能据此认定某项保护造成某次亏损。

修复前的 adverse threshold 网格、参数折中和 PnL 排名不构成有效研究证据。它们暴露出的 replay/live 机制问题仍值得保留：

- markout EMA 曾经可能在坏日、长 gap 或行情静默后形成 latch，导致一侧长期 pause；
- fill cooldown 曾经会挡住减库存方向，风险降低订单也被误杀；
- `thin_depth` 阈值一度按过高的 depth baseline 解释 BTCUSDC，导致 defense reason 常驻；
- SYNC_ADJUST 的 hard degrade 曾经过敏，一次 sync discrepancy 就可能触发 120 秒降级；
- fills/day 的分母在不同报告里混用了 full calendar day、quality day 和 active-trade day；
- native sweep 在若干 policy 细节未对齐前不能用于选参。

保留下来的只有机制层约束：

```python
# 旧 adverse 证据必须随 wall-clock 衰减，不能跨坏日/长 gap 永久生效。
markout_ema *= exp(-dt / tau_s)

# 此处仅描述 fill cooldown 的增险分支，不概括 defense 等其他暂停规则。
if fill_cd_active and exposure_increasing(side, inventory):
    allow_exposure_increase = False
```

这也是后面所有 alpha 搜索重新开始的原因。我们不再问“哪个 adverse 阈值最优”，而是先问：

1. replay 挂单数量是否和 live 同数量级；
2. fills/hour、bid/ask split、spread、block reason 是否能对齐；
3. fill selection 和 maker-signed markout 是否在 OOS 日段保持稳定；
4. 通过这些机制 gate 后，再谈某个 policy 是否有 alpha。

#### 固定 fill cooldown 不是理论终点

固定 41 秒或 85 秒的 add-side `fill_cooldown` 可以作为控制臂，但文献并没有给出一个跨波动、流持续性、库存和 库存生命周期 状态都最优的全局秒数。Avellaneda-Stoikov 的库存项首先支持的是 reservation-center shift：

$$
r_t=S_t-q_t\gamma\sigma_t^2\tau_t.
$$

它在 pair spread 不变时把加仓侧推远、减仓侧拉近。GLFT 的库存约束解进一步支持 bid/ask 距离随状态变化，而不是成交后整侧机械消失。Jusselin 的 persistent-order-flow/Hawkes 模型则说明，刚发生的 fill 会改变后续同向流强度；真正该衰减的是 order-flow excitation，时间常数应来自 response kernel 或 $t_{1/2}=\log 2/\beta$，而不是先写死在 YAML 里。

因此下一代 post-fill 报价被拆成两个正交量。设库存符号 $z_t=\operatorname{sign}(q_t)$、baseline center 为 $m_t$、half-spread 为 $h_t$：

$$
c_t=m_t-z_t\left(I_t+\frac{A_t}{2}\right),
\qquad
\tilde h_t=h_t+\frac{A_t}{2}.
$$

- $I_t$ 是库存压力：只平移 center，pair spread 不变；
- $A_t$ 是成交后 persistent/toxic flow 防守：只增加 add-side distance；
- reducing quote 不含 $A_t$，不能因为防止继续加仓而破坏自然 repair。

对 long 库存生命周期，`BUY add distance = h + I + A`，`SELL reduce distance = h - I`；short 库存生命周期 镜像。这样“保持总 spread、整体偏移”和“只算这一侧 spread 并放大”不再是互斥的口头方案，而是同一个可审计分解中的两个不同经济机制。第一轮只应比较 current cooldown、shift-only、add-widen-only、hybrid 四类小 arm，并保持 order size 与 inventory limit 不变。

它们使用旧 feature-ready 时间、event clock、P3/queue identity 或被反复查看的验证面板，不能继续判断 cooldown、inventory shift 或 post-fill widening 的价值。上面的 $I_t/A_t$ 分解仅保留为可检验的机制假设；任何新 action 必须在当前 causal replay 中以已知 propensity、完整 queue/latency/inventory_lifecycle path 和 family-specific sealed holdout 重新识别。

理论来源：[Avellaneda-Stoikov, *High-frequency trading in a limit order book*](https://people.orie.cornell.edu/sfs33/LimitOrderBook.pdf)、[Guéant-Lehalle-Fernandez-Tapia, *Dealing with the Inventory Risk. A solution to the market making problem*](https://arxiv.org/abs/1105.3115)、[Jusselin, *Optimal market making with persistent order flow*](https://arxiv.org/abs/2003.05958)。

这里还有几条必须写清的引用边界。仓库中的 size-weighted BBO 只是 weighted-mid proxy；[Stoikov 的 *The Micro-Price: A High Frequency Estimator of Future Prices*](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2970694) 用状态转移来估计未来价格的条件期望，不能用来把这个加权中价直接命名为 micro-price estimator。Gatheral-Oomen 2010 的正确题名是 [*Zero-intelligence realized variance estimation*](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=970358)；它研究 realized-variance estimation，不是该 helper 的直接来源。[*The Price of Immediacy*](https://www.hbs.edu/ris/Publication%20Files/The%20Price%20of%20Immediacy_79d652de-afcd-41cb-b574-cd5f4d59a565.pdf) 是 Chacko、Jurek、Stafford 的另一篇论文，不能混写。Zhao-Linetsky 2021 的 [*High Frequency Automated Market Making Algorithms with Adverse Selection Risk Control via Reinforcement Learning*](https://doi.org/10.1145/3490354.3494398) 中，BER 指 book-exhaustion rate；项目现有 `trade_intensity_acceleration_*` 状态没有计算订单簿耗尽，它实际是 trade-intensity acceleration guard，因此 BER 论文只能作为对照，不是该特征的理论证明。另外，Milionis 等人的 [*Automated Market Making and Loss-Versus-Rebalancing*](https://arxiv.org/abs/2208.06046) 研究对象是 CFMM/AMM 的 stale-price loss；它最多启发“应检查波动敏感性”，并不推出 CLOB 的 `vol_power=1.5`，更不证明任何 exponent 最优。

参数比较需要固定 P3、cap、guard、cooldown、queue、latency 和模型输入，并报告完整路径指标。当前 Python 基础价差消费 `risk_per_order`，库存项以 `eta_inventory` 构造有效系数；只按最终 PnL 排名不能识别哪个机制带来差异。

### 1.5 三种“斜率”不能合并：execution、touch 与 depth

Avellaneda-Stoikov 给了一个非常有用的坐标系：

$$
r_t = S_t - q_t \gamma \sigma_t^2 (T-t)
$$

$$
\lambda_{\mathrm{exec}}(\delta)=A e^{-k_{\mathrm{exec}}\delta},
\qquad
\delta^\ast \approx \frac{1}{\gamma}\log\!\left(1+\frac{\gamma}{k_{\mathrm{exec}}}\right).
$$

但真正困难的是右边这些变量如何变成实时市场状态，而不是公式本身。

这个式子里的 `k_exec` 是“成交订单到达强度随报价距离的衰减斜率”。而 F02 估计的是固定 10 秒标签窗口内的 touch probability：

$$
P_{\mathrm{touch}}(\delta,x)
=P(\tau_{\mathrm{touch}}\le 10\mathrm{s}\mid\delta,x),
\qquad
k_{\mathrm{touch}}=-\partial_\delta\log P_{\mathrm{touch}}(\delta,x).
$$

`k_touch` 不包含 queue conversion、最终 fill、cancel/replace 或 TTL lifecycle，所以不能写成 `k_exec`。深度流动性倍率又是另一件事：它根据近端平均深度相对 baseline 缩放报价距离衰减系数，本质是无量纲的 liquidity multiplier，不是从 `lambda_exec(delta)` 标定出的斜率。

`validate_p3_touch_identity()` 核对触达统计的距离单位、期限和原点。报价核心使用触达斜率投影时，将距离衰减来源记为 `p3_touch_slope_projection`。投影是报价控制中的一种使用方式，不是成交强度估计。当市场发生信息冲击时，远端 quote 的 touch/fill 关系也可能偏离单一指数曲线。toxicity 则进入逐侧 policy：

```python
if toxicity >= toxicity_threshold:
    side_policy.spread_mult = max(side_policy.spread_mult, widen_mult)
    side_policy.size_mult = min(side_policy.size_mult, shrink_mult)
    side_policy.allow_exposure_increase = False

if side_adverse_pause:
    side_policy.allow_post = False
```

也就是说，这条实现更像：

$$
\text{toxicity} \rightarrow
\{\text{widen}, \text{shrink}, \text{pause}\}
$$

而不是：

$$
\text{toxicity} \rightarrow
\kappa_{\text{eff}} \rightarrow \delta^\ast
$$

若要校准 AS/GLFT 坐标系，需要直接估计距离与成交到达强度的关系，纳入排队、撤改单、TTL、逆向选择、参考市场冲击与延迟，并验证按时间隔离的回放和动作价值。目前的触达统计不能完成这项校准。

### 1.6 第一场真正的麻烦来自数据，而不是模型

项目的数据主要来自三类来源：

- Binance Vision 的 aggTrades/trades、metrics，以及后续补充的 spot 数据；
- CryptoHFTData 的原生 orderbook 数据，用于重建 BBO 和 top-N L2。
- Bitget、Bybit、OKX 的历史 trades 与 public WebSocket BBO/trades，用于独立 venue shadow。

早期曾接入 Binance Vision 的 `bookDepth` 百分比桶，但它不是逐价 L2，也无法支持 queue 或 event-level replay。它只作为历史踩坑被本文提及，不再属于当前数据 manifest 或任何正式训练/回放入口。

最开始很容易产生一种错觉：文件存在，就代表这一小时的数据可用。实际并不是这样。CryptoHFTData 中出现过两种更隐蔽的问题：

1. 某些小时文件直接缺失；
2. 文件存在，但内部缺少足够的 orderbook snapshot，无法重建可靠的盘口状态。

如果这些日期继续进入训练和回测，问题不只是一段时间“没有成交”。maker 的 order lifetime 可能很短，日与日之间离散本身未必严重；真正危险的是 rolling feature 或未来 label 跨过了坏日期和长 gap。

例如一个 30 秒 markout label，如果第 30 秒对应的价格来自长时间缺口之后，那么这个 label 在数学上有值，在市场含义上却已经失效。rolling volatility、taker tempo、cross-market return 也可能把两个不连续的市场状态拼在一起。

因此后来做了三层修正。

#### 1.6.1 审计结果成为硬边界

orderbook audit 中不可用或低 coverage 的日期不再只是报告里的警告，而是进入统一的 `data_quality.py`。训练、回测、quote trace、shock audit 和 quote EV 都必须二次过滤，不能依赖某一个上游脚本“碰巧已经删过”。

#### 1.6.2 物理数据也同步清理

坏日期对应的 CryptoHFTData 和 Binance raw 数据被物理删除。由于跨日压缩包可能混合好日期与坏日期，不能只在聚合容器里删掉某一天，所以改为：

1. 删除覆盖坏日期的非日度 aggTrades 容器；
2. 从 Binance Vision 按日重新下载 retained good days；
3. 验证坏日期日度文件命中为 0，非日度容器残留为 0。

这样既避免磁盘继续保留不可用数据，也让物理层和逻辑层使用同一份质量边界。2026-06-06 的清理先把覆盖坏日期的非日度 `aggTrades` 容器删掉，再用 Binance Vision daily 文件回填 retained good days；2026-06-28 的粒度清理进一步把 parquet 容器收敛到 `YYYY-MM-DD` 日文件。

这里还有一个很容易误解的点：**物理文件粒度也会反过来诱导研究口径**。一开始我以为“只要逻辑层按天切 replay，底层保留少量跨日容器也没关系”，但这会让后续脚本、文档和人脑都不断滑回跨日聚合分析。后来我把本地 market data 重新扫了一遍，并把剩余非日度容器全部清掉：

| 数据 | 当前物理粒度 | 对研究口径的影响 |
|---|---|---|
| Binance raw trades / aggTrades | retained daily CSV | 可以直接按 UTC day 切 replay 和 flow |
| CryptoHFTData 重放后的 BBO/L2 | daily parquet | tick replay、queue ahead、weighted-mid proxy 的主执行口径 |
| raw metrics / 5m metrics | daily CSV + daily parquet | OI/多空比按 UTC day join，不再依赖非日度 metrics parquet |
| engineered features | `features_YYYY-MM-DD.parquet` | 训练 dataset 是日文件拼接结果，不再从月 feature 容器读取 |

2026-07-18 又把盘口时间分辨率拆成两种明确身份。旧 retained `bbo/l2` 大约每个 UTC day 86,400 个状态，适合 baseline replay，但不足以回答 10-100ms shock、depletion、refill、recovery、keep/cancel。新的 event-L2 研究把 Binance individual trades 与 CryptoHFTData price-level snapshot/delta events 合并，在 100ms grid 输出 top-20。它不做线性插值，也不把 `aggTrades` 当成逐笔撮合。

原始第三方文件有时从 delta 开始而没有完整 snapshot，因此 artifact 必须记录两种不同身份：

| Event-L2 identity | 初始化 | 允许用途 |
|---|---|---|
| `snapshot` | native complete snapshot + 严格 sequence continuation | strict top-N reconstruction 与 source-valid queue study |
| `delta-converged` | 空簿从首个可连续 delta anchor 开始，带显式 burn-in | 验证后的 top-20 path feature |

truth-set 对照中，07-03/07-12 的 BBO 均 100% exact，全部 80 个 top-20 字段分别为 99.99696%/100% exact；但这只验证 local top-20 path，不验证离 touch 数百 ticks 的真实 deep queue、隐藏流动性或自己前方撤单位置。event-L2 action panel 还必须逐日通过 24/24 小时、500ms freshness coverage、正 spread、sequence、时间单调和真实 snapshot/delta anchor gate。

后来我又犯过一次很典型的错误：以为“目录里只要大体都是日文件就够了”。实际重新扫 `${NARROWGATE_DATA_ROOT}` 后，仍能在 `raw`、`bars_1s`、`bbo/l2`、`raw_trades/trade_features` 和 metrics 层看到坏日残留。这个问题在 2026-07-01 又做了一次 cross-source hard-exclude 清理：以 `data_quality.COMPLETE_DATA_POLICY.excluded_orderbook_days("BTCUSDC")` 的 152 个 UTC day 为准，删除命中坏日期的 raw / BBO / L2 / bars / depth / metrics / trade feature 文件 664 个，约 1.738GB，二次扫描坏日期残留为 0。

这个结果也修正了“最小有限子集”的说法：物理层不应该保留坏日，也不应该保留跨坏日的非日度容器；但质量合格的日度好日仍然可以作为 OOS/research pool 保留，不需要裁成一个过小、固定、容易过拟合的子集。某一天是否进入训练、replay 或 promotion evidence，由 retained daily universe 和 `data_quality.py` 的逻辑过滤决定。

2026-06-28 与 2026-07-01 的最终口径是：`${NARROWGATE_DATA_ROOT}` 下策略相关行情容器按 UTC day 组织，坏日期物理残留为 0。2026-07-05 又做了一次更硬的边界收束：本地 2025 市场数据全部从当前研究面板删除，BTCUSDT raw trades 只保留与 BTCUSDC core layers 同时完备的 111 个 2026 good days，其余 reference-only 日期被删除。它看起来像清理磁盘，其实是清理研究边界：**物理容器和策略结论都默认按 UTC day 组织，并且 reference 数据不能比 execution universe 更宽**。

这个清理还同步到了代码仓库边界：旧远端 `main` 曾经是 BTCUSDT 执行项目，当前维护分支只保留 BTCUSDC 执行研究；BTCUSDT 退回为 reference/source 数据，不再作为同仓库内的第二个执行交易对。这样做不是否定 BTCUSDT 的信息价值，而是避免“执行标的”和“参考标的”在代码、模型、数据 manifest 和文档里互相污染。

这里还要区分“某一层数据已经到达”和“完整训练/回测链路已经可用”。2026-07-02 早上检查时，CryptoHFTData 的 2026-07-01 exact L2 已经可下载，但 Binance Vision 的 execution/reference 层还没有同时到达，因此当时只能说 **exact L2 层可用**。到 2026-07-10，`2026-07-04` 已按同一口径补齐 futures/spot trades、metrics、exact L2/BBO、1s bars 与 enhanced features，并重新进入 parity/smoke 窗口。这个例子说明补数不能按“某个 URL 返回 200”判断完成：BTCUSDC execution、BTCUSDT reference、spot anchors、BBO/L2 和 features 必须一起通过 good-day manifest，否则整天排除。

新的核心入口也因此改成：

```bash
.venv/bin/python models/backtest_tick.py --symbol BTCUSDC --day 2026-05-15 --ml --engine python
.venv/bin/python models/tick_ab.py adaptive_ttl --symbol BTCUSDC --days 2026-05-15 2026-05-16 --engine python
.venv/bin/python models/quote_decomposition_tick.py --symbol BTCUSDC --days 2026-05-15 2026-05-16 --engine cpp
.venv/bin/python models/cross_market_shock_audit.py --symbol BTCUSDC --trace-tag daily_trace --days 2026-05-15 2026-05-16
.venv/bin/python -m models.audit.runner --symbol BTCUSDC --reports order_level,inventory_lifecycle_labels,order_level_score_audit
```

旧的无合同跨日聚合入口不再作为研究主口径或 promotion 证据；2026-08-03 新增的 versioned continuous/restart-aware substrate 只允许在显式 calendar manifest、restart boundary、state carry 与 accounting identity 下运行，而且权威 tick-runner binding 仍 fail-closed。C++ replay 已覆盖 queue calibration、replace throttle/`action=keep`、pending coalesce、reducing/adaptive cooldown、库存生命周期 soft control 与历史 BUY fill-selection，因此可以在**当前解析出的 baseline identity**通过 parity 后做宽参数 fast screening。Python 仍是 reference implementation，并继续负责逐样本 empirical REST latency、archived xmarket diagnostic、live-only sync/user-stream 故障语义，以及 survivor 的完整 库存生命周期 evidence。长窗口 replay 最危险的地方不是“统计时间更长”，而是 adverse/defense/markout EMA 这类状态会跨坏日和长 gap 延续，把一个早期毒性状态扩散成后面几天的假性停报。

但这里有一个 live 风险边界不能被日度 fresh-start 掩盖：正式 retained-day replay 默认每天冷启动；如果真实 live 在好日/坏日边界还有持仓，研究口径会在 segment 末尾 mark-to-market 后从下一个 retained day 重新开始，不会模拟带仓穿过坏日的路径。这个设计能避免坏数据污染 label，却不能回答“实盘持仓穿越数据坏日怎么办”。因此 session/live policy 仍需要单独的 boundary inventory audit 或 continuous replay 诊断。

#### 1.6.3 rolling 与 label 使用同一套连续段定义

项目增加了统一的：

```python
continuous_segment_ids(index, max_gap_s=5)
mask_valid_horizon(index, horizon_s, max_gap_s=5)
```

这两个函数不是简单的 `dropna`。连续段要同时切断无效时间戳、时间倒退和超长间隔；future label 则先用 `searchsorted` 找到目标 horizon 的第一条观测，再验证它仍处于同一 segment，并且没有晚于目标太多。当前 Python fallback 的核心逻辑如下（省略时间戳类型兼容代码）：

```python
def continuous_segment_ids(index_like, max_gap_s=5.0):
    ts = _coerce_utc_timestamps(index_like)
    ns = ts.view("int64")
    invalid = np.asarray(ts.isna(), dtype=bool)

    breaks = np.zeros(len(ts), dtype=bool)
    breaks[0] = True
    if len(ts) > 1:
        delta = ns[1:].astype(float) - ns[:-1].astype(float)
        breaks[1:] = (
            invalid[:-1]
            | invalid[1:]
            | (delta < 0.0)
            | (delta > max_gap_s * 1e9)
        )
    return np.cumsum(breaks, dtype=np.int64) - 1


def mask_valid_horizon(index_like, horizon_s, max_gap_s=5.0):
    ts = _coerce_utc_timestamps(index_like)
    ns = ts.view("int64")
    segments = continuous_segment_ids(ts, max_gap_s)

    target_ns = ns.astype(float) + horizon_s * 1e9
    future_idx = np.searchsorted(ns, target_ns, side="left")
    valid = (~ts.isna()) & (future_idx < len(ts))

    rows = np.flatnonzero(valid)
    future = future_idx[rows]
    valid[rows] = (
        (segments[future] == segments[rows])
        & ((ns[future] - target_ns[rows]) <= max_gap_s * 1e9)
    )
    return valid
```

rolling feature 则按 segment 分组后再滚动，而不是算完 rolling 再把坏日期删掉：

```python
segment = continuous_segment_ids(frame.index, max_gap_s=5)
frame["ret_std_60s"] = (
    frame.groupby(segment, sort=False)["log_ret"]
         .rolling(60, min_periods=20)
         .std()
         .reset_index(level=0, drop=True)
)

valid_30s = mask_valid_horizon(frame.index, horizon_s=30, max_gap_s=5)
labels.loc[~valid_30s, "markout_30s"] = np.nan
```

在时间戳全部有效时，同一语义可以走更快的实现；有非法值时必须保留 fallback 和显式报错，避免快路径为了性能吞掉数据异常。

`feature_engineer.py`、`cross_market_shock_audit.py` 和 `train_quote_ev.py` 共用同一口径。rolling feature 只在连续 segment 内计算，未来 horizon 跨 gap 时 label 直接失效。

这件事看起来不像模型升级，但它比多加几十个 feature 更重要。一个更复杂的模型只会更擅长拟合被污染的数据。

到这里，项目的研究顺序也被迫改变了：不是先训练一个更大的模型，再在结果异常时检查数据；而是先证明每个 feature 和 label 都来自连续、可用的市场片段，然后才允许它进入训练和回放。对于订单生命周期很短的 maker 来说，日与日之间不连续未必有问题，**跨越不连续边界计算 rolling 或 future horizon 才是问题**。

### 1.7 为什么加入 BTCUSDT 和 spot 后，结果反而更差

BTCUSDC 的本地成交和盘口并不是孤立市场。项目先加入 BTCUSDT perpetual 作为 reference，后来又重建 enhanced spot features：

```text
cv_ref_perp_*
cv_exec_spot_*
cv_ref_spot_*
```

从直觉上说，多一个高流动性的 reference、多两个 spot anchor，算法应该更健壮。数据也确实带来了信息：cross-market shock audit 显示，很多 adverse fill 能被 BTCUSDT reference move 解释；spot anchor 补齐后，很多窗口的数据可用性也明显改善。

但“数据有信息”不等于“把开关打开就能形成正 EV”。早期 `multi_market.enabled=true/false`、enhanced spot、xmarket widen/retreat、reference favorable/adverse bucket、local-flow interaction、calendar/session bucket 都做过复验，详细旧数值现在从正文删除，只保留结论：

- `multi_market.enabled` 只能表示 reference / spot source wiring，不是收益开关；
- direct xmarket widen / pause / TTL / size policy 没有通过按日隔离 validation 和 库存生命周期 gate；
- reference confirmed adverse 更稳定地表现为 risk label；
- reference favorable 或 spot-unconfirmed 偶尔出现正向线索，但样本和日度稳定性不足；
- 新增 source 更适合进入 order-level score、库存生命周期 risk 与 quote-EV offline calibration，而不是直接改报价或新建 live shadow。

这不是说明 reference 无效，而是说明原来的使用形态太粗。真正有价值的问题不是“要不要开 BTCUSDT reference”，而是：

```text
ref move 里还有多少没有被 BTCUSDC 本地盘口吸收？
这个残差是在提示信息冲击，还是提示可吸收的流动性扰动？
它应该改变 fair value / inventory_lifecycle risk / replace urgency，还是根本不该动？
```

所以后续 xmarket 的方向已经从旧布尔开关转成三类更细的研究：

1. **pending reference residual / re-center**：用 `ref_move - local_move` 判断是否有未吸收的短窗重定价，只允许小幅、连续、有界地平移 reservation price；
2. **post-fill 库存生命周期 moderator**：在成交之后，用 fill-time reference 状态调节 库存生命周期 risk，而不是在 submit-time 做稀有二值 cancel；
3. **risk label / calibration feature**：让 reference/spot 帮助模型识别 toxic fill、repair probability 和 terminal 库存生命周期 risk。

换句话说，新增数据提高的是可分辨性，不是自动提供一条单调收益规则。

### 1.8 多市场 reference：历史 receive-time 诊断层与权限边界

历史运行曾将 Binance 本地 bridge 与 Bitget、Bybit、OKX 的 spot/perpetual public WebSocket 接入 venue-aware 状态层，并记录 `exchange_event_ts`、`local_receive_ts` 与 `feature_ready_ts`。那一身份中的外部源只参与只读 reference tape 和 global-flow state，不拥有交易权限，也不会绕过 Binance 本地风险门控。后来某个冻结 no-shadow 运维快照关闭了 external、Flow、Ref 与全部 shadow；这是带时间戳的历史事实，不是对当前 EC2 进程的公开声明。

那批结果无法识别亚秒 lead-lag，也不能在修复前 feature/replay identity 下证明 re-center、cancel、stop-add 或 库存生命周期 moderator 的 action value。

若未来重开这类离线研究，边界仍是按 `feature_ready_ts <= decision_ts` 合并已冻结的 receive-time BBO/trade tape，构造 10/25/50/100/250/500ms 的 aggressive flow、agreement、OFI/depletion/refill 与 freshness；先比较 local-only M0 和 external M1 对 fill toxicity、queue value 与 库存生命周期 outcome 的增量。只有增量通过 chronological split、leave-one-venue-out、latency stress 和 family-specific sealed holdout，并获得新的显式授权，才允许创建有界 action family；某个历史快照中的开关状态本身不构成新研究结论。

因此，多市场数据在这些历史实验中只是诊断输入，不是 quote alpha。接入更多 venue 曾提高 shock attribution 和反证能力，但不会自动产生一条可执行的价格平均规则；它们此刻是否进入私有运行进程，不在公开证据的可回答范围内。

### 1.9 报价机会的成交质量建模

为了避免把 cross-market 信息硬编码成一个布尔开关，项目又训练了逐侧 quote EV 模型。它不直接预测 BTC 下一秒涨跌，而是分别估计：

- `P(fill)`；
- fill 后 1s/5s/30s markout bucket；
- extreme adverse probability；
- reference/spot/local-flow 对冲击性质的确认。

这里要区分模型 ABI 与 evidence table：`20s` markout 仍可以作为 order-level/inventory_lifecycle 审计 label，但不属于当前 canonical Quote-EV runtime heads；库存生命周期-level repair / tail risk 也由下游 库存生命周期 score 消费 quote-time/fill-time evidence，不是 `QuoteEVModel` 直接输出的 head。

早期 enhanced spot、逐侧 quote EV、xmarket 与 local-flow interaction 的方向性结果不构成有效研究证据。旧 trace、旧 label universe 与修复前 replay 不能为这些路线提供正向或负向先验；若继续研究，必须在当前 causal identity 下重新定义 action family。

当前保留的判断很简单：

- quote EV 只能作为 retained-data offline calibration、order-level score、fill-selection 或 库存生命周期-outcome feature；历史 shadow 只能按原身份解释，不能据此默认新建 live shadow；
- bid/ask 必须 side-specific，不允许用一个“好成交”定义套两侧；
- `P(fill)` 不是 alpha，本身甚至可能是 adverse selection 的强信号；
- 真正要学的是“成交后不像 toxic fill”的条件，以及这个成交所在 库存生命周期 是否更容易自然修复。

这里最容易误解的是样本量。quote rows 可以有几十万甚至上百万，但能监督 `E(markout | fill)` 的只有真实 filled rows。未成交报价能帮助校准 fill probability，却不能直接告诉我们 fill 后的 markout、库存生命周期 terminal PnL 或 repair rate。因此 quote EV 的 promotion gate 必须看 filled-row support、calibration、按日隔离验证、side markout、tail loss、inventory time 和 库存生命周期 outcome，而不能只看一次 raw PnL 改善。

2026-07 之后，quote EV 的方向已经和 inventory_lifecycle/order-level evidence 合流：每一笔 placed order 都带 quote-time state、fill outcome、markout、库存生命周期 label 和 explainable scores。只有这些连续 score 在日级稳定解释 fill quality 与 库存生命周期 outcome，才有资格注册一个新的 offline action family；是否进入真实 randomized canary 或 owner deployment 是另一项显式授权，不能用 candidate-specific shadow 代替。

分桶只解释分数在何种市场结构下有效或失效，不能代替具有完整后续库存路径的动作对照。

### 1.10 Shadow 概念与“不得默认新建研究 shadow”边界

NarrowGate 不应该把 quote EV 直接从回测 A/B 推到 live。下面保留的是 shadow calibration 的历史方法说明：实盘收行情并记录 quote-time state、quote、policy 与 would-place；未来 L2/trades 到达后，再生成 **delayed shadow replay label / delayed would-fill counterfactual**。后者不是决策时刻已知的 live truth，也不是实际订单的交易所 ACK/fill。

截至 2026-08-25 的公开治理记录里，这已不再是新研究候选的默认流程。应先审计未被该 family 消耗的 retained good days、普通 executed-order telemetry、既有 receive-time tapes 与 canonical market data，再用 offline replay 回答 Development 问题；不得为了候选 scorer、counterfactual policy 或缺失字段，默认向 live runtime 新增 observer、companion、sidecar、writer、feature dump 或 hypothetical-action log。既有 q90 shadow 与历史日志只按过去合同解释，不是可复制的模板。只有 owner 对一个精确命名机制重新作出显式授权，才可以另行冻结资源、字段、期限、回滚与 retirement gate。公开文章不用该治理规则反推私有进程的此刻开关。

shadow mode 的核心问题不是“预测收益是多少”，而是：

$$
P_{\text{model}}(\text{fill} \mid \text{quote context})
\quad \text{是否接近} \quad
P_{\text{observed}}(\text{fill} \mid \text{live context})
$$

以及：

$$
E[\text{markout}_{30s} \mid \text{predicted bucket}]
\quad \text{是否和} \quad
\text{realized markout bucket}
\quad \text{同向、同量级}
$$

需要看的不是一个 raw PnL 数字，而是一组校准表：

| Shadow 检查 | 说明 | 如果失败 |
|---|---|---|
| fill probability calibration | 预测的 `P(fill)` 分桶后，真实/可回放 fill rate 是否接近 | quote EV 只能做排序，不能做阈值 |
| realized-vs-pred markout | 高 EV bucket 是否真的有更好 markout | EV label 或 feature 泄漏/错配 |
| placed orders/day | shadow/replay 是否和 live 同数量级 | guard/pause/requote gating 不一致 |
| fills / placed order | 每个挂单的成交概率是否接近 live | queue ahead 或 latency floor 不对 |
| side split | bid/ask fill 是否失衡 | side policy 或库存压力错误 |
| inventory time | 正 edge 是否靠堆库存换来 | 风险调整后不可用 |

实盘里很常见的情况是：回测看起来排到了，live 却因为 latency floor 根本没进入同一个队列位置。这个问题不能用“系统更快”简单解决，因为它通常来自三层延迟：

- 行情到达本机的网络/解码延迟；
- 策略从行情到下单的决策延迟；
- 订单从本机到交易所并 ack 的新单延迟。

因此 shadow mode 需要把 measured new/cancel latency 注入 replay，再比较 live order log 与延迟生成的 replay would-fill：

```python
def shadow_fill_check(event, measured_latency):
    quote = compute_quote(event)
    activation_ts = event.ts + measured_latency.new_order_ms

    replay_fill = replay_queue_fill(
        side=quote.side,
        price=quote.price,
        activation_ts=activation_ts,
        l2=event.future_l2,
        trades=event.future_trades,
    )

    return {
        "pred_fill_prob": quote.ev_fill_prob,
        "would_fill": replay_fill is not None,
        "latency_ms": measured_latency.new_order_ms,
        "queue_ahead": replay_fill.queue_ahead if replay_fill else None,
    }
```

这也是为什么 quote EV promotion 要比普通模型上线更保守。逐侧 quote EV 如果 valid fills 不足，或 calibration/Brier/bucket markout 不过 gate，就只能作为诊断；修复前任何聚合 A/B 的正负方向都不再保留。

这个 delayed label 仍依赖 queue-ahead、cancellation-ahead、latency injection、future L2/trades 完整性与同 timestamp event ordering。它比 bar-touch 诚实，但不能被写成“不发单也观测到了真实 fill”。

> **Shadow 小结**
>
> - quote EV 的关键不是单次 A/B raw PnL，而是 `P(fill)`、markout bucket 和库存时间是否同时校准。
> - shadow mode 要把 live latency floor 和 would-fill replay 放在一起看，否则“回测排到了”不代表实盘有同样队列位置。
新候选必须重新通过样本量、Brier/calibration、bucket realized-vs-pred 和日度稳定性 gate。
> - 这些是解释既有 shadow evidence 的校准要求，不是创建新 live shadow 的授权；新研究默认使用 canonical retained data 与 offline replay。

#### 1.10.1 Promotion gate：方向对还不够，必须校准过关

Shadow mode 不是为了再看一个漂亮 PnL，而是为了回答：

$$
P_{\text{model}}(\text{fill}) \approx P_{\text{observed}}(\text{fill})
$$

以及：

$$
E[\text{markout}\mid \text{predicted bucket}]
\approx
E[\text{realized markout}\mid \text{same bucket}]
$$

实操上我会把 gate 分成四层：

| Gate | 最低要求 | 含义 |
|---|---:|---|
| 样本量 | 每 side validation valid fills `>= 100`，更理想是数百 | 少于这个数，bucket calibration 很容易飘 |
| fill calibration | 分桶 MAE `<= 0.05` | 预测 20% fill 的桶，真实 fill rate 不能长期是 5% 或 50% |
| markout calibration | bucket realized-vs-pred 同向，MAE 不恶化 | 高 EV bucket 至少不能有更差 markout |
| 风险效率 | InvAdj 不差，abs inventory-time 不恶化，fills/day 不塌 | 不能用堆库存换 raw PnL |

这些阈值是 operational fail-fast gates，不是显著性或置信度的替代品。正式 promotion 还应报告 day-clustered bootstrap interval、calibration slope/intercept、Brier 相对 baseline 的增量、daily sign consistency、effective sample size、多 arm selection correction，以及从未参与模型选择的 late-holdout effect interval。100 个 fills 若集中在少数相关 库存生命周期，信息量远小于 100 个独立样本。

当前 direct quote-EV executor 也已移除；新的模型只能从 canonical retained data、offline calibration 与 causal action panel 重新取得证据。除非另有 owner 精确授权，不新建 research-specific live shadow。

一个更像上线前检查表的伪代码是：

```python
def promotion_gate(summary):
    return (
        summary.valid_filled_rows >= 100
        and summary.fill_calibration_mae <= 0.05
        and summary.markout_bucket_direction_ok
        and summary.inv_adj_delta >= -small_tolerance
        and summary.abs_inventory_time_delta <= 0
        and summary.daily_rollup_stability_ok
    )
```

这不是说阈值永远不变，而是说必须有硬门槛。没有门槛的 shadow mode，很容易退化成“我又看了一张更漂亮的图”。

#### 1.10.2 Shadow Replay 与 Shadow Simulation 不是同一种证据

本文在方法上刻意区分 shadow replay 和 shadow simulation。

**Shadow Replay** 更接近“把候选规则接到真实 retained-day / quote trace 上重放”。它要求使用同一套 replay 状态、同一套 placed-order denominator、同一套 fill/markout 口径，只是候选规则不改变 live 配置。比如 库存生命周期 stop-add 的 replay shadow arm 会问：如果当时 `abs_inventory >= 0.006 BTC` 或 库存生命周期 age 超过 60 分钟时停止继续加仓，placed/day、fills/day、pause、raw、InvAdj、inventory-time 和 side markout 会怎样变化。它的证据等级高于孤立 bucket，因为它真的经过了 replay 里的订单生命周期和 daily hard gate。

**Shadow Simulation** 则更宽泛：它可以是 paper path、what-if counterfactual、或者对某个标签的离线 proxy 估算。它适合快速问“这个想法有没有方向”，但如果没有接入真实 placed-order denominator、queue/fill 逻辑、daily stability 和 false-block/tail accounting，就不能直接叫候选 policy。

`toxic-risk` 只能作为 ranking / quote-EV calibration 输入，不能直接变成 hard veto。它必须先通过 order-level denominator、tail capture、positive false-block、inventory-time、side markout 与 action-uplift gate，之后是否进入任何运行 arm 仍需单独的明确授权。

#### 1.10.3 Rolling baseline：live、mechanics 与 economic control 必须分层

后期复盘里另一个容易混淆的问题是“baseline 到底是哪一版”。NarrowGate 的 baseline 不是某个永久固定的历史 bundle，而是**实验冻结时精确的 code、config、owner-policy 身份与数据口径共同产生的策略行为**。一个 GitHub pointer、公开 config 或旧 replay panel 只有在身份完全对齐时才可以代表该次冻结对照。

开源仓库里的 `live/config.yaml` 是可运行的安全示例，不包含私有现役参数。若拿不到一次实验所对应的 exact owner manifest，就必须明确标记 `public_baseline_not_current_live_parity`。公开 v13 只是历史 locator prerequisite；30 日 mechanics-safety successor 定义的 exact BUY E3、exact SELL B0、D+1 B0 与共同 `pause_exposure` overlay 只是 reduced-support mechanics default/paired arm；冻结 v12 50 日结果只作为 stale historical comparator。这些对象都不能代替未公开的当前运维身份，也不能互相替代。

因此每一轮实验都按下面这个定义推进：

```text
exact frozen owner manifest = operational paired-control identity for that experiment
mechanics-safety successor = 30-day reduced-support mechanics comparator
immutable v12 50-day identity = stale historical comparator under old mechanics
public v13 = historical locator prerequisite only
new mechanism or parameter = arm within its declared authority layer

baseline 先和所声称的运行机制量对齐
    -> placed/day
    -> fills/day
    -> fill/placed
    -> action mix: replace / keep / pause / place
    -> pause/block reason
    -> spread p50/p90
    -> bid/ask fill split

arm 再相对该次冻结 baseline 评估
    -> daily/inventory_lifecycle gate
    -> side markout
    -> inventory time
    -> terminal inventory_lifecycle PnL
```

这条规则有两个实际后果。

第一，如果 baseline 和 live 在机制量上已经不对齐，比如 replay 的 `pause_rate` 明显低于 live，或者 action mix 没有接入 live 的 replace throttle / `action=keep`，那下一步应该修 baseline/live parity，而不是开始调新 arm。否则新 arm 的“改善”可能只是 simulator error。

第二，回测基线必须明确冻结报价、撤改单、冷却和会计规则。不同规则下的运行记录不能直接拼成同一对照组，也不能用额外计数器替代缺失的动作与成交路径。

第三，rolling baseline 是“当前实际运行事实”，不等于“严格 promotion gate 已通过”。每次 live 变更仍必须记录部署身份、回滚条件和机制差异，但不能把运维选择倒写成已证明的 alpha。

因此当前最准确的总结是：**系统已有风险状态与成交质量诊断能力，owner 也已经启用两个显式 risk-accepted cooldown policy；但这不等于任何候选已经跨 validation、sealed holdout、strict queue/transport 与 库存生命周期-tail hard gates 获得 research-supported action authority。**

#### 1.10.4 参数选择：从“找最优点”改成 racing + 约束优化

到这一步，另一个旧习惯也要被修正：不能说“把 `config.yaml` 所有参数全量重测，找出最优参数”。这在数学上不可做，也在金融研究上很危险。一个 live 配置有上百个 leaf 参数，其中有些是 API、日志、WebSocket watchdog、sync-adjust safety，有些是 shadow/archived 路径；把它们混进同一个 PnL 网格，只会制造 data snooping。

现在更合理的流程是：

```text
current operational baseline identity
  -> one-factor or preregistered candidate generation
  -> Python/C++ baseline parity gate
  -> mechanism-preserving quick smoke
  -> chronological development + embargo + validation
  -> family-specific sealed holdout
  -> explicit owner authorization + deployment/rollback/resource gates
  -> ordinary canonical operational observation
```

每轮实验必须绑定 `experiment_id`、baseline config hash、code commit、P3/queue/latency artifact、dataset manifest、search-space version 与 split identity。旧 48/1024-arm 排名、retained 面板 winner 和 ablation 数值不构成有效研究证据；它们不能概括当前 baseline。

候选排序仍是 constraint-first：先检查 fills retention、pause/action mix、BUY/SELL split、queue/replace 行为、inventory time 与 库存生命周期 tail，再比较 terminal 库存生命周期 PnL 和 raw PnL。summary-only C++ smoke 只产生 survivor，不能产生 promotion 结论。

### 1.11 只看 PnL 还不够：把库存风险写成积分

maker 策略可能用更长时间、更大库存换取同样的 PnL。如果 A/B 报告只列 raw PnL 和最终库存，这种风险会被隐藏。

项目因此加入库存时间暴露：

$$
T_{\lvert q\rvert}=\int_0^T |q(t)|\,dt,\qquad
T_q=\int_0^T q(t)\,dt
$$

$$
T_{q^2}=\int_0^T q(t)^2\,dt,\qquad
T_{\text{notional}}=\int_0^T |q(t)|\,\operatorname{mid}(t)\,dt
$$

它表达的不是某一时刻仓位有多大，而是整个持仓期间承担了多少风险预算。两个 arm 即使最终都回到零库存，持仓 10 秒与持仓 2 小时也不应该被视为相同。

这些字段被接入 tick replay summary、事件引擎 HEALTH/metrics 和 A/B report，并进一步派生 `time_avg_abs_inventory` 与 `pnl_per_abs_inventory_hour`。从此比较 ask EV、multi-market 和 enhanced spot 时，不只问“raw PnL 改善多少”，还要问“为这点改善占用了多少库存时间”。

但库存时间不是一个越小越好的单调目标。maker 的 alpha 本来就来自愿意短暂承担别人不愿意承担的库存风险；如果把库存时间压到接近 0，策略也就没有多少被动提供流动性的空间。更准确的说法是：库存时间是风险预算，不是收益本身，也不是绝对惩罚。

因此后续更重要的单位从单笔 fill 变成了 库存生命周期：

```text
flat -> nonzero -> flat = one inventory lifecycle

long -> short / short -> long = one physical fill, two economic legs

inventory_lifecycle labels:
  max inventory
  duration
  closed inventory_lifecycle realized PnL / censored terminal MTM
  early 5m / 10m / 20m drawdown
  adverse excursion / MAE
  exposure-increasing fills
  reducing fills
  natural repair flag
```

当一笔物理成交穿越零仓位时，旧 库存生命周期 必须在零点终结，新 side 库存生命周期 在同一时间戳从 opening remainder 开始。closing/opening quantity 与 signed commission/rebate 按数量分摊；不能把整笔费用塞进旧仓，也不能把新仓 opening fee 置零。物理成交身份仍只有一个，经济归属则明确拆成两个 legs。

这里要把终局口径拆开：flat-to-flat 的 closed 库存生命周期 才能称为 realized PnL；窗口末仍未回到 flat 的 库存生命周期 是 censored terminal MTM。假想 taker liquidation 只能作为单独压力测试；只有显式 timeout/emergency taker exit 才是真实计入账本的 taker exit。replay 正式 `final_pnl` 使用 `cash + inventory * terminal_mark`，不默认扣除一笔并未发生的期末 taker fee。

这套标签能回答一个更贴近真实损失来源的问题：亏损到底来自“某一笔成交后的 20 秒 markout”，还是来自“一个库存生命周期 拖得太久、越加越大，最后自然减仓也仍然亏”。从最近 live 复盘看，后者往往更接近真正的风险来源。

所以 库存生命周期 control 现在只适合先做 shadow / replay evidence。例如：

```text
if abs_inventory >= 0.006 BTC:
    shadow: exposure-increasing side widen / stop-add

if inventory_lifecycle_age >= 20m / 40m / 60m:
    shadow: stop adding inventory, keep reducing side available

if high inventory_lifecycle risk and reducing side is firing too frequently:
    shadow: reducing cooldown 4s / 5s / 8s / 12s
```

这些不是 alpha 开关，而是风险塑形候选。它们要先看 terminal 库存生命周期 PnL、MAE、duration、tail 库存生命周期、是否误杀自然修复、是否减少反向开仓/翻仓 churn，再决定能不能映射成 spread / skew / lifecycle 的极小 arm。

库存生命周期 control 的当前研究要求是：只使用 decision-time 可见的 库存生命周期-so-far、exact-L2 refill/cancel、depth recovery 与 queue depletion；风险 score 不能直接翻译成 `widen/skew/cooldown`，必须经过带 overlap 的 action panel。

这里要特别澄清 `InvAdj`。项目里的 `InvAdj` 不是“风险惩罚后的 PnL”，而是：

$$
\operatorname{InvAdj}
= \operatorname{raw\ PnL}
- \operatorname{inventory\_pnl}
$$

其中 `inventory_pnl` 是持仓库存随 mark price 漂移带来的价格路径分解。把它从 raw PnL 里扣掉，可以帮助区分“报价/成交本身的贡献”和“刚好持仓期间市场漂移”的贡献；但它不是库存风险罚项，也不能单独用于 alpha 或 live promotion。

这个区别很重要：一个 arm 可能让 InvAdj 看起来没那么差，只是因为它剥离了某段库存顺风或逆风漂移；但它仍可能有更差的 maker-signed markout、更长的库存时间、更高的 tail loss 或更严重的 positive false-block。因此现在读结果时，`raw PnL`、`InvAdj`、side markout、tail/false-block、abs inventory-time 和 daily stability 必须一起看，不能只按一个数字排序。

### 1.12 库存终局：被动斜率不是万能退出路径

库存控制现在已经比早期完整很多。系统会记录：

$$
\int |q_t|\,dt,\quad
\int q_t\,dt,\quad
\int q_t^2\,dt,\quad
\int |q_t|S_t\,dt
$$

这让 A/B 不只比较 raw PnL，还能比较“赚这点 PnL 占用了多少库存时间”。但这仍然不是库存终局。

做市系统真正被打穿时，reservation price 的斜率可能已经不够。举例说，当库存接近 `max_inventory`，且市场继续沿不利方向重定价时，继续靠“少挂增加库存的一侧、多挂减少库存的一侧”来恢复，可能会遇到两个问题：

- 减仓一侧一直排不到队；
- 能排到队时，价格已经变差，库存损失扩大。

当前 NarrowGate 有可选的 timeout close / IOC / emergency MARKET 兜底，但默认主线并不启用主动 taker 对冲。也就是说，它还没有实现这种路径：

```text
BTCUSDC maker inventory
        |
        | risk budget breached
        v
choose hedge venue / instrument
        |
        | estimate hedge cost + basis + latency
        v
BTCUSDT perp / spot taker hedge
        |
        v
residual basis + inventory budget update
```

如果站在资金效率和风险终局看，下一阶段应该研究的是：

$$
\text{expected hedge cost}
<
\text{expected inventory tail loss}
$$

只有当主动瘦身成本、basis risk、taker fee、延迟和残余库存都进入同一张账，库存控制才从“被动做市参数”变成“风险闭环”。当前项目还没有走到这里。

### 1.13 微观振幅与宏观趋势：成交概率锚和库存风险锚

最近又加入了一个更贴近 maker 直觉的 evidence 方向：小粒度波动率 / 振幅 / 涨跌幅，与大粒度波动率 / 振幅 / 涨跌幅的比值。

它背后的问题是：报价是否落在短窗自然摆动范围内，以及这次短窗摆动是否只是噪声，还是已经被更大级别趋势接管。

第一层是成交概率锚：

$$
\operatorname{quote\_distance\_micro}
=
\frac{\lvert p_{\text{quote}}-\operatorname{mid}\rvert}
{\operatorname{range}_{5s\ \text{or}\ 10s}+\epsilon}
$$

如果这个值很小，报价落在短窗自然摆动范围内，fill probability 往往会更高。但 maker 里“容易成交”经常也是危险信号，因为 toxic flow 最先打到的就是容易成交的价格。

第二层是库存风险锚：

$$
\operatorname{trend\_efficiency}_{T}
=
\frac{\lvert \operatorname{mid}_t-\operatorname{mid}_{t-T}\rvert}
{\operatorname{range}_{T}+\epsilon}
$$

同时定义 side-aware adverse trend：

$$
\operatorname{side\_trend\_adverse}
=
\begin{cases}
1, & \text{BUY quote and macro trend down}\\
1, & \text{SELL quote and macro trend up}\\
0, & \text{otherwise}
\end{cases}
$$

于是可以得到一个更可解释的四象限：

| 状态 | 直觉 | 研究处理 |
|---|---|---|
| micro/macro ratio 高 + trend efficiency 低 | 局部噪声强、长趋势弱 | 可能是可吸收扰动，进入 local reversion evidence |
| micro/macro ratio 低 + trend efficiency 高 | 趋势主导，短窗摆动不足 | 容易变成 toxic fill 或 库存生命周期 loss |
| micro/macro ratio 高 + trend efficiency 高 | 冲击/切换状态，成交多但风险大 | 必须再看 depth refill / flow deceleration |
| micro/macro ratio 低 + trend efficiency 低 | 死水，fill 少且 replace 价值低 | 不应过度撤挂 |

这些字段现在不直接改 spread 或 TTL，而是进入 order-level evidence table：

```text
quote_distance_micro
micro_macro_range_ratio
trend_efficiency_60s / 300s
side_trend_adverse
micro_reversion_score
trend_inventory_risk_score
fill outcome
1s / 5s / 20s / 30s markout
inventory_lifecycle terminal PnL
inventory_lifecycle MAE
inventory_lifecycle repair flag
```

验证顺序也很明确：

1. `quote_distance_micro` 是否真的排序 fill rate；
2. `trend_inventory_risk_score` 高是否对应更差 markout、更差 库存生命周期 terminal PnL、更高 tail；
3. `micro_reversion_score` 高是否至少不更 toxic，最好有更高 repair rate；
4. 这些关系是否按 UTC day 稳定，而不是由少数窗口撑起来。

只有当这些 score 在 retained daily evidence 上站住，才会进入 quote EV / 库存生命周期 outcome risk 的 offline calibration 与 action-family preregistration。即使通过，也不能直接 tighten 或加 size；必须先冻结一个很小的 knob 映射，再经过匹配的 full-path、overlap、tail 与 owner authorization gate。

> **本节工程结论**
>
> - maker 研究不能只看 `spread` 或 raw PnL，必须把 fill 后 markout、库存时间和校准质量放进同一张表。
> - 多市场数据首先用于解释冲击来源，不应该直接变成一个全局开关。
> - 数据质量不是 ETL 细节，而是模型定义的一部分；rolling feature 和 future label 必须共享连续段口径。
> - quote EV 的 promotion gate 应该先过样本量、Brier/calibration、bucket realized-vs-pred 和分侧稳定性；通过后也只能定义新的 action family，不能将预测校准直接视为动作价值通过。
> - 库存时间是风险预算，不是单调惩罚；库存生命周期-level terminal outcome 比单笔 fill markout 更接近库存终局。

## 第二部分：回放验证与证据边界

到这里，maker 算法部分已经形成了一个闭环：候选报价、排队成交、fill 后 markout、cross-market attribution、quote EV 校准和库存时间积分。但它还必须落到 replay 和 evidence gate 上，否则很容易重新滑回“某个窗口 PnL 好看”的旧习惯。

### 2.1 为什么 bar 回测不够

bar 回测最容易自欺欺人的地方是：只要下一根 bar 的 low/high 碰到我的价格，就认为成交。maker 策略里这几乎一定会高估结果，因为真实世界里还有队列、延迟、TTL、cancel pending 和 post-only reject。

NarrowGate 的 tick replay 更保守：价格碰到只是必要条件，不是充分条件。订单进入盘口后，需要估计自己前面的 queue ahead，然后用后续 aggressive trade 去消耗这个 queue。简化逻辑是：

```python
def activate_order(side, quote_px, activation_ts, l2_book):
    level_qty = l2_book.visible_qty_at(quote_px, activation_ts)
    queue_left = level_qty if level_qty is not None else conservative_fallback()
    return LiveOrder(side=side, price=quote_px, queue_left=queue_left)


def process_trade(order, trade):
    if not trade_crosses_order(trade, order):
        return

    aggress_qty = trade.qty
    consumed_ahead = min(order.queue_left, aggress_qty)
    order.queue_left -= consumed_ahead
    aggress_qty -= consumed_ahead

    if order.queue_left <= 0.0 and aggress_qty > 0.0:
        fill(order, min(order.remaining_qty, aggress_qty))
```

这当然仍然不是“真实交易所撮合队列”。历史 Top-N 深度看不到这个 level 内部每个订单的真实排队顺序，也看不到隐藏单和你前方订单的真实撤单。因此 queue ahead 的价值不是声称知道真实 FIFO，而是避免 bar touch 那种最危险的乐观假设，并把不可观测部分留给 live calibration。

### 2.2 Promotion gate：从漂亮数字到可用证据

一个 maker alpha 线索要从 research clue 走到 policy candidate，至少要穿过下面这条链：

```text
数据质量
  -> replay/live 机制量
  -> rolling current-live baseline
  -> placed-order denominator
  -> fill selection
  -> OOS bucket
  -> daily stability
  -> inventory_lifecycle terminal outcome
  -> tail / positive false-block
  -> raw / InvAdj / inventory-time / side markout
```

其中 denominator 很关键。只看 filled rows 会产生幸存者偏差：你只看到了真正成交的订单，却不知道同一 bucket 下有多少未成交、被 guard 挡住、被 inventory limit 挡住或根本没有机会挂出的订单。order-level 主表更稳妥：每一行是一笔 placed order，带 quote-time state、fill outcome、1s/5s/20s/30s markout、库存生命周期 risk、shadow flags 和 explainable scores。

这里的 `rolling current-live baseline` 是硬前置。如果 replay baseline 还没有接入 live 的 replace throttle、`action=keep`、empirical latency、库存生命周期 evidence fields、明确的 shadow-disabled 状态或相应 pause reason 结构，就不能拿它去评估新 arm。baseline/live 对不齐时，优先修 replay 机制；baseline 对齐后，才比较 arm 是否真的改善了 fill selection、库存生命周期 loss 和库存风险。

### 2.2.1 从 score 到 action value：离线 policy evaluation

fill-selection score 回答的是“baseline 已经产生的 fill，哪些比较不 toxic”。它不能自动回答：

$$
V(x,a_{candidate})-V(x,a_{baseline})>0
$$

因为后一个问题还需要 behavior propensity、action overlap、action-specific reward 和反事实估计。当前实现位于 `research.families.f09_inventory_lifecycle_action_uplift.audit.offline_policy_evaluation`，提供 chronological/blocked-day cross-fitting、behavior propensity、action-specific $\hat Q(x,a)$、DM、clipped IPS/SNIPS、doubly robust value、day-cluster bootstrap、ESS 与 unsupported-mass gate。方法参考 [Bennett-Kallus](https://proceedings.mlr.press/v119/bennett20a.html)；多步 库存生命周期 的后续扩展方向参考 [Kallus-Uehara](https://jmlr.org/papers/v21/19-827.html)。当前 v1 是独立 decision unit 的 contextual OPE，不应冒充完整 sequential DRL/OPE。

Bennett-Kallus 在这里也是一条限制：把 direct/IPW/DR score 塞进 surrogate-loss reduction，不自动得到对 policy 参数高效的学习器。当前 `supported-Q argmax` 只用于 discovery；项目尚未实现论文中的 efficient GMM policy-parameter estimator，也尚未实现 Kallus-Uehara 的 sequential marginalized density-ratio DRL。

输入必须是一行一个独立 decision 的完整 action panel：实际 behavior action、决策后 reward，以及预注册 candidate action/probability。reward 可以预先定义为：

$$
\text{fill value}-\text{incremental 库存生命周期 cost}-\text{queue/reset cost}.
$$

现有 `order_level.csv` 主要包含 placed orders，所以不能直接识别 `pause/skip/re-center` 的价值。如果 baseline 从未尝试某个动作，regression 即使给出数值也不能修复 overlap；报告会明确标成 `diagnostic_only_overlap_failed`。这层不会替代完整 lifecycle replay：改变 queue priority 或后续库存路径的候选仍必须经过 queue、latency、pending cancel 和 库存生命周期 tail 回放。实现与输入契约见 [GitHub 文档](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/docs/offline_policy_evaluation_20260712.md)。

即使 overlap、ESS 和 bootstrap 都通过，估计仍依赖 consistency、conditional exchangeability、positivity、无未建模跨 decision 干扰与正确 reward attribution。工具会把这些 identification assumptions 写进报告，但不会假装数据自动证明了它们。event-time/cross-venue feature 还可以在 registry 中绑定 source timestamp 和 age budget，任何 `source_ts > decision_ts` 的行直接 fail fast。

这套方法在 2026-07-18 不再只是工具说明，而是完成了第一组正式的 existing-data action-uplift。`side_specific_local_actions_causal_v4_20260718` 从 122 个 causal-v4 good days 冻结 `80 development + 1 embargo + 20 validation + 1 embargo + 20 sealed holdout`。每个 库存生命周期 最多一次 exposure-increasing add 干预，behavior policy 为 `baseline / prevent-over-widen / widen-1tick / recenter-1tick = 0.40 / 0.20 / 0.20 / 0.20`；size、reducing side、inventory limit、hard safety、empirical latency 和 queue 都不变。

development 有 5,746 个 intervention 库存生命周期，validation 有 1,508 个。development 中的 BUY `widen_1tick` DR uplift 为 `+0.01783 USDC/intervention`，95% day-clustered interval `[-0.01233,+0.04682]`；SELL `recenter_1tick` 为 `+0.01318`，`[-0.01481,+0.04277]`。两者区间都跨零，只被冻结成 diagnostic candidate。固定 development-to-validation 后，BUY widen 收缩到 `+0.00394`，区间 `[-0.04063,+0.05211]`，正向日率只有 45%；SELL recenter 反号为 `-0.00905`。validation 的表面 winner 变成 development 为负的 SELL prevent-over-widen，属于 winner rotation，不是稳定 action alpha。candidate action 在 `terminal_inventory_lifecycle_pnl <= -5 USDC` 上又没有足够事件，tail gate 因 support 不足失败。因此这组固定 local add actions 已正式关闭，20 日 family-specific holdout 保持未读，live/C++/config/baseline 均未改变。

随后两个更窄、使用独立 identity 的 family 也没有通过 Development。BUY `buy_add_conditional_widen_causal_v4_v1` 在 28 个未来 evaluation days 上为 `-0.00742 USDC/decision`，区间 `[-0.02657,+0.01304]`；SELL `sell_add_repair_trend_skip_causal_v4_v1` 的 chronological policy 只选择 4 次 skip，reward interval 跨零，repair/trend-through competing-risk utilities 全部为负。两个 family 的 validation 与 sealed holdout 都未读取。负结果或区间穿零不是“继续等新日期”的理由；若要继续，必须定义新的 state-conditioned family 和新的冻结 evidence allocation。

### 2.3 2026-07-28 时点最诚实的结论

当前只能说这些状态通道仍可被重新研究，不能说它们已经提供正向线索。2026-07-18 的 causal-v4 action panel 已证明固定一 tick或一次报价周期的 local add action 没有通过 development/validation；2026-07-25 的 normalized-100ms 重建进一步确认，换一套更干净的 L2、特征与模型身份，并不会自动把状态预测转化为动作价值。

causal-v5 在 Validation20/Test17 的 raw 中心曾分别改善约 3.56/2.14 USDC，但 interval 跨零、参与度下降且 inventory time 增加；它只是一段历史 `user_directed_trial`。随后 causal-v9 使用 133 个 good days 和修复后的 taker-tempo lineage 重训，正式 Test3 的 raw/terminal 分别落后 `2.2308/2.6268 USDC`，tail 增加 3 个，因此没有部署。可公开审计的历史时序是：7 月 27 日冻结 baseline 为 ML-OFF + empirical P3，8 月 3 日的快照滚动到 causal-v12 v7，8 月 12 日为 v10，8 月 20 日公开快照为 v12，后续还有单独标记的 owner-side override 记录。这条历史不用来推断今日私有进程。任何受限 cancel/re-entry 也只是独立 action treatment，不是 scorer 排序通过后自然获得的因果结论。

宽参数网格现在已经能跑，但它不能替代 order-level / 库存生命周期-level score sanity，更不能替代 action value。下面这些 score 仍用于解释状态，不再被直接当成“下一步上线规则”：

```text
fill_probability_score     # 只解释会不会成交
fill_quality_score         # 解释成交后 markout 是否不坏
toxic_risk_score           # side-specific quantile，不用固定稀疏 high bucket
inventory_lifecycle_outcome_risk      # 解释 terminal inventory_lifecycle loss / MAE / duration
micro_reversion_score      # 局部扰动是否有短半衰期
trend_inventory_risk       # 大级别趋势是否正在放大库存风险
```

这些 score 如果不能按日稳定排序 fill rate、markout、tail 和 库存生命周期 terminal outcome，就不应该进入 quote EV 重训；即使能排序，也必须先生成带完整 propensity、queue 和后续库存路径的 action panel。当前下一步不是继续扫固定 tick/秒数，而是先解释 spread、action-specific activation、exact-queue/through fill CIF 与 lifecycle fill 的非线性，再用 native snapshot/delta queue evidence 预注册 state-conditioned queue-value family。

### 2.4 Null、score 与 action 必须分层

Submit-time opportunity null 只在同日同侧的 placed-order denominator 中比较报价时刻机会；它不重放成交、queue、latency、cancel/replace、库存依赖或 库存生命周期 path，因此不能被称为随机 maker 策略收益。Executable passive null 才会通过完整 state machine，但它仍只是可执行对照，不是 promotion candidate。修复前两类 null 的具体 PnL、seed 排名与 gap 数值不构成有效研究证据。

Side-specific fill-quality score 估计的是 baseline 已产生订单/成交中的条件排序，不等价于 `P(fill | x,a)`，更不等价于 action uplift。scorer 与 action 证据只接受对应 causal feature identity、已知 behavior propensity 和 family-specific split。causal-v9 本身未获 live 权限；旧 BUY selector 在 2026-08-03 的 v7 中只有 shadow permission，至 2026-08-12 的 v10 已是 shadow/action 均 OFF。

Reference 也遵守同一边界：local M0 先证明 action support 与 value，external M1 只检查 Bitget/Bybit/OKX 是否对 toxicity/queue value 提供增量。没有 M0 action uplift，就不把 external residual 直接映射成 re-center、cancel、size 或 stop-add。

### 2.5 先排除实现归因，再继续找 alpha

代码审查假设必须与策略证据分开。

窗口结束只是 valuation boundary，当前账本使用：

$$
\mathrm{PnL}_{\mathrm{terminal}}=\mathrm{cash}+qP_{\mathrm{mark}}.
$$

没有实际 taker order 就不扣假想平仓费；hypothetical liquidation 只作为单独压力测试。BTCUSDC maker fee 按当前配置独立核对。这个口径修复不会改变报价、queue、fill 或 库存生命周期，也不能被包装成 alpha。

后续归因固定沿 `placed opportunities -> fills -> fill markout -> inventory lifecycle -> terminal/tail PnL` 展开，并同时报告参与度、queue/replace、side split、inventory time 与 库存生命周期 censoring。

### 2.6 2026-07-15：旧 ML 精确数值失效后的正式重校准

时间与单位审计确认：旧离线 10 秒特征在 bucket 左边界提前可见，旧 tick replay 主要由 execution trade 推进，风险金额路径还混用了绝对价格方差与收益率方差的单位。由于报价、fill、库存生命周期 与库存状态是非线性的，baseline 和 arm 同时受到错误并不能让差值自动抵消。

修复后，formal replay 使用 bucket-end `feature_ready_ts`、因果 warmup、trade/BBO/L2/timer 合并时钟、显式 empirical P3 artifact、strict queue/latency identity、数量加权 markout 与 terminal MTM。修复前 ML、多行情、参数排名、queue 倍率和精确 PnL 数值不构成有效研究证据。

7 月 25 日的 historical operational identity 位于 `research/families/f10_live_replay_attribution/docs/operational_baseline_identity_20260725.json`；它记录的是 causal-v5 trial，不再授权当前 live。该段完成时的 corrected baseline 由 ML-OFF、empirical P3、queue 与 latency identity 联合确定；8 月 3 日 v7 改为 causal-v12、P3、q90 shadow/action-OFF 与 BUY-selector shadow/action-OFF，8 月 12 日 v10 又关闭 BUY-selector shadow，8 月 20 日公开指针前移到 v12，8 月 24 日 owner-side authority 再叠加 BUY E3，随后 no-shadow successor 关闭 external/Flow/Ref 与全部 shadow/companion。它们不能混成一个没有时间戳的“baseline”。

### 2.7 2026-07-17：BUY scorer 与 shared side policy 完成双引擎 parity

7 月 15 日修复事件时钟与特征可用时间后，C++ formal replay 仍有两处完整窗口偏移。它们后来都被定位为离散 policy 语义，而不是浮点累计：

1. Python 在 post-policy-only 再次触发 spread cap 时，漏计了一次 `final_cap_compress_rate`；C++ 会把 initial 与 post-policy compression 合并计数；
2. C++ 仍走旧 shallow-depth multiplier，只看一个较浅的 depth 字段，可能在 exact L2 已显示深度充足时错误施加 `1.1` thin-depth multiplier。

修复后，Python/live 的 `evaluate_common_side_policy()` 与 C++ 的 `evaluate_common_side_policy_cpp()` 对 BUY/SELL 使用同一行为契约，spread、size、hard pause 与 exposure-only allow 不再由两套漂移的旧 helper 各自解释。BUY fill-selection 也补齐了 C++ ABI v3：Python adapter 先按 causal `feature_ready_ts` 将 `Prediction.feature_dict` 中的静态 fold contribution 编译为数组，C++ 再与 quote-time distance、depth、toxicity、inventory 和 policy allow 字段合并，执行与 Python 相同的 shrink、fold average、missing gate 与 actionable gate。旧 ABI 或静态 payload 不完整时直接 fail fast。

该 2026-07-17 checkpoint 当时的验证为全仓 `355 passed, 4 skipped`；May normal/high activity、Feb sparse 与 Jan A/B 四个 real-data golden 均通过 summary、PnL path、fills、inventory-time 与 trace 长度对照。这个 checkpoint 说明 BUY scorer 和 active common-policy surface 已经可以进入 C++ fast screening；它不表示 queue cancellation-ahead、逐请求 REST latency、P3 artifact identity 或 live-only sync/user-stream 故障已经被历史 replay 完全识别。完整代码边界见 [live/replay parity report](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f10_live_replay_attribution/docs/live_replay_code_parity_20260717.md)。

### 2.8 2026-07-18：causal-v4 empirical-P3 formal research baseline

7 月 17 日的 parity checkpoint 解决了双引擎行为契约，但没有让 causal-v2 的旧精确结果重新有效。下一步是用一个冻结 identity 重建整个 formal research surface：

- completed 10s feature bucket 只能在 `bucket_end` 可见；
- volatility 是 `(USDC/BTC)^2 / second` 的一秒绝对价格方差；
- 该历史 identity 的 inventory risk 显式乘 `quote_horizon_s`，不再额外乘 mid；当前维护的 Python 核心使用 `risk_horizon_s`，不能沿用历史字段解释当前公式；
- replay 使用 trade、BBO/L2 与 timer merged clock；
- empirical P3、queue 与 REST latency 都绑定 artifact 路径和 SHA；
- 构造 order-level retraining denominator 时关闭旧 BUY live scorer。

新的 feature split 是 `80 train + 1 embargo + 20 validation + 1 embargo + 20 test`；order-level denominator 共 122 日、2,219,633 个 placed orders 和 70,650 个 fills。10 秒 empirical P3 在该历史 identity 中使用 `delta*=13.9990859817 USDC/BTC`、触达概率局部斜率为 0.0674381136；后者描述 `P_touch` 随距离的对数变化，不是 execution-intensity slope。13-head causal-v4 bundle 的 test 指标为：

| Head | Test metric |
|---|---:|
| direction 10s / 30s / 60s AUC | 0.5284 / 0.5085 / 0.5071 |
| return 10s / 30s / 60s IC | 0.0342 / 0.0074 / 0.0024 |
| volatility 10s / 30s / 60s IC | 0.5155 / 0.6968 / 0.7539 |
| BUY toxicity 5s / 10s AUC | 0.5686 / 0.5456 |
| SELL toxicity 5s / 10s AUC | 0.5628 / 0.5409 |

严格 ML A/B 的 later panels 看起来比 causal-v2 更好，但仍没有形成 clean promotion：

| Panel | Raw delta ML-ON minus OFF | Terminal delta | Tail delta | Fill delta |
|---|---:|---:|---:|---:|
| Train 80 | +5.50 | -36.81 | -6 | -1,131 |
| Validation 20 | +1.58 | +10.72 | +1 | -571 |
| Test 20 | +7.55 | +19.17 | +3 | -519 |
| All 122 | +15.13 | -5.50 | -2 | -2,341 |

validation/test 的 raw 与 terminal 中心改善，但 test 多 3 个 tail 库存生命周期，train terminal 又反向。因此 empirical P3、causal timing、merged clock 和 artifact validation 成为新的 research baseline；13-head bundle 与 rebuilt BUY scorers 仍是 shadow，queue q0.70 也只是校准 reference，不会按 replay PnL 表改成新的策略 knob。

### 2.9 2026-07-18：从 score ranking 到带已知 propensity 的 action-value evaluation

causal-v4 checkpoint 最重要的变化不是模型数字，而是停止把“高分 bucket”直接翻译成 action。下面的 DR/OPE 数值仍依赖 consistency、conditional exchangeability、positivity、干扰结构与 reward attribution 等识别假设；已知 propensity 和 overlap 让 action-value 估计更可审计，不等于这些因果识别条件已经由数据证明。同一 122 日 universe 随后冻结了第一组正式 side-specific local-action family。固定 prevent-over-widen、widen-one-tick、recenter-one-tick 没有通过 development/validation；20 日 family-specific sealed holdout 因而没有读取。

为了排除“动作面太宽”这个解释，研究又开了两个独立窄 family：

1. BUY exposure-increasing add 只比较 baseline 与 conditional widen-one-tick；
2. 已持有 short inventory 时，SELL add 只比较 baseline 与 skip one quote cycle。

两者都使用 50/50 已知 propensity、每 库存生命周期 最多一次干预，保持 reducing side、size、inventory limit、external reference、queue 和 empirical latency 不变。BUY family 在 28 个未来 evaluation days 上中心为负且 interval 跨零；SELL family 的 learned policy 只触发 4 次，reward 下界不过关，repair 与 trend-through competing-risk utility 还同时恶化。两个 family 都在 Development 关闭，validation 和 sealed holdout 均保持未读。

这给当前研究一个比“再收几天数据”更严格的停止规则：现有数据已经足以否证这三组固定/窄 local actions，不能用等待新日期救回同一 hypothesis。下一代如果研究 local shock/refill/recovery 或 queue-value keep/cancel，必须使用新的 event-L2 eligibility、新的 family identity、预注册 action/reward/gate 和新的冻结 evidence allocation。

### 2.10 2026-07-25：normalized-100ms 与 causal-v5 历史账本

causal-v4 解决了 feature-ready time 与 merged clock，却仍混用了早期约 1 秒和近期 100ms 的 normalized L2。当前 formal identity 改为 `normalized_l2_100ms_v2`：原生 CryptoHFTData snapshot/delta 是权威源，normalized 目录只作可再生、版本化输入；每个 UTC 日附带 rebuilt、sequence、warmup 与 formal eligibility。当前 128 个 rebuilt days 中有 62 个 formal normalized days，53 个具备有效前日上下文。2026-07-04 至 07-11 的 individual-trade BUY/SELL 标志也已修复，旧分侧结论因此不再沿用。

新的 causal-v5 面板包含 128 个日文件、220 个 feature 和 13 个 label，模型 split 为 86 train、20 validation、20 test。它保留 bucket-end visibility、因果 warmup、merged clock、显式 empirical P3/queue/latency artifact。主要 test 诊断为：

| Head | Metric |
|---|---:|
| direction 10s / 30s / 60s AUC | 0.5394 / 0.5097 / 0.5112 |
| return 10s IC | 0.0429 |
| volatility 10s / 30s / 60s IC | 0.6552 / 0.7264 / 0.7613 |
| BUY / SELL toxicity 5s AUC | 0.5748 / 0.5764 |

严格 ML-ON minus ML-OFF replay 的可用 later panels 为：

| Panel | Raw delta | Terminal delta | InvAdj delta | Fills retention | Inventory-time delta |
|---|---:|---:|---:|---:|---:|
| Validation20 | +3.56 | -0.23 | +4.07 | 91.46% | +271.2 BTC-s |
| Test17 | +2.14 | +0.47 | +1.99 | 92.64% | +131.4 BTC-s |

raw/terminal bootstrap interval 都跨零；参与度下降，库存时间也没有改善。四个 rebuilt BUY scorer 的 action gate 同样全部失败，只能保留 descriptive ranking。formal 42 日 lifecycle 又显示，10,330 个库存 lots 的中位存活时间约 308 秒、库存生命周期-flat 中位约 381 秒，LONG/SHORT 中位约 348/262 秒。这也解释了为什么只盯 30 秒 markout 会遗漏真正的库存传导路径。

用户随后明确要求将 causal-v5 部署为新 baseline。系统通过 SIGHUP 热加载完成切换，config/model/P3 与 baseline identity 都写入 hash；promotion class 记录为 `user_directed_trial`。这里必须保留两层判断：

- operationally，它已成为下一轮 arm 必须比较的 rolling baseline；
- statistically，它没有通过 strict promotion gate，不能被称为稳定 alpha。

这两条描述绑定 7 月 25 日当时的历史状态。7 月 27 日 causal-v9 将训练身份延伸到 2026-07-25，并排除 side-corrupted taker-tempo lineage；正式 Test3 中 raw delta 三日全部为负，terminal 更差且 tail 增加，因此 candidate 未部署。当时 rolling baseline 恢复为 ML-OFF，empirical P3 保持该次冻结身份；以下 causal-v5 数字只用于解释 normalized-100ms 重建过程，不再代表 live 权限。该 baseline 先被 causal-v12 v7 取代，2026-08-12 前移到 v10，2026-08-20 的最后公开 snapshot 是 v12；

对应的可复现边界见 [causal-v5 revalidation](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v5_normalized100ms_revalidation_20260725.md) 与 [operational baseline identity](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f10_live_replay_attribution/docs/operational_baseline_identity_20260725.json)。后续的 causal-v9 决策见 [causal-v9 replay](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v9_through_20260725_replay_20260727.md)。

### 2.11 Fixed spread 与成交概率：先拆 touch，再谈 fill

这一轮没有直接优化 live spread，而是先问一个更基础的问题：**同一个决策、同一段未来行情和同一个订单生命周期里，报价离同侧 BBO 越远，成交概率应当怎样变化？**

第一版实验把 25 个距离分别放进独立策略世界。某个距离成交后会改变库存、cooldown 和下一次 activation denominator；更关键的是，scalar matcher 把 strictly-through trade 当成 exact-price trade，只消耗当前 print quantity。这样会出现“深价订单成交、同路径浅价订单未成交”，因此旧表中的 0→1 tick lifecycle 反转不再解释为 queue discontinuity，旧概率、local kappa 和 lookup 全部撤回。

替代实验 `paired_fixed_spread_monotonic_v2` 对每个 side/decision 一次性生成全部 25 个距离，共享 new/cancel latency、activation book、TTL、cancel ACK 和未来行情路径；counterfactual fill 不反馈库存或后续订单。exact-price trade 按数量消耗 queue，strictly-through trade 强制 full fill；如果深价成交而浅价未成交，C++ replay 直接 fail fast。

固定报价定义为：

$$
p_{\mathrm{BUY}}=b_t-d\cdot\mathrm{tick},\qquad
p_{\mathrm{SELL}}=a_t+d\cdot\mathrm{tick}.
$$

对已经激活的订单，概率可以拆成：

$$
P(\mathrm{fill})
=P(\mathrm{touch})\,
P(\mathrm{fill}\mid\mathrm{active\ touch},\mathrm{lifecycle}).
$$

第二项不能简称 queue conversion：它同时包含 exact-price queue depletion、later-through fill、strictly-through forced fill 和 deeper-path selection。决策时还必须另外乘上每个 action 自己的 activation/GTX acceptance；paired v2 的共同 activation 只用于证明共同支持集内的距离单调性。

实验覆盖 128 个 good days、25 个距离和 BUY/SELL 两侧；正式曲线只使用 62 个 `formal_eligible` normalized-100ms days，共写出 6,400 行日度 sufficient statistics。所有 filled/full-filled/filled-quantity 以及 1s、5s、10s、lifecycle pathwise 和 aggregate 单调性断言均为零违例。

![BTCUSDC paired fixed-spread execution geometry](/images/narrowgate/paired-fixed-spread-curve-20260726.png)

formal panel 的关键点如下：

| Side / distance | Exact touch | Through touch | Any touch | Fill given touch | 1s fill | Lifecycle fill |
|---|---:|---:|---:|---:|---:|---:|
| BUY 0 tick | 58.53% | 29.63% | 64.89% | 78.72% | 20.82% | 51.08% |
| BUY 1 tick | 22.31% | 37.67% | 49.20% | 98.92% | 18.92% | 48.66% |
| SELL 0 tick | 59.44% | 44.43% | 65.75% | 76.32% | 19.70% | 50.18% |
| SELL 1 tick | 21.16% | 45.70% | 49.69% | 98.53% | 18.77% | 48.96% |

修正后，BUY 0→1 tick lifecycle fill 是 `51.08%→48.66%`，SELL 是 `50.18%→48.96%`，不再反常上升。右下角的 `fill | touch` 仍从约 76%–79% 上升到 98%–99%，但这不是无条件成交概率：能 strictly through 更深价格的市场路径本来就是更强的条件子集，而且 through 发生时更优价 passive order 必须已经成交。**条件 conversion 上升与无条件 fill 单调下降可以同时成立。**

0/1 tick 的 queue fallback 都约 0.02%，所以近端单调结果主要来自可见盘口；但 80 tick fallback 已约 79%，100 tick 约 93%，140 tick 后超过 99%。因此远端尾部仍只能解释冻结的 calibrated matching-model geometry，不能称为 native deep exchange queue truth，更不能直接生成 live lookup。旧 observational spline 的 NLL 也不会因本次配对重放而自动恢复；它必须在新的 paired denominator 上重建。

完整说明见 [paired fixed-spread report](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/paired_fixed_spread_monotonic_v2_20260726.md)。失败机制只在 paired v2 报告中保留，防止同一错误再次进入研究链。本轮没有修改 live。

#### 触达统计、成交风险与报价用途

成交相关模型分别回答不同问题：P3 估计10秒触达机会；成交 hazard 研究短时成交风险；fill-selection scorer 研究成交质量排序；主模型预测市场状态。它们的时钟、条件集合和目标不同，不能互换。

下一步不是直接拟合一张 surface，而是先建立逐 side-decision 的 lifecycle panel。每行同时保存 current、-1 tick、+1 tick 的 action-specific activation、queue、exact/through touch、partial/full fill、cancel request/ACK 与固定期限结果。

新提交订单与活动订单必须拆成两个 estimand：placement 模型从 decision time 开始，并对 ACK 后 queue 分布积分；active-order continuation 模型可以使用当前 queue、age 和 refill/recovery path。KEEP 保留 queue，REPLACE 重置 queue，二者不能被当成同一距离 surface，也不能强制满足距离单调性。

活动订单的总 fill CIF 写成：

$$
CIF_{\mathrm{fill}}(h)
=
CIF_{\mathrm{exact\ queue}}(h)
+CIF_{\mathrm{through}}(h).
$$

波动率不能只作为一个额外 bucket。当前 `sigma_sq` 是每秒绝对价格变化方差；scheduled exposure 必须包含 cancel request 到 ACK 期间仍可成交的时间：

$$
H_{\mathrm{sched}}(a)
=
t_{\mathrm{scheduled\ request}}(a)-t_0
+E[L_{\mathrm{cancel\ ACK}}].
$$

再把报价距离归一化为：

$$
z
=
\frac{d_{\mathrm{price}}}
{\sqrt{\sigma^2_{\mathrm{price},1s}H_{\mathrm{sched}}(a)}}.
$$

同样的 20 ticks 在低波动与高波动下不是同一个执行距离。不过模型仍须保留 raw distance、fast/slow volatility ratio、queue、weighted-mid proxy、flow、refill/recovery、side 与 inventory role，并对无条件 fill probability 施加“距离越远不增加”的单调约束。

策略也不能选择成交概率最高的报价，因为高波动往往同时提高 touch 和 toxic-fill 风险。真正比较的是：

$$
V(a\mid x)
=
E\!\left[
\sum_i\frac{q_iP_i}{10^4}(m_{i,H}-fee_{\mathrm{bps}})
-\Delta C_{\mathrm{库存生命周期}}
-C_{\mathrm{explicit\ reset/churn}}
\mid do(a),x
\right].
$$

maker-signed markout 已经包含 spread capture；queue 已经通过 fill probability 起作用；terminal 库存生命周期 MTM 已包含的 repair value 都不能重复扣加。

第一阶段当时只允许单日、三候选、native-deep、流式压缩 smoke；约 61 GiB 的可用空间尚不满足完整数百万行 panel 的安全门槛。腾出空间、冻结 split/feature timing/model gates 后，项目才进入后续 Development prediction family；它仍须先通过 Value 与 randomized action uplift，才允许影响 keep/widen/re-center/cancel。完整契约见 [volatility-conditioned fill design](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/volatility_conditioned_fill_probability_design_20260726.md)。

截至 2026-07-26，这个 mechanics smoke 已经完成。Development 单日的 1,000 个真实 baseline side-decisions 生成 3,000 个 `closer/current/farther` child；BUY/SELL 为 `551/449`，opener/reducing/add 为 `442/439/119`。三档总 fills 为 `42/40/39`，其中 exact-queue fills 为 `4/6/10`，through fills 为 `38/34/29`，路径单调性违例为 0。exact 增加而 through 减少再次说明，两种机制应分开诊断，primary target 应直接使用总 fill CIF。

这个结果仍不允许拟合 surface：单 action 只有 39--42 fills，add 也只有 119 行；BUY q90 在该 smoke 时尚无 replay-equivalent cancel/re-entry 状态机，因此被哈希并排除为 frozen separate treatment。后续 q90 v1.6 已完成 40 日 exact-native mechanics，但首次 prospective transport 因 duplicate activation 与缺 exact feature-ready companion fail closed，action 仍关闭且未读独立经济 outcome。shadow child 不反馈库存，所以该历史 smoke 也没有 库存生命周期-PnL counterfactual。完整记录见 [paired lifecycle smoke](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/paired_state_fill_surface_smoke_20260726.md)。

### 2.12 重建后的 null 与 Python/C++ parity

submit-time opportunity null 仍显示明显 toxic-selection gap：actual fill 的 20/30 秒 maker-signed markout 约为 -1.1 至 -1.5 bps，而同日同侧随机 placed opportunity 约为 +3.8 至 +3.9 bps，差约 -5 bps。它只证明 baseline fills 比无条件 submit-time opportunity 更 toxic，不证明随机订单能够成交或盈利。

可执行 random-passive null 给出了更严格、也更克制的结论。Development33 上 random raw 相对 baseline 中心约 +2.98 USDC，但 interval 跨零且 InvAdj 为负；Validation9 上 random raw 反而落后约 8.85 USDC，32 个 seeds 只有 1 个 raw 胜出、InvAdj 没有胜出。于是：

- baseline 对该可执行随机生命周期具有可验证优势；
- baseline 自身仍可能为负，不能把“优于随机”写成正收益 alpha；
- opportunity gap 与 executable null 回答的是两个不同问题。

最后，代表日的 ML-ON/OFF、fills、PnL 与 executable-null Python/C++ replay 已完成精确对拍；当前代码快照的 suite 为 `917 passed, 4 skipped`。这使后续 spread-fill、queue-value 与 arm 研究可以共享同一状态机；它提高的是复现性，不提高某个动作的因果证据等级。

### 2.13 2026-07-28：从 cancel policy clock 到 ordered common-support surface

早期 competing-risk 模型把 fill、cancel ACK、jump 和 repair 都当成从订单激活时刻开始的平稳自然 hazard。这个结构不对：cancel request 是 baseline policy 决定的 stopping time，ACK 是 request 之后的系统延迟；ACK 前剩余数量仍可能 partial/full fill。repair 则需要 inventory/inventory_lifecycle/reducing path 进入可修复状态，不能从每张订单的零时刻进入同一风险集。

新的 request-state family 将生命周期拆为：

```text
submit -> activation
       -> pre-request fill risk
       -> deterministic policy cancel request
       -> pending-cancel fill / conditional ACK race
```

结构修复让 pre-request fill 和 request-conditioned ACK 在 Development 获得支持，但 pending fill 过于稀疏，不值得继续建立复杂 role/cause head。它被降级为带不确定性和 USDC 上界的 empirical nuisance，而不是用 joint Brier 中由 ACK 主导的改善替它“补票”。

在此基础上，`ordered_common_support_fill_surface_v1` 对 closer/current/farther 使用共享 state、共享 calibrator 和带 distance 单调约束的 side-specific hazard。结果是：

| Development gate | 结果 |
|---|---:|
| action-specific pre-request curve | 18/18 pass |
| conservative transport probability bound | 18/18 pass |
| activation absolute calibration | 11/18 pass |
| all-three support absolute calibration | 9/18 pass |
| pending posterior predictive | 36/36 pass |
| pending economic uncertainty | 0/36 pass |

正式输出还有 1,042 行 apparent monotonicity violation，涉及 399 个 cohort。复核发现这 399 个 cohort 的三 action realized exposure 全部不同，max-minus-min 中位差为 3,713ms：filled closer action 可能在实际 fill time 停止积分，而 surviving farther action 积分到更晚的 cancel request。**单调 hazard 在不同时钟上积分，不保证 CIF 仍有序。** 所以这是 common-lifecycle evaluator contract failure，不是 LightGBM distance constraint 失败，也不能事后用 isotonic projection 修复。

同样需要克制的是 constrained-versus-unconstrained 比较。18/18 “not significantly worse”只表示没有检测到显著损害，不是预冻结 margin 下的 non-inferiority 证明。未来若要声称非劣，必须事前冻结 $\epsilon_L$，并要求：

$$
\operatorname{UCB}_{95\%}
\left(L_{\mathrm{ordered}}-L_{\mathrm{unconstrained}}\right)
\le \epsilon_L.
$$

因此该 prediction family 在 Development 正确关闭；Validation 与 sealed holdout 均未读取，`prediction_supported`、`transport_supported`、`economic_resolution_supported`、`action_experiment_authorized` 和 `live_deployment_authorized` 全部为 false。仓库没有创建 `placement_action_value_surface_v1` 或 `placement_quote_action_uplift_v1`。未来 identity 必须从冻结 Spec 解析 ex-ante、cohort-common、非 outcome-derived 的时钟来源，并对缺少任一 paired action 的 cohort fail fast。

代码按 10 个策略与证据研究族、系统工程和共享基础设施组织。`data/` 管理离线下载、导入和规范化工具；`live/orderbook/` 管理实时执行市场深度簿；`execution/` 管理己方活动订单的队列和订单路径状态。

完整边界见 [fixed-parameter closure](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f01_fixed_parameter_racing/docs/fixed_parameter_strategy_family_closed.md)、[ordered common-support result](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/ordered_common_support_fill_surface_v1_development_20260728.md) 与 [contract errata](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/ordered_common_support_fill_surface_v1_contract_errata_20260728.md)。

### 2.14 2026-08-03：causal-v12 control、连续价值口径与研究族收口

模型预测、基线选择和报价动作的有效性是三个不同问题，需要分别检验。

#### causal-v12 为什么可以运行，却还不能写成独立研究确认

2025 数据以新的 source-aware 身份重新进入模型研究。2025-08-01 至年底的 153 个自然日都具备 15 类非 CryptoHFT 源；Tardis `incremental_book_L2` 与 `book_ticker` 完整到达后，93 日通过 provider-normalized gate，再要求严格 D-1 warmup，得到 67 个 target days。它们与 45 个 2026 native days 合成 112 日 feature universe；66 个 2025 target days 用于 causal-v12 训练，每个 head 使用 173 个 semantics-v6 features。

2025 provider-normalized 数据可用于相应特征和模型训练，但缺少 Binance 原生 `U/u/pu` 序列及精确接收时钟，不能据此重建精确排队、订单路径或随机动作标签。

causal-v12 首轮 strict research gate 没有全过。迁移到 2026 native panel 后，分类 ranking 部分延续，但 absolute probability/scale transport 仍弱；新增 5 个 post-fit Grade-A days 的 PnL 点估计为正，区间仍跨零且原 90% fill-retention、库存生命周期 q10/CVaR 与 SELL maker-value gate 没有联合通过。

项目 owner 随后建立了一个**显式 outcome-informed 的 v2 经济合同**，把 fill band 改为 80%-120%，并在该闭合库存标签研究内把 UTC day-end open inventory/MTM 作为 accounting diagnostic。这个局部指标安排不能推广为完整账户核算规则：完整账户权益仍须计入期末未平仓 MTM。它没有回写原 v1，也不能伪装成事前 gate。历史 late 22 days 与新增 5 days 合并后的结果是：

| combined 27-day metric | causal-v12 ML-ON minus ML-OFF |
|---|---:|
| terminal MTM | `+32.7400 USDC` |
| mean/day，95% day-cluster interval | `+1.2126`，`[+0.5755,+1.8437]` |
| positive days | `19/27 = 70.37%` |
| fill retention | `85.58%` |
| relative loss reduction / relative fill reduction | `2.925`，interval `[1.574,4.384]` |
| 已结束库存生命周期 value | `+29.8355 USDC`，占总增量 `91.13%` |
| 库存生命周期 q10 change/day | `-0.01269 USDC`，interval `[-0.03880,+0.01419]` |

这组结果来自已读取面板上的事后重新评分。收益差不能简单解释为按比例少成交，也主要不是日末浮动估值产生；但库存生命周期 q10 非劣检验未通过，13 个模型头也未取得独立样本上的联合验证，因此不能据此确认预测或报价动作有效。

#### 日末库存降权，不等于库存风险被取消

新的 scorecard v2 profiles 把 `closed_inventory_lifecycle_value` 设为主要 value，把旧 day-end censoring 权重转给 `conditional_net_value`。UTC 日末库存、open-库存生命周期 MTM 和 censoring 的 ranking weight 变成零，因为 live 不会在 23:59 自动停机、平仓和清空 库存生命周期。正确的每日恒等式是：

$$
\mathrm{PnL}_d
=
\mathrm{realized}_d
+q_{d,end}m_{d,end}
-q_{d,start}m_{d,start}.
$$

如果一个结果声明 continuous accounting，现金、库存和 库存生命周期 就必须跨午夜延续，daily rows 只用于 dependence clustering；但冻结的 predecessor 50 日 compatibility control 明确采用 `daily_fresh_start`，不声称 continuous-live PnL。无论哪种身份，都不允许用平均收益补偿路径风险：库存生命周期 q10/CVaR、terminal protection、MAE、最大库存与 inventory-time 继续是不可补偿 hard gates，日末浮亏降权和多档库存风险降权是两件完全不同的事。

#### 一个历史 q90 shadow 与一个退役 selector 为什么都没有研究 action 权限

旧 BUY fill-selection 在冻结 40 日精确 A/B 中，唯一切换的是 quote permission：

```text
PnL:  -159.1323 -> -175.9269 USDC
delta: -16.7946 USDC = -0.4199 USDC/day
95% day-cluster interval: [-1.3041,+0.2950]
fills: +0.573%
multi-level SHORT terminal value: -13.5910 USDC
```

区间跨零，所以不能声称已经证明所有状态甚至平均意义下必然有害；但一个 overlay 的责任是先证明正增量，而不是让生产继续承担负点估计直到“普遍有害”被证明。因此 action 先被关闭，随后旧 scorer shadow 也在 observation-stream retirement 中关闭；科学分类仍是 `unsupported_negative_point_estimate`，不是“普遍有害已证实”。

q90 的问题不同。旧 replay 把 exchange clock 与 provider receive clock 混用，后续又发现 cancel ACK 后 terminal order 仍进入 active hazard risk set。v1.6 40 日 mechanics 曾在 665,831 个 exact-native eligible lifecycle spells 上完成，Python/C++ transition mismatch 与 post-terminal reuse 都为零；但首次 prospective live/AWS transport 因 330/589 lifecycles 出现 REST ACK + WebSocket `NEW` duplicate activation，且缺少 exact feature-ready companion 而 fail closed。修复代码不能改写这次失败证据；在那个历史身份中 q90 是 shadow ON/action OFF 且未读独立经济 outcome，后来的某个冻结 no-shadow 快照则记录两者关闭。这与 BUY selector 的负经济点估计不是同一种关闭原因；两条历史都不用来声称当前私有运行状态。

#### 各研究族的公开证据停在哪里

| family / route | 公开结论 | 下一权限边界 |
|---|---|---|
| F06 placement fill/value | 两档以上 fill 差异可辨识；direct marginal terminal value 0/24 cells 一侧通过 | `closed_placement_distance_value_unidentified`，不建 Value/Action |
| F09 exact cooldown/inventory actions | variance-time、one-cycle、SELL-add price penalty、passive aggressive repair 等冻结动作未改善 assignment-to-terminal value | 关闭这些精确 action；不能外推成整个 temporal permission、inventory suppression 或 passive-repair 函数空间耗尽 |
| F09 成交强度加速保护的加仓侧动作 | 冻结 40 日改变 14.96% side decisions；terminal MTM -11.666288、已结束库存生命周期 -9.384488 USDC，fills +13.85% | primary value gate 失败；当时对照中的 global guard 保持不变，不晋级 directional successor；不声称它是 book-exhaustion BER |
| F04 BABEL-P1 | source-bound program 已完成 31 个 valid full windows、覆盖 30 个 distinct UTC days | 该历史记录不授予新的 capture authority |
| F04 BABEL-P2 | 26/7,786 outward changes，candidate rate 0.334%，只 6 个 add | mechanics 成功但 action support 不足；exact-opener runtime identity 需 successor，PnL 未读 |
| F10 live loss attribution | 240h 中 multi-level SHORT 集中损失，但库存深度是内生路径 | 不能从相关性直接推出 stop-add；已测试库存压制/repair 动作均关闭 |

这张表解释了为什么“胜率低、库存亏损”不能无限被带到证据基础设施上，也不能反过来跳过证据直接调 live。研究路由应先回答一个明确 PnL 问题；只有当 baseline parity 或 lifecycle 身份会改变该问题的 estimand 时，才暂停去修底层合同。BABEL-P1 已经达到 30 日 count gate；现在的 blocker 是冻结的 exact-lifecycle 与 statistical contract，不是继续收集更多日期，更不是为其他 cooldown、placement 或本地 fill-quality 研究恢复 live capture。

#### 连续日历回放是共享底座，不是第十一个策略族

新的 `restart_aware_calendar` 允许把 2026-06-01 至 07-30 的行情 gap 冻结成计划维护窗口：停机前停止新报价并等待 cancel terminal；gap 内不产生策略成交，但每个 arm 保留自己的 cash、position、entry price、economic 库存生命周期 与 MTM 风险；恢复后从新 snapshot、past-only warmup 和空本地订单簿启动。UTC midnight 不做任何隐含 reset。

这个 substrate 位于各 research family 之下，统一 calendar、restart、state carry 和 accounting；各 family 仍分别拥有 treatment、propensity、reward 与 hard gate。共享 substrate 的 authoritative tick-runner binding 仍 fail-closed，所以它本身还没有生成统一的 continuous PnL baseline，也不会把 Grade-B gap days 升级成 exact queue/lifecycle days。F05 后来完成的 corrected 71 日结果属于该 family 自己的 restart-aware modeled-queue runner；它是有效的 family diagnostic，但不是共享 substrate、strict queue 或 live transport authority。

当前合同与结果见 [causal-v12 v2 rescore](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f03_causal_13_head/docs/causal_v12_owner_amended_economic_rescore_v2_20260802.md)、[F05 current ledger](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/README.md)、[BABEL map](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f04_external_market_alpha/docs/babel_external_market_research_map.md)、[F09 README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_inventory_lifecycle_action_uplift/README.md) 与 [continuous replay substrate](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/shared/replay_lifecycle/docs/versioned_continuous_replay_substrate_v1.md)。

### 2026-08-12 历史 checkpoint：multichannel Boolean cooldown 当时检验了什么

这条研究最初要回答的是一个完整链条：在每次 exposure-increasing fill 时读取 decision-visible 的多尺度市场与生命周期状态，用有界 AND/OR/NOT 规则选择一次总 cooldown duration，随后在全天每个合法 fill 上重复执行同一 policy，并观察完整订单、queue、库存、库存生命周期 与 terminal PnL。reducing fill 不改，control 保持 `85s × consecutive fill units`。单次 fork 只能提供 $Q^{\pi_0}(x_t,\tau)$ 标签，不能把多个 fork 相加成持续 policy 的 PnL。

strict-native 历史标签路径先在数据可识别性处停止。41 个 formal-support days 的 raw snapshot/delta source admission 与 sequence audit 已通过，但 public trade 只有毫秒时间，而 book stream 在同一毫秒内包含更细事件；trade、book、activation 与 ACK 跨流没有共同序号时，历史输入不能确定谁先可见。首个正式日处理 5,058,417 个 events 后，八个 treatment arms 都在 suffix 遇到歧义，最终 0 日、0 panel 被接纳。系统没有重置失败计数或发明 tie-break，而是正确 fail closed，因此这个结果只关闭该 historical strict-label execution，不关闭 multichannel cooldown 问题。

随后另行冻结的 `owner_modeled_queue_v1` 是较弱且明确分开的 identity。它复用 40 日 modeled-queue one-shot panel，共 8,600 个 opportunities、实际 68,800 条 source arm rows；报告中的 120,400 是把 BUY/SELL duration vocabulary 合并后得到的 dense opportunity-action slots，不是额外运行了 51,600 条反事实。8,429 个机会有 point label，171 个保留 right-censored/unsupported 状态且未被插值；2025 provider 数据只提供 outcome-blind normalization、predicate threshold 与 support，所有经济标签仍来自 2026 Development。

该 successor 建了 R0、M0、M1、M2 四个 block，并执行 4 个 expanding outer folds × 3 个 inner folds。非 baseline 规则真实进入 outer OOF，动作率并非零；但实际 post-OOF 计算的是 14 个独立的 `panel × side × block` absolute cells 各自相对 `CONTROL_85N` 的 库存生命周期-weighted uplift。14 个 identified 95% LCB 全部低于 0，最接近的是 Prefix40 SELL R0：mean `+0.000194`、LCB `-0.000773` USDC/inventory_lifecycle-weighted opportunity，所以当前 any-cell finalizer 得到 `supported_sides=[]`。

这里必须保留一项实现审计修正：冻结设计曾写 M0 absolute → paired M1−M0 → paired M2−M1，并要求连续状态与 Boolean 的 paired comparison；owner 实现却没有计算这些 paired increments，而是让任一 absolute cell 通过即可支持该 side。Boolean search 也比一般多通道公式窄得多：每个 clause 最多 2 个 literals、每个 rule 最多 2 个 clauses、每个 block 最多 384 个候选，实际 outer-selected policies 都是 single-rule。因此准确结论是“这个固定 modeled-queue one-shot label、duration vocabulary、有限 Boolean search 和 absolute-cell selector 没有找到可晋级 policy”，不能写成“M1 对 M0 无增量”“M2 对 M1 无增量”或“一般 EMA Boolean cooldown 已被证明无效”。

训练/测试没有发现直接 outcome leakage：outer fold 只使用过去的 purged train rows，所有 train-arm washout end 都严格早于当前 test assignment，Validation 与 sealed holdout 未读。但分布并不均匀。M2 的 33 日是从 40 日中按 source completeness 选出的 common-support subset，不是连续的前 33 日；它有 6,991 个 opportunities、2.26% censoring，被排除的 7 日有 1,609 个、0.81% censoring，所以 M2 与 M1 只有在同一 Prefix33 denominator 上才可比较。171 个 censored opportunities 也明显集中于 BUY：BUY `142/4,499=3.16%`、SELL `29/4,101=0.71%`，其中 BUY add 为 `115/1,871=6.15%`；2026-06-13 一日占 36 个。完整连续特征 SMD/PSI 与 predicate prevalence audit 尚未完成，所以不能声称 train/test feature distribution 已经稳定。

在这个 2026-08-12 predecessor identity 的冻结晋级合同下，`supported_sides=[]` 使统一 policy、repeated-policy ABI、40/10/50 full-path、restart-aware 与 transport 阶段结构性停止，Validation/holdout 也保持未读；这不是漏跑一个当时已经合法晋级的 candidate。这个结论只描述该 predecessor identity，不能继续用现在时概括后来新建的 persistent-policy 与 full-multiscale successor。

权威来源与边界见 [strict-native failure](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/docs/causal_multichannel_window_boolean_cooldown_duration_v2_strict_native_formal_execution_failure_20260811.md)、[owner modeled-queue Development closure](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f05_fill_quality_quote_ev/docs/causal_multichannel_window_boolean_cooldown_duration_v2_owner_modeled_queue_v1_development_20260812.md) 与 [F05 current ledger](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f05_fill_quality_quote_ev/README.md)。

### Development 结果与证据范围

后续 `persistent-policy v3` 是新的 research identity，不是对 2026-08-12 predecessor 结果的补写。它实现 paired M0/M1/M2 hierarchy、更宽的 ordered rules、fold-distribution audit 与 shared UTC-day wild-max-t inference；两侧都未通过 M0 research gate，但 owner 另行冻结了一个 non-research-supported SELL M2 diagnostic policy，在 modeled-queue full-path 上继续做经济检查。

50 日 repeated-policy replay 相对 predecessor control 的 terminal MTM 改善 `+11.372165 USDC`、已结束库存生命周期 value 改善 `+9.747065 USDC`，fill retention 为 96.04%；但两个 primary intervals 都跨零，只有 24/50 日改善。corrected 71 日 restart-aware replay 的 terminal MTM 改善 `+16.877254 USDC`、已结束库存生命周期 value 改善 `+16.895254 USDC`，fill retention 为 97.66%，q10/CVaR 与最大库存 point metrics 也更好；但两个 lower bounds 仍为负，只有 26/71 日改善。这些是正 point estimates 与有效 diagnostic，不是 research hard-gate pass。历史 operational record 随后记录了 owner 显式接受 statistical、strict-queue 与 transport 风险，将 unchanged SELL policy 标成 `owner_risk_accepted_promotion`；这只说明当时的权限来源。

更晚的 full-multiscale offline successor 使用 30 个历史 Development days、3,516 个 opportunities 完成 nested chronological search。BUY E3 是最强 point candidate：相对 baseline 的 terminal value 差为 `+0.458577 USDC/day`、已结束库存生命周期 value 差为 `+0.604012 USDC/day`，fills 下降 2.71%，四个 outer-fold means 全为正。但 candidate 自身的 terminal value 仍约为 `-2.445540 USDC/day`；`+0.458577` 是“少亏”的相对差，不是盈利。相对 action-matched control 的 extra increment 为 `+0.193888 USDC/day`，这可以排除“仅因为少成交”的纯数量解释；但 semantic interval 仍跨零，所以不是因果确认。simultaneous day lower bounds 与 frozen feature hierarchy 也失败；SELL 没有正 non-baseline candidate。研究结论因此仍是 `research_supported=false`，Validation 与 sealed holdout 未读，不能从这些 Development 数值生成 经验证的动作收益或实盘有效性。

随后的历史 operational record 记录，owner 以 outcome-informed override 把 BUY E3 用于 exposure-increasing BUY executed fill。这个决定必须标记为 owner-risk exception，不能倒写成上段 scorecard 通过。公开 v13 只提供历史 locator prerequisite；mechanics-safety successor 只提供 30 日 reduced-support exact BUY E3、exact SELL B0、D+1 B0 与共同 `pause_exposure` overlay 的 mechanics resolution；冻结 v12 50 日结果只作为旧 mechanics 下的 stale historical comparator。精确现役 owner policy、配置和 EC2 进程依赖必须从私有 release manifest 与实际主机状态确认，不由本文公开。

## 结论：窄门不是参数，而是证据门槛

NarrowGate 从一个 AS 公式实验，走到了数据审计、跨市场冲击归因、逐侧 quote EV、库存时间积分、opportunity/executable 两层 null baseline、order-level denominator、版本化 100ms L2、causal artifact lineage 和 randomized action uplift。这个过程不断推翻自己的旧答案：更多 reference 不会自动带来更好 policy，严格的时钟与 lifecycle 会改变结论，score 能排序部分 markout、模型 A/B 中心为正，也都不代表固定 widen/recenter/skip/cancel action 已有正 value。

最初的问题因此被越问越窄：不是“能不能预测 BTC”，而是“在这一侧、这个价格、这个盘口和这段库存暴露下，采取某个明确 action 是否比当前 baseline 更好”。两层 null baseline 检查 selection gap 是否存在，side-specific scorer 检查 decision-visible state 能否排序，randomized 或严格 paired action panel 才检查改变报价后、经过 queue 和后续库存路径的增量 value；三者不能互相替代。

30 日 mechanics-safety successor 只定义 reduced-support mechanics comparator；v12 50 日 compatibility identity 是 daily-fresh-start、queue-disabled 且在账本/费用/inventory_lifecycle/spread/fill-order 修复后已经 stale 的历史 comparator，其 absolute PnL 为负，不应被写成 current economic/control default、continuous-live、strict order-path 或 实盘有效性证据。F06 已走到 direct marginal terminal value 后关闭；F09 成交强度加速保护的加仓侧动作、若干 cooldown、库存压制、被动 repair 与 symmetric fair-center 等**精确动作**也已关闭，但这些阴性结果不能扩大成整个库存控制、recovery 或 state-to-duration 函数空间已耗尽。

multichannel Boolean cooldown 现在提供了更完整、但仍有限的答案。strict-native 历史标签仍因 same-millisecond ordering 不可识别而停止；2026-08-12 的受限 one-shot selector 没有晋级。后续 persistent SELL policy 在 modeled-queue 50/71 日 full-path 上得到正 point estimates，却没有正 lower bound；full-multiscale Development 的 BUY E3 也有跨四 fold 的正 point signal，却未通过 simultaneous lower-bound 与 feature-hierarchy gates。owner 可以显式接受这些未闭合风险并部署，但研究文章必须继续把 prediction、diagnostic economics、research-supported promotion 与 owner operational authority 分开。

下一扇窄门不是预设某个模型名字，而是要求同一个问题同时具备：decision-visible state、与主张匹配的 lifecycle/queue authority、当前 baseline 的 full-path counterfactual、assignment 后的 已结束库存生命周期 USDC value、明确的 state carry/restart 语义和不可补偿 tail gate。预测排序、低 candidate rate、更快减仓、较小库存或更漂亮的 day-end MTM，都不能单独替代这条因果链。

这可能也是“窄门”最贴切的地方。一个研究系统的成熟，不在于它接入了多少模型和数据源，而在于它愿意用多少层约束拒绝一个看起来很诱人的结论。

---

本文及 NarrowGate 项目仅用于市场微观结构、价格行为学、做市模型、机器学习回测方法和系统工程的学习交流与技术研究，不构成财务、投资、法律或合规建议。中国大陆关于 crypto 交易及相关业务活动的监管环境具有不确定性；任何人将相关代码用于连接交易平台、交易、商业展业或投资决策，其合规风险、资金损失、技术故障及其他后果均由使用者自行承担，与作者无关。
