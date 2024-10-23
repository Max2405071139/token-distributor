import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY_SALT = "[*l.[`G=]N37qhYHS$&~O'F}+0}&VCwG";
const IV_SALT = "4=e:$=SnQEZJ+%a?{6T{AG{@fRr^h%c[";

export class SecretEncryptor {
    constructor(private password: string) {
        if (password.length < 8) {
            throw new Error("Illegal password for secret encryptor");
        }
    }

    private getKeyAndIv(): { key: string, iv: string } {
        const key = crypto
            .createHash('sha512')
            .update(this.password + KEY_SALT)
            .digest('hex')
            .substring(0, 32)
        const iv = crypto
            .createHash('sha512')
            .update(this.password + IV_SALT)
            .digest('hex')
            .substring(0, 16)

        return { key, iv };
    }

    public encrypt(text: string): string {
        const { key, iv } = this.getKeyAndIv();
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    public decrypt(encryptedText: string): string {
        const { key, iv } = this.getKeyAndIv();
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf-8');
        return decrypted;
    }

}