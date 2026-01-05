import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, foundry } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

export const config = getDefaultConfig({
    appName: 'Foundry ERC20 App',
    projectId: 'YOUR_PROJECT_ID',
    chains: [mainnet, sepolia, foundry],
    ssr: true,
    transports: {
        [mainnet.id]: http(),
        [sepolia.id]: http(),
        [foundry.id]: http(),
    },
})
