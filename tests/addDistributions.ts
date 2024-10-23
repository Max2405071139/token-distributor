import { v4 as uuidv4 } from 'uuid';
import { addTransactionalDataSource, initializeTransactionalContext, StorageDriver } from "typeorm-transactional";
import { DATASOURCE } from "./settings";
import { Keypair } from "@solana/web3.js";
import { DistributionEntity, DistributionState } from "./provider";

async function main(count: number) {
    await DATASOURCE.initialize();

    // global transaction
    initializeTransactionalContext({ storageDriver: StorageDriver.ASYNC_LOCAL_STORAGE });
    addTransactionalDataSource(DATASOURCE);

    const repository = DATASOURCE.getRepository(DistributionEntity); 
    for (let i = 0; i < count; i++) {
        const recipient = Keypair.generate().publicKey;

        const entity = new DistributionEntity();
        entity.id = uuidv4();
        entity.recipient = recipient.toString();
        entity.amount = 10000000000; // 10
        entity.state = DistributionState.Initialized;
        entity.createdAt = new Date();
        entity.updatedAt = entity.createdAt;

        await repository.save(entity);
    }
}

const count = Number(process.argv[2]);

main(count);