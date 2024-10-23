import { addTransactionalDataSource, initializeTransactionalContext, StorageDriver } from "typeorm-transactional";
import { Distributor } from "../src";
import { DistributionProviderTestOnly } from "./provider";
import { CONNECTION, DATASOURCE, SECURITY_PARAMS, THE_MINT } from "./settings";

async function main() {
    await DATASOURCE.initialize();

    // global transaction
    initializeTransactionalContext({ storageDriver: StorageDriver.ASYNC_LOCAL_STORAGE });
    addTransactionalDataSource(DATASOURCE);

    const distributor = new Distributor(
        THE_MINT,
        DATASOURCE,
        CONNECTION,
        new DistributionProviderTestOnly(DATASOURCE),
        SECURITY_PARAMS
    );

    distributor.launch({ constructInterval: 5000, processInterval: 5000, completeInterval: 30000 });
}

main()