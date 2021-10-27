const crypto = require("crypto");
require("dotenv").config();

const algorithm = "aes-256-ctr";
const secretKey = process.env.ENCRYPTION_KEY;

module.exports = {
  encrypt: (text) => {
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return {
      iv: iv.toString("hex"),
      content: encrypted.toString("hex"),
    };
  },

  decrypt: (content, iv) => {
    const decipher = crypto.createDecipheriv(
      algorithm,
      secretKey,
      Buffer.from(iv, "hex")
    );

    const decrpyted = Buffer.concat([
      decipher.update(Buffer.from(content, "hex")),
      decipher.final(),
    ]);

    return decrpyted.toString();
  },
};
