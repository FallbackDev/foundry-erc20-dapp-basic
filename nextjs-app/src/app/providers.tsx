// 1. 声明这是客户端组件。因为这里面用到了 useState 等钩子，必须在浏览器运行，不能在服务器运行。
'use client'

import React, { ReactNode, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query' // 2.用于管理数据请求和缓存的库，Wagmi 底层依赖它来缓存链上数据。
import { WagmiProvider } from 'wagmi' // 3. Wagmi 的核心 Provider，像“电源插座”一样给整个应用供电（提供区块链连接能力）。
import { RainbowKitProvider } from '@rainbow-me/rainbowkit' // 4. RainbowKit 的 UI 上下文，管理连接钱包那个漂亮的弹窗。
import '@rainbow-me/rainbowkit/styles.css' // 5. 引入 RainbowKit 的默认样式文件。

import { config } from '@/wagmi' // 6. 导入我们在 wagmi.ts 里定义好的“静态配置”（地图）。

// 7. 定义并导出 Providers 组件。它是一个包裹器，接收 children（您的所有页面）作为参数。
//({ children }: { children: ReactNode }) 是 参数：参数类型的意思，用了解构写法
//children是一个“强约定”
//<>标签中间夹的内容会被默认定义为children属性，
// export function Providers({ children }: { children: ReactNode })就是形参为children，用了解构写法，确保形参匹配上“children”属性，
//同时要求实参的children属性必须为ReactNode，{ children: ReactNode }限定了这个被捕获的属性值必须是合法的 React 节点（文本、标签等），不接受别的乱七八糟的东西。
export function Providers({ children }: { children: ReactNode }) {
    // 8. 创建一个 QueryClient 实例。
    // useState(() => new QueryClient()) 这种写法确保 QueryClient 只在第一次渲染时创建一次，避免重复创建清空缓存。
    //() => new QueryClient()类似于lambda表达式
    // 它就像一个“本地数据库”，缓存了查到的余额、交易记录等，防止每次切换页面都重新去链上读。
    //ts/js的数组元素可以不一致
    //这里是数组解构，只拿了useState返回值的第一个元素
    //useState是泛型函数
    //useState，返回一个value（实参）和一个修改其数据的setvalue函数
    //给它实参，它把实参原封不动给你。 这听起来像是在“脱裤子放屁
    //本质区别：记忆与重生。关键在于 React 组件是会反复运行的函数。
    //如果不用useState，直接声明普通变量。问题： 普通变量没有“记忆”。组件一刷新，它就死而复生，以前的事全忘了。
    //使用useState，1.持久化 (Persistence): 让函数在多次重新执行之间，能够记住之前的状态。
    //2.触发更新 (Trigger): 这才是重点！那个 setValue 函数不仅仅是修改值。 当您调用 setValue(5) 时，它会做两件事：
    //把后台账本里的值改成 5。
    //大喊一声：“甚至数据变了！重新运行整个渲染函数！”
    //所以： useState 不是简单的“存取器”。 它是一个 连接 React 渲染引擎的“锚点”。 它把一个普通的数据，变成了一个能驱动 UI 变化的“响应式数据”。

    // 总结 const [queryClient] = useState(() => new QueryClient()) 的逻辑闭环：
    // 1. 需求：我们需要一个 QueryClient 对象来管理全局缓存。
    // 2. 问题：React 组件函数 Providers 会被多次执行（重渲染）。如果直接 const client = new QueryClient()，每次重渲染都会创建新对象，导致缓存丢失且浪费性能。
    // 3. 解决方案：使用 useState。它充当“React 这里的全局变量管理器”。
    //    - 第一次运行时：useState 接收初始值，创建对象，存入 React 内部的“账本”，并返回给变量 queryClient。
    //    - 第N次运行时：useState 忽略初始值，直接从“账本”里取出之前存好的那个老对象返回。这样保证了对象是同一个。
    // 4. 优化（惰性初始化）：使用 () => new QueryClient() 而不是 new QueryClient()。
    //    - 这是一个箭头函数（Lambda），相当于把“创建对象”的权力封装成一个锦囊交给了 React。
    //    - 只有在第一次初始化时，React 才会打开锦囊执行函数，创建对象。
    //    - 后续重渲染时，React 根本不会执行这个函数，避免了无意义的对象创建开销。
    // 5. 语法细节：
    //    - 泛型推断：TS 自动推断出 queryClient 是 QueryClient 类型。
    //    - 数组解构：useState 返回 [value, setValue]，我们只需要 value，所以解构出第一个元素，丢弃了不需要的 setValue。
    const [queryClient] = useState(() => new QueryClient())


    return (
        // 9. 第一层包裹：WagmiProvider
        // 把配置（config）注入全局。从此内部所有组件都知道连哪个链、用哪个 RPC。
        <WagmiProvider config={config}>
            {/* 10. 第二层包裹：QueryClientProvider */}
            {/* 把缓存机制注入全局。让 Wagmi 能够智能地缓存数据、自动刷新数据。 */}
            <QueryClientProvider client={queryClient}>
                {/* 11. 第三层包裹：RainbowKitProvider */}
                {/* 把 UI 主题注入全局。让我们可以直接使用 <ConnectButton /> 等组件。 */}
                <RainbowKitProvider>
                    {/* 12. 这里的 children 就是您的整个应用（page.tsx 等）。 */}
                    {/* 它们被层层包裹，从而拥有了访问区块链的所有能力。 */}
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}


