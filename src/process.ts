import { createAssociatedTokenAccountInstruction, createTransferInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Distribution, DistributionProvider } from "./types";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, TransactionSignature } from "@solana/web3.js";
import { Batch, BatchManager, BatchState } from "./batch";
import { getLogger } from "log4js";
import { DataSource } from "typeorm";
import { Transactional } from "typeorm-transactional";
import bs58 from "bs58";
import { AxiosError } from "axios";
import { DistributionBatchEntity } from "./typeorm";
import { Wallet, WalletManager } from "./wallet";

const logger = getLogger("distribution-batch-manager");
const FAKE_WALLET = Keypair.generate().publicKey;
const FAKE_RECENT_BLOCK_HASH = "qRCC8APEc3nDL6YddF9fyEv7ZyPXVdqgNUMg33EAeBJ";

// Size of signatures in transaction: length(compact-u16) + 64 * signatures count）
// signatures count is 2, payer and vaultOwner
export const TX_SIGNATURES_SIZE = 3 + 64 * 2;
export const TX_MAX_MESSAGE_SIZE = 1232 - TX_SIGNATURES_SIZE;

export class DistributionProcess {
    constructor(
        public readonly mint: PublicKey,
        public readonly connection: Connection,
        public readonly dataSource: DataSource,
        public readonly distributionProvider: DistributionProvider,
        public readonly walletManager: WalletManager,
        public readonly batchManager: BatchManager,
    ) {
    }

    async constructBatches() {
        logger.info("constructBatches: starts to work")
        while (true) {
            let count: number;
            try {
                count = await this.constructOneBatch();
            } catch (e) {
                logger.error(e);
                break;
            }

            if (count == 0) {
                break;
            }
            logger.info(`Created new batch with ${count} distributions inside`);
        }
        logger.info("constructBatches: ends work")
    }

    @Transactional()
    private async constructOneBatch(): Promise<number> {
        const transaction = new Transaction();
        transaction.recentBlockhash = FAKE_RECENT_BLOCK_HASH;
        transaction.feePayer = FAKE_WALLET;

        const distributions = await this.distributionProvider.fetch(19);
        const choosed: Distribution[] = [];
        while (distributions.length > 0) {
            const distribution = distributions.pop()!;

            const instructions: TransactionInstruction[] = [];
            const recipientTokenAccount = getAssociatedTokenAddressSync(this.mint, distribution.recipient);
            // if ata not exists
            if ((await this.connection.getAccountInfo(recipientTokenAccount, "processed")) == null) {
                instructions.push(createAssociatedTokenAccountInstruction(FAKE_WALLET, recipientTokenAccount, distribution.recipient, this.mint));
            }

            // transfer 
            const vault = getAssociatedTokenAddressSync(this.mint, FAKE_WALLET);
            instructions.push(createTransferInstruction(vault, recipientTokenAccount, FAKE_WALLET, distribution.amount));

            if (!this.safeAddInstruction(transaction, instructions)) {
                // push back to array
                distributions.push(distribution);
                break;
            }

            choosed.push(distribution);
        }

        // return remains distributions.
        if (distributions.length != 0) {
            await this.distributionProvider.onReturned(distributions);
        }

        if (choosed.length != 0) {
            await this.batchManager.createBatch(choosed);
        }

        return choosed.length;
    }

    private safeAddInstruction(transaction: Transaction, instructions: TransactionInstruction[]): boolean {
        const tempTransaction = new Transaction();
        tempTransaction.recentBlockhash = transaction.recentBlockhash;
        tempTransaction.feePayer = transaction.feePayer;
        tempTransaction.instructions = [...transaction.instructions];
        tempTransaction.add(...instructions);

        let messageData: Buffer;
        let errorHappens = false;
        try {
            messageData = tempTransaction.serializeMessage();
        } catch (e) {
            errorHappens = true;
        }

        if (errorHappens || messageData!.length > TX_MAX_MESSAGE_SIZE) {
            return false;
        }

        transaction.add(...instructions);
        return true;
    }

    async processBatches() {
        const repository = this.dataSource.getRepository(DistributionBatchEntity);
        const entities = await repository.find({
            where: {
                state: BatchState.Initialized,
            },
            order: {
                createdAt: "ASC",
            }
        });

        logger.info(`Found ${entities.length} initialized batches`);

        for (let entity of entities) {
            const batch = await this.batchManager.getBatchById(entity.id);
            try {
                await this.processOneBatch(batch!);
            } catch (e) {
                logger.error(e);
            }
        }
    }

    @Transactional()
    private async processOneBatch(batch: Batch) {
        const wallet = await this.getRandomWallet();
        const transaction = new Transaction();
        for (let distribution of batch.distributions) {
            const recipient = distribution.recipient;
            const recipientTokenAccount = getAssociatedTokenAddressSync(this.mint, recipient);
            // if ata not exists
            if ((await this.connection.getAccountInfo(recipientTokenAccount, "processed")) == null) {
                transaction.add(createAssociatedTokenAccountInstruction(wallet.address, recipientTokenAccount, recipient, this.mint));
            }

            // transfer 
            const vault = getAssociatedTokenAddressSync(this.mint, wallet.address);
            transaction.add(createTransferInstruction(vault, recipientTokenAccount, wallet.address, distribution.amount));
        }

        const recentBlockhash = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = recentBlockhash.blockhash;
        transaction.feePayer = wallet.address;

        // sign
        await this.walletManager.signTransaction([wallet.name], transaction);

        // first signature is used as transaction id
        const txId = bs58.encode((transaction as Transaction).signature!);
        // update batch state to processing
        await this.batchManager.processBatch(batch.id!, wallet.name, { signature: txId, ...recentBlockhash });

        // if exceeds max transaction size, fail the batch.
        let transactionData;
        try {
            transactionData = transaction.serialize();
        } catch (e) {
            logger.error(`Batch# ${batch.id} # serialize transaction failed: ${e}`);
            await this.failBatch(batch, String(e));
            return;
        }

        let signature: TransactionSignature;
        // send
        try {
            signature = await this.connection.sendRawTransaction(transactionData, { skipPreflight: false, maxRetries: 0 });
        } catch (e) {
            // we don't know whether the tranaction has been sent to the server
            if (e instanceof AxiosError && e.message.includes("timeout")) {
                logger.error(`Batch# ${batch.id} # sendRawTransaction timeout: ${e}`);
                return;
            }

            await this.failBatch(batch, String(e));

            logger.error(`Batch# ${batch.id} # send transaction failed: ${e}`);
            return;
        }

        if (txId !== signature) {
            throw new Error(`Transaction signature mismatch, expect: ${txId}, got: ${signature}`);
        }

        logger.info(`Batch# ${batch.id} # send transaction successfully`);
    }

    private async getRandomWallet(): Promise<Wallet> {
        const wallets = await this.walletManager.getAll();
        if (wallets.length == 0) {
            throw Error("No wallets found");
        }

        return wallets.length == 1 ? wallets[0] : wallets[Math.floor(Math.random() * wallets.length)];
    }

    async completeBatches() {
        const repository = this.dataSource.getRepository(DistributionBatchEntity);
        const entities = await repository.find({
            where: {
                state: BatchState.Processing,
            },
            order: {
                processedAt: "ASC",
            }
        });

        logger.info(`Found ${entities.length} processing batches`);

        for (let entity of entities) {
            const batch = await this.batchManager.getBatchById(entity.id);
            try {
                await this.completeOneBatch(batch!);
            } catch (e) {
                logger.error(e);
            }
        }
    }

    @Transactional()
    private async completeOneBatch(batch: Batch) {
        logger.info(`Batch# ${batch.id} # check transaction status`);

        const { signature, lastValidBlockHeight } = batch.tx!;
        const result = await this.connection.getSignatureStatus(signature);

        const status = result.value;
        if (status == null) {
            const hashExpired = await this.isBlockhashExpired(lastValidBlockHeight);
            // if expired, retry later
            if (hashExpired) {
                logger.info(`Batch# ${batch.id} # transaction is expired, retry later`);

                // complete first
                await this.batchManager.completeBatch(batch.id!, "expired: block height exceeded");
                // retry later 
                await this.batchManager.retryBatch(batch.id!);
            } else {
                // else, check later
                logger.info(`Batch# ${batch.id} # transaction is in unknown status`);
            }

            return;
        }

        if (status.err != null) {
            logger.info(`Batch# ${batch.id} # failed with error: ${status.err}`);
            await this.failBatch(batch, String(status.err));
            return;
        }

        // if status if processed or confirmed, check later
        if (status.confirmationStatus !== 'finalized') {
            logger.info(`Batch# ${batch.id} # transaction is processed or confirmed`);
            return;
        }

        // now the status is finalized
        logger.info(`Batch# ${batch.id} # transaction is finalized`);
        await this.succeedBatch(batch, signature);
    }

    private async failBatch(batch: Batch, message: string) {
        await this.batchManager.completeBatch(batch.id, message);
        await this.distributionProvider.onReturned(batch.distributions);
    }

    private async succeedBatch(batch: Batch, signature: string) {
        await this.batchManager.completeBatch(batch.id);
        await this.distributionProvider.onCompleted(batch.distributions, signature);
    }

    async isBlockhashExpired(lastValidBlockHeight: number) {
        let currentBlockHeight = (await this.connection.getBlockHeight('finalized'));
        return (currentBlockHeight > lastValidBlockHeight);
    }
}