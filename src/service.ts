const debug = require('debug')('skynet:service');
import * as os from 'os';
import { Model, IReport } from '@skyzh/tick';
import * as _ from 'lodash';
import * as moment from 'moment';
import * as child_process from 'child_process';

function getExec(
  cmd: string,
  args: string[],
  regex: RegExp
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    let result = '';
    const child = child_process.execFile(
      '/opt/vc/bin/vcgencmd',
      args,
      (err, stdout, stderr) => {
        result += stdout;
      }
    );
    child.on('close', code => {
      const mat = result.match(regex);
      if (mat) {
        resolve(+mat[1]);
      } else {
        resolve(null);
      }
    });
  });
}

function getTemp(): Promise<number | null> {
  return getExec('/opt/vc/bin/vcgencmd', ['measure_temp'], /temp=(.*)'C/);
}

function getVolt(): Promise<number | null> {
  return getExec(
    '/opt/vc/bin/vcgencmd',
    ['measure_volts', 'core'],
    /volt=(.*)V/
  );
}

let lstStatus: { [id: string]: number } = { user: 0, sys: 0, idle: 0 };

function getCpu(): number {
  const currentStatus: { [id: string]: number } = { user: 0, sys: 0, idle: 0 };
  _.forEach(os.cpus(), (cpu: any) => {
    _.forEach(['user', 'sys', 'idle'], key => currentStatus[key] += cpu.times[key]);
  });
  const deltaIdle = currentStatus.idle - lstStatus.idle;
  const deltaUser = currentStatus.user - lstStatus.user;
  const deltaSys = currentStatus.sys - lstStatus.sys;
  const result =  (deltaSys + deltaUser) / (deltaUser + deltaSys + deltaIdle);
  lstStatus = currentStatus;
  console.log(result);
  return result;
}

export default class Service {
  constructor(
    private cpuModel: Model<number>,
    private memModel: Model<number>,
    private temModel: Model<number>,
    private volModel: Model<number>
  ) {}

  public async report(): Promise<{ [name: string]: Array<IReport<number>> }> {
    const [cpuReport, memReport, temReport, volReport] = await Promise.all([
      this.cpuModel.report(getCpu(), moment(Date.now())),
      this.memModel.report(+(os.totalmem() - os.freemem()), moment(Date.now())),
      this.temModel.report((await getTemp()) || 0, moment(Date.now())),
      this.volModel.report((await getVolt()) || 0, moment(Date.now())),
    ]);
    return {
      cpuReport,
      memReport,
      temReport,
      volReport,
    };
  }
}
