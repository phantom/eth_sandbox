/**
 * @DEV: If the sandbox is throwing dependency errors, chances are you need to clear your browser history.
 * This will trigger a re-install of the dependencies in the sandbox – which should fix things right up.
 * Alternatively, you can fork this sandbox to refresh the dependencies manually.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';

import { getProvider, sendTransaction } from './utils';

import { TLog, Web3Provider } from './types';

import { Logs, Sidebar, NoProvider } from './components';

// =============================================================================
// Styled Components
// =============================================================================

const StyledApp = styled.div`
  display: flex;
  flex-direction: row;
  height: 100vh;
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

// =============================================================================
// Constants
// =============================================================================

declare global {
  interface Window {
    ethereum: any
  }
}
let accounts = [];
const message = 'To avoid digital dognappers...';
const sleep = (timeInMS) => new Promise((resolve) => setTimeout(resolve, timeInMS));
  const NETWORKS = {
  ethereum: {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.infura.io/v3/'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  polygon: {
    chainId: '0x89',
    chainName: 'Polygon Mainnet',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  sepolia: {
    chainId: '0xaa36a7',
    chainName: 'Sepolia Testnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.sepolia.org'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  mumbai: {
    chainId: '0x13881',
    chainName: 'Polygon Mumbai Testnet',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://rpc-mumbai.maticvigil.com'],
    blockExplorerUrls: ['https://mumbai.polygonscan.com'],
  },
};

// =============================================================================
// Typedefs
// =============================================================================

export type ConnectedMethods =
  | {
      name: string;
      onClick: () => Promise<string>;
    }
  | {
      name: string;
      onClick: () => Promise<void>;
    };

interface Props {
  address: string | null;
  connectedMethods: ConnectedMethods[];
  handleConnect: () => Promise<void>;
  provider: Web3Provider;
  logs: TLog[];
  clearLogs: () => void;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * @DEVELOPERS
 * The fun stuff!
 */
const useProps = (): Props => {
  const [provider, setProvider] = useState<Web3Provider | null>(null);
  const [logs, setLogs] = useState<TLog[]>([]);

  const createLog = useCallback(
    (log: TLog) => {
      return setLogs((logs) => [...logs, log]);
    },
    [setLogs]
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, [setLogs]);

  useEffect(() => {
    (async () => {
      // sleep for 100 ms to give time to inject
      await sleep(100);
      setProvider(getProvider());
    })();
  }, []);

  useEffect(() => {
    if (!provider) return;

    window.ethereum.on('connect', (connectionInfo: { chainId: string }) => {
      createLog({
        status: 'success',
        method: 'connect',
        message: `Connected to chain: ${connectionInfo.chainId}`,
      });
    });

    window.ethereum.on('disconnect', () => {
      createLog({
        status: 'warning',
        method: 'disconnect',
        message: 'lost connection to the rpc',
      });
    });

    window.ethereum.on('accountsChanged', (newAccounts: String[]) => {
      if (newAccounts) {
        createLog({
          status: 'info',
          method: 'accountChanged',
          message: `Switched to account: ${newAccounts}`,
        });
        accounts = newAccounts;
      } else {
        /**
         * In this case dApps could...
         *
         * 1. Not do anything
         * 2. Only re-connect to the new account if it is trusted
         *
         * ```
         * provider.send('eth_requestAccounts', []).catch((err) => {
         *  // fail silently
         * });
         * ```
         *
         * 3. Always attempt to reconnect
         */

        createLog({
          status: 'info',
          method: 'accountChanged',
          message: 'Attempting to switch accounts.',
        });

        provider.send('eth_requestAccounts', []).catch((error) => {
          createLog({
            status: 'error',
            method: 'accountChanged',
            message: `Failed to re-connect: ${error.message}`,
          });
        });
      }
    });
  }, [provider, createLog]);

  /** eth_sendTransaction */
  const handleEthSendTransaction = useCallback(async () => {
    if (!provider) return;

    try {
      // send the transaction up to the network
      const transaction = await sendTransaction(provider);
      createLog({
        status: 'info',
        method: 'eth_sendTransaction',
        message: `Sending transaction: ${JSON.stringify(transaction)}`,
      });
      try {
        // wait for the transaction to be included in the next block
        const txReceipt = await transaction.wait(1); // 1 is number of blocks to be confirmed before returning the receipt
        createLog({
          status: 'success',
          method: 'eth_sendTransaction',
          message: `TX included: ${JSON.stringify(txReceipt)}`,
        });
      } catch (error) {
        // log out if the tx didn't get included for some reason
        createLog({
          status: 'error',
          method: 'eth_sendTransaction',
          message: `Failed to include transaction on the chain: ${error.message}`,
        });
      }
    } catch (error) {
      createLog({
        status: 'error',
        method: 'eth_sendTransaction',
        message: error.message,
      });
    }
  }, [provider, createLog]);

  /** SignMessage */
  const handleSignMessage = useCallback(async () => {
    if (!provider) return;
    try {
      const signer = provider.getSigner();
      const signature = await signer.signMessage(message);
      createLog({
        status: 'success',
        method: 'signMessage',
        message: `Message signed: ${JSON.stringify(signature)}`,
      });
      return signature;
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signMessage',
        message: error.message,
      });
    }
  }, [provider, createLog]);

  const handleSwitchNetwork = useCallback(async (networkKey: string) => {
  if (!provider) return;
  const network = NETWORKS[networkKey];
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: network.chainId }],
    });
    createLog({
      status: 'success',
      method: 'eth_sendTransaction',
      message: `Switched to ${network.chainName}!`,
    });
  } catch (error) {
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [network],
        });
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: network.chainId }],
        });
        createLog({
          status: 'success',
          method: 'eth_sendTransaction',
          message: `${network.chainName} added and switched successfully!`,
        });
      } catch (addError: any) {
        createLog({
          status: 'error',
          method: 'eth_sendTransaction',
          message: addError.message,
        });
      }
    } else {
      createLog({
        status: 'error',
        method: 'eth_sendTransaction',
        message: error.message,
      });
    }
  }
}, [provider, createLog]);
  /** Connect */
  const handleConnect = useCallback(async () => {
    if (!provider) return;

    try {
      accounts = await provider.send('eth_requestAccounts', []);
      createLog({
        status: 'success',
        method: 'connect',
        message: `connected to account: ${accounts[0]}`,
      });
    } catch (error) {
      createLog({
        status: 'error',
        method: 'connect',
        message: error.message,
      });
    }
  }, [provider, createLog, accounts]);

  const connectedMethods = useMemo(() => {
  return [
    {
      name: 'Send Transaction',
      onClick: handleEthSendTransaction,
    },
    {
      name: 'Sign Message',
      onClick: handleSignMessage,
    },
    {
      name: 'Reconnect',
      onClick: handleConnect,
    },
    {
      name: 'Switch to Ethereum',
      onClick: () => handleSwitchNetwork('ethereum'),
    },
    {
      name: 'Switch to Polygon',
      onClick: () => handleSwitchNetwork('polygon'),
    },
    {
      name: 'Switch to Sepolia',
      onClick: () => handleSwitchNetwork('sepolia'),
    },
    {
      name: 'Switch to Mumbai',
      onClick: () => handleSwitchNetwork('mumbai'),
    },
  ];
}, [handleEthSendTransaction, handleSignMessage, handleConnect, handleSwitchNetwork]);
  return {
    address: accounts[0],
    connectedMethods,
    handleConnect,
    provider,
    logs,
    clearLogs,
  };
};

// =============================================================================
// Stateless Component
// =============================================================================

const StatelessApp = React.memo((props: Props) => {
  const { address, connectedMethods, handleConnect, logs, clearLogs } = props;

  return (
    <StyledApp>
      <Sidebar address={address} connectedMethods={connectedMethods} connect={handleConnect} />
      <Logs address={address} logs={logs} clearLogs={clearLogs} />
    </StyledApp>
  );
});

// =============================================================================
// Main Component
// =============================================================================

const App = () => {
  const props = useProps();

  if (!props.provider) {
    return <NoProvider />;
  }

  return <StatelessApp {...props} />;
};

export default App;
