const debug = require('debug')('skynet:main');
import { Model, IReport } from '@skyzh/tick';
import Service from './service';
import * as _ from 'lodash';
import { proxyGet, proxyPut } from './cache';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const cpuModel = new Model<number>(
    'cpu',
    (data: number[]) => _.mean(data),
    (table: string, id: string) => proxyGet('cpu', table, id)
  );
  const memModel = new Model<number>(
    'mem',
    (data: number[]) => _.mean(data),
    (table: string, id: string) => proxyGet('memory', table, id)
  );
  const volModel = new Model<number>(
    'voltage',
    (data: number[]) => _.mean(data),
    (table: string, id: string) => proxyGet('voltage', table, id)
  );
  const temModel = new Model<number>(
    'temperature',
    (data: number[]) => _.mean(data),
    (table: string, id: string) => proxyGet('temperature', table, id)
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
      ..._.map(cpuReport, (report: IReport<number>) => proxyPut('cpu', report)),
      ..._.map(memReport, (report: IReport<number>) => proxyPut('memory', report)),
      ..._.map(temReport, (report: IReport<number>) => proxyPut('temperature', report)),
      ..._.map(volReport, (report: IReport<number>) => proxyPut('voltage', report)),
    ]).then(res => {
      debug(`Data at ${currentTime} reported`);
      debug(
        [
          `cpu: ${cpuReport[0].data}`,
          `memory: ${memReport[0].data}`,
          `temperature: ${temReport[0].data}`,
          `voltage: ${volReport[0].data}`,
        ].join('\n')
      );
    });
    await delay(3000);
  }
}

export default () => {
  main().catch(debug);
};
