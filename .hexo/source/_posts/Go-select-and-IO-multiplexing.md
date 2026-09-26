---
title: Go select 与 I/O 多路复用
date: 2022-04-03 20:05:08
tags:
- Go
- I/O multiplexing
categories:
- Go语言
---

### select

Go 的 `select` 关键字用到了“多路等待”的思想，但它本身不是操作系统层面的 I/O 多路复用，因为 `select` 面向的是 channel，而不是文件描述符。先看下面的例子：

```go
package main

import (
	"fmt"
	"sync"
)
func main() {
	c1 := make(chan int, 1)
	var i1, i2 int
	var count sync.WaitGroup
	count.Add(1)
	go func() {
		defer count.Done()
		select {
		case i1 = <-c1:
			fmt.Println("i1 received from c1", i1)
		case i2 = <-c1:
			fmt.Println("i2 received from c1", i2)
		}
	}()
	c1 <- 1
	count.Wait()
	close(c1)
}
```

当多个 `case` 同时就绪时，Go 会伪随机选择其中一个执行，所以这个例子有时会运行 `i1 = <-c1`，有时会运行 `i2 = <-c1`。这个随机性可以避免固定顺序带来的饥饿问题，但它并不保证公平调度，只能说明程序不能依赖某个 `case` 总是先被执行。

#### 和 I/O 多路复用的关系

操作系统里的 I/O 多路复用通常指 `select`、`poll`、`epoll`、`kqueue` 这一类机制：一个线程同时监听多个 fd，当某个 fd 可读或可写时再处理它。Go 网络库内部确实会使用运行时的 netpoller，在 Linux 上通常对应 `epoll`，在 macOS 上通常对应 `kqueue`。不过这些细节被 runtime 封装起来了，业务代码一般只需要阻塞读写连接，runtime 会在 I/O 未就绪时挂起 goroutine，并在 fd 就绪后唤醒它。

所以可以这样区分：`select` 是 Go 语言层面对多个 channel 操作的等待；I/O 多路复用是操作系统层面对多个 fd 的等待。两者思想相似，抽象层次不同。写 Go 服务时，通常把网络 I/O 交给标准库和 runtime，把业务并发协调交给 goroutine、channel 和 `select`。

### select 的执行语义

`select` 并不是简单地从上到下检查 `case`。它大致遵循这些语义：

1. 先对所有 channel 表达式和发送值表达式求值。
2. 找出当前已经可以执行的 `case`。
3. 如果有多个 ready case，伪随机选择一个。
4. 如果没有 ready case 且存在 `default`，执行 `default`。
5. 如果没有 ready case 且没有 `default`，当前 goroutine 阻塞，等待某个 channel 就绪。

这解释了一个常见误区：`default` 会让 `select` 变成非阻塞轮询。如果在循环里写一个带 `default` 的 `select`，又没有任何 sleep、timer 或阻塞点，就很容易把 CPU 打满。

```go
for {
	select {
	case msg := <-ch:
		handle(msg)
	default:
		// 空 default 会导致忙等
	}
}
```

更好的方式通常是让 goroutine 阻塞在 channel、timer 或 context 上：

```go
for {
	select {
	case msg := <-ch:
		handle(msg)
	case <-ctx.Done():
		return
	}
}
```

### runtime netpoller

Go 的网络 I/O 表面上看起来是一个 goroutine 阻塞在 `Read` 或 `Write` 上，但 runtime 不会为每个连接固定占用一个操作系统线程。当 fd 没有就绪时，runtime 会把 goroutine 挂起，把 fd 注册到 netpoller；当内核通知 fd 可读或可写时，runtime 再把对应 goroutine 放回可运行队列。

在不同平台上，netpoller 背后的机制不同：Linux 常用 `epoll`，macOS/BSD 常用 `kqueue`，Windows 使用 IOCP。业务代码通常不需要直接操作这些系统调用，这是 Go 网络库能够支撑大量连接的重要原因。

可以把这里的分工理解为：

1. 内核负责告诉 runtime 哪些 fd 就绪。
2. runtime 负责把等待这些 fd 的 goroutine 唤醒。
3. 调度器负责把可运行 goroutine 安排到 P/M 上执行。

### select、channel 和网络 I/O 如何配合

网络连接的 `Read`/`Write` 并不是 channel 操作，所以不能直接把 fd 写进 `select`。常见做法是由一个 goroutine 负责读连接，再把解析后的消息送入 channel；业务层通过 `select` 同时等待消息、超时和取消信号。

```go
select {
case msg := <-messages:
	handle(msg)
case <-time.After(time.Second):
	return ErrTimeout
case <-ctx.Done():
	return ctx.Err()
}
```

需要注意 `time.After` 在循环中会反复创建 timer。高频循环中更推荐复用 `time.Timer`，避免制造额外分配和 GC 压力。

### 小结

Go 的 `select` 和操作系统 I/O 多路复用解决的是不同层次的问题。`select` 用来组合多个 channel 事件，让业务并发控制更清晰；netpoller 用来把大量网络 fd 的等待交给内核，并把就绪事件重新接回 Go 调度器。理解这条链路之后，就能解释为什么 Go 可以用同步写法处理高并发网络 I/O，也能知道什么时候应该警惕忙等、timer 分配和 goroutine 泄漏。
