import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, foundry } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

export const config = getDefaultConfig({
    // 1. 名字 (Name)
    // 作用：这是你 DApp 的“身份证”。
    // 谁用：
    // - 用户在钱包里看到（比如连接钱包时，钱包会显示“来自 XXX 应用的连接请求”）。
    // - 钱包的连接历史记录会用这个名字。
    // - 如果你未来接入一些 WalletConnect 的服务，这个名字也会作为你的品牌出现。
    // 为什么需要：
    // - 信任：用户看到熟悉的品牌会更愿意连接。
    // - 识别：如果你的应用是多链的，用户可以通过名字快速区分。
    // 建议：改成你项目的实际名字，比如 'OurToken DApp' 或 'Foundry ERC20 Wallet'。
    appName: 'Foundry ERC20 App',
    // 2. 项目 ID (Project ID)
    // 作用：这是 RainbowKit 官方提供的“通行证”。
    // 谁用：
    // - RainbowKit 库需要它来初始化连接服务。
    // - 尤其是当你使用 WalletConnect（连接手机钱包）时，这个 ID 是必须的。
    // 为什么需要：
    // - 免费额度：RainbowKit 提供了免费的公共项目 ID，足够个人项目和学习使用。
    // - 商业限制：如果你是大型商业应用，需要处理大量用户，建议申请自己的 ID 以获得更好的服务质量和配额。
    // 建议：对于学习和个人项目，使用默认的公共 ID 即可。如果未来需要，可以去 https://www.rainbowkit.com/docs/get-a-project-id 申请自己的。
    projectId: 'YOUR_PROJECT_ID',
    // 3. 链 (Chains)
    // 作用：定义你的 DApp 支持哪些区块链网络。
    // 谁用：
    // - RainbowKit 的连接弹窗会显示这些链，让用户选择。
    // - Wagmi 的工具函数（如 useReadContract）会根据选中的链去对应的网络请求数据。
    // 为什么需要：
    // - 明确支持：告诉用户你的应用在哪些链上可用。
    // - 自动配置：Wagmi 会自动为这些链配置好连接方式（Transport）。
    // 建议：
    // - sepolia (sepolia): 测试网，开发必备。
    // - 主网 (mainnet): 生产环境。
    // - Foundry (foundry): 本地开发链，用于快速测试。
    chains: [sepolia, mainnet, foundry],
    // 4. 服务器端渲染 (SSR)
    // 作用：控制是否在服务器端预渲染页面。
    // 谁用：
    // - Next.js 等框架在生成静态页面或服务器渲染页面时会用到。
    // 为什么需要：
    // - 性能：开启 SSR 可以让首屏加载更快，因为页面内容在服务器端已经生成好了。
    // - SEO：对于公开的 DApp，SSR 有助于搜索引擎抓取内容。
    // - 兼容性：确保在不支持 JavaScript 的环境中也能显示基本内容。
    // 建议：
    // - true: 推荐用于生产环境，以获得更好的 SEO 和首屏加载性能。
    // - false: 适用于纯客户端应用或对隐私要求极高的应用。
    ssr: true,
    // 5. 传输 (Transports)
    // 作用：定义如何连接到每个区块链网络。
    // 谁用：
    // - Wagmi 的所有内部工具（如 useReadContract, useWriteContract）都会使用这些传输来发送请求。
    // 为什么需要：
    // - 节点连接：区块链数据存储在节点上。我们需要通过某种方式（传输）连接到节点来读取数据或发送交易。
    // - 性能优化：http 传输通常比 WebSocket 更稳定，适合读取操作；但对于实时监听事件（如 useWatchContractEvent），WebSocket 更优（尽管这里我们用了轮询）。
    // 建议：
    // - http(): 标准的 HTTP 请求，适用于大多数情况。
    // - [mainnet.id]: http(): 主网使用 HTTP 连接。
    // - [sepolia.id]: http(): 测试网使用 HTTP 连接。
    // - [foundry.id]: http(): 本地 Foundry 节点使用 HTTP 连接。
    //这里 http() 默认没有参数，意思是“使用公共的免费 RPC 节点”。 
    // 注意： 对于本地开发，它会自动指向 http://127.0.0.1:8545，这就是为什么它能连上您的 anvil。 
    // 如果以后上主网，这里通常要填入 Alchemy 或 Infura 的 API Key URL，否则公共节点很容易被限流。
    transports: {
        [mainnet.id]: http(),
        //Next.js 前端环境变量必须以 NEXT_PUBLIC_ 开头，否则浏览器里读不到
        [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
        [foundry.id]: http(),
    },
})
