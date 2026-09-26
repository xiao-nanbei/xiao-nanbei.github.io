---
title: 'MIT 6.S081 Lab 5: Lazy page allocation'
date: 2023-02-21 16:04:00
categories:
- 操作系统
tags:
- MIT 6.S081 Lab
---

#### Eliminate allocation from sbrk()

我们先来看看这个图：

![](https://img2020.cnblogs.com/blog/2002319/202101/2002319-20210104192210213-1712203988.png)

代码段不必多说，唯一要注意的点是：在原始 xv6 实现里，`sbrk()` 会触发实际物理页分配并建立映射；而本实验要改成“先只扩大地址空间，再按缺页异常补映射”的方式。

本实验你的任务是修改 `sys_sbrk()`使得其只增加/减少进程地址空间大小，而不真正地分配页面。`sbrk`是xv6提供的系统调用，它使得用户应用程序能扩大自己的`heap` ，相当于linux中的`brk`。

在xv6中，`sbrk`的实现默认是`eager allocation`，一旦调用了`sbrk`，内核就会立即分配物理内存给进程。我们可以利用`lazy allocation`来做，`sbrk`基本不做任何事，只是改变`p->sz`的大小。这里的 `n` 是按字节计算的增量，而不是“页数”；真正按页分配会延后到 page fault 发生时。

我们先来看看原版本：

```c
uint64
sys_sbrk(void)
{
  int addr;
  int n;

  if(argint(0, &n) < 0)//检测传入的参数
    return -1;
  addr = myproc()->sz;//uint64 sz,Size of process memory (bytes)
  if(growproc(n) < 0)//分配n个bytes
    return -1;
  return addr;
}
```

我们看看growproc函数，就知道为什么要这么做了：

```c
// Grow or shrink user memory by n bytes.
// Return 0 on success, -1 on failure.
int
growproc(int n)
{
  uint sz;
  struct proc *p = myproc();

  sz = p->sz;
  if(n > 0){
    if((sz = uvmalloc(p->pagetable, sz, sz + n)) == 0) {
      return -1;
    }
  } else if(n < 0){
    sz = uvmdealloc(p->pagetable, sz, sz + n);
  }
  p->sz = sz;
  return 0;
}
```

大家看，在上述函数中，使用uvmalloc函数是会为这个进程的虚拟地址分配实际的物理内存的。

在sys_sbrk()函数中，用来分配页面的是growproc函数，我们直接修改这部分：

```c
uint new_addr=addr+n;//直接把地址+n，分配虚拟地址
myproc()->sz=newaddr;
```

然后对new_addr控制在合理的范围之内范围：

```c
if(newaddr>=MAXVA||newaddr<=0){
	return addr;
}
```

#### Lazy allocation

本实验中，你的目标是修改trap.c和其他地方的代码，使得在你的代码能够在缺页时分配一块新的内存并建立映射。

page fault可以让地址映射关系变得动态起来，这也是我们实现lazy allocation的关键。当发生page fault的时候，xv6内核会打印出错的虚拟地址，并且会将这个地址保存在STVAL寄存器中；当用户程序触发 page fault，控制流会切换到内核，再由内核根据 `stval` 中的故障地址判断如何处理。

对于不同场景，page fault 的 `scause` 值不同：`13` 常见于 load page fault，`15` 常见于 store/AMO page fault，`12` 常见于 instruction page fault。

##### 缺页处理

我们可以先检查是否为缺页错误。当我们看到了一个page fault，相应的虚拟地址小于当前*p->sz*，同时大于stack，那么我们就知道这是一个来自于heap的地址，但是内核还没有分配任何物理内存。所以对于这个page fault的响应也理所当然的直接明了：在page fault handler中，通过kalloc函数分配一个内存page；初始化这个page内容为0；将这个内存page映射到user page table中；最后重新执行指令。比方说，如果是load指令，或者store指令要访问属于当前进程但是还未被分配的内存，在我们映射完新申请的物理内存page之后，重新执行指令应该就能通过了。

在usertrap函数中，我们可以为缺页异常添加检测：如果缺页异常确实来自 lazy allocation 的地址区间，就分配物理内存并建立页表映射，代码如下：

```c
 if((r_scause() == 13 || r_scause() == 15) && trap_by_lazyallocation){ // 缺页异常，并且发生异常的地址进行过懒分配
       // 分配物理内存，并在页表创建映射
    } else { // 如果不是缺页异常，或者是在非懒加载地址上发生缺页异常，则抛出错误并杀死进程
      printf("usertrap(): unexpected scause %p pid=%d\n", r_scause(), p->pid);
      printf("            sepc=%p stval=%p\n", r_sepc(), r_stval());
      p->killed = 1;
    }
```

那么我们如何检测是否是lazy allocation导致的错误呢？我们需要定义一个函数`trap_by_lazyallocation`，其实现如下：

```c
uint64 va = r_stval();// 获取触发缺页异常的虚拟地址
if(va<p->sz){
    return 1;
}else{
    return 0;
}
```

也就是说，当我们的这个要访问的页面小于进程的整个逻辑内存的页面的数量时，说明是缺页的。但是测试之后发现不对，我们再次修改：

```c
((pte = walk(p->pagetable, va, 0))==0) || ((*pte & PTE_V)==0)
```

同时还要确认这个 va 当前没有有效映射（PTE_V 未置位），这样才能把它归类为“应由懒分配补齐”的缺页。那具体如何分配呢？

我们可以通过`uvmalloc`函数来做到分配物理页面，先来看看`uvmalloc`函数：

```c
uint64
uvmalloc(pagetable_t pagetable, uint64 oldsz, uint64 newsz)
{
  char *mem;
  uint64 a;

  if(newsz < oldsz)
    return oldsz;

  oldsz = PGROUNDUP(oldsz);
  for(a = oldsz; a < newsz; a += PGSIZE){
    mem = kalloc();
    if(mem == 0){
      uvmdealloc(pagetable, a, oldsz);
      return 0;
    }
    memset(mem, 0, PGSIZE);
    if(mappages(pagetable, a, PGSIZE, (uint64)mem, PTE_W|PTE_X|PTE_R|PTE_U) != 0){
      kfree(mem);
      uvmdealloc(pagetable, a, oldsz);
      return 0;
    }
  }
  return newsz;
}
```

我们仿照上述的`uvmalloc`函数来编写下面的`uvm_lazy`函数：

```c
 memset(mem, 0, PGSIZE);
 mappages(p->pagetable, PGROUNDDOWN(va), PGSIZE, (uint64)mem, PTE_W|PTE_X|PTE_R|PTE_U)
```

这样就完成了 lazy 分配路径的核心映射逻辑。

---

补充一个 `segmentation fault` 的知识：`SIGSEGV` 本质上是“进程访问了当前页表权限不允许的虚拟地址”，并不等价于“越过了某个段的边界”。

在 xv6 中，如果用户态访问未映射页、访问超出 `p->sz` 的地址，或违反页权限（例如向只读页写入），内核同样会在 trap 中识别异常并杀死进程。Linux 里看到的 “Segmentation fault” 也是这类地址访问异常在用户态的表现，底层主要依赖页表和权限位检查。

常见触发场景包括：空指针解引用、野指针、越界访问、向只读映射写入，或执行不可执行页面等。

指针越界访问是触发 `SIGSEGV` 的常见原因之一。

---
