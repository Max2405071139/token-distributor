import { Distribution } from "../types";


export type BatchTx = {
    readonly signature: string,
    readonly blockhash: string,
    readonly lastValidBlockHeight: number,
}

export const enum BatchState {
    Initialized = "Initialized",
    Processing = "Processing",
    Success = "Success",
    Failed = "Failed",
}

export class Batch {
    constructor(
        public readonly id: string,
        public readonly distributions: Distribution[],
        public readonly createdAt: Date,
        public state: BatchState,
        public walletName: string | null,
        public tx: BatchTx | null,
        public message: string | null,
        public processedAt: Date | null,
        public completedAt: Date | null,
    ) { }

    public process(walletName: string, tx: BatchTx) {
        if (this.state != BatchState.Initialized) {
            throw new Error(`illegal state: ${this.state}`);
        }

        this.state = BatchState.Processing;
        this.walletName = walletName;
        this.tx = tx;
        this.processedAt = new Date();
    }

    public succeed() {
        if (this.state != BatchState.Processing) {
            throw new Error(`illegal state: ${this.state}`);
        }

        this.state = BatchState.Success;
        this.completedAt = new Date();
    }

    public fail(message: string | null = null) {
        if (this.state != BatchState.Processing) {
            throw new Error(`illegal state: ${this.state}`);
        }

        this.state = BatchState.Failed;
        this.message = message;
        this.completedAt = new Date();
    }

    public retry(): { tx: BatchTx, message: string, processedAt: Date, completedAt: Date } {
        if (this.state != BatchState.Failed) {
            throw new Error(`illegal state: ${this.state}`);
        }

        const result = {
            walletName: this.walletName!, 
            tx: this.tx!,
            message: this.message!,
            processedAt: this.processedAt!,
            completedAt: this.completedAt!,
        }

        this.state = BatchState.Initialized;
        this.walletName = null;
        this.tx = null;
        this.message = null;
        this.processedAt = null;
        this.completedAt = null;

        return result;
    }
}