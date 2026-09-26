---
title: 'Stanford CS144 Lab 1: Stream reassembler'
date: 2021-11-27 15:42:05
categories:
- 计算机网络
tags:
- Stanford CS144 Lab
---

该lab要求我们实现一个流重组类，可以将Sender发来的带索引号的字节碎片重组成有序的字节写入到byte_stream。接收端从发送端读取数据，调用流重组器，流重组器对数据进行排序，排序好后写入byte_stream。

值得注意的是，无论是 lab0 中的 byte_stream，还是 lab1 中的重组器，都有 `capacity` 的概念。`capacity` 对应可用缓冲上限，它由“重组器中尚未拼接的数据”与“已经写入 byte_stream 但尚未被读取的数据”共同占用。


所以我们在进行重组和读写操作时，都要根据 `capacity` 约束维护重组器。为了方便起见，我们依旧使用双端队列作为重组器。

在重组器类的函数中，push_substring函数完成重组工作。其参数有data(string),index(size_t),eof(bool),data是待排序的数据，index是数据首元素的序号，eof用于判断是否结束。结束后将不再有数据输入。

在重组的过程中，我们会遇到重复、丢包、重叠、乱序的现象。为了使乱序的数据找到有序的位置，我使用’\0’维护重组器中数据的相对序号，例如，第一次data为make,index为0,第二次data为great,index为13,而处于两组数据中间的数据未知，我们就用’\0’代替，即make\0\0\0\0\0\0\0\0\0great。这样就维护了已经进入重组器的数据的有序。当然，写入的data中也有可能含有\0,这是，我们就需要一个bool双端队列，来记录相应位置的数据是否有序，在上述例子中，队列的bool值为111100000000011111。

1.我们先判断输入序号是否超过当前可接受窗口（unacceptable 区域之外）。如果超过，说明当前缓冲容量不足以接纳该片段，需要直接丢弃。代码如下：

```cpp
if(index>_output.bytes_read()+_capacity){
    return;
}
```

2.如果 `data` 的尾部超出当前可接受范围，我们只保留窗口内可接纳的那一段。写入时常见两种情况：一是 `index` 在当前重组尾部之后，需要补占位并标记状态；二是 `index` 落在已有区间内，需要按覆盖规则处理重叠部分。代码如下：

```cpp
if(index+data.length()>_capacity+_output.bytes_read()){
    for(size_t i=_lens_un+_output.bytes_written();i<_capacity+_output.bytes_read();i++){
        if(i<index){
            _unassembled_byte.push_back('\0');
            _check_byte.push_back(false);

        }else{
            _unassembled_byte.push_back(data[i-index]);
            _check_byte.push_back(true);

        }
        _lens_un++;
    }
}
```

3.我们要判断index是否等于已经写入byte_stream(_output)中的数据，如果是的，我们就直接将data中的数据写入byte_stream,然后在重组器中弹出data.length()个数据，值得注意的是，当重组器中的数据个数小于data.length()，我们就全部弹出。代码如下：

```cpp
if(index==_output.bytes_written()){
    _output.write(data);
    size_t temp_len=std::min(_lens_un,data.length());
    _unassembled_byte.erase(_unassembled_byte.begin(),_unassembled_byte.begin()+temp_len);
    _check_byte.erase(_check_byte.begin(),_check_byte.begin()+temp_len);
    _lens_un-=temp_len;
}
```

4.我们要判断index是否大于流重组器中的最后一个数据的序号和写入byte_stream中的数据个数之和，如果大于，我们就可以参考1的处理，代码如下：

```cpp
if(index>_output.bytes_written()+_lens_un){
    for(size_t i=_output.bytes_written()+_lens_un;i<index;i++){
        _unassembled_byte.push_back('\0');
        _check_byte.push_back(false);
        _lens_un++;
    }
    for(char i : data){
        _unassembled_byte.push_back(i);
        _lens_un++;
        _check_byte.push_back(true);
    }
}
```

5.我们要判断data中的数据是否已经被写入byte_stream，这个说法有些不准确，准确的说是相应序号的数据被写入，如果data中的所有数据都被写入了byte_stream，我们就直接返回，如果只是部分被写入，我们就将data中未被写入的部分写入。代码如下：

```cpp
if(index<_output.bytes_written()){
    if(_output.bytes_written()>index+data.length()){
        return;
    }
    std::string data_cut(data.begin()+_output.bytes_written()-index,data.end());
    _output.write(data_cut);
    size_t temp_len=std::min(_lens_un,data_cut.length());
    _unassembled_byte.erase(_unassembled_byte.begin(),_unassembled_byte.begin()+temp_len);
    _check_byte.erase(_check_byte.begin(),_check_byte.begin()+temp_len);
    _lens_un-=temp_len;
```

6.在上述特殊情况都被排除之后，剩下的就是index处于流重组器的中间，我们就插入data中的数据到流重组器就行了。代码如下：

```cpp
//在中间插入元素
//先弹出一部分数据保存到栈中
std::stack<char> temp;
std::stack<bool> temp_check;
for(size_t i=0;i<index-_output.bytes_written();i++){
    temp.push(_unassembled_byte.at(i));
    temp_check.push(_check_byte.at(i));
}
size_t temp_len=std::min(_lens_un,data.length()+index-_output.bytes_written());
_unassembled_byte.erase(_unassembled_byte.begin(),_unassembled_byte.begin()+temp_len);
_check_byte.erase(_check_byte.begin(),_check_byte.begin()+temp_len);
_lens_un-=temp_len;
for(int i=data.length()-1;i>=0;i--){
    _unassembled_byte.push_front(data[i]);
    _check_byte.push_front(true);
    _lens_un++;
}
while(!temp.empty()){
    _unassembled_byte.push_front(temp.top());
    _check_byte.push_front(temp_check.top());
    _lens_un++;
    temp.pop();
    temp_check.pop();
}
```

在讲完data中数据插入流重组器操作之后，我们就要讲一讲如何讲流重组器中的数据写入byte_stream，其实非常简单，如果流重组器中的front数据的判定值为true,就说明该数据已经排好序了，我们就可以直接写入，依次判定，直到遇到判定值为false的数据。代码如下：

```cpp
std::string n(_unassembled_byte.begin(),_unassembled_byte.begin()+i);
_output.write(n);
_unassembled_byte.erase(_unassembled_byte.begin(),_unassembled_byte.begin()+i);
_lens_un-=i;
_check_byte.erase(_check_byte.begin(),_check_byte.begin()+i);
if(eof) input_end_index=index+data.length();
if(input_end_index==_output.bytes_written()) _output.end_input();
```

至于unassembled_byte函数，就是返回流重组器中false数据的个数，empty就是一个判空函数，代码如下：

```cpp
size_t StreamReassembler::unassembled_bytes() const {
    size_t res=0;
    for(bool i:_check_byte){
        if(i){
            res++;
        }
    }
    return res;
}

bool StreamReassembler::empty() const { return _lens_un==0; }
```

stream_reassembler.cc代码如下：

```cpp
#include "stream_reassembler.hh"
#include "stack"
#include "cstring"
#include "iostream"
// Dummy implementation of a stream reassembler.

// For Lab 1, please replace with a real implementation that passes the
// automated checks run by `make check_lab1`.

// You will need to add private members to the class declaration in `stream_reassembler.hh`

template <typename... Targs>
void DUMMY_CODE(Targs &&... /* unused */) {}

using namespace std;

StreamReassembler::StreamReassembler(const size_t capacity) : _output(capacity), _capacity(capacity), _unassembled_byte(0),_check_byte(0),_lens_un(0),input_end_index(-1){}

//! \details This function accepts a substring (aka a segment) of bytes,
//! possibly out-of-order, from the logical stream, and assembles any newly
//! contiguous substrings and writes them into the output stream in order.
//
void StreamReassembler::push_substring(const string &data, const size_t index, const bool eof) {
    DUMMY_CODE(data, index, eof);
    //始终使用绝对索引
    if(index>_output.bytes_read()+_capacity){
        return;
    }else if(index+data.length()>_capacity+_output.bytes_read()){
        for(size_t i=_lens_un+_output.bytes_written();i<_capacity+_output.bytes_read();i++){
            if(i<index){
                _unassembled_byte.push_back('\0');
                _check_byte.push_back(false);

            }else{
                _unassembled_byte.push_back(data[i-index]);
                _check_byte.push_back(true);

            }
            _lens_un++;
        }
    }else if(index==_output.bytes_written()){
        _output.write(data);
        size_t temp_len=std::min(_lens_un,data.length());
        _unassembled_byte.erase(_unassembled_byte.begin(),_unassembled_byte.begin()+temp_len);
        _check_byte.erase(_check_byte.begin(),_check_byte.begin()+temp_len);
        _lens_un-=temp_len;
    }else if(index>_output.bytes_written()+_lens_un){
        for(size_t i=_output.bytes_written()+_lens_un;i<index;i++){
            _unassembled_byte.push_back('\0');
            _check_byte.push_back(false);
            _lens_un++;
        }
        for(char i : data){
            _unassembled_byte.push_back(i);
            _lens_un++;
            _check_byte.push_back(true);
        }
    }else if(index<_output.bytes_written()){
        if(_output.bytes_written()>index+data.length()){
            return;
        }
        std::string data_cut(data.begin()+_output.bytes_written()-index,data.end());
        _output.write(data_cut);
        size_t temp_len=std::min(_lens_un,data_cut.length());
        _unassembled_byte.erase(_unassembled_byte.begin(),_unassembled_byte.begin()+temp_len);
        _check_byte.erase(_check_byte.begin(),_check_byte.begin()+temp_len);
        _lens_un-=temp_len;
    }else{
        //在中间插入元素
        //先弹出一部分数据保存到栈中
        std::stack<char> temp;
        std::stack<bool> temp_check;
        for(size_t i=0;i<index-_output.bytes_written();i++){
            temp.push(_unassembled_byte.at(i));
            temp_check.push(_check_byte.at(i));
        }
        size_t temp_len=std::min(_lens_un,data.length()+index-_output.bytes_written());
        _unassembled_byte.erase(_unassembled_byte.begin(),_unassembled_byte.begin()+temp_len);
        _check_byte.erase(_check_byte.begin(),_check_byte.begin()+temp_len);
        _lens_un-=temp_len;
        for(int i=data.length()-1;i>=0;i--){
            _unassembled_byte.push_front(data[i]);
            _check_byte.push_front(true);
            _lens_un++;
        }
        while(!temp.empty()){
            _unassembled_byte.push_front(temp.top());
            _check_byte.push_front(temp_check.top());
            _lens_un++;
            temp.pop();
            temp_check.pop();
        }
    }
    size_t i=0;
    while(i<_lens_un){
        if(!_check_byte.at(i)){
            break;
        }
        i++;
    }
    std::string n(_unassembled_byte.begin(),_unassembled_byte.begin()+i);
    _output.write(n);
    _unassembled_byte.erase(_unassembled_byte.begin(),_unassembled_byte.begin()+i);
    _lens_un-=i;
    _check_byte.erase(_check_byte.begin(),_check_byte.begin()+i);
    if(eof) input_end_index=index+data.length();
    if(input_end_index==_output.bytes_written()) _output.end_input();
}

size_t StreamReassembler::unassembled_bytes() const {
    size_t res=0;
    for(bool i:_check_byte){
        if(i){
            res++;
        }
    }
    return res;
}

bool StreamReassembler::empty() const { return _lens_un==0; }
```

stream_reassembler.hh代码如下：

```cpp
#ifndef SPONGE_LIBSPONGE_STREAM_REASSEMBLER_HH
#define SPONGE_LIBSPONGE_STREAM_REASSEMBLER_HH

#include "byte_stream.hh"

#include <cstdint>
#include <string>

//! \brief A class that assembles a series of excerpts from a byte stream (possibly out of order,
//! possibly overlapping) into an in-order byte stream.
class StreamReassembler {
  private:
    // Your code here -- add private members as necessary.
    ByteStream _output;  //!< The reassembled in-order byte stream
    //capacity是SreamReassembler里面储存的max_index减去在bytestream里面还没有被读取min_index,然后还要加上1
    size_t _capacity;    //!< The maximum number of bytes
    std::deque<char> _unassembled_byte;//
    std::deque<bool> _check_byte;
    size_t _lens_un;
    bool _eof;
  public:
    //! \brief Construct a `StreamReassembler` that will store up to `capacity` bytes.
    //! \note This capacity limits both the bytes that have been reassembled,
    //! and those that have not yet been reassembled.
    StreamReassembler(const size_t capacity);

    //! \brief Receive a substring and write any newly contiguous bytes into the stream.
    //!
    //! The StreamReassembler will stay within the memory limits of the `capacity`.
    //! Bytes that would exceed the capacity are silently discarded.
    //!
    //! \param data the substring
    //! \param index indicates the index (place in sequence) of the first byte in `data`
    //! \param eof the last byte of `data` will be the last byte in the entire stream
    void push_substring(const std::string &data, const uint64_t index, const bool eof);

    //! \name Access the reassembled byte stream
    //!@{
    const ByteStream &stream_out() const { return _output; }
    ByteStream &stream_out() { return _output; }
    //!@}

    //! The number of bytes in the substrings stored but not yet reassembled
    //!
    //! \note If the byte at a particular index has been pushed more than once, it
    //! should only be counted once for the purpose of this function.
    /*unassembled byte是还未传递但是要传递给bytestream的储存在StreamReassembler的字符数，
     * 其中如果不同的字符串有重叠部分的话，重叠部分只算一次
     * */
    size_t unassembled_bytes() const;

    //! \brief Is the internal state empty (other than the output stream)?
    //! \returns `true` if no substrings are waiting to be assembled
    //判空函数，
    bool empty() const;
};

#endif  // SPONGE_LIBSPONGE_STREAM_REASSEMBLER_HH
```

后记：

在我面试的时候，面试官问我：

如果遇到极端情况，当前所需的第一个字节index为i，但包含这个字节的segment迟迟不来，这个时候应该怎么办？

这个问题其实不应该是流重组器应该考虑的，这个应该是快速重传的问题。当`receiver`所需的segment迟迟没来的时候，大概是三次冗余ack，`sender`就会进行快速重传，当然本实验是不需要实现快速重传的，所以从这个角度讲关我流重组器什么是捏。

大家如果要看快速重传的内容可以到这里下载：

[GBN&SR&TCP](https://github.com/xiao-nanbei/hust-cs/tree/main/%E8%AE%A1%E7%AE%97%E6%9C%BA%E7%BD%91%E7%BB%9C/%E5%AE%9E%E9%AA%8C%E4%BA%8C(%E4%BC%A0%E8%BE%93%E5%8D%8F%E8%AE%AE%EF%BC%89)）
