---
title: 'NarrowGate：回测吞吐与 Live 尾延迟工程'
date: 2026-07-01 08:03:00
updated: 2026-09-27 10:45:00
categories:
- C++
tags:
- C++
- 低延时
- pybind11
- Market Making
- 系统工程
math: true
---


做市系统的工程目标不只是更快地算出报价，还要让行情可见性、订单生效和账户记账在回放与实际运行中各有清楚定义。本文讨论共享计算内核、事件调度和尾延迟测量；接口测试、有限组装与完整经济评价分别说明，不互相替代。

## 执行协议与工程证据范围

下文 9 月 6 日及更早快照、测试计数和 benchmark 保留原日期，不能读作今天的测量。当前 `strategy.live_public_signal.LivePublicSignalEngine` 的 execution_v1 路径消费 individual `@trade` 与 depth，通过共享特征生成已就绪 FeatureFrame，加载当前 13 头及后处理；该入口拒绝 aggTrade，关闭旧 native feature/inference 路径。它不是旧 causal-v12 固定 10000ms 桶说明的直接延续，也不表示所有 live 入口都已改用 individual 或全部 C++ 已停用：native 报价与 native 模型推理是不同能力，部署状态仍由具体运行证据确定。

维护中的 Python ConsumerBundle 回放已有绑定输入／配置／源码的完整状态恢复；F06/F07 规则状态测试和一个原生 BUY/SELL 冷却启用的完整开发账户恢复已在声明范围内验收。这不是任意跨版本／主机、完整 C++ 主循环恢复或 CIF/hazard 科学研究完成。隔离 Linux 候选的有限真实观察→13 头→P3→native 报价→无交易能力记录意图组装已验收，但不代表已激活或当前 live 身份。详见[维护架构及验收范围](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/docs/architecture.zh-CN.md)。

## 从计算内核到完整运行路径

这篇文章是 NarrowGate 的工程篇，接在算法篇 [《NarrowGate：Maker Quote EV、Order-Level Evidence 与 Causal Action Uplift》](/2026/06/19/NarrowGate-Maker-Quote-EV-Research-Framework/) 后面。算法篇回答“maker quote 应该验证什么”；本文回答“这些验证如何被工程化成可重复的 replay、可审计的 live hot path，以及可解释的延迟预算”。

> **版本边界（2026-09-06）**：本文保留工程结构、parity 方法与历史 benchmark，但所有数值必须按小节日期阅读。9 月 2 日 terminal-continuation 的匿名化聚合观测不是今天的实测值、长期 SLA 或 PnL 证据。公开代码不包含私有当前 release manifest、精确 live config 或进程状态，不能据此推断现役开关。最新源码已整合进 main，但完整日执行器的分源交付与计算耗时接入尚未完成，也尚未产生这一环境下完成的 B0 或候选经济结果。历史 F05 失败结论与 owner 风险试验分别保留，代码修复不将它们改写成研究通过。

### 历史执行修复与性能测量（2026-09-06）

本轮已经公开的 [native 接口精简](https://github.com/xiao-nanbei/NarrowGateMaker/commit/13d44967) 把内部 C++ Bar 和配置字段当成明确接口：缺字段不再补零或跳过，已选 native 后的计算异常直接暴露；测试 fixture 补齐正式依赖，私有流 generation 未绑定时不再假定安全。为日志重复验证模型包的工作也改为复用已验证 metadata。[部署环境元数据读取修复](https://github.com/xiao-nanbei/NarrowGateMaker/commit/db0122cd) 则处理 root-private 文件的受限检查。这些是维护性和正确性修复，不是新的实盘延迟测量。

新的 REST 异步响应路径与 7 月已经关闭的 per-side latest-wins 实验不同：普通报撤仍使用一个 GLOBAL FIFO，同一时刻不增加网络请求并发，只将等待 response 与决策执行分离。队列中尚未发出的请求也占有订单生命周期；私有终态提前可见不能令尚未返回的 HTTP 请求凭空结束。协议比较必须另外进行，不能把异步化、双侧并发和 REST→WebSocket 同时改变后，把结果归因于某一项。是否在特定 live 进程启用仍需私有运行记录确认。

Replay 必须分别推进行情产生、各源消息到达、特征完成、决策计算、FIFO 等待、请求发出、订单 exchange-effective、HTTP 返回和私有回调可见这些时钟。多个阶段重叠时，不能重复叠加；同一次请求的 effective/return 样本要成对保留，不能把 RTT 一律除以二。IOC 尤其需要区分“交易所已经减仓”和“本地账本还未收到可见成交证明”：前者限制真实剩余可成交量，后者决定策略何时更新库存、费用和冷却。[本轮合并](https://github.com/xiao-nanbei/NarrowGateMaker/commit/5672e838) 已在 Python replay 中实现这项分离：交易所激活时扫盘一次，HTTP 返回释放串行 worker，本地账本等到成交可见才推进；同步 close 调用者仍按其真实调用语义等待响应和成交证明。C++ IOC trace 也改用交易所激活时间，而不是下一笔历史 trade 的时间。

撮合与通知分离后，策略可见现金／库存按本地通知推进；经济成交事实在撮合处独立记录，并用于完整经济结算，含账户终点前已撮合但尚未通知的成交。本地通知日志不是全账户物理撮合顺序，两套账户在通知未到齐时不必相等。旧通知日志不能靠排序变成新撮合事实。

另一个值得做的减法是 [复用 lifecycle 持久化实现](https://github.com/xiao-nanbei/NarrowGateMaker/commit/249a2549)：strict-native writer 不再维护一份近乎相同的持久化代码，正常回调采用增量提交，不再每次扫描全部历史 part；启动、失败恢复和最终完整性检查保留。恢复必须先于读取 cursor 和准备新 batch，这样减少的是重复工作，不是崩溃恢复保障。

合并后的默认全套测试为 **4,853 passed、18 skipped、15 deselected**，本机重新编译的 C++ 也参与回归。这证明所覆盖的接口与状态机没有回归，不是 x86 性能测量，也不代表完整 C++ 异步 scheduler 已经可替代 Python。当前缺口是把逐源消息交付和 cached/new-bucket/catch-up 计算耗时接到完整日 runner；已接通的 gateway-only diagnostic 不能换个名称就当作当前 B0。本轮没有新部署，也没有新的实盘 p99 或经济结果。

完成执行路径后，下一轮先建立当前 B0，再比较新增风险前的 quote/wait、挂单中的 keep/cancel、恢复后的 add/continue-wait。两臂保留相同事后保护和外部延迟抽样规则，但分别形成自己的订单、FIFO 等待、成交和库存路径。不能因为 native 更快，就用缺少这些时钟的旧 C++ 路径代替；也不能用旧 50 日或 71 日金额填充新的 baseline。详细研究边界见 [时间尺度与因果复验](/2026/08/29/NarrowGate-Time-Unit-Causality-Repair-Research/) 和 [研究项目地图](/2026/08/29/NarrowGate-Research-Project-Map/)。

以下十条仅概括 2026-09-06 的历史工程快照，现行入口差异见上文：

1. 13-head causal-v12 在每个**已完成的 10 秒桶**刷新一次，桶间 sample-and-hold；它不是 100ms 订单生命周期模型。
2. `live_10s_signal_cutoff.v1` 已修复“下一桶第一根 1 秒 bar 进入上一桶特征”的因果越界；`features/feature_dag.py` 校验 graph、unit、clock、cadence 与 label namespace，但还不是自动生成所有 Python/C++ 特征实现的动态 DAG executor。
3. `simulate_tick_arrays_ext_policy_v3` 仍是基础 formal ABI，但当前 Python dispatcher 会按功能合同选择 v4、v5、v6 或 v7；较低层的 `simulate_tick_arrays` 和 `bench/` 脚本仍只属于 binding、benchmark 与回归测试面。研究权限来自调用方冻结的数据、时钟、参数和 family contract，不来自“版本号更大”本身。
4. 50 日 `native_derived_top20_100ms_cpp_daily_fresh_start_diagnostic` 是冻结但已经 stale 的 v12 historical comparator，不是今天的 economic/control default 或 operational policy。它使用历史 trades、BBO 和规范化 top-20/100ms L2，但 native raw snapshot/delta queue scheduler、订单/撤单延迟和 receive-time visibility 都关闭；账本、费用/campaign、spread-cap 与同时间成交顺序修复后，不能把旧 50 日行为继续叫作 current live 或 E3 mechanics default。
5. strict-native + sampled-latency successor 已在 2026-06-29 完成一日机制验证，真实消费 raw snapshot/delta、执行 19,460 次 queue lookup 且 missing=0；完整 50 日尚未运行，一日差异不能外推成 50 日修正方向。
6. native queue scheduler 在 exchange clock 上使用公开 MBP snapshot/delta、exact price-level seed、individual-trade consumption 与 cancel-ahead 模型；它不是交易所订单 ID/FIFO 真值。同毫秒 trade/book/activation/ACK 若没有共同序号，必须显式标记歧义或 fail closed，不能偷偷发明顺序。
7. Binance BTCUSDC execution-feed 路径使用 `depth20@100ms`、`aggTrade` 与事件驱动 `bookTicker`；代码另提供可选的 REST snapshot + diff-depth active-order deep book，是否启用不能从模块存在推断。公开数据仍是 price-level L2/MBP，历史 individual trades 只能改善历史 queue consumption，不能补出真实逐单排队。
8. `continuous_replay_state.v1`、restart boundary、continuous accounting 与分层 cache DAG 已形成共享底座；共享 substrate 的 authoritative full-tick-runner binding 仍 fail-closed。F05 后来完成的 71 日 restart-aware modeled-queue replay 是 family-specific runner 的诊断结果，不能反向证明共享 substrate、strict queue 或 live transport 已统一接通。
9. 该历史 F05 cooldown 研究产物只支持 `supported_sides=[]`，不代表当前整个 F05 没有可运行消费者；历史 owner override 是另一种权限来源，不是 research pass，也不能用来推断当前 EC2 究竟依赖哪些代码。
10. 公开 v13 只治理历史 locator；mechanics-safety successor 只定义 30 日 reduced-support paired mechanics comparator；v12 50 日结果只作 stale historical comparator。research、mechanics、owner operation 和 latest-liveness 四层权限不得互相上升。

项目源码与构建入口：[GitHub - xiao-nanbei/NarrowGateMaker](https://github.com/xiao-nanbei/NarrowGateMaker)。公开配置是安全研究模板，不是当前私有 live 参数快照。文中的 `blob/main` 链接只用于导航；复现某个冻结结果时必须使用该结果绑定的 commit/tag、run manifest 与 artifact identity，不能把会继续滚动的 `main` 当成证据快照。

### 2026-08-29 报价核心的语义边界

C++ 并不会让一个代理变量更接近论文对象。Python/C++ parity 只能证明两套引擎执行了同一实现；如果两边都把 touch 斜率当成 execution-intensity 斜率，parity 会稳定复制这个语义错误。

| 历史名称 | 代码实际计算的对象 | 不能冒充的论文对象 |
|---|---|---|
| `microprice` | `m_w = mid + ((Q_b-Q_a)/(Q_b+Q_a)) * spread/2` 的 weighted-mid proxy | 通过订单簿状态转移估计 <code>E[S_(t+h) &#124; LOB state]</code> 的 Stoikov micro-price |
| `p3_kappa_eff` | 10 秒 `P_touch(delta,x)` 的局部距离斜率所投影的 legacy ABI 值 | `lambda_exec(delta) = A exp(-k_exec * delta)` 中的 execution-intensity slope |
| depth-kappa | top-N 深度相对 baseline 的有界 liquidity multiplier | 从距离–成交到达强度标定出的 `k_exec` |
| `ber_*` | trade-intensity fast/slow EMA ratio 与其保护逻辑 | Zhao–Linetsky 的 book-exhaustion rate |

报价核心也应称为 **AS-shaped empirical controller**，而不是一个已完整校准的 AS/GLFT 实现。若显式使用订单量 $z$，一个数量闭合的近似式应写成：

$$
\psi(z)\approx \gamma z\sigma^2\tau
+\frac{2}{\gamma z}\log\!\left(1+\frac{\gamma z}{k_{\mathrm{exec}}}\right).
$$

历史 quote core 没有在对数项中显式引入 $z$，而是通过 `inventory_reference_qty`、`eta_inventory`、`a_spread` 与 legacy `gamma` 做工程缩放。这可以是冻结策略的 ABI，但它没有自动获得 BTC→mBTC、USDC→cent 的 denomination invariance。

时间上也有四个不同的时钟：`60×1s` 是方差 lookback，`quote_horizon_s=1s` 是风险积分期限，报价更新/存活约为 5–10s，P3 label horizon 是 10s。**60×1s 方差的实践量纲正确，但固定 1s risk horizon 与 5–10s 报价寿命、10s P3 仍有经济期限错位**。合理的下一步是对 `lookback × risk horizon × gamma/eta/a_spread` 做成对 chronological replay，而不是因为量纲表面通过就假定经济期限已对齐。

最后，公开仓库的代码、聚合 scorecard 和 receipt 足以审计许多失败门槛，但精确 OOF rows、cache 与 owner artifacts 未分发。所以第三方可以核对“为什么没晋级”，不能独立重算全部数字；这是公开可审计，不是端到端公开可复现。

离线侧的低延时，本质是把严格 replay 从“只能抽样验证”推进到“可以按日、按窗口、按参数臂系统验证”。它关注 wall time、rows/s、windows/hour、内存峰值、路径一致性和结果可重复性；单个函数调用的尾部延迟只有在暴露 fallback、分配、swap 或过度订阅时才有解释价值。

在线侧的低延时，是让报价、撤单和库存控制在真实事件循环里尽量少出现 stale quote、late cancel、跨语言 fallback 和偶发尖刺。这里必须看 mean、p99、p99.9、CPU migration、page fault、context switch、fallback 计数和长样本 soak。

这两个目标最终都服务同一件事：让 maker 策略的 spread、skew、TTL、cooldown 和库存风险控制，可以在足够多反例里被验证，也可以在 live 中按预期执行。低延时不是独立于 alpha 的炫技，它是策略工程化后必须面对的执行条件。

到 2026-07-10，项目里的工程边界又收紧了一层：tracked `live/config.yaml` 只保留公开模板，私有 live 参数通过 `NARROWGATE_LIVE_CONFIG` 注入；仓库补了根级 `pyproject.toml`、`narrowgate` CLI、CI、Docker/devcontainer 和 5 分钟 quickstart。这个变化不是“文档好看一点”，而是把低延时研究从个人实验推进到可复现边界：别人应该能跑通 quote demo、smoke test 和 public replay skeleton，但不应该拿到私有基础设施、模型快照和实盘参数。

同一时期，C++ replay 也从“小窗口 parity 工具”推进成 active-parameter fast screening engine。queue side/regime calibration、replace throttle/pending coalesce、reducing-side cooldown、adaptive add cooldown、campaign soft control 和 BUY fill-selection score 已经进入 native 参数结构与状态机；这里 2026-07-06 的旧代 soft-keep probe 与 2026-07-25 的 causal-v5 都只是各自时点的 rolling baseline。每次宽搜索仍必须先用**运行当日解析出的 operational baseline identity**过 Python/C++ parity gate，不能继续把当时的 ML-OFF 当成永久控制组。`xmarket_retreat` 的执行入口已经物理删除，只剩 legacy audit reader 可以解释旧日志列；逐样本 empirical REST latency，以及 user-stream mismatch / sync-adjust 这类只有实盘才存在的故障闭环，仍不能由历史 C++ replay 凭空恢复。

2026-07-17 的 checkpoint 又补齐了两个关键边界：Python/live 的 `evaluate_common_side_policy()` 与 C++ replay 的 `evaluate_common_side_policy_cpp()` 对 BUY/SELL 使用同一输入/输出契约和行为测试；旧代 BUY soft-keep scorer 的 causal 静态特征通过 ABI v3 进入 native replay，不再只传 quote-time 动态字段。全仓测试为 `355 passed, 4 skipped`（该数字绑定 2026-07-17 当时的代码快照），May normal/high、Feb sparse、Jan A/B 四个 real-data golden 均通过。这个结果允许 C++ 承接已 parity 参数面的 fast screening，但不等于 queue cancellation-ahead、逐请求 REST latency 或 live-only 故障已经被历史数据识别。

2026-07-18 的研究 checkpoint 又把证据身份收紧了一层。causal-v4 使用完成后的 10 秒桶、merged event clock、empirical P3、显式 queue/REST-latency artifact，形成 122 日 order-level denominator；新 13-head bundle 与 causal-v4 `non_toxic` / `beats_opportunity` 两个 rebuilt BUY scorer 都只保留为 shadow，没有替换旧代 live soft-keep probe。固定的 BUY widen、SELL re-center/skip 等 local action family 也没有通过冻结的 development/validation gate，sealed holdout 未读取。下一步改为使用 event-L2 研究 local shock/refill/recovery 与 state-conditioned queue-value，而不是继续扫固定 tick/秒数。这说明系统可以把验证跑得更快、更细，但不能替策略证据补票。

2026-07-25 又完成了一轮纵向重建。正式 L2 输入迁移到版本化的 `normalized_l2_100ms_v2`，旧的约 1 秒与 100ms 混合目录退出 formal 默认路径；2026-07-04 至 07-11 的 individual-trade maker-side 标志也完成修复。基于这一身份，causal-v5 重新生成 128 日特征、重训 13-head bundle，并在严格 ML-ON/OFF replay 中取得小幅正的 raw/terminal 中心值，但区间仍跨零、fills 下降约 7% 至 9%，inventory time 没有改善。它随后按用户指定进入 live，promotion class 明确记录为 `user_directed_trial`，不是通过研究 strict gate 的 alpha。

随后 causal-v9 将数据延伸到 2026-07-25，并修复 mutable taker-tempo lineage。正式 Test3 中 ML-ON 相对 ML-OFF 的 raw/terminal 分别为 `-2.2308/-2.6268 USDC`，tail 增加 3 个，三个 formal days 的 raw delta 全部为负，因此没有部署；**截至 2026-07-28**，live 回到 `ml.enabled=false`，empirical P3 保持不变。该快照的全仓测试为 `917 passed, 4 skipped`。这证明两套引擎能执行同一 corrected baseline，不把模型可加载、一次历史部署或预测 ranking 包装成现役 alpha；它已被上面的 2026-08-03 v7 baseline 状态取代。

本文只讨论工程实现，不讨论也不建议任何真实交易行为。所有 PnL、fill、markout、A/B 和 benchmark 都是研究指标或系统指标，不是收益承诺。

| 场景 | 目标 | 主指标 | p99/毛刺的用途 |
|---|---|---|---|
| ARM 本机回测 | 多日、多臂、多窗口跑得动且可复现 | wall time、rows/s、windows/hour、parity、内存峰值 | 排查 fallback、分配、swap、过度订阅 |
| x86 live | 单事件路径稳定、报价不过期、撤单不迟到 | mean、p99、p99.9、fallback、migration、fault | 核心指标，必须长样本 soak |

## 第一部分：ARM 本机回测低延时：吞吐、确定性与 parity
到这里，maker 算法部分已经形成了一个闭环：候选报价、排队成交、fill 后 markout、cross-market attribution、quote EV 校准和库存时间积分。但这个闭环一旦严格起来，工程问题就不再是“以后再说”的附属项。因为每一次反例验证都要重新跑真实窗口、真实队列和真实 policy state，系统吞吐量本身会决定研究能不能继续。

这一部分是算法和 C++ 之间的桥。它回答的不是“怎么写 native 代码”，而是“为什么验证流程会需要 native 状态机”。

### 1.1 严格 replay 为什么会变成吞吐问题

NarrowGate 的 tick replay 不是拿下一根 K 线 high/low 判断是否成交。为了尽量接近 maker 的执行过程，它需要模拟：

- 历史 BBO 与 L2 best bid/ask；
- exact-level queue ahead；
- new order latency 与 cancel latency；
- maker fill gate；
- final spread cap；
- adverse/defense guard；
- flat、fragile、adaptive TTL 与 cooldown；
- local extreme guard；
- position timeout 和 emergency path；
- 库存时间积分与完整 trace。

这些机制大多是高频、顺序相关、状态明确的循环。Python 写起来灵活，但每一个策略臂都重复读取数据、更新 queue、计算 quote、写 summary。做多日多臂 A/B 时，真正耗时的并不是 LightGBM 训练，而是一次次 replay 和 quote context 生成。

还有一个比速度更重要的问题：如果某个 guard 只存在于回测，或回测拥有事件引擎没有的 queue/TTL 信息，那么回测会比实际策略“更聪明”。此时加速一套不一致的模拟，只会更快地产生错误信心。

前面的数据审计、日度 A/B、strict calibration gate 都指向同一个现实：这类策略不能靠一两个漂亮窗口下结论，必须反复跑多个真实日段、多个 side policy 和多个风险口径。也正是在这里，Python 循环从“足够灵活”变成了研究吞吐量的瓶颈。

所以 C++ 迁移的第一目标不是孤立的微基准数字，而是让更严格的验证在时间上可负担；第二目标是建立同一批真实数据下的 Python/C++ parity，并借此把 policy 边界显式化。若两套引擎不能解释同一条成交路径，跑得再快也没有研究价值。

### 1.2 双引擎 parity：不是相信 C++，而是让 C++ 持续被 Python 审讯

Python/C++ 双引擎最容易做成两套系统：Python 负责研究，C++ 负责速度，最后两个结果不一样，却不知道是策略变了、浮点误差、时间戳 as-of 边界，还是 C++ 少实现了一个 guard。

NarrowGate 里我采用的原则是：**Python 仍然是研究口径的 reference implementation，C++ 必须在同一批 normalized arrays 上被持续审讯**。

parity 只能证明两套实现执行了同一组模型假设，不能证明这些假设正确。exact-close 曾被 Python/C++ 同时误标为 exposure-increasing，正是“两边一样但语义仍错”的直接反例；因此 parity 之外仍需要数量感知的库存角色、账本不变量和经济反例审查。

![同一段 K 线上的 Python 与 C++ 报价 parity](/images/narrowgate/python-cpp-parity-kline.svg)

*机制图：在完全相同的 normalized arrays、状态、参数和事件顺序上，Python 圆点与 C++ 加号应落在同一条 bid/ask 轨迹。重合只证明两套引擎执行了同一实现；`touch ≠ fill intensity`、weighted-mid proxy 与 microprice、数量单位和时钟闭合仍需独立语义审计。图为合成示意，不是 benchmark 或 live 证据。*

这张 K 线图把 parity 的边界画得很直接：如果某根 candle 到来后 Python 撤 bid 而 C++ 仍保留，路径已经分叉；如果两边同时在错误的语义下撤掉 bid，轨迹仍会完美重合。前一种问题由 parity 抓，后一种问题只能由模型 contract、单位测试与经济反例抓。

这里的 “parity” 不等于所有浮点数 bitwise 完全一致。tick replay 里有成交价、PnL、markout、inventory time、rounding、latency gate 等连续变量，要求 bitwise 一致反而会把工程带偏。真正重要的是三层断言：

1. **路径级断言**：fill 数、bid/ask split、最终库存、订单状态迁移、trace 行数必须一致或可解释；
2. **金额级断言**：PnL、InvAdj、inventory time、spread summary 用很小 tolerance 对齐；
3. **边界级断言**：NaN、缺盘口、长 gap、pending cancel fill、同 timestamp 多事件排序必须 fail fast 或有显式规则。

整个流程可以概括成这样：

```text
Parquet/CSV/raw logs
        |
        v
Python loader: timezone, int64 timestamp, tick/lot rounding, bad segment mask
        |
        v
Normalized NumPy arrays
        |
        +--------------------+
        |                    |
        v                    v
 Python replay          C++ replay
 reference              strict engine
        |                    |
        +---------+----------+
                  v
        summary + trace comparator
```

伪代码大概是：

```python
def assert_replay_parity(window, params):
    arrays = load_window_as_arrays(
        window,
        timestamp_dtype="int64_ms",
        price_dtype="float64",
        drop_bad_quality_segments=True,
    )

    py = simulate_tick_python(arrays, params)
    cpp = simulate_tick_cpp(arrays, params, strict=True)

    # 路径级：这些不应该靠 tolerance 蒙混过关。
    for key in [
        "fills_total",
        "fills_bid",
        "fills_ask",
        "final_inventory",
        "n_requotes",
        "trace_rows",
    ]:
        assert py[key] == cpp[key], key

    # 金额级：允许浮点末位误差，但不允许经济含义变化。
    for key in [
        "raw_pnl",
        "inventory_adjusted_pnl",
        "abs_inventory_time_s",
        "avg_final_spread_bps",
    ]:
        np.testing.assert_allclose(
            py[key],
            cpp[key],
            rtol=1e-8,
            atol=1e-8,
            err_msg=key,
        )
```

这里踩过的坑很多，而且大多不是 C++ 语法问题：

- **时间戳必须是整数**：不要在 hot loop 里用 float seconds。Binance、CryptoHFTData、内部日志可能混用毫秒、微秒和 ISO 字符串，先统一到 `int64`。
- **as-of 边界必须一致**：Python `searchsorted(..., side="right") - 1` 和 C++ `upper_bound - 1` 要写成同一条规则，否则刚好落在 book update timestamp 上的订单会错一格盘口。
- **tick rounding 必须单点定义**：`floor`、`ceil`、`round` 在买卖两侧含义不同，不能 Python 一套、C++ 一套。
- **NaN 不能“顺手补 0”**：spot/reference/orderbook 缺失时，应该进入 quality mask 或 segment reset，而不是让 C++ 默认值悄悄参与训练和回放。
- **pending cancel fill 要显式建模**：订单发出 cancel 后，在 cancel latency 到达前仍可能成交。Python 如果已经把它当撤单、C++ 还把它当 live order，fill path 会马上分叉。
- **模块来源要 strict**：两个项目都叫 `narrowgate_cpp` 时，同一个 venv 可能 import 到另一个 repo 的扩展。strict 模式下必须检查 `narrowgate_cpp.__file__`、字段 shape 和 ABI version。
- **函数存在不等于 ABI 一致**：一次 x86 部署中，旧 pybind 模块仍有 `compute_quote_core_live`，但返回的 `QuoteFlags` 缺少新字段 `cap_exposure_block`。只检查函数名会在第一轮 quote 才失败；当前启动 preflight 同时实例化 `QuoteFlags`/`SideQuoteContext` 并核对字段 contract，旧扩展会在连接行情和报单前被拒绝。

所以双引擎 parity 的本质不是“我把 Python 翻译成 C++ 了”，而是建立一套制度：**每次 C++ 多迁一个状态机，都必须先在小真实窗口里通过路径级和金额级审讯，然后才允许进入 sweep/A/B**。

截至 2026-07-17，完整窗口中最后两处 drift 也已关闭。第一处是 Python 漏计 post-policy-only spread-cap compression，导致 `final_cap_compress_rate` 与 C++ 不一致；第二处是 C++ 旧 helper 只看 shallow depth，可能在 exact L2 深度充足时错误施加 `1.1` thin-depth multiplier。修复不是放宽 tolerance，而是让 Python 与 C++ 的等价 evaluator 对 BUY/SELL 产出相同的 spread、size、hard-pause 和 exposure allow 语义。四个 real-data golden 现在同时核对 summary、PnL path、fills、inventory-time 与 trace 长度；相关边界记录在 [live/replay parity report](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f10_live_replay_attribution/docs/live_replay_code_parity_20260717.md)。

但历史 `compress` parity 不能把它升级成安全默认。当前 mechanics-safety default 使用 `pause_exposure`：当风险要求的点差超过边界时，停止 exposure-increasing quote，而不是把危险报价向内压；`compress` 只保留为显式研究兼容 arm。exact close 与 partial reduce 不施加 adverse widening 或 size reduction，只有开仓、同向加仓和穿越零点后的 opening remainder 才属于 exposure-increasing。

### 1.3 Queue Ahead：回测要保守，但它不是实时系统

bar 回测最容易自欺欺人的地方是：只要下一根 bar 的 low/high 碰到我的价格，就认为成交。maker 策略里这几乎一定会高估结果，因为真实世界里还有队列。

NarrowGate 的 tick replay 更保守：价格碰到只是必要条件，不是充分条件。订单进入盘口后，需要估计自己前面的 queue ahead，然后用后续 aggressive trade 去消耗这个 queue。

简化逻辑如下：

```python
def activate_order(side, quote_px, activation_ts, l2_book):
    level_qty = l2_book.visible_qty_at(quote_px, activation_ts)

    if level_qty is not None:
        # 保守假设：自己排在当前可见 level 的后面。
        queue_left = level_qty
    else:
        # 没有可靠 L2 时，用距离 mid 的衰减模型兜底。
        distance = abs(quote_px - mid_at(activation_ts))
        queue_left = queue_base * math.exp(-queue_decay * distance)

    return LiveOrder(side=side, price=quote_px, queue_left=queue_left)


def process_trade(order, trade):
    if not trade_crosses_order(trade, order):
        return

    aggress_qty = trade.qty

    # 先消耗排在我前面的可见队列。
    consumed_ahead = min(order.queue_left, aggress_qty)
    order.queue_left -= consumed_ahead
    aggress_qty -= consumed_ahead

    # 只有 queue ahead 被打穿后，剩余 aggressive qty 才可能打到我。
    if order.queue_left <= 0.0 and aggress_qty > 0.0:
        fill_qty = min(order.remaining_qty, aggress_qty)
        fill(order, fill_qty)
```

这当然仍然不是“真实交易所撮合队列”。历史 Top-N 深度看不到三件事：

- 这个 level 内部每个订单的真实排队顺序；
- 其他参与者在你前面的撤单；
- 你的订单到达交易所前，level 已经变化了多少。

所以“不自欺欺人”的做法不是假装知道这些，而是把不可观测部分分成两类：

1. **保守规则**：默认排在可见 level 后面，不因为看见 level 变小就自动认为前面的人都撤了；
2. **校准参数**：用 live/order log 反推 queue model、new/cancel latency、fill gate，让回放的 placed orders/day、fills/day、side split 和 live 同数量级。

如果只用 Top-N L2，queue ahead 永远是估计值，而不是事实。因此 replay 结果要同时报告：

- placed orders/day；
- fills/day；
- fills / placed order；
- cap/guard/pause rate；
- active-trade-day fills；
- quality-day fills；
- full-calendar-day fills。

这样才能区分“成交概率模型太保守”和“策略根本没有挂出足够多订单”。前者是 queue/fill calibration，后者往往是 guard/pause/requote gating 的问题。

#### 1.3.1 用 live 指标校准 queue，而不是只看 fills/day

Top-N 历史盘口看不到隐藏单、真实 order id 排序、你前方订单撤单和交易所撮合内部细节。Queue Ahead 的价值不是“完美复现撮合”，而是避免 bar touch 那种最危险的乐观假设，并把不可观测部分留给 live calibration。

如果要判断 queue 模型是否太保守或太乐观，不能只看 fills/day，要同时看：

| 指标 | 解释 |
|---|---|
| placed orders/day | 策略是否真的挂出了足够多订单 |
| fills/day | 最终成交频率 |
| fills / placed order | queue/fill 概率是否和 live 同数量级 |
| bid/ask split | 是否一侧被系统性高估 |
| queue_left at fill | 是否经常“刚好被打穿” |
| pending cancel fill count | cancel latency 下是否仍然能被打 |

如果 fills/day 低一个数量级，但 fills/order 与 live 接近，问题往往不是 queue，而是策略在回测里被 guard/pause 挡掉了太多 quote。这个区别非常关键。

> **本节工程结论**
>
> - 严格 tick replay 的价值不是“更复杂”，而是阻止 bar 回测把触价误判成成交。
> - Python/C++ 双引擎先做 parity，再做 sweep 加速；路径不一致时，速度没有意义。
> - A/B 不能只比最终 PnL，还要比 fills、bid/ask split、final inventory、InvAdj、inventory time、spread/cap 和 trace 行数。
> - replay、queue、TTL、latency、guard 是强顺序状态机，适合一次 C++ 调用跑完整窗口；pandas IO 和训练编排继续留给 Python。

### 1.4 Native replay 与 batch API：一次跨边界跑完整窗口

从这里开始才进入 C++。前面的 maker 章节回答“应该验证什么”，这一部分回答“哪些计算形态适合迁移、迁移后如何保证和 Python 口径一致”。因此它不会把下载、pandas 清洗、LightGBM 训练和报告生成都重写，而只关注状态长期驻留、调用粒度足够大、语义相对稳定的路径。

如果从量化 C++ 面试展示角度看，这部分真正想展示的不是“我会写 pybind11”，而是这些工程判断：

- pybind11 边界成本和 object materialization 往往比公式本身更贵；
- native path 必须 fail fast，不能静默 fallback 后仍把结果当 C++ benchmark；
- parity test 用来区分策略差异、对象转换差异和 ABI 差异；
- SoA view、fixed-array feature vector、ring buffer 和 O(1) rolling state 比“把函数搬到 C++”更重要；
- PMR 只适合生命周期清楚的 replay scratch，不应该跨 Python 边界泄漏 arena 生命周期；
- live scalar path 和 offline batch path 是两种问题：**offline 关心吞吐，live 关心尾延迟；offline 可以 batch，live 只能 scalar；offline 释放 GIL 有意义，live 主路径通常没有**；
- 回测 benchmark 先看 wall time、rows/s、windows/hour、parity 和资源占用；p99/p99.9 是 live promotion 与定位异常时才必须上桌的指标。

#### 1.4.1 为什么 C++ 是结果，而不是起点

Python 仍然很适合：

- 数据下载、清洗和 parquet/CSV IO；
- pandas/NumPy 特征验证；
- LightGBM 训练和校准；
- 实验编排、图表和报告。

真正适合 C++ 的是：

- 每个 tick 都要更新的 streaming state；
- quote core 的大批量数值计算；
- queue、latency、TTL、guard、inventory 组成的 replay 状态机；
- 同一数据窗口被几十个参数臂反复执行的 sweep/A/B。

这里有一个很关键的取舍：项目没有把数据下载、pandas 清洗、LightGBM 训练和报告生成全部重写。它们要么不是 CPU 热点，要么迭代频繁、Python 生态更合适。迁移对象集中在“状态长期驻留、每 tick 重复执行、分支语义相对稳定”的部分。这样 C++ 服务的是研究方法，而不是制造一个难以验证的新系统。

最终的分层大致是：

```text
Python / pandas / LightGBM
  - 数据质量、特征工程、模型训练、校准和报告

C++ extension
  - quote core batch
  - tick replay state machine
  - streaming feature state
  - receive-time global-flow state
  - queue / latency / TTL / policy execution

Python wrapper
  - 加载数组和模型产物
  - 调用 C++ batch/replay
  - 写 trace、label 和 A/B summary
```

C++ 目录由 pybind11 暴露给 Python：

```text
cpp/
  CMakeLists.txt
  pyproject.toml
  narrowgate_cpp/
    bindings.cpp
    common.hpp
    dynamic_fill_hazard.hpp / dynamic_fill_hazard.cpp
    global_flow.hpp / global_flow.cpp
    quote_core.hpp / quote_core.cpp
    tick_replay.hpp / tick_replay.cpp
    streaming_features.hpp / streaming_features.cpp

research/families/
  f03_causal_13_head/cpp/
  f06_placement_fill_cif/cpp/
  f07_active_order_continuation/cpp/

tests/
  test_cpp_quote_core_parity.py
  test_cpp_tick_replay_parity.py
  test_cpp_signal_features.py

bench/
  bench_global_flow_batch.py
  bench_live_path.py
  bench_live_routing_bridge.py
  bench_quote_core.py
  bench_tick_replay.py
```

`bindings.cpp` 只处理边界，业务逻辑留在普通 C++ 类型和函数里。这样 quote core 和 replay 可以脱离 Python binding 单独测试，也更容易发现“是策略差异，还是对象转换差异”。

构建层使用 `scikit-build-core + CMake + pybind11`。extension 由当前虚拟环境的 CPython ABI 编译成 `.so`，并不是在运行时解释 C++：

```toml
# cpp/pyproject.toml
[build-system]
requires = ["scikit-build-core>=0.10", "pybind11>=2.12"]
build-backend = "scikit_build_core.build"
```

```cmake
# cpp/CMakeLists.txt
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
find_package(Python COMPONENTS Interpreter Development.Module REQUIRED)
find_package(pybind11 CONFIG REQUIRED)

pybind11_add_module(narrowgate_cpp
    narrowgate_cpp/bindings.cpp
    narrowgate_cpp/dynamic_fill_hazard.cpp
    narrowgate_cpp/global_flow.cpp
    narrowgate_cpp/quote_core.cpp
    ../research/families/f06_placement_fill_cif/cpp/request_state_features.cpp
    ../research/families/f06_placement_fill_cif/cpp/risk_set_expansion.cpp
    ../research/families/f06_placement_fill_cif/cpp/sparse_order_lifecycle.cpp
    ../research/families/f07_active_order_continuation/cpp/active_order_competing_risk_cif.cpp
    ../research/families/f07_active_order_continuation/cpp/order_lifecycle_journal_v2_mirror.cpp
    ../research/families/f03_causal_13_head/cpp/causal_v12_1s_features.cpp
    narrowgate_cpp/tick_replay.cpp
    narrowgate_cpp/streaming_features.cpp
)
install(TARGETS narrowgate_cpp LIBRARY DESTINATION .)
```

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/pip install -e cpp
.venv/bin/python -c \
  'import narrowgate_cpp; print(narrowgate_cpp.__file__)'
```

最后一行很重要。项目早期同时维护过 BTCUSDC 和 BTCUSDT 两个执行仓库，它们都暴露名为 `narrowgate_cpp` 的模块，共用一个环境时可能导入另一份 build。loader 因此检查模块路径和 editable-install 的 `direct_url.json` 是否指向当前 repo，也允许用 `NARROWGATE_CPP_EXPECT_MODULE_TOKEN` 显式约束；`NARROWGATE_CPP_STRICT=1` 下来源不符会直接失败，不允许悄悄 fallback 到 Python。

2026-07-05 之后，仓库边界被进一步收束：维护分支只保留 BTCUSDC 执行项目，BTCUSDT 退回为 reference/source 数据，并且 raw trades 也要与 BTCUSDC minimal complete good-day universe 对齐。这个变化不只是文档整理，它能减少 C++ extension、模型目录、live config 和 replay manifest 之间的符号碰撞，让低延时优化只围绕一个执行标的做 parity。

> **本节工程结论**
>
> - 不把 Python binding 和业务逻辑揉在一起：`bindings.cpp` 只做边界，quote/replay/signal core 用普通 C++ 类型实现。
> - C++ core 必须可以脱离 pybind 单测；否则无法区分策略差异、对象转换差异和 ABI 差异。
> - `NARROWGATE_CPP_STRICT=1` 是开发期默认心态：模块来源、字段缺失、shape 错误必须 fail fast。
> - 同名 extension 在多个 repo 之间很容易碰撞，import path 和 editable install 来源必须进入 sanity check。

##### 1.4.1.1 Python/C++ 胶水层：不是每 tick 传 JSON，而是一次传连续数组

普通工程师最担心跨语言部分：Python 和 C++ 到底怎么一起工作？答案是：**回测/batch 路径里，Python 负责 IO 和编排，C++ 负责一次调用内的状态机；不会每 tick 传 JSON。**

离线路径是：

```text
Parquet / CSV / logs
        |
        v
Python pandas/pyarrow loader
        |
        v
NumPy contiguous arrays
        |
        v
pybind11 binding
        |
        v
C++ ArrayView / MatrixView / std::span
        |
        v
simulate full window / compute batch quote context
        |
        v
summary + optional trace arrays back to Python
```

核心原则是：

- C++ 不在 hot loop 里读 parquet；
- Python 不在每个 tick 调 C++；
- pybind 在窗口边界检查 shape，并要求 C-style typed array；当前 binding 使用 `c_style | forcecast`，输入 dtype/layout 不匹配时可能先复制转换，只有调用方已经提供匹配的 contiguous dtype 时才是借用原 NumPy memory 的零拷贝路径；
- `std::span` / view 只在函数调用期间借用 Python-owned memory；
- C++ 不把这些指针存到函数返回之后；
- trace、diagnostics、DataFrame 构造回到 Python 冷路径。

正式调用边界可以理解为：Python loader 先完成 source identity、时间、shape、dtype、参数与因果可见性校验，再由权威 runner 通过版本化 formal ABI 一次性把窗口交给 C++。不要在研究脚本里直接调用低层 `simulate_tick_arrays`；它只属于 binding/benchmark/test surface。

```bash
.venv/bin/python models/backtest_tick.py --engine cpp ...
```

live 路径则不同。live 不能一次喂一整个月数组，所以只把很小的 compact context 过桥：

```text
Python event state
        |
        v
fixed tuple / small arrays / cached native config
        |
        v
C++ compact quote core
        |
        v
Python side policy
        |
        v
C++ partial routing decision
        |
        v
compact result: price, size, can_post, reason_mask
        |
        v
Python REST adapter
```

这也是为什么 scalar quote core 单独迁 C++ 反而可能慢：如果每次都构造 dict、dataclass、字符串 key，跨语言边界比数学本身更贵。真正要优化的是“边界形状”，不是盲目把更多 Python 改成 C++。

#### 1.4.2 quote core：真正慢的是“每 tick 全量物化”

做市 quote core 包含 weighted-mid proxy（代码旧名 `microprice`）、经验 reservation/spread controller、legacy touch-slope 兼容值、depth liquidity multiplier、inventory skew、adverse/defense guard，以及最终 bid/ask 到 BBO 的距离。它的浮点计算并不重，早期 scalar C++ 路径却明显更慢：

| 路径 | Python | 旧 C++ | 结果 |
|---|---:|---:|---|
| mixed quote/policy path | 85.48 us | 136.33 us | C++ 慢约 59% |
| `_compute_quotes` | 54.93 us | 105.07 us | C++ 慢约 91% |

> **这张表怎么读**
>
> - 说明什么：单独把 quote 公式搬到 C++，在 pybind/dataclass/dict 往返很重时会负优化。
> - 不能说明什么：不能说明 C++ quote core 算法本身慢，也不能说明所有 native path 都不值得做。
> - 下一步验证：拆掉每 tick 全量物化后，重新测 compact ABI，并同时跑 quote-field parity。

早期 profile 后发现，时间并没有花在 `quote_core.cpp` 的公式里，而是花在边界两端：每 tick 都要重新创建并复制约 70 个 config 字段、当时 14 个 state 字段、5 个 prediction 字段和整本 depth levels；C++ 返回以后，Python 又把 native result 展开成两个完整 `quote_context`、quote flags、diagnostics 和 dataclass。当前 state ABI 已扩为 16 字段，但固定布局原则不变。一次报价所需的数学运算很少，对象搬运反而成了主任务。

##### 1.4.2.1 解决方法：热路径紧凑，完整对象按需物化

这次没有继续微调 C++ 公式，而是重新设计边界：

1. Python wrapper 缓存已经物化的 native `QuoteCoreConfig`，配置对象热重载时失效；
2. state/pred 通过紧凑 tuple 传入，depth levels 由 C++ 直接读取 Python sequence，不再逐档创建 pybind `DepthLevel` 对象；
3. 当时 direct quote EV 关闭时，只返回 side policy 真正读取的 adverse、defense、TTL、local-extreme、near-depth 字段，以及周期诊断日志使用的小型 diagnostics；
4. 当时任一侧 direct quote EV 开启时会自动回到完整 context，因为模型确实需要完整特征，不能为了速度静默丢列。

这段设计记录的是当时 direct-policy fast path 的边界。2026-07-17 direct Quote-EV executor、配置入口、预计算 action arrays 与 C++ action ABI 已从公开代码中物理删除；完整 quote context 只在 offline/historical-shadow audit 或显式诊断需要时物化，不存在可由公开配置重新打开的 live Quote-EV 分支。本句是代码边界，不用来声明私有进程的其他 shadow 状态。

##### 1.4.2.2 把配置、状态和诊断分成三种生命周期

原接口几乎把 Python dataclass 一比一复制成 pybind 对象。改造后，配置只在对象变化时同步；高频 state/pred 使用固定位置 tuple；L2 sequence 由 binding 直接读取。下面是实际 wrapper 的裁剪版：

```python
_CPP_STATE_FIELDS = (
    "mid", "inventory", "sigma_sq", "trade_intensity",
    "best_bid", "best_ask", "ber_active",
    "mo_ema_all", "mo_ema_bid", "mo_ema_ask",
    "bid_adverse_markout_pause_latch",
    "ask_adverse_markout_pause_latch",
    "mo_ref",
    "position_open", "hold_time_s", "unrealized_pnl",
)

def _cached_cpp_config(cpp, cfg):
    global _CPP_CFG_CACHE_KEY, _CPP_CFG_CACHE_REF, _CPP_CFG_CACHE_VALUE
    cached = _CPP_CFG_CACHE_REF() if _CPP_CFG_CACHE_REF else None
    if _CPP_CFG_CACHE_KEY == id(cfg) and cached is cfg:
        return _CPP_CFG_CACHE_VALUE
    native = _copy_attrs(cfg, cpp.QuoteCoreConfig(), _CPP_CFG_FIELDS)
    _CPP_CFG_CACHE_KEY = id(cfg)
    _CPP_CFG_CACHE_REF = weakref.ref(cfg)
    _CPP_CFG_CACHE_VALUE = native
    return native

result = cpp.compute_quote_core_live(
    tuple(getattr(state, name) for name in _CPP_STATE_FIELDS),
    _cached_cpp_config(cpp, cfg),
    (pred_dir, pred_vol, pred_ret, tox_bid, tox_ask),
    depth.bids if depth else (),
    depth.asks if depth else (),
)
```

这里保留 `ber_active` 是为了对应实际兼容 ABI；它的语义是 trade-intensity acceleration guard，不是 book-exhaustion rate。字段名的历史债务不应被 parity 文章包装成论文一致性。

C++ binding 则对 tuple 做长度检查并填充栈上的普通结构体，depth 不再逐档创建 `DepthLevel` Python wrapper：

```cpp
m.def("compute_quote_core_live",
    [](py::sequence state_values,
       const QuoteCoreConfig& cfg,
       py::sequence pred_values,
       py::handle bids,
       py::handle asks) {
        if (py::len(state_values) != 16 || py::len(pred_values) != 5)
            throw std::invalid_argument("live quote state/pred length mismatch");

        QuoteState s;
        s.mid             = py::cast<double>(state_values[0]);
        s.inventory       = py::cast<double>(state_values[1]);
        s.sigma_sq        = py::cast<double>(state_values[2]);
        s.trade_intensity = py::cast<double>(state_values[3]);
        s.best_bid        = py::cast<double>(state_values[4]);
        s.best_ask        = py::cast<double>(state_values[5]);
        // 其余状态包括 BUY/SELL adverse-markout pause latch；
        // 当前 state ABI 共 16 个固定位置字段。

        QuotePrediction p;
        p.dir_10s = py::cast<double>(pred_values[0]);
        p.vol_10s = py::cast<double>(pred_values[1]);
        p.ret_10s = py::cast<double>(pred_values[2]);
        p.tox_bid = py::cast<double>(pred_values[3]);
        p.tox_ask = py::cast<double>(pred_values[4]);

        return compute_quote_core(
            s, cfg, p, depth_from_python_levels(bids, asks));
    });
```

##### 1.4.2.3 diagnostics 不是全有或全无

side policy 每 tick 真正读取的字段远少于离线 quote EV。compact path 只物化 guard、距离、TTL 和少量 cap 诊断：

```python
def compact_side_context(side, ctx, result):
    return {
        "near_depth_total": float(result.near_depth_total),
        "final_quote_delta_to_bbo": float(ctx.final_quote_delta_to_bbo),
        "side_adverse": bool(ctx.side_adverse),
        "side_adverse_pause": bool(ctx.side_adverse_pause),
        "defense_guard": bool(ctx.defense_guard),
        "defense_pause": bool(ctx.defense_pause),
        "mid_guard": bool(ctx.mid_guard),
        "post_only": bool(ctx.post_only),
        "delta_cap": bool(result.flags.delta_cap),
    }

def compute_quote_core_live(..., require_full_context=False):
    if cpp_enabled and not require_full_context:
        return _compute_quote_core_cpp_compact(...)
    return compute_quote_core(...)       # 旧代 BUY soft-keep scorer / offline trace 需要完整 context
```

这个方案的关键不是少返回几个字段，而是明确了三种生命周期：几乎不变的 config 被缓存，每 tick 变化的 state 用紧凑序列，只有旧代 BUY soft-keep scorer、模型训练、trace 或调试需要的长 diagnostics 才完整物化。可观测性仍在，只是不再无条件出现在最热路径。

固定环境复测使用 Python 3.12.13、AppleClang Release build、ML 关闭以隔离 quote/feature CPU，`--n 10000 --signal-n 1000`，每项跑三次取 mean 的中位数：

| 路径 | Python | compact C++ | 变化 |
|---|---:|---:|---:|
| live `_compute_quotes` | 42.85 us | 34.53 us | **快 19.4%** |
| mixed quote/policy path | 74.55 us | 62.32 us | **快 16.4%** |

> **这张表怎么读**
>
> - 说明什么：边界收紧后，scalar native path 从负优化翻转为小幅性能增益。
> - 不能说明什么：不能把这组数字套到旧代 BUY soft-keep scorer 或 offline trace 使用的完整 context 路径，也不能推出端到端报单延迟改善 16%。
> - 下一步验证：在目标 x86 live 机型上做 p99/p99.9 soak，并确认 strict 模式没有 fallback。

这不是数量级加速，但它完成了更重要的翻转：scalar native path 终于不再因为 Python 对象往返而负优化。它仍保持显式 opt-in；旧代 BUY soft-keep scorer或 offline trace 触发的完整 context 路径不能套用这组数字。

离线 quote decomposition、shock audit 和 quote EV label 仍使用 depth-aware batch binding。batch 场景一次传连续数组，跨语言成本被大量样本摊薄，依然比 scalar 更适合 C++。`book_imb`、`near_depth_total`、legacy touch-slope/depth-multiplier、adverse/defense 等字段继续纳入 parity 审计；性能优化不能把 C++ 悄悄变成另一套策略。

#### 1.4.3 tick replay：先迁完整状态机，再谈加速倍数

tick replay 是整个迁移中最适合 C++ 的部分，因为 queue、latency、TTL、inventory 和 fill path 都是顺序相关状态。若只把某个公式做成 scalar binding，Python 仍要在每个 tick 调度所有状态；把完整 replay loop 放进一次 C++ 调用，跨语言边界才只出现于窗口输入和 summary/trace 输出。

C++ 版本逐项迁入当前 active replay 所需的机制：

- historical BBO/L2；
- exact-level queue ahead；
- new/cancel latency；
- maker fill gate；
- inventory 与 inventory-time summary；
- spread cap、adverse/defense guard；
- local extreme、fragile/adaptive TTL/cooldown；
- side/regime queue calibration、reducing cooldown、adaptive add cooldown；
- replace throttle、pending coalesce、campaign soft control 与 BUY fill-selection score；
- position timeout/emergency path；
- 完整 trace 和 summary 字段。

这里的“完整”指 active baseline 和已显式迁移的参数面，不代表 live-only 故障状态也被历史 replay 凭空重建。user-stream mismatch、REST sync-adjust degrade、真实 ACK 乱序与逐请求 REST latency sample 仍需要 live telemetry 或 Python diagnostic。`xmarket_retreat` 的 runtime/replay 入口已经删除，只有 legacy audit reader 继续解释旧日志字段，不能再作为可开启或 fail-fast 的候选机制。

##### 1.4.3.1 输入是只读 view，窗口数据不再逐 tick 穿过 Python

replay 的入口不是 `on_trade(dict)`，而是一组生命周期覆盖整个调用的连续数组 view。Python 完成 parquet/Arrow 加载和 dtype 归一化后，只跨一次 pybind 边界：

```cpp
struct TickReplayInput {
    ArrayView<std::int64_t> trade_ts_ms;
    ArrayView<double> trade_price;
    ArrayView<double> trade_qty;
    ArrayView<std::uint8_t> is_buyer_maker;

    ArrayView<std::int64_t> var_ts_ms;
    ArrayView<double> var_ssq;

    ArrayView<std::int64_t> ml_ts_ms;
    ArrayView<double> ml_dir_10s;
    ArrayView<double> ml_vol_10s;
    ArrayView<double> ml_ret_10s;
    ArrayView<double> ml_tox_bid;
    ArrayView<double> ml_tox_ask;
    MatrixView<double> buy_fill_static_logit_delta;
    MatrixView<double> buy_fill_static_missing;
    MatrixView<double> buy_fill_static_used;

    ArrayView<std::int64_t> bbo_ts_ms;
    ArrayView<double> bbo_best_bid;
    ArrayView<double> bbo_best_ask;
    ArrayView<double> bbo_bid_qty;
    ArrayView<double> bbo_ask_qty;

    ArrayView<std::int64_t> l2_ts_ms;
    MatrixView<double> l2_bid_px;
    MatrixView<double> l2_bid_qty;
    MatrixView<double> l2_ask_px;
    MatrixView<double> l2_ask_qty;

    ArrayView<double> queue_base_by_trade;
    ArrayView<double> queue_decay_by_trade;

    void validate() const;
};

TickReplayResult simulate_tick_arrays(
    const TickReplayInput& input,
    const TickReplayParams& params);
```

`ArrayView/MatrixView` 只保存指针和 shape，不拥有数据。binding 在调用期间持有 NumPy array，C++ 内循环读取连续内存；结果结束后一次性返回 summary 和可选 trace。这样优化的是整个状态机，而不是把每个 tick 的 Python callback 换成一次 pybind callback。

##### 1.4.3.2 queue policy 只保留 exact-level，并用模板固定 side

项目早期曾同时保留 exact-level 与 through-level 两种 queue mode。through-level 会把穿过多个价位的可见量混进同一张订单的 queue ahead，容易把旧近似重新带回 formal replay；当前 Python/C++ 已物理删除 `QueueAheadMode` 与 through-level ABI，formal 入口只接受 `exact_level`。热循环只需要把 BUY/SELL side 固定到编译期：

```cpp
template <Side S>
double l2_visible_queue_ahead(
    const TickReplayInput& input,
    double quote_price,
    std::int64_t target_ts,
    double price_tolerance) {

    const auto row = index_at_or_before(input.l2_ts_ms, target_ts);
    if (row < 0)
        return -1.0;

    double visible = 0.0;
    if constexpr (is_buy_v<S>) {
        for (std::size_t col = 0; col < input.l2_bid_px.cols; ++col) {
            const double px = input.l2_bid_px(row, col);
            if (std::abs(px - quote_price) <= price_tolerance)
                visible += std::max(0.0, input.l2_bid_qty(row, col));
        }
    } else {
        for (std::size_t col = 0; col < input.l2_ask_px.cols; ++col) {
            const double px = input.l2_ask_px(row, col);
            if (std::abs(px - quote_price) <= price_tolerance)
                visible += std::max(0.0, input.l2_ask_qty(row, col));
        }
    }
    return visible;
}
```

上面省略了 duplicate-level 与 coverage 边界。真实实现找不到可靠 exact level 时，才回到显式的 distance-decay calibration；它不再接受字符串或枚举开关把 formal replay 切回 through-level。

订单本身是一个显式状态机：

```cpp
struct ReplayOrder {
    Side side;
    double price, quantity, remaining;
    double queue_left, queue_init;
    std::int64_t quote_ts, activate_ts, cancel_effective_ts;
    std::int64_t ttl_ms;
    OrderState state;
    bool side_adverse, defense_guard, local_extreme_guard;

    // 默认不分配；只有打开 trace 时才指向冷诊断对象。
    TraceOrderPtr trace;
};

order.activate_ts = ts + sampled_new_latency_ms;
order.state = sampled_new_latency_ms > 0 ? ORDER_PENDING_NEW : ORDER_OPEN;

if (order.ttl_ms > 0 && ts - order.quote_ts >= order.ttl_ms) {
    order.state = ORDER_PENDING_CANCEL;
    order.cancel_effective_ts = ts + sampled_cancel_latency_ms;
}
```

`PENDING_CANCEL` 期间仍允许成交，因此 trace 会单独统计 `pending_cancel_fills`。这类语义如果只保留“请求撤单后立即删除订单”的简化实现，回测会系统性低估撤单延迟风险。

##### 1.4.3.3 fill 先消耗 queue，再改变 inventory

maker fill 不由价格 touch 直接触发。主动成交必须跨过订单价格，并先消耗 `queue_left`：

```cpp
if (!trade_crosses_order<S>(trade_price, order.price))
    continue;

if (order.queue_left > 0.0) {
    const double eaten = std::min(order.queue_left, remaining_trade_qty);
    order.queue_left -= eaten;
    remaining_trade_qty -= eaten;
}

double fill_qty = floor_lot(
    std::min(order.remaining, remaining_trade_qty), lot_size);
if (fill_qty < lot_size)
    continue;

cash += side_cash_delta<S>(order.price, fill_qty, maker_fee);
inventory += inventory_delta_sign<S>() * fill_qty;
order.remaining -= fill_qty;
```

库存时间风险也在同一事件时钟中积分，不使用“最终仓位乘总时长”的粗略近似：

```cpp
const double dt_s = (ts[i] - ts[i - 1]) / 1000.0;
const double mark = trade_price[i - 1];

summary.signed_inventory_time_s += inventory * dt_s;
summary.abs_inventory_time_s += std::abs(inventory) * dt_s;
summary.sq_inventory_time_s += inventory * inventory * dt_s;
summary.notional_inventory_time_s += std::abs(inventory) * mark * dt_s;
```

迁移顺序刻意很慢：每增加一个机制，就在固定真实窗口同时跑 Python 和 C++，比较：

```text
PnL
fills / bid-ask split
final inventory
InvAdj
inventory time
spread<100 / cap_hit
Sharpe
trace rows
```

golden window 覆盖正常、高波动、低成交/稀疏以及不同日期状态。只有差异能够被解释，C++ engine 才被允许进入当时的 sweep、cap A/B、quote EV A/B 等批量 runner。默认行为仍保留 Python，显式 `--engine cpp` 才切换，strict 模式下 extension 不可用会直接报错，避免静默 fallback 让人误以为跑了 C++。其中 direct quote-EV runner 后来已随 executor 和 action ABI 删除。

完整 CLI 的 wall time 还包含 parquet、模型和窗口加载，因此不能拿 C++ 内层循环的 microbenchmark 直接宣称整月回测有同样倍数。对回测来说，**路径一致比一个夸张的加速倍数更重要**。

2026-07-08 之后，C++ replay 的角色又往前推了一步：它不再只是“基础路径 fast screening”，而是可以在 **active live baseline 的 parity gate 通过后** 承接宽参数 smoke。这里修掉的关键偏差并不是浮点精度，而是离散状态口径：Python 的 queue 初始化使用成交时钟上的 causal local-rank，而 C++ 曾经复用了 local-extreme rank，在 guard 关闭时会退化成 `0.5`；同时同一 tick 内多个候选订单的成交优先级也必须按 BUY 高价优先、SELL 低价优先稳定排序。修复后，`2026-06-26` 与新补齐的 `2026-07-04` live-like baseline 窗口都做到了 Python/C++ fill 数与 PnL 对齐，retained-day runner 才允许切到 native engine。

因此新的规则是：C++ 可以用于 active baseline 的参数快筛，但每次 sweep 前要先跑 baseline parity gate；如果 gate 不过，runner 必须 fail closed，由操作者显式修复 parity 或另行选择 Python reference，不能静默 fallback 后继续筛参数。这个边界比“C++ 快不快”更重要，因为参数搜索最怕的不是慢，而是用另一套成交口径选出一个看起来很强的假 arm。

旧的宽参数搜索、markout-sign、spread-cap 与 passive-null 数值已经从本文删除。它们依赖修复前的 feature-ready 时间、event clock、P3/queue identity 或旧 rolling baseline，不能继续充当策略证据。保留下来的工程结论只有两点：宽筛必须先通过当前 baseline 的 Python/C++ parity gate；正式 replay 必须显式绑定 private config、empirical P3、daily queue calibration、历史 BBO/L2、REST latency、代码 commit 与数据 manifest，缺一项就 fail fast。

期末账本本身则做了语义修复。窗口结束只是 valuation boundary，并没有发出 taker order，所以 Python/C++ 现在都令 `final_pnl = cash + inventory * terminal_mark`，`terminal_fee_drag=0`。假想主动平仓成本只作为 `terminal_liquidation_fee_estimate` 单独报告，不进入 PnL。真实 timeout/emergency taker exit 仍扣 taker fee；当前 BTCUSDC maker fills 按配置的 `maker_fee=0` 记账。这个改动只修账本边界，不改变报价、queue、fill 或 campaign，不能被解释成 alpha。

同一个 C++ state machine 仍可生成 executable passive null，但旧 seed 排名与 PnL 数值已经删除。这个 null 的用途是检查报价函数是否优于可执行随机对照，并验证 queue、latency、inventory 与 campaign accounting；它不是一条可上线的随机策略。

这个过程说明 C++ fast screening 的正确姿势：先让它快速扩大反例和候选覆盖，再用 daily/campaign gate 识别幸存者偏差与风险转移。当时的 `fast_cpp_arm_smoke.py` 只收 summary，后来已作为重复入口删除；它留下的方法边界仍成立：summary-only 快筛可以回答“哪些组合值得继续算”，不能回答“哪个组合应该上线”。

#### 1.4.4 历史 quote EV fast screening：快筛不是最终裁决

quote EV online inference 会对大量 quote 逐行构造 feature 并调用模型，多日 A/B 很慢。早期项目因此增加过一条研究快筛路径：

1. 在 baseline quote context 下预计算 bid/ask EV arrays；
2. C++ replay 在每个 tick 直接读取对应分数；
3. 快速筛掉明显不值得继续的 direct-policy probe；
4. 最终候选仍必须回到 Python online inference、按日隔离 validation、chronological walk-forward 和 campaign gate。

这条路径的价值是工程上的：证明预计算数组 + C++ replay 可以显著降低筛选成本。它不再代表当前策略方向；direct quote-EV executor、配置入口、预计算 action arrays 和 C++ action ABI 均已删除。

研究链路不是一句“打开 C++”就结束，而是把昂贵步骤和快速步骤拆开。早期我曾用 C++ replay + 预计算 quote EV arrays 去快速筛 direct quote-EV policy arms；这条 direct-policy 路线已在因果重置时物理删除，修复前的正负方向不再保留。代码只保留与动作无关的模型训练和历史/offline calibration 接口；它们不授予任何 live shadow 权限。

这段经历仍然留下一个系统结论：C++ 最适合承接**已经固定语义的批处理边界**，例如 quote context batch、order-level denominator、shock/label 前的重复 quote-core 计算、以及已 parity 的 replay fast screening；它不应该替一个还没过 evidence gate 的策略机制背书。

当前更稳妥的用法是：Python 先负责 retained-day universe、window cache、feature/model loading 和 evidence schema；C++ 只处理可独立验证的 tight loop，并在 `NARROWGATE_CPP_STRICT=1` 下 fail fast。模块不可用、字段缺失或 shape 错误时直接终止，而不是悄悄 fallback 后输出一个看似成功的 A/B 文件。

同样，C++ loop 变快以后，CLI wall time 可能仍受 parquet、模型和数据加载支配。后续优化重点因此转向 window cache、数组复用和批量 quote decomposition，而不是继续微调一个已经很快的循环。

#### 1.4.5 streaming feature：迁状态，而不是反复搬列表

逐笔成交进入系统后，需要更新 1s bar、10s feature、taker tempo、rolling volume、L2 execution 和 cross-market state。

第一版 `SIGNAL_FEATURES=1` 恰好犯了 quote scalar 相同的错误：每十秒把最多 320 根 Python `Bar1s` 和全部 feature history 逐字段复制成 pybind 对象，C++ 算完 overlay 后再返回 dict。旧基准从 Python 约 1.40ms 变成 C++ 约 2.65ms，明显负优化。

修正后的 `SignalFeatureEngine` 长期持有最近 320 根 1s bars 和最多 60,480 条 10s history。Python 每完成一根 1s bar 增量推送一次，每十秒只推一条新的 history，再请求一个 feature snapshot：

```text
on_trade(price, qty, side, ts)
  -> update current 1s bar
  -> close gap/completed bars
  -> update rolling state
  -> emit compact feature snapshot
```

当前实现不再保留早期的 `RollingStats<WindowSeconds>` 首版模板。稳定的长历史统计使用 `CircularBuffer<T>` 与 `CountRollingMoments`：ring buffer 覆盖最旧值，rolling moments 用支持删除旧值的 Welford `mean/M2` 更新，避免低方差序列里的消差。短窗口、仍在变化的实验特征可以继续扫描有限 history，不为了追求“全部 O(1)”过早固化：

```cpp
class CountRollingMoments {
public:
    explicit CountRollingMoments(std::size_t capacity)
        : values_(capacity) {}

    void push(double value) {
        if (values_.size() == values_.capacity()) {
            remove_value(values_[0], values_.size(), mean_, m2_);
        }
        values_.push_back(value);
        add_value(value, values_.size(), mean_, m2_);
    }

    double mean() const noexcept { return mean_; }
    double stddev() const noexcept;

private:
    CircularBuffer<double> values_;
    double mean_ = 0.0;
    double m2_ = 0.0;
};
```

更高层的 engine 只暴露增量接口：

```cpp
class SignalFeatureEngine {
public:
    SignalFeatureEngine(std::size_t max_bars = 320,
                        std::size_t max_history = 60480);
    void push_bar(const Bar1s& bar);
    void push_history(const FeatureHistoryRow& row);
    [[nodiscard]] SignalFeatureVector compute(
        const Bar1s& bar_10s) const;

private:
    CircularBuffer<Bar1s> bars_;
    CircularBuffer<FeatureHistoryRow> history_;
};
```

这里的返回值也不再是热路径上的 `std::map<std::string, double>`。80 个稳定字段在 C++ 内部使用 `enum class SignalFeatureId` 定位，值存进 `std::array<double, 80>`；只有跨过 pybind 边界返回 Python 时，才按 compile-time 字段表物化一次 dict。这样同时去掉了红黑树节点分配、字符串比较和字段拼写漂移。

Python 只在 warmup/reconnect 后 seed 一次，正常运行时逐根追加：

```python
def _ensure_cpp_feature_engine(self):
    if not self._cpp_feature_engine_seeded:
        for bar in list(self._bar_buffer)[-320:]:
            self._cpp_feature_engine.push_bar(self._bar_to_cpp(bar))
        for row in self._feat_history:
            self._cpp_feature_engine.push_history(self._history_to_cpp(row))
        self._cpp_feature_engine_seeded = True
    return self._cpp_feature_engine

def _finalize_bar(self, bar):
    self._bar_buffer.append(bar)
    self._ensure_cpp_feature_engine().push_bar(self._bar_to_cpp(bar))

overlay = self._ensure_cpp_feature_engine().compute(cpp_bar_10s)
```

这里故意没有把所有 cross-market book/trade state 一次迁完。当前 C++ overlay 负责稳定、重复的 rolling 数值部分，Python 继续补 execution L2、cross-market、time 和 metrics features。这样的分层可以逐列做 parity；若一口气迁完整 82-feature pipeline，任何时间对齐差异都会很难定位。

Python 负责事件和研究编排，C++ 负责持续演化的数值状态。这个边界也更接近未来真正值得优化的“计算/决策层”，而不是去重写 WebSocket 和 IO。

同一组固定环境三轮中位数中，完整“喂入十秒事件并计算 features”的路径从 Python `803.20 us` 降到 C++ persistent state `563.26 us`，快约 **29.9%**。单独的 1s ingest 会从 `22.42 us` 增到约 `25.44 us`，但十秒整体仍有净收益，因为昂贵的窗口重拷贝被移除了。

历史实验开关 `SIGNAL_STATE=1` 只把单条 trade aggregation 搬进 C++，Python 仍负责 event dict 解析、锁、回调和 bar 对象同步。它的 ingest 中位数是 `23.44 us`，比 Python `22.42 us` 慢约 4.5%；2026-07-17 已物理删除该实现与环境开关，而不是把一个负优化入口永久留成 dormant option。这里的结论很朴素：**只有状态和足够长的计算链一起迁移才有意义，单独迁四则运算没有。**

##### 1.4.5.1 Fixed-Array Signal：哪些是 O(1)，哪些还不是

`fixed-array signal` 不是一个神秘概念，本质就是把“特征名字符串字典”换成“固定顺序数组”：

```cpp
enum class SignalFeatureId {
    Return1,
    Volatility60s,
    TradeIntensity60s,
    TakerQuoteImbalance10s,
    // ...
    Count,
};

class SignalFeatureVector {
public:
    double& operator[](SignalFeatureId id);
    const std::array<double, kSignalFeatureCount>& values() const;
private:
    std::array<double, kSignalFeatureCount> values_{};
};
```

行情状态维护则分两层：

```cpp
class TradeBarAggregator {
    std::vector<Bar1s> update(ts_ms, price, qty, is_buyer_maker);
    Bar1s current_;
    int last_trade_side_;
    int last_trade_run_len_;
};

class SignalFeatureEngine {
    CircularBuffer<Bar1s> bars_;
    CircularBuffer<FeatureHistoryRow> history_;
    CountRollingMoments return_abs_2160_;
    CountRollingMoments return_abs_8640_;
    CountRollingMoments vol_regime_6h_60480_;
};
```

但这里也要诚实：当前并不是所有特征都已经做到完全 O(1) 增量。已经增量化的是一部分长窗口 rolling moments 和 trade/bar state；仍有一些 overlay 特征会扫描短窗口或使用 scratch buffer。原因是这些特征还处在研究变化阶段，过早把所有实验性 feature 都写成复杂 C++ 状态机，会让 parity 和调参变得更难。

当前工程取舍是：

- 高频、稳定、低基数的窗口统计逐步进 C++；
- 特征顺序固定，用 array 输出，减少 dict/string 热路径；
- 实验性特征先保留 Python 或短窗口扫描；
- 只有当某个特征进入稳定模型并被 profile 证明是热点，再改成长期持有的 rolling state。

这和前面 C++ 的原则一致：C++ 不是为了“看起来硬核”，而是为了把稳定边界收紧。

#### 1.4.6 pybind11 的教训：不要估算边界，要 profile 边界

编译后的 extension 会被 CPython 作为 native module 加载。进入 C++ 后当然运行机器码，但调用前后的 tuple/dict 解包、属性访问、容器复制和返回对象构造依旧发生。NarrowGate 这次最有价值的经验不是某个通用的“pybind 调用耗时”，而是同一条路径在不同接口形状下会从负优化变成正收益：

| 接口形状 | 结果 |
|---|---|
| scalar quote + 每 tick 完整 dataclass/dict | C++ 明显慢于 Python |
| scalar quote + cached config + compact context | C++ quote+policy 快约 16.4% |
| 每 10s 重传 320 bars/history | C++ features 明显变慢 |
| C++ 常驻 rolling state + 增量更新 | 10s features 快约 29.9% |
| 单条 trade aggregation 跨一次 pybind | 基本打平且略慢 |
| 离线连续数组 batch / 完整 replay 状态机 | 最适合迁移 |

> **这张表怎么读**
>
> - 说明什么：迁移对象应该按“状态是否能常驻、单次调用是否足够大”来选择。
> - 不能说明什么：不能简单得出“Python 慢、C++ 快”；接口形状比语言标签更关键。
> - 下一步验证：每个 native 开关都必须同时通过 parity、wall-time 和 strict import/source 检查。

因此现在的判断标准是：

- 计算很少、对象很多时，保留 Python；
- 配置稳定时缓存 native representation；
- rolling window 让 C++ 持有状态，不重复搬历史；
- 离线大数组用 batch，一次跨边界处理许多样本；
- 完整诊断对象按需要生成，不把可观测性变成每 tick 的固定税；
- 每个开关都必须同时通过 parity 和 wall-time，不能只证明“确实执行了 C++”。

##### 1.4.6.1 一条 native path 要过三层测试

第一层是小输入的字段 parity，用专门构造的 inventory、depth、adverse/defense 场景逐字段比较；第二层是 synthetic replay，检查成交路径、queue、latency、TTL 和 emergency 分支；第三层才是真实窗口 golden test：

```bash
# quote / signal / synthetic replay
.venv/bin/python -m pytest \
  tests/test_cpp_quote_core_parity.py \
  tests/test_cpp_signal_features.py \
  tests/test_cpp_tick_replay_parity.py -q

# 正常、高波动、稀疏和跨 regime 真实窗口
RUN_NARROWGATE_GOLDEN=1 NARROWGATE_CPP_STRICT=1 \
  .venv/bin/python -m pytest \
  tests/test_cpp_tick_replay_golden_parity.py -q
```

golden test 不要求所有浮点数逐 bit 相同，但必须给每类差异设显式容忍度。尤其不能只比最终 PnL，因为两条不同成交路径可能偶然得到接近的 PnL。当前比较集合至少包括：

```python
SUMMARY_KEYS = (
    "pnl", "inventory_adjusted_pnl", "inventory_pnl",
    "fills_total", "fills_bid", "fills_ask", "final_inventory",
    "avg_markout", "markout_count",
    "abs_inventory_time_s", "signed_inventory_time_s",
    "sq_inventory_time_s", "notional_inventory_time_s",
    "avg_spread", "avg_final_spread", "n_requotes",
    "quote_spread_lt_100_rate", "cap_hit_rate",
    "sharpe", "max_drawdown",
)
```

开发阶段还必须打开 strict 模式：

```bash
NARROWGATE_CPP_QUOTE_CORE=1 \
NARROWGATE_CPP_SIGNAL_FEATURES=1 \
NARROWGATE_CPP_STRICT=1 \
.venv/bin/python bench/bench_live_path.py \
  --n 10000 --signal-n 1000 --engine cpp --strict-cpp
```

如果 C++ import、模块来源检查或某个 native 调用失败，这条命令必须非零退出。否则 benchmark 很可能测到 fallback 后的 Python，却被错误记录为 C++ 性能。

##### 1.4.6.2 是否迁移，用“状态驻留 × 调用粒度”决定

项目现在用下面这套决策矩阵，而不是看到 Python 函数就重写：

| 路径 | 状态是否可常驻 | 单次工作量 | 方案 |
|---|---:|---:|---|
| parquet/特征表 IO | 否 | 大，但 Arrow 已优化 | 保留 Python/Arrow |
| LightGBM 训练 | 模型库内部已 native | 大 | 保留 Python orchestration |
| scalar side policy | 少 | 约几十微秒 | 与 quote/routing 合并后再迁 |
| rolling signal | 是 | 每 trade/每秒重复 | C++ 长期持有窗口状态 |
| quote decomposition | 否 | 数万至数百万行 | NumPy contiguous batch |
| tick replay | 是 | 完整窗口顺序状态机 | 一次 C++ 调用跑完整窗口 |

> **这张表怎么读**
>
> - 说明什么：迁移优先级来自计算形态，不来自文件名或语言偏好。
> - 不能说明什么：synthetic CPU isolation 不能裁决 WebSocket、REST、日志是否会制造 live 尾部；后文的 receive-time soak 需要单独审计这些边界。
> - 下一步验证：对候选迁移点先做 flame/profile，再设计最小 native API，而不是照搬 Python 对象模型。

这张表解释的是 C++ 迁移优先级，不是 WebSocket 可以不治理。在这轮 synthetic CPU isolation 中，rolling state、quote/policy bundle 和 replay 状态机比重写 IO 更适合 native；但后续 3600 秒 receive-time soak 证明，多个 Python callback 同步争用 GIL/共享锁时仍会制造明显 p99。随后做的两种 Python dispatcher 实验又补了一条反例：每 source 一个 worker 会增加调度竞争，单个共享 worker 则会把 burst 串行积压到秒级。因此“缩短 callback”仍是正确目标，但不能把工作机械搬给更多 Python 线程；那一历史实验最终回到同步 reference callback，后来某个冻结 no-shadow 快照记录 external/Flow/Ref 关闭。后一句只是历史时点，不代表当前主机。

在该轮 2026-06-21 代码快照上，相关 quote、signal、tick replay 快速测试共 `20 passed`；显式开启的四个真实窗口 golden tests 也全部通过。这个数字只绑定当时的 commit、依赖和 fixture，不是当前 working tree 的滚动测试总数。这些 benchmark 是同机 synthetic CPU isolation，关闭 ML 以分离 feature/quote 成本；它们不代表网络延迟、模型推理或完整事件引擎的端到端耗时，也不能直接决定 live 默认配置。

##### 1.4.6.3 C++20 现代化：改的是数据运动，不只是标准号

完成 Python/C++ parity 后，构建标准从 C++17 升到了 C++20：

```cmake
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
target_compile_features(narrowgate_cpp PRIVATE cxx_std_20)
```

选择 C++20 并不是为了把所有新语法都塞进交易路径，而是优先使用几项收益明确、行为容易验证的能力。

第一项是用 `concept` 和 `std::span` 表达“不拥有、连续、只读的数值数组”。quote core、tick replay 和 streaming feature 不再各自传裸指针与长度：

```cpp
template <typename T>
concept Arithmetic = std::is_arithmetic_v<T>;

template <Arithmetic T>
using ArrayView = std::span<const T>;

template <Arithmetic T>
struct MatrixView {
    ArrayView<T> values;
    std::size_t rows{};
    std::size_t cols{};

    [[nodiscard]] T at(std::size_t row,
                       std::size_t col) const noexcept {
        return values[row * cols + col];
    }
};
```

这不会自动让循环变快，但它把 shape、ownership 和 constness 写进类型，减少 Python buffer 绑定和 replay 数组新增字段时的错误面。`[[nodiscard]]` 则放在 quote result、feature snapshot 和 replay result 上，避免调用方无意丢弃策略结果。

第二项是固定容量 ring buffer。旧的 60,480 行 history 使用 `vector.erase(begin())` 淘汰头部，每次满载 push 都会搬动后续元素；现在只覆盖 head：

```cpp
template <typename T>
class CircularBuffer {
public:
    explicit CircularBuffer(std::size_t capacity)
        : storage_(capacity) {}

    void push(const T& value) {
        if (size_ < storage_.size()) {
            storage_[(head_ + size_) % storage_.size()] = value;
            ++size_;
            return;
        }
        storage_[head_] = value;
        head_ = (head_ + 1) % storage_.size();
    }

    [[nodiscard]] const T& operator[](std::size_t i) const {
        return storage_[(head_ + i) % storage_.size()];
    }

private:
    std::vector<T> storage_;
    std::size_t head_{};
    std::size_t size_{};
};
```

对应的 80 维 feature 输出改成稳定布局；字段名只在边界出现：

```cpp
enum class SignalFeatureId : std::size_t {
    AggressionImbalance10s,
    BookImbalance,
    // ... 其余稳定字段
    Count
};

struct SignalFeatureVector {
    std::array<double,
        static_cast<std::size_t>(SignalFeatureId::Count)> values{};

    double& operator[](SignalFeatureId id) noexcept {
        return values[static_cast<std::size_t>(id)];
    }
};
```

名称诊断使用 `std::ranges::lower_bound`，失败路径附带 `std::source_location`；窗口常量使用 `std::to_array`。这些都在冷路径或编译期工作，不给每 tick 增加新分配。

第三项是让 replay 的状态和 trace 从字符串变成强类型枚举，并用 `std::pmr::monotonic_buffer_resource` 承担单次 replay 内部短生命周期容器：

```cpp
enum class OrderState : std::uint8_t {
    PendingNew, Active, PendingCancel, Filled, Cancelled
};

enum class TraceOutcome : std::uint8_t {
    None, Filled, Cancelled, Expired, Rejected
};

std::array<std::byte, 64 * 1024> replay_scratch{};
std::pmr::monotonic_buffer_resource arena(
    replay_scratch.data(), replay_scratch.size());
std::pmr::vector<ReplayOrder> bid_orders{&arena};
std::pmr::vector<ReplayOrder> ask_orders{&arena};
```

pybind property 仍返回旧的字符串值，所以 Python trace schema、parquet 报告和 A/B 脚本无需改变。PMR 只管理函数内部的临时订单和 pending markout；需要返回 Python 的结果继续使用普通 owning container，避免把 arena 生命周期泄漏到边界外。

本次现代化后的同机结果如下：

| 测量 | 旧实现 | C++20 实现 | 解读 |
|---|---:|---:|---|
| 500-row 短历史 signal 10s | 557.32 us | 553.17 us | 快约 0.7%，短窗口本来就不是搬移瓶颈 |
| mixed quote/policy path | 63.09 us | 63.18 us | 统计上持平，现代化没有伤害 scalar path |
| 60,480 history 满载 push（纯 C++ operation microbench） | 80.05 us | 0.0026 us | 去掉 `erase(begin)` 后由 O(N) 变 O(1) |
| 60,480 history full snapshot | - | 111.23 us | 常驻 ring + 定长输出下的完整计算 |

> **这张表怎么读**
>
> - 说明什么：C++20 现代化主要减少数据搬移和生命周期错误，短路径不一定会显著变快。
> - 不能说明什么：`0.0026 us` 不是 live 总延迟，也不是策略收益，只是一个容器操作微基准。
> - 下一步验证：继续看真实窗口 golden parity、长 history p99，以及目标 Linux CPU 上的 PMU 或 wall-time soak。

第三行尤其不能直接解读成 live 总延迟快了三万倍：它只隔离测量“满载后保留尾部”的容器操作。真实路径还包含 Python event、pybind、模型和路由。它说明的是旧容器在长时间运行后存在确定的线性成本，而不是给系统吞吐量制造一个夸张数字。

验证也按风险分层完成：在这次 C++20 迁移的 2026-06-20 快照上，快速 quote/signal/replay 测试为 `18 passed, 4 skipped`；另行显式运行 May 正常、高波动、Feb 稀疏和 Jan 窗口的 golden parity 为 `4 passed`。这些数量绑定当时代码与 fixture。此外三个 C++ 核心翻译单元用 `-std=c++20 -Wall -Wextra -Wpedantic` 编译为零 warning。由于短路径收益接近噪声，本次只更新 native 基础设施和研究路径，没有修改 live 配置。

##### 1.4.6.4 第二轮：消除 depth 分配，拆开热状态与诊断状态

第一轮解决了 Python/C++ 边界和长 history 头删，但 profile 里还有三类成本：每次 requote 临时构造 L2 vectors、热订单携带完整 trace、长周期 vol-regime 每次重新扫历史。第二轮没有改策略公式，而是继续压缩数据运动。

##### L2 使用 view，不再逐行复制

原始 L2 输入是四个 SoA 矩阵：bid price/qty、ask price/qty。把它们先拼成 `vector<DepthLevel>`，既分配又把 SoA 重新交错。现在 quote core 直接消费两个 span pair：

```cpp
struct DepthSideView {
    std::span<const DepthLevel> levels; // owned API 可用
    std::span<const double> prices;     // matrix row 可用
    std::span<const double> quantities;

    [[nodiscard]] double price(std::size_t i) const noexcept;
    [[nodiscard]] double quantity(std::size_t i) const noexcept;
};

struct DepthView {
    DepthSideView bids;
    DepthSideView asks;
};

const DepthView depth{
    DepthSideView{{}, bid_px.row(i), bid_qty.row(i)},
    DepthSideView{{}, ask_px.row(i), ask_qty.row(i)},
};
const auto quote = compute_quote_core(state, cfg, pred, depth);
```

公开 pybind API 仍保留 owning `DepthSnapshot`，它只需提供 `.view()`。replay 和 batch 则直接 view NumPy buffer 的矩阵行，不再为每个 tick/row 分配两个 vector。

BBO/L2 的 current-time snapshot 也从每次 binary search 改成 loop-owned cursor：

```cpp
bbo_idx = advance_index(input.bbo_ts_ms, bbo_idx, ts);
l2_idx = advance_index(input.l2_ts_ms, l2_idx, ts);
const auto book = book_snapshot_at(input, ts, bbo_idx, l2_idx, ...);
```

这里有一个不能“顺手优化”的边界：queue ahead 使用未来 `activate_ts`，而 latency jitter 会让相邻订单的 activation timestamp 不保证单调。它不能共享 current-time cursor，因此仍保留二分。错误共享 cursor 会把未来盘口泄漏给当前 quote，速度快了，回测却坏了。

##### ReplayOrder 只保存会参与成交循环的字段

旧 `ReplayOrder` 同时持有完整 `SideQuoteContext` 和 `TraceOrderRow`。即使 trace 关闭，`transition_orders()`、`best_live_order()`、`process_side_fill()` 扫描的每个订单也背着一大块冷数据。现在热结构只保留成交状态：

```cpp
struct ReplayOrder {
    Side side;
    double price, remaining, queue_left, queue_init;
    std::int64_t quote_ts, activate_ts, cancel_effective_ts, ttl_ms;
    OrderState state;
    bool side_adverse, defense_guard, local_extreme_guard;
    TraceOrderRow* trace = nullptr;
};
```

只有 `trace_quotes_max` 或 `trace_fills_max` 大于零时，才从 arena-backed `unsynchronized_pool_resource` 分配 cold row。hot order 用带 PMR deleter 的 RAII pointer；订单退出后 slot 回到 pool，不会像纯 monotonic allocation 一样随长窗口持续累积。输出 trace 仍复制到 owning result vector，pool pointer 不跨函数生命周期。

fill trace 的时间窗也改成 `lower_bound/upper_bound` 定位，不再从第零条成交开始扫；1s/5s/30s markout 同样用 `lower_bound` 找 horizon。trace 默认关闭，这项优化主要服务大规模 quote decomposition。

##### summary-only 不是简单丢掉曲线

PnL curves 原先还承担 Python 侧 Sharpe 和 max drawdown，所以不能直接禁用。C++ replay 现在每次 requote 在线维护 peak、drawdown、PnL delta、时间增量以及标准化 delta 的一、二阶矩：

```cpp
const double normalized = pnl_delta / std::sqrt(dt_s);
pnl_delta_sum += pnl_delta;
pnl_dt_sum += dt_s;
normalized_sum += normalized;
normalized_sq_sum += normalized * normalized;
peak_pnl = std::max(peak_pnl, current_pnl);
max_drawdown = std::max(max_drawdown, peak_pnl - current_pnl);
```

单次 API 的 `collect_curves=true` 保持兼容；C++ sweep、cap A/B、统一 `tick_ab.py` 和 quote-EV A/B 自动使用 summary-only。2M trades、200k requotes 的 synthetic replay 中，CPU 只从 42.18ms 降到 41.77ms，约 1%；真正收益是三条 200k vector 变成零行，也无需再转成 NumPy。

##### 长周期 moments 增量化，但保持数值稳定

长 history 的主要扫描来自 2,160/8,640 条 `return_abs` 均值和最多 60,480 条 `vol_regime_6h` z-score。它们现在由 fixed-count rolling moments 在 `push_history()` 时更新。

简单维护 `sum_sq - sum²/n` 在低方差序列上会严重消差；长历史 parity test 正好抓到了这个问题。因此实现使用支持删除最旧值的 Welford `mean/M2` 更新，而不是放宽测试：

```cpp
static void remove_value(double x, std::size_t n,
                         double& mean, double& m2) noexcept {
    const double next_mean = (n * mean - x) / (n - 1);
    m2 = std::max(0.0, m2 - (x - mean) * (x - next_mean));
    mean = next_mean;
}
```

`SignalFeatureEngine.compute_values()` 返回固定顺序的 NumPy array；`SIGNAL_FEATURE_NAMES` 只在模块初始化时创建一次。旧 dict API 仍兼容。满 60,480 history 时，fixed-array snapshot 从第一轮约 111.23us 降到 1.90us，兼容 dict 为 4.42us。短历史 live 整体仍受 Python feature merge/model 路径影响，没有据此切换 live 默认配置。

##### 只给逐行独立 batch 加线程

单个 replay 的订单、库存、现金和 latency 状态强顺序依赖，仍保持单线程。depth quote batch 的每一行独立，才新增显式 `workers` 参数；默认 1，每 worker 至少 4,096 行：

```cpp
std::vector<std::jthread> threads;
for (std::size_t worker = 0; worker < worker_count; ++worker) {
    threads.emplace_back(run_rows, begin[worker], end[worker]);
}
```

100k rows × 10 levels 的 Release benchmark：1 worker 为 35.48ms / 2.82M rows/s，4 workers 为 10.08ms / 9.92M rows/s，快 3.52x。参数已经贯通到 `cross_market_shock_audit.py --quote-context-workers N`，但不会自动开启：若外层已经按 day/window/arm 多进程并行，再把每个进程开满内部线程只会过度订阅。

第二轮验证结果在 2026-06-21 对应代码快照上为快速 suite `20 passed, 4 skipped`、四个真实窗口 golden parity `4 passed`，核心 C++20 翻译单元仍为零 warning。测试数量绑定该轮 commit/fixture；优化改变了 allocation、cache footprint 和输出策略，没有改变成交路径，也没有修改 live 配置。

### 1.5 ARM 本机 benchmark：离线低延时服务反例产能

ARM 本机回测里的“低延时”，真正要解决的是反例产能：更多质量合格日、更多窗口、更多策略臂、更重的 quote context，以及更严格的 Python/C++ parity。它的价值不是把某个函数调用压到多漂亮，而是把原本只能抽样看的 replay，推进到可以系统性跑日度 panel、blocked-day validation 和 stress diagnostics。

离线 benchmark 里的尾部数字仍然有用，但它主要用来定位非确定性来源：隐式 Python fallback、异常对象分配、I/O 抖动、内存暴涨、swap、多进程过度订阅或路径分叉。只要这些风险被排除，离线侧更核心的指标就是完整窗口耗时、每秒处理行数、每天/每臂 sweep 产能、路径级 parity、金额级 parity、内存峰值和失败可解释性。

这也改变了参数搜索的工程形态。NarrowGate 现在不再把 `live/config.yaml` 看成一个可以暴力全组合扫描的超大网格，而是先把参数分成五类：

| 类别 | 例子 | 验证方式 |
|---|---|---|
| quote-controller compatibility parameters | `gamma/eta_inventory/a_spread`、legacy touch-slope adapter、depth liquidity multiplier、`adverse_*`、`fill_cooldown`、replace throttle | Python reference + baseline-gated C++ fast screening + daily/campaign gate；不把兼容字段当作 GLFT 标定量 |
| live-only | API、WebSocket watchdog、`sync_adjust_*`、日志 | live soak / fault audit |
| offline diagnostics | adaptive cooldown、local extreme、depth execution probes | retained-data replay / target-host soak；不因研究缺字段而默认新建 live shadow |
| archived/removed | direct Quote-EV live、SELL resiliency live、历史 RL | Quote-EV/SELL resiliency executor 与相关运行入口已删除，只保留历史 audit/model evidence；RL 入口、配置和 lazy-loader 也已删除，不进 sweep |
| live-static | symbol、tick/lot、fees | 合约事实，不优化 |

当前入口收束为 `models/parameter_selection.py` 与 `models/parameter_racing_sweep.py`：前者生成 coverage report 和 one-factor / Sobol arm spec，后者负责 staged racing、partial state 与 retained panel 计划，并把通过 gate 的 arm 交给现有 tick/campaign runner。旧 `models/fast_cpp_arm_smoke.py` 已删除，不再保留第三套宽筛 CLI：

```bash
.venv/bin/python models/parameter_racing_sweep.py \
  --symbol BTCUSDC \
  --tag parameter_quick_20260705 \
  --stage quick-smoke \
  --groups spread guard cooldown execution \
  --single-factor \
  --workers 4 \
  --window-cache-dir ${NARROWGATE_DATA_ROOT}/window_cache \
  --execute
```

`quick-smoke` 默认只跑一个上限约 30 个 arms 的 group-balanced 小面板；完整 60+ arm 主效应面必须显式使用 `--stage quick-full-main-effect`。宽 Sobol/search 先走 summary-only C++ smoke，只有 survivor 才进入 campaign replay。后者在每个 UTC day 完成后写 partial daily / rollup / campaign labels，长任务中断时不会把整段计算全部丢掉。

它不是“自动炼金器”。它只是把过去散落在多个 `*_sweep.py`、`stage_t_*` 和 bucket 脚本里的调参动作，收束成一个约束优先的实验设计：

早期 sweep 的 winner 和排名已经删除，不能被重新包装成当前候选。当前参数研究必须从严格绑定身份的 rolling live baseline 重新出发，先过 mechanism gate，再看 campaign outcome 和 order-level fill selection。

C++ fast screening、fill-quality score 和 action-level OPE 也必须分开。C++ 的职责是更快生成经过 parity 约束的订单生命周期反事实；score 只负责排序状态；真正估计候选动作价值时，还需要完整 decision denominator、behavior propensity、action overlap、action-specific reward 与 doubly robust evaluation。项目新增的 `models.audit.offline_policy_evaluation` 会输出 DM、clipped IPS/SNIPS、DR、day-cluster bootstrap、ESS 和 unsupported mass。若 `re-center/skip/widen` 从未被 behavior policy 尝试，它会 fail overlap gate，而不是让 C++ 回放速度或回归外推替这个动作“补证据”。输入与边界见 [GitHub OPE 文档](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/offline_policy_evaluation_20260712.md)。即使数值 gate 通过，结论仍以 consistency、conditional exchangeability、positivity、无跨 decision 干扰和正确 reward attribution 为条件；C++ parity 只提高反事实生成可信度，不会自动满足这些因果识别假设。

```text
parameter coverage
  -> one-factor / Sobol candidates
  -> quick-smoke retained days
  -> quick-full-main-effect only when explicit
  -> reject mechanism-drift arms early
  -> frozen chronological validation
  -> family-specific sealed holdout
  -> historical or separately authorized live shadow / soak
```

排序也不再直接看 raw PnL。新的 `constraint_first_score` 先看 arm 是否仍像 baseline 一样运行：fills retention、pause/action mix、BUY/SELL split、tail campaign、bad campaign rate 和 inventory time 都不能明显漂移。只有这些硬约束过线，terminal campaign PnL、raw、InvAdj 才进入排序。这个设计比“多开几个 worker”更重要，因为它减少的是错误实验本身，而不只是把错误实验跑得更快。

NarrowGate 当前 C++ hot path 并没有把 `std::atomic` 当作优化手段；代码里真正显式的 C++ 内部并发，是 `compute_quote_core_batch_depth(..., workers=N)` 的 `std::jthread` 分片。因此风险不是“某个 atomic trick 在 ARM 上慢”，而是更朴素：**本机离线吞吐优化不等于 x86 live 尾延迟优化**。

更专业一点说，我后来把优化项按 CPU/OS 层拆成下面这张表，而不是笼统地说“C++ 更快”：

| 层面 | Apple Silicon / ARM 本机更容易看到的收益 | x86 Linux live 需要重新判断的点 | 对 NarrowGate 的工程含义 |
|---|---|---|---|
| CPU 前端与 I-cache | 本机编译器、P-core 前端、统一内存带来的微基准很稳定，适合看代码布局和 pybind 固定税 | 目标 live 机器通常是云上 Intel/AMD，32KiB L1I 很常见，SMT/虚拟化会改变 p99 | 只缩小整个 `.so` 的 `__text` 没意义；要看 live 事件实际经过的 hot instruction working set |
| D-cache / TLB / allocator | replay 的 `DepthView`、hot/cold order、summary-only curves 很容易在本机吞吐 benchmark 中体现 | live 的状态更小，但 tail latency 更怕偶发分配、page fault、跨 NUMA/跨 socket 访问 | replay 优化主要服务研究吞吐；live 侧要优先去掉每 tick 动态对象和字符串查找 |
| memory ordering / atomics | ARM 上不同实现可能走 LL/SC retry 或 LSE，竞争时成本形态和 x86 不同 | x86 有更强内存模型和 `LOCK` 前缀原语，但 false sharing 仍会毁掉 tail | 当前 hot path 不用 `std::atomic`；未来 lock-free queue 必须分别在 ARM/x86 测 |
| SIMD / 数学库 | ARM64/NEON、Apple Accelerate/本机 wheel 影响训练和 NumPy/LightGBM 吞吐 | x86 wheel 可能走 AVX2/AVX512/OpenBLAS/OpenMP，不同实例族差别很大 | `models/ml_model.py` 的 Apple 参数只服务本机训练；live venv 要固定 BLAS/OMP 线程 |
| 线程调度 / SMT / IRQ | 本机桌面负载和核心调度相对可控 | 云上 2 vCPU 可能只是同一个物理核的两个 SMT 线程；ENA/NVMe IRQ 与 softirq 会抢 CPU | `taskset` 不一定总是好事；先固定库线程，再观察 CPU migration 和 p99.9 |
| Python/C++ ABI | pybind 往返在 ARM 上可能比 quote 数学本身更贵，导致 scalar C++ 负优化 | x86 上 tuple ABI 可能足够便宜，但 dict/asdict 仍是固定税 | live C++ 要迁“大包决策”，不要迁单个 scalar 函数；固定 tuple/array 比 dict 更重要 |
| 可观测性 | 本机可用 Instruments、`time`、Python profiler 和局部 microbench | 云 KVM 可能不暴露 PMU，`perf stat` 看不到 cycles/L1I/iTLB | 没有 PMU 时只能先用 wall-time p99/p99.9 soak；最终 promotion 要在真实 live 机型复测 |

我把这些结果分成两类。

第一类是“本机有效但 live 不一定有效”：

- `models/ml_model.py` 里的 Apple Silicon/ARM64 假设。LightGBM 的 native ARM64、NEON、统一内存和本机核心数，只说明本机训练吞吐；x86 研究机应重新设置 `MM_LGB_THREADS`、histogram pool 和 OpenMP 亲和性。
- 所有 multiprocessing sweep。`backtest_tick.py --sweep`、`tick_ab.py --workers`、quote EV A/B workers 缩短的是多月、多臂、多窗口研究 wall time；live 的决策路径仍然是单事件、强顺序、低尾延迟问题。
- `compute_quote_core_batch_depth(..., workers=N)` 的 worker 分片。100k rows × 10 levels 在本机 4 workers 快 3.52x，但如果外层已经按 day/window/arm 多进程并行，再在每个进程内部开满线程，只会过度订阅。x86 上 worker 数要重新扫。
- tick replay 的 allocator/cache locality benchmark。`DepthView`、hot/cold order、summary-only curves 和 PMR trace pool 减少了 replay 的内存运动与 Python 转换，但它们首先服务离线研究吞吐，不自动证明 live quote/routing 更快。

## 第二部分：x86 live 低延时：尾延迟、毛刺与 hot path

live 的低延时不是把本机回测的优化指标照搬过来。回测可以一次喂完整数组，可以释放 GIL，可以让外层 sweep 多进程并行；live 每次只面对一个最新 market state、一个 depth snapshot 和一组本地订单状态。它的失败形态也不同：毛刺可能让 quote stale、cancel late、replace 迟到，或者让本来该降级的状态继续报价。

所以 x86 live 章节只问三件事：目标机器上 native 开关是否真的降低尾延迟；pybind/对象物化有没有引入 fallback 或尖刺；当前架构离真正 HFT live stack 还差哪些系统边界。

### 2.1 x86 live benchmark：短跑看方向，soak 看 p99/p99.9

需要在 x86 live 目标机器上单独 benchmark 的开关包括：

```bash
scripts/x86_live_env_audit.sh
scripts/x86_live_benchmark.sh
scripts/x86_live_soak.sh
```

这些 benchmark 也不能只看 mean。live 关心 p99/p99.9、偶发抖动和是否触发跨语言 fallback。目标 x86 Linux 上应该同时看 `cycles`、`instructions`、`branch-misses`、`L1-icache-load-misses`、`iTLB-load-misses`、LLC miss、context switches。只有这些指标和策略 parity 一起过，native 开关才有资格从 shadow 变成配置候选。

2026 年 7 月，我拿当时的 x86 EC2 live host 做了这件事：Amazon Linux 2023、Intel Xeon Platinum 8259CL、2 vCPU（一个物理核的两个 SMT 线程）、L1d/L1i 都是 32KiB，clocksource 是 `tsc`。这台历史主机一开始甚至没有 `gcc/g++/cmake`，所以第一步不是调参数，而是把 live benchmark 环境和训练环境拆开；下面的 Python 3.11 环境与性能数字均绑定该冻结 host/runtime，不能直接代表 2026-08-11 之后的 Python 3.12 新 AWS epoch。

这里有个很现实的坑：如果在 Linux live 机器上直接 `pip install -r requirements.txt`，`torch` 会默认拉一大串 CUDA wheels。它对这个 maker live path 没帮助，却会把 32G 根盘迅速塞满。我最后只装了 live benchmark 需要的轻量依赖：

```bash
python3.11 -m venv .venv
source .venv/bin/activate

pip install numpy pandas pyarrow lightgbm scikit-learn scipy \
  pyyaml requests binance-futures-connector websocket-client \
  pycryptodome zstandard pytest
pip install -e cpp
```

为了不再靠手敲命令，我加了三个脚本：

```bash
scripts/x86_live_env_audit.sh
scripts/x86_live_benchmark.sh
scripts/x86_live_soak.sh
```

第一个脚本记录 OS、CPU/cache、clocksource、sysctl、IRQ、Python/narrowgate_cpp import 和 NumPy backend。第二个脚本做短跑 smoke：Python baseline、C++ quote core、C++ signal features、候选组合和 compact live-routing ABI。第三个脚本只跑候选组合长样本 soak，用来观察 p99.9。

```bash
export OMP_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1
export MKL_NUM_THREADS=1
export NUMEXPR_NUM_THREADS=1
export MALLOC_ARENA_MAX=1
```

然后依次跑 Python baseline、C++ quote core、C++ signal features、候选组合和 compact live-routing ABI。

这次 x86 结果很有意思，因为它和 Apple Silicon 本机结论并不完全一致：

| 开关 | signal 10s mean/p99 | `_compute_quotes` mean/p99 | mixed quote/policy mean/p99 | 结论 |
|---|---:|---:|---:|---|
| Python baseline | 3431 / 4159 us | 152 / 201 us | 240 / 305 us | x86 baseline |
| `NARROWGATE_CPP_QUOTE_CORE=1` | 3328 / 4233 us | 121 / 158 us | 210 / 270 us | quote core 在 x86 上转正 |
| `NARROWGATE_CPP_SIGNAL_FEATURES=1` | 1973 / 2347 us | 153 / 194 us | 237 / 302 us | signal features 在 x86 上明显有收益 |
| `QUOTE_CORE=1 + SIGNAL_FEATURES=1` | 1949 / 2199 us | 120 / 160 us | 209 / 269 us | 该轮 x86 工程候选组合 |

> **这张表怎么读**
>
> - 说明什么：ARM 本机结论不能直接外推到 x86 live；目标机型上 quote core 和 signal features 的方向都要重新测。
> - 不能说明什么：短跑 smoke 不能代表长时间 p99.9，也不能代表网络、REST 和交易所响应。
> - 下一步验证：固定 BLAS/OMP 线程后跑 soak，并确认没有 CPU migration、page fault 或 fallback 尖刺。

短跑只能说明方向，所以我又在同一台 x86 benchmark 机型上跑了更长的 soak：baseline 和候选各 `--n 100000 --signal-n 10000`，routing compact ABI `--n 200000`。下面采用 EC2 上实际保留的 benchmark artifact，而不是后来手抄过的一组中间数字：

| 路径 | Python baseline mean/p99/p99.9 | `QUOTE_CORE + SIGNAL_FEATURES` mean/p99/p99.9 | 观察 |
|---|---:|---:|---|
| signal 10s features | 15970 / 50395 / 159093 us | 3630 / 14858 / 42108 us | C++ fixed-array 把 mean、p99、p99.9 都压低约 70%-77% |
| live `_compute_quotes` | 267 / 566 / 1329 us | 229 / 665 / 1909 us | 均值改善，但这轮 p99/p99.9 反而更差，不能把 quote core 单独称为稳定胜出 |
| mixed quote/policy path | 486 / 1412 / 6592 us | 438 / 1175 / 5128 us | Python side policy + native compact quote/routing 的 mean 与尾部有小幅性能改善；policy 主体仍在 Python |
| compact routing ABI | n/a | 1.94 / 3.10 / 18.91 us | 固定 tuple ABI 的 p99 很低，p99.9 仍可见解释器/调度毛刺 |

> **这张表怎么读**
>
> - 说明什么：x86 上最明确、可重复的 CPU 收益来自 fixed-array signal features；compact routing ABI 本身也足够轻。
> - 不能说明什么：quote core 的均值改善没有在每轮 p99/p99.9 上稳定复现；而且这组数不包含 Binance 网络、REST new/cancel、交易所撮合和真实异常恢复。
> - 下一步验证：先用已授权的 canonical operational/performance telemetry 或目标主机离线 soak，比较 native 开关时的 HEALTH、requote、ORDER_UPDATE 和 p99.9；不为研究候选默认新增 sidecar/shadow。

随后我又在当时实际运行 live 的私有 x86 主机上补了这一步：Amazon Linux 2023、Intel Xeon 系列 vCPU，以及该 epoch 的 venv、模型和配置。这里要把 synthetic benchmark、真实 live telemetry 与研究机制 parity 分开；这些表都属于原 host/runtime 的历史证据，可以复用作工程先验或敏感度，但不能因新主机同在 Tokyo 且 CPU/内存规格相近，就重标为新 AWS epoch 的当前延迟。

第一类仍是 synthetic benchmark。它只测 Python/C++ 决策路径本身，不包含真实 Binance REST 往返。本轮命令是：

```bash
python bench/bench_live_path.py --n 5000 --signal-n 500 --ml --engine python

NARROWGATE_CPP_QUOTE_CORE=1 \
NARROWGATE_CPP_SIGNAL_FEATURES=1 \
NARROWGATE_CPP_STRICT=1 \
python bench/bench_live_path.py --n 5000 --signal-n 500 --ml --engine cpp --strict-cpp
```

该冻结 live epoch 可以正常 import `narrowgate_cpp`。下面这张表只回答“这台 x86 上 C++ fixed-array / quote core 本身是否值得继续做目标主机工程验证”，不包含真实 REST、交易所 ACK 和订单生命周期，也不授权新建 live shadow。

| 路径 | Python baseline mean/p99/p99.9 | `QUOTE_CORE + SIGNAL_FEATURES` mean/p99/p99.9 | 读法 |
|---|---:|---:|---|
| ingest 1s ws events | 91.01 / 178.84 / 441.45 us | 108.37 / 206.71 / 640.06 us | ingest 仍是 Python 事件路径，native 组合没有带来收益 |
| signal cached | 21.14 / 47.81 / 389.72 us | 19.00 / 34.12 / 58.40 us | cached path 的尾部更稳 |
| signal 10s features | 12395.55 / 95617.29 / 139250.92 us | 3497.96 / 8772.66 / 19431.87 us | fixed-array state 是最清楚的 CPU 收益 |
| live `_compute_quotes` | 357.99 / 558.48 / 1170.40 us | 267.88 / 1183.41 / 3128.01 us | 均值更低，但 p99/p99.9 在这轮变差 |
| side policy pair | 125.20 / 223.37 / 287.34 us | 136.84 / 376.36 / 1204.02 us | policy 主体仍在 Python，native quote 不解决这里 |
| mixed quote/policy path | 536.57 / 895.01 / 1698.98 us | 696.11 / 4829.99 / 14519.30 us | Python side policy + native quote/routing 的短跑出现明显尖刺，与 100k 长跑方向不一致 |

这张表和 ARM 本机结论不同：在该冻结 x86 live epoch 中，`SIGNAL_FEATURES=1` 已经不是早期那种负优化；它在短跑和 100k 长跑里都明显降低 10s feature 的均值和尾部。quote core 则更微妙：短跑里 `_compute_quotes` 均值更低，尾部却更差；100k 长跑里 mixed quote/policy path 又恢复为小幅改善。这种 run-to-run 波动说明共享 VM 上不能凭一次 microbenchmark 宣布 quote core 胜出，真正稳定的结论仍只有 fixed-array signal 与低成本 compact routing ABI。

第二类是真实 live 进程旁路 telemetry。我在 `MakerEngine` 里加了 `logs/live_perf_telemetry.csv`，每次 requote 记录 `signal_compute_us`、`compute_quotes_us`、`update_orders_us`、REST new/cancel 耗时，以及 futures/spot/reference WebSocket age。

2026-07-01 的受控 live soak 曾经把进程环境切到：

```bash
NARROWGATE_CPP_QUOTE_CORE=1
NARROWGATE_CPP_SIGNAL_FEATURES=1
NARROWGATE_CPP_LIVE_ROUTING=1
OMP_NUM_THREADS=1
OPENBLAS_NUM_THREADS=1
MKL_NUM_THREADS=1
NUMEXPR_NUM_THREADS=1
MALLOC_ARENA_MAX=1
```

第一版只把 `replace_min_price_change_ticks` 设成 1-2 tick，结果几乎没有减少 REST：BTCUSDC 报价每轮自然跳动经常是几十 tick，2 tick 门槛基本等于没设。后来改成非零的 adding/reducing 门槛，并保留减仓方向更敏捷的 interval。这个改动不是 alpha 参数，而是 order lifecycle coalescing：价格没有变到足够多时，不做 cancel+new；TTL、stale-data、pause 和库存安全撤单不被阻断。

受控 soak 里，`cpp_routing_used` 覆盖率达到约 97%-99.6%，并出现 `REPLACE_THROTTLE`。但 2026-07-10 回查当时进程时发现了一个更值得记录的部署问题：进程通过 `live/run.sh` 重启时只从 `live/.env` 加载了 API 凭据，`NARROWGATE_CPP_QUOTE_CORE`、`NARROWGATE_CPP_SIGNAL_FEATURES`、`NARROWGATE_CPP_LIVE_ROUTING` 和 `NARROWGATE_CPP_STRICT` 都没有持久化。结果是当时约 24 小时 telemetry 中 `cpp_routing_used=0%`，signal/quote/routing 也都回到了 Python 路径。

这不是 C++ 运行时退化，而是 **opt-in feature flag 没有成为部署 profile**。它暴露了一个低延时系统很实际的问题：benchmark 命令里的环境变量如果没有进入 `run.sh` 可审计的 profile，下一次策略参数重启就会静默丢失。以后 live soak 必须同时记录进程启动环境、extension 路径、strict flag 和 telemetry native-hit rate；只看“机器上可以 import `narrowgate_cpp`”远远不够。

随后把这个部署缺口修成了显式 profile，而不是继续依赖运维人员记住一串 `export`：

```bash
# 凭据仍来自不进 Git 的 live/.env；这里只选择非秘密计算 profile。
NARROWGATE_LIVE_PROFILE=python ./live/run.sh restart
NARROWGATE_LIVE_PROFILE=native ./live/run.sh restart

# 在真正重启前先审计将被加载的开关。
NARROWGATE_LIVE_PROFILE=native ./live/run.sh profile
```

`native.env` 固化 `QUOTE_CORE + SIGNAL_FEATURES + LIVE_ROUTING + STRICT`，并把 OMP、OpenBLAS、MKL、NumExpr 的线程数固定为 1；`python.env` 保留相同线程环境，只关闭 native 实现。`main.py` 启动时主动 import extension，检查所需 API，并把 profile 名、全部开关和 `.so` 来源写进启动日志。strict profile 如果缺模块或 binding，会在连接交易所、发送订单之前失败；`run.sh status` 也会显示当前持久化 profile。这样“Python/native A/B”才是在换实现，而不是顺手换了线程池、配置或环境。

2026-07-11 又发现了一个比函数 benchmark 更危险的部署边界：一段历史进程使用相对路径 `.venv/bin/python3 live/main.py` 启动，而旧版 `run.sh` 只按绝对 `main.py` 路径识别进程。一次 restart 因此误判为“未运行”，又启动了第二个 maker，交易所短暂出现两组双边订单。确认订单归属后先撤单并终止旧进程，随后把 `run.sh` 改为同时识别绝对/相对入口；即使 PID 文件缺失，`start` 也会先扫描现有 maker，发现单实例已存在就拒绝重复启动。这个事故没有改变策略参数，却说明低延时工程的正确性还包括**单实例、订单所有权和可恢复启动**；只优化 p99，而不能证明现场只有一个决策者，性能数字没有生产意义。

下面把两段历史 native soak 与当前 Python 进程放在一起。它们不是同一市场时段的 A/B，不能据此计算“C++ 让端到端快了多少”；这张表只用于检查数量级和部署状态。REST 分位数使用每个 requote 内真实调用的 max sample，不把零调用行混进统计：

| live 窗口 | native routing hit | keep / pause | signal p50 / p99 | requote p50 / p99 | REST new / cancel p99 |
|---|---:|---:|---:|---:|---:|
| 2026-07-01 controlled native 90m | 99.56% | 16.34% / 4.62% | 15.17 / 341.27 ms | 50.78 / 912.87 ms | 92.85 / 122.18 ms |
| 2026-07-01 controlled native 60m | 96.91% | 24.86% / 10.44% | 9.38 / 266.86 ms | 38.81 / 673.31 ms | 91.29 / 109.60 ms |
| 2026-07-09 current Python 24h | 0% | 13.23% / 12.86% | 27.85 / 302.81 ms | 63.85 / 781.87 ms | 87.44 / 94.83 ms |

当前 Python 24 小时窗口的 `requote_total_us` p99.9 仍约 1.41 秒；`update_orders_us` p99 约 440ms，而 `_compute_quotes` p99 约 12.7ms。也就是说，即使重新打开 C++ quote/routing，端到端 p99 的上限仍然主要由 order lifecycle 决定。历史 native soak 的 signal p50 明显更低，但 p99 仍可达数百毫秒，也说明解释器调度、模型/日志、虚拟机抢占和行情状态会盖过单个 C++ tight loop 的收益。

这段 live telemetry 因此保留了最初的工程判断：`keep` 已经明显出现，说明 replace throttle 确实减少了一部分无意义撤挂；它也暴露出 `pending_coalesce` 必须有独立 counter，不能只从 action mix 里猜。当时的 gateway 实验曾为此补过独立 telemetry；该 gateway 及其专属 telemetry ABI 后来一起删除。REST 只统计有真实 REST 调用的行时，new/cancel 的 p99 仍然可以进入百毫秒量级；完整 requote 的 p99/p99.9 仍由 order lifecycle 拉长。所以该冻结 live 窗口中尾部的主因不是 quote math，而是：

1. REST cancel/new 的百毫秒级尾部；
2. `update_orders()` 同步等待导致的路径拉长；
3. `signal_compute_us` 偶发长尾；
4. WebSocket 短时 silence/reconnect 对 freshness 的扰动。

安全路径在当前窗口仍然工作：telemetry 有少量 `stale_book` / `risk_block`，日志没有进程级 traceback，也没有持续 stream silence；偶发 post-only reject 和 cancel unknown-order 仍会进入订单状态机。关键读法是，网络/交易所路径的毛刺会直接进入 live p99，不能被 synthetic benchmark 消去。

profile 固化后，该冻结 x86 live epoch 的第一段同步 native preflight 做到 `cpp_routing_used=100%`，strict 模式没有 fallback，extension 来源也与预期的 x86 CPython wheel 一致。这个短窗口只证明当时的部署链路恢复了，不能替代完整的 Python/native 同口径 soak，更不能直接外推到后续 host/runtime；restart 附近的 inventory sync、warmup 和 sync-degrade 行也必须先从 marker 中排除。

同一配置下又做了两段相邻的短窗 preflight。Python-sync 约 8.4 分钟，native-sync 约 9.1 分钟；后者的 `requote_total_us` p50/p99 从约 `44.5/434.7ms` 变成 `40.5/318.3ms`，`signal_compute_us` p99 从约 `132.8ms` 变成 `95.4ms`，`compute_quotes_us` p99 从约 `14.4ms` 变成 `3.9ms`。native hit 为 100%，没有 strict fallback。这里最重要的不是百分比，而是口径：两个窗口共享代码、配置、线程限制和 marker schema，但市场时间不重叠，因此只能作为 deployment preflight，不能称为严格因果 A/B。

因此当时没有根据短窗口直接调 replace threshold，而是先做同一配置的 Python/native sync A/B，再保持 native profile 不变测试 async gateway。下面记录的长 soak 已经完成并否证这条实现：action mix 和安全链路虽可运行，p99/p99.9 没有改善，coalesce 也几乎没有形成。

该冻结窗口的结论也随之更新：**C++ fixed-array 当时进入可持久化的 live profile，能压缩 signal/quote/routing 的计算部分；端到端 p99 的剩余主因仍是 order lifecycle、REST tail、pending state 和系统调度。该 identity 保持同步 adapter；若未来重做异步网关，必须以新的 bounded-queue/backpressure 实验重新开始，不能复活旧开关。**

#### 2.1.1 历史失败实验：Per-side latest-wins order gateway

> **历史状态（2026-07-19）**：本节只保留 2026-07-10 的系统实验与失败证据。`strategy/order_gateway.py`、配置开关、专属 telemetry ABI 和测试已于 2026-07-17 物理删除；当时回到同步 normal-order adapter。该结论不包括本文新增说明的 9 月 GLOBAL FIFO 异步响应路径，不能外推为今天仓库没有异步实现。

当时的出发点是：直接把 `rest.new_order()` 扔进普通线程池并不安全。行情每几秒可能产生一个新目标，而前一个 cancel/new 还在交易所或用户流中收敛；无界任务队列会让“最新报价”排在一串已经过期的价格后面。实验实现因此使用 **每侧容量为 1 的状态机**：

```text
market / decision thread
    desired[BUY]  = newest bid intent
    desired[SELL] = newest ask intent
              │
              ├── BUY worker: wait pending -> cancel old -> re-read newest -> place
              └── SELL worker: wait pending -> cancel old -> re-read newest -> place

new intent while REST is in flight:
    overwrite desired[side]
    coalesced_count += 1
    do not append another REST job
```

当时的实现放在后来已删除的 `strategy/order_gateway.py`。BUY/SELL 各有一个 worker，避免一侧 cancel 尾部阻塞另一侧；每侧只保留最新 `QuoteIntent`，旧 generation 不会继续下单。worker 在 `PENDING_NEW/PENDING_CANCEL` 时等待状态收敛，超时只记 telemetry，不绕过订单账本。REST cancel response 只证明请求返回，订单终态和 cancel 前可能发生的 fill 仍由 user stream 驱动；缺失事件继续走原有 stale pending reconciliation。

实验中的异步路径只接管正常 quote/place/replace，以下路径故意保持同步并高优先级：

- stale book / stream safety cancel；
- cancel-all 与进程 shutdown；
- emergency close 和 maker 原生退出；
- 库存硬上限触发的即时撤单。

当时的 `async_order_gateway_enabled` 是 startup-only 开关，SIGHUP 不能在有活跃订单时改变线程模型。逐操作的 `place/cancel/coalesce/pending_timeout/error` 写入独立的 `order_gateway_telemetry.csv`，`HEALTH` 同时输出累计值。上述开关、CSV schema 和 counter 都随失败实现删除，不能作为当前配置或日志契约引用。

第一段 native-async 安全 preflight 约 10.1 分钟。窗口内记录到 `178` 次 submit、`164` 次 cancel、`165` 次 place，`coalesce/timeout/error=0/0/0`；gateway new/cancel p99 约为 `172/184ms`。`update_orders_us` p50 从同步 native 的约 `36.8ms` 降到 `15.5ms`，说明正常 REST 已经离开决策线程；但 p99 从约 `249ms` 升到 `833ms`，不能据此宣布尾部改善。逐行复盘发现，最慢的两次 requote 同时伴随 signal、quote 和 update-orders 的整体停顿，而 gateway 没有 pending timeout 或 error，更像 VM 调度、GIL/日志竞争或同一时刻的进程级 stall。每段只有约百个 requote，p99 实际只由一两个样本决定。

后续 native-async 长 soak 累积了约 194.4 分钟。native routing hit 为 `99.64%`，双边 fills 为 `24/27`，WebSocket 没有持续 silence，TTL、stale-data block 和 safety cancel 仍然工作。gateway 共记录约 `3513` 次 submit、`2799` 次 cancel、`2850` 次 place，但 coalesce 只有 `1` 次，window timeout/error 为 `0/1`。这说明在当前 requote cadence 下，无界 pending replace 并不是常驻瓶颈。

| 路径 | native-sync p50 / p99 / p99.9 | native-async p50 / p99 / p99.9 | 读法 |
| --- | ---: | ---: | --- |
| requote total | 40.5 / 318.3 / 381.1 ms | 31.3 / 720.2 / 1074.8 ms | median 下降，tail 明显变差 |
| update orders | 36.8 / 248.7 / 249.2 ms | 15.9 / 444.1 / 855.1 ms | REST 离开常规路径，但进程级 tail 未消失 |
| signal compute | 7.1 / 95.4 / 132.5 ms | 13.2 / 227.5 / 400.1 ms | 同时恶化，不能归因于 REST worker 本身 |
| quote compute | 0.38 / 3.86 / 8.87 ms | 0.39 / 11.9 / 94.3 ms | scalar quote 不是端到端 tail 的决定因素 |

这仍是相邻、非重叠市场窗口，所以不能把 ratio 当成严格因果 A/B；但工程决策不需要假装有优势：async 没有形成足够 coalesce，p99/p99.9 也没有改善，复杂度和故障面却更高。因此生产 baseline 回滚到 synchronous order adapter，native C++ profile 保留，replace threshold 不因这次 system soak 额外提高。2026-07-17 随后物理删除异步实现、配置、telemetry ABI 和专属测试，不保留“研究路径”式 dormant switch。

当时为了避免 A/B 变成手工摘日志，soak analyzer 曾统一读取 REST/gateway telemetry。当前 `scripts/analyze_live_soak.py` 已移除 gateway 专属输入，只分析仍存在的 action mix、native hit、WS age、placed/fills，以及 signal/quote/update/requote 与 REST 分位数。`scripts/x86_live_profile_ab_soak.sh` 仍只能通过 `run.sh` 管理进程，并要求显式 `ACK_LIVE_SOAK=YES`，避免误把 benchmark helper 变成无人值守的实盘重启器。

#### 2.1.2 历史独立 venue 行情：receive-time 曾是 hot-path 诊断输入

接入外部 reference 的历史实验说明，延迟预算不能只看 Binance quote、routing 和 REST。那一 x86 live 身份曾以 shadow-only 方式接收 Bitget、Bybit、OKX 的 BTCUSDT spot/perpetual 六条行情；外部 connector 没有下单接口，也不进入当时报价函数，只记录 venue-aware event。Binance `USDCUSDT` spot bookTicker 另作本地币种换算锚，不算第七个独立 vote。后来某个冻结 no-shadow 快照记录 external、Flow、Ref 与全部 shadow 关闭；这一节保留的仅是历史工程证据，不声称当前状态。

每条事件同时保留：

```text
exchange_event_ts_ns
local_receive_ts_ns
feature_ready_ts_ns
transport_lag_ms
sequence_number
market_id = venue:instrument_type:symbol
```

这个双时钟不是装饰。第一次独立 smoke 只按 receive-time 判断 freshness，发现连接刚建立时 trade channel 会返回一小批较旧成交：消息是“刚收到的”，但成交事件已经过去十几秒。如果直接把 receive age 当成 market age，trade p99 会被错误放大，策略也可能把历史成交当作新冲击。修复后，snapshot 同时输出 book/trade event age 与 transport lag；整体 reference availability 由 `bookStale` 决定，成交流安静只设置独立的 `tradeStale`，不能覆盖仍然新鲜的 `books1`。

接入过程中的第一个 Bitget-only 窗口曾测到 `books1` transport p50/p99 约 `5.1/37.9ms`，trade 约 `7.8/38.5ms`。随后第二个 source 刻意先用 REST，验证“HTTP 返回快”与“市场事件新鲜”不能混为一谈。Bybit 早期 warmup 后基线如下：

| Bybit public REST | samples | event lag p50 | p95 | p99 | REST RTT p50 / p95 / p99 |
| --- | ---: | ---: | ---: | ---: | ---: |
| BBO | 323 | 139.9 ms | 208.9 ms | 236.6 ms | 76.4 / 82.5 / 95.4 ms |
| trade | 442 | 190.9 ms | 470.2 ms | 512.4 ms | 80.0 / 96.2 / 105.5 ms |

这张 REST 表现在只保留为 transport 反例：它适合说明轮询为什么不能承担 50/100ms maker action，不代表 current live。那一历史身份随后把 Bitget、Bybit、OKX 的 BTCUSDT spot/perpetual 全部切成**无需 API key 的 public WebSocket BBO + trades**；connector 只暴露行情方法，没有账户、持仓或下单接口。当时 HEALTH 中的六个 external ID 是：

```text
bitget:perp:BTCUSDT
bybit:perp:BTCUSDT
bitget:spot:BTCUSDT
bybit:spot:BTCUSDT
okx:perp:BTCUSDT
okx:spot:BTCUSDT
```

统一 public-WS 的 15 秒零密钥 preflight 得到下表。lag 是样本末端 `local_receive_ts - exchange_event_ts` 的短窗观测，不是长期 SLA：

| source | BBO / trade events | 末端 BBO / trade lag |
| --- | ---: | ---: |
| Bitget perpetual | 173 / 70 | 约 5 / 6ms |
| Bybit perpetual | 132 / 21 | 约 38 / 39ms |
| OKX perpetual | 203 / 46 | 约 29 / 30ms |
| Bitget spot | 67 / 51 | 约 13 / 6ms |
| Bybit spot | 94 / 12 | 约 40 / 39ms |
| OKX spot | 75 / 11 | 约 28 / 28ms |

六条 source 的 connector error/reconnect 当时都为 0，spot/perpetual 各有 3/3 fresh venue。该部署窗口的 HEALTH 曾显示 `externalSources=6`、`externalStale=0`、`externalErrors=0`，`marketTapeDropped=0`、`marketTapeInvalid=0` 与 `globalFlow100Valid=1`。receive-time tape 使用无损流式 `.jsonl.gz`；短窗写盘投影由未压缩约 5.9GB/day 降到约 0.54GB/day，没有为了省空间退回 1 秒聚合。六路 source 当时也未进入 active quote policy；这些数值不能被重标为 current no-shadow health。

在 AWS Tokyo `ap-northeast-1` 的 `t3.medium`（2 vCPU、3.75GiB、x86_64、Amazon Linux 2023）上又固定测了 3600 秒，共 682,110 条事件。外部 BBO p50 是 Bitget 约 5-6ms、OKX 约 29-36ms、Bybit 约 38-40ms；p99 已放大到约 268-701ms。更值得警惕的是，同机 Binance perpetual callback p99 约 2.8 秒，而 feature processing p50 通常只有约 71-136µs。这说明尾部主要不是一个 C++ scalar 公式，也不能简单归因于交易所距离；公网 delivery、callback/GIL 竞争、VM 调度与一次受控 restart 都进入了这张表。

这组环境参数已经写成可重放 profile。`captured` 使用现场 `feature_ready_ts`，不再加延迟；`exchange_zero` 是理想对照；`profile_p50/empirical/p99` 从 exchange timestamp 重建可见时间。四笔 maker BUY fill 的 wiring smoke 里，p99 profile 基本消除了 10ms flow，并把 100ms 方向相对 captured 的一致率降到 50%。markout 保持不变，因为 external state 仍未接入报价。这只能证明尾延迟足以改变短窗信息集，不能证明 re-center/cancel 有收益。重启时返回的陈旧 trade batch 继续保留在 tape，但 event age 超过 1 秒时不再进入 10-500ms flow。

#### 2.1.3 callback 解耦实验：有界队列不等于低尾延迟

3600 秒 profile 后，我按代码审计结论实现了第一版 callback 解耦：网络线程只记录 `local_receive_ts_ns`、解 JSON 并入有界队列；BBO 使用每 source 最新值 mailbox，trade/control 保持 FIFO；当时同一 venue frame 内的 trades 通过 `on_cross_agg_trade_batch()` 一次拿 signal 锁。该历史实验后期的 ingress 改为连续数组接口 `on_cross_trade_arrays()`；旧 dict batch 只属于兼容/测试边界。队列深度、高水位、最老事件年龄、BBO coalesce、trade drop 和 handler error 全部进入当时的 `HEALTH`，所以排队不能靠换线程从 telemetry 里消失。

这个机制先后测了两种拓扑，结果都没有 promotion：

| receive-to-feature 路径 | external book feature p99 | external trade feature p99 | 结论 |
| --- | ---: | ---: | --- |
| 原同步 callback，600s | 约 0.43-6.20ms | 约 0.72-27.13ms | 保留 |
| 六个 per-source worker，600s | 约 32.97-105.33ms | 约 43.85-546.68ms | 回退 |
| 一个 shared worker，420s | 约 17.75-45.64ms | 约 747.16-1,960.82ms | 回退 |

六 worker 把六条 source 的 runnable 线程一起压到 2 vCPU 上，调度、GIL 和同一把 `SignalEngine._lock` 的竞争更重。shared worker 虽然少了线程，却串行承担所有 venue 的归一化和 trade 更新；一次 burst 把 FIFO 高水位推到 `1,486` frame，最大排队年龄达到 `4.05s`。两版都没有 trade drop，也没有 dispatcher handler error，这恰好说明失败不是“少记了坏样本”，而是**无损队列本身已经 stale**。相邻窗口不是严格因果 A/B，但这种数量级回归与队列机制量足以做系统 fail-fast。

因此那一阶段的生产口径曾是：六路 public WS reference 在线但只做 shadow/reference；两种失败的 Python dispatcher 实现与 `dispatch_enabled` 开关均被删除，callback 直接做 frame-level normalize/array batch；normal-order adapter 保持 synchronous，native compute profile 保留。完成所需 receive-time capture 后，六路 external JSONL 与 Binance market tape 也默认关闭；记录期间 Binance writer 曾达到 `7,151` 行高水位和 `4.4s` writer queue age，说明完整 raw tape 应该是有起止 marker 的审计模式，不是常驻 live 默认项。关闭录制后的相邻 600 秒 sanity 中，`signal_compute`、`update_orders`、`requote_total` p99 分别约从 `282/809/989ms` 降到 `169/542/797ms`；REST tail 和 action mix 同时变化，所以这里只把它当作“没有机制损伤”的工程检查，不当成严格因果加速比。后来的冻结 no-shadow 快照记录更大范围的关闭，但本文不将其写成当前进程身份。

这轮还修了两个容易被性能图掩盖的工程问题。第一，外部连接停机改为并发关闭，整体等待由最慢一路决定，不再把六个 WebSocket join timeout 相加。第二，tape 改成 UTC day + recorder session 独立 gzip；强制停机最多损坏当前 session，不会再向坏 member 后追加一整天数据。若未来获得新的显式授权继续优化 callback，也不增加 Python worker，而是先减少锁内 dict/deque 物化，把 5-10ms per-source trade frame 聚合与 fixed-array global-flow state 作为一个较大的 native 边界，再用同一环境标签复测 p50/p99/p99.9。

#### 2.1.4 native fixed-array global-flow batch

这条历史后续曾经实现，而且边界刻意没有扩成新的线程拓扑。Bitget、Bybit、OKX 每个 trade frame 先归一化为 timestamp/price/size/maker 四组连续数组，再一次进入 `NativeGlobalFlowEngine.on_trade_batch()`；C++ 在内部固定容量 ring 上更新 receive-time flow，释放 GIL 后才回到 Python。随后 `SignalEngine._lock` 只拿一次，原地更新该 market 的最新状态，并通过 `TradeBarAggregator.update_batch()` 完成 cross-market 1s bar。BBO 同样先更新 native L1 flow，再在锁内原地修改 latest ticker 与同秒 history。这里没有新增 Python worker；该路径在后来的某个冻结 no-shadow 快照中未启用，不代表今日进程。

native engine 当时预留 16 个 market slot；每个 slot 有 32,768 个 trade event 和 8,192 个 book event。构造完成后不再按事件分配对象。该历史 live 身份使用 11/16 个 slot；stale、out-of-order、capacity overflow 都有独立计数，strict profile 缺少 ABI 或耗尽 market slot 时直接失败，不能静默退回 Python。

目标 x86 live 机上的 `bench_global_flow_batch.py` 同时测纯 flow 与完整 signal ingress。后者包含 NumPy 边界、source-state 更新、bar rollover 和 global-flow，不只测一个理想 C++ tight loop：

| venue frame | Python signal ingress | native signal ingress | 加速 |
| ---: | ---: | ---: | ---: |
| 1 trade | 22.17 us/frame | 13.17 us/frame | 1.68x |
| 8 trades | 82.73 us/frame | 14.07 us/frame | 5.88x |
| 32 trades | 311.25 us/frame | 18.55 us/frame | 16.78x |

这组结果的重点是 burst，不是 scalar。单笔 frame 只有约 1.7x；frame 越大，原实现逐笔创建 dict/dataclass、逐笔过 Python bar loop 的固定税才越明显。纯 native flow 在 32 笔 frame 上接近 39x，但那不是 live callback 的完整收益，所以不能拿来替换上表。

部署后的 10.3 分钟 preflight 保持策略配置与同步 order gateway 不变。11 个 HEALTH 样本的 native global-flow 命中率为 100%；窗口看到 55,254 笔 trade，接受 54,063 笔，处理 441,254 条 BBO；trade/book fixed-ring overflow 为 `0/0`，external error、reconnect、stream silence 也都是 0。窗口中有 1,188 个 stale counter 增量：这是交易所后来送到的旧 trade 被 exchange-time 年龄门控拒绝，而不是把陈旧成交塞进 10-500ms flow。

同一窗口的 requote、update-orders、signal、quote p99 约为 `852/465/324/13.9ms`。它们来自一个新的非重叠市场窗口，不能和旧窗口做因果比值；而且 requote tail 仍明显包含 REST、模型、调度和日志。那时能保留的只有**无额外 worker 的 native shadow state 工程结论**，不是“端到端 p99 已解决”，更不是“global flow 已经成为 alpha”；它也不授权任何后续 release 重新启用 shadow。

该历史实现也没有把 BBO 冒充 exact L2。`GlobalFlowEngine` 只从 public top-of-book 与逐笔成交构造 10/25/50/100/250/500ms aggressive buy/sell volume、trade imbalance、L1 OFI、bid/ask depletion/refill proxy、spot/perpetual 2-of-3 consensus 和 global-minus-local residual。只有通过 2-of-3 freshness 的 spot 或 perpetual 层才有资格进入 global common factor；单个 venue 即使数值极端也不能投票。离线 `fill_toxicity.py` 再严格按 `feature_ready_ts_ns <= fill_ts_ns` 重放这些事件，并用 Binance BTCUSDC receive-time BBO 计算同 horizon 的 maker-signed markout。它回答的是 fill toxicity sorting，不是 keep、cancel 或 re-center 的反事实收益。

稳定币换算的历史实现也必须写清方向。Binance 正式 symbol 是 `USDCUSDT`，表示一单位 USDC 对应多少 USDT，因此 BTCUSDC bridge 是 `BTCUSDT / USDCUSDT`。当时 live 只为这个 anchor 订阅 bookTicker，不订阅无用的 aggTrade；历史层则只下载 canonical retained days，聚合成 1s bars 后删除 raw CSV/ZIP。BTCUSDC spot 继续作为 cross-check/fallback，而不是外部共识票。这个慢速 anchor 使用独立的 30 秒 level freshness；三家外部 spot/perpetual 的 BBO freshness 与 10-500ms event window 单独计算。二者不能共用同一个阈值，否则稳定币 BBO 几秒不变会制造假的 reference-invalid。旧 retained111 的 1 秒 trade-time Stage 0 已冻结为历史诊断，不再继续调 threshold；后续 Stage 0 只使用真实 receive-time tape。当时 HEALTH 也分别输出 fresh venue 数、flow pressure、agreement、basis warmup 样本数和 invalid reason，而不再只给一个无法归因的布尔值；current Ref/Flow 已关闭。

这些数字只能证明目标机器上的接收链路数量级和实现语义，不能证明 cross-venue alpha，也不能直接与 Binance REST p99 相加。样本仍短、市场窗口单一，而且各 venue 与 Binance 的网络路径不同。后续若研究 50/100ms event cancel 或 1 tick re-center，必须使用同一采集点的 receive-time tape，并把：

```text
external feed age
+ feature / decision latency
+ Binance cancel-or-replace latency
+ exchange acknowledgement / matching latency
```

一起与信号半衰期比较。只有 predictive horizon 在 p95/p99 端仍长于完整执行链路，cross-venue evidence 才可能进入 policy；否则它最多是 post-fill campaign moderator 或 risk diagnostic。

第三类是研究机制边界。C++ 已能重放 queue-enabled fill-selection 及其周边 side/regime queue lookup、replace throttle、pending coalesce、reducing/adaptive cooldown 和 campaign soft control，因此它不再是“Python-only 缺口”。2026-08-12 的 v10 checkpoint 已把旧 BUY fill-selection 的 action 与 shadow 都关闭，后续公开 v12 继续保持关闭；历史 owner-side BUY E3 是另一套 fill 后 cooldown policy，不是旧 selector 复活。C++ 能执行某个历史 action，不等于该 action 属于当前私有 baseline。

仍不能交给 C++ 历史 replay 裁决的，是三类本质不同的问题：已删除执行入口的 `xmarket_retreat` 只允许由 legacy audit reader 解释旧日志；empirical REST latency 目前还是分布/样本近似，而不是逐请求真实 ACK tape；user-stream mismatch、sync-adjust degrade、断线重连和交易所 reject 属于 live-only 故障闭环。后两类需要 Python diagnostic 或真实 live soak，不能靠给 C++ 多加几个字段就假装已经回放。

这条边界很关键：C++ 现在适合两件事。第一，active baseline 以及已 parity 参数面的宽 arm / retained fast screening；第二，quote context、order-level denominator、shock/label 前处理这类批处理 tight loop。它不适合替还没过 evidence gate 的新机制背书。换句话说，C++ 可以让反例更便宜，但不能把一个未验证机制变成 alpha。

这说明一件事：**架构边界不是文档措辞，而是真的会改变工程结论。** 在本机 ARM 上，早期 `SIGNAL_FEATURES=1` 曾经是负优化；经过 fixed-array/ring-state 改造后，在 x86 上它反而变成最明显的 live CPU 收益。相反，历史 `SIGNAL_STATE=1` 在这台 x86 上没有额外收益，其实现与开关已于 2026-07-17 删除。pin 到单个 vCPU 对均值帮助也不大，甚至可能放大 VM 上的尾部抖动。

`perf stat` 也给了一个现实提醒：这台 KVM 实例不暴露 `cycles`、`instructions`、`L1-icache-load-misses`、`iTLB-load-misses` 这些硬件事件，最后只能看到 context switches、cpu migrations 和 page faults。因此“x86 benchmark”也要继续细分：普通云主机能做 wall-time/tail-latency 复测，但真正要分析 L1I/iTLB/cache miss，可能需要裸金属、特定实例族或能暴露 PMU 的环境。

#### 2.1.5 2026-09-02：权威终态驱动 continuation 消除了整轮 cadence 空等

2026-08-29 的修复前样本显示，cancel terminal 已经在本机可见后，replacement 仍等待下一次 5–10 秒正常 requote：BUY p50/p99 为 5.477/9.590 秒，SELL 为 5.379/9.537 秒。这段数据现在只作为优化前的历史基线，不能再写成当前路径。

后续实现没有恢复已经删除的 async gateway。它继续保持同侧单一 ownership，只在权威 cancel/fill terminal 后唤醒唯一主决策循环，并用最新 snapshot 重新执行 inventory、cooldown、risk、ownership 和 post-only 检查。intent 只保存 side、generation 和“需要重新考虑报价”的事实，不保存可直接执行的旧价格或旧数量；unknown terminal 仍然 fail-closed。

本节 2026-09-02 的匿名化观测窗口累计 2,434 次成功 requote 和 1,404 次 replacement continuation；1,404 次均完整经过 `arm → publish → decision`，没有 drop。

| 指标 | 前序优化窗口 | 本节历史观察窗口 | 观测变化 |
| --- | ---: | ---: | ---: |
| requote total p50 / p99 | 20.81 / 211.66ms | 17.70 / 138.17ms | -15.0% / -34.7% |
| update orders p50 / p99 | 11.99 / 119.22ms | 10.08 / 73.24ms | -15.9% / -38.6% |
| terminal visible → decision p50 / p99 | 4.16 / 99.08ms | 3.06 / 52.77ms | -26.4% / -46.7% |
| REST new / cancel 每请求均值 | 9.92 / 7.86ms | 7.30 / 7.09ms | -26.5% / -9.8% |

该历史窗口的 BUY/SELL continuation p99 分别为 63.84ms 和 47.63ms，合并 p99 为 52.77ms，低于当时设定的 p99 ≤ 250ms 工程目标。相对最初约 9.5 秒的 p99，窗口内的机制结论是：整轮 cadence 空等已经消失，而且同侧 ownership 与终态安全约束仍然保留。52.77ms 只描述 terminal visible → decision，不是全链路延迟，也不是今天主机的 p99。

表中两个 release 位于相邻但不重叠的市场窗口，市场状态、网络和主机负载没有被同步控制，因此 -15% 至 -47% 只能解释为观测改善，不能全部归因于代码。该窗口也不能证明更低延迟会改善 PnL；更高 quote uptime 对 fills、markout、inventory 和 tail 的影响仍需单独观察。低延时验收通过，不等于 alpha 或经济 no-harm 已经通过。

#### 2.1.6 2026-09-06：下一轮 p99 该怎么量

现在不能用“某个 C++ 函数更快”替代整条链路测量。下一轮至少分开看四个区间：决策快照里 depth 的总年龄、一次 requote 占用决策线程的时间、同一快照到 NEW 私有回调、同一快照到 CANCEL 私有回调。前两者分别衡量输入有多旧、决策线程被占用多久；后两者包含请求排队和回执可见性，不能简单归到 REST RTT。

这些区间的 p99 不能相加。即使两段在逐事件时间轴上首尾相接，`p99(A+B)` 通常也不等于 `p99(A)+p99(B)`；而快照到回调还可能与 requote 本地尾段重叠，直接相加会重复计算。应该先按同一 decision/order identity 连接时间戳，计算每一条真实路径的起止差，再对这些差值求分位数。并行阶段按实际依赖和完成顺序处理，不把它们硬串起来。

优化顺序仍是：保持单一 GLOBAL FIFO 先解除普通 REST 响应对决策线程的阻塞；分别测量冷对账、日志和新 10 秒桶计算的尾部；最后在相同串行方式下独立比较 REST 与 WebSocket API。比较主指标是 `decision → dispatch → private visible`，同时报告超时、UNKNOWN、拒单和重连，不能只选 response RTT 更低的一方。协议、并发数和策略阈值不能在同一对比中一起改变。

depth 年龄还要保留真实消息间隔：100ms 订阅参数不是每 100ms 必有一条新消息的保证。减少锁内计算可以缩短本地等待，却不能抹掉源端间隔或传输尾部。快照原子性、stale 保护和订单 ownership 都保留；只有在同一测量口径下重新观察，才能说明改动究竟减少了哪一段延迟。

### 2.2 live 路径的 C++ 优化：与 replay 完全不同的约束

前面几节讲的 quote core batch、tick replay 状态机和 streaming features，都是以"吞吐量"为优化目标：输入是连续数组或完整窗口，可以释放 GIL、多线程并行、用 SoA 布局喂给 SIMD。但 live 路径是另一种世界。

从 C++ 学习的角度看，live 优化最容易犯的错是把“语言更快”误解为“函数搬过去就会更快”。maker live path 里单个 quote 公式可能只要几十微秒，pybind 边界、Python 字典、dataclass 展开、日志对象构造和 feature merge 却可能比公式本身更贵。因此这里分析的重点不是 C++ 语法，而是 **C++ 函数边界应该长什么样**。

本节的早期同步路径由 Python main loop 推进 `tick()`，正常报价受 `requote_interval` 控制，REST new/cancel 的等待会占用决策线程。后来的 terminal continuation 增加了事件唤醒，GLOBAL FIFO 异步响应路径又将普通请求等待分离，因此不能用这张旧同步结构描述所有当前模式。六条 external shadow feed 也只描述历史实验；本文不列举当前 EC2 的进程或采集状态。无论采用哪种调度，决策都必须读取一致 snapshot，并在最新库存、风险和 ownership 下重新计算。

这里还要明确 transport 边界。Binance 官方 FIX API 只覆盖 Spot，Market Data 与 Order Entry 又是不同 session；Market Data session 不能报撤单。NarrowGate 当前 execution instrument 是 Binance USD-M Futures，因此 execution market/private feed 与 new/cancel 仍然是 USD-M WebSocket/REST 路径，不能把 Spot FIX endpoint 当成 Futures 的低延迟替代。未来即使增加 Binance Spot FIX adapter，它也只覆盖相应 Spot source，不会统一覆盖 USD-M 或 Bitget/Bybit/OKX。协议是否可用必须逐 venue、逐 instrument、逐 session 核验，而不是把 `TCP + TLS + FIX` 当成跨交易所通用开关。官方能力边界见 [Binance Spot FIX 文档](https://developers.binance.com/en/docs/products/spot/fix-api)。

```text
Binance callback threads ─► receive/decode ─► SignalEngine update
external callback threads ─► receive/decode/normalize
                          ├─► native fixed-array global-flow batch
                          └─► one-lock source/bar state update
                                                    │
                                                    ▼
                                      SignalEngine shared snapshot
                                                    │ lock-protected snapshot
                                                    ▼
main decision thread: tick() ──► _requote()
           │              ├── compute_signal()          # LightGBM predict
           │              ├── compute_quote_core_live() # C++ compact path
           │              └── _update_orders()
           │                      ├── _build_side_policy()
           │                      └── REST new/cancel
           └── [sleep rq_interval]
```

报价决策本身没有批量处理的机会：每次只有一组 state，一个 depth snapshot。当前 tiny scalar native call 与上述线程/锁模型下，释放 GIL 的 benchmark 没有显示收益；这只是该调用边界的实测结论，不是“live 系统一律不该释放 GIL”。callback thread、decision thread、日志和模型调用仍可能竞争 GIL/锁，是否释放必须连同 snapshot 一致性和 p99 soak 一起测。

早期的错误迁移方式长这样：

```python
# 每 tick 都创建大对象，再跨 pybind 边界，再返回大 dict。
# C++ 只算了 quote 公式，Python 仍然负责 policy/routing。
ctx = asdict(live_quote_state)               # 当前固定 ABI 为 16 fields
cfg = asdict(live_quote_config)              # 70+ fields
depth = [asdict(level) for level in l2_book] # N levels

quote = narrowgate_cpp.compute_quote_core(ctx, cfg, depth)

bid_policy = build_policy_from_dict(quote["bid_context"])
ask_policy = build_policy_from_dict(quote["ask_context"])
orders = python_route_orders(quote, bid_policy, ask_policy)
```

这看起来“用了 C++”，但热路径仍然到处是 hash lookup、字符串 key、临时 dict/list、对象分配和 Python 属性访问。改造后的方向是把生命周期不同的数据拆开：

```python
# config：几乎不变，缓存 native object
native_cfg = cached_cpp_config(cfg)

# state/pred：每 tick 改变，但字段位置固定
state_tuple = (
    mid, inventory, sigma_sq, trade_intensity,
    best_bid, best_ask, ber_active,
    mo_ema_all, mo_ema_bid, mo_ema_ask,
    bid_adverse_markout_pause_latch,
    ask_adverse_markout_pause_latch,
    mo_ref,
    position_open, hold_time_s, unrealized_pnl,
)
pred_tuple = (dir_10s, vol_10s, ret_10s, tox_bid, tox_ask)

# result：先返回 compact result，只有旧代 BUY soft-keep scorer / offline trace
# 才物化完整 context
quote = narrowgate_cpp.compute_quote_core_live(
    state_tuple, native_cfg, pred_tuple, depth_bids, depth_asks)

route = narrowgate_cpp.compute_live_routing_decision(
    routing_input_tuple,
    bid_policy_tuple,
    ask_policy_tuple,
)
```

这里的学习点很清楚：C++ 不是为了替代 Python 的事件编排，而是为了让高频决策包使用固定布局、固定字段、固定分支，减少每次 tick 的动态对象税。

#### 2.2.1 热路径的三个生命周期层

live 路径的优化策略由三个不同的生命周期决定，不是统一的"全部 C++"：

**第一层：几乎不变的 config（按配置对象缓存）**

`QuoteCoreConfig` 包含 70+ 个策略参数（legacy `gamma/kappa` 兼容字段、`eta_inventory/a_spread`、adverse/defense 阈值、spread cap 系数等）。直接每次 requote 都从 Python cfg 解包再构造一次 native 对象，benchmark 测出来比 Python 还慢——单次约 300µs 的 object 构造完全抹平了 quote 数学的收益。这里的 `kappa` 名字不表示已完成 GLFT execution-intensity calibration。

改造后用 `id(cfg)` + `weakref` 作缓存键，每次报价的 C++ config 参数零分配，config reload 时才同步一次。

**第二层：每 tick 变化的 state（固定位置 tuple）**

策略状态（当前 ABI 为 16 个字段：mid、inventory、sigma_sq、BBO、markout EMA、BUY/SELL adverse-markout pause latch 等）每次 requote 都不同，必须传入。用固定位置 tuple 代替 dict，C++ 端按下标读取，无 key hash、无对象构造。

**第三层：按需物化的诊断（功能驱动的懒加载）**

side policy 每 tick 只需 9 个字段；完整的 100+ 字段 context 只在旧代 BUY soft-keep scorer 或离线 trace 时需要，由 `require_full_context` 控制。direct Quote-EV executor 已经删除，不是这个开关的现役 consumer。

这三层合在一起，让 `compute_quote_core_live` 从最初的负优化（慢 59%）翻转为稳定正收益（快 16.4%）——不靠改进 quote math，只靠把「每 tick 固定税」改成「功能需要时才支付」。

#### 2.2.2 Compact Context：从嵌套对象到固定字段 ABI

live 路径上最反直觉的一点是：把单个报价公式搬到 C++ 可能更慢。原因不是 C++ 慢，而是 Python/C++ 边界太重。

早期路径接近这样：

```python
ctx = {
    "config": asdict(config),
    "state": asdict(engine_state),
    "inventory": asdict(inventory_state),
    "prediction": prediction_dict,
    "book": {
        "best_bid": best_bid,
        "best_ask": best_ask,
        "depth": [{"price": p, "qty": q} for p, q in levels],
    },
}

result = narrowgate_cpp.compute_quote(ctx)
```

这看起来很灵活，但在 live hot path 里会反复制造这些成本：

- `asdict()` 深拷贝；
- 字符串 key 查找；
- Python list/dict/object materialization；
- pybind 再把动态对象解析成 C++ 类型；
- C++ 算完以后再组一个 Python dict 返回。

Compact Context 的方向不是“把所有东西都迁到 C++”，而是把边界变成固定字段 ABI：

```cpp
struct CompactMarketView {
    double mid;
    double best_bid;
    double best_ask;
    std::span<const DepthLevel> bids;
    std::span<const DepthLevel> asks;
};

struct CompactInventoryView {
    double position;
    double abs_inventory_time_s;
    double signed_inventory_time_s;
};

struct CompactPredictionView {
    double ret_1s_bps;
    double ret_5s_bps;
    double toxicity;
    double vol_bps;
    double ref_move_bps;
};

struct CompactRoutingResult {
    double bid_px;
    double ask_px;
    double bid_qty;
    double ask_qty;
    bool can_bid;
    bool can_ask;
    uint32_t bid_reason_mask;
    uint32_t ask_reason_mask;
};
```

Python 侧则只传固定顺序的 tuple/array 和已经缓存的 native config：

```python
market = (
    mid,
    best_bid,
    best_ask,
    bid_prices_view,
    bid_qtys_view,
    ask_prices_view,
    ask_qtys_view,
)

state = (
    inventory,
    abs_inventory_time_s,
    signed_inventory_time_s,
    bid_markout_ema,
    ask_markout_ema,
    bid_pause_until,
    ask_pause_until,
)

pred = (
    ret_1s_bps,
    ret_5s_bps,
    toxicity,
    vol_bps,
    ref_move_bps,
)

decision = cpp_live_routing(native_cfg, market, state, pred)
```

架构上是：

```text
WebSocket / REST / logging
        |
        | 仍然留在 Python
        v
Python normalized event state
        |
        | fixed tuple / array / span-like views
        v
C++ compact quote core
        |
        v
Python `_build_side_policy()`
        |
        | fixed policy tuples
        v
C++ partial routing / price-size-action back half
        |
        | compact result: price, size, can_post, reason_mask
        v
Python order adapter
        |
        v
exchange REST/WebSocket
```

这样做的收益不是“C++ 数学快了多少”，而是减少边界上的动态对象。前面的 live benchmark 里也能看到这个现象：原始 routing 桥接大约是 `6us` 级别，该冻结 x86 artifact 中 compact ABI 约为 `1.94us` mean、`3.10us` p99；但如果只把 scalar quote core 单独搬过去，pybind/dataclass 往返会把收益吃掉，甚至变慢。

这也是为什么 WebSocket 目前不急着迁 C++。receive-time profile 已经证明 callback 排队值得治理，但没有证明“把 socket 库换成 C++”本身就是答案；两种全 Python dispatcher 已经实测失败，真正应先收紧的是 callback 后的 lock ownership、compact global-flow state，以及 receive-state 与下单 adapter 之间的 **rolling state -> native quote -> Python policy -> native partial route decision**。这是一条当前机器和代码下的优先级判断，不是关于所有 WebSocket 实现的一般定律。

#### 2.2.3 routing bridge：当前还不是完整 native 决策包

`_build_side_policy()` 是 live 路径的另一个计算热点。它接收 quote_context、L2 metrics 和 pred，输出 `spread_mult`、`size_mult`、`allow_post`、`reason_mask`，大量工作是评估 10+ 个 policy guard 的条件。

这些条件判断本身不重，但每次需要访问 Python dict（`quote_ctx.get("side_adverse", False)` 等），在单 tick 热路径上积少成多。

`NARROWGATE_CPP_LIVE_ROUTING` 仍只接管后半段的价格调整、spread cap、库存准入、size 和 cancel/replace 判断，但跨语言接口已经从动态 dict 收紧为固定布局：

```python
bid_policy = self._build_side_policy(Side.BUY, mid, q, pred)
ask_policy = self._build_side_policy(Side.SELL, mid, q, pred)

routed = cpp_route.compute_live_routing_decision(
    (
        mid, q, base_bid_price, base_ask_price,
        best_bid, best_ask, tick, lot, min_qty, min_notional,
        order_size, max_inventory, eta, symmetric_size,
        requote_threshold_bps, max_spread,
        bid_alive, bid_active_price, bid_age_ms,
        ask_alive, ask_active_price, ask_age_ms,
    ),
    (
        bid_policy.allow_post,
        bid_policy.allow_exposure_increase,
        bid_policy.spread_mult,
        bid_policy.size_mult,
        bid_policy.order_ttl_ms,
    ),
    (
        ask_policy.allow_post,
        ask_policy.allow_exposure_increase,
        ask_policy.spread_mult,
        ask_policy.size_mult,
        ask_policy.order_ttl_ms,
    ),
)
```

native 侧对应的是普通结构体，而不是把业务逻辑继续堆在 pybind lambda 中：

```cpp
struct LiveRoutingPolicy {
    bool allow_post;
    bool allow_exposure_increase;
    double spread_mult;
    double size_mult;
    double order_ttl_ms;
};

LiveRoutingResult compute_live_routing_decision(
    const LiveRoutingInput& input,
    const LiveRoutingPolicy& bid,
    const LiveRoutingPolicy& ask);
```

它仍不是 quote → policy → routing 的完全 fused kernel，因为 `_build_side_policy()` 还在 Python；但 routing 边界自身已不再创建两个 20+ 字段 dict、逐个做字符串 key 查询、再创建结果 dict。旧/新二进制使用同一组输入做 100,000 次对照，checksum 完全一致：mean `6.024 → 0.472 us`，p99 `6.375 → 0.583 us`。这个约 92% 的下降只描述 routing binding，不代表完整 `_update_orders()` 或网络报单延迟也下降 92%。

最终更理想的 live C++ 决策包应该继续向下面这个形态收敛：一次调用接收 market state、model prediction、inventory state 和 live order state，返回两个 side 的完整动作，但仍不负责 REST IO。

```cpp
enum class OrderAction : std::uint8_t {
    Keep,
    Cancel,
    Replace,
    NewOrder,
};

struct LiveDecisionInput {
    double mid;
    double best_bid;
    double best_ask;
    double tick_size;
    double lot_size;

    double inventory;
    double max_inventory;
    double sigma_sq;
    double ret_10s;
    double tox_bid;
    double tox_ask;

    ActiveOrder bid_order;
    ActiveOrder ask_order;
    DepthView depth;
};

struct SideDecision {
    OrderAction action;
    double price;
    double quantity;
    double ttl_ms;
    std::uint32_t reason_mask;
};

struct LiveDecision {
    SideDecision bid;
    SideDecision ask;
    double final_spread;
    bool inventory_blocked;
};

LiveDecision compute_live_decision(
    const LiveDecisionInput& in,
    const QuoteCoreConfig& quote_cfg,
    const PolicyConfig& policy_cfg) {
    auto quote = compute_quote_core_compact(in, quote_cfg);

    auto bid_policy = evaluate_side_policy<Side::Buy>(
        quote.bid, in.inventory, in.tox_bid, policy_cfg);
    auto ask_policy = evaluate_side_policy<Side::Sell>(
        quote.ask, in.inventory, in.tox_ask, policy_cfg);

    return route_quote_to_orders(
        quote, bid_policy, ask_policy, in.bid_order, in.ask_order);
}
```

这段伪代码里有两个刻意保留的边界：

- `ActiveOrder` 是当前本地状态，不在 C++ 里发 REST；C++ 只说“应该怎么做”，Python 负责实际 cancel/new 和异常处理。
- `reason_mask` 是整数位图，不是字符串列表；日志需要人类可读 reason 时再冷路径翻译。这样热路径不做字符串拼接，也不会因为审计文本拖慢每次报价。

设计上有一点克制：进出 REST 的部分（cancel/new order、TTL check、GIL 相关操作）仍留在 Python，不放进 C++ call 内。这条边界的理由是：当前普通 new/cancel 每请求均值约为 7ms，历史尾部仍可进入几十至上百毫秒；强行把 REST 客户端搬进 C++ 也不会自然消除公网、交易所 gateway、matching engine 与回执尾部，反而会让 unknown-state 和订单所有权错误更难诊断。

#### 2.2.4 最小且可预测的热指令工作集

HFT 代码短小，不是为了追求源码上的简洁，而是为了控制 CPU 前端真正看见的机器码。这里采用的标准是：**让一次高频事件实际触达的指令工作集最小、稳定且分支可预测，而不是让整个扩展模块都塞进 L1I。**

这一区别很重要。在 **2026-06-22 对应 commit、AppleClang Release + pybind ThinLTO 诊断构建**中，`narrowgate_cpp` 的 `__text` 是 471,364 bytes，仍然大于本机性能核 192 KiB、能效核 128 KiB 的 L1I；但其中包括 pybind 注册、Python 类型转换、异常处理、批量研究接口和 trace binding，它们不会在一次 live requote 中全部执行。随后 extension 又加入 native global-flow 等代码，因此 471,364 bytes 只是一张历史 build snapshot，不是 2026-07-19 当前二进制大小。该轮 linker map 中的函数尺寸如下：

| native 函数 | text 大小 | 热路径判断 |
|---|---:|---|
| `compute_quote_core()` | 7,528 B | live quote 主体紧凑，明显小于常见 32 KiB L1I |
| shared `compute_signal_feature_vector()` | 9,184 B | stateful/legacy 共用的唯一大计算主体 |
| `simulate_tick_arrays()` | 23,596 B | replay 顺序状态机接近 32 KiB 级别，仍需连同被调用 helper 用 PMU 验证 |
| legacy `compute_signal_feature_overlay()` wrapper | 1,136 B | 只构造 span view 并调用共享主体，不再复制大函数 |
| depth batch pybind worker | 23,668 B | 离线批量入口，不属于 live scalar 热路径 |

诊断命令本身也应进入性能工程流程，而不是只看 benchmark 平均值：

```bash
BIN=$(.venv/bin/python -c \
  'import narrowgate_cpp; print(narrowgate_cpp.__file__)')

xcrun llvm-size -A "$BIN"
xcrun llvm-objdump -d --demangle --no-show-raw-insn "$BIN" \
  > /tmp/narrowgate.disasm

# 诊断构建额外生成 linker map：-Wl,-map,/tmp/narrowgate.map
# Linux 研究机再看 L1I/iTLB/branch miss 与 p99 是否同步恶化。
perf stat -r 20 \
  -e cycles,instructions,branches,branch-misses,\
L1-icache-loads,L1-icache-load-misses,\
iTLB-loads,iTLB-load-misses \
  ./bench_hot_path
```

源码审计也需要给模板设预算。当前 queue 热循环只把低基数的 `Side` 固定到编译期；旧 `QueueAheadMode` 与 through-level 实例已经删除。rolling moments 已收敛为普通运行时容量类型，容器 view 也共享非模板计算主体：

```cpp
template <Side S>
double l2_visible_queue_ahead(...);
```

BUY/SELL 只有两个 side 实例；`CountRollingMoments` 用运行时 capacity 复用同一份机器码，quote core 的大主体本身也不是模板。这里没有 `EnableAdverse x EnableDefense x EnableQuoteEV x ...` 这样的布尔笛卡尔积，因此目前不存在明显的模板组合爆炸。side-specific helper 展开后，`compute_quote_core()` 总体仍只有约 7.4 KiB。

审计发现的两个缺口随后都做了收敛：

1. routing 改为固定 22 字段 input tuple、两个 5 字段 policy tuple 和 11 字段 result tuple；binding 只负责位置解包，业务数学进入普通 `LiveRoutingInput/Policy/Result` C++ 函数。place/replace 时为了审计日志执行的 `asdict()` 仍保留，因为它不属于每次 routing 计算。
2. `compute_signal_feature_vector<Bars, History>` 改成接收 `SegmentedSpanView<Bar1s/FeatureHistoryRow>` 的单一非模板主体。`CircularBuffer` 暴露 ring 的两段 span，legacy vector 暴露一段 span，无复制共享同一份机器码。相关大计算代码由 `8,868 + 10,120 B` 收到 `9,184 + 1,136 B`，减少 8,668 B；该轮诊断构建的扩展 `__text` 从 478,392 降到 471,364 B。

代码变小没有换来性能回退。满 60,480 history 的 `compute_values()` 对照中，mean `1.901 → 1.748 us`，p99 `2.500 → 1.917 us`。这说明 two-span 访问增加的一次边界判断，代价小于共享代码布局和编译器优化带来的收益；但这些仍是同机微基准，不能替代目标 Linux CPU 的 PMU 计数。

因此这里对模板元编程的约束是：只把真正高频、低基数的结构性分支固定到编译期；数值阈值和频繁实验的 policy 留在数据中；大段公共计算只保留一份非模板主体；trace、日志、异常和兼容 binding 保持冷路径。评估是否合格最终看的是固定/轮换模板实例实验中的 L1I MPKI、iTLB MPKI、branch miss 和 p99/p99.9，而不是 `.text` 总大小，也不是源码有多少行。

#### 2.2.5 Live 脏数据与异常：离线可以删，live 只能降级

离线数据坏了可以物理删除，live 不行。live 遇到乱序 tick、WebSocket 静默、盘口过期、bad trade、用户流漏成交时，策略必须降级，而不是继续假装状态健康。

当前 NarrowGate 的 live 防御层大概是：

| 异常 | 当前处理 |
|---|---|
| bad trade parse / 非法价格数量 | 计数并限频日志，不进入 bar state |
| aggTrade 静默 | watchdog 重连已文档化的 `@aggTrade`；不切换到未声明的 USD-M futures raw `@trade` |
| execution/reference/spot stream 静默 | market stream reconnect |
| execution depth 过期 | cancel live quotes，停止 requote，原因 `stale_hard` |
| bookTicker / post-only crossing | GTX reject 当作正常不可挂事件处理 |
| REST / user-stream reconciliation | 使用 exact trade ID、order ID、累计成交与 snapshot cursor；不使用时间 fudge，无法证明幂等时 fail closed |
| order ledger | 累计成交必须 finite、非负、单调且不超过订单量；terminal correction 可以补记新增累计量 |
| callback / ownership | 外部 callback 在状态锁外按账本提交序列派发；terminal ownership 只由精确 tombstone 释放，冲突不能自动解闩 |
| stale local order | 周期性清理 `PENDING_NEW` 卡死订单 |
| REST 半开 / fatal reconciliation | 同步网络请求使用有限 timeout；致命账本或对账错误以非零状态退出，supervisor 不自动重启 |
| C++ 扩展异常 | strict 模式直接 fail；非 strict live 可 fallback/disable native path |
| 同时间物理成交 | trace 使用不可变 `fill_sequence` 保留原始执行顺序，并在首次账本写入前验证连续序列和 inventory-before/after 路径 |
| 运行健康 | `HEALTH` 显式区分进程/行情存活与 quote-loop/ownership-latch 状态；PID 或 HEALTH 仍更新不等于还在报价 |

伪代码是：

```python
if depth_age_s > max_exec_book_age_s:
    cancel_active_quotes()
    skip_requote(reason="stale_hard")

if stream_silent(symbol, timeout_s):
    reconnect_market_streams()

if sync_adjust_count >= threshold:
    pause_exposure_increasing_quotes(duration_s)
    reconnect_user_stream()

if bad_trade:
    bad_trade_counter += 1
    return
```

早期版本还曾在这里写 `sell_resiliency_shadow.csv` denominator log。该 direct live/shadow producer 与 HEALTH counters 已删除；当前只有历史 audit reader 能解释旧 CSV 字段，不能把旧文件名写成现役 telemetry 契约。新的 denominator 统一进入 order-level / action-level evidence panel。

这仍然不是完整高可用交易网关。它没有 kernel bypass、没有独立 order gateway 进程、没有完整 SPSC ring 隔离，也没有多机热备。公开实现的目标是：在研究回放和有界在线运行里，遇到脏数据时优先撤单、降级、报警、重连，而不是继续用坏状态报价；这不表示私有当前进程启用或关闭了任何 shadow。

> **本节实操结论**
>
> - 参数映射要把 `gamma/eta/a_spread`、$\sigma^2$、risk horizon、order quantity、legacy touch slope 和 depth multiplier 分开映射到 spread/reservation/tick，再谈 ML 是否有用。
> - queue ahead 只在“可见 queue ahead 与 cancellation-ahead 假设”这一维度偏悲观；隐藏流动性、聚合 trades、sequence gap、前后方撤单归属和 receive ordering 仍可能让整体误差双向偏移。应报告 assumption sensitivity，不能把整个 execution simulator 简称为保守。
> - 历史或未来另行授权的 shadow mode 必须有样本量、fill calibration、markout calibration 和库存风险硬 gate；新研究不得默认靠新建 shadow 补证据。
> - Python/C++ 胶水层的关键是一次传连续数组或固定 tuple，不在每 tick 传动态对象。
> - fixed-array signal 当前是渐进式迁移：稳定热点进 C++，实验性特征保留更灵活的路径。
> - live 脏数据不能删除，只能通过 stale block、watchdog reconnect、SYNC_ADJUST degrade 和 telemetry 降级。
> - live 操作必须走统一脚本，例如 `live/run.sh start|stop|restart|status|logs|reload`；不要裸 `nohup python live/main.py`，否则很容易绕过 `.env`，导致 API key/secret 没进进程环境。

#### 2.2.6 live 路径不该做的事

这套设计也确定了 live 路径不迁移的边界：

- **WebSocket 层**：公开实现不把 socket client 整体迁到 C++；per-source/shared Python dispatcher 都因历史 p99 回归而关闭。frame-level trade batching、lock ownership 与 native fixed-array global-flow 工作只保留为工程证据；未来若重开也不默认增加 Python worker
- **LightGBM 推理**：模型本身已 native（LightGBM C API），Python 只做 feature → array 转换
- **大块 Python 编排逻辑**：config reload、日志、HEALTH 上报、REST 重连和当前 order/action evidence 输出——这些不在 CPU 热点，放 Python 更容易验证和修改；已删除的 `sell_resiliency_shadow.csv` producer 不属于当前契约
- **GIL 释放**：当前 tiny scalar native call 和现有 callback/main-thread 模型下未显示收益；更大 native 区域仍需结合锁、snapshot 一致性和长样本 p99 重新测

live 路径的结论和 offline 路径相同，但结论的来路完全不同：**offline 关心吞吐，live 关心尾延迟；quote decision 通常是 scalar，交易所一个 frame 内的多笔 external trades 则可以小批量处理；GIL 是否释放必须按具体调用边界验证**。把 offline 的大窗口优化模式直接复制到 live，往往得不到同样收益。

> **本节工程结论**
>
> - live hot path 不应该先重写 WebSocket/REST 库；先收紧 callback、背压、rolling state、quote/policy/routing 边界。
> - 单个公式迁到 C++ 很容易被 pybind、dict、dataclass 和日志对象物化反噬；稳定、高频、低基数的决策包才适合 native。
> - 热路径目标是最小且可预测的指令工作集，而不是让整个 `.so` 塞进 L1I。
> - ARM 回测吞吐、offline sweep 加速、x86 live p99/p99.9 是三种不同证据，不能互相替代。
> - 只有获得独立授权的 observation/shadow 才能新增 counter 和 CSV；不以“明天能复盘”为由默认恢复旁路。

#### 2.2.7 系统侧：C++ replay 很强，live 架构还不是终局

工程侧完成度更高，但也要分清 offline 和 live。

已经比较扎实的是：

- Python/C++ 双引擎 replay parity；
- depth-aware quote-core batch；
- C++ tick replay 状态机；
- `DepthView` / `std::span` 无分配访问；
- fixed-array signal feature vector，以及历史 receive-time global-flow ring 实现；
- hot/cold order 拆分；
- summary-only replay 输出；
- x86 live 上的 p99/p99.9 soak benchmark。

但 live 线程模型还不是 HFT 终局。当前架构更接近：

```text
Binance WebSocket client callback threads
        |
        v
Python WSHandler: decode + receive timestamp
        |
        v
SignalEngine with lock-protected update/snapshot
        |
        v
main decision loop: engine.tick() / quote / Python side policy
        |
        v
synchronous REST order adapter (default baseline)
```

因此 callback 可能与 decision thread 竞争 GIL 或 `SignalEngine` lock，但不会在同一个 Python 调用栈里串行执行。默认 REST 会阻塞 main decision loop；旧 async gateway 已在失败 soak 后物理删除。这个线程边界也是为什么“某个 pybind call 释放 GIL 无收益”不能外推成整个 live 系统的结论。

这和更硬核的低延迟架构不同：

```text
NIC / kernel bypass or tuned socket
        |
        v
pinned reactor thread
        |
        v
SPSC ring buffer / sequence barrier
        |
        v
pinned strategy thread: rolling state + quote + routing
        |
        v
order gateway thread
```

前者适合研究、shadow、审计和可维护性；后者才是面向极端尾延迟的 live 系统。NarrowGate 当前选择的是前者，并且已经把最热的 replay、signal、quote/routing 边界逐步 native 化；kernel bypass、SPSC ring、NUMA partition、专用 order gateway 和多机热备则属于下一层系统工程。

这不影响当前 C++ 迁移的价值，因为当前 C++ 主要服务两个目标：

1. **研究吞吐**：让多日 replay、source A/B、quote context 和 label 生成跑得动；
2. **边界收紧**：让 live hot path 中稳定的小决策包更少依赖 Python 动态对象。

这个边界很重要：当前项目不是专用交易网关，也不是把所有网络和订单路径都 native 化的极限 HFT stack；它是一个把 maker 研究、tick replay、order-level evidence 和 live hot path 逐步接起来的低延时工程框架。

### 2.3 下一阶段：策略证据和系统执行分开推进

NarrowGate 后续工作需要分成两条轨道。它们会互相约束，但不能互相替代：策略侧回答“什么状态值得接单”，系统侧回答“这套状态机能否稳定、及时、可审计地执行”。

**策略性质工作**已经越过“先建一张 order table”的阶段。2026-07-18 causal-v4 action panel 否证了固定 widen/re-center/skip；2026-07-25 又把正式数据面迁到 `normalized_l2_100ms_v2`，修复分侧 individual trades，并重建 causal-v5、order-level、lifecycle、null 与 spread-fill 证据。causal-v5 曾按用户指定进入 operational live，但后续 causal-v9 在 corrected Test3 上 raw、terminal 与 tail 同时失败；截至 7 月 28 日 live 曾回到 ML-OFF。8 月 3 日 operational control 已滚动到 causal-v12 semantics-v6，q90 与 BUY fill-selection action 同时关闭、shadow 同时保留。固定全局参数研究族也已正式关闭：固定数值仍可作为 baseline、校准或安全边界，但不再通过扩大 grid 寻找 pooled winner。

当前下一阶段也不再是继续扫固定 tick/秒数，而是：

1. **formal 100ms local state**：只有 `rebuilt / sequence_valid / warmup_valid / formal_eligible` 全部通过的日期，才能进入 queue、hazard、spread-fill 与 cancel 研究；旧混合 L2 仅保留历史复现身份。
2. **先分解执行几何**：固定 spread 实验分别估计 action-specific activation、pre-request fill、pending-cancel fill 与 request-conditioned ACK；`P(fill | active touch)` 不是纯 queue conversion，不能把一个全局指数 κ 当作所有 side、role 和 queue 状态的真实成交曲线。
3. **state-conditioned queue value**：最新 ordered common-support prediction family 已在 Development 关闭；Value 与 Action identity 均未创建。未来 keep/cancel/re-entry 仍须冻结 eligibility、propensity、reward、queue/P3/latency identity，并完整模拟 cancel ACK 前 fill 与 queue reset。
4. **multi-venue 只作历史 moderator 候选**：receive-time global flow 与 stablecoin bridge 曾只在 shadow 中评估；没有新的 local M0 action uplift 与显式授权，不把跨市场相关性翻译成报价动作，也不恢复观察旁路。某个历史 no-shadow 快照的关闭状态不被用来推断今日进程。

**系统性质工作**继续围绕真实 x86 live soak 与同步 order lifecycle：

1. `run.sh` 继续显式加载并打印 quote core、signal features、live routing、strict mode 与 extension path，重启后由 telemetry native-hit rate 再校验。
2. normal order adapter 保持同步。旧 latest-wins gateway 已由约 194 分钟 soak 否证并于 2026-07-17 物理删除；未来若重做异步执行，必须作为新的 bounded queue / backpressure 实验，不复活旧 flag、ABI 或 telemetry。
3. 多行情 callback 的历史实验不再增加 Python worker。若未来另行授权重开 external/Flow/Ref，必须先以关闭态为起点，再评估 lock 内对象物化、frame-level arrays/native global-flow，并在目标机分别报告 feed age、receive-to-feature、signal、quote、REST 与完整 requote 的 p50/p99/p99.9。
4. event-L2 提升的是离线研究分辨率，不应被误写成 live socket 已经迁到 C++。live WebSocket 优化仍须以 freshness、drop/overflow、GIL/lock contention 和长 soak 为证据。
5. 公开仓库只暴露模板配置、sample workflow、CI 和 no-data examples；私有 live 参数、基础设施地址、实盘结果和 paid-data manifest 不进入 public docs。

> **本节边界结论**
>
> - 策略侧的进展必须过 data quality -> mechanism -> fill selection -> OOS bucket -> daily stability -> campaign outcome risk。
> - 系统侧的进展必须过 x86 live soak -> action mix -> REST tail -> stream freshness -> safety path。
> - 两条线最终会在 spread、skew、TTL、cooldown 和 order lifecycle 上汇合，但验证顺序必须分开。
> - 如果某个策略证据没过 daily/campaign gate，C++ 不能把它“加速成可用”；如果某个系统优化降低 p99，也不能自动说明 alpha 更好。

### 2026-07-15：事件时钟 parity 与 queue calibration 必须分开

该轮 formal repair 把旧 tick replay 的 trade-only clock 改成了 trade、BBO/L2 与 timer 合并事件队列。ML 特征也只能在 bucket 完成后的 `feature_ready_ts` 被消费，并通过 7 日因果 warmup 保持长周期特征与 live 分布一致。这个改动使 TTL、cooldown、requote 和 book state 不再等待下一笔 execution trade 才推进。所有旧 ML、多行情和受旧时钟影响的精确 PnL 数值因此降级为历史诊断，不能与新结果直接拼接。

修复前的逐日 Python/C++ fill/PnL 对拍数值和固定 queue 倍率排名已经删除。它们能暴露 parity 与 calibration 是两个问题，却不能在旧 replay identity 下继续作为当前误差预算。当前仍成立的机制边界是：同一 frozen queue identity 才能做双引擎 parity；固定 queue-ahead 倍率不能识别跨日、side/regime 条件化的 cancellation-ahead 与 book-refresh 状态。

因此 queue artifact 现升级为 v3，并把 replay multipliers 纳入严格身份；正式输出记录 artifact path、SHA256、schema、fit days 和参数来源。后续 C++ sweep 只能比较相同 calibration identity 下的 paired delta，绝对 PnL 必须同时给出 queue sensitivity。在 queue 跨日 gate 通过前，`7-8x` 加速提高的是研究吞吐，不是结论置信度。

### 2026-07-17：旧代 BUY soft-keep scorer ABI v3 与完整 golden 收口

事件时钟修复之后，C++ 仍缺少 2026-07-06 旧代 BUY soft-keep live/Python scorer 使用的 causal `Prediction.feature_dict`。只把 quote distance、depth、inventory 等动态字段传入 native，会让同一模型在 C++ 中系统性降低 score，属于模型输入漂移，不是模型差异。

当前 adapter 会在每个 feature-ready row 上预编译各 fold 的静态 logit contribution、missing count 与 used count；C++ ABI v3 在 quote decision 时再合并动态字段，执行相同的 contribution shrink、fold average、missing gate 与 actionable hard gate。旧 ABI 或不完整静态 payload 会 fail fast，不能静默把“能加载模型”冒充成“模型输入一致”。

同一轮还修复了 `final_cap_compress_rate` 的 post-policy 计数差异，以及旧 shallow-depth policy multiplier。2026-07-17 对应代码快照的本地 suite 为 `355 passed, 4 skipped`，四个 real-data golden 全部通过；该数量不代表后续 working tree 的滚动测试总数。这里的“通过”只说明该快照的 active common-policy 与 BUY scorer surface 可以由 C++ formal replay 执行；P3、queue、latency artifact 仍必须绑定自己的数据和版本身份，不能由 golden 代替校准。

### 2026-07-18：causal-v4、event-L2 与下一代 queue-value

causal-v4 把前一日的时钟修复冻结成一套可审计 identity：完成后的 10 秒 feature bucket 只能在 `bucket_end` 可见；volatility 使用 `(USDC/BTC)^2 / second`；replay 使用 merged event clock；empirical P3、queue 与 REST-latency artifact 都必须显式绑定。122 日 order-level denominator 含 2,219,633 个 placed orders 与 70,650 个 fills。新 13-head bundle 和 causal-v4 `non_toxic` / `beats_opportunity` 两个 rebuilt BUY scorer 虽有局部排序能力，但 campaign outcome 与 tail gate 不支持 promotion，因此都保持 shadow-only；它们没有替换 2026-07-06 的旧代 BUY soft-keep rolling-baseline probe，live baseline 不变。

同一 frozen identity 上的固定 local actions 也没有晋级。BUY widen、SELL re-center / prevent-over-widen，以及 short inventory 中 skip 一次 SELL add，都没有同时通过 chronological reward、campaign/downside、support 与 interval gate；sealed holdout 未读取。这一结果关闭的是固定 tick/秒数 family，不是所有 state-conditioned action。

研究分辨率也从旧的约 1Hz BBO/L2 容器推进到 retained event-L2。新路径使用 Binance individual trades、CryptoHFTData price-level snapshot/delta 与 fixed timer events，并保持 `state_timestamp <= decision_timestamp`。`snapshot` 与 `delta-converged + burn-in` 是两个不同的数据身份：后者可用于验证后的 top-20 shock/refill/recovery feature，不能冒充深档 exact queue truth。正式 event-L2 日必须满足 24/24 raw hours、500ms freshness 下至少 99% coverage、完整 top-20 schema、正 spread、有效 anchor，以及零 sequence gap/invalid/time reversal。

因此下一代实验被收敛为预注册的 local shock/refill/recovery eligibility 与 `queue_value_keep_cancel_v1`。Python 先生成 authoritative randomized replay、propensity 与 chronological OPE；只有 action 定义冻结、support/LCB/campaign/tail gate 通过后，才把相同 contract 迁进 C++ parity 和 fast screening。event-L2 解决的是 10-100ms 状态分辨率，不解决 hidden liquidity、深档真实排位，也不自动证明 keep/cancel 有正 uplift。

### 2026-07-25：normalized-100ms、formal parity 与 causal-v5 历史 baseline

7 月 18 日的 event-L2 还是一条正在收口的数据路径；7 月 25 日，它被固定为唯一版本化的 formal normalized 身份。`normalized_l2_100ms_v2` 从 CryptoHFTData 原生 snapshot/delta 重建，不原地覆盖旧 `bbo/`、`l2/`；每个 UTC 日都附带 rebuilt、sequence、warmup 与 formal eligibility。当前 128 个 rebuilt days 中有 62 日通过 formal normalized gate、53 日具备有效前日上下文。旧约 1 秒与 100ms 混合面板仍可解释历史实验，但不能再被 formal runner 默认 glob。

这一轮还修复了 2026-07-04 至 07-11 的 futures individual-trade maker-side 标志，并重新生成 causal feature、13-head 模型、order-level denominator、campaign lifecycle、null 与 BUY scorer。因果时间、P3、queue、latency、model tree 和 config 都写入独立 manifest/hash；缺 feature、错误 schema 或旧 L2 identity 会 fail fast，而不是补零继续跑。

双引擎随后使用同一 fresh-start、fixed/merged event clock 和固定随机延迟路径完成 formal 对拍。代表日的 ML-OFF、ML-ON 以及 executable passive null 中，Python/C++ 的 fills 完全一致，PnL 误差约为浮点舍入量级；该 checkpoint 的全仓测试快照为 `717 passed, 4 skipped`。这轮修复覆盖 activation-time queue rank、pause/reducing precedence、Post-Only activation、cancel ACK/fill race、IOC book semantics 与 tick rounding。它证明的是同一模拟契约，不是公开行情能恢复真实交易所内部 queue priority。

causal-v5 的严格 A/B 如下：

| Panel | Raw delta | Terminal delta | Fills retention | Inventory time |
|---|---:|---:|---:|---:|
| Validation20 | +3.56 | -0.23 | 91.46% | +271.2 BTC-s |
| Test17 | +2.14 | +0.47 | 92.64% | +131.4 BTC-s |

raw 与 terminal interval 都跨零，因此研究 strict gate 没有通过。随后按用户明确指令，该 bundle 通过 SIGHUP 热加载进入 live，并成为新的 operational baseline；部署身份标为 `user_directed_trial`，旧 causal-v3 只作 rollback。文章故意保留这个区分：**能由两套引擎一致执行**、**被指定上线观察**、**已证明稳定正 uplift** 是三件不同的事。

这段只描述 7 月 25 日的历史状态。7 月 27 日 causal-v9 使用 133 个 good days 和修复后的 taker-tempo lineage 重训后，在三个 formal test days 上 raw 全部为负，terminal 更差且 tail 增加，因此没有晋级或部署。当时 operational baseline 恢复为 ML-OFF，P3 artifact 不变；causal-v5 不再具有该次 live 权限。8 月 3 日的历史 pointer 后续滚动到 causal-v12 v7 identity，这整段都不能用来还原当前开关。

同一 formal scheduler 的第一版 fixed-spread 实验后来暴露出一个更重要的工程问题：25 个距离分别运行在独立策略世界，fill 会反馈到库存和后续 activation；scalar matcher 又把 strictly-through trade 当成 exact-price quantity consumption。它制造了错误的 0→1 tick lifecycle 反转，因此旧 queue-discontinuity、local-kappa 和 lookup 结论全部撤回。

替代的 `paired_fixed_spread_monotonic_v2` 仍只写 6,400 行日度 sufficient statistics，但每个 side/decision 在同一次 C++ replay 中生成全部 25 个距离，共享 ACK-time book、new/cancel latency、TTL 和未来行情路径，且 counterfactual fill 不改变下一次决策。exact-price trade 按数量与冻结 queue calibration 消耗 queue；strictly-through trade 强制 full fill。引擎对 filled/full-filled/quantity 以及 1s/5s/10s/lifecycle 指标逐订单 fail fast：任何“深价成交、浅价未成交”都会终止实验。

128 日 descriptive 与 62 日 formal 最终均为零单调性违例。formal lifecycle fill 的 0→1 tick 变化是 BUY `51.08%→48.66%`、SELL `50.18%→48.96%`。`fill | touch` 仍会上升到约 99%，但它是 deeper-through 条件样本选择，不是无条件 fill edge。80 tick 后 queue fallback 约 79%，100 tick 约 93%，140 tick 后超过 99%，因此远端曲线仍不能冒充 native deep-book truth，也没有接入 live。这个修正比单纯缩短 runtime 更能说明 C++ replay 的价值：高吞吐只有和共享反事实路径、路径级 invariant 与可观测边界同时存在，才会产生可信证据。

paired v2 仍不是训练面板：它只有 `side x distance x day` 汇总，固定 `initial_inventory=0`，也没有 current/`-1 tick`/`+1 tick` 的逐 decision activation、queue、partial-fill、cancel request/ACK 与 censoring 路径。下一步先用 native snapshot/delta 建一个单日流式 smoke，随后分开拟合 placement surface 与 active-order KEEP surface；REPLACE/cancel-re-enter 会重置 queue，必须留在独立 lifecycle action 实验中。只有 prediction gate 通过后，才登记带已知 propensity 的 `action_execution_v1`，不会从这张聚合曲线直接修改 live。

2026-07-26 的单日 native-deep smoke 已经把这条接口真正接通。Python baseline pass 保留真实 inventory role、campaign-so-far 和 side-decision state；独立 sidecar 为每个 place/replace 生成 `closer/current/farther` 三个 child，并按 exchange-time snapshot/delta 与 individual trades 做 k-way merge。1,000 个 cohort 中，三档 fills 为 `42/40/39`，exact-queue fills 为 `4/6/10`，through fills 为 `38/34/29`，路径单调性违例为 0。request→ACK 期间的 fill、partial fill、action-specific GTX 和 native queue 失效原因都进入宽表。

这仍只是 mechanics smoke：shadow fill 不反馈库存，不能生成 campaign counterfactual；截至该 7 月 26 日身份，BUY q90 cancel/re-entry 没有 replay-equivalent state machine，因此作为独立 treatment 被哈希并排除。后来的 ABI v4 已实现 terminal risk-set 与 fresh prospective recovery，但 action 仍因 40 日 lockstep/transport 未通过而关闭。单 action 只有 39--42 fills，加上磁盘 reserve 限制，当时没有训练 surface、读取 Validation/holdout 或创建 action。换句话说，新的 C++/Python 边界现在能生产正确的训练行，但统计证据还没到可以训练策略的程度。

### 2026-07-28：Policy clock、common-support 合同与仓库物理边界

placement fill 研究随后证明，cancel ACK 不能被当成从订单激活时刻开始的平稳自然 hazard。它应被拆成确定性的 baseline cancel request、request-to-ACK latency，以及 ACK 前仍可能 partial/full fill 的 pending race。request-state v2 因此让 pre-request fill 与条件 ACK 曲线在 Development 获得支持，但 pending fill 极稀疏，不能靠增加复杂 head 补足证据。

最新 `ordered_common_support_fill_surface_v1` 又把 closer/current/farther 放进共享的 distance-ordered hazard。它的 action-specific pre-request curves 为 18/18 pass，保守 transport probability bound 也是 18/18 pass；但 activation calibration 只有 11/18、all-three support calibration 只有 9/18，pending economic uncertainty 为 0/36 pass。此外正式 evaluator 将 hazard 积分到 action-specific realized exposure，产生 1,042 行 apparent monotonicity violation，涉及 399 个 cohort，三 action 时钟 max-minus-min 中位差 3,713ms。这是 common-clock implementation-contract failure，不是 LightGBM distance constraint 失效。

所以该 family 在 Development 关闭，Validation/holdout 保持未读，Prediction、Transport、Value、Action 与 Live 权限全部为 false；仓库中也没有创建 `placement_action_value_surface_v1` 或 `placement_quote_action_uplift_v1`。未来 identity 必须由冻结 Spec 绑定 cohort-common、ex-ante、非 outcome-derived 的 scheduled clock，并对缺任一 counterfactual action 的 cohort fail fast。

同一天，仓库按研究所有权物理拆成 10 个策略/证据 family、1 条系统工程线和 D/R/S/G 四层共享基础设施，不保留旧路径 symlink。运行时目录也进一步收口：`data/` 只存离线下载、导入与规范化代码，真实 payload 位于 `${NARROWGATE_DATA_ROOT}`；Binance 执行市场的 REST snapshot + diff-depth 本地簿迁入 `live/orderbook/`；我方活动订单的 queue/path 状态继续由 `execution/` 持有。这样仓库不再同时出现含义模糊的 `data/` 与 `market_data/` Python package。

对应冻结边界见 [causal-v9 replay](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v9_through_20260725_replay_20260727.md)、[ordered common-support result](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/ordered_common_support_fill_surface_v1_development_20260728.md) 与 [contract errata](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f06_placement_fill_cif/docs/ordered_common_support_fill_surface_v1_contract_errata_20260728.md)。

### 2026-08-03：双时钟生命周期、Feature DAG 与连续回放底座

7 月 28 日之后，工程工作的重心从“再加一个模型或 action”转向了三个更底层的合同：**策略到底看见了哪一时刻的数据、订单何时真正离开风险集、跨日回放怎样保留经济状态。**

![K 线上的订单生命周期与 exchange visibility 双时钟](/images/narrowgate/dual-clock-order-lifecycle-kline.svg)

*机制图：订单从 submitted、active、partial fill、cancel pending 到 terminal 不是由一根 K 线瞬间完成；cancel request 之后、cancel ACK 之前仍可能成交。上层交易所事件时钟与下层策略可见时钟也不能互相替代，同毫秒跨流顺序不明时必须 censor 或 fail closed。图为合成示意，不是实盘事件样本。*

这也解释了为什么 C++ 加速不能把生命周期压成一个 `is_live` 布尔值。K 线只画出价格走过哪里；状态机还要保留 remaining quantity、queue risk、request-to-ACK race，以及每个事件何时才对策略可见，否则快速路径会系统性低估 pending risk 或产生未来信息。

在 2026-08-03 这个历史 checkpoint，live/backtest control 由不可变 v7 identity 和当时的可变 pointer 共同解析；下表只记录当日状态，不是任何后续日期或当前的现役开关：

| 组件 | 当日状态 | 工程含义 |
|---|---|---|
| causal-v12 semantics-v6 | ML ON，13 heads，173 features/head | 完成 10 秒桶后刷新，桶间持有 |
| BUY fill-selection | shadow ON，action OFF | 继续记 scorer，不再改变报价权限 |
| BUY q90 | shadow ON，action OFF | 继续观测 100ms active-order score，不撤单/重入 |
| empirical P3 | 10 秒 touch calibration | 仍是 touch，不冒充 queue-aware fill probability |
| runtime authority | startup、restart、preflight、SIGHUP 共用 | 未授权 action 默认 fail-fast，owner override 必须留痕 |

这里最重要的变化不是某个布尔开关，而是 **shadow 与 action 已经拆成两套权限**。模型能加载、scorer 能计算、shadow 有日志，都不再暗示 quote permission 已经开启。

行情侧也需要把“实时”拆成明确的市场数据身份：

| 市场输入 | 当日 live 粒度 | 当时能做什么 | 不能做什么 |
|---|---|---|---|
| Binance BTCUSDC `depth20@100ms` | 买卖各 20 档 partial snapshot，100ms | 报价、weighted-mid proxy、top-N state | 不能恢复每个订单身份 |
| Binance BTCUSDC `bookTicker` | BBO 价或量变化即推送 | 低延迟 best bid/ask 与 MTM | 没有第二档以后深度 |
| Binance BTCUSDC `aggTrade` | 同一 taker order 聚合，USD-M 最快 100ms 推送 | live flow 与聚合成交方向 | 不是 historical individual trade |
| Binance deep book | REST 1000 档 snapshot + diff-depth 100ms | 当日 active-order exact-level path 与 q90 shadow | 仍是 price-level MBP，不是 MBO；当日 shadow 不拥有 action 权限 |
| Bitget / Bybit / OKX spot+perp | `books1` / `orderbook.1` / `bbo-tbt` 与 public trades | 当日 receive-time external shadow | 只有 L1/BBO，且当时不进入 quote action；不由本表声明今日开关 |
| user data stream | 我方 order/fill/account event | 自有订单生命周期与仓位同步 | 看不到其他参与者的逐笔委托 |

因此历史 replay 可以用 Binance Vision individual trades 更细地消耗可见 queue，但 live 策略面对的成交源仍是 `aggTrade`，全市场盘口仍只有价位聚合量。任何 queue-ahead 结果都应写成 **在冻结 MBP、trade 与 latency 合同下的估计**，不能包装成交易所真实逐单排位。

Feature DAG 则把此前散落在函数调用顺序里的时钟边界显式化。当前不是动态 graph executor，而是静态实现加机器可读 contract。已登记两张图：

```text
live_10s_signal_cutoff.v1
    finalized 1s bars
      -> strict cutoff-exclusive completed 10s bucket
      -> 13-head feature vector
      -> sample-and-held prediction

buy_q90_visibility_lifecycle_path_score.v3
    exchange book + exchange order events
      -> causal visibility
      -> remaining-quantity lifecycle
      -> E_q^exchange / E_q^visible
      -> active-order depth path
      -> q90 score
```

第二张图修复了一个会直接污染 action-rate transport 的问题：exchange-terminal 订单不能继续伪装成 `PENDING_CANCEL` 接受 hazard evaluation。当前共享 lifecycle 显式区分 `SUBMITTED / ACTIVE / PARTIALLY_FILLED / CANCEL_PENDING / EXCHANGE_TERMINAL / POST_CANCEL_RECOVERY / REENTRY_ELIGIBLE`；只有三种 exchange-live 状态累积 fill risk。partial fill、cancel reject、ACK 前成交与 remaining quantity 都保留，缺失或倒退的 exchange timestamp 会让物理 $E_q$ 变成 null，而不是借 visibility clock 补值。

fresh prospective recovery 也不再复用旧订单：cancel ACK 且剩余数量大于零时，才以当前价格、age=0、当前因果可见簿、queue-at-tail 和当前 GTX support 评估一张**新候选单**。绑定旧 v5 配置的冻结 v1.6 一日 ABI-v4 smoke 曾做到 Python/C++ transitions 零 mismatch；但 61 次 recovery evaluation 没有一个满足有效 transport 条件。当前 v7 config hash 与继续开发后的 `backtest_tick.py`、bindings/native module hash 已偏离该冻结身份，因此旧 v1.6 不能直接复跑或冒充 v7 parity；需要新 successor/linkage 后才能继续 40 日 run。这项修复仍是 historical local baseline-integrity evidence，不是 q90 action 恢复依据。

最后，跨日研究不再把“连续 replay”理解成把坏日硬拼起来。新的 versioned substrate 有三种不同权限：native strict 只在原生 sequence 合格段声明 exact lifecycle；restart-aware 把数据缺口冻结为计划停机，停机前必须完成 cancel terminal，期间不报单但持仓继续 MTM；Tardis provider-normalized 只做预测/source sensitivity，永远不获得 native queue 权限。UTC midnight 仍可作为 bootstrap cluster，却不再意味着平仓、清库存或结束经济 campaign。

这套 substrate 与三层 cache DAG 都比 F03/F05/F09/F10 更底层，但它们只统一 replay 语义，不统一各 family 的 action、reward 或 promotion gate。当前 full tick-runner binding 仍然 fail-closed；在第一条权威连续路径跑出来前，不能拿单元测试通过冒充新的连续 PnL baseline。

相关公开合同见 [Feature DAG](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/docs/feature_dag_contract.md)、[continuous replay substrate](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/shared/replay_lifecycle/docs/versioned_continuous_replay_substrate_v1.md)、[replay cache DAG governance](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/docs/replay_cache_dag_v2_governance_20260803.md) 与 [operational baseline v12](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f10_live_replay_attribution/docs/operational_baseline_identity_20260820_v12.json)。v12 保持不可变，但只作为旧执行语义下的 50 日 stale historical comparator；公开 v13 只治理历史 locator。当前 live 身份必须从私有 release manifest 与实际主机状态确认，精确定位符不随公开文章分发。

### 2026-08-12 至 2026-08-24：benchmark、ABI、compatibility baseline 与 strict-native 证据分层

`bench/` 目录确实主要用于测量 C++ 路径的性能，但“跑到了 C++”不等于“跑到了正式回测”。`bench_quote_core.py`、`bench_tick_replay.py` 和 live-routing benchmark 测的是绑定成本、吞吐、尾延迟或回归稳定性；`simulate_tick_arrays_ext_policy_v3` 是基础 formal ABI，当前 `models/backtest_tick.py` 会按冻结功能合同分派到 v4、v5、v6 或 v7。Python 继续负责数据身份、因果时钟、参数合同和 fail-fast 校验；较低层的 `simulate_tick_arrays` 即使更快，也只是 benchmark/test surface。ABI 版本扩展表示更多输入/策略面被显式绑定，不自动提高 evidence class。

2026-08-11 的 AWS runtime 后来已经成为历史身份；公开 v12 又在 2026-08-20 记录过一次 host-only successor，历史 owner-side authority 在 2026-08-24 继续前移。公开文章不发布后续私有 release 的主机地址、实例、进程身份或证据路径；“当前主机”不能从某个旧 pointer、曾经复用的网络地址或公开快照推断。本文前面的 7 月 x86 benchmark、REST/WebSocket latency、dispatcher 与 global-flow soak 仍只属于原 provider/host/runtime 的历史工程证据或敏感度，不能因为后继环境区域或规格相近就重标成 current-host 实测。

冻结的 50 日 compatibility result 也需要按这个边界重读。它完整复现了 40 日前缀并新增 10 日，但实际执行身份是规范化 top-20/100ms L2 的 C++ daily-fresh-start diagnostic，native raw snapshot/delta queue scheduler、订单/撤单延迟和 execution-book receive-time visibility 均未启用。它可以解释旧结果的冻结历史 denominator，却不是新 mechanics 的默认控制；只有新合同显式要求历史兼容复现时，才可按其原身份重放。

| Panel | Terminal MTM | Closed-campaign value | Fills |
|---|---:|---:|---:|
| Immutable first 40 days | -144.251748 USDC | -147.466348 USDC | 17,118 |
| Added 10 days | -21.314331 USDC | -21.064631 USDC | 3,029 |
| Pooled 50 days | -165.566079 USDC | -168.530979 USDC | 20,147 |

这些数字是 predecessor common-simulator 的权威诊断分母，却不是 strict-native order-path PnL，更不是连续 live 账本。`daily_fresh_start` 会在每个 UTC 日重启进程态，公开 top-20/100ms L2 也没有驱动 native queue lookup；所以任何 cooldown、replace、cancel/re-entry 或 fill-selection 候选若要解释订单路径增量，必须在两臂共同升级到与主张匹配的执行身份。

F05 随后在明确较弱的 modeled-queue lane 上完成了 SELL persistent policy 的 50 日 repeated full-path 与 corrected 71 日 restart-aware replay：点估计均改善，但 primary lower bounds 仍为负，research hard gates 没有通过。这里的“71 日连续”是 F05 family-specific restart-aware runner 的结果；共享 `continuous_replay_state.v1` 的 authoritative full-tick-runner binding 仍是另一条 fail-closed 合同，二者不能混称同一个 continuous authority。

对应的 strict-native + sampled-latency successor 已完成 2026-06-29 一日机制验证：消费 5,086,247 个 native events，完成 19,460 次 queue lookup，其中 exact 9,797、known-zero 9,663、missing 0，并应用 14,825 次 visibility delay。该日 fills 从 compatibility 路径的 489 变为 921，terminal MTM 从 -7.878888 变为 -7.132700 USDC；这证明 raw queue 与 latency 输入真实改变路径，但只证明机制已接通，不能据此推断完整 50 日修正的符号或幅度。

更严格也不意味着可以越过数据不可识别性。后续 F05 strict-native cooldown 标签执行发现，历史 public trade 只有毫秒时间，而 raw book 含同毫秒内更细事件；trade、book、activation 与 ACK 跨流没有共同序号时，哪个事件先可见无法从源数据恢复。正式路径因此保留歧义并 fail closed，没有用任意 tie-break 伪造 exact queue 标签。这是 source identifiability 边界，不是把一个 C++ 排序规则写得更复杂就能消失的问题。

`fill_sequence` 只解决已经进入同一物理成交 trace 的同时间成交顺序：它保存原始追加次序，并在任何账本写入前验证序列连续及 inventory-before/after 路径。它不为彼此没有共同序号的 trade、book、activation 与 ACK 跨流事件发明顺序，因此不改变上面的 source-identifiability fail-closed 边界。

即便 strict native queue 可识别，它仍只重建公开 exchange-time MBP 与我方反事实订单：看不到交易所私有订单 ID/FIFO、hidden liquidity、真实 private ACK/user-stream receive clock、live 多线程调度、完整进程内 warm state 和市场对我方订单的反馈。工程文章里的“parity”因此必须总是带限定词：Python/C++ mechanics parity、historical strict queue evidence、empirical transport sensitivity 与 exact live reproduction 是四种不同主张。

对应的历史证据见 [50 日 compatibility baseline](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f10_live_replay_attribution/docs/current_live_held_ber_replay_baseline_50d_20260810.json)、[execution-scope amendment](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f10_live_replay_attribution/docs/current_live_held_ber_replay_baseline_50d_execution_scope_amendment_v1_20260810.md)、[strict-native 一日机制结果](https://github.com/xiao-nanbei/NarrowGateMaker/blob/3abc02ff91ce76cc69a4263dcc326dcd1226eba6/research/families/f10_live_replay_attribution/docs/current_live_held_ber_strict_native_latency_baseline_50d_v1_one_day_mechanics_20260810.md)、[Python formal dispatcher](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/models/backtest_tick.py) 与 [pybind ABI](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/cpp/narrowgate_cpp/bindings.cpp)。文件名中的 `current_live_held_ber` 是历史 identity 名称；其 `ber` 对象实际是 trade-intensity acceleration guard，不是 book-exhaustion rate。

### 2026-08-24 至 2026-08-25：BUY E3 历史 owner override 与 no-shadow 快照

历史 operational record 记录，owner-side authority 在 2026-08-24 把 BUY E3 cooldown 接入当时的 live hot path：receive-time EMA 在普通行情观察器中更新，只有 exposure-increasing BUY executed fill 选择新的 cooldown duration；E1、E2、SELL owner policy、reducing quotes、hard safety 与 unsupported/warmup fallback 保持当时合同。后来一个私有 no-shadow 快照记录了其他开关的关闭，但本文不把它公布为当前现役状态。公开 `live/config.yaml` 只是默认关闭的安全模板；精确配置、运行 manifest、receipt 和进程依赖属于私有证据边界。

这个历史 owner operation 是显式 operational exception，而不是 research promotion：BUY E3 在 Development 上有正 point signal，但 simultaneous lower bound 与 frozen feature hierarchy 失败，Validation 和 sealed holdout 未读。预激活的 1,000-sample resource gate 只证明当时 fresh disabled process 的冻结范围，不能改名成 active process 的持续性能证明；后续 active observation 又留下小样本 latency/overflow caveat。冻结 health 与 lifecycle 证据也只证明各自采集时刻，不证明 latest-liveness、动作发生或经济效果。公开 v13 只是历史 locator prerequisite；mechanics-safety successor 只提供 30 日 reduced-support mechanics resolution；冻结 v12 50 日结果只作为旧 mechanics 下的 stale historical comparator。它们都不授予 research、action、live、occurrence、validation/holdout 或 promotion authority，也不公开当前 owner policy。

一次历史 owner-side incident check 暴露了一个容易被健康日志掩盖的边界：predecessor 进程、市场输入和 HEALTH 输出仍在推进，但 `ORDER_OWNERSHIP_CONFLICT` 安全闩已经停止报价。这不是已证明的操作系统进程死锁；更重要的是，PID/HEALTH 存活不等于 quoting 存活。本文只保留这条工程教训，不据此声明当前 live 健康、动作发生或经济效果，也不把仓库中的 successor 修复写成已部署恢复。

## 结论：低延时最终服务报价决策

NarrowGate 的工程迁移不是从“我要写一个高速交易系统”开始的，而是从 maker 研究本身的压力长出来的：一旦需要真实 L2、queue ahead、latency、TTL、guard、inventory-time、quote EV labels 和多日多臂 A/B，Python orchestration 仍然合适，但 hot loop 和状态机必须收紧边界。

这篇工程复盘里，最重要的结论不是某个 benchmark 数字，而是几条工程判断：

1. 离线引擎优化的价值，是把严格 replay、quote context、order-level evidence 和多日反例验证变成日常流程，而不是偶尔抽样；
2. x86 live 优化的价值，是让同一套 spread、skew、TTL、cooldown 和库存控制在真实 REST/WebSocket 尾部下仍能按预期执行；
3. Python 仍然适合数据清洗、训练编排、报告和实验组织；
4. C++ 适合长期驻留的状态、高频低基数分支、完整窗口 replay 和稳定的 live hot path 小决策包；
5. pybind 边界必须按数组、固定 tuple 或 compact context 设计，不能每 tick 传大 dict/dataclass；
6. parity 比速度更重要，没有路径级和金额级一致性，sweep 越快越危险；
7. native profile、日志和订单调度是工程对象，历史策略开关与 owner 试验不是现役状态证明。7 月失败并移除的是 per-side latest-wins gateway；9 月的 terminal continuation 与单一 GLOBAL FIFO 异步响应必须分别验证。历史 52.77ms 只衡量某个窗口的 terminal visible → decision，不能冒充当前全链路 p99。后续经济比较必须带入新的运行时延迟与独立订单路径，不能靠复活旧开关或新建研究旁路获得结论。
8. 包名也必须表达生命周期：离线 ETL 在 `data/`，live 公共簿在 `live/orderbook/`，我方订单状态在 `execution/`，大型行情文件只存在于仓库外数据根。

所以 C++ 在 NarrowGate 里的定位不是外置加速器，而是 maker 策略工程化的一部分：离线侧让严格 replay、反例搜索、null baseline、order-level evidence 和参数 racing 变得可负担；live 侧把稳定、高频、低基数的状态和决策边界收紧到更少动态对象、更少无意义 replace、更可控的尾延迟。低延时本身不是 alpha 结论，但它决定了一个 maker alpha 能否被真实验证、稳定执行，并在风险变坏时及时撤退。

公开结论是：Full-Multiscale 的 `supported_sides=[]`，50/71 日 SELL 与 BUY E3 Development 虽有改善的 point estimates，但 lower-bound、feature-hierarchy、strict-queue/transport 或独立确认门槛仍未全部闭合。历史两侧 owner policy 都不能重写为 research pass；30 日 mechanics-safety successor 只定义 reduced-support mechanics comparator，v12 50 日 compatibility identity 是禁用 raw native queue、latency 与 live transport，且在账本/费用/campaign/spread/fill-order 修复后已经 stale 的历史 comparator。精确当前 live 依赖需从私有 release manifest 和实际 EC2 状态确认，不由本文推断。生产代码可以继续变快、变清楚，owner 也可以做可回滚的运营选择，但 benchmark、单日 mechanics、诊断 PnL、preactivation resource gate、模型可加载、PID 存活和 frozen health 都不能替未通过的 Prediction、Value、Action、Live 或 latest-liveness 证据。

面向开源版本，C++ 还有另一层价值：它迫使项目把边界说清楚。哪些路径有 Python/C++ parity，哪些只能 fast screening，哪些仍必须由 Python replay 做正式证据，都应该在 public README、CI 和 examples 里体现出来。否则一个看起来很快的 extension 只会让陌生人更快踩进旧结论。

---

本文及 NarrowGate 项目仅用于 C++ 低延时系统、市场微观结构、价格行为学、做市模型和机器学习回测方法的学习交流与技术研究，不构成财务、投资、法律或合规建议。中国大陆关于 crypto 交易及相关业务活动的监管环境具有不确定性；任何人将相关代码用于连接交易平台、交易、商业展业或投资决策，其合规风险、资金损失、技术故障及其他后果均由使用者自行承担，与作者无关。
