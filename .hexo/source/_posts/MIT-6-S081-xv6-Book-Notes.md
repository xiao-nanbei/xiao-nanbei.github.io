---
title: 'MIT 6.S081: xv6 实验参考书解析'
date: 2022-01-10 21:19:31
categories:
- 操作系统
tags:
- MIT 6.S081 Lab
---

### 第0章

#### 操作系统接口

本书通过xv6操作系统来阐述操作系统的概念，它提供Unix操作系统中的基本接口，同时模仿Unix的内部设计。

> xv6提供了传统的内核概念，**即一个向其他运行的程序提供服务的特殊程序**，每一个运行中的进程都有指令、数据、栈的内存空间。进程通过系统调用使用内核服务。系统调用会进入内核，让内核执行服务然后返回。所以进程总是在用户空间和内核空间之间交替运行。

我们看到上面加粗的那句话：

> xv6提供了传统的内核概念，即一个向其他运行的程序提供服务的特殊程序。

如果说一个进程分了用户空间和内核空间，那么用户态->内核态相当于是cpu特权级别的切换和栈指针的切换，但进程还是那个进程。但上面那句话表达的意思是一旦用户进入内核态就又是另一个进程，这一点我感觉有点歧义。后面查阅了其他资料后才有了解释：

---

在 Linux 内核里，进程和线程都用 `task_struct` 描述。线程通常可理解为“共享地址空间等资源的一组 task”，而不是单独再定义一套完全不同的内核实体；它们的执行上下文、栈等仍是各自独立的。

回到 xv6，默认实现里核心抽象是 `proc`，每个 `proc` 对应一条执行流；它并没有像 Linux 那样提供完整的“同进程多线程”用户模型。

因此，上面那句“内核是向其他程序提供服务的特殊程序”更适合理解为“内核/用户态的职责划分”，而不是在这里直接推出 xv6 的线程模型。

（后面我们可以看到，这个解释其实依然有问题，但他的参考书是这样写的，我们只能暂时这样理解）

---

一个xv6进程由两部分组成，一部分是用户内存空间（指令、数据、栈），另一部分是仅对内核可见的进程状态。我们直接看看`proc`结构：

```c
// Per-process state
struct proc {
  struct spinlock lock;

  // p->lock must be held when using these:
  enum procstate state;        // Process state
  void *chan;                  // If non-zero, sleeping on chan
  int killed;                  // If non-zero, have been killed
  int xstate;                  // Exit status to be returned to parent's wait
  int pid;                     // Process ID

  // wait_lock must be held when using this:
  struct proc *parent;         // Parent process

  // these are private to the process, so p->lock need not be held.
  uint64 kstack;               // Virtual address of kernel stack
  uint64 sz;                   // Size of process memory (bytes)
  pagetable_t pagetable;       // User page table
  struct trapframe *trapframe; // data page for trampoline.S
  struct context context;      // swtch() here to run process
  struct file *ofile[NOFILE];  // Open files
  struct inode *cwd;           // Current directory
  char name[16];               // Process name (debugging)
  pagetable_t kernel_pt;
};
```

如上所示，` uint64 kstack;`代表内核栈地址，而` enum procstate state; `则是进程状态，`pagetable_t pagetable; `则是用户空间的页表。



我们来看看具体的资源分布情况：



- 指令实现了程序的运算。
- 数据是用于运算中的变量。
- 栈管理了程序的过程调用。

进程通过系统调用使用内核服务。系统调用会进入内核，让内核执行服务然后返回，所以进程总是在用户空间和内核空间中交替运行的。

| 系统调用                | 描述                            |
| ----------------------- | ------------------------------- |
| fork()                  | 创建进程                        |
| exit()                  | 结束当前进程                    |
| wait()                  | 等待子进程结束                  |
| kill(pid)               | 结束pid所指进程                 |
| getpid()                | 获取当前进程pid                 |
| sleep(n)                | 睡眠n秒                         |
| exec(filename,*argv)    | 加载并执行一个文件              |
| sbrk(n)                 | 为进程内存空间增加n字节         |
| open(filename,flags)    | 打开文件，flag指定读写模式      |
| read(fd,buf,n)          | 从文件中读取n个字节到buf        |
| write(fd,buf,n)         | 从buf中写n个字节到文件          |
| close(fd)               | 关闭打开的fd                    |
| dup(fd)                 | 复制fd                          |
| pipe(p)                 | 创建管道，并把读和写的fd返回到p |
| chdir(dirname)          | 改变当前目录                    |
| mkdir(dirname)          | 创建新的目录                    |
| mknod(name,major,minor) | 创建设备文件                    |
| fstat(fd)               | 返回文件信息                    |
| link(f1,f2)             | 给f1创建一个新名字（f2）        |
| unlink(filename)        | 删除文件                        |

系统调用的具体讲解我分布在其他博客中了。

#### 文件描述符

文件描述符是一个整数，它代表了一个进程可以读写的被内核管理的对象。进程可以通过多种方法获得一个文件描述符，如打开文件、目录、设备或者创建一个管道，或者复制已经存在的文件描述符。简单起见，我们常常把文件描述符指向的对象称为“文件”，文件描述符的接口是对文件、管道、设备等的抽象，这种抽象使得它们看上去就是字节流。

每个进程都有一张表，而xv6内核就是以文件描述符作为这张表的索引，所以每个进程都有一个从0开始的文件描述符空间。

传统 Unix 风格接口以同步 I/O 语义为主（阻塞、非阻塞、I/O 多路复用都属于同步通知模型）；现代系统也提供异步 I/O 机制，只是接口与使用方式更复杂。

对于异步IO，异步系统调用会立即返回，不会等待 I/O 操作的完成，应用程序可以继续执行其他的操作，等到 I/O 操作完成了以后，操作系统会通知调用进程。

对于同步IO：

- 阻塞IO，如果IO没有就绪就一直block，直到IO就绪。
- 非阻塞IO，

##### 系统调用read和write

系统调用`read`和`write`从文件描述符所指的文件中读或者写n个字节。`read`从fd中读最多n个字节，将它们拷贝到buffer中，然后返回读出的字节数。每一个指向文件的文件描述符都和一个偏移量有关，

我们都知道在linux中有一切皆文件的说法，linux中的所有内容都是以文件的形式保存和管理的，在linux中，文件具体可分为以下几种类型：

- 普通文件

  类似txt、jpg这种可以直接拿来使用的都是普通文件，linux用户根据访问权限的不同可以对于这些文件进行查看、删除以及更改操作。

- 目录文件

  在linux中，目录文件包含了此目录中各个文件的文件名以及执行这个文件的指针，打开目录等同于打开目录文件。

- 

###### "一切皆文件"的利弊

linux中所有读操作都可以用read函数来进行，几乎所有更改的操作都可以用write函数来进行。不过任何硬件设备都必须跟根目录下某一目录执行挂载操作，否则无法使用。

### 第一章

xv6使用页表（由硬件实现）来为每个进程提供其独有的地址空间。页表将虚拟地址翻译为物理地址。xv6为每个进程维护了不同的页表，这样就能够合理地定义进程的地址空间了，一片地址空间包含了从虚拟地址0开始的用户内存，

### 第二章

这一章细说页表。

操作系统通过页表机制实现了对内存空间的控制。除了传统的功能——让不同的进程各自的进程空间映射到相同的物理内存上，还能够为不同的进程的内存提供保护，我们还能够通过使用页表来间接实现一些特殊功能。xv6主要利用页表来

### 第三章

运行程序时，CPU一直处于一个大循环中：取指、更新PC、执行，取指。但有些情况下用户程序需要进入内核，而不是执行下一条用户指令，这些情况包括设备信号的发出，用户程序的非法操作，也就是我们所说的用户态进入内核态的三种情况——中断、异常和系统调用。处理这些情况面临三大挑战：

1. 内核必须使处理器能够从用户态转换到内核态（并且再转回到用户态）。
2. 内核和设备必须协调好他们并行的活动。
3. 内核必须知道硬件接口的细节。

用户程序通过系统调用请求系统服务；硬件产生引起操作系统注意的信号`interrupt`；非法程序操作产生的`exception`，都会使得用户态进入内核态。在所有的三种情况下，我们都要保证：系统必须保存寄存器以备将来的状态恢复。



### 第四章

xv6运行在多处理器上，即计算机上有多个单独执行代码的CPU，这些CPU操作同一片地址空间并分享其中的数据结构，xv6必须建立一种合作机制防止它们互相干扰，即使是在单个处理器上，xv6也必须使用某些机制来防止中断处理程序与非中断代码之间的相互干扰。xv6为这两种情况的使用提供了底层概念——锁。

#### 系统调用

`trap`调用`syscall`，`syscall`从中断帧中读出系统调用号。

### 第五章

#### 关于进程

xv6这个版本还没有线程的概念，因此我们要从proc（进程）的视角来看待它的运行和调度过程。

> “在大部分情况下，我们认为内核态是一种CPU的特权态，这个特权态下，CPU可以执行这个特权态才允许执行的指令，访问这个特权态才允许访问的资源。这和当前的进程无关。”

上面这句话描述的对象是CPU，从CPU的角度来说什么是内核态。对于CPU来说，用户态——内核态就是硬件上一个标志位的切换，从而可以执行一些特权级才能执行的指令。

那么我们从进程的角度来说内核态是怎么样的呢？援引陈海波教授《现代操作系统：原理与实现》的说法：

>处于进程地址空间最顶端的是内核内存。每个进程的虚拟地址空间里都映射了相同的内核内存。当进程在用户态运行时，内核内存对其不可见；只有当进程进入内核态时，才能访问内核内存。与用户态相似，内核部分也有内核需要的代码和数据段，当进程由于中断或系统调用进入内核后，会使用内核的栈。

这一点在xv6的`proc`结构也有所体现，我们来介绍一下`proc`结构，详情见`kernel/proc.h`：

```c
// Per-process state
struct proc {
  struct spinlock lock;

  // p->lock must be held when using these:
  enum procstate state;        // Process state
  void *chan;                  // If non-zero, sleeping on chan
  int killed;                  // If non-zero, have been killed
  int xstate;                  // Exit status to be returned to parent's wait
  int pid;                     // Process ID

  // wait_lock must be held when using this:
  struct proc *parent;         // Parent process

  // these are private to the process, so p->lock need not be held.
  uint64 kstack;               // Virtual address of kernel stack
  uint64 sz;                   // Size of process memory (bytes)
  pagetable_t pagetable;       // User page table
  struct trapframe *trapframe; // data page for trampoline.S
  struct context context;      // swtch() here to run process
  struct file *ofile[NOFILE];  // Open files
  struct inode *cwd;           // Current directory
  char name[16];               // Process name (debugging)
  pagetable_t kernel_pt;
};
```

在上述代码中，我们可以看到如下成员：

- `int killed`，表示进程是否被杀死；

- `struct proc *parent`，指向父进程；

- `uint sz`，进程空间的大小；

  ........

我们可以看到有一个`uint64 kstack`的成员，这就是进程内核栈的地址。当进程由于中断或系统调用进入内核后，会使用内核的栈。类比到 Linux，对应的调度实体是 `task_struct`，但 `proc` 并不等于 `task_struct` 的“改名版”，两者属于不同内核实现中的结构体定义。

---

---

值得注意的是：在 Linux 内核中，进程和线程都用 `task_struct` 描述，线程本质上是“共享更多资源的 task”。因此它们在统一调度框架下运行，但并不是“没有线程概念”，而是“用统一抽象表示进程/线程”。

---

---

我们来看看进程的process memory是如何分布的，也就是它的虚拟地址空间如何分布，其实在`proc`结构体中，我们有了`pagetable`、`sz`和`kstack`就可以基本描述我们的虚拟用户空间，如下图所示：


内核在创建进程的时候，会为进程创建相应的堆栈。每个进程会有两个栈，一个用户栈，存在于用户空间，一个内核栈，存在于内核空间。当进程在用户空间运行时，CPU堆栈指针寄存器里面的内容是用户堆栈地址，使用用户栈；当进程在内核空间时，CPU堆栈指针寄存器里面的内容是内核栈空间地址，使用内核栈。当进程因为中断或者系统调用而陷入内核态时，进程所使用的堆栈也要从用户栈转到内核栈。进程进入内核态后，先把用户态堆栈的地址保存在内核栈中，然后设置堆栈指针寄存器的内容为内核栈的地址，这样就完成了用户栈向内核栈的切换。

值得注意的是：用户堆是低地址到高地址的，而用户栈是高地址到低地址的。

进程的上下文包括进程运行时的寄存器状态，其能够用于保存和恢复一个进程在处理器上运行的状态。我们看看context的结构就知道了：

```c
// Saved registers for kernel context switches.
struct context {
  uint64 ra;
  uint64 sp;

  // callee-saved
  uint64 s0;
  uint64 s1;
  uint64 s2;
  uint64 s3;
  uint64 s4;
  uint64 s5;
  uint64 s6;
  uint64 s7;
  uint64 s8;
  uint64 s9;
  uint64 s10;
  uint64 s11;
};
```

这里保存的全是寄存器状态。

进程间切换：进程间的切换可以看成是PCB的切换，也就是地址空间的切换、`context`的切换以及栈指针的切换。当进程要切换的时候就会把它（now_process)的状态保存在$PCB_1$中，然后将下一个进程先前保存的$PCB_2$取出来，将$PCB_2$的`context`的状态取出来恢复到对应的寄存器中，然后将用然后将$PCB_2$中的其他信息（pagetable、stack、pid等）写入now_process中，从而切换到该进程执行。

#### 调度与多路复用

当进程数>处理器的数量的时候，我们就要考虑如何分享处理器资源，即如何调度资源。通常我们对进程造成一个自己独占处理器的家乡，然后让操作系统的多路复用机制将单独的一个物理处理器模拟为多个虚拟处理器。

当一个进程等待磁盘请求的时候，xv6使之进入睡眠状态，然后调度执行另一个进程。另外，当一个进程耗尽了它在处理器上的时间片的时候，xv6使用时钟中断强制它停止运行，这样调度器才能调度运行其他进程，这样的多路复用机制为进程提供了独占处理器的假象。

进程调度的主要功能是按照一定的策略选择—个处于就绪状态的进程，使其获得处理机执行。根据不同的系统设计目的，有各种各样的选择策略，例如系统开销较少的静态优先数调度法，适合于分时系统的轮转法(Round RoLin) 和多级互馈轮转法(Round Robin with Multip1e feedback) 等。这些选择策略决定了调度算法的性能。


##### 进程切换

###### 上下文切换

xv6在底层实现了两种上下文切换：

1. 从进程的内核线程切换到当前CPU的调度器线程；
2. 从调度器线程切换到进程的内核线程。



###### 具体的实现过程

进程的切换是通过用户态——内核态切换、切换到调度器、切换到新进程的内核线程、最后返回用户态实现的。如下图所示：


> 好了，然后工程师们就发现，其实一个线程分为 “内核态 “线程和” 用户态 “线程。
>
> [《GMP调度器》](https://learnku.com/articles/41728)

这其实是一种诙谐的说法，我们在上面看到确实一个线程（进程）是分为用户态和内核态的。

每个xv6进程都有自己的内核空间以及内核栈以及寄存器集合。每个CPU都有一个单独的调度器线程，这样调度就不会发生在进程的内核线程中，而是在此调度器线程中，线程切换涉及到了保存旧线程的CPU寄存器，恢复新线程之前保存的寄存器。

当进程让出CPU时，进程的内核线程调用swtch来保存自身进程的上下文然后返回到调度器的上下文中。这也就是第一个swtch，第二个swtch同理，swtch简单的保存和恢复寄存器集合。每个上下文以结构体`struct context*`表示，实际上就是一个保存在内核栈中的指针，swtch有两个参数，`struct context *old`，`struct context *new`。

回到上面我标成黄色的句子，xv6默认实现里没有 Linux 那样的多线程用户进程模型（每个 `proc` 对应一个执行流），所以书里说“线程”时更多是在解释调度语义，而不是说 xv6 已经实现了完整的 pthread 风格线程库。Linux 中进程/线程在内核里都是 `task_struct`，差别主要体现在资源是否共享。

在 xv6 中，可以把一次系统调用/中断理解为“同一执行流在用户态与内核态之间切换”，其中 `kstack` 是该执行流在内核态使用的栈地址。当发生切换时：

1. 将对应的用户栈的PC地址和寄存器信息保存起来（xv6中是保存在内核栈），方便后续内核方法调用完毕后，恢复用户方法执行的现场。

2. 将CPU的字段改为内核态（硬件标志位），将内核段对应的代码地址写入到PC寄存器中，设置堆栈指针寄存器的内容为内核栈的地址，然后开始执行内核方法。

3. 当内核方法执行完毕后，会将CPU的字段改为用户态，然后利用之前用户态的信息来恢复用户栈的执行。

在 Linux 中，线程通常由 `clone` 系统调用支持实现，线程之间共享地址空间、文件描述符等资源，但拥有各自的执行上下文。`vfork` 更适合描述“创建后立刻 exec”的子进程场景，它会让父子进程暂时共享地址空间，但不能把它简单等同于线程创建。因此，更准确的说法是：线程是共享同一进程资源的一组执行流，而 xv6 这里讨论的 `swtch` 关注的是内核调度时如何保存和恢复执行上下文。



### 第六章

#### 文件系统

正如我们在第〇章所说，xv6的文件系统中使用了类似Unix的文件、文件描述符、目录和路径，并且把数据存储到一块内存，我们通过xv6中的描述来具体看看：

```c
int open(const char*, int);
```

第一个参数代表文件路径字符串，第二个参数是`flag`，表示以何种方式打开文件，返回值是文件描述符。说到这里，我们来说说文件描述符指向的结构：

```c
struct file {
  enum { FD_NONE, FD_PIPE, FD_INODE, FD_DEVICE } type;
  int ref; // reference count
  char readable;//能读
  char writable;//能写
  struct pipe *pipe; // FD_PIPE
  struct inode *ip;  // FD_INODE and FD_DEVICE
  uint off;          // FD_INODE
  short major;       // FD_DEVICE
};
```



### 实例

我们从一个实例来看看xv6的调度情况：

如上图所示：我们从一个shell语句开始，例如我们执行`read `这个语句，我们为了进入内核，要先执行如下代码：

```assembly
read:
	li a7,SYS_read
	ecall
	ret
.global read
```

在上述代码中，我们会将系统调用号`SYS_read`放入a7寄存器
