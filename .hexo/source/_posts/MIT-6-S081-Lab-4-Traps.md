---
title: 'MIT 6.S081 Lab 4: Traps'
date: 2022-02-01 21:39:43
categories:
- 操作系统
tags:
- MIT 6.S081 Lab
---

#### 先来说说trap

我们知道，用户态切换到内核态的有两种情况：一种是系统调用（syscall），另一种是异常（trap）或中断（interruption），在前面的实验中我们学习了系统调用。我们先来回忆一下在lab1中做过的`sleep`任务。在进入内核后，会调用`sys_sleep`函数。关于用户态转到内核态我们在lab2中已经讲过了。

##### trap机制

在x86中我们常常说中断，但是在xv6中我们都是使用trap来代表他们，因为trap是传统的Unix术语。trap是由在CPU上运行的当前进程导致的；而中断是由设备导致的，可能与当前进程毫无关系。但是他们都**依赖相同的硬件机制在用户模式和内核模式之间进行切换**。

在从用户态转到内核态的时候，都相当于执行了一个中断响应的过程，因为系统调用实际上最终是中断机制实现的。其具体过程如下：

1. 首先，保存32个用户寄存器，因为我们需要恢复用户应用程序的执行。但是这些寄存器又要被内核代码所使用，所以在trap之前，我们必须在某处保存这32个用户寄存器。（当然，stack pointer也在这32个寄存器里面的）
2. 程序计数器也要在某个地方保存，因为我们需要在用户程序运行中断的位置继续执行用户程序。
3. 将CPU的字段改为内核态（硬件标志位）。
4. SATP寄存器也要改变，此时SATP寄存器正指向user page table，我们要将SATP指向kernel   page table。
5. 我们要将堆栈寄存器指向位于内核的一个地址，因为我们需要一个堆栈来调用内核的C函数。
6. 一旦我们设置好了，我们需要跳入内核的C代码。

---

我们在实验2中知道，用户态在进入内核态的时候调用了一个entry，如下所示：

```
fork:
 li a7, SYS_fork
 ecall
 ret
.global exit
```

ecall是什么呢？ecall就是将CPU中的mode标志位设置为supervisor，并且设置程序计数器的值为STVEC寄存器的值。内核会将trampoline page的地址存在STVEC寄存器中，所以ecall的下一条指令的位置是STVEC指向的地址，也就是trampoline page的起始地址。

##### `kernel/trampoline.S`

trampoline.S从user space过渡到kernel space，kernel space返回到user space。STVEC寄存器中存储的是 trampoline page 的起始位置。**进入内核前，首先需要在该位置处执行一些初始化的操作。例如，切换页表、切换栈指针等操作**。cpu 从 trampoline page 处开始进行取指执行。接下来需要**保存所有寄存器的值**，寄存器的值是如何保存的呢？当寄存器里面的还都是用户程序的数据的时候，我们需要非常小心，我们在这个时间点不能使用任何寄存器，否则我们是没法恢复寄存器数据的。如果内核在这个时间点使用了任何一个寄存器，内核会覆盖寄存器内的用户数据，如果我们要尝试恢复用户数据，我们就不能恢复寄存器中的正确数据，用户程序的执行也会相应的出错。比如说，trampoline里面有个csrrw指令，这是trampoline page的第一条指令，这条指令的意思是交换a0和sscratch中的内容，在这之后内核就可以任意使用a0寄存器了。

以便在系统调用后恢复调用前的状态。然后我们要根据中断的原因执行相应的处理：产生中断的原因有很多，比如**系统调用、运算时除以0、使用了一个未被映射的虚拟地址、或者是设备中断等等**。这里是因为系统调用，所以以系统调用的方式进行处理。然后才是内核态执行系统调用函数，将ecall指令时保存在a7的参数取出来，完成相应的系统调用函数，系统调用完成之后将寄存器的值取出来，从该地址存储的指令处开始执行，恢复到用户态。

#### RISC-V assembly

源文件`call.c`代码如下所示：

```c
#include "kernel/param.h"
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"

int g(int x) {
  return x+3;
}

int f(int x) {
  return g(x);
}

void main(void) {
  printf("%d %d\n", f(8)+1, 13);
  exit(0);
}
```

我们先编译一下源文件得到`call.asm`，部分代码如下所示：

```asm
void main(void) {
  1c:	1141                	addi	sp,sp,-16
  1e:	e406                	sd	ra,8(sp)
  20:	e022                	sd	s0,0(sp)
  22:	0800                	addi	s0,sp,16
  printf("%d %d\n", f(8)+1, 13);
  24:	4635                	li	a2,13
```



1. Q:Which registers contain arguments to functions? For example, which register holds 13 in main's call to `printf`?

   A:a0-a7.A2 holds 13 in main's call to printf.

2. Q:Where is the call to function `f` in the assembly code for main? Where is the call to `g`? (Hint: the compiler may inline functions.)

   A:nowhere, compiler optimization by inline function.

   其实是没有这样的代码。 g(x) 被内联到 f(x) 中，然后 f(x) 又被进一步内联到 main() 中。所以看到的不是函数跳转，而是优化后的内联函数。

3. Q:At what address is the function `printf` located?


#### Backtrace

使用这些帧指针向上遍历堆栈并在每个堆栈帧中打印保存的返回地址。

我们知道x86使用函数参数压栈的方式来保护函数参数，而xv6使用寄存器的方式保存参数。无论是x86还是xv6,函数调用时，都需要将返回地址和父函数的栈帧起始地址压入栈中。即被调用函数的栈帧中保存着这两个值，在xv6中，fp为当前函数的栈顶指针，sp为栈底指针。fp-8存放返回地址，fp-16存放原栈帧。

我们看如下这幅图：

![](https://pic4.zhimg.com/80/v2-d7a2b1baeaf71d7e0c2cf306d80c49d7_720w.jpg)

fp指向当前栈帧的开始地址，sp指向结束地址，我们可以看到，栈是从高地址到低地址，fp是高地址，sp是低地址，fp-8是`return address`，fp-16是`to prev.frame`，分别代表返回地址和原栈帧。

我们根据提示，将backtrace的原型添加到`kernel/defs.h`中，代码如下所示：

```c
// printf.c
void            printf(char*, ...);
void            panic(char*) __attribute__((noreturn));
void            printfinit(void);
void            backtrace(void);
```

GCC 编译器将当前执行函数的帧顶指针存储在寄存器`s0`中。因此我们通过`r_fp`函数可以知道当前函数的栈顶指针fp：

```c
kernel/riscv.h:
static inline uint64
r_fp()
{
  uint64 x;
  asm volatile("mv %0, s0" : "=r" (x) );
  return x;
}
```

`backtrace`函数如下：

```c++
void
backtrace(void){
  uint64 fp = r_fp(), top = PGROUNDUP(fp);
  printf("backtrace:\n");
  for(; fp < top; fp = *((uint64*)(fp-16))) {//我们知道，每个fp-16就是原栈帧，我们通过*(fp-16)得到原栈帧，保存在fp中，然后打印*(fp-8)
    printf("%p\n", *((uint64*)(fp-8)));
  }
}
```



#### Alarm

在本练习中，您将向xv6添加一项功能，该功能会在使用CPU时间的情况下定期向进程发出警报。这对于想要限制消耗多少CPU时间的计算密集型进程，或者对于想要进行计算但还希望采取一些定期操作的进程很有用。

您应该添加一个新的`sigalarm(interval,handler)`系统调用。 如果应用程序调用`sigalarm(n,fn)`，则在程序每消耗n个“ tick” CPU时间之后，内核应导致调用应用程序函数fn。 当fn返回时，应用程序应从中断处恢复。

###### 实现过程

我们首先看到测试函数，代码解析在注释中：

```c
void
test0()
{
  int i;
  printf("test0 start\n");//开始测试
  count = 0;//计数器为0
  sigalarm(2, periodic);//在消耗2个cpu时间之后，调用periodic函数
  for(i = 0; i < 1000*500000; i++){
    if((i % 1000000) == 0)
      write(2, ".", 1);
    if(count > 0)
      break;
  }
  sigalarm(0, 0);//停止生成定期警报调用
  if(count > 0){
    printf("test0 passed\n");
  } else {
    printf("\ntest0 failed: the kernel never called the alarm handler\n");
  }
}
void
periodic()
{
  count = count + 1;
  printf("alarm!\n");//打印"alarm"
  sigreturn();//调用sigreturn函数
}
```

- 在`user/user.h`，我们需要做如下声明：

```c
int sigalarm(int ticks, void (*handler)());
int sigreturn(void);
```

- 在 user/usys.pl 添加 entry：

```c
entry("sigalarm");
entry("sigreturn");
```

- 在 kernel/syscall.h 中添加函数调用码：

```c
frame pointer。#define SYS_sigalarm  22
#define SYS_sigreturn 23
```

- 在 kernel/syscall.c 添加函数调用代码：

```c
extern uint64 sys_sigalarm(void);
extern uint64 sys_sigreturn(void);
[SYS_sigalarm]  sys_sigalarm,
[SYS_sigreturn] sys_sigreturn,
```

我们需要在proc结构体中添加字段，用于记录进程的滴答数——`uint64 ticks`；还需要一个`uint64 interval`，ticks达到interval便中断；当然，还需要一个函数指针`alarm_pointer`，用来中断时的调用。

```c
if(which_dev == 2) {//which_dev为2说明是因为定时引起的
    if(p->interval) {
      if(p->ticks == p->interval) {//当alarm_interval==0 && alarm_handler==0时，内核应该停止产生周期性的报警调用
        p->ticks = 0;  
        p->trapframe->epc = p->handler;
      }
      p->ticks++;
    }
    yield();
  }
```





