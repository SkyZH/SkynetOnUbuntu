const debug = require('debug')('skynet:cache');
import * as NodeCache from 'node-cache';
import { Model, IReport } from '@skyzh/tick';
import * as _ from 'lodash';
import { database as Database } from 'firebase-admin';
import * as moment from 'moment';
import { resolve } from 'url';

const CACHE_MAP: { [id: string]: any } = {
  "second": { TTL: 60 * 60 * 3, cacheOnly: true, retain: 60 * 60 * 24 },
  "minute": { TTL: 60 * 60 * 24 * 7, cacheOnly: false, retain: 60 * 60 * 24 * 7 },
  "hour": { TTL: 60 * 60 * 24 * 30, cacheOnly: false },
  "day": { TTL: 60 * 60 * 24 * 300, cacheOnly: false },
  "month": { TTL: 60 * 60 * 24 * 300, cacheOnly: false }
}; 

export class Cache {
  private cache: NodeCache;
  private refs:  { [id: string]: Database.Reference };

  constructor(private baseRef: Database.Reference) {
    this.cache = new NodeCache({ stdTTL: 60 * 60 * 3, checkperiod: 60 * 5, errorOnMissing: true });
    this.refs = {
      cpu: baseRef.child('CPU'),
      memory: baseRef.child('Memory'),
      temperature: baseRef.child('Temperature'),
    };
    setTimeout(() => this.clearDatabase().then(d => debug('Database cleared')).catch(debug), 60 * 60 * 1000);
    this.clearDatabase().then(d => debug('Initial database cleared')).catch(debug);
  }

  public proxyGet(
    name: string,
    table: string,
    id: string
  ): Promise<number | null> {
    return this.get_key(`${name}-${table}-${id}`, CACHE_MAP[table]).catch(err =>
      this.refs[name]
        .child(table)
        .child(id)
        .once('value')
        .then(d => Promise.resolve(d.exists() ? +d.val()!.data : null))
    );
  }

  public proxyPut(name: string, report: IReport<number>): Promise<void> {
    const cachePromise = this.cacheSet(`${name}-${report.table}-${report.id}`, CACHE_MAP[report.table].TTL, report.data);
    debug(`${name}-${report.table}-${report.id} requested to write on remote database`);
    return Promise.all([cachePromise, this.getPromise(this.refs[name], report)])
      .then(d => debug(`${name}-${report.table}-${report.id} written to remote database`))
      .catch(err => debug(`${name}-${report.table}-${report.id} failed to write: ${err}`));
  }

  private getPromise<T>(
    loc:  Database.Reference,
    report: IReport<T>
  ) {
    return loc
      .child(report.table)
      .child(report.id)
      .set({
        timestamp: +report.id,
        data: report.data,
      });
  }
    
  private cacheSet(key: string, TTL: number, data: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cache.set(key, data, TTL, (err, res) => resolve())
    });
  }
  
  private get_key(id: string, policy: any): Promise<number | null> {
    return new Promise((resolve, reject) => {
      this.cache.get(id, (err, val) => {
        if (val) {
          resolve(+val);
        } else {
          if (policy.cacheOnly) {
            resolve(null);
          } else {
            debug(`cache miss on ${id}`);
            reject(err || _.isUndefined(val));
          }
        }
      });
    });
  }


  private clearDatabase(): Promise<void> {
    const promises: Array<Promise<void>> = [];
    for (const key of _.keys(this.refs)) {
      const ref = this.refs[key];
      for (const table of _.keys(CACHE_MAP)) {
        const cachePolicy = CACHE_MAP[table];
        if (cachePolicy.retain) {
          const endAt = moment(Date.now() - cachePolicy.retain * 1000).unix();
          promises.push(ref.child(table)
            .orderByKey()
            .endAt(`${endAt}`)
            .once('value')
            .then(data => {
              const removes: Array<Promise<void>> = [];
              data.forEach(d => {
                if (+d.key! < endAt) {
                  debug(`${key}-${table}-${d.key} requested to remove`);
                  removes.push(ref.child(table).child(d.key!).remove());
                }
                return true;
              });
              return Promise.all(removes);
            }).then(d => { return })
          )
        }
      }
    }
    return Promise.all(promises).then(d => { return });
  }
}
