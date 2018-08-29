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
  const db = admin.firestore().collection('Mac_Mon');
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
  const volModel = new Model<number>(
    'voltage',
    (data: number[]) => _.mean(data),
    (table: string, id: string) => cache.proxyGet('voltage', table, id)
  );
  const temModel = new Model<number>(
    'temperature',
    (data: number[]) => _.mean(data),
    (table: string, id: string) => cache.proxyGet('temperature', table, id)
  );
  const service = new Service(cpuModel, memModel, temModel, volModel);
  while (true) {
    debug('Gathering Data');
    const {
      cpuReport,
      memReport,
      temReport,
      volReport,
    } = await service.report();
    debug('Reporting Data');
    const currentTime = new Date(Date.now());
    Promise.all([
      ..._.map(cpuReport, (report: IReport<number>) => cache.proxyPut('cpu', report)),
      ..._.map(memReport, (report: IReport<number>) => cache.proxyPut('memory', report)),
      ..._.map(temReport, (report: IReport<number>) => cache.proxyPut('temperature', report)),
      ..._.map(volReport, (report: IReport<number>) => cache.proxyPut('voltage', report)),
    ]).then(res => {
      debug(`Data at ${currentTime} reported`);
    });
    await delay(3000);
  }
}

export default () => {
  main().catch(debug);
};
