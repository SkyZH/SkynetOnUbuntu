const debug = require('debug')('skynet:main');
import admin from './admin';
import { Model, IReport } from '@skyzh/tick';
import Service from './service';
import * as _ from 'lodash';
import * as NodeCache from 'node-cache'; 

const db = admin.firestore();
const raspiRef = db.collection('Mon_Raspi');
const cpuRef = raspiRef.doc('CPU');
const memRef = raspiRef.doc('Memory');

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

async function main() {
  const cpuModel = new Model<number>(
    'cpu',
    (data: number[]) => _.mean(data),
    (table: string, id: string) =>
      cpuRef
        .collection(table)
        .doc(id)
        .get()
        .then(d => Promise.resolve(d.exists ? +d.data()!.data : null))
  );
  const memModel = new Model<number>(
    'mem',
    (data: number[]) => _.mean(data) || 0,
    (table: string, id: string) =>
      memRef
        .collection(table)
        .doc(id)
        .get()
        .then(d => Promise.resolve(d.exists ? +d.data()!.data : null))
  );
  const service = new Service(cpuModel, memModel);
  while (true) {
    debug('Reporting Data...');
    const { cpuReport, memReport } = await service.report();
    debug('Saving Data...');
    await Promise.all([
      ..._.map(cpuReport, (report: IReport<number>) =>
        getPromise(cpuRef, report)
      ),
      ..._.map(memReport, (report: IReport<number>) =>
        getPromise(memRef, report)
      ),
    ]);
    debug('Sleeping...');
    await delay(3000);
  }
}

export default () => {
  main().then(d => false);
};
