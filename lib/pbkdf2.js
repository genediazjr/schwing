// https://gist.github.com/skeggse/52672ddee97c8efec269
import fp from 'fastify-plugin';
import { pbkdf2Sync, randomBytes } from 'crypto';
const defaults = {
  iterations: 872791,
  hashBytes: 32,
  saltBytes: 16,
  encoding: 'base64',
  digest: 'sha512'
};

// PBKDF2_HASHBYTES
// size of the generated hash
//
// PBKDF2_SALTBYTES
// larger salt means hashed passwords are more resistant to rainbow table,
// but you get diminishing returns pretty fast
//
// PBKDF2_ITERATIONS
// more iterations means an attacker has to take longer to brute force an
// individual password, so larger is better. however, larger also means longer
// to hash the password. tune so that hashing the password takes about a second

/**
 * Hash a password using Node's asynchronous pbkdf2 (key derivation) function.
 *
 * Returns a self-contained buffer which can be arbitrarily encoded for storage
 * that contains all the data needed to verify a password.
 *
 * @param {!String} password
 * @return {!function(?Error, ?Buffer=)}
 */
function hashPassword (password, opts) {
  opts = { ...defaults, ...opts };
  // generate a salt for pbkdf2
  const salt = randomBytes(opts.saltBytes);
  const hash = pbkdf2Sync(password, salt, opts.iterations, opts.hashBytes, opts.digest);
  const hashed = Buffer.from(new ArrayBuffer(hash.length + salt.length + 8));

  // include the size of the salt so that we can, during verification,
  // figure out how much of the hash is salt
  hashed.writeUInt32BE(salt.length, 0, true);
  // similarly, include the iteration count
  hashed.writeUInt32BE(opts.iterations, 4, true);

  salt.copy(hashed, 8);
  hash.copy(hashed, salt.length + 8);

  return hashed.toString(opts.encoding);
}

/**
 * Verify a password using Node's asynchronous pbkdf2 (key derivation) function.
 *
 * Accepts a hash and salt generated by hashPassword, and returns whether the
 * hash matched the password (as a boolean).
 *
 * @param {!String} password
 * @param {!Buffer} combined Buffer containing hash and salt as generated by hashPassword.
 * @return {!function(?Error, !boolean)}
 */
function verifyPassword (password, hashed, opts) {
  opts = { ...defaults, ...opts };
  // extract the salt and hash from the combined buffer
  hashed = Buffer.from(hashed, opts.encoding);
  const saltBytes = hashed.readUInt32BE(0);
  const hashBytes = hashed.length - saltBytes - 8;
  const iterations = hashed.readUInt32BE(4);
  const salt = hashed.slice(8, saltBytes + 8);
  const hash = hashed.toString('binary', saltBytes + 8);

  // verify the salt and hash against the password
  const verify = pbkdf2Sync(password, salt, iterations, hashBytes, opts.digest);

  return verify.toString('binary') === hash;
}

async function Pbkdf2 (fastify) {
  const { config } = fastify;
  const opts = {
    ...defaults,
    iterations: config.PBKDF2_ITERATIONS,
    hashBytes: config.PBKDF2_HASHBYTES,
    saltBytes: config.PBKDF2_SALTBYTES,
    encoding: config.PBKDF2_ENCODING,
    digest: config.PBKDF2_DIGEST
  };

  fastify.decorate('pbkdf2', {
    hashPassword: password => hashPassword(password, opts),
    verifyPassword: (password, hashed) => verifyPassword(password, hashed, opts)
  });
}

export const HashPassword = hashPassword;
export const VerifyPassword = verifyPassword;
export default fp(Pbkdf2, { name: 'pbkdf2' });
