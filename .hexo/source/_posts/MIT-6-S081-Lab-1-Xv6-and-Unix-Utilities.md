---

title: 'MIT 6.S081 Lab 1: Xv6 and Unix utilities'
date: 2022-12-12 19:01:44
categories:
- 操作系统
tags:
- MIT 6.S081 Lab
---

在这个实验中要实现几个用户级别的应用程序，其对应的系统调用在`kernel`中都已经被实现好了。

#### *sleep*

本实验要为 xv6 实现 UNIX 程序 sleep； 您的睡眠应暂停用户指定的滴答数。 滴答是 xv6 内核定义的时间概念，即来自定时器芯片的两次中断之间的时间。

我们检查参数，如果出现不是数字的参数就`exit(-1)`，否则进行sleep。代码如下所示：

``` c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"

int main(int argc,char *argv[]){
  while(argv[1][i]!=''){
    if(argv[1][i]>'9'||argv[1][i]<'0'){
      write(1, "error\n", 6);
      exit(-1);
    }
    i++; 
  }
  int times=atoi(argv[1]);
  sleep(times);
  exit(0);
}

```

值得注意的是，程序中我们使用了一些系统调用函数，如sleep函数，write函数。我们可以在user/user.h中一窥这些函数的原型：


我们来分析一下`write`函数，我们可以看到`write`函数的声明为`int write(int,const void*,int);`其中，参数中第一个`int`为文件描述符`fd`，参数中第二个`const void*`为内存地址，第三个`int`为写入的字节数量，意思就是说：将参数`buf`所指的内存写入`count`个字节到参数`fd`所指的文件，其中，fd为文件描述符。大家可以看到上述代码中的`write`函数的调用：`write(1,"error\n",6)`，其中`fd=1`代表标准输出`stdout`，也就是会打印到显示器。

我们来看看`write`在内核中的实现`sys_write`:

```c
uint64
sys_write(void)
{
  struct file *f;//存储文件描述符
  int n;//存储写入的字节数量
  uint64 p;//存储内存地址

  if(argfd(0, 0, &f) < 0 || argint(2, &n) < 0 || argaddr(1, &p) < 0)//分别写入
    return -1;

  return filewrite(f, p, n);
}
```

在进入内核的时候，系统调用函数会将参数保存在寄存器中，然后调用`argfd`等函数将参数取出，保存在`f，p，n`中，调用`filewrite`函数。我们注意到`struct file `结构，其结构如下所示：

```c
struct file {
  enum { FD_NONE, FD_PIPE, FD_INODE, FD_DEVICE } type;
  int ref; // reference count
  char readable;
  char writable;
  struct pipe *pipe; // FD_PIPE
  struct inode *ip;  // FD_INODE and FD_DEVICE
  uint off;          // FD_INODE
  short major;       // FD_DEVICE
}
```

`filewrite`是xv6操作系统中用于向文件写入数据的系统级函数。它在内核层面处理所有文件写入操作。函数参数 `filewrite(struct file **f*, uint64 *addr*, int *n*)`

- `f`: 文件结构体指针，包含文件的所有元数据

- `addr`: 用户空间的虚拟地址，指向要写入的数据

- `n`: 要写入的字节数

根据文件类型执行不同的写入操作：

- 管道文件 (FD_PIPE)：

```c
if(f->type == FD_PIPE){
	ret = pipewrite(f->pipe, addr, n);
}
```

调用`pipewrite`函数处理管道写入。

- 设备文件 (FD_DEVICE)

```c
else if(f->type == FD_DEVICE){
	if(f->major < 0 || f->major >= NDEV || !devsw[f->major].write)
	return -1;
	ret = devsw[f->major].write(1, addr, n);
}
```

检查设备号是否有效，然后调用相应设备的写函数。

- 普通文件 (FD_INODE)：这部分最复杂，需要特殊处理。

  分块写入数据：

```c
 int i = 0;
 while(i < n){
   int n1 = n - i;
   if(n1 > max)
     n1 = max;
   // ...写入逻辑...
   i += r;
 }
```

每次写入块时都使用事务保证原子性：

```c
 begin_op();  // 开始事务
 ilock(f->ip);  // 锁定inode
 if ((r = writei(f->ip, 1, addr + i, f->off, n1)) > 0)
   f->off += r;  // 更新文件偏移量
 iunlock(f->ip);  // 解锁inode
 end_op();  // 结束事务
```



说到这里了，我们提一下`buffer IO`，我感觉`xv6`是没有实现`buffer IO`的，源码里面没有找到相关的说明和代码，但是在`linux`里面是实现了的。`buffer IO`是为了提高读写效率和保护磁盘，比如我们通过`read`函数将`fd`对应的文件拷贝count个字节到`buf`对应的内存，这个时候如果是`buffer io`机制，那么我们就会先将count个字节拷贝到page cache中，然后再拷贝到`buf`对应的用户空间中。`write`操作类似。

上次有位面试官问了我一个问题：什么时候将脏页刷回磁盘？

我查了一下，有的说是进程退出的时候刷回去，有的说是定时刷回去。在`CMU15445`细说。

---

我们将在后面的实验中继续学习`syscall`。

#### *pingpong*

编写一个程序，使用 UNIX 系统调用在两个进程之间通过一对管道“乒乓”一个字节，每个管道一个。 父母应该向孩子发送一个字节； 子进程应该打印“<pid>: received ping”，其中 <pid> 是它的进程 ID，将管道上的字节写入父进程，然后退出； 父母应该从孩子那里读取字节，打印“<pid>: received pong”，然后退出。

一些提示：

- 使用管道创建管道。
- 使用 fork 创建一个孩子。
- 使用 read 从管道读取，并使用 write 写入管道。
- 使用 getpid 查找调用进程的进程 ID。
- 将程序添加到 Makefile 中的 UPROGS。
- xv6 上的用户程序有一组有限的库函数可供它们使用。 可以在 user/user.h 中看到列表； 源（系统调用除外）位于 user/ulib.c、user/printf.c 和 user/umalloc.c。

代码如下：

```c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"

int main(){
  int p_filedes[2],s_filedes[2];
  pipe(p_filedes);
  pipe(s_filedes);
  char buf[4];
  if(fork()==0){
    read(p_filedes[0],buf,4);
    printf("%d: received %s\n",getpid(),buf);
    write(s_filedes[1],"pong",4);
  }else{
    write(p_filedes[1],"ping",4);
    read(s_filedes[0],buf,4);
    printf("%d: received %s\n",getpid(),buf);
  }
  exit(0);
}
```

在上述代码中，我们使用了两个管道，p_filedes和s_filedes，来传递父进程和子进程之间的信息。

借此机会，我们来分析一下`read`函数，read函数原型为`read(int,void *,int)`，其意义为将文件描述符`fd`所指向的文件读取`count`个数据到`buf`中。如`read(0,buf,10)`就是将标准输入读取10个字节到buf中。其底层实现为`sys_read`，

这让我想到了HUST大三学生在2021年做的lab1，通过程序演示多进程并发执行和进程软中断、管道通信。实验具体描述如下：

- 父进程先建立一个管道,然后创建两个进程:子进程1和子进程2;

- 父进程每隔1秒向管道发送消息(消息数量有上限) :

  I send you x times. (x的初值为1,每次发送后对x做加1操作)

- 子进程1、2从管道接收消息,并显示在屏幕上。
- 父进程能捕获软中断信号SIGINT(按键盘的Ctrl+C键),捕获到该信号后,父进程分别向两个子进程发出软中断信号SIGUSR1。
- 子进程能捕获父进程发出的SIGUSR1信号,捕获到该信号后,分别输出下列信息后终止:
  Child Process l is Killed by Parent!
  Child Process 2 is Killed by Parent!
- 父进程等待两个子进程终止后,释放管道并输出如下信息后终止:
  Parent Process is Killed!

这个实验可以通过如下框架进行设计：

```
main( )
{
    创建无名管道;
    设置信号SIGINT处理;
    创建子进程1、2;
    定时发送数据;
    等待子进程1、2退出;
    关闭管道;
    打印信息、退出;
}
父进程SIGINT信号处理
{
    发SIGUSR1给子进程1;
    发SIGUSR2给子进程2;
    等待子进程1、2退出;
    关闭管道;
    打印信息、退出;
}
子进程1/2
{
    设置信号SIGINT处理;
    设置SIGUSR1或2处理;
    while(1) {
        从管道接收数据;
        显示数据;
        计数器++;
    }
    关闭管道;
    打印信息、退出;
}
SIGUSR1/2信号处理
{
    关闭管道;
    打印信息;
    退出;
}
```

具体代码如下：

```c
#include <unistd.h>
#include <stdlib.h>
#include<string.h>
#include<stdio.h>
#include<time.h>
#include <sys/wait.h>
#include <sys/types.h>
int pid_1,pid_2;
int filedes_1[2],filedes_2[2];

void fun(int sig)
{
	kill(pid_1,SIGUSR1);
	kill(pid_2,SIGUSR1);
    waitpid(pid_1,NULL,0);
    waitpid(pid_2,NULL,0);
    close(filedes_1[0]);
    close(filedes_1[1]);
    close(filedes_2[0]);
    close(filedes_2[1]);
    printf("Parent Process is Killed!\n");
    exit(0);
}


void fun1(int sig)
{
	printf("\nChild1 process1  is  killed by parent!\n");
    close(filedes_1[0]);
    close(filedes_1[1]);
    exit(0);
}

void fun2(int sig)
{
	printf("\nChild2 process2  is  killed by parent!\n");
    close(filedes_2[0]);
    close(filedes_2[1]);
    exit(0);
}
int main(){
    pipe(filedes_1);
    pipe(filedes_2);

    char s[80];
    int x=0;
    pid_1=fork();
    if(pid_1>0){
        pid_2=fork();
        if(pid_2>0){
            signal(SIGINT,fun);
            while(1){
                x++;
                char buf[80];
                sprintf(buf, "I send you %d times", x);
                write(filedes_1[1],buf,sizeof(buf));
                write(filedes_2[1],buf,sizeof(buf));
                sleep(1);
            }
            return 0;
        }
        else{
            signal(SIGINT,SIG_IGN);
            signal(SIGUSR1,fun2);
            while(1){
                read(filedes_2[0],s,sizeof(s));
                printf("%s c2\n",s);
                sleep(1);
            }
        }
    }
    else{
        signal(SIGINT,SIG_IGN);
        signal(SIGUSR1,fun1);
        while(1){
            read(filedes_1[0],s,sizeof(s));
            printf("%s c1\n",s);
            sleep(1);
        }
    }
}

```

#### *xargs*

xarg是给命令传递参数的一个过滤器，也是组合多个命令的一个工具。xarg可以将管道或标准输入数据转换成命令行参数，也能够从文件的输出中读取数据。

在实验中我们要完成的xargs程序与linux命令类似。

代码如下：

```C
#include "kernel/types.h"
#include "kernel/param.h"
#include "user/user.h"

int main(int argc, char *argv[]) {
    char line[256], *p[MAXARG], ch;
    int lines = 0, linen, ps = 0, pn, i, j;
    for (i = 0; i < argc - 1; i++) {
        p[ps++] = line + lines;
        for (j = 0; j < strlen(argv[i + 1]); j++)
            line[lines++] = argv[i + 1][j];
        line[lines++] = '\0';
    }
    linen = lines; pn = ps; p[pn++] = line + linen;
    while (read(0, &ch, 1) > 0) {
        if (ch == '\n') {
            line[linen++] = '\0'; p[pn++] = 0;
            if (fork() == 0) exec(argv[1], p);
            else {
                wait(0); linen = lines; pn = ps; p[pn++] = line + linen;
            }
        } else if (ch == ' ') {
            line[linen++] = '\0'; p[pn++] = line + linen;
        } else line[linen++] = ch;
    }
    exit(0);
}
```

