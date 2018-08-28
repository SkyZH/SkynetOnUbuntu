const debug = require('debug')('skynet:main');
import admin from './admin';
import { Model, IReport } from '@skyzh/tick';
import Service from './service';
import * as _ from 'lodash';
import * as NodeCache from 'node-cache';

const db = admin.firestore();
const raspiRef = db.collection('Mon_Raspi');

const refs: { [id: string]: FirebaseFirestore.DocumentReference } = {
  cpu: raspiRef.doc('CPU'),
  memory: raspiRef.doc('Memory'),
  voltage: raspiRef.doc('Voltage'),
  temperature: raspiRef.doc('Temperature'),
};

const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

function getPromise<T>(
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

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function get_key(id: string): Promise<number> {
  return new Promise((resolve, reject) => {
    cache.get(id, (err, val) => {
      if (err) {
        reject(err);
      } else {
        if (!val) {
          reject(null);
        } else {
          resolve(val as number);
        }
      }
    });
  });
}

function proxyGet(
  name: string,
  table: string,
  id: string
): Promise<number | null> {
  return get_key(`${name}-${table}-${id}`).catch(err =>
    refs[name]
      .collection(table)
      .doc(id)
      .get()
      .then(d => Promise.resolve(d.exists ? +d.data()!.data : null))
  );
}

function proxyPut(name: string, report: IReport<number>): Promise<void> {
  cache.set(`${name}-${report.table}-${report.id}`, report.data);
  if (report.table !== 'second') {
    return getPromise(refs[name], report).then(p => Promise.resolve());
  } else {
    return Promise.resolve();
  }
}

async function main() {
  const cpuModel = new Model<number>(
    'cpu',
    (data: number[]) => _.mean(data),
    (table: string, id: string) => proxyGet('cpu', table, id)
  );
  const memModel = new Model<number>(
    'mem',
    (data: number[]) => _.mean(data) || 0,
    (table: string, id: string) => proxyGet('memory', table, id)
  );
  const volModel = new Model<number>(
    'voltage',
    (data: number[]) => _.mean(data),
    (table: string, id: string) => proxyGet('voltage', table, id)
  );
  const temModel = new Model<number>(
    'temperature',
    (data: number[]) => _.mean(data) || 0,
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
    await Promise.all([
      ..._.map(cpuReport, (report: IReport<number>) => proxyPut('cpu', report)),
      ..._.map(memReport, (report: IReport<number>) =>
        proxyPut('memory', report)
      ),
      ..._.map(temReport, (report: IReport<number>) =>
        proxyPut('temperature', report)
      ),
      ..._.map(volReport, (report: IReport<number>) =>
        proxyPut('voltage', report)
      ),
    ]);
    debug(`Data at ${new Date(Date.now())} reported`);
    debug(
      [
        `cpu: ${cpuReport[0].data}`,
        `memory: ${memReport[0].data}`,
        `temperature: ${temReport[0].data}`,
        `voltage: ${volReport[0].data}`,
      ].join('\n')
    );
    await delay(1000);
  }
}

export default () => {
  main().then(d => false);
};
