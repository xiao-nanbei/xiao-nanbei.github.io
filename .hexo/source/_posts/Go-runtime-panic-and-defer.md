---
title: 'Go runtime: panic 与 defer'
date: 2022-03-12 01:09:40
tags:
- Go runtime
categories:
- Go语言
---

### Go panic

大多数编程语言都提供了异常处理机制，恰恰相反，Go延续了C语言的风格，并未提供异常处理机制。但在Go中，提供了panic异常，从某种意义上说，它也非常接近其他语言的异常处理。

Go语言在编译期间就能捕获大量异常，但是有些异常只能发生在运行期间，比如运行期间的除以0的异常，数组越界错误等。

除了程序本身的问题导致panic异常外，也可以直接在程序里调用panic函数引发panic异常。panic函数原型如下：

```go
func panic(v interface{})
```

当我们直接调用panic函数时就会引发程序panic异常。如下面例子：

```go
package main

import "fmt"

func f(x int) {
    fmt.Printf("f(%d)\n", x+0/x) // 当参数为 0 时，引发 panic 异常
    defer fmt.Printf("%d\n", x)
    f(x - 1)
}

func main() {
    f(3)
    fmt.Println("end")
}
```

当程序发生 panic 时，当前函数会中断正常执行，并沿着调用栈向外传播。在传播过程中，每一层已经注册的 `defer` 都会按后进先出的顺序执行。以上面的例子来说，`f(0)` 触发除零错误后，panic 会从 `f(0)` 逐层传到 `f(1)`、`f(2)`、`f(3)`，直到所有已注册的 deferred 函数都执行完。

##### Go defer

Go 语言的 `defer` 语句会把后面跟随的调用延迟到当前函数返回前执行。多个 `defer` 的执行顺序是后进先出，也就是说先注册的最后执行，最后注册的最先执行。延迟语句常常用于释放资源、关闭文件、解锁互斥锁，或者在 panic 发生时做收尾工作。

```go
func readFile(name string) error {
    f, err := os.Open(name)
    if err != nil {
        return err
    }
    defer f.Close()

    // 这里处理文件内容。无论中途正常返回还是发生 panic，Close 都有机会被执行。
    return nil
}
```

需要注意的是，`defer` 后面的函数参数会在注册 defer 时求值，而不是在真正执行 defer 时才求值。理解这一点可以避免很多闭包和循环变量带来的误判。

`panic` 和 `defer` 经常一起出现，但它们不是异常处理的替代品。Go 更推荐用 `error` 表达可预期的失败，用 `panic` 表达程序无法继续运行的严重错误。只有在边界层，例如 HTTP 中间件或 goroutine 入口处，才适合用 `recover` 把 panic 收敛下来，记录日志并保护进程不被单个请求拖垮。

### defer 的几个细节

`defer` 最容易误解的地方是参数求值时机。下面这段代码最终打印的是 `0`，因为 `defer fmt.Println(i)` 注册时，参数 `i` 已经被求值：

```go
func main() {
    i := 0
    defer fmt.Println(i)
    i = 10
}
```

如果 defer 后面是闭包，闭包内部读取的是变量本身，结果就不同：

```go
func main() {
    i := 0
    defer func() { fmt.Println(i) }()
    i = 10
}
```

这段代码会打印 `10`。循环中使用 defer 或闭包时尤其要注意这个差异。

### recover 的边界

`recover` 只有在 deferred 函数中直接调用才会生效。它不能跨 goroutine 捕获 panic，也不能在普通函数调用链里随便调用。

```go
func safeRun(fn func()) {
    defer func() {
        if r := recover(); r != nil {
            log.Printf("panic recovered: %v", r)
        }
    }()
    fn()
}
```

每个 goroutine 都有自己的栈。某个 goroutine panic 时，只会展开自己的栈；如果没有在这个 goroutine 的 defer 链上 recover，程序最终会崩溃。因此后台任务的入口处通常应该有统一的 recover 边界。

### runtime 视角

从 runtime 角度看，`defer` 和 `panic` 都是围绕 goroutine 栈组织的。函数注册 defer 时，runtime 会记录一个延迟调用；函数返回或 panic 展开栈时，再按后进先出的顺序执行这些调用。panic 传播时会不断执行当前栈帧上的 defer，如果某个 defer 成功 recover，panic 传播停止，函数从 defer 之后的路径返回。

早期 Go 版本中 defer 成本较高，所以很多性能敏感代码会避免在热点循环中使用 defer。现在编译器已经能对一部分 defer 做 open-coded 优化，普通资源释放场景不必过度担心。但在极端热点路径上，仍然应该用 benchmark 说话，而不是凭感觉判断 defer 是否昂贵。

### 使用建议

1. 可预期错误返回 `error`，不可恢复的程序状态才使用 `panic`。
2. 在 goroutine 入口、HTTP/RPC 中间件等边界层统一 recover。
3. recover 后至少记录堆栈，否则问题会被静默吞掉。
4. 不要用 panic/recover 模拟业务分支，它会让控制流变得隐蔽。
5. 热点循环中大量 defer 需要 benchmark 验证成本。
