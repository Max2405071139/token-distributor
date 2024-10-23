import { DataSource } from "typeorm";
import { SecurityParams, TYPEORM_ENTITIES } from "../src";
import { DistributionEntity } from "./provider";
import * as log4js from "log4js";
import { PublicKey } from "@solana/web3.js";
import { getConnection } from "./axios";

/// configure Logger
log4js.configure({
    appenders: {
        default: {
            type: 'file',
            filename: 'logs/distribution.log',
            maxLogSize: 52428800, // 50M
            numBackups: 20
        }
    },
    categories: {
        default: { appenders: ['default'], level: 'info' },
    }
});

export const CONNECTION = getConnection("https://devnet.helius-rpc.com/?api-key=f9843088-3c79-4094-a869-a125c73598b1")

export const DATASOURCE = new DataSource({
    type: "mysql",
    host: "localhost",
    port: 3306,
    username: "root",
    password: "root123",
    database: "distribution",
    // synchronize: true,
    logging: false,
    entities: [...TYPEORM_ENTITIES, DistributionEntity],
});


export const SECURITY_PARAMS: SecurityParams = {
    walletPassword: "testtesttest",
    digestSalt: "testtesttest"
};

export const THE_MINT = new PublicKey("59ibD2AQQbcA3LJzXsdnPKt5NfDA6o9nXDac9UAJEnqt");