import fp from 'fastify-plugin';
import mime from 'mime-types';
import imagemin from 'imagemin';
import mozjpeg from 'imagemin-mozjpeg';
import pngquant from 'imagemin-pngquant';
import CryptRandStr from 'crypto-random-string';
import { fileTypeFromBuffer } from 'file-type';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

async function filestore (fastify, opts = {}) {
  const { config, log } = fastify;
  const { S3_BUCKET, S3_REGION, S3_PREFIX, NODE_ENV, ASSETSRC, ASSETSRC_DEV } = config;
  if (!S3_BUCKET || !S3_REGION) {
    fastify.decorateRequest('storeFile', async uri => uri);
    return;
  }

  const client = new S3Client({ region: S3_REGION });
  const assetsrc = NODE_ENV.startsWith('prod') ? ASSETSRC : ASSETSRC_DEV;
  let prefix = S3_PREFIX || '';
  if (prefix.startsWith('/')) {
    prefix = prefix.substr(1);
  }
  if (prefix.endsWith('/')) {
    prefix = prefix.substr(0, prefix.length - 1);
  }
  fastify.decorate('storeFile', storeFile);
  fastify.decorateRequest('storeFile', storeFile);

  async function storeFile (file, key = '', opt = {}) {
    let fileMime;
    let fileBuff = file;
    if (file.split) {
      const fileArr = file.split(',');
      fileMime = fileArr.shift().replace('data:', '').split(';')[0].toLowerCase();
      fileBuff = Buffer.from(fileArr.join(), 'base64');
    } else {
      const fileType = await fileTypeFromBuffer(file);
      fileMime = fileType.mime;
    }
    const fileHash = CryptRandStr({ length: opt.length || opts.storeFileLength || 64, type: 'hex' });
    const fileName = `${prefix}/${fileHash}${Date.now()}${key}.${mime.extension(fileMime)}`;
    const plugins = [];
    if (Array.isArray(opt.types) && !opt.types.includes(fileMime)) {
      throw new Error('file_type_not_allowed');
    }
    if (fileMime === 'image/jpeg') {
      plugins.push(mozjpeg({ quality: opts.jpegMaxQuality || 55 }));
    }
    if (fileMime === 'image/png') {
      plugins.push(pngquant({ strip: true, speed: opts.pngSpeed || 1 }));
    }
    const params = {
      Bucket: S3_BUCKET,
      Key: fileName,
      Body: plugins.length ? await imagemin.buffer(fileBuff, { plugins }) : fileBuff,
      ContentType: fileMime
    };
    try {
      const data = await client.send(new PutObjectCommand(params));
      const url = `${assetsrc}/${fileName}`;
      log.info(`filestore ${params.Bucket} saved ${data.ETag} ${url}`);
      return url;
    } catch (err) {
      log.error(`filestore ${params.Bucket} error ${params.Key}`);
      log.error(err);
      throw err;
    }
  }
}

export default fp(filestore, { name: 'filestore' });
