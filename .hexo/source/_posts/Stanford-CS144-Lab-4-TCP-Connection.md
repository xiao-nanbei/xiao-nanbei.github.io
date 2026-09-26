---
title: 'Stanford CS144 Lab 4: TCP connection'
date: 2022-01-13 08:39:30
categories:
- 计算机网络
tags:
- Stanford CS144 Lab
---

在这一关要求实现一个TCPConnection类，基于TCP的有限状态机，将 sender 和 receiver 封装起来。也就是说，作为一个TCP客户端，我们有自己的sender和receiver，现在要用这个客户端与其他主机进行联系，所以我们要实现TCP的各种FSM。

在tests文件夹中，我们可以看到很多关于fsm的测试文件，这些就是基于不同的有限状态机的测试，因此，我们掌握了TCP的有限状态机，才能将这个实验完成。这里的 fsm 测试名不是 RFC 里标准状态名，而是 CS144 按测试场景拆出来的名字。可以先把它们理解成下面这些场景：

| 状态机 | 含义 |
| --- | --- |
| fsm_connect | 主动打开连接，发送 SYN，并在收到 SYN+ACK 后补 ACK，完成三次握手。 |
| fsm_listen | 被动打开连接，先收到对端 SYN，再发送 SYN+ACK，模拟服务端接受连接。 |
| fsm_ack_rst | 收到带 RST 的报文后立即异常关闭连接，并把 sender/receiver 的 stream 标记为 error。 |
| fsm_ack_active | 本端主动关闭时发送 FIN，并正确处理对端对 FIN 的 ACK。 |
| fsm_ack_passive | 对端先发送 FIN，本端进入被动关闭路径，需要 ACK 对端 FIN，并在本端输入结束后再发送自己的 FIN。 |
| fsm_active_close | 完整主动关闭流程：本端 `end_input()` 后发送 FIN，等待对端 ACK 和 FIN，最后进入 TIME_WAIT。 |
| fsm_passive_close | 完整被动关闭流程：先收到对端 FIN，之后本端写完数据并发送 FIN，最终双方关闭。 |
| fsm_retx | 重传定时器相关场景：超时后重发未确认 segment，超过最大重传次数后发送 RST 并关闭。 |
| fsm_win | 接收窗口和 ACK 字段相关场景：每次发出 segment 前都要带上正确 ackno 和 window size。 |

把这些测试场景串起来看，`TCPConnection` 要做的事其实很清楚：`TCPSender` 负责“我还能发什么”，`TCPReceiver` 负责“我收到了什么以及该 ACK 到哪里”，而 `TCPConnection` 负责把两边粘起来，处理 RST、ACK、窗口、定时器和连接生命周期。



我们先来看看到底要实现哪些类

在上述代码中，可以看到有一个之前没有接触过的类——`TCPConfig`，所以我们首先来了解一下`TCPConfig`。我们到`TCPConfig`类中可以看到，它是对一些相关参数设置默认大小，如下所示：

```c++
class TCPConfig {
  public:
    static constexpr size_t DEFAULT_CAPACITY = 64000;  //!< Default capacity
    static constexpr size_t MAX_PAYLOAD_SIZE = 1000;   //!< Conservative max payload size for real Internet
    static constexpr uint16_t TIMEOUT_DFLT = 1000;     //!< Default re-transmit timeout is 1 second
    static constexpr unsigned MAX_RETX_ATTEMPTS = 8;   //!< Maximum re-transmit attempts before giving up

    uint16_t rt_timeout = TIMEOUT_DFLT;       //!< Initial value of the retransmission timeout, in milliseconds
    size_t recv_capacity = DEFAULT_CAPACITY;  //!< Receive capacity, in bytes
    size_t send_capacity = DEFAULT_CAPACITY;  //!< Sender capacity, in bytes
    std::optional<WrappingInt32> fixed_isn{};
};
```

在`_receiver`等变量中通过`TCPConfig`默认大小。刚看到`TCPConnection`类时可能无从下手，我们先运行一下check程序，从第一个 failed 入手（没错，本懒狗是边做lab边写博客，面向tests编程）。

我们可以看到第一个 failed 出现在第35个测试，也就是fsm_passive_close，这个测试检测的是有限状态机中的初始状态（？）我们在项目中找到指定位置，开始debug，发现是`void TCPConnection::connect() `方法的错误，当我们要建立连接的时候，我们想到的还是三次握手，如下图：


（还是以客户端为例子）首先，我们要进行第一次握手，也就是客户端发送SYN报文，在TCPSender类中，我们实现了fill_window方法，里面包含了三次握手中第一次握手的过程。在TCPConnection中，有相关的建立连接的方法，即`void TCPConnection::connect()`方法，于是我们将sender中的握手的过程加入函数当中，如下所示：

```c++
void TCPConnection::connect() {
    // send SYN
    _sender.fill_window();
    real_send();
}
```

这就是第一次握手时的场景，调用了fill_window()，在没有预设参数的情况下，fill_window会默认是第一次握手，从而设置对应的syn和seqno值。这样就完成了建立连接的第一步。为了使得发送报文可以模块化操作，实现real_send函数，real_send函数负责将_sender.segment_out队列中的报文拿出来，放入到 _segment_out队列中，代码如下所示：

```c++
bool TCPConnection::real_send() {
    bool isSend = false;
    while (!_sender.segments_out().empty()) {
        isSend = true;
        TCPSegment segment = _sender.segments_out().front();
        _sender.segments_out().pop();
        set_ack_and_windowsize(segment);
        _segments_out.push(segment);
    }
    return isSend;
}
```

当收到服务器的第二次握手时，就会调用TCPConnection中的`void TCPConnection::segment_received(const TCPSegment &seg) `函数，这个函数的参数是收到的segment，当收到这个segment的时候，客户端就要进行第三次握手，当然，我们的第三次握手就可以看成正常的发送报文了。那么我们来看看收到报文之后应该如何处理。首先，我们将segment给到我们的 _receiver中：

```c++
    // give the segment to receiver
    _receiver.segment_received(seg);
```



![](https://imgconvert.csdnimg.cn/aHR0cDovL2ltZy5ibG9nLmNzZG4ubmV0LzIwMTcwNjA2MDg0ODUxMjcy?x-oss-process=image/format,png)





在TCP协议中，rst用来异常的关闭连接。在TCP的设计中它是不可或缺的，发送rst段关闭连接时，不必等缓冲区的数据都发送出去，直接丢弃缓冲区中的数据，而接收端收到rst后，也不必发送ack来确认。

什么时候发送RST包：

1.  建立连接的SYN到达某端口，但是该端口上没有正在监听的服务。
2.  TCP收到了一个根本不存在的连接上的分节。
3.  请求超时。 使用setsockopt的SO_RCVTIMEO选项设置recv的超时时间。接收数据超时时，会发送RST包。

当收到的segment的rst段为1，那么我们直接断开连接（非正常关闭），而不必发送ack来确认，如下所示：

```c++
if (seg.header().rst) {
    _sender.stream_in().set_error();
    _receiver.stream_out().set_error();
    _active = false;
    return;
}
```



在`write`函数中，我们需要将数据写入到stream中，然后返回写入stream的data的长度，如下所示：

```c++
size_t TCPConnection::write(const string &data) {
    //如果data的为空则直接返回
    if (data.empty()) return 0;
    //否则将数据写入_sender的stream_in，等待fill_window将其封装为报文
    size_t actually_write = _sender.stream_in().write(data);
    //封装data为segment
    _sender.fill_window();
    real_send();
    //返回实际长度
    return actually_write;
}
```

在关闭TCP连接也就是“四次握手”的时候，我们会有一个`TIME_WAIT`的状态，在这个状态下客户端会等待2MSL才断开，这其实有两个原因：

1. 保证全双工的连接能够可靠关闭。
2. 保证这次连接的数据段彻底从网络中消失。

在这里我们要创建一个real_send()函数，我们都知道在sender中其实只是把数据传到了队列segment_out里面来作为发送数据的操作，在这个任务中我们将完成剩余的操作，也就是将数据发送出去，所以我们需要完成real_send()函数。

在segment_received()函数中，我们要模拟的是TCP收到数据的情况，其框架如下：

```c++
_receiver.segment_received(seg);//将收到的seg交给_receiver的相关函数进行处理
if (seg.header().ack) {
	//收到ack报文的相关操作，也就是将其ackno和win交给_sender的相关函数，让其准备下一次发送
    //
}
```



在tick函数中，

在lab4中，我们可以检测出前面实验的错误：

1. 我删除了很多不必要的代码

2. 

   

---

##### TCP可靠传输

做到这里，我们的TCP也就算实现了基本功能，我们也就知道了TCP协议如何保证可靠传输：

1. 流量控制：TCP连接双方都有固定大小的缓冲空间，TCP接收端只允许发送端发送接收端缓冲区能接纳的数据。当接收方来不及处理发送方的数据的时候，就提示发送方降低发送的速率。
2. 拥塞控制：当网络拥塞时，减少数据的发送（这个在lab中没有什么体现）。
3. 超时重传：当TCP发出一个段后，就会启动一个定时器，如果不能及时收到确认，就重发这个报文段。
4. 校验和：（这个好像在后面的实验中有体现）。

再补充一个知识点——`socket`

##### TCP长连接

在HTTP1.0中，默认使用的是短连接。也就是说，浏览器和服务器每进行一次HTTP操作，就建立一次连接，但任务结束后就中断连接。但从HTTP1.1开始，默认使用长连接，用以保持连接特性。使用长连接的HTTP协议，会在响应头加入如下字段:

```
Connection:keep-alive
```

HTTP协议的长连接和短连接，实质上是TCP协议的长连接和短连接。

###### TCP保活机制

保活功能主要为服务器应用提供，服务器应用希望知道客户主机是否崩溃，从而可以代表客户使用资源。如果客户已经消失，使得服务器上保留一个半开放的连接，而服务器又在等待来自客户端的数据，则服务器将应远等待客户端的数据，保活功能就是试图在服务器端检测到这种半开放的连接。对于设置了keepalive来说，当**tcp**检测到对端**socket**不再可用时**(**不能发出探测包**,**或探测包没有收到**ACK**的响应包**),select**会返回**socket**可读**,**并且在**recv**时返回**-1,**同时置上**errno**为ETIMEDOUT。此时TCP的状态是断开的。
