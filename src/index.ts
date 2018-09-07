const debug = require('debug')('skynet:main');
import { Model, IReport } from '@skyzh/tick';
import Service from './service';
import * as _ from 'lodash';
import { Cache } from './cache';
import admin from './admin';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const db = admin.database().ref(require('../data/database'));
  const cache = new Cache(db);
  const cpuModel = new Model<number>(
    'cpu',
    (data: number[]) => _.mean(data),
    (table: string, id: string) => cache.proxyGet('cpu', table, id)
  );
  const memModel = new Model<number>(
    'mem',
    (data: number[]) => _.mean(data),
    (table: string, id: string) => cache.proxyGet('memory', table, id)
  );
  const temModel = new Model<number>(
    'temperature',
    (data: number[]) => _.mean(data),
    (table: string, id: string) => cache.proxyGet('temperature', table, id)
  );
  const service = new Service(cpuModel, memModel, temModel);
  while (true) {
    debug('Gathering Data');
    const {
      cpuReport,
      memReport,
      temReport,
    } = await service.report();
    debug('Reporting Data');
    const currentTime = new Date(Date.now());
    Promise.all([
      ..._.map(cpuReport, (report: IReport<number>) => cache.proxyPut('cpu', report)),
      ..._.map(memReport, (report: IReport<number>) => cache.proxyPut('memory', report)),
      ..._.map(temReport, (report: IReport<number>) => cache.proxyPut('temperature', report)),
    ]).then(res => {
      debug(`Data at ${currentTime} reported`);
    });
    await delay(5000);
  }
}

export default () => {
  main().catch(debug);
};
