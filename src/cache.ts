const debug = require('debug')('skynet:cache');
import * as NodeCache from 'node-cache';
import { Model, IReport } from '@skyzh/tick';
import * as _ from 'lodash';

const CACHE_MAP: { [id: string]: any } = {
  "second": { TTL: 60 * 60 * 3, cacheOnly: true },
  "minute": { TTL: 60 * 60 * 24 * 7, cacheOnly: false },
  "hour": { TTL: 60 * 60 * 24 * 30, cacheOnly: false },
  "day": { TTL: 60 * 60 * 24 * 300, cacheOnly: false },
  "month": { TTL: 60 * 60 * 24 * 300, cacheOnly: false }
}; 

export class Cache {
  private cache: NodeCache;
  private refs:  { [id: string]: FirebaseFirestore.DocumentReference };

  constructor(private baseRef: FirebaseFirestore.CollectionReference) {
    this.cache = new NodeCache({ stdTTL: 60 * 60 * 2, checkperiod: 60 * 5, errorOnMissing: true });
    this.refs = {
      cpu: baseRef.doc('CPU'),
      memory: baseRef.doc('Memory'),
      voltage: baseRef.doc('Voltage'),
      temperature: baseRef.doc('Temperature'),
    };
  }

  public proxyGet(
    name: string,
    table: string,
    id: string
  ): Promise<number | null> {
    return this.get_key(`${name}-${table}-${id}`, CACHE_MAP[table]).catch(err =>
      this.refs[name]
        .collection(table)
        .doc(id)
        .get()
        .then(d => Promise.resolve(d.exists ? +d.data()!.data : null))
    );
  }

  public proxyPut(name: string, report: IReport<number>): Promise<void> {
    const cachePromise = this.cacheSet(`${name}-${report.table}-${report.id}`, CACHE_MAP[report.table].TTL, report.data);
    if (report.table !== 'second') {
      debug(`${name}-${report.table}-${report.id} requested to write on remote database`);
      return Promise.all([cachePromise, this.getPromise(this.refs[name], report)])
        .then(d => debug(`${name}-${report.table}-${report.id} written to remote database`))
        .catch(err => debug(`${name}-${report.table}-${report.id} failed to write: ${err}`));
    } else {
      return cachePromise;
    }
  }

  private getPromise<T>(
    loc: FirebaseFirestore.DocumentReference,
    report: IReport<T>
  ) {
    return loc
      .collection(report.table)
      .doc(report.id)
      .set({
        timestamp: new Date(+report.id * 1000),
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
}
