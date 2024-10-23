import fs from "fs";
import bs58 from "bs58";
import { addTransactionalDataSource, initializeTransactionalContext, StorageDriver } from "typeorm-transactional";
import { DATASOURCE, SECURITY_PARAMS } from "./settings";
import { WalletManager } from "../src/wallet";
import { TypeormWalletRepository } from "../src/typeorm";
import { Keypair } from "@solana/web3.js";

async function main(walletName: string, secretKey: string) {
    await DATASOURCE.initialize();

    // global transaction
    initializeTransactionalContext({ storageDriver: StorageDriver.ASYNC_LOCAL_STORAGE });
    addTransactionalDataSource(DATASOURCE);

    const walletManager = new WalletManager(SECURITY_PARAMS.walletPassword, new TypeormWalletRepository(DATASOURCE, SECURITY_PARAMS.digestSalt));
    await walletManager.addWallet(walletName, secretKey);
}

const walletName = process.argv[2];
const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(process.argv[3]).toString())));
const secretKey = bs58.encode(keypair.secretKey);

main(walletName, secretKey);