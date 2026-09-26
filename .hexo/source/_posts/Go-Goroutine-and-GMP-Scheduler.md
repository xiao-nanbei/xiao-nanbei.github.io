---
title: 'Go Goroutine 与 GMP 调度器'
date: 2021-12-17 16:44:45
tags:
- Goroutine
- Go runtime
categories:
- Go语言
---

Goroutine 是由 Go runtime 管理的轻量级并发执行单元。它和操作系统线程不是一一对应关系：runtime 会把大量 goroutine 复用到少量线程上执行。goroutine 初始栈很小且可按需增长，因此单进程可以承载大量并发任务。

我在前面的文章[MIT 6.S081: xv6 实验参考书解析](https://xiao-nanbei.github.io/2022/01/10/MIT-6-S081-xv6-Book-Notes/)中讲过进程/线程的切换方式，当切换的时候要从用户态->内核态->另一个进程/线程的内核态->另一个进程的用户态，但是在Goroutine中不是这样。通过GMP，可以使得开销尽量小。

#### Coroutine

先来说说协程（Coroutine）：

> 主流的操作系统都是采用一对一的线程模型，用户态和内核态线程具有一对一关系，可以认为用户态线程的执行完全受到操作系统调度器的管理。但是随着应用程序越来越复杂，与操作系统调度器相比，应用程序对线程的语义和执行状态更加了解，因此可能做出更优的调度策略。在这个背景下，操作系统开始提供更多对用户态线程，即协程的支持。

也就是说，一个线程的执行可以从内核态和用户态两个视角来观察。内核级线程由操作系统调度，用户级协程则由语言运行时或协程库调度。

如下图所示，我们可以更好地理解协程和线程的关系，[图片来源](https://juejin.cn/post/6995091405563494431)。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a22b3af8462e41f8adb601eb34c22bb6~tplv-k3u1fbpfcp-watermark.awebp)

协程的上下文切换触发机制与内核态线程存在较大不同。操作系统可以通过中断抢占当前 CPU 并进行上下文切换，这种切换是强制性的，因此称为抢占式调度；协程通常由运行时或协程库调度，协程库一般会提供 `yield` 接口，让当前协程暂时放弃 CPU，从而使其他协程获得运行机会。



---

补充一下常见的面经：

###### 进程、线程、协程的区别：

进程是资源隔离与分配的基本单位，线程是进程内的执行流。线程共享进程地址空间和大部分资源，但有各自的栈与寄存器上下文。不同进程天然隔离，通常通过 IPC 机制通信。

共享一个进程资源的多线程有自己独有的用户栈和内核栈，有共享的代码段、数据段和堆。线程有自己独有的`context`，这个`context`包括栈、栈指针、寄存器和程序计数器。

协程是用户态调度的并发执行单元，通常由语言 runtime 或协程库管理。它并不等同于“异步机制”，而是另一种并发组织方式；是否抢占、何时切换，取决于具体 runtime 的调度策略。



进程、线程、协程切换开销的对比：

- 

###### 同步与异步的区别：

同步是阻塞模式，而异步是非阻塞模式：

- 同步通常指调用方需要在当前控制流中等待操作完成（或等待其结果可用）后再继续。

- 异步是进程不需要一直等下去，而是继续执行下面的操作，不管其他进程的状态。当有消息返回时系统会通知进程处理，这样可以提高执行的效率。

  知乎上这个[文章](https://zhuanlan.zhihu.com/p/67452727)说得很好，分享给大家：

  > 同步异步 ， 举个例子来说，一家餐厅吧来了5个客人，**同步**的意思就是说，来第一个点菜，点了个鱼，好， 厨师去捉鱼杀鱼，过了半小时鱼好了给第一位客人，开始下位一位客人，就这样一个一个来，按**顺序**来相同， **异步**呢，异步的意思就是来第一位客人，点什么，点鱼，给它一个牌子，让他去一边等吧，下一位客人接着点菜，点完接着点让厨师做去吧，哪个的菜先好就先端出来。
  >
  > 同步的优点是：同步是按照顺序一个一个来，不会乱掉，更不会出现上面代码没有执行完就执行下面的代码， 缺点：是解析的速度没有异步的快；
  >
  > 异步的优点是：异步是接取一个任务，直接给后台，在接下一个任务，一直一直这样，谁的先读取完先执行谁的， 缺点：没有顺序 ，谁先读取完先执行谁的 ，会出现上面的代码还没出来下面的就已经出来了，会报错。

---

goroutine 来自协程的概念，让一组可复用的函数运行在一组线程之上，即使有协程阻塞，该线程的其他协程也可以被 runtime 调度，转移到其他可运行的线程上。最关键的是，程序员看不到这些底层的细节，这就降低了编程的难度，提供了更容易的并发。

Go 中，协程被称为 goroutine，它非常轻量，一个 goroutine 只占几 KB，并且这几 KB 就足够 goroutine 运行完，这就能在有限的内存空间内支持大量 goroutine，支持了更多的并发。虽然一个 goroutine 的栈只占几 KB，但实际是可伸缩的，如果需要更多内容，runtime 会自动为 goroutine 分配。

#### channel之于Goroutine

##### 无缓冲channel和有缓冲channel

无缓冲channel发送动作和接收动作是同时发生的，例如 `ch := make(chan int)` ，如果没 `goroutine` 读取接收者`<-ch` ，那么发送者`ch<-` 就会一直阻塞，**缓冲** `channel` 类似一个队列，只有队列满了才可能发生阻塞。

##### 如何优化channel

和学长聊到这个问题，深夜无眠，写一下自己的理解。

channel 的构造语句 `make(chan int)`，将会被 golang 编译器翻译为 `runtime.makechan` 函数, 其函数签名如下：

```go
func makechan(t *chantype, size int) *hchan
```

其中，`t *chantype` 即构造 channel 时传入的元素类型。`size int` 即用户指定的 channel 缓冲区大小，不指定则为 0。该函数的返回值是 `*hchan`。hchan 则是 channel 在 golang 中的内部实现。其定义如下：

```go
type hchan struct {
	qcount   uint           // buffer 中已放入的元素个数
	dataqsiz uint           // 用户构造 channel 时指定的 buf 大小
	buf      unsafe.Pointer // buffer
	elemsize uint16         // buffer 中每个元素的大小
	closed   uint32         // channel 是否关闭，== 0 代表未 closed
	elemtype *_type         // channel 元素的类型信息
	sendx    uint           // buffer 中已发送的索引位置 send index
	recvx    uint           // buffer 中已接收的索引位置 receive index
	recvq    waitq          // 等待接收的 goroutine  list of recv waiters
	sendq    waitq          // 等待发送的 goroutine list of send waiters

	lock mutex
}
```

我们可以知道，hchan中定义了悲观锁来进行互斥，channel是一个用于同步和通信的有锁队列。

###### channel回比mutex低效吗？

今晚我被这个问题折磨了很久，查了很多资料才有了一些答案。

在 Go 中，channel 的发送/接收是并发安全的同步操作；通过它可以建立清晰的 happens-before 关系。常见经验是：如果问题本质是“数据流动与协作”，channel 往往更自然；如果问题本质是“保护共享状态”，mutex 往往更直接。性能与可维护性需要结合场景权衡。

| 操作     | 一个零值nil通道 | 一个非零值但已关闭的通道 | 一个非零值且尚未关闭的通道 |
| -------- | --------------- | ------------------------ | -------------------------- |
| 关闭     | 产生恐慌        | 产生恐慌                 | 成功关闭                   |
| 发送数据 | 永久阻塞        | 产生恐慌                 | 阻塞或者成功发送           |
| 接收数据 | 永久阻塞        | 永不阻塞                 | 阻塞或者成功接收           |

***更新***

---

https://segmentfault.com/a/1190000017890174

我在看了上述博文之后对channel和mutex的选择有了一些认识，摘录如下：

> 面对一个并发问题的时候，应当选择合适的并发方式：channel还是mutex。**选择的依据是他们的能力/特性：channel的能力是让数据流动起来，擅长的是数据流动的场景**，**mutex的能力是数据不动，某段时间只给一个协程访问数据的权限擅长数据位置固定的场景**。

---

###### 无锁队列ring buffer

按照上述我的想法来看加锁的损耗较高，对于某些特殊的情况，可以采用简单的无锁ring buffer来实现。


在ring buffer中，设置两个指针，head指向的是下一次读的位置，而tail指向的是下一次写的位置，由于是ring buffer，可以将buffer的最后一个单元不存储数据。所以，如果head == tail，那么说明buffer为空。如果 head == tail + 1 ，那么说明buffer满了。

在进行读操作时，我们只修改head的值，而在写操作时我们只修改tail的值，在写操作时，我们在写入内容到buffer之后才修改tail的值；而在进行读操作的时候，我们会读取tail的值并将其赋值给copyTail。

这里依赖的是“按顺序发布与读取索引”的并发协议，而不是“任意赋值都天然原子”。示例代码通过 `atomic.Load/Store` 保证索引读写的可见性和顺序性，从而让读写双方对可读区间达成一致。

因此在单生产者/单消费者模型下，tail 到 head 之前的区间可视为可写区间，避免覆盖尚未消费的数据。注意这一定义依赖前面的并发前提；推广到多生产者或多消费者时需要额外同步机制。

下面是我自己实现的无锁队列ring buffer，大伙看个热闹：

```go
type RingBuffer struct {
	data []int
	head uint64
	tail uint64
}

func (r *RingBuffer) Push(v int) bool {
	tail := atomic.LoadUint64(&r.tail)
	next := (tail + 1) % uint64(len(r.data))
	if next == atomic.LoadUint64(&r.head) {
		return false
	}
	r.data[tail] = v
	atomic.StoreUint64(&r.tail, next)
	return true
}

func (r *RingBuffer) Pop() (int, bool) {
	head := atomic.LoadUint64(&r.head)
	if head == atomic.LoadUint64(&r.tail) {
		return 0, false
	}
	v := r.data[head]
	atomic.StoreUint64(&r.head, (head+1)%uint64(len(r.data)))
	return v, true
}
```

这个例子只适合单生产者、单消费者模型。只要扩展到多生产者或多消费者，就需要额外的 CAS、序号槽位或锁来处理竞争，否则多个 goroutine 可能同时写同一个位置。

###### 分段锁

分段锁提高channel效率思想的思想就是**使用带有协调机制的独占锁，这些机制允许更高的并发性**。

用白话说就是给buffer中的不同数据段上不同的锁，那么当多个Goroutine访问不同数据段的数据时，就不会存在锁竞争，从而可以有效的提高并发访问效率。

但是这只是ConcurrentHashMap所使用的锁分段技术，我查了很多遍也没有在网上看到有人用这个思路优化channel，这也许只是我个人的脑洞。

###### 官方大佬的答案

Go 语言社区也在 2014 年提出了无锁 Channel 的实现方案，该方案将 Channel 分成了以下三种类型：

- 同步 Channel — 不需要缓冲区，发送方会直接将数据交给（Handoff）接收方；
- 异步 Channel — 基于环形缓存的传统生产者消费者模型；
- chan struct{} 类型的异步 Channel — struct{} 类型不占用内存空间，不需要实现缓冲区和直接发送（Handoff）的语义；

这个方案可以在一些关键路径上通过无锁提升channel的性能，但这玩意最后被搁浅了，我也不知道为啥。



###### channel一些问题

给未初始化的channel读写数据，会报错：

```go
var ch chan int
ch<-1
//fatal error: all goroutines are asleep - deadlock!
```

```go
var ch chan int
ch<-1
//fatal error: all goroutines are asleep - deadlock!
```

为什么会报死锁的错误呢？我在网上看到一个解释：

>当`chan`能阻塞的情况下，则直接阻塞 `gopark(nil, nil, waitReasonChanSendNilChan, traceEvGoStop, 2),` 然后调用`throw(s string)`抛出错误,其中`waitReasonChanSendNilChan`。
>
>没有初始化的channel，相当于nil，这个时候对其进行操作，会直接阻塞，抛出异常`waitReasonChanSendNilChan`，也就是报错`"chan send (nil chan)"`，最后呈现给我们的error就是`deadlock`。
>
>————————————————
>[原文链接](https://blog.csdn.net/ilini/article/details/106884674)



##### Goroutine调度原理

###### GMP调度模型

- M 对应 runtime 管理的工作线程（映射到底层 OS 线程），负责实际执行 goroutine。

- G代表一个Goroutine，它有自己的栈，instruction pointer和其他信息。
- P 表示调度上下文（可理解为运行 Go 代码所需的“处理器令牌”），它维护本地可运行 goroutine 队列并参与调度。

也就是说，一个G的执行需要M和P的支持，一个M在与一个P关联后形成一个有效的G的运行环境[内核环境+上下文环境]。每个P都会包含一个可运行的G的队列。

![](https://upload-images.jianshu.io/upload_images/10436675-a29a641d8a384787.png?imageMogr2/auto-orient/strip|imageView2/2/w/400/format/webp)

从上图中看，有2个物理线程M，每一个M都拥有一个处理器P，每一个也都有一个正在运行的Goroutine。默认的P的数量等于CPU的个数，P的数量可以通过GOMAXPROCS()来设置，它其实也就代表了真正的并发度，即有多少个Goroutine可以同时运行。上图中灰色的代表Goroutine并没有运行，而是处于ready的就绪态，正在等待被调度，P维护这个队列。

在go语言中，一旦执行go function，runqueue队列就会在其末尾加入一个Goroutine。在下一个调度点，就从runqueue中取出一个goroutine执行。系统中这么多P，具体会加到哪个P中，要看具体的调度策略。（补充：其实还有一个全局队列，如果P中队列满了，就会存放在全局队列中。）

###### P 和 M 何时会被创建

1、P 何时创建：在确定了 P 的最大数量 n 后，运行时系统会根据这个数量创建 n 个 P。

2、M 何时创建：没有足够的 M 来关联 P 并运行其中的可运行的 G。比如所有的 M 此时都阻塞住了，而 P 中还有很多就绪任务，就会去寻找空闲的 M，而没有空闲的，就会去创建新的 M。

###### 调度过程

1. 通过go func()创建一个goroutine；
2. 新创建的G会保存在P的本地队列中，如果P的本地队列已经满了就会保存在全局的队列中；
3. G只能运行在M中，一个M必须持有一个P。M会从P的本地队列中弹出一个可执行状态的G来执行，如果P的本地队列为空，就会向其他的M-P组合中偷取一个可执行的G来执行；
4. 循环执行；
5. 当M执行某一个G的时候如果发生了系统调用或者阻塞操作，M会阻塞，如果当前有一个G在执行，runtime会把这个线程M从P中摘除，然后再创建一个新的内核线程来服务于这个P；
6. 当M系统调用结束后，这个G会尝试获取一个空闲的P执行，并放到这个P的本地队列，如果获取不到P，那么这个线程M就会变成休眠状态，加入到空闲线程中，然后这个G会被放到全局队列中。

GMP的数量都是有限制的，摘自[博客](https://juejin.cn/post/6947589840187686920)

###### M的限制

在协程的执行中，真正干活的是GMP中的M，M的默认数量限制是10000，如果超出就会报错。通常只有在Goroutine出现阻塞的时候才会出现这种情况。

###### G的限制

Goroutine的创建数量理论上没有限制，但是我们的内存是有上限的，所以实际是有限制的。

###### P的限制

P的数量受环境变量GOMAXPROCS的直接影响。

###### GMP中为什么要有P

###### 老调度器的缺点

1. 因为缓存G的只有一个全局队列，而M有多个，这样我们多个M在访问同一个资源的时候就要加锁保持互斥，这样就加大了开销。



当一个Go程序启动之后会创建一个编号为0的主线程M0，M0负责初始化操作和启动第一个G，之后M0就和其他的M一样了。

G0是每次启动一个M都会第一个创建的goroutine,G0是仅负责调度的G，其不指向任何可执行的函数，每个M都会有一个自己的G0，在调度或系统调用时会使用G0的栈空间，全局变量中的G0是M0的G0。



真正决定并行度的是P的数量，我们看如下例子：

```go
package main

import (
	"fmt"
	"runtime"
)

func main() {
	fmt.Println(runtime.NumCPU())
	old := runtime.GOMAXPROCS(2)
	fmt.Println("old GOMAXPROCS:", old)
	fmt.Println("new GOMAXPROCS:", runtime.GOMAXPROCS(0))
}
```

`GOMAXPROCS` 控制同时执行 Go 代码的 P 的数量。goroutine 可以创建很多，但同一时刻真正并行运行 Go 代码的数量不会超过 P 的数量。I/O 阻塞、系统调用和 runtime 调度会让 M 的数量变化，但并行度的核心旋钮仍然是 P。

Go 同时支持“共享内存 + 锁”与“通过通信共享内存”两种并发组织方式。CSP 风格在 Go 里主要通过 goroutine + channel 体现，核心是用通信来协调并发执行流。

开发go程序的时候，时常需要使用goroutine并发处理任务，有时候这些goroutine是相互独立的，而有的时候，多个goroutine之间常常是需要同步与通信的，值得注意的是，有时候主goroutine需要控制它所属的子goroutine。
