+++
title = "Being in the Linux Kernel Mentorship"
date = 2025-09-10

[extra]
image = "thumb.png"
+++

From March to August of this year, I have been a mentee in the Linux Foundation's [Linux Kernel Mentorship Program](https://wiki.linuxfoundation.org/lkmp) alongside my university studies.

I've always kind of idolized kernel development, so this was a great opportunity to see what it is really like.

I stumbled upon it quite by accident. {% sidenote(ref="I was browsing LinkedIn") %}Not something I usually ever do, really.{% end %} looking at alumni from my university, when I saw that one of them, who was working as a kernel engineer at Google, had reposted an announcement for the <abbr>LKMP</abbr>. I clicked through and that was that.

## Application & Acceptance

I had to create an account on the <abbr>LFX</abbr> Mentorship portal, fill out my profile and a small statement-of-purpose, and then I was given a list of tasks on the basis of which I would be accepted (or not). These tasks ranged from completing [a beginner's course in kernel development from <abbr>LFX</abbr>](https://training.linuxfoundation.org/training/a-beginners-guide-to-linux-kernel-development-lfc103/), to writing a cover letter, to building and experimenting with writing simple kernel modules, and even making patches for small mistakes we could find. I managed to get 5 minor patches into the kernel as part of these preliminary tasks.

I finished my tasks and spent around a week or so awaiting the result. On the 26th of February, I got my acceptance email.

## Starting to Work

I was invited to a Discord server for the mentees, and each Wednesday we had online meetings with our mentor Shuah Khan, where we covered various useful tools, discussed contribution opportunities, and got non-public (and less harsh) reviews and feedback on our patch attempts.

I decided to focus on fixing bugs, and to that end I tried to fix bugs from [syzkaller](https://syzkaller.appspot.com/). It's a hosted public dashboard for bugs found via [the syz fuzzing system](https://github.com/google/syzkaller/blob/master/docs/syzbot.md). These are mostly kernel warnings, and reports from <abbr>KASAN</abbr> (Kernel Address Sanitizer), <abbr>KMSAN</abbr> (Memory), and <abbr>UBSAN</abbr> (Undefined Behavior).

This was hard. Not all bugs had working reproducers, or were comprehensible to someone new to the subsystem. Most of the viable ones would be solved by an actual kernel engineer faster than I could reproduce and investigate it. There were even false positives.

Despite this, I managed to get some bugfixes in bcachefs, from syzkaller. I'll try to recount the process of investigating and fixing each bug in detail, in the hopes that it might be useful to others looking to fix kernel bugs.

## Fixes in bcachefs

### Atomic Contexts and Blocking Functions

I started by picking this syzkaller bug: [BUG: sleeping function called from invalid context in `bch2_printbuf_make_room`
(2)](https://syzkaller.appspot.com/bug?extid=c82cd2906e2f192410bb).

Let's look at (the relevant parts of) the crash report.

```crash
BUG: sleeping function called from invalid context at ./include/linux/sched/mm.h:321
in_atomic(): 0, irqs_disabled(): 0, non_block: 0, pid: 5828, name: syz-executor246
preempt_count: 0, expected: 0
RCU nest depth: 1, expected: 0
3 locks held by syz-executor246/5828:
 #0: ffff88807ad6a0e0 (&type->s_umount_key#42/1){+.+.}-{4:4}, at: alloc_super+0x221/0x9d0 fs/super.c:344
 #1: ffff888075a84210 (&c->btree_trans_barrier){.+.+}-{0:0}, at: srcu_lock_acquire include/linux/srcu.h:161 [inline]
 #1: ffff888075a84210 (&c->btree_trans_barrier){.+.+}-{0:0}, at: srcu_read_lock include/linux/srcu.h:253 [inline]
 #1: ffff888075a84210 (&c->btree_trans_barrier){.+.+}-{0:0}, at: __bch2_trans_get+0x7ed/0xd40 fs/bcachefs/btree_iter.c:3386
 #2: ffffffff8ed3b560 (rcu_read_lock){....}-{1:3}, at: rcu_lock_acquire include/linux/rcupdate.h:331 [inline]
 #2: ffffffff8ed3b560 (rcu_read_lock){....}-{1:3}, at: rcu_read_lock include/linux/rcupdate.h:841 [inline]
 #2: ffffffff8ed3b560 (rcu_read_lock){....}-{1:3}, at: bch2_bkey_pick_read_device+0x29c/0x19b0 fs/bcachefs/extents.c:144
CPU: 0 UID: 0 PID: 5828 Comm: syz-executor246 Not tainted 6.14.0-syzkaller-11270-g08733088b566 #0 PREEMPT(full) 
Hardware name: Google Google Compute Engine/Google Compute Engine, BIOS Google 02/12/2025
Call Trace:
 <TASK>
 __dump_stack lib/dump_stack.c:94 [inline]
 dump_stack_lvl+0x241/0x360 lib/dump_stack.c:120
 __might_resched+0x558/0x6c0 kernel/sched/core.c:8818
 might_alloc include/linux/sched/mm.h:321 [inline]
 slab_pre_alloc_hook mm/slub.c:4089 [inline]
 slab_alloc_node mm/slub.c:4167 [inline]
 __do_kmalloc_node mm/slub.c:4317 [inline]
 __kmalloc_node_track_caller_noprof+0xd3/0x4d0 mm/slub.c:4337
 __do_krealloc mm/slub.c:4895 [inline]
 krealloc_noprof+0x10f/0x300 mm/slub.c:4948
 bch2_printbuf_make_room+0x1f1/0x350 fs/bcachefs/printbuf.c:59
 bch2_prt_printf+0x269/0x6d0 fs/bcachefs/printbuf.c:186
 bch2_log_msg_start fs/bcachefs/error.c:19 [inline]
 bch2_fs_trans_inconsistent fs/bcachefs/error.c:63 [inline]
 bch2_fs_inconsistent+0x143/0x220 fs/bcachefs/error.c:81
 bch2_dev_rcu fs/bcachefs/sb-members.h:226 [inline]
 bch2_bkey_pick_read_device+0x95e/0x19b0 fs/bcachefs/extents.c:165
 bch2_btree_node_read+0x7ac/0x29e0 fs/bcachefs/btree_io.c:1706
 __bch2_btree_root_read fs/bcachefs/btree_io.c:1796 [inline]
 bch2_btree_root_read+0x656/0x7e0 fs/bcachefs/btree_io.c:1818
 read_btree_roots+0x3d7/0xa80 fs/bcachefs/recovery.c:581
 bch2_fs_recovery+0x28e4/0x3e20 fs/bcachefs/recovery.c:928
 bch2_fs_start+0x2fb/0x610 fs/bcachefs/super.c:1060
 bch2_fs_get_tree+0x113e/0x18f0 fs/bcachefs/fs.c:2253
 vfs_get_tree+0x90/0x2b0 fs/super.c:1759
 do_new_mount+0x2cf/0xb70 fs/namespace.c:3878
 do_mount fs/namespace.c:4218 [inline]
 __do_sys_mount fs/namespace.c:4429 [inline]
 __se_sys_mount+0x38c/0x400 fs/namespace.c:4406
 do_syscall_x64 arch/x86/entry/syscall_64.c:63 [inline]
 do_syscall_64+0xf3/0x230 arch/x86/entry/syscall_64.c:94
 entry_SYSCALL_64_after_hwframe+0x77/0x7f
```

Now, where do we look for the bug? The first thing to look for is the last bcachefs function in the call trace, because it's a reasonable assumption that the bug is in bcachefs code and not in core kernel memory management code. That is `bch2_printbuf_make_room`.

Right, but what is an "invalid context" anyway? {% sidenote(ref="Researching the error message") %}[Even good old StackOverflow suffices.](https://stackoverflow.com/questions/16538824/bug-sleeping-function-called-from-invalid-context-at-mm-slub-c1719){% end %} will tell us that "invalid" here is "atomic". You can't call a function which may sleep from an atomic context.

Although we don't need this to solve the bug, we might as well ask ourselves why we're in an atomic context here. The reason can be seen in the `locks held` part of the report, which lists an `rcu_read_lock` held by `bch2_bkey_pick_read_device`. {% sidenote(ref="It is illegal to block while in an <abbr>RCU</abbr> read-side critical section.") %}<https://www.kernel.org/doc/html/next/RCU/whatisRCU.html#rcu-read-lock>{% end %}

What are the offending functions? Let's look at what `bch2_printbuf_make_room` is doing, exactly.

{% marginnote() %}[`fs/bcachefs/printbuf.c`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/bcachefs/printbuf.c?id=08733088b566b58283f0f12fb73f5db6a9a9de30#n59){% end %}
```c,hl_lines=9
int bch2_printbuf_make_room(struct printbuf *out, unsigned extra)
{
	/* snip */
  
	/*
	 * Note: output buffer must be freeable with kfree(), it's not required
	 * that the user use printbuf_exit().
	 */
	char *buf = krealloc(out->buf, new_size, !out->atomic ? GFP_KERNEL : GFP_NOWAIT);

	if (!buf) {
		out->allocation_failure = true;
		out->overflow = true;
		return -ENOMEM;
	}

	out->buf	= buf;
	out->size	= new_size;
	return 0;
}
```

That `krealloc` call is what the crash report is complaining about as well. It's interesting that the call does seem to think about atomicity, from the `!out->atomic ? GFP_KERNEL : GFP_NOWAIT`. Then, `out->atomic` must not be correctly maintained? Let's step back in the call trace and look at how the caller is using this `struct printbuf`.

First we would look at `bch2_prt_printf`, but that's not where the `struct printbuf` is constructed. Neither is it one more step back, in `bch2_log_msg_start`. Finally we see it being constructed in `bch2_fs_trans_inconsistent`:

{% marginnote() %}[`fs/bcachefs/error.c`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/bcachefs/error.c?id=08733088b566b58283f0f12fb73f5db6a9a9de30#n61){% end %}
```c,hl_lines=5
__printf(3, 0)
static bool bch2_fs_trans_inconsistent(struct bch_fs *c, struct btree_trans *trans,
				       const char *fmt, va_list args)
{
	struct printbuf buf = PRINTBUF;

	bch2_log_msg_start(c, &buf);

	prt_vprintf(&buf, fmt, args);
	prt_newline(&buf);

	if (trans)
		bch2_trans_updates_to_text(&buf, trans);
	bool ret = __bch2_inconsistent_error(c, &buf);
	bch2_print_string_as_lines(KERN_ERR, buf.buf);

	printbuf_exit(&buf);
	return ret;
}
```

and expanding the `PRINTBUF` macro…

{% marginnote() %}[`fs/bcachefs/printbuf.h`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/bcachefs/printbuf.h?id=08733088b566b58283f0f12fb73f5db6a9a9de30#n133){% end %}
```c
/* Initializer for a heap allocated printbuf: */
#define PRINTBUF ((struct printbuf) { .heap_allocated = true })
```

So `buf.atomic` is `0`. Hence the `krealloc` call is made with `GFP_KERNEL`, which is potentially blocking. How do we correctly handle this `.atomic` field? Let's look for examples in `fs/bcachefs`.

```c
❯ rg -F '.atomic'
journal.c
145:    buf.atomic++;
273:            pbuf.atomic++;
287:            err.atomic++;

btree_io.c
2246:           buf.atomic++;

error.c
46:     buf.atomic++;
62:     buf.atomic++;

debug.c
515:            i->buf.atomic++;
531:            --i->buf.atomic;

journal_reclaim.c
225:                    buf.atomic++;

alloc_foreground.c
1638:   buf.atomic++;
1647:   --buf.atomic;

btree_locking.c
164:            buf.atomic++;
200:    buf.atomic++;
```

Alright. So we're supposed to increment the `.atomic` field before working with the buffer, and decrement it when done. Let's do that. It should be fixed now, right?

Nope, we get a similar crash. What gives? Turns out there's one more blocking function left in this codepath. It's `bch2_print_string_as_lines`, due to it calling `console_lock`. Luckily for us, there is a direct replacement function already there, called… `bch2_print_string_as_lines_nonblocking`. We just replace the call, and we're finally done.

{% marginnote() %}Kent Overstreet is really nice, by the way. He even suggested possible further work in that thread for me. Namely, trying to replace `print_string_as_lines` entirely by calling something lower-level which didn't have the 1k chars limitation of `printk`. Unfortunately I did not find a straightforward lower function to `printk` that would've done what we wanted, but still.{% end %}
Now, having done this, I submitted [my patch](https://lore.kernel.org/all/20250402161043.161795-1-bharadwaj.raju777@gmail.com/T/) to the bcachefs mailing list, only to be told by Kent Overstreet that he had beat me to it. But! He hadn't replaced the `bch2_print_string_as_lines` call, which meant the issue wasn't fully fixed, and I still had a contribution to make. I made [another patch](https://lore.kernel.org/linux-bcachefs/20250402181556.81529-1-bharadwaj.raju777@gmail.com/T/) doing only that, and it was accepted.

### Error Paths, 1

The bug this time is [<abbr>UBSAN</abbr>: shift-out-of-bounds in `__bch2_bkey_unpack_key`](https://syzkaller.appspot.com/bug?extid=cfd994b9cdf00446fd54).

Crash report:

```crash
UBSAN: shift-out-of-bounds in fs/bcachefs/bkey.c:163:16
shift exponent 4294967127 is too large for 64-bit type 'u64' (aka 'unsigned long long')
CPU: 0 UID: 0 PID: 5832 Comm: read_btree_node Not tainted 6.15.0-syzkaller-01958-g785cdec46e92 #0 PREEMPT(full) 
Hardware name: Google Google Compute Engine/Google Compute Engine, BIOS Google 05/07/2025
Call Trace:
 <TASK>
 dump_stack_lvl+0x189/0x250 lib/dump_stack.c:120
 ubsan_epilogue+0xa/0x40 lib/ubsan.c:231
 __ubsan_handle_shift_out_of_bounds+0x386/0x410 lib/ubsan.c:492
 get_inc_field fs/bcachefs/bkey.c:163 [inline]
 __bch2_bkey_unpack_key+0xdc4/0xe10 fs/bcachefs/bkey.c:284
 __bch2_bkey_compat+0x4db/0xbd0 fs/bcachefs/bkey_methods.c:480
 bch2_bkey_compat fs/bcachefs/bkey_methods.h:134 [inline]
 validate_bset_keys+0x6c1/0x1390 fs/bcachefs/btree_io.c:983
 bch2_btree_node_read_done+0x18c8/0x4f60 fs/bcachefs/btree_io.c:1211
 btree_node_read_work+0x426/0xe30 fs/bcachefs/btree_io.c:1400
 bch2_btree_node_read+0x887/0x29f0 fs/bcachefs/btree_io.c:-1
 bch2_btree_node_fill+0xd12/0x14f0 fs/bcachefs/btree_cache.c:994
 bch2_btree_node_get_noiter+0xa2c/0x1000 fs/bcachefs/btree_cache.c:1261
 found_btree_node_is_readable fs/bcachefs/btree_node_scan.c:85 [inline]
 try_read_btree_node fs/bcachefs/btree_node_scan.c:220 [inline]
 read_btree_nodes_worker+0x1319/0x1e20 fs/bcachefs/btree_node_scan.c:269
 kthread+0x711/0x8a0 kernel/kthread.c:464
 ret_from_fork+0x4e/0x80 arch/x86/kernel/process.c:148
 ret_from_fork_asm+0x1a/0x30 arch/x86/entry/entry_64.S:245
 </TASK>
---[ end trace ]---
```

That shift exponent does look too large. Let's check out the function where it happens.

{% marginnote() %}[`fs/bcachefs/bkey.c`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/bcachefs/bkey.c?id=785cdec46e9227f9433884ed3b436471e944007c#n163){% end %}
```c,hl_lines=8
__always_inline
static u64 get_inc_field(struct unpack_state *state, unsigned field)
{
	unsigned bits = state->format->bits_per_field[field];
	u64 v = 0, offset = le64_to_cpu(state->format->field_offset[field]);

	if (bits >= state->bits) {
		v = state->w >> (64 - bits);
		bits -= state->bits;

		state->p = next_word(state->p);
		state->w = *state->p;
		state->bits = 64;
	}

	/* avoid shift by 64 if bits is 0 - bits is never 64 here: */
	v |= (state->w >> 1) >> (63 - bits);
	state->w <<= bits;
	state->bits -= bits;

	return v + offset;
}
```

`(64 - bits)` became `4294967127`. Shift exponents are unsigned, so `bits` must have been greater than 64 to cause a huge value when cast. We can calculate (or `printk`) to see that `bits == 233`.

So `state->format` has invalid values. Where does it come from? If we follow it up the call stack, we see that it comes from `struct btree` itself and is passed here:

{% marginnote() %}[`fs/bcachefs/btree_io.c`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/bcachefs/btree_io.c?id=785cdec46e9227f9433884ed3b436471e944007c#n983){% end %}
```c,hl_lines=12
static int validate_bset_keys(struct bch_fs *c, struct btree *b,
			 struct bset *i, int write,
			 struct bch_io_failures *failed,
			 struct printbuf *err_msg)
{

    /* snip */

		if (!write)
			bch2_bkey_compat(b->c.level, b->c.btree_id, version,
				    BSET_BIG_ENDIAN(i), write,
				    &b->format, k);

    /* snip */

}
```

Well… what now? Let's look at where `validate_bset_keys` is being called from here.

{% marginnote() %}[`fs/bcachefs/btree_io.c`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/bcachefs/btree_io.c?id=785cdec46e9227f9433884ed3b436471e944007c#n1211){% end %}
```c,hl_lines=15
int bch2_btree_node_read_done(struct bch_fs *c, struct bch_dev *ca,
			      struct btree *b,
			      struct bch_io_failures *failed,
			      struct printbuf *err_msg)
{
    /* snip */
    
		ret = validate_bset(c, ca, b, i, b->written, sectors, READ, failed, err_msg);
		if (ret)
			goto fsck_err;

		if (!b->written)
			btree_node_set_format(b, b->data->format);

		ret = validate_bset_keys(c, b, i, READ, failed, err_msg);
		if (ret)
			goto fsck_err;

    /* snip */
}
```

There's a lot of validation functions in the surrounding code, which is interesting. If `validate_bset_keys` fails on an invalid format, then maybe it expects a previous validation step to have caught it? There's some reference to `btree_node_set_format` immediately after `validate_bset`, so let's see if there's anything relevant to us there. Turns out there isn't any validation in `btree_node_set_format` itself, so maybe it's happening before. Let's read `validate_bset` instead. It's a huge function, nevertheless a careful reading rewards us:


{% marginnote() %}[`fs/bcachefs/btree_io.c`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/bcachefs/btree_io.c?id=785cdec46e9227f9433884ed3b436471e944007c#n861){% end %}
```c,hl_lines=9
static int validate_bset(struct bch_fs *c, struct bch_dev *ca,
			 struct btree *b, struct bset *i,
			 unsigned offset, unsigned sectors, int write,
			 struct bch_io_failures *failed,
			 struct printbuf *err_msg)
{
    /* snip */

		btree_err_on(bch2_bkey_format_invalid(c, &bn->format, write, &buf1),
			     -BCH_ERR_btree_node_read_err_bad_node,
			     c, ca, b, i, NULL,
			     btree_node_bad_format,
			     "invalid bkey format: %s\n%s", buf1.buf,
			     (printbuf_reset(&buf2),
			      bch2_bkey_format_to_text(&buf2, &bn->format), buf2.buf));

    /* snip */
}
```

So there is a function to validate the format after all! So, the question becomes: why did it not catch the invalid format? Adding a `printk` to log its result tells us that it *does* return `-BCH_ERR_invalid`. What gives?

The answer is in `btree_err_on`, and how it deals with `btree_node_bad_format` errors.

{% marginnote() %}[`fs/bcachefs/btree_io.c`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/bcachefs/btree_io.c?id=785cdec46e9227f9433884ed3b436471e944007c#n656){% end %}
```c
#define btree_err(type, c, ca, b, i, k, _err_type, msg, ...)		\
({									\
	int _ret = __btree_err(type, c, ca, b, i, k, write,		\
			       BCH_FSCK_ERR_##_err_type,		\
			       failed, err_msg,				\
			       msg, ##__VA_ARGS__);			\
									\
	if (_ret != -BCH_ERR_fsck_fix) {				\
		ret = _ret;						\
		goto fsck_err;						\
	}								\
									\
	true;								\
})

#define btree_err_on(cond, ...)	((cond) ? btree_err(__VA_ARGS__) : false)
```

So, the jump to `fsck_err` is only made if the return value from `__btree_err` is not `-BCH_ERR_fsck_fix`. Let's look at what `__btree_err` does, then.

{% marginnote() %}[`fs/bcachefs/btree_io.c`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/bcachefs/btree_io.c?id=785cdec46e9227f9433884ed3b436471e944007c#n546){% end %}
```c,hl_lines=14-15
__printf(11, 12)
static int __btree_err(int ret,
		       struct bch_fs *c,
		       struct bch_dev *ca,
		       struct btree *b,
		       struct bset *i,
		       struct bkey_packed *k,
		       int rw,
		       enum bch_sb_error_id err_type,
		       struct bch_io_failures *failed,
		       struct printbuf *err_msg,
		       const char *fmt, ...)
{
	if (c->recovery.curr_pass == BCH_RECOVERY_PASS_scan_for_btree_nodes)
		return -BCH_ERR_fsck_fix;

  /* snip */
}
```

And that's it (confirmed by a bit of logging). If the current recovery pass is "scan for btree nodes", then all kinds of errors will be turned into `-BCH_ERR_fsck_fix`.

This offending line was added in [`cd3cdb1ef706`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=cd3cdb1ef706a1ac725194d81858d58375739b25). Previously it would have returned `__bch2_topology_error(c, &out)`.

Based on that I made my [first patch](https://lore.kernel.org/all/20250614185743.657564-1-bharadwaj.raju777@gmail.com/T/), but based on feedback I sent a simpler [second patch](https://lore.kernel.org/all/20250615164547.11900-1-bharadwaj.raju777@gmail.com/T/), which was accepted. The function now checks if it is `-BCH_ERR_btree_node_read_err_fixable` before returning `fsck_fix`.

### Error Paths, 2

The bug at hand: [<abbr>UBSAN</abbr>: shift-out-of-bounds in `__bch2_btree_node_hash_insert`](https://syzkaller.appspot.com/bug?extid=029d1989099aa5ae3e89).

```crash
  node offset 0/16 bset u64s 0: incorrect max key U64_MAX:18374686479671623680:50331647, btree topology error: 
bcachefs (loop0): flagging btree xattrs lost data
bcachefs (loop0): running explicit recovery pass check_backpointers_to_extents (16), currently at recovery_pass_empty (0)
bcachefs (loop0): running explicit recovery pass scan_for_btree_nodes (1), currently at recovery_pass_empty (0)
bcachefs (loop0): error reading btree root btree=xattrs level=0: btree_node_read_error, fixing
------------[ cut here ]------------
UBSAN: shift-out-of-bounds in fs/bcachefs/btree_cache.c:218:18
shift exponent 251 is too large for 64-bit type 'unsigned long long'
CPU: 0 UID: 0 PID: 5830 Comm: syz-executor323 Not tainted 6.15.0-rc1-syzkaller-00246-g900241a5cc15 #0 PREEMPT(full) 
Hardware name: Google Google Compute Engine/Google Compute Engine, BIOS Google 02/12/2025
Call Trace:
 <TASK>
 __dump_stack lib/dump_stack.c:94 [inline]
 dump_stack_lvl+0x241/0x360 lib/dump_stack.c:120
 ubsan_epilogue lib/ubsan.c:231 [inline]
 __ubsan_handle_shift_out_of_bounds+0x3c8/0x420 lib/ubsan.c:492
 __btree_node_pinned fs/bcachefs/btree_cache.c:218 [inline]
 __bch2_btree_node_hash_insert+0x1b32/0x1ba0 fs/bcachefs/btree_cache.c:294
 bch2_btree_node_hash_insert+0x7e/0xc0 fs/bcachefs/btree_cache.c:309
 __bch2_btree_root_read fs/bcachefs/btree_io.c:1791 [inline]
 bch2_btree_root_read+0x605/0x7e0 fs/bcachefs/btree_io.c:1819
 read_btree_roots+0x3d7/0xa80 fs/bcachefs/recovery.c:581
 bch2_fs_recovery+0x28e4/0x3e20 fs/bcachefs/recovery.c:928
 bch2_fs_start+0x310/0x620 fs/bcachefs/super.c:1059
 bch2_fs_get_tree+0x113e/0x18f0 fs/bcachefs/fs.c:2253
 vfs_get_tree+0x90/0x2b0 fs/super.c:1759
 do_new_mount+0x2cf/0xb70 fs/namespace.c:3879
 do_mount fs/namespace.c:4219 [inline]
 __do_sys_mount fs/namespace.c:4430 [inline]
 __se_sys_mount+0x38c/0x400 fs/namespace.c:4407
 do_syscall_x64 arch/x86/entry/syscall_64.c:63 [inline]
 do_syscall_64+0xf3/0x230 arch/x86/entry/syscall_64.c:94
 entry_SYSCALL_64_after_hwframe+0x77/0x7f
RIP: 0033:0x7f3aa1b3afaa
Code: d8 64 89 02 48 c7 c0 ff ff ff ff eb a6 e8 5e 04 00 00 66 2e 0f 1f 84 00 00 00 00 00 0f 1f 40 00 49 89 ca b8 a5 00 00 00 0f 05 <48> 3d 01 f0 ff ff 73 01 c3 48 c7 c1 b8 ff ff ff f7 d8 64 89 01 48
RSP: 002b:00007ffe042c3768 EFLAGS: 00000282 ORIG_RAX: 00000000000000a5
RAX: ffffffffffffffda RBX: 00007ffe042c3780 RCX: 00007f3aa1b3afaa
RDX: 0000200000000180 RSI: 0000200000000540 RDI: 00007ffe042c3780
RBP: 0000200000000540 R08: 00007ffe042c37c0 R09: 0000000000005964
R10: 0000000000800000 R11: 0000000000000282 R12: 0000200000000180
R13: 00007ffe042c37c0 R14: 0000000000000003 R15: 0000000000800000
 </TASK>
---[ end trace ]---
```

Let's look at the last function to see what exactly is invalid.

{% marginnote() %}[`fs/bcachefs/btree_cache.c`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/bcachefs/btree_cache.c?id=900241a5cc15e6e0709a012051cc72d224cd6a6e#n218){% end %}
```c,hl_lines=7
static inline bool __btree_node_pinned(struct btree_cache *bc, struct btree *b)
{
	struct bbpos pos = BBPOS(b->c.btree_id, b->key.k.p);

	u64 mask = bc->pinned_nodes_mask[!!b->c.level];

	return ((mask & BIT_ULL(b->c.btree_id)) &&
		bbpos_cmp(bc->pinned_nodes_start, pos) < 0 &&
		bbpos_cmp(bc->pinned_nodes_end, pos) >= 0);
}
```

`BIT_ULL(nr)` expands to `1ULL << nr`. So `b->c.btree_id` is too large at 251.

But… what are the valid values for `btree_id`? Where does it come from, and where is it validated, if anywhere?

{% marginnote() %}With some more forethought, you could save time by assuming that a validation check, if it existed, would probably be in the form of `btree_id\s+(>|<)` and search for that.{% end %}There are many ways you could try to research these questions. What I did was just search for `btree_id` in the codebase and scan through for interesting instances. I found this:

{% marginnote() %}[`fs/bcachefs/recovery.c`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/bcachefs/recovery.c?id=900241a5cc15e6e0709a012051cc72d224cd6a6e#n469){% end %}
```c,hl_lines=12-15
static int journal_replay_entry_early(struct bch_fs *c,
				      struct jset_entry *entry)
{
	int ret = 0;

	switch (entry->type) {
	case BCH_JSET_ENTRY_btree_root: {

		if (unlikely(!entry->u64s))
			return 0;

		if (fsck_err_on(entry->btree_id >= BTREE_ID_NR_MAX,
				c, invalid_btree_id,
				"invalid btree id %u (max %u)",
				entry->btree_id, BTREE_ID_NR_MAX))
			return 0;

    /* snip */
}
```

Examining the functions in the call trace will show that this function is indeed called before the failure point.

This seems familiar to the previous case, doesn't it? There's a validation check in place, but it doesn't actually stop the code from proceeding, for whatever reason. Let's find out.

This check was introduced in [`9e7cfb35e266`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=9e7cfb35e2668e542c333ed3ec4b0a951dd332ee). A later commit, [`141526548052`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=14152654805256d760315ec24e414363bfa19a06), introduced this bug. It is worthwhile to see what exactly these two commits do.

The first introduces a new error type called `invalid_btree_id` in `sb-errors_format.h`.{% marginnote() %}`sb` stands for superblock.{% end %} The second marks the error types `btree_root_bkey_invalid` and `btree_root_read_error` as `FSCK_AUTOFIX`. Why did that make the bug happen? Look at these lines from the crash report, just before <abbr>UBSAN</abbr> blows up:

```,hl_lines=5
  node offset 0/16 bset u64s 0: incorrect max key U64_MAX:18374686479671623680:50331647, btree topology error: 
bcachefs (loop0): flagging btree xattrs lost data
bcachefs (loop0): running explicit recovery pass check_backpointers_to_extents (16), currently at recovery_pass_empty (0)
bcachefs (loop0): running explicit recovery pass scan_for_btree_nodes (1), currently at recovery_pass_empty (0)
bcachefs (loop0): error reading btree root btree=xattrs level=0: btree_node_read_error, fixing
```

It looks as if marking `btree_root_read_error` as autofix caused us to attempt to fix it (as expected), and that codepath ran into this issue.

Back to why the validation check didn't work. Once again, let's look at how `fsck_err_on` actually works. Long story short, it expands into a bunch of macros:

{% marginnote() %}[`fs/bcachefs/error.h`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/fs/bcachefs/error.h?id=900241a5cc15e6e0709a012051cc72d224cd6a6e#n90)

Note that in the call we're looking at, `_err_type` is `invalid_btree_id`, and `_flags` is `FSCK_CAN_FIX|FSCK_CAN_IGNORE`.
{% end %}
```c
#define bch2_fsck_err(c, _flags, _err_type, ...)				\
	__bch2_fsck_err(type_is(c, struct bch_fs *) ? (struct bch_fs *) c : NULL,\
			type_is(c, struct btree_trans *) ? (struct btree_trans *) c : NULL,\
			_flags, BCH_FSCK_ERR_##_err_type, __VA_ARGS__)

#define fsck_err_wrap(_do)						\
({									\
	int _ret = _do;							\
	if (_ret != -BCH_ERR_fsck_fix &&				\
	    _ret != -BCH_ERR_fsck_ignore) {				\
		ret = _ret;						\
		goto fsck_err;						\
	}								\
									\
	_ret == -BCH_ERR_fsck_fix;					\
})

#define __fsck_err(...)		fsck_err_wrap(bch2_fsck_err(__VA_ARGS__))

#define fsck_err_on(cond, c, _err_type, ...)				\
	__fsck_err_on(cond, c, FSCK_CAN_FIX|FSCK_CAN_IGNORE, _err_type, __VA_ARGS__)
```

We only `goto fsck_err` if what `__bch2_fsck_err` returns is neither `fsck_fix` nor `fsck_ignore`.

My [first patch](https://lore.kernel.org/all/20250627084033.614376-2-bharadwaj.raju777@gmail.com/T/) thus proposed that we use `mustfix_fsck_err_on` instead of `fsck_err_on`, which doesn't pass `FSCK_CAN_IGNORE` as part of the `_flags`. However, it was pointed out that we can just mark `invalid_btree_id` autofix as well, and then `__bch2_fsck_err` would (auto)fix it. So that's what my [second patch](https://lore.kernel.org/all/20250627164132.25133-1-bharadwaj.raju777@gmail.com/T/) did, and was accepted.

### False Positives from <abbr>KMSAN</abbr>

I spent a lot of time trying and failing to investigate this bug: [<abbr>KMSAN</abbr>: uninit-value in `bch2_btree_ptr_v2_validate`](https://syzkaller.appspot.com/bug?extid=655143dc5f99972b52e6). I did not see how the value in question was possibly uninitialized.

Until shortly after, when this patch series was posted to the linux-bcachefs mailing list which showed that most of the <abbr>KMSAN</abbr> bugs recorded against bcachefs were spurious: [\[PATCH&nbsp;0/5\] kmsan splat fixes](https://lore.kernel.org/linux-bcachefs/20250320213256.3359777-1-kent.overstreet@linux.dev/T/).

<abbr>KMSAN</abbr> doesn't understand `memcpy`s implemented using inline assembly, and it has trouble when a struct's fields are initialized via stores to bitfields.

I learned that I could stand to take a little more seriously my suspicions of sanitizers when their reports didn't seem to match up to what I saw. I had it in the back of my mind, but my inexperience made me apprehensive of just dismissing a report from an established tool. All in all, educational despite me not getting a bugfix out of this one.


## Sensor Driver

I spent the rest of my time developing an <abbr>IIO</abbr> kernel driver for the InvenSense <abbr>ICM</abbr>-20948 sensor, which combines an accelerometer, gyrometer, and magnetometer. This post is long enough as it is, so I'll talk about that another time. Maybe when it's actually merged.

## Reflections

I split my time during this program between bugfixes and driver development. I semi-intentionally eschewed those  contribution opportunities which were in the shape of "find and update uses of this old <abbr>API</abbr> to the new one" firstly because I did not find them that interesting to work on, and also because as I observed with my peers, {% sidenote(ref="a lot of such patches were seen as churn and rejected by maintainers") %}For a particularly incisive example, see [Re: \[PATCH\] xfs: replace strncpy with strscpy](https://lore.kernel.org/all/aHg7JOY5UrOck9ck@dread.disaster.area/).{% end %}.

Being in the <abbr>LKMP</abbr> was as rewarding as it was challenging. If you're interested in becoming a kernel developer, I recommend it wholeheartedly. The program structure is extremely flexible, so you can do it alongside other obligations. Contributing to the Linux kernel can be rather daunting and even discouraging, so having a mentor to guide you through the initial troubles is really valuable.

Finally… thank you to Shuah Khan, Ricardo B. Marlière, and Javier Carrasco!

