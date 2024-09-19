const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = require("hardhat");

const {
  USDC,
  DAI,
  ROUTER_ADDRESS,
  FACTORY_ADDRESS,
  constants,
} = require("../scripts");

describe("EvoMint", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployEvoMint() {
    const [owner] = await hre.ethers.getSigners();

    const { ROUTER, V2_FACTORY, impersonatedSigner, WETH } = await constants();

    const EvoMint = await hre.ethers.getContractFactory("EvoMint");
    const evoMint = await EvoMint.deploy(ROUTER_ADDRESS, FACTORY_ADDRESS);

    return { evoMint, owner, WETH, ROUTER, V2_FACTORY, impersonatedSigner };
  }

  async function _createPairAndAddLiquidity() {
    const { evoMint, owner, impersonatedSigner } = await loadFixture(
      deployEvoMint
    );

    console.log(ethers.formatUnits(await evoMint.balanceOf(owner)));

    const transferAmount = ethers.parseUnits("30000", 18);
    const emTransferTx = await evoMint.transfer(
      impersonatedSigner.address,
      transferAmount
    );

    console.log(
      ethers.formatUnits(await evoMint.balanceOf(impersonatedSigner.address))
    );

    const amountIn = ethers.parseUnits("20000", 18);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

    await evoMint
      .connect(impersonatedSigner)
      .approve(evoMint.getAddress(), amountIn);

    await evoMint.createTokenWethPair();

    await evoMint
      .connect(impersonatedSigner)
      .addLiquidity(amountIn, amountIn / BigInt(3), 0, deadline, {
        value: ethers.parseEther("10"),
      });
  }

  describe("Deployment EvoMint", function () {
    it("Should set the right router and factory address", async function () {
      const { evoMint } = await loadFixture(deployEvoMint);

      expect(await evoMint.v2Router()).to.equal(ROUTER_ADDRESS);
      expect(await evoMint.v2Factory()).to.equal(FACTORY_ADDRESS);
      expect(await evoMint.name()).to.equal("EvoMint");
      expect(await evoMint.symbol()).to.equal("EVT");
    });
  });

  describe("swap EvoMint Tokens For ETH", function () {
    it("revert if minting is before 30 after previous mint", async function () {
      const { evoMint, owner } = await loadFixture(deployEvoMint);

      console.log(ethers.formatUnits(await evoMint.balanceOf(owner)));

      const mintAmount = ethers.parseUnits("50000", 18);

      expect(evoMint.mint(mintAmount)).to.be.revertedWithCustomError(
        evoMint,
        "YouCanOnlyMintOnceEvery30Days"
      );
    });

    it("mint succesfully after 30 days from first mint", async function () {
      const { evoMint, owner } = await loadFixture(deployEvoMint);

      await time.increase(100000000000);

      const prevBal = await evoMint.balanceOf(owner);

      const mintAmount = ethers.parseUnits("50000", 18);
      const mintTx = await evoMint.mint(mintAmount);
      await mintTx.wait();

      const nextBal = await evoMint.balanceOf(owner);
      expect(nextBal).to.equal(prevBal + mintAmount);
    });

    it("create pair and add liquidity to pair", async function () {
        await _createPairAndAddLiquidity();
    });

    it("Should swap evomint tokens for eth", async function () {
      const { evoMint, owner, ROUTER, WETH, impersonatedSigner } =
        await loadFixture(deployEvoMint);

      await _createPairAndAddLiquidity();

      console.log(ethers.formatUnits(await evoMint.balanceOf(owner)));

      const transferAmount = ethers.parseUnits("30000", 18);
      const emTransferTx = await evoMint.transfer(
        impersonatedSigner.address,
        transferAmount
      );

      console.log(
        ethers.formatUnits(await evoMint.balanceOf(impersonatedSigner.address))
      );

      const amountIn = ethers.parseUnits("20000", 18);
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

      await evoMint
        .connect(impersonatedSigner)
        .approve(evoMint.getAddress(), amountIn);

      const tx = await evoMint
        .connect(impersonatedSigner)
        .swapTokensForEth(
          amountIn,
          0,
          [evoMint.getAddress(), WETH],
          impersonatedSigner.address,
          deadline
        );

      tx.wait();
    });
  });

  describe("pause and unpause", function() {
    it("should pause if not paused", async function() {
      const { evoMint, owner } = await loadFixture(deployEvoMint);

      expect(await evoMint.pause()).to.emit(evoMint, "Paused").withArgs(owner);
    })

    it("should revert with error if paused when calling pause", async function() {
      const { evoMint } = await loadFixture(deployEvoMint);

      await evoMint.pause();

      expect(evoMint.pause()).to.be.revertedWithCustomError(evoMint, "EnforcedPause")
    })

    it("should unpause if paused", async function() {
      const { evoMint, owner } = await loadFixture(deployEvoMint);
      
      await evoMint.pause();

      expect(await evoMint.unpause()).to.emit(evoMint, "Unpaused").withArgs(owner);
    })

    it("should revert with error if unpaused when calling unpause", async function() {
      const { evoMint } = await loadFixture(deployEvoMint);

      expect(evoMint.unpause()).to.be.revertedWithCustomError(evoMint, "ExpectedPause")
    })
  })

  describe("burn", function() {
    it("should burn tokens if less than supply", async function() {
      const { evoMint, owner } = await loadFixture(deployEvoMint);

      const amountToBurn = ethers.parseUnits("500", 18);

      expect(await evoMint.burn(amountToBurn)).to.emit(evoMint, "Transfer").withArgs(owner, ethers.ZeroAddress, amountToBurn);
    })
  })
});
