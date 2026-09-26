---
title: 'MIT 6.S081 Lab 3: Page tables'
date: 2022-01-19 01:57:32
categories:
- 操作系统
tags:
- MIT 6.S081 Lab
---

> 当我第一次学习它，还是一个学生的时候，我想它是很直接的，能有多难，就是一个表要将虚拟地址映射到物理地址。或许有点复杂，但不是那么复杂。只有当用它编程时，我才知道虚拟内存是巧妙的，迷人的，非常强大。

在本次实验中，您将探索页表并修改它们以简化将数据从用户空间复制到内核空间的函数。在讲解实验之前，我们先要了解页表结构。

页表（pagetable）是做地址翻译与权限控制的：把 Virtual Address (VA) 映射到 Physical Address (PA)，并检查访问权限位。更准确地说，页表不是“用虚拟地址直接做索引的一维数组”，而是按页粒度组织、由多级索引逐层查找的映射结构。页表本身放在内存中，硬件通过页表基址寄存器定位其起点。

如何解决页表占用内存过大呢？

- 不要为每个地址创建一个表单条目，而是为每个page创建一条表单条目
- **多级页表**

我们首先来了解一下pagetable是如何实现的：

#### 页表

##### 页表的实现

![](https://pic2.zhimg.com/v2-2635bdb5168de78ce3ad23f9857fd7e9_b.jpg)

假设一个page的大小为4kb,对于虚拟地址，将它划分为两部分，index和offset，index用来查找page，offset对应的是一个page中的哪个字节。当MMU在做地址翻译的时候，通过读取虚拟内存地址中的index可以知道物理内存中的page号，这个page号对应了物理内存中的4096个字节。之后虚拟内存地址中的offset指向了page中的4096个字节中的某一个，假设offset是12，那么page中的第12个字节被使用了。将offset加上page的起始地址，就可以得到物理内存地址。

以上图为例，每个页表仍然需要2^27个条目，每个条目占8个字节，每个页表占内存1GB，而且每个进程都会有一个页表，这仍然是不能接受的。到目前为止，最大的问题是即使应用程序所引用的只是虚拟地址空间中很小的一部分，也总是需要一个完整的页表驻留在内存中。（上述例子来源于[博客](https://wjrsbu.smartapps.cn/zhihu/article?id=369660512&isShared=1&_swebfr=1&_swebFromHost=baiduboxapp))

##### 多级页表

![](https://pic1.zhimg.com/v2-3eaf43267f882245cc176d23274c1978_b.jpg)

以xv6使用的RISC-V框架为例，使用三级页表。我们之前所说的VA中的27bit的index，实际上是由3个9bit的数字组成（L2，L1，L0）。对于L2，其被用来索引最高级的page directory，directory中的一个条目被称为PTE(Page Table Entry)是64bit，而一个page directory是4KB，这样的话，一个PT中就有512个PTE，也就是说我们的L2的9bit可以对应一个page directory的PTE，而PTE的组成部分是PPN+Flags，这个PPN指向中间级的page directory。同理，我们使用L1找到中间级page directory的PPN，在最低级的pagedirectory，我们可以得到对应于虚拟内存地址的物理内存地址。

多级页表相较于一级页表，能大大减少pagetable的大小，优化空间。

##### x86页表的实现

x86页表在物理内存中像一棵两层的树，也就是两级页表。树的根是一个4096字节的页目录，其中包含1024个PTE的条目（每个条目占4字节），每个条目是指向一个页表页，每个页表页包含1024个32位PTE的数组（PTE就是虚拟地址到物理地址映射的条目），如下图所示：


如上图所示，经典 32 位两级分页里常见划分是 10 位 Dir、10 位 table、12 位 offset。先用 Dir 定位页目录项，再用 table 定位页表项，最后把页框号与 12 位 offset 组合得到物理地址。

#### xv6对页表的使用

![](https://img-blog.csdnimg.cn/img_convert/493f49ab5868db801f35592c0434adda.png)

这个是xv6中PTE的结构，其中，53-10位是PPN，余下几位是flag位，弄懂标志位的含义对本实验至关重要，第0位V表示该PTE是否可用，第1位R表示该PTE是否可读；第2位W表示该PTE是否可写；第3位X表示是否可执行的。

虚拟内存有两个主要的优点：

- 隔离性：虚拟内存使操作系统可以为每个应用程序提供独立地址空间。应用程序不能直接访问其他进程或内核的内存，除非内核显式建立了可访问映射。
- 提供了一层抽象：处理器和所有的指令都可以使用虚拟地址，而内核会定义从虚拟地址到物理地址的映射关系。

#### Print a page table

该任务是编写一个打印页表内容的函数，定义一个名为`vmprint()`的函数。

`在 exec.c 中的return argc`之前插入`if(p->pid==1) vmprint(p->pagetable)`，以打印第一个进程的页表。也就是说

这个pagetable_t参数指的就是进程的页表号，或者说对应的页表中的首地址（暂时来看这是最好的理解）。

在riscv.h中定义了如下所示的宏，也就是说pagetable_t参数是一个uint64类型的指针，一个页表有512个PTE。

```c
typedef uint64 *pagetable_t; // 512 PTEs
```

1.我们在exec.c的`return argc`前加入下列代码：

```c
if(p->pid==1){
	vmprint(p->pagetable);
}
```

2.我们在defs.h中定义vmprint函数的原型，以便在exec.c中调用它：

```c
void            vmprint(pagetable_t)
```

3.编写vmprint函数如下所示：

```c
void 
printwalk(pagetable_t pagetable, uint level) {
  char* prefix;
  //不同级别的页表打印不同的..
  if (level == 2) prefix = "..";
  else if (level == 1) prefix = ".. ..";
  else prefix = ".. .. ..";
  for(int i = 0; i < 512; i++){ // 每级页表有512项
    pte_t pte = pagetable[i];
    if(pte & PTE_V){ // 该页表项有效
      uint64 pa = PTE2PA(pte); // 将pte中转化为pa
      //打印PTE对应的PA
      printf("%s%d: pte %p pa %p\n", prefix, i, pte, pa);
      if((pte & (PTE_R|PTE_W|PTE_X)) == 0){ // 如果有下一级页表
         printwalk((pagetable_t)pa, level - 1);
      }
    }
  }
}
 
void
vmprint(pagetable_t pagetable) {
  printf("page table %p\n", pagetable);
  printwalk(pagetable, 2);
}
```

如果PTE_V==1，则说明该页表项有效。如果pte中的PTE_R、PTE_W和PTE_X位都是0，则说明有下一级页表，可以通过递归进入下一级页表。

#### A kernel page table per process 

xv6为每个进程的用户地址空间提供一个单独的页表，然而从用户态进入内核态中，多个进程使用的是一个内核页表。这个任务的目标是让每一个进程进入内核态后，都能有自己的独立内核页表。

首先，我们要在进程的结构体proc中添加一个`pagetable_t kernel_pagetable`，表示每个进程在内核态中有自己独立的内核页表，结构体如下所示：

```c
// kernel/proc.h
// Per-process state
struct proc {
  struct spinlock lock;

  // p->lock must be held when using these:
  enum procstate state;        // Process state
  struct proc *parent;         // Parent process
  void *chan;                  // If non-zero, sleeping on chan
  int killed;                  // If non-zero, have been killed
  int xstate;                  // Exit status to be returned to parent's wait
  int pid;                     // Process ID

  // these are private to the process, so p->lock need not be held.
  uint64 kstack;               // Virtual address of kernel stack
  uint64 sz;                   // Size of process memory (bytes)
  pagetable_t pagetable;       // User page table
  struct trapframe *trapframe; // data page for trampoline.S
  struct context context;      // swtch() here to run process
  struct file *ofile[NOFILE];  // Open files
  struct inode *cwd;           // Current directory
  char name[16];               // Process name (debugging)
  pagetable_t kernel_pb;     // Kernel page table （在 proc 中添加该 field）
};

```

至于proc结构体在下一个实验前细说。

在`kernel/vm.c`中，我们发现了如下变量：

```c
/*
 * the kernel's page table.
 */
pagetable_t kernel_pagetable;
```

这就是我们内核中的唯一的`kernel_pagetable`，在原版本中，vm.c中的`void kvminit(void)`会调用kvmake函数来修改kernel_pagetable，那么现在我们需要修改kvminit函数，来让我们的每个进程在内核中都有自己的内核页表。我们先来看看原版本中的实现：

```c
// Initialize the one kernel_pagetable
void
kvminit(void)
{
  kernel_pagetable = kvmmake();
}

pagetable_t
kvmmake(void)
{
  pagetable_t kpgtbl;

  kpgtbl = (pagetable_t) kalloc();
  memset(kpgtbl, 0, PGSIZE);

  // uart registers
  kvmmap(kpgtbl, UART0, UART0, PGSIZE, PTE_R | PTE_W);

  // virtio mmio disk interface
  kvmmap(kpgtbl, VIRTIO0, VIRTIO0, PGSIZE, PTE_R | PTE_W);

  // PLIC
  kvmmap(kpgtbl, PLIC, PLIC, 0x400000, PTE_R | PTE_W);

  // map kernel text executable and read-only.
  kvmmap(kpgtbl, KERNBASE, KERNBASE, (uint64)etext-KERNBASE, PTE_R | PTE_X);

  // map kernel data and the physical RAM we'll make use of.
  kvmmap(kpgtbl, (uint64)etext, (uint64)etext, PHYSTOP-(uint64)etext, PTE_R | PTE_W);

  // map the trampoline for trap entry/exit to
  // the highest virtual address in the kernel.
  kvmmap(kpgtbl, TRAMPOLINE, (uint64)trampoline, PGSIZE, PTE_R | PTE_X);

  // map kernel stacks
  proc_mapstacks(kpgtbl);
  
  return kpgtbl;
}

void
kvmmap(pagetable_t kpgtbl, uint64 va, uint64 pa, uint64 sz, int perm)
{
  if(mappages(kpgtbl, va, sz, pa, perm) != 0)
    panic("kvmmap");
}
```

我们可以模仿内核页表初始化的方式初始化用户进程的kernel pagetable。

```cpp
// 模仿vm.c中kvminit的方式构建每个进程自己
// 的内核映射表 TODO:删除
pagetable_t
proc_kpt_init()
{
  pagetable_t kpt;
  kpt = uvmcreate();
  if (kpt == 0) return 0;
  uvmmap(kpt, UART0, UART0, PGSIZE, PTE_R | PTE_W);
  uvmmap(kpt, VIRTIO0, VIRTIO0, PGSIZE, PTE_R | PTE_W);
  uvmmap(kpt, CLINT, CLINT, 0x10000, PTE_R | PTE_W);
  uvmmap(kpt, PLIC, PLIC, 0x400000, PTE_R | PTE_W);
  uvmmap(kpt, KERNBASE, KERNBASE, (uint64)etext-KERNBASE, PTE_R | PTE_X);
  uvmmap(kpt, (uint64)etext, (uint64)etext, PHYSTOP-(uint64)etext, PTE_R | PTE_W);
  uvmmap(kpt, TRAMPOLINE, (uint64)trampoline, PGSIZE, PTE_R | PTE_X);
  return kpt;
}

// 添加映射到用户进程的kernel pagetable
void 
uvmmap(pagetable_t pagetable, uint64 va, uint64 pa, uint64 sz, int perm)
{
  if(mappages(pagetable, va, sz, pa, perm) != 0)
    panic("uvmmap");
}
```



#### Simplify `copyin/copyinstr`
