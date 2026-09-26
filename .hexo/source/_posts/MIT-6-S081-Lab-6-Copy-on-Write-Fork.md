---
title: 'MIT 6.S081 Lab 6: Copy-on-write fork'
date: 2022-02-24 22:58:34
categories:
- 操作系统
tags:
- MIT 6.S081 Lab
---

> 早期的fork()实现较为“简单粗暴”，会将父进程的物理内存完整拷贝一份，并映射到子进程的内存空间中，这种方式在很多情况下是不必要的，一部分虚拟内存是只读的，对他们进行拷贝是一种浪费，其次，由于进程有时会在调用fork函数之后立即调用exec以载入新的可执行文件，重置地址空间，之前的内存拷贝就完全失去了意义。因此可以用写时拷贝技术来对fork的实现进行优化。对于本来就是只读的虚拟页，父进程和子进程可以共享这些页，减少了拷贝的开销。但对于容易发生变化的虚拟页，如果出现了写操作，就会触发写时拷贝。
>
> ——陈海波《现代操作系统：原理与实现》

传统的`fork`函数会复制数据段、堆、栈，而代码段则不会复制，而是采用映射的方式映射到父进程的代码段，这也很好解释，因为我们不需要去更改代码段的内容，也就没必要复制。

当两个进程拥有很多相同的内存数据，如果把这些数据相同的内存页在物理内存中仅存储一份，然后以只读的方式映射给两个应用程序，那么就能显著地节约物理内存资源。如下图所示：



`PTE`除了记录物理页号，还记录了别的信息，我们回忆实验3里面讲的，`PTE`中有一些标志位，用来表示虚拟页的权限的权限位。写时拷贝正是利用表示“是否可写”的权限位来实现的。

`COW fork() `只为孩子创建一个页表，用户内存的 PTE 指向父级的物理页面。`COW fork() `将 parent 和 child 中的所有用户 PTE 标记为不可写。当任一进程尝试写入这些 COW 页之一时，CPU 将强制发生页错误。内核页面错误处理程序检测到这种情况，为出错进程分配物理内存页面，将原始页面复制到新页面中，并修改出错进程中的相关 PTE 以引用新页面，这次使用PTE 标记为可写。当页面错误处理程序返回时，用户进程将能够写入它的页面副本。

值得注意的是：<font color=#FF0000>当多个用户进程的虚拟内存都指向相同的物理内存page，父进程退出的时候我们要更加小心，因为我们要判断是否能立即释放相应的物理page，因为子进程可能同样会用到这个物理内存所存储的数据。</font>这个时候我们要引入引用计数器`count`，当物理内存的引用数为0的时候，我们就能释放这个物理页表了。

---

值得注意的是，在linux中有一个`vfork()`，可以用来解决创建子进程后又马上调用`exec()`函数的情况，与`fork`函数一样，`vfork`函数也是用来创建子进程的。且该函数创建出的子进程与父进程共用一个地址空间。通过`vfork`创建的子进程会执行完后，才到父进程执行。

---

我们需要修改`uvmcopy()`，在复制副进程的内存到子进程的时候，不立即进行复制数据，而是建立指向原物理页的映射，并将父子两端的页表项都设置为不可写。

我们首先看到`sys_fork`函数：

```c
uint64
sys_fork(void)
{
  return fork();
}
```

这个`fork`函数如下所示，我将自己的理解写在了注释中：

```c
int
fork(void)
{
  int i, pid;
  //新建proc
  struct proc *np;
  //准备好当前的proc,用来复制
  struct proc *p = myproc();

  // Allocate process.
  if((np = allocproc()) == 0){
    return -1;
  }

  // Copy user memory from parent to child.
  //分配内存
  if(uvmcopy(p->pagetable, np->pagetable, p->sz) < 0){
    freeproc(np);
    release(&np->lock);
    return -1;
  }
  np->sz = p->sz;

  // copy saved user registers.
  *(np->trapframe) = *(p->trapframe);

  // Cause fork to return 0 in the child.
  np->trapframe->a0 = 0;

  // increment reference counts on open file descriptors.
  for(i = 0; i < NOFILE; i++)
    if(p->ofile[i])
      np->ofile[i] = filedup(p->ofile[i]);
  np->cwd = idup(p->cwd);
  
  safestrcpy(np->name, p->name, sizeof(p->name));
  
  pid = np->pid;

  release(&np->lock);
  //获取锁
  acquire(&wait_lock);
  
  np->parent = p;
  release(&wait_lock);

  acquire(&np->lock);
  np->state = RUNNABLE;
  
  release(&np->lock);
  //返回进程id
  return pid;
}
```

我们先来说说进程的`state`字段：

A question about the `fork` function

```c
enum procstate { UNUSED, USED, SLEEPING, RUNNABLE, RUNNING, ZOMBIE };
//未运行、已运行（终止）、阻塞、就绪、运行、僵死
```

> 英文术语*zombie process*源自丧尸——不死之人，隐喻子进程已死但仍然没有被回收。与正常进程不同，`kill`命令对僵尸进程无效。

在类Unix系统中，僵死进程是指完成执行，但在操作系统进程表中仍然存在其进程控制块，处于”终止状态“的进程。

下面是一个进程僵死的例子，解释在注释中：

```c
#include <sys/wait.h>
#include <stdlib.h>
#include <unistd.h>

int main(void)
{
	pid_t pids[10];
	int i;

	for (i = 9; i >= 0; --i) {
		pids[i] = fork();
		if (pids[i] == 0) {
			sleep(i+1);
			_exit(0);//在这之后已经完成执行了
		}
	}

	for (i = 9; i >= 0; --i)
        //我们在这里有个wait，所以操作系统会保留其PCB，这就是僵尸装在
		waitpid(pids[i], NULL, 0);

	return 0;
}
```

在`kernel/proc.c`的`fork`函数中，我们会将子进程设置为`RUNNABLE`状态，也就是拿到当前的就绪队列中，等待调度了，值得注意的是，在对`np`的状态进行状态赋值的时候我们会上锁，为什么呢？



我们来看看`kernel/proc.c`中的`proc`函数，调用了`uvmcopy`函数，将父进程的页表以及内存拷贝到子进程，如下所示：

```c
  // Copy user memory from parent to child.
  if(uvmcopy(p->pagetable, np->pagetable, p->sz) < 0){//将副进程的页表拷贝
    freeproc(np);//释放一个proc结构和挂在它上面的数据
    release(&np->lock);
    return -1;
  }
  np->sz = p->sz;
```

`uvmcopy`函数如下所示：

```c
int
uvmcopy(pagetable_t old, pagetable_t new, uint64 sz)
{
  pte_t *pte;
  uint64 pa, i;
  uint flags;
  char *mem;

  for(i = 0; i < sz; i += PGSIZE){
    if((pte = walk(old, i, 0)) == 0)
      continue; // 如果一个页不存在，则认为是懒加载的页，忽略即可
    if((*pte & PTE_V) == 0)
      continue; // 如果一个页不存在，则认为是懒加载的页，忽略即可
    pa = PTE2PA(*pte);
    flags = PTE_FLAGS(*pte);
    //if((mem = kalloc()) == 0)
      //goto err;
    //memmove(mem, (char*)pa, PGSIZE);
    if(mappages(new, i, PGSIZE, (uint64)mem, flags) != 0){
      //kfree(mem);
      goto err;
    }
  }
  return 0;

 err:
  uvmunmap(new, 0, i / PGSIZE, 1);
  return -1;
}
```

当我们在面试的时候很多面试官也会问`malloc`的底层实现，那么我们就根据xv版本的代码来具体看看：

