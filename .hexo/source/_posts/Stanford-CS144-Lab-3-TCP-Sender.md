---
title: 'Stanford CS144 Lab 3: TCP sender'
date: 2021-11-23 17:33:46
categories:
- 计算机网络
tags:
- Stanford CS144 Lab
---

在这个实验中我们要完成tcp_sender的部分。由于我们实现的是简易的TCP，因此在测试集对于拥塞控制并没有太多要求，且计时器我们也只用实现重传计时器。

我们先来理解bytes_in_flight，bytes_in_flight是发送但还未确认的数据长度。根据概念，这段长度等于_next_seqno减去base。因此我们定义一个base用来维护基序号，同时也可以完成bytes_in_flight函数。代码如下:

```cpp
uint64_t TCPSender::bytes_in_flight() const {    return _next_seqno-base;}
```

#### TCP连接与释放（三次握手与四次挥手）

在这个实验中我们同样要用到三次握手的知识，为了更好的解释实现过程，我们用以下图示解释。


在介绍三次握手之前，先要说说TCP头部的一些常用字段（这也是我们实验中要用到的）。

- 序号：seqno，占32位，用来标识从发送端到接收端的字节流；
- 确认号：ackno，占32位，只有 ACK 标志位为 1 时才有效；它表示“期望收到的下一个序号”，并不总是简单等于 `seqno+1`；
- 标志位：
  - SYN：发起一个连接；
  - FIN：释放一个连接；
  - ACK：确认序号有效。

我们可以将sender理解为将要发送syn报文的client(事实上，client和server都有sender和receiver，我们将在lab4中具体组装sender和receiver）。至此，我们的lab都是单向通信。发送方只有一个TCPsender，接收方只有一个TCPReceiver，由TCPsender发送的和TCPReceiver返回的都是TCPsegment格式的TCP报文段，只不过由于单向通信，所以发送方的TCPsegment中只包含序列号seqno、 Payload、SYN 和 FIN，接收方返回的TCPsegment中只包含ackno和window size。作为绝对序号，_next_seqno的初始值为0，此时我们必须发送SYN报文建立连接，也就是第一次握手，seqno为 _isn（即上图的x，这是系统赋予的），syn为true，payload置空，报文准备好后，我们将其写入到定义好的队列 _segments_out，等待系统调用，同时，我们为了实现重传，定义了一个 _segments_out_cache,作为缓冲区，用于缓存报文，在特定的情况下将报文重传。当然，我们也要维护GBN中的滑动窗口，因此定义一个curr_window_size，用来维护当前可用窗口的大小。代码如下：

```cpp
if(_next_seqno==0){
    TCPSegment seg;
    seg.header().seqno=_isn;
    seg.header().syn= true;
    _next_seqno=1;
    curr_window_size--;//当前可用窗口减1
    _segments_out.push(seg);
    _segments_out_cache.push(seg);
}
```

当client接收第二次握手时传入的内容，即ack=x+1，也即ackno_64=1的内容，将会调用ack_received函数，ack_received函数的定义——`ack_received(const WrappingInt32 ackno, const uint16_t window_size) `，此时ackno=_isn+1，我们会执行如下操作：

```cpp
if(base==0&&ackno_64==1){    
    base=1;    
    _segments_out_cache.pop();    
    _consecutive_remission=0;
}
```

将base置为1，也就是将基序号+1；将缓冲队列出队（此时对方已经确认，我们不需要了）；连续重传此时对于sender来说，我们可以进行正常的报文发送了，也就是第三次握手。

无独有偶，实验中也要用到四次挥手的知识，为了更好的解释该过程，我们用下图解释。


在该实验中，当数据传输完成时，即 _stream.eof等于1时，我们要进行挥手，此时sender发送fin报文，即fin为1。如下所示：

```c++
if(_stream.eof()){
    fin_flag=true;
    TCPSegment seg;
    //将syn设置为false，将fin设置为true
    seg.header().syn= false;
    seg.header().fin=true;
    seg.header().seqno= wrap(_next_seqno,_isn);
    _next_seqno++;
    //维护窗口
    curr_window_size--;
    _segments_out_cache.push(seg);
    _segments_out.push(seg);
}
```

在该实验中，我们有两种情况发送fin包，第一种是恰好 _stream.eof为1，即刚好将 _stream中的数据全部读取完毕，这个时候我们发送一个fin值为1，payload为空的报文。第二种情况是发送窗口大于 _stream.size，此时也可以将 _stream中的报文读完。此时我们将最后一个报文(读取 _stream之后 _stream为空）的fin值置为1。值得注意的是，当fin值为1是要占用一个序号。因为有MAX_PAYLOAD_SIZE的限制，我们将用while进行循环读取。代码如下：

```cpp
else {
    while (!_stream.buffer_empty()&&curr_window_size>0){
        //这里会有两种状况，一种是_stream为空但窗口不为空；一种是窗口为空但_stream不为空。
        //我们找到_stream curr_window_size以及payload中的最小值，作为发送报文的长度
        uint64_t lens_byte=std::min(_stream.buffer_size(),uint64_t (curr_window_size));
        lens_byte=std::min(lens_byte,TCPConfig::MAX_PAYLOAD_SIZE);
        TCPSegment seg;
        //对header中的字段进行赋值
        seg.header().seqno= wrap(_next_seqno,_isn);
        seg.header().syn=false;
        seg.payload()=_stream.read(lens_byte);
        _next_seqno+=lens_byte;
        //将curr_window_size减去lens_byte
        curr_window_size-=lens_byte;
        //如果_stream已经空了，那么我们就进行第一次挥手
        if(_stream.eof()&&curr_window_size>0){
            seg.header().fin= true;
            fin_flag= true;
            curr_window_size--;
            _next_seqno++;
        }
        _segments_out.push(seg);
        _segments_out_cache.push(seg);
        if(fin_flag){//开始挥手之后就可以退出
            break;
        }
    }
}
```

#### TCP重传机制

在每次发送报文之后，都会启动一个定时器，如果在定时器时间内没有收到，则进行重传。而重传的超时时间，则称为RTO（Retransmission TimeOut），我们就要开始计时，将初始超时重传时间 _time_out设置 _initial_retransmission_timeout（也就是说，我们并不会去动态地计算RTT和RTO，这都是测试程序自动计算的），如果发生超时，将 _time_outx2。这个跟我们在《计算机网络黑皮书》上学到的不一样，是最新的标准。上述过程用time_waiting标志位进行维护。代码如下：

```cpp
if(!time_waiting){
    _time_out=_initial_retransmission_timeout;
    time_waiting=true;//为true的时候表示我们正在计时
    _total_time=0;
}
```

那么这个tick函数就很好做了，每次调用tick函数，_total_time加上 ms_since_last_tick，如果总时间大于超时时间，那么我们就可以进行重传，并将重传的次数+1，我们的 TCPConnection 将使用此信息来决定连接是否无望（连续重传过多）并需要中止，如果window size不为0，那么我们将RTO的值翻倍，称为指数退避。将总计时时间置为0。

```
void TCPSender::tick(const size_t ms_since_last_tick) {
    DUMMY_CODE(ms_since_last_tick);
    _total_time+=ms_since_last_tick;
    //如果缓冲队列不为空，停等时间在运行，且总时间大于超时
    if(!_segments_out_cache.empty()&&time_waiting&&_total_time>=_time_out){
        _segments_out.push(_segments_out_cache.front());
        //重传次数增加
        _consecutive_remission++;
        if(!window_zero){
            _time_out*=2;
        }
        _total_time=0;
    }
}

```

值得注意的是，TCP中有7种定时器，我们在这里只实现了重传定时器：

- 建立连接定时器(connection-establishment timer)
- 重传定时器(retransmission timer)
- 延迟应答定时器(delayed ACK timer)
- 坚持定时器(persist timer)
- 保活定时器(keepalive timer)
- FIN_WAIT_2定时器(FIN_WAIT_2 timer)
- TIME_WAIT定时器 (TIME_WAIT timer, 也叫2MSL timer)

#### ack_received

1.如果 ackno_64大于 _next_seqno，就会触发SYN_SENT状态，按照常理来说，ackno_64是不应该大于 _next_seqno,如果ackno_64大于 _next_seqno，我们将其定为“*stream started but nothing acknowledged*“，直接返回即可，等待下一次传入的ackno，至于为什么会出现ackno_64大于 _next_seqno我们并不关心。代码如下：

```cpp
uint 64_t ackno_64= unwrap(ackno,_isn,base);
if(ackno_64>_next_seqno){
    return;
}
```

2.对于三次握手中的第二次握手，也就是我们客户端收到确认报文这个情况，对于发送方的窗口而言，我们应当这样实现：

```cpp
 if(base==0&&ackno_64==1){
        base=1;
        _segments_out_cache.pop();
        _consecutive_remission=0;
 }
```

3.如果是正常的接收确认报文，对于窗口而言，我们应当这样实现，代码如下（详解在注释中）：

```c++
//下面代码就是在模拟GBN,根据接收到的ackno，删除窗口中base和ackno之间的数据
else if (!_segments_out_cache.empty() && ackno_64 >= base + _segments_out_cache.front().length_in_sequence_space()) {//收到的确认号大于base+发送的报文的长度
        //缓冲队列第一个元素的序号
        uint64_t copy_seg_seqno = unwrap(_segments_out_cache.front().header().seqno, _isn, base);
        //缓冲队列第一个元素的长度
        uint64_t copy_seg_len = _segments_out_cache.front().length_in_sequence_space();
        //序号加长度小于等于确认号，就一个一个删除
        while (copy_seg_seqno + copy_seg_len <= ackno_64) {
            base += _segments_out_cache.front().length_in_sequence_space();
            _segments_out_cache.pop();
            if (_segments_out_cache.empty()) break;
            copy_seg_seqno = unwrap(_segments_out_cache.front().header().seqno, _isn, base);
            copy_seg_len = _segments_out_cache.front().length_in_sequence_space();
        }
        _time_out = _initial_retransmission_timeout;
        _total_time = 0;
        _consecutive_remission = 0;

    }
```

4.对于流量控制，我们需要用接收方的窗口大小来维护发送方的窗口大小，如果说`_next_seqno-base>=window_size`，那么此时我们肯定是不能发送报文的，在这种情况下，说明我们发送出去但还没有确认的报文的长度大于接收窗口的长度，这种情况下我们如果再次发送报文可能会导致接收方接收出现问题。代码如下所示：

```c++
if(_next_seqno-base>=window_size){
        curr_window_size=0;
        return;
}
```

这里的curr_window_size就是活动窗口中待发送的长度，这个长度是根据接收窗口维护的。

`tcp_sender.hh`

```cpp
#ifndef SPONGE_LIBSPONGE_TCP_SENDER_HH
#define SPONGE_LIBSPONGE_TCP_SENDER_HH

#include "byte_stream.hh"
#include "tcp_config.hh"
#include "tcp_segment.hh"
#include "wrapping_integers.hh"

#include <functional>
#include <queue>

//! \brief The "sender" part of a TCP implementation.

//! Accepts a ByteStream, divides it up into segments and sends the
//! segments, keeps track of which segments are still in-flight,
//! maintains the Retransmission Timer, and retransmits in-flight
//! segments if the retransmission timer expires.
class TCPSender {
  private:
    //! our initial sequence number, the number for our SYN.
    WrappingInt32 _isn;

    uint64_t base{0};

    //! outbound queue of segments that the TCPSender wants sent
    std::queue<TCPSegment> _segments_out{};
    std::queue<TCPSegment> _segments_out_cache{};
    //! retransmission timer for the connection
    unsigned int _initial_retransmission_timeout;

    //! outgoing stream of bytes that have not yet been sent
    ByteStream _stream;

    //! the (absolute) sequence number for the next byte to be sent
    uint64_t _next_seqno{0};
    uint16_t curr_window_size;
    bool fin_flag;
    size_t _total_time;
    bool time_waiting;
    int _consecutive_remission;
    size_t _time_out;
    bool window_zero;
  public:
    //! Initialize a TCPSender
    TCPSender(const size_t capacity = TCPConfig::DEFAULT_CAPACITY,
              const uint16_t retx_timeout = TCPConfig::TIMEOUT_DFLT,
              const std::optional<WrappingInt32> fixed_isn = {});

    //! \name "Input" interface for the writer
    //!@{
    ByteStream &stream_in() { return _stream; }
    const ByteStream &stream_in() const { return _stream; }
    //!@}

    //! \name Methods that can cause the TCPSender to send a segment
    //!@{

    //! \brief A new acknowledgment was received
    void ack_received(const WrappingInt32 ackno, const uint16_t window_size);

    //! \brief Generate an empty-payload segment (useful for creating empty ACK segments)
    void send_empty_segment();

    //! \brief create and send segments to fill as much of the window as possible
    void fill_window();

    //! \brief Notifies the TCPSender of the passage of time
    void tick(const size_t ms_since_last_tick);
    //!@}

    //! \name Accessors
    //!@{

    //! \brief How many sequence numbers are occupied by segments sent but not yet acknowledged?
    //! \note count is in "sequence space," i.e. SYN and FIN each count for one byte
    //! (see TCPSegment::length_in_sequence_space())
    size_t bytes_in_flight() const;

    //! \brief Number of consecutive retransmissions that have occurred in a row
    //连续发生的重传次数
    unsigned int consecutive_retransmissions() const;

    //! \brief TCPSegments that the TCPSender has enqueued for transmission.
    //! \note These must be dequeued and sent by the TCPConnection,
    //! which will need to fill in the fields that are set by the TCPReceiver
    //! (ackno and window size) before sending.
    std::queue<TCPSegment> &segments_out() { return _segments_out; }
    //!@}

    //! \name What is the next sequence number? (used for testing)
    //!@{

    //! \brief absolute seqno for the next byte to be sent
    uint64_t next_seqno_absolute() const { return _next_seqno; }

    //! \brief relative seqno for the next byte to be sent
    WrappingInt32 next_seqno() const { return wrap(_next_seqno, _isn); }
    //!@}
};

#endif  // SPONGE_LIBSPONGE_TCP_SENDER_HH
```

`tcp_sender.cc`

```cpp
#include "tcp_sender.hh"
#include "iostream"
#include "tcp_config.hh"
#include <random>

// Dummy implementation of a TCP sender

// For Lab 3, please replace with a real implementation that passes the
// automated checks run by `make check_lab3`.

template <typename... Targs>
void DUMMY_CODE(Targs &&... /* unused */) {}

using namespace std;

//! \param[in] capacity the capacity of the outgoing byte stream
//! \param[in] retx_timeout the initial amount of time to wait before retransmitting the oldest outstanding segment
//! \param[in] fixed_isn the Initial Sequence Number to use, if set (otherwise uses a random ISN)
TCPSender::TCPSender(const size_t capacity, const uint16_t retx_timeout, const std::optional<WrappingInt32> fixed_isn)
    : _isn(fixed_isn.value_or(WrappingInt32{random_device()()}))
    ,base(0)
    , _initial_retransmission_timeout{retx_timeout}
    , _stream(capacity)
    , curr_window_size(1)
    , fin_flag(false)
    , _total_time(0)
    , time_waiting(false)
    , _consecutive_remission(0)
    , _time_out(0)
    , window_zero(false)
    {

}

uint64_t TCPSender::bytes_in_flight() const {
    return _next_seqno-base;
}

void TCPSender::fill_window() {
    if(curr_window_size==0||fin_flag){
        return;
    }
    if(_next_seqno==0){
        TCPSegment seg;
        seg.header().seqno=_isn;
        seg.header().syn= true;
        _next_seqno=1;
        curr_window_size--;
        _segments_out.push(seg);
        _segments_out_cache.push(seg);
    }else if(_stream.eof()){
        fin_flag=true;
        TCPSegment seg;
        seg.header().syn= false;
        seg.header().fin=true;
        seg.header().seqno= wrap(_next_seqno,_isn);
        _next_seqno++;
        curr_window_size--;
        _segments_out_cache.push(seg);
        _segments_out.push(seg);
    }
    else {
        while (!_stream.buffer_empty()&&curr_window_size>0){
            uint64_t lens_byte=std::min(_stream.buffer_size(),uint64_t (curr_window_size));
            lens_byte=std::min(lens_byte,TCPConfig::MAX_PAYLOAD_SIZE);
            TCPSegment seg;
            seg.header().seqno= wrap(_next_seqno,_isn);
            seg.header().syn=false;
            seg.payload()=_stream.read(lens_byte);
            _next_seqno+=lens_byte;
            curr_window_size-=lens_byte;
            if(_stream.eof()&&curr_window_size>0){
                seg.header().fin= true;
                fin_flag= true;
                curr_window_size--;
                _next_seqno++;
            }
            _segments_out.push(seg);
            _segments_out_cache.push(seg);
            if(fin_flag){
                break;
            }
        }
    }
    //开始计时
    if(!time_waiting){
        _time_out=_initial_retransmission_timeout;
        time_waiting=true;
        _total_time=0;
    }

}

//! \param ackno The remote receiver's ackno (acknowledgment number)
//! \param window_size The remote receiver's advertised window size
void TCPSender::ack_received(const WrappingInt32 ackno, const uint16_t window_size) {
    DUMMY_CODE(ackno, window_size);
    uint64_t ackno_64= unwrap(ackno,_isn,base);
    if(base==0&&ackno_64==1){
        base=1;
        _segments_out_cache.pop();
        _consecutive_remission=0;
    }else if (!_segments_out_cache.empty() && ackno_64 >= base + _segments_out_cache.front().length_in_sequence_space()) {
        //缓冲队列第一个元素的序号
        uint64_t copy_seg_seqno = unwrap(_segments_out_cache.front().header().seqno, _isn, base);
        //缓冲队列第一个元素的长度
        uint64_t copy_seg_len = _segments_out_cache.front().length_in_sequence_space();
        //序号加长度小于等于确认号，就一个一个删除
        while (copy_seg_seqno + copy_seg_len <= ackno_64) {
            base += _segments_out_cache.front().length_in_sequence_space();
            _segments_out_cache.pop();
            if (_segments_out_cache.empty()) break;
            copy_seg_seqno = unwrap(_segments_out_cache.front().header().seqno, _isn, base);
            copy_seg_len = _segments_out_cache.front().length_in_sequence_space();
        }
        _time_out = _initial_retransmission_timeout;
        _total_time = 0;
        _consecutive_remission = 0;

    } else if(ackno_64==_next_seqno&&fin_flag){
        base=ackno_64;
        _segments_out_cache.pop();
    }
    if(_next_seqno-base==0){
        time_waiting= false;
    }else if(_next_seqno-base>=window_size){
        curr_window_size=0;
        return;
    }
    if(window_size==0){
        curr_window_size=1;
        window_zero= true;
    }else{
        curr_window_size=window_size;
        window_zero= false;
        _consecutive_remission=0;
    }
    fill_window();
}

//! \param[in] ms_since_last_tick the number of milliseconds since the last call to this method
void TCPSender::tick(const size_t ms_since_last_tick) {
    DUMMY_CODE(ms_since_last_tick);
    _total_time+=ms_since_last_tick;
    //如果缓冲队列不为空，停等时间在运行，且总时间大于超时
    if(!_segments_out_cache.empty()&&time_waiting&&_total_time>=_time_out){
        _segments_out.push(_segments_out_cache.front());
        //重传次数增加
        _consecutive_remission++;
        if(!window_zero){
            _time_out*=2;
        }
        _total_time=0;
    }
}

unsigned int TCPSender::consecutive_retransmissions() const { return _consecutive_remission; }

void TCPSender::send_empty_segment() {
    TCPSegment seg;
    seg.header().seqno= wrap(_next_seqno,_isn);
    seg.payload()={};
    _segments_out.push(seg);
}
```

做到这里我们就可以理解几个面经的问题了：

Q1:***TCP建立连接可以两次握手吗？为什么？***

A1:不可以。有两个原因：

1. 已经失效的连接请求报文段又传到了服务器端。

   >client发出的第一个连接请求报文并没有丢失，而是在某个网络结点长时间地滞留了，以致于延误到连接释放以后的某个时间才到达server，本来这是一个已经失效的报文段，但server收到此失效的连接请求报文段后，还是向client发出确认报文段，同意建立连接。假设不采用三次握手，那么只要server发出确认，新的连接就建立了，由于此时client不会与server进行通讯，那么server的资源就白白浪费了。

2. 两次握手无法保证client端正确接收第二次握手的报文，无法保证client和server之间成功互换了初始序列号。

Q2:***为什么TCP连接的时候是3次，关闭的时候却是4次？***

A2:因为关闭的时候必须要确保通信双方都能通知对方释放连接，假设客户端发送完数据向服务端发送释放连接的请求，客户端并不知道，服务端是否已经发送完数据，所以此次断开的是客户端到服务端的单项连接，服务端返回给客户端确认报文后，服务端还能继续单向给客户端发送数据。也就是说第二次挥手就是服务端向客户端发送确认报文，这之后服务端还能单向给客户端发送数据。当服务端发送完数据后还需要向客户端发送释放连接请求，客户端返回确认报文，TCP才彻底关闭，四次挥手代表的是客户端和服务器端分别向对方发送释放连接的报文和发送确认报文，一共需要四次。

这里我们来总结一下滑动窗口的实现：

首先在发送方，我们定义了两个成员变量：`base`和`next_seqno`，其中`nextseqno-base==byte_in_fly`，当我们在`ack_res`函数中收到返回的`segment`的`ackno`和`window`的时候，我们根据`ackno`来确定`base`的大小，将`ackno`-原`base`的这些数据出队，注意，这个时候如果`nextseqno-base>window`，那就说明我们没必要去发送`segment`，直接返回。然后我们把`window`赋值给`curr_window`，这个时候呢，我们将`next_seqno+=curr_window`，发送长度为`curr_window`的数据过去，那么这个时候`base`和原`next_seqno`的数据我们就交给`tick`也就是超时重传来处理。
