import { Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { SecretEncryptor } from "./secret";
import bs58 from "bs58";

export class Wallet {
    constructor(public readonly name: string, public readonly address: PublicKey, public readonly secret: string) { }
}

export interface WalletRepository {
    save(wallet: Wallet): Promise<void>;

    getAll(): Promise<Wallet[]>;

    getByName(name: string): Promise<Wallet | null>;

    getByAddress(address: string | PublicKey): Promise<Wallet | null>;
}

export class WalletManager {
    private secretEncryptor: SecretEncryptor;

    constructor(password: string, private walletRepository: WalletRepository) {
        this.secretEncryptor = new SecretEncryptor(password);
    }

    async addWallet(name: string, secretKey: string) {
        if ((await this.walletRepository.getByName(name)) != null) {
            throw new Error(`Duplicated wallet name`);
        }

        const keypair = Keypair.fromSecretKey(bs58.decode(secretKey));
        if ((await this.walletRepository.getByAddress(keypair.publicKey.toBase58())) != null) {
            throw new Error(`Duplicated wallet`);
        }

        const wallet = new Wallet(name, keypair.publicKey, this.secretEncryptor.encrypt(secretKey));
        await this.walletRepository.save(wallet);
    }

    async getAll(): Promise<Wallet[]> {
        return await this.walletRepository.getAll();
    }

    async getByName(name: string): Promise<Wallet | null> {
        return await this.walletRepository.getByName(name);
    }

    async signTransaction(walletNames: string[], tx: Transaction | VersionedTransaction) {
        for (let walletName of walletNames) {
            const wallet = await this.walletRepository.getByName(walletName);
            if (wallet == null) {
                throw new Error(`Unknown wallet: ${walletName}`);
            }

            const decryptedSecret = this.secretEncryptor.decrypt(wallet.secret);
            const keypair = Keypair.fromSecretKey(bs58.decode(decryptedSecret));

            if ((tx as any).version != undefined) {
                (tx as VersionedTransaction).sign([keypair]);
            } else {
                (tx as Transaction).sign(keypair);
            }
        }
    }
}