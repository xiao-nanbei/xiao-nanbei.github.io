---
title: 'Stanford CS144 Lab 2: TCP receiver'
date: 2021-11-20 15:29:24
categories:
- 计算机网络
tags:
- Stanford CS144 Lab
---

CS144 这个实验并不是“在 UDP 之上封装 TCP”，而是让我们在用户态按 TCP 语义实现发送端与接收端组件（例如 sequence number、ACK、reassembly、window 等），以理解 TCP 协议机制本身。

### Translating between 64-bit indexes and 32-bit seqnos

《自顶向下》中，在讲到GBN协议时有这样一段话可能大家都忽略了，原文如下：

> 在实践中，一个分组的序号承载在分组首部的一个固定长度的字段中。如果分组序号字段的比特数是k,则该序号范围是[0,2^k]。 在一个有限的序号范围内，所有涉及序号的运算必须使用模2^k 运算。（即序号空间可被看作是一个长度为2^k 的环，其中序号2^k-1紧挨着0）。

序号的大小始终限制在2^k 之内，事实上，我们往往取k为32,这个序号被称为相对序号，与之相对应的还有绝对序号，即没有被取模2^k 序号，其大小范围为2^64,在这个任 务中我们要完成相对序号和绝对序号的转换。

值得注意的是，相对序号的起始值是一个随机数_isn，这样取的好处是增加报文复杂程度，而绝对序号的起始值为0,具体如下图所示：


首先是绝对序号转化为相对序号，根据位运算和模运算，我们只需要将绝对序号n加上相对序号_isn,赋值给一个32位数字。代码如下：

```cpp
WrappingInt32 wrap(uint64_t n, WrappingInt32 isn) {    DUMMY_CODE(n, isn);    WrappingInt32 res(n+isn.raw_value());    return res;}
```

接着是相对序号转化为绝对序号，其中n是待转化的相对序号，_isn是相对序号的起始值，checkpoint是参考值，也就是我们要找到离checkpoint最近的绝对序号。那么如何找到相应的绝对序号呢，代码如下：

```cpp
uint64_t unwrap(WrappingInt32 n, WrappingInt32 isn, uint64_t checkpoint) {
    DUMMY_CODE(n, isn, checkpoint);
    uint64_t temp=n.raw_value()-isn.raw_value();
    if(checkpoint==0){
        return temp;
    }
    uint32_t div=checkpoint/(1ul<<32);
    uint32_t res=checkpoint%(1ul<<32);
    if (res<=temp) {
        temp=(checkpoint-temp-(div-1)*(1ul<<32))<(temp+div*(1ul<<32)-checkpoint)?temp+(div-1)*(1ul<<32):temp+div*(1ul<<32);
    }else{
        temp=(checkpoint-temp-div*(1ul<<32))<(temp+(div+1)*(1ul<<32)-checkpoint)?temp+div*(1ul<<32):temp+(div+1)*(1ul<<32);
    }
    return temp;
}
```

### Implementing the TCP receiver

这个任务的主要目标是实现tcp的接收部分，在实现receiver之前，我们首先要熟悉segment类，具体可以参考tcp_segment.cc中的内容。TCP头部的一些常用字段（这也是我们实验中要用到的）如下：

- 序号：seqno，占32位，用来标识从发送端到接收端的字节流；
- 确认号：ackno，占32位，只有 ACK 标志位为 1 时才有效；它表示“期望收到的下一个序号”，并不总是简单等于 `seqno+1`。
- 标志位：
  - SYN：发起一个连接；
  - FIN：释放一个连接；
  - ACK：确认序号有效。

在后面的实验中我们要用到rst标志位。

1.在这个任务中我们要用到三次握手的知识，为了更好的解释实现过程，我们用以下图示解释(在下一个实验sender中也会用到该图）。


我们可以先从“被动接收 SYN 的一端”来理解 receiver：如果收到带 `SYN` 的 segment，就记录初始序号并进入已同步状态；如果还没看到 `SYN` 就收到普通数据段，则直接忽略。代码如下：

```cpp
if(seg.header().syn){    
    syn_flag= true;    //窗口的左端    
    ISN=seg.header().seqno;
} else if(!syn_flag){    			
    return;
}
```

2.为了调用流重组器函数，我们要计算 `data`、`index` 和 `eof`。其中 `data` 就是 `segment.payload()`，`index` 是 payload 对应的绝对序号起点。由于 `SYN/FIN` 都会各自占用一个序号，所以在非 `SYN` 报文上要对序号做相应偏移；`eof` 则由 `FIN` 决定。代码如下：

```cpp
void TCPReceiver::segment_received(const TCPSegment &seg) {
    DUMMY_CODE(seg);
    //代表第一个传过来的seg
    if(seg.header().syn){
        syn_flag= true;
        //窗口的左端
        ISN=seg.header().seqno;
    } else if(!syn_flag){
        return;
    }
    uint64_t received_lens=_reassembler.stream_out().bytes_written();
    size_t index= unwrap(seg.header().seqno,ISN,received_lens);
    if(!seg.header().syn){
        index--;
    }
    //进行重组
    _reassembler.push_substring(seg.payload().copy(),index,seg.header().fin);
}
```

这样我们就完成了接收操作。然后我们要返回确认报文。

对于要返回的ackno，如果还未建立连接，我们就返回nullptr，否则，我们分为两种情况，一种是全部数据传输未完成，我们返回写入byte_stream的数据的序号加1，这样一种是全部数据传输完成之后，end_input为true,这个时候我们的返回值应该为写入byte_streamde的数据的序号加2（因为fin标志位要占1个位置）。

发送方没有收到ACK分为两种情况，一种是发送方发送的数据报丢失，因此接收方并没有向发送方返回ACK；另一种是接收方收到了发送方的数据报，但是返回的ACK丢失了，这种情况发送方重传后，接收方会直接丢弃发送方重传的数据报，然后再次发送ACK响应报文。

在代码中我们并没有实现这种情况，因为在`_reassembler.push_substring`中有解决这个问题的相关实现，如果说非要做一个这样的检验是否是重传的数据报的函数，可以增加一个buffer队列，用来缓存收到的segment的header，然后将收到的segment与其进行对比，但是lab并没有要求我们实现，所以没有做。

代码如下：

```cpp
optional<WrappingInt32> TCPReceiver::ackno() const {
    if(!syn_flag){
        return std::nullopt;
    }else{
        if(_reassembler.stream_out().input_ended()){
            return ISN+_reassembler.stream_out().bytes_written()+2;
        }else{
            return ISN+_reassembler.stream_out().bytes_written()+1;
        }
    }
}
```

至于滑动窗口大小，就是我们之前提到过的重组器大小，即capacity减去已经写入byte_stream但还没有读取的数据的大小。代码如下：

```cpp
size_t TCPReceiver::window_size() const {    return _capacity-_reassembler.stream_out().bytes_written()+_reassembler.stream_out().bytes_read();}
```

`wrapping_integers.cc`

```cpp
#include "wrapping_integers.hh"

#include "cmath"

#include <iostream>
// Dummy implementation of a 32-bit wrapping integer

// For Lab 2, please replace with a real implementation that passes the
// automated checks run by `make check_lab2`.

template <typename... Targs>
void DUMMY_CODE(Targs &&... /* unused */) {}

using namespace std;

//! Transform an "absolute" 64-bit sequence number (zero-indexed) into a WrappingInt32
//! \param n The input absolute 64-bit sequence number
//! \param isn The initial sequence number
WrappingInt32 wrap(uint64_t n, WrappingInt32 isn) {
    DUMMY_CODE(n, isn);
    WrappingInt32 res(n+isn.raw_value());
    return res;
}

//! Transform a WrappingInt32 into an "absolute" 64-bit sequence number (zero-indexed)
//! \param n The relative sequence number
//! \param isn The initial sequence number
//! \param checkpoint A recent absolute 64-bit sequence number
//! \returns the 64-bit sequence number that wraps to `n` and is closest to `checkpoint`
//!
//! \note Each of the two streams of the TCP connection has its own ISN. One stream
//! runs from the local TCPSender to the remote TCPReceiver and has one ISN,
//! and the other stream runs from the remote TCPSender to the local TCPReceiver and
//! has a different ISN.
uint64_t unwrap(WrappingInt32 n, WrappingInt32 isn, uint64_t checkpoint) {
    DUMMY_CODE(n, isn, checkpoint);
    uint64_t temp=n.raw_value()-isn.raw_value();
    if(checkpoint==0){
        return temp;
    }
    uint32_t div=checkpoint/(1ul<<32);
    uint32_t res=checkpoint%(1ul<<32);
    if (res<=temp) {
        temp=(checkpoint-temp-(div-1)*(1ul<<32))<(temp+div*(1ul<<32)-checkpoint)?temp+(div-1)*(1ul<<32):temp+div*(1ul<<32);
    }else{
        temp=(checkpoint-temp-div*(1ul<<32))<(temp+(div+1)*(1ul<<32)-checkpoint)?temp+div*(1ul<<32):temp+(div+1)*(1ul<<32);
    }
    return temp;
}
```

`wrapping_integers.hh`

```cpp
#ifndef SPONGE_LIBSPONGE_WRAPPING_INTEGERS_HH
#define SPONGE_LIBSPONGE_WRAPPING_INTEGERS_HH

#include <cstdint>
#include <ostream>

//! \brief A 32-bit integer, expressed relative to an arbitrary initial sequence number (ISN)
//! \note This is used to express TCP sequence numbers (seqno) and acknowledgment numbers (ackno)
class WrappingInt32 {
  private:
    //原始32位储存整数
    uint32_t _raw_value;  //!< The raw 32-bit stored integer

  public:
    //! Construct from a raw 32-bit unsigned integer
    //显式构造
    explicit WrappingInt32(uint32_t raw_value) : _raw_value(raw_value) {}
    //访问原始存储值
    uint32_t raw_value() const { return _raw_value; }  //!< Access raw stored value
};

//! Transform a 64-bit absolute sequence number (zero-indexed) into a 32-bit relative sequence number
//! \param n the absolute sequence number
//! \param isn the initial sequence number
//! \returns the relative sequence number
WrappingInt32 wrap(uint64_t n, WrappingInt32 isn);

//! Transform a 32-bit relative sequence number into a 64-bit absolute sequence number (zero-indexed)
//! \param n The relative sequence number
//! \param isn The initial sequence number
//! \param checkpoint A recent absolute sequence number
//! \returns the absolute sequence number that wraps to `n` and is closest to `checkpoint`
//!
//! \note Each of the two streams of the TCP connection has its own ISN. One stream
//! runs from the local TCPSender to the remote TCPReceiver and has one ISN,
//! and the other stream runs from the remote TCPSender to the local TCPReceiver and
//! has a different ISN.
uint64_t unwrap(WrappingInt32 n, WrappingInt32 isn, uint64_t checkpoint);

//! \name Helper functions
//!@{

//! \brief The offset of `a` relative to `b`
//! \param b the starting point
//! \param a the ending point
//! \returns the number of increments needed to get from `b` to `a`,
//! negative if the number of decrements needed is less than or equal to
//! the number of increments
inline int32_t operator-(WrappingInt32 a, WrappingInt32 b) { return a.raw_value() - b.raw_value(); }

//! \brief Whether the two integers are equal.
inline bool operator==(WrappingInt32 a, WrappingInt32 b) { return a.raw_value() == b.raw_value(); }

//! \brief Whether the two integers are not equal.
inline bool operator!=(WrappingInt32 a, WrappingInt32 b) { return !(a == b); }

//! \brief Serializes the wrapping integer, `a`.
inline std::ostream &operator<<(std::ostream &os, WrappingInt32 a) { return os << a.raw_value(); }

//! \brief The point `b` steps past `a`.
inline WrappingInt32 operator+(WrappingInt32 a, uint32_t b) { return WrappingInt32{a.raw_value() + b}; }

//! \brief The point `b` steps before `a`.
inline WrappingInt32 operator-(WrappingInt32 a, uint32_t b) { return a + -b; }
//!@}

#endif  // SPONGE_LIBSPONGE_WRAPPING_INTEGERS_HH
```

`tcp_receiver.cc`

```c++
#include "tcp_receiver.hh"

// Dummy implementation of a TCP receiver

// For Lab 2, please replace with a real implementation that passes the
// automated checks run by `make check_lab2`.

template <typename... Targs>
void DUMMY_CODE(Targs &&... /* unused */) {}

using namespace std;

void TCPReceiver::segment_received(const TCPSegment &seg) {
    DUMMY_CODE(seg);
    //代表第一个传过来的seg
    if(seg.header().syn){
        syn_flag= true;
        //窗口的左端
        ISN=seg.header().seqno;
    } else if(!syn_flag){
        return;
    }
    uint64_t received_lens=_reassembler.stream_out().bytes_written();
    size_t index= unwrap(seg.header().seqno,ISN,received_lens);
    if(!seg.header().syn){
        index--;
    }
    _reassembler.push_substring(seg.payload().copy(),index,seg.header().fin);

}

optional<WrappingInt32> TCPReceiver::ackno() const {
    if(!syn_flag){
        return std::nullopt;
    }else{
        if(_reassembler.stream_out().input_ended()){
            return ISN+_reassembler.stream_out().bytes_written()+2;
        }else{
            return ISN+_reassembler.stream_out().bytes_written()+1;//返回当前接收窗口的初始序号
        }
    }
}

size_t TCPReceiver::window_size() const {
    return _capacity-_reassembler.stream_out().bytes_written()+_reassembler.stream_out().bytes_read();
}
bool TCPReceiver::recv_fin() const {
    if(_reassembler.stream_out().input_ended()){
        return true;
    }else{
        return false;
    }

```

`tcp_receiver.hh`

```c++
#ifndef SPONGE_LIBSPONGE_TCP_RECEIVER_HH
#define SPONGE_LIBSPONGE_TCP_RECEIVER_HH

#include "byte_stream.hh"
#include "stream_reassembler.hh"
#include "tcp_segment.hh"
#include "wrapping_integers.hh"

#include <optional>

//! \brief The "receiver" part of a TCP implementation.

//! Receives and reassembles segments into a ByteStream, and computes
//! the acknowledgment number and window size to advertise back to the
//! remote TCPSender.
//接收重组segments为 ByteStream，并计算确认号和窗口大小以通告回远程 TCPSender。
class TCPReceiver {
    //! Our data structure for re-assembling bytes.
    //我们用于重新组装字节的数据结构。
    StreamReassembler _reassembler;

    //! The maximum number of bytes we'll store.
    //容量大小
    size_t _capacity;
    WrappingInt32 ISN;
    bool syn_flag;
  public:

    //! \brief Construct a TCP receiver
    //!
    //! \param capacity the maximum number of bytes that the receiver will
    //!                 store in its buffers at any give time.
    //构造函数，构造一个 TCP 接收器，容量接收器在任何给定时间将存储在其缓冲区中的最大字节数。
    TCPReceiver(const size_t capacity) : _reassembler(capacity), _capacity(capacity),ISN(0) ,syn_flag(0){}

    //! \name Accessors to provide feedback to the remote TCPSender
    //!@{

    //! \brief The ackno that should be sent to the peer
    //! \returns empty if no SYN has been received
    //!
    //! This is the beginning of the receiver's window, or in other words, the sequence number
    //! of the first byte in the stream that the receiver hasn't received.
    // 如果没有收到 SYN，则应发送给对等方的 ackno 为空
    //这是接收器窗口的开始，否则，接收器未接收到的流中第一个字节的序列号。
    std::optional<WrappingInt32> ackno() const;

    //! \brief The window size that should be sent to the peer
    //!
    //! Operationally: the capacity minus the number of bytes that the
    //! TCPReceiver is holding in its byte stream (those that have been
    //! reassembled, but not consumed).
    //!
    //! Formally: the difference between (a) the sequence number of
    //! the first byte that falls after the window (and will not be
    //! accepted by the receiver) and (b) the sequence number of the
    //! beginning of the window (the ackno).
    size_t window_size() const;
    //!@}

    //! \brief number of bytes stored but not yet reassembled
    size_t unassembled_bytes() const { return _reassembler.unassembled_bytes(); }

    //! \brief handle an inbound segment
    void segment_received(const TCPSegment &seg);

    //! \name "Output" interface for the reader
    //!@{
    ByteStream &stream_out() { return _reassembler.stream_out(); }
    const ByteStream &stream_out() const { return _reassembler.stream_out(); }
    bool recv_fin() const;
    //!@}
};

#endif  // SPONGE_LIBSPONGE_TCP_RECEIVER_HH
```
