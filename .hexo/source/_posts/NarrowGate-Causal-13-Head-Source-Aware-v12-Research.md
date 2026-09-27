---
title: 'NarrowGate 新 13-Head：Tardis 因果特征、时间加权选型与负收益结果'
date: 2026-08-29 13:30:00
updated: 2026-09-27 10:45:00
categories:
- Market Making
tags:
- Market Making
- 机器学习
- 时间序列
- Causal 13-Head
- 回放
math: true
---



## 历史前言：为什么重建整条链路？

v4 因未来 metrics 泄漏而撤回对应 test 和经济结论：这是无效证据，不是有效负结果。修正后的 v5、v9 保留了预测诊断价值，但没有建立稳定的 maker 经济增益。Source-aware v12 及其一秒后继说明，特征语义更清晰、推理更快，不等于订单路径更好：换单可能丢失队列优先级、减少成交并延长库存暴露。这些结论只属于原样本和执行假设，不是对未来机器学习永久无效的判断。

可继承的是方法：预测损失、实际动作、完整净权益是三种不同测量。新行情需要新的校准、标签和模型身份，不能把旧目录改名当迁移。旧研究作为本文前言，不再是当前模型默认值。


## 新特征与标签合同

本轮 F03 在规定的 407 日源日历中只使用 BTCUSDC。BTCUSDT 处理和镜像独立进行，不向本模型提供参考市场特征。模型从共同执行协议的 30 项中使用 29 项，排除不可得的原生包数量，保留未知值和有效性掩码。历史个体成交计数在 live 中也必须使用个体成交，不能把聚合包拆成虚构子成交。

源时间、模型化交付、特征就绪时间分开；决策只消费已经就绪的观察。独立 outcome Bars 只服务离线标签，不能把未来送进特征。源时间代理和采样延迟仍是建模假设，不是原生时间或队列一致性。

13 个 head 包括 10/30/60 秒方向、收益、波动，以及 5/10 秒 bid/ask toxicity。继承的报价／触达条件语义不是无条件未来收益或排队必然成交。各 head 使用实际 outcome end 剔除越界，而不是共用固定 horizon；缺失未来 markout 仍是未知，不是安全或无毒的零标签。

P3 使用全部 100 个规定训练日统一拟合一次，在标签和训练前冻结。它是绝对价格距离下的触达概率，不是含排队的成交概率。H=inf/240/120/60 四套完整训练共 52 个 head，逐头绑定来源、标签、校准、划分与训练身份；冻结模型字节保持不变。


## 选型、对照与会计

只有 B 的 100 日净收益参与四套完整模型选型，A/C/T 金额不参与；同分优先 inf，再优先较长半衰期。ML-OFF 是新链路对照，不是第五个候选或旧 B0。开发区每臂有 150 个独立两日账户；Final 只接受冻结胜者与 ML-OFF，末尾单日另算。

每片内部账户连续，片间按相同初态重置；特征预热不等于账户延续。行情、P3、延迟、执行假设和会计固定。ML-OFF 不加载模型，使用行情 Bar 滚动方差。回放接口实际输出五个预测字段：10 秒方向、波动、收益和买卖 toxicity。训练 13 个 head 不等于证明每个 head 都有独立经济贡献。

净权益包括成交现金流、手续费、带符号真实资金费和期末库存 MTM；估值不假定免费清仓。缺资金费或终点估值不能写成完整 all-in 收益。



## 本轮结果：相对少亏，不是盈利验证

2026-09-22 更新。B 按既定规则选中 H=inf，开发区完成 750 次策略分片。Final 已完成 108/108 次：每组 53 个独立两日账户和 1 个单日账户、覆盖相同 107 日。

| Final 策略 | 全成本净收益 |
| --- | ---: |
| 选定 H=inf | −189.212148 USDC |
| 新链路 ML-OFF | −269.042233 USDC |
| 配对合计差值 | +79.830084 USDC |

已经包含手续费、真实资金费和期末库存 MTM。两组都亏损；独立账户求和不是连续账户收益率，也不是线上盈利证明。共完成 858/858 次计划内策略分片，全部分片账本与日账绑定核验通过；407 日参考市场处理和全量镜像仍是独立未完工作。


## 补齐尾片与保留使用历史

末尾单日账户最初缺少边界日资金费文件，现已补取真实 Binance 数据并完成两臂日账核验。最后一日 H=inf 为 −6.636594 USDC，ML-OFF 为 −7.103006 USDC。边界记录真实时间为 9 月 12 日 00:00:00.001 UTC，严格保留该时间，不将终点之后的资金费挪入账户；边界文件用于完整性验证。ML-OFF 在查看一个开发分片四套收益后追加，Final 日期保留 previous-use，不是新的未触碰 holdout；完整运行结束前已查看过部分 Final，这一使用历史不会因补完尾片而消失。

这些数字是冻结执行假设下的描述结果；没有在这里报告统计显著性、年化收益或真实订单因果效果。公共成交资格、队列和延迟没有原生证据的部分仍属模型假设。


## 新模型与 live：历史状态与候选组装分开

以下两段记录 2026-09-22 当时的边界，不是今天的 live 状态查询：

新 execution_v1 live 接口已经实现个体成交接入、共同特征、13 个未修改 head 的身份检查和输入异常停报价。目标主机部署、实际报价动作、延迟和完整激活验收仍是另一层工作；本机时钟偏差不证明 AWS 时钟有同样问题或已经健康。

当前配置仍引用的旧模型必须等安全替代后再删除。本次没有修改冻结新模型，也没有把旧模型默认目录替换当成部署完成。


2026-09-26 补充：后续已完成一个未激活候选的目标 Linux 环境及有限真实观察链路组装验收，覆盖共享特征、13 头与后处理、P3、native 报价及无交易能力的意图记录出口；两个预热完成决策、四条意图与本地参考一致。该次验收未连接交易通道、未切换 current、服务或生产配置，不等于完整收益回测、全面输入覆盖、原生接收／队列一致或已经开始实盘交易，也不证明今天的 live 版本。证据范围见[代码架构说明](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/docs/architecture.zh-CN.md)。

## 量纲与时钟：仍须逐消费者核查

绝对价格及 P3 距离是 USDC/BTC；库存和成交量是 BTC；方差率合同为 (USDC/BTC)²/秒，不可与标准差、收益方差、bps 混用。毫秒、微秒、纳秒及秒必须在边界显式转换；个体成交数不是原生消息包数。费率无量纲，最终资金费和手续费现金流为 USDC。账本对齐不等于已经证明所有特征与动作单位正确。

完整账本：H=inf 手续费 12.188537 USDC，资金费现金流 +0.041388 USDC；ML-OFF 手续费 10.601817 USDC，资金费现金流 +0.021085 USDC，均已计入净收益，不另加减一次。详细审查地图见[仓库量纲审查入口](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/units_review.zh-CN.md)，完整结果见[F03 主报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/README.zh-CN.md)。


## 证据与范围

本页保留历史永久链接，当前摘要说明新链路研究，后附保留的旧阶段源稿并明确其历史范围。购买行情、冻结模型、选型回执和逐日账本保存在私有证据库，不随公共仓库分发。完整 F01–F10 兼容计划、407 日全量内容验收和其他研究族的新实验不能由本次 F03 结果代替。

源代码中的 F03 文档记录输入、标签、选型与会计合同。本文是研究记录，不构成盈利承诺或投资建议。


## 历史源稿（2026-08-30）

以下保留迁入写作工程的历史原稿，所有“当前”仅指当时的版本；它不是现行接口、当前结果或部署声明。


## 1. 五个版本其实是一场持续的可证伪实验

Causal 13‑Head 研究用同一组做市相关标签检验 decision-visible state 能否改善预测，并进一步改变完整 maker 路径。v4、v5、v9、v12 和 1 秒 cadence 不是五个互不相关的模型项目：它们依次修复 P3、100ms 归一化、taker-tempo、跨源语义与决策频率，每次都在追问同一个核心问题——预测增量是否能穿过订单、库存和 campaign accounting 变成稳定经济增量。

对第 $h$ 个 head，预测层比较 proper loss：

$$
\Delta L_h=L_h(f_{\mathrm{ML}})-L_h(f_{\mathrm{baseline}}),
$$

经济层则比较同一日、同一初始状态与同一 replay identity 下的完整路径：

$$
\Delta Y_d=Y_d(\pi_{\mathrm{ML}})-Y_d(\pi_0).
$$

$\Delta L_h<0$ 不能替代 $\Delta Y>0$；旧 v4–v12 与 cadence 实验中反复出现的情况是：局部 ranking 或少数 heads 通过，但 side、tail、fill retention 与 terminal value 没有同时闭合。

## 2. 研究阶段与证据状态

| 阶段 | 它真正问什么 | 结论/权限 |
|---|---|---|
| v4：Empirical P3 重训 | 替换历史 P3 后，13 heads 与 replay 是否仍成立？ | 发现 future-metric leakage；旧经济数字撤回 |
| v5：Normalized-100ms 重建 | 在修复后的 100ms/P3 身份下能否晋级？ | 有 prediction 排序；无稳定经济 promotion |
| v9：Taker Tempo | 成交节奏特征能否转化为 maker alpha？ | 正式 denominator/support 与 maker value 失败 |
| v12：Source-aware semantics | 跨源语义修复后 13 heads 能否通过完整门？ | 仅 5/13 heads；full-path screen 失败 |
| 一秒 cadence successor | 更快更新是否改善十秒 control？ | fills 减少、库存时间与 tail 恶化；Development 关闭 |

## 3. v4：Empirical P3 重训

### TL;DR：一次严肃的重建，也可能因为三天时钟错误失去 test authority

Causal-v4 是 NarrowGate 在修复 10 秒 feature-ready、价格方差量纲、merged event clock 和经验 P3 后，对 13-head model 做的一次完整重训与严格 replay。它不是只重新跑一遍 LightGBM：研究冻结了 80 train、1 embargo、20 validation、1 embargo、20 test，绑定 122 日 order denominator、显式 P3、queue、latency 与 C++/Python parity，并只让 `ml_enabled` 区分经济 arms。

后来 MarketData alignment audit 发现，2026-07-12、07-14、07-15 三个 futures-metrics archive 使用 interval-start timestamp，使本应五分钟后才可见的 observation 提前进入 feature。P3 自己的日期截至 07-11，不受影响；13-head train/validation 也不受影响。但三天落在 test，且 BUY scorer 的 blocked-day cross-fitting 会让污染跨日传播，所以 test metrics、test/all ML A/B 与 scorer buckets 全部撤回。

因此这项研究的最终结论不是“v4 模型表现多少”，而是：经验 P3、bucket-end timing、merged clock 和严格 artifact validation 被保留为研究基线；v4 13-head 与 BUY scorers 不得 promotion；旧 queue/PnL 数字不能继续作为当前选择证据。后来的 normalized-100ms 与 time/calendar/unit 修复建立了新身份，不能把 v4 改名后继续用。

![Causal-v4 的特征可见时钟与证据撤回](/images/narrowgate/causal-v4-clock-lineage.svg)

*图 1：证据谱系示意。10 秒 bucket 必须到 `bucket_end` 才可见；三天 metrics 提前五分钟会污染 test 与跨日 scorer，因而整个对应结果分支撤回，而不是只删三行。*

本文只讨论历史研究证据，不建议任何真实交易行为。公开报告中的模型和 PnL 均不代表当前部署状态。

### 1. 研究问题

13-head model 同时预测多个 horizon 的方向、收益、波动和 bid/ask toxicity。它的策略用途不是直接输出 BUY/SELL，而是改变 quote core 使用的风险、方向和 toxic-state inputs。

研究问题可以分成三层：

1. 修复后的 causal features 是否保留可用的 held-panel ranking；
2. ML-ON 相对 ML-OFF 是否在相同 full replay 中改善 PnL、campaign terminal 与 tail；
3. 这种改善是否在正确 test identity 上成立，并足以越过 promotion gates。

预测层与动作层不能混用。设 13 个 heads 为 $f_h(x_t)$，每个 head 的 predictive score 只是：

$$
S_h=\operatorname{Score}\bigl(y_{t,h},f_h(x_t)\bigr).
$$

经济 estimand 则是完整 arm difference：

$$
\Delta Y_d=Y_d(ML\text{-}ON)-Y_d(ML\text{-}OFF),
$$

其中只有 `ml_enabled` 可以变化，P3、queue、latency、inventory、cooldown 和 safety configuration 必须相同。

### 2. 输入、模型与动作

输入使用 completed 10-second feature buckets。方向与回归 heads 覆盖 10s、30s、60s；toxicity heads 按 bid/ask 与 5s/10s 分离。模型输出进入 shared live/replay quote semantics，但本研究没有独立的 order-level propensity action。

经济 arms 是整条 quote policy 的 ML OFF/ON。BUY fill-selection scorer 在构造 order denominator 时被禁用，以免另一个 action overlay 污染对 13-head 的归因。

queue q0.70 是由外部 calibration 得到的 reference，不是从本次 PnL 表挑出的参数。q0.55/q0.85/q1.00 只做 sensitivity，不能用 replay winner 改写 queue truth。

| 组件 | 冻结含义 |
| --- | --- |
| Feature cadence | 10 秒 bucket，`bucket_end` 可见 |
| Volatility | `(USDC/BTC)^2 / second` 的绝对价格方差 |
| P3 | 经验 10 秒 touch curve 与显式 artifact identity |
| Event path | merged causal event clock |
| Replay | C++，先过 Python/C++ baseline parity |
| Action difference | 仅 `ml_enabled` |

### 3. 因果时钟与量纲修复

一个 10 秒 bucket 覆盖 $[t,t+10s)$，只有在 $t+10s$ 后才完整。正确 feature-ready rule 是：

$$
t^{feature\ ready}=t^{bucket\ start}+10s.
$$

若把 row timestamp 当作 bucket start 又在 $t$ 使用，就让策略看见未来十秒。v4 明确采用 completed bucket，并将 quote labels、P3/effective-kappa、dynamic cap 和 absolute maker-fee floor 放在一致单位中。

风险项也修复了绝对价格方差的单位。若 $\sigma^2$ 是每秒绝对价格方差，$q$ 是 BTC 数量，horizon 为 $H$，一个 USDC 风险尺度可写成：

$$
R=\sqrt{\sigma^2H}\,|q|.
$$

它不应再乘一次 mid，否则会重复把价格单位放大。hypothetical terminal taker liquidation 被单独报告，不偷偷从 final PnL 再扣一次。

### 4. 冻结面板

feature split 为 80 train、1 embargo、20 validation、1 embargo、20 test。order denominator 覆盖 122 日、2,219,633 个 placed orders 与 70,650 fills。

P3 fit/validation/test identity 截止 2026-07-11，因此后来的三天 futures-metrics timing 问题不影响 P3。13-head model 的 train/validation dates 也在污染之前；受影响的是 test interpretation、在 test/all 上运行的经济 A/B，以及使用 blocked-day cross-fitting 的 BUY scorer buckets。

这一区分很重要。不能因为 model fit bytes 本身来自未污染 train，就宣称整个 research result 仍有效；promotion 依赖 held test 与完整 action evaluation，而这些证据已经失去 causal identity。

### 5. 一个五分钟提前可见的具体例子

假设 futures metric row 标记为 12:00，但语义其实是 12:00–12:05 interval 的统计量，正确 ready time 应是 12:05。若 feature join 按标签 12:00 使用，12:01 的 quote decision 已经获得未来四分钟的信息。

这不是几毫秒 latency approximation，而是目标 horizon 同量级甚至更长的直接 leakage。它可以同时改善 direction AUC、改变 model early stopping，并通过 quote path 影响 fills。

只删除被污染三天的 report rows也不够。blocked-day cross-fitting 可能在一个污染日训练 scorer，再到另一个看似正常日评分；模型参数已经把错误信息带到下游。正确处置是撤回整个受影响 artifact 与 result branch，然后在新 identity 下重建。

### 6. 当时看到的结果与当前可引用边界

v4 report 曾给出 13-head、BUY scorer、strict ML A/B 和 queue sensitivity 数字。后续公开状态明确规定：v4 13-head、scorer 与 exact replay numbers 被 normalized-100ms、trade-side、time/calendar/unit 修复所 supersede，不能用于当前 promotion 或参数选择。

仍可保留的定性结果包括：same-input Python/C++ parity gate 可以成立；较大 queue-ahead sensitivity 会显著改变 fills 与参与；单看 aggregate PnL 可能把 participation reduction 当作改善；q0.70 不能由 replay PnL winner 替换。

报告还指出 q1.00 相对 q0.70 少约 10.3% fills，并在当时的 test raw PnL 上更差、增加五个 tails。这个历史机制说明 queue arm 的 winner 解释脆弱，但精确表格不具有当前 causal authority。

由于正式 test/economic evidence 被撤回，本项目没有一个可以诚实报告的 current confidence interval。把“没有有效 interval”写成结论，比从 invalid panel 计算一个很窄的区间更科学。

### 7. 研究演进为何合并成一篇

`model/runtime cleanup`、feature timing 修复、empirical-P3 retrain、scorer rebuild、strict replay 与后续 correction 都服务同一个 v4 问题。这些改动影响实现准备与证据可用性，本身不增加独立经济检验。

当 normalized L2、trade-side universe 或 time/calendar/unit contract 改变后，才出现新的 v5/v7 research identity。v4 的后继不能沿用旧 test numbers，也不能把普通 implementation repair 编成 `v4.1/v4.2` 来制造似乎更多的研究。

### 8. 关闭与支持边界

保留：empirical P3 研究方向、completed-bucket causal timing、merged clock、dimensionally closed risk/accounting，以及 artifact validation/parity discipline。

撤回：v4 test prediction metrics、test/all ML A/B、BUY scorer bucket values 和任何基于它们的 promotion claim。

没有获得：model replacement、BUY scorer action、queue retuning、Validation/holdout 晋级、shadow 或 live authority。历史上某些 model bytes 曾作为 owner-directed operational trial，与统计 promotion 是两件事，也不描述当前 runtime。

### 深入推导：一个泄漏 head 怎样污染共享模型

多任务模型常写成共享表示 $z_t=f_\phi(X_t)$ 与十三个输出头 $\hat y_{j,t}=g_{\psi_j}(z_t)$，训练目标是：

$$
\mathcal L(\phi,\psi)=\sum_{j=1}^{13}w_j\mathcal L_j(y_{j,t},g_{\psi_j}(f_\phi(X_t))).
$$

如果某个输入列或 label construction 提前看见未来，问题不只停留在对应 head。它的梯度会更新共享参数 $\phi$，其他十二个头也可能从被污染的表示中获益。于是“删掉泄漏 head 的结果列”并不能恢复模型；必须从特征物化、训练、artifact 到 full-path replay 全部重建。

v4 中三天 timing error 的严重性正来自这里。哪怕多数日期和多数 heads 合法，只要 formal test 的一部分 rows 使用了决策时尚未可见的 future metric，报告中的 prediction ranking、阈值、quote path 与经济差值就不再绑定同一个因果信息集。

![13-head 从共享输入到经济门的证据流水线](/images/narrowgate/f03-thirteen-head-evidence-pipeline.svg)

*图 2：共享 encoder 会传播时钟错误；prediction joint gate 与 economics joint gate 都必须重跑，不能只删除一列结果。*

### 为什么三天错误不能按比例“打折”

直觉上，人们可能想把错误三天从总 PnL 中减掉，保留其他天。但 maker replay 有路径和选择反馈。模型阈值可能由含错误日期的训练或 calibration 决定；错误 rows 也可能改变模型在哪些状态开启、改变 fills 与库存，从而影响整个日期的后续订单。即使单日结果可以删除，训练 artifact 与 candidate selection 已经读过这些日期，剩余天也不再是原先声明的 untouched test。

统计上，删除不合法日期还改变 denominator 与不确定性。若 formal test 原本只有少数日期，去掉三天会显著改变日级 cluster 数、regime 构成和 simultaneous gate。正确标签是“经济数字撤回、原不晋级决定保守保留”，而不是重新计算一个看似精确的折扣 PnL。

### 一个反事实例子：提前五分钟可见为何会显得异常强

假设特征声称在 $t$ 时刻给出未来五分钟 realized volatility。市场即将单边下跌时，这个量已经升高，模型因而在跌势开始前扩大 BUY quote；历史回放会显示更少 adverse BUY fills。可是 live 在 $t$ 时刻不知道未来五分钟路径，真正可用的只能是过去窗口估计或延迟发布值。

错误特征等价于让动作读取 $X_{t:t+5m}$：

$$
A_t=\pi(X_{\le t},X_{t:t+5m}),
$$

而可执行策略必须满足 $A_t=\pi(X_{\le t_{ready}})$。两者不是同一个噪声水平下的近似，而是不同的信息结构。后续 normalized-100ms 与 source-aware successor 的意义，就是重新限定 $\sigma$、P3、trade 与 L2 何时 ready，而不是简单换一批训练文件。

### 泄漏为何会穿过 cross-fitting，而不是只污染三天

blocked cross-fitting的每个OOF prediction看似来自“不含本行”的模型，但这不等于不含任何非法时间信息。若某些训练日的five-minute feature在bucket start就暴露完整区间，模型会学到一个现实决策时不可获得的关系；它随后在其它合法日期上生成的predictions也继承了这个错误函数。受影响对象因此是整个fold model identity，不只是三天rows。

阈值与head selection还会扩大传播。若研究者根据validation metric选择某个toxicity head、bucket或action threshold，少量高泄漏rows可能改变winner；即使最终test rows本身没有直接lookahead，测试的已经是被非法validation选择过的候选。故障路径可以写成

$$
\text{premature feature}
\rightarrow
\text{fitted function}
\rightarrow
\text{validation ranking}
\rightarrow
\text{selected action}
\rightarrow
\text{test path}.
$$

这也是为什么不能通过“把三天从最终表里删掉”来修复。必须从ready-time feature generation开始重建所有受影响folds，再用新的manifest、cache与model identity执行一次完整的chronological evaluation。

### 一个真正 successor 的最小验收面

第一，逐列声明index、source与ready timestamp，并用边界例子证明左标bucket只有在右端点后可见。第二，训练fold的每一天都必须早于其validation/test decision time，且跨日warmup只能从连续过去读取。第三，13个heads的prediction gate要和action gate分开：AUC/IC/calibration通过只允许进入策略实验，不允许直接报价。

第四，full-path A/B必须只改变冻结的ML treatment；baseline/candidate共享market stream、queue、latency、initial state和随机种子。第五，用day-cluster interval、activity与inventory/tail gates同时判断，避免一个小的mean PnL正值覆盖路径风险。最后，旧v4文件保留为failure receipt，新结果使用新的名字，不能把历史页面原地改成pass。

这些要求使本篇不仅是一份“发现lookahead”的事故记录，也是一份时间序列模型怎样重新获得研究资格的验收协议。

### Feature lineage ledger 应写到什么粒度

每列至少需要：原始source、event object、aggregation window、index convention、ready offset、lookback warmup、missing policy、单位与允许消费它的runtime。对组合feature还要递归列出parents；例如一个五分钟ratio若依赖两个一分钟EMA，它的ready time是所有parents完整后再加计算延迟，而不是沿用输出index。

模型artifact也要绑定ordered feature names与semantics hash。仅检查列数相同无法发现同名字段从left-label改成right-label、秒改毫秒或BUY/SELL符号变化。runtime在任一字段缺失、过期或identity不符时fail closed，不能静默填零后继续给action。

### 一个 leakage sentinel 的设计

可以构造边界合成路径：在bucket最后一毫秒注入只影响未来label的价格跳变。合法feature在bucket结束前不应变化；若$t$时decision已经看到跳变，测试立即失败。对每种window和外部join都应有类似sentinel。

另一个经验检查是把feature整体延迟一个完整window后重新评分。若原模型表现异常高、延迟后骤降，不构成lookahead证明，却是需要审计ready semantics的信号。最终authority仍来自lineage与event-order contract，不是靠相关性猜测。

### Withdrawn metrics 怎样继续服务研究史

旧v4 prediction和PnL数字不再用于current comparison，但failure cause、测试路径与当时权限决定应保留。删除它们会让后人重复同一时钟错误；继续把它们放winner table又会污染选择。

最合适的状态是`withdrawn for current evidence, retained as historical receipt`：正文解释哪些字段失效、哪些correctness lessons仍成立，并指向successor新identity。这样研究透明度与证据卫生可以同时满足。

### 9. 公共证据

- [Causal-v4 Empirical-P3 Retrain and Strict Replay](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v4_empirical_p3_retrain_replay_20260718.md)
- [F03 Causal 13-Head README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/README.md)
- [Causal-v8 Lineage Invalidation，展示后继如何处理来源错误](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v8_lineage_invalidation_20260727.md)

公开报告披露研究合同、修正与撤回边界；模型 bundles、逐行 replay 与 private evidence 不随公共仓库分发。

## 4. v5：Normalized-100ms 重建

### TL;DR：13-head 有预测排序，ML-ON 没有稳定经济晋级；baseline 又确实优于随机生命周期

Causal-v5 把 normalized 100ms L2、修复后的 taker-side、经验 P3、queue q0.70、固定 latency 和 fresh-start replay 绑定成一个新身份，重建 128 个 daily feature files、220 个 features 与 13 个 labels。它同时回答了三个问题：13-head 是否还有 held-panel ranking；ML-ON 相对 ML-OFF 是否改善完整 maker path；当前 baseline 相对一个真正可执行、但随机化 cadence/side geometry 的 passive null 是否有价值。

结果不是一句“模型失败”可以概括。clean ML A/B 在 Validation20 和 Test17 上的 raw/InvAdj point estimates 有些为正，但 paired daily raw 与 terminal intervals 都跨零，fills 只保留约 91%–93%，absolute inventory time 上升。四个 BUY fill-selection scorers 又没有一个同时改善 fill quality、campaign terminal 和 tail。

另一边，随机 passive null 在 Development33 的 raw/terminal point estimate看似略优，却在 Validation9 的 raw PnL 和 InvAdj 显著更差；32 个 seeds 中只有 1 个在 Validation raw PnL 上为正，没有 seed 在任一 panel 的 InvAdj 上胜过 baseline。因此 baseline 相对这个 executable null 有稳定结构价值，但 baseline 本身 PnL 仍为负，不能把“优于随机”写成“已经盈利”。

v5 的正式统计 promotion 没有通过，sealed holdout9 保持未读；随后 time/calendar/unit repairs 又建立 causal-v7 identity。v5 报告中的随机空模型、评分、队列与一致性检查分别回答实现和统计问题，不是独立的收益证据。

![Causal-v5 的 ML OFF、ML ON 与随机被动策略路径](/images/narrowgate/causal-v5-three-arm-kline.svg)

*图 1：机制示意。同一 market path 上，ML-ON 改变 quote geometry；random-passive null 随机化 cadence 与 flat-state side geometry，但保留 queue、latency、cooldown、inventory 和 accounting。图不是实盘 K 线。*

本文只讨论历史研究证据，不建议任何真实交易行为。

### 1. 研究问题与三种比较

第一种比较是 prediction：13 heads 是否在 held panel 上保留方向 AUC、return/volatility IC 与 toxicity ranking。

第二种比较是 action-path：

$$
\Delta Y_d^{ML}=Y_d(ML\text{-}ON)-Y_d(ML\text{-}OFF).
$$

只有 `ml_enabled` 变化，BUY scorer、dynamic-hazard shadow/action 都必须在两 arms 中关闭。

第三种比较是 executable null：

$$
\Delta Y_{d,s}^{null}=Y_{d,s}(random\ passive)-Y_d(baseline),
$$

其中 $s$ 是 32 个冻结 keyed seeds。null 随机化 quote cadence 与 flat-state side geometry，side mirror probability 为 0.5、timing jitter 为 0.35；其他订单生命周期机制不变。

这三个 estimands 不能互相替代。prediction pass 不等于动作价值；baseline 打败 random null 也不等于 baseline 的绝对 PnL 为正。

### 2. 数据与身份

normalized L2、repaired taker-tempo、individual-trade quality、empirical P3、queue reference、formal replay contract 与 latency seeds 被共同绑定。模型 feature split 是：

| Panel | Days | Rows |
| --- | ---: | ---: |
| Train | 86 | 742,998 |
| Validation | 20 | 172,798 |
| Test | 20 | 172,799 |

formal order denominator 是另一套面向 order/campaign estimand 的冻结 split：Development33 有 610,915 placed orders，Validation9；合计 42 日、780,099 orders；sealed holdout9 的 order files 没有交给 scorer。

模型 split 与 order split 不能只用“日期大致重合”合并。前者估计 multi-head prediction，后者估计 fill/campaign action 与 random-null full path；每个结果必须引用自己的 denominator。

### 3. 因果时钟与订单生命周期

features 使用已完成 bucket；individual trades 的 maker side 在受影响日期被重建并通过双侧质量门。L2 统一为 normalized 100ms identity，正式 replay 则继续明确自身的 queue approximation 与 fixed latency sampling。

订单生命周期遵守 submit、activation、queue、partial/full fill、cancel request、cancel ACK 与终局 accounting 的因果顺序。Python/C++ parity 修复了 wall-clock L2 refill/cancel/flip、activation queue rank、Post-Only、adverse-pause precedence、cancel ACK 前 fill、IOC close 与 tick rounding。

一个 concrete example：如果 order 在 cancel request 后、ACK 前被市场成交，replay 必须保留这个 fill；若实现直接在 request 时删除订单，候选 action 会得到过于乐观的 queue reset 和更少 adverse fill。相同输入下的 engine parity 因而是研究 admissibility gate，不是单纯性能 benchmark。

### 4. 13-head prediction 与 clean ML A/B

held diagnostics 中，`dir_10s` AUC 为 `0.5394`，`ret_10s` IC `0.0429`，`vol_10s` IC `0.6552`；30s/60s direction 只略高于随机，volatility ranking 较强，bid/ask 5s toxicity AUC 分别约 `0.5748/0.5764`。

这些数值说明模型学到一些 ranking structure，但没有给出 calibrated action value。

首次 A/B 意外保留 shared dynamic-hazard action overlay，因此只能解释为 conditional comparison。authoritative clean rerun 在两 arms 都关闭 BUY selection 与 dynamic-hazard paths，只切换 ML。

| Clean panel | Raw Δ | Terminal Δ | InvAdj Δ | Fill retention | Inventory-time Δ |
| --- | ---: | ---: | ---: | ---: | ---: |
| Validation20 | +3.5564 | -0.2288 | +4.0734 | 91.46% | +271.2 BTC-s |
| Test17 | +2.1422 | +0.4696 | +1.9945 | 92.64% | +131.4 BTC-s |

paired daily raw 与 terminal intervals 在两个 clean panels 上都跨零。InvAdj 改善伴随更低 participation 与更高 absolute inventory time；因此 13-head bundle 只能保留 research signal 身份，不能获得 unconditional ML action authority。

### 5. Queue sensitivity：为什么不能从 PnL 挑 q

q0.70 是两日 live-conditional calibration reference。sensitivity arms q0.55/q0.85/q1.00 改变 queue-ahead approximation，会系统性改变 fills、campaigns、inventory 与 PnL。

Validation20 上，q0.55 相对 q0.70 增加 659 fills，却让 raw/terminal 分别下降 `10.278/12.072 USDC`；q1.00 少 986 fills，terminal point estimate仅 `+0.078`，InvAdj `-2.443`，tails 增加 8。Test17 的方向又不同。

这不是一个从表格里选“最好 q”的竞赛。queue reference 应由 order/lifecycle evidence 校准；用 PnL 选 q 会把参与、queue truth 与策略 alpha 混在一起。

### 6. Random opportunity diagnostic 与 executable null

提交时机会 audit 发现，实际 fills 在 Development33 与 Validation9 的 BUY/SELL、20s/30s comparisons 上都没有打败随机 opportunity reference，显示强 toxic-selection gap。但这个 reference 不会真的挂单，不能告诉我们随机策略是否会成交或赚钱。

executable null 补上了缺失的反事实。每个 seed 运行完整订单生命周期；没有从 Development 挑 seed，Validation 一次读取同样 32 个 seeds。

Development33 中，baseline raw PnL `-127.3036`，random mean `-124.3251`，delta `+2.9785`，interval `[-22.0778,+28.4772]`；terminal delta `+5.5838`，interval同样跨零。看 point estimate，随机似乎略好。

但 Development InvAdj delta 为 `-2.3969`，interval `[-3.7684,-1.0596]`。Validation9 更明确：raw delta `-8.8534`，interval `[-16.2260,-0.6039]`；terminal delta `-8.4395`，interval `[-15.5517,-0.5297]`；InvAdj delta `-0.5759`，interval `[-1.1946,-0.0192]`。

32 个 seeds 在 Development raw delta 范围约 `-23.04` 到 `+22.43`，21 个为正；Validation 范围 `-16.93` 到 `+4.23`，只有 1 个为正，中位数 `-9.20`。没有 seed 在任一 panel 的 InvAdj 上胜过 baseline。

因此 executable null 被拒绝。正确结论是 baseline 的时序与几何结构优于这组随机生命周期，不是“baseline 已经具备正 alpha”。

### 7. BUY scorers 与 action boundary

四个 BUY exposure-increasing scorers 分别预测 `non_toxic`、`beats_opportunity`、`campaign_repair` 与联合目标。它们使用 expanding walk-forward Development fits、一日 embargo 与 frozen Validation9，threshold 只从 Development OOF 选择。

部分 high-score buckets 改善 markout，部分改善 terminal point estimate，但没有一个同时改善 fill quality、campaign terminal 与 tail。hit/miss campaigns 还可能重叠，因此 bucket comparison 是描述性 ranking，不是动作 uplift。

四个 scorer 的 direct action gate 全部失败；sealed holdout 仍未读。一个 prediction bucket 不因名称叫 `non_toxic` 就自动拥有 skip/keep 权限。

### 8. 版本为何合并，何时才算新项目

v5 report 内的 feature rebuild、replay parity、random null、queue sensitivity 与 scorer rebuild 都共享 normalized-100ms/trade-side/formal replay umbrella，因此是同一研究项目的不同问题层。

旧 48/512/1024 parameter arms 在这里被撤回，只是治理清理，不应变成 v5 子文章。随后 calendar、bar-clock、commission、daily-PnL、tick/lot 与 volatility-interface repairs 改变 authoritative identity，形成 causal-v7；那是新 source/semantics contract，不是把 v5 report 的结论改成“后来通过”。

### 9. 关闭、支持与没有获得的权限

支持：normalized input 和 corrected lifecycle 下仍有 multi-head ranking；baseline 明显优于冻结的 executable random-passive null；Python/C++ same-input parity 可建立。

不支持：13-head ML unconditional economic uplift、四个 BUY scorer 的 direct action、通过 PnL 重新选 queue，或 baseline 绝对盈利。

没有获得：model promotion、scorer action、Validation/holdout 重读、shadow 或 live authority。历史 owner-directed operational trial 不等于 statistical promotion，也不描述当前 runtime。

### 深入理解三种比较：prediction、策略 A/B 与 executable null

这项研究同时出现三类问题，必须分开读。Prediction 比较问十三个 heads 能否在 chronological OOF 中优于各自 baseline；ML-ON/OFF 比较问冻结 mapping 是否改善完整 maker 路径；random opportunity diagnostic 则问当前 runner 与生命周期是否至少能区分真实策略和不带信息的随机动作。

它们之间不是简单的逐级“通过证书”。Prediction fail 会阻止声称模型已学到完整状态；prediction pass 也不保证 mapping 有价值。Executable null 若异常，则说明 replay 或 attribution 不能成为经济证据；null 正常也只证明实验装置有基本分辨率，不会使 ML-ON 自动有效。

![13-head 的 prediction 与 economics 双重 joint gate](/images/narrowgate/f03-thirteen-head-evidence-pipeline.svg)

*图 2：十三个 heads 的校准与 full-path 经济路径是两层独立门；随机生命周期对照只校验装置，不产生 alpha。*

### Queue sensitivity 为什么只能做机制敏感性

设某次 placement 前方 queue 为 $q_0$，成交过程由 aggressive volume、cancel-ahead 与价格跳动共同消耗。若 replay 把 $q_0$ 乘以敏感性系数 $c$，得到的 fills 与 PnL 会变化；但不同 $c$ 对应不同的未观测撮合世界，不是策略可以选择的动作。

因此从 $c\in\{0.5,1,2\}$ 中挑 PnL 最高者，相当于按结果选择“市场曾经怎样排队”，而不是找到更好的策略。Queue sensitivity 的合法用途是检查结论是否对合理 calibration 范围稳健：若 ML-ON 只在一个极端 $c$ 下为正，应该降低证据等级；不能把那个 $c$ 设为 winner。

真正的 action 必须是 maker 能实施的 KEEP、CANCEL、REENTER、WIDEN 等，并在同一 queue calibration 下 paired replay。市场机制参数与策略参数必须是不同类型。

### 为什么 baseline 优于随机生命周期仍然重要

随机 opportunity control 刻意破坏状态—动作对应关系，同时保留大体 action rate。若真实 baseline 与随机策略没有区别，可能意味着 runner 没有执行 action、reward attribution 太稀疏，或策略本身只是在随机采样。baseline 明显优于随机 null 说明当前 maker 结构包含可重复机制，也说明完整 replay 对路径差异有分辨率。

但这是一条较弱结论：

$$
V(B_0)>V(\pi_{random})\not\Rightarrow V(\pi_{ML})>V(B_0).
$$

它排除“所有策略都一样”的极端解释，却不能替 ML candidate 补上相对 baseline 的置信下界、tail 与 side gates。v5 因此同时保留了 baseline 有结构和 ML 无晋级两条结论。

### 三类比较各自排除什么解释

Prediction comparison排除“模型连未来标签排序都做不到”；它比较proper loss、AUC/IC、calibration与日期稳定性，却不包含下单反馈。ML ON/OFF full-path comparison排除“预测改善在既定映射下没有任何策略效应”；它让库存与订单递归分叉，但结果同时混合model、mapping与execution。Executable null则排除“baseline只因为挂得久或交易得多才看起来更好”；它把机会、寿命或动作频率随机化，检查真实状态逻辑是否提供超越机械参与度的结构。

三者形成的证据关系不是多数投票：

$$
\text{prediction pass}
\not\Rightarrow
\text{mapping pass},
\qquad
\text{baseline>null}
\not\Rightarrow
\text{candidate>baseline}.
$$

当前结果恰好体现这种组合：13-head保留一定排序，clean ML A/B没有稳定晋级，baseline又明显不是随机生命周期。这不矛盾；它说明系统已有值得保留的结构，而新增模型还没有把结构变成更好的动作。

### Queue sensitivity 应怎样变成可证伪问题

queue quantile从0.55到1.00改变fills与inventory path时，PnL不单调，说明它不是一个可以在同一回放上按收益选择的自由超参数。正确用途是外部calibration：用独立的activation-to-fill轨迹检验不同quantile对fill timing、partial quantity与cancel-ahead的coverage，然后在结果出现前冻结一个queue identity。

如果多个queue assumptions都符合外部数据，策略结论还应对这组plausible identities做robustness，而不是选PnL最高者。可以要求candidate effect在集合$\mathcal Q$内保持方向：

$$
\inf_{q\in\mathcal Q}\Delta V(q)>0.
$$

若只在某个极端queue设定下为正，最诚实的结论是对执行假设敏感。这样queue study提供的是identified set，而不是另一个回测调参维度。

### 为什么阴性经济结果仍推动了研究

revalidation把两个常见借口分开了。模型没有完全失去预测排序，所以不能简单说“ML不行”；baseline优于random null，所以也不能说“所有报价生命周期都一样”。失败更集中在prediction-to-action接口、状态支持和full-path价值门。

这使后续研究从“再训练一个更高AUC的bundle”转向更窄的action estimand：在明确inventory role、quote coordinate与counterfactual baseline下，预测哪些局部动作真正改善terminal campaign value。研究关闭的是当前clean A/B identity，不是继续建模的理由。

### 十三个输出为什么不是一个统一“市场方向分数”

direction heads输出分类概率，return/volatility heads输出不同单位的连续量，toxicity或fill-related heads又有自己的条件总体。把它们标准化后相加会隐藏单位与loss差异；报价器必须明确每个head如何进入center、width、permission或diagnostic。

一个safe ABI应给每个output附带`estimand`、`unit`、`horizon`、`side convention`、`ready_time`与`valid`。例如absolute-price variance可以进入risk formula，dimensionless return probability不能在没有映射时替代；toxicity ranking可以触发研究action，却不能伪装成fill probability。

### Executable null 应保留哪些机械量

随机生命周期如果同时减少active time、requotes与fills，baseline胜出可能只因为参与更多。更强的null应尽可能匹配eligible opportunities、side/role mix、订单寿命或action rate，只随机化state-to-action关联。匹配越多，越能排除纯机械解释；但也不能通过post-treatment matching删除真实作用路径。

可以分层建立null ladder：随机decision、随机同日同side、随机同role/age bucket，最后action-matched control。每一层回答更窄问题。baseline持续优于这些null，说明状态逻辑有结构；它仍不证明新增13-head mapping超过baseline。

### 从 revalidation 到可部署 bundle 的缺口

除prediction与full-path gates外，还需runtime parity、latency budget、missing fallback、resource envelope和monitoring。任何head在live不可及时生成，都不能用离线100ms分数替代；任何invalid state都应回baseline而非默认风险低。

最重要的是新action证据必须独立于model选择面板。revalidation可以保留模型作为research artifact，却不授予部署。将“模型存在”与“模型被策略消费”拆开，正是这项研究留下的系统边界。

### 10. 公共证据

- [Causal-v5 Normalized-100ms Revalidation](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v5_normalized100ms_revalidation_20260725.md)
- [Causal-v5 Revalidation Registry](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v5_revalidation_registry_20260725.md)
- [F03 README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/README.md)

公共文档给出聚合结果、withdrawal registry 与权限；逐单 traces、model bundles 和完整 reports 不随公共仓库分发。

## 5. v9：Taker Tempo

### TL;DR：预测排序存在，正式三日的 maker value 全面反向

Causal-v9 在一个容易被忽略的失败之后诞生。v8 曾从 mutable `trade_features` workspace 读取 taker-tempo sidecars，其中 2026-07-04 至 07-11 的旧文件把 individual trades 全部分到同一 taker side，并且 133 日中有 90 日的 interarrival derivatives 与冻结 source 不一致。v8 在任何 prediction、replay 或 live use 前被整体判 invalid；替换八个文件不能修复已经拟合的模型。

v9 重新冻结 133 个 good days、corrected taker-tempo manifest、normalized 100ms L2、经验 P3、q0.70 queue reference、fixed latency 与 C++ daily-fresh-start replay。唯一经济 arm difference 是 `ml_enabled`；BUY selector 与 dynamic-hazard actions 在两 arms 都关闭。

13-head 在 Test5 仍显示一些 ranking：10s direction AUC `0.5563`，10s return IC `0.0623`，10s volatility IC `0.5940`，bid/ask toxicity 也高于随机。但 formal replay 因 source coverage 只剩三天，ML-ON 相对 ML-OFF raw PnL `-2.2308 USDC`、terminal campaign `-2.6268 USDC`、tails `+3`，三天 raw delta 全为负；原 gate 要求至少四个 formal days。

候选减少 inventory time、保留 97.70% fills，却同时损失价值并增加 tails。这是一种风险/参与 tradeoff，不是 executable alpha。v9 不 promotion、不部署，ML-OFF corrected baseline 保持 reference。

![Taker tempo 从交易事件到 10 秒模型再到 maker path](/images/narrowgate/causal-v9-taker-tempo-kline.svg)

*图 1：机制示意。aggressive trade tempo 只能在 parent/event ready 后进入 completed 10 秒 bucket；ML-ON 改变报价后，价值必须由完整 fill、inventory 与 campaign path 判断。*

本文只讨论历史研究 evidence，不建议任何真实交易行为。

### 1. 研究问题

taker tempo 包含同侧 aggressive run、count、notional、interarrival 与流向 persistence。直觉上，连续 aggressive SELL 可能让 BUY maker 更容易被 adverse fill，反之亦然。

但 predictive clue 需要经过两个转换才可能成为 alpha：

$$
\text{causal taker state}
\rightarrow \text{13-head prediction}
\rightarrow \text{quote path and campaign value}.
$$

v9 研究因此同时问：corrected tempo features 是否保留 held ranking；ML-ON 是否相对 ML-OFF 提高 raw/terminal PnL并不恶化 tails；formal denominator 是否足够支持 deployment inference。

### 2. 输入、动作与 estimand

输入 universe 有 133 个 UTC good days through 2026-07-25。features 使用 semantics v5，`feature_ready_ts=bucket_start+10s`；corrected taker-tempo、normalized L2 与 empirical P3 各自绑定 manifest。

13 heads 覆盖：

$$
\{dir_h,ret_h,vol_h\}_{h\in\{10,30,60\}s}
$$

以及 bid/ask toxicity heads。prediction metrics 包括 AUC、IC 与 calibration diagnostics。

full-path arms 是：

| Arm | 13-head | BUY selector | Dynamic hazard action | 其他机制 |
| --- | --- | --- | --- | --- |
| ML OFF | disabled | disabled | disabled | 冻结相同 |
| ML ON | causal-v9 | disabled | disabled | 冻结相同 |

primary economic estimand 为：

$$
\Delta_d^{raw}=PnL_d^{ON}-PnL_d^{OFF},
\qquad
\Delta_d^{terminal}=C_d^{ON}-C_d^{OFF}.
$$

同时检查 fill retention、absolute inventory time、tail campaigns 与 positive-day count。降低 inventory time 不能补偿 value/tail hard gate。

### 3. Causal maker-side mapping

taker feature 必须按 maker side 翻译。BUY maker 的直接对手是 aggressive SELL taker；SELL maker 的对手是 aggressive BUY taker：

```text
BUY maker  <- aggressive SELL taker
SELL maker <- aggressive BUY taker
```

若把 raw BUY-taker flow 直接当作 BUY maker adverse input，就会把经济方向翻转。v8 sidecar corruption 更严重：部分日期所有 trades 只有一个 taker side，模型能够学到文件缺陷而不是市场结构。

aggregate trade message 还可能包含一组 child trade IDs。单个 child 的 exchange timestamp 可用于历史 matching truth，却不能让 live policy 在 parent message ready 之前看见整组内部次序。v9 的历史 feature contract虽纠正 sidecar 来源，仍然只赋予其自身 10 秒 aggregate causal semantics，不把它升级为 exact subsecond receive-time truth。

### 4. v8 修复了什么

v8 从 mutable root 解析数据，训练前没有冻结正确 source lineage。它不具备有效的 sample/feature identity，因此没有资格产生经济 inference。项目将 artifacts 标记 invalid，明确禁止引用任何 v8 prediction 或 PnL。

这与“候选在有效 Development 上得分为负”不同。前者是证据身份失败，后者才是科学阴性结果。v8 应作为 v9 的 lineage 章节，说明为什么新 manifest 必要，而不是独立包装成一次实验。

v9 在拟合前冻结 133-day manifest 与 corrected tempo hash，避免在看到 v8 outcomes 后只替换几天并继续沿用模型。

### 5. Chronological split 与 formal amendment

| Panel | 日期角色 |
| --- | --- |
| Train106 | through 2026-06-28 |
| Embargo | 2026-06-29 |
| Validation20 | 2026-06-30 through 07-19 |
| Embargo | 2026-07-20 |
| Test5 | 2026-07-21 through 07-25 |

原 formal panel 计划使用四天。loader 在产生 arm outcome 前发现 2026-07-24 normalized L2 coverage 只有 `97.8925%`，最大 gaps 约 744.7s、675.3s 与 415.8s；重新下载对应 source hours 后 bytes 相同，说明是 provider source gap，不是本地下载损坏。

amendment 在任何 arm outcome 生成前冻结：07-21、22、23 为 formal；07-24 diagnostic；07-25 因 required prior-day context 不合格也只能 diagnostic。这样改 denominator 是 outcome-blind source admission，不是看见 PnL 后删日。

三天仍少于原四日 gate，所以即使经济指标为正也不能通过 denominator requirement。

### 6. Prediction diagnostics

模型在 915,796 train rows 上拟合，在 43,200 Test5 rows 上评估。选定 metrics：

| Head | Test5 metric |
| --- | ---: |
| 10s direction | AUC 0.5563 |
| 10s return | IC 0.0623 |
| 10s volatility | IC 0.5940 |
| 30s direction | AUC 0.5219 |
| 60s direction | AUC 0.5195 |
| bid toxicity 5s | AUC 0.5849 |
| ask toxicity 5s | AUC 0.5629 |

这些是 row-level ranking diagnostics。它们没有告诉我们 calibration error 如何映射到 quote ticks，也没有对 BUY/SELL action value 给出反事实。

### 7. Formal Test3 与 diagnostic days

Python/C++ parity 在 07-21 完全一致：两者都是 332 fills，PnL difference 为零。

三日 formal aggregate：

| Metric | ML OFF | ML ON | Candidate delta/ratio |
| --- | ---: | ---: | ---: |
| Raw PnL | -0.6571 | -2.8879 | -2.2308 USDC |
| Terminal campaign | +3.5311 | +0.9043 | -2.6268 USDC |
| Tail campaigns | 2 | 5 | +3 |
| Fills | 999 | 976 | 97.70% retained |
| Absolute inventory time | 499.71 | 454.03 | 90.86% |

每日 raw deltas 分别为 `-0.3379`、`-1.7475`、`-0.1453 USDC`；terminal deltas 也全部为负。候选降低 inventory time，却没有将其转化为 terminal/tail protection。

两个 diagnostic days 合计 raw `-0.8231`、terminal `-0.8827 USDC`。07-24 明显更差，07-25 只有 raw `+0.0043`、terminal `+0.0067` 的极小改善。把 diagnostic 与 formal 池化会违反 source gate，故只能作为方向说明。

### 8. Deployment gates 与不确定性

formal denominator 3<4；raw/terminal deltas 均失败；tail +3 失败；positive raw days 0/3 失败。fill retention 与 inventory-time ratio 通过，不能补偿 hard failures。

只有三天也不适合宣称一个稳定置信区间。这里最有力的不确定性信息是所有 formal daily signs 同为负，同时 denominator 本身不足。项目没有在读 Test5 后调 threshold、calibrator 或 feature list。

降低 inventory time 是真实机制，但它与价值损失和 tail 增加同现。风险控制指标不能脱离经济终局单独 promotion。

### 9. 关闭、支持与没有获得的权限

支持：corrected taker-tempo 能产生有限 prediction ranking；ML path 确实改变 fills 与 inventory；same-input parity 在代表日成立。

关闭：causal-v9 13-head bundle 作为 ML-OFF baseline replacement。v8 artifacts 永久 invalid，不可通过更名复活。

没有获得：model promotion、deployment、queue retuning、action、Validation/holdout、shadow 或 live authority。后继若继续 13-head，需要新的 fixed-forward/action-value estimand，而不是继续优化相同 AUC。

### 深入推导：tempo ranking 与 maker 动作之间隔着 treatment effect

Taker tempo 可以预测短时价格或 adverse fill 风险。以 BUY maker 为例，对手方是 aggressive SELL taker；更短 interarrival、更长同向 run 或更高 notional 可能对应更强向下压力。模型若能排序坏状态，说明：

$$
E[Y_0\mid score\ high]<E[Y_0\mid score\ low],
$$

其中 $Y_0$ 是 baseline 下的结果。但动作研究需要的是：

$$
E[Y_1-Y_0\mid score\ high]>0,
$$

这里 $Y_1$ 才是 widen、skip、cancel 等候选路径。第一式是 prognostic risk，第二式是 conditional treatment effect；它们可以一正一负。高风险状态中，撤掉 BUY 也可能错过最快的 reducing 或 repair 机会。

![十三头 prediction ranking 到 maker action 的完整证据链](/images/narrowgate/f03-thirteen-head-evidence-pipeline.svg)

*图 2：tempo head 通过排序只到达 prediction gate；冻结报价 mapping 与完整路径仍可能反号。*

### 为什么 BUY/SELL 映射不能靠统一符号解决

市场原始流有 BUY taker 与 SELL taker，maker 决策又有 BUY quote 与 SELL quote。BUY maker 的直接对手是 SELL taker，SELL maker 的直接对手是 BUY taker；但“away flow”对库存修复的影响还取决于当前持仓与订单角色。

例如当前为 short inventory，SELL add 会继续加空，BUY reducing 则帮助 flat。相同的 aggressive BUY taker burst 对 SELL add 可能是 adverse continuation，对 BUY reducing 却可能提高修复成交机会。若只给 trade feature 乘一个 side sign，再把 opener/add/reducing 混合，模型会把风险和机会平均。

所以 side-specific 不只是训练两个模型，还要冻结 maker-side counterparty mapping、order role、inventory sign 与 reward。没有实际 action overlap 的 role 只能写 `diagnostic_only`。

### Formal Test3 反号应怎样解释

正式三日中 maker value 全面反向，不意味着 tempo 完全没有预测信息。更准确的解释是：冻结 v9 mapping 在声明的测试日期没有把 prediction ranking 转化为正经济路径。可能原因包括 conditional fill value 与方向信号不同、模型集中减少有利 fills、queue/latency 稀释短时信号，或三日 regime 与训练不同。

三日样本也不足以把每个解释精确分离，所以不能继续在同一 Test3 上改窗口、阈值或 side mapping。正确 stop decision 是关闭这个 exact inference identity，并把诊断线索留给新的、不同动作语义；不是从反号结果中挑一个新阈值继续试。

### Taker tempo 与 maker value 中间缺少哪几个条件概率

tempo head预测的是短窗口内主动成交节奏或方向，而maker action关心的是挂单在特定side、price与queue下的终局价值。二者之间至少经过

$$
P(tempo\mid X)
\rightarrow
P(touch\mid tempo,X)
\rightarrow
P(fill\mid touch,queue,tempo,X)
\rightarrow
E[V_T\mid fill,role,tempo,X].
$$

任一箭头都可能反号。快速SELL taker flow会提高BUY quote被触达与成交的概率，但该fill可能是负向延续中的exposure add；同一信号对已有SHORT的BUY repair却可能有利。统一把“SELL flow高”映射为widen BUY，会混合两个inventory roles。

此外，tempo预测改善可能主要来自容易识别的极端burst，而策略动作发生在中等分数、接近阈值的rows。总体AUC通过不保证threshold neighborhood calibration。动作研究应报告policy-weighted calibration与阈值附近support，而不是从全分布ranking推断边际动作价值。

### Formal Test3 全面反向意味着什么

三日不是足以证明长期负效应的大样本，但预注册formal panel在主要maker-value方向上全面反向，足以拒绝当前映射的晋级。因为项目目标是证明一个有正价值的action，证据不足与点估计反向都应导致同一个权限结果：不推广。不能用额外diagnostic days挑回一个有利平均，也不能把prediction pass当作经济门的替代票。

这个失败仍留下可复用信息。它说明taker tempo在预测层不是纯噪声；错误更可能位于side/role mapping、order lifetime或value target。若未来重开，应把action单位改成明确的keep/widen/cancel/recenter，按exposure-increasing与inventory-reducing分层，并用one-shot发现后再做repeated full-path确认。

换句话说，v9关闭的是“当前tempo到maker动作的统一映射”，不是“主动流没有信息”。这是阴性研究能够给出的最精确边界。

### Tempo 至少有三种不可互换的定义

trade count per second衡量消息/成交片段频率，quantity per second衡量成交量，signed notional imbalance衡量方向与规模。一个大单拆成许多children会提高count却不改变总quantity；价格上涨会提高notional即使BTC量不变。burst、run与sweep又涉及连续性和跨level路径。

因此head contract必须写明event identity、聚合窗口、side convention和单位。一个预测count tempo的模型不能直接解释为预测depth exhaustion；一个预测signed notional的模型也不能无条件映射到maker adverse value。

### Threshold neighborhood 才是动作真正消费的区域

若action只在score高于$q_{0.9}$触发，overall AUC由全分布pair ranking构成，大量远离阈值的easy rows会主导。真正需要的是阈值附近calibration、日期覆盖与policy lift：

$$
E[Y\mid s\in(\tau-\epsilon,\tau+\epsilon),side,role].
$$

但在同一已读面板扫描$\tau$和$\epsilon$会形成新multiplicity。应先用训练fold选阈值，外层chronological fold评价，且unsupported时回baseline。

### Formal 三日反号后的研究纪律

diagnostic days可以帮助解释是某side、role或regime失效，却不能合入主结果救平均。若解释提出了明确新机制，例如tempo只对exposure-add有害，它成为新hypothesis；必须冻结后在新证据上测试。

保留原反号结果还有一个价值：未来模型若宣称改进，应与这条失败路径比较，证明不是通过更弱action、不同clock或删除不利日获得。研究版本连续性让真正的进步可见。

### 10. 公共证据

- [Causal-v9 Retraining and Replay Result](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v9_through_20260725_replay_20260727.md)
- [Causal-v8 Lineage Invalidation](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v8_lineage_invalidation_20260727.md)
- [F03 README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/README.md)

模型、逐日 traces 和 private reports 不随公共仓库分发；公开文档保留 frozen identity、aggregates 和 no-promotion decision。

## 6. v12：Source-aware semantics

### TL;DR：五日 PnL 点估计为正，13 个 prediction gates 只过 5 个，完整经济门仍然关闭

Causal-v12 把 2025 provider-normalized source-aware features、semantics-v6 10 秒 causal cutoff、13-head model 与 2026 native lifecycle replay 连成一条研究链。模型先在 52 个 2025 fit 日和 13 个 chronological selection 日上确定 early stopping，再用 66 日 refit；随后在两组已读 22 日 native panels 做历史 transport，最后使用 2026-07-26 至 07-31 的五个 Grade-A days 做 family-specific post-fit OOS diagnostic。

最后五日的 ML-ON terminal MTM 相对 ML-OFF 改善 `+6.0334 USDC`，平均 `+1.2067 USDC/day`，是一个看起来很有吸引力的点估计。但 day-clustered 95% interval 为 `[-0.2435,+2.5635]`；只有 5/13 heads 通过冻结 prediction transport gate；fills 只保留 `84.20%`，低于 90%；campaign q10/CVaR 恶化，SELL 30s maker value 也失败。

因此 canonical result 是 `close_causal_v12_economic_screen_on_historical_native_panels`，ranking score 为空。五日不是 globally unseen，也不是 sealed holdout；它们曾被 live/F10 diagnostics 使用，只能叫 family-specific post-fit OOS diagnostic。

这项研究说明：positive PnL point estimate、良好 ranking 和完整 promotion 是三件不同的事。一个 13-head family 只要绝对概率、volatility scale、participation、tail 或 side gate 失败，就不能靠 pooled PnL 抵消。

![Causal-v12 从 source-aware 训练到 native full-path 经济门](/images/narrowgate/causal-v12-source-aware-native-path.svg)

*图 1：研究链示意。2025 source-aware training 先经过 2026 native prediction transport，再进入 ML OFF/ON 完整回放；任何上游 gate 失败都不能被五日正 PnL 点估计买穿。*

本文只讨论历史 Development/post-fit evidence，不建议任何真实交易行为，也不描述当前部署身份。

### 1. 研究问题

v9 使用 2026 训练与较小 formal test。v12 改变 source、feature semantics 与训练 chronology，希望回答：

> 在不读取 2026 native outcomes 进行 model selection 的前提下，2025 source-aware 13-head 是否能 transport 到 2026，且 ML-ON 相对 ML-OFF 在完整 native maker path 上改善 terminal value、保持 activity 并保护 campaign tails？

这包含 prediction 与 economic 两类 estimands。对 classification head，最低要求可概括为：

$$
AUC>0.5,\qquad BrierSkill>0.
$$

对 regression head：

$$
SpearmanIC>0,\qquad RMSESkill>0.
$$

family-level prediction pass 要求全部 13 heads 满足各自 contract，而不是只看 median AUC。

经济 primary estimand 为：

$$
\Delta_d=TerminalMTM_d(ML\text{-}ON)-TerminalMTM_d(ML\text{-}OFF).
$$

day-cluster lower bound 必须大于零，同时满足 fill retention、inventory ratio、campaign q10/CVaR 与 side maker-value noninferiority。

### 2. 输入、动作与模型身份

features 使用 semantics v6 与 `live_10s_signal_cutoff.v1` DAG。13 heads 包含 10/30/60s direction、return、volatility，以及 bid/ask 5s/10s toxicity。

source-aware 并不意味着“把外部来源当 live alpha”。source identity 和 transport diagnostics 被严格区分；model bundle 本身没有 action/live authority。

full replay arms：

| Mechanism | ML OFF | ML ON |
| --- | --- | --- |
| 13-head | disabled | frozen v12 bundle |
| Empirical P3 | shared | shared |
| Native queue/lifecycle | shared | shared |
| q90 action | OFF | OFF |
| BUY fill selection | OFF | OFF |
| Latency/cooldown/inventory/accounting | identical | identical |

因此 arm difference 聚焦于 13-head outputs 如何改变 quote path，而不与其他 policy overlays 混淆。

### 3. 训练 chronology

2025 训练 Spec 冻结 52 fit days、1 embargo day 与 13 selection days。inner chronological early stopping 只使用过去 tail，不在 outer/native panels 上调超参数；随后在 66 日 refit。

可以把 selection 写成：

$$
\hat m=\arg\min_{m\in\mathcal M}L_{selection}(m;D_{fit}),
$$

随后：

$$
\hat f=Fit(D_{fit}\cup D_{selection};\hat m).
$$

2026 external/native panels 在 fit 期间未读，calibrator 也没有利用它们拟合。这里的 `selection` 是训练内部模型选择，不是 action Validation。

### 4. Native historical panels 与证据角色

两组 22 日 2026 native panels 分别标记为 historical native transport Development 与 historical native late diagnostic。它们已经被历史研究读取，不能被包装成 independent confirmation。

后继 post-fit 日期 07-26 至 07-31 没有进入 v12 的 66 日训练，也没有进入前两个 22 日 panels。source audit 检查六日、15 sources 的 90 个 availability cells，全部通过；native L2 sequence reconstruction 在六日都通过。

质量 split：五个 Grade-A days 的 coverage 约 `99.996%–99.997%`，maximum internal gap `2.571–3.768s`；07-28 coverage `99.3460%`、maximum gap `419.735s`，只作为 Grade-B sensitivity，不能救 primary gate。

这些日期不是 globally untouched，因为其他 family/operational diagnostics 曾用过。正确证据名称是 family-specific post-fit OOS diagnostic。

### 5. Prediction transport

13 heads 中只有 5 个通过预冻结 gate。classification median AUC 为 `0.528418`，但七个 classification heads 只有两个 Brier skill 为正；`dir_10s` 与 `tox_ask_10s` 通过，多个 direction/toxicity heads 的 absolute probability transport 失败。

六个 regression heads 都保留正 ranking direction。三个 return heads 的 RMSE skill 仅微弱为正；三个 volatility heads ranking 很好，却有 negative RMSE skill，说明顺序尚可、绝对尺度不 transport。

standardized feature shifts 中，`oi_log` 约 `+8.45`、`close` 约 `-4.02`、cross-venue perp basis 约 `+3.41`。模型可以在 distribution shift 下保持 rank，同时产生错误的 probability/scale；quote core 往往需要后者，不能只凭 AUC/IC 使用。

### 6. Full-path ML OFF/ON 结果

| Metric | ML OFF | ML ON | Candidate result |
| --- | ---: | ---: | ---: |
| Terminal MTM | -11.6080 | -5.5746 | +6.0334 USDC |
| Mean daily delta |  |  | +1.2067 USDC/day |
| 95% day-cluster interval |  |  | [-0.2435,+2.5635] |
| Positive days |  |  | 3/5 |
| Fills | 1,468 | 1,236 | 84.20% retained |
| Inventory-time ratio |  |  | 1.0270 |
| Closed campaigns | 426 | 324 | diagnostic |
| Campaign q10 | -0.16564 | -0.19310 | worse |

ML-ON 改善 pooled terminal point estimate，也减少 aggregate multi-level LONG/SHORT losses。但 lower bound 仍为负，说明五日 uncertainty 不能排除无改善；fills retention 又明显低于 90%，候选很大一部分“改善”可能来自减少参与。

inventory-time ratio 尚在 1.05 budget 内，却无法补偿 q10/CVaR 与 SELL maker-value failures。hard gates 在 ranking score 之前，故 ranking score 必须为 null。

### 7. 一个正点估计为什么仍不能晋级

若只看 total delta，`+6.0334` 很容易被描述成成功。可是五日 mean 的 interval 跨零，3/5 positive-day rate 也说明结果依赖少数日期。

更重要的是 activity 与 tail。候选少 232 fills、少 102 closed campaigns；如果 deleted fills 中既有 toxic fills也有 repair fills，仅看总 PnL 不能证明选择性。campaign q10 从 `-0.16564` 恶化到 `-0.19310`，说明较差尾部并未得到保护。

SELL 30s maker value failure 又阻止 pooled BUY improvement 掩盖另一 side。maker action 的权限必须 side-specific；一个 family-wide score 不能买穿失败 side。

### 8. 版本、Specs 与执行文件为何合并

training Spec、native transport Spec、full-path Spec、post-fit Spec 与 Development report 定义同一个 causal-v12 research program 的不同 evidence stages。它们分别冻结 source/model、prediction panels、economic arms 与 post-fit denominator，不是五个博客项目。

随后大量 1s feature generator、schema、C++ parity、overlay binding、batch、materialization 与 execution amendments 属于另一个明确问题——1 秒 cadence successor——应单独成文；普通 executor fix 不应把 v12 变成虚构的研究版本序列。

### 9. 关闭、支持与没有获得的权限

支持：部分 heads 保留 ranking；ML-ON 在五日有正 terminal point estimate；native replay 能产生完整 campaign/economic diagnostics。

关闭：当前 10 秒 source-aware causal-v12 historical economic screen。结果不支持把历史 canary 叙述成通过 prediction/economic gates。

没有获得：prediction family pass、model/action promotion、Validation、sealed holdout、shadow 或 live authority。任何后继必须建立新 model/estimand，而不是在已读 panels 上调 calibrator、threshold 或 feature list。

### 深入推导：十三个 heads 为什么必须使用 joint gate

如果研究预先声明十三个 heads 共同构成 inference bundle，那么整体身份不能用“至少几个表现不错”定义。每个 head 的 base rate、loss 与经济用途不同；一个 failed volatility head 可能错误缩放 spread，一个 failed fill head 可能错误决定 participation，一个 failed direction head 可能偏移 center。

设通过事件为 $G_j$。完整 bundle 的 prospective gate 是：

$$
G_{bundle}=\bigcap_{j\in J_{required}}G_j.
$$

观察到 5/13 通过，说明部分预测对象有增量，却不满足交集。事后把 required set 缩成这五个，会把 Development 变成 feature selection panel；若想研究 five-head successor，必须重新冻结 mapping、面板与多重性，而不能把它写成 v12 原本就通过。

![十三头 joint gate、冻结映射与完整经济路径](/images/narrowgate/f03-thirteen-head-evidence-pipeline.svg)

*图 2：共享模型的局部成功不能抵消 required head 的失败；经济正点估计也不能越过 prediction joint gate。*

### 五日 PnL 正点估计为什么证据仍然弱

五日 paired PnL 为正，可以说明 candidate 值得解释，但日级有效样本仍是五，而不是日内数百万 rows。若 daily deltas 为 $\Delta_1,\ldots,\Delta_5$，不确定性取决于日期间波动和 regime，而不是 tick 数：

$$
SE(\bar\Delta)\approx \frac{s_{day}}{\sqrt5}.
$$

任何单日都可能强烈影响均值；leave-one-day-out 旋转、side 反号或 tail harm 都不能被 pooled point estimate 掩盖。更何况 quote policy 是由多个 heads 联合驱动，正 PnL 无法告诉我们是哪一头贡献，也可能来自较低 participation。

所以这组结果最多支持“source-aware bundle 具有后续研究价值”，不支持“v12 已验证 alpha”。若继续，必须先冻结 required heads 和 mapping，再用较长 chronological panel 检查 simultaneous lower bound、side/role、fill retention 与 campaign tail。

### 从 prediction transport 到 inference contract

模型 artifact 不只是权重文件。一个可复核 inference identity 还应绑定 feature schema、normalizer、缺失值语义、head 顺序、calibration、decision cadence、fallback 与 quote mapping。相同权重在 1 秒与 10 秒 cadence、不同 stale-age cutoff 或不同 missing fallback 下，会产生不同订单路径。

v12 的 source-aware 价值之一，是把 source identity 与 feature readiness 写入训练；但若 downstream mapping 没有同样强类型绑定，transport 仍会漂移。文章把 train spec、postfit、native A/B 和 amendment 合在一起，正是为了让读者看到完整 contract，而不是把一个 `.json` 权重包当作全部研究。

### 十三个 heads 的 joint gate 为什么不是过度保守

十三个targets不是十三张独立彩票，而是同一个报价器将使用的联合状态描述。若只选通过的五个heads，需要在看到结果后重新定义模型bundle与映射；新组合已经是一个outcome-informed candidate。原合同要求joint prediction transport，目的不是宣称每个head同等重要，而是防止研究者事后从相关targets中挑出最漂亮者。

heads之间高度相关也不意味着可以忽略失败。相关性会减少“十三次完全独立检验”的夸张，但失败可能集中在对动作关键的toxicity或volatility维度。更好的successor做法是在结果前定义一个较小的必要head集合，或预注册组合loss：

$$
L_{bundle}
=
\sum_{j=1}^{13}w_jL_j,
\qquad
w_j\ge0,
\quad\sum_jw_j=1,
$$

并同时保留每个关键head的hard safety gate。权重必须来自动作语义或旧训练资料，不能按本次test表现调。

### 五日经济结果的分辨率

五个formal days的正点估计只说明在这五条市场路径上candidate总和更高。日级相关、campaign clustering与少数大尾部意味着row-level标准误毫无意义；即使五天全部同号，仍难区分持续效应与单一regime。日期bootstrap在$D=5$时也只有很粗的经验支持，interval的端点高度依赖有限日组合。

所以本项目同时要求prediction gates、full-path value、activity/inventory与tail，而不是让PnL点估计单独裁决。若模型通过5/13 heads、PnL正但区间和风险门不闭合，正确结论是“存在后继假说”，不是“差一点就该上线”。

下一步若重开，应优先扩充冻结的chronological independent days，并把inference contract缩到被动作真正消费的features。只有在新days上同时保持prediction transport与paired terminal improvement，source-aware 13-head bundle才可能从研究资产升级为action input。

### Source-aware 模型为何仍可能学到年份标签

当provider与native日期几乎分属不同年份，source flag、calendar regime、volatility与market structure纠缠。即使模型没有显式source feature，它也可能从spread、message rate或session pattern识别时期。跨来源OOF必须按chronology测试，而不是随机打散rows。

理想设计包含overlap-day measurement parity、earlier→later temporal transport与native-only sensitivity。若只有混合训练后的五日结果，无法区分旧数据带来可迁移representation还是把模型拉向过去regime。五日点估计为正不足以解决这个识别问题。

### Joint gate 可以怎样兼顾必要性与可解释性

先把heads分为动作必需、安全必需与diagnostic三组。动作必需heads决定quote，必须各自通过；安全必需heads即使不提高平均PnL也不能恶化关键calibration；diagnostic heads失败不应阻断未消费它们的action，但也不能被宣传为bundle整体成功。

分组必须在结果前写进ABI。若当前bundle把13个heads全部作为同一candidate identity，看到5个通过后再声称其它8个“不重要”，等于事后创建小bundle。新的小bundle可以研究，但要使用新日期和新mapping。

### 五日结果如何规划样本，而不是提供权限

可以用观察到的day-level dispersion估计下一次研究需要多少独立日期才能分辨业务最小效应，但不能把同一五日反复bootstrap当成新增信息。样本规划应保留regime覆盖、连续日依赖与source Grade，而不是只按IID公式。

五日正点估计最合理的用途是形成一个优先级：如果模型/动作链在工程上值得继续，可预注册更长native panel；若新日未保持方向，就关闭。它不是以“方向先验”为由降低后续门槛的许可证。

### 10. 公共证据

- [Causal-v12 Post-Fit Native OOS Diagnostic](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v12_postfit_native_oos_20260726_31_20260802.md)
- [Source-Aware Semantics-v6 Training Spec](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v12_expanded_source_aware_semantics_v6_train_spec_20260802.json)
- [Native Full-Path ML A/B Spec](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v12_native_full_path_ml_ab_spec_20260802.json)
- [F03 README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/README.md)

model bundles、native reports 与逐日 rows 不随公共仓库分发；公开材料保留 identities、aggregates 与关闭决定。

## 7. 一秒 cadence successor

### TL;DR：1 秒更新减少了 fills，却增加库存时间并恶化 campaign tails

把 13-head cadence 从 10 秒缩短到 1 秒，看起来应该更快吸收市场变化。NarrowGate 没有把这个直觉当作结论，而是冻结完整 1-second full-schema model/policy，与当时的 v9 10-second ML-ON control 在同一 40-day native Development panel 上运行 full-path A/B。

候选没有通过。terminal MTM 从 `-161.935091` 变成 `-164.052065 USDC`，差 `-2.116974 USDC`；fills 从 `16,959` 降到 `14,758`，只保留 `87.0216%`；absolute inventory time 反而增加 `888.737 BTC*s`。campaign CVaR10、q10 shortfall、inventory-time avoidance 与 maximum-inventory avoidance 的 day-clustered intervals 全部显示显著恶化。

这不是一个 near-pass。1 秒候选降低参与，却没有改善 value，库存暴露和 multi-level LONG tail 还更差。项目因此在 Development 关闭，没有打开 Validation，也没有运行原计划的 71-day continuous confirmation。

结论边界同样重要：它关闭的是这套 1s cadence/model/policy successor，不是证明所有 sub-10-second 模型都有害。更快的时钟会改变 feature distribution、quote churn、fill selection 与 inventory feedback，必须用完整路径而不是 prediction latency 直觉评估。

![1秒与10秒13-head策略在同一K线上的路径差异](/images/narrowgate/causal-v12-one-second-vs-ten-second-kline.svg)

*图 1：机制示意。1 秒模型更频繁更新 quote state，却可能在噪声中反复改变 exposure-increasing path；fills 减少不代表 inventory risk 自动下降。图不是实盘 K 线。*

本文只讨论历史 Development evidence，不建议任何真实交易行为。

### 1. 研究问题

10 秒 feature bucket 有明显延迟：一个刚发生的 shock 最晚要等下一 completed bucket 才能完整进入模型。1 秒 cadence 理论上可以更快更新 direction、volatility 与 toxicity。

但更快并不只改变“响应速度”。它还会改变训练样本相关性、label horizon 与 decision cadence 的比例、模型输出 jitter、requote/cancel、queue position 和 inventory path。因此研究问题是：

> 保持 quote/execution ABI、P3、queue、latency、cooldown、inventory 和 accounting 不变时，完整 1s full-schema ML policy 是否相对 10s ML-ON control 提高 terminal/campaign value，并满足 participation 与 tail gates？

### 2. 输入、动作与 estimand

control 是 v9 10-second ML-ON policy；candidate 是 retrained 1-second full-schema ML-ON policy。它们不是同一 model 的一个 cadence flag，而是两个完整 model/policy identities。

shared mechanisms：empirical P3 v2、q90 action OFF、BUY fill-selection OFF、相同 quote/execution ABI、latency、native queue、cooldown、inventory rules 与 accounting。

primary estimand：

$$
\Delta_d=TerminalMTM_d(1s)-TerminalMTM_d(10s).
$$

同时报告：

$$
\Delta CampaignValue,quad FillRetention,quad
\Delta InventoryTime,quad
\Delta q10,quad \Delta CVaR10.
$$

tail 指标被写成 protection/avoidance direction；负值意味着候选更差，而不是因为符号命名被误解为“损失更负所以更安全”。

### 3. 数据与因果时钟

formal denominator 是冻结的 40-day native Development panel。每个日 fresh start，策略 state、book、individual trades、queue 与 lifecycle 在同一 native replay contract 下运行。

10 秒 control 的 feature 在 completed 10s bucket ready 后更新；1 秒 candidate 使用 completed 1s features。两者都不能在 bucket 结束前看到未来 events。

1 秒 cadence 增加了相邻 rows 的高度相关性。虽然 row 数大幅增加，统计 cluster 仍然是 UTC day；不能把每秒 prediction 或 decision 当作独立 observation 来获得虚假的窄 interval。

| 层级 | 10s control | 1s candidate |
| --- | --- | --- |
| Feature update | 每 completed 10s | 每 completed 1s |
| Model/policy | v9 10s | 1s full-schema retrain |
| Native lifecycle | shared | shared |
| Statistical cluster | UTC day | UTC day |
| Panel | 同一 40 Development days | 同一 40 Development days |

### 4. 为什么执行完整性不等于经济成功

这项研究为 bound surfaces 建立了 173-field feature parity、zero Python/C++ feature mismatches、zero fill-path mismatches、identity/hash parity 与低于 `2.8e-13 USDC` 的 campaign accounting error。

这些 gates 证明实现按声明运行，不能证明策略有价值。另一些 surfaces——prediction-output parity、tick/GTX/spread-cap parity——没有被该 runner 绑定，因此也不能从“总体 parity passed”外推为已证明。

研究先保证结果不是明显 implementation mismatch，再读取 economics。执行器的一系列 feature generator、label schema、C++ batch、overlay binding、materialization 与 execution amendment 都服务这一条 research identity；普通 bug fix 与 execution attempt 不会生成新科学问题。

### 5. 一个更快却更危险的机制例子

假设价格在几秒内上下摆动，10 秒 control 只在 bucket 完成后做一次平滑响应。1 秒 candidate 则可能在第 1、2、3 秒连续改变 direction/volatility state，反复调整 exposure-increasing quote。

若这些短时变化主要是 microstructure noise，candidate 会更频繁 cancel/replace、丢失 queue，减少某些自然 fills；一旦仍发生 exposure-increasing fill，后续库存偏斜与 cooldown 又可能让 reducing path 更慢。

因此 fills 下降和 inventory time 上升完全可以同时发生：交易次数少了，但留下的 campaign 更难修复、持仓更久。只有 full-path campaign accounting 能看见这一反馈。

### 6. 冻结结果

| Metric | 10s control | 1s candidate | Candidate minus control |
| --- | ---: | ---: | ---: |
| Terminal MTM | -161.935091 | -164.052065 | -2.116974 USDC |
| Terminal MTM/day | -4.048377 | -4.101302 | -0.052924 |
| Closed-campaign value | -162.123791 | -163.690165 | -1.566374 USDC |
| Fills | 16,959 | 14,758 | -2,201 |
| Fill retention | 100% | 87.0216% | -12.9784 pp |
| Inventory time | 5,327.642 | 6,216.379 | +888.737 BTC*s |

terminal-MTM mean difference 的 95% day-cluster interval 是 `[-1.106631,+1.005055] USDC/day`，19/40 days positive。点估计与区间都不支持 value improvement。

tail/lifecycle 更明确：campaign CVaR10 protection `-0.176559/day`，interval `[-0.294295,-0.066028]`；q10 shortfall protection `-0.059563/day`，interval `[-0.091067,-0.029543]`。

inventory-time avoidance `-22.218436 BTC*s/day`，interval `[-34.376329,-8.407483]`；maximum-inventory avoidance `-0.000975 BTC/day`，interval `[-0.001700,-0.000150]`。multi-level LONG terminal value 从 `-63.237078` 恶化到 `-93.231090 USDC`。

### 7. 不确定性与 stop decision

primary terminal interval 跨零本身已经不允许晋级；tail 和 inventory intervals 又完全位于 harmful direction。即使把 terminal point estimate视为“接近持平”，也无法把显著恶化的 downside protection 忽略。

候选 fill retention 低于常见 90% floor，说明 activity change material。若要声称 selective execution，应证明 avoided-loss share 快于 fill loss，并且 direct paired PnL 与 tail 不受伤；本候选没有满足这些条件。

因此无需打开 Validation 来“再看一次”，也不应启动 71-day continuous confirmation 寻找 favorable aggregate。Development failure 是完成的结果。

### 8. 研究演进与版本合并

1s project 曾产生多份 design、schema、feature generator、trainer、C++ parity、daily batch、source coverage、execution prep 与 amendment 文档。它们共同解决“如何可信地执行同一个 1s A/B”，不是各自一个 research project。

正式文章应保留它们的重要合同：feature clock、173-field parity、native source admission、two-arm invariant、day cluster 和 stop rule；但不把 `v1/v2/v3 execution amendment` 写成新经济假设。

### 9. 关闭、未关闭与权限

关闭：当前 1-second full-schema model/policy successor 相对 v9 10s control 的 40-day Development identity。

未关闭：具有不同 labels、regularization、state representation 或 action semantics 的未来 sub-10-second model。它必须解释自己怎样避免相邻样本、输出 jitter 与 lifecycle feedback，而不能沿用本项目 panels 调参。

没有获得：Validation、sealed holdout、71-day confirmation、action、model replacement、shadow 或 live authority。10s baseline 保持不变。

### 深入推导：更快 cadence 同时改变控制频率与订单年龄

把 inference 从十秒改成一秒，不只是每十秒多算九次分数。每次 decision 可能触发 place、replace 或 cancel，重置 queue priority，并改变订单在市场上的年龄分布。若 $u_t$ 是模型信号，$a_t$ 是实际订单动作，策略可以写成：

$$
a_t=\Gamma(u_t,O_{t^-},I_t,C_t),
$$

其中 $O_{t^-}$ 是当前 active order，$I_t$ 是库存，$C_t$ 是 cooldown/campaign state。增加 $u_t$ 的更新频率只有在 $\Gamma$ 真正改变订单且新增信息超过 queue reset 成本时才有价值。

![1 秒 inference 必须穿过冻结 mapping 与完整路径门](/images/narrowgate/f03-thirteen-head-evidence-pipeline.svg)

*图 2：cadence 属于 inference identity；更快更新会改变 queue、fill、inventory 和 campaign，而不仅是 prediction rows。*

### 一个路径例子：及时撤单为何可能延长库存

假设 BUY add 刚成交，策略持有长库存，同时 SELL reducing quote 正在 queue 前部等待修复。新的一秒信号轻微恶化，快 cadence 触发 replace，把 reducing SELL 外移并失去原 queue position；市场随后小幅反弹，但新单来不及成交。十秒 baseline 没有在这次噪声上动作，旧 reducing order 反而完成 flat。

在另一个单边下跌路径中，一秒 cadence 及时撤掉新的 BUY add，确实避免 adverse fill。两条路径展示典型 trade-off：更快控制降低某些 exposure-increasing fills，却也更频繁干扰 reducing queue。最终结果必须同时看 fills、库存时间、campaign duration 与 tail。

这也是为什么“fills 更少”不能单独判为好或坏。若减少的是 toxic add fills，terminal value 应相对改善；若减少的是 repair fills，库存时间和 tail 可能恶化。冻结结果中 fills 下降而 inventory time 与 campaign tail 更差，说明至少在该 mapping 下，第二种机制不可忽略。

### Cadence 研究需要的三个对照

第一是 score-only parity：在共同 decision timestamps 上，1 秒与 10 秒模型是否产生预期分数，排除实现错位。第二是 action-count decomposition：新增九次计算中多少是 no-op、多少 replace、多少 cancel，分别作用于 add 与 reducing。第三是 full-path paired replay：保持 market data、latency seed 与非 cadence 机制相同，比较 terminal economics。

若只做第三步而不做前两步，经济差异难以解释；若只做前两步，又不能推导 value。当前研究的价值在于三者都能对齐，并给出明确阴性：执行完整、动作真实发生，但更快 cadence 没有形成经济晋级。

### Cadence 是一个控制系统参数，不只是计算频率

把更新间隔从十秒缩到一秒，至少同时改变四件事：特征刷新延迟、订单平均年龄、cancel/re-entry次数、以及库存反馈被重新写入报价的速度。若旧单在两次decision之间仍active，cadence还改变每个score对实际exchange exposure覆盖的比例。因此“更快模型”不是同一policy跑得更勤，而是一项新的动态控制律。

可以把状态递归写成

$$
S_{k+1}=F(S_k,M_{k:k+1},A_k),
\qquad
A_k=\pi(X_{t_k},S_k;\Delta t),
$$

其中$\Delta t$显式进入policy identity。改变$\Delta t$会改变决策网格$t_k$、每段市场路径$M_{k:k+1}$和后续状态$S_{k+1}$。因此不能把十秒结果按十倍线性缩放，也不能在一秒arm里沿用按十秒寿命校准的touch probability而不说明期限错配。

### 需要同时观测的四个控制代价

第一是staleness：行情变化到下一次合法决策的等待时间。第二是churn：每小时cancel、ACK、re-entry与queue reset。第三是exposure：active quantity-time与inventory-time。第四是terminal path：campaign value、tail与窗口末端库存。更快cadence通常降低第一项，却可能提高第二项，并通过失去queue priority或删掉repair fills恶化后三项。

一个有说服力的cadence实验不应只比较1s与10s两个端点。它应在结果前冻结少量工程可行档位，保持feature horizon、order TTL与risk horizon语义明确；对每个arm记录真实decision opportunity、action change率与full-path outcome。若1s只是在十次检查中九次重复keep，它与真正每秒撤换不是同一个treatment。

本研究观察到fills减少、inventory time增加与tail恶化，说明更快控制确实改变了路径，却没有带来净价值。最合理的后继不是继续缩到100ms，而是先分离“更早看到风险”和“更频繁重置订单”两种机制，例如允许高频监测、低频常规requote，只在预注册风险事件上越级cancel。

### Cadence 与 feature horizon 的 aliasing

每秒decision不等于每秒获得独立信息。若核心features来自10秒完成bucket，连续十次decision可能消费同一个vector，只是order age与book变化。此时效应主要来自execution cadence，而不是model refresh。反过来，若book feature每100ms更新而policy十秒一次，短时信号会被采样alias掉。

报告应区分`decision count`、`unique feature versions`和`quote-changed count`。三者之比能判断更快cadence究竟增加信息、重复评估还是增加churn。只看CPU loop次数会夸大treatment strength。

### TTL、requote 与 cancel ACK 的时钟耦合

若requote每1秒、cancel ACK延迟数百毫秒，系统可能长期处于pending cancel；下一次decision不能假设旧单已消失。新的quote是否允许submit、旧单是否仍可fill与queue cursor如何终止，都属于cadence treatment。

因此paired replay要共享deterministic latency，并允许两arms因action次数不同而产生不同pending states，但不能让一个arm多抽随机数后移动另一个arm延迟序列。keyed latency按order/event identity取样，可保持反事实可比。

### 如何设计“高频监测、低频动作”的后继

把score每秒更新，但常规quote仍按较慢cadence；只有预注册hard-risk event允许提前cancel。这样可以单独检验低staleness是否有价值，而不把每次新score都变成queue reset。

实验至少有三臂：低频监测/低频动作、 高频监测/低频动作、高频监测/高频动作。第一与第二识别information timing，第二与第三识别execution churn。若只比较两个端点，无法知道fills减少和inventory增加来自哪一层。

### 10. 公共证据

- [Causal-v12 1s Native 40-Day Full-Path ML A/B](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v12_1s_native_40day_full_path_ml_ab_v3_development_20260808.md)
- [F03 README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/README.md)
- [1s Cadence Economic Precommit](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f03_causal_13_head/docs/causal_v12_1s_cadence_full_path_economic_precommit_v1_20260805.md)

完整 report、model bundles 与逐日 paths 不随公共仓库分发；公开文档提供冻结 comparison、aggregates 与 Development closure。

![Causal 13-Head 从 v4 到一秒 cadence 的阶段结果收敛](/images/narrowgate/causal-13-head-research-synthesis.svg)

*图：五个阶段分别暴露 timing、transport、support 与 economics 问题；没有一阶段同时通过预测、实现、动作路径和终局经济门。*

## 8. 结论：模型复杂度增加了，证据门没有因此降低

13‑Head 的价值不在于产生过某个正 PnL 点估计，而在于把失败定位到不同层：有时是 feature/label 时间污染，有时是 source transport，有时是 denominator 太小，有时是 prediction gate 只通过少数 heads，最后一次则是 cadence 真正改变了路径却朝坏方向变化。这些旧阶段没有同时满足预测、实现、动作路径与终局收益要求；这段结论不替代前文新 Tardis 实验的独立结果。

因此该主线关闭的是这些冻结模型/频率/映射 identity，而不是“机器学习永远不能做市”。未来 successor 必须先声明新的输入状态、模型类、输出动作与 reward，再用 nested chronological OOF 和 paired full-path replay 检验；不能用更高 AUC、更低某个 head loss 或 Python/C++ parity 替代动作价值。
