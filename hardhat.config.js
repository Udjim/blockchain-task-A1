/**
 * @type import('hardhat/config').HardhatUserConfig
 */

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require('@openzeppelin/hardhat-upgrades');
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("@nomicfoundation/hardhat-network-helpers");
require("hardhat-tracer");

require("dotenv").config();

const CUSTOM_RPC_URL = process.env.CUSTOM_RPC_URL || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {},
        custom: {
            url: CUSTOM_RPC_URL,
            accounts: [PRIVATE_KEY],
            saveDeployments: true,
        },
        bnb: {
           url: CUSTOM_RPC_URL,
           accounts: [PRIVATE_KEY]
        }
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY
    },
    solidity: {
        compilers: [
            {
                version: "0.8.9",
            },
            {
                version: "0.8.4",
            },
            {
                version: "0.8.0",
            },
        ],
        settings: {
           optimizer: {
             runs: 200,
             enabled: true
           }
         }
    },
    mocha: {
        timeout: 100000,
    },

    gasReporter: {
       enabled: false,
       gasPrice: 10,
       currency: 'USD',
       coinmarketcap: '2f0fe43a-0f3d-40a6-8558-ddd3625bfd6b',
   },
};
