---
title: 记一次manjaro OS恢复
date: 2022-05-29 23:29:44
tags:
---

我的PC前段时间短路了，更换主板之后重新启动电脑没有manjaro OS和Windows的启动项选择界面了，而是直接进入Winows，查看BOIS之后发现只有一个Winows启动项，遂开始恢复。

首先我发现只有一个Winows启动项，于是直接在Winows下管理员cmd中输入如下命令增加启动项：

```bash
$bcdedit /set "{bootmgr}" path \EFI\Manjaro\grubx64.efi
```

重启之后我发现已经有了选择界面了，这就说明我的grub并没有受到影响，于是直接启动Manjaro，得到如下结果：

```bash
mount:/new_root:cant find UUID-xxxxxxxxxxxxxxx.

You are now being dropped into an emergency shell.

sh:cant access tty:job control turn off

[rootfs]#
```

我的第一反应是UUID有问题，于是下载了最新版的manjaro kde iso制作live cd，用live cd启动系统，开启KDE分区管理器，查看磁盘情况，会有两种情况：

1.live cd的os不能识别硬盘，也就是说当我点击安装系统的时候反馈`there are no partitions to install on manjaro`，这是硬盘的驱动设置有问题，于是我重启电脑，打开bios，storage->rst mode，将rst mode设置为AHCI（不要理会它的警告，尽管这会导致你无法进入Windows系统），然后直接进入grub的manjaro，这个时候发现可以直接使用了。

2.live cd的os能识别硬盘，这个时候的话就说明你的UUID确实有问题了，应该想办法恢复UUID。打开终端，开始恢复。

```bash
#blkid
//输入这个命令之后会出现磁盘所有分区的信息，找到系统的root区的UUID记住
#sudo mount /dev/nvme0n0p6 /mnt
//这里我的root区是nvme0n0p6，将/mnt挂载到这里
#sudo nona /mnt/etc/fstab
//开始输入正确的UUID
#genfstab -U /mnt >> /mnt/etc/fstab
```

完成之后重启进入原manjaro系统，发现可以运行了。

---

补充，如何优雅的在Windows中关闭Intel rst，使得我们在AHCI下可以运行Windows：

```
1.以管理员身份打开cmd，不是那个普通的cmd哈。
2.输入bcdedit /set safeboot minimal回车
3.Restart the computer and enter BIOS Setup
4.Change the SATA Operation mode to AHCI from either IDE or RAID
5.Save changes and exit Setup and Windows will automatically boot to Safe Mode.
6.以管理员身份打开cmd，不是那个普通的cmd哈。
7.bcdedit /deletevalue safeboot回车
8.Reboot once more and Windows will automatically start with AHCI drivers enabled.
9.恢复正常了，正常使用Windows。
```

最后我们来测试一下CPU性能，看本次短路有没有冲击到CPU：


参考文章：

1. https://blog.csdn.net/qq_43391414/article/details/120606567

