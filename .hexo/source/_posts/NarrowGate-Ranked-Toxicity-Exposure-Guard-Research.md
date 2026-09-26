---
title: 'NarrowGate Exposure Guards：BER Proxy、BUY q90、Ranked Toxicity 与跨 Campaign 订单所有权'
date: 2026-08-29 13:30:00
updated: 2026-08-30 02:10:00
categories:
- Market Making
tags:
- Market Making
- Exposure Guard
- Toxicity
- q90
- 订单所有权
math: true
---


Last materially modified: 2026-08-30


## 1. 三类 Guard 研究的是同一条从风险分数到终局价值的链

历史上以 `BER` 命名的机制实际是 trade-intensity acceleration proxy，并非论文中的 Book Exhaustion Rate；BUY q90 使用 active-order hazard 的高分位过滤；ranked-toxicity guard 则用 causal-v12 toxicity rank 触发持久 permission state。三个机制虽然 score 来源不同，却都必须回答同一问题：风险分数何时可见、它控制哪张订单、订单离开 exchange risk set 后 permission 如何延续，以及改变路径后 portfolio terminal value 是否改善。

Role-safe BER 能改变 exposure 路径，却使 terminal value 恶化。q90 审计发现 mixed clock 与 post-cancel-ACK terminal hold，portfolio attribution 又只支持 fill imbalance 的第一条边。Ranked-toxicity preflight 进一步发现订单可以跨 inventory campaign 改变 role，迫使 assignment unit 升级为 carryover-safe episode。把这三条 guard 链合并后，可以看出最大的难点从来不是选 `1.2`、q90 或 p90，而是 causal visibility、risk-set termination 和 action ownership。

统一状态需要同时追踪

$$
O_t=(\text{order id},\text{owner arm},\text{submit role},\text{current role},\text{risk-set state},\text{guard state}).
$$

若订单从 reducing 变为 exposure-increasing，不能重新随机 arm，也不能让新 campaign 接管旧 queue position。Guard 的动作正确性因此取决于 lifecycle ownership，而不只是 score 超过 p90。

## 2. 研究阶段与证据状态

| 阶段 | 它真正问什么 | 结论/权限 |
|---|---|---|
| Trade-intensity proxy add-only | 只保护 exposure-increasing add 能否避免误伤 opener/reducing？ | fills 增加但 terminal value 恶化；关闭 |
| BUY q90 clock/lifecycle | 高分位 active-order guard 是否在合法可见时钟和风险集上运行？ | mixed-clock 与 post-ACK 缺陷确认；旧 parity 失效 |
| BUY q90 portfolio attribution | 过滤 BUY 是否通过 fill imbalance 导致 SHORT concentration 与损失？ | 只支持第一条机制边；没有 policy 结论 |
| Ranked-toxicity carryover-safe guard | p90 rank 触发的持久 guard 能否保持跨 campaign 订单所有权？ | 一日 smoke 通过；40 日 mechanics/economics 未运行 |

## 3. Trade-intensity proxy add-only

### TL;DR：绕过 opener/reducing 后 fills 增加 13.85%，terminal value 反而少 11.67 USDC

当前 BER guard 使用同一个 signal、threshold 1.2 与 spread multiplier 2.0，全局双边影响报价。本研究只改角色映射：candidate 让 BER 继续保护 exposure-increasing add，但 flat opener 与 reducing quote 使用 exact BER-bypass price；mixed-cross-zero quantity 保持 control。它不是重新搜索 BER 常数。

40 日 daily fresh-start Development 中，candidate 产生 172,328 个 effective side-price changes，change rate 14.96%，BUY/SELL 82,682/89,646，40 日均有支持；Python/C++ fill path、BER state、source 与 cap mismatches 都为零。机械实现明确。

经济上，control/candidate terminal MTM 为 -144.2517/-155.9180 USDC，差 -11.6663；closed-campaign value 差 -9.3845；fills 从 17,118 增至 19,488，即 +13.85%。paired daily delta -0.2917 USDC/day，95% interval $[-1.1439,+0.6813]$，只有 13/40 日改善。candidate 的 q10、CVaR、MAE、max inventory 与 inventory time 等 proxy 反而变好，再一次说明更低库存/更快 repair 不能替代 terminal value。

这还是一个 outcome-informed owner Development screen，不是独立 confirmation；即使未来有正结果，也不能重标为 research-supported。当前 global BER 保持不变，candidate foundation 关闭，也没有 continuous confirmation、action 或 live authority。

![BER role-safe add-only 的角色 DAG 与时钟](/images/narrowgate/ber-role-safe-add-only.svg)

*图 1：机制示意。相同 completed-10s BER state 在每个 completed-1s callback 被采样；candidate 只把 add side 接到 BER quote，opener/reducing 接 bypass quote，cross-zero 保持 control。*

![Role-safe spread action 的完整 campaign 路径](/images/narrowgate/f09-campaign-action-causal-path.svg)

*图 2：历史 BER 状态只决定哪一套 quote source 进入角色合成；bypass 会改变 opener/reducing 的成交、库存与后续报价。fills 和风险 proxy改善后，仍须以 terminal value决定动作。*

#### 名称边界：这里的 BER 不是论文里的 Book Exhaustion Rate

`BER` 是历史代码与冻结 artifact 名称，本文保留它只是为了让读者能追踪同一研究身份。实际输入是 `trade_intensity_60s` 经快慢 EMA 形成的**成交强度加速度代理**，不是从订单簿队列耗尽事件估计的 Book Exhaustion Rate。

概念上更接近：

$$
R_t^{intensity}=\frac{EMA_{fast}(I_t)}{EMA_{slow}(I_t)+\epsilon},
$$

当 ratio 高于 1.2 时，把 spread multiplier设为 2.0。它说明近期成交强度相对慢基线加速；没有直接计算某档 book被撤单/成交耗尽的 hazard，也不能引用 book-exhaustion论文把二者视为同一 estimand。

因此后文出现“BER state/quote”时，都应读成“历史 BER 接口下的 trade-intensity-acceleration guard”。这个命名修正不改变冻结实验：control、candidate、threshold与multiplier字节仍按历史身份比较；它只避免理论解释越界。

### 1. 研究问题：BER 应保护所有报价角色，还是只保护加风险？

历史 BER widening 的直觉是当成交强度加速度代理异常时减少被动暴露。但 reducing quote 的目标是修复库存，flat opener 又决定参与入口；全局 widening 可能无差别阻碍它们。role-safe candidate 问：保留同一个历史 BER signal，只在 exposure-increasing add 上应用，能否提高完整路径价值？

目标比较为：

$$
\tau=E[Y(\text{BER add-only})-Y(\text{global bilateral BER})].
$$

这不是 fresh independent trial。候选建立在已经完成的 BER retirement outcomes 与 current-stack owner knowledge 上，因此被预先标为 owner screen。它可否定一个工程方向，却不能凭同一证据谱系获得“研究支持”标签。

### 2. BER 时钟与输入一致性

权威时钟是：最新完成的 10-second feature value 被 held，并在每个 completed 1-second bar callback 采样。不是每个 100ms loop 更新，也不能使用尚未完成的 10s bucket。

设 $x_k$ 是第 $k$ 个 completed 10s feature，$t_j$ 是 completed 1s callback，则：

$$
BER(t_j)=g(x_{k^*}),\qquad k^*=\max\{k:t^{ready}_{10s,k}\le t_j\}.
$$

threshold 为 1.2、multiplier 2.0，slow-EMA ready threshold $10^{-6}$。live/Python/C++ 在 quote composition 前必须输出同样的 raw BER input、EMA values、ratio、readiness 与 active state。当前 control 使用 corrected held-feature clock，不与旧 BER-retirement control 的 prior update semantics 数值互换。

#### 2.1 10 秒 publish、1 秒 sample 与 100ms loop 是三只时钟

强度 feature在 completed canonical 10s bucket发布；状态由每个 completed 1s callback采样；主循环可能更高频运行，但在新 1s callback前只能持有旧状态。于是同一 $x_k$ 可被多个 1s decisions读取，却不能在每个100ms evaluation重复推进 EMA。

若 replay按100ms更新，effective half-life会缩短约一个数量级，threshold crossing和action rate都会改变。若在10s bucket结束前读取最终强度，又会提前知道未来 trades。clock parity不仅是时间戳格式，而是决定 signal dynamics 的一部分。

#### 2.2 Ratio、threshold 与 multiplier 属于三种不同语义

$R_t$ 是状态代理，1.2 是离散 active门，2.0 是报价宽度映射。研究只改变 active以后哪些 inventory role消费 widened quote，没有重新证明 ratio的预测价值、1.2的最优性或2.0的经济最优性。

这也是为什么 candidate失败后，不能推出 global control经过研究确认。control只是现有 operational comparator；“candidate更差”不等于“control理论正确或最优”。

### 3. Role composition

同一个 immutable decision snapshot 同时算 global BER quote 与 `ber_active=false` 的 bypass quote。role 由 decision-pre inventory 和 target quantity 确定：

| Inventory / target | Candidate quote source |
|---|---|
| $q>0$ 的非 crossing BUY | exposure add → global BER |
| $q>0$ 的 SELL | reducing → bypass |
| $q<0$ 的非 crossing SELL | exposure add → global BER |
| $q<0$ 的 BUY | reducing → bypass |
| $|q|\le10^{-10}$ | 两侧 flat opener → bypass |
| quantity crosses flat | `mixed_cross_zero` → control |

若 BER inactive，两臂完全相同。若 mixed pair 触及 spread cap，只能移动 add side；若无法保持 opener/reducing 的 exact bypass price，则此 decision 退化为 no-op，不能偷偷移动修复侧。

cancel/replace/queue/fill 是 price change 的自然 treatment consequence。candidate 不直接改 cancel policy、requote clock、cooldown、quantity、P3、ML、q90 或 lifecycle。

### 4. 因果 denominator：不能由 treatment path 重建

动作改变 fills 与 inventory，随后可用 decisions 也会改变。若按每臂各自出现的 requotes 计算 change rate，denominator 本身已被 treatment 污染。冻结方案使用两臂共同存在的 canonical requote timestamps，每 timestamp 两个 side rows：

$$
\mathcal D=\{(t,s):t\in T_{control}\cap T_{candidate},\ s\in\{BUY,SELL\}\}.
$$

任何 `n_requotes` mismatch 都 fail closed，不从 fills 或 inventory path 补建 denominator。append-only scorecard repair 曾修正 misplaced support metadata，恢复 canonical support 5,067 rows、40 days、zero support failures；economic hard-gate decision 没变。元数据修复不是新 outcome run。

#### 4.1 为什么 cross-arm requote count 不应强制相等

price action可以改变 fill，fill改变inventory与circuit breaker，继而改变后续 replay何时终止或是否继续requote。要求两臂最终拥有相同 requote count，会错误拒绝真实 treatment effect。

正确不变量是每个 arm内部 Python/C++对同一事件流和状态转移锁步，以及在预先定义的 canonical opportunity上计算支持。跨臂路径分叉本身是 estimand，不该被“修平”。早期 failure正是把不同 terminal time的BER EMA拿来比较；successor只修正了不合法 invariant，没有改变action。

#### 4.2 Canonical denominator 如何防止 action-rate自我美化

若 candidate因多fill产生更多后续decision，按candidate rows算分母可能降低change rate；若它早终止campaign，又可能提高。共同 canonical timestamps把支持测量固定在两臂可比较的机会，不让 treatment自己决定分母。

经济终局仍各自沿完整path计算。也就是说，support使用共同机会，outcome允许后续分叉；这两个分母服务不同问题，不能强迫相同。

### 5. Mechanics 结果

one-day native preflight 先要求 role semantics 与 Python/C++ full-path parity；之后才允许读剩余 40 日 Development。正式结果：

| Mechanics | Frozen result |
|---|---:|
| effective side-price changes | 172,328 |
| effective change rate | 14.96% |
| BUY / SELL changes | 82,682 / 89,646 |
| support days | 40 / 40 each side |
| Python/C++ fill-path mismatch | 0 |
| BER-state/source mismatch | 0 |
| infeasible cap count | 0 |

动作强度足够，且 role composition 没有由 cap 或 parity defect 吃掉。因此 economic failure 不能归因于“实现未生效”。

### 6. Economic 结果：fills 增加，价值下降

| Metric | Control | Candidate | Candidate-control |
|---|---:|---:|---:|
| terminal MTM PnL | -144.2517 | -155.9180 | -11.6663 USDC |
| closed-campaign value | -147.4663 | -156.8508 | -9.3845 USDC |
| fills | 17,118 | 19,488 | +2,370，+13.85% |

按 40 个 UTC 日配对，terminal delta 为 -0.2917 USDC/day，95% interval $[-1.1439,+0.6813]$，仅 13/40 日改善。negative-terminal protection 也恶化 -0.4621 USDC/day。

候选改善 campaign q10、CVaR10、MAE、maximum inventory、inventory time 与 multi-level LONG/SHORT point estimates。看似矛盾，其实说明 opener/reducing bypass 增加参与和修复，但新增 fills 的 execution/selection value 足以让 terminal 变差。proxy 可以描述机制，不能覆盖经济 hard gate。

#### 6.1 为什么绕过 reducing 与 opener 会同时增加 fills

reducing bypass让库存修复报价更靠近市场，提高成交；回到flat后，opener bypass又让新campaign更容易启动。于是 candidate不只“更快结束旧库存”，也“更快重新开始下一段暴露”。+13.85% fills是两条路径共同结果。

库存时间、MAE与max inventory下降，说明旧campaign修复机制确实增强；terminal变差则说明新增执行/selection与重复参与成本更大。只观察某个成功repair片段，会漏掉flat后的新opener和后续campaign。

#### 6.2 一个数值一致性检查

terminal总差 -11.6663 USDC除以40日为 -0.2917 USDC/day，与paired daily point estimate一致。fills增加2,370，不能用 $-11.6663/2370$ 当“每个新增fill因果成本”，因为新增/删除fill没有一一配对，且已有fills的时点、价格与后续path也改变。

这个粗比值最多是描述性规模，不能支持“每多一笔必亏多少”。真正action unit是整条daily/campaign full path。

#### 6.3 Proxy改善为何不能隐式改成风险效用

如果owner愿意用terminal价值换更低inventory，应在结果前冻结效用权重，例如 $U=PnL-\lambda E|q|dt$。本项目primary是terminal与closed-campaign value，没有预注册 $\lambda$；结果后以MAE、q10或inventory time救援，会改变目标函数。

这并不贬低风险proxy。它们解释动作怎么运作，也可为新risk-mandate提供设计依据；它们只是不能反向改写当前hard gate。

### 7. 一个报价路径例子

假设 inventory $q=-0.002$，BER active。global control 会同时 widen SELL add 与 BUY reducing；candidate 只 widen SELL，BUY 使用 bypass、更接近市场。candidate 更容易获得 reducing BUY fill，inventory time 下降。但若 BUY 在继续下跌的市场中更早成交，或者绕过 widening 损失了选择性，terminal value 可能变差。

当 inventory 回到 near-flat，后续 opener 也 bypass BER，因此 candidate 可能比 control 更快重新参与，解释 fills +13.85%。这些都是 action path 的组成，不是 bug，也不能只选择“成功 repair 的 campaign”评价。

### 8. 研究演进与证据地位

初版 mechanics implementation failure、execution amendments、estimand errata、offline projection 与最终 40 日 Development 都围绕同一 role-safe action。它们不因文件多就成为多个研究项目。第一次 scorecard support metadata 错位由 append-only repair 修正，结论不变。

因为候选是 completed BER retirement 之后的 outcome-informed successor，它永久保留 owner-risk-accepted 标签。formal Development pass 本来也只可能开启 restart-aware continuous owner confirmation；daily fresh-start evidence 不能直接授权 live。现在 Development 经济已失败，连该 confirmation 路线也没有晋级基础。

### 9. 关闭边界

关闭的是“相同 signal/1.2 threshold/2.0 multiplier，仅 add 使用 BER、opener/reducing bypass”的 B1 foundation。它不证明 global BER optimal，也不证明所有 role mapping 无效；只是 directional empirical BER v2 不能建立在这个已失败 foundation 上。

不能在 40 日已读面板上调 threshold/multiplier、只保留某侧、改变 cross-zero rule，或把 proxy score 换成 primary。current global BER 继续 enabled，不因 candidate 失败而自动退休。

### 10. 没有获得的权限

- 没有 continuous restart-aware confirmation；
- 没有 action、shadow、live 或配置变更权限；
- 没有把 owner screen 重标为 independent research-supported；
- 没有从 proxy 改善推出 terminal value；
- 没有调整 threshold 1.2、multiplier 2.0、side/role 或 cross-zero semantics 的权限。

### 从代理状态到真正 Book Exhaustion Rate 的分界

当前历史字段由快慢成交强度EMA之比构成，可示意为

$$
R_t=\frac{EMA_{fast}(I_t)}{EMA_{slow}(I_t)}.
$$

$R_t>1$表示近期trade intensity相对慢基线加速；它没有直接测量某一侧book queue被消耗的速率、补单与撤单。真正的book-exhaustion对象至少需要side-specific depth depletion、replenishment和event-time exposure，语义不能由字段名`BER`继承。

若未来实现真正Book Exhaustion Rate，应使用新名字、新ABI和新研究身份，不能把新特征悄悄替换旧ratio后宣称本篇结论被翻转。本篇所有数字只约束trade-intensity-acceleration proxy及其role-safe mapping。

### 三只时钟如何共同决定一次保护动作

慢/快EMA可能每1秒采样，状态每10秒发布，而maker loop每100ms检查。100个loop ticks可能消费同一个published state；这不等于100次独立信号。若在10秒内重复cancel/requote，action frequency由loop与lifecycle共同决定，而feature information只更新一次。

因此canonical denominator应是有合法published state且role明确的decision opportunities，另行报告unique state updates与最终quote changes。把100ms evaluations当样本量会严重低估不确定性；interval仍应按day或campaign cluster。

### Role-safe 失败之后还剩什么可研究

结果说明“绕过opener/reducing、只惩罚add”确实提高participation，却恶化terminal value。它不区分失败来自ratio无信息、threshold错误、multiplier过强还是role mapping遗漏状态，但已读面板不能继续逐项调参救援。

合法后继需要独立机制：例如直接构造side-specific depletion/replenishment features，或在随机化局部actions中估计$E[Y(widen)-Y(keep)\mid role,X]$。若仍使用旧ratio，只能作为预先指定的普通flow feature，不能引用BER论文赋予理论权威。

### 11. 公共证据

- [`ber_guard_role_safe_add_only_current_stack_owner_v1_development_20260809.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/ber_guard_role_safe_add_only_current_stack_owner_v1_development_20260809.md)
- [`ber_guard_role_safe_add_only_current_stack_owner_v1_spec_20260808.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/ber_guard_role_safe_add_only_current_stack_owner_v1_spec_20260808.md)
- [`F09 README`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/README.md)

### 结语

role-safe composition 确实做到了想做的事：加风险继续受 BER 保护，opener/reducing 获得更积极价格，fills 与库存路径显著改变。但终局少了 11.67 USDC。这个结果再次把“修复更快、库存更小”放回它应有的位置——机制指标，而不是价值函数。

## 4. BUY q90 clock/lifecycle

### TL;DR：混合时钟几乎删掉了整个 q90 风险集，修好时钟后又暴露出 cancel ACK 后继续打分的终局缺陷

BUY q90 是 active-order fill-hazard 路径上的高分过滤机制。它本应在订单仍然暴露于 exchange fill risk 时读取因果可见状态，决定是否发出 cancel；订单收到 cancel ACK 后，旧 order path 必须终止，未来若要 re-entry，只能用当前价格、age zero、fresh queue 与当前可见市场重新评估。

历史实现混合了两个时钟：native book、matching 与 fill 属于 exchange clock；strategy score 却应服从 feature-ready visibility clock。旧 scheduler 把 ordinary transport latency 误当成 future information，775,192 次 evaluations 中只有 3,896 次有效，valid rate 仅 0.503%。修正 visibility clock 后，同规模 shadow evaluations 的 valid rate 接近 99.99%，说明历史 weak treatment 主要是风险集被错误删空，而不是 q90 score 永远不触发。

第一版修复在首个 stateful Python/C++ evaluation 就 fail closed：四个 predicted probabilities 相差约 0.5%–0.7%。离散 state、book 与 queue 全部一致，根因是 Python 用 feature-ready timestamp 形成 visible path age，C++ 仍用 provider source timestamp。后续 v1.1 修好连续特征并达到 zero kernel/lifecycle mismatch，却仍未通过 same-date parity：replay valid fraction 与历史 live slice 相差 0.12983，高于 0.05 门；cancel-role total variation 为 0.151495，略高于 0.15 门。

进一步 exact-order audit 找到真正的 lifecycle bug：23 个 BUY orders 都已有 cancel request 与 cancel ACK，exchange risk 已终止，但 tracker 仍把它们合成为 PENDING_CANCEL。由此产生 69,074 条 post-ACK active-order hazard evaluations，其中 62,495 条 invalid；18 个所谓 recovery/re-entry 也继续使用终局订单的旧 age、price、queue 和 cursor，因此不能作为 recovery evidence。

后续 dual-clock terminal routing 与 fresh prospective placement 已在本地 mechanics 上修复；one-day v1.6 smoke 达到 zero event mismatch、zero post-terminal hazard/cursor reuse，并完成 3/3 cancel/recovery/re-entry。但 61 次 prospective recovery evaluations 全部 invalid，正式 40 日 run 又因冻结 storage reserve gate 未启动。项目状态仍是：**terminal-risk-set defect confirmed；one-day mechanics repaired；40-day parity、transport、economics 与 action authority 均未完成。**

本文只讨论公开 Development mechanics，不构成交易建议。图中的订单、时钟和状态为抽象机制图，不是实盘订单或当前运行状态。

![BUY q90 的 exchange clock、visibility clock 与 terminal recovery 状态机](/images/narrowgate/buy-q90-causal-clock-lifecycle.svg)

*图 1：exchange truth 与 strategy visibility 分属两只时钟。Cancel request 后旧订单仍可 fill；cancel ACK 才结束 active risk。ACK 后的 recovery 必须创建 fresh prospective placement，不能继续使用旧 cursor。*

![F10 从观测归因、机制复现到动作价值的证据阶梯](/images/narrowgate/f10-attribution-evidence-ladder.svg)

*图 2：本项目停在“机制修复与单日复现”一层。它尚未完成全样本 transport，更没有跨过 paired action-value 与 live-authority 两道门。把修复后的 state machine 直接称为有效策略，会跳过阶梯中间的全部证据。*

### 1. q90 到底在哪个风险集上工作

q90 的输入是 active BUY order path。合法 fill-risk phases 只有 ACTIVE、PARTIALLY_FILLED 与 CANCEL_PENDING。SUBMITTED 尚未获得 active risk，EXCHANGE_TERMINAL 已经没有 remaining exchange fill risk。

设订单在 feature-ready edge $t$ 的 score 为 $q_t$，冻结阈值为 $\tau_{0.90}$。抽象触发规则为

$$
A_t
=
\mathbf 1[
state_t\in\mathcal R_{active}
\land q_t\ge\tau_{0.90}
\land support_t=1
],
$$

其中

$$
\mathcal R_{active}
=
\{ACTIVE,PARTIALLY\_FILLED,CANCEL\_PENDING\}.
$$

这个定义有两个硬边界：feature 必须在 $t$ 前 ready；state 必须仍属于真实 exchange risk。任何一边出错，score 即使数学上相同也属于错误 estimand。

### 2. Source time 与 feature-ready time 是不同事实

exchange/source timestamp 描述 book delta、trade、activation 或 terminal event 在市场侧的时间。feature-ready timestamp 描述这些事实经过 transport、batch、处理与原子 state update 后，策略何时可以使用。

对任一 feature $x$, 合法读取要求

$$
t_{ready}(x)\le t_{eval}.
$$

如果 replay 在 source time 立刻暴露 $x$，就向策略提供了尚未到达的信息；如果又把 visible-state age 从 source time 计算，transport delay 会被错误计入订单已可见年龄。BUY q90 的 path age 是连续模型输入，即使 phase、queue counters 与 book values 都相同，age 差异也会改变 probabilities。

修复后的 scheduler 用 exchange time 重建 native sequence、queue truth、matching 与 fills；用 feature-ready time排队 strategy-visible events。只有 exact same-ready timestamp tie 才使用冻结 book-before-trade 规则。原始 timestamps 保持 immutable，不通过覆写 timestamp制造“对齐”。

### 3. 旧 mixed clock 如何删空风险集

旧 legacy mixed shadow 的 mechanics table：

| Mode | Evaluations | Valid | Valid rate | Shadow cancel signals |
|---|---:|---:|---:|---:|
| Legacy mixed | 775,192 | 3,896 | 0.503% | 5 |
| Provider-receive | 775,185 | 775,135 | 99.994% | 3,606 |
| Environment-profile | 775,185 | 775,085 | 99.987% | 2,505 |

在 mixed clock 下，普通 latency 被解释成状态时间冲突，99% 以上 evaluations 从 q90 risk set 消失。旧 low action rate 因此不能被读成“score 很少超过 q90”；它主要反映 invalidation mechanics。

正确 clock 下 stateful apply mode有 784,825 evaluations、784,675 valid、192 applied cancels。历史 observed slice 是 184 cancels；修正后的 cancel/hour ratio 约 0.641，不再是早期估计的约 $1/190$。这只说明 treatment strength 恢复到同一数量级，不证明 parity 或 action value。

可以把这个问题写成风险集分母的改变。令 $N_t^{risk}$ 表示时刻 $t$ 真正处于 active exchange risk 的订单数，$V_t$ 表示同时满足 feature-ready 与输入支持的订单数，则 scorer 的有效覆盖率是

$$
C
=
\frac{\sum_t V_t}{\sum_t N_t^{risk}}.
$$

旧 mixed clock 不是把同一批风险样本打出了较低分，而是把绝大多数 $V_t$ 错误置零。阈值命中率、cancel rate 与 role distribution 因而都在一个被破坏的分母上计算。此时即使把 score histogram 画得再精细，也无法区分“模型认为安全”和“系统没有允许模型看见样本”。这正是为什么 clock repair 必须先于任何 threshold tuning。

### 4. 第一版修复为何必须保留为 failure

首次 stateful run 在第一个合法 Python/C++ evaluation 停止。两侧 lifecycle identity、action、source/ready timestamps、generation、queue counters 与 book values 都匹配，但四个 probabilities 差约 0.5%–0.7%。

根因不是浮点 tolerance，而是连续 input semantics：Python 的 visible_state_age_ms 从 last feature-ready timestamp 计算，C++ active-order path age仍从 provider source timestamp 计算。若 source 与 ready 相差两秒，策略在 ready 后 100ms 的可见 age 应是 100ms，而不是 2,100ms。

修复没有改旧失败报告。它创建新 implementation identity，并加入 source/ready separation regression。这样 failure receipt 保留了“哪个合同被暴露”，successor 才证明“如何修复”。两次 execution attempt 仍属于同一 causal-clock/lifecycle 项目，不应拆成两篇 alpha。

### 5. v1.1：kernel 锁步通过，same-date parity 仍失败

v1.1 的 stateful apply path记录 192 cancel ACK、190 score recoveries、192 re-entries；Python/C++ 在 book、activation、evaluation 与 lifecycle checks 上 mismatch 为零。future feature count、native gaps、sequence failures、time reversals与 receive-time fallbacks 也均为零。

但 frozen parity contract 有两项失败：

| Gate | Result | Frozen limit | Status |
|---|---:|---:|---|
| Replay-live valid-fraction absolute delta | 0.12983 | 0.05 | fail |
| Cancel-role total variation | 0.151495 | 0.15 | fail |

role-TV 只比门高 0.001495，也不能在看到结果后把 0.15 改成 0.152。valid-fraction gap更大，且高度集中在少数 retained orders 的 outside-deep-book invalid rows。这引出下一项 exact lifecycle audit。

### 6. Cancel ACK：exchange risk 的硬终点

23 个 implicated BUY orders 都有 exactly one cancel request 与 one cancel ACK。ACK 后 exchange order 已 terminal，却仍被 tracker 合成为 PENDING_CANCEL，并继续输入 active-order hazard model。

| Terminal-hold metric | Frozen result |
|---|---:|
| Orders | 23 |
| Post-ACK active hazard evaluations | 69,074 |
| Post-ACK valid rows | 6,579 |
| Post-ACK invalid rows | 62,495 |
| Old price above current mid | 62,466 / 62,495 |
| Apparent recoveries / re-entries | 18 / 23 |
| Slice-end terminal holds | 5 / 23 |

对 BUY order，old order price 高于 current mid 已足以说明它高于 best bid；62,466 条 observations 不是“deep book 不够深”，而是终局订单仍在被错误当作 active path。剩余 29 条因 frozen tape 缺少精确 field 而保持 unresolved，没有强行归因给 depth。

18 个 apparent recoveries 也无效，因为它们仍使用终局 order 的旧 active-risk state。一个 recovery 事件最终产生 re-entry，不会逆向证明 score 过程合法。

#### 6.1 一条订单路径的逐步推演

考虑一张在 $t_0$ 被交易所确认 active 的 BUY 单，初始剩余量 $Q_0$、价格 $p_0$、queue-ahead $a_0$。在 $t_1$，可见特征使 $q_{t_1}\ge\tau_{0.90}$，策略发出 cancel；从 $t_1$ 到 ACK 到达前的 $t_2$，订单仍可能被成交，所以状态只能是 CANCEL_PENDING，不能提前从 exchange risk set 删除。

在 $t_2$ 收到 cancel ACK 后，旧订单的合法状态立刻变成 EXCHANGE_TERMINAL。若市场在 $t_3$ 回到可接受状态，策略可以评估一张新候选单 $(p_3,Q_3)$，但新单的年龄必须是零、queue-ahead 必须按 $p_3$ 的当前队尾重新种子化，active-order cursor 也必须重新创建。把 $p_0,a_0,t_0$ 延续到 $t_3$，等价于假设一张已经撤掉的订单仍保留原队列位置。

这条路径解释了为何旧实现会同时制造两类错觉：终局订单在价格远离市场后不断产生 invalid evaluations；一旦价格重新靠近，它又像“自然恢复”一样重新有效。前者夸大无支持状态，后者虚构 queue continuity。二者来自同一 lifecycle identity 泄漏，不能分别解释成模型保守与策略恢复能力。

### 7. 三种状态必须拆开

修复后的合同明确区分：

1. exchange_order_terminal：cancel ACK、full fill、reject、expiry 或其它受支持 terminal 已结束旧订单风险；
2. q90_hold_terminal：策略 permission hold 可以在旧订单结束后继续存在；
3. post_cancel_recovery_state：新的恢复 estimand，只评估是否允许 fresh placement。

exchange terminal 不等于立刻允许 re-entry，但也绝不允许继续用 active-order hazard。旧 depth cursor、queue path、price、age、cancel/refill history 与 hazard state 都必须清空。

Terminal routing 依 outcome 分流：cancel ACK 且 remaining quantity 为正进入 prospective cancel re-entry；full fill 或 zero remainder terminal complete；reject/expiry回普通 baseline resubmit；shutdown不 re-enter；unknown fail closed。

### 8. 两种 quantity-time exposure

旧字段把 strategy-visible exposure 当作 physical exchange exposure。dual-clock contract 改为同时记录

$$
E_q^{exchange}
=
\int Q_{remaining}(t_{exchange})\,dt,
$$

$$
E_q^{visible}
=
\int Q_{remaining}(t_{visible})\,dt,
$$

单位都是 BTC·s。二者差异衡量 information/transport delay，却不能互相替代。若 activation 缺 exchange timestamp，physical exposure 必须 null 并带 invalid reason，不能借 visibility time补齐。

partial fill 先更新 remaining quantity，再累计下一段 exposure。first-fill latency 也同时保留 exchange 与 visible 版本。C++ 当时没有 quantity-time exposure authority，因此 Python/C++ parity 只覆盖 terminal route、native path、score、cancel 与 recovery，不夸大为三 runtime exposure parity。

### 9. Fresh prospective placement：re-entry 必须从零开始

cancel ACK with positive remainder 只获得进入 prospective recovery 的资格。fresh evaluator 使用：current BUY candidate price、age zero、current causal book/trade state、current level 的 fresh queue-at-tail seed、当前 non-crossing GTX eligibility 与 feature-ready coverage。

retired order_id 只保留 lifecycle provenance。旧 cursor、queue path、elapsed age 与 active hazard state禁止作为 feature。没有引入新的 learned activation model；这一阶段 activation support 只是 GTX eligible 与 current state causally covered。

这条合同保护 baseline integrity，但它仍不回答 q90 action 是否有经济价值。fresh candidate 只是 mechanics 正确，不代表 score calibration、re-entry fill probability 或 terminal campaign value已通过。

#### 9.1 Active hazard 与 prospective placement 是两个 estimand

active-order hazard问的是：**一张已经在簿上的订单，给定其真实 path age、queue history 与 remaining quantity，继续暴露是否危险？** prospective placement问的是：**如果现在重新挂一张新单，它从当前队尾开始的未来风险与价值是什么？** 两者的条件变量不同：

$$
q^{active}_t
=
f(X_t,p_{old},age_t,queue\_path_t,Q_t),
$$

$$
q^{new}_t
=
g(X_t,p_{new},0,queue\_seed_t,Q_{new}).
$$

即使 $f$ 与 $g$ 最终共享部分编码器，也不能把 $f$ 对旧订单的 recovery score当成 $g$ 的输出。旧实现恰恰跨过了这条 estimand boundary：它用 active path 的连续状态替代新 placement 尚不存在的生命周期。v1.6 的 61 次 prospective evaluation 全部 fail closed，说明边界已经被守住，但新估计量的支持仍未建立。

### 10. One-day smoke 通过，为何项目仍未闭合

v1.6 one-day Development smoke 在 exact feature-ready batch semantics 下得到：

| Check | Result |
|---|---:|
| Python/C++ mismatch | 0 |
| Post-terminal hazard reuse | 0 |
| Post-terminal cursor reuse | 0 |
| Unsupported terminal route | 0 |
| Future feature time | 0 |
| Cancel request / ACK | 3 / 3 |
| Recovery / re-entry | 3 / 3 |
| Complete terminal exchange exposure | 8,797 / 8,797 orders |

同一 ready boundary 上 book 与 execution ordering 不可知时，两 runtimes 都持久标记 same_ms_exchange_book_ambiguity。214 次 Python authoritative invalidations 被同步到 message-oriented C++，三次 q90 evaluations 携带该 reason，mismatch 仍为零。

但是 61 个 prospective recovery evaluations 全部 invalid；这不破坏 lockstep，因为双方一致 fail closed，却没有提供有效 recovery-score transport support。正式 40 日 run也没有启动：可用内部空间 56.63 GiB，低于冻结 60 GiB reserve。没有删除 cache 来绕过安全门。

所以 one-day smoke 只证明一个 target day 的 event mechanics，不等于 full denominator，也不应该被写成“q90 parity passed”。

#### 10.1 从 smoke 到 economics 还缺四个闭环

第一，全 40 日必须在同一 frozen input identity 上完成，确认 one-day 的 zero mismatch不是偶然避开某种 terminal route。第二，prospective placement必须获得非零且可解释的有效支持，否则“双方一致 invalid”只是一种安全停机。第三，replay与目标运行环境要在 valid fraction、cancel role、cancel/hour、state age和terminal route上通过 transport gates。第四，只有前三项完成后，才允许比较 q90 ON/OFF 的 fills、inventory campaign与 terminal MTM。

顺序不能倒置。若在 recovery rows全 invalid时先看 PnL，观察到的 arm difference主要反映 fail-closed fallback；若 action rate未 transport就做 paired replay，结果只适用于历史低强度 treatment；若 lifecycle仍泄漏就调阈值，threshold会吸收系统 bug。完整证据链因此是

$$
\text{event identity}
\rightarrow
\text{risk-set support}
\rightarrow
\text{runtime parity}
\rightarrow
\text{transport}
\rightarrow
\text{paired economics}.
$$

本项目目前明确停在前两层之间，而不是“只差一次长回测”。

### 11. 最终状态与没有获得的权限

整条项目链最终得到：

- mixed clock defect confirmed；
- Python/C++ path-age mismatch confirmed and repaired；
- same-date v1.1 parity failed原 valid-fraction 与 role-TV gates；
- 23-order terminal active-riskset defect confirmed；
- terminal routing、dual exposure 与 fresh placement mechanics implemented；
- one-day event lockstep passed；
- full 40-day mechanics、exact transport、recovery support 与 economics仍未完成。

没有读取 PnL、markout、campaign reward、Validation 或 sealed holdout；没有 q90 threshold change、F07 v2 registration、action、rollback、deployment 或 live authority。q90 mechanics 的修复不能被解释为策略应该 ON。

### 12. 公共证据

- [Causal Visibility Clock Parity v1 Failure](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/buy_q90_causal_visibility_clock_parity_v1_implementation_failure_20260731.md)
- [Causal Visibility Clock Parity v1.1 Development](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/buy_q90_causal_visibility_clock_parity_v1_1_development_20260731.md)
- [Terminal-Hold Risk-Set Audit](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/buy_q90_terminal_hold_riskset_audit_v1_development_20260801.md)
- [Dual-Clock Terminal Routing v2](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/buy_q90_dual_clock_terminal_routing_contract_v2_implementation_20260802.md)
- [Fresh Prospective Placement Recovery v4](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/buy_q90_fresh_prospective_placement_recovery_v4_implementation_20260802.md)
- [ABI v4 One-Day Smoke v1.6](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/buy_q90_abi_v4_40day_lockstep_v1_6_one_day_smoke_20260803.md)

公开报告提供 mechanics、聚合计数与权限边界；exact order rows、runtime profiles 与 owner-side machine artifacts 不随仓库分发。

## 5. BUY q90 portfolio attribution

### TL;DR：q90 ON 确实扩大了 SELL-minus-BUY fill imbalance，但“更多 SHORT、更多多层 SHORT、终局更差”都没有成立

BUY q90 的组合机制假说很直观：若系统优先取消高风险 BUY active orders，就会减少增加 LONG 或修复 SHORT 的 BUY fills；SELL exposure fills相对更多，库存因此更容易进入 SHORT；SHORT campaigns 进一步变成 multi-level；最终 terminal MTM 变差。

F10 用冻结 40 日 paired full-path replay 比较 q90 ON 与 q90 OFF。24 个 Grade-A primary 日里，q90 ON 的 SELL-minus-BUY exposure-fill imbalance 增加 $+0.43057$ fills/hour，95% 日期聚类区间 $[+0.00869,+0.85418]$，是整条链唯一通过的 link。

其它 link 均不成立。BUY exposure suppression 为 $-0.22744$ fills/hour，区间上端 $+0.00173$，仅差一点却仍失败；SHORT campaign share 增加 $+0.00851$，区间跨零；multi-level SHORT share 反而点估计下降 $-0.00124$；terminal MTM 为 $+0.09470$ USDC/day，区间 $[-0.23214,+0.45084]$，没有 terminal harm evidence。

全 40 日描述性 aggregate 甚至显示 q90 ON 的 terminal MTM 比 OFF 少亏 $+0.33804$ USDC/day，但这不是独立 OOS policy validation。更关键的 transport mismatch 是：replay 959.963 小时只有 105 个 cancel requests，约 0.109/hour；另一个冻结历史 operational diagnostic 为约 20.84/hour，强度相差约 190 倍。历史 replay 没有回答异常高频 policy 是否造成 observed SHORT concentration。

因此项目结论是 **complete portfolio-bias mechanism not supported on Development**。它既不能证明 q90 有害，也不能证明应该保留或移除；只说明在冻结历史路径和 action intensity 下，四段机制链没有闭合。

本文只讨论公开 Development aggregation，不构成交易建议。图中的 K 线、订单与库存分叉是合成机制示意。

![BUY q90 ON/OFF 到 exposure imbalance、SHORT campaign 与 terminal MTM 的机制链](/images/narrowgate/buy-q90-portfolio-attribution.svg)

*图 1：q90 ON 与 OFF 共享市场路径，在 BUY cancel 处开始分叉。只有 SELL-minus-BUY exposure imbalance 获得正下界；后续 SHORT share、multi-level share 与 terminal harm 均未通过。*

![F10 从观测归因到动作价值的证据阶梯](/images/narrowgate/f10-attribution-evidence-ladder.svg)

*图 2：Portfolio attribution 已经做了 paired full-path action replay，但固定 scorer 与 Development 重叠、运行强度又未 transport，所以它仍停留在机制归因，而不是独立样本外策略验证。*

### 1. 为什么这是 portfolio path，不是单笔 cancel study

一笔 BUY cancel 的局部结果可能只是少一次 fill，但 inventory system 具有反馈。少一个 BUY exposure fill 可能减少 LONG，也可能减少对已有 SHORT 的 repair；随后 quote role、cooldown、inventory guard 与 campaign identity都会改变。不能只看被取消订单的 10 秒 markout，就推断组合终局。

因此 q90 portfolio attribution 把 action 视为一条 full-path policy toggle：同一历史 market path、latency path、P3、queue calibration、cooldown、loss guard、size 与 inventory limit 下，只改变 q90 ON/OFF。arms 一旦 inventory path 分叉，campaigns 独立重建，不再强行匹配同名 campaign。

主 contrast 为 paired daily effect：

$$
\Delta_m
=
\frac{1}{D}
\sum_{d=1}^{D}
\left(m_{d,ON}-m_{d,OFF}\right).
$$

不确定性按 UTC day cluster 重采样，保留同日共同市场 shock 与多个 campaign 的依赖。

### 2. 预注册的四段机制链

完整 hypothesis 不是“BUY cancels 增多”，而是：

$$
q90\ ON
\rightarrow
\Delta BUY\ exposure<0
\rightarrow
\Delta(SELL-BUY)>0
\rightarrow
\Delta SHORT\ share>0
\rightarrow
\Delta multiSHORT>0
\rightarrow
\Delta terminal\ MTM<0.
$$

冻结 contract 要求所有核心 links 同时通过。中间一段显著不能补偿后一段失败；terminal harm 又需要 upper bound 低于零，而不是点估计为负。

这种 joint gate 防止研究者只挑一个符合故事的 mediator。一个 policy 可以改变 side activity，却被后续 reducing fills、campaign repair 或其它 feedback 抵消。

#### 2.1 为什么一条链不能靠单个显著 link 成立

将各段写成粗略的局部变化率，terminal effect可以示意为

$$
\frac{\partial MTM_T}{\partial q90}
=
\frac{\partial BUYfill}{\partial q90}
\frac{\partial imbalance}{\partial BUYfill}
\frac{\partial SHORT}{\partial imbalance}
\frac{\partial multiSHORT}{\partial SHORT}
\frac{\partial MTM_T}{\partial multiSHORT}
+R,
$$

其中 $R$ 汇总 SELL fills、reducing fills、quote recenter、cooldown、campaign duration和terminal mark等其它路径。这个式子不是用来做线性估计，而是提醒我们：第一段方向正确，不代表乘积的后续项非零，更不代表 $R$ 不会抵消。当前证据只较清楚地支持 imbalance这一段；SHORT share、multi-level与terminal三段均未闭合。

因此“q90减少 BUY，所以一定造成 SHORT”是把 flow当成stock。库存是历史成交的累积状态，BUY既可能增加 LONG，也可能减少 SHORT；SELL同理。只有把初始库存、fill role与campaign边界一并纳入，才能知道 side flow改变最终落在哪个库存状态。

### 3. 数据、arms 与 causal boundary

primary panel 是 24 个 Grade-A Development 日，16 个 Grade-B 日只作 sensitivity。两个 arms 使用同一 native snapshot/delta book、strict exact-price queue、individual execution trades 与 deterministic latency path。initial state、model、P3、queue calibration、cooldowns、size 和 risk limits 绑定不变。

q90 scorer 的 Python/C++ kernel 在使用点 fail-fast lockstep，但完整 tick replay以 Python 为 authority。这个边界不能写成“全 C++ replay parity”。

action 后 campaign path 可以不同，因此 outcome 在每个 arm 内独立 accounting。最大 absolute campaign accounting error 为 $3.69\times10^{-13}$ USDC，native event denominator在所有日、两 arms间一致。

Validation 与 sealed holdout 没有读取。fixed q90 model 与 Development存在训练/选择 overlap，所以这项研究是机制 attribution，不是 independent policy validation。

### 4. Grade-A primary：只有 side imbalance 通过

| Metric，ON − OFF | Estimate | 95% day-cluster interval | Gate |
|---|---:|---:|---|
| Terminal MTM, USDC/day | +0.09470 | [-0.23214, +0.45084] | no harm evidence |
| Closed campaign value, USDC/day | +0.09061 | [-0.23923, +0.44908] | diagnostic |
| BUY exposure fills/hour | -0.22744 | [-0.45487, +0.00173] | fail |
| SELL exposure fills/hour | +0.20313 | [-0.00521, +0.41494] | diagnostic |
| SELL-minus-BUY fills/hour | +0.43057 | [+0.00869, +0.85418] | pass |
| SHORT campaign share | +0.00851 | [-0.00247, +0.01922] | fail |
| Multi-level SHORT share | -0.00124 | [-0.00633, +0.00386] | fail |
| Multi-level rate among SHORT | -0.00630 | [-0.01597, +0.00324] | diagnostic |
| Multi-level SHORT value, USDC/day | -0.12788 | [-0.33732, +0.05815] | diagnostic |

BUY suppression 的 upper endpoint 仅为 $+0.00173$，但冻结 gate 是单侧不跨零；“差一点”仍是失败。即使把这一 link宽松视为方向性成立，SHORT share 与 multi-level share 也没有正下界，terminal harm 更没有出现。

这说明 exposure-flow imbalance 与 campaign-stock distribution 不是同一 estimand。fills/hour 的 side difference 可以改变，但 campaign birth、repair 与 flatting 的 nonlinear path可能吸收它。

#### 4.1 一个数值路径说明为何 flow 增加不等于 SHORT 增加

假设某日 OFF arm 有 100 次 BUY exposure fills与100次 SELL exposure fills，side imbalance为0。ON arm因 q90少了3次BUY fills、同时多了2次SELL fills，imbalance于是增加5；但若被取消的3次 BUY里，两次原本会增加 LONG、只有一次会修复 SHORT，而新增的2次 SELL都发生在已有 LONG 上并把库存推回 flat，那么最终 SHORT campaign数未必增加。

反过来，即使 SHORT campaign share增加，multi-level share也可能下降：policy可能制造更多很浅、很快被修复的单层 SHORT，同时减少少数长期累积的深层 SHORT。terminal MTM又同时取决于进场价、持有时间、repair价格与窗口末端标记。因此表中的五列不是同一事实的重复指标，而是同一机制故事中不可互换的状态转移。

### 5. Grade B 与 all-40 为什么不能救 primary

Grade B 的 terminal-MTM effect 是 $+0.70306$ USDC/day，区间 $[+0.22705,+1.22846]$。multi-level SHORT share 增加，但 overall SHORT-share 与 exposure-imbalance intervals 都跨零。它的机制方向与 Grade A并不完整一致。

全 40 日 descriptive effect 为 $+0.33804$ USDC/day，区间 $[+0.04751,+0.65533]$。aggregate terminal MTM 从 OFF 的 $-192.16901$ 变为 ON 的 $-178.64726$ USDC。

这些正值不授权 q90。Grade B 预注册为 sensitivity，不能覆盖 Grade-A joint mechanism failure；all-40 pooled result又混合 evidence roles。固定模型与 panel 重叠，且 action intensity 未 transport。把描述性少亏写成“q90 profitable”会越过三道边界。

### 6. Treatment strength：历史 replay 与 operational diagnostic 相差约 190 倍

q90 ON replay 产生：

- 25,555,868 score evaluations；
- 105 cancel requests 与 105 cancel ACKs；
- 104 re-entries；
- 34/40 日有 cancel activity；
- Grade A 57 requests，Grade B 48；
- 0 pending-cancel fills。

959.963 小时对应约 0.109 requests/hour。独立冻结的 120 小时 operational diagnostic 有 2,501 requests，约 20.84/hour。若 counters 语义可比，差异约 190 倍。

这意味着 portfolio result 的外推对象非常有限。历史 replay回答“低频 fixed q90 在这 40 日是否形成完整 bias chain”；它没有回答高强度 operational behavior 的 causal effect。差异可能来自 market regime、receive/feature clock、runtime state 或 denominator semantics，不能只归因给模型阈值。

后续 causal-clock audit确实发现 mixed-clock defect，但不能倒写本篇 economics：clock repair 改变 treatment denominator，需要新的完整 action identity，而不是重加权旧 105 cancels。

#### 6.1 为什么不能把 105 次动作简单乘以 190

若 policy effect对动作次数线性，或许可以把低频 replay的每次 cancel value外推到高频环境。但 active-order策略具有明显干扰：一次 cancel改变后续是否有订单、queue位置、fill、inventory与下一次可触发机会。第 $k$ 次 action的反事实依赖前 $k-1$ 次 action，因而

$$
Y(A_1,\ldots,A_K)
\ne
Y(0)+\sum_{k=1}^{K}\{Y(A_k)-Y(0)\}.
$$

190倍差异也可能不是同一个 denominator上的频率差，而是 valid-risk-set、role定义、terminal hold或receive clock不同。最安全的结论不是“真实效应会放大190倍”，而是旧 40 日 paired effect不具备目标强度 transport。新的研究必须先复现目标 action-rate与role mix，再重新跑完整路径。

### 7. 为什么 terminal MTM 是必要但仍不充分的终点

terminal MTM 保留 cash、remaining inventory 与 terminal mark：

$$
E_T=cash_T+inventory_T\cdot mark_T-fees_T.
$$

它避免把未关闭库存当作 realized zero，也避免只用 30 秒 markout判断长期 harm。但一个 daily terminal delta仍可被少数日和 window endpoint影响，因此研究同时报告 closed campaign value、multi-level SHORT value、share 与 day-cluster interval。

Grade A terminal point estimate为正、区间跨零，所以既没有 harm evidence，也没有稳定 benefit evidence。正确读法是 uncertain，不是“q90 改善 PnL”。

### 8. 研究支持了什么、没有支持什么

支持：q90 ON 在冻结 Grade-A replay上增加 SELL-minus-BUY exposure-fill imbalance；full-path mechanics 具有 nonzero treatment；paired day accounting 与 native event denominator闭合。

不支持：BUY exposure suppression 的冻结单侧门、更多 SHORT campaigns、更多 multi-level SHORT campaigns、terminal harm、当前 operational policy effect。

不能从本结果推导的决策包括：keep q90、remove q90、rollback、调 threshold、把 BUY filtering 改成 SELL filtering，或将 all-40 descriptive少亏当成 promotion evidence。

#### 8.1 四种容易混淆的结论

“没有证明有害”不是“证明无害”；区间跨零意味着当前分辨率下两种方向都仍可能。“全40日少亏”不是“Grade-A primary通过”；后者是预注册证据角色，前者混入 sensitivity days。“imbalance通过”不是“完整机制通过”；joint hypothesis要求链条闭合。“paired replay”也不是“独立OOS”；模型选择与Development overlap仍然存在。

把这四层分开，文章得到的是一张机制地图：q90确实能够改变订单流方向，但在当前低强度路径上，这个改变没有稳定地传到 campaign结构或terminal harm。这个结果有研究价值，因为它排除了最简单的单调故事，同时告诉下一轮实验应把精力放在action transport与库存状态转移，而不是重复证明 scorer能发cancel。

### 9. 最终状态与权限

最终结论为

$$
\text{q90 portfolio bias mechanism not supported on Development}.
$$

Validation 与 sealed holdout 未读；action、live、automatic rollback 与 baseline update 均未授权。项目也没有解释另一个历史 240 小时窗口中的 SHORT concentration，因为 frozen replay action rate未 transport。

若未来重开，必须先完成 causal clock/lifecycle mechanics 和 exact action-rate transport，再冻结新的 ON/OFF economics；不能用修复后的 clock 去修改已完成的旧 report。

### 中介链报告不是自动的因果 mediation

fills imbalance、SHORT share与multi-level share都是action后的变量，彼此还受共同market path与inventory feedback影响。分别对每个link做paired effect可以检查机制故事是否方向闭合，却不能把乘积解释为自然间接效应；那需要更强的sequential ignorability或专门随机化。

本篇用joint gates的目的更克制：若连必要方向都未出现，完整单调故事就不受支持；某一link通过则只说明action确实改变该层。它没有声称0.43057的imbalance增量“造成”多少terminal MTM。

### Target-rate transport 应怎样重做

在clock/lifecycle修复后，先冻结目标运行环境的valid-risk fraction、cancel/hour、role mix、score quantiles与re-entry率区间；历史replay必须在不看economics时达到这些mechanics gates。若达不到，应解释source/regime差异或构造明确的随机ized dose，而不是缩放旧结果。

通过后再以q90 OFF、目标强度ON和必要的低强度diagnostic组成paired full path。这样可以估计dose非线性，而不是假设105 actions与高频环境成比例。

### Initial state 与终局窗口

daily fresh start可能低估连续live中继承的SHORT、active orders和cooldown；restart-aware replay又需要可信initial artifact。两种身份应分开报告。terminal MTM必须对未平库存mark-to-market，不能通过窗口末端强平制造收益。

因此新结果即使通过，也只对其initial-state contract有效；不能把fresh-start40日直接解释为当前连续运行效应。

### 10. 公共证据

- [BUY q90 Portfolio Path Attribution v1](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/buy_q90_portfolio_path_attribution_v1_development_20260731.md)
- [F10 Live/Replay Attribution README](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/README.md)
- [BUY q90 Causal Visibility Clock Parity v1.1](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f10_live_replay_attribution/docs/buy_q90_causal_visibility_clock_parity_v1_1_development_20260731.md)

公开仓库提供 aggregate daily effects、mechanism gates 与 transport boundary；per-day arm rows 和 owner-side reports 不随仓库分发。

## 6. Ranked-toxicity carryover-safe guard

### TL;DR：一日生命周期 plumbing 通过，40 日 mechanics 与任何经济结论都还没有

这项研究尝试把 causal-v12 的 side-specific toxicity rank 变成一个真正的 active-order action：在 exposure-increasing BUY 或 SELL quote 的 score 穿越 past-only p90 时，candidate 只取消当前风险订单一次，等待 cancel ACK，把旧订单移出 fill-risk set，随后持续抑制 exposure quote；直到下一个 completed 10-second score 低于当日冻结 p90，才以新 queue、age 与 order identity re-enter。reducing quote 永远 bypass。

最初的 campaign-side assignment 不能安全处理跨边界仍存活的 active order。carryover-safe v2 因此把 ownership 与 exchange-live order 绑定，并允许一个真实角色转移：订单提交时是 reducing，inventory 变化后在仍 active 且 fill-risk-active 的情况下变为 exposure；它保留 queue 和 assignment owner，而不是强制 washout。

冻结一日 smoke 的 untreated baseline 有 29,072 decisions，candidate 全部消费。BUY/SELL 各 337 episodes、336 complete、1 censor；carryovers 58/50，SELL 有 1 次合法 active-order role transition；cross-arm ownership、forced washout cancel、owner mismatch 与 terminal risk-set reuse 都为零。v2.2 plumbing 因而通过，但正式 40 日 mechanics 未运行，PnL、reward、markout、Validation 与 sealed holdout 全部未读。本文的结论是**因果动作与所有权合同可实现**，不是支持、价值或部署结论。

![Ranked toxicity guard 的 ACK 与 carryover 状态机](/images/narrowgate/ranked-toxicity-exposure-guard.svg)

*图 1：机制示意。p90 crossing 只发一次 cancel；ACK 才把旧 order 移出风险集。campaign 边界不能冲掉仍 live 的 owner，role 也可随 inventory 合法转移。*

![Persistent guard 的 campaign action 与 ownership 路径](/images/narrowgate/f09-campaign-action-causal-path.svg)

*图 2：rank crossing 只是 trigger。candidate 经 cancel pending、ACK、suppression、release 与 fresh re-entry 形成完整路径；ownership 必须跨 campaign 边界保持，mechanics 通过后才能读取 selectivity 与 economics。*

### 1. 研究问题：预测毒性之后，究竟对哪一张订单做什么？

toxicity score 可以排序未来 adverse flow，但 maker action 不是把 score 写进日志。订单可能已经 active、有 queue position、正在 cancel pending，甚至在 inventory 变化后从 reducing 变成 exposure。研究问题是：一个 past-only ranked score 能否定义一条无 ownership 泄漏、无 terminal reuse、可随机化的 persistent permission path？

BUY 与 SELL 是独立注册 identity，因为 `tox_bid` 与 `tox_ask` 的风险面不同；它们共享同一主文章，因为 rank denominator、state machine、所有权修复与证据边界一致。未来经济 estimand 才会分别是：

$$
\tau_s=E[Y_s(\text{ranked guard})-Y_s(\text{baseline})],\qquad s\in\{BUY,SELL\}.
$$

当前阶段没有读取 $Y_s$，所以不能报告 $\tau_s$ 的符号、大小或 interval。

### 2. Past-only rank denominator

当日 p90 只使用严格更早 UTC days，并且每个 completed 10-second prediction bucket 只取第一条 causally visible eligible row。row 必须满足 matching side、baseline quote permission、exposure-increasing role（opener 或 add）与：

$$
t^{feature}_{ready}\le t^{decision}.
$$

经验阈值为：

$$
c_{s,d}=Q_{0.90}\left(\{z_{s,b}:day(b)<d,\ b\text{ eligible completed bucket}\}\right).
$$

重复的 100ms main-loop evaluations 不进入 CDF，否则高频重复会给慢变 score 过高权重。阈值在整个 UTC day 冻结；更早数据少于 5 日或 500 buckets 时没有 fallback。缺阈值就没有 candidate action，不能用当天数据补齐。

baseline 是 exact operational v5：causal-v12 enabled、q90 shadow enabled/action disabled、BUY fill-selection 在两臂相同、raw toxicity threshold disabled。关闭 BUY fill-selection 会构成不同 baseline，不能为本项目提供 promotion evidence。

#### 2.1 为什么 rank 比 raw score 更可运输，又不是免费的

past-only p90 将不同日期的 score scale映射为相对尾部，减少模型校准漂移对阈值的影响。若 score做单调变换，rank基本不变；raw threshold则会改变 action rate。

但 rank仍依赖 denominator。若把 100ms循环中同一个 10秒 score重复 100次，慢变状态会按运行频率加权；只取 completed bucket的第一条 eligible row，才让经验 CDF以信息更新为单位。若 eligibility本身受 candidate影响，又会发生 treatment-dependent threshold，因此阈值只从 untreated历史构造并整日冻结。

#### 2.2 五日/500 bucket warmup为什么 fail closed

少量历史下 p90易被一两个极值决定，且无法覆盖日间 regime。没有足够过去数据时回退固定 0.8，看似保持动作可用，却把 plumbing threshold偷换成预测阈值。冻结合同宁可不触发，也不借当天分布补种。

这意味着 early days或 source gap会减少 action opportunities，正式 mechanics必须将其计入 denominator。不能只在有阈值的日期报告漂亮 action rate，再称为全期支持。

### 3. 动作、输入与未来 estimand

状态机冻结为：

```text
BASELINE --p90 crossing--> GUARD_ACTIVE
GUARD_ACTIVE --cancel once--> CANCEL_PENDING
CANCEL_PENDING --cancel ACK--> SUPPRESSING
SUPPRESSING --next completed score < p90--> RELEASED
```

| 元素 | 冻结语义 |
|---|---|
| Assignment | prospective campaign-side lineage，0.5/0.5，仅一次 |
| Trigger | completed 10s side score 穿越 past-only p90 |
| Immediate action | 对 active exposure order 发一次 cancel |
| ACK boundary | ACK 后旧 order 才退出 fill-risk set |
| Suppression | 后续 exposure opener/add 不报价 |
| Release | 下一 completed score 低于 frozen p90 |
| Bypass | reducing quotes 永远不受 guard |
| Re-entry | 新 order id、age=0、新 queue lifecycle |

未来两阶段读取中，stage one 只能读 opportunity、assignment、cancel/ACK、state transitions、support、propensity、ESS 与 final-action mechanics；只有全部 gates 通过，新的 hash-bound execution spec 才可能打开 Development economics。BUY/SELL 必须分别通过，禁止 pooled promotion。

### 4. ACK 是风险集边界，不是日志装饰

假设 active SELL exposure order 在 p90 crossing 时收到 cancel request。request 到 ACK 之间仍可能被 fill，所以它仍属于风险集：

$$
R_i(t)=\mathbf1\{t_{activate,i}\le t<t_{ack,i}\ \land\ order_i\text{ exchange-live}\}.
$$

只有 $t\ge t_{ack}$ 才能把旧 queue、age、hazard 与 depth cursor 清除。若 score 先恢复，也不能把 cancel-pending order 当作从未存在；re-entry 必须等生命周期合同完成。

这条边界避免一个常见乐观偏差：candidate 发出 cancel 就立即删除未来 fill，而 control 继续承担 ACK latency risk。严格 replay 必须允许 cancel-request/ACK race 的真实结果。

### 5. 为什么 v1 的 campaign 边界不够安全

订单生命周期可能跨 campaign-side assignment boundary。若新 assignment 到来时旧 active order 仍可成交，强制把它洗掉会改变 market path；把它交给新 arm 又会产生 cross-arm contamination。carryover-safe identity 因而将 assignment owner 延续到 active risk set 终止。

更隐蔽的情况是 role transition。某订单提交时是 reducing SELL，之后其他 fill 改变 inventory，使同一 exchange-live order 变为 exposure-increasing。旧 adapter 把 submit-time role 当永恒常量，于是错误 fail。修复只允许在 order 仍 active、exchange-nonterminal、`fill_risk_active=true` 且 owner 相同的情况下发生：

$$
role_i(t^-)=reducing,\quad role_i(t)=exposure,
$$

并写入显式 journal event；queue 与 owner 不重置。unknown、terminal 或已离开风险集的 order 仍立即 fail-fast。

#### 5.1 Assignment owner 与当前 inventory role 是两个维度

owner回答“这张订单由哪次随机 assignment创建并负责”；role回答“按当前 inventory，这张仍 active 的订单成交后会增加还是减少暴露”。前者在订单终局前不可变，后者可能随其它 fills改变。

可写成：

$$
owner_i(t)=owner_i(t_{submit}),\qquad t<t_{terminal},
$$

$$
role_i(t)=r(side_i,q_t,remaining_i).
$$

把 role冻结在 submit，会错过合法 transition；按新 campaign重写 owner，又会让新 arm控制旧 arm创建的 queue option。carryover-safe adapter必须同时维护这两个状态。

#### 5.2 为什么不能强制 washout

在 campaign flat 时强制取消所有旧单，确实能让 assignment边界整齐，但它本身是额外动作，会改变 fill、queue与下一 campaign。若只在 candidate或边界附近发生，就污染 treatment contrast。

自然 washout要求 owner延续到所有 owned exchange-live orders和guard state终止；最后未终止 episode右 censor。这样牺牲一点样本整齐度，保留真实市场路径。58/50 carryovers说明这不是理论角落，而是常见 lifecycle事实。

### 6. 研究演进：失败记录为什么不能拆成新项目

v1.1–v1.5 的 full-path adapter 尝试逐步发现 ownership、terminal risk set 与 role contract；它们是同一 frozen action 的实现审计。carryover-safe v2 一日 smoke 修复 role transition 后通过。v2.1 尝试复用旧 baseline tape，却在 prediction warmup 前发现 current loader 下 candidate 与 untreated baseline identity 不再相等，输出 0B，fail-safe 关闭。

v2.2 不偷继承旧 tape，而是在相同 current loader、read-only replay-cache DAG 与 code identity 下重新生成 untreated baseline shadow 和 candidate path。冻结 0.8 threshold 仅为 plumbing，不具预测或动作含义。spec/attempt/version 的变化解决的是执行可比性，没有改变科学 action，因此全部合并在本文。

### 7. 一日冻结 mechanics 结果

2026-04-17 baseline 29,072 decisions，candidate 29,072，unconsumed 0。结果：

| Contract counter | BUY | SELL |
|---|---:|---:|
| Episodes | 337 | 337 |
| Completed | 336 | 336 |
| Censored | 1 | 1 |
| Carryover transitions | 58 | 50 |
| Active-order role transitions | 0 | 1 |
| Baseline-shadow mismatch | 0 | 0 |
| Cross-arm ownership | 0 | 0 |
| Forced washout cancel | 0 | 0 |
| Order-owner mismatch | 0 | 0 |

role lifecycle 与 carryover lifecycle 都 valid，cache writers 全关闭、write attempts 为零。21 个 v2.2/v2.1/carryover assignment tests 通过；较早 targeted regression 49 tests 也通过。

这些数字只证明 one-day plumbing。337 episodes 不是正式 support denominator，0 ownership violation 也不能估计 40 日 action rate、ESS 或 value。尤其不能拿 plumbing threshold 0.8 替代 past-only p90。

#### 7.1 Smoke test 能证伪什么，不能估计什么

一日 smoke足以发现 deterministic contract defect：未消费 baseline row、cross-arm owner、terminal后复用、forced cancel、role transition失败。只要出现一次，就说明 adapter不安全。零次则仅说明这一天没有观察到违反，不给稀有失败率一个强上界，更不证明其它 regime。

它也不能估计 p90 action support，因为使用0.8 plumbing threshold；不能估计 value，因为 outcome字段未读；不能证明 current baseline parity，因为绑定历史v5 snapshot。把 smoke称为“策略回测通过”会跨越三个证据层。

#### 7.2 正式 mechanics 应报告的 selectivity funnel

40日 stage one至少要报告：past-only threshold可用 opportunities、rank crossings、active-order cancels、ACK前 fills、suppressed quote decisions、fresh re-entries、assigned quantity、retained fills与missing-label worst-case bounds。BUY/SELL分开，并按日给 propensity与ESS。

只有 action rate适中、quantity denominator闭合、reducing bypass零违反、candidate不是 broad shutdown，才允许打开 terminal economics。预测 score很强不能替代这些机械条件。

### 8. 不确定性与关闭/支持边界

当前状态不是“经济失败”，而是“formal mechanics not run”。已支持的是：rank denominator 可定义、ACK/riskset 与 carryover owner 可执行、一日 baseline/candidate consumption 对齐。未支持的是：40 日机会率、action selectivity、quantity-based fill retention、Development reward/tail、live transport。

future selectivity 必须以 common assigned-quantity denominator 计算。missing 10-second BBO labels 保留在 denominator 并使用对 candidate 不利的 censoring bound，不能删除 missing rows 获得漂亮 retention。

旧 operational v5 baseline 本身后来有 lifecycle repair，但 local repair 不构成 deployed runtime parity。prospective placement recovery、full transport 与 live parity 仍 unsupported，ranked guard 不能借 q90 repair 获得 action authority。

#### 8.1 当前状态为什么是“未完成”，不是正面或阴性经济结果

formal mechanics 尚未运行，所以 action可能支持不足、过度抑制、选择性良好或完全无效；当前都不知道。经济字段未读，也就没有 reward符号。唯一已建立的是动作状态机在一日历史路径上能维持所有权与终局不变量。

把未完成写成 closed-negative会抹掉真实工程进展；写成 promising alpha又会越级。最精确状态是 mechanics plumbing passed on one-day smoke，formal support/economics unopened。

#### 8.2 这项 plumbing 对其它动作有什么公共价值

carryover-safe ownership不只服务 toxicity guard。任何 campaign-level随机 action，只要订单可跨 flat或role可随 inventory变化，都需要同一原则：exchange-live order保留创建 arm，role动态计算，terminal后才释放 owner。

这类基础设施可以复用，经济证据不能复用。另一个 action继承 adapter parity，不等于继承本 guard的 p90、support或value；它仍需自己的 assignment与结果门。

### 9. 没有获得的权限

- 正式 40 日 mechanics 尚未运行；
- PnL、reward、markout、toxic fills 与 campaign tails 未读；
- Validation 与 sealed holdout 未读；
- 没有 shadow、action、live 或 q90 authority；
- 没有把一日 0.8 plumbing threshold 当作预测阈值；
- 没有从零 ownership violation 推出正经济价值。

### Rank transport 的优势和隐藏状态

past-only percentile rank把不同模型版本或regime的raw score压到相对位置，能减弱尺度漂移。但rank依赖reference denominator：过去哪些日进入、窗口多长、按side还是按role、missing bucket怎样处理。denominator变化会让同一raw score得到不同rank，所以它本身是有状态的online estimator。

设过去合法scores经验CDF为$\hat F_{t^-}$，当前rank为

$$
r_t=\hat F_{t^-}(s_t).
$$

必须先冻结$\hat F$再评当前$s_t$；若把当前bucket或未来日加入denominator，就会轻微lookahead。warmup不足时fail closed保护了语义，但也会选择性删除新regime开头，正式mechanics需报告这些invalid rows集中在哪里。

### Exposure guard 的 assignment owner 与动态 role

一张订单在assignment时可能是exposure-increasing，之后库存因另一侧fill改变，它在当前时刻变成reducing。若guard按动态role立即释放，treatment duration依赖其它订单；若按assignment owner保持，可能继续保护一张现在有修复价值的单。两种都合理，却是不同policy。

因此lineage需同时保存`assignment_owner_role`与`current_inventory_role`，并预注册terminal/release规则。campaign边界也不能靠强制washout制造独立样本；自然flat或明确terminal state才结束经济路径。否则guard可能通过删除跨窗口尾部看起来更安全。

### 从 one-day plumbing 到 40-day scorecard

正式mechanics至少要给eligible→rank valid→threshold hit→quote changed→order active→fill/cancel→campaign terminal的selectivity funnel，并按side、role与day报告。只有action exposure充分且不被少数日期支配，才允许读取terminal value。

经济阶段应比较guard ON/OFF的paired full path，并预注册mean、tail、fills retention和inventory-time gates。若rank只在action intensity上transport、value不通过，结论仍是不晋级；若mechanics本身不足，则状态是incomplete而非negative。当前一日结果只证明state/ACK plumbing可工作，离这两种正式结论都还有距离。

### 10. 公共证据

- [`causal_v12_ranked_toxicity_exposure_guard_v1_registration_20260802.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/causal_v12_ranked_toxicity_exposure_guard_v1_registration_20260802.md)
- [`causal_v12_ranked_toxicity_exposure_guard_carryover_safe_v2_implementation_20260803.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/causal_v12_ranked_toxicity_exposure_guard_carryover_safe_v2_implementation_20260803.md)
- [`causal_v12_ranked_toxicity_exposure_guard_carryover_safe_v2_2_execution_result_20260803.md`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/docs/causal_v12_ranked_toxicity_exposure_guard_carryover_safe_v2_2_execution_result_20260803.md)
- [`F09 README`](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f09_campaign_action_uplift/README.md)

### 结语

这项研究最重要的进展不是 score，而是把订单所有权当作因果合同：cancel request 不是终点，campaign boundary 不是 washout，submit-time role 也未必永恒。一日 plumbing 已把这些边界跑通；在 40 日 mechanics 与 economics 之前，除此之外没有更强的结论。

![Exposure Guard 从经济关闭到身份撤回与 carryover plumbing 的结果收敛](/images/narrowgate/exposure-guard-research-synthesis.svg)

*图：经济失败、证据身份失效、描述性归因和仅完成 plumbing 是四种不同状态，不能组合成一条虚假的 live 授权链。*

## 8. 合并后的结论：一个 guard 经济关闭，一个 guard 身份失效，一个 guard 只完成 plumbing

三个阶段不能互相借权限。Role-safe add-only 的完整 replay 已显示经济伤害；BUY q90 的旧 clock/risk-set identity 失效，历史 portfolio 诊断也没有闭合完整中介链；ranked-toxicity successor 修复的是阈值可比性、persistent state、cancel ACK 与 carryover ownership，目前只有 outcome-blind smoke。后者更严谨，不代表前两者的结果消失，也不代表新动作已经有 prediction 或 economic support。

正式 successor 仍需完成冻结 mechanics panel、证明 action-path divergence 与 support，再注册独立 randomized economic identity。任何 live guard 都不能从一次 smoke、一个分位触发率、一次 fill-imbalance 变化或历史 `BER` 名称推出。
