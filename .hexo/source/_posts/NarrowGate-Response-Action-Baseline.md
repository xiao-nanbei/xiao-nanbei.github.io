---
title: 'NarrowGate B0_RESPONSE：407 日响应动作研究完成，不等于 live 验收完成'
date: 2026-10-08 16:00:00
updated: 2026-10-08 16:00:00
categories:
- Market Making
tags:
- Market Making
- Action Value
- 订单生命周期
math: false
---

## 先区分研究身份

`B0_RESPONSE_20261007` 来自冻结主候选 `TRADE_BOOK_RESPONSE_VALUE`，是后续研究基线，不是旧 B0 的重命名。历史旧 B0、主候选和信息消融结果均保留原身份。[历史 Side-Taker Lifecycle](/2026/08/29/NarrowGate-Side-Taker-Flow-Research/)的 hazard 路线和[U0/U1 订单评价时机](/2026/08/29/NarrowGate-Active-Order-Queue-Value-Keep-Cancel-Research/)也不因此变成成功或获得晋升。

## 完整结果：204 个独立账户，而非连续 407 日

150 个两日 Development 账户及 54 个 Final 账户覆盖 407 日。Final 包含 53 个两日账户及最后一日，复用原主候选完整结果一次，不是重新跑一次复现。完整结果已收回本机归档，通过模型、授权源码、计算耗时、输入、账户边界、终点 cut 和 accounting 绑定验收。归档没有迁往外置存储。

下表重新汇总完整账本，不用早期部分进度金额。单位收益按合计 PnL 除以合计成交量／成交额计算。

| 区间 | 账户／日数 | 净 PnL（USDC） | 每 BTC 净收益（USDC） | 每万 USDC 成交额净收益（USDC） |
| --- | ---: | ---: | ---: | ---: |
| Development | 150／300 | -1414.486011 | -6.518970 | -0.716277 |
| Final，单次复用 | 54／107 | -188.545171 | -4.222452 | -0.616426 |
| 合计 | 204／407 | -1603.031182 | -6.127022 | -0.702886 |

合计成交量 261.633 BTC，成交额 22,806,427.3226 USDC，完整会计包括费用、真实资金费与期末库存 MTM。结果仍然亏损；少亏不是正收益。Development 包含训练日，Final 有评价和晋升的 previous-use，因此这不是全样本外验证。模型的 `final_used=false` 仅表示拟合没有使用 Final，不能抹掉后来的使用。

## 模型改变什么

冻结标准化 Ridge 使用 47 特征，预测建模动作标签，不直接预测全账户 PnL。历史消融仅删除四个恢复历史量及四个缺失标记，保留 39 特征，不是删掉所有主动成交历史。必要输入缺失要回退，恢复锚点缺失保留原编码；不可统一补零制造覆盖。

候选在真实旧订单价格取响应特征，正分 UPDATE、负分 KEEP、零分沿用原判断，仅介入可选更新价格意图。原 15 ticks 不再是所有更新的绝对下限，但年龄、pending、数量、库存和强制风险约束不能放宽。决策意图不等于请求，更不等于撤单生效或成交。研究使用可见 ready 时钟，live 使用真实接收／提交时钟；离线模拟计入的响应计算预算不能在 live 再人为 sleep 一次。

## 已有接线与仍需证据

现有路径是 execution_v1 个体 trade → LivePublicSignalEngine → LiveResponseHistory → 报价快照 sequence／盘口 generation → 真实旧价 frame → 冻结响应评分 → 原可选更新价格门槛 → OrderManager 与请求生命周期。它不是普通 aggTrade 路径，也不是等待重新写一个 live 引擎。模型字节、特征顺序、scale、角色、目标范围和 restart-only 配置已有校验。

但合同标识映射不是 47 特征等价证明，合成分段测试也不是交易所端到端验收。必须在同一事件、可见水位、盘口版本和旧单身份下比较原始特征／缺失、标准化、score 与意图，使用真实报价上下文；网络可用 fake gateway，特征和订单状态机不能一起 mock。特别需要覆盖部分成交与撤单竞态、私有 ACK 先于 HTTP、超时未知、拒单、终态承接、订单身份变化及断线重预热。

响应候选拒绝三条不兼容 native 订单规划开关：`NARROWGATE_CPP_LIVE_ROUTING`、`NARROWGATE_CPP_ORDER_ACTION_PLAN`、`NARROWGATE_CPP_FINAL_ORDER_PLAN`；应使用当前支持的 Python 订单规划路径，不是禁用所有 C++。不能复制旧机器环境后仅凭参数相同宣称一致。

sequence／generation 失配回退是在阻止未来状态进入旧决策，不应删掉。应按同一机会联合记录合资格、必要字段、旧价覆盖、版本一致、评分、改变意图、请求及后续阻断，不能把边际计数相乘成覆盖率。约一秒盘口年龄和十秒响应预热的支持范围也不能为了覆盖率随意放宽。

此次补充的离线集成测试实际构造 MakerEngine、LivePublicSignalEngine、报价消费者、OrderManager、库存回调及 cooldown 存储，仅用 fake gateway 替代网络。合成记录贯通了评分、原订单路由、撤单期间部分成交、私有通知先于 HTTP、未知／拒绝结果和终态重新报价；另对照同一可见记录的全部 47 特征、缺失、标准化与评分。定向测试 295 项通过。还修复了一整 tick 的浮点资格误拒，并增加活动订单对象身份检查；不修改历史冻结回测。

这仍是合成模型／消息的离线验收，不是冻结生产模型在真实记录上的全部 47 特征等价证明。生产同一机会联合覆盖率尚未实测，不能从现有边际计数推算。真实 USD-M BTCUSDC 消息、存储准入、重启对账和部署环境仍需单独取证；本次研究不证明交易所已接受订单，也不授权交易。源码测试、工程验证和经济价值必须分开报告。

完整方法、限制与后续验收记录见[仓库双语报告](https://github.com/xiao-nanbei/NarrowGateMaker/blob/main/research/families/f08_side_taker_lifecycle/response_baseline.zh-CN.md)。私有模型、完整参数、购买行情和逐账户账本不公开；证据私有不等于实验未完成。
