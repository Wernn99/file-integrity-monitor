import crypto from 'node:crypto';
import fs from 'node:fs';

/**
 * Calculates the SHA-256 hash of a file using streams to keep memory usage low.
 * @param {string} filepath 
 * @returns {Promise<string>} Hex representation of the SHA-256 hash
 */
export function calculateSha256(filepath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filepath);

    stream.on('data', (data) => {
      hash.update(data);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}
