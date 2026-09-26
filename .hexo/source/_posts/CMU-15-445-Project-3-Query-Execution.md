---
title: 'CMU 15-445 Project 3: Query execution'
date: 2022-05-16 14:09:17
tags:
- CMU 15-445
categories:
- 数据库
---

#### TASK #1 - SYSTEM CATALOG

在这个任务中，我们会修改`rc/include/catalog/catalog.h`以允许 DBMS 将新表添加到数据库并使用名称或内部对象标识符 ( `table_oid_t`) 检索它们。

我们在最新的BusTub中可以看到`catalog`的实现，但是这个版本只能实现通过6个测试，

先来看看`TableInfo`的结构体：

```c++
struct TableInfo {
  /**
   * Construct a new TableInfo instance.
   * @param schema The table schema
   * @param name The table name
   * @param table An owning pointer to the table heap
   * @param oid The unique OID for the table
   */
  TableInfo(Schema schema, std::string name, std::unique_ptr<TableHeap> &&table, table_oid_t oid)
      : schema_{std::move(schema)}, name_{std::move(name)}, table_{std::move(table)}, oid_{oid} {}
  /** The table schema */
  Schema schema_;
  /** The table name */
  const std::string name_;
  /** An owning pointer to the table heap */
  std::unique_ptr<TableHeap> table_;
  /** The table OID */
  const table_oid_t oid_;
};
```

我们可以看看`catalog`的成员变量：

```c++
  std::unordered_map<table_oid_t, std::unique_ptr<TableInfo>> tables_;//无序map,也就是表信息集合
  std::unordered_map<std::string, table_oid_t> table_names_;//表名集合
//这里我们可以看出寻表是表名->oid->表信息
std::atomic<table_oid_t> next_table_oid_{0};//用atomic类来做多线程编程
//index与上述结构相似
std::unordered_map<index_oid_t, std::unique_ptr<IndexInfo>> indexes_;
std::unordered_map<std::string, std::unordered_map<std::string, index_oid_t>> index_names_;//在index_names_中，是以<string,<string,index_oid_t>>作为结构，第一个string是index的name，第二个string是
std::atomic<index_oid_t> next_index_oid_{0};
```



```
  /**
   * Create a new table and return its metadata.
   * @param txn The transaction in which the table is being created
   * @param table_name The name of the new table
   * @param schema The schema of the new table
   * @return A (non-owning) pointer to the metadata for the table
   */
```

从上面的注释可以看出，`CreateTable` 的核心并不复杂：先为表分配新的 `table_oid_t`，再用表名、schema 和 `TableHeap` 构造 `TableInfo`，最后同时维护 `tables_` 和 `table_names_` 两个索引结构。需要注意的是，`table_names_` 负责从表名查到 OID，`tables_` 负责从 OID 查到真正的元数据，两者必须保持一致。

#### TASK #2 - EXECUTORS

Query Execution 这一部分的重点是把逻辑计划节点落实成可以迭代执行的 executor。BusTub 的 executor 通常都遵循 `Init()` + `Next(Tuple *tuple, RID *rid)` 的模式：`Init()` 负责初始化子 executor 或内部状态，`Next()` 每次产出一条结果，直到返回 `false`。

比较容易出错的点有三个：

1. `SeqScanExecutor` 不只是遍历表，还要应用 predicate，并且返回的 tuple schema 要和计划节点保持一致。
2. `InsertExecutor`、`UpdateExecutor`、`DeleteExecutor` 不只是改表数据，还要维护相关索引，否则后续查询会读到不一致的结果。
3. 聚合和 join executor 需要先想清楚“拉模型”的执行顺序。比如 hash join 通常先把一侧构建成哈希表，再由另一侧驱动匹配；aggregation 通常先消费完子 executor，再按 group key 输出结果。

#### 小结

Project 3 的难点不在单个函数，而在执行器之间的契约：每个 executor 都通过 `Next()` 向上层交付 tuple，上层不应该知道下层是顺序扫描、索引扫描、连接还是聚合。只要保持这个接口稳定，复杂查询就可以由多个简单 executor 组合出来。这也是数据库执行层最重要的抽象。

