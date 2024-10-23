import { Entity, PrimaryColumn, Column, DataSource, In, VersionColumn } from "typeorm";
import { Distribution, DistributionProvider } from "../src/types";
import { PublicKey } from "@solana/web3.js";

/// Test only

export const enum DistributionState {
    Initialized = "Initialized",
    Processing = "Processing",
    Completed = "Completed",
}

@Entity("distributions")
export class DistributionEntity {
    @PrimaryColumn()
    id!: string;
    @Column()
    recipient!: string;
    @Column()
    amount!: number;
    @Column()
    state!: DistributionState;
    @Column({ name: "tx_id" })
    txId!: string;
    @Column({ name: "created_at" })
    createdAt!: Date;
    @Column({ name: "updated_at" })
    updatedAt!: Date;
    @VersionColumn()
    version!: number;
}

export class DistributionProviderTestOnly implements DistributionProvider {
    constructor(private readonly dataSource: DataSource) {
    }

    async fetch(limit: number): Promise<Distribution[]> {
        const repository = this.dataSource.getRepository(DistributionEntity);
        const entities = await repository.find({
            where: {
                state: DistributionState.Initialized,
            },
            order: {
                createdAt: "ASC",
            },
            take: limit,
        });

        // update state to processing 
        this.dataSource.createQueryBuilder()
            .update(DistributionEntity)
            .set({ state: DistributionState.Processing })
            .where({ id: In(entities.map((entity) => entity.id)), state: DistributionState.Initialized })
            .execute();

        return entities.map((entity) => {
            return {
                id: entity.id,
                recipient: new PublicKey(entity.recipient),
                amount: entity.amount
            }
        })
    }

    async onReturned(distributions: Distribution[]): Promise<void> {
        // update state from processing to initialized 
        this.dataSource.createQueryBuilder()
            .update(DistributionEntity)
            .set({ state: DistributionState.Initialized })
            .where({ id: In(distributions.map((d) => d.id)), state: DistributionState.Processing })
            .execute();
    }

    async onCompleted(distributions: Distribution[], txId: string): Promise<void> {
        // update state from processing to completed 
        this.dataSource.createQueryBuilder()
            .update(DistributionEntity)
            .set({ state: DistributionState.Completed, txId, })
            .where({ id: In(distributions.map((d) => d.id)), state: DistributionState.Processing })
            .execute();
    }

}