import { PublicKey } from "@solana/web3.js"

export type Distribution = {
    readonly id: string,
    readonly recipient: PublicKey,
    readonly amount: number,
}

export interface DistributionProvider {

    fetch(limit: number): Promise<Distribution[]>;

    onReturned(distributions: Distribution[]): Promise<void>;

    onCompleted(distributions: Distribution[], signature: string): Promise<void>;
}
