---
title: 'Go 标准库：container、reflect、unsafe 与 atomic'
date: 2022-03-20 15:05:46
tags:
- Go
- Go standard library
categories:
- Go语言
---

### Go map

#### 底层实现

Go语言的map底层实现基于哈希表。Hash会把任意长度输入映射到有限值域，因此一定会存在冲突。Go map 不是“传统链地址法”的单链表实现，而是“bucket + overflow bucket”结构：每个 bucket 固定容纳若干键值对，冲突严重时通过 overflow bucket 串接扩展。值得注意的是：==Java1.8中在冲突链较长时会做树化优化，而 Go map 走的是 bucket 扩容与渐进迁移路线。==

使用哈希表的目的就是要快速查找到目标key，然而，随着向map中添加的key越来越多，key发生碰撞的概率也越来越大，bucket中的8个cell会被逐渐塞满，插入、查找和删除key的效率也会越来越低，最理想的情况是bucket只装入一个key，这样，就能达到$O(1)$的效率，但这样空间消耗太大，代价太高。

底层源码如下所示：

```go
// A header for a Go map.
type hmap struct {
	count     int // # live cells == size of map.  Must be first (used by len() builtin)
	flags     uint8
	B         uint8  // log_2 of # of buckets (can hold up to loadFactor * 2^B items)
	noverflow uint16 
	hash0     uint32 // hash seed

	buckets    unsafe.Pointer // array of 2^B Buckets. may be nil if count==0.
	oldbuckets unsafe.Pointer // previous bucket array of half the size, non-nil only when growing
	nevacuate  uintptr        // progress counter for evacuation (buckets less than this have been evacuated)

	extra *mapextra // optional fields
}
```

其中，`buckets unsafe.Pointer`指向具体的buckets数组，这个数组是`bmap`结构，如下所示：

```go
// A bucket for a Go map.
type bmap struct {
	tophash [bucketCnt]uint8
}
```

在实际编译期间，Go语言的`bmap`会经过反射生成真正的`bmap`类型：

```go
type bmap struct {
  topbits  [8]uint8
  keys     [8]keytype
  values   [8]valuetype
  pad      uintptr
  overflow uintptr
}
```

map的访问即通过给定的key在map中寻找其对应value，过程如下：

1. 原始的key通过hash函数映射成64位二进制；
2. 末尾x位代表`bmap`的位置，从`[]bmap`中找到对应的`bmap`，值得注意的是，bmap的数量一般是2的幂，如果末尾x位代表`bmap`的位置就代表有$2^x$个`bmap`；
3. 首8位对应key的tophash，在bmap中进行检索，首先会比较`bmap`顶层的`tophash`与原始key的`tophash`是否相同，若不相同则直接跳过比较下一个；若相同则进一步比较key是否相同。

### `container`

众所周知，Go对于一些基本的数据结构封装得不是很好，在`container`中也只有三种常见的数据结构——链表、环形链表和堆。

#### `container/list`

我们先来看看`list`的写入与打印：

```go
l := list.New()
l.PushBack(1) //尾插
l.PushBack(2)
fmt.Println(l)
```

我们看看打印结果：

```go
&{{0xc00007c180 0xc00007c1b0 <nil> <nil>} 2}
```

为什么打印结果是这样的，如果我们弄懂`list`的底层结构，就能知道答案了。`list`的底层结构如下：

```go
type Element struct {
	// Next and previous pointers in the doubly-linked list of elements.
	// To simplify the implementation, internally a list l is implemented
	// as a ring, such that &l.root is both the next element of the last
	// list element (l.Back()) and the previous element of the first list
	// element (l.Front()).
	next, prev *Element

	// The list to which this element belongs.
	list *List

	// The value stored with this element.
	Value interface{}
}

// List represents a doubly linked list.
// The zero value for List is an empty list ready to use.
type List struct {
	root Element // sentinel list element, only &root, root.prev, and root.next are used
	len  int     // current list length excluding (this) sentinel element
}
```

结合上面的打印，我们可以发现，`{0xc00007c180 0xc00007c1b0 <nil> <nil>}` 是`root Element`，`2`是`len int`。我们接着打印：

```go
l := list.New()//初始化
l.PushBack(1) //尾插
l.PushBack(2)
fmt.Println(l.Front())
fmt.Println(l.Back())
fmt.Println(l)
```

其打印结果如下：

```go
&{0xc00007c1b0 0xc00007c150 0xc00007c150 1}
&{0xc00007c150 0xc00007c180 0xc00007c150 2}
&{{0xc00007c180 0xc00007c1b0 <nil> <nil>} 2}
```

从这个结果我们不难看出，`list`其实是一个环形结构。其中，`root`的next指向链表的`front`，`root`的pre指向链表的`back`，而`root`自身是不存储数据的。如果我们再加上一个数据，就会变成这样了：

```go
l := list.New()//初始化
l.PushBack(1) //尾插
l.PushBack(2)
l.PushBack(3)
fmt.Println(l.Front())
fmt.Println(l.Back())
fmt.Println(l)
```

其打印结果如下：

```go
&{0xc00007c1b0 0xc00007c150 0xc00007c150 1}
&{0xc00007c150 0xc00007c1b0 0xc00007c150 3}
&{{0xc00007c180 0xc00007c1e0 <nil> <nil>} 3}
```

#### `container/heap`

我们来看看如何初始化一个heap，如下所示：

```go
type Student struct {
	name  string
	score int
}
h := &StudentHeap{
	{name: "xiaoming", score: 82},
	{name: "xiaozhang", score: 88},
	{name: "laowang", score: 85}
}
heap.Init(h)
```

先来读读`Init()`函数，如下所示：

```go
func Init(h Interface) {
	// heapify
	n := h.Len()
	for i := n/2 - 1; i >= 0; i-- {
		down(h, i, n)
	}
}
func down(h Interface, i0, n int) bool {
	i := i0
	for {
		j1 := 2*i + 1
		if j1 >= n || j1 < 0 { // j1 < 0 after int overflow
			break
		}
		j := j1 // left child
		if j2 := j1 + 1; j2 < n && h.Less(j2, j1) {
			j = j2 // = 2*i + 2  // right child
		}
		if !h.Less(j, i) {
			break
		}
		h.Swap(i, j)
		i = j
	}
	return i > i0
}
```

可以看到，这两个函数跟我们的堆排序很像，还是讲一下，

#### `container/ring`

>环的结构有点特殊，环的尾部就是头部，所以每个元素实际上就可以代表自身的这个环。 它不需要像 list 一样保持 list 和 element 两个结构，只需要保持一个结构就行。
>
>——[1. 3.3 container — 容器数据类型：heap、list 和 ring](https://books.studygolang.com/The-Golang-Standard-Library-by-Example/chapter03/03.3.html)

我觉得这句话总结得很好，

### `reflect`

#### `reflect.DeepEqual`

`DeepEqual`函数用来判断两个值是否深度一致。这和`==`有什么不同吗？我们来看看下面例子：

```go
type S struct{
	name string
    age	 int
}
func main(){
     a := S{
        name:    "aa",
        age:     1,
    }
    b := S{
        name:    "aa",
        age:     1,
    }

   fmt.Println(a == b)
}
```

其中`a==b`为`true`。如果我们将结构体中加入一个指针，就会返回false，这是因为指针指向的地址不一样，如下所示：

```go
type S struct {
    Name    string
    Age     int
    Address *int
}

func main() {
    a := S{
        Name:    "aa",
        Age:     1,
        Address: new(int),
    }
    b := S{
        Name:    "aa",
        Age:     1,
        Address: new(int),
    }

   fmt.Println(a == b)
}

```

这时会返回`false`。

值得注意的是：`slice`、`map`、`function`是不能参与比较的，如果在结构体中出现以上类型，会`panic`。在这里我们就有一个疑问？到底是什么原因导致`slice`、`map`、`function`不能进行比较，如果是因为引用类型的原因，`channel`却可以进行比较。我们先来看看比较`slice`的时候返回的错误，如下所示：

```go
invalid operation: a == b (struct containing []int cannot be compared)
```

有的博主说`slice`不可比较有两个原因：

- 引用类型，比较地址没有意义。
- 切片有len，cap，比较的维度不好衡量，因此go设计的时候就不允许切片可比较。

但是我们来看看这个情况：

```go
type S struct {
	Name    string
	Age     int
	Ch	chan []int
}

func main() {
	a := S{
		Name:    "aa",
		Age:     1,
		Ch:      make(chan []int),
	}
	b := S{
		Name:    "aa",
		Age:     1,
		Ch:      make(chan []int),
	}

	fmt.Println(a == b)
}
```

但是在`[]int`的`channel`是可以比较的，这就会比较迷惑。

无独有偶，两个`interface{}`是能比较的，其规则如下：

- 两个类型相同且值相同的接口比较结果为`true`；
- 两个类型相同且值不同的接口比较结果为`false`；
- 两个类型不同的接口比较结果为`false`；
- 如果空接口保存了上面的`slice`、`map`和`function`的值，则不能比较。

总结：类型不同的空接口间的比较结果不相同，不能比较空接口中的动态值。

回到正题，我们来看看`reflect.DeepEqual`，`reflect.DeepEqual`在可以时（主要是基本类型）会使用`==`；但还会比较`array`、`slice`的**成员**，`map`的**键值对**，**结构体字段**进行深入比对。如下所示：

```go
func main() {
	m1 := map[int]interface{}{1: []int{1, 2, 3}, 2: 3, 3: "a"}
	m2 := map[int]interface{}{1: []int{1, 2, 3}, 2: 3, 3: "a"}
	if reflect.DeepEqual(m1, m2) {
		fmt.Println("相等")
	}
}
//输出”相等”
```

当然，我们还是要从它的源码进行分析:

```go
func DeepEqual(x, y interface{}) bool {
	if x == nil || y == nil {
		return x == y
	}
	v1 := ValueOf(x)
	v2 := ValueOf(y)
	if v1.Type() != v2.Type() {
		return false
	}
	return deepValueEqual(v1, v2, make(map[visit]bool))
}

```

我们可以看到，如果`x==nil`或者`y==nil`，就比较二者的指针，否则比较二者的类型，如果类型相同，那么我们就用`deepValueEqual`函数进行比较。这个函数的核心逻辑可以概括为：先处理类型和值的边界条件，再按 `Kind` 递归比较。源码中还有 `visited` 结构，用来避免带环的数据结构导致无限递归。

```go
func deepValueEqual(v1, v2 Value, visited map[visit]bool) bool {
	if !v1.IsValid() || !v2.IsValid() {
		return v1.IsValid() == v2.IsValid()
	}
	if v1.Type() != v2.Type() {
		return false
	}

	switch v1.Kind() {
	case Array:
		for i := 0; i < v1.Len(); i++ {
			if !deepValueEqual(v1.Index(i), v2.Index(i), visited) {
				return false
			}
		}
		return true
	case Slice:
		if v1.IsNil() != v2.IsNil() || v1.Len() != v2.Len() {
			return false
		}
		for i := 0; i < v1.Len(); i++ {
			if !deepValueEqual(v1.Index(i), v2.Index(i), visited) {
				return false
			}
		}
		return true
	case Map:
		if v1.IsNil() != v2.IsNil() || v1.Len() != v2.Len() {
			return false
		}
		for _, key := range v1.MapKeys() {
			if !deepValueEqual(v1.MapIndex(key), v2.MapIndex(key), visited) {
				return false
			}
		}
		return true
	case Struct:
		for i := 0; i < v1.NumField(); i++ {
			if !deepValueEqual(v1.Field(i), v2.Field(i), visited) {
				return false
			}
		}
		return true
	default:
		return valueInterface(v1, false) == valueInterface(v2, false)
	}
}
```

所以 `DeepEqual` 并不是“万能等号”。它适合测试和调试，不适合作为高频业务路径上的比较工具：它会走反射，比较规则也未必符合业务语义。例如空 slice 和 nil slice 在 `DeepEqual` 下并不相等。

### `unsafe`

>**Unsafe code**是一种绕过go类型安全和内存安全检查的Go代码。大多数情况，unsafe code是和指针相关的。但是要记住使用unsafe code有可能会损害你的程序，所以，如果你不完全确定是否需要用到unsafe code就不要使用它。
>
>[关于 Go 中的 unsafe 包](https://studygolang.com/articles/22265)

Go 里面没有 `warning` 这个说法。相比于 C/C++，Go 中一些危险的操作由 `unsafe` 包提供。

#### `unsafe.Pointer`

我以前有一个疑问：既然指针代表的是地址，那为什么还要分类呢？原来，针区分类型是为了在通过指针访问它所指向的存储空间的时候，能够正确访问，如果通过一个char类型的指针操作一个int的变量，如果值的二进制数据超过1字节，那么就造成数据错误。

我们先看如下例子：

```go
func main() {
	var value int64 = 5
	var p1 = &value
	var p2 = (*int32)(unsafe.Pointer(p1))
	fmt.Println(p1)
	fmt.Println(p2)
}
```

输出结果如下：

```go
0xc00001e0d0
0xc00001e0d0
```

可以发现这两个指针所指向的地址是一样的，这个方法能让你创造一个`int32`的`p2`指针去指向一个`int64`的`value`变量，而这个变量是使用`p1`指针去访问的。我们通过以下例子来说明：

```go
x := int32(5)
var p=(*byte)(unsafe.Pointer(&x))
s:=*p
fmt.Println(s)
//输出5
```

但是从`byte`转换成`int32`的时候会出现问题：

```go
b:='5'
var p=(*int32)(unsafe.Pointer(&b))
i:=*p
fmt.Println(i)
//输出53
```

这是因为存放的`b`中存放的实际是ASCII码，故而转换成int时输出53。那么为什么转换成`byte`时就会输出5呢，我们用反射来看s的实际类型，显示是`uint8`，也就是说我们只是在这只是修改了指针类型 或者说只是修改了编译器解释他的类型。

#### `uintptr`和`unsafe.Pointer`的区别

uintptr本质是一个无符号的整型，它的长度可以用来保存一个指针地址。unsafe包提供的Pointer表示可以指向任意类型的指针。

uintptr往往用来进行指针计算，因为它是整型，所以很容易计算出下一个指针所指向的位置。

- unsafe.Pointer只是单纯的通用指针类型，用于转换不同类型指针，它不可以参与指针运算；
- 而uintptr是用于指针运算的，GC 不把 uintptr 当指针，也就是说 uintptr 无法持有对象， uintptr 类型的目标会被回收；
- unsafe.Pointer 可以和 普通指针 进行相互转换；
- unsafe.Pointer 可以和 uintptr 进行相互转换。

### `sync`

sync包中提供了常见的并发编程同步原语，所谓原语，一般是指由若干条指令组成的程序段，用来实现某个特定的功能，在执行过程中不可被中断，否则就会出现操作错误，造成系统混乱。

#### `sync.Mutex`

sync.Mutex是sync包中使用最广泛的原语，它允许在共享资源上互斥访问。

```go
type mutex struct{
	state	int32
	sema	uint32
}
```

上述是`mutex`的结构，`state`表示当前互斥锁的状态，`sema`是用于控制锁状态的信号量。在`state`中有一个标志位叫`mutexStarving`，表示当前的互斥锁是否进入了饥饿状态，在正常状态下，锁的等待者会按照先进先出的顺序获取锁；在饥饿模式下，互斥锁会直接交给等待队列最前面的 Goroutine。新的 Goroutine 在该状态下不能获取锁、也不会进入自旋状态，它们只会在队列的末尾等待。如果一个 Goroutine 获得了互斥锁并且它在队列的末尾或者它等待的时间少于 1ms，那么当前的互斥锁就会切换回正常模式。

##### `sync.Mutex.Lock`

```go
func (m *Mutex) Lock() {
	if atomic.CompareAndSwapInt32(&m.state, 0, mutexLocked) {
		return
	}
	m.lockSlow()
}
```

在这里用到原子操作CAS，常常被用于自旋机制，具体讲解在下面。当锁的状态是0时，就会将`mutexLocked`位置设置为1，如果互斥锁的状态不是0就会调用`lockSlow`尝试通过自旋等待锁的释放。

##### `sync.Mutex.Unlock`

```go
func (m *Mutex) Unlock() {
	new := atomic.AddInt32(&m.state, -mutexLocked)
	if new != 0 {
		m.unlockSlow(new)
	}
}
```

在`Unlock`中，用到了原子操作Add，这里这个原子操作的意思是：如果只是`mutexLocked`位为1，那么我们将state设置为0，return；否则，调用`UnlockSlow`进行缓慢解锁。也就是说如果有其他goroutine等待着，那么我们就会进入缓慢解锁的状态——移交锁的所有权给下一个goroutine。

#### `sync.RWMutex`

```go
type RWMutex struct {
	w           Mutex  // held if there are pending writers
	writerSem   uint32 // semaphore for writers to wait for completing readers
	readerSem   uint32 // semaphore for readers to wait for completing writers
	readerCount int32  // number of pending readers
	readerWait  int32  // number of departing readers
}
```

我们可以看到，`RWMutex`继承了`Mutex`，并且增加了几个成员。我们先来说说这几个成员：

- `writerSem`：写者等待读者完成的信号量；
- `readerSem`：读者等待写者完成的信号量；
- `readerCount`：当前有几个读者共享锁；
- `readerWait`：离开的读者数。

##### `Rlock`&`RUnlock`

 ```go
 	if atomic.AddInt32(&rw.readerCount, 1) < 0 {
 		// A writer is pending, wait for it.
 		runtime_SemacquireMutex(&rw.readerSem, false, 0)
 	}
 ```

如上述所示，上读锁的就是给`readerCount`+1，如果有写者占用，就

```go
	if r := atomic.AddInt32(&rw.readerCount, -1); r < 0 {
		// Outlined slow-path to allow the fast-path to be inlined
		rw.rUnlockSlow(r)
	}
```

如上述所示，解读锁就是给`readerCount`-1，如果有

##### `Lock`&`Unlock`

```go
	r := atomic.AddInt32(&rw.readerCount, rwmutexMaxReaders)
	if r >= rwmutexMaxReaders {
		race.Enable()
		throw("sync: Unlock of unlocked RWMutex")
	}
	// Unblock blocked readers, if any.
	for i := 0; i < int(r); i++ {
		runtime_Semrelease(&rw.readerSem, false, 0)
	}
```



#### `sync/atomic`

> CPU执行一条汇编语句就是一个原子操作吗？

原子操作是指不会被多线程调度机制打断的操作，这种操作一旦开始，就一直运行到结束，中间不会有任何context switch。原子操作是不可分割的，在执行完毕之前不会被任何其它任务或事件中断。在单处理器系统（**UniProcessor**）中，能够在单条指令中完成的操作都可以认为是" 原子操作"，因为中断只能发生于指令之间。

说到这里，我们来看看维基百科上对原子操作的判定：

>如果这个操作所处的层(layer)的更高层不能发现其内部实现与结构，那么这个操作是一个原子(atomic)操作。

再看看其定义：

>原子操作可以是一个步骤，也可以是多个操作步骤，但是其顺序不可以被打乱，也不可以被切割而只执行其中的一部分。将整个操作视作一个整体是原子性的核心特征。

也就是说，绝大多数情况下，一个机器指令就是一个原子操作。在Intel的参考手册，CPU基于以下三种机制保证了多核中加锁的原子操作：

>（1）一些基本的内存读写操作是本身已经被硬件提供了原子性保证（例如读写单个字节的操作）；
>（2）一些需要保证原子性但是没有被第（1）条机制提供支持的操作（例如read-modify-write）可以通过使用”LOCK#”来锁定总线，从而保证操作的原子性
>（3）因为很多内存数据是已经存放在L1/L2 cache中了，对这些数据的原子操作只需要与本地的cache打交道，而不需要与总线打交道，所以CPU就提供了cache coherency机制来保证其它的那些也cache了这些数据的processor能读到最新的值。

上面（1）就是由硬件保持的原子操作，具体来说有以下操作：

> • Reading or writing a byte（一个字节的读写）
> • Reading or writing a word aligned on a 16-bit boundary（对齐到16位边界的字的读写）
> • Reading or writing a doubleword aligned on a 32-bit boundary（对齐到32位边界的双字的读写）
>
> • Reading or writing a quadword aligned on a 64-bit boundary（对齐到64位边界的四字的读写）
> • 16-bit accesses to uncached memory locations that fit within a 32-bit data bus（未缓存且在32位数据总线范围之内的内存地址的访问）
>
> • Unaligned 16-, 32-, and 64-bit accesses to cached memory that fit within a cache line（对单个cache line中缓存地址的未对齐的16/32/64位访问)

[参考文章](https://mp.weixin.qq.com/s/zeggpIOKJMRBmMOCRCsfhA)

下面我们再看看（2）总线锁。

##### 总线锁

处理器会自动保证基本的内存操作的原子性。处理器保证从系统内存当中读取或者写入一个字节是原子的，意思是当一个处理器读取一个字节时，其他处理器不能访问这个字节的内存地址。

上述操作就是通过总线锁实现的，**在x86 平台上，CPU提供了在指令执行期间对**总线加锁的手段，这样能实现并行时的原子操作。

##### Go支持的原子操作概述

Win32 API中常用的原子操作主要有三类，一种是加一减一操作，二是比较交换操作，三赋值操作。对于一个整数类型`T`，`sync/atomic`标准库包提供了下列原子操作函数。 其中`T`可以是内置`int32`、`int64`、`uint32`、`uint64`和`uintptr`类型。

```go
func AddT(addr *T, delta T)(new T)
func LoadT(addr *T) (val T)
func StoreT(addr *T, val T)
func SwapT(addr *T, new T) (old T)
func CompareAndSwapT(addr *T, old, new T) (swapped bool)
```

我们看看`CompareAndSwap`的源码：

```go
// sync/atomic 中的声明形式大致如下：
func CompareAndSwapInt32(addr *int32, old, new int32) (swapped bool)

// amd64 上最终会落到类似这样的原子指令序列：
// MOVQ addr, BX
// MOVL old, AX
// MOVL new, CX
// LOCK
// CMPXCHGL CX, 0(BX)
// SETEQ swapped
```

CAS 的语义是：只有当 `*addr == old` 时，才把 `*addr` 更新为 `new`，并返回 `true`；否则不修改内存并返回 `false`。这个检查和更新必须作为一个不可分割的整体完成，所以底层需要 CPU 原子指令支持。

在 x86 上，`LOCK CMPXCHG` 会让这次读-改-写对其他核心可见为一个原子操作。Go 的 `sync/atomic` 还规定了内存顺序语义：原子操作不仅要保证单个变量更新不可分割，还要避免编译器和 CPU 把相关内存读写重排到不符合并发语义的位置。

CAS 常见于无锁结构和锁的 fast path，但它不是“免费加速”。高竞争下 CAS 会不断失败，goroutine 可能反复自旋，最终还不如互斥锁稳定。写并发代码时，应该先用 `sync.Mutex`、channel 等更清晰的同步方式；只有在热点路径已经明确、竞争模型也清楚时，再考虑直接使用 `sync/atomic`。

### `encoding/json`

#### `Marshal`

`json.Marshal` 会把 Go 值编码成 JSON 字节序列。它的核心流程是：先根据动态类型找到对应的 encoder，再递归编码字段、数组、切片、map 等结构。

常见规则如下：

1. 结构体字段默认使用字段名作为 JSON key。
2. 可以通过 struct tag 控制字段名、忽略字段或省略零值。
3. 未导出的字段不会被编码。
4. `map` 的 key 如果不是 string、整数或实现了 `encoding.TextMarshaler`，通常不能直接编码成 JSON object。
5. 循环引用无法编码，会返回错误。

```go
type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email,omitempty"`
}

b, err := json.Marshal(User{ID: 1, Name: "nanbei"})
if err != nil {
	return err
}
fmt.Println(string(b)) // {"id":1,"name":"nanbei"}
```

`omitempty` 的判断基于零值：空字符串、0、false、nil 指针、nil slice、nil map 都会被省略。需要区分“字段不存在”和“字段存在但为空”时，应该使用指针或自定义类型表达。

#### `Unmarshal`

`json.Unmarshal` 会把 JSON 字节序列解码到传入的指针里。这里必须传指针，否则函数无法修改调用方的变量。

```go
var user User
if err := json.Unmarshal(data, &user); err != nil {
	return err
}
```

反序列化时有几个容易踩坑的点：

1. JSON number 默认解到 `interface{}` 时会变成 `float64`，大整数可能丢精度。需要保留精度时可以使用 `Decoder.UseNumber()`。
2. JSON 中不存在的字段不会覆盖结构体里已有字段，因此复用结构体变量时要先清空。
3. 多余字段默认会被忽略；如果希望严格校验，可以使用 `Decoder.DisallowUnknownFields()`。
4. `null` 解到指针、slice、map 时会得到 nil；解到普通数字或字符串字段时不会把它变成特殊值。

如果需要自定义编码/解码，可以实现 `MarshalJSON` 和 `UnmarshalJSON`：

```go
func (u User) MarshalJSON() ([]byte, error) {
	type Alias User
	return json.Marshal(struct {
		Alias
		Kind string `json:"kind"`
	}{Alias: Alias(u), Kind: "user"})
}
```

`encoding/json` 最大的优点是标准、稳定、反射能力强；缺点是反射带来的性能开销较明显。高性能场景可以考虑代码生成或专用 JSON 库，但业务系统的默认选择仍然应该先从标准库开始。

