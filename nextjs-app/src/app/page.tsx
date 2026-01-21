'use client'

import { useState, useEffect, useCallback } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
} from 'wagmi'
import { formatUnits, parseUnits, publicActions } from 'viem'
import { ourTokenAbi } from '@/constants/abi'
import { OUR_TOKEN_ADDRESS } from '@/constants/contracts'
import { config } from '@/wagmi'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Send, Coins, Wallet, History, ArrowRightLeft, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
// ... (rest of imports and types omitted for brevity, but they should remain)

interface Transaction {
  hash: string
  from: string
  to: string
  amount: string
  timestamp: number
  type: 'in' | 'out'
}

export default function Home() {
  //useAccount---查户口，它是wagmi提供的最基础的hook
  //useAccount会返回一个包含十几个属性的巨大对象
  //address: 当前连接钱包的地址，如果有值，那就是连上了；没连上就是 undefined。
  //isConnected: 当前是否已连接
  //{}是对象解构，靠属性名取值，名字必须对上
  const { address, isConnected } = useAccount()

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // Format address helper
  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  // Read Token Info
  //解构重名，语法：{ 原名: 新名 }
  //函数参数，只传一个对象，在这个对象里不限定顺序
  const { data: name } = useReadContract({
    address: OUR_TOKEN_ADDRESS,
    abi: ourTokenAbi,
    functionName: 'name',
  })

  const { data: symbol } = useReadContract({
    address: OUR_TOKEN_ADDRESS,
    abi: ourTokenAbi,
    functionName: 'symbol',
  })

  const { data: decimals } = useReadContract({
    address: OUR_TOKEN_ADDRESS,
    abi: ourTokenAbi,
    functionName: 'decimals',
  })

  //读余额
  //refetch重新读取余额
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: OUR_TOKEN_ADDRESS,
    abi: ourTokenAbi,
    functionName: 'balanceOf',
    //在前端页面刚加载的一瞬间，有可能用户还没连钱包，此时 address 变量是空的 (undefined)。
    //如果直接写 args: [address]，就等于发出了一个 balanceOf(undefined) 的请求。合约肯定会报错，甚至让程序崩溃。
    //当 useReadContract 收到 args 是 undefined 时，它会非常聪明地暂时罢工（不发送请求），直到 address 变成有效值。
    args: address ? [address] : undefined,
  })

  // Reusable log fetcher
  //它的作用是去链上把 Transfer事件日志全抓下来，生成左边的“交易历史列表”。
  //这也是为了让用户转账成功后，列表里能马上多出来刚刚那一笔交易。
  const fetchLogs = useCallback(async () => {
    if (!address || !decimals) return

    try {
      const client = (config.getClient() as any).extend(publicActions)
      const logs = await client.getLogs({
        address: OUR_TOKEN_ADDRESS,
        event: {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { type: 'address', name: 'from', indexed: true },
            { type: 'address', name: 'to', indexed: true },
            { type: 'uint256', name: 'value' }
          ]
        },
        fromBlock: BigInt(0),
        toBlock: 'latest'
      })

      const formattedLogs: Transaction[] = logs
        .map((log: any) => {
          const { from, to, value } = log.args
          if (from.toLowerCase() === address.toLowerCase() || to.toLowerCase() === address.toLowerCase()) {
            return {
              hash: log.transactionHash,
              from,
              to,
              amount: formatUnits(value, (decimals as number) || 18),
              timestamp: Date.now(),
              type: from.toLowerCase() === address.toLowerCase() ? 'out' : 'in',
            }
          }
          return null
        })
        .filter((tx: Transaction | null): tx is Transaction => tx !== null)
        .reverse()

      setTransactions(formattedLogs)
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    }
  }, [address, decimals])

  // Initial logs fetch
  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Watch for Transfer events (Real-time listener)
  useWatchContractEvent({
    address: OUR_TOKEN_ADDRESS,
    abi: ourTokenAbi,
    eventName: 'Transfer',
    pollingInterval: 1000, // Faster updates for local node
    onLogs(logs: any[]) {
      logs.forEach((log) => {
        const { from, to, value } = log.args
        if (address && (from.toLowerCase() === address.toLowerCase() || to.toLowerCase() === address.toLowerCase())) {
          const newTx: Transaction = {
            hash: log.transactionHash,
            from,
            to,
            amount: formatUnits(value, (decimals as number) || 18),
            timestamp: Date.now(),
            type: from.toLowerCase() === address.toLowerCase() ? 'out' : 'in'
          }
          setTransactions(prev => {
            if (prev.find(tx => tx.hash === newTx.hash)) return prev
            return [newTx, ...prev]
          })
          refetchBalance()
        }
      })
    },
  })

  //useWriteContract初始化了一个交易发射器，writeContract就是那把枪
  const { data: hash, writeContract, isPending: isWritePending, error: writeError } = useWriteContract()

  //持续监听，当 Wagmi 的这个 Hook 被传入有效 hash 启动后，它会在内部（浏览器后台）开启一个 定时器 (Interval)。
  //每隔几秒钟，它偷偷向区块链节点发请求：eth_getTransactionReceipt(0x123)。
  //这就是所谓的“持续监听”（轮询 Polling）。
  //出块前：RPC 返回空，Hook 内部设置 isConfirming = true。这又导致 React 重跑一遍 UI，于是您的按钮上出现了那个转圈圈动画。
  //出块后：RPC 返回 receipt，Hook 内部设置 isConfirming = false，isConfirmed = true。React 再次重跑 UI，于是您的按钮上出现了那个绿色的对勾。
  //useWaitForTransactionReceipt是全自动的：
  //它们内部自己藏着对应的 useState。
  //它们内部的逻辑（轮询、网络请求）会自动调用那些看不见的 setState。
  //作为使用者，只能被动接收它吐出来的最新状态 (isLoading, isSuccess)，完全无法手动去修改它们。
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  //useWaitForTransactionReceipt (Wagmi)：
  //是真的在**“后台持续监听”（Polling/轮询）。它每隔几秒就发请求问一次区块链。它是一个主动**的监听者。

  //useEffect (React)：
  //它不是在后台持续监听。它更像是一个**“被动触发的守门员”**。
  //它不消耗 CPU 去轮询。它只是在 React 每次渲染完成后，对比一下依赖列表：
  //如果依赖列表中的值发生变化了，它就会触发一次 useEffect中的函数。

  //useEffect：自动化机器人
  //useEffect(函数, [依赖列表])
  //这是 React 最重要的 Hook 之一，叫 副作用 (Side Effect)。
  //参数 1 (函数)：要干的活。
  //参数 2 (依赖列表)：触发条件（监听器）。当依赖列表中的值发生变化时，函数会被重新执行。
  //React 听好了： 请你盯着 isConfirmed 这个变量（还有后面几个凑数的）。 
  // 只要 isConfirmed 变成了 true（哪怕稍微变一下）， 你就立刻执行前面那个函数（刷新余额、刷新日志、清空表单）。
  //
  useEffect(() => {
    if (isConfirmed) {
      refetchBalance()
      fetchLogs() // Immediately refresh history after confirmation
      //重置表单
      setAmount('')
      setRecipient('')
    }
  }, [isConfirmed, refetchBalance, fetchLogs])

  //handleTransfer是具体的发起交易逻辑，它被绑定在了按钮的onClick事件上
  const handleTransfer = () => {
    if (!recipient || !amount) return

    writeContract({
      address: OUR_TOKEN_ADDRESS,
      abi: ourTokenAbi,
      functionName: 'transfer',
      args: [recipient as `0x${string}`, parseUnits(amount, (decimals as number) || 18)],
    })
  }

  const handleMint = () => {
    writeContract({
      address: OUR_TOKEN_ADDRESS,
      abi: ourTokenAbi,
      functionName: 'mint',
    })
  }

  ///////////////////////////////////////////
  //                return
  //////////////////////////////////////////

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-black text-white p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-500/20">
              <Coins className="w-8 h-8 text-white" />
            </div>
            <div>
              {/*展示代币名称和代币符号*/}
              <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">{name as string || 'OurToken'}</h1>
              <p className="text-slate-400 text-sm font-medium">{(symbol as string) || 'OTK'} Explorer</p>
            </div>
          </div>
          <ConnectButton />
        </header>

        {!isConnected ? (
          //motion.div是一个普通的 div 盒子，但这加了个 motion. 前缀。 这是引入的一个叫 Framer Motion 的动画库。 它的作用是：让这个盒子出现在屏幕上时，不那么生硬，而是只要给它写参数，它就会自己动。
          //initial={{ opacity: 0, y: 20 }}：表示这个盒子在一开始的时候，透明度为 0（完全看不见），位置在原位下方 20 像素处。
          //animate={{ opacity: 1, y: 0 }}：表示这个盒子在动画结束的时候，透明度变 1（完全显示），位置回到原位（y=0）。
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 shadow-inner"
          >
            {/*展示代币名称和代币符号*/}
            <Wallet className="w-20 h-20 text-slate-500 mb-6 opacity-50" />
            <h2 className="text-2xl font-bold mb-3 text-white">Wallet Not Connected</h2>
            <p className="text-slate-400 mb-8 max-w-sm text-center">Connect your wallet to monitor your balance and send tokens seamlessly.</p>
            {/*ConnectButton是 RainbowKit 提供的组件，用于触发连接钱包的流程。*/}
            <ConnectButton />
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar / Stats */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="bg-white/5 backdrop-blur-xl border-white/10 text-white shadow-xl group hover:border-blue-500/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-slate-400 font-medium text-xs uppercase tracking-widest">Available Balance</CardTitle>
                    <Coins className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-4xl font-black text-white tracking-tighter pt-3 break-all">
                    {/*展示余额，balance以wei为单位，是bigint。*/}
                    {/*formatUnits()函数是viem提供的，formatUnits(100...000, 18) =》 把大数除以 10^18 =》 变成字符串 "100"。*/}
                    {/*Number()函数是JavaScript提供的，Number("100") =》 把字符串 "100" 转换成数字 100。*/}
                    {/*toLocaleString()函数是JavaScript提供的，Number(100).toLocaleString() =》 把数字 10000 转换成字符串 "10,000"。*/}

                    {/*(decimals as number || 18)是保底写法，||的意思是如果左边那个不行，就用右边的值。*/}
                    {/*因为网络请求是异步的。当页面刚打开的几毫秒内，useReadContract 还在转圈圈，decimals 变量此时是 undefined。*/}
                    {/*如果不加这个 || 18，formatUnits(..., undefined) 就会报错炸裂。加上这个，就能保证“就算还没查到精度，页面也能先按默认值 18 显示着，别崩溃”。*/}
                    {balance ? Number(formatUnits((balance as bigint), (decimals as number || 18))).toLocaleString() : '0'}
                  </div>
                  <div className="text-blue-400 font-bold text-lg mt-1">{symbol as string}</div>

                  {/* Mint / Faucet Button */}
                  <button
                    onClick={handleMint}
                    disabled={isWritePending || isConfirming}
                    className="mt-4 px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-full text-sm font-medium transition-all flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Coins className="w-4 h-4" />
                    {isWritePending || isConfirming ? 'Minting...' : 'Mint 10 Tokens (Faucet)'}
                  </button>
                </CardHeader>
                <CardContent className="pt-4 border-t border-white/5 mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span>Account</span>
                    <span className="text-slate-300">{formatAddress(address || '')}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-600/20 to-transparent backdrop-blur-lg border-white/10 text-white shadow-lg overflow-hidden relative">
                <div className="absolute -right-4 -bottom-4 opacity-10">
                  <ArrowRightLeft className="w-32 h-32" />
                </div>
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Network Info</CardTitle>
                  <CardDescription className="text-blue-300 font-medium">Foundry Local Development</CardDescription>
                </CardHeader>
                <CardContent className="text-xs opacity-80 pt-0">
                  <div className="flex flex-col gap-2">
                    <p>Chain ID: 31337</p>
                    <div className="flex items-center">Status: <span className="text-green-400 inline-flex items-center ml-2"><div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" /> Active</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-8">
              <Tabs defaultValue="transfer" className="w-full">
                <TabsList className="bg-black/40 border border-white/10 p-1 mb-6 inline-flex h-auto rounded-xl">
                  <TabsTrigger value="transfer" className="px-8 py-2.5 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all text-sm font-bold">Transfer</TabsTrigger>
                  <TabsTrigger value="history" className="px-8 py-2.5 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all text-sm font-bold flex items-center gap-2">
                    History
                    {transactions.length > 0 && (
                      <span className="bg-blue-400/20 text-blue-300 text-[10px] px-1.5 py-0.5 rounded-md">{transactions.length}</span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="transfer" className="mt-0 focus-visible:outline-none">
                  <Card className="bg-white/5 backdrop-blur-xl border-white/10 text-white shadow-2xl overflow-hidden border-t-2 border-t-blue-500/50">
                    <CardHeader>
                      <CardTitle className="text-xl flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg"><Send className="w-5 h-5 text-blue-400" /></div>
                        Send Tokens
                      </CardTitle>
                      <CardDescription className="text-slate-400">Transfer {name as string} securely across the network.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-2">
                      <div className="space-y-3 font-medium">
                        <label className="text-sm text-slate-300 ml-1">Recipient Address</label>
                        <Input
                          placeholder="0x..."
                          className="bg-black/40 border-white/10 text-white h-14 rounded-xl focus:ring-2 focus:ring-blue-500/50 transition-all border-2"
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                        />
                      </div>
                      <div className="space-y-3 font-medium">
                        <label className="text-sm text-slate-300 ml-1">Amount to Send</label>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="0.00"
                            className="bg-black/40 border-white/10 text-white h-14 rounded-xl focus:ring-2 focus:ring-blue-500/50 transition-all border-2 pr-16"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-400 bg-blue-400/10 px-2 py-1 rounded">
                            {symbol as string}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pb-8 pt-2">
                      <Button
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black h-14 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] text-base group"
                        disabled={!recipient || !amount || isWritePending || isConfirming}
                        onClick={handleTransfer}
                      >
                        {isWritePending || isConfirming ? (
                          <Loader2 className="mr-3 h-6 w-6 animate-spin text-white" />
                        ) : (
                          <Send className="mr-3 h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        )}
                        {isConfirming ? 'Processing Transaction...' : isWritePending ? 'Awaiting Signature...' : `Confirm Transfer`}
                      </Button>
                    </CardFooter>
                    {writeError && (
                      <div className="px-6 pb-6 pt-0 text-red-400 text-xs italic bg-red-500/5 py-3 border-t border-red-500/10">
                        Error: {writeError.message.split('\n')[0]}
                      </div>
                    )}
                  </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-0 focus-visible:outline-none">
                  <Card className="bg-white/5 backdrop-blur-xl border-white/10 text-white shadow-2xl min-h-[400px]">
                    <CardHeader className="border-b border-white/5">
                      <CardTitle className="text-xl flex items-center gap-3">
                        <div className="p-2 bg-slate-500/20 rounded-lg"><History className="w-5 h-5 text-slate-300" /></div>
                        Transaction Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 opacity-40">
                          <History className="w-16 h-16 mb-4 stroke-[1]" />
                          <p className="text-sm font-medium">No activity in this session</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          <AnimatePresence initial={false}>
                            {transactions.map((tx) => (
                              <motion.div
                                key={tx.hash}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-5 flex items-center justify-between hover:bg-white/5 transition-colors group"
                              >
                                <div className="flex items-center gap-4">
                                  <div className={`p-2.5 rounded-full ${tx.type === 'in' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                    {tx.type === 'in' ? (
                                      <ArrowRightLeft className="w-5 h-5 text-green-400 rotate-180" />
                                    ) : (
                                      <Send className="w-5 h-5 text-red-400" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-bold text-sm tracking-tight flex items-center gap-2">
                                      {tx.type === 'in' ? 'Received' : 'Sent'} {Number(tx.amount).toLocaleString()} {symbol as string}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                                      <span>{tx.type === 'in' ? `From: ${formatAddress(tx.from)}` : `To: ${formatAddress(tx.to)}`}</span>
                                      <span>•</span>
                                      <span>{new Date(tx.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                  </div>
                                </div>
                                <a
                                  href={`https://etherscan.io/tx/${tx.hash}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-2 hover:bg-blue-400/20 rounded-lg text-slate-400 hover:text-blue-400 transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        <footer className="text-center text-slate-600 text-[10px] pt-12 uppercase tracking-widest font-bold">
          <p className="flex items-center justify-center gap-2">
            Verified Source <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            Contract: <span className="text-slate-400 font-mono lower">{OUR_TOKEN_ADDRESS}</span>
          </p>
        </footer>
      </div>
    </main>
  )
}
