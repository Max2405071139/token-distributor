import { v4 as uuidv4 } from 'uuid';
import { Distribution } from "../types";
import { Batch, BatchState, BatchTx } from "./types";
import { getLogger } from 'log4js';

export * from "./types";

const logger = getLogger("batch-manager");

export interface BatchRepository {
    save(batch: Batch): Promise<void>;

    getById(id: string): Promise<Batch | null>;
}

export class BatchManager {
    constructor(
        public readonly repository: BatchRepository,
    ) { }

    async createBatch(distributions: Distribution[]): Promise<string> {
        if (distributions.length == 0) {
            throw new Error("enpty distributions");
        }

        const id = uuidv4();
        const batch = new Batch(
            id,
            distributions,
            new Date(),
            BatchState.Initialized,
            null,
            null,
            null,
            null,
            null
        );

        await this.repository.save(batch);

        logger.info(`Create batch#${batch.id}# ${JSON.stringify(distributions)}`);
        return id;
    }

    async getBatchById(id: string): Promise<Batch | null> {
        return await this.repository.getById(id);
    }

    private async unsafeGetBatch(id: string): Promise<Batch> {
        const distribution = await this.repository.getById(id);
        if (distribution == null) {
            throw new Error(`Batch not found: ${id}`);
        }

        return distribution;
    }

    async processBatch(id: string, walletName: string, tx: BatchTx) {
        const batch = await this.unsafeGetBatch(id);

        batch.process(walletName, tx);
        await this.repository.save(batch);

        logger.info(`Process batch#${batch.id}# state: ${batch.state}, tx: ${tx.signature}`);
    }

    async retryBatch(id: string) {
        const batch = await this.unsafeGetBatch(id);

        const prevData = batch.retry();
        await this.repository.save(batch);

        logger.info(`Retry batch#${batch.id}# state: ${batch.state}, prevData: ${JSON.stringify(prevData)}`);
    }

    async completeBatch(id: string, message: string | null = null) {
        const batch = await this.unsafeGetBatch(id);

        if (message == null) {
            batch.succeed();
            await this.repository.save(batch);
        } else {
            batch.fail(message);
        }
        await this.repository.save(batch);

        logger.info(`Complete batch#${batch.id}# state: ${batch.state}, message: ${message}`);
    }
}