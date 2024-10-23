import { Column, DataSource, Entity, PrimaryColumn, UpdateDateColumn, VersionColumn } from "typeorm";
import { Distribution } from "../types";
import { BatchState, Batch, BatchRepository } from "../batch";
import { sha256 } from "js-sha256";
import { PublicKey } from "@solana/web3.js";

const SALT = "G^4I>L&5LHDhtMvRP#RWiOIj->KXeEb)";

@Entity("distribution_batch")
export class DistributionBatchEntity {
    @PrimaryColumn()
    id!: string;
    @Column()
    distributions!: string;
    @Column({ name: "created_at" })
    createdAt!: Date;
    @Column()
    state!: BatchState;
    @Column({ name: "wallet_name", type: "varchar" })
    walletName!: string | null;
    @Column({ name: "tx_signature", type: "varchar" })
    txSignature!: string | null;
    @Column({ name: "tx_blockhash", type: "varchar" })
    txBlockhash!: string | null;
    @Column({ name: "tx_last_valid_block_height", type: "bigint" })
    txLastValidBlockHeight!: number | null;
    @Column({ type: "varchar" })
    message!: string | null;
    @Column({ name: "processed_at", type: "datetime" })
    processedAt!: Date | null;
    @Column({ name: "completed_at", type: "datetime" })
    completedAt!: Date | null;
    @Column()
    digest!: string;
    @Column({ name: "updated_at" })
    updatedAt!: Date;
    @VersionColumn()
    version!: number;
}

export class TypeormBatchRepository implements BatchRepository {
    constructor(public readonly dataSource: DataSource, private readonly digestSalt: string) { }

    digest(entity: DistributionBatchEntity): string {
        const content =
            this.digestSalt +
            entity.id +
            entity.distributions +
            entity.state +
            entity.walletName +
            entity.txSignature +
            entity.txBlockhash +
            entity.txLastValidBlockHeight +
            entity.message +
            SALT

        return sha256(content);
    }

    async save(batch: Batch): Promise<void> {
        const entity = new DistributionBatchEntity();
        entity.id = batch.id;
        entity.distributions = JSON.stringify(batch.distributions);
        entity.createdAt = batch.createdAt;
        entity.state = batch.state;
        entity.walletName = batch.walletName;
        if (batch.tx) {
            entity.txSignature = batch.tx.signature;
            entity.txBlockhash = batch.tx.blockhash;
            entity.txLastValidBlockHeight = batch.tx.lastValidBlockHeight;
        } else {
            entity.txSignature = null;
            entity.txBlockhash = null;
            entity.txLastValidBlockHeight = null;
        }
        entity.message = batch.message;
        entity.processedAt = batch.processedAt;
        entity.completedAt = batch.completedAt;
        entity.digest = this.digest(entity);
        entity.updatedAt = new Date();

        const repository = this.dataSource.getRepository(DistributionBatchEntity);
        await repository.save(entity);
    }

    async getById(id: string): Promise<Batch | null> {
        const repository = this.dataSource.getRepository(DistributionBatchEntity);

        const entity = await repository.findOneBy({ id });
        if (entity == null) {
            return null;
        }

        const expectDigest = this.digest(entity);
        if (entity.digest != expectDigest) {
            throw new Error("data corruption");
        }

        const distributions: Distribution[] =
            (JSON.parse(entity.distributions) as any[])
                .map((o) => {
                    return {
                        id: o.id,
                        recipient: new PublicKey(o.recipient),
                        amount: Number(o.amount)
                    }
                });


        return new Batch(
            entity.id,
            distributions,
            entity.createdAt,
            entity.state,
            entity.walletName,
            entity.txSignature ? { signature: entity.txSignature!, blockhash: entity.txBlockhash!, lastValidBlockHeight: entity.txLastValidBlockHeight! } : null,
            entity.message,
            entity.processedAt,
            entity.completedAt
        );
    }

}