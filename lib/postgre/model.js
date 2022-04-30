import { MakeSearchQuery, MakeColumnJSON, MakeAggObject, ColFix } from '../util.js';
import assert from 'assert';
import qs from 'qs';

const checkId = (column, value) => {
  return isNaN(value) && (
    column.toLowerCase() === 'id' ||
    column.toLowerCase().endsWith('.id') ||
    column.toLowerCase().endsWith('_id'));
};

class Model {
  constructor (postgre) {
    this.postgre = postgre;
  }

  subQuery (ref) {
    assert(Array.isArray(ref.columns), `Columns required for hasMany2 in ${this.model} references`);
    const alias = ref.alias || ref.hasMany2;
    const query = this.postgre(`${ref.hasMany2} as ${alias}`).select(MakeAggObject(this.postgre, ref.columns, alias));
    if (ref.where) {
      query.where(ref.where);
    } else {
      query.where(ref.reference || `${alias}.${this.model}_id`, this.postgre.ref(ref.column || `${this.model}.id`));
    }
    query.as(ref.as || ref.column || ref.hasMany2);
    return query;
  }

  async isCreator (id, userId) {
    const res = await this.postgre(this.model)
      .count('id').where({ id, created_by: userId });
    return res[0].count;
  }

  async isEnabled (id) {
    const res = await this.postgre(this.model)
      .count('id').where({ id, is_enabled: true });
    return res[0].count;
  }

  async isDeleted (id) {
    const res = await this.postgre(this.model)
      .count('id').where({ id, is_deleted: true });
    return res[0].count;
  }

  async getColumn (id, column) {
    const res = await this.postgre(this.model)
      .select(column).where({ id });
    return res[0] && res[0][column];
  }

  /**
   *
   * @param {*} column - column name or where object
   * @param {*} value - if column is string, value is the value to match
   * @returns {number} - count of matching records
   */
  async countAll (column, value) {
    const query = this.postgre(this.model).count('id');
    if (column && value) {
      query.where(column, value);
    }
    if (typeof column === 'object' ||
      typeof column === 'function') {
      query.where(column);
    }
    const res = await query;
    return parseInt(res[0].count);
  }

  /**
   *
   * @param {*} params
   * - page
   * - pageSize
   * - find
   * - fields
   * @param {*} full
   * - if true, will return object with other details
   * @returns {object}
   * - data
   * - page or offset
   * - pageSize or limit
   * - total
   */
  async getAll (params, opts = {}) {
    params = params || {};
    params.limit = params.limit || 0;
    let where = params.where || {};
    if (Object.keys(params).includes('sort[0][column]')) {
      params.sort = qs.parse(params).sort;
    }
    if (params.sort) {
      params.orderBy = params.sort;
    }
    if (params.pageSize) {
      params.limit = params.pageSize;
    }
    if (params.page) {
      params.offset = params.limit * (params.page - 1);
    }
    if (!params.offset || params.offset < 0) {
      params.offset = 0;
    }
    if (params.find && Array.isArray(params.fields) && params.fields.length) {
      where = (qb) => {
        qb.where(params.where || {})
          .andWhere(MakeSearchQuery({
            find: params.find,
            fields: params.fields.map(f => ColFix(this.model, f))
          }, this.model));
      };
    }
    params.references = params.references || this.references || [];
    assert(Array.isArray(params.references), `References of ${this.model} must be an array`);
    const query = this.postgre(this.model);
    const selects = [];
    if (params.columns) {
      selects.push(`${this.model}.id`);
      params.columns.forEach(col => {
        if (typeof col === 'string') {
          if (col.toLowerCase() !== 'id') {
            selects.push(ColFix(this.model, col));
          }
        } else {
          selects.push(col);
        }
      });
    } else {
      selects.push(`${this.model}.*`);
    }

    let hasManyCount = 0;
    let hasMany2 = false;
    let hasMany = false;
    params.references.forEach(ref => {
      if (ref.hasMany2) {
        hasMany2 = true;
      }
      if (ref.hasMany) {
        hasMany = true;
        hasManyCount++;
      }
    });
    assert(hasManyCount < 2, `hasMany on ${this.model} is only allowed once. use hasMany2 instead.`);

    params.references.forEach(ref => {
      const alias = ref.alias || `x${ref.column || ref.hasOne || ref.hasMany}`;
      const as = ref.as || ref.column || ref.hasOne || ref.hasMany;
      if (ref.hasOne) {
        selects.push(MakeColumnJSON(this.postgre, ref.columns, alias, as, hasMany || hasMany2));
      } else if (ref.hasMany) {
        assert(Array.isArray(ref.columns), `Columns required for hasMany in ${this.model} references`);
        selects.push(MakeAggObject(this.postgre, ref.columns, alias, as));
      } else if (typeof ref.hasMany2 === 'string') {
        selects.push(this.subQuery(ref));
      } else if (typeof ref.hasMany2 === 'object') {
        selects.push(ref.hasMany2);
      } else if (typeof ref.hasMany2 === 'function') {
        selects.push(ref.hasMany2());
      } else {
        throw new Error(`Missing hasOne, hasMany, or hasMany2 for ${this.model} references`);
      }
    });

    query.select(selects);

    if (typeof where === 'object') {
      const newwhere = {};
      for (const field in where) {
        newwhere[ColFix(this.model, field)] = where[field];
      }
      query.where(newwhere);
    } else {
      query.where(where);
    }
    if (opts.where) {
      if (typeof opts.where === 'object') {
        const optwhere = {};
        for (const field in opts.where) {
          optwhere[ColFix(this.model, field)] = opts.where[field];
        }
        query.where(optwhere);
      } else {
        query.where(opts.where);
      }
    }
    if (opts.trx) {
      query.transacting(opts.trx);
    }

    if (Array.isArray(params.orderBy) && params.orderBy.length) {
      if (params.orderBy.length === 1 && params.orderBy[0].column === 'updated_at') {
        query.orderByRaw(`"${this.model}"."updated_at" ${params.orderBy[0].order === 'asc' ? 'asc' : 'desc'} NULLS LAST`);
      } else {
        query.orderBy(params.orderBy.map(o => ({
          order: o.order,
          column: ColFix(this.model, o.column)
        })));
      }
    } else {
      query.orderBy([{
        column: `${this.model}.created_at`,
        order: 'desc'
      }]);
    }

    params.references.forEach(ref => {
      if (ref.hasMany2) {
        return;
      }
      const alias = ref.alias || `x${ref.column || ref.hasOne || ref.hasMany}`;
      let colum = ref.column || `${this.model}.${ref.hasOne}_id`;
      let refer = ref.reference || `${alias}.id`;
      if (ref.hasMany) {
        colum = ref.column || `${this.model}.id`;
        refer = ref.reference || `${alias}.${this.model}_id`;
      }
      const joins = `${ref.hasOne || ref.hasMany} as ${alias}`;
      if (ref.join) {
        assert(ref.alias, `Alias is required when using join param ${this.model} getAll`);
        query.leftJoin(joins, ref.join);
      } else {
        query.leftJoin(joins, ColFix(this.model, colum), ColFix(alias, refer));
      }
    });

    if (hasMany || hasMany2) {
      query.groupByRaw('1');
    }

    const count = await this.postgre(this.model)
      .from(query.clone().offset(0).clear('order').as('count__query__'))
      .count('* as total')
      .first();

    query.offset(params.offset);
    if (params.limit) {
      query.limit(params.limit);
    }

    const data = await query;

    params.references.forEach(ref => {
      if (ref.hasMany || ref.hasMany2) {
        const as = ref.as || ref.column || ref.hasMany || ref.hasMany2;
        data.forEach(d => {
          if (Array.isArray(d[as]) && (d[as].length === 0 || (d[as].length === 1 && !d[as][0].id))) {
            d[as] = null;
          }
        });
      } else {
        const as = ref.as || ref.column || ref.hasOne;
        data.forEach(d => {
          if (Array.isArray(d[as]) && d[as].length) {
            d[as] = d[as][0];
          }
          if (d[as] && !d[as].id) {
            d[as] = null;
          }
        });
      }
    });

    const res = { data, total: parseInt(count.total) };
    if (params.page) {
      res.page = params.page;
    } else {
      res.offset = params.offset;
    }
    if (params.pageSize) {
      res.pageSize = params.pageSize;
    } else {
      res.limit = params.limit;
    }
    res.find = params.find || '';
    return opts.query ? res : res.data;
  }

  /**
   *
   * @param {*} column - column name or where object
   * @param {*} value - value to match
   * @returns {object} - matching record
   */
  async getOne (column, value, opts) {
    assert(column, `Missing column for ${this.model} getOne`);
    let query;
    if (typeof column === 'object') {
      const newwhere = {};
      let hasFailId = false;
      for (const field in column) {
        hasFailId = checkId(field, column[field]);
        newwhere[ColFix(this.model, field)] = column[field];
      }
      if (hasFailId) {
        return null;
      }
      query = this.getAll({ where: newwhere }, opts);
    } else if (!opts && typeof value === 'object') {
      query = this.getAll(column, value);
    } else if (!opts && !value) {
      query = this.getAll(column);
    } else {
      if (checkId(column, value)) {
        return null;
      }
      query = this.getAll({ where: { [column]: value } }, opts);
    }
    const res = await query;
    assert(res.length <= 1, `Found multiple results for ${this.model} getOne ${column} ${value}`);
    return res[0];
  }

  async add (data, opts = {}) {
    if (this.addFormat) {
      data = this.addFormat(data);
    }
    const query = this.postgre(this.model)
      .returning('*')
      .insert(data);
    if (opts.trx) {
      query.transacting(opts.trx);
    }
    const res = await query;
    return res[0];
  }

  /**
   *
   * @param {*} data - new data. if id is present, will update matching id.
   * @param {*} match - optional. where object to match.
   * @param {*} opts - optional. will insert if no match.
   * @returns {object} - updated record
   */
  async edit (data, match = {}, opts = {}) {
    if (this.editFormat) {
      data = this.editFormat(data);
    }
    assert(data.id || match, `Missing id or match for ${this.model} edit`);
    if (this.updated_at || this.updatedAt) {
      data.updated_at = new Date();
    }
    const query = this.postgre(this.model)
      .returning('*')
      .update(data);
    if (match.trx || opts.trx) {
      query.transacting(match.trx || opts.trx);
    }
    if (data.id) {
      query.where('id', data.id);
    } else if (typeof match === 'function' || (typeof match === 'object' && !match.trx && Object.keys(match).length)) {
      query.where(match);
      if (!opts.multiple) {
        const matches = await this.countAll(match);
        assert(matches <= 1, `Found multiple results ${matches} for ${this.model} edit ${JSON.stringify(match)}. Set multiple option to true.`);
      }
    } else {
      throw new Error(`No matching condition for edit of ${this.model}.`);
    }
    let res = await query;
    if (res.length === 0 && opts.upsert) {
      if (data.updated_by) {
        data.created_by = data.updated_by;
        delete data.updated_by;
      }
      res = await this.postgre(this.model)
        .returning('*')
        .insert({ ...match, ...data });
    }
    return res[0];
  }

  /**
   *
   * @param {*} colval
   * @param {*} match
   * @param {*} opts
   * @returns
   */
  async decrement (colval, match, opts = {}) {
    const query = this.postgre(this.model)
      .decrement(colval)
      .where(match);
    if (opts.trx) {
      query.transacting(opts.trx);
    }
    const res = await query;
    return res[0];
  }

  /**
   *
   * @param {*} colval
   * @param {*} match
   * @param {*} opts
   * @returns
   */
  async increment (colval, match, opts = {}) {
    const query = this.postgre(this.model)
      .increment(colval)
      .where(match);
    if (opts.trx) {
      query.transacting(opts.trx);
    }
    const res = await query;
    return res[0];
  }

  /**
   * soft delete
   * @param {*} id - id or where object
   * @param {*} opts
   * @returns
   */
  async delete (id, opts = {}) {
    assert(id, `Missing id for ${this.model} delete`);
    const query = this.postgre(this.model)
      .returning('*')
      .update({ is_deleted: true });
    if (opts.trx) {
      query.transacting(opts.trx);
    }
    if (parseInt(id)) {
      query.where('id', id);
    } else {
      query.where(id);
    }
    const res = await query;
    return res;
  }
}

const querySchema = {
  page: {
    type: 'integer'
  },
  pageSize: {
    type: 'integer'
  },
  find: {
    type: 'string'
  },
  sort: {
    type: 'array'
  },
  'sort[0][order]': {
    type: 'string'
  },
  'sort[0][column]': {
    type: 'string'
  }
};

export { querySchema };
export default Model;
