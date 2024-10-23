import { Column, DataSource, Entity, PrimaryColumn } from "typeorm";
import { Wallet, WalletRepository } from "../wallet";
import { PublicKey } from "@solana/web3.js";
import { sha256 } from "js-sha256";

const SALT = "?AlBy1BFj5okA;!j>5OcUh1HA\w1k.>/";

@Entity("wallets")
export class WalletEntity {
    @PrimaryColumn()
    id!: number;
    @Column()
    name!: string;
    @Column()
    address!: string;
    @Column()
    secret!: string;
    @Column()
    digest!: string;
    @Column({ name: "created_at" })
    createdAt!: Date;
}

export class TypeormWalletRepository implements WalletRepository {
    constructor(private readonly dataSource: DataSource, private readonly digestSalt: string) { }

    digest(entity: WalletEntity): string {
        return sha256(this.digestSalt + entity.name + entity.address + entity.secret + SALT);
    }

    async save(wallet: Wallet): Promise<void> {
        const entity = new WalletEntity();
        entity.name = wallet.name;
        entity.address = wallet.address.toBase58();
        entity.secret = wallet.secret;
        entity.createdAt = new Date();
        entity.digest = this.digest(entity);

        await this.dataSource.getRepository(WalletEntity).save(entity);
    }

    async getAll(): Promise<Wallet[]> {
        const repository = this.dataSource.getRepository(WalletEntity);
        const entities = await repository.find();

        return entities.map((e) => this.convert(e));
    }

    private convert(entity: WalletEntity): Wallet {
        const expectDigest = this.digest(entity);
        if (entity.digest != expectDigest) {
            throw new Error("data corruption");
        }

        return new Wallet(entity.name, new PublicKey(entity.address), entity.secret);
    }


    async getByName(name: string): Promise<Wallet | null> {
        const repository = this.dataSource.getRepository(WalletEntity);
        const entity = await repository.findOne({ where: { name } });
        if (entity == null) {
            return null;
        }

        return this.convert(entity);
    }

    async getByAddress(address: string | PublicKey): Promise<Wallet | null> {
        const repository = this.dataSource.getRepository(WalletEntity);
        const __address = typeof (address) == 'string' ? address : address.toBase58();

        const entity = await repository.findOne({ where: { address: __address } });
        if (entity == null) {
            return null;
        }

        return this.convert(entity);
    }

}
