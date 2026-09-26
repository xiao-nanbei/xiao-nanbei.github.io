---
title: 'MIT 6.S081 Lab 2: System calls'
date: 2022-01-10 21:07:09
categories:
- 操作系统
tags:
- MIT 6.S081 Lab
---

在上一个实验中我们使用系统调用编写了一些utilities，在这个实验中我们需要为xv6增加一些系统调用，以便我们理解系统调用是如何工作的，并向我们展示xv6内核的一些内部结构。

我们先来说说什么是系统调用，操作系统作为用户和计算机硬件之间的接口，需要向上提供一些简单易用的服务，主要包括命令接口和程序接口。其中，程序接口由一组系统调用组成。应用程序通过系统调用请求操作系统的服务。系统中的各种共享资源都由操作系统统一掌握，因此在用户程序中，凡是与资源有关的操作(如存储分配、I/O操作、文件管理等)，都必须通过系统调用的方式向操作系统提出服务请求，由操作系统代为完成。

从某种角度来看，系统调用和普通的函数调用非常相似。区别仅仅在于，系统调用由操作系统核心提供，运行于核心态，而普通的函数调用由函数库或用户自己提供，运行于用户态。

用户程序执行到系统调用命令时，会发生中断，处理器由用户态变为内核态，操作系统的中断处理程序得到控制权，它根据系统调用的功能号，通过例行子程序入口地址表跳转到相应的例程中去执行，在完成了用户所需要的服务功能后，退出中断，返回到用户子程序的断点继续执行。

我们来看如下例子，来源于[博客](http://blog.codepiano.com/2017/03/01/read-file-from-disk)：

---

假设场景是一个 Linux 操作系统中运行的进程 P 需要读取文件 `/home/user/text.txt`。

如果进程P需要读取文件，首先要发起系统调用open，传入文件路径和相关参数，执行系统调用后操作系统会从用户态转换到内核态，切换到内核态后，操作系统调用相应的处理器开始处理读取文件的请求。然后内核控制硬件。

这个时候并不会直接读取磁盘中的文件到进程掌握的内存，而是先进行权限方面的检查，如果进程可以访问这个文件，就根据文件路径去查找文件对应的inode编号，这部分属于文件系统的内容，这里不做说明。

在获取 inode 以后，操作系统生成一个文件描述符，存储在进程 P 的数据结构中，通过文件描述符可以索引到文件的打开方式和要打开文件的 inode。至此系统调用 `open` 完成。

进程在得到文件描述符之后，还要再发起系统调用read，传入文件描述符来读取文件内容，在这里读取操作同样需要切换到内核态由内核代为完成，切换到内核态后，操作系统通过文件描述符找到对应的inode，通过inode来确定文件存储在磁盘的哪个扇区，然后读取这些扇区，把内容读取到内核的地址空间里面。

磁盘的IO完成之后，磁盘会触发一个中断，CPU会暂时终止当前线程的执行，保存相关的寄存器信息，然后把读取到的内容从内核地址空间拷贝到进程P的地址空间里面，然后进程P的状态设置为runnable，进程P排队等待自己的CPU时间片，被调度器调度以后可以继续执行。

---

#### syscall.c

syscall.c是系统调用程序，我们先来介绍在syscall中的几个函数。

##### argint函数

argint的函数原型为`int argint(int n,int *ip)`，其意义为获得第n个32位调用参数，该函数调用了argraw函数，在得到了相应的数据之后，保存在以ip为地址的空间中。

```c
if(argint(0,&pid)<0){
	return -1;
}
```

##### argraw函数

argraw的函数原型为`static uint64 argraw(int n)`，其意义为返回相应的寄存器中保存的值。代码如下图所示：

```c
switch (n) {
case 0:
return p->trapframe->a0;
case 1:
return p->trapframe->a1;
case 2:
return p->trapframe->a2;
case 3:
return p->trapframe->a3;
case 4:
return p->trapframe->a4;
case 5:
return p->trapframe->a5;
}
```

##### syscall函数

syscall函数代码如下：

```c
void
syscall(void)
{
  int num;
  struct proc *p = myproc();

  num = p->trapframe->a7;
  if(num > 0 && num < NELEM(syscalls) && syscalls[num]) {
    p->trapframe->a0 = syscalls[num]();
  } else {
    printf("%d %s: unknown sys call %d\n",
            p->pid, p->name, num);
    p->trapframe->a0 = -1;
  }
}
```

设置一个proc指针，指向myproc，在`num = p->trapframe->a7;`中，将a7寄存器中的值赋值给num，a7寄存器中保存的就是系统调用的调用号，我们可以在user/usys.s中看见相关的代码（以fork系统调用为例）：

```
fork:
 li a7, SYS_fork
 ecall
 ret
.global exit
```

也就是说，当一个程序需要作系统调用的时候，它将相关参数放进系统调用相关的寄存器。

然后判断调用号是否正确，如果正确的话就将`syscalls[num]()`赋值给a0，syscalls中调用号对应sys_xxx函数，也就是将要调用的函数的返回值赋值给a0。代码如下所示：

```c
static uint64 (*syscalls[])(void) = {
[SYS_fork]    sys_fork,
[SYS_exit]    sys_exit,
[SYS_wait]    sys_wait,
[SYS_pipe]    sys_pipe,
[SYS_read]    sys_read,
[SYS_kill]    sys_kill,
[SYS_exec]    sys_exec,
[SYS_fstat]   sys_fstat,
[SYS_chdir]   sys_chdir,
[SYS_dup]     sys_dup,
[SYS_getpid]  sys_getpid,
[SYS_sbrk]    sys_sbrk,
[SYS_sleep]   sys_sleep,
[SYS_uptime]  sys_uptime,
[SYS_open]    sys_open,
[SYS_write]   sys_write,
[SYS_mknod]   sys_mknod,
[SYS_unlink]  sys_unlink,
[SYS_link]    sys_link,
[SYS_mkdir]   sys_mkdir,
[SYS_close]   sys_close,
[SYS_trace]   sys_trace,
};
```

同样，我们在syscalls.c中定义了如下的外部函数，部分外部函数的实现在sysproc.c中，代码如下所示：

```c
extern uint64 sys_chdir(void);
extern uint64 sys_close(void);
extern uint64 sys_dup(void);
extern uint64 sys_exec(void);
extern uint64 sys_exit(void);
extern uint64 sys_fork(void);
extern uint64 sys_fstat(void);
extern uint64 sys_getpid(void);
extern uint64 sys_kill(void);
extern uint64 sys_link(void);
extern uint64 sys_mkdir(void);
extern uint64 sys_mknod(void);
extern uint64 sys_open(void);
extern uint64 sys_pipe(void);
extern uint64 sys_read(void);
extern uint64 sys_sbrk(void);
extern uint64 sys_sleep(void);
extern uint64 sys_unlink(void);
extern uint64 sys_wait(void);
extern uint64 sys_write(void);
extern uint64 sys_uptime(void);
extern uint64 sys_trace(void);
```

#### sysproc.c

sysproc.c是系统进程，正如我们在xv6文档看到的那样，起到由用户转到内核的作用，通过syscall，可以进入sysproc执行相应的函数。

##### proc数据结构

proc数据结构表示进程状态，其数据结构如下所示：

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
  uint64 mask;
};
```

#### System call tracing

这个模块要实现系统调用跟踪，添加一个新的系统调用跟踪功能，即创建一个新的跟踪系统调用来控制跟踪。我们首先分析trace程序，在user/trace.c中可以看到第十七行为`if (trace(atoi(argv[1])) < 0) `，我们可以得知trace函数的原型为`int trace(int n)`其中，n为第一个参数，也就是`1<<SYS_xxx`,这个SYS_xxx是一个整数“掩码”（这么翻译的，感觉翻译得不太好，调用号更合适些），每一个不同的SYS_xxx对应不同的系统调用。我们可以看看trace函数中的代码：

```c
#include "kernel/param.h"
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"

int
main(int argc, char *argv[])
{
  int i;
  char *nargv[MAXARG];

  if(argc < 3 || (argv[1][0] < '0' || argv[1][0] > '9')){
    fprintf(2, "Usage: %s mask command\n", argv[0]);
    exit(1);
  }

  if (trace(atoi(argv[1])) < 0) {
    fprintf(2, "%s: trace failed\n", argv[0]);
    exit(1);
  }
  
  for(i = 2; i < argc && i < MAXARG; i++){
    nargv[i-2] = argv[i];
  }
  exec(nargv[0], nargv);
  exit(0);
}
```

在上述程序中，调用了trace函数，trace函数的参数就是在终端输入的trace指令的第一个参数，trace函数通过`entry(trace)`从用户态转到内核态，执行后续操作。在内核态中会将第一个参数也就是系统调用号保存在myproc->mask中，后续调用exec函数的时候会通过之前保存的mask值来跟踪相应的系统调用（后续详细讲解）。

在上述程序中，输入的参数必须大于2个，也就是必须要有一个调用号参数，还要有一个另外的一个指令参数，跟踪的正是这个指令中相应调用号的系统调用。正如上述代码中第三个for循环所示，将从第二个参数开始之后的所有参数复制到nargv，然后调用exec函数执行该指令。

在实验文档中给出的例子中，执行命令`trace 32 grep hello README`的意思是，跟踪grep命令中调用号为5（32=1<<5）的系统调用。我们可以在syscall.h中看到这些调用号，如下代码所示：

```c
// System call numbers
#define SYS_fork    1
#define SYS_exit    2
#define SYS_wait    3
#define SYS_pipe    4
#define SYS_read    5
#define SYS_kill    6
#define SYS_exec    7
#define SYS_fstat   8
#define SYS_chdir   9
#define SYS_dup    10
#define SYS_getpid 11
#define SYS_sbrk   12
#define SYS_sleep  13
#define SYS_uptime 14
#define SYS_open   15
#define SYS_write  16
#define SYS_mknod  17
#define SYS_unlink 18
#define SYS_link   19
#define SYS_mkdir  20
#define SYS_close  21
```

那么32就对应`SYS_read=5`。也就是说要跟踪read系统调用。

因为trace本身也是系统调用之一，在user/usys.pl中加入从用户态进入内核态的入口`entry(trace)`，生成汇编语言代码，如下所示：

```c
trace:
 li a7, SYS_trace
 ecall
 ret
```

可以看到，将SYS_trace保存在a7寄存器中。系统调用的ecall指令会使用a0和a7寄存器，其中a7寄存器保存的是系统进程号，a0寄存器保存的是系统调用参数，返回值会保存在a0寄存器中（unix中是这样，ecall的实现过程在文章开头给出）。

（这一部分我是参考了CSDN上的博主@//夜游神的[博客](https://blog.csdn.net/qq_33894666/article/details/121545027))

在kernel/syscall.h中加入系统进程号`#define SYS_trace 22`。

在kernel/proc.h的结构体proc中加入一个新成员`uint64 mask`。（我看到有的博主写的是`uint32 mask`，个人认为位数的多少取决于系统调用的数量。到trace为止，系统调用的数量为22）。

在kernel/sysproc.c中实现`uint64 sys_trace(void)`函数。

```c
uint64 sys_trace(void)
{
    int mask;//这里的int也可以换成长整数
    if (argint(0,&mask) < 0)
        return -1;
    myproc()->mask = mask;
    return 0;
}

```

在文章开头我们讲过了`int argint(int n,int *ip)`函数，，trace只有一个参数，放在a0中，在这里我们要将a0的值保存在mask中，即`if(argint(0,&mask)<0) return -1;`。将mask赋值给myproc()->mask，作为我们进程的状态结构体的一部分。

在kernel/syscall.c中补充syscall函数，代码如下如所示：

```c
if (p->mask & (1 << num))
      printf("%d: syscall %s -> %d\n", p->pid, callnames[num - 1], p->trapframe->a0);
```

上述代码中callnamens数组如下所示：

```c
static const char* callnames[] = {
	"fork","exit","wait","pipe","read","kill","exec","fstat","chdir",
	"dup","getpid","sbrk","sleep","uptime","open","write","mknod",
	"unlink","link","mkdir","close","trace"
};
```

p->pid是进程号，callnamens是系统调用名称，p->trapframe->a0是返回值。

下面就可以好好说说系统调用响应的过程了：

在命令行输入`trace 32 grep hello README`指令，然后调用trace程序(如上述代码所示)，首先执行trace函数，待trace函数执行完后执行grep命令。在trace函数中（trace的系统调用只有sys_trece)，通过entry(trace)将sys_trace系统调用号保存在a7寄存器中，调用ecall进入内核态（用户态进入内核态的具体实现会在lab4中体现）。在内核态中首先调用syscall函数，将a7的值赋值给num，由此调用sys_trace函数，将我们的命令的第一个参数保存在`myproc()->mask`中，方便后续的命令进行比较。由于trace函数只有trace一个系统调用，num的值为SYS_trace，但是此时的mask为read的调用号，所以不进行打印系统调用的过程。

执行完trace函数之后通过exec命令执行grep命令，grep命令会用到调用号为5的系统调用read，通过entry(read)进入内核态后，先调用syscall函数，将a7的值赋值给num，然后执行sys_read函数，然后进行判定，`p->mask & (1 << num)`，如果这两个值相等，就可以打印相应系统调用的进程号、名称以及返回值。

在linux中，提供了一个`ptrace`系统函数，`ptrace`提供了一种使父进程得以监视和控制其他进程的方式，它还能改变子进程中的寄存器和内核映像，因而在gdb中用作断点调试和跟踪。

#### Sysinfo

在这个作业中，我们要添加一个系统调用sysinfo，它收集有关正在运行的系统调用的信息。系统调用有一个参数：指向strcut sysinfo的指针。

1. 在Makefile中加入`$U/_sysinfotest`。

2. 在user.h中加入`int sysinfo(struct sysinfo*)`和`struct sysinfo`。

3. 在usys.pl中加入系统调用入口`entry("sysinfo")`。

4. 在kernel/syscall.h中加入sysinfo的系统调用号`#define SYS_sysinfo 23`。

5. 在kernel/syscall.c函数中加入外部函数生命和函数指针，代码如下所示：

   ```c
   extern uint64 sys_sysinfo(void);
   static uint64 (*syscalls[])(void) = 
   {
       .....
       [SYS_sysinfo] sys_sysinfo
   };
   
   ```

在上述完成后我们就将基础工作完成了。

在正式分析sysinfotest函数之前，我们要先搞懂`struct sysinfo`数据结构，其定义如下：

```c
struct sysinfo {
  uint64 freemem;   // amount of free memory (bytes)
  uint64 nproc;     // number of process
};
```

在sysinfo数据结构中，有两个uint64变量，一个是freemem，代表空闲内存的大小，单位为bytes；另一个是nproc，代表进程的数量。

现在来具体分析sysinfotest要实现的功能，该系统调用收集正在运行的系统调用的信息。在sysinfotest的主函数如下所示：

```c
int
main(int argc, char *argv[])
{
  printf("sysinfotest: start\n");
  testcall();
  testmem();
  testproc();
  printf("sysinfotest: OK\n");
  exit(0);
}
```

在上述主函数中，首先调用了testcall函数，testcall函数如下：

```c
void
testcall() {
  struct sysinfo info;
  
  if (sysinfo(&info) < 0) {
    printf("FAIL: sysinfo failed\n");
    exit(1);
  }

  if (sysinfo((struct sysinfo *) 0xeaeb0b5b00002f5e) !=  0xffffffffffffffff) {
    printf("FAIL: sysinfo succeeded with bad argument\n");
    exit(1);
  }
}
```

在sysinfo函数中，定义了一个sysinfo变量info。调用sysinfo函数，也就是在内核中调用sys_sysinfo函数，我们在上文中提到，调用sysinfo函数，会在entry中将sys_info的系统调用号赋值给a7（同时将参数赋值给a0），然后进入内核进行调用。那么我们就要来完成sys_sysinfo函数：

```c
uint64
sys_sysinfo(void)
{
	uint64 addr;
	if (argaddr(0,&addr) < 0)
		return -1;
	struct sysinfo sf;
	sf.nproc = nop();//nop 后面加
	sf.freemem = freemem();// 后面加
	if (copyout(myproc()->pagetable,addr,(char*)&sf,sizeof(sf)) < 0)
		return -1;
	return 0;
}

```

在sys_sysinfo中定义了一个uint64变量addr，sysinfo的参数也就是a0赋值给addr，

```c
void
testmem() {
  struct sysinfo info;
  uint64 n = countfree();
  
  sinfo(&info);

  if (info.freemem!= n) {
    printf("FAIL: free mem %d (bytes) instead of %d\n", info.freemem, n);
    exit(1);
  }
  
  if((uint64)sbrk(PGSIZE) == 0xffffffffffffffff){
    printf("sbrk failed");
    exit(1);
  }

  sinfo(&info);
    
  if (info.freemem != n-PGSIZE) {
    printf("FAIL: free mem %d (bytes) instead of %d\n", n-PGSIZE, info.freemem);
    exit(1);
  }
  
  if((uint64)sbrk(-PGSIZE) == 0xffffffffffffffff){
    printf("sbrk failed");
    exit(1);
  }

  sinfo(&info);
    
  if (info.freemem != n) {
    printf("FAIL: free mem %d (bytes) instead of %d\n", n, info.freemem);
    exit(1);
  }
}

```



```c
void testproc() {
  struct sysinfo info;
  uint64 nproc;
  int status;
  int pid;
  
  sinfo(&info);
  nproc = info.nproc;

  pid = fork();
  if(pid < 0){
    printf("sysinfotest: fork failed\n");
    exit(1);
  }
  if(pid == 0){
    sinfo(&info);
    if(info.nproc != nproc+1) {
      printf("sysinfotest: FAIL nproc is %d instead of %d\n", info.nproc, nproc+1);
      exit(1);
    }
    exit(0);
  }
  wait(&status);
  sinfo(&info);
  if(info.nproc != nproc) {
      printf("sysinfotest: FAIL nproc is %d instead of %d\n", info.nproc, nproc);
      exit(1);
  }
}
```
