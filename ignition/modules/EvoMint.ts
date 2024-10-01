import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const EvoMintModule = buildModule("EvoMintModule", (m) => {
    const evoMint = m.contract('EvoMint');

    return { evoMint };
})

export default EvoMintModule;