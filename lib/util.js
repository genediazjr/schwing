import fp from 'fastify-plugin';
import sharp from 'sharp';

const getIp = (request) => {
  const ips = request.ips || request;
  let ip = '0.0.0.0';
  if (Array.isArray(ips)) {
    ip = ips[ips.length - 1];
  }

  return ip;
};

const fixMobile = (mobile) => {
  if (mobile) {
    if (mobile.startsWith('09')) {
      return `+63${mobile.substring(1)}`;
    } else if (mobile.startsWith('639')) {
      return `+${mobile}`;
    }
  }

  return mobile;
};

const resizeDataUri = async (dataUri, width, height) => {
  const res = await sharp(Buffer.from(dataUri.split(',')[1], 'base64')).resize(width, height).toBuffer();
  return `${dataUri.split(',')[0]},${res.toString('base64')}`;
};

const colFix = (model, col) => {
  if (col.includes('.')) {
    return col;
  }
  return !col.startsWith(`${model}.`)
    ? `${model}.${col}`
    : col;
};

const aggJSONb = (hasMany, script) => {
  if (hasMany) {
    return `jsonb_agg(${script})`;
  }
  return script;
};

const makeColumnJSON = (pg, cols, ali, as, hasMany) => {
  const alias = ali ? `"${ali}".` : '';
  let col;
  if (Array.isArray(cols) && cols.length) {
    let jsonCols = `${alias}"id"`;
    cols.forEach(jcol => {
      if (jcol.toLowerCase() !== 'id') {
        jsonCols += `, ${alias}"${jcol}"`;
      }
    });
    col = `to_json((SELECT x FROM (SELECT ${jsonCols}) x))`;
  } else {
    col = `to_json(${alias}*)`;
  }
  if (hasMany) {
    col = aggJSONb(hasMany, col);
  }
  if (as) {
    col = `${col} as ${as}`;
  }
  return pg.raw(col);
};

const makeAggObject = (pg, cols, ali, as) => {
  const alias = ali ? `"${ali}".` : '';
  let jsonCols = `'id',${alias}"id"`;
  cols.forEach(jcol => {
    if (typeof jcol === 'string') {
      if (jcol.toLowerCase() !== 'id') {
        jsonCols += `, '${jcol}', ${alias}"${jcol}"`;
      }
    } else {
      jsonCols += `, '${jcol.key}', ${jcol.value}`;
    }
  });
  let agg = `jsonb_agg(jsonb_build_object(${jsonCols}))`;
  if (as) {
    agg = `${agg} as ${as}`;
  }
  return pg.raw(agg);
};

const makeJSONQuery = (col, json, is = '=') => {
  return qb => {
    for (const key in json) {
      qb.whereRaw(`${col}->>'${key}' ${is} ?`, [json[key]]);
    }
  };
};

const makeSearchQuery = (args, model) => {
  return qb => {
    if (args.find) {
      if (model) {
        args.fields = args.fields.map(field => colFix(model, field));
        qb.where(`${model}.id`, 0);
      } else {
        qb.where('id', 0);
      }
      const keywords = args.find.split(' ');
      for (let i = 0; i < keywords.length; ++i) {
        const keyword = keywords[i].trim();
        if (keyword) {
          for (let j = 0; j < args.fields.length; ++j) {
            const field = args.fields[j];
            qb.orWhere(field, 'ilike', `${keyword}`);
            qb.orWhere(field, 'ilike', `${keyword}%`);
            qb.orWhere(field, 'ilike', `%${keyword}`);
            qb.orWhere(field, 'ilike', `%${keyword}%`);
          }
        }
      }
    }
  };
};

const eachAsync = async (collection, iterator) => {
  const tasks = [];
  if (Array.isArray(collection)) {
    for (let i = 0; i < collection.length; ++i) {
      tasks.push((async () => {
        await iterator(collection[i], i);
      })());
    }
  } else {
    for (const key in collection) {
      tasks.push((async () => {
        await iterator(collection[key], key);
      })());
    }
  }

  await Promise.all(tasks);
};

const isJSONObj = obj => {
  return obj !== null &&
    typeof obj === 'object' &&
    !(obj instanceof Date);
};

const isJSONStr = str => {
  try {
    if (isNaN(str)) {
      JSON.parse(str);
      return true;
    }
  } catch (ex) { }
  return false;
};

const toLowerCaseJSON = json => {
  return JSON.parse(JSON.stringify(json).toLowerCase());
};

const capitalize = str => {
  return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase();
};

const titleCase = str => {
  return str.replace(/_/gm, ' ').replace(/\w\S*/gm, capitalize);
};

const padString = (pad, size, str, isRight) => {
  let res = str || '';
  res = res.toString();
  while (res.length < size) {
    if (isRight) {
      res = `${res}${pad}`;
    } else {
      res = `${pad}${res}`;
    }
  }
  return res;
};

const toOrdinal = num => {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) {
    return `${num}st`;
  }
  if (j === 2 && k !== 12) {
    return `${num}nd`;
  }
  if (j === 3 && k !== 13) {
    return `${num}rd`;
  }
  return `${num}th`;
};

const toMonetary = (num, precision) => {
  let digits = precision;
  if (precision === null || isNaN(precision)) {
    digits = 2;
  }
  return parseFloat(num).toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
};

const getAge = (dob, returnObject) => {
  let years = 0;
  let days = this.date().diff(dob, 'days');
  if (days >= 365) {
    years = Math.floor(days / 365);
    days -= years * 365;
  }
  if (returnObject) {
    return { years, days };
  }
  return `${years}Y${days}D`;
};

async function util (fastify) {
  fastify.decorate('getIp', getIp);
  fastify.decorate('getAge', getAge);
  fastify.decorate('colFix', colFix);
  fastify.decorate('aggJSONb', aggJSONb);
  fastify.decorate('eachAsync', eachAsync);
  fastify.decorate('fixMobile', fixMobile);
  fastify.decorate('isJSONObj', isJSONObj);
  fastify.decorate('isJSONStr', isJSONStr);
  fastify.decorate('toOrdinal', toOrdinal);
  fastify.decorate('toMonetary', toMonetary);
  fastify.decorate('capitalize', capitalize);
  fastify.decorate('titleCase', titleCase);
  fastify.decorate('padString', padString);
  fastify.decorate('resizeDataUri', resizeDataUri);
  fastify.decorate('makeAggObject', makeAggObject);
  fastify.decorate('makeJSONQuery', makeJSONQuery);
  fastify.decorate('makeColumnJSON', makeColumnJSON);
  fastify.decorate('makeSearchQuery', makeSearchQuery);
  fastify.decorate('toLowerCaseJSON', toLowerCaseJSON);
}

export const GetIp = getIp;
export const GetAge = getAge;
export const ColFix = colFix;
export const AggJSONb = aggJSONb;
export const EachAsync = eachAsync;
export const FixMobile = fixMobile;
export const IsJSONObj = isJSONObj;
export const IsJSONStr = isJSONStr;
export const ToOrdinal = toOrdinal;
export const ToMonetary = toMonetary;
export const Capitalize = capitalize;
export const TitleCase = titleCase;
export const PadString = padString;
export const ResizeDataUri = resizeDataUri;
export const MakeAggObject = makeAggObject;
export const MakeJSONQuery = makeJSONQuery;
export const MakeColumnJSON = makeColumnJSON;
export const MakeSearchQuery = makeSearchQuery;
export const ToLowerCaseJSON = toLowerCaseJSON;
export default fp(util, { name: 'util' });
