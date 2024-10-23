import { Connection, PublicKey } from "@solana/web3.js";
import { DistributionProvider } from "./types";
import { DataSource } from "typeorm";
import { DistributionBatchEntity, TypeormBatchRepository, TypeormWalletRepository, WalletEntity } from "./typeorm";
import { DistributionProcess } from "./process";
import { WalletManager } from "./wallet";
import { BatchManager } from "./batch";

export const TYPEORM_ENTITIES = [DistributionBatchEntity, WalletEntity];

export type SecurityParams = {
    readonly walletPassword: string
    readonly digestSalt: string
}

export class Distributor {
    private readonly process: DistributionProcess;
    constructor(
        public readonly mint: PublicKey,
        public readonly dataSource: DataSource,
        public readonly connection: Connection,
        public readonly provider: DistributionProvider,
        public readonly securityParams: SecurityParams,
    ) {
        this.process = new DistributionProcess(
            mint,
            connection,
            dataSource,
            provider,
            new WalletManager(securityParams.walletPassword, new TypeormWalletRepository(dataSource, securityParams.digestSalt)),
            new BatchManager(new TypeormBatchRepository(dataSource, securityParams.digestSalt))
        )
    }

    async launch(params: { constructInterval: number, processInterval: number, completeInterval: number }) {
        // task 1: construct batches periodically
        runInterval(async () => {
            await this.process.constructBatches();
        }, params.constructInterval)

        // task 2: process initialized batches periodically
        runInterval(async () => {
            await this.process.processBatches();
        }, params.processInterval)

        // task 3: complete processing batches periodically
        runInterval(async () => {
            await this.process.completeBatches();
        }, params.completeInterval)
    }
}

async function runInterval(func: (...args: any[]) => Promise<void>, ms: number, ...args: any[]) {
    setTimeout(async () => {
        try {
            await func(args)
        } catch (e) {
            console.error(e);
        }
        runInterval(func, ms, args);
    }, ms)
}