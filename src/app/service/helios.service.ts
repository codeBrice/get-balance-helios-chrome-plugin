import { Injectable } from '@angular/core';
import Web3 from 'helios-web3';
import * as Utils from 'web3-utils';
import {formatters} from 'web3-core-helpers';
import { promise } from 'protractor';
import { Transaction } from '../entities/transaction';


@Injectable({
  providedIn: 'root'
})
export class HeliosService {
  private web3: any;

  private availableNodes: any[] = [
    'wss://bootnode.heliosprotocol.io:30304',
    'wss://bootnode2.heliosprotocol.io:30304',
    'wss://bootnode3.heliosprotocol.io:30304',
    'wss://masternode1.heliosprotocol.io:30304'
  ];

  constructor() { }

  /**
   * Gets balance
   * @param address  example : 0x9c8b20E830c0Db83862892Fc141808eA6a51FEa2
   * @returns  balance string
   */
  async getBalance(address: string) {
    try {
      console.log('getBalance');
      if (await this.isConnected()) {
        const hls = await this.web3.hls.getBalance(address);
        const balance = parseFloat(this.web3.utils.fromWei(String(this.web3.utils.toBN(hls)))).toFixed(2);
        console.log(balance);
        return balance;
      }
    } catch (error) {
      console.log(error);
      throw new Error('Failed to get balance');
    }
  }

    /**
   * Determines whether connected is node
   * @returns  boolean
   */
  private async isConnected() {
    try {
      if (this.web3 && !(this.web3.currentProvider == null || !this.web3.currentProvider.connected)) {
        return true;
      } else {
        const connect = await this.connectToFirstAvailableNode();
        return connect;
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Connects to first available node.
   * @returns  true : Successfully connected  or Error Failed to connect.
   */
  async connectToFirstAvailableNode() {
    console.log(`connectToFirstAvailableNode`);
    try {
      if (this.web3 && !(this.web3.currentProvider == null || !this.web3.currentProvider.connected)) {
        return true;
      } else {
        for (const node of this.availableNodes) {
            console.log(`Connecting to node ${node}`);
            this.web3 = new Web3(new Web3.providers.WebsocketProvider(node));
            // this.web3.extend(this.methods);
            // console.log(this.web3);
            try {
              const listen = await this.web3.eth.net.isListening();
              // await this.web3.eth.net.getPeerCount();
              if (this.isConnected() || listen) {
                  console.log(`Successfully connected to ${node}`);
                  return true;
              }
            } catch ( error ) {
              console.log(`Failed connected to ${node}`);
            }
            // console.log( ' listening: ' + isListening.toString() + ' with ' + numPeers + ' peers');
        }
        throw new Error('Failed to connect to nodes');
      }
    } catch (error) {
      throw error;
    }
  }

  async getAllTransactions(address: string, startDate, endDate, startIndex, length) {
    try {
      console.log('getAllTransactions');

      if (await this.isConnected()) {

        if (!(startIndex || false)) {
          startIndex = 0;
        }

        if (!(length || false)) {
            length = 10;
        }

        let startBlockNumber = await this.web3.hls.getBlockNumber(address, startDate);

        startBlockNumber = startBlockNumber - startIndex;
        let endBlockNumber = startBlockNumber - length;
        if (endBlockNumber < 0) {
          endBlockNumber = 0;
        }
        // console.log(startBlockNumber);
        const output = [];
        const blocksPromise = [];
        for (let i = startBlockNumber; i >= endBlockNumber; i--) {
           // console.log('Getting all transactions at block number ' + i);
           blocksPromise.push(new Promise(async (resolve, reject) => {
            try {
              const newBlock = await this.web3.hls.getBlockByNumber(i, address, true);
              // console.log(newBlock);
              // comentado por que se creo en promesa
              if (newBlock.timestamp > startDate) {
               return;
              }
              /* if (newBlock.timestamp > endDate) {
                return;
              } */
              if (newBlock.transactions.length > 0) {
                 for (const transactionBlock of newBlock.transactions) {
                     const tx = transactionBlock;
                     output.push(new Transaction(newBlock.timestamp, 'Send transaction',
                       formatters.outputBigNumberFormatter(this.web3.utils.toBN(tx.value).mul(this.web3.utils.toBN(-1))),
                       formatters.outputBigNumberFormatter(this.web3.utils.toBN(tx.gasUsed)
                         .mul(this.web3.utils.toBN(tx.gasPrice)).mul(this.web3.utils.toBN(-1))),
                       tx.to, address, formatters.outputBigNumberFormatter(newBlock.accountBalance), newBlock.number));
                 }
              }
              if (newBlock.receiveTransactions.length > 0) {
                 for (const receiveTransactions of newBlock.receiveTransactions) {
                     const tx = receiveTransactions;
                     let description;
                     if (tx.isRefund) {
                         description = 'Refund transaction';
                     } else {
                         description = 'Receive transaction';
                     }
                     output.push(new Transaction(newBlock.timestamp, description,
                       formatters.outputBigNumberFormatter(tx.value),
                       formatters.outputBigNumberFormatter(this.web3.utils.toBN(tx.gasUsed)
                         .mul(this.web3.utils.toBN(tx.gasPrice)).mul(this.web3.utils.toBN(-1))),
                       address, tx.from, formatters.outputBigNumberFormatter(newBlock.accountBalance), newBlock.number));
                 }
              }
              if (parseFloat(newBlock.rewardBundle.rewardType2.amount.substring('2')) !== parseFloat('0')) {
               if (formatters.outputBigNumberFormatter(newBlock.rewardBundle.rewardType2.amount) > 0) {
                 output.push(new Transaction(newBlock.timestamp, 'Reward type 2',
                 formatters.outputBigNumberFormatter(newBlock.rewardBundle.rewardType2.amount), 0, address, 'Coinbase',
                 formatters.outputBigNumberFormatter(newBlock.accountBalance), newBlock.number));
               }
              }
              resolve();
            } catch (error) {
             console.log(error, {block: i , address});
             reject(error);
            }
           }));
        }
        const promisesResult = await Promise.all(blocksPromise);
        output.map( data  => {
          data.value = parseFloat(this.web3.utils.fromWei(String(this.web3.utils.toBN(data.value)))).toFixed(2);
          data.balance = parseFloat(this.web3.utils.fromWei(String(this.web3.utils.toBN(data.balance)))).toFixed(2);
          data.gasCost = parseFloat(this.web3.utils.fromWei(String(this.web3.utils.toBN(data.gasCost)))).toFixed(2);
        });
        return output;
      }
    } catch (error) {
      console.log(error);
      try {
        if (JSON.parse(error.message.replace('Returned error: ', '')).error === 'No canonical head set for this chain') {
          return [];
        }
      } catch (error) {
        throw new Error('Failed to get All Transactions');
      }
      throw new Error('Failed to get All Transactions');
    }
  }
}
